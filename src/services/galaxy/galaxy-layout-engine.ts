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
 * - Genre Planets: distributed symmetrically around center origin (Radius ~ 700-1200px)
 * - Artist Systems: orbit around their primary Genre center (Radius ~ 220-450px)
 * - Album Satellites: concentric rings around their Artist (Radius ~ 85-200px)
 * - Song Nodes: satellite clusters around their Album (Radius ~ 35-120px)
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
    genre: 38,
    artist: 24,
    album: 16,
    track: 8,
    playlist: 20,
    folder: 18
  };

  private static hashSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) / 2147483647;
  }

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

    const artistMap = new Map(artists.map(a => [a.id, a]));
    const albumMap = new Map(albums.map(al => [al.id, al]));
    const trackMap = new Map(tracks.map(t => [t.id, t]));

    for (const edge of edges) {
      if (edge.type === 'genre-artist') {
        const list = genreToArtists.get(edge.sourceId) ?? [];
        const artist = artistMap.get(edge.targetId);
        if (artist && !list.includes(artist)) list.push(artist);
        genreToArtists.set(edge.sourceId, list);
      } else if (edge.type === 'artist-album') {
        const list = artistToAlbums.get(edge.sourceId) ?? [];
        const album = albumMap.get(edge.targetId);
        if (album && !list.includes(album)) list.push(album);
        artistToAlbums.set(edge.sourceId, list);
      } else if (edge.type === 'album-track') {
        const list = albumToTracks.get(edge.sourceId) ?? [];
        const track = trackMap.get(edge.targetId);
        if (track && !list.includes(track)) list.push(track);
        albumToTracks.set(edge.sourceId, list);
      }
    }

    // 1. Position Genres around origin symmetrically with generous spacing
    const genreCount = genres.length || 1;
    const genreOrbitRadius = Math.max(800, Math.min(2200, 600 + genreCount * 120));

    genres.forEach((genre, idx) => {
      const angle = (idx / genreCount) * Math.PI * 2;
      genre.x = originX + Math.cos(angle) * genreOrbitRadius;
      genre.y = originY + Math.sin(angle) * genreOrbitRadius;
      genre.radius = genre.radius || GalaxyLayoutEngine.RADIUS_MAP.genre;
      genre.color = genre.color || GalaxyLayoutEngine.COLOR_MAP.genre;
    });

    // Fallback genre anchor for unattached artists
    const defaultCenter = { x: originX, y: originY };

    // 2. Position Artists around their primary Genre center in concentric orbital rings
    const unparentedArtists: GalaxyNode[] = [...artists];
    for (const [genreId, artistList] of genreToArtists.entries()) {
      const parentGenre = genres.find(g => g.id === genreId);
      const center = parentGenre ? { x: parentGenre.x, y: parentGenre.y } : defaultCenter;
      const aCount = artistList.length || 1;
      const baseSeed = GalaxyLayoutEngine.hashSeed(genreId) * Math.PI * 2;

      artistList.forEach((artist, aIdx) => {
        // Distribute across rings if artist count is large
        const ringIndex = Math.floor(aIdx / 6);
        const posInRing = aIdx % 6;
        const ringSize = Math.min(6, aCount - ringIndex * 6);
        const ringRadius = 240 + ringIndex * 130;
        const angle = baseSeed + (posInRing / Math.max(1, ringSize)) * Math.PI * 2 + ringIndex * 0.4;

        artist.x = center.x + Math.cos(angle) * ringRadius;
        artist.y = center.y + Math.sin(angle) * ringRadius;
        artist.radius = artist.radius || GalaxyLayoutEngine.RADIUS_MAP.artist;
        artist.color = artist.color || GalaxyLayoutEngine.COLOR_MAP.artist;

        const uIdx = unparentedArtists.indexOf(artist);
        if (uIdx !== -1) unparentedArtists.splice(uIdx, 1);
      });
    }

    // Position any orphan artists around origin
    unparentedArtists.forEach((artist, idx) => {
      const angle = (idx / (unparentedArtists.length || 1)) * Math.PI * 2;
      artist.x = originX + Math.cos(angle) * 500;
      artist.y = originY + Math.sin(angle) * 500;
      artist.radius = artist.radius || GalaxyLayoutEngine.RADIUS_MAP.artist;
      artist.color = artist.color || GalaxyLayoutEngine.COLOR_MAP.artist;
    });

    // 3. Position Albums around their parent Artist in concentric orbital rings
    const unparentedAlbums = [...albums];
    for (const [artistId, albumList] of artistToAlbums.entries()) {
      const parentArtist = artistMap.get(artistId);
      const center = parentArtist ? { x: parentArtist.x, y: parentArtist.y } : defaultCenter;
      const albCount = albumList.length || 1;
      const baseSeed = GalaxyLayoutEngine.hashSeed(artistId) * Math.PI * 2;

      albumList.forEach((album, albIdx) => {
        const ringIndex = Math.floor(albIdx / 5);
        const posInRing = albIdx % 5;
        const ringSize = Math.min(5, albCount - ringIndex * 5);
        const ringRadius = 90 + ringIndex * 50;
        const angle = baseSeed + (posInRing / Math.max(1, ringSize)) * Math.PI * 2 + ringIndex * 0.5;

        album.x = center.x + Math.cos(angle) * ringRadius;
        album.y = center.y + Math.sin(angle) * ringRadius;
        album.radius = album.radius || GalaxyLayoutEngine.RADIUS_MAP.album;
        album.color = album.color || GalaxyLayoutEngine.COLOR_MAP.album;

        const uIdx = unparentedAlbums.indexOf(album);
        if (uIdx !== -1) unparentedAlbums.splice(uIdx, 1);
      });
    }

    unparentedAlbums.forEach((album, idx) => {
      const angle = (idx / (unparentedAlbums.length || 1)) * Math.PI * 2;
      album.x = originX + Math.cos(angle) * 400;
      album.y = originY + Math.sin(angle) * 400;
      album.radius = album.radius || GalaxyLayoutEngine.RADIUS_MAP.album;
      album.color = album.color || GalaxyLayoutEngine.COLOR_MAP.album;
    });

    // 4. Position Tracks in satellite clusters around their parent Album
    const unparentedTracks = [...tracks];
    for (const [albumId, trackList] of albumToTracks.entries()) {
      const parentAlbum = albumMap.get(albumId);
      const center = parentAlbum ? { x: parentAlbum.x, y: parentAlbum.y } : defaultCenter;
      const tCount = trackList.length || 1;
      const baseSeed = GalaxyLayoutEngine.hashSeed(albumId) * Math.PI * 2;

      trackList.forEach((track, tIdx) => {
        const ringIndex = Math.floor(tIdx / 8);
        const posInRing = tIdx % 8;
        const ringSize = Math.min(8, tCount - ringIndex * 8);
        const ringRadius = 38 + ringIndex * 24;
        const angle = baseSeed + (posInRing / Math.max(1, ringSize)) * Math.PI * 2 + ringIndex * 0.3;

        track.x = center.x + Math.cos(angle) * ringRadius;
        track.y = center.y + Math.sin(angle) * ringRadius;
        track.radius = track.radius || GalaxyLayoutEngine.RADIUS_MAP.track;
        track.color = track.color || GalaxyLayoutEngine.COLOR_MAP.track;

        const uIdx = unparentedTracks.indexOf(track);
        if (uIdx !== -1) unparentedTracks.splice(uIdx, 1);
      });
    }

    unparentedTracks.forEach((track, idx) => {
      const angle = (idx / (unparentedTracks.length || 1)) * Math.PI * 2;
      track.x = originX + Math.cos(angle) * 300;
      track.y = originY + Math.sin(angle) * 300;
      track.radius = track.radius || GalaxyLayoutEngine.RADIUS_MAP.track;
      track.color = track.color || GalaxyLayoutEngine.COLOR_MAP.track;
    });

    // 5. Outer Orbits for Playlists & Folders
    playlists.forEach((pl, idx) => {
      const angle = (idx / (playlists.length || 1)) * Math.PI * 2 + 0.5;
      pl.x = originX + Math.cos(angle) * (genreOrbitRadius + 450);
      pl.y = originY + Math.sin(angle) * (genreOrbitRadius + 450);
      pl.radius = pl.radius || GalaxyLayoutEngine.RADIUS_MAP.playlist;
      pl.color = pl.color || GalaxyLayoutEngine.COLOR_MAP.playlist;
    });

    folders.forEach((f, idx) => {
      const angle = (idx / (folders.length || 1)) * Math.PI * 2 + 1.0;
      f.x = originX + Math.cos(angle) * (genreOrbitRadius + 650);
      f.y = originY + Math.sin(angle) * (genreOrbitRadius + 650);
      f.radius = f.radius || GalaxyLayoutEngine.RADIUS_MAP.folder;
      f.color = f.color || GalaxyLayoutEngine.COLOR_MAP.folder;
    });

    return nodes;
  }
}
