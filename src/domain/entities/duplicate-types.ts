import type { Track } from './models';
import type { EntityId } from '../value-objects/audio-types';

export type DuplicateMatchLevel =
  | 'exact_file'
  | 'exact_metadata'
  | 'high_confidence'
  | 'likely_duplicate';

export interface DuplicateCandidate {
  readonly track: Track;
  readonly matchLevel: DuplicateMatchLevel;
  readonly confidenceScore: number; // 0.0 - 1.0
  readonly reason: string;
  readonly fileSizeDiffBytes?: number | undefined;
}

export interface DuplicateGroup {
  readonly id: string;
  readonly primaryTrack: Track;
  readonly candidates: readonly DuplicateCandidate[];
  readonly matchLevel: DuplicateMatchLevel;
  readonly reason: string;
  readonly potentialSavingsBytes: number;
}

export interface DuplicateScanResult {
  readonly groups: readonly DuplicateGroup[];
  readonly totalDuplicateTracks: number;
  readonly totalGroups: number;
  readonly potentialSavingsBytes: number;
  readonly scannedAt: number;
}

export interface DuplicateDetectionOptions {
  readonly durationToleranceMs?: number | undefined;
  readonly includeLikely?: boolean | undefined;
}

export interface DuplicateResolutionAction {
  readonly trackId: EntityId;
  readonly action: 'keep' | 'remove_from_library';
}

export interface DuplicateResolutionResult {
  readonly removedCount: number;
  readonly errors: readonly string[];
}
