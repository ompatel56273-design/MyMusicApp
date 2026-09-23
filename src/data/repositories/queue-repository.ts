import type { IQueueRepository, QueueMetadata } from '../../domain/repositories/repository-contracts';
import type { QueueItem } from '../../domain/entities/models';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class QueueRepository implements IQueueRepository {
  public static readonly METADATA_KEY = 'playback_queue_state';
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getQueue(): Promise<readonly QueueItem[]> {
    try {
      const items = await this.db.getAll<QueueItem>(STORES.QUEUE_ITEMS);
      return (items || []).sort((a, b) => a.position - b.position);
    } catch {
      return [];
    }
  }

  public async saveQueue(items: readonly QueueItem[]): Promise<void> {
    try {
      await this.db.clear(STORES.QUEUE_ITEMS);
      if (items.length > 0) {
        await this.db.putBatch(STORES.QUEUE_ITEMS, items);
      }
    } catch {
      // Safe fallback
    }
  }

  public async clearQueue(): Promise<void> {
    try {
      await this.db.clear(STORES.QUEUE_ITEMS);
      await this.db.delete(STORES.SETTINGS, QueueRepository.METADATA_KEY);
    } catch {
      // Safe fallback
    }
  }

  public async getQueueMetadata(): Promise<QueueMetadata | null> {
    try {
      const record = await this.db.get<{ key: string; value: QueueMetadata }>(
        STORES.SETTINGS,
        QueueRepository.METADATA_KEY
      );
      return record?.value ?? null;
    } catch {
      return null;
    }
  }

  public async saveQueueMetadata(metadata: QueueMetadata): Promise<void> {
    try {
      await this.db.put(STORES.SETTINGS, {
        key: QueueRepository.METADATA_KEY,
        value: metadata
      });
    } catch {
      // Safe fallback
    }
  }
}
