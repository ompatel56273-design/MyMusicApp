import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { RouterService } from '../navigation/router-service';
import type {
  ISearchService,
  ILibraryService,
  IPlaybackManager,
  IArtworkService,
  SearchResults
} from '../../services/contracts/service-contracts';
import type { Track, Album, Artist } from '../../domain/entities/models';
import { escapeHtml } from '../../core/security/html-sanitizer';
import { TrackRowComponent } from '../components/library/track-row-component';
import { AlbumCardComponent } from '../components/library/album-card-component';
import { ArtistCardComponent } from '../components/library/artist-card-component';
import { getIconSvg, type IconName } from '../icons/icon-registry';

export type SearchCategory = 'all' | 'songs' | 'albums' | 'artists' | 'playlists' | 'genres';

export interface SearchViewDependencies {
  searchService?: ISearchService | undefined;
  libraryService?: ILibraryService | undefined;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
  routerService?: RouterService | undefined;
}

/**
 * Phase 6 Complete Visual Rebuild of Search View (Template 4).
 * Features:
 * - Authoritative Template 4 composition for Desktop, Tablet, and Mobile
 * - Search Hero with atmospheric purple/cyan glow, large input, keyboard shortcut, clear button
 * - Category filter pills with active neon glow (All, Songs, Albums, Artists, Playlists, Genres)
 * - Popular searches quick chips
 * - 10-Genre visual browsing grid with rich gradients and Lucide icons
 * - Desktop Right Discovery & Recent Searches Panel
 * - Dynamic results view with Top Result hero card, Songs list, Albums grid, Artists grid, Playlists
 * - Real data consumption via SearchService without modifying protected logic.
 */
export class SearchView implements IView {
  private container: HTMLElement | null = null;
  private currentQuery = '';
  private activeCategory: SearchCategory = 'all';
  private searchTimeout: number | null = null;
  private isSearching = false;
  private currentResults: SearchResults | null = null;
  private recentSearches: string[] = [];
  private topArtists: Artist[] = [];

  private readonly searchService?: ISearchService | undefined;
  private readonly libraryService?: ILibraryService | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly routerService?: RouterService | undefined;

  constructor(depsOrService?: SearchViewDependencies | ISearchService) {
    if (depsOrService && 'search' in depsOrService) {
      this.searchService = depsOrService;
    } else if (depsOrService) {
      this.searchService = depsOrService.searchService;
      this.libraryService = depsOrService.libraryService;
      this.playbackManager = depsOrService.playbackManager;
      this.artworkService = depsOrService.artworkService;
      this.routerService = depsOrService.routerService;
    }
    this.loadRecentSearches();
  }

  public mount(container: HTMLElement, params?: RouteParams): void {
    this.container = container;
    if (params?.query !== undefined) {
      this.currentQuery = params.query;
    }
    this.render();
    void this.loadTopArtists();
    if (this.currentQuery.trim()) {
      void this.executeSearch(this.currentQuery.trim());
    }
  }

  public unmount(): void {
    if (this.searchTimeout) {
      window.clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(params: RouteParams): void {
    if (params.query !== undefined && params.query !== this.currentQuery) {
      this.currentQuery = params.query;
      const input = this.container?.querySelector<HTMLInputElement>('#search-view-input');
      if (input) {
        input.value = this.currentQuery;
      }
      if (this.currentQuery.trim()) {
        void this.executeSearch(this.currentQuery.trim());
      } else {
        this.currentResults = null;
        this.render();
      }
    }
  }

  private loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem('mymusic_recent_searches');
      if (stored) {
        this.recentSearches = JSON.parse(stored);
      } else {
        this.recentSearches = [];
      }
    } catch (_e) {
      this.recentSearches = [];
    }
  }

  private saveRecentSearch(query: string): void {
    const q = query.trim();
    if (!q) return;
    this.recentSearches = [q, ...this.recentSearches.filter(s => s.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    try {
      localStorage.setItem('mymusic_recent_searches', JSON.stringify(this.recentSearches));
    } catch (_e) {
      // Ignore
    }
  }

  private clearRecentSearches(): void {
    this.recentSearches = [];
    try {
      localStorage.removeItem('mymusic_recent_searches');
    } catch (_e) {
      // Ignore
    }
    this.render();
  }

  private async loadTopArtists(): Promise<void> {
    if (!this.libraryService) return;
    try {
      const res = await this.libraryService.listArtists({ offset: 0, limit: 6 });
      this.topArtists = [...res.items];
      this.updateFeaturedArtists();
    } catch (_e) {
      // Ignore
    }
  }

  private updateFeaturedArtists(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#featured-artists-slot');
    if (!container || this.topArtists.length === 0) return;

    container.innerHTML = `
      <div style="display: flex; gap: var(--space-4); overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
        ${this.topArtists
          .map(
            artist => `
          <div
            class="search-artist-chip"
            data-artist-id="${escapeHtml(artist.id)}"
            data-artist-name="${escapeHtml(artist.name)}"
            style="
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px 16px;
              border-radius: var(--radius-full);
              background: var(--glass-bg-subtle);
              border: 1px solid var(--glass-border);
              cursor: pointer;
              transition: all var(--duration-fast) var(--ease-smooth);
              white-space: nowrap;
              flex-shrink: 0;
            "
          >
            <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--color-accent-purple), #4338ca); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #ffffff;">
              ${escapeHtml(artist.name ? artist.name.charAt(0).toUpperCase() : '♫')}
            </div>
            <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #ffffff;">
              ${escapeHtml(artist.name)}
            </span>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    container.querySelectorAll<HTMLElement>('.search-artist-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.getAttribute('data-artist-name');
        if (name) {
          this.currentQuery = name;
          const searchIn = this.container?.querySelector<HTMLInputElement>('#search-view-input');
          if (searchIn) searchIn.value = name;
          void this.executeSearch(name);
        }
      });
    });
  }

  private render(): void {
    if (!this.container) return;

    const categories: Array<{ id: SearchCategory; label: string; icon: IconName }> = [
      { id: 'all', label: 'All', icon: 'sparkles' },
      { id: 'songs', label: 'Songs', icon: 'music' },
      { id: 'albums', label: 'Albums', icon: 'disc' },
      { id: 'artists', label: 'Artists', icon: 'user' },
      { id: 'playlists', label: 'Playlists', icon: 'playlist' },
      { id: 'genres', label: 'Genres', icon: 'radio' }
    ];

    this.container.innerHTML = `
      <style>
        .search-view-container {
          padding: var(--space-6) var(--space-8);
          max-width: 1720px;
          margin: 0 auto;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          width: 100%;
          min-width: 0;
          color: var(--color-text-primary);
          font-family: var(--font-family-base);
        }

        /* 2-Column Search Grid (Template 4 Desktop) */
        .search-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: var(--space-6);
          align-items: start;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .search-main-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .search-side-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        /* Search Hero Banner */
        .search-hero-banner {
          position: relative;
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-2xl);
          padding: var(--space-6) var(--space-8);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          overflow: hidden;
          box-shadow: var(--shadow-elevation-medium), 0 0 24px rgba(124, 58, 237, 0.2);
          box-sizing: border-box;
          width: 100%;
        }

        .search-hero-glow {
          position: absolute;
          right: -30px;
          top: -40px;
          width: 260px;
          height: 260px;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }

        /* Search Input Box */
        .search-input-wrapper {
          position: relative;
          width: 100%;
          max-width: 680px;
          z-index: 1;
        }

        .search-input-field {
          width: 100%;
          padding: 14px 48px 14px 48px;
          background: rgba(10, 14, 23, 0.85);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-full);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          box-sizing: border-box;
          outline: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          transition: all var(--duration-fast) var(--ease-smooth);
        }
        .search-input-field:focus {
          border-color: var(--color-accent-purple);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.3), 0 4px 24px rgba(0, 0, 0, 0.4);
        }

        /* Category Filter Tabs */
        .search-cat-tabs {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
          z-index: 1;
          overscroll-behavior-x: contain;
        }
        .search-cat-tabs::-webkit-scrollbar {
          display: none;
        }

        .search-cat-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-height: 40px;
          box-sizing: border-box;
        }

        /* Tablet Responsive (< 1200px) */
        @media (min-width: 768px) and (max-width: 1199px) {
          .search-view-container {
            padding: var(--space-5) var(--space-6);
            gap: var(--space-4);
          }

          .search-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-5);
          }
        }

        /* Mobile Responsive (< 768px) */
        @media (max-width: 767px) {
          .search-view-container {
            padding: var(--space-4) var(--space-3) calc(var(--mini-player-height) + var(--bottom-nav-height) + var(--space-8)) var(--space-3);
            gap: var(--space-4);
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .search-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-4);
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .search-hero-banner {
            padding: var(--space-5) var(--space-4);
            border-radius: var(--radius-xl);
          }

          .search-input-wrapper {
            max-width: 100%;
          }
        }
      </style>

      <section class="search-view-container" aria-label="Search Music">
        <!-- 1. Search Hero Banner (Template 4) -->
        <header class="search-hero-banner">
          <div class="search-hero-glow"></div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; z-index: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-accent-cyan);">${getIconSvg('search', { size: 20 })}</span>
              <h1 style="font-size: clamp(24px, 4vw, 32px); font-weight: var(--font-weight-extrabold); letter-spacing: -0.02em; color: #ffffff; margin: 0;">
                Search Music
              </h1>
            </div>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0;">
              Find tracks, artists, albums, and genres across your local lossless library.
            </p>
          </div>

          <!-- Large Search Input Box -->
          <div class="search-input-wrapper">
            <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; display: flex;">
              ${getIconSvg('search', { size: 18 })}
            </span>
            <input
              id="search-view-input"
              type="search"
              placeholder="Search songs, artists, albums, or genres..."
              value="${escapeHtml(this.currentQuery)}"
              aria-label="Search music library"
              class="search-input-field"
            />
            ${
              this.currentQuery
                ? `
              <button
                id="search-clear-btn"
                aria-label="Clear search"
                title="Clear search"
                style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;"
              >
                ${getIconSvg('close', { size: 16 })}
              </button>
            `
                : ''
            }
          </div>

          <!-- Category Filter Tabs (Template 4) -->
          <nav role="tablist" aria-label="Search Filter Categories" class="search-cat-tabs">
            ${categories
              .map(
                cat => `
              <button
                role="tab"
                aria-selected="${this.activeCategory === cat.id}"
                data-category="${cat.id}"
                class="search-cat-btn"
                style="
                  background: ${this.activeCategory === cat.id ? 'linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%)' : 'var(--glass-bg-subtle)'};
                  color: ${this.activeCategory === cat.id ? '#ffffff' : 'var(--color-text-secondary)'};
                  border: 1px solid ${this.activeCategory === cat.id ? 'var(--glass-border-interactive)' : 'var(--glass-border)'};
                  box-shadow: ${this.activeCategory === cat.id ? '0 2px 14px rgba(124, 58, 237, 0.4)' : 'none'};
                "
              >
                <span>${getIconSvg(cat.icon, { size: 15, color: this.activeCategory === cat.id ? '#ffffff' : 'currentColor' })}</span>
                <span>${cat.label}</span>
              </button>
            `
              )
              .join('')}
          </nav>
        </header>

        <!-- 2. Dynamic 2-Column Search Layout -->
        <div class="search-grid-layout">
          <div class="search-main-column">
            <!-- Dynamic Content Slot: Results or Discovery View -->
            <div id="search-content-slot" style="flex: 1; display: flex; flex-direction: column; min-width: 0; width: 100%;">
              ${this.renderBodyContent()}
            </div>
          </div>

          <!-- Right Discovery & Recent Searches Column (Desktop Template 4) -->
          <aside class="search-side-column">
            <!-- 1. Recent Searches Card -->
            <div
              class="glass-panel"
              style="
                background: var(--glass-bg-subtle);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-2xl);
                padding: var(--space-5);
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                box-sizing: border-box;
              "
            >
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; text-transform: uppercase; letter-spacing: 0.08em;">
                  ${getIconSvg('clock', { size: 14, color: 'var(--color-accent-cyan)' })}
                  <span>Recent Searches</span>
                </div>
                ${this.recentSearches.length > 0 ? `
                  <button id="clear-recent-btn" style="background: transparent; border: none; font-size: 11px; font-weight: var(--font-weight-semibold); color: var(--color-accent-purple-glow); cursor: pointer; padding: 2px 6px;">
                    Clear
                  </button>
                ` : ''}
              </div>

              ${this.recentSearches.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
                  ${this.recentSearches
                    .map(
                      s => `
                    <button
                      class="recent-search-item"
                      data-query="${escapeHtml(s)}"
                      style="
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        background: rgba(255, 255, 255, 0.04);
                        border: 1px solid var(--glass-border);
                        color: var(--color-text-secondary);
                        padding: 6px 14px;
                        border-radius: var(--radius-full);
                        font-size: 12px;
                        cursor: pointer;
                        transition: all 0.15s ease;
                      "
                    >
                      <span>${getIconSvg('search', { size: 12 })}</span>
                      <span>${escapeHtml(s)}</span>
                    </button>
                  `
                    )
                    .join('')}
                </div>
              ` : `
                <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); padding: 8px 0; text-align: center;">
                  No recent searches.
                </div>
              `}
            </div>

            <!-- 2. Discover / Lossless Audio Card -->
            <div
              class="glass-panel"
              style="
                background: linear-gradient(135deg, rgba(30, 20, 70, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-2xl);
                padding: var(--space-5);
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                box-sizing: border-box;
              "
            >
              <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-accent-pink); text-transform: uppercase; letter-spacing: 0.08em;">
                ${getIconSvg('sparkles', { size: 14, color: 'var(--color-accent-pink)' })}
                <span>Audio Discovery</span>
              </div>
              <h3 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: #ffffff; margin: 0;">
                High-Resolution Purity
              </h3>
              <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0; line-height: 1.5;">
                Explore FLAC, WAV, and ALAC files stored on your local disk with bit-perfect 10-band equalization.
              </p>
              <button
                id="search-explore-lossless-btn"
                data-query="Lossless"
                style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  padding: 8px 16px;
                  border-radius: var(--radius-full);
                  background: var(--glass-bg-interactive);
                  border: 1px solid var(--glass-border-interactive);
                  color: var(--color-text-primary);
                  font-size: 12px;
                  font-weight: var(--font-weight-semibold);
                  cursor: pointer;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  margin-top: 4px;
                "
              >
                <span>Filter Lossless Music</span>
                <span>${getIconSvg('chevron-right', { size: 12 })}</span>
              </button>
            </div>
          </aside>
        </div>
      </section>
    `;

    this.bindEvents();
  }

  private renderBodyContent(): string {
    if (this.isSearching) {
      return `
        <div class="glass-panel" style="padding: var(--space-12); border-radius: var(--radius-xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border);">
          <div style="color: var(--color-accent-purple-glow); display: flex; justify-content: center; margin-bottom: 12px;">
            ${getIconSvg('sound-wave', { size: 36 })}
          </div>
          <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); color: var(--color-text-primary);">Searching your library...</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 4px;">Matching songs, albums, artists, and genres</div>
        </div>
      `;
    }

    if (this.currentQuery.trim() && this.currentResults) {
      return this.renderSearchResults(this.currentResults);
    }

    return this.renderDiscoveryView();
  }

  private renderDiscoveryView(): string {
    const genres = [
      { name: 'Pop', icon: 'mic', bg: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', border: 'rgba(236, 72, 153, 0.4)' },
      { name: 'Rock', icon: 'sound-wave', bg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', border: 'rgba(239, 68, 68, 0.4)' },
      { name: 'Hip Hop', icon: 'headphones', bg: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', border: 'rgba(168, 85, 247, 0.4)' },
      { name: 'EDM', icon: 'radio', bg: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', border: 'rgba(6, 182, 212, 0.4)' },
      { name: 'R&B', icon: 'sparkles', bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: 'rgba(139, 92, 246, 0.4)' },
      { name: 'Classical', icon: 'music', bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', border: 'rgba(99, 102, 241, 0.4)' },
      { name: 'Jazz', icon: 'radio', bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'rgba(245, 158, 11, 0.4)' },
      { name: 'Lo-Fi', icon: 'moon', bg: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', border: 'rgba(20, 184, 166, 0.4)' },
      { name: 'Ambient', icon: 'sparkles', bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', border: 'rgba(59, 130, 246, 0.4)' },
      { name: 'Indie', icon: 'music', bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', border: 'rgba(16, 185, 129, 0.4)' }
    ] as const;

    const quickPills = ['Lossless Audio', 'FLAC', 'Favorites', 'Hi-Res', 'MP3', 'Top Rated'];

    return `
      <div style="display: flex; flex-direction: column; gap: var(--space-6); width: 100%; min-width: 0; box-sizing: border-box;">
        
        <!-- Popular Searches & Quick Suggestions -->
        <section style="display: flex; flex-direction: column; gap: var(--space-3);">
          <h2 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
            Popular Searches
          </h2>
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
            ${quickPills
              .map(
                pill => `
              <button
                class="quick-search-pill"
                data-query="${escapeHtml(pill)}"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  background: var(--glass-bg-subtle);
                  border: 1px solid var(--glass-border);
                  color: var(--color-text-primary);
                  padding: 8px 18px;
                  border-radius: var(--radius-full);
                  font-size: var(--font-size-xs);
                  font-weight: var(--font-weight-semibold);
                  cursor: pointer;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  min-height: 38px;
                "
              >
                <span style="color: var(--color-accent-pink);">${getIconSvg('flame', { size: 14 })}</span>
                <span>${escapeHtml(pill)}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Featured Discovered Artists -->
        <section style="display: flex; flex-direction: column; gap: var(--space-3);">
          <h2 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
            Featured Artists
          </h2>
          <div id="featured-artists-slot">
            <div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">Loading artists...</div>
          </div>
        </section>

        <!-- Browse by Genre (10 Tiles Grid — Template 4) -->
        <section style="display: flex; flex-direction: column; gap: var(--space-3);">
          <h2 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
            Browse by Genre
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-3); width: 100%; box-sizing: border-box;">
            ${genres
              .map(
                g => `
              <div
                class="genre-search-tile glass-panel"
                data-genre="${escapeHtml(g.name)}"
                style="
                  background: ${g.bg};
                  border: 1px solid ${g.border};
                  border-radius: var(--radius-xl);
                  padding: var(--space-4);
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
                  transition: all var(--duration-fast) var(--ease-smooth);
                  min-height: 52px;
                  box-sizing: border-box;
                "
              >
                <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff;">${g.name}</span>
                <span style="color: rgba(255, 255, 255, 0.85);">${getIconSvg(g.icon as any, { size: 18 })}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

      </div>
    `;
  }

  private renderSearchResults(results: SearchResults): string {
    const totalCount =
      (results.tracks?.length || 0) +
      (results.albums?.length || 0) +
      (results.artists?.length || 0) +
      (results.playlists?.length || 0);

    if (totalCount === 0) {
      return `
        <div class="glass-panel" style="padding: var(--space-12); border-radius: var(--radius-2xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px dashed var(--glass-border);">
          <div style="color: var(--color-accent-purple-glow); display: flex; justify-content: center; margin-bottom: 12px;">
            ${getIconSvg('search', { size: 38 })}
          </div>
          <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin-bottom: 6px;">
            No results found for "${escapeHtml(this.currentQuery)}"
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); max-width: 400px; margin: 0 auto var(--space-4) auto; line-height: 1.5;">
            Please check the spelling or try searching for a different song title, artist, album, or genre.
          </div>
          <button id="search-reset-btn" style="padding: 10px 24px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; border: none; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); color: #ffffff;">
            Clear Search
          </button>
        </div>
      `;
    }

    // Top Result Hero Card (Template 4)
    let topResultHtml = '';
    const topTrack = results.tracks?.[0];

    if (topTrack) {
      topResultHtml = `
        <div class="top-result-card glass-panel" style="background: linear-gradient(135deg, rgba(30, 20, 70, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-2xl); padding: var(--space-6); display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: var(--space-4);">
            <div style="width: 72px; height: 72px; border-radius: var(--radius-xl); background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-glow-purple); border: 1px solid var(--glass-border);">
              ${getIconSvg('music', { size: 32, color: 'var(--color-accent-cyan)' })}
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 10px; font-weight: var(--font-weight-extrabold); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-accent-cyan);">
                Top Result
              </span>
              <h2 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
                ${escapeHtml(topTrack.title)}
              </h2>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                Song • ${escapeHtml(topTrack.artistName ?? 'Unknown Artist')} • ${escapeHtml(topTrack.albumTitle ?? 'Unknown Album')}
              </span>
            </div>
          </div>
          <button
            id="play-top-result-btn"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; border: none; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); color: #ffffff; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);"
          >
            ${getIconSvg('play', { size: 16, color: '#ffffff' })}
            <span>Play Now</span>
          </button>
        </div>
      `;
    }

    const showSongs = (this.activeCategory === 'all' || this.activeCategory === 'songs') && results.tracks && results.tracks.length > 0;
    const showAlbums = (this.activeCategory === 'all' || this.activeCategory === 'albums') && results.albums && results.albums.length > 0;
    const showArtists = (this.activeCategory === 'all' || this.activeCategory === 'artists') && results.artists && results.artists.length > 0;
    const showPlaylists = (this.activeCategory === 'all' || this.activeCategory === 'playlists') && results.playlists && results.playlists.length > 0;

    return `
      <div style="display: flex; flex-direction: column; gap: var(--space-6); width: 100%; min-width: 0; box-sizing: border-box;">
        ${topResultHtml}

        <!-- Songs Results -->
        ${
          showSongs
            ? `
          <section style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
                Songs (${results.tracks.length})
              </h3>
            </div>
            <div id="search-songs-list" class="glass-panel" style="background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-2xl); padding: var(--space-2); display: flex; flex-direction: column;">
            </div>
          </section>
        `
            : ''
        }

        <!-- Albums Results -->
        ${
          showAlbums
            ? `
          <section style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
                Albums (${results.albums.length})
              </h3>
            </div>
            <div id="search-albums-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-4);">
            </div>
          </section>
        `
            : ''
        }

        <!-- Artists Results -->
        ${
          showArtists
            ? `
          <section style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
                Artists (${results.artists.length})
              </h3>
            </div>
            <div id="search-artists-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3);">
            </div>
          </section>
        `
            : ''
        }

        <!-- Playlists Results -->
        ${
          showPlaylists
            ? `
          <section style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0;">
                Playlists (${results.playlists.length})
              </h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-3);">
              ${results.playlists
                .map(
                  pl => `
                <div class="glass-panel search-playlist-card" data-playlist-id="${escapeHtml(pl.id)}" role="button" tabindex="0" aria-label="Open playlist ${escapeHtml(pl.name)}" style="padding: var(--space-4); border-radius: var(--radius-xl); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); cursor: pointer; transition: all var(--duration-fast);">
                  <div style="width: 100%; aspect-ratio: 1; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; color: var(--color-accent-pink);">
                    ${getIconSvg('playlist', { size: 32 })}
                  </div>
                  <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-text-primary); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(pl.name)}
                  </span>
                  <span style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px; display: block;">
                    ${pl.trackCount ?? 0} ${pl.trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
              `
                )
                .join('')}
            </div>
          </section>
        `
            : ''
        }
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Search Input Real-Time Debounce
    const input = this.container.querySelector<HTMLInputElement>('#search-view-input');
    input?.addEventListener('input', () => {
      this.currentQuery = input.value;
      if (this.searchTimeout) {
        window.clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = window.setTimeout(() => {
        const q = this.currentQuery.trim();
        if (q) {
          void this.executeSearch(q);
        } else {
          this.currentResults = null;
          this.render();
          this.updateFeaturedArtists();
        }
      }, 250);
    });

    input?.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.currentQuery = '';
        input.value = '';
        this.currentResults = null;
        this.render();
        this.updateFeaturedArtists();
      } else if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q) {
          void this.executeSearch(q);
        }
      }
    });

    // Clear Button
    const clearBtn = this.container.querySelector<HTMLButtonElement>('#search-clear-btn');
    clearBtn?.addEventListener('click', () => {
      this.currentQuery = '';
      this.currentResults = null;
      this.render();
      this.updateFeaturedArtists();
    });

    const resetBtn = this.container.querySelector<HTMLButtonElement>('#search-reset-btn');
    resetBtn?.addEventListener('click', () => {
      this.currentQuery = '';
      this.currentResults = null;
      this.render();
      this.updateFeaturedArtists();
    });

    // Clear Recent Button
    const clearRecentBtn = this.container.querySelector<HTMLButtonElement>('#clear-recent-btn');
    clearRecentBtn?.addEventListener('click', () => {
      this.clearRecentSearches();
    });

    // Category Filter Buttons
    const catButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-category]');
    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category') as SearchCategory;
        if (cat && cat !== this.activeCategory) {
          this.activeCategory = cat;
          this.render();
          this.populateResultComponents();
        }
      });
    });

    // Quick Search & Recent Search Pills
    const queryPills = this.container.querySelectorAll<HTMLElement>('[data-query]');
    queryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const q = pill.getAttribute('data-query');
        if (q) {
          this.currentQuery = q;
          const searchIn = this.container?.querySelector<HTMLInputElement>('#search-view-input');
          if (searchIn) searchIn.value = q;
          void this.executeSearch(q);
        }
      });
    });

    // Genre Tiles
    const genreTiles = this.container.querySelectorAll<HTMLElement>('[data-genre]');
    genreTiles.forEach(tile => {
      tile.addEventListener('click', () => {
        const g = tile.getAttribute('data-genre');
        if (g) {
          this.currentQuery = g;
          const searchIn = this.container?.querySelector<HTMLInputElement>('#search-view-input');
          if (searchIn) searchIn.value = g;
          void this.executeSearch(g);
        }
      });
    });

    // Top Result Play Button
    const topPlayBtn = this.container.querySelector<HTMLButtonElement>('#play-top-result-btn');
    topPlayBtn?.addEventListener('click', () => {
      if (this.currentResults?.tracks && this.currentResults.tracks.length > 0 && this.playbackManager) {
        void this.playbackManager.playTrack(this.currentResults.tracks[0]!, this.currentResults.tracks as Track[]);
      }
    });

    // Playlist Search Cards
    const playlistCards = this.container.querySelectorAll<HTMLElement>('.search-playlist-card');
    playlistCards.forEach(card => {
      const plId = card.getAttribute('data-playlist-id');
      if (plId) {
        card.addEventListener('click', () => {
          if (this.routerService) {
            this.routerService.navigate('playlists', { id: plId });
          }
        });
        card.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (this.routerService) {
              this.routerService.navigate('playlists', { id: plId });
            }
          }
        });
      }
    });

    this.populateResultComponents();
  }

  private populateResultComponents(): void {
    if (!this.container || !this.currentResults) return;

    // Populate Songs List
    const songsSlot = this.container.querySelector<HTMLElement>('#search-songs-list');
    if (songsSlot && this.currentResults.tracks) {
      songsSlot.innerHTML = '';
      this.currentResults.tracks.forEach((track, index) => {
        const row = TrackRowComponent.create(
          track as Track,
          index,
          {
            onPlay: t => {
              if (this.playbackManager) {
                void this.playbackManager.playTrack(t, this.currentResults?.tracks as Track[]);
              }
            },
            onToggleFavorite: async t => {
              if (this.libraryService) {
                await this.libraryService.toggleFavorite(t.id);
              }
            }
          },
          this.artworkService
        );
        songsSlot.appendChild(row);
      });
    }

    // Populate Albums Grid
    const albumsSlot = this.container.querySelector<HTMLElement>('#search-albums-grid');
    if (albumsSlot && this.currentResults.albums) {
      albumsSlot.innerHTML = '';
      this.currentResults.albums.forEach(album => {
        const card = AlbumCardComponent.create(
          album as Album,
          {
            onSelect: _a => {
              if (this.routerService) {
                this.routerService.navigate('library', { tab: 'songs' });
              }
            },
            onPlay: async a => {
              if (this.playbackManager && this.libraryService) {
                const res = await this.libraryService.listTracks({ offset: 0, limit: 100 }, { albumId: a.id });
                if (res.items.length > 0) {
                  void this.playbackManager.playTrack(res.items[0]!, res.items);
                }
              }
            }
          },
          this.artworkService
        );
        albumsSlot.appendChild(card);
      });
    }

    // Populate Artists Grid
    const artistsSlot = this.container.querySelector<HTMLElement>('#search-artists-grid');
    if (artistsSlot && this.currentResults.artists) {
      artistsSlot.innerHTML = '';
      this.currentResults.artists.forEach(artist => {
        const card = ArtistCardComponent.create(artist as Artist, {
          onSelect: _a => {
            if (this.routerService) {
              this.routerService.navigate('library', { tab: 'artists' });
            }
          }
        });
        artistsSlot.appendChild(card);
      });
    }
  }

  private async executeSearch(query: string): Promise<void> {
    if (!this.searchService) return;
    this.isSearching = true;
    this.render();

    try {
      const results = await this.searchService.search(query, 12);
      this.currentResults = results;
      this.saveRecentSearch(query);
    } catch (_e) {
      this.currentResults = { tracks: [], albums: [], artists: [], playlists: [] };
    } finally {
      this.isSearching = false;
      this.render();
      this.populateResultComponents();
    }
  }
}
