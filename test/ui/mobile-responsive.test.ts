import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { TrackRowComponent } from '../../src/ui/components/library/track-row-component';
import { SearchView } from '../../src/ui/views/search-view';
import { PlaylistsView } from '../../src/ui/views/playlists-view';
import { SettingsView } from '../../src/ui/views/settings-view';
import { MobileGalaxyView } from '../../src/ui/views/galaxy/mobile-galaxy-view';
import { GalaxyView } from '../../src/ui/views/galaxy-view';
import { HomeView } from '../../src/ui/views/home-view';
import { SongsTabView } from '../../src/ui/views/library/songs-tab-view';
import { AppShell } from '../../src/ui/shell/app-shell';
import { EventBus } from '../../src/core/events/event-bus';
import type { Track, Album, Artist, Genre } from '../../src/domain/entities/models';
import type {
  ILibraryService,
  IPlaybackManager,
  ISearchService,
  IPlaylistService,
  IGalaxyService
} from '../../src/services/contracts/service-contracts';

describe('Mobile Responsive Layouts & Discovery Engine', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockLibraryService: ILibraryService;
  let mockPlaybackManager: IPlaybackManager;
  let mockSearchService: ISearchService;
  let mockPlaylistService: IPlaylistService;
  let mockGalaxyService: IGalaxyService;

  const sampleTrack: Track = {
    id: 'track_1',
    fileId: 'file_1',
    title: 'Midnight Resonance (2026 Remaster)',
    artistName: 'Synth Wave Collective',
    albumTitle: 'Neon Cosmos',
    durationMs: 215000,
    format: { container: 'flac', codec: 'flac', isLossless: true, sampleRate: 44100, channels: 2 },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 15,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const sampleArtists: Artist[] = [
    { id: 'art_1', name: 'Daft Punk', trackCount: 40, albumCount: 4 },
    { id: 'art_2', name: 'Tycho', trackCount: 25, albumCount: 3 }
  ];

  const sampleGenres: Genre[] = [
    { id: 'gen_1', name: 'Electronic', trackCount: 50 },
    { id: 'gen_2', name: 'Synthwave', trackCount: 30 }
  ];

  const sampleAlbums: Album[] = [
    { id: 'alb_1', title: 'Discovery', artistName: 'Daft Punk', trackCount: 14, year: 2001, durationMs: 3600000, isCompilation: false, dateAdded: Date.now() },
    { id: 'alb_2', title: 'Dive', artistName: 'Tycho', trackCount: 10, year: 2011, durationMs: 3000000, isCompilation: false, dateAdded: Date.now() }
  ];

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
      getTrack: vi.fn().mockResolvedValue(sampleTrack),
      listTracks: vi.fn().mockResolvedValue({ items: [sampleTrack], total: 1, offset: 0, limit: 50 }),
      getAlbum: vi.fn().mockResolvedValue(sampleAlbums[0]),
      listAlbums: vi.fn().mockResolvedValue({ items: sampleAlbums, total: 2, offset: 0, limit: 50 }),
      getArtist: vi.fn().mockResolvedValue(sampleArtists[0]),
      listArtists: vi.fn().mockResolvedValue({ items: sampleArtists, total: 2, offset: 0, limit: 50 }),
      toggleFavorite: vi.fn().mockResolvedValue(true),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 1, albumCount: 2, artistCount: 2 }),
      listGenres: vi.fn().mockResolvedValue({ items: sampleGenres, total: 2, offset: 0, limit: 50 }),
      listFolders: vi.fn().mockResolvedValue([])
    };

    mockSearchService = {
      search: vi.fn().mockResolvedValue({
        tracks: [sampleTrack],
        albums: sampleAlbums,
        artists: sampleArtists,
        playlists: []
      }),
      searchTracks: vi.fn().mockResolvedValue([sampleTrack]),
      searchAlbums: vi.fn().mockResolvedValue(sampleAlbums),
      searchArtists: vi.fn().mockResolvedValue(sampleArtists),
      searchPlaylists: vi.fn().mockResolvedValue([])
    };

    mockPlaylistService = {
      listPlaylists: vi.fn().mockResolvedValue({
        items: [
          { id: 'pl_1', name: 'Chill Vibes', trackCount: 12, durationMs: 2400000, createdAt: Date.now() },
          { id: 'pl_2', name: 'High Energy', trackCount: 8, durationMs: 1800000, createdAt: Date.now() }
        ],
        total: 2
      }),
      getPlaylist: vi.fn().mockResolvedValue(null),
      getPlaylistWithTracks: vi.fn().mockResolvedValue(null),
      createPlaylist: vi.fn(),
      createSmartPlaylist: vi.fn(),
      updatePlaylist: vi.fn(),
      deletePlaylist: vi.fn(),
      addTracksToPlaylist: vi.fn(),
      removeTrackFromPlaylist: vi.fn(),
      reorderPlaylistItems: vi.fn()
    };

    mockGalaxyService = {
      getGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [], totalNodes: 0, totalEdges: 0, createdAt: Date.now() }),
      invalidateCache: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({ defaultLOD: 2, showPlaylists: true, showFolders: true, reducedMotion: false }),
      saveSettings: vi.fn().mockImplementation(async s => ({ defaultLOD: 2, showPlaylists: true, showFolders: true, reducedMotion: false, ...s }))
    };
  });

  afterEach(() => {
    container.remove();
  });

  describe('Part 1: Mobile Library Track Row Component', () => {
    it('creates track row with dedicated mobile subtitle and min 44px touch targets', () => {
      const onPlay = vi.fn();
      const onToggleFavorite = vi.fn();
      const onRemove = vi.fn();

      const row = TrackRowComponent.create(sampleTrack, 0, {
        onPlay,
        onToggleFavorite,
        onRemove
      });

      expect(row.classList.contains('track-row')).toBe(true);

      const titleCol = row.querySelector('.track-row-title-col');
      expect(titleCol).not.toBeNull();

      const mobileSubtitle = row.querySelector('.track-row-mobile-subtitle');
      expect(mobileSubtitle).not.toBeNull();
      expect(mobileSubtitle?.textContent).toContain('Synth Wave Collective');
      expect(mobileSubtitle?.textContent).toContain('3:35');

      const favBtn = row.querySelector<HTMLButtonElement>('.track-fav-btn');
      expect(favBtn).not.toBeNull();
      expect(favBtn?.style.minWidth).toBe('44px');
      expect(favBtn?.style.minHeight).toBe('44px');

      favBtn?.click();
      expect(onToggleFavorite).toHaveBeenCalledWith(sampleTrack);
    });
  });

  describe('Part 2: Mobile Search Horizontal Category Strip', () => {
    it('renders horizontal scrollable category tabs with touch-friendly pills', () => {
      const searchView = new SearchView({
        searchService: mockSearchService,
        libraryService: mockLibraryService,
        playbackManager: mockPlaybackManager
      });

      searchView.mount(container);

      const tabsNav = container.querySelector<HTMLElement>('.search-cat-tabs');
      expect(tabsNav).not.toBeNull();

      const tabButtons = container.querySelectorAll<HTMLButtonElement>('.search-cat-btn');
      expect(tabButtons.length).toBe(6);

      tabButtons.forEach(btn => {
        expect(btn.getAttribute('role')).toBe('tab');
      });

      searchView.unmount();
    });
  });

  describe('Part 3: Mobile Playlist Filter Toolbar', () => {
    it('renders independently scrollable playlist-cat-tabs without page overflow', async () => {
      const router = {
        current: { route: 'playlists' as const },
        navigate: vi.fn(),
        subscribe: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        back: vi.fn(),
        forward: vi.fn()
      } as any;

      const playlistsView = new PlaylistsView({
        playlistService: mockPlaylistService,
        playbackManager: mockPlaybackManager,
        eventBus,
        router
      });

      playlistsView.mount(container);
      await new Promise(r => setTimeout(r, 20));

      const tabs = container.querySelector<HTMLElement>('.playlist-cat-tabs');
      expect(tabs).not.toBeNull();

      const catButtons = container.querySelectorAll<HTMLButtonElement>('.playlist-cat-btn');
      expect(catButtons.length).toBe(5);

      playlistsView.unmount();
    });
  });

  describe('Part 4, 5, 6: Mobile Settings Category Menu & Scrolling Flow', () => {
    it('manages mobile menu list, detail mode switch, and back navigation cleanly', () => {
      const settingsView = new SettingsView({});
      settingsView.mount(container);

      expect(settingsView.getMobileView()).toBe('menu');
      const mobileMenu = container.querySelector<HTMLElement>('#settings-mobile-menu');
      expect(mobileMenu).not.toBeNull();

      const categoryRows = container.querySelectorAll<HTMLButtonElement>('.settings-mobile-category-row');
      expect(categoryRows.length).toBe(12);

      // Open detail
      const themeRow = Array.from(categoryRows).find(r => r.getAttribute('data-section-id') === 'appearance');
      expect(themeRow).not.toBeNull();
      themeRow?.click();

      expect(settingsView.getMobileView()).toBe('detail');
      expect(settingsView.getSelectedMobileSection()).toBe('appearance');

      const backBtn = container.querySelector<HTMLButtonElement>('#settings-mobile-back-btn');
      expect(backBtn).not.toBeNull();
      backBtn?.click();

      expect(settingsView.getMobileView()).toBe('menu');
      expect(settingsView.getSelectedMobileSection()).toBeNull();

      settingsView.unmount();
    });

    it('deep-links directly to requested settings section (Screen B) on mount with params', () => {
      const settingsView = new SettingsView({});
      settingsView.mount(container, { section: 'storage' });

      expect(settingsView.getMobileView()).toBe('detail');
      expect(settingsView.getSelectedMobileSection()).toBe('storage');

      const activeCard = container.querySelector<HTMLElement>('#section-storage');
      expect(activeCard?.classList.contains('mobile-active-section')).toBe(true);

      const backTitle = container.querySelector<HTMLElement>('#settings-mobile-back-title');
      expect(backTitle?.textContent).toBe('Storage & Database');

      settingsView.unmount();
    });
  });

  describe('Part 8: Mobile Galaxy Interactive Canvas 2D Orbit Universe & Discovery', () => {
    it('renders discovery hero, live canvas 2d celestial orbit universe, and library carousels', async () => {
      const mobileGalaxy = new MobileGalaxyView({
        libraryService: mockLibraryService,
        playbackManager: mockPlaybackManager,
        eventBus
      });

      await mobileGalaxy.mount(container);

      // Header verification
      const hero = container.querySelector<HTMLElement>('.mobile-discovery-hero');
      expect(hero).not.toBeNull();

      // Live Orbit Canvas Universe
      const orbitCanvas = container.querySelector<HTMLCanvasElement>('#mobile-galaxy-orbit-canvas');
      expect(orbitCanvas).not.toBeNull();
      expect(orbitCanvas?.style.width).toBeDefined();

      const orbitContainer = container.querySelector<HTMLElement>('#mobile-galaxy-canvas-container');
      expect(orbitContainer).not.toBeNull();

      // Orbit nodes created from real library data
      const nodes = mobileGalaxy.getOrbitNodes();
      expect(nodes.length).toBeGreaterThanOrEqual(4); // Core + Genres + Artists + Albums/Tracks

      // Core node ("My Music")
      const coreNode = nodes.find(n => n.orbitRing === 0);
      expect(coreNode).toBeDefined();
      expect(coreNode?.name).toBe('My Music');

      // Planetary orbit motion across frames
      const artistNode = nodes.find(n => n.type === 'artist');
      expect(artistNode).toBeDefined();
      if (artistNode) {
        const initialAngle = artistNode.currentAngle;
        const initialX = artistNode.x;
        const initialY = artistNode.y;

        // Step physics forward by 500ms
        mobileGalaxy.stepOrbitPhysics(500);

        expect(artistNode.currentAngle !== initialAngle).toBe(true);
        expect(artistNode.x !== initialX || artistNode.y !== initialY).toBe(true);

        // Step physics forward again
        const frame2X = artistNode.x;
        const frame2Y = artistNode.y;
        mobileGalaxy.stepOrbitPhysics(500);
        expect(artistNode.x !== frame2X || artistNode.y !== frame2Y).toBe(true);
      }

      // Search input
      const searchInput = container.querySelector<HTMLInputElement>('#mobile-discovery-search');
      expect(searchInput).not.toBeNull();

      // Artists carousel
      const artistCards = container.querySelectorAll<HTMLButtonElement>('.mobile-discovery-artist-card');
      expect(artistCards.length).toBe(2);
      expect(artistCards[0]?.textContent).toContain('Daft Punk');

      // Genres
      const genrePills = container.querySelectorAll<HTMLButtonElement>('.mobile-discovery-genre-pill');
      expect(genrePills.length).toBe(2);

      // Albums
      const albumCards = container.querySelectorAll<HTMLButtonElement>('.mobile-discovery-album-card');
      expect(albumCards.length).toBe(2);

      // Artist tap interaction
      artistCards[0]?.click();
      await new Promise(r => setTimeout(r, 10));
      expect(mockLibraryService.listTracks).toHaveBeenCalled();

      // Genre tap interaction
      genrePills[0]?.click();
      await new Promise(r => setTimeout(r, 10));
      expect(mockLibraryService.listTracks).toHaveBeenCalled();

      mobileGalaxy.unmount();
    });

    it('GalaxyView mounts both desktop canvas root and mobile discovery root responsively', async () => {
      const galaxyView = new GalaxyView({
        galaxyService: mockGalaxyService,
        playbackManager: mockPlaybackManager,
        libraryService: mockLibraryService,
        searchService: mockSearchService,
        eventBus
      });

      await galaxyView.mount(container);

      // Desktop canvas present for desktop viewports
      const desktopRoot = container.querySelector<HTMLElement>('#galaxy-desktop-root');
      expect(desktopRoot).not.toBeNull();
      const canvas = container.querySelector<HTMLCanvasElement>('#galaxy-canvas');
      expect(canvas).not.toBeNull();

      // Mobile root present for responsive mobile viewport
      const mobileRoot = container.querySelector<HTMLElement>('#galaxy-mobile-root');
      expect(mobileRoot).not.toBeNull();

      galaxyView.unmount();
    });
  });

  describe('Part 9: Home View Mobile Hero Actions & Responsiveness', () => {
    it('mounts HomeView with responsive hero action buttons and quick tiles', () => {
      const homeView = new HomeView(mockLibraryService, {
        playbackManager: mockPlaybackManager,
        eventBus
      });

      homeView.mount(container);

      const heroCard = container.querySelector<HTMLElement>('.home-hero-card');
      expect(heroCard).not.toBeNull();

      const playBtn = container.querySelector<HTMLButtonElement>('.home-hero-btn-play');
      const shuffleBtn = container.querySelector<HTMLButtonElement>('.home-hero-btn-shuffle');
      expect(playBtn).not.toBeNull();
      expect(shuffleBtn).not.toBeNull();

      const quickRow = container.querySelector<HTMLElement>('.home-mobile-quick-row');
      expect(quickRow).not.toBeNull();

      homeView.unmount();
    });
  });

  describe('Part 10: SongsTabView Metadata Toolbar & Virtual Scroller', () => {
    it('mounts SongsTabView with metadata action toolbar', async () => {
      const mockMetaService: any = {
        batchUpdateTags: vi.fn().mockResolvedValue({ success: true })
      };
      const mockVirtualTrackService: any = {
        importFromCue: vi.fn().mockResolvedValue([])
      };

      const songsTab = new SongsTabView({
        libraryService: mockLibraryService,
        playbackManager: mockPlaybackManager,
        metadataEditorService: mockMetaService,
        virtualTrackService: mockVirtualTrackService
      });

      await songsTab.mount(container);

      const toolbar = container.querySelector<HTMLElement>('.songs-metadata-toolbar');
      expect(toolbar).not.toBeNull();

      const actionsStrip = container.querySelector<HTMLElement>('.songs-metadata-actions');
      expect(actionsStrip).not.toBeNull();

      const cueBtn = container.querySelector<HTMLButtonElement>('#import-cue-btn');
      const batchBtn = container.querySelector<HTMLButtonElement>('#batch-edit-btn');
      const normBtn = container.querySelector<HTMLButtonElement>('#batch-norm-btn');
      const renameBtn = container.querySelector<HTMLButtonElement>('#batch-rename-btn');

      expect(cueBtn).not.toBeNull();
      expect(batchBtn).not.toBeNull();
      expect(normBtn).not.toBeNull();
      expect(renameBtn).not.toBeNull();

      songsTab.unmount();
    });
  });

  describe('Part 11: AppShell Mobile Bottom Navigation & Galaxy Route Reachability', () => {
    it('renders mobile bottom navigation bar with 5 items including Galaxy and navigates on tap', () => {
      const shell = new AppShell({
        playbackManager: mockPlaybackManager,
        libraryService: mockLibraryService,
        searchService: mockSearchService,
        playlistService: mockPlaylistService,
        galaxyService: mockGalaxyService,
        eventBus
      });

      shell.mount(container);

      const bottomNav = container.querySelector<HTMLElement>('#shell-bottom-nav-slot');
      expect(bottomNav).not.toBeNull();

      const navButtons = container.querySelectorAll<HTMLButtonElement>('.mobile-nav-btn');
      expect(navButtons.length).toBe(5);

      const galaxyBtn = Array.from(navButtons).find(btn => btn.getAttribute('data-mobile-route') === 'galaxy');
      expect(galaxyBtn).not.toBeNull();
      expect(galaxyBtn?.textContent).toContain('Galaxy');

      // Tap Galaxy in mobile bottom nav
      galaxyBtn?.click();
      expect(shell.getRouter().current.route).toBe('galaxy');
      expect(galaxyBtn?.getAttribute('aria-current')).toBe('page');

      shell.unmount();
    });
  });
});
