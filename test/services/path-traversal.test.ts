import { describe, it, expect } from 'vitest';
import { BaseFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';

describe('Path Traversal Hardening', () => {
  const adapter = new BaseFilesystemAdapter();

  it('normalizes standard relative and nested paths', () => {
    expect(adapter.normalizePath('folder/file.mp3')).toBe('folder/file.mp3');
    expect(adapter.normalizePath('music/rock/song.flac')).toBe('music/rock/song.flac');
  });

  it('resolves current directory dot segments (.)', () => {
    expect(adapter.normalizePath('folder/./file.mp3')).toBe('folder/file.mp3');
    expect(adapter.normalizePath('./music/./artist/./track.wav')).toBe('music/artist/track.wav');
  });

  it('resolves parent directory dot-dot segments (..)', () => {
    expect(adapter.normalizePath('folder/../file.mp3')).toBe('file.mp3');
    expect(adapter.normalizePath('music/rock/../pop/song.mp3')).toBe('music/pop/song.mp3');
  });

  it('handles relative traversal outside current scope safely', () => {
    expect(adapter.normalizePath('../../outside.mp3')).toBe('../../outside.mp3');
    expect(adapter.normalizePath('folder/../../outside.mp3')).toBe('../outside.mp3');
  });

  it('handles absolute root traversal without escaping past root', () => {
    expect(adapter.normalizePath('/folder/../../outside.mp3')).toBe('/outside.mp3');
    expect(adapter.normalizePath('C:/Music/../BigLibrary/file.mp3')).toBe('C:/BigLibrary/file.mp3');
  });

  it('handles Windows backslash separators cleanly', () => {
    expect(adapter.normalizePath('C:\\Users\\Music\\Song.mp3')).toBe('C:/Users/Music/Song.mp3');
    expect(adapter.normalizePath('folder\\subfolder\\..\\file.mp3')).toBe('folder/file.mp3');
  });

  it('collapses repeated slashes and handles empty segments', () => {
    expect(adapter.normalizePath('folder///subfolder////file.mp3')).toBe('folder/subfolder/file.mp3');
    expect(adapter.normalizePath('')).toBe('');
  });

  it('preserves unicode and special filename characters', () => {
    expect(adapter.normalizePath('Music/Für Elise - 🎵.flac')).toBe('Music/Für Elise - 🎵.flac');
  });
});
