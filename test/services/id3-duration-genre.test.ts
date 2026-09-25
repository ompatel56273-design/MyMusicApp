import { describe, it, expect } from 'vitest';
import { ID3Parser } from '../../src/services/metadata/parsers/id3-parser';

describe('ID3Parser - Duration & Genre Improvements', () => {
  it('parses duration from TLEN frame in ID3v2 tag', () => {
    // Construct a minimal ID3v2.3 tag with TLEN frame = "240000" (4 minutes)
    const tlenContent = new TextEncoder().encode('\x00240000'); // 1 byte encoding flag (ISO-8859-1) + string
    const frameHeader = new Uint8Array([
      0x54, 0x4C, 0x45, 0x4E, // 'TLEN'
      0x00, 0x00, 0x00, tlenContent.length, // frame size
      0x00, 0x00 // flags
    ]);

    const tagSize = frameHeader.length + tlenContent.length;
    // ID3v2 header: ID3 (3 bytes) + ver (2 bytes) + flags (1 byte) + synchsafe size (4 bytes)
    const id3Header = new Uint8Array([
      0x49, 0x44, 0x33, // 'ID3'
      0x03, 0x00,       // v2.3
      0x00,             // flags
      0x00, 0x00, 0x00, tagSize // synchsafe size (fits in 7 bits)
    ]);

    const buffer = new Uint8Array(id3Header.length + frameHeader.length + tlenContent.length);
    buffer.set(id3Header, 0);
    buffer.set(frameHeader, id3Header.length);
    buffer.set(tlenContent, id3Header.length + frameHeader.length);

    const result = ID3Parser.parse(buffer);
    expect(result.durationMs).toBe(240000);
  });

  it('parses standard numeric ID3 genres like (17) into genre names', () => {
    // Construct a minimal ID3v2.3 tag with TCON frame = "(17)" (Rock)
    const tconContent = new TextEncoder().encode('\x00(17)');
    const frameHeader = new Uint8Array([
      0x54, 0x43, 0x4F, 0x4E, // 'TCON'
      0x00, 0x00, 0x00, tconContent.length,
      0x00, 0x00
    ]);

    const tagSize = frameHeader.length + tconContent.length;
    const id3Header = new Uint8Array([
      0x49, 0x44, 0x33,
      0x03, 0x00,
      0x00,
      0x00, 0x00, 0x00, tagSize
    ]);

    const buffer = new Uint8Array(id3Header.length + frameHeader.length + tconContent.length);
    buffer.set(id3Header, 0);
    buffer.set(frameHeader, id3Header.length);
    buffer.set(tconContent, id3Header.length + frameHeader.length);

    const result = ID3Parser.parse(buffer);
    expect(result.genre).toBe('Rock');
  });

  it('parses MPEG Layer III audio sync header and extracts sample rate, bitrate and channels', () => {
    // Construct an MPEG frame: sync word 0xFFE0
    // 0xFF, 0xFB (MPEG1, Layer 3, no CRC)
    // 0x90 (128 kbps, 44100 Hz, no padding)
    // 0x00 (Stereo)
    const frameHeader = new Uint8Array([
      0xFF, 0xFB, 0x90, 0x00
    ]);

    // Create a buffer of 1000 bytes with this frame at offset 0
    const buffer = new Uint8Array(1000);
    buffer.set(frameHeader, 0);

    const result = ID3Parser.parse(buffer);
    expect(result.sampleRate).toBe(44100);
    expect(result.bitrate).toBe(128);
    expect(result.channels).toBe(2);
    expect(result.durationMs).toBeGreaterThan(0);
  });
});
