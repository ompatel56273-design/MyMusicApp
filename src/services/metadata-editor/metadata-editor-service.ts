import type { ITrackRepository, IAudioFileRepository } from '../../domain/repositories/repository-contracts';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import type { BrowserFilesystemAdapter } from '../scanner/browser-filesystem-adapter';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { STORES } from '../../data/db/schema';
import { Logger } from '../../core/logging/logger';
import type { Track, AudioFile, Artist, Album, Genre } from '../../domain/entities/models';

import type {
  SingleTrackEditPayload,
  BatchEditPayload,
  NormalizationOptions,
  TrackChangePreview,
  BatchPreviewResult,
  SingleTrackWriteResult,
  BatchWriteResult,
  EditableMetadataFields
} from './metadata-write-types';

import { MetadataWriteEngine } from './metadata-write-engine';
import { FilenamePatternEngine } from './filename-pattern-engine';
import { MetadataNormalizer } from './metadata-normalizer';

export class MetadataEditorService {
  private readonly logger = new Logger('MetadataEditorService');

  constructor(
    private readonly trackRepo: ITrackRepository,
    private readonly audioFileRepo: IAudioFileRepository,
    private readonly fsAdapter: BrowserFilesystemAdapter,
    private readonly dbAdapter: IDatabaseAdapter,
    private readonly eventBus?: EventBus
  ) {}

  /**
   * Generates a preview for editing a single track's metadata.
   */
  public async getSingleTrackPreview(
    trackId: string,
    edits: SingleTrackEditPayload
  ): Promise<TrackChangePreview> {
    const track = await this.trackRepo.getById(trackId);
    if (!track) {
      throw new Error(`Track with ID "${trackId}" not found.`);
    }

    const audioFile = await this.audioFileRepo.getById(track.fileId);
    const filename = audioFile?.filename || track.title;
    const canWrite = MetadataWriteEngine.canWrite(filename);

    const currentMetadata: EditableMetadataFields = {
      title: track.title,
      artist: track.artistName,
      albumArtist: track.albumArtistId ? track.artistName : undefined,
      album: track.albumTitle,
      genre: track.genreName,
      year: track.year,
      trackNumber: track.trackNumber,
      discNumber: track.discNumber
    };

    const proposedMetadata: EditableMetadataFields = {
      title: edits.title !== undefined ? edits.title : currentMetadata.title,
      artist: edits.artist !== undefined ? edits.artist : currentMetadata.artist,
      albumArtist: edits.albumArtist !== undefined ? edits.albumArtist : currentMetadata.albumArtist,
      album: edits.album !== undefined ? edits.album : currentMetadata.album,
      genre: edits.genre !== undefined ? edits.genre : currentMetadata.genre,
      year: edits.year !== undefined ? edits.year : currentMetadata.year,
      trackNumber: edits.trackNumber !== undefined ? edits.trackNumber : currentMetadata.trackNumber,
      totalTracks: edits.totalTracks !== undefined ? edits.totalTracks : undefined,
      discNumber: edits.discNumber !== undefined ? edits.discNumber : currentMetadata.discNumber,
      totalDiscs: edits.totalDiscs !== undefined ? edits.totalDiscs : undefined,
      composer: edits.composer !== undefined ? edits.composer : undefined,
      comment: edits.comment !== undefined ? edits.comment : undefined
    };

    return {
      track,
      audioFile: audioFile || undefined,
      currentMetadata,
      proposedMetadata,
      canWrite,
      reasonIfCannotWrite: canWrite ? undefined : 'Metadata editing is not supported for this file format.'
    };
  }

  /**
   * Executes a single track metadata edit. Writes to physical file first, then updates IndexedDB.
   */
  public async executeSingleTrackEdit(
    trackId: string,
    edits: SingleTrackEditPayload
  ): Promise<SingleTrackWriteResult> {
    const preview = await this.getSingleTrackPreview(trackId, edits);
    if (!preview.canWrite) {
      return {
        success: false,
        trackId,
        error: preview.reasonIfCannotWrite || 'File format does not support writing.'
      };
    }

    const audioFile = preview.audioFile;
    if (!audioFile) {
      return {
        success: false,
        trackId,
        error: 'Audio file record not found.'
      };
    }

    try {
      // 1. Read physical file bytes
      const originalBuffer = await this.fsAdapter.readFile(audioFile.path);

      // 2. Modify binary tags in memory & verify
      const modifiedBuffer = MetadataWriteEngine.updateBuffer(
        originalBuffer,
        audioFile.filename,
        preview.proposedMetadata,
        edits.artwork
      );

      // 3. Write physical file back to filesystem
      await this.writePhysicalFile(audioFile.path, modifiedBuffer);

      // 4. Update IndexedDB Track & related records
      const updatedTrack = await this.updateDatabaseTrack(preview.track, preview.proposedMetadata);

      // 5. Emit domain event
      this.notifyLibraryUpdated();

      return {
        success: true,
        trackId,
        updatedTrack
      };
    } catch (err) {
      this.logger.error(`Failed to update metadata for track "${trackId}":`, err);
      return {
        success: false,
        trackId,
        error: (err as Error).message
      };
    }
  }

  /**
   * Generates previews for a batch metadata edit across multiple tracks.
   */
  public async getBatchEditPreview(
    trackIds: readonly string[],
    payload: BatchEditPayload
  ): Promise<BatchPreviewResult> {
    const previews: TrackChangePreview[] = [];
    const collisions: string[] = [];
    let writableCount = 0;
    let unsupportedCount = 0;

    for (let i = 0; i < trackIds.length; i++) {
      const id = trackIds[i]!;
      const track = await this.trackRepo.getById(id);
      if (!track) continue;

      const audioFile = await this.audioFileRepo.getById(track.fileId);
      const filename = audioFile?.filename || track.title;
      const canWrite = MetadataWriteEngine.canWrite(filename);

      if (canWrite) writableCount++;
      else unsupportedCount++;

      const currentMetadata: EditableMetadataFields = {
        title: track.title,
        artist: track.artistName,
        albumArtist: track.artistName,
        album: track.albumTitle,
        genre: track.genreName,
        year: track.year,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber
      };

      const proposedMetadata: EditableMetadataFields = {
        title: payload.title?.strategy === 'replace' ? payload.title.value : currentMetadata.title,
        artist: payload.artist?.strategy === 'replace' ? payload.artist.value : currentMetadata.artist,
        albumArtist: payload.albumArtist?.strategy === 'replace' ? payload.albumArtist.value : currentMetadata.albumArtist,
        album: payload.album?.strategy === 'replace' ? payload.album.value : currentMetadata.album,
        genre: payload.genre?.strategy === 'replace' ? payload.genre.value : currentMetadata.genre,
        year: payload.year?.strategy === 'replace' ? payload.year.value : currentMetadata.year,
        composer: payload.composer?.strategy === 'replace' ? payload.composer.value : undefined,
        comment: payload.comment?.strategy === 'replace' ? payload.comment.value : undefined,
        trackNumber: payload.trackNumbering?.enabled ? payload.trackNumbering.startNumber + i : currentMetadata.trackNumber
      };

      previews.push({
        track,
        audioFile: audioFile || undefined,
        currentMetadata,
        proposedMetadata,
        canWrite,
        reasonIfCannotWrite: canWrite ? undefined : 'Metadata editing is not supported for this file format.'
      });
    }

    return {
      previews,
      totalSelected: trackIds.length,
      writableCount,
      unsupportedCount,
      collisions
    };
  }

  /**
   * Executes a batch metadata edit across multiple tracks.
   */
  public async executeBatchEdit(
    trackIds: readonly string[],
    payload: BatchEditPayload
  ): Promise<BatchWriteResult> {
    const { previews } = await this.getBatchEditPreview(trackIds, payload);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: Array<{ trackId: string; title: string; status: 'success' | 'failed' | 'skipped'; reason?: string; newFilePath?: string }> = [];

    for (const prev of previews) {
      if (!prev.canWrite) {
        skippedCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'skipped',
          reason: prev.reasonIfCannotWrite || 'Unsupported file format.'
        });
        continue;
      }

      const res = await this.executeSingleTrackEdit(prev.track.id, {
        ...prev.proposedMetadata,
        artwork: payload.artwork
      });

      if (res.success) {
        successCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'success'
        });
      } else {
        failedCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'failed',
          reason: res.error || 'Write failed.'
        });
      }
    }

    return {
      totalProcessed: previews.length,
      successCount,
      failedCount,
      skippedCount,
      results
    };
  }

  /**
   * Generates a preview for renaming files using tag pattern.
   */
  public async getRenamePreview(
    trackIds: readonly string[],
    pattern: string
  ): Promise<BatchPreviewResult> {
    const previews: TrackChangePreview[] = [];
    const proposedNamesSet = new Set<string>();
    const collisions: string[] = [];
    let writableCount = 0;
    let unsupportedCount = 0;

    for (const id of trackIds) {
      const track = await this.trackRepo.getById(id);
      if (!track) continue;

      const audioFile = await this.audioFileRepo.getById(track.fileId);
      const filename = audioFile?.filename || `${track.title}.mp3`;
      const canWrite = MetadataWriteEngine.canWrite(filename);

      if (canWrite) writableCount++;
      else unsupportedCount++;

      const meta: EditableMetadataFields = {
        title: track.title,
        artist: track.artistName,
        album: track.albumTitle,
        genre: track.genreName,
        year: track.year,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber
      };

      const proposedFilename = FilenamePatternEngine.generateFilenameFromTags(pattern, meta, filename);

      if (proposedNamesSet.has(proposedFilename.toLowerCase())) {
        collisions.push(`Duplicate target filename generated: "${proposedFilename}"`);
      } else {
        proposedNamesSet.add(proposedFilename.toLowerCase());
      }

      previews.push({
        track,
        audioFile: audioFile || undefined,
        currentMetadata: meta,
        proposedMetadata: meta,
        proposedFilename,
        canWrite,
        reasonIfCannotWrite: canWrite ? undefined : 'Format not supported for file operations.'
      });
    }

    return {
      previews,
      totalSelected: trackIds.length,
      writableCount,
      unsupportedCount,
      collisions
    };
  }

  /**
   * Executes physical file renaming based on metadata pattern.
   */
  public async executeRename(
    trackIds: readonly string[],
    pattern: string
  ): Promise<BatchWriteResult> {
    const { previews, collisions } = await this.getRenamePreview(trackIds, pattern);

    if (collisions.length > 0) {
      throw new Error(`Renaming cancelled due to filename collisions:\n${collisions.join('\n')}`);
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: Array<{ trackId: string; title: string; status: 'success' | 'failed' | 'skipped'; reason?: string; newFilePath?: string }> = [];

    for (const prev of previews) {
      if (!prev.canWrite || !prev.audioFile || !prev.proposedFilename) {
        skippedCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'skipped',
          reason: 'Cannot write or file not found.'
        });
        continue;
      }

      try {
        const oldPath = prev.audioFile.path;
        const newPath = this.buildNewPath(oldPath, prev.proposedFilename);

        if (oldPath !== newPath) {
          // Read original bytes
          const bytes = await this.fsAdapter.readFile(oldPath);
          // Write to new path
          await this.writePhysicalFile(newPath, bytes);

          // Update AudioFile record path in IndexedDB
          const updatedFile: AudioFile = {
            ...prev.audioFile,
            path: newPath,
            filename: prev.proposedFilename
          };
          await this.audioFileRepo.save(updatedFile);
        }

        successCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'success',
          newFilePath: newPath
        });
      } catch (err) {
        failedCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'failed',
          reason: (err as Error).message
        });
      }
    }

    this.notifyLibraryUpdated();

    return {
      totalProcessed: previews.length,
      successCount,
      failedCount,
      skippedCount,
      results
    };
  }

  /**
   * Generates a preview for metadata text normalization.
   */
  public async getNormalizationPreview(
    trackIds: readonly string[],
    options: NormalizationOptions
  ): Promise<BatchPreviewResult> {
    const previews: TrackChangePreview[] = [];
    let writableCount = 0;
    let unsupportedCount = 0;

    for (const id of trackIds) {
      const track = await this.trackRepo.getById(id);
      if (!track) continue;

      const audioFile = await this.audioFileRepo.getById(track.fileId);
      const filename = audioFile?.filename || track.title;
      const canWrite = MetadataWriteEngine.canWrite(filename);

      if (canWrite) writableCount++;
      else unsupportedCount++;

      const currentMetadata: EditableMetadataFields = {
        title: track.title,
        artist: track.artistName,
        albumArtist: track.artistName,
        album: track.albumTitle,
        genre: track.genreName,
        year: track.year
      };

      const proposedMetadata = MetadataNormalizer.normalizeFields(currentMetadata, options);

      previews.push({
        track,
        audioFile: audioFile || undefined,
        currentMetadata,
        proposedMetadata,
        canWrite,
        reasonIfCannotWrite: canWrite ? undefined : 'Format not supported for editing.'
      });
    }

    return {
      previews,
      totalSelected: trackIds.length,
      writableCount,
      unsupportedCount,
      collisions: []
    };
  }

  /**
   * Executes metadata text normalization across selected tracks.
   */
  public async executeNormalization(
    trackIds: readonly string[],
    options: NormalizationOptions
  ): Promise<BatchWriteResult> {
    const { previews } = await this.getNormalizationPreview(trackIds, options);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results: Array<{ trackId: string; title: string; status: 'success' | 'failed' | 'skipped'; reason?: string }> = [];

    for (const prev of previews) {
      if (!prev.canWrite) {
        skippedCount++;
        results.push({
          trackId: prev.track.id,
          title: prev.track.title,
          status: 'skipped'
        });
        continue;
      }

      const res = await this.executeSingleTrackEdit(prev.track.id, prev.proposedMetadata);
      if (res.success) {
        successCount++;
        results.push({ trackId: prev.track.id, title: prev.track.title, status: 'success' });
      } else {
        failedCount++;
        results.push({ trackId: prev.track.id, title: prev.track.title, status: 'failed', reason: res.error ?? 'Normalization failed.' });
      }
    }

    return {
      totalProcessed: previews.length,
      successCount,
      failedCount,
      skippedCount,
      results
    };
  }

  private async writePhysicalFile(filePath: string, bytes: Uint8Array): Promise<void> {
    // If registered via FileSystemDirectoryHandle, use createWritable
    const rootHandle = this.fsAdapter.getDirectoryHandle(this.extractParentDir(filePath));
    if (rootHandle) {
      const fileName = filePath.split('/').pop() || filePath;
      const fileHandle = await rootHandle.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(bytes);
      await writable.close();
      return;
    }

    // Otherwise update registered memory file
    const file = new File([new Uint8Array(bytes)], filePath.split('/').pop() || 'audio.mp3');
    this.fsAdapter.registerFile(filePath, file);
  }

  private async updateDatabaseTrack(track: Track, newMeta: EditableMetadataFields): Promise<Track> {
    // Check/create Artist entity
    let artistId = track.artistId;
    if (newMeta.artist) {
      const existingArtist = await this.dbAdapter.getByIndex<Artist>(STORES.ARTISTS, 'by_name', newMeta.artist);
      if (existingArtist) {
        artistId = existingArtist.id;
      } else {
        artistId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newArtist: Artist = {
          id: artistId,
          name: newMeta.artist,
          trackCount: 1,
          albumCount: 1
        };
        await this.dbAdapter.put(STORES.ARTISTS, newArtist);
      }
    }

    // Check/create Album entity
    let albumId = track.albumId;
    if (newMeta.album) {
      const existingAlbum = await this.dbAdapter.getByIndex<Album>(STORES.ALBUMS, 'by_title', newMeta.album);
      if (existingAlbum) {
        albumId = existingAlbum.id;
      } else {
        albumId = `alb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newAlbum: Album = {
          id: albumId,
          title: newMeta.album,
          artistId,
          artistName: newMeta.artist || track.artistName,
          year: newMeta.year || track.year,
          trackCount: 1,
          durationMs: track.durationMs,
          isCompilation: false,
          dateAdded: Date.now()
        };
        await this.dbAdapter.put(STORES.ALBUMS, newAlbum);
      }
    }

    // Check/create Genre entity
    let genreId = track.genreId;
    if (newMeta.genre) {
      const existingGenre = await this.dbAdapter.getByIndex<Genre>(STORES.GENRES, 'by_name', newMeta.genre);
      if (existingGenre) {
        genreId = existingGenre.id;
      } else {
        genreId = `gnr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newGenre: Genre = {
          id: genreId,
          name: newMeta.genre,
          trackCount: 1
        };
        await this.dbAdapter.put(STORES.GENRES, newGenre);
      }
    }

    const updatedTrack: Track = {
      ...track,
      title: newMeta.title || track.title,
      artistId,
      artistName: newMeta.artist || track.artistName,
      albumId,
      albumTitle: newMeta.album || track.albumTitle,
      genreId,
      genreName: newMeta.genre || track.genreName,
      year: newMeta.year !== undefined ? newMeta.year : track.year,
      trackNumber: newMeta.trackNumber !== undefined ? newMeta.trackNumber : track.trackNumber,
      discNumber: newMeta.discNumber !== undefined ? newMeta.discNumber : track.discNumber,
      dateModified: Date.now()
    };

    await this.trackRepo.save(updatedTrack);
    return updatedTrack;
  }

  private buildNewPath(oldPath: string, newFilename: string): string {
    const parts = oldPath.replace(/\\/g, '/').split('/');
    parts.pop();
    parts.push(newFilename);
    return parts.join('/');
  }

  private extractParentDir(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    parts.pop();
    return parts.join('/');
  }

  private notifyLibraryUpdated(): void {
    if (this.eventBus) {
      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        tracksAdded: 0,
        tracksUpdated: 1,
        tracksRemoved: 0,
        timestamp: Date.now()
      });
    }
  }
}
