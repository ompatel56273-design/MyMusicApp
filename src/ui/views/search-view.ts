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

export type SearchCategory = 'all' | 'songs' | 'albums' | 'artists' | 'playlists' | 'genres' | 'folders';

export interface SearchViewDependencies {
  searchService?: ISearchService | undefined;
  libraryService?: ILibraryService | undefined;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
  routerService?: RouterService | undefined;
}

export class SearchView implements IView {
  private container: HTMLElement | null = null;
  private currentQuery = '';
  private activeCategory: SearchCategory = 'all';
  private searchTimeout: number | null = null;
  private isSearching = false;
  private currentResults: SearchResults | null = null;
  private recentSearches: string[] = [];

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
        this.recentSearches = ['The Weeknd', 'Dua Lipa', 'Chill Mix', 'Starboy', 'Lossless'];
      }
    } catch (_e) {
      this.recentSearches = ['The Weeknd', 'Dua Lipa', 'Chill Mix', 'Starboy', 'Lossless'];
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

  private render(): void {
    if (!this.container) return;

    const categories: Array<{ id: SearchCategory; label: string; icon: string }> = [
      { id: 'all', label: 'All', icon: '✨' },
      { id: 'songs', label: 'Songs', icon: '🎵' },
      { id: 'albums', label: 'Albums', icon: '💿' },
      { id: 'artists', label: 'Artists', icon: '👤' },
      { id: 'playlists', label: 'Playlists', icon: '📑' },
      { id: 'genres', label: 'Genres', icon: '🏷️' },
      { id: 'folders', label: 'Folders', icon: '📁' }
    ];

    this.container.innerHTML = `
      <section class="search-view" style="padding: var(--space-6); max-width: 1400px; margin: 0 auto; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: var(--space-5); overflow-y: auto;">
        
        <!-- Header & Search Input Banner (Template 4) -->
        <header style="position: relative; background: linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.7) 100%); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); overflow: hidden; backdrop-filter: blur(16px);">
          <div style="position: absolute; right: -30px; top: -30px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%); pointer-events: none; border-radius: 50%;"></div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; z-index: 1;">
            <h1 style="font-size: clamp(24px, 4vw, 32px); font-weight: 800; letter-spacing: -0.02em; color: var(--color-text-primary); margin: 0;">
              Search Music
            </h1>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">
              Find your next favorite song, artist, album, and more across your local library.
            </p>
          </div>

          <!-- Search Input Box -->
          <div style="position: relative; width: 100%; max-width: 640px; z-index: 1;">
            <span style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); font-size: 16px; color: var(--color-text-muted); pointer-events: none;">🔍</span>
            <input
              id="search-view-input"
              type="search"
              placeholder="Search songs, artists, albums, or playlists..."
              value="${escapeHtml(this.currentQuery)}"
              aria-label="Search music library"
              style="
                width: 100%;
                padding: 14px 44px 14px 48px;
                background: rgba(10, 14, 23, 0.8);
                border: 1px solid var(--glass-border-highlight);
                border-radius: var(--radius-full);
                color: var(--color-text-primary);
                font-size: 14px;
                font-weight: 500;
                box-sizing: border-box;
                outline: none;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            />
            ${
              this.currentQuery
                ? `
              <button
                id="search-clear-btn"
                aria-label="Clear search"
                title="Clear search"
                style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--color-text-muted); font-size: 16px; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;"
              >
                ✕
              </button>
            `
                : ''
            }
          </div>

          <!-- Category Filter Pills (Template 4) -->
          <nav role="tablist" aria-label="Search Filter Categories" style="display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; z-index: 1;">
            ${categories
              .map(
                cat => `
              <button
                role="tab"
                aria-selected="${this.activeCategory === cat.id}"
                data-category="${cat.id}"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  background: ${this.activeCategory === cat.id ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(59, 130, 246, 0.25) 100%)' : 'rgba(255, 255, 255, 0.04)'};
                  color: ${this.activeCategory === cat.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};
                  border: 1px solid ${this.activeCategory === cat.id ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.08)'};
                  box-shadow: ${this.activeCategory === cat.id ? 'var(--shadow-glow-purple)' : 'none'};
                  padding: 8px 18px;
                  border-radius: var(--radius-full);
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  white-space: nowrap;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  min-height: 40px;
                "
              >
                <span>${cat.icon}</span>
                <span>${cat.label}</span>
              </button>
            `
              )
              .join('')}
          </nav>
        </header>

        <!-- Dynamic Content Slot: Results or Discovery View -->
        <div id="search-content-slot" style="flex: 1; display: flex; flex-direction: column;">
          ${this.renderBodyContent()}
        </div>
      </section>
    `;

    this.bindEvents();
  }

  private renderBodyContent(): string {
    if (this.isSearching) {
      return `
        <div class="glass-panel" style="padding: var(--space-12); border-radius: var(--radius-xl); text-align: center; color: var(--color-text-muted);">
          <div style="font-size: 36px; margin-bottom: 12px; animation: pulse 1.5s infinite;">🔍</div>
          <div style="font-size: 16px; font-weight: 600; color: var(--color-text-primary);">Searching your library...</div>
          <div style="font-size: 13px; margin-top: 4px;">Matching songs, albums, and artists</div>
        </div>
      `;
    }

    if (this.currentQuery.trim() && this.currentResults) {
      return this.renderSearchResults(this.currentResults);
    }

    // Default Discovery View (Template 4)
    return this.renderDiscoveryView();
  }

  private renderDiscoveryView(): string {
    const genres = [
      { name: 'Pop', icon: '🎤', color: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(219, 39, 119, 0.15) 100%)', border: 'rgba(236, 72, 153, 0.35)' },
      { name: 'Rock', icon: '🎸', color: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.15) 100%)', border: 'rgba(239, 68, 68, 0.35)' },
      { name: 'Hip Hop', icon: '🎧', color: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)', border: 'rgba(245, 158, 11, 0.35)' },
      { name: 'EDM', icon: '⚡', color: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)', border: 'rgba(6, 182, 212, 0.35)' },
      { name: 'R&B', icon: '🎷', color: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)', border: 'rgba(168, 85, 247, 0.35)' },
      { name: 'Classical', icon: '🎻', color: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(109, 40, 217, 0.15) 100%)', border: 'rgba(139, 92, 246, 0.35)' },
      { name: 'Jazz', icon: '🎺', color: 'linear-gradient(135deg, rgba(251, 146, 60, 0.25) 0%, rgba(234, 88, 12, 0.15) 100%)', border: 'rgba(251, 146, 60, 0.35)' },
      { name: 'Lo-Fi', icon: '☕', color: 'linear-gradient(135deg, rgba(20, 184, 166, 0.25) 0%, rgba(13, 148, 136, 0.15) 100%)', border: 'rgba(20, 184, 166, 0.35)' }
    ];

    const quickPills = ['The Weeknd', 'Lossless Audio', 'Starboy', 'Chill Vibes', 'Taylor Swift', 'Dua Lipa'];

    return `
      <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-6);">
        
        <!-- Popular Searches & Quick Suggestions -->
        <section>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
            <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
              Popular Searches
            </h2>
          </div>
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
                  background: rgba(255, 255, 255, 0.04);
                  border: 1px solid var(--glass-border);
                  color: var(--color-text-primary);
                  padding: 8px 16px;
                  border-radius: var(--radius-full);
                  font-size: 13px;
                  font-weight: 500;
                  cursor: pointer;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  min-height: 38px;
                "
              >
                <span>🔥</span>
                <span>${escapeHtml(pill)}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Browse by Genre (Template 4) -->
        <section>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
            <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
              Browse by Genre
            </h2>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3);">
            ${genres
              .map(
                g => `
              <div
                class="genre-search-tile glass-panel"
                data-genre="${escapeHtml(g.name)}"
                style="
                  background: ${g.color};
                  border: 1px solid ${g.border};
                  border-radius: var(--radius-lg);
                  padding: 18px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  transition: all var(--duration-fast) var(--ease-smooth);
                "
              >
                <span style="font-size: 14px; font-weight: 700; color: var(--color-text-primary);">${g.name}</span>
                <span style="font-size: 22px;">${g.icon}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- Recent Searches (Template 4 Sidebar / Section) -->
        ${
          this.recentSearches.length > 0
            ? `
          <section class="glass-panel" style="background: rgba(18, 24, 38, 0.4); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-5);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">⏱️</span>
                <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Recent Searches</h3>
              </div>
              <button id="clear-recent-btn" style="background: transparent; border: none; font-size: 12px; font-weight: 600; color: var(--color-purple-neon); cursor: pointer; padding: 4px 8px;">
                Clear All
              </button>
            </div>
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
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--glass-border);
                    color: var(--color-text-secondary);
                    padding: 8px 14px;
                    border-radius: var(--radius-full);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                  "
                >
                  <span>🔍</span>
                  <span>${escapeHtml(s)}</span>
                </button>
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

  private renderSearchResults(results: SearchResults): string {
    const totalCount =
      (results.tracks?.length || 0) +
      (results.albums?.length || 0) +
      (results.artists?.length || 0) +
      (results.playlists?.length || 0);

    if (totalCount === 0) {
      return `
        <div class="glass-panel" style="padding: var(--space-12); border-radius: var(--radius-xl); text-align: center; color: var(--color-text-muted); background: rgba(18, 24, 38, 0.4); border: 1px solid var(--glass-border);">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <div style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin-bottom: 6px;">
            No results found for "${escapeHtml(this.currentQuery)}"
          </div>
          <div style="font-size: 13px; color: var(--color-text-secondary); max-width: 400px; margin: 0 auto 16px auto;">
            Please check the spelling or try searching for a different song title, artist, or album.
          </div>
          <button id="search-reset-btn" class="btn-primary" style="padding: 8px 20px; border-radius: var(--radius-full); font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); color: #fff;">
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
        <div class="top-result-card glass-panel" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: var(--radius-xl); padding: var(--space-6); display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: var(--space-5);">
            <div style="width: 72px; height: 72px; border-radius: var(--radius-lg); background: linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(59, 130, 246, 0.4) 100%); display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; box-shadow: var(--shadow-glow-purple);">
              🎵
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-purple-neon);">
                Top Result
              </span>
              <h2 style="font-size: 20px; font-weight: 800; color: var(--color-text-primary); margin: 0;">
                ${escapeHtml(topTrack.title)}
              </h2>
              <span style="font-size: 13px; color: var(--color-text-secondary);">
                Song • ${escapeHtml(topTrack.artistName ?? 'Unknown Artist')} • ${escapeHtml(topTrack.albumTitle ?? 'Unknown Album')}
              </span>
            </div>
          </div>
          <button
            id="play-top-result-btn"
            class="btn-primary"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: var(--radius-full); font-size: 14px; font-weight: 700; cursor: pointer; border: none; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); color: #ffffff; box-shadow: var(--shadow-glow-purple);"
          >
            <span>▶</span> Play Now
          </button>
        </div>
      `;
    }

    const showSongs = (this.activeCategory === 'all' || this.activeCategory === 'songs') && results.tracks && results.tracks.length > 0;
    const showAlbums = (this.activeCategory === 'all' || this.activeCategory === 'albums') && results.albums && results.albums.length > 0;
    const showArtists = (this.activeCategory === 'all' || this.activeCategory === 'artists') && results.artists && results.artists.length > 0;
    const showPlaylists = (this.activeCategory === 'all' || this.activeCategory === 'playlists') && results.playlists && results.playlists.length > 0;

    return `
      <div style="display: flex; flex-direction: column; gap: var(--space-6);">
        ${topResultHtml}

        <!-- Songs Results -->
        ${
          showSongs
            ? `
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
              <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
                Songs (${results.tracks.length})
              </h3>
            </div>
            <div id="search-songs-list" class="glass-panel" style="background: rgba(18, 24, 38, 0.4); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-2); display: flex; flex-direction: column;">
            </div>
          </section>
        `
            : ''
        }

        <!-- Albums Results -->
        ${
          showAlbums
            ? `
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
              <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
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
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
              <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
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
          <section>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3);">
              <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
                Playlists (${results.playlists.length})
              </h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-3);">
              ${results.playlists
                .map(
                  pl => `
                <div class="glass-panel" style="padding: 16px; border-radius: var(--radius-lg); background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); cursor: pointer;">
                  <div style="width: 100%; aspect-ratio: 1; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%); display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 10px;">
                    📑
                  </div>
                  <span style="font-size: 13px; font-weight: 700; color: var(--color-text-primary); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(pl.name)}
                  </span>
                  <span style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px; display: block;">
                    ${pl.trackCount ?? 0} tracks
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
        }
      }, 250);
    });

    input?.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.currentQuery = '';
        input.value = '';
        this.currentResults = null;
        this.render();
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
    });

    const resetBtn = this.container.querySelector<HTMLButtonElement>('#search-reset-btn');
    resetBtn?.addEventListener('click', () => {
      this.currentQuery = '';
      this.currentResults = null;
      this.render();
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
