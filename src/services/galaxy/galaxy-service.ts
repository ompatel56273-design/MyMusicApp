import type {
  GalaxyGraph,
  GalaxyNode,
  GalaxyEdge,
  GalaxyFilterOptions,
  GalaxySettings
} from '../../domain/entities/galaxy-types';
import { DEFAULT_GALAXY_SETTINGS } from '../../domain/entities/galaxy-types';
import type { ILibraryService, IPlaylistService, IGalaxyService } from '../contracts/service-contracts';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { GalaxyLayoutEngine } from './galaxy-layout-engine';
import { Logger } from '../../core/logging/logger';

export interface GalaxyServiceDependencies {
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
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
  private readonly database?: IDatabaseAdapter | undefined;
  private readonly layoutEngine = new GalaxyLayoutEngine();

  private cachedGraph: GalaxyGraph | null = null;
  private cachedSettings: GalaxySettings = { ...DEFAULT_GALAXY_SETTINGS };
  private isSettingsLoaded = false;

  constructor(deps: GalaxyServiceDependencies) {
    this.libraryService = deps.libraryService;
    this.playlistService = deps.playlistService;
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
    const [artistsRes, albumsRes, tracksRes, genresRes, folders, playlistsRes] = await Promise.all([
      this.libraryService.listArtists({ limit: 500 }),
      this.libraryService.listAlbums({ limit: 1000 }),
      this.libraryService.listTracks({ limit: 2500 }),
      this.libraryService.listGenres({ limit: 100 }),
      this.libraryService.listFolders(),
      this.playlistService ? this.playlistService.listPlaylists({ limit: 100 }) : { items: [] }
    ]);

    const artists = artistsRes.items;
    const albums = albumsRes.items;
    const tracks = tracksRes.items;
    const genres = genresRes.items;
    const playlists = playlistsRes.items;

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

    // 2. Build Genre Nodes (LOD 1 - 4)
    for (const g of genres) {
      if (!g.name) continue;
      addNode({
        id: `genre:${g.id}`,
        type: 'genre',
        entityId: g.id,
        label: g.name,
        x: 0,
        y: 0,
        radius: 36,
        color: '#a855f7',
        lodMin: 1,
        lodMax: 4,
        metadata: { trackCount: g.trackCount }
      });
    }

    // 3. Build Artist Nodes (LOD 1 - 4)
    for (const a of artists) {
      addNode({
        id: `artist:${a.id}`,
        type: 'artist',
        entityId: a.id,
        label: a.name || 'Unknown Artist',
        x: 0,
        y: 0,
        radius: 24,
        color: '#3b82f6',
        lodMin: 1,
        lodMax: 4,
        artworkId: a.artworkId,
        metadata: { trackCount: a.trackCount, albumCount: a.albumCount }
      });
    }

    // 4. Build Album Nodes (LOD 2 - 4)
    for (const al of albums) {
      addNode({
        id: `album:${al.id}`,
        type: 'album',
        entityId: al.id,
        label: al.title || 'Unknown Album',
        x: 0,
        y: 0,
        radius: 16,
        color: '#ff6b00',
        lodMin: 2,
        lodMax: 4,
        artworkId: al.artworkId,
        metadata: {
          artistName: al.artistName,
          trackCount: al.trackCount,
          durationMs: al.durationMs,
          year: al.year,
          isCompilation: al.isCompilation
        }
      });

      // Connect Artist -> Album
      if (al.artistId) {
        addEdge(`artist:${al.artistId}`, `album:${al.id}`, 'artist-album', 2);
      }
    }

    // 5. Build Track Nodes (LOD 3 - 4)
    for (const t of tracks) {
      addNode({
        id: `track:${t.id}`,
        type: 'track',
        entityId: t.id,
        label: t.title,
        x: 0,
        y: 0,
        radius: 8,
        color: '#10b981',
        lodMin: 3,
        lodMax: 4,
        artworkId: t.artworkId,
        metadata: {
          artistName: t.artistName,
          albumTitle: t.albumTitle,
          durationMs: t.durationMs,
          isFavorite: t.isFavorite
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
