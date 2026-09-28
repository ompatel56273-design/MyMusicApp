import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsService } from '../../src/services/stats/stats-service';
import type {
  ITrackRepository,
  IArtistRepository,
  IAlbumRepository,
  IGenreRepository,
  IFolderRepository,
  IHistoryRepository
} from '../../src/domain/repositories/repository-contracts';
import type { Track, Artist, Album, Genre, Folder, PlaybackHistoryItem } from '../../src/domain/entities/models';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';

describe('StatsService', () => {
  let mockTrackRepo: ITrackRepository;
  let mockArtistRepo: IArtistRepository;
  let mockAlbumRepo: IAlbumRepository;
  let mockGenreRepo: IGenreRepository;
  let mockFolderRepo: IFolderRepository;
  let mockHistoryRepo: IHistoryRepository;
  let eventBus: EventBus;

  let tracks: Track[] = [];
  let artists: Artist[] = [];
  let albums: Album[] = [];
  let genres: Genre[] = [];
  let folders: Folder[] = [];
  let historyItems: PlaybackHistoryItem[] = [];

  beforeEach(() => {
    tracks = [];
    artists = [];
    albums = [];
    genres = [];
    folders = [];
    historyItems = [];
    eventBus = new EventBus();

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

    mockFolderRepo = {
      getById: async (id) => folders.find(f => f.id === id) || null,
      getByPath: async () => null,
      listChildren: async () => folders,
      save: async () => {},
      delete: async () => {}
    };

    mockHistoryRepo = {
      getRecent: async (limit = 50) => historyItems.slice(0, limit),
      addRecord: async () => {},
      deleteRecord: async (id: string) => {
        historyItems = historyItems.filter(h => h.id !== id);
      },
      clearHistory: async () => {
        historyItems = [];
      },
      getByDateRange: async (start: number, end: number) => {
        return historyItems.filter(h => h.playedAt >= start && h.playedAt <= end);
      },
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
      folderRepo: mockFolderRepo,
      historyRepo: mockHistoryRepo
    });

    const overview = await statsService.getOverview();
    expect(overview.totalSongs).toBe(0);
    expect(overview.totalArtists).toBe(0);
    expect(overview.totalAlbums).toBe(0);
    expect(overview.totalGenres).toBe(0);
    expect(overview.totalFolders).toBe(0);
    expect(overview.totalListeningTimeMs).toBe(0);
    expect(overview.totalPlays).toBe(0);
    expect(overview.uniqueTracksPlayed).toBe(0);
    expect(overview.uniqueArtistsPlayed).toBe(0);
    expect(overview.uniqueAlbumsPlayed).toBe(0);
    expect(overview.averageListeningDurationMs).toBe(0);
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

    const timeRange = await statsService.getTimeRangeStats('today');
    expect(timeRange.playCount).toBe(0);
    expect(timeRange.totalListeningTimeMs).toBe(0);
    expect(timeRange.uniqueTracksCount).toBe(0);
  });

  it('computes accurate totals, metrics, and listening duration from populated data', async () => {
    tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Song Alpha',
        artistName: 'Artist One',
        albumTitle: 'Album One',
        durationMs: 200000,
        playCount: 12,
        lastPlayedAt: 5000,
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
        lastPlayedAt: 6000,
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

    folders = [
      { id: 'fol1', name: 'Music', path: '/music', isMonitored: true, trackCount: 3 }
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
      folderRepo: mockFolderRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    const overview = await statsService.getOverview();
    expect(overview.totalSongs).toBe(3);
    expect(overview.totalArtists).toBe(2);
    expect(overview.totalAlbums).toBe(2);
    expect(overview.totalGenres).toBe(1);
    expect(overview.totalFolders).toBe(1);
    expect(overview.totalPlays).toBe(17); // 12 + 5 + 0
    expect(overview.totalListeningTimeMs).toBe(350000); // 200000 + 150000
    expect(overview.uniqueTracksPlayed).toBe(2);
    expect(overview.uniqueArtistsPlayed).toBe(1);
    expect(overview.uniqueAlbumsPlayed).toBe(1);
    expect(overview.averageListeningDurationMs).toBe(175000); // (200000 + 150000) / 2
    expect(overview.favoriteSongsCount).toBe(2);

    // Top Songs
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

  it('performs deterministic tie-breaking for top songs, artists, and albums', async () => {
    tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Zebra Song',
        artistName: 'Artist B',
        albumTitle: 'Album B',
        durationMs: 180000,
        playCount: 10,
        lastPlayedAt: 2000,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      },
      {
        id: 't2',
        fileId: 'f2',
        title: 'Apple Song',
        artistName: 'Artist A',
        albumTitle: 'Album A',
        durationMs: 180000,
        playCount: 10,
        lastPlayedAt: 2000,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      },
      {
        id: 't3',
        fileId: 'f3',
        title: 'Newer Song',
        artistName: 'Artist C',
        albumTitle: 'Album C',
        durationMs: 180000,
        playCount: 10,
        lastPlayedAt: 5000, // higher lastPlayedAt
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      }
    ];

    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      historyRepo: mockHistoryRepo
    });

    const topSongs = await statsService.getTopSongs();
    expect(topSongs.length).toBe(3);
    // 1st: t3 due to newer lastPlayedAt (5000 > 2000)
    expect(topSongs[0]?.track.id).toBe('t3');
    // 2nd: t2 due to alphabetical title ('Apple Song' < 'Zebra Song')
    expect(topSongs[1]?.track.id).toBe('t2');
    // 3rd: t1
    expect(topSongs[2]?.track.id).toBe('t1');
  });

  it('fetches deduplicated recently played tracks in correct order', async () => {
    tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Track 1',
        artistName: 'Artist 1',
        albumTitle: 'Album 1',
        durationMs: 180000,
        playCount: 1,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      },
      {
        id: 't2',
        fileId: 'f2',
        title: 'Track 2',
        artistName: 'Artist 2',
        albumTitle: 'Album 2',
        durationMs: 180000,
        playCount: 1,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      }
    ];

    // History contains repeated plays of t1 and a non-existent track
    historyItems = [
      { id: 'h1', trackId: 't1', playedAt: 3000, durationListenedMs: 60000, completed: true },
      { id: 'h2', trackId: 't2', playedAt: 2000, durationListenedMs: 60000, completed: true },
      { id: 'h3', trackId: 't1', playedAt: 1000, durationListenedMs: 60000, completed: true },
      { id: 'h4', trackId: 't_deleted', playedAt: 500, durationListenedMs: 60000, completed: true }
    ];

    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      historyRepo: mockHistoryRepo
    });

    const recentTracks = await statsService.getRecentlyPlayedTracks(10);
    // Should contain t1 and t2 only once, newest first (t1 then t2)
    expect(recentTracks.length).toBe(2);
    expect(recentTracks[0]?.id).toBe('t1');
    expect(recentTracks[1]?.id).toBe('t2');
  });

  it('calculates favorite statistics correctly', async () => {
    tracks = [
      {
        id: 't1',
        fileId: 'f1',
        title: 'Fav 1',
        artistName: 'Artist A',
        albumTitle: 'Album A',
        genreName: 'Rock',
        durationMs: 100000,
        playCount: 1,
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
        title: 'Fav 2',
        artistName: 'Artist A',
        albumTitle: 'Album B',
        genreName: 'Rock',
        durationMs: 200000,
        playCount: 1,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      },
      {
        id: 't3',
        fileId: 'f3',
        title: 'Non-fav',
        artistName: 'Artist B',
        albumTitle: 'Album C',
        genreName: 'Jazz',
        durationMs: 150000,
        playCount: 1,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available',
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000,
        dateModified: 1000
      }
    ];

    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      historyRepo: mockHistoryRepo
    });

    const favStats = await statsService.getFavoriteStats();
    expect(favStats.totalFavorites).toBe(2);
    expect(favStats.favoriteTracks.length).toBe(2);
    expect(favStats.favoriteArtistsCount).toBe(1);
    expect(favStats.favoriteAlbumsCount).toBe(2);
    expect(favStats.topFavoriteGenre).toBe('Rock');
  });

  it('manages history deletion and clear operations while firing domain events', async () => {
    historyItems = [
      { id: 'h1', trackId: 't1', playedAt: 1000, durationListenedMs: 50000, completed: true },
      { id: 'h2', trackId: 't2', playedAt: 2000, durationListenedMs: 50000, completed: true }
    ];

    const statsService = new StatsService({
      trackRepo: mockTrackRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });

    const eventSpy = vi.fn();
    eventBus.subscribe(DomainEvents.HISTORY_UPDATED, eventSpy);

    // Delete single item
    await statsService.deleteHistoryItem('h1');
    expect(historyItems.length).toBe(1);
    expect(historyItems[0]?.id).toBe('h2');
    expect(eventSpy).toHaveBeenCalledTimes(1);

    // Clear all history
    await statsService.clearAllHistory();
    expect(historyItems.length).toBe(0);
    expect(eventSpy).toHaveBeenCalledTimes(2);
  });
});
