import type { EqualizerPreset } from '../../domain/entities/audio-settings';
import type { Artist, Album, Genre, Folder, Lyrics } from '../../domain/entities/models';
import type { AudioContainer, AudioCodec, AvailabilityState } from '../../domain/value-objects/audio-types';

export const BACKUP_FORMAT_IDENTIFIER = 'mymusic';
export const CURRENT_BACKUP_VERSION = 1;

export interface BackupAudioFileRecord {
  readonly id: string;
  readonly path: string;
  readonly filename: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly modifiedTimeMs: number;
}

export interface BackupTrackRecord {
  readonly id: string;
  readonly fileId: string;
  readonly title: string;
  readonly artistId?: string | undefined;
  readonly artistName?: string | undefined;
  readonly albumId?: string | undefined;
  readonly albumTitle?: string | undefined;
  readonly albumArtistId?: string | undefined;
  readonly genreId?: string | undefined;
  readonly genreName?: string | undefined;
  readonly folderId?: string | undefined;
  readonly durationMs: number;
  readonly trackNumber?: number | undefined;
  readonly discNumber?: number | undefined;
  readonly year?: number | undefined;
  readonly format: {
    readonly container: AudioContainer;
    readonly codec: AudioCodec;
    readonly sampleRate: number;
    readonly bitrate?: number | undefined;
    readonly channels: number;
    readonly isLossless: boolean;
  };
  readonly replayGain?: {
    readonly trackGainDb?: number | undefined;
    readonly trackPeak?: number | undefined;
    readonly albumGainDb?: number | undefined;
    readonly albumPeak?: number | undefined;
  } | undefined;
  readonly dateAdded: number;
  readonly dateModified: number;
  readonly lastPlayedAt?: number | undefined;
  readonly playCount: number;
  readonly isFavorite: boolean;
  readonly hasLyrics: boolean;
  readonly availability?: AvailabilityState | undefined;
  readonly filePath?: string | undefined;
}

export interface BackupPlaylistRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly isSmart: boolean;
  readonly smartRulesJson?: string | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly trackCount: number;
  readonly durationMs: number;
}

export interface BackupPlaylistItemRecord {
  readonly id: string;
  readonly playlistId: string;
  readonly trackId: string;
  readonly position: number;
  readonly addedAt: number;
}

export interface BackupHistoryRecord {
  readonly id: string;
  readonly trackId: string;
  readonly playedAt: number;
  readonly durationListenedMs: number;
  readonly completed: boolean;
}

export interface BackupQueueRecord {
  readonly id: string;
  readonly trackId: string;
  readonly position: number;
  readonly addedReason?: 'user' | 'album' | 'playlist' | 'artist' | 'genre' | 'search' | undefined;
}

export interface BackupDataPayload {
  readonly tracks: readonly BackupTrackRecord[];
  readonly audioFiles?: readonly BackupAudioFileRecord[] | undefined;
  readonly playlists: readonly BackupPlaylistRecord[];
  readonly playlistItems: readonly BackupPlaylistItemRecord[];
  readonly history: readonly BackupHistoryRecord[];
  readonly favorites: readonly string[];
  readonly settings: Record<string, any>;
  readonly eqPresets: readonly EqualizerPreset[];
  readonly queue?: readonly BackupQueueRecord[] | undefined;
  readonly artists?: readonly Artist[] | undefined;
  readonly albums?: readonly Album[] | undefined;
  readonly genres?: readonly Genre[] | undefined;
  readonly folders?: readonly Folder[] | undefined;
  readonly lyrics?: readonly Lyrics[] | undefined;
}

export interface MyMusicBackupBundle {
  readonly format: typeof BACKUP_FORMAT_IDENTIFIER;
  readonly version: number;
  readonly createdAt: number;
  readonly appVersion: string;
  readonly data: BackupDataPayload;
}

export type ImportMode = 'restore' | 'merge';

export interface ValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly field?: string | undefined;
}

export interface BackupValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly bundle?: MyMusicBackupBundle | undefined;
}

export interface BackupImportPreview {
  readonly createdAt: number;
  readonly version: number;
  readonly appVersion: string;
  readonly totalTracksInBackup: number;
  readonly totalPlaylistsInBackup: number;
  readonly totalSmartPlaylistsInBackup: number;
  readonly totalHistoryInBackup: number;
  readonly totalFavoritesInBackup: number;
  readonly totalEqPresetsInBackup: number;

  readonly tracksToAdd: number;
  readonly tracksToUpdate: number;
  readonly tracksExisting: number;
  readonly tracksMissingFile: number;

  readonly playlistsToAdd: number;
  readonly playlistsToMerge: number;

  readonly historyToAdd: number;
  readonly favoritesToSync: number;

  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface BackupImportOptions {
  readonly mode: ImportMode;
}

export interface BackupImportResult {
  readonly success: boolean;
  readonly mode: ImportMode;
  readonly tracksImported: number;
  readonly playlistsImported: number;
  readonly historyImported: number;
  readonly favoritesImported: number;
  readonly settingsImported: boolean;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}
