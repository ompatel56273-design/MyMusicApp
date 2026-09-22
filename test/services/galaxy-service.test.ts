import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GalaxyService } from '../../src/services/galaxy/galaxy-service';
import type { ILibraryService, IPlaylistService } from '../../src/services/contracts/service-contracts';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import { DEFAULT_GALAXY_SETTINGS } from '../../src/domain/entities/galaxy-types';

describe('GalaxyService', () => {
  let mockLibraryService: ILibraryService;
  let mockPlaylistService: IPlaylistService;
  let mockDatabase: IDatabaseAdapter;
  let galaxyService: GalaxyService;
  let dbStore: Record<string, any>;

  beforeEach(() => {
    dbStore = {};
    mockDatabase = {
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
      get: vi.fn().mockImplementation(async (_store, key) => dbStore[key] ? { key, value: dbStore[key] } : null),
      getAll: vi.fn(),
      getByIndex: vi.fn(),
      getAllByIndex: vi.fn(),
      put: vi.fn().mockImplementation(async (_store, item) => {
        dbStore[item.key] = item.value;
      }),
      putBatch: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      transaction: vi.fn()
    };

    mockLibraryService = {
      getTrack: vi.fn().mockResolvedValue(null),
      listTracks: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'track_1',
            fileId: 'file_1',
            title: 'Paranoid Android',
            artistId: 'artist_1',
            artistName: 'Radiohead',
            albumId: 'album_1',
            albumTitle: 'OK Computer',
            genreId: 'genre_1',
            genreName: 'Alternative Rock',
            durationMs: 383000,
            format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, bitDepth: 16 },
            dateAdded: Date.now(),
            dateModified: Date.now(),
            playCount: 15,
            isFavorite: true,
            hasLyrics: true,
            availability: 'available'
          }
        ],
        total: 1,
        offset: 0,
        limit: 50
      }),
      getAlbum: vi.fn().mockResolvedValue(null),
      listAlbums: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'album_1',
            title: 'OK Computer',
            artistId: 'artist_1',
            artistName: 'Radiohead',
            genreId: 'genre_1',
            year: 1997,
            trackCount: 12,
            durationMs: 3180000,
            isCompilation: false,
            dateAdded: Date.now()
          }
        ],
        total: 1,
        offset: 0,
        limit: 50
      }),
      getArtist: vi.fn().mockResolvedValue(null),
      listArtists: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'artist_1',
            name: 'Radiohead',
            trackCount: 50,
            albumCount: 9
          }
        ],
        total: 1,
        offset: 0,
        limit: 50
      }),
      toggleFavorite: vi.fn().mockResolvedValue(true),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 1, albumCount: 1, artistCount: 1 }),
      listGenres: vi.fn().mockResolvedValue({
        items: [
          { id: 'genre_1', name: 'Alternative Rock', trackCount: 50 }
        ],
        total: 1,
        offset: 0,
        limit: 50
      }),
      listFolders: vi.fn().mockResolvedValue([
        { id: 'folder_1', path: 'C:/Music/Radiohead', name: 'Radiohead', isMonitored: true, trackCount: 12 }
      ])
    };

    mockPlaylistService = {
      getPlaylist: vi.fn().mockResolvedValue(null),
      getPlaylistWithTracks: vi.fn().mockResolvedValue(null),
      listPlaylists: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'playlist_1',
            name: 'Favorite Rock',
            isSmart: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            trackCount: 10,
            durationMs: 2400000
          }
        ],
        total: 1,
        offset: 0,
        limit: 50
      }),
      createPlaylist: vi.fn(),
      updatePlaylist: vi.fn(),
      deletePlaylist: vi.fn(),
      addTracksToPlaylist: vi.fn(),
      removeTrackFromPlaylist: vi.fn(),
      reorderPlaylistItems: vi.fn()
    };

    galaxyService = new GalaxyService({
      libraryService: mockLibraryService,
      playlistService: mockPlaylistService,
      database: mockDatabase
    });
  });

  it('builds real graph nodes and edges from library data', async () => {
    const graph = await galaxyService.getGraph();

    expect(graph.totalNodes).toBeGreaterThan(0);
    expect(graph.nodes.some(n => n.id === 'artist:artist_1')).toBe(true);
    expect(graph.nodes.some(n => n.id === 'album:album_1')).toBe(true);
    expect(graph.nodes.some(n => n.id === 'track:track_1')).toBe(true);
    expect(graph.nodes.some(n => n.id === 'genre:genre_1')).toBe(true);

    // Verify verified edge connections
    expect(graph.edges.some(e => e.sourceId === 'artist:artist_1' && e.targetId === 'album:album_1')).toBe(true);
    expect(graph.edges.some(e => e.sourceId === 'album:album_1' && e.targetId === 'track:track_1')).toBe(true);
  });

  it('caches generated graph until invalidated', async () => {
    const graph1 = await galaxyService.getGraph();
    const graph2 = await galaxyService.getGraph();
    expect(graph1).toBe(graph2); // Same object reference

    galaxyService.invalidateCache();
    const graph3 = await galaxyService.getGraph();
    expect(graph3).not.toBe(graph1); // New generation
  });

  it('handles empty library gracefully', async () => {
    mockLibraryService.listArtists = vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 });
    mockLibraryService.listAlbums = vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 });
    mockLibraryService.listTracks = vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 });
    mockLibraryService.listGenres = vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 });
    mockLibraryService.listFolders = vi.fn().mockResolvedValue([]);
    mockPlaylistService.listPlaylists = vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 });

    galaxyService.invalidateCache();
    const emptyGraph = await galaxyService.getGraph();
    expect(emptyGraph.totalNodes).toBe(0);
    expect(emptyGraph.totalEdges).toBe(0);
  });

  it('saves and sanitizes galaxy settings', async () => {
    const defaults = await galaxyService.getSettings();
    expect(defaults).toEqual(DEFAULT_GALAXY_SETTINGS);

    const updated = await galaxyService.saveSettings({
      defaultLOD: 3,
      showPlaylists: false,
      reducedMotion: true
    });

    expect(updated.defaultLOD).toBe(3);
    expect(updated.showPlaylists).toBe(false);
    expect(updated.reducedMotion).toBe(true);

    const loaded = await galaxyService.getSettings();
    expect(loaded).toEqual(updated);
  });
});
