import type { GalaxyGraph, GalaxyNode, GalaxyEdge } from '../../../domain/entities/galaxy-types';
import { isUnknownTag } from '../../../services/galaxy/galaxy-service';

export interface GalaxyProjectionConfig {
  maxGenres?: number;             // Default: unlimited (preserves real library)
  maxArtistsPerGenre?: number;    // Default: unlimited
  maxAlbumsPerArtist?: number;    // Default: unlimited
  maxStandaloneTracks?: number;   // Default: unlimited
  maxTrackMoonsPerParent?: number; // Default: 4 when expanded, 0-1 when collapsed
  expandedNodeIds?: Set<string>;     // Selected / expanded nodes reveal extra detail
}

export const DEFAULT_PROJECTION_CONFIG: Required<Omit<GalaxyProjectionConfig, 'expandedNodeIds'>> = {
  maxGenres: Infinity,
  maxArtistsPerGenre: Infinity,
  maxAlbumsPerArtist: Infinity,
  maxStandaloneTracks: Infinity,
  maxTrackMoonsPerParent: 4
};

/**
 * GalaxyProjection V9
 * Category-aware data projection layer for Audio Galaxy V9.
 * Preserves the full real music library without arbitrary slicing or truncation,
 * classifying items into 4 category zones:
 * - Category A: Standalone Songs (unparented tracks -> Zone 1)
 * - Category B: Albums (Zone 2)
 * - Category C: Artists (Zone 3)
 * - Category D: Genres (Zone 4)
 */
export class GalaxyProjection {
  /**
   * Projects a raw, full-library GalaxyGraph into a clean, visual-first solar system graph.
   */
  public static projectGraph(fullGraph: GalaxyGraph, config?: GalaxyProjectionConfig): GalaxyGraph {
    if (!fullGraph || fullGraph.nodes.length === 0) {
      const sunNode: GalaxyNode = {
        id: 'core',
        type: 'genre',
        entityId: 'core',
        label: 'My Music',
        x: 0,
        y: 0,
        radius: 42,
        color: '#7c3aed',
        lodMin: 1,
        lodMax: 4,
        metadata: { trackCount: 0 }
      };
      return {
        nodes: [sunNode],
        edges: [],
        totalNodes: 1,
        totalEdges: 0,
        createdAt: Date.now()
      };
    }

    const expandedNodeIds = config?.expandedNodeIds ?? new Set<string>();

    const maxGenres = config?.maxGenres ?? DEFAULT_PROJECTION_CONFIG.maxGenres;
    const maxArtistsPerGenre = config?.maxArtistsPerGenre ?? DEFAULT_PROJECTION_CONFIG.maxArtistsPerGenre;
    const maxAlbumsPerArtist = config?.maxAlbumsPerArtist ?? DEFAULT_PROJECTION_CONFIG.maxAlbumsPerArtist;
    const maxStandaloneTracks = config?.maxStandaloneTracks ?? DEFAULT_PROJECTION_CONFIG.maxStandaloneTracks;
    const maxTrackMoonsPerParent = config?.maxTrackMoonsPerParent ?? DEFAULT_PROJECTION_CONFIG.maxTrackMoonsPerParent;

    const nodesMap = new Map<string, GalaxyNode>();
    const edgesList: GalaxyEdge[] = [];
    const edgeSet = new Set<string>();

    const addNode = (node: GalaxyNode) => {
      if (!nodesMap.has(node.id)) {
        nodesMap.set(node.id, node);
      }
    };

    const addEdge = (sourceId: string, targetId: string, type: GalaxyEdge['type'], weight = 1) => {
      const edgeId = `edge:${sourceId}-${targetId}`;
      if (!edgeSet.has(edgeId) && nodesMap.has(sourceId) && nodesMap.has(targetId)) {
        edgeSet.add(edgeId);
        edgesList.push({
          id: edgeId,
          sourceId,
          targetId,
          type,
          weight,
          color: 'rgba(255, 255, 255, 0.15)'
        });
      }
    };

    // 1. Central Core Sun ("My Music")
    const existingSun = fullGraph.nodes.find(n => n.id === 'core' || (n.type as string) === 'core');
    const sunNode: GalaxyNode = {
      id: 'core',
      type: 'genre',
      entityId: 'core',
      label: existingSun?.label || 'My Music',
      x: 0,
      y: 0,
      radius: 42,
      color: '#7c3aed',
      lodMin: 1,
      lodMax: 4,
      metadata: existingSun?.metadata || { trackCount: fullGraph.nodes.filter(n => n.type === 'track').length }
    };
    addNode(sunNode);

    // 2. Extract Categories
    const genreNodes = fullGraph.nodes.filter(n => n.type === 'genre' && n.id !== 'core');
    const artistNodes = fullGraph.nodes.filter(n => n.type === 'artist');
    const albumNodes = fullGraph.nodes.filter(n => n.type === 'album');
    const trackNodes = fullGraph.nodes.filter(n => n.type === 'track');

    // Indexing maps
    const artistsByGenre = new Map<string, GalaxyNode[]>();
    const albumsByArtist = new Map<string, GalaxyNode[]>();
    const tracksByAlbum = new Map<string, GalaxyNode[]>();
    const tracksByArtist = new Map<string, GalaxyNode[]>();
    const unparentedTracks: GalaxyNode[] = [];

    fullGraph.edges.forEach(e => {
      if (e.type === 'genre-artist') {
        const list = artistsByGenre.get(e.sourceId) || [];
        const artist = artistNodes.find(a => a.id === e.targetId);
        if (artist && !list.some(a => a.id === artist.id)) list.push(artist);
        artistsByGenre.set(e.sourceId, list);
      } else if (e.type === 'artist-album') {
        const list = albumsByArtist.get(e.sourceId) || [];
        const album = albumNodes.find(a => a.id === e.targetId);
        if (album && !list.some(a => a.id === album.id)) list.push(album);
        albumsByArtist.set(e.sourceId, list);
      } else if (e.type === 'album-track') {
        const list = tracksByAlbum.get(e.sourceId) || [];
        const track = trackNodes.find(t => t.id === e.targetId);
        if (track && !list.some(t => t.id === track.id)) list.push(track);
        tracksByAlbum.set(e.sourceId, list);
      } else if (e.type === 'artist-track') {
        const list = tracksByArtist.get(e.sourceId) || [];
        const track = trackNodes.find(t => t.id === e.targetId);
        if (track && !list.some(t => t.id === track.id)) list.push(track);
        tracksByArtist.set(e.sourceId, list);
      }
    });

    // Identify Category A — Standalone Songs (track with NO artist AND NO album metadata)
    trackNodes.forEach(t => {
      const artistName = t.metadata?.artistName as string | undefined;
      const albumTitle = t.metadata?.albumTitle as string | undefined;

      const hasValidArtist = Boolean(artistName && !isUnknownTag(artistName));
      const hasValidAlbum = Boolean(albumTitle && !isUnknownTag(albumTitle));

      const hasAlbumEdge = Array.from(tracksByAlbum.values()).some(list => list.some(x => x.id === t.id));
      const hasArtistEdge = Array.from(tracksByArtist.values()).some(list => list.some(x => x.id === t.id));

      if (!hasValidArtist && !hasValidAlbum && !hasAlbumEdge && !hasArtistEdge) {
        unparentedTracks.push(t);
      }
    });

    // 3. Add Category A: Standalone Songs (Zone 1)
    const selectedStandalone = isFinite(maxStandaloneTracks) ? unparentedTracks.slice(0, maxStandaloneTracks) : unparentedTracks;
    selectedStandalone.forEach(track => {
      addNode({
        ...track,
        radius: 6,
        lodMin: 3
      });
    });

    // 4. Add Category D: Genres (Zone 4)
    const sortedGenres = [...genreNodes].sort((a, b) => (b.metadata?.trackCount ?? 0) - (a.metadata?.trackCount ?? 0));
    const selectedGenres = isFinite(maxGenres) ? sortedGenres.slice(0, maxGenres) : sortedGenres;

    selectedGenres.forEach(g => {
      addNode({ ...g, radius: 26, lodMin: 1 });
    });

    // 5. Add Category C: Artists per Genre (Zone 3)
    const activeGenres = selectedGenres.length > 0 ? selectedGenres : genreNodes;
    activeGenres.forEach(genre => {
      let genreArtists = artistsByGenre.get(genre.id) || [];
      const sortedArtists = [...genreArtists].sort((a, b) => (b.metadata?.trackCount ?? 0) - (a.metadata?.trackCount ?? 0));
      const selectedArtists = isFinite(maxArtistsPerGenre) ? sortedArtists.slice(0, maxArtistsPerGenre) : sortedArtists;

      selectedArtists.forEach(artist => {
        addNode({ ...artist, radius: 18, lodMin: 2 });
        if (nodesMap.has(genre.id)) {
          addEdge(genre.id, artist.id, 'genre-artist', 2);
        }

        // 6. Add Category B: Albums per Artist (Zone 2)
        const artistAlbums = albumsByArtist.get(artist.id) || [];
        const sortedAlbums = [...artistAlbums].sort((a, b) => (b.metadata?.trackCount ?? 0) - (a.metadata?.trackCount ?? 0));
        const selectedAlbums = isFinite(maxAlbumsPerArtist) ? sortedAlbums.slice(0, maxAlbumsPerArtist) : sortedAlbums;

        selectedAlbums.forEach(album => {
          addNode({ ...album, radius: 14, lodMin: 2 });
          addEdge(artist.id, album.id, 'artist-album', 2);

          // Track Moons orbiting Albums when expanded
          const albumTracks = tracksByAlbum.get(album.id) || [];
          const isAlbumExpanded = expandedNodeIds.has(album.id);
          const trackLimit = isAlbumExpanded ? maxTrackMoonsPerParent * 2 : 0;
          const selectedTracks = albumTracks.slice(0, trackLimit);

          selectedTracks.forEach(track => {
            addNode({ ...track, radius: 5, lodMin: 3 });
            addEdge(album.id, track.id, 'album-track', 1);
          });
        });
      });
    });

    // Include unparented Artists if any exist outside genres
    artistNodes.forEach(artist => {
      if (!nodesMap.has(artist.id)) {
        addNode({ ...artist, radius: 18, lodMin: 2 });
      }
    });

    // Include unparented Albums if any exist outside artists
    albumNodes.forEach(album => {
      if (!nodesMap.has(album.id)) {
        addNode({ ...album, radius: 14, lodMin: 2 });
      }
    });

    const projectedNodes = Array.from(nodesMap.values());

    return {
      nodes: projectedNodes,
      edges: edgesList,
      totalNodes: projectedNodes.length,
      totalEdges: edgesList.length,
      createdAt: Date.now()
    };
  }
}
