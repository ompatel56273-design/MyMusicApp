import { describe, it, expect } from 'vitest';
import { FlacVorbisParser } from '../../src/services/metadata/parsers/flac-vorbis-parser';

describe('FlacVorbisParser', () => {
  function createSyntheticFlacBuffer(): Uint8Array {
    // 4 bytes 'fLaC' + STREAMINFO block (38 bytes) + VORBIS_COMMENT block
    const comments = [
      'TITLE=Echoes',
      'ARTIST=Pink Floyd',
      'ALBUM=Meddle',
      'DATE=1971',
      'TRACKNUMBER=6',
      'GENRE=Progressive Rock'
    ];

    const vendorStr = new TextEncoder().encode('Reference LibFLAC');
    const commentBytes: Uint8Array[] = comments.map(c => new TextEncoder().encode(c));

    let vorbisBlockLength = 4 + vendorStr.length + 4;
    for (const b of commentBytes) {
      vorbisBlockLength += 4 + b.length;
    }

    const vorbisBlock = new Uint8Array(vorbisBlockLength);
    const view = new DataView(vorbisBlock.buffer);
    let offset = 0;

    view.setUint32(offset, vendorStr.length, true);
    offset += 4;
    vorbisBlock.set(vendorStr, offset);
    offset += vendorStr.length;

    view.setUint32(offset, commentBytes.length, true);
    offset += 4;

    for (const b of commentBytes) {
      view.setUint32(offset, b.length, true);
      offset += 4;
      vorbisBlock.set(b, offset);
      offset += b.length;
    }

    // Combine: fLaC (4) + STREAMINFO (4 + 34 = 38) + VORBIS_COMMENT (4 + vorbisBlockLength)
    const streamInfoPayload = new Uint8Array(34);
    // Set 96kHz, 24-bit, 2-ch:
    // sample rate = 96000 (0x17700), ch = 2 (1), bitDepth = 24 (23 = 0x17)
    streamInfoPayload[10] = 0x17;
    streamInfoPayload[11] = 0x70;
    streamInfoPayload[12] = 0x02; // channels & bit depth
    streamInfoPayload[13] = 0x70;

    const total = 4 + 4 + 34 + 4 + vorbisBlockLength;
    const buffer = new Uint8Array(total);
    buffer[0] = 0x66; buffer[1] = 0x4c; buffer[2] = 0x61; buffer[3] = 0x43; // 'fLaC'

    // Block 0: STREAMINFO (not last)
    buffer[4] = 0x00; // Type 0, isLast = false
    buffer[5] = 0x00; buffer[6] = 0x00; buffer[7] = 34;
    buffer.set(streamInfoPayload, 8);

    // Block 1: VORBIS_COMMENT (last block)
    const vOffset = 8 + 34;
    buffer[vOffset] = 0x84; // Type 4, isLast = true (0x80 | 0x04)
    buffer[vOffset + 1] = (vorbisBlockLength >> 16) & 0xff;
    buffer[vOffset + 2] = (vorbisBlockLength >> 8) & 0xff;
    buffer[vOffset + 3] = vorbisBlockLength & 0xff;
    buffer.set(vorbisBlock, vOffset + 4);

    return buffer;
  }

  it('should parse FLAC header, STREAMINFO, and Vorbis comments accurately', () => {
    const buffer = createSyntheticFlacBuffer();
    const parsed = FlacVorbisParser.parse(buffer);

    expect(parsed.title).toBe('Echoes');
    expect(parsed.artist).toBe('Pink Floyd');
    expect(parsed.album).toBe('Meddle');
    expect(parsed.year).toBe(1971);
    expect(parsed.genre).toBe('Progressive Rock');
    expect(parsed.trackNumber).toBe(6);
    expect(parsed.isLossless).toBe(true);
    expect(parsed.container).toBe('flac');
    expect(parsed.sampleRate).toBe(96000);
    expect(parsed.channels).toBe(2);
  });
});
