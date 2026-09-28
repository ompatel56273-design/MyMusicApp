import type { ExtractedMetadata, ExtractedArtwork } from '../metadata-types';
import type { ReplayGainData } from '../../../domain/value-objects/audio-types';

/**
 * Standard ID3v1 Genre Table (148 standard genre strings)
 */
const ID3_GENRE_TABLE: readonly string[] = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock',
  'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
  'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance',
  'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise',
  'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Pop-Folk', 'Eurodance',
  'Dream', 'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap',
  'Pop/Funk', 'Jungle', 'Native American', 'Cabaret', 'New Wave', 'Psychadelic', 'Rave',
  'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro',
  'Musical', 'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock', 'National Folk', 'Swing',
  'Fast Fusion', 'Bebob', 'Latin', 'Revival', 'Celtic', 'Bluegrass', 'Avantgarde',
  'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock',
  'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson',
  'Opera', 'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove',
  'Satire', 'Slow Jam', 'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad',
  'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'Acapella', 'Euro-House',
  'Dance Hall', 'Goa', 'Drum & Bass', 'Club-House', 'Hardcore', 'Terror', 'Indie',
  'BritPop', 'Negerpunk', 'Polsk Punk', 'Beat', 'Christian Gangsta Rap', 'Heavy Metal',
  'Black Metal', 'Crossover', 'Contemporary Christian', 'Christian Rock', 'Merengue',
  'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop'
];

/**
 * Binary ID3v1 / ID3v2.2 / ID3v2.3 / ID3v2.4 Tag Parser & MPEG Frame Analyzer.
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
    let result: Partial<ExtractedMetadata> = {};
    if (this.isID3(buffer)) {
      result = this.parseID3v2(buffer);
    } else {
      result = this.parseID3v1(buffer);
    }

    const mutableResult: Record<string, any> = { ...result };
    const mpegInfo = this.parseMpegAudioInfo(buffer);
    if (mpegInfo) {
      if ((!mutableResult.durationMs || mutableResult.durationMs <= 0) && mpegInfo.durationMs) {
        mutableResult.durationMs = mpegInfo.durationMs;
      }
      if (!mutableResult.sampleRate && mpegInfo.sampleRate) {
        mutableResult.sampleRate = mpegInfo.sampleRate;
      }
      if (!mutableResult.channels && mpegInfo.channels) {
        mutableResult.channels = mpegInfo.channels;
      }
      if (mpegInfo.bitrate) {
        mutableResult.bitrate = mpegInfo.bitrate;
      }
    }

    return mutableResult as Partial<ExtractedMetadata>;
  }

  private static parseID3v2(buffer: Uint8Array): Partial<ExtractedMetadata> {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const versionMajor = buffer[3]; // 2 = v2.2, 3 = v2.3, 4 = v2.4
    const flags = buffer[5];
    const hasExtendedHeader = (flags & 0x40) !== 0;

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
      if (buffer[offset] === 0) break;

      let frameId = '';
      let frameSize = 0;
      let headerLength = 0;

      if (versionMajor === 2) {
        if (offset + 6 > totalHeaderLength) break;
        frameId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2]);
        frameSize = (buffer[offset + 3] << 16) | (buffer[offset + 4] << 8) | buffer[offset + 5];
        headerLength = 6;
      } else {
        if (offset + 10 > totalHeaderLength) break;
        frameId = String.fromCharCode(buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]);

        if (versionMajor === 4) {
          frameSize =
            ((buffer[offset + 4] & 0x7f) << 21) |
            ((buffer[offset + 5] & 0x7f) << 14) |
            ((buffer[offset + 6] & 0x7f) << 7) |
            (buffer[offset + 7] & 0x7f);
        } else {
          frameSize = view.getUint32(offset + 4);
        }
        headerLength = 10;
      }

      if (frameSize <= 0 || offset + headerLength + frameSize > buffer.length) break;

      const frameData = buffer.subarray(offset + headerLength, offset + headerLength + frameSize);
      offset += headerLength + frameSize;

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

    // Parse TLEN frame for duration in ms
    let durationMs: number | undefined;
    const tlenStr = tags['TLEN'] || tags['TLE'];
    if (tlenStr) {
      const parsedDur = parseInt(tlenStr, 10);
      if (!isNaN(parsedDur) && parsedDur > 0) {
        durationMs = parsedDur;
      }
    }

    const { number: trackNumber, total: totalTracks } = this.parseNumberAndTotal(trackStr);
    const { number: discNumber, total: totalDiscs } = this.parseNumberAndTotal(discStr);

    let year: number | undefined;
    if (yearStr) {
      const match = yearStr.match(/\b(19\d\d|20\d\d)\b/);
      if (match && match[1]) {
        year = parseInt(match[1], 10);
      }
    }

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
      durationMs,
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
      return {};
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

    if (buffer[tagOffset + 125] === 0 && buffer[tagOffset + 126] !== 0) {
      trackNumber = buffer[tagOffset + 126];
    }

    const genreByte = buffer[tagOffset + 127];
    const genre = genreByte !== undefined && genreByte < ID3_GENRE_TABLE.length ? ID3_GENRE_TABLE[genreByte] : undefined;

    return {
      title: title || undefined,
      artist: artist || undefined,
      album: album || undefined,
      genre,
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
    if (encoding === 0) decoded = this.textDecoderLatin1.decode(textData);
    else if (encoding === 1) decoded = this.textDecoderUtf16.decode(textData);
    else if (encoding === 2) decoded = this.textDecoderUtf16be.decode(textData);
    else if (encoding === 3) decoded = this.textDecoderUtf8.decode(textData);

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
      const format = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2]).toUpperCase();
      mimeType = format === 'PNG' ? 'image/png' : 'image/jpeg';
      offset += 3;
    } else {
      let endMime = offset;
      while (endMime < data.length && data[endMime] !== 0) endMime++;
      mimeType = String.fromCharCode(...data.subarray(offset, endMime)).toLowerCase() || 'image/jpeg';
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
      offset = endMime + 1;
    }

    if (offset >= data.length) return undefined;
    offset += 1; // Skip picture type

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
    const trimmed = genre.trim();
    const match = trimmed.match(/^\((\d+)\)(.*)$/);
    if (match && match[1]) {
      const idx = parseInt(match[1], 10);
      if (idx < ID3_GENRE_TABLE.length && ID3_GENRE_TABLE[idx]) {
        return ID3_GENRE_TABLE[idx];
      }
      if (match[2] && match[2].trim()) {
        return match[2].trim();
      }
    }
    const plainNum = trimmed.match(/^(\d+)$/);
    if (plainNum && plainNum[1]) {
      const idx = parseInt(plainNum[1], 10);
      if (idx < ID3_GENRE_TABLE.length && ID3_GENRE_TABLE[idx]) {
        return ID3_GENRE_TABLE[idx];
      }
    }
    return trimmed || undefined;
  }

  /**
   * Scans MPEG audio sync headers (0xFFE0) to decode sample rate, bitrate, channel mode,
   * and derives total duration from Xing/VBRI headers or audio byte size.
   */
  private static parseMpegAudioInfo(buffer: Uint8Array): { durationMs?: number; sampleRate?: number; bitrate?: number; channels?: number } | null {
    if (buffer.length < 100) return null;

    // Bitrate table for MPEG1 / Layer III (kbps)
    const bitrateTableV1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    // Bitrate table for MPEG2 / Layer III (kbps)
    const bitrateTableV2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

    const sampleRateTableV1 = [44100, 48000, 32000, 0];
    const sampleRateTableV2 = [22050, 24000, 16000, 0];
    const sampleRateTableV25 = [11025, 12000, 8000, 0];

    let audioStart = 0;
    if (this.isID3(buffer)) {
      const tagSize =
        ((buffer[6] & 0x7f) << 21) |
        ((buffer[7] & 0x7f) << 14) |
        ((buffer[8] & 0x7f) << 7) |
        (buffer[9] & 0x7f);
      audioStart = 10 + tagSize;
    }

    let audioEnd = buffer.length;
    if (buffer.length >= 128 && buffer[buffer.length - 128] === 0x54 && buffer[buffer.length - 127] === 0x41 && buffer[buffer.length - 126] === 0x47) {
      audioEnd = buffer.length - 128;
    }

    let frameOffset = -1;
    for (let i = audioStart; i < Math.min(audioEnd - 4, audioStart + 32768); i++) {
      if (buffer[i] === 0xFF && (buffer[i + 1]! & 0xE0) === 0xE0) {
        frameOffset = i;
        break;
      }
    }

    if (frameOffset === -1 || frameOffset + 4 > buffer.length) {
      return null;
    }

    const h1 = buffer[frameOffset + 1]!;
    const h2 = buffer[frameOffset + 2]!;
    const h3 = buffer[frameOffset + 3]!;

    const mpegVersionRaw = (h1 >> 3) & 0x03; // 3 = v1, 2 = v2, 0 = v2.5
    const layerRaw = (h1 >> 1) & 0x03;       // 1 = Layer 3
    const bitrateIdx = (h2 >> 4) & 0x0F;
    const sampleRateIdx = (h2 >> 2) & 0x03;
    const channelMode = (h3 >> 6) & 0x03;    // 3 = Single channel (Mono), else stereo

    if (mpegVersionRaw === 1 || layerRaw !== 1) {
      return null; // Only accept Layer III
    }

    const isMpeg1 = mpegVersionRaw === 3;
    const isMpeg2 = mpegVersionRaw === 2;

    let sampleRate = 44100;
    if (isMpeg1) sampleRate = sampleRateTableV1[sampleRateIdx] || 44100;
    else if (isMpeg2) sampleRate = sampleRateTableV2[sampleRateIdx] || 22050;
    else sampleRate = sampleRateTableV25[sampleRateIdx] || 11025;

    const bitrateTable = isMpeg1 ? bitrateTableV1L3 : bitrateTableV2L3;
    const bitrateKbps = bitrateTable[bitrateIdx] || 128;
    const channels = channelMode === 3 ? 1 : 2;

    // Check Xing / Info / VBRI header for VBR duration calculation
    let durationMs: number | undefined;
    const xingHeaderOffsets = [frameOffset + 36, frameOffset + 21, frameOffset + 13];
    for (const off of xingHeaderOffsets) {
      if (off + 12 <= buffer.length) {
        const headerId = String.fromCharCode(buffer[off], buffer[off + 1], buffer[off + 2], buffer[off + 3]);
        if (headerId === 'Xing' || headerId === 'Info') {
          const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
          const flags = view.getUint32(off + 4);
          if ((flags & 0x01) !== 0) { // Frames count present
            const totalFrames = view.getUint32(off + 8);
            const samplesPerFrame = isMpeg1 ? 1152 : 576;
            if (totalFrames > 0 && sampleRate > 0) {
              durationMs = Math.round((totalFrames * samplesPerFrame / sampleRate) * 1000);
            }
          }
          break;
        }
      }
    }

    if (!durationMs && bitrateKbps > 0) {
      const audioBytes = Math.max(0, audioEnd - frameOffset);
      if (audioBytes > 0) {
        durationMs = Math.round(((audioBytes * 8) / (bitrateKbps * 1000)) * 1000);
      }
    }

    const ret: { durationMs?: number; sampleRate?: number; bitrate?: number; channels?: number } = {
      sampleRate,
      bitrate: bitrateKbps,
      channels
    };
    if (durationMs !== undefined) {
      ret.durationMs = durationMs;
    }
    return ret;
  }
}
