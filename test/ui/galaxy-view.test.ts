import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { GalaxyView } from '../../src/ui/views/galaxy-view';
import { EventBus } from '../../src/core/events/event-bus';
import type { IGalaxyService, IPlaybackManager, ILibraryService, ISearchService } from '../../src/services/contracts/service-contracts';
import type { GalaxyGraph } from '../../src/domain/entities/galaxy-types';

describe('GalaxyView', () => {
  let container: HTMLElement;
  let view: GalaxyView;
  let mockGalaxyService: IGalaxyService;
  let mockPlaybackManager: IPlaybackManager;
  let mockLibraryService: ILibraryService;
  let mockSearchService: ISearchService;
  let eventBus: EventBus;

  const sampleGraph: GalaxyGraph = {
    nodes: [
      { id: 'genre:1', type: 'genre', entityId: 'g1', label: 'Electronic', x: 0, y: 0, radius: 36, color: '#a855f7', lodMin: 1, lodMax: 4, metadata: { trackCount: 10 } },
      { id: 'artist:1', type: 'artist', entityId: 'a1', label: 'Daft Punk', x: 100, y: 100, radius: 24, color: '#3b82f6', lodMin: 1, lodMax: 4, metadata: { albumCount: 4, trackCount: 40 } },
      { id: 'album:1', type: 'album', entityId: 'al1', label: 'Discovery', x: 200, y: 200, radius: 16, color: '#ff6b00', lodMin: 2, lodMax: 4, metadata: { artistName: 'Daft Punk', trackCount: 14 } }
    ],
    edges: [],
    totalNodes: 3,
    totalEdges: 0,
    createdAt: Date.now()
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();

    mockGalaxyService = {
      getGraph: vi.fn().mockResolvedValue(sampleGraph),
      invalidateCache: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({ defaultLOD: 2, showPlaylists: true, showFolders: true, reducedMotion: false }),
      saveSettings: vi.fn().mockImplementation(async s => ({ defaultLOD: 2, showPlaylists: true, showFolders: true, reducedMotion: false, ...s }))
    };

    mockPlaybackManager = {
      state: 'idle',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      repeatMode: 'off',
      shuffleMode: 'off',
      queue: [],
      currentQueueIndex: -1,
      playTrack: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn(),
      addToQueue: vi.fn().mockResolvedValue(undefined),
      playQueueIndex: vi.fn().mockResolvedValue(undefined),
      removeFromQueue: vi.fn().mockResolvedValue(undefined),
      reorderQueue: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockLibraryService = {
      getTrack: vi.fn().mockResolvedValue(null),
      listTracks: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      getAlbum: vi.fn().mockResolvedValue(null),
      listAlbums: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      getArtist: vi.fn().mockResolvedValue(null),
      listArtists: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      toggleFavorite: vi.fn().mockResolvedValue(true),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 40, albumCount: 4, artistCount: 1 }),
      listGenres: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      listFolders: vi.fn().mockResolvedValue([])
    };

    mockSearchService = {
      search: vi.fn().mockResolvedValue({
        tracks: [],
        albums: [{ id: 'al1', title: 'Discovery', artistName: 'Daft Punk' }],
        artists: [],
        playlists: []
      }),
      searchTracks: vi.fn(),
      searchAlbums: vi.fn(),
      searchArtists: vi.fn(),
      searchPlaylists: vi.fn()
    };

    view = new GalaxyView({
      galaxyService: mockGalaxyService,
      playbackManager: mockPlaybackManager,
      libraryService: mockLibraryService,
      searchService: mockSearchService,
      eventBus
    });
  });

  afterEach(() => {
    view.unmount();
    container.remove();
  });

  it('mounts canvas and control buttons into DOM', async () => {
    await view.mount(container);

    const canvas = container.querySelector<HTMLCanvasElement>('#galaxy-canvas');
    expect(canvas).not.toBeNull();

    const zoomInBtn = container.querySelector<HTMLButtonElement>('#galaxy-zoom-in');
    const zoomOutBtn = container.querySelector<HTMLButtonElement>('#galaxy-zoom-out');
    const resetBtn = container.querySelector<HTMLButtonElement>('#galaxy-reset-camera');

    expect(zoomInBtn).not.toBeNull();
    expect(zoomOutBtn).not.toBeNull();
    expect(resetBtn).not.toBeNull();
  });

  it('toggles accessible alternative outline list view', async () => {
    await view.mount(container);

    const toggleBtn = container.querySelector<HTMLButtonElement>('#galaxy-toggle-accessible');
    const navEl = container.querySelector<HTMLElement>('#galaxy-accessible-nav');

    expect(toggleBtn).not.toBeNull();
    expect(navEl).not.toBeNull();

    toggleBtn?.click();
    expect(navEl?.style.display).toBe('block');

    const closeBtn = container.querySelector<HTMLButtonElement>('#galaxy-close-accessible');
    closeBtn?.click();
    expect(navEl?.style.display).toBe('none');
  });

  it('executes search and focuses matching node', async () => {
    await view.mount(container);

    const searchInput = container.querySelector<HTMLInputElement>('#galaxy-search-input');
    expect(searchInput).not.toBeNull();

    if (searchInput) {
      searchInput.value = 'Discovery';
      searchInput.dispatchEvent(new Event('input'));
    }

    await new Promise(r => setTimeout(r, 10));
    expect(mockSearchService.search).toHaveBeenCalledWith('Discovery', 1);
  });
});
