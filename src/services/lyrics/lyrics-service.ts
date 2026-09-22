import type { ILyricsService } from '../contracts/service-contracts';
import type { ILyricsRepository, ITrackRepository } from '../../domain/repositories/repository-contracts';
import type { Lyrics } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import { LrcParser } from './lrc-parser';
import { Logger } from '../../core/logging/logger';

export interface LyricsServiceDependencies {
  lyricsRepo: ILyricsRepository;
  trackRepo?: ITrackRepository | undefined;
}

/**
 * Single authoritative Lyrics domain service.
 * Manages lyric parsing, persistent caching, and track association.
 */
export class LyricsService implements ILyricsService {
  private readonly lyricsRepo: ILyricsRepository;
  private readonly trackRepo?: ITrackRepository | undefined;
  private readonly logger = new Logger('LyricsService');

  constructor(deps: LyricsServiceDependencies) {
    this.lyricsRepo = deps.lyricsRepo;
    this.trackRepo = deps.trackRepo;
  }

  public async getLyrics(trackId: EntityId): Promise<Lyrics | null> {
    if (!trackId) return null;
    return this.lyricsRepo.getByTrackId(trackId);
  }

  public async saveLyrics(lyrics: Lyrics): Promise<void> {
    if (!lyrics || !lyrics.trackId) {
      throw new Error('Invalid lyrics payload: trackId is required.');
    }

    await this.lyricsRepo.save(lyrics);

    // If track repository is attached, update hasLyrics flag on track if needed
    if (this.trackRepo) {
      const track = await this.trackRepo.getById(lyrics.trackId);
      if (track && !track.hasLyrics) {
        await this.trackRepo.save({
          ...track,
          hasLyrics: true
        });
      }
    }

    this.logger.info(`Saved ${lyrics.type} lyrics for track "${lyrics.trackId}"`);
  }

  public parseLrc(lrcContent: string, trackId: EntityId = 'unknown_track'): Lyrics {
    return LrcParser.parse(lrcContent, trackId);
  }

  public async deleteLyrics(trackId: EntityId): Promise<void> {
    if (!trackId) return;
    await this.lyricsRepo.deleteByTrackId(trackId);

    if (this.trackRepo) {
      const track = await this.trackRepo.getById(trackId);
      if (track && track.hasLyrics) {
        await this.trackRepo.save({
          ...track,
          hasLyrics: false
        });
      }
    }
  }
}
