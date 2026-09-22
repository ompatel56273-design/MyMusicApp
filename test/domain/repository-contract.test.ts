import { describe, it, expect } from 'vitest';
import type { ITrackRepository, PaginationOptions, PaginatedResult, TrackFilter } from '../../src/domain/repositories/repository-contracts';
import type { Track } from '../../src/domain/entities/models';
import type { EntityId } from '../../src/domain/value-objects/audio-types';

/**
 * In-Memory Test Double verifying ITrackRepository contract adherence
 */
class InMemoryTrackRepository implements ITrackRepository {
  private tracks = new Map<EntityId, Track>();

  async getById(id: EntityId): Promise<Track | null> {
    return this.tracks.get(id) ?? null;
  }

  async getByFileId(fileId: EntityId): Promise<Track | null> {
    for (const track of this.tracks.values()) {
      if (track.fileId === fileId) return track;
    }
    return null;
  }

  async list(options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>> {
    let list = Array.from(this.tracks.values());

    if (filter?.isFavorite !== undefined) {
      list = list.filter(t => t.isFavorite === filter.isFavorite);
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginated = list.slice(offset, offset + limit);

    return {
      items: paginated,
      total: list.length,
      offset,
      limit
    };
  }

  async save(track: Track): Promise<void> {
    this.tracks.set(track.id, track);
  }

  async saveBatch(tracks: readonly Track[]): Promise<void> {
    for (const track of tracks) {
      this.tracks.set(track.id, track);
    }
  }

  async delete(id: EntityId): Promise<void> {
    this.tracks.delete(id);
  }

  async setFavorite(id: EntityId, isFavorite: boolean): Promise<void> {
    const track = this.tracks.get(id);
    if (track) {
      this.tracks.set(id, { ...track, isFavorite });
    }
  }

  async incrementPlayCount(id: EntityId, timestamp: number): Promise<void> {
    const track = this.tracks.get(id);
    if (track) {
      this.tracks.set(id, {
        ...track,
        playCount: track.playCount + 1,
        lastPlayedAt: timestamp
      });
    }
  }

  async count(): Promise<number> {
    return this.tracks.size;
  }
}

describe('Repository Contracts (ITrackRepository Test Double)', () => {
  it('should save, retrieve, and filter tracks', async () => {
    const repo = new InMemoryTrackRepository();

    const track1: Track = {
      id: 't-1',
      fileId: 'f-1',
      title: 'Track One',
      durationMs: 180000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: true,
      hasLyrics: false,
      availability: 'available'
    };

    const track2: Track = {
      id: 't-2',
      fileId: 'f-2',
      title: 'Track Two',
      durationMs: 200000,
      format: { container: 'flac', codec: 'flac', sampleRate: 96000, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: true,
      availability: 'available'
    };

    await repo.saveBatch([track1, track2]);

    expect(await repo.count()).toBe(2);

    const fetched = await repo.getById('t-1');
    expect(fetched?.title).toBe('Track One');

    const favorites = await repo.list(undefined, { isFavorite: true });
    expect(favorites.total).toBe(1);
    expect(favorites.items[0].id).toBe('t-1');
  });

  it('should update favorite status atomically', async () => {
    const repo = new InMemoryTrackRepository();
    const track: Track = {
      id: 't-10',
      fileId: 'f-10',
      title: 'Favorite Test',
      durationMs: 120000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    };

    await repo.save(track);
    await repo.setFavorite('t-10', true);

    const updated = await repo.getById('t-10');
    expect(updated?.isFavorite).toBe(true);
  });
});
