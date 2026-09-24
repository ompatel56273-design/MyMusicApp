import type { ExtractedMetadata, ExtractedArtwork } from '../metadata-types';
import type { ReplayGainData } from '../../../domain/value-objects/audio-types';

/**
 * Binary FLAC & OGG Vorbis Comment Parser
 * Parses STREAMINFO, VORBIS_COMMENT, and METADATA_BLOCK_PICTURE blocks.
 */
export class FlacVorbisParser {
  private static textDecoder = new TextDecoder('utf-8');

  public static isFlac(buffer: Uint8Array): boolean {
    if (buffer.length < 4) return false;
    return buffer[0] === 0x66 && buffer[1] === 0x4c && buffer[2] === 0x61 && buffer[3] === 0x43; // 'fLaC'
  }

  public static isOgg(buffer: Uint8Array): boolean {
    if (buffer.length < 4) return false;
    return buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53; // 'OggS'
  }

  public static parse(buffer: Uint8Array): Partial<ExtractedMetadata> {
    if (this.isFlac(buffer)) {
      return this.parseFlac(buffer);
    }
    if (this.isOgg(buffer)) {
      return this.parseOggVorbis(buffer);
    }
    return {};
  }

  private static parseFlac(buffer: Uint8Array): Partial<ExtractedMetadata> {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 4; // Skip 'fLaC'

    let sampleRate: number | undefined;
    let channels: number | undefined;
    let bitDepth: number | undefined;
    let totalSamples: number | undefined;
    let durationMs: number | undefined;

    const comments: Record<string, string[]> = {};
    let artwork: ExtractedArtwork | undefined;

    let isLast = false;
    while (offset < buffer.length && !isLast) {
      if (offset + 4 > buffer.length) break;

      const blockHeader = buffer[offset];
      isLast = (blockHeader & 0x80) !== 0;
      const blockType = blockHeader & 0x7f;
      const blockSize = (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];

      offset += 4;
      if (offset + blockSize > buffer.length) break;

      if (blockType === 0) {
        // STREAMINFO (34 bytes)
        if (blockSize >= 34) {
          // sample rate (20 bits), channels (3 bits), bit depth (5 bits), total samples (36 bits)
          const b10 = buffer[offset + 10];
          const b11 = buffer[offset + 11];
          const b12 = buffer[offset + 12];
          const b13 = buffer[offset + 13];

          sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
          channels = ((b12 >> 1) & 0x07) + 1;
          bitDepth = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;

          const s1 = b13 & 0x0f;
          const s2 = view.getUint32(offset + 14);
          totalSamples = (s1 * 0x100000000) + s2;

          if (sampleRate > 0 && totalSamples > 0) {
            durationMs = Math.round((totalSamples / sampleRate) * 1000);
          }
        }
      } else if (blockType === 4) {
        // VORBIS_COMMENT
        this.parseVorbisCommentBlock(buffer.subarray(offset, offset + blockSize), comments);
      } else if (blockType === 6) {
        // PICTURE
        if (!artwork) {
          artwork = this.parseFlacPictureBlock(buffer.subarray(offset, offset + blockSize));
        }
      }

      offset += blockSize;
    }

    return this.mapCommentsToMetadata(comments, {
      container: 'flac',
      codec: 'flac',
      sampleRate: sampleRate ?? 44100,
      channels: channels ?? 2,
      bitDepth: bitDepth ?? 16,
      durationMs,
      isLossless: true,
      artwork
    });
  }

  private static parseOggVorbis(buffer: Uint8Array): Partial<ExtractedMetadata> {
    const comments: Record<string, string[]> = {};
    // Search for vorbis comment header pattern 'vorbis'
    const vorbisMarker = [0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]; // 'vorbis'
    let foundIndex = -1;

    for (let i = 0; i < Math.min(buffer.length - 10, 8192); i++) {
      if (
        buffer[i] === vorbisMarker[0] &&
        buffer[i + 1] === vorbisMarker[1] &&
        buffer[i + 2] === vorbisMarker[2] &&
        buffer[i + 3] === vorbisMarker[3] &&
        buffer[i + 4] === vorbisMarker[4] &&
        buffer[i + 5] === vorbisMarker[5]
      ) {
        foundIndex = i + 6;
        break;
      }
    }

    if (foundIndex !== -1) {
      this.parseVorbisCommentBlock(buffer.subarray(foundIndex), comments);
    }

    return this.mapCommentsToMetadata(comments, {
      container: 'ogg',
      codec: 'vorbis',
      sampleRate: 44100,
      channels: 2,
      isLossless: false
    });
  }

  private static parseVorbisCommentBlock(block: Uint8Array, result: Record<string, string[]>): void {
    if (block.length < 8) return;
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    let offset = 0;

    // Vendor string length
    const vendorLength = view.getUint32(offset, true);
    offset += 4 + vendorLength;

    if (offset + 4 > block.length) return;

    // User comment list length
    const commentCount = view.getUint32(offset, true);
    offset += 4;

    for (let i = 0; i < commentCount; i++) {
      if (offset + 4 > block.length) break;
      const length = view.getUint32(offset, true);
      offset += 4;

      if (offset + length > block.length) break;
      const commentStr = this.textDecoder.decode(block.subarray(offset, offset + length));
      offset += length;

      const equalIndex = commentStr.indexOf('=');
      if (equalIndex > 0) {
        const key = commentStr.substring(0, equalIndex).toUpperCase().trim();
        const value = commentStr.substring(equalIndex + 1).trim();
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(value);
      }
    }
  }

  private static parseFlacPictureBlock(block: Uint8Array): ExtractedArtwork | undefined {
    if (block.length < 32) return undefined;
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);

    let offset = 4; // Skip picture type (4 bytes)
    const mimeLength = view.getUint32(offset);
    offset += 4;

    if (offset + mimeLength > block.length) return undefined;
    const mimeType = this.textDecoder.decode(block.subarray(offset, offset + mimeLength)).toLowerCase() || 'image/jpeg';
    offset += mimeLength;

    const descLength = view.getUint32(offset);
    offset += 4 + descLength; // Skip description
    offset += 16; // Skip width(4), height(4), depth(4), colors(4)

    if (offset + 4 > block.length) return undefined;
    const dataLength = view.getUint32(offset);
    offset += 4;

    if (offset + dataLength > block.length || dataLength === 0) return undefined;
    const data = block.subarray(offset, offset + dataLength);

    return {
      mimeType,
      data,
      type: 'cover_front'
    };
  }

  private static mapCommentsToMetadata(
    comments: Record<string, string[]>,
    base: Partial<ExtractedMetadata>
  ): Partial<ExtractedMetadata> {
    const getFirst = (key: string) => comments[key]?.[0];
    const getAll = (key: string) => comments[key];

    const title = getFirst('TITLE');
    const artist = getFirst('ARTIST');
    const artists = getAll('ARTIST');
    const albumArtist = getFirst('ALBUMARTIST') || getFirst('ALBUM ARTIST');
    const album = getFirst('ALBUM');
    const genre = getFirst('GENRE');
    const genres = getAll('GENRE');
    const trackStr = getFirst('TRACKNUMBER') || getFirst('TRACK');
    const totalTracksStr = getFirst('TRACKTOTAL') || getFirst('TOTALTRACKS');
    const discStr = getFirst('DISCNUMBER');
    const totalDiscsStr = getFirst('DISCTOTAL') || getFirst('TOTALDISCS');
    const dateStr = getFirst('DATE') || getFirst('YEAR');
    const composer = getFirst('COMPOSER');
    const isCompilation = getFirst('COMPILATION') === '1';

    let year: number | undefined;
    if (dateStr) {
      const m = dateStr.match(/\b(19\d\d|20\d\d)\b/);
      if (m && m[1]) year = parseInt(m[1], 10);
    }

    const trackNumber = trackStr ? parseInt(trackStr.split('/')[0], 10) : undefined;
    const totalTracks = totalTracksStr ? parseInt(totalTracksStr, 10) : (trackStr?.includes('/') ? parseInt(trackStr.split('/')[1], 10) : undefined);
    const discNumber = discStr ? parseInt(discStr.split('/')[0], 10) : undefined;
    const totalDiscs = totalDiscsStr ? parseInt(totalDiscsStr, 10) : undefined;

    // ReplayGain
    let replayGain: ReplayGainData | undefined;
    const trackGain = getFirst('REPLAYGAIN_TRACK_GAIN');
    const trackPeak = getFirst('REPLAYGAIN_TRACK_PEAK');
    const albumGain = getFirst('REPLAYGAIN_ALBUM_GAIN');
    const albumPeak = getFirst('REPLAYGAIN_ALBUM_PEAK');

    if (trackGain || albumGain) {
      const parseGain = (val?: string) => {
        if (!val) return undefined;
        const num = parseFloat(val.replace(/dB/i, '').trim());
        return Number.isFinite(num) ? num : undefined;
      };
      const parsePeak = (val?: string) => {
        if (!val) return undefined;
        const num = parseFloat(val.trim());
        return Number.isFinite(num) ? num : undefined;
      };
      replayGain = {
        trackGainDb: parseGain(trackGain),
        trackPeak: parsePeak(trackPeak),
        albumGainDb: parseGain(albumGain),
        albumPeak: parsePeak(albumPeak)
      };
    }

    return {
      ...base,
      title,
      artist,
      artists: artists && artists.length > 1 ? artists : undefined,
      albumArtist,
      album,
      genre,
      genres: genres && genres.length > 1 ? genres : undefined,
      trackNumber: isNaN(trackNumber!) ? undefined : trackNumber,
      totalTracks: isNaN(totalTracks!) ? undefined : totalTracks,
      discNumber: isNaN(discNumber!) ? undefined : discNumber,
      totalDiscs: isNaN(totalDiscs!) ? undefined : totalDiscs,
      year,
      composer,
      isCompilation,
      replayGain
    };
  }
}
