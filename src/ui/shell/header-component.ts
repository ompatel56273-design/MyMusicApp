import type { RouterService } from '../navigation/router-service';
import type { RouteState } from '../navigation/route-types';
import type { Disposable } from '../../core/types/common';
import { ThemeManager } from '../theme/theme-manager';
import { getIconSvg } from '../icons/icon-registry';
import { renderAvatar } from '../primitives/avatar';

export class HeaderComponent {
  private container: HTMLElement | null = null;
  private readonly router: RouterService;
  private routerSub: Disposable | null = null;
  private themeUnsub: (() => void) | null = null;

  constructor(router: RouterService) {
    this.router = router;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();

    this.routerSub = this.router.subscribe(state => {
      this.updateTitle(state);
    });

    const themeManager = ThemeManager.getInstance();
    this.themeUnsub = themeManager.subscribe(theme => {
      this.updateThemeIcon(theme);
    });
  }

  public unmount(): void {
    if (this.themeUnsub) {
      this.themeUnsub();
      this.themeUnsub = null;
    }
    if (this.routerSub) {
      this.routerSub.dispose();
      this.routerSub = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <style>
        .app-header {
          height: var(--header-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-6);
          border-bottom: 1px solid var(--glass-border);
          z-index: var(--z-header);
          gap: var(--space-4);
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
        }

        .header-left-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
          min-width: 0;
        }

        .header-search-container {
          flex: 1;
          max-width: 520px;
          min-width: 0;
          margin: 0 var(--space-2);
        }

        .header-right-group {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }

        .header-user-name, .header-user-chevron {
          display: inline;
        }

        /* Mobile Header Responsive (< 768px) */
        @media (max-width: 767px) {
          .app-header {
            padding: 0 12px;
            gap: 8px;
            height: 56px;
          }

          .header-nav-btns {
            display: none !important;
          }

          .header-left-group h1 {
            font-size: 15px !important;
          }

          .header-search-container {
            margin: 0;
            max-width: 100%;
          }

          #global-search-input {
            height: 36px !important;
            padding: 0 12px 0 32px !important;
            font-size: 12px !important;
          }

          .header-search-icon {
            left: 10px !important;
            font-size: 12px !important;
          }

          .header-shortcut-badge {
            display: none !important;
          }

          .header-right-group {
            gap: 6px;
          }

          #header-theme-toggle {
            display: none !important;
          }

          #header-notifications-btn {
            width: 34px !important;
            height: 34px !important;
          }

          #header-user-profile {
            padding: 2px !important;
          }

          .header-user-name, .header-user-chevron {
            display: none !important;
          }
        }
      </style>

      <header
        class="glass-panel app-header"
        role="banner"
      >
        <!-- Left: History Navigation & Route Title -->
        <div class="header-left-group">
          <div class="header-nav-btns" style="display: flex; gap: var(--space-1);">
            <button
              id="nav-back-btn"
              aria-label="Go Back"
              style="
                width: 34px;
                height: 34px;
                border-radius: var(--radius-sm);
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              ${getIconSvg('chevron-left', { size: 16 })}
            </button>
            <button
              id="nav-forward-btn"
              aria-label="Go Forward"
              style="
                width: 34px;
                height: 34px;
                border-radius: var(--radius-sm);
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              ${getIconSvg('chevron-right', { size: 16 })}
            </button>
          </div>

          <h1 id="header-route-title" style="font-size: 16px; font-weight: 700; text-transform: capitalize; letter-spacing: -0.01em; color: var(--color-text-primary); margin: 0; white-space: nowrap;">
            ${this.router.current.route}
          </h1>
        </div>

        <!-- Center: Global Search Input -->
        <div class="header-search-container">
          <div style="position: relative; display: flex; align-items: center; width: 100%;">
            <span class="header-search-icon" style="position: absolute; left: 14px; color: var(--color-text-muted); pointer-events: none; display: flex; align-items: center;">
              ${getIconSvg('search', { size: 15 })}
            </span>
            <input
              id="global-search-input"
              type="search"
              placeholder="Search music, artists, albums, playlists..."
              aria-label="Search local library"
              style="
                width: 100%;
                height: 40px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                padding: 0 70px 0 38px;
                color: var(--color-text-primary);
                font-size: 13px;
                outline: none;
                transition: all var(--duration-fast) var(--ease-smooth);
                box-sizing: border-box;
                min-width: 0;
              "
            />
            <div class="header-shortcut-badge" style="
              position: absolute;
              right: 12px;
              padding: 2px 6px;
              border-radius: var(--radius-xs);
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid var(--glass-border);
              font-size: 10px;
              font-weight: 600;
              color: var(--color-text-muted);
              pointer-events: none;
            ">Ctrl + K</div>
          </div>
        </div>

        <!-- Right: Actions & User Avatar Pill -->
        <div class="header-right-group">
          <!-- Theme Toggle -->
          <button
            id="header-theme-toggle"
            aria-label="Toggle Theme"
            style="
              width: 36px;
              height: 36px;
              border-radius: var(--radius-full);
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              color: var(--color-text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            <span id="theme-toggle-icon" style="display: flex; align-items: center;">
              ${getIconSvg('sun', { size: 18 })}
            </span>
          </button>

          <!-- Notifications with Indicator -->
          <button
            id="header-notifications-btn"
            aria-label="Notifications"
            style="
              width: 36px;
              height: 36px;
              border-radius: var(--radius-full);
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              color: var(--color-text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            ${getIconSvg('bell', { size: 18 })}
            <span style="
              position: absolute;
              top: 7px;
              right: 8px;
              width: 7px;
              height: 7px;
              border-radius: var(--radius-full);
              background: var(--color-status-error);
              border: 1.5px solid var(--color-bg-surface);
            "></span>
          </button>

          <!-- User Profile Pill -->
          <div
            id="header-user-profile"
            role="button"
            tabindex="0"
            aria-label="User Profile Om Patel"
            style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
              padding: 4px 10px 4px 4px;
              border-radius: var(--radius-full);
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              cursor: pointer;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            ${renderAvatar({ name: 'Om Patel', size: 'sm', isArtist: true })}
            <span class="header-user-name" style="font-size: 13px; font-weight: 600; color: var(--color-text-primary);">
              Om Patel
            </span>
            <span class="header-user-chevron" style="display: flex; align-items: center; color: var(--color-text-muted);">
              ${getIconSvg('chevron-down', { size: 14 })}
            </span>
          </div>
        </div>
      </header>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    // History navigation
    this.container.querySelector('#nav-back-btn')?.addEventListener('click', () => {
      this.router.back();
    });

    this.container.querySelector('#nav-forward-btn')?.addEventListener('click', () => {
      this.router.forward();
    });

    // Theme toggle button
    const themeBtn = this.container.querySelector('#header-theme-toggle');
    themeBtn?.addEventListener('click', () => {
      const themeManager = ThemeManager.getInstance();
      const current = themeManager.getPreference();
      const next = current === 'dark' ? 'light' : 'dark';
      themeManager.setPreference(next);
    });

    // Search input enter/focus -> Search view
    const searchInput = this.container.querySelector<HTMLInputElement>('#global-search-input');
    searchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && searchInput.value.trim().length > 0) {
        this.router.navigate('search', { query: searchInput.value.trim() });
      }
    });

    searchInput?.addEventListener('click', () => {
      if (this.router.current.route !== 'search') {
        this.router.navigate('search');
      }
    });

    // Profile click -> Settings
    this.container.querySelector('#header-user-profile')?.addEventListener('click', () => {
      this.router.navigate('settings');
    });
  }

  private updateTitle(state: RouteState): void {
    if (!this.container) return;
    const titleEl = this.container.querySelector('#header-route-title');
    if (titleEl) {
      titleEl.textContent = state.route === 'nowplaying' ? 'Now Playing' : state.route;
    }
  }

  private updateThemeIcon(theme: 'dark' | 'light'): void {
    if (!this.container) return;
    const iconEl = this.container.querySelector('#theme-toggle-icon');
    if (iconEl) {
      iconEl.innerHTML = getIconSvg(theme === 'dark' ? 'sun' : 'moon', { size: 18 });
    }
  }
}
