import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from '../../src/services/audio/audio-engine';

describe('AudioEngine', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    // Setup mock HTMLMediaElement & AudioContext in jsdom/node
    const mockAudio = {
      src: '',
      paused: true,
      ended: false,
      currentTime: 0,
      duration: 180,
      volume: 1,
      playbackRate: 1,
      preload: 'auto',
      crossOrigin: 'anonymous',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(function (this: any) { this.paused = true; }),
      load: vi.fn()
    };

    if (typeof document === 'undefined') {
      (globalThis as any).document = {
        createElement: vi.fn(() => mockAudio)
      };
    } else {
      vi.spyOn(document, 'createElement').mockReturnValue(mockAudio as any);
    }

    const mockContext = {
      state: 'running',
      sampleRate: 48000,
      currentTime: 0,
      destination: {},
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() }
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

    (globalThis as any).AudioContext = vi.fn(() => mockContext);
    (globalThis as any).window = {
      AudioContext: (globalThis as any).AudioContext,
      URL: {
        createObjectURL: vi.fn(() => 'blob:http://localhost/test-uuid'),
        revokeObjectURL: vi.fn()
      }
    };
    (globalThis as any).URL = (globalThis as any).window.URL;

    audioEngine = new AudioEngine();
  });

  it('should initialize context and report sample rate', () => {
    const ctx = audioEngine.ensureContext();
    expect(ctx).toBeDefined();
    expect(audioEngine.sampleRate).toBe(48000);
  });

  it('should handle play, pause, seek, and volume control', async () => {
    audioEngine.ensureContext();
    await expect(audioEngine.play()).resolves.toBeUndefined();

    audioEngine.pause();
    expect(audioEngine.currentTime).toBe(0);

    audioEngine.seek(45.5);
    audioEngine.setGain(0.85);
    audioEngine.setPlaybackRate(1.25);
  });

  it('should load buffer from Blob and revoke previous Object URLs', async () => {
    const blob1 = new Blob(['audio-data-1'], { type: 'audio/mp3' });
    const blob2 = new Blob(['audio-data-2'], { type: 'audio/mp3' });

    // Mock canplay trigger
    const createElementSpy = vi.spyOn(document, 'createElement');
    let canPlayCb: any;
    createElementSpy.mockImplementation(() => {
      const el: any = {
        src: '',
        paused: true,
        duration: 120,
        addEventListener: (event: string, cb: any) => {
          if (event === 'canplay') canPlayCb = cb;
        },
        removeEventListener: vi.fn(),
        load: () => {
          if (canPlayCb) canPlayCb();
        },
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      };
      return el;
    });

    const engine = new AudioEngine();
    await engine.loadBuffer(blob1);
    expect(URL.createObjectURL).toHaveBeenCalled();

    await engine.loadBuffer(blob2);
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    engine.dispose();
  });
});
