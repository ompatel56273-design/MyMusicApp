import type { ArtworkPayload } from './metadata-write-types';

export class ArtworkWriter {
  public static readonly MAX_ARTWORK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
  public static readonly SUPPORTED_MIME_TYPES: readonly string[] = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  /**
   * Validates an uploaded artwork File or Blob.
   */
  public static async validateImage(fileOrBlob: File | Blob): Promise<{ valid: boolean; mimeType?: string; reason?: string }> {
    try {
      const payload = await this.prepareArtworkPayload(fileOrBlob);
      return payload.mimeType ? { valid: true, mimeType: payload.mimeType } : { valid: true };
    } catch (err: any) {
      return { valid: false, reason: err?.message || 'Invalid image file.' };
    }
  }

  /**
   * Validates an uploaded artwork File or Blob and prepares an ArtworkPayload for tag embedding.
   */
  public static async prepareArtworkPayload(fileOrBlob: File | Blob): Promise<ArtworkPayload> {
    if (fileOrBlob.size > this.MAX_ARTWORK_SIZE_BYTES) {
      throw new Error(`Artwork image exceeds maximum safe size of 10MB (${(fileOrBlob.size / 1024 / 1024).toFixed(1)}MB).`);
    }

    const rawType = (fileOrBlob.type || '').toLowerCase();
    const mimeType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;

    if (mimeType && !this.SUPPORTED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported artwork image type "${mimeType}". Expected JPEG, PNG, or WebP.`);
    }

    const buffer = await fileOrBlob.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Verify magic bytes
    const detectedMime = this.detectImageMimeType(uint8Array);
    if (!detectedMime) {
      throw new Error('Invalid image binary: Header magic bytes do not match a valid JPEG, PNG, or WebP file.');
    }

    return {
      action: 'replace',
      data: uint8Array,
      mimeType: detectedMime
    };
  }

  private static detectImageMimeType(data: Uint8Array): string | null {
    if (data.length < 8) return null;

    // JPEG magic bytes: FF D8 FF
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47 &&
      data[4] === 0x0d &&
      data[5] === 0x0a &&
      data[6] === 0x1a &&
      data[7] === 0x0a
    ) {
      return 'image/png';
    }

    // WebP magic bytes: RIFF....WEBP
    if (
      data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
    ) {
      return 'image/webp';
    }

    return null;
  }
}
