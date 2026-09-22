import { describe, it, expect } from 'vitest';
import { MetadataReader } from '../../src/services/metadata/metadata-reader';
import { MetadataNormalizer } from '../../src/services/metadata/metadata-normalizer';

describe('Metadata Large-Library Benchmark', () => {
  function createSyntheticID3Buffer(index: number): Uint8Array {
    const text = `Song Number ${index}`;
    const textBytes = new TextEncoder().encode(text);
    const frameData = new Uint8Array(1 + textBytes.length);
    frameData[0] = 3;
    frameData.set(textBytes, 1);

    const frame = new Uint8Array(10 + frameData.length);
    frame[0] = 0x54; frame[1] = 0x49; frame[2] = 0x54; frame[3] = 0x32; // 'TIT2'
    frame[7] = frameData.length;
    frame.set(frameData, 10);

    const buffer = new Uint8Array(10 + frame.length);
    buffer[0] = 0x49; buffer[1] = 0x44; buffer[2] = 0x33; buffer[3] = 3;
    buffer[9] = frame.length;
    buffer.set(frame, 10);

    return buffer;
  }

  it('should parse and normalize 1,000 synthetic metadata buffers with high throughput', async () => {
    const reader = new MetadataReader();
    const count = 1000;
    const buffers: Uint8Array[] = [];

    for (let i = 0; i < count; i++) {
      buffers.push(createSyntheticID3Buffer(i));
    }

    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const raw = await reader.readMetadata(buffers[i], 'mp3');
      const normalized = MetadataNormalizer.normalize(raw, `track_${i}.mp3`);
      expect(normalized.title).toBe(`Song Number ${i}`);
    }
    const durationMs = performance.now() - start;

    console.info(`[Metadata Large-Library Benchmark Results]
      Parsed & Normalized: ${count} tags in ${durationMs.toFixed(2)}ms (${(durationMs / count).toFixed(3)}ms/tag)
      Throughput: ${(count / (durationMs / 1000)).toFixed(0)} tags/second
    `);

    expect(durationMs).toBeLessThan(5000); // Under 5s for 1000 binary tag parses
  });
});
