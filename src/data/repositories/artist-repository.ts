import type { IArtistRepository, PaginationOptions, PaginatedResult } from '../../domain/repositories/repository-contracts';
import type { Artist } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class ArtistRepository implements IArtistRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<Artist | null> {
    return this.db.get<Artist>(STORES.ARTISTS, id);
  }

  public async getByName(name: string): Promise<Artist | null> {
    return this.db.getByIndex<Artist>(STORES.ARTISTS, 'by_name', name);
  }

  public async list(options?: PaginationOptions): Promise<PaginatedResult<Artist>> {
    let artists = await this.db.getAll<Artist>(STORES.ARTISTS);

    if (options?.sortBy) {
      const field = options.sortBy as keyof Artist;
      const dir = options.sortDirection === 'desc' ? -1 : 1;
      artists.sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }

    const total = artists.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginated = artists.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      offset,
      limit
    };
  }

  public async save(artist: Artist): Promise<void> {
    await this.db.put(STORES.ARTISTS, artist);
  }

  public async saveBatch(artists: readonly Artist[]): Promise<void> {
    await this.db.putBatch(STORES.ARTISTS, artists);
  }

  public async delete(id: EntityId): Promise<void> {
    await this.db.delete(STORES.ARTISTS, id);
  }
}
