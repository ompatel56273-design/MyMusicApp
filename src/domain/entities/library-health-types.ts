export type LibraryHealthCategory =
  | 'library-stats'
  | 'file-availability'
  | 'duplicates'
  | 'missing-metadata'
  | 'incomplete-metadata'
  | 'invalid-duration'
  | 'unverifiable-files'
  | 'orphaned-metadata';

export type LibraryHealthStatus =
  | 'all-clear'
  | 'needs-attention'
  | 'verification-incomplete';

export type LibraryHealthIssueSeverity = 'info' | 'warning' | 'error';

export interface LibraryHealthIssue {
  readonly id: string;
  readonly category: LibraryHealthCategory;
  readonly trackId?: string | undefined;
  readonly trackTitle?: string | undefined;
  readonly artistName?: string | undefined;
  readonly albumTitle?: string | undefined;
  readonly description: string;
  readonly severity: LibraryHealthIssueSeverity;
  readonly targetTab?: 'songs' | 'albums' | 'artists' | 'genres' | 'folders' | 'duplicates' | undefined;
  readonly targetFilter?: string | undefined;
}

export interface LibraryHealthCategoryMetrics {
  // Library Overview
  readonly totalTracks: number;
  readonly totalAlbums: number;
  readonly totalArtists: number;
  readonly totalGenres: number;
  readonly totalPlaylists: number;
  readonly totalDurationMs: number;

  // File Availability
  readonly availableFiles: number;
  readonly missingFiles: number;
  readonly unverifiableFiles: number;
  readonly unsupportedFiles: number;

  // Duplicate Detection
  readonly duplicateGroupsCount: number;
  readonly duplicateTracksCount: number;
  readonly potentialSpaceSavingsBytes: number;

  // Metadata Completeness
  readonly completeMetadataCount: number;
  readonly missingTitleCount: number;
  readonly missingArtistCount: number;
  readonly missingAlbumCount: number;
  readonly missingGenreCount: number;
  readonly invalidDurationCount: number;
  readonly orphanedMetadataCount: number;

  // Timestamps
  readonly lastScanTimestamp?: number | undefined;
  readonly lastVerificationTimestamp?: number | undefined;
}

export interface LibraryHealthSnapshot {
  readonly timestamp: number;
  readonly status: LibraryHealthStatus;
  readonly metrics: LibraryHealthCategoryMetrics;
  readonly issues: readonly LibraryHealthIssue[];
  readonly verificationDurationMs: number;
  readonly isCancelled?: boolean | undefined;
}

export type HealthVerificationStage =
  | 'idle'
  | 'reading-tracks'
  | 'verifying-files'
  | 'detecting-duplicates'
  | 'checking-metadata'
  | 'complete'
  | 'cancelled';

export interface LibraryHealthProgress {
  readonly stage: HealthVerificationStage;
  readonly processedItems: number;
  readonly totalItems: number;
  readonly currentTaskDescription: string;
}
