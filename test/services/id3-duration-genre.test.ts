import { describe, it, expect } from 'vitest';
import { ID3Parser } from '../../src/services/metadata/parsers/id3-parser';

describe('ID3Parser MPEG & Genre Extraction', () => {
  it('should compute duration and bitrate from MPEG header for audio files', () => {
    // Construct fake 100KB buffer with MPEG frame header sync 0xFFE0
    const buffer = new Uint8Array(100000);
    // Sync word 0xFF, 0xFB (MPEG 1 Layer 3, 128kbps, 44100Hz)
    buffer[0] = 0xff;
    buffer[1] = 0xfb;
    buffer[2] = 0x90; // 128 kbps, 44100 Hz
    buffer[3] = 0x00;

    const res = ID3Parser.parse(buffer);
    expect(res).toBeDefined();
    expect(res.durationMs).toBeGreaterThan(0);
    expect(res.bitrate).toBe(128); // 128 kbps
    expect(res.sampleRate).toBe(44100);
  });
});
