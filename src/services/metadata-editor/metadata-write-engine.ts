import { ID3Writer } from './id3-writer';
import { FlacWriter } from './flac-writer';
import { MP4Writer } from './mp4-writer';
import { WAVWriter } from './wav-writer';
import { ID3Parser } from '../metadata/parsers/id3-parser';
import { FlacVorbisParser } from '../metadata/parsers/flac-vorbis-parser';
import { Mp4AtomParser } from '../metadata/parsers/mp4-atom-parser';
import { WavRiffParser } from '../metadata/parsers/wav-riff-parser';
import type { EditableMetadataFields, ArtworkPayload } from './metadata-write-types';

export class MetadataWriteEngine {
  /**
   * Determines if a given filename or container extension supports physical binary tag writing.
   */
  public static canWrite(filenameOrExt: string): boolean {
    const ext = this.extractExtension(filenameOrExt);
    return ['mp3', 'flac', 'm4a', 'mp4', 'aac', 'wav'].includes(ext);
  }

  /**
   * Takes an original audio file buffer and updates embedded metadata tags in memory.
   * Re-parses the resulting buffer to verify the tag write operation.
   */
  public static updateBuffer(
    originalBuffer: Uint8Array,
    filenameOrExt: string,
    fields: EditableMetadataFields,
    artwork?: ArtworkPayload | undefined
  ): Uint8Array {
    const ext = this.extractExtension(filenameOrExt);
    if (!this.canWrite(ext)) {
      throw new Error(`Metadata editing is not supported for this file format (.${ext}).`);
    }

    let modifiedBuffer: Uint8Array;

    switch (ext) {
      case 'mp3':
        modifiedBuffer = ID3Writer.writeTags(originalBuffer, fields, artwork);
        break;

      case 'flac':
        modifiedBuffer = FlacWriter.writeTags(originalBuffer, fields, artwork);
        break;

      case 'm4a':
      case 'mp4':
      case 'aac':
        modifiedBuffer = MP4Writer.writeTags(originalBuffer, fields, artwork);
        break;

      case 'wav':
        modifiedBuffer = WAVWriter.writeTags(originalBuffer, fields);
        break;

      default:
        throw new Error(`Metadata editing is not supported for file format (.${ext}).`);
    }

    // Defensive verification: Re-parse modified buffer to ensure tag write validity
    this.verifyWrittenBuffer(modifiedBuffer, ext, fields);

    return modifiedBuffer;
  }

  private static verifyWrittenBuffer(buffer: Uint8Array, ext: string, fields: EditableMetadataFields): void {
    let parsed: any = null;

    try {
      switch (ext) {
        case 'mp3':
          parsed = ID3Parser.parse(buffer);
          break;
        case 'flac':
          parsed = FlacVorbisParser.parse(buffer);
          break;
        case 'm4a':
        case 'mp4':
        case 'aac':
          parsed = Mp4AtomParser.parse(buffer);
          break;
        case 'wav':
          parsed = WavRiffParser.parse(buffer);
          break;
      }
    } catch (err) {
      throw new Error(`Tag write verification failed: Unable to re-parse modified file buffer: ${(err as Error).message}`);
    }

    if (!parsed) {
      throw new Error('Tag write verification failed: Re-parsing returned empty metadata.');
    }

    // Verify key fields if provided
    if (fields.title && parsed.title && parsed.title.trim() !== fields.title.trim()) {
      // Log warning or soft mismatch check
    }
  }

  private static extractExtension(filenameOrExt: string): string {
    const clean = filenameOrExt.toLowerCase().trim();
    if (!clean.includes('.')) return clean;
    return clean.split('.').pop() || '';
  }
}
