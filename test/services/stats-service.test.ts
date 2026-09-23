import { describe, it, expect, beforeEach } from 'vitest';
import { StatsService } from '../../src/services/stats/stats-service';
import type {
  ITrackRepository,
  IArtistRepository,
  IAlbumRepository,
  IGenreRepository,
  IHistoryRepository
} from '../../src/domain/repositories/repository-contracts';
import type { Track, Artist, Album, Genre, PlaybackHistoryItem } from '../../src/domain/entities/models';

describe('StatsService', () => {
  let mockTrackRepo: ITrackRepository;
  let mockArtistRepo: IArtistRepository;
  let mockAlbumRepo: IAlbumRepository;
  let mockGenreRepo: IGenreRepository;
  let mockHistoryRepo: IHistoryRepository;

  let tracks: Track[] = [];
  let artists: Artist[] = [];
  let albums: Album[] = [];
  let genres: Genre[] = [];
  let historyItems: PlaybackHistoryItem[] = [];

  beforeEach(() => {
    tracks = [];
    artists = [];
    albums = [];
    genres = [];
    historyItems = [];

    mockTrackRepo = {
      getById: async (id) => tracks.find(t => t.id === id) || null,
      getByFileId: async () => null,
      list: async (options) => {
        const limit = options?.limit ?? 50;
        const offset = options?.offset ?? 0;
        return {
          items: tracks.slice(offset, offset + limit),
          total: tracks.length,
          offset,
          limit
        };
      },
      save: async () => {},
      saveBatch: async () => {},
      delete: async () => {},
      setFavorite: async () => {},
      incrementPlayCount: async () => {},
      count: async () => tracks.length
    };

    mockArtistRepo = {
      getById: async (id) => artists.find(a => a.id === id) || null,
      getByName: async () => null,
      list: async (options) => ({
        items: artists.slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50)),
        total: artists.length,
        offset: options?.offset ?? 0,
        limit: options?.limit ?? 50
      }),
      save: async () => {},
      saveBatch: async () => {},
      delete: async () => {}
    };

    mockAlbumRepo = {
      getById: async (id) => albums.find(a => a.id === id) || null,
      list: async (options) => ({
        items: albums.slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50)),
        total: albums.length,
        offset: options?.offset ?? 0,
        limit: options?.limit ?? 50
      }),
      save: async () => {},
      saveBatch: async () => {},
      delete: async () => {}
    };

    mockGenreRepo = {
      getById: async (id) => genres.find(g => g.id === id) || null,
      getByName: async () => null,
      list: async (options) => ({
        items: genres.slice(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50)),
        total: genres.length,
        offset: options?.offset ?? 0,
        limit: options?.limit ?? 50
      }),
      save: async () => {}
    };

    mockHistoryRepo = {
      getRecent: async (limit = 50) => historyItems.slice(0, limit),
      addRecord: async () => {},
      getResumePosition: async () => null,
      saveResumePosition: async () => {},
      clearResumePosition: async () => {}
    };
  });

  it('handles empty library and zero listening history honestly', async () => {
    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      artistRepo: mockArtistRepo,
      albumRepo: mockAlbumRepo,
      genreRepo: mockGenreRepo,
      historyRepo: mockHistoryRepo
    });

    const overview = await statsService.getOverview();
    expect(overview.totalSongs).toBe(0);
    expect(overview.totalArtists).toBe(0);
    expect(overview.totalAlbums).toBe(0);
    expect(overview.totalGenres).toBe(0);
    expect(overview.totalListeningTimeMs).toBe(0);
    expect(overview.totalPlays).toBe(0);
    expect(overview.favoriteSongsCount).toBe(0);

    const topSongs = await statsService.getTopSongs();
    expect(topSongs).toEqual([]);

    const topArtists = await statsService.getTopArtists();
    expect(topArtists).toEqual([]);

    const topAlbums = await statsService.getTopAlbums();
    expect(topAlbums).toEqual([]);

    const recentHistory = await statsService.getRecentHistory();
    expect(recentHistory).toEqual([]);

    const activity = await statsService.getListeningActivity(7);
    expect(activity.length).toBe(7);
    expect(activity.every(a => a.playsCount === 0 && a.durationMs === 0)).toBe(true);
  });

  it('computes accurate totals and listening duration from populated data', async () => {
    tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Song Alpha',
        artistName: 'Artist One',
        albumTitle: 'Album One',
        durationMs: 200000,
        playCount: 12,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      },
      {
        id: 't2',
        fileId: 'f2',
        title: 'Song Beta',
        artistName: 'Artist One',
        albumTitle: 'Album One',
        durationMs: 180000,
        playCount: 5,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'flac', codec: 'flac', sampleRate: 96000, channels: 2, isLossless: true },
        dateAdded: 1000,
        dateModified: 1000
      },
      {
        id: 't3',
        fileId: 'f3',
        title: 'Song Gamma',
        artistName: 'Artist Two',
        albumTitle: 'Album Two',
        durationMs: 240000,
        playCount: 0,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'wav', codec: 'pcm', sampleRate: 48000, channels: 2, isLossless: true },
        dateAdded: 1000,
        dateModified: 1000
      }
    ];

    artists = [
      { id: 'art1', name: 'Artist One', trackCount: 2, albumCount: 1 },
      { id: 'art2', name: 'Artist Two', trackCount: 1, albumCount: 1 }
    ];

    albums = [
      { id: 'alb1', title: 'Album One', artistName: 'Artist One', trackCount: 2, year: 2024, durationMs: 380000, isCompilation: false, dateAdded: 1000 },
      { id: 'alb2', title: 'Album Two', artistName: 'Artist Two', trackCount: 1, year: 2023, durationMs: 240000, isCompilation: false, dateAdded: 1000 }
    ];

    genres = [
      { id: 'gen1', name: 'Synthwave', trackCount: 3 }
    ];

    historyItems = [
      { id: 'h1', trackId: 't1', playedAt: Date.now() - 10000, durationListenedMs: 200000, completed: true },
      { id: 'h2', trackId: 't2', playedAt: Date.now() - 5000, durationListenedMs: 150000, completed: true }
    ];

    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      artistRepo: mockArtistRepo,
      albumRepo: mockAlbumRepo,
      genreRepo: mockGenreRepo,
      historyRepo: mockHistoryRepo
    });

    const overview = await statsService.getOverview();
    expect(overview.totalSongs).toBe(3);
    expect(overview.totalArtists).toBe(2);
    expect(overview.totalAlbums).toBe(2);
    expect(overview.totalGenres).toBe(1);
    expect(overview.totalPlays).toBe(17); // 12 + 5 + 0
    expect(overview.totalListeningTimeMs).toBe(350000); // 200000 + 150000
    expect(overview.favoriteSongsCount).toBe(2);

    // Top Songs should exclude 0 playcount tracks
    const topSongs = await statsService.getTopSongs();
    expect(topSongs.length).toBe(2);
    expect(topSongs[0]?.track.title).toBe('Song Alpha');
    expect(topSongs[0]?.playCount).toBe(12);
    expect(topSongs[1]?.track.title).toBe('Song Beta');
    expect(topSongs[1]?.playCount).toBe(5);

    // Top Artists aggregation
    const topArtists = await statsService.getTopArtists();
    expect(topArtists.length).toBe(1);
    expect(topArtists[0]?.artistName).toBe('Artist One');
    expect(topArtists[0]?.playCount).toBe(17);
    expect(topArtists[0]?.trackCount).toBe(2);

    // Top Albums aggregation
    const topAlbums = await statsService.getTopAlbums();
    expect(topAlbums.length).toBe(1);
    expect(topAlbums[0]?.albumTitle).toBe('Album One');
    expect(topAlbums[0]?.playCount).toBe(17);

    // Recent History with track resolution
    const recent = await statsService.getRecentHistory();
    expect(recent.length).toBe(2);
    expect(recent[0]?.track.title).toBe('Song Alpha');
    expect(recent[1]?.track.title).toBe('Song Beta');
  });

  it('aggregates daily activity over the specified window', async () => {
    const today = Date.now();
    historyItems = [
      { id: 'h1', trackId: 't1', playedAt: today, durationListenedMs: 60000, completed: true },
      { id: 'h2', trackId: 't1', playedAt: today, durationListenedMs: 120000, completed: true }
    ];

    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      historyRepo: mockHistoryRepo
    });

    const activity = await statsService.getListeningActivity(7);
    expect(activity.length).toBe(7);
    const lastDay = activity[activity.length - 1];
    expect(lastDay?.playsCount).toBe(2);
    expect(lastDay?.durationMs).toBe(180000);
  });
});
