import { EQUALIZER_ISO_FREQUENCIES, type AudioAnalysisMetrics, type DspPipelineOptions, type ReplayGainMode } from './audio-types';
import type { ReplayGainData } from '../../domain/value-objects/audio-types';

/**
 * Web Audio DSP Pipeline.
 * Manages the audio processing chain:
 * Source -> Preamp/ReplayGain -> 10-Band EQ Cascade -> Balance -> Limiter -> Master Gain -> Analyser -> Destination
 */
export class DspPipeline {
  private readonly context: AudioContext;
  private readonly inputNode: GainNode;
  private readonly preampNode: GainNode;
  private readonly eqFilters: BiquadFilterNode[] = [];
  private readonly balanceNode: StereoPannerNode | null = null;
  private readonly limiterNode: DynamicsCompressorNode;
  private readonly masterGainNode: GainNode;
  private readonly analyserNode: AnalyserNode;

  private isEqEnabled = true;
  private eqGainsDb: number[] = new Array(10).fill(0);
  private preampGainDb = 0;
  private replayGainDb = 0;
  private replayGainMode: ReplayGainMode = 'track';
  private preventClipping = true;
  private currentReplayGainData: ReplayGainData | null = null;
  private balanceValue = 0;
  private masterVolumeValue = 1.0;
  private isMutedValue = false;
  private isLimiterEnabled = true;

  constructor(context: AudioContext) {
    this.context = context;

    // 1. Input entry point
    this.inputNode = context.createGain();

    // 2. Preamp & ReplayGain gain stage
    this.preampNode = context.createGain();
    this.inputNode.connect(this.preampNode);

    // 3. 10-Band ISO EQ Cascade
    let previousNode: AudioNode = this.preampNode;
    for (let i = 0; i < EQUALIZER_ISO_FREQUENCIES.length; i++) {
      const freq = EQUALIZER_ISO_FREQUENCIES[i]!;
      const filter = context.createBiquadFilter();

      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === EQUALIZER_ISO_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.414; // Standard ~1 octave bandwidth
      }

      filter.frequency.value = freq;
      filter.gain.value = 0;

      previousNode.connect(filter);
      this.eqFilters.push(filter);
      previousNode = filter;
    }

    // 4. Stereo Balance Panner (if supported by browser/context)
    if (typeof context.createStereoPanner === 'function') {
      try {
        this.balanceNode = context.createStereoPanner();
        this.balanceNode.pan.value = 0;
        previousNode.connect(this.balanceNode);
        previousNode = this.balanceNode;
      } catch {
        this.balanceNode = null;
      }
    }

    // 5. Brickwall Safety Limiter (DynamicsCompressorNode)
    this.limiterNode = context.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.5; // -0.5 dB
    this.limiterNode.knee.value = 0.0; // Hard knee
    this.limiterNode.ratio.value = 20.0; // 20:1 Brickwall ratio
    this.limiterNode.attack.value = 0.003; // 3ms fast attack
    this.limiterNode.release.value = 0.05; // 50ms fast release

    previousNode.connect(this.limiterNode);

    // 6. Master Volume
    this.masterGainNode = context.createGain();
    this.masterGainNode.gain.value = 1.0;
    this.limiterNode.connect(this.masterGainNode);

    // 7. Passive Analyser
    this.analyserNode = context.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.masterGainNode.connect(this.analyserNode);

    // 8. Output to Destination
    this.analyserNode.connect(context.destination);
  }

  /**
   * The entry AudioNode for external sources to connect to.
   */
  public getInputNode(): AudioNode {
    return this.inputNode;
  }

  /**
   * Set Master Volume [0.0, 1.0]
   */
  public setVolume(volume: number): void {
    const clamped = Math.max(0.0, Math.min(1.0, isNaN(volume) ? 1.0 : volume));
    this.masterVolumeValue = clamped;
    this.updateMasterGain();
  }

  public getVolume(): number {
    return this.masterVolumeValue;
  }

  /**
   * Set Mute State
   */
  public setMuted(muted: boolean): void {
    this.isMutedValue = muted;
    this.updateMasterGain();
  }

  public isMuted(): boolean {
    return this.isMutedValue;
  }

  private updateMasterGain(): void {
    const targetGain = this.isMutedValue ? 0.0 : this.masterVolumeValue;
    this.masterGainNode.gain.setValueAtTime(targetGain, this.context.currentTime);
  }

  /**
   * Set Preamp Gain in dB [-12, +12]
   */
  public setPreampGain(gainDb: number): void {
    const clamped = Math.max(-12.0, Math.min(12.0, isNaN(gainDb) ? 0.0 : gainDb));
    this.preampGainDb = clamped;
    this.updatePreampStage();
  }

  public getPreampGain(): number {
    return this.preampGainDb;
  }

  /**
   * Apply ReplayGain metadata for currently playing track.
   */
  public setReplayGainData(data: ReplayGainData | null): void {
    this.currentReplayGainData = data;
    this.recomputeReplayGain();
  }

  /**
   * Set ReplayGain Mode ('off' | 'track' | 'album')
   */
  public setReplayGainMode(mode: ReplayGainMode): void {
    this.replayGainMode = mode;
    this.recomputeReplayGain();
  }

  /**
   * Set Prevent Clipping / Peak Limiting Safety toggle
   */
  public setPreventClipping(enabled: boolean): void {
    this.preventClipping = enabled;
    this.updatePreampStage();
  }

  private recomputeReplayGain(): void {
    let targetGainDb = 0;

    if (this.replayGainMode !== 'off' && this.currentReplayGainData) {
      const data = this.currentReplayGainData;
      const isValid = (v?: number) => typeof v === 'number' && !isNaN(v) && isFinite(v);

      if (this.replayGainMode === 'album') {
        if (isValid(data.albumGainDb)) {
          targetGainDb = data.albumGainDb!;
        } else if (isValid(data.trackGainDb)) {
          targetGainDb = data.trackGainDb!;
        }
      } else if (this.replayGainMode === 'track') {
        if (isValid(data.trackGainDb)) {
          targetGainDb = data.trackGainDb!;
        } else if (isValid(data.albumGainDb)) {
          targetGainDb = data.albumGainDb!;
        }
      }
    }

    if (isNaN(targetGainDb) || !isFinite(targetGainDb)) {
      targetGainDb = 0;
    }

    // Clamp gainDb to safe bounds [-24.0, +15.0]
    this.replayGainDb = Math.max(-24.0, Math.min(15.0, targetGainDb));
    this.updatePreampStage();
  }

  private updatePreampStage(): void {
    // Total stage gain = Preamp dB + ReplayGain dB
    const totalGainDb = this.preampGainDb + this.replayGainDb;
    // Linear gain = 10^(dB / 20)
    let linearGain = Math.pow(10, totalGainDb / 20);

    // Guard against NaN or non-finite or negative values
    if (isNaN(linearGain) || !isFinite(linearGain) || linearGain < 0) {
      linearGain = 1.0;
    }

    // Safety peak clamp if peak is defined and preventClipping is active
    if (this.preventClipping && this.currentReplayGainData && this.replayGainMode !== 'off') {
      const data = this.currentReplayGainData;
      const isValidPeak = (p?: number) => typeof p === 'number' && !isNaN(p) && isFinite(p) && p > 0;

      let peak: number | undefined;
      if (this.replayGainMode === 'album') {
        peak = isValidPeak(data.albumPeak) ? data.albumPeak : (isValidPeak(data.trackPeak) ? data.trackPeak : undefined);
      } else {
        peak = isValidPeak(data.trackPeak) ? data.trackPeak : (isValidPeak(data.albumPeak) ? data.albumPeak : undefined);
      }

      if (peak !== undefined && peak > 0 && linearGain * peak > 1.0) {
        linearGain = 1.0 / peak;
      }
    }

    // Upper bound clamp to prevent uncontrolled positive amplification
    linearGain = Math.min(linearGain, 4.0);

    this.preampNode.gain.setValueAtTime(linearGain, this.context.currentTime);
  }

  /**
   * Set Equalizer Enable/Disable
   */
  public setEqualizerEnabled(enabled: boolean): void {
    this.isEqEnabled = enabled;
    this.updateEqFilters();
  }

  public getEqualizerEnabled(): boolean {
    return this.isEqEnabled;
  }

  /**
   * Set individual band gain in dB [-12, +12]
   */
  public setEqualizerBandGain(bandIndex: number, gainDb: number): void {
    if (bandIndex < 0 || bandIndex >= this.eqFilters.length) {
      return;
    }
    const clamped = Math.max(-12.0, Math.min(12.0, isNaN(gainDb) ? 0.0 : gainDb));
    this.eqGainsDb[bandIndex] = clamped;
    this.updateEqFilters();
  }

  /**
   * Set all 10 EQ band gains
   */
  public setEqualizerBands(gainsDb: readonly number[]): void {
    for (let i = 0; i < this.eqFilters.length; i++) {
      const val = gainsDb[i];
      if (typeof val === 'number') {
        this.eqGainsDb[i] = Math.max(-12.0, Math.min(12.0, isNaN(val) ? 0.0 : val));
      }
    }
    this.updateEqFilters();
  }

  public getEqualizerBands(): readonly number[] {
    return [...this.eqGainsDb];
  }

  private updateEqFilters(): void {
    for (let i = 0; i < this.eqFilters.length; i++) {
      const filter = this.eqFilters[i]!;
      const targetGain = this.isEqEnabled ? (this.eqGainsDb[i] ?? 0) : 0;
      filter.gain.setValueAtTime(targetGain, this.context.currentTime);
    }
  }

  /**
   * Set Stereo Balance [-1.0 (Left), +1.0 (Right)]
   */
  public setBalance(balance: number): void {
    const clamped = Math.max(-1.0, Math.min(1.0, isNaN(balance) ? 0.0 : balance));
    this.balanceValue = clamped;
    if (this.balanceNode) {
      this.balanceNode.pan.setValueAtTime(clamped, this.context.currentTime);
    }
  }

  public getBalance(): number {
    return this.balanceValue;
  }

  /**
   * Enable/Disable Limiter
   */
  public setLimiterEnabled(enabled: boolean): void {
    this.isLimiterEnabled = enabled;
    // When disabled, configure threshold high with 1:1 ratio (transparent)
    if (enabled) {
      this.limiterNode.threshold.setValueAtTime(-0.5, this.context.currentTime);
      this.limiterNode.ratio.setValueAtTime(20.0, this.context.currentTime);
    } else {
      this.limiterNode.threshold.setValueAtTime(0.0, this.context.currentTime);
      this.limiterNode.ratio.setValueAtTime(1.0, this.context.currentTime);
    }
  }

  public getLimiterEnabled(): boolean {
    return this.isLimiterEnabled;
  }

  /**
   * Extract audio analysis metrics (frequency & time-domain).
   */
  public getAnalysisMetrics(): AudioAnalysisMetrics {
    const binCount = this.analyserNode.frequencyBinCount;
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(binCount);

    this.analyserNode.getByteFrequencyData(freqData);
    this.analyserNode.getByteTimeDomainData(timeData);

    // Compute RMS and Peak from time domain
    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < timeData.length; i++) {
      // Normalize [0, 255] to [-1.0, 1.0]
      const sample = (timeData[i]! - 128) / 128.0;
      const abs = Math.abs(sample);
      if (abs > peak) {
        peak = abs;
      }
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / timeData.length);

    return {
      rms,
      peak,
      frequencyData: freqData,
      timeDomainData: timeData
    };
  }

  public getOptions(): DspPipelineOptions {
    return {
      equalizerEnabled: this.isEqEnabled,
      equalizerBands: [...this.eqGainsDb],
      replayGainMode: this.replayGainMode,
      preventClipping: this.preventClipping,
      preampGainDb: this.preampGainDb,
      balance: this.balanceValue,
      limiterEnabled: this.isLimiterEnabled,
      masterVolume: this.masterVolumeValue,
      isMuted: this.isMutedValue
    };
  }

  public getEffectiveReplayGainDb(): number {
    return this.replayGainDb;
  }

  public getEffectiveLinearGain(): number {
    return this.preampNode.gain.value;
  }

  public getAnalyserNode(): AnalyserNode {
    return this.analyserNode;
  }

  /**
   * Dispose and disconnect nodes cleanly.
   */
  public dispose(): void {
    try {
      this.inputNode.disconnect();
      this.preampNode.disconnect();
      for (const filter of this.eqFilters) {
        filter.disconnect();
      }
      if (this.balanceNode) {
        this.balanceNode.disconnect();
      }
      this.limiterNode.disconnect();
      this.masterGainNode.disconnect();
      this.analyserNode.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
  }
}
