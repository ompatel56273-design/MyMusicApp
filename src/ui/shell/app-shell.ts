import { RouterService } from '../navigation/router-service';
import type { RouteState, AppRoute } from '../navigation/route-types';
import type { IView } from '../views/view-interface';
import { HomeView } from '../views/home-view';
import { LibraryView } from '../views/library-view';
import { SearchView } from '../views/search-view';
import { PlaylistsView } from '../views/playlists-view';
import { GalaxyView } from '../views/galaxy-view';
import { SettingsView } from '../views/settings-view';
import { NowPlayingView } from '../views/now-playing-view';
import { StatsView } from '../views/stats-view';
import { StatsService } from '../../services/stats/stats-service';
import { SleepTimerService } from '../../services/playback/sleep-timer-service';
import { HeaderComponent } from './header-component';
import { SidebarComponent } from './sidebar-component';
import { MiniPlayerComponent } from './mini-player-component';
import { KeyboardManager } from '../keyboard/keyboard-manager';
import { MediaSessionService } from '../../services/playback/media-session-service';
import type {
  IPlaybackManager,
  ILibraryService,
  ISearchService,
  IArtworkService,
  IPlaylistService,
  ILyricsService,
  IAudioEngine,
  IAudioSettingsService,
  IVisualizerService,
  IGalaxyService,
  IDashboardService,
  IScannerService,
  IDuplicateDetectorService
} from '../../services/contracts/service-contracts';
import { EventBus } from '../../core/events/event-bus';
import type { Disposable } from '../../core/types/common';
import type { BrowserFilesystemAdapter } from '../../services/scanner/browser-filesystem-adapter';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { ThemeManager } from '../theme/theme-manager';
import { getIconSvg, type IconName } from '../icons/icon-registry';

export interface AppShellDependencies {
  playbackManager: IPlaybackManager;
  libraryService: ILibraryService;
  searchService: ISearchService;
  playlistService?: IPlaylistService | undefined;
  artworkService?: IArtworkService | undefined;
  lyricsService?: ILyricsService | undefined;
  audioEngine?: IAudioEngine | undefined;
  audioSettingsService?: IAudioSettingsService | undefined;
  visualizerService?: IVisualizerService | undefined;
  galaxyService?: IGalaxyService | undefined;
  dashboardService?: IDashboardService | undefined;
  scannerService?: IScannerService | undefined;
  statsService?: StatsService | undefined;
  sleepTimerService?: SleepTimerService | undefined;
  fsAdapter?: BrowserFilesystemAdapter | undefined;
  dbAdapter?: IDatabaseAdapter | undefined;
  eventBus: EventBus;
  duplicateDetectorService?: IDuplicateDetectorService | undefined;
}

/**
 * Master Global Application Shell.
 * Mounts persistent layout regions (Header, Sidebar, Main Content Viewport, MiniPlayer, Mobile Bottom Nav),
 * manages view switching based on RouterService, and coordinates global keyboard shortcuts.
 */
export class AppShell {
  private container: HTMLElement | null = null;
  private readonly router: RouterService;
  private readonly header: HeaderComponent;
  private readonly sidebar: SidebarComponent;
  private readonly miniPlayer: MiniPlayerComponent;
  private readonly keyboardManager: KeyboardManager;
  private readonly mediaSessionService: MediaSessionService;

  private views: Map<AppRoute, IView>;
  private activeView: IView | null = null;
  private activeRoute: AppRoute | null = null;
  private routerSub: Disposable | null = null;

  private readonly eventBus?: EventBus | undefined;
  private eventBusSub: Disposable | null = null;

  private mobileNavItems: { id: AppRoute; label: string; icon: IconName }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'library', label: 'Library', icon: 'library' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'playlists', label: 'Playlists', icon: 'playlist' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  constructor(deps: AppShellDependencies) {
    this.eventBus = deps.eventBus;
    this.router = new RouterService('home');
    this.header = new HeaderComponent(this.router);
    this.sidebar = new SidebarComponent(this.router, deps.libraryService, deps.eventBus);
    this.miniPlayer = new MiniPlayerComponent({
      playbackManager: deps.playbackManager,
      artworkService: deps.artworkService,
      router: this.router,
      eventBus: deps.eventBus,
      sleepTimerService: deps.sleepTimerService
    });
    this.keyboardManager = new KeyboardManager({
      playbackManager: deps.playbackManager,
      router: this.router
    });
    this.mediaSessionService = new MediaSessionService({
      playbackManager: deps.playbackManager,
      eventBus: deps.eventBus,
      artworkService: deps.artworkService
    });

    const playlistsView = deps.playlistService
      ? new PlaylistsView({
          playlistService: deps.playlistService,
          playbackManager: deps.playbackManager,
          artworkService: deps.artworkService,
          eventBus: deps.eventBus,
          router: this.router
        })
      : new PlaylistsView();

    const galaxyView = deps.galaxyService
      ? new GalaxyView({
          galaxyService: deps.galaxyService,
          playbackManager: deps.playbackManager,
          libraryService: deps.libraryService,
          playlistService: deps.playlistService,
          searchService: deps.searchService,
          statsService: deps.statsService,
          artworkService: deps.artworkService,
          router: this.router,
          eventBus: deps.eventBus
        })
      : new GalaxyView();

    this.views = new Map<AppRoute, IView>([
      [
        'home',
        new HomeView(deps.libraryService, {
          playbackManager: deps.playbackManager,
          router: this.router,
          artworkService: deps.artworkService,
          playlistService: deps.playlistService,
          dashboardService: deps.dashboardService,
          eventBus: deps.eventBus
        })
      ],
      [
        'library',
        new LibraryView({
          libraryService: deps.libraryService,
          playbackManager: deps.playbackManager,
          artworkService: deps.artworkService,
          scannerService: deps.scannerService,
          fsAdapter: deps.fsAdapter,
          eventBus: deps.eventBus,
          duplicateDetectorService: deps.duplicateDetectorService
        })
      ],
      [
        'search',
        new SearchView({
          searchService: deps.searchService,
          playbackManager: deps.playbackManager,
          libraryService: deps.libraryService,
          artworkService: deps.artworkService,
          routerService: this.router
        })
      ],
      ['playlists', playlistsView],
      ['galaxy', galaxyView],
      [
        'settings',
        new SettingsView({
          audioEngine: deps.audioEngine,
          audioSettingsService: deps.audioSettingsService,
          visualizerService: deps.visualizerService,
          galaxyService: deps.galaxyService,
          dashboardService: deps.dashboardService,
          scannerService: deps.scannerService,
          libraryService: deps.libraryService,
          fsAdapter: deps.fsAdapter,
          dbAdapter: deps.dbAdapter,
          eventBus: deps.eventBus,
          router: this.router,
          playbackManager: deps.playbackManager,
          sleepTimerService: deps.sleepTimerService
        })
      ],
      [
        'nowplaying',
        new NowPlayingView({
          playbackManager: deps.playbackManager,
          libraryService: deps.libraryService,
          artworkService: deps.artworkService,
          lyricsService: deps.lyricsService,
          audioEngine: deps.audioEngine,
          visualizerService: deps.visualizerService,
          router: this.router,
          eventBus: deps.eventBus,
          sleepTimerService: deps.sleepTimerService
        })
      ],
      [
        'stats',
        new StatsView({
          statsService: deps.statsService ?? new StatsService({
            trackRepo: (deps.libraryService as any)?.trackRepo ?? {
              getById: async () => null,
              getByFileId: async () => null,
              list: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
              save: async () => {},
              saveBatch: async () => {},
              delete: async () => {},
              setFavorite: async () => {},
              incrementPlayCount: async () => {},
              count: async () => 0
            },
            dbAdapter: deps.dbAdapter
          }),
          playbackManager: deps.playbackManager,
          artworkService: deps.artworkService,
          router: this.router,
          eventBus: deps.eventBus
        })
      ]
    ]);
  }

  public mount(container: HTMLElement): void {
    ThemeManager.getInstance();
    this.container = container;
    this.renderLayout();

    // Mount persistent sub-components
    const headerEl = this.container.querySelector<HTMLElement>('#shell-header-slot');
    if (headerEl) this.header.mount(headerEl);

    const sidebarEl = this.container.querySelector<HTMLElement>('#shell-sidebar-slot');
    if (sidebarEl) this.sidebar.mount(sidebarEl);

    const miniPlayerEl = this.container.querySelector<HTMLElement>('#shell-miniplayer-slot');
    if (miniPlayerEl) this.miniPlayer.mount(miniPlayerEl);

    this.bindMobileNav();
    this.keyboardManager.init();
    this.mediaSessionService.init();

    // Subscribe to route changes
    this.routerSub = this.router.subscribe(state => {
      this.switchView(state);
      this.updateMobileNavActive(state);
    });

    // Mount initial view
    this.switchView(this.router.current);
    this.updateMobileNavActive(this.router.current);

    // Live Announcer Event Subscription
    if (this.eventBus) {
      this.eventBusSub = this.eventBus.subscribe('playback:state-changed', (event: any) => {
        if (!event) return;
        const liveEl = this.container?.querySelector<HTMLElement>('#shell-live-announcer');
        if (!liveEl) return;

        if (event.state === 'playing' && event.track) {
          liveEl.textContent = `Now playing ${event.track.title} by ${event.track.artistName ?? 'Unknown Artist'}`;
        } else if (event.state === 'paused') {
          liveEl.textContent = 'Playback paused';
        } else if (event.state === 'stopped') {
          liveEl.textContent = 'Playback stopped';
        }
      });
    }
  }

  public unmount(): void {
    if (this.routerSub) {
      this.routerSub.dispose();
      this.routerSub = null;
    }

    if (this.eventBusSub) {
      this.eventBusSub.dispose();
      this.eventBusSub = null;
    }

    if (this.activeView) {
      this.activeView.unmount();
      this.activeView = null;
    }

    this.header.unmount();
    this.sidebar.unmount();
    this.miniPlayer.unmount();
    this.keyboardManager.dispose();
    this.mediaSessionService.dispose();

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public getRouter(): RouterService {
    return this.router;
  }

  private renderLayout(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <style>
        #app-shell {
          display: grid;
          grid-template-rows: var(--header-height) 1fr var(--mini-player-height);
          grid-template-columns: var(--sidebar-width) 1fr;
          grid-template-areas:
            'sidebar header'
            'sidebar main'
            'miniplayer miniplayer';
          height: 100vh;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          background: var(--color-bg-base);
          color: var(--color-text-primary);
          overflow: hidden;
          position: relative;
        }

        #shell-bottom-nav-slot {
          display: none;
        }

        /* Tablet Responsive (768px – 1199px) */
        @media (min-width: 768px) and (max-width: 1199px) {
          #app-shell {
            grid-template-columns: 220px 1fr;
          }
        }

        /* Mobile Responsive (< 768px) */
        @media (max-width: 767px) {
          #app-shell {
            grid-template-rows: 56px 1fr auto auto;
            grid-template-columns: 1fr;
            grid-template-areas:
              'header'
              'main'
              'miniplayer'
              'bottomnav';
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
          }
          #shell-sidebar-slot {
            display: none !important;
          }
          #shell-bottom-nav-slot {
            display: flex !important;
            grid-area: bottomnav;
            height: auto;
            min-height: var(--bottom-nav-height);
            padding-bottom: max(6px, env(safe-area-inset-bottom));
            z-index: var(--z-bottom-nav);
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }
          #shell-miniplayer-slot {
            grid-area: miniplayer;
            z-index: var(--z-player);
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }
          #shell-viewport-slot {
            padding-bottom: var(--space-4);
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
          }
        }
      </style>

      <div id="app-shell">
        <div id="shell-live-announcer" aria-live="polite" aria-atomic="true" class="sr-only"></div>
        <div id="shell-sidebar-slot" style="grid-area: sidebar; height: 100%;"></div>
        <div id="shell-header-slot" style="grid-area: header;"></div>
        
        <main id="shell-viewport-slot" role="main" style="
          grid-area: main;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--color-bg-base);
          position: relative;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        "></main>
        
        <div id="shell-miniplayer-slot" style="grid-area: miniplayer;"></div>
        
        <!-- Mobile Bottom Navigation Bar -->
        <nav
          id="shell-bottom-nav-slot"
          class="glass-panel-elevated"
          role="navigation"
          aria-label="Mobile Bottom Navigation"
          style="
            border-top: 1px solid var(--glass-border);
            align-items: center;
            justify-content: space-around;
            padding-left: var(--space-2);
            padding-right: var(--space-2);
          "
        >
          ${this.mobileNavItems
            .map(
              item => `
            <button
              class="mobile-nav-btn"
              data-mobile-route="${item.id}"
              aria-label="${item.label}"
              aria-current="${this.router.current.route === item.id ? 'page' : 'false'}"
              style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 3px;
                flex: 1;
                min-height: 48px;
                background: transparent;
                border: none;
                color: ${this.router.current.route === item.id ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)'};
                font-size: 11px;
                font-weight: ${this.router.current.route === item.id ? '700' : '500'};
                cursor: pointer;
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              <span style="display: flex; align-items: center; justify-content: center;">
                ${getIconSvg(item.icon, { size: 20 })}
              </span>
              <span>${item.label}</span>
            </button>
          `
            )
            .join('')}
        </nav>
      </div>
    `;
  }

  private bindMobileNav(): void {
    if (!this.container) return;
    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.mobile-nav-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-mobile-route') as AppRoute;
        if (route) {
          this.router.navigate(route);
        }
      });
    });
  }

  private updateMobileNavActive(state: RouteState): void {
    if (!this.container) return;
    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.mobile-nav-btn');
    buttons.forEach(btn => {
      const route = btn.getAttribute('data-mobile-route');
      const isActive = route === state.route;
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      btn.style.color = isActive ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)';
      btn.style.fontWeight = isActive ? '700' : '500';
    });
  }

  private switchView(state: RouteState): void {
    if (!this.container) return;

    const viewport = this.container.querySelector<HTMLElement>('#shell-viewport-slot');
    if (!viewport) return;

    if (this.activeRoute === state.route && this.activeView) {
      this.activeView.updateParams?.(state.params);
      return;
    }

    if (this.activeView) {
      this.activeView.unmount();
    }

    const miniPlayerSlot = this.container.querySelector<HTMLElement>('#shell-miniplayer-slot');
    if (miniPlayerSlot) {
      miniPlayerSlot.style.display = state.route === 'nowplaying' ? 'none' : 'block';
    }

    const nextView = this.views.get(state.route) ?? this.views.get('home')!;
    this.activeRoute = state.route;
    this.activeView = nextView;
    nextView.mount(viewport, state.params);
  }
}
