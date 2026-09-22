import type { GalaxyNode, GalaxyEdge, GalaxyNodeType } from '../../domain/entities/galaxy-types';

export interface LayoutOptions {
  radiusScale?: number;
  centerOriginX?: number;
  centerOriginY?: number;
  relaxationIterations?: number;
}

/**
 * Deterministic Radial-Hierarchical Layout Calculator for Audio Galaxy.
 * Produces consistent, reproducible, bounded 2D positions for graph nodes.
 * Hierarchy:
 * - Genre Centers: distributed symmetrically around center origin (Radius ~ 600px)
 * - Artists: orbit around their primary Genre center (Radius ~ 250px)
 * - Albums: concentric rings around their Artist (Radius ~ 120px)
 * - Tracks: satellite clusters around their Album (Radius ~ 60px)
 * - Playlists & Folders: dedicated outer perimeter orbits
 */
export class GalaxyLayoutEngine {
  private static readonly COLOR_MAP: Record<GalaxyNodeType, string> = {
    genre: '#a855f7', // Purple
    artist: '#3b82f6', // Blue
    album: '#ff6b00', // Accent Orange
    track: '#10b981', // Emerald
    playlist: '#ec4899', // Pink
    folder: '#eab308' // Amber
  };

  private static readonly RADIUS_MAP: Record<GalaxyNodeType, number> = {
    genre: 36,
    artist: 24,
    album: 16,
    track: 8,
    playlist: 20,
    folder: 18
  };

  public computeLayout(
    nodes: GalaxyNode[],
    edges: GalaxyEdge[],
    options?: LayoutOptions
  ): GalaxyNode[] {
    const originX = options?.centerOriginX ?? 0;
    const originY = options?.centerOriginY ?? 0;

    // Group nodes by type
    const genres = nodes.filter(n => n.type === 'genre');
    const artists = nodes.filter(n => n.type === 'artist');
    const albums = nodes.filter(n => n.type === 'album');
    const tracks = nodes.filter(n => n.type === 'track');
    const playlists = nodes.filter(n => n.type === 'playlist');
    const folders = nodes.filter(n => n.type === 'folder');

    // Build relationship maps from edges
    const genreToArtists = new Map<string, GalaxyNode[]>();
    const artistToAlbums = new Map<string, GalaxyNode[]>();
    const albumToTracks = new Map<string, GalaxyNode[]>();

    for (const edge of edges) {
      if (edge.type === 'genre-artist') {
        const list = genreToArtists.get(edge.sourceId) ?? [];
        const artist = artists.find(a => a.id === edge.targetId);
        if (artist && !list.includes(artist)) list.push(artist);
        genreToArtists.set(edge.sourceId, list);
      } else if (edge.type === 'artist-album') {
        const list = artistToAlbums.get(edge.sourceId) ?? [];
        const album = albums.find(al => al.id === edge.targetId);
        if (album && !list.includes(album)) list.push(album);
        artistToAlbums.set(edge.sourceId, list);
      } else if (edge.type === 'album-track') {
        const list = albumToTracks.get(edge.sourceId) ?? [];
        const track = tracks.find(t => t.id === edge.targetId);
        if (track && !list.includes(track)) list.push(track);
        albumToTracks.set(edge.sourceId, list);
      }
    }

    // 1. Position Genres around origin in a circle
    const genreCount = genres.length || 1;
    const genreOrbitRadius = 700;

    genres.forEach((genre, idx) => {
      const angle = (idx / genreCount) * Math.PI * 2;
      genre.x = originX + Math.cos(angle) * genreOrbitRadius;
      genre.y = originY + Math.sin(angle) * genreOrbitRadius;
      genre.radius = GalaxyLayoutEngine.RADIUS_MAP.genre;
      genre.color = GalaxyLayoutEngine.COLOR_MAP.genre;
    });

    // Fallback genre anchor for unattached artists
    const defaultCenter = { x: originX, y: originY };

    // 2. Position Artists around their primary Genre center
    const unparentedArtists: GalaxyNode[] = [...artists];
    for (const [genreId, artistList] of genreToArtists.entries()) {
      const parentGenre = genres.find(g => g.id === genreId);
      const center = parentGenre ? { x: parentGenre.x, y: parentGenre.y } : defaultCenter;
      const aCount = artistList.length || 1;
      const artistOrbit = 260;

      artistList.forEach((artist, aIdx) => {
        const angle = (aIdx / aCount) * Math.PI * 2 + (parentGenre ? (parentGenre.x * 0.001) : 0);
        artist.x = center.x + Math.cos(angle) * artistOrbit;
        artist.y = center.y + Math.sin(angle) * artistOrbit;
        artist.radius = GalaxyLayoutEngine.RADIUS_MAP.artist;
        artist.color = GalaxyLayoutEngine.COLOR_MAP.artist;

        const uIdx = unparentedArtists.indexOf(artist);
        if (uIdx !== -1) unparentedArtists.splice(uIdx, 1);
      });
    }

    // Position any orphan artists around main origin
    unparentedArtists.forEach((artist, idx) => {
      const angle = (idx / (unparentedArtists.length || 1)) * Math.PI * 2;
      artist.x = originX + Math.cos(angle) * 400;
      artist.y = originY + Math.sin(angle) * 400;
      artist.radius = GalaxyLayoutEngine.RADIUS_MAP.artist;
      artist.color = GalaxyLayoutEngine.COLOR_MAP.artist;
    });

    // 3. Position Albums around their parent Artist
    const unparentedAlbums = [...albums];
    for (const [artistId, albumList] of artistToAlbums.entries()) {
      const parentArtist = artists.find(a => a.id === artistId);
      const center = parentArtist ? { x: parentArtist.x, y: parentArtist.y } : defaultCenter;
      const albCount = albumList.length || 1;
      const albumOrbit = 120;

      albumList.forEach((album, albIdx) => {
        const angle = (albIdx / albCount) * Math.PI * 2;
        album.x = center.x + Math.cos(angle) * albumOrbit;
        album.y = center.y + Math.sin(angle) * albumOrbit;
        album.radius = GalaxyLayoutEngine.RADIUS_MAP.album;
        album.color = GalaxyLayoutEngine.COLOR_MAP.album;

        const uIdx = unparentedAlbums.indexOf(album);
        if (uIdx !== -1) unparentedAlbums.splice(uIdx, 1);
      });
    }

    unparentedAlbums.forEach((album, idx) => {
      const angle = (idx / (unparentedAlbums.length || 1)) * Math.PI * 2;
      album.x = originX + Math.cos(angle) * 300;
      album.y = originY + Math.sin(angle) * 300;
      album.radius = GalaxyLayoutEngine.RADIUS_MAP.album;
      album.color = GalaxyLayoutEngine.COLOR_MAP.album;
    });

    // 4. Position Tracks in satellite cluster around their parent Album
    const unparentedTracks = [...tracks];
    for (const [albumId, trackList] of albumToTracks.entries()) {
      const parentAlbum = albums.find(al => al.id === albumId);
      const center = parentAlbum ? { x: parentAlbum.x, y: parentAlbum.y } : defaultCenter;
      const tCount = trackList.length || 1;
      const trackOrbit = 50;

      trackList.forEach((track, tIdx) => {
        const angle = (tIdx / tCount) * Math.PI * 2;
        track.x = center.x + Math.cos(angle) * trackOrbit;
        track.y = center.y + Math.sin(angle) * trackOrbit;
        track.radius = GalaxyLayoutEngine.RADIUS_MAP.track;
        track.color = GalaxyLayoutEngine.COLOR_MAP.track;

        const uIdx = unparentedTracks.indexOf(track);
        if (uIdx !== -1) unparentedTracks.splice(uIdx, 1);
      });
    }

    unparentedTracks.forEach((track, idx) => {
      const angle = (idx / (unparentedTracks.length || 1)) * Math.PI * 2;
      track.x = originX + Math.cos(angle) * 200;
      track.y = originY + Math.sin(angle) * 200;
      track.radius = GalaxyLayoutEngine.RADIUS_MAP.track;
      track.color = GalaxyLayoutEngine.COLOR_MAP.track;
    });

    // 5. Outer Orbits for Playlists & Folders
    playlists.forEach((pl, idx) => {
      const angle = (idx / (playlists.length || 1)) * Math.PI * 2 + 0.5;
      pl.x = originX + Math.cos(angle) * 1100;
      pl.y = originY + Math.sin(angle) * 1100;
      pl.radius = GalaxyLayoutEngine.RADIUS_MAP.playlist;
      pl.color = GalaxyLayoutEngine.COLOR_MAP.playlist;
    });

    folders.forEach((f, idx) => {
      const angle = (idx / (folders.length || 1)) * Math.PI * 2 + 1.0;
      f.x = originX + Math.cos(angle) * 1250;
      f.y = originY + Math.sin(angle) * 1250;
      f.radius = GalaxyLayoutEngine.RADIUS_MAP.folder;
      f.color = GalaxyLayoutEngine.COLOR_MAP.folder;
    });

    // 6. Optional bounded relaxation pass (capped at max 50 iterations)
    const iterations = Math.min(options?.relaxationIterations ?? 15, 50);
    this.relaxNodes(nodes, edges, iterations);

    return nodes;
  }

  /**
   * Bounded force relaxation to prevent node collisions while preserving radial stability.
   */
  private relaxNodes(nodes: GalaxyNode[], edges: GalaxyEdge[], iterations: number): void {
    if (nodes.length <= 1 || iterations <= 0) return;

    const nodeMap = new Map<string, GalaxyNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const k = 80; // Ideal resting distance
    const damping = 0.85;

    for (let iter = 0; iter < iterations; iter++) {
      const tempStep = 1.0 / (iter + 1);

      // Repulsion between close node pairs
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j]!;
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy || 1;
          const minDist = n1.radius + n2.radius + 15;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq);
            const force = ((minDist - dist) / dist) * 0.5 * tempStep;
            const fx = dx * force;
            const fy = dy * force;

            if (n1.type !== 'genre') {
              n1.x -= fx * damping;
              n1.y -= fy * damping;
            }
            if (n2.type !== 'genre') {
              n2.x += fx * damping;
              n2.y += fy * damping;
            }
          }
        }
      }

      // Edge spring attraction
      for (const edge of edges) {
        const source = nodeMap.get(edge.sourceId);
        const target = nodeMap.get(edge.targetId);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const displacement = dist - k;
        const springForce = (displacement / dist) * 0.05 * tempStep;

        const fx = dx * springForce;
        const fy = dy * springForce;

        if (source.type !== 'genre') {
          source.x += fx;
          source.y += fy;
        }
        if (target.type !== 'genre') {
          target.x -= fx;
          target.y -= fy;
        }
      }
    }
  }
}
