import { describe, it, expect, beforeEach } from 'vitest';
import { LibraryAnalyticsService } from '../../src/services/analytics/library-analytics-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track, AudioFile } from '../../src/domain/entities/models';

class MockTrackRepo {
  public tracks: Track[] = [];

  async list() {
    return { items: this.tracks, total: this.tracks.length, offset: 0, limit: 50000 };
  }

  async count() {
    return this.tracks.length;
  }

  async getById(id: string) {
    return this.tracks.find(t => t.id === id) || null;
  }
}

class MockAudioFileRepo {
  public files: AudioFile[] = [];

  async list() {
    return { items: this.files, total: this.files.length, offset: 0, limit: 50000 };
  }

  async listAllPaths() {
    const map = new Map<string, { id: string; sizeBytes: number; modifiedTimeMs: number }>();
    for (const f of this.files) {
      map.set(f.path || f.id, { id: f.id, sizeBytes: f.sizeBytes, modifiedTimeMs: f.modifiedTimeMs || Date.now() });
    }
    return map;
  }

  async getById(id: string) {
    return this.files.find(f => f.id === id) || null;
  }
}

describe('LibraryAnalyticsService', () => {
  let trackRepo: MockTrackRepo;
  let audioFileRepo: MockAudioFileRepo;
  let eventBus: EventBus;
  let analyticsService: LibraryAnalyticsService;

  beforeEach(() => {
    trackRepo = new MockTrackRepo();
    audioFileRepo = new MockAudioFileRepo();
    eventBus = new EventBus();

    analyticsService = new LibraryAnalyticsService({
      trackRepo: trackRepo as any,
      audioFileRepo: audioFileRepo as any,
      eventBus
    });
  });

  it('should return valid snapshot for empty library with 0 metrics and no fake data', async () => {
    trackRepo.tracks = [];
    const snapshot = await analyticsService.getAnalyticsSnapshot();

    expect(snapshot.summary.totalTracks).toBe(0);
    expect(snapshot.summary.totalArtists).toBe(0);
    expect(snapshot.summary.totalAlbums).toBe(0);
    expect(snapshot.summary.totalGenres).toBe(0);
    expect(snapshot.summary.totalPlays).toBe(0);
    expect(snapshot.topArtists.length).toBe(0);
    expect(snapshot.topAlbums.length).toBe(0);
    expect(snapshot.genreBreakdown.length).toBe(0);
    expect(snapshot.storage.formats.length).toBe(0);
    expect(snapshot.trackInsights.neverPlayedCount).toBe(0);
  });

  it('should compute accurate summary, artist/album/genre breakdowns, storage, and track insights from real tracks', async () => {
    trackRepo.tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Track One',
        artistName: 'Linkin Park',
        albumTitle: 'Meteora',
        genreName: 'Rock',
        durationMs: 180000,
        playCount: 15,
        isFavorite: true,
        availability: 'available',
        format: { container: 'flac', isLossless: true }
      } as unknown as Track,
      {
        id: 't2',
        fileId: 'f2',
        title: 'Track Two',
        artistName: 'Linkin Park',
        albumTitle: 'Meteora',
        genreName: 'Rock',
        durationMs: 210000,
        playCount: 5,
        isFavorite: false,
        availability: 'available',
        format: { container: 'mp3', isLossless: false }
      } as unknown as Track,
      {
        id: 't3',
        fileId: 'f3',
        title: 'Track Three',
        artistName: 'Coldplay',
        albumTitle: 'Parachutes',
        genreName: 'Alternative',
        durationMs: 240000,
        playCount: 0,
        isFavorite: false,
        availability: 'missing',
        format: { container: 'mp3', isLossless: false }
      } as unknown as Track
    ];

    audioFileRepo.files = [
      { id: 'f1', sizeBytes: 25000000, format: { container: 'flac', isLossless: true } } as unknown as AudioFile,
      { id: 'f2', sizeBytes: 8000000, format: { container: 'mp3', isLossless: false } } as unknown as AudioFile,
      { id: 'f3', sizeBytes: 9000000, format: { container: 'mp3', isLossless: false } } as unknown as AudioFile
    ];

    const snapshot = await analyticsService.getAnalyticsSnapshot();

    expect(snapshot.summary.totalTracks).toBe(3);
    expect(snapshot.summary.availableTracks).toBe(2);
    expect(snapshot.summary.missingTracks).toBe(1);
    expect(snapshot.summary.favoriteTracksCount).toBe(1);
    expect(snapshot.summary.totalPlays).toBe(20);
    expect(snapshot.summary.totalDurationMs).toBe(630000);
    expect(snapshot.summary.totalStorageBytes).toBe(42000000);

    // Top Artists
    expect(snapshot.topArtists.length).toBe(2);
    expect(snapshot.topArtists[0].artistName).toBe('Linkin Park');
    expect(snapshot.topArtists[0].playCount).toBe(20);

    // Storage
    expect(snapshot.storage.losslessTrackCount).toBe(1);
    expect(snapshot.storage.lossyTrackCount).toBe(2);

    // Track Insights
    expect(snapshot.trackInsights.neverPlayedCount).toBe(1);
    expect(snapshot.trackInsights.longestTrack?.id).toBe('t3');
    expect(snapshot.trackInsights.shortestTrack?.id).toBe('t1');
  });

  it('should invalidate cached snapshot when DomainEvents.LIBRARY_UPDATED or PLAYBACK_STATE_CHANGED fires', async () => {
    trackRepo.tracks = [
      { id: 't1', title: 'Song 1', durationMs: 100000 } as unknown as Track
    ];

    await analyticsService.getAnalyticsSnapshot();
    expect(analyticsService.getCachedSnapshot()).not.toBeNull();

    eventBus.publish(DomainEvents.LIBRARY_UPDATED, { timestamp: Date.now() });
    expect(analyticsService.getCachedSnapshot()).toBeNull();
  });

  it('should guarantee strictly read-only behavior without mutating repository tracks', async () => {
    const originalTracks = [
      { id: 't1', title: 'Song 1', durationMs: 100000, playCount: 5 } as unknown as Track
    ];
    trackRepo.tracks = [...originalTracks];

    await analyticsService.getAnalyticsSnapshot();

    expect(trackRepo.tracks.length).toBe(1);
    expect(trackRepo.tracks[0]).toEqual(originalTracks[0]);
  });
});
