import type { ITrackRepository, PaginationOptions, PaginatedResult, TrackFilter } from '../../domain/repositories/repository-contracts';
import type { Track } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class TrackRepository implements ITrackRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<Track | null> {
    return this.db.get<Track>(STORES.TRACKS, id);
  }

  public async getByFileId(fileId: EntityId): Promise<Track | null> {
    return this.db.getByIndex<Track>(STORES.TRACKS, 'by_fileId', fileId);
  }

  public async list(options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>> {
    let tracks: Track[];

    if (filter?.artistId) {
      tracks = await this.db.getAllByIndex<Track>(STORES.TRACKS, 'by_artistId', filter.artistId);
    } else if (filter?.albumId) {
      tracks = await this.db.getAllByIndex<Track>(STORES.TRACKS, 'by_albumId', filter.albumId);
    } else if (filter?.genreId) {
      tracks = await this.db.getAllByIndex<Track>(STORES.TRACKS, 'by_genreId', filter.genreId);
    } else if (filter?.folderId) {
      tracks = await this.db.getAllByIndex<Track>(STORES.TRACKS, 'by_folderId', filter.folderId);
    } else {
      tracks = await this.db.getAll<Track>(STORES.TRACKS);
    }

    // Apply favorite filter
    if (filter?.isFavorite !== undefined) {
      tracks = tracks.filter(t => t.isFavorite === filter.isFavorite);
    }

    // Filter in-memory if text search filter is requested
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      tracks = tracks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.artistName && t.artistName.toLowerCase().includes(q)) ||
        (t.albumTitle && t.albumTitle.toLowerCase().includes(q))
      );
    }

    // Apply sorting
    if (options?.sortBy) {
      const field = options.sortBy as keyof Track;
      const dir = options.sortDirection === 'desc' ? -1 : 1;
      tracks.sort((a, b) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
      });
    }

    const total = tracks.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100000;
    const paginated = tracks.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      offset,
      limit
    };
  }

  public async save(track: Track): Promise<void> {
    await this.db.put(STORES.TRACKS, track);
  }

  public async saveBatch(tracks: readonly Track[]): Promise<void> {
    await this.db.putBatch(STORES.TRACKS, tracks);
  }

  public async delete(id: EntityId): Promise<void> {
    await this.db.delete(STORES.TRACKS, id);
  }

  public async setFavorite(id: EntityId, isFavorite: boolean): Promise<void> {
    const track = await this.getById(id);
    if (track) {
      const updated: Track = {
        ...track,
        isFavorite,
        dateModified: Date.now()
      };
      await this.db.put(STORES.TRACKS, updated);
    }
  }

  public async incrementPlayCount(id: EntityId, timestamp: number): Promise<void> {
    const track = await this.getById(id);
    if (track) {
      const updated: Track = {
        ...track,
        playCount: track.playCount + 1,
        lastPlayedAt: timestamp,
        dateModified: Date.now()
      };
      await this.db.put(STORES.TRACKS, updated);
    }
  }

  public async count(): Promise<number> {
    return this.db.count(STORES.TRACKS);
  }
}
