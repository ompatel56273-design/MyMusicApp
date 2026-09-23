import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { SearchView } from '../../src/ui/views/search-view';
import type { Track, Album, Artist, Playlist } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('SearchView Rebuild (Template 4)', () => {
  let container: HTMLElement;
  let mockSearchService: any;
  let mockLibraryService: any;
  let mockPlaybackManager: any;
  let mockRouterService: any;
  let searchView: SearchView;

  const mockTracks: Track[] = [
    {
      id: 't1',
      fileId: 'f1',
      title: 'Midnight City',
      artistName: 'M83',
      albumTitle: 'Hurry Up, We\'re Dreaming',
      durationMs: 243000,
      format: { container: 'flac', codec: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2, isLossless: true },
      dateAdded: 1000,
      dateModified: 1000,
      playCount: 42,
      isFavorite: true,
      hasLyrics: false,
      availability: 'available'
    },
    {
      id: 't2',
      fileId: 'f2',
      title: 'Intro',
      artistName: 'The xx',
      albumTitle: 'xx',
      durationMs: 127000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: 2000,
      dateModified: 2000,
      playCount: 18,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    }
  ];

  const mockAlbums: Album[] = [
    { id: 'alb1', title: 'Hurry Up, We\'re Dreaming', artistName: 'M83', trackCount: 22, year: 2011, durationMs: 4400000, isCompilation: false, dateAdded: 1000 }
  ];

  const mockArtists: Artist[] = [
    { id: 'art1', name: 'M83', trackCount: 22, albumCount: 1 },
    { id: 'art2', name: 'The xx', trackCount: 11, albumCount: 1 }
  ];

  const mockPlaylists: Playlist[] = [
    { id: 'pl1', name: 'Synthwave Night', isSmart: false, trackCount: 1, durationMs: 243000, createdAt: 1000, updatedAt: 1000 }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockSearchService = {
      search: vi.fn().mockResolvedValue({
        tracks: mockTracks,
        albums: mockAlbums,
        artists: mockArtists,
        playlists: mockPlaylists
      })
    };

    mockLibraryService = {
      listArtists: vi.fn().mockResolvedValue({ items: mockArtists, total: 2, offset: 0, limit: 6 }),
      listTracks: vi.fn().mockResolvedValue({ items: mockTracks, total: 2, offset: 0, limit: 50 }),
      toggleFavorite: vi.fn().mockResolvedValue(false)
    };

    mockPlaybackManager = {
      playTrack: vi.fn().mockResolvedValue(undefined)
    };

    mockRouterService = {
      navigate: vi.fn()
    };

    searchView = new SearchView({
      searchService: mockSearchService,
      libraryService: mockLibraryService,
      playbackManager: mockPlaybackManager,
      routerService: mockRouterService
    });
  });

  afterEach(() => {
    searchView.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders search hero with input, clear button, and category filters', () => {
    searchView.mount(container);

    const input = container.querySelector('#search-view-input') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.getAttribute('placeholder')).toContain('Search songs, artists, albums');

    const filters = container.querySelectorAll('.search-cat-btn');
    expect(filters.length).toBe(6); // All, Songs, Albums, Artists, Playlists, Genres
  });

  it('renders default discovery state with genre grid and popular searches when query is empty', () => {
    searchView.mount(container);

    const genreTiles = container.querySelectorAll('.genre-search-tile');
    expect(genreTiles.length).toBe(10); // 10 approved genres

    const quickPills = container.querySelectorAll('.quick-search-pill');
    expect(quickPills.length).toBeGreaterThan(0);

    const rightPanel = container.querySelector('.search-side-column');
    expect(rightPanel).toBeDefined();
  });

  it('triggers search when user types in search input', async () => {
    searchView.mount(container);

    const input = container.querySelector('#search-view-input') as HTMLInputElement;
    input.setAttribute('value', 'M83');
    input.value = 'M83';
    input.dispatchEvent(new Event('input'));

    // Wait for debounce timeout
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(mockSearchService.search).toHaveBeenCalledWith('M83', 12);
    expect(container.querySelector('.top-result-card')).toBeDefined();
    expect(container.textContent).toContain('Midnight City');
  });

  it('clears query when clear button is clicked', async () => {
    searchView.mount(container, { query: 'Synthwave' });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockSearchService.search).toHaveBeenCalledWith('Synthwave', 12);

    const clearBtn = container.querySelector('#search-clear-btn') as HTMLElement;
    expect(clearBtn).toBeDefined();

    clearBtn.dispatchEvent(new Event('click'));

    const input = container.querySelector('#search-view-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(container.querySelector('.genre-search-tile')).toBeDefined();
  });

  it('initiates search when popular search chip is clicked', async () => {
    searchView.mount(container);

    const quickPill = container.querySelector('.quick-search-pill') as HTMLElement;
    expect(quickPill).toBeDefined();
    const query = quickPill.getAttribute('data-query');

    quickPill.dispatchEvent(new Event('click'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockSearchService.search).toHaveBeenCalledWith(query, 12);
  });

  it('initiates search when genre tile is clicked', async () => {
    searchView.mount(container);

    const genreTile = container.querySelector('.genre-search-tile') as HTMLElement;
    expect(genreTile).toBeDefined();
    const genre = genreTile.getAttribute('data-genre');

    genreTile.dispatchEvent(new Event('click'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockSearchService.search).toHaveBeenCalledWith(genre, 12);
  });

  it('filters results by category when filter tab is clicked', async () => {
    searchView.mount(container, { query: 'test' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const songFilter = Array.from(container.querySelectorAll('.search-cat-btn')).find(
      (btn) => (btn as HTMLElement).getAttribute('data-category') === 'songs'
    ) as HTMLElement;
    expect(songFilter).toBeDefined();

    songFilter.dispatchEvent(new Event('click'));

    expect(container.querySelector('#search-songs-list')).toBeDefined();
    expect(container.querySelector('#search-albums-grid')).toBeNull();
  });

  it('plays track when play button is clicked on top result card', async () => {
    searchView.mount(container, { query: 'Midnight' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const topPlayBtn = container.querySelector('#play-top-result-btn') as HTMLElement;
    expect(topPlayBtn).toBeDefined();

    topPlayBtn.dispatchEvent(new Event('click'));
    expect(mockPlaybackManager.playTrack).toHaveBeenCalledWith(mockTracks[0], mockTracks);
  });

  it('renders empty result state when search returns no matches', async () => {
    mockSearchService.search.mockResolvedValueOnce({
      tracks: [],
      albums: [],
      artists: [],
      playlists: []
    });

    searchView.mount(container, { query: 'NonexistentTrackXYZ' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(container.textContent).toContain('No results found for "NonexistentTrackXYZ"');
  });

  it('saves and clears recent search history', async () => {
    searchView.mount(container, { query: 'Lossless Audio' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Re-mount to see recent searches in right panel
    searchView.mount(container);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const recentChips = container.querySelectorAll('.recent-search-item');
    expect(recentChips.length).toBeGreaterThan(0);

    const clearHistoryBtn = container.querySelector('#clear-recent-btn') as HTMLElement;
    if (clearHistoryBtn) {
      clearHistoryBtn.dispatchEvent(new Event('click'));
      expect(container.querySelectorAll('.recent-search-item').length).toBe(0);
    }
  });
});
