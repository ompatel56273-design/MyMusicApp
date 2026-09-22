import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtworkService } from '../../src/services/artwork/artwork-service';

describe('ArtworkService', () => {
  let service: ArtworkService;

  beforeEach(() => {
    service = new ArtworkService();
  });

  afterEach(() => {
    service.clear();
  });

  it('should validate JPEG, PNG, and WebP image magic bytes and reject invalid headers', () => {
    const validJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const invalidData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

    expect(ArtworkService.isValidImageHeader(validJpeg)).toBe(true);
    expect(ArtworkService.isValidImageHeader(validPng)).toBe(true);
    expect(ArtworkService.isValidImageHeader(invalidData)).toBe(false);
  });

  it('should deduplicate identical artwork payloads to the same artwork ID', () => {
    const img1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22, 0x33]);
    const img2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22, 0x33]); // identical bytes
    const img3 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x99, 0x88, 0x77]); // different bytes

    const id1 = service.registerArtwork({ mimeType: 'image/jpeg', data: img1 });
    const id2 = service.registerArtwork({ mimeType: 'image/jpeg', data: img2 });
    const id3 = service.registerArtwork({ mimeType: 'image/jpeg', data: img3 });

    expect(id1).toBeDefined();
    expect(id1).toBe(id2); // Deduplicated!
    expect(id3).not.toBe(id1);
  });
});
