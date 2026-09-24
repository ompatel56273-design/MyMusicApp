import type { ReplayGainMode } from '../../services/audio/audio-types';

export interface EqualizerPreset {
  readonly id: string;
  readonly name: string;
  readonly isBuiltIn: boolean;
  readonly bands: readonly number[]; // Exactly 10 gain values in dB [-12, +12]
  readonly preampGainDb: number; // Preamp gain in dB [-12, +12]
}

export interface AudioSettings {
  readonly equalizerEnabled: boolean;
  readonly equalizerBands: readonly number[]; // Exactly 10 gain values in dB [-12, +12]
  readonly preampGainDb: number; // Preamp gain in dB [-12, +12]
  readonly replayGainMode: ReplayGainMode; // 'off' | 'track' | 'album'
  readonly selectedPreset: string; // 'flat' | 'rock' | ... | custom preset id
  readonly customPresets: readonly EqualizerPreset[];
  readonly balance: number; // [-1.0 (Left), +1.0 (Right)]
  readonly limiterEnabled: boolean;
  readonly crossfadeEnabled: boolean;
  readonly crossfadeDurationSec: number; // [1.0, 12.0]
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  equalizerEnabled: true,
  equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  preampGainDb: 0,
  replayGainMode: 'track',
  selectedPreset: 'flat',
  customPresets: [],
  balance: 0,
  limiterEnabled: true,
  crossfadeEnabled: false,
  crossfadeDurationSec: 3
};
