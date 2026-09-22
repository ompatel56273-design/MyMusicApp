import type { IPlaylistRepository, PaginationOptions, PaginatedResult } from '../../domain/repositories/repository-contracts';
import type { Playlist, PlaylistItem } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../db/database-adapter';
import { STORES } from '../db/schema';

export class PlaylistRepository implements IPlaylistRepository {
  private readonly db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  public async getById(id: EntityId): Promise<Playlist | null> {
    return this.db.get<Playlist>(STORES.PLAYLISTS, id);
  }

  public async list(options?: PaginationOptions): Promise<PaginatedResult<Playlist>> {
    const playlists = await this.db.getAll<Playlist>(STORES.PLAYLISTS);

    const total = playlists.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    const paginated = playlists.slice(offset, offset + limit);

    return {
      items: paginated,
      total,
      offset,
      limit
    };
  }

  public async save(playlist: Playlist): Promise<void> {
    await this.db.put(STORES.PLAYLISTS, playlist);
  }

  public async delete(id: EntityId): Promise<void> {
    // Delete playlist record and cascade to all its playlist items
    await this.db.delete(STORES.PLAYLISTS, id);
    const items = await this.getItems(id);
    for (const item of items) {
      await this.db.delete(STORES.PLAYLIST_ITEMS, item.id);
    }
  }

  public async getItems(playlistId: EntityId): Promise<readonly PlaylistItem[]> {
    const items = await this.db.getAllByIndex<PlaylistItem>(STORES.PLAYLIST_ITEMS, 'by_playlistId', playlistId);
    return items.sort((a, b) => a.position - b.position);
  }

  public async setItems(playlistId: EntityId, items: readonly PlaylistItem[]): Promise<void> {
    const existing = await this.getItems(playlistId);
    for (const item of existing) {
      await this.db.delete(STORES.PLAYLIST_ITEMS, item.id);
    }
    await this.db.putBatch(STORES.PLAYLIST_ITEMS, items);
  }

  public async addItem(playlistId: EntityId, trackId: EntityId, position?: number): Promise<void> {
    const items = await this.getItems(playlistId);
    const newPos = position !== undefined ? position : items.length;

    const newItem: PlaylistItem = {
      id: `${playlistId}_${trackId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      playlistId,
      trackId,
      position: newPos,
      addedAt: Date.now()
    };

    await this.db.put(STORES.PLAYLIST_ITEMS, newItem);
  }

  public async removeItem(_playlistId: EntityId, itemId: EntityId): Promise<void> {
    await this.db.delete(STORES.PLAYLIST_ITEMS, itemId);
  }
}
