import type { IAudioEngine } from '../contracts/service-contracts';
import type { VisualizerAudioData } from './visualizer-types';

export interface AudioAnalyzerOptions {
  sensitivity?: number | undefined;
  smoothing?: number | undefined;
  beatIntensity?: number | undefined;
}

export class VisualizerAudioAnalyzer {
  private readonly audioEngine?: IAudioEngine | undefined;
  private customAnalyserNode?: AnalyserNode | undefined;

  // Reusable typed arrays for zero-allocation performance
  public static readonly BIN_COUNT = 128;
  private readonly rawFrequencyData = new Uint8Array(VisualizerAudioAnalyzer.BIN_COUNT);
  private readonly rawTimeDomainData = new Uint8Array(VisualizerAudioAnalyzer.BIN_COUNT);

  // Cached analysis structure
  private readonly currentAudioData: VisualizerAudioData = {
    rms: 0,
    bass: 0,
    mids: 0,
    treble: 0,
    energy: 0,
    spectralIntensity: 0,
    beatPulse: 0,
    smoothedAmplitude: 0,
    frequencyData: this.rawFrequencyData,
    timeDomainData: this.rawTimeDomainData
  };

  // Smoothing memory buffers
  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedTreble = 0;
  private smoothedEnergy = 0;
  private smoothedRms = 0;
  private beatEnergyHistory: number[] = new Array(30).fill(0);
  private beatHistoryIndex = 0;
  private beatPulse = 0;

  // Settings
  private sensitivity = 1.0;
  private smoothing = 0.75;
  private beatIntensity = 1.0;

  constructor(audioEngine?: IAudioEngine, options?: AudioAnalyzerOptions) {
    this.audioEngine = audioEngine;
    if (options) {
      if (options.sensitivity !== undefined) this.sensitivity = options.sensitivity;
      if (options.smoothing !== undefined) this.smoothing = options.smoothing;
      if (options.beatIntensity !== undefined) this.beatIntensity = options.beatIntensity;
    }
  }

  public setAnalyserNode(node: AnalyserNode): void {
    this.customAnalyserNode = node;
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0.1, Math.min(3.0, val));
  }

  public setSmoothing(val: number): void {
    this.smoothing = Math.max(0.0, Math.min(0.95, val));
  }

  public setBeatIntensity(val: number): void {
    this.beatIntensity = Math.max(0.1, Math.min(2.5, val));
  }

  /**
   * Samples the audio engine and updates normalized metrics for current frame.
   * Zero allocation in the hot loop.
   */
  public update(deltaTimeSec: number = 0.016): VisualizerAudioData {
    let hasData = false;

    if (this.customAnalyserNode) {
      this.customAnalyserNode.getByteFrequencyData(this.rawFrequencyData);
      this.customAnalyserNode.getByteTimeDomainData(this.rawTimeDomainData);
      hasData = true;
    } else if (this.audioEngine) {
      try {
        const metrics = this.audioEngine.getAnalysisMetrics();
        if (metrics && metrics.frequencyData && metrics.timeDomainData) {
          const len = Math.min(VisualizerAudioAnalyzer.BIN_COUNT, metrics.frequencyData.length);
          for (let i = 0; i < len; i++) {
            this.rawFrequencyData[i] = metrics.frequencyData[i]!;
            this.rawTimeDomainData[i] = metrics.timeDomainData[i]!;
          }
          hasData = true;
        }
      } catch (_e) {
        hasData = false;
      }
    }

    if (!hasData) {
      this.decayValues(deltaTimeSec);
      return this.currentAudioData;
    }

    // 1. Compute RMS & Peak from Time Domain Data
    let sumSquares = 0;
    const len = this.rawTimeDomainData.length;
    for (let i = 0; i < len; i++) {
      const sample = (this.rawTimeDomainData[i]! - 128) / 128.0;
      sumSquares += sample * sample;
    }
    const rawRms = Math.sqrt(sumSquares / (len || 1));

    // 2. Compute Frequency Bands
    // Bass: bins 0..12 (~20Hz - 250Hz)
    // Mids: bins 13..64 (~250Hz - 4kHz)
    // Treble: bins 65..127 (~4kHz - 16kHz+)
    let bassSum = 0;
    let midsSum = 0;
    let trebleSum = 0;
    let totalEnergySum = 0;

    for (let i = 0; i < 13; i++) {
      bassSum += this.rawFrequencyData[i]!;
    }
    for (let i = 13; i < 65; i++) {
      midsSum += this.rawFrequencyData[i]!;
    }
    for (let i = 65; i < 128; i++) {
      trebleSum += this.rawFrequencyData[i]!;
    }
    for (let i = 0; i < 128; i++) {
      totalEnergySum += this.rawFrequencyData[i]!;
    }

    const rawBass = (bassSum / (13 * 255.0)) * this.sensitivity;
    const rawMids = (midsSum / (52 * 255.0)) * this.sensitivity;
    const rawTreble = (trebleSum / (63 * 255.0)) * this.sensitivity;
    const rawEnergy = (totalEnergySum / (128 * 255.0)) * this.sensitivity;

    // 3. Exponential Smoothing
    const smoothFactor = this.smoothing;
    const alpha = 1.0 - smoothFactor;

    this.smoothedBass = this.smoothedBass * smoothFactor + rawBass * alpha;
    this.smoothedMids = this.smoothedMids * smoothFactor + rawMids * alpha;
    this.smoothedTreble = this.smoothedTreble * smoothFactor + rawTreble * alpha;
    this.smoothedEnergy = this.smoothedEnergy * smoothFactor + rawEnergy * alpha;
    this.smoothedRms = this.smoothedRms * smoothFactor + (rawRms * this.sensitivity) * alpha;

    // 4. Beat Detection & Transient Pulse
    // Track short term moving average of bass + energy
    const instantBeatEnergy = rawBass * 1.5 + rawEnergy * 0.5;
    let historySum = 0;
    for (let i = 0; i < this.beatEnergyHistory.length; i++) {
      historySum += this.beatEnergyHistory[i]!;
    }
    const averageBeatEnergy = historySum / this.beatEnergyHistory.length;
    this.beatEnergyHistory[this.beatHistoryIndex] = instantBeatEnergy;
    this.beatHistoryIndex = (this.beatHistoryIndex + 1) % this.beatEnergyHistory.length;

    // Trigger pulse on sudden onset above moving threshold
    const beatThreshold = Math.max(0.12, averageBeatEnergy * 1.35);
    if (instantBeatEnergy > beatThreshold && instantBeatEnergy > 0.15) {
      const impulse = Math.min(1.0, (instantBeatEnergy - beatThreshold) * 2.5 * this.beatIntensity);
      this.beatPulse = Math.max(this.beatPulse, impulse);
    }

    // Decay beat pulse smoothly with time
    const decayRate = Math.exp(-deltaTimeSec * 6.0); // ~150ms half-life
    this.beatPulse *= decayRate;

    // 5. Spectral Intensity (high frequency concentration)
    const spectralIntensity = Math.min(1.0, (this.smoothedTreble / (this.smoothedEnergy + 0.001)) * 0.5);

    // Populate current audio data object
    this.currentAudioData.rms = Math.min(1.0, this.smoothedRms);
    this.currentAudioData.bass = Math.min(1.0, this.smoothedBass);
    this.currentAudioData.mids = Math.min(1.0, this.smoothedMids);
    this.currentAudioData.treble = Math.min(1.0, this.smoothedTreble);
    this.currentAudioData.energy = Math.min(1.0, this.smoothedEnergy);
    this.currentAudioData.spectralIntensity = Math.min(1.0, spectralIntensity);
    this.currentAudioData.beatPulse = Math.min(1.0, this.beatPulse);
    this.currentAudioData.smoothedAmplitude = Math.min(1.0, (this.smoothedBass + this.smoothedMids) * 0.5);

    return this.currentAudioData;
  }

  private decayValues(deltaTimeSec: number): void {
    const decayRate = Math.exp(-deltaTimeSec * 4.0);
    this.smoothedBass *= decayRate;
    this.smoothedMids *= decayRate;
    this.smoothedTreble *= decayRate;
    this.smoothedEnergy *= decayRate;
    this.smoothedRms *= decayRate;
    this.beatPulse *= decayRate;

    this.currentAudioData.rms = this.smoothedRms;
    this.currentAudioData.bass = this.smoothedBass;
    this.currentAudioData.mids = this.smoothedMids;
    this.currentAudioData.treble = this.smoothedTreble;
    this.currentAudioData.energy = this.smoothedEnergy;
    this.currentAudioData.spectralIntensity = 0;
    this.currentAudioData.beatPulse = this.beatPulse;
    this.currentAudioData.smoothedAmplitude = this.smoothedRms;

    this.rawFrequencyData.fill(0);
    this.rawTimeDomainData.fill(128);
  }
}
