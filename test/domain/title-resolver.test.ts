import { describe, it, expect } from 'vitest';
import { resolveDisplayTitle, cleanFilenameTitle } from '../../src/domain/utils/title-resolver';
import type { Track } from '../../src/domain/entities/models';

describe('Title Resolution & Display Strategy (Issue 1)', () => {
  const createMockTrack = (overrides?: Partial<Track>): Track => ({
    id: 'track_1',
    fileId: 'file_1',
    title: 'Midnight Resonance',
    artistName: 'Synth Artist',
    albumTitle: 'Neon Cosmos',
    durationMs: 180000,
    format: { container: 'flac', codec: 'flac', isLossless: true, sampleRate: 44100, channels: 2 },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 5,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available',
    ...overrides
  });

  describe('cleanFilenameTitle', () => {
    it('removes common audio file extensions', () => {
      expect(cleanFilenameTitle('track01.mp3')).toBe('track01');
      expect(cleanFilenameTitle('symphony_no_5.flac')).toBe('symphony no 5');
      expect(cleanFilenameTitle('audio_sample.wav')).toBe('audio sample');
      expect(cleanFilenameTitle('podcast_ep12.m4a')).toBe('podcast ep12');
      expect(cleanFilenameTitle('lossless_track.opus')).toBe('lossless track');
      expect(cleanFilenameTitle('recording.alac')).toBe('recording');
    });

    it('handles filenames with paths (both forward and backward slashes)', () => {
      expect(cleanFilenameTitle('C:\\Music\\Electronic\\01_starlight.mp3')).toBe('starlight');
      expect(cleanFilenameTitle('/home/user/music/ambient/night_sky.flac')).toBe('night sky');
    });

    it('converts underscores to readable spaces while preserving hyphens and meaningful punctuation', () => {
      expect(cleanFilenameTitle('01_cyber_city_-_night_drive.flac')).toBe('cyber city - night drive');
      expect(cleanFilenameTitle('lo-fi_chill_beats_vol_1.mp3')).toBe('lo-fi chill beats vol 1');
      expect(cleanFilenameTitle('rock-and-roll_forever.mp3')).toBe('rock-and-roll forever');
    });

    it('preserves Unicode and international characters without mangling', () => {
      expect(cleanFilenameTitle('夜に駆ける.flac')).toBe('夜に駆ける');
      expect(cleanFilenameTitle('01_Café_del_Mar_—_Sunset.mp3')).toBe('Café del Mar — Sunset');
      expect(cleanFilenameTitle('Élégie_Op.24.wav')).toBe('Élégie Op.24');
      expect(cleanFilenameTitle('01_사랑해_-_K-Pop_Hit.mp3')).toBe('사랑해 - K-Pop Hit');
    });

    it('handles long complex titles without layout breaking', () => {
      const longFilename = '01_The_Extremely_Long_Concert_Concerto_No_4_in_D_Minor_Opus_102_Allegro_Maestoso_Remastered_2026_Deluxe_Edition.flac';
      const cleaned = cleanFilenameTitle(longFilename);
      expect(cleaned).toBe('The Extremely Long Concert Concerto No 4 in D Minor Opus 102 Allegro Maestoso Remastered 2026 Deluxe Edition');
    });

    it('returns empty string for empty or invalid inputs', () => {
      expect(cleanFilenameTitle('')).toBe('');
      expect(cleanFilenameTitle('   ')).toBe('');
    });
  });

  describe('resolveDisplayTitle', () => {
    it('uses valid embedded metadata title when available', () => {
      const track = createMockTrack({ title: 'Cosmic Journey (Extended Mix)' });
      expect(resolveDisplayTitle(track)).toBe('Cosmic Journey (Extended Mix)');
    });

    it('cleans raw filename-like titles that have extensions or raw underscores', () => {
      const track = createMockTrack({ title: '01_deep_space_exploration.flac' });
      expect(resolveDisplayTitle(track)).toBe('deep space exploration');
    });

    it('falls back to filename when title is empty or missing', () => {
      const track = createMockTrack({ title: '' });
      (track as any).filename = '02_ambient_nebula.mp3';
      expect(resolveDisplayTitle(track)).toBe('ambient nebula');
    });

    it('falls back to path when title and filename are absent', () => {
      const track = createMockTrack({ title: 'Unknown Track' });
      (track as any).path = 'C:\\Audio\\Solar_Wind.flac';
      expect(resolveDisplayTitle(track)).toBe('Solar Wind');
    });

    it('handles strings passed directly to resolveDisplayTitle', () => {
      expect(resolveDisplayTitle('01_supernova_explosion.wav')).toBe('supernova explosion');
      expect(resolveDisplayTitle('Standard Song Title')).toBe('Standard Song Title');
      expect(resolveDisplayTitle('')).toBe('Unknown Title');
      expect(resolveDisplayTitle(null)).toBe('Unknown Title');
      expect(resolveDisplayTitle(undefined)).toBe('Unknown Title');
    });

    it('preserves legitimate hyphens and parentheses in song titles', () => {
      const track = createMockTrack({ title: 'A-Ha - Take On Me (2026 Remaster)' });
      expect(resolveDisplayTitle(track)).toBe('A-Ha - Take On Me (2026 Remaster)');
    });

    it('preserves Unicode titles in track objects', () => {
      const track = createMockTrack({ title: '春よ、来い (Haru Yo, Koi)' });
      expect(resolveDisplayTitle(track)).toBe('春よ、来い (Haru Yo, Koi)');
    });
  });
});
