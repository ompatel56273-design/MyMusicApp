import type { Track, Playlist, QueueItem } from '../entities/models';
import type { PlaybackState, RepeatMode, ShuffleMode, AbLoopState } from '../value-objects/audio-types';

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

export interface AbLoopChangedEvent {
  readonly abLoop: AbLoopState;
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

export interface SmartPlaylistChangedEvent {
  readonly playlist: Playlist;
  readonly action: 'created' | 'updated' | 'deleted' | 'evaluated';
}

export interface SleepTimerChangedEvent {
  readonly isActive: boolean;
  readonly startedAt: number | null;
  readonly durationMs: number;
  readonly endsAt: number | null;
  readonly remainingMs: number;
}

export interface SleepTimerExpiredEvent {
  readonly timestamp: number;
  readonly durationMs: number;
}

/**
 * Event string constants
 */
export const DomainEvents = {
  TRACK_CHANGED: 'playback:track-changed',
  PLAYBACK_STATE_CHANGED: 'playback:state-changed',
  PLAYBACK_TIME_UPDATED: 'playback:time-updated',
  PLAYBACK_MODES_CHANGED: 'playback:modes-changed',
  AB_LOOP_CHANGED: 'playback:ab-loop-changed',
  QUEUE_CHANGED: 'queue:changed',
  FAVORITE_CHANGED: 'library:favorite-changed',
  SCAN_PROGRESS: 'scanner:progress',
  LIBRARY_UPDATED: 'library:updated',
  PLAYLIST_UPDATED: 'playlist:updated',
  SMART_PLAYLIST_CREATED: 'smart-playlist:created',
  SMART_PLAYLIST_UPDATED: 'smart-playlist:updated',
  SMART_PLAYLIST_DELETED: 'smart-playlist:deleted',
  SMART_PLAYLIST_CHANGED: 'smart-playlist:changed',
  SLEEP_TIMER_CHANGED: 'playback:sleep-timer-changed',
  SLEEP_TIMER_EXPIRED: 'playback:sleep-timer-expired'
} as const;
