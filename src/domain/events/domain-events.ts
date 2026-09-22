import type { Track, Playlist, QueueItem } from '../entities/models';
import type { PlaybackState, RepeatMode, ShuffleMode } from '../value-objects/audio-types';

/**
 * Strongly-typed domain events broadcasted across application boundaries.
 */

export interface TrackChangedEvent {
  readonly currentTrack: Track | null;
  readonly previousTrack: Track | null;
  readonly positionMs: number;
}

export interface PlaybackStateChangedEvent {
  readonly state: PlaybackState;
  readonly track: Track | null;
  readonly positionMs: number;
  readonly durationMs: number;
}

export interface PlaybackTimeUpdatedEvent {
  readonly positionMs: number;
  readonly durationMs: number;
}

export interface PlaybackModesChangedEvent {
  readonly repeat: RepeatMode;
  readonly shuffle: ShuffleMode;
}

export interface QueueChangedEvent {
  readonly items: readonly QueueItem[];
  readonly activeIndex: number;
}

export interface FavoriteChangedEvent {
  readonly trackId: string;
  readonly isFavorite: boolean;
}

export interface LibraryScanProgressEvent {
  readonly rootPath: string;
  readonly scannedCount: number;
  readonly totalEstimated?: number;
  readonly currentFile?: string;
  readonly isComplete: boolean;
}

export interface LibraryUpdatedEvent {
  readonly tracksAdded: number;
  readonly tracksUpdated: number;
  readonly tracksRemoved: number;
  readonly timestamp: number;
}

export interface PlaylistUpdatedEvent {
  readonly playlist: Playlist;
  readonly action: 'created' | 'updated' | 'deleted';
}

/**
 * Event string constants
 */
export const DomainEvents = {
  TRACK_CHANGED: 'playback:track-changed',
  PLAYBACK_STATE_CHANGED: 'playback:state-changed',
  PLAYBACK_TIME_UPDATED: 'playback:time-updated',
  PLAYBACK_MODES_CHANGED: 'playback:modes-changed',
  QUEUE_CHANGED: 'queue:changed',
  FAVORITE_CHANGED: 'library:favorite-changed',
  SCAN_PROGRESS: 'scanner:progress',
  LIBRARY_UPDATED: 'library:updated',
  PLAYLIST_UPDATED: 'playlist:updated'
} as const;
