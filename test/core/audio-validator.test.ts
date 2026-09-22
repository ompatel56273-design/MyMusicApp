import { describe, it, expect } from 'vitest';
import {
  isSupportedAudioFile,
  getAudioExtension,
  getAudioMimeType,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_AUDIO_EXTENSIONS_SET
} from '../../src/core/audio/audio-validator';

describe('AudioValidator', () => {
  it('recognizes all supported audio extensions', () => {
    expect(SUPPORTED_AUDIO_EXTENSIONS.length).toBeGreaterThan(5);
    const validExtensions = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'webm', 'aiff', 'aif', 'alac'];
    for (const ext of validExtensions) {
      expect(SUPPORTED_AUDIO_EXTENSIONS_SET.has(ext)).toBe(true);
      expect(isSupportedAudioFile(`test_song.${ext}`)).toBe(true);
      expect(getAudioExtension(`path/to/my_song.${ext.toUpperCase()}`)).toBe(ext);
    }
  });

  it('rejects unsupported non-audio file extensions', () => {
    const invalidFiles = ['document.pdf', 'image.jpg', 'video.mp4', 'script.js', 'styles.css', 'archive.zip', 'text.txt'];
    for (const file of invalidFiles) {
      expect(isSupportedAudioFile(file)).toBe(false);
      expect(getAudioExtension(file)).toBeNull();
    }
  });

  it('validates File objects with audio MIME type and extension', () => {
    const file1 = new File(['fake audio'], 'track.flac', { type: 'audio/flac' });
    const file2 = new File(['fake audio'], 'song.mp3', { type: 'audio/mpeg' });
    const file3 = new File(['fake image'], 'cover.png', { type: 'image/png' });

    expect(isSupportedAudioFile(file1)).toBe(true);
    expect(isSupportedAudioFile(file2)).toBe(true);
    expect(isSupportedAudioFile(file3)).toBe(false);
  });

  it('returns standard audio MIME types for containers', () => {
    expect(getAudioMimeType('track.mp3')).toBe('audio/mpeg');
    expect(getAudioMimeType('track.flac')).toBe('audio/flac');
    expect(getAudioMimeType('track.wav')).toBe('audio/wav');
    expect(getAudioMimeType('track.m4a')).toBe('audio/mp4');
    expect(getAudioMimeType('track.ogg')).toBe('audio/ogg');
  });
});
