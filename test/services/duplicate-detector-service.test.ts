import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DuplicateDetectorService } from '../../src/services/duplicate/duplicate-detector-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track } from '../../src/domain/entities/models';

describe('DuplicateDetectorService', () => {
  let detector: DuplicateDetectorService;
  let eventBus: EventBus;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let tracks: Track[];

  beforeEach(() => {
    eventBus = new EventBus();
    tracks = [];

    mockTrackRepo = {
      list: vi.fn().mockImplementation(() => Promise.resolve({ items: tracks, total: tracks.length, offset: 0, limit: 50000 })),
      delete: vi.fn().mockImplementation((id: string) => {
        tracks = tracks.filter(t => t.id !== id);
        return Promise.resolve();
      })
    };

    mockAudioFileRepo = {
      listAllPaths: vi.fn().mockResolvedValue(new Map())
    };

    detector = new DuplicateDetectorService({
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      eventBus
    });
  });

  it('detects exact file duplicates pointing to the same file path', async () => {
    tracks = [
      {
        id: 'track_1',
        fileId: 'file_1',
        title: 'Bohemian Rhapsody',
        artistName: 'Queen',
        durationMs: 354000,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false, bitrate: 320 },
        dateAdded: 1000,
        dateModified: 1000,
        playCount: 10,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available',
        path: '/music/queen/bohemian.mp3',
        fileSize: 8500000
      } as any,
      {
        id: 'track_2',
        fileId: 'file_1_dup',
        title: 'Bohemian Rhapsody',
        artistName: 'Queen',
        durationMs: 354000,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false, bitrate: 128 },
        dateAdded: 2000,
        dateModified: 2000,
        playCount: 0,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        path: '/music/queen/bohemian.mp3',
        fileSize: 8500000
      } as any
    ];

    const result = await detector.detectDuplicates();

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.matchLevel).toBe('exact_file');
    expect(result.groups[0]!.primaryTrack.id).toBe('track_1'); // 320kbps + favorite + higher play count preferred
    expect(result.groups[0]!.candidates).toHaveLength(1);
    expect(result.groups[0]!.candidates[0]!.track.id).toBe('track_2');
    expect(result.totalDuplicateTracks).toBe(1);
  });

  it('detects metadata fingerprint duplicates with near-identical duration', async () => {
    tracks = [
      {
        id: 'track_a',
        fileId: 'file_a',
        title: 'Hotel California',
        artistName: 'Eagles',
        albumTitle: 'Hotel California',
        durationMs: 390000,
        format: { container: 'flac', codec: 'flac', sampleRate: 96000, channels: 2, isLossless: true, bitrate: 2400 },
        dateAdded: 1000,
        dateModified: 1000,
        playCount: 5,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      },
      {
        id: 'track_b',
        fileId: 'file_b',
        title: 'Hotel California',
        artistName: 'Eagles',
        albumTitle: 'Greatest Hits',
        durationMs: 390500, // 500ms difference within tolerance
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false, bitrate: 320 },
        dateAdded: 2000,
        dateModified: 2000,
        playCount: 1,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      }
    ];

    const result = await detector.detectDuplicates();

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.matchLevel).toBe('exact_metadata');
    expect(result.groups[0]!.primaryTrack.id).toBe('track_a'); // Lossless FLAC preferred over MP3
    expect(result.groups[0]!.candidates[0]!.track.id).toBe('track_b');
  });

  it('protects false-positives: Remix vs Original must NOT be treated as duplicates', async () => {
    tracks = [
      {
        id: 'track_orig',
        fileId: 'file_orig',
        title: 'Levitating',
        artistName: 'Dua Lipa',
        durationMs: 203000,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false, bitrate: 320 },
        dateAdded: 1000,
        dateModified: 1000,
        playCount: 20,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available'
      },
      {
        id: 'track_remix',
        fileId: 'file_remix',
        title: 'Levitating (Remix)',
        artistName: 'Dua Lipa',
        durationMs: 203200,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false, bitrate: 320 },
        dateAdded: 2000,
        dateModified: 2000,
        playCount: 5,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      }
    ];

    const result = await detector.detectDuplicates();

    expect(result.groups).toHaveLength(0);
    expect(result.totalDuplicateTracks).toBe(0);
  });

  it('protects false-positives: Live version vs Original must NOT be treated as duplicates', async () => {
    tracks = [
      {
        id: 't_studio',
        fileId: 'f_studio',
        title: 'Comfortably Numb',
        artistName: 'Pink Floyd',
        durationMs: 382000,
        format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
        dateAdded: 1000,
        dateModified: 1000,
        playCount: 15,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available'
      },
      {
        id: 't_live',
        fileId: 'f_live',
        title: 'Comfortably Numb (Live)',
        artistName: 'Pink Floyd',
        durationMs: 382500,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 2000,
        dateModified: 2000,
        playCount: 2,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      }
    ];

    const result = await detector.detectDuplicates();

    expect(result.groups).toHaveLength(0);
  });

  it('protects false-positives: Same title but different artists must NEVER match', async () => {
    tracks = [
      {
        id: 't_artist1',
        fileId: 'f1',
        title: 'Hello',
        artistName: 'Adele',
        durationMs: 295000,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000,
        playCount: 10,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      },
      {
        id: 't_artist2',
        fileId: 'f2',
        title: 'Hello',
        artistName: 'Lionel Richie',
        durationMs: 295200,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 2000,
        dateModified: 2000,
        playCount: 8,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      }
    ];

    const result = await detector.detectDuplicates();

    expect(result.groups).toHaveLength(0);
  });

  it('resolves duplicates non-destructively: deletes from DB and publishes LIBRARY_UPDATED', async () => {
    let updateFired = false;
    eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, () => {
      updateFired = true;
    });

    tracks = [
      { id: 'keep_1', fileId: 'f1', title: 'Song', durationMs: 180000, format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false }, dateAdded: 1, dateModified: 1, playCount: 0, isFavorite: false, hasLyrics: false, availability: 'available' },
      { id: 'del_1', fileId: 'f2', title: 'Song', durationMs: 180000, format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false }, dateAdded: 2, dateModified: 2, playCount: 0, isFavorite: false, hasLyrics: false, availability: 'available' }
    ];

    const result = await detector.resolveDuplicates([
      { trackId: 'del_1', action: 'remove_from_library' }
    ]);

    expect(result.removedCount).toBe(1);
    expect(mockTrackRepo.delete).toHaveBeenCalledWith('del_1');
    expect(tracks).toHaveLength(1);
    expect(tracks[0]!.id).toBe('keep_1');
    expect(updateFired).toBe(true);
  });
});
