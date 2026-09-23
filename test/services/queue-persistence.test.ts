import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { QueueRepository } from '../../src/data/repositories/queue-repository';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track, QueueItem } from '../../src/domain/entities/models';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import { STORES } from '../../src/data/db/schema';

describe('Playback Queue Persistence', () => {
  let dbStore: Record<string, any>;
  let mockDb: IDatabaseAdapter;
  let queueRepo: QueueRepository;
  let eventBus: EventBus;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockHistoryRepo: any;
  let mockAudioEngine: any;
  let mockFilesystem: any;
  let playbackManager: PlaybackManager;

  const mockTrack1: Track = {
    id: 'track_1',
    fileId: 'file_1',
    title: 'Track One',
    artistId: 'artist_1',
    artistName: 'Artist A',
    albumId: 'album_1',
    albumTitle: 'Album A',
    durationMs: 180000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, bitDepth: 16, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 5,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const mockTrack2: Track = {
    id: 'track_2',
    fileId: 'file_2',
    title: 'Track Two',
    artistId: 'artist_1',
    artistName: 'Artist A',
    albumId: 'album_1',
    albumTitle: 'Album A',
    durationMs: 240000,
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, bitDepth: 16, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 12,
    isFavorite: true,
    hasLyrics: true,
    availability: 'available'
  };

  const mockTrack3: Track = {
    id: 'track_3',
    fileId: 'file_3',
    title: 'Track Three',
    artistId: 'artist_2',
    artistName: 'Artist B',
    albumId: 'album_2',
    albumTitle: 'Album B',
    durationMs: 200000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, bitDepth: 16, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 2,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  beforeEach(() => {
    dbStore = {
      [STORES.QUEUE_ITEMS]: [],
      [STORES.SETTINGS]: {}
    };

    mockDb = {
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
      get: vi.fn().mockImplementation(async (store: string, key: string) => {
        if (store === STORES.SETTINGS) {
          const val = dbStore[STORES.SETTINGS][key];
          return val ? { key, value: val } : null;
        }
        return null;
      }),
      getAll: vi.fn().mockImplementation(async (store: string) => {
        return dbStore[store] ? [...dbStore[store]] : [];
      }),
      getByIndex: vi.fn(),
      getAllByIndex: vi.fn(),
      put: vi.fn().mockImplementation(async (store: string, item: any) => {
        if (store === STORES.SETTINGS) {
          dbStore[STORES.SETTINGS][item.key] = item.value;
        }
      }),
      putBatch: vi.fn().mockImplementation(async (store: string, items: readonly any[]) => {
        dbStore[store] = [...items];
      }),
      delete: vi.fn().mockImplementation(async (store: string, key: string) => {
        if (store === STORES.SETTINGS) {
          delete dbStore[STORES.SETTINGS][key];
        }
      }),
      clear: vi.fn().mockImplementation(async (store: string) => {
        dbStore[store] = [];
      }),
      count: vi.fn().mockImplementation(async (store: string) => {
        return dbStore[store]?.length ?? 0;
      }),
      transaction: vi.fn()
    };

    queueRepo = new QueueRepository(mockDb);
    eventBus = new EventBus();

    mockTrackRepo = {
      getById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'track_1') return mockTrack1;
        if (id === 'track_2') return mockTrack2;
        if (id === 'track_3') return mockTrack3;
        return null;
      }),
      save: vi.fn().mockResolvedValue(undefined),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn().mockResolvedValue({ id: 'file_1', path: '/music/track1.mp3', availability: 'available' })
    };

    mockHistoryRepo = {
      getResumePosition: vi.fn().mockResolvedValue({ trackId: 'track_2', positionMs: 45000, updatedAt: Date.now() }),
      saveResumePosition: vi.fn().mockResolvedValue(undefined),
      addRecord: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioEngine = {
      isInitialized: vi.fn().mockReturnValue(true),
      loadBuffer: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      setGain: vi.fn(),
      setPlaybackRate: vi.fn()
    };

    mockFilesystem = {
      readFile: vi.fn().mockResolvedValue(new Uint8Array(100))
    };

    playbackManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem: mockFilesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });
  });

  it('persists queue items and metadata when adding tracks to queue', async () => {
    await playbackManager.addToQueue([mockTrack1, mockTrack2]);

    expect(playbackManager.queue.length).toBe(2);
    expect(playbackManager.getTracks().length).toBe(2);

    // Verify written to database adapter
    const persistedQueue = await queueRepo.getQueue();
    expect(persistedQueue.length).toBe(2);
    expect(persistedQueue[0]?.trackId).toBe('track_1');
    expect(persistedQueue[1]?.trackId).toBe('track_2');

    const meta = await queueRepo.getQueueMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.activeIndex).toBe(0);
  });

  it('persists queue state on mutations (reorder, remove, clear)', async () => {
    await playbackManager.addToQueue([mockTrack1, mockTrack2, mockTrack3]);
    expect(playbackManager.queue.length).toBe(3);

    // 1. Reorder: move track 0 to position 2
    await playbackManager.reorderQueue(0, 2);
    let persistedQueue = await queueRepo.getQueue();
    expect(persistedQueue.map(i => i.trackId)).toEqual(['track_2', 'track_3', 'track_1']);

    // 2. Remove: remove track at index 1 ('track_3')
    await playbackManager.removeFromQueue(1);
    persistedQueue = await queueRepo.getQueue();
    expect(persistedQueue.map(i => i.trackId)).toEqual(['track_2', 'track_1']);

    // 3. Clear queue
    await playbackManager.clearQueue();
    persistedQueue = await queueRepo.getQueue();
    expect(persistedQueue.length).toBe(0);
    const meta = await queueRepo.getQueueMetadata();
    expect(meta).toBeNull();
  });

  it('restores queue, active track, ordering, and resume position on startup', async () => {
    // Populate database directly as if saved from a previous session
    const savedItems: QueueItem[] = [
      { id: 'q_1', trackId: 'track_1', position: 0, addedReason: 'user' },
      { id: 'q_2', trackId: 'track_2', position: 1, addedReason: 'user' },
      { id: 'q_3', trackId: 'track_3', position: 2, addedReason: 'user' }
    ];
    await queueRepo.saveQueue(savedItems);
    await queueRepo.saveQueueMetadata({
      activeIndex: 1,
      activeTrackId: 'track_2',
      repeatMode: 'all',
      shuffleMode: 'off',
      updatedAt: Date.now()
    });

    // Create a new playback manager simulating application reboot
    const newPlaybackManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem: mockFilesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    let queueChangedFired = false;
    let trackChangedFired = false;
    eventBus.subscribe(DomainEvents.QUEUE_CHANGED, () => { queueChangedFired = true; });
    eventBus.subscribe(DomainEvents.TRACK_CHANGED, () => { trackChangedFired = true; });

    await newPlaybackManager.restoreQueue();

    expect(newPlaybackManager.queue.length).toBe(3);
    expect(newPlaybackManager.getTracks().length).toBe(3);
    expect(newPlaybackManager.currentQueueIndex).toBe(1);
    expect(newPlaybackManager.currentTrack?.id).toBe('track_2');
    expect(newPlaybackManager.positionMs).toBe(45000); // restored from resume position
    expect(newPlaybackManager.repeatMode).toBe('all');
    expect(newPlaybackManager.state).toBe('idle'); // Should NOT auto-play audio
    expect(mockAudioEngine.play).not.toHaveBeenCalled();

    expect(queueChangedFired).toBe(true);
    expect(trackChangedFired).toBe(true);
  });

  it('safely handles missing tracks during restoration without corrupting remaining queue', async () => {
    // Save queue containing valid track_1, DELETED track_999, and valid track_3
    const savedItems: QueueItem[] = [
      { id: 'q_1', trackId: 'track_1', position: 0, addedReason: 'user' },
      { id: 'q_del', trackId: 'track_999', position: 1, addedReason: 'user' },
      { id: 'q_3', trackId: 'track_3', position: 2, addedReason: 'user' }
    ];
    await queueRepo.saveQueue(savedItems);
    await queueRepo.saveQueueMetadata({
      activeIndex: 2, // was pointing to track_3 (position 2 in old list)
      activeTrackId: 'track_3',
      updatedAt: Date.now()
    });

    const freshManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem: mockFilesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    await freshManager.restoreQueue();

    // track_999 should be filtered out, leaving track_1 and track_3
    expect(freshManager.queue.length).toBe(2);
    expect(freshManager.getTracks().map(t => t.id)).toEqual(['track_1', 'track_3']);
    // Active index should point to track_3 which is now at index 1
    expect(freshManager.currentQueueIndex).toBe(1);
    expect(freshManager.currentTrack?.id).toBe('track_3');

    // Database should be synchronized with the pruned list
    const updatedDbQueue = await queueRepo.getQueue();
    expect(updatedDbQueue.length).toBe(2);
    expect(updatedDbQueue.map(i => i.trackId)).toEqual(['track_1', 'track_3']);
  });

  it('handles empty or corrupted queue gracefully on startup', async () => {
    // 1. Empty queue test
    const emptyManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem: mockFilesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    await emptyManager.restoreQueue();
    expect(emptyManager.queue.length).toBe(0);
    expect(emptyManager.currentTrack).toBeNull();
    expect(emptyManager.currentQueueIndex).toBe(-1);

    // 2. Corrupted items with null/undefined trackId
    const corruptRepo: any = {
      getQueue: vi.fn().mockResolvedValue([{ invalid: true }, null, { trackId: null }]),
      getQueueMetadata: vi.fn().mockResolvedValue({ activeIndex: 99 }),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    const robustManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem: mockFilesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo: corruptRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    await robustManager.restoreQueue();
    expect(robustManager.queue.length).toBe(0);
    expect(robustManager.currentTrack).toBeNull();
    expect(corruptRepo.clearQueue).toHaveBeenCalled();
  });

  it('handles IndexedDB throwing exceptions without crashing playback or startup', async () => {
    const brokenRepo: any = {
      getQueue: vi.fn().mockRejectedValue(new Error('IndexedDB transaction failed')),
      getQueueMetadata: vi.fn().mockRejectedValue(new Error('IndexedDB read error')),
      saveQueue: vi.fn().mockRejectedValue(new Error('IndexedDB quota exceeded')),
      clearQueue: vi.fn().mockRejectedValue(new Error('IndexedDB clear error'))
    };

    const resilientManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem: mockFilesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo: brokenRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    // restoreQueue should not throw
    await expect(resilientManager.restoreQueue()).resolves.not.toThrow();
    expect(resilientManager.queue.length).toBe(0);

    // In-memory queue operations should still function 100%
    await expect(resilientManager.addToQueue([mockTrack1])).resolves.not.toThrow();
    expect(resilientManager.queue.length).toBe(1);
    expect(resilientManager.getTracks()[0]?.id).toBe('track_1');
  });

  it('supports duplicate track instances with distinct queue items', async () => {
    // User queues same track multiple times (e.g. repeat track in custom sequence)
    await playbackManager.addToQueue([mockTrack1, mockTrack1]);

    expect(playbackManager.queue.length).toBe(2);
    expect(playbackManager.queue[0]?.position).toBe(0);
    expect(playbackManager.queue[1]?.position).toBe(1);

    const persisted = await queueRepo.getQueue();
    expect(persisted.length).toBe(2);
  });
});
