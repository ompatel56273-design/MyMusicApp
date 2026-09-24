import type { ExtractedMetadata, ExtractedArtwork } from '../metadata-types';
import type { ReplayGainData } from '../../../domain/value-objects/audio-types';

/**
 * Binary ID3v1 / ID3v2.2 / ID3v2.3 / ID3v2.4 Tag Parser
 * Zero external dependencies. Uses DataView and TextDecoder.
 */
export class ID3Parser {
  private static textDecoderLatin1 = new TextDecoder('iso-8859-1');
  private static textDecoderUtf8 = new TextDecoder('utf-8');
  private static textDecoderUtf16 = new TextDecoder('utf-16');
  private static textDecoderUtf16be = new TextDecoder('utf-16be');

  public static isID3(buffer: Uint8Array): boolean {
    if (buffer.length < 10) return false;
    return buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33; // 'ID3'
  }

  public static parse(buffer: Uint8Array): Partial<ExtractedMetadata> {
    if (this.isID3(buffer)) {
      return this.parseID3v2(buffer);
    }
    return this.parseID3v1(buffer);
  }

  private static parseID3v2(buffer: Uint8Array): Partial<ExtractedMetadata> {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const versionMajor = buffer[3]; // 2 = v2.2, 3 = v2.3, 4 = v2.4
    const flags = buffer[5];
    const hasExtendedHeader = (flags & 0x40) !== 0;

    // Synchsafe integer calculation for tag size
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);

    const totalHeaderLength = Math.min(10 + tagSize, buffer.length);
    let offset = 10;

    if (hasExtendedHeader && versionMajor >= 3) {
      if (offset + 4 <= totalHeaderLength) {
        const extSize = versionMajor === 4
          ? ((buffer[offset] & 0x7f) << 21) | ((buffer[offset + 1] & 0x7f) << 14) | ((buffer[offset + 2] & 0x7f) << 7) | (buffer[offset + 3] & 0x7f)
          : view.getUint32(offset);
        offset += extSize;
      }
    }

    const tags: Record<string, string> = {};
    const txxxTags: Record<string, string> = {};
    let artwork: ExtractedArtwork | undefined;

    while (offset < totalHeaderLength) {
      if (buffer[offset] === 0) {
        // Padding reached
        break;
      }

      let frameId = '';
      let frameSize = 0;
      let headerLength = 0;

      if (versionMajor === 2) {
        // 3-byte ID, 3-byte size
        if (offset + 6 > totalHeaderLength) break;
        frameId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2]);
        frameSize = (buffer[offset + 3] << 16) | (buffer[offset + 4] << 8) | buffer[offset + 5];
        headerLength = 6;
      } else {
        // 4-byte ID, 4-byte size, 2-byte flags
        if (offset + 10 > totalHeaderLength) break;
        frameId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);

        if (versionMajor === 4) {
          // v2.4 uses synchsafe frame sizes
          frameSize =
            ((buffer[offset + 4] & 0x7f) << 21) |
            ((buffer[offset + 5] & 0x7f) << 14) |
            ((buffer[offset + 6] & 0x7f) << 7) |
            (buffer[offset + 7] & 0x7f);
        } else {
          // v2.3 uses regular 32-bit uint
          frameSize = view.getUint32(offset + 4);
        }
        headerLength = 10;
      }

      if (frameSize <= 0 || offset + headerLength + frameSize > buffer.length) {
        break;
      }

      const frameData = buffer.subarray(offset + headerLength, offset + headerLength + frameSize);
      offset += headerLength + frameSize;

      // Parse Frame content
      if (frameId.startsWith('T') && frameId !== 'TXXX' && frameId !== 'TXX') {
        const text = this.decodeTextFrame(frameData);
        if (text) tags[frameId] = text;
      } else if (frameId === 'TXXX' || frameId === 'TXX') {
        const { desc, value } = this.decodeTxxxFrame(frameData);
        if (desc && value) txxxTags[desc.toUpperCase()] = value;
      } else if (frameId === 'APIC' || frameId === 'PIC') {
        if (!artwork) {
          artwork = this.decodeApicFrame(frameData, versionMajor);
        }
      }
    }

    // Map frames to normalized metadata
    const title = tags['TIT2'] || tags['TT2'];
    const artist = tags['TPE1'] || tags['TP1'];
    const albumArtist = tags['TPE2'] || tags['TP2'];
    const album = tags['TALB'] || tags['TAL'];
    const genre = tags['TCON'] || tags['TCO'];
    const trackStr = tags['TRCK'] || tags['TRK'];
    const discStr = tags['TPOS'] || tags['TPA'];
    const yearStr = tags['TDRC'] || tags['TYER'] || tags['TYE'] || tags['TDRL'];
    const composer = tags['TCOM'] || tags['TCM'];
    const isCompilation = tags['TCMP'] === '1' || txxxTags['COMPILATION'] === '1';

    // Parse track & disc numbers (e.g. "3/12")
    const { number: trackNumber, total: totalTracks } = this.parseNumberAndTotal(trackStr);
    const { number: discNumber, total: totalDiscs } = this.parseNumberAndTotal(discStr);

    let year: number | undefined;
    if (yearStr) {
      const match = yearStr.match(/\b(19\d\d|20\d\d)\b/);
      if (match && match[1]) {
        year = parseInt(match[1], 10);
      }
    }

    // Parse ReplayGain from TXXX tags
    let replayGain: ReplayGainData | undefined;
    if (txxxTags['REPLAYGAIN_TRACK_GAIN'] || txxxTags['REPLAYGAIN_ALBUM_GAIN'] || txxxTags['REPLAYGAIN_TRACK_PEAK'] || txxxTags['REPLAYGAIN_ALBUM_PEAK']) {
      const parseGain = (v?: string) => {
        if (!v) return undefined;
        const num = parseFloat(v.replace(/dB/i, '').trim());
        return isNaN(num) || !isFinite(num) ? undefined : num;
      };
      const parsePeak = (v?: string) => {
        if (!v) return undefined;
        const num = parseFloat(v.trim());
        return isNaN(num) || !isFinite(num) ? undefined : num;
      };
      replayGain = {
        trackGainDb: parseGain(txxxTags['REPLAYGAIN_TRACK_GAIN']),
        trackPeak: parsePeak(txxxTags['REPLAYGAIN_TRACK_PEAK']),
        albumGainDb: parseGain(txxxTags['REPLAYGAIN_ALBUM_GAIN']),
        albumPeak: parsePeak(txxxTags['REPLAYGAIN_ALBUM_PEAK'])
      };
    }

    return {
      title,
      artist,
      albumArtist,
      album,
      genre: this.cleanGenre(genre),
      trackNumber,
      totalTracks,
      discNumber,
      totalDiscs,
      year,
      composer,
      isCompilation,
      artwork,
      replayGain,
      container: 'mp3',
      codec: 'mp3',
      isLossless: false
    };
  }

  private static parseID3v1(buffer: Uint8Array): Partial<ExtractedMetadata> {
    if (buffer.length < 128) return {};
    const tagOffset = buffer.length - 128;
    if (buffer[tagOffset] !== 0x54 || buffer[tagOffset + 1] !== 0x41 || buffer[tagOffset + 2] !== 0x47) {
      return {}; // Not 'TAG'
    }

    const decode = (start: number, length: number) => {
      const slice = buffer.subarray(tagOffset + start, tagOffset + start + length);
      return this.textDecoderLatin1.decode(slice).replace(/\0+$/, '').trim();
    };

    const title = decode(3, 30);
    const artist = decode(33, 30);
    const album = decode(63, 30);
    const yearStr = decode(93, 4);
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    let trackNumber: number | undefined;

    // ID3v1.1 track number check
    if (buffer[tagOffset + 125] === 0 && buffer[tagOffset + 126] !== 0) {
      trackNumber = buffer[tagOffset + 126];
    }

    return {
      title: title || undefined,
      artist: artist || undefined,
      album: album || undefined,
      year: isNaN(year!) ? undefined : year,
      trackNumber,
      container: 'mp3',
      codec: 'mp3',
      isLossless: false
    };
  }

  private static decodeTextFrame(data: Uint8Array): string {
    if (data.length < 2) return '';
    const encoding = data[0];
    const textData = data.subarray(1);

    let decoded = '';
    if (encoding === 0) {
      decoded = this.textDecoderLatin1.decode(textData);
    } else if (encoding === 1) {
      decoded = this.textDecoderUtf16.decode(textData);
    } else if (encoding === 2) {
      decoded = this.textDecoderUtf16be.decode(textData);
    } else if (encoding === 3) {
      decoded = this.textDecoderUtf8.decode(textData);
    }

    return decoded.replace(/\0+$/, '').trim();
  }

  private static decodeTxxxFrame(data: Uint8Array): { desc: string; value: string } {
    if (data.length < 3) return { desc: '', value: '' };
    const encoding = data[0];
    const textData = data.subarray(1);

    let text = '';
    if (encoding === 0) text = this.textDecoderLatin1.decode(textData);
    else if (encoding === 1) text = this.textDecoderUtf16.decode(textData);
    else if (encoding === 2) text = this.textDecoderUtf16be.decode(textData);
    else if (encoding === 3) text = this.textDecoderUtf8.decode(textData);

    const parts = text.split('\0');
    return {
      desc: (parts[0] || '').trim(),
      value: (parts[1] || '').replace(/\0+$/, '').trim()
    };
  }

  private static decodeApicFrame(data: Uint8Array, version: number): ExtractedArtwork | undefined {
    if (data.length < 10) return undefined;
    const encoding = data[0];
    let offset = 1;
    let mimeType = 'image/jpeg';

    if (version === 2) {
      // 3-byte format, e.g. "JPG", "PNG"
      const format = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2]).toUpperCase();
      mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
      offset += 3;
    } else {
      // Null-terminated MIME string
      let endMime = offset;
      while (endMime < data.length && data[endMime] !== 0) {
        endMime++;
      }
      mimeType = String.fromCharCode(...data.subarray(offset, endMime)).toLowerCase() || 'image/jpeg';
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
      offset = endMime + 1;
    }

    if (offset >= data.length) return undefined;

    // Picture type (e.g. 0x03 = Cover (front))
    offset += 1;

    // Description (null-terminated according to encoding)
    if (encoding === 0 || encoding === 3) {
      while (offset < data.length && data[offset] !== 0) offset++;
      offset += 1;
    } else {
      while (offset + 1 < data.length && !(data[offset] === 0 && data[offset + 1] === 0)) offset += 2;
      offset += 2;
    }

    if (offset >= data.length) return undefined;

    const imgBytes = data.subarray(offset);
    if (imgBytes.length === 0) return undefined;

    return {
      mimeType,
      data: imgBytes,
      type: 'cover_front'
    };
  }

  private static parseNumberAndTotal(str?: string): { number?: number | undefined; total?: number | undefined } {
    if (!str) return {};
    const parts = str.split('/');
    const num = parseInt(parts[0], 10);
    const tot = parts[1] ? parseInt(parts[1], 10) : undefined;
    return {
      number: isNaN(num) ? undefined : num,
      total: tot !== undefined && !isNaN(tot) ? tot : undefined
    };
  }

  private static cleanGenre(genre?: string): string | undefined {
    if (!genre) return undefined;
    // Replace Winamp genre numbers like (17) -> Hard Rock
    const match = genre.match(/^\((\d+)\)$/);
    if (match && match[1]) {
      const idx = parseInt(match[1], 10);
      const GENRES_LIST = ['Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock'];
      if (idx < GENRES_LIST.length) return GENRES_LIST[idx];
    }
    return genre.trim() || undefined;
  }
}
