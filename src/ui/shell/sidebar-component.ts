import type { RouterService } from '../navigation/router-service';
import type { AppRoute, RouteState } from '../navigation/route-types';
import type { Disposable } from '../../core/types/common';
import type { ILibraryService } from '../../services/contracts/service-contracts';
import { getIconSvg, type IconName } from '../icons/icon-registry';

export interface NavItem {
  id: AppRoute;
  label: string;
  icon: IconName;
}

export class SidebarComponent {
  private container: HTMLElement | null = null;
  private readonly router: RouterService;
  private readonly libraryService?: ILibraryService | undefined;
  private routerSub: Disposable | null = null;
  private statsInterval: number | null = null;

  private primaryNavItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'library', label: 'Library', icon: 'library' },
    { id: 'search', label: 'Search', icon: 'search' },
    { id: 'playlists', label: 'Playlists', icon: 'playlist' },
    { id: 'stats', label: 'Statistics', icon: 'bar-chart' },
    { id: 'galaxy', label: 'Galaxy', icon: 'galaxy' },
    { id: 'nowplaying', label: 'Now Playing', icon: 'now-playing' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  private yourMusicItems: { label: string; icon: IconName; route: AppRoute; params?: Record<string, any> }[] = [
    { label: 'Favorites', icon: 'heart', route: 'library', params: { tab: 'favorites' } },
    { label: 'Recently Added', icon: 'clock', route: 'library', params: { tab: 'songs', sort: 'dateAdded' } },
    { label: 'Most Played', icon: 'trending', route: 'library', params: { tab: 'songs', sort: 'playCount' } },
    { label: 'Downloads', icon: 'download', route: 'library', params: { tab: 'folders' } }
  ];

  constructor(router: RouterService, libraryService?: ILibraryService) {
    this.router = router;
    this.libraryService = libraryService;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();

    this.routerSub = this.router.subscribe(state => {
      this.updateActiveNav(state);
    });

    this.fetchLibraryStats();
  }

  public unmount(): void {
    if (this.routerSub) {
      this.routerSub.dispose();
      this.routerSub = null;
    }
    if (this.statsInterval) {
      window.clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <aside
        id="app-sidebar"
        class="glass-panel"
        role="navigation"
        aria-label="Primary Navigation"
        style="
          width: var(--sidebar-width);
          height: 100%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--glass-border);
          padding: var(--space-4);
          gap: var(--space-3);
          z-index: var(--z-sidebar);
          overflow-y: auto;
          overflow-x: hidden;
          box-sizing: border-box;
        "
      >
        <!-- App Logo & Tagline -->
        <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2) var(--space-3); cursor: pointer;" id="sidebar-brand">
          <div style="
            width: 38px;
            height: 38px;
            border-radius: var(--radius-md);
            background: var(--gradient-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            box-shadow: var(--shadow-glow-purple);
            flex-shrink: 0;
          ">
            ${getIconSvg('sound-wave', { size: 22, color: '#ffffff' })}
          </div>
          <div style="display: flex; flex-direction: column; overflow: hidden;">
            <span style="font-size: 17px; font-weight: 800; letter-spacing: -0.03em; color: var(--color-text-primary); line-height: 1.2;">
              MyMusicApp
            </span>
            <span style="font-size: 11px; color: var(--color-text-muted); font-weight: 500; letter-spacing: 0.02em;">
              Your Music. Your Space.
            </span>
          </div>
        </div>

        <!-- Main Navigation Section -->
        <nav style="display: flex; flex-direction: column; gap: var(--space-1);" aria-label="Main menu">
          ${this.primaryNavItems
            .map(item => {
              const isActive = this.router.current.route === item.id;
              return `
                <button
                  data-route="${item.id}"
                  aria-current="${isActive ? 'page' : 'false'}"
                  style="
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: 10px var(--space-4);
                    min-height: 42px;
                    border-radius: var(--radius-md);
                    border: 1px solid ${isActive ? 'var(--glass-border-highlight)' : 'transparent'};
                    background: ${isActive ? 'var(--color-bg-surface-elevated)' : 'transparent'};
                    color: ${isActive ? 'var(--color-accent-purple-glow)' : 'var(--color-text-secondary)'};
                    font-size: 14px;
                    font-weight: ${isActive ? '600' : '500'};
                    cursor: pointer;
                    text-align: left;
                    width: 100%;
                    box-shadow: ${isActive ? 'var(--shadow-sm)' : 'none'};
                    transition: all var(--duration-fast) var(--ease-smooth);
                  "
                >
                  <span style="display: flex; align-items: center; justify-content: center; width: 20px; color: ${isActive ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)'};">
                    ${getIconSvg(item.icon, { size: 18 })}
                  </span>
                  <span style="flex: 1;">${item.label}</span>
                  ${isActive ? `<span style="width: 6px; height: 6px; border-radius: var(--radius-full); background: var(--color-accent-purple-glow); box-shadow: var(--shadow-glow-purple);"></span>` : ''}
                </button>
              `;
            })
            .join('')}
        </nav>

        <!-- YOUR MUSIC Section -->
        <div style="display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-2);">
          <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-dim); padding: 0 var(--space-3) var(--space-1);">
            Your Music
          </span>
          <div style="display: flex; flex-direction: column; gap: var(--space-0-5);">
            ${this.yourMusicItems
              .map(item => `
                <button
                  class="sidebar-sub-nav-btn"
                  data-sub-route="${item.route}"
                  data-sub-params='${JSON.stringify(item.params ?? {})}'
                  style="
                    display: flex;
                    align-items: center;
                    gap: var(--space-3);
                    padding: 8px var(--space-4);
                    min-height: 38px;
                    border-radius: var(--radius-md);
                    border: 1px solid transparent;
                    background: transparent;
                    color: var(--color-text-secondary);
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    text-align: left;
                    width: 100%;
                    transition: all var(--duration-fast) var(--ease-smooth);
                  "
                >
                  <span style="display: flex; align-items: center; justify-content: center; width: 18px; color: var(--color-text-muted);">
                    ${getIconSvg(item.icon, { size: 16 })}
                  </span>
                  <span>${item.label}</span>
                </button>
              `)
              .join('')}
          </div>
        </div>

        <!-- Spacer -->
        <div style="flex: 1; min-height: var(--space-2);"></div>

        <!-- Bottom Local Library Card -->
        <div
          id="sidebar-library-card"
          class="glass-card"
          role="button"
          tabindex="0"
          aria-label="Open Local Library"
          style="
            padding: var(--space-3) var(--space-4);
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            cursor: pointer;
            background: var(--color-bg-surface-elevated);
          "
        >
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: var(--radius-sm);
              background: rgba(139, 92, 246, 0.15);
              border: 1px solid rgba(139, 92, 246, 0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--color-accent-purple-glow);
              flex-shrink: 0;
            ">
              ${getIconSvg('folder', { size: 16 })}
            </div>
            <div style="display: flex; flex-direction: column; overflow: hidden;">
              <span style="font-size: 12px; font-weight: 600; color: var(--color-text-primary);">
                Local Library
              </span>
              <span id="sidebar-lib-stats" style="font-size: 11px; color: var(--color-text-muted);">
                Ready to play
              </span>
            </div>
          </div>
          <!-- Storage Meter Progress Bar -->
          <div style="width: 100%; height: 4px; border-radius: var(--radius-full); background: rgba(255, 255, 255, 0.08); overflow: hidden;">
            <div id="sidebar-lib-meter" style="width: 35%; height: 100%; border-radius: var(--radius-full); background: var(--gradient-primary);"></div>
          </div>
        </div>
      </aside>
    `;

    // Bind brand click -> home
    this.container.querySelector('#sidebar-brand')?.addEventListener('click', () => {
      this.router.navigate('home');
    });

    // Bind navigation click events
    const navButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-route]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-route') as AppRoute;
        if (route) {
          this.router.navigate(route);
        }
      });
    });

    // Bind YOUR MUSIC sub-navigation click events
    const subNavButtons = this.container.querySelectorAll<HTMLButtonElement>('.sidebar-sub-nav-btn');
    subNavButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-sub-route') as AppRoute;
        const paramsStr = btn.getAttribute('data-sub-params');
        const params = paramsStr ? JSON.parse(paramsStr) : {};
        if (route) {
          this.router.navigate(route, params);
        }
      });
    });

    // Bind Library card click -> library
    this.container.querySelector('#sidebar-library-card')?.addEventListener('click', () => {
      this.router.navigate('library');
    });
  }

  private updateActiveNav(state: RouteState): void {
    if (!this.container) return;
    const navButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-route]');
    navButtons.forEach(btn => {
      const route = btn.getAttribute('data-route');
      const isActive = route === state.route;
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      btn.style.background = isActive ? 'var(--color-bg-surface-elevated)' : 'transparent';
      btn.style.color = isActive ? 'var(--color-accent-purple-glow)' : 'var(--color-text-secondary)';
      btn.style.borderColor = isActive ? 'var(--glass-border-highlight)' : 'transparent';
      btn.style.fontWeight = isActive ? '600' : '500';
    });
  }

  private async fetchLibraryStats(): Promise<void> {
    if (!this.libraryService) return;
    try {
      const stats = await this.libraryService.getLibraryStats();
      if (!this.container) return;
      const statsEl = this.container.querySelector('#sidebar-lib-stats');
      if (statsEl && stats) {
        statsEl.textContent = `${stats.trackCount} songs • ${stats.albumCount} albums`;
      }
    } catch {
      // Gracefully retain placeholder text
    }
  }
}
