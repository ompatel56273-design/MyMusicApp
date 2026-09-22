import type { IGenreRepository, PaginationOptions, PaginatedResult } from '../../domain/repositories/repository-contracts';
import type { Genre } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class GenreRepository implements IGenreRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<Genre | null> {
    return this.db.get<Genre>(STORES.GENRES, id);
  }

  public async getByName(name: string): Promise<Genre | null> {
    return this.db.getByIndex<Genre>(STORES.GENRES, 'by_name', name);
  }

  public async list(options?: PaginationOptions): Promise<PaginatedResult<Genre>> {
    let genres = await this.db.getAll<Genre>(STORES.GENRES);

    if (options?.sortBy) {
      const field = options.sortBy as keyof Genre;
      const dir = options.sortDirection === 'desc' ? -1 : 1;
      genres.sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }

    const total = genres.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginated = genres.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      offset,
      limit
    };
  }

  public async save(genre: Genre): Promise<void> {
    await this.db.put(STORES.GENRES, genre);
  }
}
