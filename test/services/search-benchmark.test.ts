import { describe, it, expect, vi } from 'vitest';
import { SearchService } from '../../src/services/search/search-service';
import type { Track, Album, Artist, Playlist } from '../../src/domain/entities/models';

describe('Search & Library Query Large-Library Benchmark', () => {
  it('should benchmark query latency across 5,000 synthetic tracks and measure execution time', async () => {
    const NUM_TRACKS = 5000;
    const syntheticTracks: Track[] = [];

    const genres = ['Rock', 'Electronic', 'Jazz', 'Classical', 'Ambient', 'Synthwave', 'Metal'];

    for (let i = 0; i < NUM_TRACKS; i++) {
      syntheticTracks.push({
        id: `track_${i}`,
        fileId: `file_${i}`,
        title: `Synthetic Track Title ${i} - ${i % 2 === 0 ? 'Remix' : 'Acoustic Edition'}`,
        artistName: `Artist Group ${(i % 50) + 1}`,
        albumTitle: `Studio Album ${(i % 100) + 1}`,
        genreName: genres[i % genres.length],
        durationMs: 180000 + (i % 60000),
        format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
        dateAdded: Date.now() - i * 1000,
        dateModified: Date.now() - i * 1000,
        playCount: i % 100,
        isFavorite: i % 10 === 0,
        hasLyrics: false,
        availability: 'available'
      });
    }

    const syntheticAlbums: Album[] = Array.from({ length: 100 }, (_, i) => ({
      id: `album_${i}`,
      title: `Studio Album ${i + 1}`,
      artistName: `Artist Group ${(i % 50) + 1}`,
      trackCount: 50,
      durationMs: 3600000,
      isCompilation: false,
      dateAdded: Date.now()
    }));

    const syntheticArtists: Artist[] = Array.from({ length: 50 }, (_, i) => ({
      id: `artist_${i}`,
      name: `Artist Group ${i + 1}`,
      trackCount: 100,
      albumCount: 2
    }));

    const syntheticPlaylists: Playlist[] = Array.from({ length: 20 }, (_, i) => ({
      id: `playlist_${i}`,
      name: `Curated Playlist ${i + 1}`,
      description: `Description for playlist ${i + 1}`,
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: 50,
      durationMs: 3600000
    }));

    const mockTrackRepo = {
      list: vi.fn().mockResolvedValue({ items: syntheticTracks, total: NUM_TRACKS, offset: 0, limit: 50 }),
      getById: vi.fn(),
      getByFileId: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn(),
      setFavorite: vi.fn(),
      incrementPlayCount: vi.fn(),
      count: vi.fn().mockResolvedValue(NUM_TRACKS)
    };

    const mockAlbumRepo = {
      list: vi.fn().mockResolvedValue({ items: syntheticAlbums, total: 100, offset: 0, limit: 50 }),
      getById: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn()
    };

    const mockArtistRepo = {
      list: vi.fn().mockResolvedValue({ items: syntheticArtists, total: 50, offset: 0, limit: 50 }),
      getById: vi.fn(),
      getByName: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn()
    };

    const mockPlaylistRepo = {
      list: vi.fn().mockResolvedValue({ items: syntheticPlaylists, total: 20, offset: 0, limit: 50 }),
      getById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      getItems: vi.fn(),
      setItems: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn()
    };

    const searchService = new SearchService({
      trackRepo: mockTrackRepo as any,
      albumRepo: mockAlbumRepo as any,
      artistRepo: mockArtistRepo as any,
      playlistRepo: mockPlaylistRepo as any
    });

    // 1. Benchmark Prefix Query
    const startPrefix = performance.now();
    const prefixResults = await searchService.search('Synthetic Track Title 10', 5);
    const durationPrefix = performance.now() - startPrefix;

    expect(prefixResults.tracks.length).toBeGreaterThanOrEqual(1);

    // 2. Benchmark Substring / Multi-word Query
    const startSubstring = performance.now();
    const substringResults = await searchService.search('Acoustic Edition', 5);
    const durationSubstring = performance.now() - startSubstring;

    expect(substringResults.tracks.length).toBeGreaterThanOrEqual(1);

    // 3. Benchmark Unified Multi-Category Query
    const startUnified = performance.now();
    const unifiedResults = await searchService.search('Artist Group 25', 5);
    const durationUnified = performance.now() - startUnified;

    expect(unifiedResults.artists.length).toBeGreaterThanOrEqual(1);
    expect(unifiedResults.tracks.length).toBeGreaterThanOrEqual(1);

    console.log(`
      [Search Large-Library Benchmark Results (${NUM_TRACKS.toLocaleString()} tracks)]
      Prefix Query Latency: ${durationPrefix.toFixed(2)}ms
      Substring Query Latency: ${durationSubstring.toFixed(2)}ms
      Unified Multi-Category Query Latency: ${durationUnified.toFixed(2)}ms
    `);
  });
});
