import type { Track } from './models';

export type DuplicateMatchType = 'exact_hash' | 'exact_metadata' | 'fuzzy_metadata';

export interface DuplicateGroup {
  readonly id: string;
  readonly primaryTrack: Track;
  readonly duplicateTracks: readonly Track[];
  readonly matchType: DuplicateMatchType;
  readonly confidenceScore: number; // 0.0 to 1.0
  readonly reason: string;
}

export interface DuplicateDetectionSummary {
  readonly totalTracksScanned: number;
  readonly duplicateGroupsFound: number;
  readonly totalDuplicatesFound: number;
  readonly potentialSpaceSavingsBytes: number;
  readonly groups: readonly DuplicateGroup[];
}

export interface DuplicateResolutionPlan {
  readonly groupId: string;
  readonly keepTrackId: string;
  readonly removeTrackIds: readonly string[];
}
