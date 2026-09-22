import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../src/services/search/search-service';
import type { Track, Album, Artist, Playlist, Genre, Folder } from '../../src/domain/entities/models';

describe('SearchService', () => {
  let searchService: SearchService;

  const mockTracks: Track[] = [
    {
      id: 't1',
      fileId: 'f1',
      title: 'Bohemian Rhapsody',
      artistName: 'Queen',
      albumTitle: 'A Night at the Opera',
      genreName: 'Rock',
      durationMs: 354000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: 1,
      dateModified: 1,
      playCount: 100,
      isFavorite: true,
      hasLyrics: true,
      availability: 'available'
    },
    {
      id: 't2',
      fileId: 'f2',
      title: 'Under Pressure',
      artistName: 'Queen & David Bowie',
      albumTitle: 'Hot Space',
      genreName: 'Rock',
      durationMs: 248000,
      format: { container: 'flac', codec: 'flac', sampleRate: 96000, channels: 2, isLossless: true },
      dateAdded: 2,
      dateModified: 2,
      playCount: 50,
      isFavorite: false,
      hasLyrics: false,
      availability: 'missing'
    }
  ];

  const mockAlbums: Album[] = [
    {
      id: 'al1',
      title: 'A Night at the Opera',
      artistName: 'Queen',
      trackCount: 12,
      durationMs: 2600000,
      isCompilation: false,
      dateAdded: 1
    }
  ];

  const mockArtists: Artist[] = [
    {
      id: 'ar1',
      name: 'Queen',
      trackCount: 2,
      albumCount: 1
    },
    {
      id: 'ar2',
      name: 'David Bowie',
      trackCount: 1,
      albumCount: 0
    }
  ];

  const mockPlaylists: Playlist[] = [
    {
      id: 'p1',
      name: 'Best of Queen Rock',
      description: 'Greatest hits collection',
      isSmart: false,
      createdAt: 1,
      updatedAt: 1,
      trackCount: 10,
      durationMs: 3600000
    }
  ];

  const mockGenres: Genre[] = [
    { id: 'g1', name: 'Rock', trackCount: 2 },
    { id: 'g2', name: 'Pop', trackCount: 0 }
  ];

  const mockFolders: Folder[] = [
    { id: 'fol1', name: 'Queen Collection', path: 'C:/Music/Queen', isMonitored: true, trackCount: 2 }
  ];

  beforeEach(() => {
    const mockTrackRepo = {
      list: vi.fn().mockResolvedValue({ items: mockTracks, total: mockTracks.length, offset: 0, limit: 50 }),
      getById: vi.fn(),
      getByFileId: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn(),
      setFavorite: vi.fn(),
      incrementPlayCount: vi.fn(),
      count: vi.fn().mockResolvedValue(mockTracks.length)
    };

    const mockAlbumRepo = {
      list: vi.fn().mockResolvedValue({ items: mockAlbums, total: mockAlbums.length, offset: 0, limit: 50 }),
      getById: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn()
    };

    const mockArtistRepo = {
      list: vi.fn().mockResolvedValue({ items: mockArtists, total: mockArtists.length, offset: 0, limit: 50 }),
      getById: vi.fn(),
      getByName: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn()
    };

    const mockPlaylistRepo = {
      list: vi.fn().mockResolvedValue({ items: mockPlaylists, total: mockPlaylists.length, offset: 0, limit: 50 }),
      getById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      getItems: vi.fn(),
      setItems: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn()
    };

    const mockGenreRepo = {
      list: vi.fn().mockResolvedValue({ items: mockGenres, total: mockGenres.length, offset: 0, limit: 50 }),
      getById: vi.fn(),
      getByName: vi.fn(),
      save: vi.fn()
    };

    const mockFolderRepo = {
      listChildren: vi.fn().mockResolvedValue(mockFolders),
      getById: vi.fn(),
      getByPath: vi.fn(),
      save: vi.fn(),
      delete: vi.fn()
    };

    searchService = new SearchService({
      trackRepo: mockTrackRepo as any,
      albumRepo: mockAlbumRepo as any,
      artistRepo: mockArtistRepo as any,
      playlistRepo: mockPlaylistRepo as any,
      genreRepo: mockGenreRepo as any,
      folderRepo: mockFolderRepo as any
    });
  });

  it('should return empty results for empty or whitespace-only queries', async () => {
    const emptyResult = await searchService.search('');
    expect(emptyResult.tracks).toHaveLength(0);
    expect(emptyResult.albums).toHaveLength(0);
    expect(emptyResult.artists).toHaveLength(0);
    expect(emptyResult.playlists).toHaveLength(0);

    const spaceResult = await searchService.search('   ');
    expect(spaceResult.tracks).toHaveLength(0);
  });

  it('should execute unified multi-category search across all entities', async () => {
    const results = await searchService.search('queen');
    expect(results.tracks.length).toBeGreaterThanOrEqual(1);
    expect(results.albums.length).toBeGreaterThanOrEqual(1);
    expect(results.artists.length).toBeGreaterThanOrEqual(1);
    expect(results.playlists.length).toBeGreaterThanOrEqual(1);
    expect(results.folders?.length).toBeGreaterThanOrEqual(1);
  });

  it('should preserve missing availability flag on tracks in search results', async () => {
    const results = await searchService.search('pressure');
    expect(results.tracks).toHaveLength(1);
    expect(results.tracks[0]?.id).toBe('t2');
    expect(results.tracks[0]?.availability).toBe('missing');
  });

  it('should support dedicated paginated searches', async () => {
    const paginatedTracks = await searchService.searchTracks('queen', { offset: 0, limit: 1 });
    expect(paginatedTracks.items).toHaveLength(1);
    expect(paginatedTracks.total).toBe(2);
    expect(paginatedTracks.limit).toBe(1);

    const paginatedArtists = await searchService.searchArtists('david');
    expect(paginatedArtists.items).toHaveLength(1);
    expect(paginatedArtists.items[0]?.name).toBe('David Bowie');
  });
});
