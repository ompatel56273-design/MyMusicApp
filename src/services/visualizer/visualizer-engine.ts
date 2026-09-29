import { Logger } from '../../core/logging/logger';
import type { IAudioEngine } from '../contracts/service-contracts';
import {
  type VisualizerPreset,
  type VisualizerEngineConfig,
  type VisualizerRenderContext,
  DEFAULT_VISUALIZER_ENGINE_CONFIG
} from './visualizer-types';
import { VisualizerAudioAnalyzer } from './visualizer-audio-analyzer';
import { VisualizerPresetRegistry } from './visualizer-preset-registry';

export interface VisualizerEngineOptions {
  audioEngine?: IAudioEngine | undefined;
  analyserNode?: AnalyserNode | undefined;
  config?: Partial<VisualizerEngineConfig> | undefined;
  onFallback?: (reason: string) => void;
  onPresetChanged?: (presetId: string) => void;
}

export class VisualizerEngine {
  private readonly logger = new Logger('VisualizerEngine');
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;

  private readonly audioAnalyzer: VisualizerAudioAnalyzer;
  private readonly presetRegistry: VisualizerPresetRegistry;

  private activePreset: VisualizerPreset | null = null;
  private config: VisualizerEngineConfig = { ...DEFAULT_VISUALIZER_ENGINE_CONFIG };

  // Render loop state
  private isRunning = false;
  private isPaused = false;
  private animationFrameId: number | null = null;
  private lastFrameTimestamp = 0;
  private elapsedTimeSec = 0;

  // Context loss listeners
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: ((e: Event) => void) | null = null;
  private isContextLost = false;

  private readonly onFallbackCallback?: ((reason: string) => void) | undefined;
  private readonly onPresetChangedCallback?: ((presetId: string) => void) | undefined;

  constructor(options?: VisualizerEngineOptions) {
    this.presetRegistry = VisualizerPresetRegistry.getInstance();
    this.audioAnalyzer = new VisualizerAudioAnalyzer(options?.audioEngine, {
      sensitivity: options?.config?.sensitivity,
      smoothing: options?.config?.smoothing,
      beatIntensity: options?.config?.beatIntensity
    });

    if (options?.analyserNode) {
      this.audioAnalyzer.setAnalyserNode(options.analyserNode);
    }

    if (options?.config) {
      this.config = { ...this.config, ...options.config };
    }

    this.onFallbackCallback = options?.onFallback;
    this.onPresetChangedCallback = options?.onPresetChanged;
  }

  /**
   * Attaches a canvas element, creates WebGL 2.0 context, and initializes active preset.
   */
  public attachCanvas(canvas: HTMLCanvasElement): boolean {
    this.detachCanvas();

    this.canvas = canvas;

    // Detect WebGL 2.0
    try {
      this.gl = canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });
    } catch (err: any) {
      this.logger.error('Failed to obtain WebGL 2 context:', err);
      this.gl = null;
    }

    if (!this.gl) {
      const reason = 'WebGL 2.0 is not supported or enabled on this graphics hardware.';
      this.logger.warn(reason);
      if (this.onFallbackCallback) {
        this.onFallbackCallback(reason);
      }
      return false;
    }

    // Bind context loss events
    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      this.isContextLost = true;
      this.logger.warn('WebGL context lost event received.');
      if (this.onFallbackCallback) {
        this.onFallbackCallback('WebGL Graphics Context Lost.');
      }
    };

    this.contextRestoredHandler = () => {
      this.isContextLost = false;
      this.logger.info('WebGL context restored. Rebuilding visualizer shaders...');
      if (this.gl && this.activePreset) {
        this.activePreset.initialize(this.gl);
      }
      this.resize();
    };

    canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);

    this.resize();
    this.setPreset(this.config.presetId);

    return true;
  }

  public detachCanvas(): void {
    this.stop();

    if (this.canvas) {
      if (this.contextLostHandler) {
        this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
        this.contextLostHandler = null;
      }
      if (this.contextRestoredHandler) {
        this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
        this.contextRestoredHandler = null;
      }
    }

    if (this.gl && this.activePreset) {
      this.activePreset.dispose(this.gl);
      this.activePreset = null;
    }

    this.gl = null;
    this.canvas = null;
    this.isContextLost = false;
  }

  public setPreset(presetId: string): boolean {
    this.config.presetId = presetId;

    if (!this.gl) return false;

    // Dispose old preset
    if (this.activePreset) {
      this.activePreset.dispose(this.gl);
      this.activePreset = null;
    }

    const newPreset = this.presetRegistry.createPreset(presetId) || this.presetRegistry.createPreset('neon-nebula');
    if (!newPreset) return false;

    const ok = newPreset.initialize(this.gl);
    if (!ok) {
      this.logger.error(`Failed to initialize preset "${presetId}".`);
      return false;
    }

    this.activePreset = newPreset;
    if (this.canvas) {
      this.activePreset.resize(this.gl, this.canvas.width, this.canvas.height);
    }

    if (this.onPresetChangedCallback) {
      this.onPresetChangedCallback(presetId);
    }

    return true;
  }

  public cycleNextPreset(): string {
    const list = this.presetRegistry.listPresets();
    if (list.length === 0) return this.config.presetId;

    const currentIndex = list.findIndex(p => p.id === this.config.presetId);
    const nextIndex = (currentIndex + 1) % list.length;
    const nextPreset = list[nextIndex]!;
    this.setPreset(nextPreset.id);
    return nextPreset.id;
  }

  public updateConfig(partial: Partial<VisualizerEngineConfig>): void {
    this.config = { ...this.config, ...partial };

    if (partial.sensitivity !== undefined) {
      this.audioAnalyzer.setSensitivity(partial.sensitivity);
    }
    if (partial.smoothing !== undefined) {
      this.audioAnalyzer.setSmoothing(partial.smoothing);
    }
    if (partial.beatIntensity !== undefined) {
      this.audioAnalyzer.setBeatIntensity(partial.beatIntensity);
    }
    if (partial.presetId !== undefined && partial.presetId !== this.activePreset?.id) {
      this.setPreset(partial.presetId);
    }
  }

  public getConfig(): Readonly<VisualizerEngineConfig> {
    return this.config;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTimestamp = performance.now();
    this.tick(this.lastFrameTimestamp);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public resize(): void {
    if (!this.canvas || !this.gl) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.0) : 1;

    const physicalWidth = Math.floor(Math.max(rect.width, 100) * dpr);
    const physicalHeight = Math.floor(Math.max(rect.height, 100) * dpr);

    if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
      this.canvas.width = physicalWidth;
      this.canvas.height = physicalHeight;
      this.gl.viewport(0, 0, physicalWidth, physicalHeight);

      if (this.activePreset) {
        this.activePreset.resize(this.gl, physicalWidth, physicalHeight);
      }
    }
  }

  private tick = (timestamp: number): void => {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.tick);

    if (this.isContextLost || !this.gl || !this.canvas || !this.activePreset) {
      return;
    }

    // FPS Limiter Logic (30, 45, 60, 90, 120)
    const targetIntervalMs = 1000.0 / Math.max(15, this.config.fpsLimit);
    const elapsedSinceLast = timestamp - this.lastFrameTimestamp;

    if (elapsedSinceLast < targetIntervalMs - 1.5) {
      return; // Skip rendering this frame to maintain target FPS
    }

    const deltaTimeSec = Math.min(0.1, elapsedSinceLast / 1000.0);
    this.lastFrameTimestamp = timestamp;
    this.elapsedTimeSec += deltaTimeSec;

    // Sample audio
    const audioData = this.audioAnalyzer.update(deltaTimeSec);

    const renderContext: VisualizerRenderContext = {
      gl: this.gl,
      canvas: this.canvas,
      width: this.canvas.width,
      height: this.canvas.height,
      aspect: this.canvas.width / (this.canvas.height || 1),
      time: this.elapsedTimeSec,
      deltaTime: deltaTimeSec,
      audio: audioData,
      sensitivity: this.config.sensitivity,
      smoothing: this.config.smoothing,
      beatIntensity: this.config.beatIntensity,
      reducedMotion: this.config.reducedMotion,
      isPlaying: !this.isPaused
    };

    try {
      this.activePreset.render(renderContext);
    } catch (renderErr) {
      this.logger.error('Error during preset render:', renderErr);
    }
  };

  public dispose(): void {
    this.detachCanvas();
  }
}
