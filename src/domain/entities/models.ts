import type {
  EntityId,
  AvailabilityState,
  AudioFormatInfo,
  ReplayGainData,
  ArtistRole
} from '../value-objects/audio-types';

export interface Track {
  readonly id: EntityId;
  readonly fileId: EntityId;
  readonly title: string;
  readonly artistId?: EntityId | undefined;
  readonly artistName?: string | undefined;
  readonly albumId?: EntityId | undefined;
  readonly albumTitle?: string | undefined;
  readonly albumArtistId?: EntityId | undefined;
  readonly genreId?: EntityId | undefined;
  readonly genreName?: string | undefined;
  readonly folderId?: EntityId | undefined;
  readonly artworkId?: EntityId | undefined;
  readonly durationMs: number;
  readonly trackNumber?: number | undefined;
  readonly discNumber?: number | undefined;
  readonly year?: number | undefined;
  readonly format: AudioFormatInfo;
  readonly replayGain?: ReplayGainData | undefined;
  readonly dateAdded: number;
  readonly dateModified: number;
  readonly lastPlayedAt?: number | undefined;
  readonly playCount: number;
  readonly isFavorite: boolean;
  readonly hasLyrics: boolean;
  readonly availability: AvailabilityState;
}

export interface AudioFile {
  readonly id: EntityId;
  readonly path: string;
  readonly filename: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly modifiedTimeMs: number;
  readonly contentHash?: string | undefined;
  readonly scanSessionId?: EntityId | undefined;
  readonly availability: AvailabilityState;
}

export interface Artist {
  readonly id: EntityId;
  readonly name: string;
  readonly sortName?: string | undefined;
  readonly bio?: string | undefined;
  readonly artworkId?: EntityId | undefined;
  readonly trackCount: number;
  readonly albumCount: number;
}

export interface TrackArtistLink {
  readonly trackId: EntityId;
  readonly artistId: EntityId;
  readonly role: ArtistRole;
}

export interface Album {
  readonly id: EntityId;
  readonly title: string;
  readonly sortTitle?: string | undefined;
  readonly artistId?: EntityId | undefined;
  readonly artistName?: string | undefined;
  readonly year?: number | undefined;
  readonly genreId?: EntityId | undefined;
  readonly trackCount: number;
  readonly durationMs: number;
  readonly artworkId?: EntityId | undefined;
  readonly isCompilation: boolean;
  readonly dateAdded: number;
}

export interface Genre {
  readonly id: EntityId;
  readonly name: string;
  readonly trackCount: number;
}

export interface Folder {
  readonly id: EntityId;
  readonly path: string;
  readonly parentId?: EntityId | undefined;
  readonly name: string;
  readonly isMonitored: boolean;
  readonly lastScannedAt?: number | undefined;
  readonly trackCount: number;
}

export interface Playlist {
  readonly id: EntityId;
  readonly name: string;
  readonly description?: string | undefined;
  readonly isSmart: boolean;
  readonly smartRulesJson?: string | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly trackCount: number;
  readonly durationMs: number;
  readonly artworkId?: EntityId | undefined;
}

export interface PlaylistItem {
  readonly id: EntityId;
  readonly playlistId: EntityId;
  readonly trackId: EntityId;
  readonly position: number;
  readonly addedAt: number;
}

export interface QueueItem {
  readonly id: EntityId;
  readonly trackId: EntityId;
  readonly position: number;
  readonly addedReason?: 'user' | 'album' | 'playlist' | 'artist' | 'genre' | 'search' | undefined;
}

export interface PlaybackHistoryItem {
  readonly id: EntityId;
  readonly trackId: EntityId;
  readonly playedAt: number;
  readonly durationListenedMs: number;
  readonly completed: boolean;
}

export interface PlaybackPosition {
  readonly trackId: EntityId;
  readonly positionMs: number;
  readonly updatedAt: number;
}

export interface LyricLine {
  readonly timeMs: number;
  readonly text: string;
}

export interface Lyrics {
  readonly id: EntityId;
  readonly trackId: EntityId;
  readonly type: 'synced' | 'plain';
  readonly plainText: string;
  readonly lines: readonly LyricLine[];
  readonly source?: 'embedded' | 'lrc_file' | 'manual' | 'online' | undefined;
  readonly offsetMs?: number | undefined;
  readonly updatedAt: number;
}

