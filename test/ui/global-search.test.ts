import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { GlobalSearchService } from '../../src/services/search/global-search-service';
import { HeaderComponent } from '../../src/ui/shell/header-component';
import { RouterService } from '../../src/ui/navigation/router-service';
import type { Track, Album, Artist, Playlist, Folder } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('Global App Search System', () => {
  let container: HTMLElement;
  let mockSearchService: any;
  let mockLibraryService: any;
  let mockPlaylistService: any;
  let router: RouterService;

  const sampleTracks: Track[] = [
    {
      id: 't1',
      fileId: 'f1',
      title: 'Rock Anthem',
      artistName: 'Rock Legends',
      albumTitle: 'Classic Rock 101',
      durationMs: 240000,
      format: { codec: 'mp3', container: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      isFavorite: false,
      hasLyrics: false,
      playCount: 10,
      availability: 'available'
    }
  ];

  const sampleAlbums: Album[] = [
    {
      id: 'al1',
      title: 'Classic Rock 101',
      artistName: 'Rock Legends',
      trackCount: 12,
      durationMs: 2400000,
      isCompilation: false,
      dateAdded: Date.now()
    }
  ];

  const sampleArtists: Artist[] = [
    {
      id: 'ar1',
      name: 'Rock Legends',
      albumCount: 2,
      trackCount: 24
    }
  ];

  const samplePlaylists: Playlist[] = [
    {
      id: 'p1',
      name: 'My Rock Jam',
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: 15,
      durationMs: 3600000
    }
  ];

  const sampleFolders: Folder[] = [
    {
      id: 'fol1',
      name: 'Downloads Music',
      path: 'C:/Users/ompat/Downloads',
      isMonitored: true,
      trackCount: 42
    }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    router = new RouterService('home');

    mockSearchService = {
      search: vi.fn().mockResolvedValue({
        tracks: sampleTracks,
        albums: sampleAlbums,
        artists: sampleArtists,
        playlists: samplePlaylists,
        genres: [{ id: 'g1', name: 'Rock', trackCount: 50 }],
        folders: sampleFolders
      })
    };

    mockLibraryService = {
      listFolders: vi.fn().mockResolvedValue(sampleFolders),
      listGenres: vi.fn().mockResolvedValue({ items: [{ id: 'g1', name: 'Rock' }], total: 1 })
    };

    mockPlaylistService = {
      listPlaylists: vi.fn().mockResolvedValue(samplePlaylists)
    };
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('GlobalSearchService', () => {
    it('searches across settings sections with keyword matching', async () => {
      const searchService = new GlobalSearchService({
        searchService: mockSearchService,
        libraryService: mockLibraryService,
        playlistService: mockPlaylistService
      });

      // Search for "storage"
      const storageRes = await searchService.searchGlobal('storage');
      expect(storageRes.settings.length).toBeGreaterThan(0);
      expect(storageRes.settings[0]?.title).toBe('Storage & Database');
      expect(storageRes.settings[0]?.params?.section).toBe('storage');

      // Search for "equalizer"
      const eqRes = await searchService.searchGlobal('equalizer');
      expect(eqRes.settings.length).toBeGreaterThan(0);
      expect(eqRes.settings[0]?.title).toBe('Audio DSP & EQ');
      expect(eqRes.settings[0]?.params?.section).toBe('audio');

      // Search for "theme"
      const themeRes = await searchService.searchGlobal('theme');
      expect(themeRes.settings.length).toBeGreaterThan(0);
      expect(themeRes.settings[0]?.title).toBe('Theme & Style');
    });

    it('searches across application pages and navigation destinations', async () => {
      const searchService = new GlobalSearchService({
        searchService: mockSearchService
      });

      const res = await searchService.searchGlobal('playlists');
      expect(res.pages.some(p => p.route === 'playlists')).toBe(true);

      const galaxyRes = await searchService.searchGlobal('galaxy');
      expect(galaxyRes.pages.some(p => p.route === 'galaxy')).toBe(true);

      const favRes = await searchService.searchGlobal('favorites');
      expect(favRes.pages.some(p => p.params?.tab === 'favorites')).toBe(true);
    });

    it('discovers indexed folders and filesystem resources', async () => {
      const searchService = new GlobalSearchService({
        searchService: mockSearchService
      });

      const res = await searchService.searchGlobal('Downloads');
      expect(res.folders.length).toBeGreaterThan(0);
      expect(res.folders[0]?.title).toBe('Downloads Music');
      expect(res.folders[0]?.route).toBe('library');
      expect(res.folders[0]?.params?.tab).toBe('folders');
    });

    it('ranks exact matches higher than partial matches', async () => {
      const searchService = new GlobalSearchService({
        searchService: mockSearchService
      });

      const res = await searchService.searchGlobal('Local Music Access');
      expect(res.settings[0]?.title).toBe('Local Music Access');
      expect(res.settings[0]?.score).toBe(100);
    });

    it('returns empty results for blank or empty query', async () => {
      const searchService = new GlobalSearchService({
        searchService: mockSearchService
      });

      const res = await searchService.searchGlobal('   ');
      expect(res.totalMatches).toBe(0);
      expect(res.settings.length).toBe(0);
      expect(res.tracks.length).toBe(0);
    });
  });

  describe('HeaderComponent Global Search Integration', () => {
    it('mounts header with updated app-wide search placeholder', () => {
      const header = new HeaderComponent(router, mockSearchService, mockLibraryService, mockPlaylistService);
      header.mount(container);

      const input = container.querySelector<HTMLInputElement>('#global-search-input');
      expect(input).not.toBeNull();
      expect(input?.getAttribute('placeholder')).toContain('Search songs, folders, settings, pages');

      header.unmount();
    });

    it('executes global search and displays grouped dropdown results on input', async () => {
      const header = new HeaderComponent(router, mockSearchService, mockLibraryService, mockPlaylistService);
      header.mount(container);

      await header.executeGlobalSearch('storage');

      const dropdown = container.querySelector('.global-search-dropdown');
      expect(dropdown).not.toBeNull();

      const settingsItems = container.querySelectorAll('.global-search-item');
      expect(settingsItems.length).toBeGreaterThan(0);

      header.unmount();
    });

    it('navigates to settings section when settings item is clicked', async () => {
      const header = new HeaderComponent(router, mockSearchService, mockLibraryService, mockPlaylistService);
      header.mount(container);

      const navigateSpy = vi.spyOn(router, 'navigate');

      await header.executeGlobalSearch('storage');

      const storageItem = Array.from(container.querySelectorAll<HTMLButtonElement>('.global-search-item')).find(el =>
        el.textContent?.includes('Storage')
      );
      expect(storageItem).toBeDefined();
      storageItem?.click();

      expect(navigateSpy).toHaveBeenCalledWith('settings', expect.objectContaining({ section: 'storage' }));

      header.unmount();
    });

    it('supports keyboard ArrowDown/ArrowUp and Enter navigation in dropdown', async () => {
      const header = new HeaderComponent(router, mockSearchService, mockLibraryService, mockPlaylistService);
      header.mount(container);

      const navigateSpy = vi.spyOn(router, 'navigate');

      await header.executeGlobalSearch('galaxy');

      const input = container.querySelector<HTMLInputElement>('#global-search-input')!;

      // Navigate down
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      const activeItem = container.querySelector('.global-search-item-active');
      expect(activeItem).not.toBeNull();

      // Press Enter to select
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(navigateSpy).toHaveBeenCalled();

      header.unmount();
    });

    it('navigates to dedicated search page when pressing Enter with no item highlighted', async () => {
      const header = new HeaderComponent(router, mockSearchService, mockLibraryService, mockPlaylistService);
      header.mount(container);

      const navigateSpy = vi.spyOn(router, 'navigate');

      const input = container.querySelector<HTMLInputElement>('#global-search-input')!;
      input.value = 'Unknown Track Query';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(navigateSpy).toHaveBeenCalledWith('search', { query: 'Unknown Track Query' });

      header.unmount();
    });

    it('closes dropdown when Escape is pressed', async () => {
      const header = new HeaderComponent(router, mockSearchService, mockLibraryService, mockPlaylistService);
      header.mount(container);

      await header.executeGlobalSearch('theme');

      expect(container.querySelector('.global-search-dropdown')).not.toBeNull();

      const input = container.querySelector<HTMLInputElement>('#global-search-input')!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(container.querySelector('.global-search-dropdown')).toBeNull();

      header.unmount();
    });
  });
});
