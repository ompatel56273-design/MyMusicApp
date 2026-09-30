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
import type { Track } from '../../domain/entities/models';
import { STORES } from '../../data/db/schema';
import { GalaxyLayoutEngine } from './galaxy-layout-engine';
import { Logger } from '../../core/logging/logger';

export interface GalaxyServiceDependencies {
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
  statsService?: StatsService | undefined;
  database?: IDatabaseAdapter | undefined;
}

export function isUnknownTag(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'unknown' ||
    trimmed === 'unknown artist' ||
    trimmed === 'unknown album' ||
    trimmed === 'unknown genre'
  );
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
    // 1. Fetch real entity collections from authoritative services with full capacity
    const [artistsRes, albumsRes, tracksRes, genresRes, folders, playlistsRes, recentHistory] = await Promise.all([
      this.libraryService.listArtists({ limit: 100000 }),
      this.libraryService.listAlbums({ limit: 100000 }),
      this.libraryService.listTracks({ limit: 100000 }),
      this.libraryService.listGenres({ limit: 100000 }),
      this.libraryService.listFolders(),
      this.playlistService ? this.playlistService.listPlaylists({ limit: 100000 }) : { items: [] },
      this.statsService ? this.statsService.getRecentHistory(20).catch(() => []) : Promise.resolve([])
    ]);

    const artists = [...artistsRes.items];
    const albums = [...albumsRes.items];
    const tracks = [...tracksRes.items];
    const genres = [...genresRes.items];
    const playlists = playlistsRes.items;

    // Create a map for recent history ordering
    const recentPlayMap = new Map<string, number>();
    recentHistory.forEach((h, idx) => {
      recentPlayMap.set(h.track.id, idx + 1);
    });

    // 2. Discover / Synthesize missing Genre, Artist, and Album entities to prevent broken hierarchy
    const genreMap = new Map<string, { id: string; name: string }>();
    genres.forEach(g => {
      if (g.name) genreMap.set(g.id, { id: g.id, name: g.name });
    });

    const artistMap = new Map<string, { id: string; name: string; genreId: string; artworkId?: string | undefined }>();
    artists.forEach(a => {
      artistMap.set(a.id, {
        id: a.id,
        name: a.name || 'Unknown Artist',
        genreId: 'genre_general',
        ...(a.artworkId ? { artworkId: a.artworkId } : {})
      });
    });

    const albumMap = new Map<string, { id: string; title: string; artistId: string; artworkId?: string | undefined; year?: number | undefined }>();
    albums.forEach(al => {
      albumMap.set(al.id, {
        id: al.id,
        title: al.title || 'Unknown Album',
        artistId: al.artistId || 'artist_unknown',
        ...(al.artworkId ? { artworkId: al.artworkId } : {}),
        ...(al.year !== undefined ? { year: al.year } : {})
      });
    });

    // Inspect tracks and assign / synthesize parent relationships
    const tracksByAlbum = new Map<string, Track[]>();
    const tracksByArtist = new Map<string, Track[]>();
    const tracksByGenre = new Map<string, Track[]>();
    const albumsByArtist = new Map<string, Set<string>>(); // artistId -> Set<albumIds>
    const artistsByGenre = new Map<string, Set<string>>(); // genreId -> artistIds[]

    for (const t of tracks) {
      // Resolve Genre (only if valid)
      let gId: string | undefined = t.genreId;
      if (gId && genreMap.has(gId)) {
        // Valid genre entity from library
      } else if (t.genreName && !isUnknownTag(t.genreName)) {
        const cleanGName = t.genreName.trim();
        gId = `genre_${cleanGName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        if (!genreMap.has(gId)) {
          genreMap.set(gId, { id: gId, name: cleanGName });
        }
      } else {
        gId = undefined;
      }

      // Resolve Artist (only if valid)
      let aId: string | undefined = t.artistId;
      if (aId && artistMap.has(aId)) {
        // Valid artist entity from library
      } else if (t.artistName && !isUnknownTag(t.artistName)) {
        const cleanAName = t.artistName.trim();
        aId = `artist_${cleanAName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        if (!artistMap.has(aId)) {
          artistMap.set(aId, { id: aId, name: cleanAName, genreId: gId || '' });
        }
      } else {
        aId = undefined;
      }

      // Associate Artist with Genre if valid
      if (aId && gId) {
        const artistEntry = artistMap.get(aId);
        if (artistEntry && !artistEntry.genreId) {
          artistEntry.genreId = gId;
        }
        let gArtists = artistsByGenre.get(gId);
        if (!gArtists) {
          gArtists = new Set<string>();
          artistsByGenre.set(gId, gArtists);
        }
        gArtists.add(aId);
      }

      // Resolve Album (only if valid)
      let alId: string | undefined = t.albumId;
      if (alId && albumMap.has(alId)) {
        // Valid album entity from library
      } else if (t.albumTitle && !isUnknownTag(t.albumTitle)) {
        const cleanAlTitle = t.albumTitle.trim();
        const artistPrefix = aId || 'various';
        alId = `album_${cleanAlTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${artistPrefix}`;
        if (!albumMap.has(alId)) {
          albumMap.set(alId, { id: alId, title: cleanAlTitle, artistId: aId || '' });
        }
      } else {
        alId = undefined;
      }

      // Associate Album with Artist if valid
      if (alId && aId) {
        let aAlbums = albumsByArtist.get(aId);
        if (!aAlbums) {
          aAlbums = new Set<string>();
          albumsByArtist.set(aId, aAlbums);
        }
        aAlbums.add(alId);
      }

      // Group tracks into valid parent collections
      if (alId) {
        const alTrackList = tracksByAlbum.get(alId) || [];
        alTrackList.push(t);
        tracksByAlbum.set(alId, alTrackList);
      }

      if (aId) {
        const aTrackList = tracksByArtist.get(aId) || [];
        aTrackList.push(t);
        tracksByArtist.set(aId, aTrackList);
      }

      if (gId) {
        const gTrackList = tracksByGenre.get(gId) || [];
        gTrackList.push(t);
        tracksByGenre.set(gId, gTrackList);
      }
    }

    const nodeMap = new Map<string, GalaxyNode>();
    const edgeSet = new Set<string>();
    const edges: GalaxyEdge[] = [];

    const addNode = (node: GalaxyNode) => {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
      }
    };

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

    // 3. Build Genre Nodes (LOD 1 - 4)
    for (const [gId, gMeta] of genreMap.entries()) {
      const genreTracks = tracksByGenre.get(gId) || [];
      if (genreTracks.length === 0 && genres.length > 0) continue;

      const genrePlayCount = genreTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      const trackCount = genreTracks.length;
      const radius = Math.min(56, Math.max(30, 30 + Math.log2(trackCount + 1) * 4));

      addNode({
        id: `genre:${gId}`,
        type: 'genre',
        entityId: gId,
        label: gMeta.name,
        x: 0,
        y: 0,
        radius,
        color: '#a855f7',
        lodMin: 1,
        lodMax: 4,
        metadata: {
          trackCount,
          playCount: genrePlayCount,
          artistCount: (artistsByGenre.get(gId) || new Set()).size,
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

    // 4. Build Artist Nodes (LOD 1 - 4)
    for (const [aId, aMeta] of artistMap.entries()) {
      const artistTracks = tracksByArtist.get(aId) || [];
      if (artistTracks.length === 0 && artists.length > 0) continue;

      const artistAlbumIds = albumsByArtist.get(aId) ? Array.from(albumsByArtist.get(aId)!) : [];
      const artistPlayCount = artistTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      const trackCount = artistTracks.length;
      const hasFavorites = artistTracks.some(t => t.isFavorite);
      const radius = Math.min(40, Math.max(18, 18 + Math.log2(trackCount + 1) * 3));
      const isMajorArtist = trackCount >= 4 || artistPlayCount >= 10;

      addNode({
        id: `artist:${aId}`,
        type: 'artist',
        entityId: aId,
        label: aMeta.name,
        x: 0,
        y: 0,
        radius,
        color: '#3b82f6',
        lodMin: isMajorArtist ? 1 : 2,
        lodMax: 4,
        artworkId: aMeta.artworkId,
        metadata: {
          trackCount,
          albumCount: artistAlbumIds.length,
          playCount: artistPlayCount,
          isFavorite: hasFavorites,
          albumList: artistAlbumIds.map(alId => {
            const al = albumMap.get(alId);
            return {
              id: alId,
              title: al ? al.title : 'Album',
              year: al?.year,
              trackCount: (tracksByAlbum.get(alId) || []).length
            };
          }),
          trackList: artistTracks.slice(0, 50).map(t => ({
            id: t.id,
            title: t.title,
            durationMs: t.durationMs,
            isFavorite: t.isFavorite,
            playCount: t.playCount
          }))
        }
      });

      // Connect Genre -> Artist
      const gId = aMeta.genreId;
      if (gId && nodeMap.has(`genre:${gId}`)) {
        addEdge(`genre:${gId}`, `artist:${aId}`, 'genre-artist', 2);
      }
    }

    // 5. Build Album Nodes (LOD 2 - 4)
    for (const [alId, alMeta] of albumMap.entries()) {
      const albumTracks = tracksByAlbum.get(alId) || [];
      if (albumTracks.length === 0 && albums.length > 0) continue;

      const albumPlayCount = albumTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
      const trackCount = albumTracks.length;
      const hasFavorites = albumTracks.some(t => t.isFavorite);
      const radius = Math.min(26, Math.max(13, 13 + Math.log2(trackCount + 1) * 2));

      addNode({
        id: `album:${alId}`,
        type: 'album',
        entityId: alId,
        label: alMeta.title,
        x: 0,
        y: 0,
        radius,
        color: '#ff6b00',
        lodMin: 2,
        lodMax: 4,
        artworkId: alMeta.artworkId,
        metadata: {
          artistName: artistMap.get(alMeta.artistId)?.name,
          trackCount,
          year: alMeta.year,
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
      if (nodeMap.has(`artist:${alMeta.artistId}`)) {
        addEdge(`artist:${alMeta.artistId}`, `album:${alId}`, 'artist-album', 2);
      }
    }

    // 6. Build Track Nodes (LOD 3 - 4)
    for (const t of tracks) {
      const recentOrder = recentPlayMap.get(t.id);
      const baseRadius = 7;
      const favBonus = t.isFavorite ? 3 : 0;
      const playBonus = t.playCount ? Math.min(3, t.playCount * 0.3) : 0;
      const radius = baseRadius + favBonus + playBonus;

      // Find resolved parent album
      let parentAlbumId = t.albumId;
      if (!parentAlbumId || !albumMap.has(parentAlbumId)) {
        const aId = t.artistId || (t.artistName && !isUnknownTag(t.artistName) ? `artist_${t.artistName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}` : undefined);
        parentAlbumId = t.albumTitle && !isUnknownTag(t.albumTitle) ? `album_${t.albumTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${aId || 'standalone'}` : undefined;
      }

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
          artistName: t.artistName || (t.artistId ? artistMap.get(t.artistId)?.name : undefined),
          albumTitle: t.albumTitle || (parentAlbumId ? albumMap.get(parentAlbumId)?.title : undefined),
          durationMs: t.durationMs,
          isFavorite: t.isFavorite,
          playCount: t.playCount,
          recentPlayOrder: recentOrder
        }
      });

      // Connect Album -> Track (or fallback to Artist -> Track or Genre -> Track)
      const aId = t.artistId || (t.artistName && !isUnknownTag(t.artistName) ? `artist_${t.artistName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}` : undefined);
      const gId = t.genreId || (t.genreName && !isUnknownTag(t.genreName) ? `genre_${t.genreName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}` : undefined);

      if (parentAlbumId && nodeMap.has(`album:${parentAlbumId}`)) {
        addEdge(`album:${parentAlbumId}`, `track:${t.id}`, 'album-track', 1);
      } else if (aId && nodeMap.has(`artist:${aId}`)) {
        addEdge(`artist:${aId}`, `track:${t.id}`, 'artist-track', 1);
      } else if (gId && nodeMap.has(`genre:${gId}`)) {
        addEdge(`genre:${gId}`, `track:${t.id}`, 'genre-track', 1);
      }
    }

    // 7. Build Playlist Nodes (Optional LOD 2 - 4)
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

    // 8. Build Folder Nodes (Optional LOD 2 - 4)
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

    // 9. Calculate positions using deterministic layout engine
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
