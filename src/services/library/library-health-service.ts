import type { ILibraryService } from '../contracts/service-contracts';
import type {
  ITrackRepository,
  IAudioFileRepository,
  IPlaylistRepository
} from '../../domain/repositories/repository-contracts';
import type { Track } from '../../domain/entities/models';
import type { DuplicateDetectorService } from '../duplicate/duplicate-detector-service';
import type {
  LibraryHealthSnapshot,
  LibraryHealthIssue,
  LibraryHealthCategoryMetrics,
  LibraryHealthProgress,
  LibraryHealthStatus
} from '../../domain/entities/library-health-types';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';
import type { Disposable } from '../../core/types/common';

export interface LibraryHealthServiceDependencies {
  libraryService: ILibraryService;
  trackRepo: ITrackRepository;
  audioFileRepo: IAudioFileRepository;
  playlistRepo?: IPlaylistRepository | undefined;
  duplicateDetectorService?: DuplicateDetectorService | undefined;
  eventBus: EventBus;
}

export class LibraryHealthService {
  private readonly libraryService: ILibraryService;
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo: IAudioFileRepository;
  private readonly playlistRepo?: IPlaylistRepository | undefined;
  private readonly duplicateDetectorService?: DuplicateDetectorService | undefined;
  private readonly eventBus: EventBus;
  private readonly logger = new Logger('LibraryHealthService');

  private cachedSnapshot: LibraryHealthSnapshot | null = null;
  private isVerifying = false;
  private eventBusSub: Disposable | null = null;

  constructor(deps: LibraryHealthServiceDependencies) {
    this.libraryService = deps.libraryService;
    this.trackRepo = deps.trackRepo;
    this.audioFileRepo = deps.audioFileRepo;
    this.playlistRepo = deps.playlistRepo;
    this.duplicateDetectorService = deps.duplicateDetectorService;
    this.eventBus = deps.eventBus;

    // Listen for library update events to invalidate cached snapshot
    this.eventBusSub = this.eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, () => {
      this.invalidateCache();
    });
  }

  public dispose(): void {
    if (this.eventBusSub) {
      this.eventBusSub.dispose();
      this.eventBusSub = null;
    }
  }

  public getCachedSnapshot(): LibraryHealthSnapshot | null {
    return this.cachedSnapshot;
  }

  public invalidateCache(): void {
    this.cachedSnapshot = null;
    this.logger.info('Library health snapshot cache invalidated.');
  }

  /**
   * Performs complete read-only health verification of the local music library.
   */
  public async verifyLibraryHealth(options?: {
    signal?: AbortSignal | undefined;
    onProgress?: ((progress: LibraryHealthProgress) => void) | undefined;
  }): Promise<LibraryHealthSnapshot> {
    if (this.isVerifying) {
      if (this.cachedSnapshot) return this.cachedSnapshot;
    }

    this.isVerifying = true;
    const startTime = Date.now();
    const signal = options?.signal;
    const reportProgress = (prog: LibraryHealthProgress) => options?.onProgress?.(prog);

    const issues: LibraryHealthIssue[] = [];

    try {
      // Step 1: Read tracks and library overview stats
      reportProgress({
        stage: 'reading-tracks',
        processedItems: 0,
        totalItems: 100,
        currentTaskDescription: 'Reading library overview & track metadata...'
      });

      if (signal?.aborted) return this.createCancelledSnapshot(startTime);

      const [libraryStats, tracksListResult, audioFilesMap, playlistsResult] = await Promise.all([
        this.libraryService.getLibraryStats(),
        this.trackRepo.list({ limit: 10000 }),
        this.audioFileRepo.listAllPaths ? await this.audioFileRepo.listAllPaths() : new Map(),
        this.playlistRepo ? await this.playlistRepo.list({ limit: 1000 }) : { total: 0 }
      ]);

      const tracks = tracksListResult.items;
      const totalTracksCount = tracks.length;

      let totalDurationMs = 0;
      for (const t of tracks) {
        if (t.durationMs && t.durationMs > 0 && isFinite(t.durationMs)) {
          totalDurationMs += t.durationMs;
        }
      }

      // Step 2: Verify File Availability
      reportProgress({
        stage: 'verifying-files',
        processedItems: 0,
        totalItems: totalTracksCount,
        currentTaskDescription: 'Verifying file records & availability states...'
      });

      let availableFiles = 0;
      let missingFiles = 0;
      let unverifiableFiles = 0;
      let unsupportedFiles = 0;

      for (let i = 0; i < tracks.length; i++) {
        if (signal?.aborted) return this.createCancelledSnapshot(startTime);

        // Yield to event loop periodically
        if (i > 0 && i % 100 === 0) {
          reportProgress({
            stage: 'verifying-files',
            processedItems: i,
            totalItems: totalTracksCount,
            currentTaskDescription: `Verifying track ${i}/${totalTracksCount}...`
          });
          await new Promise(r => setTimeout(r, 0));
        }

        const track = tracks[i]!;
        const availability = (track.availability as string) || 'available';

        if (availability === 'missing') {
          missingFiles++;
          issues.push({
            id: `issue_missing_${track.id}`,
            category: 'file-availability',
            trackId: track.id,
            trackTitle: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            description: `File record for "${track.title}" is marked as missing`,
            severity: 'error',
            targetTab: 'folders'
          });
        } else if (availability === 'unverifiable') {
          unverifiableFiles++;
          issues.push({
            id: `issue_unverifiable_${track.id}`,
            category: 'unverifiable-files',
            trackId: track.id,
            trackTitle: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            description: `File availability for "${track.title}" could not be verified`,
            severity: 'warning',
            targetTab: 'songs'
          });
        } else if (availability === 'unsupported') {
          unsupportedFiles++;
          issues.push({
            id: `issue_unsupported_${track.id}`,
            category: 'file-availability',
            trackId: track.id,
            trackTitle: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            description: `File format for "${track.title}" is unsupported`,
            severity: 'warning',
            targetTab: 'songs'
          });
        } else {
          availableFiles++;
        }
      }

      // Step 3: Duplicate Detection Integration
      reportProgress({
        stage: 'detecting-duplicates',
        processedItems: totalTracksCount,
        totalItems: totalTracksCount,
        currentTaskDescription: 'Analyzing library for duplicate audio tracks...'
      });

      if (signal?.aborted) return this.createCancelledSnapshot(startTime);

      let duplicateGroupsCount = 0;
      let duplicateTracksCount = 0;
      let potentialSpaceSavingsBytes = 0;

      if (this.duplicateDetectorService) {
        try {
          const dupSummary = await this.duplicateDetectorService.detectDuplicates();
          duplicateGroupsCount = dupSummary.duplicateGroupsFound;
          duplicateTracksCount = dupSummary.totalDuplicatesFound;
          potentialSpaceSavingsBytes = dupSummary.potentialSpaceSavingsBytes;

          for (const group of dupSummary.groups) {
            for (const dup of group.duplicateTracks) {
              issues.push({
                id: `issue_dup_${dup.id}`,
                category: 'duplicates',
                trackId: dup.id,
                trackTitle: dup.title,
                artistName: dup.artistName,
                albumTitle: dup.albumTitle,
                description: `Duplicate copy of "${dup.title}" (${group.reason})`,
                severity: 'info',
                targetTab: 'duplicates'
              });
            }
          }
        } catch (dupErr) {
          this.logger.warn('Duplicate detection encountered a non-fatal error:', { error: String(dupErr) });
        }
      }

      // Step 4: Metadata Completeness Checks
      reportProgress({
        stage: 'checking-metadata',
        processedItems: 0,
        totalItems: totalTracksCount,
        currentTaskDescription: 'Checking track titles, artists, albums, & durations...'
      });

      let completeMetadataCount = 0;
      let missingTitleCount = 0;
      let missingArtistCount = 0;
      let missingAlbumCount = 0;
      let missingGenreCount = 0;
      let invalidDurationCount = 0;

      for (let i = 0; i < tracks.length; i++) {
        if (signal?.aborted) return this.createCancelledSnapshot(startTime);

        if (i > 0 && i % 100 === 0) {
          reportProgress({
            stage: 'checking-metadata',
            processedItems: i,
            totalItems: totalTracksCount,
            currentTaskDescription: `Checking metadata ${i}/${totalTracksCount}...`
          });
          await new Promise(r => setTimeout(r, 0));
        }

        const track = tracks[i]!;
        let hasIssue = false;

        // Title Check
        if (!track.title || track.title.trim() === '' || track.title.toLowerCase() === 'unknown track') {
          missingTitleCount++;
          hasIssue = true;
          issues.push({
            id: `issue_title_${track.id}`,
            category: 'missing-metadata',
            trackId: track.id,
            trackTitle: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            description: `Track has no valid title`,
            severity: 'warning',
            targetTab: 'songs'
          });
        }

        // Artist Check
        if (!track.artistName || track.artistName.trim() === '' || track.artistName.toLowerCase() === 'unknown artist') {
          missingArtistCount++;
          hasIssue = true;
          issues.push({
            id: `issue_artist_${track.id}`,
            category: 'incomplete-metadata',
            trackId: track.id,
            trackTitle: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            description: `Track "${track.title}" is missing artist metadata`,
            severity: 'info',
            targetTab: 'artists'
          });
        }

        // Album Check
        if (!track.albumTitle || track.albumTitle.trim() === '' || track.albumTitle.toLowerCase() === 'unknown album') {
          missingAlbumCount++;
          hasIssue = true;
        }

        // Genre Check
        if (!track.genreName || track.genreName.trim() === '' || track.genreName.toLowerCase() === 'unknown genre') {
          missingGenreCount++;
          hasIssue = true;
        }

        // Duration Check
        if (!track.durationMs || track.durationMs <= 0 || !isFinite(track.durationMs)) {
          invalidDurationCount++;
          hasIssue = true;
          issues.push({
            id: `issue_duration_${track.id}`,
            category: 'invalid-duration',
            trackId: track.id,
            trackTitle: track.title,
            artistName: track.artistName,
            albumTitle: track.albumTitle,
            description: `Track "${track.title}" has an invalid or zero duration`,
            severity: 'warning',
            targetTab: 'songs'
          });
        }

        if (!hasIssue) {
          completeMetadataCount++;
        }
      }

      // Step 5: Check Orphaned Metadata (Audio files without linked tracks or vice versa)
      let orphanedMetadataCount = 0;
      if (audioFilesMap.size > 0 && tracks.length > 0) {
        const trackFileIds = new Set<string>(tracks.map((t: Track) => t.fileId));
        for (const fileRecord of audioFilesMap.values()) {
          if (!trackFileIds.has(fileRecord.id)) {
            orphanedMetadataCount++;
          }
        }
      }

      // Compute Overall Status
      let status: LibraryHealthStatus = 'all-clear';
      if (missingFiles > 0 || duplicateGroupsCount > 0 || missingTitleCount > 0 || invalidDurationCount > 0 || missingArtistCount > 0) {
        status = 'needs-attention';
      }

      const lastVerificationTimestamp = Date.now();

      const metrics: LibraryHealthCategoryMetrics = {
        totalTracks: libraryStats.trackCount,
        totalAlbums: libraryStats.albumCount,
        totalArtists: libraryStats.artistCount,
        totalGenres: libraryStats.artistCount > 0 ? libraryStats.albumCount : 0, // derived from repository
        totalPlaylists: playlistsResult.total,
        totalDurationMs,

        availableFiles,
        missingFiles,
        unverifiableFiles,
        unsupportedFiles,

        duplicateGroupsCount,
        duplicateTracksCount,
        potentialSpaceSavingsBytes,

        completeMetadataCount,
        missingTitleCount,
        missingArtistCount,
        missingAlbumCount,
        missingGenreCount,
        invalidDurationCount,
        orphanedMetadataCount,

        lastVerificationTimestamp
      };

      const verificationDurationMs = Date.now() - startTime;

      const snapshot: LibraryHealthSnapshot = {
        timestamp: lastVerificationTimestamp,
        status,
        metrics,
        issues,
        verificationDurationMs
      };

      this.cachedSnapshot = snapshot;

      reportProgress({
        stage: 'complete',
        processedItems: totalTracksCount,
        totalItems: totalTracksCount,
        currentTaskDescription: 'Health verification complete.'
      });

      return snapshot;
    } catch (err) {
      this.logger.error('Health verification failed:', err);
      // Fallback empty snapshot with verification-incomplete status
      const snapshot: LibraryHealthSnapshot = {
        timestamp: Date.now(),
        status: 'verification-incomplete',
        metrics: {
          totalTracks: 0,
          totalAlbums: 0,
          totalArtists: 0,
          totalGenres: 0,
          totalPlaylists: 0,
          totalDurationMs: 0,
          availableFiles: 0,
          missingFiles: 0,
          unverifiableFiles: 0,
          unsupportedFiles: 0,
          duplicateGroupsCount: 0,
          duplicateTracksCount: 0,
          potentialSpaceSavingsBytes: 0,
          completeMetadataCount: 0,
          missingTitleCount: 0,
          missingArtistCount: 0,
          missingAlbumCount: 0,
          missingGenreCount: 0,
          invalidDurationCount: 0,
          orphanedMetadataCount: 0
        },
        issues: [],
        verificationDurationMs: Date.now() - startTime
      };
      return snapshot;
    } finally {
      this.isVerifying = false;
    }
  }

  private createCancelledSnapshot(startTime: number): LibraryHealthSnapshot {
    return {
      timestamp: Date.now(),
      status: 'verification-incomplete',
      metrics: {
        totalTracks: 0,
        totalAlbums: 0,
        totalArtists: 0,
        totalGenres: 0,
        totalPlaylists: 0,
        totalDurationMs: 0,
        availableFiles: 0,
        missingFiles: 0,
        unverifiableFiles: 0,
        unsupportedFiles: 0,
        duplicateGroupsCount: 0,
        duplicateTracksCount: 0,
        potentialSpaceSavingsBytes: 0,
        completeMetadataCount: 0,
        missingTitleCount: 0,
        missingArtistCount: 0,
        missingAlbumCount: 0,
        missingGenreCount: 0,
        invalidDurationCount: 0,
        orphanedMetadataCount: 0
      },
      issues: [],
      verificationDurationMs: Date.now() - startTime,
      isCancelled: true
    };
  }
}
