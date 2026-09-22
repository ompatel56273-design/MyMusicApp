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
  private sourceNodeA: MediaElementAudioSourceNode | null = null;
  private sourceNodeB: MediaElementAudioSourceNode | null = null;
  private gainNodeA: GainNode | null = null;
  private gainNodeB: GainNode | null = null;

  private currentObjectUrl: string | null = null;
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

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

    // Channel B (for crossfading)
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
      this.bindElementEvents(this.audioElementA, 'A');
      this.bindElementEvents(this.audioElementB, 'B');
    } catch (err) {
      this.logger.warn('Direct createMediaElementSource failed or already connected:', { error: String(err) });
      this.activeElement = this.audioElementA;
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
  }

  public stop(): void {
    if (this.activeElement) {
      this.activeElement.pause();
      this.activeElement.currentTime = 0;
    }
  }

  public seek(timeSec: number): void {
    if (!this.activeElement) return;

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
