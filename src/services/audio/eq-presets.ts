import type { EqualizerPreset } from '../../domain/entities/audio-settings';

/**
 * Standard 10-Band ISO Center Frequencies:
 * 31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz
 * All gain values strictly in dB [-12.0, +12.0].
 */
export const BUILT_IN_EQ_PRESETS: readonly EqualizerPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    isBuiltIn: true,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preampGainDb: 0
  },
  {
    id: 'rock',
    name: 'Rock',
    isBuiltIn: true,
    bands: [4.5, 3.0, 1.5, 0, -1.0, -0.5, 1.0, 2.5, 3.5, 4.0],
    preampGainDb: -1.0
  },
  {
    id: 'pop',
    name: 'Pop',
    isBuiltIn: true,
    bands: [-1.5, -0.5, 1.0, 2.5, 3.5, 3.0, 1.5, 0.5, -0.5, -1.0],
    preampGainDb: -0.5
  },
  {
    id: 'classical',
    name: 'Classical',
    isBuiltIn: true,
    bands: [4.0, 3.0, 2.5, 2.0, -1.0, -1.0, 0, 1.5, 2.5, 3.0],
    preampGainDb: 0
  },
  {
    id: 'jazz',
    name: 'Jazz',
    isBuiltIn: true,
    bands: [3.5, 2.5, 1.0, 1.5, -1.5, -1.5, 0, 1.5, 2.5, 3.0],
    preampGainDb: 0
  },
  {
    id: 'vocal',
    name: 'Vocal',
    isBuiltIn: true,
    bands: [-2.0, -3.0, -1.5, 1.5, 3.5, 3.5, 2.5, 1.0, -0.5, -2.0],
    preampGainDb: -0.5
  },
  {
    id: 'bass_boost',
    name: 'Bass Boost',
    isBuiltIn: true,
    bands: [6.0, 5.0, 4.0, 2.5, 1.0, 0, 0, 0, 0, 0],
    preampGainDb: -2.0
  }
] as const;

export function getBuiltInPresetById(id: string): EqualizerPreset | undefined {
  return BUILT_IN_EQ_PRESETS.find(p => p.id.toLowerCase() === id.toLowerCase());
}
