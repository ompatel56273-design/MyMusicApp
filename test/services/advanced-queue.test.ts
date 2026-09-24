import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { QueueManager } from '../../src/services/playback/queue-manager';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { EventBus } from '../../src/core/events/event-bus';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { DomainEvents } from '../../src/domain/events/domain-events';
import { SmartPlaylistEvaluator } from '../../src/services/playlist/smart-playlist-evaluator';
import type { Track, AudioFile } from '../../src/domain/entities/models';
import type { SmartPlaylistDefinition } from '../../src/domain/value-objects/smart-playlist-types';

describe('Feature 9: Advanced Queue Management Comprehensive Test Suite', () => {
  let eventBus: EventBus;
  let filesystem: VirtualFilesystemAdapter;
  let audioEngine: AudioEngine;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockQueueRepo: any;
  let mockHistoryRepo: any;
  let playbackManager: PlaybackManager;
  let queueManager: QueueManager;
  let createdAudioContexts: number;

  const createTrack = (id: string, title: string, artist = 'Artist 1'): Track => ({
    id,
    fileId: `file_${id}`,
    title,
    artistName: artist,
    durationMs: 180000,
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: 1700000000000,
    dateModified: 1700000000000,
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  });

  const trackA = createTrack('track_A', 'Track A');
  const trackB = createTrack('track_B', 'Track B');
  const trackC = createTrack('track_C', 'Track C');
  const trackD = createTrack('track_D', 'Track D');
  const trackE = createTrack('track_E', 'Track E');

  const createMockAudioFile = (track: Track): AudioFile => ({
    id: track.fileId,
    path: `C:/Music/${track.title}.flac`,
    filename: `${track.title}.flac`,
    extension: 'flac',
    sizeBytes: 1024,
    modifiedTimeMs: Date.now(),
    availability: 'available'
  });

  const mockFileA = createMockAudioFile(trackA);
  const mockFileB = createMockAudioFile(trackB);
  const mockFileC = createMockAudioFile(trackC);
  const mockFileD = createMockAudioFile(trackD);
  const mockFileE = createMockAudioFile(trackE);

  beforeEach(() => {
    createdAudioContexts = 0;

    const createMockAudioElement = () => {
      let canPlayListener: any = null;
      const el: any = {
        src: '',
        paused: true,
        ended: false,
        currentTime: 0,
        duration: 180,
        volume: 1,
        playbackRate: 1,
        preload: 'auto',
        crossOrigin: 'anonymous',
        addEventListener: vi.fn((evt: string, cb: any) => {
          if (evt === 'canplay') canPlayListener = cb;
        }),
        removeEventListener: vi.fn((evt: string) => {
          if (evt === 'canplay') canPlayListener = null;
        }),
        play: vi.fn(function (this: any) {
          this.paused = false;
          return Promise.resolve();
        }),
        pause: vi.fn(function (this: any) {
          this.paused = true;
        }),
        load: vi.fn(function (this: any) {
          if (canPlayListener) canPlayListener();
        })
      };
      return el;
    };

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }

    if (typeof document === 'undefined') {
      (globalThis as any).document = {
        createElement: vi.fn((tag: string) => {
          if (tag === 'audio') return createMockAudioElement();
          return {};
        })
      };
    } else {
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'audio') return createMockAudioElement() as any;
        return document.createElement(tag);
      });
    }

    (globalThis as any).URL = {
      createObjectURL: vi.fn(() => `blob:mock-url-${Math.random()}`),
      revokeObjectURL: vi.fn()
    };

    const mockContext: any = {
      state: 'running',
      sampleRate: 48000,
      currentTime: 10,
      destination: {},
      createGain: vi.fn(() => ({
        gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createAnalyser: vi.fn(() => ({
        fftSize: 2048,
        frequencyBinCount: 1024,
        smoothingTimeConstant: 0.8,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'peaking',
        frequency: { value: 1000 },
        Q: { value: 1 },
        gain: { value: 0, setValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createStereoPanner: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        pan: { value: 0, setValueAtTime: vi.fn() }
      })),
      createDynamicsCompressor: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        threshold: { value: -0.5, setValueAtTime: vi.fn() },
        knee: { value: 0 },
        ratio: { value: 20, setValueAtTime: vi.fn() },
        attack: { value: 0.003 },
        release: { value: 0.05 }
      })),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const MockAudioContextClass = vi.fn().mockImplementation(() => {
      createdAudioContexts++;
      return mockContext;
    });

    (globalThis as any).AudioContext = MockAudioContextClass;
    (globalThis as any).webkitAudioContext = MockAudioContextClass;

    eventBus = new EventBus();
    filesystem = new VirtualFilesystemAdapter();
    filesystem.addVirtualFile('C:/Music/Track A.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/Track B.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/Track C.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/Track D.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/Track E.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));

    audioEngine = new AudioEngine();

    const tracksDb = new Map<string, Track>([
      [trackA.id, trackA],
      [trackB.id, trackB],
      [trackC.id, trackC],
      [trackD.id, trackD],
      [trackE.id, trackE]
    ]);

    const filesDb = new Map<string, AudioFile>([
      [trackA.fileId, mockFileA],
      [trackB.fileId, mockFileB],
      [trackC.fileId, mockFileC],
      [trackD.fileId, mockFileD],
      [trackE.fileId, mockFileE]
    ]);

    mockTrackRepo = {
      getById: vi.fn(async (id: string) => tracksDb.get(id) ?? null),
      findById: vi.fn(async (id: string) => tracksDb.get(id) ?? null),
      findAll: vi.fn(async () => Array.from(tracksDb.values())),
      update: vi.fn(async (t: Track) => {
        tracksDb.set(t.id, t);
        return t;
      }),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn(async (id: string) => filesDb.get(id) ?? null),
      findById: vi.fn(async (id: string) => filesDb.get(id) ?? null)
    };

    mockQueueRepo = {
      getQueue: vi.fn().mockResolvedValue([]),
      saveQueue: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockHistoryRepo = {
      addRecord: vi.fn().mockResolvedValue(undefined),
      addHistoryEntry: vi.fn().mockResolvedValue(undefined),
      getRecent: vi.fn().mockResolvedValue([]),
      saveResumePosition: vi.fn().mockResolvedValue(undefined)
    };

    playbackManager = new PlaybackManager({
      audioEngine,
      filesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo: mockQueueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    queueManager = new QueueManager();
  });

  describe('1. Empty Queue Operations', () => {
    it('initializes with empty tracks and queue', () => {
      expect(queueManager.getTracks()).toHaveLength(0);
      expect(queueManager.getItems()).toHaveLength(0);
      expect(queueManager.getUpcomingTracks()).toHaveLength(0);
      expect(queueManager.getActiveIndex()).toBe(-1);
    });

    it('clearQueue on empty queue does not throw or corrupt state', () => {
      queueManager.clear();
      expect(queueManager.getTracks()).toHaveLength(0);
      expect(queueManager.getActiveIndex()).toBe(-1);
    });

    it('PlaybackManager exposes empty queue and upcoming items when nothing is queued', () => {
      expect(playbackManager.getTracks()).toHaveLength(0);
      expect(playbackManager.getQueue()).toHaveLength(0);
      expect(playbackManager.getUpcomingTracks()).toHaveLength(0);
    });
  });

  describe('2. Add Single Track to Queue', () => {
    it('adds a single track to QueueManager and maintains indices', () => {
      queueManager.addTracks([trackA]);
      expect(queueManager.getTracks()).toEqual([trackA]);
      expect(queueManager.getItems()).toHaveLength(1);
      expect(queueManager.getItems()[0].position).toBe(0);
      expect(queueManager.getActiveIndex()).toBe(0);
    });

    it('adds a single track via PlaybackManager.addToQueue and emits QUEUE_CHANGED', async () => {
      let eventPayload: any = null;
      eventBus.subscribe(DomainEvents.QUEUE_CHANGED, (e: any) => {
        eventPayload = e;
      });

      await playbackManager.addToQueue(trackA);
      expect(playbackManager.getTracks()).toEqual([trackA]);
      expect(playbackManager.getQueue()).toHaveLength(1);
      expect(eventPayload).not.toBeNull();
      expect(eventPayload.items).toHaveLength(1);
    });
  });

  describe('3. Add Multiple Tracks to Queue', () => {
    it('adds multiple tracks in order to QueueManager', () => {
      queueManager.addTracks([trackA, trackB, trackC]);
      expect(queueManager.getTracks()).toEqual([trackA, trackB, trackC]);
      expect(queueManager.getItems().map(i => i.position)).toEqual([0, 1, 2]);
    });

    it('adds multiple tracks via PlaybackManager.addToQueue', async () => {
      await playbackManager.addToQueue([trackA, trackB, trackC]);
      expect(playbackManager.getTracks()).toEqual([trackA, trackB, trackC]);
      expect(playbackManager.getQueue()).toHaveLength(3);
    });
  });

  describe('4. Add Track to Play Next', () => {
    it('inserts track immediately after currently playing track', () => {
      queueManager.setQueue([trackA, trackB, trackC], 0);
      expect(queueManager.getActiveIndex()).toBe(0);

      queueManager.insertNext(trackD);
      expect(queueManager.getTracks()).toEqual([trackA, trackD, trackB, trackC]);
      expect(queueManager.getActiveIndex()).toBe(0);
      expect(queueManager.getUpcomingTracks()).toEqual([trackD, trackB, trackC]);
    });

    it('inserts track at index 0 if queue is empty', () => {
      queueManager.insertNext(trackA);
      expect(queueManager.getTracks()).toEqual([trackA]);
      expect(queueManager.getActiveIndex()).toBe(0);
    });

    it('plays next via PlaybackManager.playNext', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await playbackManager.playNext(trackD);

      expect(playbackManager.getTracks()).toEqual([trackA, trackD, trackB, trackC]);
      expect(playbackManager.currentQueueIndex).toBe(0);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);
    });
  });

  describe('5. Multiple Play Next Tracks Preserve Order', () => {
    it('maintains the sequential order of inserted tracks right after active track', () => {
      queueManager.setQueue([trackA, trackB], 0);
      queueManager.insertNext([trackC, trackD, trackE]);

      expect(queueManager.getTracks()).toEqual([trackA, trackC, trackD, trackE, trackB]);
      expect(queueManager.getActiveIndex()).toBe(0);
      expect(queueManager.getUpcomingTracks()).toEqual([trackC, trackD, trackE, trackB]);
    });

    it('maintains order when using PlaybackManager.playNext with multiple tracks', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await playbackManager.playNext([trackC, trackD]);

      expect(playbackManager.getTracks()).toEqual([trackA, trackC, trackD, trackB]);
      expect(playbackManager.currentQueueIndex).toBe(0);
    });
  });

  describe('6. Remove Queue Item', () => {
    it('removes an upcoming queue item cleanly and updates remaining positions', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      queueManager.removeTrack(2); // removes trackC

      expect(queueManager.getTracks()).toEqual([trackA, trackB, trackD]);
      expect(queueManager.getItems().map(i => i.position)).toEqual([0, 1, 2]);
      expect(queueManager.getActiveIndex()).toBe(0);
    });

    it('adjusts activeIndex if a preceding track is removed', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 2); // trackC active
      queueManager.removeTrack(0); // removes trackA

      expect(queueManager.getTracks()).toEqual([trackB, trackC, trackD]);
      expect(queueManager.getActiveIndex()).toBe(1);
      expect(queueManager.getActiveTrack()?.id).toBe(trackC.id);
    });

    it('removes via PlaybackManager.removeFromQueue', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await playbackManager.removeFromQueue(1);

      expect(playbackManager.getTracks()).toEqual([trackA, trackC]);
      expect(playbackManager.currentQueueIndex).toBe(0);
    });
  });

  describe('7. Move Queue Item Up', () => {
    it('moves an item up one position', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      const success = queueManager.moveUp(2); // move trackC to index 1

      expect(success).toBe(true);
      expect(queueManager.getTracks()).toEqual([trackA, trackC, trackB, trackD]);
      expect(queueManager.getItems().map(i => i.position)).toEqual([0, 1, 2, 3]);
    });

    it('returns false when trying to move top item up', () => {
      queueManager.setQueue([trackA, trackB], 0);
      const success = queueManager.moveUp(0);
      expect(success).toBe(false);
      expect(queueManager.getTracks()).toEqual([trackA, trackB]);
    });

    it('moves up via PlaybackManager.moveQueueItemUp', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await playbackManager.moveQueueItemUp(2);

      expect(playbackManager.getTracks()).toEqual([trackA, trackC, trackB]);
    });
  });

  describe('8. Move Queue Item Down', () => {
    it('moves an item down one position', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      const success = queueManager.moveDown(1); // move trackB to index 2

      expect(success).toBe(true);
      expect(queueManager.getTracks()).toEqual([trackA, trackC, trackB, trackD]);
    });

    it('returns false when trying to move bottom item down', () => {
      queueManager.setQueue([trackA, trackB], 0);
      const success = queueManager.moveDown(1);
      expect(success).toBe(false);
      expect(queueManager.getTracks()).toEqual([trackA, trackB]);
    });

    it('moves down via PlaybackManager.moveQueueItemDown', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await playbackManager.moveQueueItemDown(1);

      expect(playbackManager.getTracks()).toEqual([trackA, trackC, trackB]);
    });
  });

  describe('9. Move Queue Item to Top', () => {
    it('moves an upcoming track to the head of upcoming tracks', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      const success = queueManager.moveToTop(3); // trackD moved to index 1 (top of upcoming)

      expect(success).toBe(true);
      expect(queueManager.getTracks()).toEqual([trackA, trackD, trackB, trackC]);
      expect(queueManager.getActiveIndex()).toBe(0);
    });

    it('moves to top via PlaybackManager.moveQueueItemToTop', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC, trackD]);
      await playbackManager.moveQueueItemToTop(3);

      expect(playbackManager.getTracks()).toEqual([trackA, trackD, trackB, trackC]);
      expect(playbackManager.currentQueueIndex).toBe(0);
    });
  });

  describe('10. Move Queue Item to Bottom', () => {
    it('moves an item to the end of the queue', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      const success = queueManager.moveToBottom(1); // move trackB to last index

      expect(success).toBe(true);
      expect(queueManager.getTracks()).toEqual([trackA, trackC, trackD, trackB]);
    });

    it('moves to bottom via PlaybackManager.moveQueueItemToBottom', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC, trackD]);
      await playbackManager.moveQueueItemToBottom(1);

      expect(playbackManager.getTracks()).toEqual([trackA, trackC, trackD, trackB]);
    });
  });

  describe('11. Arbitrary Queue Reordering', () => {
    it('reorders from arbitrary index to arbitrary destination index', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD, trackE], 0);
      queueManager.reorder(4, 1); // move trackE to index 1

      expect(queueManager.getTracks()).toEqual([trackA, trackE, trackB, trackC, trackD]);
      expect(queueManager.getItems().map(i => i.position)).toEqual([0, 1, 2, 3, 4]);
    });

    it('reorders via PlaybackManager.reorderQueue', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC, trackD]);
      await playbackManager.reorderQueue(3, 1);

      expect(playbackManager.getTracks()).toEqual([trackA, trackD, trackB, trackC]);
    });
  });

  describe('12. Clear Queue with Current Track Preservation', () => {
    it('preserves active track when clear(true) is invoked', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 1); // trackB active
      queueManager.clear(true);

      expect(queueManager.getTracks()).toEqual([trackB]);
      expect(queueManager.getActiveIndex()).toBe(0);
      expect(queueManager.getActiveTrack()?.id).toBe(trackB.id);
      expect(queueManager.getUpcomingTracks()).toHaveLength(0);
    });

    it('clears all tracks when clear(false) is invoked', () => {
      queueManager.setQueue([trackA, trackB, trackC], 1);
      queueManager.clear(false);

      expect(queueManager.getTracks()).toHaveLength(0);
      expect(queueManager.getActiveIndex()).toBe(-1);
      expect(queueManager.getActiveTrack()).toBeNull();
    });

    it('preserves playing track in PlaybackManager.clearQueue(true)', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await playbackManager.clearQueue(true);

      expect(playbackManager.getTracks()).toEqual([trackA]);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);
      expect(playbackManager.getUpcomingTracks()).toHaveLength(0);
    });
  });

  describe('13. Invalid Index Handling', () => {
    it('safely rejects out of bound indexes for moveUp, moveDown, moveToTop, moveToBottom, removeTrack, reorder', () => {
      queueManager.setQueue([trackA, trackB], 0);

      expect(queueManager.moveUp(-1)).toBe(false);
      expect(queueManager.moveUp(10)).toBe(false);
      expect(queueManager.moveDown(-5)).toBe(false);
      expect(queueManager.moveDown(5)).toBe(false);
      expect(queueManager.moveToTop(-1)).toBe(false);
      expect(queueManager.moveToTop(10)).toBe(false);
      expect(queueManager.moveToBottom(-1)).toBe(false);
      expect(queueManager.moveToBottom(10)).toBe(false);
      queueManager.removeTrack(-1);
      queueManager.removeTrack(10);
      queueManager.reorder(-1, 0);
      queueManager.reorder(0, 10);

      // Queue remains intact
      expect(queueManager.getTracks()).toEqual([trackA, trackB]);
    });
  });

  describe('14. Current Track Preservation During Queue Modifications', () => {
    it('preserves the active track identity and playback state when modifying upcoming tracks', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC, trackD]);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);

      // Reorder upcoming tracks
      await playbackManager.moveQueueItemDown(1);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);
      expect(playbackManager.currentQueueIndex).toBe(0);

      // Add upcoming tracks
      await playbackManager.addToQueue(trackE);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);

      // Remove an upcoming track
      await playbackManager.removeFromQueue(2);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);
      expect(playbackManager.currentQueueIndex).toBe(0);
    });
  });

  describe('15. Queue State After Adding Tracks', () => {
    it('maintains continuous position indices after adding items', () => {
      queueManager.addTracks([trackA]);
      queueManager.addTracks([trackB, trackC]);

      const items = queueManager.getItems();
      expect(items).toHaveLength(3);
      expect(items[0].position).toBe(0);
      expect(items[1].position).toBe(1);
      expect(items[2].position).toBe(2);
    });
  });

  describe('16. Queue State After Removing Tracks', () => {
    it('renumbers positions 0..N-1 contiguously after removal', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      queueManager.removeTrack(1);

      const items = queueManager.getItems();
      expect(items).toHaveLength(3);
      expect(items.map(i => i.position)).toEqual([0, 1, 2]);
      expect(queueManager.getTracks().map(t => t.id)).toEqual([trackA.id, trackC.id, trackD.id]);
    });
  });

  describe('17. Queue State After Reorder', () => {
    it('updates position properties matching new indices', () => {
      queueManager.setQueue([trackA, trackB, trackC], 0);
      queueManager.reorder(2, 0);

      const items = queueManager.getItems();
      expect(items.map(i => i.position)).toEqual([0, 1, 2]);
      expect(queueManager.getTracks().map(t => t.id)).toEqual([trackC.id, trackA.id, trackB.id]);
    });
  });

  describe('18. Shuffle Compatibility', () => {
    it('maintains shuffle order and handles queue mutations under shuffle mode', () => {
      queueManager.setQueue([trackA, trackB, trackC, trackD], 0);
      queueManager.setShuffleMode('on');

      const tracks = queueManager.getTracks();
      expect(tracks).toHaveLength(4);
      expect(queueManager.getActiveTrack()?.id).toBe(trackA.id);

      // Add track to shuffled queue
      queueManager.addTracks([trackE]);
      expect(queueManager.getTracks()).toHaveLength(5);

      // Insert play next
      const newTrack = createTrack('track_F', 'Track F');
      queueManager.insertNext(newTrack);
      expect(queueManager.getTracks()).toHaveLength(6);
    });
  });

  describe('19. Repeat Compatibility', () => {
    it('respects repeat mode during queue advance', () => {
      queueManager.setQueue([trackA, trackB], 1); // at end
      queueManager.setRepeatMode('off');
      expect(queueManager.getNextIndex()).toBeNull();

      queueManager.setRepeatMode('all');
      expect(queueManager.getNextIndex()).toBe(0);
    });
  });

  describe('20. Smart Playlist -> Queue Integration', () => {
    it('evaluates Smart Playlist rules and loads resulting tracks into queue', async () => {
      const allTracks = [trackA, trackB, trackC, trackD, trackE];
      const playlistDef: SmartPlaylistDefinition = {
        id: 'sp_1',
        name: 'Rock Tracks',
        rules: [{ field: 'title', operator: 'contains', value: 'Track' }],
        matchMode: 'all',
        limit: 3,
        sort: { field: 'title', order: 'asc' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true
      };

      const matchedTracks = SmartPlaylistEvaluator.evaluate(allTracks, playlistDef);
      expect(matchedTracks).toHaveLength(3);

      // Queue matched tracks
      await playbackManager.addToQueue(matchedTracks);
      expect(playbackManager.getTracks().map(t => t.id)).toEqual(matchedTracks.map(t => t.id));
    });
  });

  describe('21. PlaybackManager Remains Single Authoritative Controller', () => {
    it('coordinates track selection, playback state, and queue mutation centrally', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      expect(playbackManager.currentTrack?.id).toBe(trackA.id);

      await playbackManager.playQueueIndex(2);
      expect(playbackManager.currentTrack?.id).toBe(trackC.id);
      expect(playbackManager.currentQueueIndex).toBe(2);
    });
  });

  describe('22 & 23. AudioEngine and AudioContext Invariants', () => {
    it('does not instantiate secondary AudioEngine or AudioContext instances during queue operations', async () => {
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      const initialAudioContextCount = createdAudioContexts;
      expect(initialAudioContextCount).toBe(1);

      await playbackManager.addToQueue(trackD);
      await playbackManager.playNext(trackE);
      await playbackManager.moveQueueItemUp(2);
      await playbackManager.moveQueueItemDown(1);
      await playbackManager.moveQueueItemToTop(3);
      await playbackManager.moveQueueItemToBottom(1);
      await playbackManager.clearQueue(true);

      expect(createdAudioContexts).toBe(1);
    });
  });
});
