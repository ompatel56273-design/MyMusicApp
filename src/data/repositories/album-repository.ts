import type { IAlbumRepository, PaginationOptions, PaginatedResult } from '../../domain/repositories/repository-contracts';
import type { Album } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class AlbumRepository implements IAlbumRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<Album | null> {
    return this.db.get<Album>(STORES.ALBUMS, id);
  }

  public async list(options?: PaginationOptions, artistId?: EntityId): Promise<PaginatedResult<Album>> {
    let albums: Album[];

    if (artistId) {
      albums = await this.db.getAllByIndex<Album>(STORES.ALBUMS, 'by_artistId', artistId);
    } else {
      albums = await this.db.getAll<Album>(STORES.ALBUMS);
    }

    if (options?.sortBy) {
      const field = options.sortBy as keyof Album;
      const dir = options.sortDirection === 'desc' ? -1 : 1;
      albums.sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }

    const total = albums.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginated = albums.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      offset,
      limit
    };
  }

  public async save(album: Album): Promise<void> {
    await this.db.put(STORES.ALBUMS, album);
  }

  public async saveBatch(albums: readonly Album[]): Promise<void> {
    await this.db.putBatch(STORES.ALBUMS, albums);
  }

  public async delete(id: EntityId): Promise<void> {
    await this.db.delete(STORES.ALBUMS, id);
  }
}
