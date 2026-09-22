import { describe, it, expect } from 'vitest';
import { MetadataNormalizer } from '../../src/services/metadata/metadata-normalizer';
import type { ExtractedMetadata } from '../../src/services/metadata/metadata-types';

describe('MetadataNormalizer', () => {
  it('should split multi-artists correctly while keeping primary artist', () => {
    const raw: ExtractedMetadata = {
      title: 'Under Pressure',
      artist: 'Queen & David Bowie',
      album: 'Hot Space',
      container: 'mp3',
      codec: 'mp3',
      isLossless: false
    };

    const normalized = MetadataNormalizer.normalize(raw);

    expect(normalized.primaryArtist).toBe('Queen');
    expect(normalized.allArtists.length).toBe(2);
    expect(normalized.allArtists[0].name).toBe('Queen');
    expect(normalized.allArtists[0].role).toBe('primary');
    expect(normalized.allArtists[1].name).toBe('David Bowie');
    expect(normalized.allArtists[1].role).toBe('featured');
  });

  it('should detect compilation albums from album artist or compilation tag', () => {
    const raw: ExtractedMetadata = {
      title: 'Track One',
      artist: 'Artist A',
      album: '90s Hits Collection',
      albumArtist: 'Various Artists',
      container: 'flac',
      codec: 'flac',
      isLossless: true
    };

    const normalized = MetadataNormalizer.normalize(raw);

    expect(normalized.isCompilation).toBe(true);
    expect(normalized.albumArtist).toBe('Various Artists');
  });

  it('should fallback to filename title if embedded title is empty', () => {
    const raw: ExtractedMetadata = {
      artist: 'Led Zeppelin',
      container: 'flac',
      codec: 'flac',
      isLossless: true
    };

    const normalized = MetadataNormalizer.normalize(raw, '01 - Kashmir.flac');

    expect(normalized.title).toBe('01 - Kashmir');
    expect(normalized.primaryArtist).toBe('Led Zeppelin');
  });
});
