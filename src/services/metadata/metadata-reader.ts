import type { IMetadataReader, ExtractedMetadata } from './metadata-types';
import type { AudioContainer, AudioCodec } from '../../domain/value-objects/audio-types';
import { ID3Parser } from './parsers/id3-parser';
import { FlacVorbisParser } from './parsers/flac-vorbis-parser';
import { Mp4AtomParser } from './parsers/mp4-atom-parser';
import { WavRiffParser } from './parsers/wav-riff-parser';

export class MetadataReader implements IMetadataReader {
  public canRead(container: AudioContainer): boolean {
    return ['mp3', 'flac', 'ogg', 'm4a', 'aac', 'alac', 'wav', 'aiff', 'opus', 'webm'].includes(container);
  }

  public async readMetadata(buffer: Uint8Array, container: AudioContainer): Promise<ExtractedMetadata> {
    let parsed: Partial<ExtractedMetadata> = {};

    // 1. Auto-detect from binary magic bytes or container hint
    if (ID3Parser.isID3(buffer) || container === 'mp3' || container === 'aiff') {
      parsed = ID3Parser.parse(buffer);
    } else if (FlacVorbisParser.isFlac(buffer) || container === 'flac') {
      parsed = FlacVorbisParser.parse(buffer);
    } else if (FlacVorbisParser.isOgg(buffer) || container === 'ogg' || container === 'opus') {
      parsed = FlacVorbisParser.parse(buffer);
    } else if (Mp4AtomParser.isMp4(buffer) || container === 'm4a' || container === 'aac' || container === 'alac') {
      parsed = Mp4AtomParser.parse(buffer);
    } else if (WavRiffParser.isWav(buffer) || container === 'wav') {
      parsed = WavRiffParser.parse(buffer);
    }

    // Default container & codec mapping
    const resolvedContainer: AudioContainer = parsed.container || container;
    const resolvedCodec: AudioCodec = parsed.codec || (resolvedContainer as unknown as AudioCodec);
    const isLossless = resolvedContainer === 'flac' || resolvedContainer === 'wav' || resolvedContainer === 'alac' || resolvedContainer === 'aiff';

    return {
      ...parsed,
      container: resolvedContainer,
      codec: resolvedCodec,
      isLossless: parsed.isLossless ?? isLossless,
      sampleRate: parsed.sampleRate ?? 44100,
      channels: parsed.channels ?? 2,
      bitDepth: parsed.bitDepth ?? (isLossless ? 16 : undefined)
    };
  }
}
