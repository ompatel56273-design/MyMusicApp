import { describe, it, expect, vi } from 'vitest';
import { VisualizerAudioAnalyzer } from '../../src/services/visualizer/visualizer-audio-analyzer';
import type { IAudioEngine } from '../../src/services/contracts/service-contracts';

describe('VisualizerAudioAnalyzer', () => {
  const createMockEngine = (freqFill = 100, timeFill = 128): IAudioEngine => {
    const freq = new Uint8Array(128).fill(freqFill);
    const time = new Uint8Array(128).fill(timeFill);
    return {
      getAnalysisMetrics: vi.fn().mockReturnValue({
        rms: 0.5,
        peak: 0.8,
        frequencyData: freq,
        timeDomainData: time
      })
    } as any;
  };

  it('normalizes frequency bands and energy accurately', () => {
    const mockEngine = createMockEngine(128, 128);
    const analyzer = new VisualizerAudioAnalyzer(mockEngine, {
      sensitivity: 1.0,
      smoothing: 0.0 // No smoothing to verify immediate calculation
    });

    const data = analyzer.update(0.016);
    expect(data.bass).toBeCloseTo(128 / 255.0, 2);
    expect(data.mids).toBeCloseTo(128 / 255.0, 2);
    expect(data.treble).toBeCloseTo(128 / 255.0, 2);
    expect(data.energy).toBeCloseTo(128 / 255.0, 2);
  });

  it('computes RMS amplitude from time-domain samples', () => {
    // Fill alternating min and max samples (0 and 255)
    const freq = new Uint8Array(128).fill(0);
    const time = new Uint8Array(128);
    for (let i = 0; i < 128; i++) {
      time[i] = i % 2 === 0 ? 0 : 255;
    }
    const mockEngine = {
      getAnalysisMetrics: vi.fn().mockReturnValue({
        rms: 1.0,
        peak: 1.0,
        frequencyData: freq,
        timeDomainData: time
      })
    } as any;

    const analyzer = new VisualizerAudioAnalyzer(mockEngine, {
      sensitivity: 1.0,
      smoothing: 0.0
    });

    const data = analyzer.update(0.016);
    expect(data.rms).toBeGreaterThan(0.9);
  });

  it('applies exponential smoothing across frames', () => {
    const mockEngine = createMockEngine(255, 128);
    const analyzer = new VisualizerAudioAnalyzer(mockEngine, {
      sensitivity: 1.0,
      smoothing: 0.8
    });

    // First frame with 0.8 smoothing
    const frame1 = analyzer.update(0.016);
    const initialEnergy = frame1.energy;
    expect(initialEnergy).toBeLessThan(1.0); // Smoothed from 0 towards 1.0

    // Next frame approaches 1.0 smoothly
    const frame2 = analyzer.update(0.016);
    expect(frame2.energy).toBeGreaterThan(initialEnergy);
  });

  it('scales response with sensitivity setting', () => {
    const mockEngine = createMockEngine(50, 128);
    const analyzer = new VisualizerAudioAnalyzer(mockEngine, {
      sensitivity: 1.0,
      smoothing: 0.0
    });

    const baseData = analyzer.update(0.016);
    const baseEnergy = baseData.energy;

    analyzer.setSensitivity(2.0);
    const boostedData = analyzer.update(0.016);
    expect(boostedData.energy).toBeCloseTo(baseEnergy * 2.0, 2);
  });

  it('detects beats on sudden energy rises and decays smoothly', () => {
    const mockEngine = createMockEngine(10, 128);
    const analyzer = new VisualizerAudioAnalyzer(mockEngine, {
      sensitivity: 1.0,
      smoothing: 0.0,
      beatIntensity: 1.5
    });

    // Establish baseline quiet history
    for (let i = 0; i < 30; i++) {
      analyzer.update(0.016);
    }

    // Sudden massive bass impulse
    const burstFreq = new Uint8Array(128).fill(255);
    (mockEngine.getAnalysisMetrics as any).mockReturnValue({
      rms: 0.9,
      peak: 1.0,
      frequencyData: burstFreq,
      timeDomainData: new Uint8Array(128).fill(128)
    });

    const burstData = analyzer.update(0.016);
    const burstPulse = burstData.beatPulse;
    expect(burstPulse).toBeGreaterThan(0.2);

    // Subsequent quiet frame decays the pulse
    (mockEngine.getAnalysisMetrics as any).mockReturnValue({
      rms: 0.0,
      peak: 0.0,
      frequencyData: new Uint8Array(128).fill(0),
      timeDomainData: new Uint8Array(128).fill(128)
    });

    const decayedData = analyzer.update(0.05);
    expect(decayedData.beatPulse).toBeLessThan(burstPulse);
  });

  it('gracefully handles quiet or missing audio signals without NaN', () => {
    const analyzer = new VisualizerAudioAnalyzer(undefined);
    const data = analyzer.update(0.016);

    expect(Number.isNaN(data.rms)).toBe(false);
    expect(Number.isNaN(data.bass)).toBe(false);
    expect(Number.isNaN(data.mids)).toBe(false);
    expect(Number.isNaN(data.treble)).toBe(false);
    expect(Number.isNaN(data.energy)).toBe(false);
    expect(Number.isNaN(data.beatPulse)).toBe(false);
    expect(data.energy).toBe(0);
  });
});
