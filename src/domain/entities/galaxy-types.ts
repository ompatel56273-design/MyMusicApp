import type { EntityId } from '../value-objects/audio-types';

export type GalaxyNodeType = 'artist' | 'album' | 'track' | 'genre' | 'playlist' | 'folder';

export type GalaxyEdgeType =
  | 'artist-album'
  | 'album-track'
  | 'genre-artist'
  | 'genre-track'
  | 'playlist-track'
  | 'folder-track';

export interface GalaxyNodeMetadata {
  artistName?: string | undefined;
  albumTitle?: string | undefined;
  trackCount?: number | undefined;
  albumCount?: number | undefined;
  artistCount?: number | undefined;
  durationMs?: number | undefined;
  year?: number | undefined;
  genreName?: string | undefined;
  isFavorite?: boolean | undefined;
  isCompilation?: boolean | undefined;
  playCount?: number | undefined;
  lastPlayedAt?: number | undefined;
  recentPlayOrder?: number | undefined;
  albumList?: Array<{ id: EntityId; title: string; year?: number | undefined; trackCount?: number | undefined }> | undefined;
  trackList?: Array<{ id: EntityId; title: string; durationMs?: number | undefined; isFavorite?: boolean | undefined; playCount?: number | undefined }> | undefined;
}

export interface GalaxyNode {
  readonly id: string; // e.g. "artist:artist_1", "album:album_2"
  readonly type: GalaxyNodeType;
  readonly entityId: EntityId;
  readonly label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  lodMin: number; // 1 to 4
  lodMax: number;
  artworkId?: EntityId | undefined;
  metadata: GalaxyNodeMetadata;
}

export interface GalaxyEdge {
  readonly id: string; // e.g. "edge:artist_1-album_2"
  readonly sourceId: string;
  readonly targetId: string;
  readonly type: GalaxyEdgeType;
  readonly weight: number;
  readonly color: string;
}

export interface GalaxyGraph {
  readonly nodes: readonly GalaxyNode[];
  readonly edges: readonly GalaxyEdge[];
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly createdAt: number;
}

export interface GalaxyFilterOptions {
  readonly genreId?: EntityId | undefined;
  readonly artistId?: EntityId | undefined;
  readonly albumId?: EntityId | undefined;
  readonly showPlaylists?: boolean | undefined;
  readonly showFolders?: boolean | undefined;
  readonly searchQuery?: string | undefined;
}

export interface GalaxySettings {
  readonly defaultLOD: number;
  readonly showPlaylists: boolean;
  readonly showFolders: boolean;
  readonly reducedMotion: boolean;
}

export const DEFAULT_GALAXY_SETTINGS: GalaxySettings = {
  defaultLOD: 2,
  showPlaylists: true,
  showFolders: true,
  reducedMotion: false
};
