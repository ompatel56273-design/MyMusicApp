import type { AudioContainer, AudioCodec, ReplayGainData } from '../../domain/value-objects/audio-types';

export interface ExtractedArtwork {
  readonly mimeType: string;
  readonly data: Uint8Array;
  readonly description?: string | undefined;
  readonly type?: 'cover_front' | 'cover_back' | 'artist' | 'other' | undefined;
}

export interface ExtractedMetadata {
  readonly title?: string | undefined;
  readonly artist?: string | undefined;
  readonly artists?: readonly string[] | undefined;
  readonly albumArtist?: string | undefined;
  readonly album?: string | undefined;
  readonly genre?: string | undefined;
  readonly genres?: readonly string[] | undefined;
  readonly trackNumber?: number | undefined;
  readonly totalTracks?: number | undefined;
  readonly discNumber?: number | undefined;
  readonly totalDiscs?: number | undefined;
  readonly year?: number | undefined;
  readonly date?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly isCompilation?: boolean | undefined;
  readonly comment?: string | undefined;
  readonly composer?: string | undefined;

  // Technical Audio Format Information
  readonly container: AudioContainer;
  readonly codec: AudioCodec;
  readonly sampleRate?: number | undefined;
  readonly bitDepth?: number | undefined;
  readonly channels?: number | undefined;
  readonly bitrate?: number | undefined;
  readonly isLossless: boolean;

  // ReplayGain
  readonly replayGain?: ReplayGainData | undefined;

  // Embedded Artwork
  readonly artwork?: ExtractedArtwork | undefined;
}

export interface IMetadataReader {
  canRead(container: AudioContainer): boolean;
  readMetadata(buffer: Uint8Array, container: AudioContainer): Promise<ExtractedMetadata>;
}
