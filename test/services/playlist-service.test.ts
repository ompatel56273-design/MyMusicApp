import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaylistService } from '../../src/services/playlist/playlist-service';
import type { IPlaylistRepository, ITrackRepository } from '../../src/domain/repositories/repository-contracts';
import type { Playlist, PlaylistItem, Track } from '../../src/domain/entities/models';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';

describe('PlaylistService', () => {
  let playlistRepo: IPlaylistRepository;
  let trackRepo: ITrackRepository;
  let eventBus: EventBus;
  let playlistService: PlaylistService;

  let storedPlaylists: Map<string, Playlist>;
  let storedItems: Map<string, PlaylistItem[]>;
  let storedTracks: Map<string, Track>;

  beforeEach(() => {
    storedPlaylists = new Map();
    storedItems = new Map();
    storedTracks = new Map();
    eventBus = new EventBus();

    // Mock TrackRepo
    trackRepo = {
      getById: vi.fn(async (id: string) => storedTracks.get(id) ?? null),
      getByFileId: vi.fn(async () => null),
      list: vi.fn(async () => ({ items: Array.from(storedTracks.values()), total: storedTracks.size, offset: 0, limit: 50 })),
      save: vi.fn(async (track: Track) => { storedTracks.set(track.id, track); }),
      saveBatch: vi.fn(async (tracks: readonly Track[]) => { tracks.forEach(t => storedTracks.set(t.id, t)); }),
      delete: vi.fn(async (id: string) => { storedTracks.delete(id); }),
      setFavorite: vi.fn(async () => {}),
      incrementPlayCount: vi.fn(async () => {}),
      count: vi.fn(async () => storedTracks.size)
    };

    // Mock PlaylistRepo
    playlistRepo = {
      getById: vi.fn(async (id: string) => storedPlaylists.get(id) ?? null),
      list: vi.fn(async (opts) => {
        const all = Array.from(storedPlaylists.values());
        const offset = opts?.offset ?? 0;
        const limit = opts?.limit ?? 50;
        return {
          items: all.slice(offset, offset + limit),
          total: all.length,
          offset,
          limit
        };
      }),
      save: vi.fn(async (pl: Playlist) => { storedPlaylists.set(pl.id, pl); }),
      delete: vi.fn(async (id: string) => {
        storedPlaylists.delete(id);
        storedItems.delete(id);
      }),
      getItems: vi.fn(async (playlistId: string) => {
        const items = storedItems.get(playlistId) ?? [];
        return [...items].sort((a, b) => a.position - b.position);
      }),
      setItems: vi.fn(async (playlistId: string, items: readonly PlaylistItem[]) => {
        storedItems.set(playlistId, [...items]);
      }),
      addItem: vi.fn(async (playlistId: string, trackId: string, position?: number) => {
        const items = storedItems.get(playlistId) ?? [];
        const pos = position !== undefined ? position : items.length;
        const newItem: PlaylistItem = {
          id: `${playlistId}_${trackId}_${Date.now()}`,
          playlistId,
          trackId,
          position: pos,
          addedAt: Date.now()
        };
        items.push(newItem);
        storedItems.set(playlistId, items);
      }),
      removeItem: vi.fn(async (playlistId: string, itemId: string) => {
        const items = storedItems.get(playlistId) ?? [];
        storedItems.set(playlistId, items.filter(i => i.id !== itemId));
      })
    };

    playlistService = new PlaylistService({
      playlistRepo,
      trackRepo,
      eventBus
    });

    // Seed test tracks
    storedTracks.set('track_1', {
      id: 'track_1',
      fileId: 'file_1',
      title: 'First Song',
      durationMs: 180000,
      format: { codec: 'flac', container: 'flac', bitrate: 900, sampleRate: 44100, bitDepth: 16, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    });

    storedTracks.set('track_2', {
      id: 'track_2',
      fileId: 'file_2',
      title: 'Second Song',
      durationMs: 240000,
      format: { codec: 'flac', container: 'flac', bitrate: 900, sampleRate: 44100, bitDepth: 16, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    });
  });

  describe('createPlaylist', () => {
    it('creates playlist with valid name and emits PLAYLIST_UPDATED created event', async () => {
      const spy = vi.fn();
      eventBus.subscribe(DomainEvents.PLAYLIST_UPDATED, spy);

      const pl = await playlistService.createPlaylist('Chill Vibes', 'My chill tracks');

      expect(pl.id).toBeDefined();
      expect(pl.name).toBe('Chill Vibes');
      expect(pl.description).toBe('My chill tracks');
      expect(pl.trackCount).toBe(0);
      expect(pl.durationMs).toBe(0);
      expect(storedPlaylists.has(pl.id)).toBe(true);

      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        playlist: pl,
        action: 'created'
      }));
    });

    it('rejects empty or whitespace-only names', async () => {
      await expect(playlistService.createPlaylist('')).rejects.toThrow('Playlist name cannot be empty');
      await expect(playlistService.createPlaylist('   ')).rejects.toThrow('Playlist name cannot be empty');
    });
  });

  describe('updatePlaylist', () => {
    it('updates name and description and emits PLAYLIST_UPDATED updated event', async () => {
      const pl = await playlistService.createPlaylist('Old Name');
      const spy = vi.fn();
      eventBus.subscribe(DomainEvents.PLAYLIST_UPDATED, spy);

      const updated = await playlistService.updatePlaylist(pl.id, {
        name: 'New Name',
        description: 'New Description'
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New Description');
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        playlist: updated,
        action: 'updated'
      }));
    });

    it('rejects updating with empty name', async () => {
      const pl = await playlistService.createPlaylist('Valid Name');
      await expect(playlistService.updatePlaylist(pl.id, { name: '' })).rejects.toThrow('Playlist name cannot be empty');
    });

    it('throws when updating non-existent playlist', async () => {
      await expect(playlistService.updatePlaylist('non_existent', { name: 'New' })).rejects.toThrow();
    });
  });

  describe('deletePlaylist', () => {
    it('deletes playlist and its items, and emits PLAYLIST_UPDATED deleted event', async () => {
      const pl = await playlistService.createPlaylist('To Delete');
      await playlistService.addTracksToPlaylist(pl.id, ['track_1']);

      const spy = vi.fn();
      eventBus.subscribe(DomainEvents.PLAYLIST_UPDATED, spy);

      await playlistService.deletePlaylist(pl.id);

      expect(storedPlaylists.has(pl.id)).toBe(false);
      expect(storedItems.has(pl.id)).toBe(false);
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        playlist: expect.objectContaining({ id: pl.id }),
        action: 'deleted'
      }));
    });
  });

  describe('addTracksToPlaylist', () => {
    it('adds tracks with sequential positions and updates aggregate trackCount and durationMs', async () => {
      const pl = await playlistService.createPlaylist('Mix');

      await playlistService.addTracksToPlaylist(pl.id, ['track_1', 'track_2']);

      const updated = await playlistService.getPlaylist(pl.id);
      expect(updated?.trackCount).toBe(2);
      expect(updated?.durationMs).toBe(420000); // 180000 + 240000

      const items = await playlistRepo.getItems(pl.id);
      expect(items.length).toBe(2);
      expect(items[0]?.position).toBe(0);
      expect(items[0]?.trackId).toBe('track_1');
      expect(items[1]?.position).toBe(1);
      expect(items[1]?.trackId).toBe('track_2');
    });

    it('supports duplicate tracks with distinct item IDs and contiguous positions', async () => {
      const pl = await playlistService.createPlaylist('Loop');

      await playlistService.addTracksToPlaylist(pl.id, ['track_1']);
      await playlistService.addTracksToPlaylist(pl.id, ['track_1']);

      const items = await playlistRepo.getItems(pl.id);
      expect(items.length).toBe(2);
      expect(items[0]?.trackId).toBe('track_1');
      expect(items[1]?.trackId).toBe('track_1');
      expect(items[0]?.id).not.toBe(items[1]?.id);
      expect(items[0]?.position).toBe(0);
      expect(items[1]?.position).toBe(1);
    });
  });

  describe('removeTrackFromPlaylist', () => {
    it('removes item by PlaylistItem.id and normalizes positions contiguously 0..n-1', async () => {
      const pl = await playlistService.createPlaylist('Trimming');
      await playlistService.addTracksToPlaylist(pl.id, ['track_1', 'track_2', 'track_1']);

      const itemsBefore = await playlistRepo.getItems(pl.id);
      const middleItemId = itemsBefore[1]!.id; // track_2 at position 1

      await playlistService.removeTrackFromPlaylist(pl.id, middleItemId);

      const itemsAfter = await playlistRepo.getItems(pl.id);
      expect(itemsAfter.length).toBe(2);
      expect(itemsAfter[0]?.position).toBe(0);
      expect(itemsAfter[0]?.trackId).toBe('track_1');
      expect(itemsAfter[1]?.position).toBe(1);
      expect(itemsAfter[1]?.trackId).toBe('track_1');

      const updatedPl = await playlistService.getPlaylist(pl.id);
      expect(updatedPl?.trackCount).toBe(2);
      expect(updatedPl?.durationMs).toBe(360000); // 180000 * 2
    });
  });

  describe('reorderPlaylistItems', () => {
    it('moves item and normalizes positions correctly', async () => {
      const pl = await playlistService.createPlaylist('Reorder');
      await playlistService.addTracksToPlaylist(pl.id, ['track_1', 'track_2']);

      // Move track_1 (from 0 to 1)
      await playlistService.reorderPlaylistItems(pl.id, 0, 1);

      const items = await playlistRepo.getItems(pl.id);
      expect(items[0]?.trackId).toBe('track_2');
      expect(items[0]?.position).toBe(0);
      expect(items[1]?.trackId).toBe('track_1');
      expect(items[1]?.position).toBe(1);
    });
  });

  describe('getPlaylistWithTracks', () => {
    it('resolves track entities for all playlist items', async () => {
      const pl = await playlistService.createPlaylist('Full Data');
      await playlistService.addTracksToPlaylist(pl.id, ['track_1', 'track_2']);

      const result = await playlistService.getPlaylistWithTracks(pl.id);
      expect(result).not.toBeNull();
      expect(result?.playlist.name).toBe('Full Data');
      expect(result?.items.length).toBe(2);
      expect(result?.items[0]?.track.title).toBe('First Song');
      expect(result?.items[1]?.track.title).toBe('Second Song');
    });

    it('gracefully handles missing library tracks without dropping membership', async () => {
      const pl = await playlistService.createPlaylist('With Missing');
      await playlistService.addTracksToPlaylist(pl.id, ['track_deleted_from_disk']);

      const result = await playlistService.getPlaylistWithTracks(pl.id);
      expect(result?.items.length).toBe(1);
      expect(result?.items[0]?.track.title).toBe('Unavailable Track');
      expect(result?.items[0]?.track.availability).toBe('missing');
    });
  });
});
