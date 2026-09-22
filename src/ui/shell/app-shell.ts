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
import { HeaderComponent } from './header-component';
import { SidebarComponent } from './sidebar-component';
import { MiniPlayerComponent } from './mini-player-component';
import { KeyboardManager } from '../keyboard/keyboard-manager';
import type { IPlaybackManager, ILibraryService, ISearchService, IArtworkService, IPlaylistService, ILyricsService, IAudioEngine, IAudioSettingsService, IVisualizerService, IGalaxyService } from '../../services/contracts/service-contracts';
import { EventBus } from '../../core/events/event-bus';
import type { Disposable } from '../../core/types/common';

import { ThemeManager } from '../theme/theme-manager';

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
  eventBus: EventBus;
}

/**
 * Master Application Shell.
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

  private views: Map<AppRoute, IView>;
  private activeView: IView | null = null;
  private activeRoute: AppRoute | null = null;
  private routerSub: Disposable | null = null;

  private readonly eventBus?: EventBus | undefined;
  private eventBusSub: Disposable | null = null;

  private mobileNavItems: { id: AppRoute; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: 'library', label: 'Library', icon: '𝄤' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'playlists', label: 'Playlists', icon: '☰' },
    { id: 'settings', label: 'Settings', icon: '⚙' }
  ];

  constructor(deps: AppShellDependencies) {
    this.eventBus = deps.eventBus;
    this.router = new RouterService('home');
    this.header = new HeaderComponent(this.router);
    this.sidebar = new SidebarComponent(this.router, deps.libraryService);
    this.miniPlayer = new MiniPlayerComponent({
      playbackManager: deps.playbackManager,
      artworkService: deps.artworkService,
      router: this.router,
      eventBus: deps.eventBus
    });
    this.keyboardManager = new KeyboardManager({
      playbackManager: deps.playbackManager,
      router: this.router
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
          eventBus: deps.eventBus
        })
      ],
      [
        'library',
        new LibraryView({
          libraryService: deps.libraryService,
          playbackManager: deps.playbackManager,
          artworkService: deps.artworkService
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
          galaxyService: deps.galaxyService
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
            grid-template-rows: var(--header-height) 1fr auto auto;
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
            height: var(--bottom-nav-height);
            z-index: 30;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }
          #shell-miniplayer-slot {
            grid-area: miniplayer;
            z-index: 25;
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
            padding: 0 var(--space-2);
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
              <span style="font-size: 18px;">${item.icon}</span>
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

