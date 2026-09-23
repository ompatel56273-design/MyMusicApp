import type {
  GalaxyGraph,
  GalaxyNode,
  GalaxyEdge,
  GalaxyFilterOptions,
  GalaxySettings
} from '../../domain/entities/galaxy-types';
import { DEFAULT_GALAXY_SETTINGS } from '../../domain/entities/galaxy-types';
import type { ILibraryService, IPlaylistService, IGalaxyService } from '../contracts/service-contracts';
import type { StatsService } from '../stats/stats-service';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import type { Track, Album } from '../../domain/entities/models';
import { STORES } from '../../data/db/schema';
import { GalaxyLayoutEngine } from './galaxy-layout-engine';
import { Logger } from '../../core/logging/logger';

export interface GalaxyServiceDependencies {
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
  statsService?: StatsService | undefined;
  database?: IDatabaseAdapter | undefined;
}

/**
 * Concrete Audio Galaxy Service.
 * Constructs and caches deterministic graph nodes and edges from the real local music library.
 * Preserves strict service boundaries (no direct IndexedDB or raw repository access from UI).
 */
export class GalaxyService implements IGalaxyService {
  private static readonly SETTINGS_KEY = 'galaxy_settings';
  private readonly logger = new Logger('GalaxyService');
  private readonly libraryService: ILibraryService;
  private readonly playlistService?: IPlaylistService | undefined;
  private readonly statsService?: StatsService | undefined;
  private readonly database?: IDatabaseAdapter | undefined;
  private readonly layoutEngine = new GalaxyLayoutEngine();

  private cachedGraph: GalaxyGraph | null = null;
  private cachedSettings: GalaxySettings = { ...DEFAULT_GALAXY_SETTINGS };
  private isSettingsLoaded = false;

  constructor(deps: GalaxyServiceDependencies) {
    this.libraryService = deps.libraryService;
    this.playlistService = deps.playlistService;
    this.statsService = deps.statsService;
    this.database = deps.database;
  }

  public async getGraph(filter?: GalaxyFilterOptions): Promise<GalaxyGraph> {
    if (this.cachedGraph && !filter) {
      return this.cachedGraph;
    }

    this.logger.info('Generating real Audio Galaxy graph from library...');
    const graph = await this.buildGraph(filter);

    if (!filter) {
      this.cachedGraph = graph;
    }

    return graph;
  }

  public invalidateCache(): void {
    this.cachedGraph = null;
    this.logger.info('Galaxy graph cache invalidated.');
  }

  public async getSettings(): Promise<GalaxySettings> {
    if (!this.isSettingsLoaded && this.database) {
      try {
        const record = await this.database.get<{ key: string; value: GalaxySettings }>(
          STORES.SETTINGS,
          GalaxyService.SETTINGS_KEY
        );
        if (record && record.value) {
          this.cachedSettings = this.sanitizeSettings(record.value);
        }
      } catch (err) {
        this.logger.warn('Failed to load galaxy settings from DB, using defaults:', { error: String(err) });
        this.cachedSettings = { ...DEFAULT_GALAXY_SETTINGS };
      }
      this.isSettingsLoaded = true;
    }
    return { ...this.cachedSettings };
  }

  public async saveSettings(partial: Partial<GalaxySettings>): Promise<GalaxySettings> {
    const current = await this.getSettings();
    const merged = { ...current, ...partial };
    const sanitized = this.sanitizeSettings(merged);
    this.cachedSettings = sanitized;

    if (this.database) {
      try {
        await this.database.put(STORES.SETTINGS, {
          key: GalaxyService.SETTINGS_KEY,
          value: sanitized
        });
      } catch (err) {
        this.logger.error('Failed to persist galaxy settings:', { error: String(err) });
      }
    }

    return { ...this.cachedSettings };
  }

  private async buildGraph(filter?: GalaxyFilterOptions): Promise<GalaxyGraph> {
    // 1. Fetch real entity collections from authoritative services
    const [artistsRes, albumsRes, tracksRes, genresRes, folders, playlistsRes, recentHistory] = await Promise.all([
      this.libraryService.listArtists({ limit: 500 }),
      this.libraryService.listAlbums({ limit: 1000 }),
      this.libraryService.listTracks({ limit: 2500 }),
      this.libraryService.listGenres({ limit: 100 }),
      this.libraryService.listFolders(),
      this.playlistService ? this.playlistService.listPlaylists({ limit: 100 }) : { items: [] },
      this.statsService ? this.statsService.getRecentHistory(15).catch(() => []) : Promise.resolve([])
    ]);

    const artists = artistsRes.items;
    const albums = albumsRes.items;
    const tracks = tracksRes.items;
    const genres = genresRes.items;
    const playlists = playlistsRes.items;

    // Create a map for recent history ordering
    const recentPlayMap = new Map<string, number>();
    recentHistory.forEach((h, idx) => {
      recentPlayMap.set(h.track.id, idx + 1);
    });

    // Group tracks by album and artist for relational metadata
    const tracksByAlbum = new Map<string, Track[]>();
    const tracksByArtist = new Map<string, Track[]>();
    const tracksByGenre = new Map<string, Track[]>();
    const albumsByArtist = new Map<string, Album[]>();

    for (const t of tracks) {
      if (t.albumId) {
        const list = tracksByAlbum.get(t.albumId) || [];
        list.push(t);
        tracksByAlbum.set(t.albumId, list);
      }
      if (t.artistId) {
        const list = tracksByArtist.get(t.artistId) || [];
        list.push(t);
        tracksByArtist.set(t.artistId, list);
      }
      if (t.genreId) {
        const list = tracksByGenre.get(t.genreId) || [];
        list.push(t);
        tracksByGenre.set(t.genreId, list);
      }
    }

    for (const al of albums) {
      if (al.artistId) {
        const list = albumsByArtist.get(al.artistId) || [];
        list.push(al);
        albumsByArtist.set(al.artistId, list);
      }
    }

    const nodeMap = new Map<string, GalaxyNode>();
    const edgeSet = new Set<string>();
    const edges: GalaxyEdge[] = [];

    // Helper to add nodes safely without duplicates
    const addNode = (node: GalaxyNode) => {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
      }
    };

    // Helper to add edges safely without duplicates
    const addEdge = (sourceId: string, targetId: string, type: GalaxyEdge['type'], weight = 1) => {
      const edgeId = `edge:${sourceId}-${targetId}`;
      if (!edgeSet.has(edgeId) && nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        edgeSet.add(edgeId);
        edges.push({
          id: edgeId,
          sourceId,
          targetId,
          type,
          weight,
          color: 'rgba(255, 255, 255, 0.15)'
        });
      }
    };

    // 2. Build Genre Nodes (LOD 1 - 4) with dynamic sizing based on real volume
    for (const g of genres) {
      if (!g.name) continue;
      const genreTracks = tracksByGenre.get(g.id) || [];
      const genrePlayCount = genreTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      const trackCount = g.trackCount ?? genreTracks.length;
      const radius = Math.min(52, Math.max(28, 28 + Math.log2(trackCount + 1) * 4));

      addNode({
        id: `genre:${g.id}`,
        type: 'genre',
        entityId: g.id,
        label: g.name,
        x: 0,
        y: 0,
        radius,
        color: '#a855f7',
        lodMin: 1,
        lodMax: 4,
        metadata: {
          trackCount,
          playCount: genrePlayCount,
          trackList: genreTracks.slice(0, 50).map(t => ({
            id: t.id,
            title: t.title,
            durationMs: t.durationMs,
            isFavorite: t.isFavorite,
            playCount: t.playCount
          }))
        }
      });
    }

    // 3. Build Artist Nodes (LOD 1 - 4)
    for (const a of artists) {
      const artistTracks = tracksByArtist.get(a.id) || [];
      const artistAlbums = albumsByArtist.get(a.id) || [];
      const artistPlayCount = artistTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      const trackCount = a.trackCount ?? artistTracks.length;
      const hasFavorites = artistTracks.some(t => t.isFavorite);
      const radius = Math.min(38, Math.max(18, 18 + Math.log2(trackCount + 1) * 3));

      addNode({
        id: `artist:${a.id}`,
        type: 'artist',
        entityId: a.id,
        label: a.name || 'Unknown Artist',
        x: 0,
        y: 0,
        radius,
        color: '#3b82f6',
        lodMin: 1,
        lodMax: 4,
        artworkId: a.artworkId,
        metadata: {
          trackCount,
          albumCount: a.albumCount ?? artistAlbums.length,
          playCount: artistPlayCount,
          isFavorite: hasFavorites,
          albumList: artistAlbums.map(al => ({
            id: al.id,
            title: al.title,
            year: al.year,
            trackCount: al.trackCount
          })),
          trackList: artistTracks.slice(0, 50).map(t => ({
            id: t.id,
            title: t.title,
            durationMs: t.durationMs,
            isFavorite: t.isFavorite,
            playCount: t.playCount
          }))
        }
      });
    }

    // 4. Build Album Nodes (LOD 2 - 4)
    for (const al of albums) {
      const albumTracks = tracksByAlbum.get(al.id) || [];
      const albumPlayCount = albumTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      const trackCount = al.trackCount ?? albumTracks.length;
      const hasFavorites = albumTracks.some(t => t.isFavorite);
      const radius = Math.min(24, Math.max(12, 12 + Math.log2(trackCount + 1) * 2));

      addNode({
        id: `album:${al.id}`,
        type: 'album',
        entityId: al.id,
        label: al.title || 'Unknown Album',
        x: 0,
        y: 0,
        radius,
        color: '#ff6b00',
        lodMin: 2,
        lodMax: 4,
        artworkId: al.artworkId,
        metadata: {
          artistName: al.artistName,
          trackCount,
          durationMs: al.durationMs,
          year: al.year,
          isCompilation: al.isCompilation,
          playCount: albumPlayCount,
          isFavorite: hasFavorites,
          trackList: albumTracks.map(t => ({
            id: t.id,
            title: t.title,
            durationMs: t.durationMs,
            isFavorite: t.isFavorite,
            playCount: t.playCount
          }))
        }
      });

      // Connect Artist -> Album
      if (al.artistId) {
        addEdge(`artist:${al.artistId}`, `album:${al.id}`, 'artist-album', 2);
      }
    }

    // 5. Build Track Nodes (LOD 3 - 4) with Favorite & Recent Play marks
    for (const t of tracks) {
      const recentOrder = recentPlayMap.get(t.id);
      const baseRadius = 8;
      const favBonus = t.isFavorite ? 3 : 0;
      const playBonus = t.playCount ? Math.min(3, t.playCount * 0.3) : 0;
      const radius = baseRadius + favBonus + playBonus;

      addNode({
        id: `track:${t.id}`,
        type: 'track',
        entityId: t.id,
        label: t.title,
        x: 0,
        y: 0,
        radius,
        color: t.isFavorite ? '#fbbf24' : '#10b981',
        lodMin: 3,
        lodMax: 4,
        artworkId: t.artworkId,
        metadata: {
          artistName: t.artistName,
          albumTitle: t.albumTitle,
          durationMs: t.durationMs,
          isFavorite: t.isFavorite,
          playCount: t.playCount,
          recentPlayOrder: recentOrder
        }
      });

      // Connect Album -> Track
      if (t.albumId) {
        addEdge(`album:${t.albumId}`, `track:${t.id}`, 'album-track', 1);
      }

      // Connect Genre -> Artist & Genre -> Track
      if (t.genreId) {
        if (t.artistId) {
          addEdge(`genre:${t.genreId}`, `artist:${t.artistId}`, 'genre-artist', 2);
        }
        addEdge(`genre:${t.genreId}`, `track:${t.id}`, 'genre-track', 1);
      }

      // Connect Folder -> Track
      if (t.folderId && (filter?.showFolders ?? true)) {
        addEdge(`folder:${t.folderId}`, `track:${t.id}`, 'folder-track', 1);
      }
    }

    // 6. Build Playlist Nodes (Optional LOD 2 - 4)
    if (filter?.showPlaylists ?? true) {
      for (const pl of playlists) {
        addNode({
          id: `playlist:${pl.id}`,
          type: 'playlist',
          entityId: pl.id,
          label: pl.name,
          x: 0,
          y: 0,
          radius: 20,
          color: '#ec4899',
          lodMin: 2,
          lodMax: 4,
          artworkId: pl.artworkId,
          metadata: { trackCount: pl.trackCount, durationMs: pl.durationMs }
        });
      }
    }

    // 7. Build Folder Nodes (Optional LOD 2 - 4)
    if (filter?.showFolders ?? true) {
      for (const f of folders) {
        addNode({
          id: `folder:${f.id}`,
          type: 'folder',
          entityId: f.id,
          label: f.name,
          x: 0,
          y: 0,
          radius: 18,
          color: '#eab308',
          lodMin: 2,
          lodMax: 4,
          metadata: { trackCount: f.trackCount }
        });
      }
    }

    // 8. Calculate positions using deterministic layout engine
    const allNodes = Array.from(nodeMap.values());
    this.layoutEngine.computeLayout(allNodes, edges);

    return {
      nodes: allNodes,
      edges,
      totalNodes: allNodes.length,
      totalEdges: edges.length,
      createdAt: Date.now()
    };
  }

  private sanitizeSettings(raw: any): GalaxySettings {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_GALAXY_SETTINGS };
    }

    const defaultLOD = (raw.defaultLOD >= 1 && raw.defaultLOD <= 4) ? Number(raw.defaultLOD) : DEFAULT_GALAXY_SETTINGS.defaultLOD;
    const showPlaylists = typeof raw.showPlaylists === 'boolean' ? raw.showPlaylists : DEFAULT_GALAXY_SETTINGS.showPlaylists;
    const showFolders = typeof raw.showFolders === 'boolean' ? raw.showFolders : DEFAULT_GALAXY_SETTINGS.showFolders;
    const reducedMotion = typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : DEFAULT_GALAXY_SETTINGS.reducedMotion;

    return {
      defaultLOD,
      showPlaylists,
      showFolders,
      reducedMotion
    };
  }
}
