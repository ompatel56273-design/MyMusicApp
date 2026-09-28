import { describe, it, expect, beforeEach } from 'vitest';
import { LibraryHealthService } from '../../src/services/library/library-health-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track, AudioFile } from '../../src/domain/entities/models';

class MockTrackRepo {
  public tracks: Track[] = [];

  async list() {
    return { items: this.tracks, total: this.tracks.length, offset: 0, limit: 10000 };
  }

  async getById(id: string) {
    return this.tracks.find(t => t.id === id) || null;
  }
}

class MockAudioFileRepo {
  public files: AudioFile[] = [];

  async list() {
    return { items: this.files, total: this.files.length, offset: 0, limit: 10000 };
  }

  async getById(id: string) {
    return this.files.find(f => f.id === id) || null;
  }
}

class MockLibraryService {
  public trackCount = 0;
  public albumCount = 0;
  public artistCount = 0;

  async getLibraryStats() {
    return {
      trackCount: this.trackCount,
      albumCount: this.albumCount,
      artistCount: this.artistCount
    };
  }
}

describe('LibraryHealthService', () => {
  let trackRepo: MockTrackRepo;
  let audioFileRepo: MockAudioFileRepo;
  let libraryService: MockLibraryService;
  let eventBus: EventBus;
  let healthService: LibraryHealthService;

  beforeEach(() => {
    trackRepo = new MockTrackRepo();
    audioFileRepo = new MockAudioFileRepo();
    libraryService = new MockLibraryService();
    eventBus = new EventBus();

    healthService = new LibraryHealthService({
      libraryService: libraryService as any,
      trackRepo: trackRepo as any,
      audioFileRepo: audioFileRepo as any,
      eventBus
    });
  });

  it('should handle empty library gracefully with all-clear status', async () => {
    libraryService.trackCount = 0;
    const snapshot = await healthService.verifyLibraryHealth();

    expect(snapshot.status).toBe('all-clear');
    expect(snapshot.metrics.totalTracks).toBe(0);
    expect(snapshot.issues.length).toBe(0);
    expect(snapshot.verificationDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should detect complete vs missing metadata and invalid duration', async () => {
    libraryService.trackCount = 3;
    libraryService.albumCount = 1;
    libraryService.artistCount = 1;

    trackRepo.tracks = [
      {
        id: 'track1',
        fileId: 'file1',
        title: 'Healthy Track',
        artistName: 'Linkin Park',
        albumTitle: 'Meteora',
        genreName: 'Rock',
        durationMs: 180000,
        availability: 'available',
        format: { container: 'mp3', isLossless: false }
      } as unknown as Track,
      {
        id: 'track2',
        fileId: 'file2',
        title: 'Unknown Track',
        artistName: 'Unknown Artist',
        albumTitle: 'Unknown Album',
        genreName: 'Unknown Genre',
        durationMs: 0, // Invalid duration
        availability: 'available',
        format: { container: 'mp3', isLossless: false }
      } as unknown as Track,
      {
        id: 'track3',
        fileId: 'file3',
        title: 'Missing File Track',
        artistName: 'Artist B',
        albumTitle: 'Album B',
        genreName: 'Pop',
        durationMs: 200000,
        availability: 'missing', // Missing file
        format: { container: 'mp3', isLossless: false }
      } as unknown as Track
    ];

    const snapshot = await healthService.verifyLibraryHealth();

    expect(snapshot.status).toBe('needs-attention');
    expect(snapshot.metrics.completeMetadataCount).toBe(2);
    expect(snapshot.metrics.missingArtistCount).toBe(1);
    expect(snapshot.metrics.invalidDurationCount).toBe(1);
    expect(snapshot.metrics.missingFiles).toBe(1);
    expect(snapshot.issues.length).toBeGreaterThan(0);
  });

  it('should categorize unverifiable and unsupported files correctly', async () => {
    trackRepo.tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Unverifiable Track',
        artistName: 'Artist A',
        albumTitle: 'Album A',
        genreName: 'Rock',
        durationMs: 120000,
        availability: 'unverifiable',
        format: { container: 'mp3', isLossless: false }
      } as unknown as Track,
      {
        id: 't2',
        fileId: 'f2',
        title: 'Unsupported Track',
        artistName: 'Artist B',
        albumTitle: 'Album B',
        genreName: 'Pop',
        durationMs: 150000,
        availability: 'unsupported',
        format: { container: 'wav', isLossless: true }
      } as unknown as Track
    ];

    const snapshot = await healthService.verifyLibraryHealth();
    expect(snapshot.metrics.unverifiableFiles).toBe(1);
    expect(snapshot.metrics.unsupportedFiles).toBe(1);
  });

  it('should invalidate cache when DomainEvents.LIBRARY_UPDATED is published', async () => {
    await healthService.verifyLibraryHealth();
    expect(healthService.getCachedSnapshot()).not.toBeNull();

    eventBus.publish(DomainEvents.LIBRARY_UPDATED, { timestamp: Date.now() });
    expect(healthService.getCachedSnapshot()).toBeNull();
  });

  it('should support cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort(); // Cancel immediately

    const snapshot = await healthService.verifyLibraryHealth({ signal: controller.signal });
    expect(snapshot.isCancelled).toBe(true);
    expect(snapshot.status).toBe('verification-incomplete');
  });

  it('should remain strictly read-only and never mutate repository data', async () => {
    const initialTracks = [
      { id: 't1', fileId: 'f1', title: 'Song', artistName: 'Artist', durationMs: 100000, availability: 'missing', format: { container: 'mp3' } } as unknown as Track
    ];
    trackRepo.tracks = [...initialTracks];

    await healthService.verifyLibraryHealth();

    // Verify trackRepo remained untouched
    expect(trackRepo.tracks.length).toBe(1);
    expect(trackRepo.tracks[0]).toEqual(initialTracks[0]);
  });
});
