import { describe, it, expect, vi } from 'vitest';
import { VisualizerEngine } from '../../src/services/visualizer/visualizer-engine';

describe('VisualizerEngine', () => {
  it('initializes with default configuration', () => {
    const engine = new VisualizerEngine();
    const config = engine.getConfig();

    expect(config.fpsLimit).toBe(60);
    expect(config.sensitivity).toBe(1.0);
    expect(config.smoothing).toBe(0.75);
    expect(config.beatIntensity).toBe(1.0);
    expect(config.presetId).toBe('neon-nebula');
  });

  it('updates configuration dynamically', () => {
    const engine = new VisualizerEngine();

    engine.updateConfig({
      fpsLimit: 120,
      sensitivity: 2.5,
      smoothing: 0.5,
      beatIntensity: 1.8,
      reducedMotion: true
    });

    const config = engine.getConfig();
    expect(config.fpsLimit).toBe(120);
    expect(config.sensitivity).toBe(2.5);
    expect(config.smoothing).toBe(0.5);
    expect(config.beatIntensity).toBe(1.8);
    expect(config.reducedMotion).toBe(true);
  });

  it('cycles through available presets in order', () => {
    const engine = new VisualizerEngine();
    const initialPreset = engine.getConfig().presetId;

    const nextPreset1 = engine.cycleNextPreset();
    expect(nextPreset1).not.toBe(initialPreset);

    const nextPreset2 = engine.cycleNextPreset();
    expect(nextPreset2).not.toBe(nextPreset1);
  });

  it('triggers fallback callback when canvas has no WebGL 2.0 context', () => {
    const fallbackFn = vi.fn();
    const engine = new VisualizerEngine({
      onFallback: fallbackFn
    });

    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(null),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as any;

    const attached = engine.attachCanvas(mockCanvas);
    expect(attached).toBe(false);
    expect(fallbackFn).toHaveBeenCalled();
  });

  it('handles pause and resume cleanly', () => {
    const engine = new VisualizerEngine();
    expect(() => {
      engine.setPaused(true);
      engine.setPaused(false);
      engine.stop();
      engine.dispose();
    }).not.toThrow();
  });
});
