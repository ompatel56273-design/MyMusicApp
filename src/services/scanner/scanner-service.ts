import type { IScannerService } from '../contracts/service-contracts';
import type { IFilesystemAdapter, DiscoveredFileEntry } from './filesystem-adapter';
import type { IAudioFileRepository, ITrackRepository, IFolderRepository } from '../../domain/repositories/repository-contracts';
import type { AudioFile, Track, Folder } from '../../domain/entities/models';
import type { AudioContainer, AudioCodec } from '../../domain/value-objects/audio-types';
import type { ScanSessionStats, ScannerState, ScanProgressReport } from './scanner-types';
import { Logger } from '../../core/logging/logger';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { ScannerError } from '../../core/errors/app-error';
import { isSupportedAudioFile, getAudioExtension } from '../../core/audio/audio-validator';
import type { MetadataService } from '../metadata/metadata-service';

export class ScannerService implements IScannerService {
  private _state: ScannerState = 'idle';
  private abortController: AbortController | null = null;
  private readonly fsAdapter: IFilesystemAdapter;
  private readonly audioFileRepo: IAudioFileRepository;
  private readonly trackRepo: ITrackRepository;
  private readonly folderRepo: IFolderRepository;
  private readonly eventBus: EventBus;
  private readonly metadataService?: MetadataService | undefined;
  private readonly logger = new Logger('ScannerService');

  constructor(
    fsAdapter: IFilesystemAdapter,
    audioFileRepo: IAudioFileRepository,
    trackRepo: ITrackRepository,
    folderRepo: IFolderRepository,
    eventBus: EventBus,
    metadataService?: MetadataService
  ) {
    this.fsAdapter = fsAdapter;
    this.audioFileRepo = audioFileRepo;
    this.trackRepo = trackRepo;
    this.folderRepo = folderRepo;
    this.eventBus = eventBus;
    this.metadataService = metadataService;
  }

  public get isScanning(): boolean {
    return this._state === 'scanning' || this._state === 'preparing' || this._state === 'synchronizing';
  }

  public get state(): ScannerState {
    return this._state;
  }

  public async scanDirectory(path: string): Promise<void> {
    if (this.isScanning) {
      throw new ScannerError(
        'A library scan is already in progress.',
        'ERR_SCAN_ALREADY_RUNNING'
      );
    }

    const normalizedRoot = this.fsAdapter.normalizePath(path);
    if (!normalizedRoot) {
      throw new ScannerError('Invalid scan root path provided.', 'ERR_INVALID_SCAN_PATH');
    }

    this._state = 'preparing';
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const sessionId = `scan_${Date.now()}`;
    const startTime = Date.now();

    this.logger.info(`Starting library scan for root: ${normalizedRoot}`, { sessionId });

    let filesDiscovered = 0;
    let filesAdded = 0;
    let filesUpdated = 0;
    let filesUnchanged = 0;
    let filesMissing = 0;
    const errors: { path: string; message: string }[] = [];

    const discoveredPaths = new Set<string>();
    const pendingFileBatches: AudioFile[] = [];
    const pendingTrackBatches: Track[] = [];
    const newlyAddedTrackIds: { trackId: string; filePath: string; container: AudioContainer }[] = [];
    const BATCH_SIZE = 50;

    let lastProgressTime = 0;
    const emitProgress = (currentPath?: string, isComplete: boolean = false) => {
      const now = performance.now();
      // Throttle progress events to max 10/sec unless complete
      if (isComplete || now - lastProgressTime > 100) {
        lastProgressTime = now;
        const report: ScanProgressReport = {
          sessionId,
          rootPath: normalizedRoot,
          state: this._state,
          currentFile: currentPath,
          filesDiscovered,
          filesProcessed: filesAdded + filesUpdated + filesUnchanged,
          filesAdded,
          filesUpdated,
          filesMissing,
          isComplete
        };

        this.eventBus.publish(DomainEvents.SCAN_PROGRESS, report);
      }
    };

    try {
      // 1. Fetch existing indexed files under this scan root for incremental diffing
      const existingFilesMap = await this.audioFileRepo.listAllPaths();
      const existingRootFiles = new Map<string, { id: string; sizeBytes: number; modifiedTimeMs: number }>();

      for (const [filePath, meta] of existingFilesMap.entries()) {
        if (filePath === normalizedRoot || filePath.startsWith(normalizedRoot + '/')) {
          existingRootFiles.set(filePath, meta);
        }
      }

      this._state = 'scanning';
      emitProgress(undefined, false);

      // 2. Traverse filesystem and diff
      await this.fsAdapter.traverseDirectory(
        normalizedRoot,
        async (entry: DiscoveredFileEntry) => {
          if (signal.aborted) return;

          filesDiscovered++;
          discoveredPaths.add(entry.path);

          const existing = existingRootFiles.get(entry.path);

          if (existing) {
            // Check if modified
            if (existing.sizeBytes === entry.sizeBytes && existing.modifiedTimeMs === entry.modifiedTimeMs) {
              filesUnchanged++;
            } else {
              filesUpdated++;
              const updatedFile: AudioFile = {
                id: existing.id,
                path: entry.path,
                filename: entry.name,
                extension: entry.extension,
                sizeBytes: entry.sizeBytes,
                modifiedTimeMs: entry.modifiedTimeMs,
                scanSessionId: sessionId,
                availability: 'available'
              };
              pendingFileBatches.push(updatedFile);
            }
          } else {
            // New physical file discovered
            filesAdded++;
            const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            const newFile: AudioFile = {
              id: fileId,
              path: entry.path,
              filename: entry.name,
              extension: entry.extension,
              sizeBytes: entry.sizeBytes,
              modifiedTimeMs: entry.modifiedTimeMs,
              scanSessionId: sessionId,
              availability: 'available'
            };

            // Derive safe placeholder title from filename without extension
            const lastDot = entry.name.lastIndexOf('.');
            const cleanTitle = lastDot > 0 ? entry.name.substring(0, lastDot) : entry.name;
            const container = (entry.extension.toLowerCase() || 'unknown') as AudioContainer;
            const codec = container as unknown as AudioCodec;

            const newTrack: Track = {
              id: trackId,
              fileId,
              title: cleanTitle,
              durationMs: 0,
              format: {
                container,
                codec,
                sampleRate: 44100,
                channels: 2,
                isLossless: container === 'flac' || container === 'wav' || container === 'alac' || container === 'aiff'
              },
              dateAdded: Date.now(),
              dateModified: entry.modifiedTimeMs,
              playCount: 0,
              isFavorite: false,
              hasLyrics: false,
              availability: 'available'
            };

            pendingFileBatches.push(newFile);
            pendingTrackBatches.push(newTrack);
            newlyAddedTrackIds.push({ trackId, filePath: entry.path, container });
          }

          // Flush batch if full
          if (pendingFileBatches.length >= BATCH_SIZE) {
            await this.flushBatch(pendingFileBatches, pendingTrackBatches);
          }

          emitProgress(entry.path, false);
        },
        {
          onDirectory: async (dirPath: string) => {
            // Record folder hierarchy
            const folderName = dirPath.split('/').pop() || dirPath;
            const folder: Folder = {
              id: `folder_${dirPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
              path: dirPath,
              name: folderName,
              isMonitored: dirPath === normalizedRoot,
              lastScannedAt: Date.now(),
              trackCount: 0
            };
            await this.folderRepo.save(folder);
          },
          onError: (errPath: string, err: Error) => {
            this.logger.warn(`Filesystem error during scan at: ${errPath}`, { error: err.message });
            errors.push({ path: errPath, message: err.message });
          },
          signal
        }
      );

      // Flush remaining batch
      if (pendingFileBatches.length > 0) {
        await this.flushBatch(pendingFileBatches, pendingTrackBatches);
      }

      // Enrich metadata for newly added tracks if metadataService is present
      if (this.metadataService && newlyAddedTrackIds.length > 0 && !signal.aborted) {
        for (const item of newlyAddedTrackIds) {
          if (signal.aborted) break;
          try {
            const buffer = await this.fsAdapter.readFile(item.filePath);
            await this.metadataService.enrichTrackMetadata(item.trackId, buffer, item.container);
          } catch (enrichErr) {
            this.logger.warn(`Metadata enrichment skipped for: ${item.filePath}`, { error: String(enrichErr) });
          }
        }
      }

      if (signal.aborted) {
        this._state = 'cancelled';
        this.logger.info(`Scan cancelled by user for root: ${normalizedRoot}`);
        emitProgress(undefined, true);
        return;
      }

      // 3. Reconcile missing files
      this._state = 'synchronizing';
      for (const [existingPath, meta] of existingRootFiles.entries()) {
        if (!discoveredPaths.has(existingPath)) {
          filesMissing++;
          const existingAudioFile = await this.audioFileRepo.getById(meta.id);
          if (existingAudioFile) {
            await this.audioFileRepo.save({
              ...existingAudioFile,
              availability: 'missing'
            });
          }

          const existingTrack = await this.trackRepo.getByFileId(meta.id);
          if (existingTrack) {
            await this.trackRepo.save({
              ...existingTrack,
              availability: 'missing'
            });
          }
        }
      }

      this._state = 'completed';
      emitProgress(undefined, true);

      // Publish library updated event
      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        tracksAdded: filesAdded,
        tracksUpdated: filesUpdated,
        tracksRemoved: filesMissing,
        timestamp: Date.now()
      });

      const stats: ScanSessionStats = {
        sessionId,
        rootPath: normalizedRoot,
        startTime,
        endTime: Date.now(),
        state: this._state,
        filesDiscovered,
        filesAdded,
        filesUpdated,
        filesUnchanged,
        filesMissing,
        errors
      };

      this.logger.info(`Library scan completed successfully for root: ${normalizedRoot}`, stats as unknown as Record<string, unknown>);
    } catch (err) {
      this._state = 'failed';
      emitProgress(undefined, true);
      this.logger.error(`Library scan failed for root: ${normalizedRoot}`, err);
      throw err instanceof ScannerError ? err : new ScannerError('Library scan failed', 'ERR_SCAN_FAILED', undefined, err as Error);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Directly imports user-selected audio files from an input or file picker.
   */
  public async importFiles(
    files: readonly File[] | FileList
  ): Promise<{ filesAdded: number; filesSkipped: number }> {
    const fileList = Array.from(files);
    let filesAdded = 0;
    let filesSkipped = 0;
    const sessionId = `import_${Date.now()}`;

    const existingPaths = await this.audioFileRepo.listAllPaths();

    for (const file of fileList) {
      if (!isSupportedAudioFile(file)) {
        filesSkipped++;
        continue;
      }

      const ext = getAudioExtension(file.name) || 'mp3';
      const virtualPath = `local://files/${file.name}`;

      // Register file in adapter if supported
      if ('registerFile' in this.fsAdapter && typeof (this.fsAdapter as any).registerFile === 'function') {
        (this.fsAdapter as any).registerFile(virtualPath, file);
      }

      // Check if already in repository with same name/size/modified
      const existing = existingPaths.get(virtualPath);
      if (existing && existing.sizeBytes === file.size && existing.modifiedTimeMs === file.lastModified) {
        filesSkipped++;
        continue;
      }

      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const audioFile: AudioFile = {
        id: fileId,
        path: virtualPath,
        filename: file.name,
        extension: ext,
        sizeBytes: file.size,
        modifiedTimeMs: file.lastModified,
        scanSessionId: sessionId,
        availability: 'available'
      };

      const lastDot = file.name.lastIndexOf('.');
      const cleanTitle = lastDot > 0 ? file.name.substring(0, lastDot) : file.name;
      const container = ext as AudioContainer;

      const track: Track = {
        id: trackId,
        fileId,
        title: cleanTitle,
        durationMs: 0,
        format: {
          container,
          codec: container as unknown as AudioCodec,
          sampleRate: 44100,
          channels: 2,
          isLossless: container === 'flac' || container === 'wav' || container === 'alac' || container === 'aiff'
        },
        dateAdded: Date.now(),
        dateModified: file.lastModified,
        playCount: 0,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      };

      await this.audioFileRepo.save(audioFile);
      await this.trackRepo.save(track);
      filesAdded++;

      // Enrich metadata
      if (this.metadataService) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          await this.metadataService.enrichTrackMetadata(trackId, buffer, container);
        } catch (enrichErr) {
          this.logger.warn(`Metadata extraction failed for ${file.name}:`, { error: String(enrichErr) });
        }
      }
    }

    if (filesAdded > 0) {
      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        tracksAdded: filesAdded,
        tracksUpdated: 0,
        tracksRemoved: 0,
        timestamp: Date.now()
      });
    }

    return { filesAdded, filesSkipped };
  }

  public async cancelScan(): Promise<void> {
    if (!this.isScanning || !this.abortController) {
      return;
    }
    this.logger.info('Requesting scan cancellation...');
    this.abortController.abort();
  }

  private async flushBatch(files: AudioFile[], tracks: Track[]): Promise<void> {
    if (files.length > 0) {
      await this.audioFileRepo.saveBatch([...files]);
      files.length = 0;
    }
    if (tracks.length > 0) {
      await this.trackRepo.saveBatch([...tracks]);
      tracks.length = 0;
    }
  }
}
