import type { IHistoryRepository } from '../../domain/repositories/repository-contracts';
import type { PlaybackHistoryItem, PlaybackPosition } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class HistoryRepository implements IHistoryRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getRecent(limit: number = 50): Promise<readonly PlaybackHistoryItem[]> {
    const records = await this.db.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);
    records.sort((a, b) => b.playedAt - a.playedAt);
    return records.slice(0, limit);
  }

  public async addRecord(record: Omit<PlaybackHistoryItem, 'id'>): Promise<void> {
    const fullRecord: PlaybackHistoryItem = {
      ...record,
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };
    await this.db.put(STORES.PLAYBACK_HISTORY, fullRecord);
  }

  public async getResumePosition(trackId: EntityId): Promise<PlaybackPosition | null> {
    return this.db.get<PlaybackPosition>(STORES.PLAYBACK_POSITIONS, trackId);
  }

  public async saveResumePosition(position: PlaybackPosition): Promise<void> {
    await this.db.put(STORES.PLAYBACK_POSITIONS, position);
  }

  public async clearResumePosition(trackId: EntityId): Promise<void> {
    await this.db.delete(STORES.PLAYBACK_POSITIONS, trackId);
  }
}
