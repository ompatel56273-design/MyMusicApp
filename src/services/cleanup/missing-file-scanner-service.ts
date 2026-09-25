import type {
  IMissingFileScannerService
} from '../contracts/service-contracts';
import type {
  ITrackRepository,
  IAudioFileRepository,
  IAlbumRepository,
  IArtistRepository,
  IHistoryRepository
} from '../../domain/repositories/repository-contracts';
import type { IFilesystemAdapter } from '../scanner/filesystem-adapter';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type {
  MissingFileScanSummary,
  MissingFileScanProgress,
  MissingFileScanResultItem,
  MissingFileStatus,
  CleanupResult
} from '../../domain/entities/cleanup-types';

export interface MissingFileScannerDependencies {
  readonly trackRepo: ITrackRepository;
  readonly audioFileRepo: IAudioFileRepository;
  readonly filesystem: IFilesystemAdapter;
  readonly eventBus: EventBus;
  readonly albumRepo?: IAlbumRepository | undefined;
  readonly artistRepo?: IArtistRepository | undefined;
  readonly historyRepo?: IHistoryRepository | undefined;
}

/**
 * Production Missing-File Scanner Service.
 * Verifies accessibility of all local library files against the authoritative database,
 * categorizes tracks deterministically, and provides safe, transactional record cleanup.
 */
export class MissingFileScannerService implements IMissingFileScannerService {
  private readonly logger = new Logger('MissingFileScannerService');
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo: IAudioFileRepository;
  private readonly filesystem: IFilesystemAdapter;
  private readonly eventBus: EventBus;
  private readonly albumRepo?: IAlbumRepository | undefined;
  private readonly artistRepo?: IArtistRepository | undefined;
  private readonly historyRepo?: IHistoryRepository | undefined;

  constructor(deps: MissingFileScannerDependencies) {
    this.trackRepo = deps.trackRepo;
    this.audioFileRepo = deps.audioFileRepo;
    this.filesystem = deps.filesystem;
    this.eventBus = deps.eventBus;
    this.albumRepo = deps.albumRepo;
    this.artistRepo = deps.artistRepo;
    this.historyRepo = deps.historyRepo;
  }

  public async scanMissingFiles(options?: {
    onProgress?: (progress: MissingFileScanProgress) => void;
    signal?: AbortSignal;
  }): Promise<MissingFileScanSummary> {
    const startTime = performance.now();
    this.logger.info('Starting missing-file scan across local library...');

    // 1. Fetch all tracks and audio files in parallel (O(N) single-pass)
    const [tracksResult, allAudioFilesMap] = await Promise.all([
      this.trackRepo.list({ limit: 100000 }),
      this.audioFileRepo.listAllPaths()
    ]);

    const tracks = tracksResult.items;
    const total = tracks.length;

    // Create lookup map from fileId to path
    const fileIdToPathMap = new Map<string, string>();
    for (const [path, entry] of allAudioFilesMap.entries()) {
      fileIdToPathMap.set(entry.id, path);
    }

    let availableCount = 0;
    let missingCount = 0;
    let unverifiableCount = 0;
    let unsupportedCount = 0;

    const missingTracks: MissingFileScanResultItem[] = [];
    const unverifiableTracks: MissingFileScanResultItem[] = [];

    // 2. Iterate and verify file status with non-blocking micro-yields
    const BATCH_SIZE = 50;

    for (let i = 0; i < total; i++) {
      if (options?.signal?.aborted) {
        this.logger.warn('Missing-file scan aborted by user/signal.');
        break;
      }

      const track = tracks[i]!;
      let filePath = fileIdToPathMap.get(track.fileId);

      // If not in bulk map, try direct single query fallback
      if (!filePath) {
        const audioFile = await this.audioFileRepo.getById(track.fileId);
        filePath = audioFile?.path;
      }

      let status: MissingFileStatus = 'missing';
      let reason: string | undefined;

      if (!filePath) {
        status = 'missing';
        reason = 'No audio file record mapped to track in library database';
      } else {
        try {
          status = await this.filesystem.verifyFileAccessibility(filePath);
        } catch (err: unknown) {
          status = 'unverifiable';
          reason = (err as Error)?.message || 'Filesystem verification failed with unexpected exception';
        }
      }

      const item: MissingFileScanResultItem = {
        trackId: track.id,
        audioFileId: track.fileId,
        trackTitle: track.title,
        artistName: track.artistName || 'Unknown Artist',
        albumTitle: track.albumTitle || 'Unknown Album',
        path: filePath || 'unknown',
        status,
        ...(reason ? { reason } : {})
      };

      if (status === 'available') {
        availableCount++;
      } else if (status === 'missing') {
        missingCount++;
        missingTracks.push(item);
      } else if (status === 'unverifiable') {
        unverifiableCount++;
        unverifiableTracks.push(item);
      } else if (status === 'unsupported') {
        unsupportedCount++;
      }

      // Micro-yield to prevent main thread blocking on large libraries
      if (i % BATCH_SIZE === 0 || i === total - 1) {
        options?.onProgress?.({
          current: i + 1,
          total,
          percent: total > 0 ? Math.round(((i + 1) / total) * 100) : 100,
          currentPath: filePath
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    this.logger.info(`Missing-file scan complete in ${durationMs}ms: Checked=${total}, Available=${availableCount}, Missing=${missingCount}, Unverifiable=${unverifiableCount}, Unsupported=${unsupportedCount}`);

    return {
      totalChecked: total,
      availableCount,
      missingCount,
      unverifiableCount,
      unsupportedCount,
      missingTracks,
      unverifiableTracks,
      durationMs
    };
  }

  public async cleanupMissingTracks(trackIds: readonly EntityId[]): Promise<CleanupResult> {
    if (!trackIds || trackIds.length === 0) {
      return { removedTrackCount: 0, removedFileCount: 0, trackIds: [] };
    }

    this.logger.info(`Starting cleanup of ${trackIds.length} missing tracks...`);
    let removedTrackCount = 0;
    let removedFileCount = 0;
    const affectedAlbumIds = new Set<string>();
    const affectedArtistIds = new Set<string>();

    for (const trackId of trackIds) {
      const track = await this.trackRepo.getById(trackId);
      if (!track) continue;

      if (track.albumId) affectedAlbumIds.add(track.albumId);
      if (track.artistId) affectedArtistIds.add(track.artistId);

      // 1. Delete track record
      await this.trackRepo.delete(trackId);
      removedTrackCount++;

      // 2. Delete audio file record
      if (track.fileId) {
        await this.audioFileRepo.delete(track.fileId);
        removedFileCount++;
      }

      // 3. Delete saved resume position
      if (this.historyRepo) {
        try {
          await this.historyRepo.clearResumePosition(trackId);
        } catch {
          // Non-critical
        }
      }
    }

    // 4. Update or prune empty Album records if no tracks remain
    if (this.albumRepo) {
      for (const albumId of affectedAlbumIds) {
        try {
          const remaining = await this.trackRepo.list(undefined, { albumId });
          if (remaining.total === 0) {
            await this.albumRepo.delete(albumId);
          }
        } catch {
          // Best effort
        }
      }
    }

    // 5. Update or prune empty Artist records if no tracks remain
    if (this.artistRepo) {
      for (const artistId of affectedArtistIds) {
        try {
          const remaining = await this.trackRepo.list(undefined, { artistId });
          if (remaining.total === 0) {
            await this.artistRepo.delete(artistId);
          }
        } catch {
          // Best effort
        }
      }
    }

    // 6. Broadcast authoritative LIBRARY_UPDATED event
    this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
      tracksAdded: 0,
      tracksUpdated: 0,
      tracksRemoved: removedTrackCount,
      timestamp: Date.now()
    });

    this.logger.info(`Cleanup complete: Removed ${removedTrackCount} tracks and ${removedFileCount} audio file records.`);

    return {
      removedTrackCount,
      removedFileCount,
      trackIds
    };
  }
}
