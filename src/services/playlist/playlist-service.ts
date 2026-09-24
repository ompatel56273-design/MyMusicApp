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
import { SmartPlaylistValidator } from './smart-playlist-validator';
import { SmartPlaylistEvaluator } from './smart-playlist-evaluator';
import type {
  SmartRule,
  SmartMatchMode,
  SmartPlaylistSort,
  SmartPlaylistDefinition
} from '../../domain/value-objects/smart-playlist-types';

export interface PlaylistServiceDependencies {
  playlistRepo: IPlaylistRepository;
  trackRepo: ITrackRepository;
  eventBus: EventBus;
}

/**
 * Single authoritative Playlist domain service.
 * Coordinates playlist lifecycle, item ordering, track resolution, smart playlist evaluation, and event broadcasting.
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

    if (playlist.isSmart) {
      const tracks = await this.evaluateSmartPlaylist(id);
      const now = Date.now();
      const resolvedItems: PlaylistTrackItem[] = tracks.map((track, idx) => ({
        item: {
          id: `${id}_smart_${track.id}_${idx}`,
          playlistId: id,
          trackId: track.id,
          position: idx,
          addedAt: track.dateAdded || now
        },
        track
      }));

      const totalDuration = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
      const updatedPlaylist: Playlist = {
        ...playlist,
        trackCount: tracks.length,
        durationMs: totalDuration
      };

      return {
        playlist: updatedPlaylist,
        items: resolvedItems
      };
    }

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

    if (playlist.isSmart) {
      throw new Error('Cannot manually add tracks to a Smart Playlist');
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

    if (playlist.isSmart) {
      throw new Error('Cannot manually remove tracks from a Smart Playlist');
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

    if (playlist.isSmart) {
      throw new Error('Cannot manually reorder items in a Smart Playlist');
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

  // --- Smart Playlist Methods ---

  public async createSmartPlaylist(
    name: string,
    description: string | undefined,
    rules: readonly SmartRule[],
    matchMode: SmartMatchMode = 'all',
    sort: SmartPlaylistSort = { field: 'title', order: 'asc' },
    limit: number | null = null
  ): Promise<Playlist> {
    const trimmedName = name.trim();

    SmartPlaylistValidator.validate({
      name: trimmedName,
      rules: rules as SmartRule[],
      matchMode,
      sort,
      limit
    });

    const now = Date.now();
    const id = `smart_pl_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const definition: SmartPlaylistDefinition = {
      id,
      name: trimmedName,
      description: description?.trim() || undefined,
      rules,
      matchMode,
      sort,
      limit,
      createdAt: now,
      updatedAt: now,
      enabled: true
    };

    const matchingTracks = await this.evalDefinition(definition);
    const totalDuration = matchingTracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

    const playlist: Playlist = {
      id,
      name: trimmedName,
      description: description?.trim() || undefined,
      isSmart: true,
      smartRulesJson: JSON.stringify(definition),
      createdAt: now,
      updatedAt: now,
      trackCount: matchingTracks.length,
      durationMs: totalDuration
    };

    await this.playlistRepo.save(playlist);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist,
      action: 'created'
    });

    this.eventBus.publish<any>(DomainEvents.SMART_PLAYLIST_CREATED, {
      playlist,
      action: 'created'
    });

    return playlist;
  }

  public async updateSmartPlaylist(
    id: EntityId,
    updates: Partial<Omit<SmartPlaylistDefinition, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Playlist> {
    const existingPlaylist = await this.playlistRepo.getById(id);
    if (!existingPlaylist || !existingPlaylist.isSmart) {
      throw new Error(`Smart Playlist "${id}" not found`);
    }

    const currentDef = this.getSmartPlaylistDefinitionFromPlaylist(existingPlaylist);
    if (!currentDef) {
      throw new Error(`Invalid Smart Playlist definition for "${id}"`);
    }

    const updatedDef: SmartPlaylistDefinition = {
      ...currentDef,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : currentDef.name,
      description: updates.description !== undefined ? updates.description?.trim() || undefined : currentDef.description,
      updatedAt: Date.now()
    };

    SmartPlaylistValidator.validate(updatedDef);

    const matchingTracks = await this.evalDefinition(updatedDef);
    const totalDuration = matchingTracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

    const updatedPlaylist: Playlist = {
      ...existingPlaylist,
      name: updatedDef.name,
      description: updatedDef.description,
      smartRulesJson: JSON.stringify(updatedDef),
      updatedAt: updatedDef.updatedAt,
      trackCount: matchingTracks.length,
      durationMs: totalDuration
    };

    await this.playlistRepo.save(updatedPlaylist);

    this.eventBus.publish<PlaylistUpdatedEvent>(DomainEvents.PLAYLIST_UPDATED, {
      playlist: updatedPlaylist,
      action: 'updated'
    });

    this.eventBus.publish<any>(DomainEvents.SMART_PLAYLIST_UPDATED, {
      playlist: updatedPlaylist,
      action: 'updated'
    });

    return updatedPlaylist;
  }

  public async evaluateSmartPlaylist(id: EntityId): Promise<readonly Track[]> {
    const playlist = await this.playlistRepo.getById(id);
    if (!playlist || !playlist.isSmart) return [];

    const def = this.getSmartPlaylistDefinitionFromPlaylist(playlist);
    if (!def) return [];

    return this.evalDefinition(def);
  }

  public async duplicateSmartPlaylist(id: EntityId): Promise<Playlist> {
    const playlist = await this.playlistRepo.getById(id);
    if (!playlist || !playlist.isSmart) {
      throw new Error(`Smart Playlist "${id}" not found`);
    }

    const def = this.getSmartPlaylistDefinitionFromPlaylist(playlist);
    if (!def) {
      throw new Error(`Invalid Smart Playlist definition for "${id}"`);
    }

    return this.createSmartPlaylist(
      `${def.name} (Copy)`,
      def.description,
      def.rules,
      def.matchMode,
      def.sort,
      def.limit
    );
  }

  public async getSmartPlaylistDefinition(id: EntityId): Promise<SmartPlaylistDefinition | null> {
    const playlist = await this.playlistRepo.getById(id);
    if (!playlist || !playlist.isSmart) return null;
    return this.getSmartPlaylistDefinitionFromPlaylist(playlist);
  }

  public async ensureBuiltInSmartPlaylists(): Promise<void> {
    const existing = await this.playlistRepo.list({ offset: 0, limit: 100 });
    const names = new Set(existing.items.map(p => p.name));

    const builtIns = [
      {
        name: 'Recently Added',
        description: 'Tracks added to your library in the last 30 days',
        rules: [{ field: 'addedAt' as const, operator: 'withinLast' as const, value: 30 }],
        matchMode: 'all' as const,
        sort: { field: 'dateAdded' as const, order: 'desc' as const },
        limit: 50
      },
      {
        name: 'Recently Played',
        description: 'Tracks played recently',
        rules: [{ field: 'lastPlayedAt' as const, operator: 'greaterThan' as const, value: 0 }],
        matchMode: 'all' as const,
        sort: { field: 'lastPlayed' as const, order: 'desc' as const },
        limit: 50
      },
      {
        name: 'Most Played',
        description: 'Your most played tracks',
        rules: [{ field: 'playCount' as const, operator: 'greaterThan' as const, value: 0 }],
        matchMode: 'all' as const,
        sort: { field: 'playCount' as const, order: 'desc' as const },
        limit: 50
      },
      {
        name: 'Never Played',
        description: 'Tracks in your library you haven\'t played yet',
        rules: [{ field: 'playCount' as const, operator: 'equals' as const, value: 0 }],
        matchMode: 'all' as const,
        sort: { field: 'title' as const, order: 'asc' as const },
        limit: null
      },
      {
        name: 'Favorites',
        description: 'Tracks you have starred as favorite',
        rules: [{ field: 'favorite' as const, operator: 'is' as const, value: true }],
        matchMode: 'all' as const,
        sort: { field: 'title' as const, order: 'asc' as const },
        limit: null
      }
    ];

    for (const b of builtIns) {
      if (!names.has(b.name)) {
        await this.createSmartPlaylist(b.name, b.description, b.rules, b.matchMode, b.sort, b.limit);
      }
    }
  }

  private getSmartPlaylistDefinitionFromPlaylist(playlist: Playlist): SmartPlaylistDefinition | null {
    if (!playlist.smartRulesJson) return null;
    try {
      return JSON.parse(playlist.smartRulesJson) as SmartPlaylistDefinition;
    } catch {
      return null;
    }
  }

  private async evalDefinition(def: SmartPlaylistDefinition): Promise<Track[]> {
    const paginated = await this.trackRepo.list({ offset: 0, limit: 100000 });
    return SmartPlaylistEvaluator.evaluate(paginated.items, def);
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
