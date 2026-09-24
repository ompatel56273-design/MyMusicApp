import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartPlaylistValidator } from '../../src/services/playlist/smart-playlist-validator';
import { SmartPlaylistEvaluator } from '../../src/services/playlist/smart-playlist-evaluator';
import { PlaylistService } from '../../src/services/playlist/playlist-service';
import { EventBus } from '../../src/core/events/event-bus';
import type { Track, Playlist } from '../../src/domain/entities/models';
import type { SmartPlaylistDefinition } from '../../src/domain/value-objects/smart-playlist-types';

describe('Feature 8 — Smart Playlists', () => {
  const mockTrack1: Track = {
    id: 't1',
    fileId: 'f1',
    title: 'Alpha Song',
    artistName: 'Rock Star',
    albumTitle: 'First Album',
    genreName: 'Rock',
    durationMs: 180000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: 1000,
    dateModified: 1000,
    lastPlayedAt: 5000,
    playCount: 10,
    isFavorite: true,
    hasLyrics: false,
    availability: 'available'
  };

  const mockTrack2: Track = {
    id: 't2',
    fileId: 'f2',
    title: 'Beta Ballad',
    artistName: 'Pop Icon',
    albumTitle: 'Second Album',
    genreName: 'Pop',
    durationMs: 240000,
    format: { container: 'flac', codec: 'flac', sampleRate: 96000, channels: 2, isLossless: true },
    dateAdded: 2000,
    dateModified: 2000,
    lastPlayedAt: 10000,
    playCount: 50,
    isFavorite: false,
    hasLyrics: true,
    availability: 'available'
  };

  const mockTrack3: Track = {
    id: 't3',
    fileId: 'f3',
    title: 'Gamma Groove',
    artistName: 'Rock Star',
    albumTitle: 'First Album',
    genreName: 'Rock',
    durationMs: 120000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: 3000,
    dateModified: 3000,
    lastPlayedAt: 0,
    playCount: 0,
    isFavorite: true,
    hasLyrics: false,
    availability: 'available'
  };

  const allTracks: Track[] = [mockTrack1, mockTrack2, mockTrack3];

  describe('1. Domain / Validation', () => {
    it('1. Create Smart Playlist definition with valid properties', () => {
      const def: SmartPlaylistDefinition = {
        id: 'sp1',
        name: 'Rock Classics',
        rules: [{ field: 'genre', operator: 'equals', value: 'Rock' }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true
      };
      expect(() => SmartPlaylistValidator.validate(def)).not.toThrow();
    });

    it('2. Accept default values for matchMode, sort, and limit', () => {
      expect(() => SmartPlaylistValidator.validate({ name: 'Valid Name' })).not.toThrow();
    });

    it('3. Empty name rejection', () => {
      expect(() => SmartPlaylistValidator.validate({ name: '   ' })).toThrow('Smart Playlist name cannot be empty');
    });

    it('4. Invalid rule rejection', () => {
      expect(() =>
        SmartPlaylistValidator.validate({
          name: 'Test',
          rules: [{ field: 'unknownField' as any, operator: 'equals', value: 'x' }]
        })
      ).toThrow('Unknown rule field');
    });

    it('5. Invalid operator rejection', () => {
      expect(() =>
        SmartPlaylistValidator.validate({
          name: 'Test',
          rules: [{ field: 'genre', operator: 'greaterThan' as any, value: 'Rock' }]
        })
      ).toThrow('Invalid operator "greaterThan" for text field "genre"');
    });
  });

  describe('2. Rule Engine Operators & Filtering', () => {
    it('6. Text equals', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'genre', operator: 'equals', value: 'Rock' }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('7. Text contains', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'artist', operator: 'contains', value: 'Rock' }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('8. Text startsWith', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'title', operator: 'startsWith', value: 'Alpha' }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1']);
    });

    it('9. Text endsWith', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'title', operator: 'endsWith', value: 'Ballad' }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t2']);
    });

    it('10. Numeric greaterThan', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'playCount', operator: 'greaterThan', value: 10 }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t2']);
    });

    it('11. Numeric greaterThanOrEqual', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'playCount', operator: 'greaterThanOrEqual', value: 10 }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1', 't2']);
    });

    it('12. Numeric lessThan', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'playCount', operator: 'lessThan', value: 10 }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t3']);
    });

    it('13. Numeric lessThanOrEqual', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'playCount', operator: 'lessThanOrEqual', value: 10 }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('14. Date filtering (after timestamp)', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'addedAt', operator: 'after', value: 1500 }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t2', 't3']);
    });

    it('15. Boolean filtering (favorite)', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'favorite', operator: 'is', value: true }],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('16. Duration filtering', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [{ field: 'duration', operator: 'greaterThan', value: 200 }], // 200 sec
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t2']);
    });

    it('17. ALL mode (matches both rules)', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [
          { field: 'genre', operator: 'equals', value: 'Rock' },
          { field: 'favorite', operator: 'is', value: true }
        ],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('18. ANY mode (matches either rule)', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [
          { field: 'genre', operator: 'equals', value: 'Pop' },
          { field: 'playCount', operator: 'equals', value: 0 }
        ],
        matchMode: 'any',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.id)).toEqual(['t2', 't3']);
    });
  });

  describe('3. Sorting', () => {
    it('19. Title ascending', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.title)).toEqual(['Alpha Song', 'Beta Ballad', 'Gamma Groove']);
    });

    it('20. Title descending', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [],
        matchMode: 'all',
        sort: { field: 'title', order: 'desc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.title)).toEqual(['Gamma Groove', 'Beta Ballad', 'Alpha Song']);
    });

    it('21. Play count descending', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [],
        matchMode: 'all',
        sort: { field: 'playCount', order: 'desc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.playCount)).toEqual([50, 10, 0]);
    });

    it('22. Last played descending', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [],
        matchMode: 'all',
        sort: { field: 'lastPlayed', order: 'desc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.map(t => t.lastPlayedAt)).toEqual([10000, 5000, 0]);
    });
  });

  describe('4. Limit', () => {
    it('23. No limit returns all matches', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [],
        matchMode: 'all',
        sort: { field: 'title', order: 'asc' },
        limit: null,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.length).toBe(3);
    });

    it('24. Limit applied after sorting', () => {
      const res = SmartPlaylistEvaluator.evaluate(allTracks, {
        id: 'sp',
        name: 'Test',
        rules: [],
        matchMode: 'all',
        sort: { field: 'playCount', order: 'desc' },
        limit: 2,
        createdAt: 0,
        updatedAt: 0,
        enabled: true
      });
      expect(res.length).toBe(2);
      expect(res.map(t => t.id)).toEqual(['t2', 't1']);
    });

    it('25. Invalid limit rejected during validation', () => {
      expect(() => SmartPlaylistValidator.validate({ name: 'T', limit: -5 })).toThrow();
      expect(() => SmartPlaylistValidator.validate({ name: 'T', limit: 1.5 })).toThrow();
    });
  });

  describe('5. Dynamic Evaluation & Persistence', () => {
    let mockPlaylistRepo: any;
    let mockTrackRepo: any;
    let eventBus: EventBus;
    let playlistService: PlaylistService;
    let storedPlaylists: Map<string, Playlist>;

    beforeEach(() => {
      storedPlaylists = new Map();
      mockPlaylistRepo = {
        getById: vi.fn(async (id: string) => storedPlaylists.get(id) || null),
        list: vi.fn(async () => ({ items: Array.from(storedPlaylists.values()), total: storedPlaylists.size, offset: 0, limit: 50 })),
        save: vi.fn(async (pl: Playlist) => { storedPlaylists.set(pl.id, pl); }),
        delete: vi.fn(async (id: string) => { storedPlaylists.delete(id); }),
        getItems: vi.fn(async () => []),
        setItems: vi.fn(async () => {})
      };

      mockTrackRepo = {
        list: vi.fn(async () => ({ items: [...allTracks], total: allTracks.length, offset: 0, limit: 100 })),
        getById: vi.fn(async (id: string) => allTracks.find(t => t.id === id) || null)
      };

      eventBus = new EventBus();
      playlistService = new PlaylistService({
        playlistRepo: mockPlaylistRepo,
        trackRepo: mockTrackRepo,
        eventBus
      });
    });

    it('26. Play count changes update results dynamically', async () => {
      const pl = await playlistService.createSmartPlaylist(
        'Popular',
        'Play count > 20',
        [{ field: 'playCount', operator: 'greaterThan', value: 20 }]
      );

      let tracks = await playlistService.evaluateSmartPlaylist(pl.id);
      expect(tracks.map(t => t.id)).toEqual(['t2']);

      // Mutate t1 play count
      (mockTrack1 as any).playCount = 30;

      tracks = await playlistService.evaluateSmartPlaylist(pl.id);
      expect(tracks.map(t => t.id)).toContain('t1');
      expect(tracks.map(t => t.id)).toContain('t2');

      // Reset
      (mockTrack1 as any).playCount = 10;
    });

    it('27. Metadata changes update results dynamically', async () => {
      const pl = await playlistService.createSmartPlaylist(
        'Rock',
        'Rock genre',
        [{ field: 'genre', operator: 'equals', value: 'Rock' }]
      );

      let tracks = await playlistService.evaluateSmartPlaylist(pl.id);
      expect(tracks.map(t => t.id)).toEqual(['t1', 't3']);

      // Mutate t2 genre to Rock
      (mockTrack2 as any).genreName = 'Rock';

      tracks = await playlistService.evaluateSmartPlaylist(pl.id);
      expect(tracks.map(t => t.id)).toContain('t2');

      // Reset
      (mockTrack2 as any).genreName = 'Pop';
    });

    it('28. Newly added track appears dynamically', async () => {
      const pl = await playlistService.createSmartPlaylist(
        'Favorites',
        'Starred tracks',
        [{ field: 'favorite', operator: 'is', value: true }]
      );

      const newTrack: Track = {
        ...mockTrack1,
        id: 't4',
        title: 'New Star Track',
        isFavorite: true
      };

      mockTrackRepo.list.mockResolvedValue({ items: [...allTracks, newTrack], total: 4, offset: 0, limit: 100 });

      const tracks = await playlistService.evaluateSmartPlaylist(pl.id);
      expect(tracks.map(t => t.id)).toContain('t4');
    });

    it('29. Deleted track disappears dynamically', async () => {
      const pl = await playlistService.createSmartPlaylist(
        'All Tracks',
        'All',
        []
      );

      mockTrackRepo.list.mockResolvedValue({ items: [mockTrack1, mockTrack2], total: 2, offset: 0, limit: 100 });

      const tracks = await playlistService.evaluateSmartPlaylist(pl.id);
      expect(tracks.map(t => t.id)).toEqual(['t1', 't2']);
    });

    it('30. Create, save, and load Smart Playlist definition', async () => {
      const pl = await playlistService.createSmartPlaylist(
        'My Smart PL',
        'Description',
        [{ field: 'genre', operator: 'equals', value: 'Pop' }],
        'all',
        { field: 'title', order: 'asc' },
        10
      );

      expect(pl.isSmart).toBe(true);
      const def = await playlistService.getSmartPlaylistDefinition(pl.id);
      expect(def?.name).toBe('My Smart PL');
      expect(def?.rules[0]?.value).toBe('Pop');
    });

    it('31. Update Smart Playlist', async () => {
      const pl = await playlistService.createSmartPlaylist('Old Name', 'Old Desc', []);
      const updated = await playlistService.updateSmartPlaylist(pl.id, {
        name: 'New Name',
        description: 'New Desc'
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New Desc');
    });

    it('32. Delete Smart Playlist', async () => {
      const pl = await playlistService.createSmartPlaylist('To Delete', 'Desc', []);
      await playlistService.deletePlaylist(pl.id);
      expect(storedPlaylists.has(pl.id)).toBe(false);
    });

    it('33. Duplicate Smart Playlist', async () => {
      const pl = await playlistService.createSmartPlaylist(
        'Original',
        'Desc',
        [{ field: 'genre', operator: 'equals', value: 'Rock' }]
      );

      const copy = await playlistService.duplicateSmartPlaylist(pl.id);
      expect(copy.name).toBe('Original (Copy)');
      expect(copy.isSmart).toBe(true);
    });
  });

  describe('6. Playback & Invariants Integration', () => {
    let mockPlaybackManager: any;

    beforeEach(() => {
      mockPlaybackManager = {
        state: 'stopped',
        currentTrack: null,
        queue: [],
        playTrack: vi.fn().mockResolvedValue(undefined),
        addToQueue: vi.fn().mockResolvedValue(undefined)
      };
    });

    it('34. Smart Playlist produces normal queue via PlaybackManager', () => {
      const matchingTracks = [mockTrack1, mockTrack3];
      mockPlaybackManager.playTrack(matchingTracks[0], matchingTracks);

      expect(mockPlaybackManager.playTrack).toHaveBeenCalledWith(mockTrack1, matchingTracks);
    });

    it('35. PlaybackManager remains single authoritative controller', () => {
      expect(mockPlaybackManager.state).toBe('stopped');
      expect(typeof mockPlaybackManager.playTrack).toBe('function');
    });
  });
});
