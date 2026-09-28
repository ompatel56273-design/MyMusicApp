import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events/event-bus';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { AudioSettingsService } from '../../src/services/audio/audio-settings-service';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track } from '../../src/domain/entities/models';
import { DEFAULT_AUDIO_SETTINGS } from '../../src/domain/entities/audio-settings';

describe('Feature 4: Crossfade Playback Comprehensive Test Suite', () => {
  let eventBus: EventBus;
  let filesystem: VirtualFilesystemAdapter;
  let audioEngine: AudioEngine;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockQueueRepo: any;
  let mockHistoryRepo: any;
  let mockDbAdapter: any;
  let audioSettingsService: AudioSettingsService;
  let playbackManager: PlaybackManager;

  const trackA: Track = {
    id: 'track_A',
    fileId: 'file_A',
    title: 'Track A - Ambient Intro',
    artistName: 'Artist 1',
    durationMs: 180000, // 3 mins (180s)
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
    durationMs: 240000, // 4 mins (240s)
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
    durationMs: 120000, // 2 mins (120s)
    format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const shortTrack: Track = {
    id: 'track_short',
    fileId: 'file_short',
    title: 'Track Short Jingle',
    artistName: 'Artist 1',
    durationMs: 4000, // 4s
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  let mockAudioElements: any[] = [];
  let mockGainNodes: any[] = [];
  let audioContextCreatedCount = 0;

  beforeEach(() => {
    vi.useFakeTimers();

    eventBus = new EventBus();
    filesystem = new VirtualFilesystemAdapter();
    filesystem.addVirtualFile('C:/Music/track_A.flac', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/track_B.flac', 2048, Date.now(), new Uint8Array([4, 5, 6]));
    filesystem.addVirtualFile('C:/Music/track_C.flac', 3072, Date.now(), new Uint8Array([7, 8, 9]));
    filesystem.addVirtualFile('C:/Music/track_short.mp3', 512, Date.now(), new Uint8Array([10, 11, 12]));

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
          }),
          cancelScheduledValues: vi.fn()
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
        threshold: { value: -1 },
        knee: { value: 0 },
        ratio: { value: 20 },
        attack: { value: 0.001 },
        release: { value: 0.05 }
      })),
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        fftSize: 2048,
        frequencyBinCount: 1024,
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
    (globalThis as any).webkitAudioContext = (globalThis as any).AudioContext;

    (globalThis as any).URL = {
      createObjectURL: vi.fn((_blob: Blob) => `blob:mock-url-${Math.random()}`),
      revokeObjectURL: vi.fn()
    };

    mockTrackRepo = {
      getById: vi.fn(async (id: string) => {
        if (id === 'track_A') return { ...trackA };
        if (id === 'track_B') return { ...trackB };
        if (id === 'track_C') return { ...trackC };
        if (id === 'track_short') return { ...shortTrack };
        return null;
      }),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn(async (fileId: string) => {
        if (fileId === 'file_A') return { id: 'file_A', path: 'C:/Music/track_A.flac', availability: 'available' };
        if (fileId === 'file_B') return { id: 'file_B', path: 'C:/Music/track_B.flac', availability: 'available' };
        if (fileId === 'file_C') return { id: 'file_C', path: 'C:/Music/track_C.flac', availability: 'available' };
        if (fileId === 'file_short') return { id: 'file_short', path: 'C:/Music/track_short.mp3', availability: 'available' };
        return null;
      })
    };

    mockQueueRepo = {
      getQueue: vi.fn().mockResolvedValue([]),
      getQueueMetadata: vi.fn().mockResolvedValue(null),
      saveQueue: vi.fn().mockResolvedValue(undefined),
      saveQueueMetadata: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockHistoryRepo = {
      saveResumePosition: vi.fn().mockResolvedValue(undefined),
      getResumePosition: vi.fn().mockResolvedValue(null),
      addRecord: vi.fn().mockResolvedValue(undefined)
    };

    let savedDbSettings: any = null;
    mockDbAdapter = {
      get: vi.fn(async (_store: string, _key: string) => savedDbSettings),
      put: vi.fn(async (_store: string, val: any) => {
        savedDbSettings = val;
      })
    };

    audioEngine = new AudioEngine();
    audioSettingsService = new AudioSettingsService(mockDbAdapter);

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

  describe('1. Crossfade Settings & Persistence', () => {
    it('has correct defaults (disabled, 3 seconds)', () => {
      expect(DEFAULT_AUDIO_SETTINGS.crossfadeEnabled).toBe(false);
      expect(DEFAULT_AUDIO_SETTINGS.crossfadeDurationSec).toBe(3);
      expect(playbackManager.crossfadeEnabled).toBe(false);
      expect(playbackManager.crossfadeDurationSec).toBe(3);
    });

    it('persists crossfade settings and clamps duration to 1s-12s', async () => {
      // Clamps under 1 to 1
      await audioSettingsService.saveSettings({ crossfadeEnabled: true, crossfadeDurationSec: 0 });
      let settings = await audioSettingsService.getSettings();
      expect(settings.crossfadeEnabled).toBe(true);
      expect(settings.crossfadeDurationSec).toBe(1);

      // Clamps above 12 to 12
      await audioSettingsService.saveSettings({ crossfadeDurationSec: 25 });
      settings = await audioSettingsService.getSettings();
      expect(settings.crossfadeDurationSec).toBe(12);

      // Valid range
      await audioSettingsService.saveSettings({ crossfadeDurationSec: 5 });
      settings = await audioSettingsService.getSettings();
      expect(settings.crossfadeDurationSec).toBe(5);
    });

    it('applies crossfade settings to AudioEngine and PlaybackManager', async () => {
      await audioSettingsService.saveSettings({ crossfadeEnabled: true, crossfadeDurationSec: 4 });
      await audioSettingsService.applyToAudioEngine(audioEngine);
      playbackManager.setCrossfade(true, 4);

      expect(playbackManager.crossfadeEnabled).toBe(true);
      expect(playbackManager.crossfadeDurationSec).toBe(4);
      expect(audioEngine.isCrossfading).toBe(false);
    });
  });

  describe('2. AudioEngine Gain Ramping & Channel Swapping', () => {
    it('schedules linear ramps and swaps channels during crossfade', async () => {
      const blobA = new Blob([new Uint8Array([1, 2])], { type: 'audio/flac' });
      const blobB = new Blob([new Uint8Array([3, 4])], { type: 'audio/flac' });

      await audioEngine.loadBuffer(blobA);
      await audioEngine.play();
      await audioEngine.prepareNext(blobB);

      expect(audioEngine.hasPreparedNext()).toBe(true);
      expect(audioEngine.isCrossfading).toBe(false);

      await audioEngine.startCrossfadeToNext(4.0);
      expect(audioEngine.isCrossfading).toBe(true);

      // Verify gain ramps were scheduled on gainNodeA and gainNodeB
      const gainA = (audioEngine as any).gainNodeA;
      const gainB = (audioEngine as any).gainNodeB;

      expect(gainA.gain.setValueAtTime).toHaveBeenCalled();
      expect(gainA.gain.linearRampToValueAtTime).toHaveBeenCalled();
      expect(gainB.gain.setValueAtTime).toHaveBeenCalled();
      expect(gainB.gain.linearRampToValueAtTime).toHaveBeenCalled();

      // Fast-forward time to complete the crossfade ramp (duration 4000ms + 50ms buffer)
      vi.advanceTimersByTime(4100);

      expect(audioEngine.isCrossfading).toBe(false);
      expect(audioEngine.hasPreparedNext()).toBe(false);
    });

    it('cancels scheduled ramps and resets gain values on cancelCrossfade', async () => {
      const blobA = new Blob([new Uint8Array([1, 2])], { type: 'audio/flac' });
      const blobB = new Blob([new Uint8Array([3, 4])], { type: 'audio/flac' });

      await audioEngine.loadBuffer(blobA);
      await audioEngine.play();
      await audioEngine.prepareNext(blobB);

      void audioEngine.startCrossfadeToNext(4.0);
      expect(audioEngine.isCrossfading).toBe(true);

      audioEngine.cancelCrossfade();
      expect(audioEngine.isCrossfading).toBe(false);

      const gainA = (audioEngine as any).gainNodeA;
      const gainB = (audioEngine as any).gainNodeB;

      expect(gainA.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(gainB.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(gainA.gain.setValueAtTime).toHaveBeenCalled();
      expect(gainB.gain.setValueAtTime).toHaveBeenCalled();
    });

    it('maintains single AudioContext across transitions', async () => {
      const blobA = new Blob([new Uint8Array([1, 2])], { type: 'audio/flac' });
      const blobB = new Blob([new Uint8Array([3, 4])], { type: 'audio/flac' });

      await audioEngine.loadBuffer(blobA);
      await audioEngine.prepareNext(blobB);
      void audioEngine.startCrossfadeToNext(3.0);
      vi.advanceTimersByTime(3000);

      expect(audioContextCreatedCount).toBe(1);
    });
  });

  describe('3. PlaybackManager Crossfade Progression & History', () => {
    it('triggers crossfade when remaining time <= crossfade duration', async () => {
      playbackManager.setCrossfade(true, 4);

      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await vi.runAllTimersAsync();

      const trackChangedEvents: any[] = [];
      eventBus.subscribe(DomainEvents.TRACK_CHANGED, (evt) => {
        trackChangedEvents.push(evt);
      });

      // Track A duration: 180s. At 170s, remaining time = 10s (> 4s). Crossfade not triggered.
      (audioEngine as any).callbacks?.onTimeUpdate?.(170, 180);
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_A');
      expect(playbackManager.currentQueueIndex).toBe(0);

      // At 176s, remaining time = 4s (<= 4s). Crossfade triggers!
      (audioEngine as any).callbacks?.onTimeUpdate?.(176, 180);
      await vi.runAllTimersAsync();

      // Queue state advances to track B immediately on crossfade start
      expect(playbackManager.currentTrack?.id).toBe('track_B');
      expect(playbackManager.currentQueueIndex).toBe(1);
      expect(trackChangedEvents.length).toBe(1);
      expect(trackChangedEvents[0].currentTrack.id).toBe('track_B');
      expect(trackChangedEvents[0].previousTrack.id).toBe('track_A');

      // Old track A finishes playback tail (onEnded fires from old element)
      (audioEngine as any).callbacks?.onEnded?.();
      await vi.runAllTimersAsync();

      // Does NOT double-advance queue
      expect(playbackManager.currentTrack?.id).toBe('track_B');
      expect(playbackManager.currentQueueIndex).toBe(1);
    });

    it('records listening history and play count for the outgoing track', async () => {
      playbackManager.setCrossfade(true, 3);
      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await vi.runAllTimersAsync();

      // Advance virtual timer and listen for 40s (> 30s threshold)
      vi.advanceTimersByTime(40000);
      (audioEngine as any).callbacks?.onTimeUpdate?.(40, 180);
      await vi.runAllTimersAsync();

      // Trigger crossfade at 178s
      vi.advanceTimersByTime(138000);
      (audioEngine as any).callbacks?.onTimeUpdate?.(178, 180);
      await vi.runAllTimersAsync();

      expect(mockHistoryRepo.addRecord).toHaveBeenCalled();
      expect(mockTrackRepo.incrementPlayCount).toHaveBeenCalledWith('track_A', expect.any(Number));
    });
  });

  describe('4. Short-Track Clamping (Deff = min(D, Tdur / 2))', () => {
    it('clamps crossfade duration to half of short track duration', async () => {
      playbackManager.setCrossfade(true, 6); // 6s configured
      await playbackManager.playTrack(shortTrack, [shortTrack, trackB]); // shortTrack is 4s long
      await vi.runAllTimersAsync();

      // Effective duration = min(6, 4 / 2) = 2s
      // At 1.5s (remaining 2.5s > 2s), crossfade not triggered
      (audioEngine as any).callbacks?.onTimeUpdate?.(1.5, 4.0);
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_short');

      // At 2.0s (remaining 2.0s <= 2s), crossfade triggers
      (audioEngine as any).callbacks?.onTimeUpdate?.(2.0, 4.0);
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_B');
    });
  });

  describe('5. Manual Controls & Cancellation Safety', () => {
    it('cancels crossfade on manual pause', async () => {
      playbackManager.setCrossfade(true, 4);
      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await vi.runAllTimersAsync();

      // Trigger crossfade
      (audioEngine as any).callbacks?.onTimeUpdate?.(177, 180);
      await vi.runAllTimersAsync();

      // Manual pause during crossfade
      await playbackManager.pause();
      expect(playbackManager.state).toBe('paused');
      expect(audioEngine.isCrossfading).toBe(false);
    });

    it('cancels crossfade and preload on seek', async () => {
      playbackManager.setCrossfade(true, 4);
      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await vi.runAllTimersAsync();

      // Seek back to 50s
      await playbackManager.seek(50000);
      expect(playbackManager.positionMs).toBe(50000);
      expect(audioEngine.isCrossfading).toBe(false);
    });

    it('cancels crossfade on manual next and previous', async () => {
      playbackManager.setCrossfade(true, 4);
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await vi.runAllTimersAsync();

      await playbackManager.next();
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_B');
      expect(audioEngine.isCrossfading).toBe(false);

      await playbackManager.previous();
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_A');
      expect(audioEngine.isCrossfading).toBe(false);
    });

    it('cancels preload and crossfade on queue modifications', async () => {
      playbackManager.setCrossfade(true, 4);
      await playbackManager.playTrack(trackA, [trackA, trackB, trackC]);
      await vi.runAllTimersAsync();

      await playbackManager.removeFromQueue(1);
      expect(audioEngine.isCrossfading).toBe(false);

      await playbackManager.reorderQueue(0, 1);
      expect(audioEngine.isCrossfading).toBe(false);

      await playbackManager.clearQueue();
      expect(audioEngine.isCrossfading).toBe(false);
    });
  });

  describe('6. Gapless and Crossfade Coexistence', () => {
    it('performs Gapless transition when crossfade is disabled', async () => {
      playbackManager.setCrossfade(false);
      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await vi.runAllTimersAsync();

      // At near end of track (179s), crossfade does NOT trigger
      (audioEngine as any).callbacks?.onTimeUpdate?.(179, 180);
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_A');

      // When track finishes naturally, gapless transition happens
      const transitionSpy = vi.spyOn(audioEngine, 'transitionToNext');
      (audioEngine as any).callbacks?.onEnded?.();
      await vi.runAllTimersAsync();

      expect(transitionSpy).toHaveBeenCalled();
      expect(playbackManager.currentTrack?.id).toBe('track_B');
    });

    it('performs Crossfade transition when crossfade is enabled', async () => {
      playbackManager.setCrossfade(true, 3);
      await playbackManager.playTrack(trackA, [trackA, trackB]);
      await vi.runAllTimersAsync();

      const crossfadeSpy = vi.spyOn(audioEngine, 'startCrossfadeToNext');

      // Crossfade triggers at 177s (remaining 3s)
      (audioEngine as any).callbacks?.onTimeUpdate?.(177, 180);
      await vi.runAllTimersAsync();

      expect(crossfadeSpy).toHaveBeenCalledWith(3);
      expect(playbackManager.currentTrack?.id).toBe('track_B');
    });
  });

  describe('7. Repeat Modes, Shuffle, and Queue Bounds', () => {
    it('crossfades back to first track in Repeat ALL mode', async () => {
      playbackManager.setCrossfade(true, 3);
      playbackManager.setRepeatMode('all');

      await playbackManager.playTrack(trackB, [trackA, trackB]); // trackB is last track (index 1)
      await vi.runAllTimersAsync();

      // Crossfade triggers at 237s (remaining 3s)
      (audioEngine as any).callbacks?.onTimeUpdate?.(237, 240);
      await vi.runAllTimersAsync();

      // Loops around to track A
      expect(playbackManager.currentTrack?.id).toBe('track_A');
      expect(playbackManager.currentQueueIndex).toBe(0);
    });

    it('stops at end of queue without crossfade when Repeat is OFF', async () => {
      playbackManager.setCrossfade(true, 3);
      playbackManager.setRepeatMode('off');

      await playbackManager.playTrack(trackB, [trackA, trackB]); // trackB is last track
      await vi.runAllTimersAsync();

      // No next track to preload
      expect(audioEngine.hasPreparedNext()).toBe(false);

      // Timeupdate at end does not trigger crossfade
      (audioEngine as any).callbacks?.onTimeUpdate?.(237, 240);
      await vi.runAllTimersAsync();
      expect(playbackManager.currentTrack?.id).toBe('track_B');

      // Track ends naturally -> stops
      (audioEngine as any).callbacks?.onEnded?.();
      await vi.runAllTimersAsync();
      expect(playbackManager.state).toBe('stopped');
    });
  });
});
