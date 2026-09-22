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
 * Mounts persistent layout regions (Header, Sidebar, Main Content Viewport, MiniPlayer),
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

  constructor(deps: AppShellDependencies) {
    this.eventBus = deps.eventBus;
    this.router = new RouterService('home');
    this.header = new HeaderComponent(this.router);
    this.sidebar = new SidebarComponent(this.router);
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
      ['home', new HomeView(deps.libraryService)],
      [
        'library',
        new LibraryView({
          libraryService: deps.libraryService,
          playbackManager: deps.playbackManager,
          artworkService: deps.artworkService
        })
      ],
      ['search', new SearchView(deps.searchService)],
      ['playlists', playlistsView],
      ['galaxy', galaxyView],
      [
        'settings',
        new SettingsView({
          audioEngine: deps.audioEngine,
          audioSettingsService: deps.audioSettingsService,
          visualizerService: deps.visualizerService
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
    this.container = container;
    this.renderLayout();

    // Mount persistent sub-components
    const headerEl = this.container.querySelector<HTMLElement>('#shell-header-slot');
    if (headerEl) this.header.mount(headerEl);

    const sidebarEl = this.container.querySelector<HTMLElement>('#shell-sidebar-slot');
    if (sidebarEl) this.sidebar.mount(sidebarEl);

    const miniPlayerEl = this.container.querySelector<HTMLElement>('#shell-miniplayer-slot');
    if (miniPlayerEl) this.miniPlayer.mount(miniPlayerEl);

    this.keyboardManager.init();

    // Subscribe to route changes
    this.routerSub = this.router.subscribe(state => {
      this.switchView(state);
    });

    // Mount initial view
    this.switchView(this.router.current);

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
        @media (max-width: 600px) {
          #app-shell {
            grid-template-columns: 1fr !important;
            grid-template-areas:
              'header'
              'main'
              'miniplayer' !important;
          }
          #shell-sidebar-slot {
            display: none !important;
          }
        }
      </style>
      <div id="app-shell" style="
        display: grid;
        grid-template-rows: auto 1fr auto;
        grid-template-columns: auto 1fr;
        grid-template-areas:
          'header header'
          'sidebar main'
          'miniplayer miniplayer';
        height: 100vh;
        width: 100vw;
        background: var(--color-bg-base);
        color: var(--color-text-primary);
        overflow: hidden;
      ">
        <div id="shell-live-announcer" aria-live="polite" aria-atomic="true" class="sr-only"></div>
        <div id="shell-header-slot" style="grid-area: header;"></div>
        <div id="shell-sidebar-slot" style="grid-area: sidebar;"></div>
        <main id="shell-viewport-slot" role="main" style="
          grid-area: main;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--color-bg-base);
          position: relative;
        "></main>
        <div id="shell-miniplayer-slot" style="grid-area: miniplayer;"></div>
      </div>
    `;
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
