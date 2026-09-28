import type { Album, Track } from './models';
import type { EntityId } from '../value-objects/audio-types';

/**
 * Represents a detected group of fragmented/duplicate album records.
 */
export interface AlbumMergeCandidateGroup {
  readonly key: string;
  readonly canonicalAlbumId: EntityId;
  readonly albums: readonly Album[];
  readonly totalTracks: number;
  readonly totalDurationMs: number;
  readonly confidence: 'high' | 'medium';
  readonly matchReason: string;
}

/**
 * Read-only preview of an album merge before execution.
 */
export interface AlbumMergePreview {
  readonly canonicalAlbum: Album;
  readonly mergedAlbums: readonly Album[];
  readonly affectedTracks: readonly Track[];
  readonly totalResultingTracks: number;
  readonly totalResultingDurationMs: number;
  readonly warnings: readonly string[];
}

/**
 * Result of executing an album merge operation.
 */
export interface AlbumMergeResult {
  readonly success: boolean;
  readonly canonicalAlbum: Album;
  readonly mergedAlbumIds: readonly EntityId[];
  readonly affectedTrackCount: number;
  readonly updatedTrackIds: readonly EntityId[];
  readonly timestamp: number;
  readonly errorMessage?: string | undefined;
}
