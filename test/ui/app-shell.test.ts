import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { AppShell } from '../../src/ui/shell/app-shell';
import { EventBus } from '../../src/core/events/event-bus';

setupMockDomEnvironment();

describe('AppShell', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockPlaybackManager: any;
  let mockLibraryService: any;
  let mockSearchService: any;
  let appShell: AppShell;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();

    mockPlaybackManager = {
      state: 'idle',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      isMuted: false,
      repeatMode: 'off',
      shuffleMode: 'off',
      pause: vi.fn(),
      resume: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn()
    };

    mockLibraryService = {
      getTrack: vi.fn(),
      listTracks: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      getAlbum: vi.fn(),
      listAlbums: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      getArtist: vi.fn(),
      listArtists: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      toggleFavorite: vi.fn(),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 0, albumCount: 0, artistCount: 0 })
    };

    mockSearchService = {
      search: vi.fn().mockResolvedValue({ tracks: [], albums: [], artists: [], playlists: [] }),
      searchTracks: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      searchAlbums: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      searchArtists: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      searchPlaylists: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 })
    };

    appShell = new AppShell({
      playbackManager: mockPlaybackManager,
      libraryService: mockLibraryService,
      searchService: mockSearchService,
      eventBus
    });

    appShell.mount(container);
  });

  afterEach(() => {
    appShell.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should mount full layout regions (header, sidebar, viewport, miniplayer)', () => {
    expect(container.querySelector('#shell-header-slot')).toBeDefined();
    expect(container.querySelector('#shell-sidebar-slot')).toBeDefined();
    expect(container.querySelector('#shell-viewport-slot')).toBeDefined();
    expect(container.querySelector('#shell-miniplayer-slot')).toBeDefined();
  });

  it('should switch views upon route navigation', () => {
    const router = appShell.getRouter();
    router.navigate('library');

    expect(container.querySelector('.library-view')).toBeDefined();

    router.navigate('galaxy');
    expect(container.querySelector('.galaxy-view')).toBeDefined();

    router.navigate('settings');
    expect(container.querySelector('.settings-view')).toBeDefined();
  });
});
