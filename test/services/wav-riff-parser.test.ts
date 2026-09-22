import { describe, it, expect } from 'vitest';
import { WavRiffParser } from '../../src/services/metadata/parsers/wav-riff-parser';

describe('WavRiffParser', () => {
  function createSyntheticWavBuffer(): Uint8Array {
    // RIFF (4) + size (4) + WAVE (4) + fmt (8 + 16 = 24) + LIST INFO (8 + 4 + itemChunks)
    const createInfoChunk = (id: string, text: string): Uint8Array => {
      const textBytes = new TextEncoder().encode(text + '\0');
      const chunk = new Uint8Array(8 + textBytes.length + (textBytes.length % 2));
      for (let i = 0; i < 4; i++) chunk[i] = id.charCodeAt(i);
      new DataView(chunk.buffer).setUint32(4, textBytes.length, true);
      chunk.set(textBytes, 8);
      return chunk;
    };

    const inam = createInfoChunk('INAM', 'Master of Puppets');
    const iart = createInfoChunk('IART', 'Metallica');
    const iprd = createInfoChunk('IPRD', 'Master of Puppets');

    const infoListSize = 4 + inam.length + iart.length + iprd.length;
    const infoList = new Uint8Array(8 + infoListSize);
    infoList[0] = 0x4c; infoList[1] = 0x49; infoList[2] = 0x53; infoList[3] = 0x54; // 'LIST'
    new DataView(infoList.buffer).setUint32(4, infoListSize, true);
    infoList[8] = 0x49; infoList[9] = 0x4e; infoList[10] = 0x46; infoList[11] = 0x4f; // 'INFO'

    let offset = 12;
    infoList.set(inam, offset); offset += inam.length;
    infoList.set(iart, offset); offset += iart.length;
    infoList.set(iprd, offset); offset += iprd.length;

    // fmt chunk: 44.1kHz, 16-bit, 2-ch
    const fmtChunk = new Uint8Array(24);
    fmtChunk[0] = 0x66; fmtChunk[1] = 0x6d; fmtChunk[2] = 0x74; fmtChunk[3] = 0x20; // 'fmt '
    const fmtView = new DataView(fmtChunk.buffer);
    fmtView.setUint32(4, 16, true);
    fmtView.setUint16(8, 1, true); // PCM
    fmtView.setUint16(10, 2, true); // 2 channels
    fmtView.setUint32(12, 44100, true); // 44100 Hz
    fmtView.setUint32(16, 44100 * 2 * 2, true); // byte rate
    fmtView.setUint16(20, 4, true); // block align
    fmtView.setUint16(22, 16, true); // 16 bits per sample

    const totalSize = 4 + fmtChunk.length + infoList.length;
    const buffer = new Uint8Array(8 + totalSize);
    buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46; // 'RIFF'
    new DataView(buffer.buffer).setUint32(4, totalSize, true);
    buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45; // 'WAVE'

    buffer.set(fmtChunk, 12);
    buffer.set(infoList, 12 + fmtChunk.length);

    return buffer;
  }

  it('should parse WAV fmt audio specifications and LIST INFO tags', () => {
    const buffer = createSyntheticWavBuffer();
    const parsed = WavRiffParser.parse(buffer);

    expect(parsed.title).toBe('Master of Puppets');
    expect(parsed.artist).toBe('Metallica');
    expect(parsed.album).toBe('Master of Puppets');
    expect(parsed.sampleRate).toBe(44100);
    expect(parsed.channels).toBe(2);
    expect(parsed.bitDepth).toBe(16);
    expect(parsed.isLossless).toBe(true);
  });
});
