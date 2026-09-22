import type { ILyricsRepository } from '../../domain/repositories/repository-contracts';
import type { Lyrics } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class LyricsRepository implements ILyricsRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getByTrackId(trackId: EntityId): Promise<Lyrics | null> {
    return this.db.getByIndex<Lyrics>(STORES.LYRICS, 'by_trackId', trackId);
  }

  public async save(lyrics: Lyrics): Promise<void> {
    await this.db.put(STORES.LYRICS, lyrics);
  }

  public async deleteByTrackId(trackId: EntityId): Promise<void> {
    const existing = await this.getByTrackId(trackId);
    if (existing) {
      await this.db.delete(STORES.LYRICS, existing.id);
    }
  }
}
