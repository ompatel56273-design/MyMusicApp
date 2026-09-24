import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { EventBus } from '../../src/core/events/event-bus';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('Feature 6: A/B Loop Playback Comprehensive Test Suite', () => {
  let eventBus: EventBus;
  let filesystem: VirtualFilesystemAdapter;
  let audioEngine: AudioEngine;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockQueueRepo: any;
  let mockHistoryRepo: any;
  let playbackManager: PlaybackManager;
  let mockContext: AudioContext;
  let createdAudioContexts: number;

  const trackA: Track = {
    id: 'track_A',
    fileId: 'file_A',
    title: 'Track A',
    artistName: 'Artist 1',
    durationMs: 180000, // 3 minutes (180,000 ms)
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available',
    replayGain: { trackGainDb: -6.0, trackPeak: 0.9 }
  };

  const trackB: Track = {
    id: 'track_B',
    fileId: 'file_B',
    title: 'Track B',
    artistName: 'Artist 1',
    durationMs: 240000, // 4 minutes
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const mockFileA: AudioFile = {
    id: 'file_A',
    path: 'C:/Music/track_A.flac',
    filename: 'track_A.flac',
    extension: 'flac',
    sizeBytes: 1024,
    modifiedTimeMs: Date.now(),
    availability: 'available'
  };

  const mockFileB: AudioFile = {
    id: 'file_B',
    path: 'C:/Music/track_B.flac',
    filename: 'track_B.flac',
    extension: 'flac',
    sizeBytes: 2048,
    modifiedTimeMs: Date.now(),
    availability: 'available'
  };

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

    mockContext = {
      state: 'running',
      sampleRate: 48000,
      currentTime: 10.0,
      destination: {},
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() }
      })),
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
        knee: { value: 0 },
        ratio: { value: 20, setValueAtTime: vi.fn() },
        attack: { value: 0.003 },
        release: { value: 0.05 }
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
    } as unknown as AudioContext;

    const MockAudioContextClass = vi.fn().mockImplementation(() => {
      createdAudioContexts++;
      return mockContext;
    });

    (globalThis as any).AudioContext = MockAudioContextClass;
    (globalThis as any).webkitAudioContext = MockAudioContextClass;

    eventBus = new EventBus();
    filesystem = new VirtualFilesystemAdapter();
    filesystem.addVirtualFile('C:/Music/track_A.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/track_B.flac', 2048, Date.now(), new Uint8Array([4, 5, 6]));

    audioEngine = new AudioEngine();
    audioEngine.getDspOptions();

    mockTrackRepo = {
      getById: vi.fn(async (id: string) => {
        if (id === 'track_A') return trackA;
        if (id === 'track_B') return trackB;
        return null;
      }),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn(async (id: string) => {
        if (id === 'file_A') return mockFileA;
        if (id === 'file_B') return mockFileB;
        return null;
      })
    };

    mockQueueRepo = {
      getQueue: vi.fn().mockResolvedValue([]),
      saveQueue: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockHistoryRepo = {
      addRecord: vi.fn().mockResolvedValue(undefined),
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
  });

  it('1. Basic A/B setup: setting Point A and Point B activates A/B loop', async () => {
    await playbackManager.playTrack(trackA);

    // Set Point A at 10,000 ms (10s)
    playbackManager.setLoopA?.(10000);
    let state = playbackManager.abLoop!;
    expect(state.pointA).toBe(10000);
    expect(state.pointB).toBeNull();
    expect(state.isActive).toBe(false);

    // Set Point B at 30,000 ms (30s)
    playbackManager.setLoopB?.(30000);
    state = playbackManager.abLoop!;
    expect(state.pointA).toBe(10000);
    expect(state.pointB).toBe(30000);
    expect(state.isActive).toBe(true);
  });

  it('2. Point A only: setting Point A alone leaves loop inactive', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(15000);

    const state = playbackManager.abLoop!;
    expect(state.pointA).toBe(15000);
    expect(state.pointB).toBeNull();
    expect(state.isActive).toBe(false);
  });

  it('3. Point B only: setting Point B without Point A defaults Point A to 0', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopB?.(40000);

    const state = playbackManager.abLoop!;
    expect(state.pointA).toBe(0);
    expect(state.pointB).toBe(40000);
    expect(state.isActive).toBe(true);
  });

  it('4. Boundary enforcement: position >= Point B triggers instant seek back to Point A', async () => {
    const seekSpy = vi.spyOn(audioEngine, 'seek');
    await playbackManager.playTrack(trackA);

    playbackManager.setLoopA?.(10000); // 10s
    playbackManager.setLoopB?.(20000); // 20s

    // Simulate handleTimeUpdate at 20.1s
    (playbackManager as any).handleTimeUpdate(20.1, 180);

    expect(seekSpy).toHaveBeenCalledWith(10.0); // 10s in seconds
    expect(playbackManager.positionMs).toBe(10000);
  });

  it('5. A >= B validation: setting B <= A does not create an active loop', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(30000);
    playbackManager.setLoopB?.(20000); // B < A

    const state = playbackManager.abLoop!;
    expect(state.isActive).toBe(false);
  });

  it('6. Negative / out-of-range positions: clamps positions safely to track duration', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(-5000); // Clamped to 0
    playbackManager.setLoopB?.(250000); // Clamped to track duration 180000

    const state = playbackManager.abLoop!;
    expect(state.pointA).toBe(0);
    expect(state.pointB).toBe(180000);
    expect(state.isActive).toBe(true);
  });

  it('7. Toggle loop: toggling enabled deactivates and reactivates A/B loop', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    expect(playbackManager.abLoop!.isActive).toBe(true);

    playbackManager.toggleAbLoop?.(false);
    expect(playbackManager.abLoop!.isActive).toBe(false);

    playbackManager.toggleAbLoop?.(true);
    expect(playbackManager.abLoop!.isActive).toBe(true);
  });

  it('8. Clear loop: clearAbLoop resets points to null and isActive to false', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    playbackManager.clearAbLoop?.();
    const state = playbackManager.abLoop!;
    expect(state.pointA).toBeNull();
    expect(state.pointB).toBeNull();
    expect(state.isActive).toBe(false);
  });

  it('9. Pause/resume: pausing and resuming preserves A/B loop state', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    await playbackManager.pause();
    expect(playbackManager.abLoop!.isActive).toBe(true);

    await playbackManager.resume();
    expect(playbackManager.abLoop!.isActive).toBe(true);
  });

  it('10. Seek inside loop: seeking to a position inside [A, B] maintains active loop', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    await playbackManager.seek(20000);
    expect(playbackManager.positionMs).toBe(20000);
    expect(playbackManager.abLoop!.isActive).toBe(true);
  });

  it('11. Seek below A: seeking below Point A plays smoothly toward B', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(20000);
    playbackManager.setLoopB?.(40000);

    await playbackManager.seek(5000); // 5s < 20s
    expect(playbackManager.positionMs).toBe(5000);
    expect(playbackManager.abLoop!.isActive).toBe(true);
  });

  it('12. Seek at/above B: seeking beyond B immediately loops back to Point A', async () => {
    const seekSpy = vi.spyOn(audioEngine, 'seek');
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    await playbackManager.seek(35000); // Seeking past B
    expect(playbackManager.positionMs).toBe(10000);
    expect(seekSpy).toHaveBeenCalledWith(10.0);
  });

  it('13. Track change clears loop: loading a new track clears A/B loop state', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);
    expect(playbackManager.abLoop!.isActive).toBe(true);

    await playbackManager.playTrack(trackB);
    const state = playbackManager.abLoop!;
    expect(state.pointA).toBeNull();
    expect(state.pointB).toBeNull();
    expect(state.isActive).toBe(false);
  });

  it('14. Next clears loop: manual next clears active A/B loop', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);
    expect(playbackManager.abLoop!.isActive).toBe(true);

    await playbackManager.next();
    expect(playbackManager.abLoop!.isActive).toBe(false);
  });

  it('15. Previous clears loop: manual previous clears active A/B loop', async () => {
    await playbackManager.playTrack(trackB, [trackA, trackB]);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);
    expect(playbackManager.abLoop!.isActive).toBe(true);

    await playbackManager.previous();
    expect(playbackManager.abLoop!.isActive).toBe(false);
  });

  it('16. Gapless suppression: A/B loop suppresses gapless track transition on track end', async () => {
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    // Preload next track
    await audioEngine.prepareNext?.('C:/Music/track_B.flac');

    const transitionSpy = vi.spyOn(audioEngine, 'transitionToNext');

    // Simulate handleTrackEnded
    await (playbackManager as any).handleTrackEnded();

    expect(transitionSpy).not.toHaveBeenCalled();
    expect(playbackManager.currentTrack?.id).toBe('track_A');
  });

  it('17. Crossfade suppression: A/B loop suppresses crossfade triggering', async () => {
    audioEngine.setCrossfade(true, 5);
    await playbackManager.playTrack(trackA, [trackA, trackB]);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    const crossfadeSpy = vi.spyOn(audioEngine, 'startCrossfadeToNext');

    // Simulate handleTimeUpdate near track end (e.g. 176s out of 180s)
    (playbackManager as any).handleTimeUpdate(176.0, 180.0);

    expect(crossfadeSpy).not.toHaveBeenCalled();
  });

  it('18. ReplayGain invariance: ReplayGain preamp node remains active during A/B loop', async () => {
    audioEngine.setReplayGainMode('track');
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    expect(audioEngine.getDspPipeline()?.getEffectiveReplayGainDb()).toBe(-6.0);
  });

  it('19. EQ/DSP invariance: Equalizer settings remain intact during A/B loop', async () => {
    await playbackManager.playTrack(trackA);
    audioEngine.setEqualizerEnabled(true);
    audioEngine.setEqualizerBands([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    const opts = audioEngine.getDspOptions();
    expect(opts.equalizerEnabled).toBe(true);
    expect(opts.equalizerBands).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it('20. Visualizer/analyser invariance: Analyser node is maintained during A/B loop', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    const analyser = audioEngine.getDspPipeline()?.getAnalyserNode();
    expect(analyser).toBeDefined();
  });

  it('21. Single AudioEngine/AudioContext invariant: exactly 1 AudioContext is created and reused', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    expect(createdAudioContexts).toBe(1);
    expect((playbackManager as any).audioEngine).toBe(audioEngine);
  });

  it('22. History & Statistics no-double-counting: looping A/B does not create duplicate history records', async () => {
    await playbackManager.playTrack(trackA);
    playbackManager.setLoopA?.(10000);
    playbackManager.setLoopB?.(30000);

    // Simulate 3 loop iterations
    (playbackManager as any).handleTimeUpdate(20.1, 180);
    (playbackManager as any).handleTimeUpdate(20.1, 180);
    (playbackManager as any).handleTimeUpdate(20.1, 180);

    // History addRecord should NOT have been called multiple times
    expect(mockHistoryRepo.addRecord).not.toHaveBeenCalled();
  });
});
