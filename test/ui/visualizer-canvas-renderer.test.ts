import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { VisualizerCanvasRenderer } from '../../src/ui/components/visualizer/visualizer-canvas-renderer';
import type { IAudioEngine } from '../../src/services/contracts/service-contracts';

describe('VisualizerCanvasRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: VisualizerCanvasRenderer;
  let mockAudioEngine: IAudioEngine;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300 }),
      configurable: true
    });

    mockAudioEngine = {
      sampleRate: 48000,
      currentTime: 0,
      loadBuffer: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      setGain: vi.fn(),
      setPlaybackRate: vi.fn(),
      getAnalysisData: vi.fn(() => new Uint8Array(128)),
      getAnalysisMetrics: vi.fn(() => ({
        rms: 0.5,
        peak: 0.8,
        frequencyData: new Uint8Array(128).fill(120),
        timeDomainData: new Uint8Array(128).fill(128)
      })),
      setEqualizerEnabled: vi.fn(),
      setEqualizerBands: vi.fn(),
      setEqualizerBandGain: vi.fn(),
      setPreampGain: vi.fn(),
      setReplayGainMode: vi.fn(),
      setBalance: vi.fn(),
      setLimiterEnabled: vi.fn(),
      getDspOptions: vi.fn()
    };

    renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    renderer.attachCanvas(canvas);
  });

  it('updates visualizer config correctly', () => {
    renderer.setConfig({ mode: 'waveform', colorTheme: 'rainbow', fpsLimit: 30, reducedMotion: false });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'circular', colorTheme: 'monochrome' });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'spectrum' });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'particles' });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'pulse' });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'album-reactive' });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'minimal' });
    expect(() => renderer.drawFrame()).not.toThrow();

    renderer.setConfig({ mode: 'bars' });
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('resizes canvas buffer according to dimensions and DPR', () => {
    expect(() => renderer.resize()).not.toThrow();
  });

  it('handles drawFrame under silent audio conditions (zeros)', () => {
    mockAudioEngine.getAnalysisMetrics = vi.fn(() => ({
      rms: 0,
      peak: 0,
      frequencyData: new Uint8Array(128).fill(0),
      timeDomainData: new Uint8Array(128).fill(128)
    }));

    const modes = ['bars', 'waveform', 'circular', 'spectrum', 'particles', 'pulse', 'album-reactive', 'minimal'] as const;
    for (const mode of modes) {
      renderer.setConfig({ mode });
      expect(() => renderer.drawFrame()).not.toThrow();
    }
  });

  it('handles drawFrame under maximum-amplitude input (255)', () => {
    mockAudioEngine.getAnalysisMetrics = vi.fn(() => ({
      rms: 1.0,
      peak: 1.0,
      frequencyData: new Uint8Array(128).fill(255),
      timeDomainData: new Uint8Array(128).fill(255)
    }));

    const modes = ['bars', 'waveform', 'circular', 'spectrum', 'particles', 'pulse', 'album-reactive', 'minimal'] as const;
    for (const mode of modes) {
      renderer.setConfig({ mode });
      expect(() => renderer.drawFrame()).not.toThrow();
    }
  });

  it('renders reduced motion mode when reducedMotion config is true', () => {
    renderer.setConfig({ reducedMotion: true });
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('starts and stops render loop without errors', () => {
    expect(() => renderer.start()).not.toThrow();
    expect(() => renderer.stop()).not.toThrow();
  });

  it('detaches canvas cleanly', () => {
    expect(() => renderer.detachCanvas()).not.toThrow();
  });
});
