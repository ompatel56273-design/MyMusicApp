import { describe, it, expect } from 'vitest';
import type { Track, AudioFile, Artist, Album } from '../../src/domain/entities/models';
import type { AudioFormatInfo } from '../../src/domain/value-objects/audio-types';

describe('Domain Purity & Models', () => {
  it('should instantiate Track and AudioFile with separate logical vs physical representation', () => {
    const audioFile: AudioFile = {
      id: 'file-123',
      path: '/music/rock/song.flac',
      filename: 'song.flac',
      extension: 'flac',
      sizeBytes: 35000000,
      modifiedTimeMs: 1700000000000,
      availability: 'available'
    };

    const format: AudioFormatInfo = {
      container: 'flac',
      codec: 'flac',
      sampleRate: 96000,
      bitDepth: 24,
      channels: 2,
      isLossless: true
    };

    const track: Track = {
      id: 'track-456',
      fileId: audioFile.id,
      title: 'Stairway to Sound',
      artistName: 'Led Sonic',
      albumTitle: 'Fourth Dimension',
      durationMs: 480000,
      format,
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: true,
      availability: 'available'
    };

    expect(track.fileId).toBe(audioFile.id);
    expect(track.format.isLossless).toBe(true);
    expect(track.format.bitDepth).toBe(24);
  });

  it('should instantiate Artist and Album models without browser dependencies', () => {
    const artist: Artist = {
      id: 'art-1',
      name: 'Pink Floyd',
      trackCount: 150,
      albumCount: 15
    };

    const album: Album = {
      id: 'alb-1',
      title: 'Dark Side of the Moon',
      artistId: artist.id,
      artistName: artist.name,
      year: 1973,
      trackCount: 10,
      durationMs: 2580000,
      isCompilation: false,
      dateAdded: Date.now()
    };

    expect(album.artistId).toBe(artist.id);
    expect(album.year).toBe(1973);
  });
});
