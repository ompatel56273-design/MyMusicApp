import type {
  IPlaylistService,
  PlaylistWithTracks,
  PlaylistTrackItem
} from '../contracts/service-contracts';
import type {
  IPlaylistRepository,
  ITrackRepository,
  PaginationOptions,
  PaginatedResult
} from '../../domain/repositories/repository-contracts';
import type { Playlist, PlaylistItem, Track } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents, type PlaylistUpdatedEvent } from '../../domain/events/domain-events';

export interface PlaylistServiceDependencies {
  playlistRepo: IPlaylistRepository;
  trackRepo: ITrackRepository;
  eventBus: EventBus;
}

/**
 * Single authoritative Playlist domain service.
 * Coordinates playlist lifecycle, item ordering, track resolution, and event broadcasting.
 */
export class PlaylistService implements IPlaylistService {
  private readonly playlistRepo: IPlaylistRepository;
  private readonly trackRepo: ITrackRepository;
  private readonly eventBus: EventBus;

  constructor(deps: PlaylistServiceDependencies) {
    this.playlistRepo = deps.playlistRepo;
    this.trackRepo = deps.trackRepo;
    this.eventBus = deps.eventBus;
  }

  public async getPlaylist(id: EntityId): Promise<Playlist | null> {
    return this.playlistRepo.getById(id);
  }

  public async listPlaylists(options?: PaginationOptions): Promise<PaginatedResult<Playlist>> {
    return this.playlistRepo.list(options);
  }

  public async getPlaylistWithTracks(id: EntityId): Promise<PlaylistWithTracks | null> {
    const playlist = await this.playlistRepo.getById(id);
    if (!playlist) return null;

    const items = await this.playlistRepo.getItems(id);
    const resolvedItems: PlaylistTrackItem[] = [];

    for (const item of items) {
      const track = await this.trackRepo.getById(item.trackId);
      if (track) {
        resolvedItems.push({ item, track });
      } else {
        // Create an unavailable placeholder track to prevent losing playlist membership
        const placeholderTrack: Track = {
          id: item.trackId,
          fileId: 'unknown_file',
          title: 'Unavailable Track',
          durationMs: 0,
          format: {
            codec: 'unknown',
            container: 'unknown',
            bitrate: 0,
            sampleRate: 0,
            bitDepth: 0,
            channels: 2,
            isLossless: false
          },
          dateAdded: item.addedAt,
          dateModified: item.addedAt,
          playCount: 0,
          isFavorite: false,
          hasLyrics: false,
          availability: 'missing'
        };
        resolvedItems.push({ item, track: placeholderTrack });
      }
    }

    return {
      playlist,
      items: resolvedItems
    };
  }

  public async createPlaylist(name: string, description?: string): Promise<Playlist> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Playlist name cannot be empty');
    }

    const now = Date.now();
    const playlist: Playlist = {
      id: `pl_${now}_${Math.random().toString(36).substring(2, 9)}`,
      name: trimmedName,
      description: description?.trim() || undefined,
      isSmart: false,
      createdAt: now,
      updatedAt: now,
      trackCount: 0,
      durationMs: 0
    };

    await this.playlistRepo.save(playlist);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist,
      action: 'created'
    });

    return playlist;
  }

  public async updatePlaylist(
    id: EntityId,
    updates: Partial<Pick<Playlist, 'name' | 'description'>>
  ): Promise<Playlist> {
    const existing = await this.playlistRepo.getById(id);
    if (!existing) {
      throw new Error(`Playlist "${id}" not found`);
    }

    let updatedName = existing.name;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Playlist name cannot be empty');
      }
      updatedName = trimmed;
    }

    const updatedDescription =
      updates.description !== undefined
        ? updates.description.trim() || undefined
        : existing.description;

    const updated: Playlist = {
      ...existing,
      name: updatedName,
      description: updatedDescription,
      updatedAt: Date.now()
    };

    await this.playlistRepo.save(updated);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist: updated,
      action: 'updated'
    });

    return updated;
  }

  public async deletePlaylist(id: EntityId): Promise<void> {
    const existing = await this.playlistRepo.getById(id);
    if (!existing) return;

    await this.playlistRepo.delete(id);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist: existing,
      action: 'deleted'
    });
  }

  public async addTracksToPlaylist(playlistId: EntityId, trackIds: readonly EntityId[]): Promise<void> {
    if (trackIds.length === 0) return;

    const playlist = await this.playlistRepo.getById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist "${playlistId}" not found`);
    }

    const existingItems = await this.playlistRepo.getItems(playlistId);
    const now = Date.now();

    const newItems: PlaylistItem[] = trackIds.map((trackId, idx) => ({
      id: `${playlistId}_${trackId}_${now}_${Math.random().toString(36).substring(2, 7)}`,
      playlistId,
      trackId,
      position: existingItems.length + idx,
      addedAt: now
    }));

    const combinedItems = [...existingItems, ...newItems];
    await this.playlistRepo.setItems(playlistId, combinedItems);

    // Compute updated aggregates
    const { trackCount, durationMs } = await this.computeAggregates(combinedItems);

    const updatedPlaylist: Playlist = {
      ...playlist,
      trackCount,
      durationMs,
      updatedAt: now
    };

    await this.playlistRepo.save(updatedPlaylist);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist: updatedPlaylist,
      action: 'updated'
    });
  }

  public async removeTrackFromPlaylist(playlistId: EntityId, playlistItemId: EntityId): Promise<void> {
    const playlist = await this.playlistRepo.getById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist "${playlistId}" not found`);
    }

    const items = await this.playlistRepo.getItems(playlistId);
    const filtered = items.filter(item => item.id !== playlistItemId);

    // Reindex positions contiguously 0..n-1
    const reindexedItems: PlaylistItem[] = filtered.map((item, idx) => ({
      ...item,
      position: idx
    }));

    await this.playlistRepo.setItems(playlistId, reindexedItems);

    const { trackCount, durationMs } = await this.computeAggregates(reindexedItems);

    const updatedPlaylist: Playlist = {
      ...playlist,
      trackCount,
      durationMs,
      updatedAt: Date.now()
    };

    await this.playlistRepo.save(updatedPlaylist);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist: updatedPlaylist,
      action: 'updated'
    });
  }

  public async reorderPlaylistItems(
    playlistId: EntityId,
    fromPosition: number,
    toPosition: number
  ): Promise<void> {
    const playlist = await this.playlistRepo.getById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist "${playlistId}" not found`);
    }

    const items = [...(await this.playlistRepo.getItems(playlistId))];
    if (
      fromPosition < 0 ||
      fromPosition >= items.length ||
      toPosition < 0 ||
      toPosition >= items.length ||
      fromPosition === toPosition
    ) {
      return;
    }

    // Splice and reinsert
    const [moved] = items.splice(fromPosition, 1);
    if (!moved) return;
    items.splice(toPosition, 0, moved);

    // Reindex positions contiguously 0..n-1
    const reindexedItems: PlaylistItem[] = items.map((item, idx) => ({
      ...item,
      position: idx
    }));

    await this.playlistRepo.setItems(playlistId, reindexedItems);

    const updatedPlaylist: Playlist = {
      ...playlist,
      updatedAt: Date.now()
    };

    await this.playlistRepo.save(updatedPlaylist);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist: updatedPlaylist,
      action: 'updated'
    });
  }

  private async computeAggregates(
    items: readonly PlaylistItem[]
  ): Promise<{ trackCount: number; durationMs: number }> {
    let totalDuration = 0;
    for (const item of items) {
      const track = await this.trackRepo.getById(item.trackId);
      if (track) {
        totalDuration += track.durationMs;
      }
    }
    return {
      trackCount: items.length,
      durationMs: totalDuration
    };
  }
}
