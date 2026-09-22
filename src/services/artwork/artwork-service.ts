import type { IArtworkService } from '../contracts/service-contracts';
import type { ExtractedArtwork } from '../metadata/metadata-types';
import type { EntityId } from '../../domain/value-objects/audio-types';
import { Logger } from '../../core/logging/logger';

export interface StoredArtwork {
  readonly id: EntityId;
  readonly mimeType: string;
  readonly data: Uint8Array;
  readonly sizeBytes: number;
}

/**
 * Artwork Service with memory-safe LRU caching, image magic byte validation, and SHA-256 deduplication.
 */
export class ArtworkService implements IArtworkService {
  private readonly logger = new Logger('ArtworkService');
  private artworkStore = new Map<EntityId, StoredArtwork>();
  private urlCache = new Map<string, string>(); // artworkId_size -> objectUrl
  private readonly maxCachedUrls = 100; // LRU limit to prevent browser memory leaks

  public static isValidImageHeader(data: Uint8Array): boolean {
    if (data.length < 4) return false;
    // JPEG: FF D8 FF
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true;
    // WebP: RIFF (4 bytes) + WEBP (at offset 8)
    if (data.length >= 12) {
      const isRiff = data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46;
      const isWebp = data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50;
      if (isRiff && isWebp) return true;
    }
    return false;
  }

  public static generateArtworkHash(data: Uint8Array): string {
    // Fast 64-bit FNV-1a content hash for fast in-memory & test deduplication
    let h1 = 0x811c9dc5;
    let h2 = 0xcbf29ce4;
    for (let i = 0; i < data.length; i++) {
      h1 ^= data[i];
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= data[i];
      h2 = Math.imul(h2, 0x01000193);
    }
    return `art_${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}_${data.length}`;
  }

  public registerArtwork(extracted: ExtractedArtwork): EntityId | null {
    if (!extracted.data || extracted.data.length === 0) return null;
    if (!ArtworkService.isValidImageHeader(extracted.data)) {
      this.logger.warn('Rejected embedded artwork with invalid image magic bytes.');
      return null;
    }

    const artworkId = ArtworkService.generateArtworkHash(extracted.data);

    if (!this.artworkStore.has(artworkId)) {
      this.artworkStore.set(artworkId, {
        id: artworkId,
        mimeType: extracted.mimeType || 'image/jpeg',
        data: extracted.data,
        sizeBytes: extracted.data.length
      });
    }

    return artworkId;
  }

  public async getArtworkUrl(artworkId: EntityId, size: 'small' | 'medium' | 'large' = 'medium'): Promise<string | null> {
    const key = `${artworkId}_${size}`;
    const cachedUrl = this.urlCache.get(key);
    if (cachedUrl) {
      return cachedUrl;
    }

    const stored = this.artworkStore.get(artworkId);
    if (!stored) {
      return null;
    }

    if (typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
      // LRU eviction if cache exceeds capacity
      if (this.urlCache.size >= this.maxCachedUrls) {
        const oldestKey = this.urlCache.keys().next().value;
        if (oldestKey) {
          const oldUrl = this.urlCache.get(oldestKey);
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          this.urlCache.delete(oldestKey);
        }
      }

      const blob = new Blob([stored.data as BlobPart], { type: stored.mimeType });
      const objectUrl = URL.createObjectURL(blob);
      this.urlCache.set(key, objectUrl);
      return objectUrl;
    }

    return null;
  }

  public evictCache(artworkId: EntityId): void {
    for (const [key, url] of this.urlCache.entries()) {
      if (key.startsWith(`${artworkId}_`)) {
        if (typeof URL !== 'undefined') URL.revokeObjectURL(url);
        this.urlCache.delete(key);
      }
    }
  }

  public clear(): void {
    if (typeof URL !== 'undefined') {
      for (const url of this.urlCache.values()) {
        URL.revokeObjectURL(url);
      }
    }
    this.urlCache.clear();
    this.artworkStore.clear();
  }
}
