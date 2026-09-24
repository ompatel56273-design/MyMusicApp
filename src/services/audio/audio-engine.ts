import { AudioEngineError } from '../../core/errors/app-error';
import { Logger } from '../../core/logging/logger';
import { DspPipeline } from './dsp-pipeline';
import type { IAudioEngine } from '../contracts/service-contracts';
import type { ReplayGainData } from '../../domain/value-objects/audio-types';

export interface AudioEngineCallbacks {
  onTimeUpdate?: (currentTimeSec: number, durationSec: number) => void;
  onEnded?: () => void;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (error: AudioEngineError) => void;
  onStateChange?: (isPlaying: boolean) => void;
}

/**
 * Concrete Audio Engine implementing IAudioEngine.
 * Connects streaming HTMLAudioElement decoding with Web Audio DSP pipeline.
 * Manages AudioContext lifecycle, crossfade, seeking, and object URL cleanup.
 */
export class AudioEngine implements IAudioEngine {
  private readonly logger = new Logger('AudioEngine');
  private context: AudioContext | null = null;
  private dspPipeline: DspPipeline | null = null;

  private audioElementA: HTMLAudioElement | null = null;
  private audioElementB: HTMLAudioElement | null = null;
  private activeElement: HTMLAudioElement | null = null;
  private activeChannel: 'A' | 'B' = 'A';
  private sourceNodeA: MediaElementAudioSourceNode | null = null;
  private sourceNodeB: MediaElementAudioSourceNode | null = null;
  private gainNodeA: GainNode | null = null;
  private gainNodeB: GainNode | null = null;

  private currentObjectUrl: string | null = null;
  private standbyObjectUrl: string | null = null;
  private standbyOptions: { replayGain?: ReplayGainData | undefined } | null = null;
  private standbyGeneration = 0;
  private isStandbyPrepared = false;

  private isCrossfadingActive = false;
  private crossfadeTimeoutId: any = null;
  private crossfadeOldElement: HTMLAudioElement | null = null;
  private crossfadeOldObjectUrl: string | null = null;
  private crossfadeConfig = { enabled: false, durationSec: 3 };

  private callbacks: AudioEngineCallbacks = {};
  private currentGeneration = 0;
  private isDisposed = false;

  constructor(callbacks?: AudioEngineCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: AudioEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initializes the AudioContext and DSP graph on demand (first user gesture).
   */
  public ensureContext(): AudioContext {
    if (this.context && this.context.state !== 'closed') {
      return this.context;
    }

    const AudioContextClass =
      (typeof window !== 'undefined' ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined) ||
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new AudioEngineError('Web Audio API is not supported in this runtime environment.', 'WEB_AUDIO_UNSUPPORTED');
    }

    this.context = new AudioContextClass();
    this.dspPipeline = new DspPipeline(this.context);
    this.initAudioElements();

    this.logger.info(`AudioContext initialized (SampleRate: ${this.context.sampleRate}Hz, State: ${this.context.state})`);
    return this.context;
  }

  private initAudioElements(): void {
    if (!this.context || !this.dspPipeline) return;

    if (typeof document === 'undefined') return;

    // Channel A
    this.audioElementA = document.createElement('audio');
    this.audioElementA.preload = 'auto';
    this.audioElementA.crossOrigin = 'anonymous';

    // Channel B (for gapless / crossfading)
    this.audioElementB = document.createElement('audio');
    this.audioElementB.preload = 'auto';
    this.audioElementB.crossOrigin = 'anonymous';

    try {
      this.sourceNodeA = this.context.createMediaElementSource(this.audioElementA);
      this.sourceNodeB = this.context.createMediaElementSource(this.audioElementB);

      this.gainNodeA = this.context.createGain();
      this.gainNodeB = this.context.createGain();

      this.gainNodeA.gain.value = 1.0;
      this.gainNodeB.gain.value = 0.0;

      this.sourceNodeA.connect(this.gainNodeA);
      this.sourceNodeB.connect(this.gainNodeB);

      this.gainNodeA.connect(this.dspPipeline.getInputNode());
      this.gainNodeB.connect(this.dspPipeline.getInputNode());

      this.activeElement = this.audioElementA;
      this.activeChannel = 'A';
      this.bindElementEvents(this.audioElementA, 'A');
      this.bindElementEvents(this.audioElementB, 'B');
    } catch (err) {
      this.logger.warn('Direct createMediaElementSource failed or already connected:', { error: String(err) });
      this.activeElement = this.audioElementA;
      this.activeChannel = 'A';
    }
  }

  private bindElementEvents(element: HTMLAudioElement, channel: 'A' | 'B'): void {
    element.addEventListener('timeupdate', () => {
      if (this.activeElement === element && !this.isDisposed) {
        this.callbacks.onTimeUpdate?.(element.currentTime, element.duration || 0);
      }
    });

    element.addEventListener('ended', () => {
      if (this.activeElement === element && !this.isDisposed) {
        this.callbacks.onEnded?.();
      }
    });

    element.addEventListener('waiting', () => {
      if (this.activeElement === element && !this.isDisposed) {
        this.callbacks.onBuffering?.(true);
      }
    });

    element.addEventListener('playing', () => {
      if (this.activeElement === element && !this.isDisposed) {
        this.callbacks.onBuffering?.(false);
        this.callbacks.onStateChange?.(true);
      }
    });

    element.addEventListener('pause', () => {
      if (this.activeElement === element && !this.isDisposed) {
        this.callbacks.onStateChange?.(false);
      }
    });

    element.addEventListener('error', () => {
      if (this.activeElement === element && !this.isDisposed) {
        const mediaError = element.error;
        const msg = mediaError ? `HTMLAudioElement error code ${mediaError.code}: ${mediaError.message}` : 'Audio playback error';
        this.callbacks.onError?.(new AudioEngineError(msg, 'MEDIA_ELEMENT_ERROR', { channel, code: mediaError?.code }));
      }
    });
  }

  public get sampleRate(): number {
    return this.context ? this.context.sampleRate : 44100;
  }

  public get currentTime(): number {
    return this.activeElement ? this.activeElement.currentTime : 0;
  }

  public get duration(): number {
    return this.activeElement && !isNaN(this.activeElement.duration) ? this.activeElement.duration : 0;
  }

  public get isPlaying(): boolean {
    return this.activeElement ? !this.activeElement.paused && !this.activeElement.ended : false;
  }

  public getDspPipeline(): DspPipeline | null {
    return this.dspPipeline;
  }

  /**
   * Loads a media source (URL string or Blob) into the audio engine.
   */
  public async loadBuffer(urlOrBlob: string | Blob, options?: { replayGain?: ReplayGainData | undefined }): Promise<void> {
    const generation = ++this.currentGeneration;
    this.ensureContext();

    // Cancel any active crossfade and pending standby preload
    this.cancelCrossfade();
    this.cancelPreload();

    // Revoke previous blob Object URL
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    let targetUrl: string;
    if (urlOrBlob instanceof Blob) {
      this.currentObjectUrl = URL.createObjectURL(urlOrBlob);
      targetUrl = this.currentObjectUrl;
    } else {
      targetUrl = urlOrBlob;
    }

    if (!this.activeElement) {
      throw new AudioEngineError('No active audio element available.', 'NO_AUDIO_ELEMENT');
    }

    // Ensure active channel gain is 1.0 and standby channel gain is 0.0
    const activeGain = this.activeChannel === 'A' ? this.gainNodeA : this.gainNodeB;
    const standbyGain = this.activeChannel === 'A' ? this.gainNodeB : this.gainNodeA;
    if (activeGain && this.context) {
      if (typeof activeGain.gain.cancelScheduledValues === 'function') {
        activeGain.gain.cancelScheduledValues(this.context.currentTime);
      }
      if (typeof activeGain.gain.setValueAtTime === 'function') {
        activeGain.gain.setValueAtTime(1.0, this.context.currentTime);
      } else {
        activeGain.gain.value = 1.0;
      }
    } else if (activeGain) {
      activeGain.gain.value = 1.0;
    }
    if (standbyGain && this.context) {
      if (typeof standbyGain.gain.cancelScheduledValues === 'function') {
        standbyGain.gain.cancelScheduledValues(this.context.currentTime);
      }
      if (typeof standbyGain.gain.setValueAtTime === 'function') {
        standbyGain.gain.setValueAtTime(0.0, this.context.currentTime);
      } else {
        standbyGain.gain.value = 0.0;
      }
    } else if (standbyGain) {
      standbyGain.gain.value = 0.0;
    }

    if (this.dspPipeline) {
      this.dspPipeline.setReplayGainData(options?.replayGain ?? null);
    }

    const element = this.activeElement;
    element.src = targetUrl;

    return new Promise<void>((resolve, reject) => {
      const onCanPlay = () => {
        cleanup();
        if (generation === this.currentGeneration) {
          resolve();
        }
      };

      const onError = () => {
        cleanup();
        if (generation === this.currentGeneration) {
          reject(new AudioEngineError('Failed to load audio stream.', 'LOAD_FAILED'));
        }
      };

      const cleanup = () => {
        element.removeEventListener('canplay', onCanPlay);
        element.removeEventListener('error', onError);
      };

      element.addEventListener('canplay', onCanPlay);
      element.addEventListener('error', onError);
      element.load();
    });
  }

  /**
   * Pre-buffers the next track in the standby channel without playing it.
   */
  public async prepareNext(urlOrBlob: string | Blob, options?: { replayGain?: ReplayGainData | undefined }): Promise<void> {
    const generation = ++this.standbyGeneration;
    this.ensureContext();

    if (this.standbyObjectUrl) {
      URL.revokeObjectURL(this.standbyObjectUrl);
      this.standbyObjectUrl = null;
    }

    const standbyElement = this.activeChannel === 'A' ? this.audioElementB : this.audioElementA;
    const standbyGain = this.activeChannel === 'A' ? this.gainNodeB : this.gainNodeA;

    if (!standbyElement) {
      throw new AudioEngineError('Standby audio element unavailable for preload.', 'NO_AUDIO_ELEMENT');
    }

    // Ensure standby channel is silent during preparation
    if (standbyGain && this.context) {
      standbyGain.gain.setValueAtTime(0.0, this.context.currentTime);
    } else if (standbyGain) {
      standbyGain.gain.value = 0.0;
    }

    let targetUrl: string;
    if (urlOrBlob instanceof Blob) {
      this.standbyObjectUrl = URL.createObjectURL(urlOrBlob);
      targetUrl = this.standbyObjectUrl;
    } else {
      targetUrl = urlOrBlob;
    }

    this.standbyOptions = options ?? null;
    this.isStandbyPrepared = false;
    standbyElement.src = targetUrl;

    return new Promise<void>((resolve, reject) => {
      const onCanPlay = () => {
        cleanup();
        if (generation === this.standbyGeneration) {
          this.isStandbyPrepared = true;
          this.logger.debug('Standby track prepared for gapless playback.');
          resolve();
        }
      };

      const onError = () => {
        cleanup();
        if (generation === this.standbyGeneration) {
          this.isStandbyPrepared = false;
          if (this.standbyObjectUrl) {
            URL.revokeObjectURL(this.standbyObjectUrl);
            this.standbyObjectUrl = null;
          }
          reject(new AudioEngineError('Failed to preload next audio stream.', 'PRELOAD_FAILED'));
        }
      };

      const cleanup = () => {
        standbyElement.removeEventListener('canplay', onCanPlay);
        standbyElement.removeEventListener('error', onError);
      };

      standbyElement.addEventListener('canplay', onCanPlay);
      standbyElement.addEventListener('error', onError);
      standbyElement.load();
    });
  }

  /**
   * Checks whether a standby track is prepared and ready for instantaneous playback.
   */
  public hasPreparedNext(): boolean {
    return this.isStandbyPrepared && !this.isDisposed;
  }

  /**
   * Cancels in-flight preloading and cleans up standby resources.
   */
  public cancelPreload(): void {
    this.standbyGeneration++;
    this.isStandbyPrepared = false;
    this.standbyOptions = null;

    if (this.standbyObjectUrl) {
      URL.revokeObjectURL(this.standbyObjectUrl);
      this.standbyObjectUrl = null;
    }

    const standbyElement = this.activeChannel === 'A' ? this.audioElementB : this.audioElementA;
    if (standbyElement) {
      standbyElement.pause();
      standbyElement.src = '';
    }
  }

  /**
   * Atomically transitions playback to the pre-buffered standby channel.
   */
  public async transitionToNext(): Promise<void> {
    if (!this.isStandbyPrepared || !this.context) {
      throw new AudioEngineError('No prepared track to transition to.', 'NO_PREPARED_TRACK');
    }

    const oldActiveElement = this.activeElement;
    const oldObjectUrl = this.currentObjectUrl;
    const oldChannel = this.activeChannel;

    const newChannel: 'A' | 'B' = oldChannel === 'A' ? 'B' : 'A';
    const newActiveElement = newChannel === 'A' ? this.audioElementA : this.audioElementB;
    const oldGain = oldChannel === 'A' ? this.gainNodeA : this.gainNodeB;
    const newGain = newChannel === 'A' ? this.gainNodeA : this.gainNodeB;

    if (!newActiveElement) {
      throw new AudioEngineError('Standby audio element unavailable.', 'NO_AUDIO_ELEMENT');
    }

    // Apply ReplayGain to DSP pipeline for the incoming track
    if (this.dspPipeline) {
      this.dspPipeline.setReplayGainData(this.standbyOptions?.replayGain ?? null);
    }

    // Set Web Audio gain parameters seamlessly
    const now = this.context.currentTime;
    if (oldGain) {
      oldGain.gain.setValueAtTime(0.0, now);
    }
    if (newGain) {
      newGain.gain.setValueAtTime(1.0, now);
    }

    // Flip active element and channel
    this.activeElement = newActiveElement;
    this.activeChannel = newChannel;
    this.currentObjectUrl = this.standbyObjectUrl;
    this.standbyObjectUrl = null;
    this.isStandbyPrepared = false;
    this.standbyOptions = null;

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (err) {
        this.logger.warn('AudioContext resume failed during transition:', { error: String(err) });
      }
    }

    try {
      await this.activeElement.play();
    } catch (err) {
      throw new AudioEngineError('Gapless transition playback failed.', 'PLAY_FAILED', undefined, err as Error);
    }

    // Clean up old active element & object URL
    if (oldActiveElement) {
      oldActiveElement.pause();
      oldActiveElement.src = '';
    }
    if (oldObjectUrl) {
      URL.revokeObjectURL(oldObjectUrl);
    }

    this.logger.debug(`Seamlessly transitioned playback to Channel ${newChannel}.`);
  }

  public get isCrossfading(): boolean {
    return this.isCrossfadingActive;
  }

  public setCrossfade(enabled: boolean, durationSec = 3): void {
    this.crossfadeConfig = {
      enabled,
      durationSec: Math.max(1.0, Math.min(12.0, durationSec))
    };
  }

  /**
   * Starts a smooth Web Audio gain ramp crossfade into the prepared standby channel.
   */
  public async startCrossfadeToNext(durationSec?: number): Promise<void> {
    if (!this.isStandbyPrepared || !this.context) {
      throw new AudioEngineError('No prepared track to crossfade to.', 'NO_PREPARED_TRACK');
    }

    // Cancel previous crossfade if still pending
    this.cancelCrossfade();

    const oldActiveElement = this.activeElement;
    const oldObjectUrl = this.currentObjectUrl;
    const oldChannel = this.activeChannel;

    const newChannel: 'A' | 'B' = oldChannel === 'A' ? 'B' : 'A';
    const newActiveElement = newChannel === 'A' ? this.audioElementA : this.audioElementB;
    const oldGain = oldChannel === 'A' ? this.gainNodeA : this.gainNodeB;
    const newGain = newChannel === 'A' ? this.gainNodeA : this.gainNodeB;

    if (!newActiveElement) {
      throw new AudioEngineError('Standby audio element unavailable.', 'NO_AUDIO_ELEMENT');
    }

    const D = Math.max(0.5, Math.min(12.0, durationSec ?? this.crossfadeConfig.durationSec));

    // Apply ReplayGain to DSP pipeline for the incoming track
    if (this.dspPipeline) {
      this.dspPipeline.setReplayGainData(this.standbyOptions?.replayGain ?? null);
    }

    // Schedule linear gain ramps across AudioContext timeline
    const now = this.context.currentTime;
    if (oldGain) {
      if (typeof oldGain.gain.cancelScheduledValues === 'function') {
        oldGain.gain.cancelScheduledValues(now);
      }
      if (typeof oldGain.gain.setValueAtTime === 'function') {
        oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      }
      if (typeof oldGain.gain.linearRampToValueAtTime === 'function') {
        oldGain.gain.linearRampToValueAtTime(0.0, now + D);
      } else {
        oldGain.gain.value = 0.0;
      }
    }
    if (newGain) {
      if (typeof newGain.gain.cancelScheduledValues === 'function') {
        newGain.gain.cancelScheduledValues(now);
      }
      if (typeof newGain.gain.setValueAtTime === 'function') {
        newGain.gain.setValueAtTime(0.0, now);
      }
      if (typeof newGain.gain.linearRampToValueAtTime === 'function') {
        newGain.gain.linearRampToValueAtTime(1.0, now + D);
      } else {
        newGain.gain.value = 1.0;
      }
    }

    // Flip active channel & element
    this.activeElement = newActiveElement;
    this.activeChannel = newChannel;
    this.currentObjectUrl = this.standbyObjectUrl;
    this.standbyObjectUrl = null;
    this.isStandbyPrepared = false;
    this.standbyOptions = null;
    this.isCrossfadingActive = true;
    this.crossfadeOldElement = oldActiveElement;
    this.crossfadeOldObjectUrl = oldObjectUrl;

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (err) {
        this.logger.warn('AudioContext resume failed during crossfade:', { error: String(err) });
      }
    }

    try {
      await this.activeElement.play();
    } catch (err) {
      this.cancelCrossfade();
      throw new AudioEngineError('Crossfade transition playback failed.', 'PLAY_FAILED', undefined, err as Error);
    }

    // Schedule cleanup of the faded-out track once ramp completes
    const timeoutMs = Math.round(D * 1000) + 50;
    this.crossfadeTimeoutId = setTimeout(() => {
      this.completeCrossfade();
    }, timeoutMs);

    this.logger.debug(`Initiated crossfade (${D}s) to Channel ${newChannel}.`);
  }

  /**
   * Completes the crossfade by tearing down the previous channel resources.
   */
  private completeCrossfade(): void {
    if (this.crossfadeTimeoutId) {
      clearTimeout(this.crossfadeTimeoutId);
      this.crossfadeTimeoutId = null;
    }

    if (this.crossfadeOldElement) {
      this.crossfadeOldElement.pause();
      this.crossfadeOldElement.src = '';
      this.crossfadeOldElement = null;
    }

    if (this.crossfadeOldObjectUrl) {
      URL.revokeObjectURL(this.crossfadeOldObjectUrl);
      this.crossfadeOldObjectUrl = null;
    }

    if (this.context) {
      const activeGain = this.activeChannel === 'A' ? this.gainNodeA : this.gainNodeB;
      const standbyGain = this.activeChannel === 'A' ? this.gainNodeB : this.gainNodeA;
      if (activeGain) {
        if (typeof activeGain.gain.cancelScheduledValues === 'function') {
          activeGain.gain.cancelScheduledValues(this.context.currentTime);
        }
        if (typeof activeGain.gain.setValueAtTime === 'function') {
          activeGain.gain.setValueAtTime(1.0, this.context.currentTime);
        } else {
          activeGain.gain.value = 1.0;
        }
      }
      if (standbyGain) {
        if (typeof standbyGain.gain.cancelScheduledValues === 'function') {
          standbyGain.gain.cancelScheduledValues(this.context.currentTime);
        }
        if (typeof standbyGain.gain.setValueAtTime === 'function') {
          standbyGain.gain.setValueAtTime(0.0, this.context.currentTime);
        } else {
          standbyGain.gain.value = 0.0;
        }
      }
    }

    this.isCrossfadingActive = false;
  }

  /**
   * Cancels in-flight crossfade, resets audio gains, and purges faded element.
   */
  public cancelCrossfade(): void {
    if (this.crossfadeTimeoutId) {
      clearTimeout(this.crossfadeTimeoutId);
      this.crossfadeTimeoutId = null;
    }

    if (this.context) {
      if (this.gainNodeA) {
        if (typeof this.gainNodeA.gain.cancelScheduledValues === 'function') {
          this.gainNodeA.gain.cancelScheduledValues(this.context.currentTime);
        }
        if (typeof this.gainNodeA.gain.setValueAtTime === 'function') {
          this.gainNodeA.gain.setValueAtTime(this.activeChannel === 'A' ? 1.0 : 0.0, this.context.currentTime);
        } else {
          this.gainNodeA.gain.value = this.activeChannel === 'A' ? 1.0 : 0.0;
        }
      }
      if (this.gainNodeB) {
        if (typeof this.gainNodeB.gain.cancelScheduledValues === 'function') {
          this.gainNodeB.gain.cancelScheduledValues(this.context.currentTime);
        }
        if (typeof this.gainNodeB.gain.setValueAtTime === 'function') {
          this.gainNodeB.gain.setValueAtTime(this.activeChannel === 'B' ? 1.0 : 0.0, this.context.currentTime);
        } else {
          this.gainNodeB.gain.value = this.activeChannel === 'B' ? 1.0 : 0.0;
        }
      }
    }

    if (this.crossfadeOldElement) {
      this.crossfadeOldElement.pause();
      this.crossfadeOldElement.src = '';
      this.crossfadeOldElement = null;
    }

    if (this.crossfadeOldObjectUrl) {
      URL.revokeObjectURL(this.crossfadeOldObjectUrl);
      this.crossfadeOldObjectUrl = null;
    }

    this.isCrossfadingActive = false;
  }

  public async play(): Promise<void> {
    if (!this.activeElement) return;

    if (this.context && this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (err) {
        this.logger.warn('AudioContext resume failed (user gesture required):', { error: String(err) });
      }
    }

    try {
      await this.activeElement.play();
    } catch (err) {
      throw new AudioEngineError('Playback was prevented by browser autoplay policy or decode failure.', 'PLAY_FAILED', undefined, err as Error);
    }
  }

  public pause(): void {
    if (this.activeElement && !this.activeElement.paused) {
      this.activeElement.pause();
    }
    if (this.crossfadeOldElement && !this.crossfadeOldElement.paused) {
      this.crossfadeOldElement.pause();
    }
  }

  public stop(): void {
    this.cancelCrossfade();
    if (this.activeElement) {
      this.activeElement.pause();
      this.activeElement.currentTime = 0;
    }
  }

  public seek(timeSec: number): void {
    if (!this.activeElement) return;
    this.cancelCrossfade();

    const maxDuration = isNaN(this.activeElement.duration) ? Infinity : this.activeElement.duration;
    const clamped = Math.max(0, Math.min(maxDuration, isNaN(timeSec) ? 0 : timeSec));
    this.activeElement.currentTime = clamped;
  }

  public setGain(gain: number): void {
    if (this.dspPipeline) {
      this.dspPipeline.setVolume(gain);
    } else if (this.activeElement) {
      this.activeElement.volume = Math.max(0, Math.min(1, gain));
    }
  }

  public setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.25, Math.min(4.0, isNaN(rate) ? 1.0 : rate));
    if (this.audioElementA) this.audioElementA.playbackRate = clamped;
    if (this.audioElementB) this.audioElementB.playbackRate = clamped;
  }

  public getAnalysisData(): Uint8Array {
    if (this.dspPipeline) {
      return this.dspPipeline.getAnalysisMetrics().frequencyData;
    }
    return new Uint8Array(128);
  }

  public getAnalysisMetrics(): import('./audio-types').AudioAnalysisMetrics {
    if (this.dspPipeline) {
      return this.dspPipeline.getAnalysisMetrics();
    }
    return {
      rms: 0,
      peak: 0,
      frequencyData: new Uint8Array(128),
      timeDomainData: new Uint8Array(128).fill(128)
    };
  }

  // Phase 12 DSP Controls
  public setEqualizerEnabled(enabled: boolean): void {
    if (this.dspPipeline) {
      this.dspPipeline.setEqualizerEnabled(enabled);
    }
  }

  public setEqualizerBands(gainsDb: readonly number[]): void {
    if (this.dspPipeline) {
      this.dspPipeline.setEqualizerBands(gainsDb);
    }
  }

  public setEqualizerBandGain(bandIndex: number, gainDb: number): void {
    if (this.dspPipeline) {
      this.dspPipeline.setEqualizerBandGain(bandIndex, gainDb);
    }
  }

  public setPreampGain(gainDb: number): void {
    if (this.dspPipeline) {
      this.dspPipeline.setPreampGain(gainDb);
    }
  }

  public setReplayGainMode(mode: import('./audio-types').ReplayGainMode): void {
    if (this.dspPipeline) {
      this.dspPipeline.setReplayGainMode(mode);
    }
  }

  public setBalance(balance: number): void {
    if (this.dspPipeline) {
      this.dspPipeline.setBalance(balance);
    }
  }

  public setLimiterEnabled(enabled: boolean): void {
    if (this.dspPipeline) {
      this.dspPipeline.setLimiterEnabled(enabled);
    }
  }

  public getDspOptions(): import('./audio-types').DspPipelineOptions {
    if (this.dspPipeline) {
      return this.dspPipeline.getOptions();
    }
    return {
      equalizerEnabled: true,
      equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      replayGainMode: 'track',
      preampGainDb: 0,
      balance: 0,
      limiterEnabled: true,
      masterVolume: 1.0,
      isMuted: false
    };
  }

  public dispose(): void {
    this.isDisposed = true;
    this.currentGeneration++;
    this.cancelPreload();

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    if (this.audioElementA) {
      this.audioElementA.pause();
      this.audioElementA.src = '';
    }
    if (this.audioElementB) {
      this.audioElementB.pause();
      this.audioElementB.src = '';
    }

    if (this.dspPipeline) {
      this.dspPipeline.dispose();
      this.dspPipeline = null;
    }

    if (this.context && this.context.state !== 'closed') {
      try {
        void this.context.close();
      } catch {
        // Ignore close error
      }
      this.context = null;
    }
  }
}
