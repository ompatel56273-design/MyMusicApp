export type EntityId = string;

export type AudioContainer =
  | 'mp3'
  | 'flac'
  | 'wav'
  | 'ogg'
  | 'm4a'
  | 'aac'
  | 'opus'
  | 'webm'
  | 'alac'
  | 'aiff'
  | 'wma'
  | 'ape'
  | 'unknown';

export type AudioCodec =
  | 'mp3'
  | 'flac'
  | 'pcm'
  | 'vorbis'
  | 'aac'
  | 'opus'
  | 'alac'
  | 'unknown';

export type PlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'stopped'
  | 'error';

export type RepeatMode = 'off' | 'all' | 'one';

export type ShuffleMode = 'off' | 'on';

export type AvailabilityState = 'available' | 'missing' | 'unsupported' | 'corrupt';

export type ArtistRole = 'primary' | 'featured' | 'remixer' | 'composer' | 'producer';

export interface AudioFormatInfo {
  readonly container: AudioContainer;
  readonly codec: AudioCodec;
  readonly sampleRate: number;                  // e.g. 44100, 96000
  readonly bitDepth?: number | undefined;       // e.g. 16, 24
  readonly bitrate?: number | undefined;        // in kbps
  readonly channels: number;                    // 1 = mono, 2 = stereo, etc.
  readonly isLossless: boolean;
}

export interface ReplayGainData {
  readonly trackGainDb?: number | undefined;
  readonly trackPeak?: number | undefined;
  readonly albumGainDb?: number | undefined;
  readonly albumPeak?: number | undefined;
}
