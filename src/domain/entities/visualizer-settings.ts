export type VisualizerMode =
  | 'off'
  | 'bars'
  | 'spectrum-bars'
  | 'waveform'
  | 'circular'
  | 'circular-spectrum'
  | 'spectrum'
  | 'particles'
  | 'pulse'
  | 'album-reactive'
  | 'minimal';

export type VisualizerColorTheme = 'accent' | 'rainbow' | 'monochrome';

export interface VisualizerSettings {
  readonly enabled: boolean;
  readonly mode: VisualizerMode;
  readonly fpsLimit: number; // e.g. 30 | 60
  readonly colorTheme: VisualizerColorTheme;
}

export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  enabled: false,
  mode: 'off',
  fpsLimit: 60,
  colorTheme: 'accent'
};
