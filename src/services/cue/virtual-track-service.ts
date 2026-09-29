import type { CueSheet, VirtualTrackDefinition } from './cue-types';
import type { Track, AudioFile } from '../../domain/entities/models';
import type { ITrackRepository, IAudioFileRepository } from '../../domain/repositories/repository-contracts';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';
import { CueParser } from './cue-parser';

export class VirtualTrackService {
  private readonly logger = new Logger('VirtualTrackService');

  constructor(
    private readonly trackRepo: ITrackRepository,
    private readonly audioFileRepo: IAudioFileRepository,
    private readonly dbAdapter?: IDatabaseAdapter | undefined,
    private readonly eventBus?: EventBus | undefined
  ) {
    if (this.dbAdapter) {
      this.logger.debug('VirtualTrackService initialized with database adapter');
    }
  }

  /**
   * Generates virtual track definitions from a CueSheet and a physical AudioFile.
   */
  public createVirtualTrackDefinitions(
    cueSheet: CueSheet,
    sourceAudioFile: AudioFile,
    sourceTrackDurationMs?: number
  ): VirtualTrackDefinition[] {
    const virtualTracks: VirtualTrackDefinition[] = [];
    const sourceDurationMs = sourceTrackDurationMs || 0;

    for (const cueFile of cueSheet.files) {
      const tracks = cueFile.tracks;

      for (let i = 0; i < tracks.length; i++) {
        const trk = tracks[i]!;
        if (!trk.index01) continue;

        const startTimeMs = trk.index01.positionMs;
        let endTimeMs = 0;

        if (i < tracks.length - 1) {
          const nextTrk = tracks[i + 1]!;
          // Use next track's INDEX 00 if present, otherwise INDEX 01
          endTimeMs = nextTrk.index00 ? nextTrk.index00.positionMs : nextTrk.index01!.positionMs;
        } else {
          // Last track ends at physical source file duration (or +5 minutes fallback)
          endTimeMs = sourceDurationMs > startTimeMs ? sourceDurationMs : startTimeMs + 300000;
        }

        const durationMs = Math.max(0, endTimeMs - startTimeMs);
        const virtualTrackId = `cue_trk_${sourceAudioFile.id}_${trk.trackNumber}`;

        virtualTracks.push({
          virtualTrackId,
          sourceFileId: sourceAudioFile.id,
          sourcePath: sourceAudioFile.path,
          trackNumber: trk.trackNumber,
          title: trk.title || `Track ${String(trk.trackNumber).padStart(2, '0')}`,
          performer: trk.performer || cueSheet.performer || 'Unknown Artist',
          albumTitle: cueSheet.title || sourceAudioFile.filename.replace(/\.[^/.]+$/, ''),
          albumArtistName: cueSheet.performer || trk.performer || 'Unknown Artist',
          startTimeMs,
          endTimeMs,
          durationMs,
          sourceFormat: {
            container: (sourceAudioFile.extension || 'flac') as any,
            codec: (sourceAudioFile.extension || 'flac') as any,
            sampleRate: 44100,
            channels: 2,
            isLossless: ['flac', 'wav', 'alac', 'ape'].includes((sourceAudioFile.extension || '').toLowerCase())
          },
          cueSheetId: cueSheet.id
        });
      }
    }

    return virtualTracks;
  }

  /**
   * Converts virtual track definitions into domain Track entities and persists them safely into IndexedDB.
   */
  public async importVirtualTracks(
    virtualDefs: readonly VirtualTrackDefinition[]
  ): Promise<Track[]> {
    const savedTracks: Track[] = [];

    for (const def of virtualDefs) {
      const sourceAudioFile = await this.audioFileRepo.getById(def.sourceFileId);
      const isMissing = !sourceAudioFile || sourceAudioFile.availability === 'missing';

      const trackEntity: Track = {
        id: def.virtualTrackId,
        fileId: def.sourceFileId,
        title: def.title,
        artistName: def.performer || 'Unknown Artist',
        albumTitle: def.albumTitle || 'CUE Album',
        trackNumber: def.trackNumber,
        durationMs: def.durationMs,
        format: def.sourceFormat,
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 0,
        isFavorite: false,
        hasLyrics: false,
        availability: isMissing ? 'missing' : 'available',
        // Virtual CUE metadata properties
        isVirtualTrack: true,
        virtualStartTimeMs: def.startTimeMs,
        virtualEndTimeMs: def.endTimeMs,
        cueSheetId: def.cueSheetId,
        sourcePath: def.sourcePath
      } as any;

      await this.trackRepo.save(trackEntity);
      savedTracks.push(trackEntity);
    }

    this.notifyLibraryUpdated();
    return savedTracks;
  }

  /**
   * Imports a raw CUE sheet string for a given source AudioFile.
   */
  public async importCueSheetString(
    rawCueText: string,
    sourceAudioFile: AudioFile
  ): Promise<Track[]> {
    const parseResult = CueParser.parse(rawCueText);
    if (!parseResult.validation.valid) {
      throw new Error(`CUE Validation Failed:\n${parseResult.validation.errors.map(e => e.message).join('\n')}`);
    }

    const virtualDefs = this.createVirtualTrackDefinitions(parseResult.cueSheet, sourceAudioFile);
    return this.importVirtualTracks(virtualDefs);
  }

  private notifyLibraryUpdated(): void {
    if (this.eventBus) {
      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        tracksAdded: 1,
        tracksUpdated: 0,
        tracksRemoved: 0,
        timestamp: Date.now()
      });
    }
  }
}
