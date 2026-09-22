import type { IQueueRepository } from '../../domain/repositories/repository-contracts';
import type { QueueItem } from '../../domain/entities/models';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class QueueRepository implements IQueueRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getQueue(): Promise<readonly QueueItem[]> {
    const items = await this.db.getAll<QueueItem>(STORES.QUEUE_ITEMS);
    return items.sort((a, b) => a.position - b.position);
  }

  public async saveQueue(items: readonly QueueItem[]): Promise<void> {
    await this.db.clear(STORES.QUEUE_ITEMS);
    await this.db.putBatch(STORES.QUEUE_ITEMS, items);
  }

  public async clearQueue(): Promise<void> {
    await this.db.clear(STORES.QUEUE_ITEMS);
  }
}
