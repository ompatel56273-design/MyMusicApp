import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import type { Track } from '../../src/domain/entities/models';

describe('Database Stress & Performance Benchmark', () => {
  let adapter: IndexedDbAdapter;
  let trackRepo: TrackRepository;
  const dbName = `stress_test_db_${Date.now()}`;

  beforeEach(async () => {
    adapter = new IndexedDbAdapter(dbName, 1);
    await adapter.open();
    trackRepo = new TrackRepository(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it('should batch insert 5,000 synthetic tracks and measure query performance', async () => {
    const trackCount = 5000;
    const tracks: Track[] = [];

    for (let i = 1; i <= trackCount; i++) {
      tracks.push({
        id: `stress_t_${i}`,
        fileId: `stress_f_${i}`,
        title: `Synthetic Track ${i}`,
        artistId: `stress_art_${i % 100}`,
        artistName: `Artist ${i % 100}`,
        albumId: `stress_alb_${i % 250}`,
        albumTitle: `Album ${i % 250}`,
        genreId: `stress_gen_${i % 15}`,
        genreName: `Genre ${i % 15}`,
        durationMs: 180000 + (i % 60000),
        trackNumber: (i % 12) + 1,
        format: {
          container: i % 2 === 0 ? 'flac' : 'mp3',
          codec: i % 2 === 0 ? 'flac' : 'mp3',
          sampleRate: 44100,
          channels: 2,
          isLossless: i % 2 === 0
        },
        dateAdded: Date.now() + i,
        dateModified: Date.now(),
        playCount: i % 50,
        isFavorite: i % 10 === 0,
        hasLyrics: i % 4 === 0,
        availability: 'available'
      });
    }

    // Measure Batch Insertion
    const insertStart = performance.now();
    await trackRepo.saveBatch(tracks);
    const insertDurationMs = performance.now() - insertStart;

    const totalCount = await trackRepo.count();
    expect(totalCount).toBe(trackCount);

    // Measure Indexed Query Latency (by Album)
    const queryStart = performance.now();
    const albumTracks = await trackRepo.list(undefined, { albumId: 'stress_alb_50' });
    const queryDurationMs = performance.now() - queryStart;

    expect(albumTracks.items.length).toBeGreaterThan(0);

    // Measure Fast Pagination Latency (page size = 50)
    const pageStart = performance.now();
    const page = await trackRepo.list({ offset: 2500, limit: 50 });
    const pageDurationMs = performance.now() - pageStart;

    expect(page.items.length).toBe(50);
    expect(page.total).toBe(trackCount);

    console.info(`[Stress Benchmark Results]
      Inserted: ${trackCount} tracks in ${insertDurationMs.toFixed(2)}ms (${(insertDurationMs / trackCount).toFixed(3)}ms/track)
      Indexed Query: ${queryDurationMs.toFixed(2)}ms
      Pagination (offset=2500, limit=50): ${pageDurationMs.toFixed(2)}ms
    `);

    // Verify responsiveness thresholds
    expect(insertDurationMs).toBeLessThan(10000); // under 10s for 5k in-memory IDB
    expect(queryDurationMs).toBeLessThan(150);     // under 150ms for indexed query
    expect(pageDurationMs).toBeLessThan(500);      // under 500ms for page fetch
  });
});
