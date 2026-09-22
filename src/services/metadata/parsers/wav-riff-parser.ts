import type { ExtractedMetadata } from '../metadata-types';

/**
 * Binary WAV RIFF Parser
 * Parses 'fmt ' chunk for sample rate, bit depth, channels, and 'LIST INFO' chunks for metadata.
 */
export class WavRiffParser {
  private static textDecoder = new TextDecoder('utf-8');

  public static isWav(buffer: Uint8Array): boolean {
    if (buffer.length < 12) return false;
    const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
    const wave = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
    return riff === 'RIFF' && wave === 'WAVE';
  }

  public static parse(buffer: Uint8Array): Partial<ExtractedMetadata> {
    if (!this.isWav(buffer)) return {};
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    let offset = 12;
    let sampleRate = 44100;
    let channels = 2;
    let bitDepth = 16;
    let durationMs: number | undefined;

    const infoTags: Record<string, string> = {};

    while (offset + 8 <= buffer.length) {
      const chunkId = String.fromCharCode(
        buffer[offset],
        buffer[offset + 1],
        buffer[offset + 2],
        buffer[offset + 3]
      );
      const chunkSize = view.getUint32(offset + 4, true);
      const chunkDataOffset = offset + 8;

      if (chunkSize <= 0 || chunkDataOffset + chunkSize > buffer.length) break;

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        channels = view.getUint16(chunkDataOffset + 2, true);
        sampleRate = view.getUint32(chunkDataOffset + 4, true);
        bitDepth = view.getUint16(chunkDataOffset + 14, true);
      } else if (chunkId === 'data') {
        const byteRate = sampleRate * channels * (bitDepth / 8);
        if (byteRate > 0) {
          durationMs = Math.round((chunkSize / byteRate) * 1000);
        }
      } else if (chunkId === 'LIST') {
        const listType = String.fromCharCode(
          buffer[chunkDataOffset],
          buffer[chunkDataOffset + 1],
          buffer[chunkDataOffset + 2],
          buffer[chunkDataOffset + 3]
        );

        if (listType === 'INFO') {
          let listOffset = chunkDataOffset + 4;
          const listEnd = chunkDataOffset + chunkSize;

          while (listOffset + 8 <= listEnd) {
            const infoId = String.fromCharCode(
              buffer[listOffset],
              buffer[listOffset + 1],
              buffer[listOffset + 2],
              buffer[listOffset + 3]
            );
            const infoSize = view.getUint32(listOffset + 4, true);
            const infoDataOffset = listOffset + 8;

            if (infoDataOffset + infoSize <= listEnd) {
              const text = this.textDecoder.decode(buffer.subarray(infoDataOffset, infoDataOffset + infoSize)).replace(/\0+$/, '').trim();
              infoTags[infoId] = text;
            }
            // Chunks in RIFF are word-aligned (2 bytes)
            listOffset += 8 + infoSize + (infoSize % 2);
          }
        }
      }

      // Word alignment padding
      offset += 8 + chunkSize + (chunkSize % 2);
    }

    const title = infoTags['INAM'];
    const artist = infoTags['IART'];
    const album = infoTags['IPRD'];
    const genre = infoTags['IGNR'];
    const yearStr = infoTags['ICRD'];
    const trackStr = infoTags['ITRK'];

    let year: number | undefined;
    if (yearStr) {
      const m = yearStr.match(/\b(19\d\d|20\d\d)\b/);
      if (m && m[1]) year = parseInt(m[1], 10);
    }

    const trackNumber = trackStr ? parseInt(trackStr, 10) : undefined;

    return {
      title,
      artist,
      album,
      genre,
      year,
      trackNumber: isNaN(trackNumber!) ? undefined : trackNumber,
      sampleRate,
      channels,
      bitDepth,
      durationMs,
      container: 'wav',
      codec: 'pcm',
      isLossless: true
    };
  }
}
