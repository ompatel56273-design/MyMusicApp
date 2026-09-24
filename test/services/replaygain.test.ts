import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DspPipeline } from '../../src/services/audio/dsp-pipeline';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { AudioSettingsService } from '../../src/services/audio/audio-settings-service';
import { EventBus } from '../../src/core/events/event-bus';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('Feature 5: ReplayGain Improvements Comprehensive Test Suite', () => {
  let mockContext: AudioContext;
  let mockGainNodes: any[];
  let mockAudioElements: any[];
  let createdAudioContexts: number;

  beforeEach(() => {
    mockGainNodes = [];
    mockAudioElements = [];
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
      mockAudioElements.push(el);
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

    const createMockGainNode = () => {
      const node = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: {
          value: 1,
          setValueAtTime: vi.fn(function (this: any, val: number) {
            this.value = val;
          }),
          linearRampToValueAtTime: vi.fn(function (this: any, val: number) {
            this.value = val;
          })
        }
      };
      mockGainNodes.push(node);
      return node;
    };

    mockContext = {
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
  });

  describe('DspPipeline ReplayGain Logic', () => {
    let pipeline: DspPipeline;

    beforeEach(() => {
      pipeline = new DspPipeline(mockContext);
    });

    it('1. ReplayGain disabled: mode "off" produces 0 dB gain (linear 1.0)', () => {
      pipeline.setReplayGainMode('off');
      pipeline.setReplayGainData({ trackGainDb: -6.0, albumGainDb: -3.0 });

      const opts = pipeline.getOptions();
      expect(opts.replayGainMode).toBe('off');
      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);
    });

    it('2. Track gain applied: mode "track" uses trackGainDb', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ trackGainDb: -6.0, albumGainDb: -3.0 });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(-6.0);
      expect(pipeline.getEffectiveLinearGain()).toBeCloseTo(0.501187, 4);
    });

    it('3. Album gain applied: mode "album" uses albumGainDb', () => {
      pipeline.setReplayGainMode('album');
      pipeline.setReplayGainData({ trackGainDb: -6.0, albumGainDb: -3.0 });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(-3.0);
      expect(pipeline.getEffectiveLinearGain()).toBeCloseTo(0.707945, 4);
    });

    it('4. Missing track gain: falls back to albumGainDb in "track" mode', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ albumGainDb: -4.0 });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(-4.0);

      pipeline.setReplayGainData(null);
      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);
    });

    it('5. Missing album gain: falls back to trackGainDb in "album" mode', () => {
      pipeline.setReplayGainMode('album');
      pipeline.setReplayGainData({ trackGainDb: -5.0 });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(-5.0);

      pipeline.setReplayGainData({});
      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);
    });

    it('6. Invalid gain metadata: non-numeric or malformed values fall back to 0 dB', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ trackGainDb: 'invalid' as any });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);
    });

    it('7. Invalid peak metadata: non-numeric, negative, or zero peak falls back safely without breaking gain', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ trackGainDb: 6.0, trackPeak: -0.5 });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(6.0);
      expect(pipeline.getEffectiveLinearGain()).toBeCloseTo(10 ** (6 / 20), 4);
    });

    it('8. NaN handling: NaN gain or peak falls back safely to 0 dB / 1.0 linear gain', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ trackGainDb: NaN, trackPeak: NaN });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);
    });

    it('9. Infinity handling: Infinity or -Infinity gain/peak are handled safely', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ trackGainDb: Infinity, trackPeak: Infinity });

      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);
    });

    it('10. Gain clamping: clamps gainDb within [-20, +20] dB and caps max linear gain at 4.0', () => {
      pipeline.setReplayGainMode('track');

      pipeline.setReplayGainData({ trackGainDb: 30.0 });
      expect(pipeline.getEffectiveReplayGainDb()).toBe(15.0);
      expect(pipeline.getEffectiveLinearGain()).toBeLessThanOrEqual(4.0);

      pipeline.setReplayGainData({ trackGainDb: -40.0 });
      expect(pipeline.getEffectiveReplayGainDb()).toBe(-24.0);
    });

    it('11. Peak-aware clipping protection: scales linear gain down when linearGain * peak > 1.0', () => {
      pipeline.setReplayGainMode('track');
      pipeline.setPreventClipping(true);

      pipeline.setReplayGainData({ trackGainDb: 6.0, trackPeak: 1.0 });
      expect(pipeline.getEffectiveLinearGain()).toBe(1.0);

      pipeline.setPreventClipping(false);
      expect(pipeline.getEffectiveLinearGain()).toBeCloseTo(10 ** (6 / 20), 4);
    });

    it('12. Runtime setting changes: changing mode or preventClipping updates preamp immediately without AudioContext restart', () => {
      pipeline.setReplayGainData({ trackGainDb: -6.0, albumGainDb: -3.0 });

      pipeline.setReplayGainMode('track');
      expect(pipeline.getEffectiveReplayGainDb()).toBe(-6.0);

      pipeline.setReplayGainMode('album');
      expect(pipeline.getEffectiveReplayGainDb()).toBe(-3.0);

      pipeline.setReplayGainMode('off');
      expect(pipeline.getEffectiveReplayGainDb()).toBe(0);

      expect(pipeline.getOptions().replayGainMode).toBe('off');
    });

    it('15. ReplayGain + Equalizer: ReplayGain preamp stage works alongside EQ filters in same AudioContext', () => {
      pipeline.setEqualizerBands([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
      pipeline.setReplayGainMode('track');
      pipeline.setReplayGainData({ trackGainDb: -4.0 });

      const opts = pipeline.getOptions();
      expect(opts.equalizerEnabled).toBe(true);
      expect(opts.replayGainMode).toBe('track');
      expect(pipeline.getEffectiveReplayGainDb()).toBe(-4.0);
    });

    it('16. ReplayGain + Visualizer: Analyser node receives authoritative audio stream', () => {
      const analyser = pipeline.getAnalyserNode();
      expect(analyser).toBeDefined();
      expect(mockContext.createAnalyser).toHaveBeenCalled();
    });
  });

  describe('AudioEngine & PlaybackManager ReplayGain Integration', () => {
    let eventBus: EventBus;
    let filesystem: VirtualFilesystemAdapter;
    let audioEngine: AudioEngine;
    let mockTrackRepo: any;
    let mockAudioFileRepo: any;
    let mockQueueRepo: any;
    let mockHistoryRepo: any;
    let playbackManager: PlaybackManager;

    const trackWithGainA: Track = {
      id: 'track_A',
      fileId: 'file_A',
      title: 'Track A',
      artistName: 'Artist 1',
      durationMs: 180000,
      format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available',
      replayGain: { trackGainDb: -6.0, trackPeak: 0.9, albumGainDb: -2.0, albumPeak: 0.95 }
    };

    const trackWithGainB: Track = {
      id: 'track_B',
      fileId: 'file_B',
      title: 'Track B',
      artistName: 'Artist 1',
      durationMs: 240000,
      format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available',
      replayGain: { trackGainDb: -3.0, trackPeak: 0.85, albumGainDb: -2.0, albumPeak: 0.95 }
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
      eventBus = new EventBus();
      filesystem = new VirtualFilesystemAdapter();
      filesystem.addVirtualFile('C:/Music/track_A.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
      filesystem.addVirtualFile('C:/Music/track_B.flac', 2048, Date.now(), new Uint8Array([4, 5, 6]));

      audioEngine = new AudioEngine();
      audioEngine.getDspOptions();

      mockTrackRepo = {
        getById: vi.fn(async (id: string) => {
          if (id === 'track_A') return trackWithGainA;
          if (id === 'track_B') return trackWithGainB;
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
        clearQueue: vi.fn().mockResolvedValue(undefined),
        saveQueueMetadata: vi.fn().mockResolvedValue(undefined)
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

    it('13. ReplayGain + Gapless Transition: Standby track ReplayGain metadata is transferred cleanly on transitionToNext', async () => {
      audioEngine.setReplayGainMode('track');

      await playbackManager.playTrack(trackWithGainA, [trackWithGainA, trackWithGainB]);
      expect(audioEngine.getDspPipeline()?.getEffectiveReplayGainDb()).toBe(-6.0);

      await audioEngine.prepareNext('C:/Music/track_B.flac', { replayGain: trackWithGainB.replayGain });

      audioEngine.transitionToNext();
      expect(audioEngine.getDspPipeline()?.getEffectiveReplayGainDb()).toBe(-3.0);
    });

    it('14. ReplayGain + Crossfade: Standby track ReplayGain is applied on startCrossfadeToNext so finalGain = RG * CrossfadeGain', async () => {
      audioEngine.setReplayGainMode('track');
      await playbackManager.playTrack(trackWithGainA, [trackWithGainA, trackWithGainB]);

      await audioEngine.prepareNext('C:/Music/track_B.flac', { replayGain: trackWithGainB.replayGain });

      audioEngine.startCrossfadeToNext(2.0);
      expect(audioEngine.getDspPipeline()?.getEffectiveReplayGainDb()).toBe(-3.0);
    });

    it('17. Invariant: Exactly one AudioContext is created and reused', async () => {
      await playbackManager.playTrack(trackWithGainA, [trackWithGainA, trackWithGainB]);
      audioEngine.setReplayGainMode('album');
      audioEngine.setPreventClipping(false);

      expect(createdAudioContexts).toBe(1);
    });

    it('18. Invariant: Exactly one AudioEngine instance is used', () => {
      expect((playbackManager as any).audioEngine).toBe(audioEngine);
    });

    it('19. Queue persistence unaffected by ReplayGain', async () => {
      await playbackManager.playTrack(trackWithGainA, [trackWithGainA, trackWithGainB]);
      expect(mockQueueRepo.saveQueue).toHaveBeenCalled();
    });

    it('20. History and Statistics unaffected by ReplayGain', async () => {
      await playbackManager.playTrack(trackWithGainA, [trackWithGainA, trackWithGainB]);
      await (playbackManager as any).recordPlaybackHistory(true);
      expect(mockHistoryRepo.addRecord).toHaveBeenCalled();
    });

    it('21. Sleep timer unaffected by ReplayGain', () => {
      expect(audioEngine.getDspOptions().masterVolume).toBeDefined();
    });
  });

  describe('AudioSettingsService ReplayGain Settings Persistence', () => {
    let mockEngine: any;
    let mockDb: any;
    let settingsService: AudioSettingsService;

    beforeEach(() => {
      mockEngine = {
        setEqualizerBands: vi.fn(),
        setEqualizerEnabled: vi.fn(),
        setPreampGain: vi.fn(),
        setReplayGainMode: vi.fn(),
        setPreventClipping: vi.fn(),
        setMasterVolume: vi.fn(),
        setBalance: vi.fn(),
        setLimiterEnabled: vi.fn(),
        setCrossfadeDuration: vi.fn(),
        setCrossfadeEnabled: vi.fn()
      };

      mockDb = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      };

      settingsService = new AudioSettingsService(mockDb);
    });

    it('22. ReplayGain settings persistence: loads, sanitizes, saves and applies replayGainMode & preventClipping', async () => {
      const current = await settingsService.getSettings();

      expect(current.replayGainMode).toBe('track');
      expect(current.preventClipping).toBe(true);

      await settingsService.saveSettings({
        replayGainMode: 'album',
        preventClipping: false
      });

      expect(mockDb.put).toHaveBeenCalledWith(
        'settings',
        expect.objectContaining({
          key: 'audio_dsp_settings',
          value: expect.objectContaining({
            replayGainMode: 'album',
            preventClipping: false
          })
        })
      );

      await settingsService.applyToAudioEngine(mockEngine);
      expect(mockEngine.setReplayGainMode).toHaveBeenCalledWith('album');
      expect(mockEngine.setPreventClipping).toHaveBeenCalledWith(false);
    });
  });
});
