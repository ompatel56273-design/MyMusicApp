import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { LibraryView } from '../../src/ui/views/library-view';
import type { Track, Album, Artist, Genre, Folder } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('LibraryView Hub & Tabs', () => {
  let container: HTMLElement;
  let mockLibraryService: any;
  let mockPlaybackManager: any;
  let libraryView: LibraryView;

  const mockTracks: Track[] = [
    {
      id: 't1',
      fileId: 'f1',
      title: 'Stairway to Heaven',
      artistName: 'Led Zeppelin',
      albumTitle: 'Led Zeppelin IV',
      durationMs: 482000,
      format: { container: 'flac', codec: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2, isLossless: true },
      dateAdded: 1000,
      dateModified: 1000,
      playCount: 15,
      isFavorite: true,
      hasLyrics: false,
      availability: 'available'
    },
    {
      id: 't2',
      fileId: 'f2',
      title: 'Comfortably Numb',
      artistName: 'Pink Floyd',
      albumTitle: 'The Wall',
      durationMs: 382000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: 2000,
      dateModified: 2000,
      playCount: 20,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    }
  ];

  const mockAlbums: Album[] = [
    { id: 'alb1', title: 'Led Zeppelin IV', artistName: 'Led Zeppelin', trackCount: 8, year: 1971, durationMs: 2500000, isCompilation: false, dateAdded: 1000 },
    { id: 'alb2', title: 'The Wall', artistName: 'Pink Floyd', trackCount: 26, year: 1979, durationMs: 4800000, isCompilation: false, dateAdded: 2000 }
  ];

  const mockArtists: Artist[] = [
    { id: 'art1', name: 'Led Zeppelin', trackCount: 8, albumCount: 1 },
    { id: 'art2', name: 'Pink Floyd', trackCount: 26, albumCount: 1 }
  ];

  const mockGenres: Genre[] = [
    { id: 'gen1', name: 'Classic Rock', trackCount: 34 }
  ];

  const mockFolders: Folder[] = [
    { id: 'fld1', name: 'Rock Collection', path: 'C:/Music/Rock', trackCount: 34, isMonitored: true }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockLibraryService = {
      listTracks: vi.fn().mockResolvedValue({ items: mockTracks, total: mockTracks.length, offset: 0, limit: 50 }),
      listAlbums: vi.fn().mockResolvedValue({ items: mockAlbums, total: mockAlbums.length, offset: 0, limit: 50 }),
      listArtists: vi.fn().mockResolvedValue({ items: mockArtists, total: mockArtists.length, offset: 0, limit: 50 }),
      listGenres: vi.fn().mockResolvedValue({ items: mockGenres, total: mockGenres.length, offset: 0, limit: 50 }),
      listFolders: vi.fn().mockResolvedValue(mockFolders),
      toggleFavorite: vi.fn().mockResolvedValue(false),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 2, albumCount: 2, artistCount: 2 })
    };

    mockPlaybackManager = {
      playTrack: vi.fn().mockResolvedValue(undefined)
    };

    libraryView = new LibraryView({
      libraryService: mockLibraryService,
      playbackManager: mockPlaybackManager
    });

    libraryView.mount(container);
  });

  afterEach(() => {
    libraryView.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should render library layout with category tabs and stats', () => {
    expect(container.querySelector('nav[role="tablist"]')).toBeDefined();
    expect(mockLibraryService.getLibraryStats).toHaveBeenCalled();
  });

  it('should switch between category tabs', () => {
    libraryView.updateParams({ tab: 'albums' });
    expect(mockLibraryService.listAlbums).toHaveBeenCalled();

    libraryView.updateParams({ tab: 'artists' });
    expect(mockLibraryService.listArtists).toHaveBeenCalled();

    libraryView.updateParams({ tab: 'genres' });
    expect(mockLibraryService.listGenres).toHaveBeenCalled();

    libraryView.updateParams({ tab: 'folders' });
    expect(mockLibraryService.listFolders).toHaveBeenCalled();

    libraryView.updateParams({ tab: 'favorites' });
    expect(mockLibraryService.listTracks).toHaveBeenCalledWith(expect.anything(), { isFavorite: true });
  });

  it('should play track when selected in songs tab', async () => {
    libraryView.updateParams({ tab: 'songs' });
    // Wait for async loadTracks
    await new Promise(r => setTimeout(r, 20));

    const firstRow = container.querySelector<HTMLElement>('.track-row');
    firstRow?.click();

    expect(mockPlaybackManager.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't2' }),
      expect.anything()
    );
  });
});
