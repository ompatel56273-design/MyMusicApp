import type { RouterService } from '../navigation/router-service';
import type { RouteState } from '../navigation/route-types';
import type { Disposable } from '../../core/types/common';
import type { ISearchService, ILibraryService, IPlaylistService } from '../../services/contracts/service-contracts';
import { GlobalSearchService, type GroupedGlobalSearchResults, type GlobalSearchResultItem } from '../../services/search/global-search-service';
import { ThemeManager } from '../theme/theme-manager';
import { getIconSvg, type IconName } from '../icons/icon-registry';
import { renderAvatar } from '../primitives/avatar';
import { escapeHtml } from '../../core/security/html-sanitizer';

export class HeaderComponent {
  private container: HTMLElement | null = null;
  private readonly router: RouterService;
  private readonly globalSearchService: GlobalSearchService;
  private routerSub: Disposable | null = null;
  private themeUnsub: (() => void) | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSearchResults: GroupedGlobalSearchResults | null = null;
  private activeItemIndex: number = -1;
  private flatResultItems: GlobalSearchResultItem[] = [];
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    router: RouterService,
    searchService?: ISearchService,
    libraryService?: ILibraryService,
    playlistService?: IPlaylistService
  ) {
    this.router = router;
    this.globalSearchService = new GlobalSearchService({
      searchService,
      libraryService,
      playlistService
    });
  }

  public getCurrentSearchResults(): GroupedGlobalSearchResults | null {
    return this.currentSearchResults;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();

    this.routerSub = this.router.subscribe(state => {
      this.updateTitle(state);
      this.closeSearchDropdown();
    });

    const themeManager = ThemeManager.getInstance();
    this.themeUnsub = themeManager.subscribe(theme => {
      this.updateThemeIcon(theme);
    });

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.container) return;
      const searchContainer = this.container.querySelector('.header-search-container');
      if (searchContainer && !searchContainer.contains(e.target as Node)) {
        this.closeSearchDropdown();
      }
    };
    document.addEventListener('click', this.outsideClickHandler);
  }

  public unmount(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
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
          overflow: visible;
          position: relative;
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
          max-width: 540px;
          min-width: 0;
          margin: 0 var(--space-2);
          position: relative;
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

        /* Global Search Dropdown */
        .global-search-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: rgba(10, 14, 26, 0.96);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-xl);
          box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.85), 0 0 24px rgba(124, 58, 237, 0.2);
          max-height: 480px;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          z-index: 1000;
          padding: var(--space-2);
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-sizing: border-box;
        }

        .global-search-group-header {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-accent-cyan);
          padding: 6px 12px 2px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .global-search-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: var(--radius-lg);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-height: 44px;
          box-sizing: border-box;
          text-align: left;
          width: 100%;
          gap: 12px;
          user-select: none;
        }

        .global-search-item:hover,
        .global-search-item.global-search-item-active {
          background: rgba(124, 58, 237, 0.15);
          border-color: rgba(168, 85, 247, 0.35);
        }

        .global-search-item-icon {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-accent-purple-glow);
          flex-shrink: 0;
        }

        .global-search-item-main {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .global-search-item-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .global-search-item-subtitle {
          font-size: 11px;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .global-search-item-badge {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-muted);
          border: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .global-search-footer {
          padding: 8px 12px;
          border-top: 1px solid var(--glass-border);
          font-size: 11px;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
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

          .global-search-dropdown {
            position: fixed;
            top: 56px;
            left: 8px;
            right: 8px;
            max-height: calc(100vh - 180px);
            z-index: var(--z-modal);
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

        <!-- Center: Global App Search Input & Dynamic Dropdown -->
        <div class="header-search-container" id="header-search-wrapper">
          <div style="position: relative; display: flex; align-items: center; width: 100%;">
            <span class="header-search-icon" style="position: absolute; left: 14px; color: var(--color-text-muted); pointer-events: none; display: flex; align-items: center;">
              ${getIconSvg('search', { size: 15 })}
            </span>
            <input
              id="global-search-input"
              type="search"
              placeholder="Search songs, folders, settings, pages..."
              aria-label="Search app ecosystem and library"
              autocomplete="off"
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

          <!-- Dropdown Slot -->
          <div id="header-search-dropdown-slot"></div>
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

    // Global Search Input interaction
    const searchInput = this.container.querySelector<HTMLInputElement>('#global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value;
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
          void this.executeGlobalSearch(query);
        }, 200);
      });

      searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateDropdown(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateDropdown(-1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.activeItemIndex >= 0 && this.activeItemIndex < this.flatResultItems.length) {
            const selected = this.flatResultItems[this.activeItemIndex]!;
            this.handleItemClick(selected);
          } else if (searchInput.value.trim().length > 0) {
            this.closeSearchDropdown();
            this.router.navigate('search', { query: searchInput.value.trim() });
          }
        } else if (e.key === 'Escape') {
          this.closeSearchDropdown();
          searchInput.blur();
        }
      });

      searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length > 0) {
          void this.executeGlobalSearch(searchInput.value);
        }
      });
    }

    // Profile click -> Settings
    this.container.querySelector('#header-user-profile')?.addEventListener('click', () => {
      this.router.navigate('settings');
    });
  }

  public async executeGlobalSearch(query: string): Promise<void> {
    if (!this.container) return;
    const raw = query.trim();
    if (!raw) {
      this.closeSearchDropdown();
      return;
    }

    const results = await this.globalSearchService.searchGlobal(raw, 4);
    this.currentSearchResults = results;
    this.renderSearchDropdown(results);
  }

  private renderSearchDropdown(results: GroupedGlobalSearchResults): void {
    if (!this.container) return;
    const slot = this.container.querySelector<HTMLElement>('#header-search-dropdown-slot');
    if (!slot) return;

    this.flatResultItems = [
      ...results.pages,
      ...results.settings,
      ...results.folders,
      ...results.tracks,
      ...results.artists,
      ...results.albums,
      ...results.playlists,
      ...results.genres
    ];
    this.activeItemIndex = -1;

    if (results.totalMatches === 0) {
      slot.innerHTML = `
        <div class="global-search-dropdown" role="listbox" aria-label="Search Results">
          <div style="padding: 16px; text-align: center; color: var(--color-text-muted); font-size: 13px;">
            No results found for "<span style="color: var(--color-text-primary); font-weight: 600;">${escapeHtml(results.query)}</span>"
          </div>
          <div class="global-search-footer">
            <span>Press <strong>Enter</strong> to search Music Library</span>
          </div>
        </div>
      `;
      return;
    }

    let flatCounter = 0;

    const renderGroup = (header: string, iconName: IconName, items: readonly GlobalSearchResultItem[], categoryBadge: string) => {
      if (!items || items.length === 0) return '';
      const itemsHtml = items.map(item => {
        const itemIdx = flatCounter++;
        return `
          <button
            class="global-search-item"
            data-search-index="${itemIdx}"
            role="option"
            aria-selected="false"
            aria-label="${escapeHtml(item.title)} - ${escapeHtml(categoryBadge)}"
          >
            <div class="global-search-item-icon">
              ${getIconSvg(item.icon as IconName, { size: 16 })}
            </div>
            <div class="global-search-item-main">
              <span class="global-search-item-title">${escapeHtml(item.title)}</span>
              ${item.subtitle ? `<span class="global-search-item-subtitle">${escapeHtml(item.subtitle)}</span>` : ''}
            </div>
            <span class="global-search-item-badge">${escapeHtml(categoryBadge)}</span>
          </button>
        `;
      }).join('');

      return `
        <div class="global-search-group-header">
          <span>${getIconSvg(iconName, { size: 12, color: 'var(--color-accent-cyan)' })}</span>
          <span>${escapeHtml(header)}</span>
        </div>
        ${itemsHtml}
      `;
    };

    slot.innerHTML = `
      <div class="global-search-dropdown" role="listbox" aria-label="Global Search Results">
        ${renderGroup('Application Pages', 'home', results.pages, 'Page')}
        ${renderGroup('Settings & Controls', 'settings', results.settings, 'Settings')}
        ${renderGroup('Indexed Folders', 'folder', results.folders, 'Folder')}
        ${renderGroup('Tracks', 'music', results.tracks, 'Track')}
        ${renderGroup('Artists', 'user', results.artists, 'Artist')}
        ${renderGroup('Albums', 'disc', results.albums, 'Album')}
        ${renderGroup('Playlists', 'playlist', results.playlists, 'Playlist')}
        ${renderGroup('Genres', 'sparkles', results.genres, 'Genre')}

        <div class="global-search-footer">
          <span><strong>↑↓</strong> navigate</span>
          <span><strong>↵</strong> select</span>
          <span><strong>esc</strong> close</span>
        </div>
      </div>
    `;

    // Bind click events on dropdown items
    slot.querySelectorAll<HTMLButtonElement>('.global-search-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-search-index'));
        const item = this.flatResultItems[idx];
        if (item) {
          this.handleItemClick(item);
        }
      });
    });
  }

  private navigateDropdown(direction: number): void {
    if (!this.container || this.flatResultItems.length === 0) return;
    const total = this.flatResultItems.length;

    this.activeItemIndex = (this.activeItemIndex + direction + total) % total;

    const items = this.container.querySelectorAll<HTMLButtonElement>('.global-search-item');
    items.forEach((itemEl, idx) => {
      if (idx === this.activeItemIndex) {
        itemEl.classList.add('global-search-item-active');
        itemEl.setAttribute('aria-selected', 'true');
        itemEl.scrollIntoView({ block: 'nearest' });
      } else {
        itemEl.classList.remove('global-search-item-active');
        itemEl.setAttribute('aria-selected', 'false');
      }
    });
  }

  private handleItemClick(item: GlobalSearchResultItem): void {
    this.closeSearchDropdown();
    const searchInput = this.container?.querySelector<HTMLInputElement>('#global-search-input');
    if (searchInput) {
      searchInput.value = '';
    }

    if (item.params) {
      this.router.navigate(item.route, item.params);
    } else {
      this.router.navigate(item.route);
    }
  }

  private closeSearchDropdown(): void {
    if (!this.container) return;
    const slot = this.container.querySelector<HTMLElement>('#header-search-dropdown-slot');
    if (slot) {
      slot.innerHTML = '';
    }
    this.currentSearchResults = null;
    this.activeItemIndex = -1;
    this.flatResultItems = [];
  }

  private updateTitle(state: RouteState): void {
    if (!this.container) return;
    const titleEl = this.container.querySelector('#header-route-title');
    if (titleEl) {
      titleEl.textContent = state.route === 'nowplaying' ? 'Now Playing' : state.route === 'stats' ? 'Statistics' : state.route;
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
