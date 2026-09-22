import type { AudioContainer, AudioCodec } from '../../domain/value-objects/audio-types';

/**
 * Format and Codec runtime capability states
 */
export type AudioCapabilityState = 'supported' | 'limited' | 'unsupported' | 'unknown';

export interface CodecCapability {
  readonly container: AudioContainer;
  readonly codec: AudioCodec;
  readonly mimeType: string;
  readonly state: AudioCapabilityState;
  readonly canPlay: 'probably' | 'maybe' | 'none';
  readonly canDecodeAudioData: boolean;
  readonly notes?: string | undefined;
}

/**
 * Standard 10-Band ISO Center Frequencies (Hz)
 */
export const EQUALIZER_ISO_FREQUENCIES: readonly number[] = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
] as const;

export interface EqualizerBandConfig {
  readonly frequency: number;
  readonly gainDb: number; // Clamped to [-12, +12] dB
  readonly q: number;
  readonly type: BiquadFilterType;
}

export type ReplayGainMode = 'off' | 'track' | 'album';

export interface DspPipelineOptions {
  readonly equalizerEnabled: boolean;
  readonly equalizerBands: readonly number[]; // 10 gain values in dB
  readonly replayGainMode: ReplayGainMode;
  readonly preampGainDb: number; // Preamp in dB [-12, +12]
  readonly balance: number; // [-1.0, +1.0] (Left to Right)
  readonly limiterEnabled: boolean;
  readonly masterVolume: number; // [0.0, 1.0]
  readonly isMuted: boolean;
}

export interface AudioAnalysisMetrics {
  readonly rms: number;
  readonly peak: number;
  readonly frequencyData: Uint8Array;
  readonly timeDomainData: Uint8Array;
}
