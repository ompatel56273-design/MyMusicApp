import type { RouterService } from '../navigation/router-service';
import type { RouteState } from '../navigation/route-types';
import type { Disposable } from '../../core/types/common';
import { ThemeManager } from '../theme/theme-manager';

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
          z-index: 10;
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
          gap: var(--space-4);
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

        .header-user-name {
          display: inline;
        }

        .header-user-chevron {
          display: inline;
        }

        .header-shortcut-badge {
          display: block;
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
            width: 32px !important;
            height: 32px !important;
            font-size: 14px !important;
          }

          #header-user-profile {
            padding: 2px !important;
            border-radius: var(--radius-full);
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
                font-size: 16px;
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >‹</button>
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
                font-size: 16px;
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >›</button>
          </div>

          <h1 id="header-route-title" style="font-size: 16px; font-weight: 700; text-transform: capitalize; letter-spacing: -0.01em; color: var(--color-text-primary); margin: 0; white-space: nowrap;">
            ${this.router.current.route}
          </h1>
        </div>

        <!-- Center: Global Search Input -->
        <div class="header-search-container">
          <div style="position: relative; display: flex; align-items: center; width: 100%;">
            <span class="header-search-icon" style="position: absolute; left: 14px; color: var(--color-text-muted); font-size: 14px; pointer-events: none;">🔍</span>
            <input
              id="global-search-input"
              type="search"
              placeholder="Search music, artists, albums..."
              aria-label="Search local library"
              style="
                width: 100%;
                height: 40px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                padding: 0 70px 0 40px;
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
              font-size: 15px;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            ☀️
          </button>

          <!-- Notifications Bell -->
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
              font-size: 15px;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            🔔
            <span style="
              position: absolute;
              top: 7px;
              right: 7px;
              width: 7px;
              height: 7px;
              border-radius: var(--radius-full);
              background: var(--color-accent-pink);
              box-shadow: var(--shadow-glow-pink);
            "></span>
          </button>

          <!-- User Profile Pill -->
          <div
            id="header-user-profile"
            style="
              display: flex;
              align-items: center;
              gap: var(--space-2);
              padding: 4px 12px 4px 4px;
              border-radius: var(--radius-full);
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              cursor: pointer;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            <div style="
              width: 28px;
              height: 28px;
              border-radius: var(--radius-full);
              background: var(--gradient-primary);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 700;
              font-size: 13px;
              box-shadow: var(--shadow-glow-purple);
              flex-shrink: 0;
            ">
              O
            </div>
            <span class="header-user-name" style="font-size: 13px; font-weight: 600; color: var(--color-text-primary);">
              Om Patel
            </span>
            <span class="header-user-chevron" style="font-size: 10px; color: var(--color-text-muted);">▼</span>
          </div>
        </div>
      </header>
    `;

    // Bind Back / Forward buttons
    const backBtn = this.container.querySelector('#nav-back-btn');
    backBtn?.addEventListener('click', () => this.router.back());

    const fwdBtn = this.container.querySelector('#nav-forward-btn');
    fwdBtn?.addEventListener('click', () => this.router.forward());

    // Bind Search Input
    const searchInput = this.container.querySelector<HTMLInputElement>('#global-search-input');
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.trim();
      this.router.navigate('search', { query });
    });

    // Bind search focus on Ctrl+K
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput?.focus();
      }
    });

    // Bind theme toggle
    const themeManager = ThemeManager.getInstance();
    const themeBtn = this.container.querySelector<HTMLButtonElement>('#header-theme-toggle');

    this.themeUnsub = themeManager.subscribe((resolved) => {
      if (themeBtn) {
        themeBtn.textContent = resolved === 'dark' ? '☀️' : '🌙';
        themeBtn.setAttribute('title', resolved === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      }
    });

    themeBtn?.addEventListener('click', () => {
      const currentResolved = themeManager.getResolvedTheme();
      themeManager.setPreference(currentResolved === 'dark' ? 'light' : 'dark');
    });

    // Profile click -> settings
    this.container.querySelector('#header-user-profile')?.addEventListener('click', () => {
      this.router.navigate('settings');
    });
  }

  private updateTitle(state: RouteState): void {
    if (!this.container) return;
    const titleEl = this.container.querySelector('#header-route-title');
    if (titleEl) {
      titleEl.textContent = state.route.charAt(0).toUpperCase() + state.route.slice(1);
    }
  }
}

