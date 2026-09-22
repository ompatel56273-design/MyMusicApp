import { describe, it, expect } from 'vitest';
import { BaseFilesystemAdapter, SUPPORTED_AUDIO_EXTENSIONS } from '../../src/services/scanner/filesystem-adapter';

describe('Scanner File Filtering & Format Recognition', () => {
  const adapter = new BaseFilesystemAdapter();

  it('should recognize all supported audio extensions per Docs/09_AUDIO_FORMAT_SUPPORT.md', () => {
    const supportedFiles = [
      'song.mp3',
      'track.flac',
      'audio.wav',
      'music.ogg',
      'track.m4a',
      'audio.aac',
      'podcast.opus',
      'stream.webm',
      'lossless.alac',
      'studio.aiff',
      'legacy.wma',
      'monkey.ape'
    ];

    for (const filename of supportedFiles) {
      expect(adapter.isAudioFile(filename)).toBe(true);
      const ext = adapter.getAudioExtension(filename);
      expect(ext).toBeDefined();
      expect(SUPPORTED_AUDIO_EXTENSIONS.has(ext!)).toBe(true);
    }
  });

  it('should ignore non-audio files, artwork, documents, and hidden files', () => {
    const nonAudioFiles = [
      'cover.jpg',
      'folder.png',
      'artwork.webp',
      'lyrics.lrc',
      'notes.txt',
      'checksums.md5',
      '.DS_Store',
      'Thumbs.db',
      'movie.mp4',
      'video.mkv',
      'archive.zip'
    ];

    for (const filename of nonAudioFiles) {
      expect(adapter.isAudioFile(filename)).toBe(false);
      expect(adapter.getAudioExtension(filename)).toBeNull();
    }
  });

  it('should normalize paths with mixed slashes correctly', () => {
    expect(adapter.normalizePath('C:\\Music\\Rock\\\\Song.mp3')).toBe('C:/Music/Rock/Song.mp3');
    expect(adapter.normalizePath('/home/user/music/')).toBe('/home/user/music');
    expect(adapter.normalizePath('music///albums///')).toBe('music/albums');
  });
});
