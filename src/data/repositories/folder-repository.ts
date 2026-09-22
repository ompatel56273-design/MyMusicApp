import type { IFolderRepository } from '../../domain/repositories/repository-contracts';
import type { Folder } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class FolderRepository implements IFolderRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<Folder | null> {
    return this.db.get<Folder>(STORES.FOLDERS, id);
  }

  public async getByPath(path: string): Promise<Folder | null> {
    return this.db.getByIndex<Folder>(STORES.FOLDERS, 'by_path', path);
  }

  public async listChildren(parentId?: EntityId): Promise<readonly Folder[]> {
    if (parentId) {
      return this.db.getAllByIndex<Folder>(STORES.FOLDERS, 'by_parentId', parentId);
    }
    const all = await this.db.getAll<Folder>(STORES.FOLDERS);
    return all.filter(f => !f.parentId);
  }

  public async save(folder: Folder): Promise<void> {
    await this.db.put(STORES.FOLDERS, folder);
  }

  public async delete(id: EntityId): Promise<void> {
    await this.db.delete(STORES.FOLDERS, id);
  }
}
