
export interface VisualizerAudioData {
  rms: number;
  bass: number;
  mids: number;
  treble: number;
  energy: number;
  spectralIntensity: number;
  beatPulse: number;
  smoothedAmplitude: number;
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
}

export interface VisualizerRenderContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  aspect: number;
  time: number; // Elapsed seconds
  deltaTime: number;
  audio: VisualizerAudioData;
  sensitivity: number;
  smoothing: number;
  beatIntensity: number;
  reducedMotion: boolean;
  isPlaying: boolean;
}

export interface VisualizerPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  initialize(gl: WebGL2RenderingContext): boolean;
  resize(gl: WebGL2RenderingContext, width: number, height: number): void;
  render(ctx: VisualizerRenderContext): void;
  dispose(gl: WebGL2RenderingContext): void;
}

export interface VisualizerEngineConfig {
  fpsLimit: number; // 30 | 45 | 60 | 90 | 120
  sensitivity: number; // 0.1 .. 3.0 (default 1.0)
  smoothing: number; // 0.0 .. 0.95 (default 0.75)
  beatIntensity: number; // 0.1 .. 2.5 (default 1.0)
  reducedMotion: boolean;
  presetId: string;
}

export interface VisualizerCapabilities {
  readonly webgl2Supported: boolean;
  readonly maxTextureSize: number;
  readonly vendor: string;
  readonly renderer: string;
}

export const DEFAULT_VISUALIZER_ENGINE_CONFIG: VisualizerEngineConfig = {
  fpsLimit: 60,
  sensitivity: 1.0,
  smoothing: 0.75,
  beatIntensity: 1.0,
  reducedMotion: false,
  presetId: 'neon-nebula'
};
