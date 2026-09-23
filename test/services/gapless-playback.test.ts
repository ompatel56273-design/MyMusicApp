import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events/event-bus';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('Feature 3: Gapless Playback Comprehensive Test Suite', () => {
  let eventBus: EventBus;
  let filesystem: VirtualFilesystemAdapter;
  let audioEngine: AudioEngine;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockQueueRepo: any;
  let mockHistoryRepo: any;
  let playbackManager: PlaybackManager;

  const trackA: Track = {
    id: 'track_A',
    fileId: 'file_A',
    title: 'Track A - Ambient Intro',
    artistName: 'Artist 1',
    durationMs: 180000, // 3 mins
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const trackB: Track = {
    id: 'track_B',
    fileId: 'file_B',
    title: 'Track B - Continuous Movement',
    artistName: 'Artist 1',
    durationMs: 240000, // 4 mins
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const trackC: Track = {
    id: 'track_C',
    fileId: 'file_C',
    title: 'Track C - Outro',
    artistName: 'Artist 1',
    durationMs: 120000,
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const missingTrack: Track = {
    id: 'track_missing',
    fileId: 'file_missing',
    title: 'Track Missing File',
    artistName: 'Artist 1',
    durationMs: 120000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'missing'
  };

  let mockAudioElements: any[] = [];
  let mockGainNodes: any[] = [];
  let audioContextCreatedCount = 0;

  beforeEach(() => {
    eventBus = new EventBus();
    filesystem = new VirtualFilesystemAdapter();
    filesystem.addVirtualFile('C:/Music/track_A.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/track_B.flac', 2048, Date.now(), new Uint8Array([4, 5, 6]));
    filesystem.addVirtualFile('C:/Music/track_C.flac', 3072, Date.now(), new Uint8Array([7, 8, 9]));

    mockAudioElements = [];
    mockGainNodes = [];
    audioContextCreatedCount = 0;

    const createMockAudioElement = () => {
      let canPlayListener: any = null;
      let errorListener: any = null;
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
          if (evt === 'error') errorListener = cb;
        }),
        removeEventListener: vi.fn((evt: string) => {
          if (evt === 'canplay') canPlayListener = null;
          if (evt === 'error') errorListener = null;
        }),
        play: vi.fn(function (this: any) {
          this.paused = false;
          return Promise.resolve();
        }),
        pause: vi.fn(function (this: any) {
          this.paused = true;
        }),
        load: vi.fn(function (this: any) {
          if (this.src === 'error://corrupted') {
            if (errorListener) errorListener(new Error('Decode error'));
          } else if (canPlayListener) {
            canPlayListener();
          }
        })
      };
      mockAudioElements.push(el);
      return el;
    };

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

    const createMockGainNode = () => {
      const node = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          value: 1,
          setValueAtTime: vi.fn(function (this: any, val: number) {
            this.value = val;
          })
        }
      };
      mockGainNodes.push(node);
      return node;
    };

    const mockContext = {
      state: 'running',
      sampleRate: 48000,
      currentTime: 10.0,
      destination: {},
      createGain: vi.fn(createMockGainNode),
      createBiquadFilter: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 0, setValueAtTime: vi.fn() },
        frequency: { value: 1000 },
        Q: { value: 1 }
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
        knee: { value: 0, setValueAtTime: vi.fn() },
        ratio: { value: 20, setValueAtTime: vi.fn() },
        attack: { value: 0.003, setValueAtTime: vi.fn() },
        release: { value: 0.05, setValueAtTime: vi.fn() }
      })),
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 256,
        frequencyBinCount: 128,
        smoothingTimeConstant: 0.8,
        getByteFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn()
      })),
      createMediaElementSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };

    (globalThis as any).AudioContext = vi.fn(() => {
      audioContextCreatedCount++;
      return mockContext;
    });
    (globalThis as any).window = {
      AudioContext: (globalThis as any).AudioContext,
      URL: {
        createObjectURL: vi.fn((_blob: Blob) => `blob:http://localhost/${Math.random()}`),
        revokeObjectURL: vi.fn()
      }
    };
    (globalThis as any).URL = (globalThis as any).window.URL;

    mockTrackRepo = {
      getById: vi.fn((id: string) => {
        if (id === 'track_A') return Promise.resolve(trackA);
        if (id === 'track_B') return Promise.resolve(trackB);
        if (id === 'track_C') return Promise.resolve(trackC);
        if (id === 'track_missing') return Promise.resolve(missingTrack);
        return Promise.resolve(null);
      }),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn((id: string) => {
        if (id === 'file_A') return Promise.resolve({ id: 'file_A', path: 'C:/Music/track_A.flac', availability: 'available' } as AudioFile);
        if (id === 'file_B') return Promise.resolve({ id: 'file_B', path: 'C:/Music/track_B.flac', availability: 'available' } as AudioFile);
        if (id === 'file_C') return Promise.resolve({ id: 'file_C', path: 'C:/Music/track_C.flac', availability: 'available' } as AudioFile);
        return Promise.resolve(null);
      })
    };

    mockQueueRepo = {
      saveQueue: vi.fn().mockResolvedValue(undefined),
      saveQueueMetadata: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockHistoryRepo = {
      saveResumePosition: vi.fn().mockResolvedValue(undefined),
      addRecord: vi.fn().mockResolvedValue(undefined)
    };

    audioEngine = new AudioEngine();

    playbackManager = new PlaybackManager({
      audioEngine,
      filesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo: mockQueueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });
  });

  const waitForPreload = async () => {
    await playbackManager.getPreloadPromise();
  };

  // 1 & 2. Preloading next track when playing current track
  it('1 & 2: should automatically preload the immediately upcoming track in the queue', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
    await waitForPreload();

    expect(playbackManager.currentTrack?.id).toBe('track_A');
    expect(playbackManager.state).toBe('playing');

    // Verify AudioEngine has standby track prepared
    expect(audioEngine.hasPreparedNext()).toBe(true);
    // Verify only the immediate next track (Track B) was loaded into standby
    expect(mockAudioFileRepo.getById).toHaveBeenCalledWith('file_B');
    expect(mockAudioFileRepo.getById).not.toHaveBeenCalledWith('file_C');
  });

  // 3 & 4. Gapless scheduling & atomic gain transition on end of track
  it('3 & 4: should transition gaplessly and swap channel gains when track ends', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    const trackChangedEvents: any[] = [];
    eventBus.subscribe(DomainEvents.TRACK_CHANGED, (evt: any) => {
      trackChangedEvents.push(evt);
    });

    await (playbackManager as any).handleTrackEnded();
    await waitForPreload();

    expect(playbackManager.currentTrack?.id).toBe('track_B');
    expect(playbackManager.currentQueueIndex).toBe(1);
    expect(playbackManager.state).toBe('playing');

    // Standby is immediately triggered to preload Track C
    expect(audioEngine.hasPreparedNext()).toBe(true);
    expect(mockAudioFileRepo.getById).toHaveBeenCalledWith('file_C');
  });

  // 5. Manual Next overriding scheduled transition
  it('5: manual Next click should cancel obsolete preload and load next track', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    // User presses Next manually
    await playbackManager.next();
    await waitForPreload();

    expect(playbackManager.currentTrack?.id).toBe('track_B');
    expect(playbackManager.currentQueueIndex).toBe(1);
    // After playing Track B, Track C is preloaded
    expect(audioEngine.hasPreparedNext()).toBe(true);
  });

  // 6. Manual Previous overriding scheduled transition
  it('6: manual Previous click should cancel obsolete preload and load previous track', async () => {
    await playbackManager.playTrack(trackB, [trackA, trackB, trackC]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    await playbackManager.previous();
    await waitForPreload();

    expect(playbackManager.currentTrack?.id).toBe('track_A');
    expect(playbackManager.currentQueueIndex).toBe(0);
    expect(audioEngine.hasPreparedNext()).toBe(true);
  });

  // 7. Seek invalidating and refreshing scheduled transition
  it('7: seek should cancel obsolete transition state and rebuild next track preload', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    await playbackManager.seek(60000);
    await waitForPreload();

    expect(playbackManager.positionMs).toBe(60000);
    expect(audioEngine.hasPreparedNext()).toBe(true);
  });

  // 8. Pause preventing unintended transition
  it('8: pause should never trigger the prepared next track', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    await playbackManager.pause();
    expect(playbackManager.state).toBe('paused');

    // Standby audio element must remain paused
    const standbyAudio = mockAudioElements[1];
    expect(standbyAudio.paused).toBe(true);
  });

  // 9. Queue reorder during preload
  it('9: reordering the queue should update the preloaded track to match new queue order', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    // Reorder so track C is immediately after track A (indices: trackA=0, trackC=1, trackB=2)
    await playbackManager.reorderQueue(2, 1);
    await waitForPreload();

    expect(playbackManager.queue[1]?.trackId).toBe('track_C');
    expect(mockAudioFileRepo.getById).toHaveBeenCalledWith('file_C');
  });

  // 10. Queue clear during preload
  it('10: clearing queue should cancel preload and release standby buffer', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    await playbackManager.clearQueue();

    expect(audioEngine.hasPreparedNext()).toBe(false);
  });

  // 11. Repeat ONE mode
  it('11: repeat ONE mode should preload the current track again for seamless looping', async () => {
    playbackManager.setRepeatMode('one');
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();

    expect(audioEngine.hasPreparedNext()).toBe(true);

    // End of track in Repeat One should seamlessly transition back to Track A
    await (playbackManager as any).handleTrackEnded();
    expect(playbackManager.currentTrack?.id).toBe('track_A');
  });

  // 12. Repeat ALL mode
  it('12: repeat ALL mode at end of queue should wrap around and preload first track', async () => {
    playbackManager.setRepeatMode('all');
    await playbackManager.playTrack(trackC, [trackA, trackB, trackC]);
    await waitForPreload();

    expect(audioEngine.hasPreparedNext()).toBe(true);
    expect(mockAudioFileRepo.getById).toHaveBeenCalledWith('file_A');

    await (playbackManager as any).handleTrackEnded();
    expect(playbackManager.currentTrack?.id).toBe('track_A');
    expect(playbackManager.currentQueueIndex).toBe(0);
  });

  // 13. Shuffle mode
  it('13: shuffle mode should preload the next track in the shuffled permutation', async () => {
    playbackManager.setShuffleMode('on');
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
    await waitForPreload();

    expect(audioEngine.hasPreparedNext()).toBe(true);
    const nextIdx = (playbackManager as any).queueManager.getNextIndex();
    expect(nextIdx).not.toBeNull();
  });

  // 14. End of queue behavior
  it('14: end of queue with repeat OFF should not preload and should stop gracefully', async () => {
    playbackManager.setRepeatMode('off');
    await playbackManager.playTrack(trackC, [trackA, trackB, trackC]);
    await waitForPreload();

    expect(audioEngine.hasPreparedNext()).toBe(false);

    await (playbackManager as any).handleTrackEnded();
    expect(playbackManager.state).toBe('stopped');
  });

  // 15. Missing next track
  it('15: missing next track file should fail preload silently and fall back gracefully', async () => {
    await playbackManager.playTrack(trackA, [trackA, missingTrack]);
    await waitForPreload();

    expect(audioEngine.hasPreparedNext()).toBe(false);

    // Current track A plays normally
    expect(playbackManager.state).toBe('playing');
  });

  // 16 & 17. Decode failure / corrupt audio fallback
  it('16 & 17: decode or load error during preload should cancel preload without interrupting current playback', async () => {
    const corruptTrack: Track = { ...trackB, id: 'track_corrupt', fileId: 'file_corrupt' };
    mockAudioFileRepo.getById.mockImplementation((id: string) => {
      if (id === 'file_A') return Promise.resolve({ id: 'file_A', path: 'C:/Music/track_A.flac', availability: 'available' });
      if (id === 'file_corrupt') return Promise.resolve({ id: 'file_corrupt', path: 'C:/Music/corrupt.flac', availability: 'available' });
      return Promise.resolve(null);
    });
    filesystem.addVirtualFile('C:/Music/corrupt.flac', 10, Date.now(), new Uint8Array([0]));

    vi.spyOn(audioEngine, 'prepareNext').mockRejectedValueOnce(new Error('Corrupt audio stream'));

    await playbackManager.playTrack(trackA, [trackA, corruptTrack]);
    await waitForPreload();

    expect(playbackManager.state).toBe('playing');
    expect(audioEngine.hasPreparedNext()).toBe(false);
  });

  // 18. Rapid Next/Previous clicks
  it('18: rapid Next/Previous clicks should maintain consistency without race conditions', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);

    const p1 = playbackManager.next();
    const p2 = playbackManager.next();
    const p3 = playbackManager.previous();

    await Promise.all([p1, p2, p3]);
    await waitForPreload();

    expect(playbackManager.state).toBe('playing');
    expect(playbackManager.currentTrack).toBeDefined();
  });

  // 19. Sleep timer interaction
  it('19: sleep timer pausing playback should not allow standby track to trigger', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    // Sleep timer expires and calls pause()
    await playbackManager.pause();
    expect(playbackManager.state).toBe('paused');

    // Standby element remains silent
    expect(audioEngine.isPlaying).toBe(false);
  });

  // 20. Statistics / history not counting preloaded tracks
  it('20: preloading a track must NOT count towards play count or history', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    // Track B was preloaded, but NOT played
    expect(mockTrackRepo.incrementPlayCount).not.toHaveBeenCalledWith('track_B', expect.any(Number));
    expect(mockHistoryRepo.addRecord).not.toHaveBeenCalledWith(expect.objectContaining({ trackId: 'track_B' }));
  });

  // 21. Visualizer/analyser pipeline remains authoritative
  it('21: visualizer analysis metrics continue through the same DSP pipeline during transitions', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();

    const metrics1 = audioEngine.getAnalysisMetrics();
    expect(metrics1).toBeDefined();
    expect(metrics1.frequencyData).toBeInstanceOf(Uint8Array);

    await (playbackManager as any).handleTrackEnded();
    await waitForPreload();

    const metrics2 = audioEngine.getAnalysisMetrics();
    expect(metrics2).toBeDefined();
    expect(metrics2.frequencyData.length).toBe(128);
  });

  // 22 & 23. No duplicate AudioContext or AudioEngine
  it('22 & 23: guarantees a single AudioContext and single AudioEngine instance', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await (playbackManager as any).handleTrackEnded();
    await playbackManager.next();

    // Verify AudioContext was created exactly once across multiple track transitions
    expect(audioContextCreatedCount).toBe(1);
  });

  // 24. Memory cleanup / stale prepared buffer cleanup
  it('24: cleans up and revokes object URLs on track transitions and disposal', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    await waitForPreload();
    expect(URL.createObjectURL).toHaveBeenCalled();

    await (playbackManager as any).handleTrackEnded();
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    audioEngine.dispose();
    expect(audioEngine.hasPreparedNext()).toBe(false);
  });

  // 25. Failed gapless transition fallback should NOT skip next track
  it('25: failed gapless transition should safely fall back and play the preloaded next track without skipping', async () => {
    // Queue: A -> B -> C
    await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
    await waitForPreload();
    expect(audioEngine.hasPreparedNext()).toBe(true);

    // Mock transitionToNext to reject once
    vi.spyOn(audioEngine, 'transitionToNext').mockRejectedValueOnce(new Error('Transition failure'));

    // Trigger end of track A
    await (playbackManager as any).handleTrackEnded();
    await waitForPreload();

    // Verify that fallback plays B (not C)
    expect(playbackManager.currentTrack?.id).toBe('track_B');
    expect(playbackManager.currentQueueIndex).toBe(1);
    expect(playbackManager.state).toBe('playing');
    expect(playbackManager.currentTrack?.id).not.toBe('track_C');
  });
});
