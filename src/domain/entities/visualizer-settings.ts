export type VisualizerMode = 'bars' | 'waveform' | 'circular' | 'spectrum' | 'particles' | 'minimal';
export type VisualizerColorTheme = 'accent' | 'rainbow' | 'monochrome';

export interface VisualizerSettings {
  readonly enabled: boolean;
  readonly mode: VisualizerMode;
  readonly fpsLimit: number; // e.g. 30 | 60
  readonly colorTheme: VisualizerColorTheme;
}

export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  enabled: true,
  mode: 'bars',
  fpsLimit: 60,
  colorTheme: 'accent'
};
