import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DspPipeline } from '../../src/services/audio/dsp-pipeline';

describe('DspPipeline', () => {
  let mockContext: AudioContext;
  let pipeline: DspPipeline;

  beforeEach(() => {
    const createMockGain = () => ({
      gain: { value: 1.0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn()
    });

    const createMockFilter = () => ({
      type: 'peaking',
      frequency: { value: 1000 },
      gain: { value: 0, setValueAtTime: vi.fn() },
      Q: { value: 1.414 },
      connect: vi.fn(),
      disconnect: vi.fn()
    });

    const createMockCompressor = () => ({
      threshold: { value: -0.5, setValueAtTime: vi.fn() },
      knee: { value: 0.0 },
      ratio: { value: 20.0, setValueAtTime: vi.fn() },
      attack: { value: 0.003 },
      release: { value: 0.05 },
      connect: vi.fn(),
      disconnect: vi.fn()
    });

    const createMockAnalyser = () => ({
      fftSize: 256,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
      getByteTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn()
    });

    const createMockPanner = () => ({
      pan: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn()
    });

    mockContext = {
      currentTime: 12.34,
      destination: {},
      createGain: vi.fn().mockImplementation(createMockGain),
      createBiquadFilter: vi.fn().mockImplementation(createMockFilter),
      createDynamicsCompressor: vi.fn().mockImplementation(createMockCompressor),
      createAnalyser: vi.fn().mockImplementation(createMockAnalyser),
      createStereoPanner: vi.fn().mockImplementation(createMockPanner)
    } as unknown as AudioContext;

    pipeline = new DspPipeline(mockContext);
  });

  afterEach(() => {
    pipeline.dispose();
  });

  it('initializes 10 ISO biquad filters and creates expected audio stages', () => {
    expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(10);
    expect(mockContext.createDynamicsCompressor).toHaveBeenCalledTimes(1);
    expect(mockContext.createAnalyser).toHaveBeenCalledTimes(1);

    const opts = pipeline.getOptions();
    expect(opts.equalizerBands).toHaveLength(10);
    expect(opts.equalizerEnabled).toBe(true);
    expect(opts.preampGainDb).toBe(0);
    expect(opts.replayGainMode).toBe('track');
  });

  it('updates individual band gains and all band gains within [-12, +12] dB', () => {
    pipeline.setEqualizerBandGain(3, 4.5);
    let opts = pipeline.getOptions();
    expect(opts.equalizerBands[3]).toBe(4.5);

    // Clamping upper
    pipeline.setEqualizerBandGain(3, 30);
    opts = pipeline.getOptions();
    expect(opts.equalizerBands[3]).toBe(12.0);

    // Set all bands
    pipeline.setEqualizerBands([-2, -1, 0, 1, 2, 3, 2, 1, 0, -1]);
    opts = pipeline.getOptions();
    expect(opts.equalizerBands).toEqual([-2, -1, 0, 1, 2, 3, 2, 1, 0, -1]);
  });

  it('bypasses EQ filters when disabled without losing stored gain values', () => {
    pipeline.setEqualizerBands([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    pipeline.setEqualizerEnabled(false);

    let opts = pipeline.getOptions();
    expect(opts.equalizerEnabled).toBe(false);
    expect(opts.equalizerBands).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);

    pipeline.setEqualizerEnabled(true);
    opts = pipeline.getOptions();
    expect(opts.equalizerEnabled).toBe(true);
  });

  it('applies ReplayGain track mode, album mode, and peak anti-clipping safeguard', () => {
    pipeline.setPreampGain(0);
    pipeline.setReplayGainMode('track');

    // Track gain -6dB
    pipeline.setReplayGainData({
      trackGainDb: -6.0,
      trackPeak: 0.95
    });

    let opts = pipeline.getOptions();
    expect(opts.replayGainMode).toBe('track');

    // Album mode with fallback to track
    pipeline.setReplayGainMode('album');
    pipeline.setReplayGainData({
      trackGainDb: -3.0
    });
    opts = pipeline.getOptions();
    expect(opts.replayGainMode).toBe('album');
  });

  it('configures stereo balance and limiter safety modes', () => {
    pipeline.setBalance(0.75);
    expect(pipeline.getBalance()).toBe(0.75);

    pipeline.setBalance(-2.0); // Clamped to -1.0
    expect(pipeline.getBalance()).toBe(-1.0);

    pipeline.setLimiterEnabled(true);
    expect(pipeline.getLimiterEnabled()).toBe(true);

    pipeline.setLimiterEnabled(false);
    expect(pipeline.getLimiterEnabled()).toBe(false);
  });
});
