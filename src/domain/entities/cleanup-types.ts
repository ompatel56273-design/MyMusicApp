import type { EntityId } from '../value-objects/audio-types';

export type MissingFileStatus = 'available' | 'missing' | 'unverifiable' | 'unsupported';

export interface MissingFileScanResultItem {
  readonly trackId: EntityId;
  readonly audioFileId: EntityId;
  readonly trackTitle: string;
  readonly artistName: string;
  readonly albumTitle: string;
  readonly path: string;
  readonly status: MissingFileStatus;
  readonly reason?: string | undefined;
}

export interface MissingFileScanSummary {
  readonly totalChecked: number;
  readonly availableCount: number;
  readonly missingCount: number;
  readonly unverifiableCount: number;
  readonly unsupportedCount: number;
  readonly missingTracks: readonly MissingFileScanResultItem[];
  readonly unverifiableTracks: readonly MissingFileScanResultItem[];
  readonly durationMs: number;
}

export interface MissingFileScanProgress {
  readonly current: number;
  readonly total: number;
  readonly percent: number;
  readonly currentPath?: string | undefined;
}

export interface CleanupResult {
  readonly removedTrackCount: number;
  readonly removedFileCount: number;
  readonly trackIds: readonly EntityId[];
}
