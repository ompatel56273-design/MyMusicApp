import { describe, it, expect, beforeEach } from 'vitest';
import { CodecDetector } from '../../src/services/audio/codec-detector';

describe('CodecDetector', () => {
  beforeEach(() => {
    CodecDetector.resetCache();
  });

  it('should generate a comprehensive capability matrix for all supported containers', () => {
    const matrix = CodecDetector.getCapabilityMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(10);

    const mp3 = matrix.find(c => c.container === 'mp3');
    expect(mp3).toBeDefined();
    expect(mp3?.mimeType).toBe('audio/mpeg');

    const flac = matrix.find(c => c.container === 'flac');
    expect(flac).toBeDefined();
    expect(flac?.mimeType).toBe('audio/flac');

    const wav = matrix.find(c => c.container === 'wav');
    expect(wav).toBeDefined();
    expect(wav?.mimeType).toContain('audio/wav');
  });

  it('should accurately return capability for a specific container and codec', () => {
    const mp3Cap = CodecDetector.getCapability('mp3', 'mp3');
    expect(mp3Cap.container).toBe('mp3');
    expect(mp3Cap.codec).toBe('mp3');

    const unknownCap = CodecDetector.getCapability('unknown' as any, 'unknown' as any);
    expect(unknownCap.state).toBe('unknown');
    expect(unknownCap.canPlay).toBe('none');
  });

  it('should distinguish unverified/unsupported codecs such as WMA and APE', () => {
    const wmaCap = CodecDetector.getCapability('wma', 'unknown');
    expect(wmaCap.state).toMatch(/unsupported|limited/);

    const apeCap = CodecDetector.getCapability('ape', 'unknown');
    expect(apeCap.state).toMatch(/unsupported|limited/);
  });
});
