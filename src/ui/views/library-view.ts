import type { IView } from './view-interface';
import type { RouteParams, LibraryTab } from '../navigation/route-types';
import type { ILibraryService, IPlaybackManager, IArtworkService } from '../../services/contracts/service-contracts';
import { LibraryToolbar, type LibraryToolbarState } from '../components/library/library-toolbar';
import { SongsTabView } from './library/songs-tab-view';
import { AlbumsTabView } from './library/albums-tab-view';
import { ArtistsTabView } from './library/artists-tab-view';
import { GenresTabView } from './library/genres-tab-view';
import { FoldersTabView } from './library/folders-tab-view';
import { FavoritesTabView } from './library/favorites-tab-view';

export interface LibraryViewDependencies {
  libraryService: ILibraryService;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
}

export class LibraryView implements IView {
  private container: HTMLElement | null = null;
  private currentTab: LibraryTab = 'songs';
  private readonly libraryService: ILibraryService;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;

  private toolbar: LibraryToolbar | null = null;
  private activeSubView:
    | SongsTabView
    | AlbumsTabView
    | ArtistsTabView
    | GenresTabView
    | FoldersTabView
    | FavoritesTabView
    | null = null;

  constructor(depsOrService?: LibraryViewDependencies | ILibraryService) {
    if (depsOrService && 'libraryService' in depsOrService) {
      this.libraryService = depsOrService.libraryService;
      this.playbackManager = depsOrService.playbackManager;
      this.artworkService = depsOrService.artworkService;
    } else {
      this.libraryService = depsOrService as ILibraryService;
    }
  }

  public mount(container: HTMLElement, params?: RouteParams): void {
    this.container = container;
    if (params?.tab) {
      this.currentTab = params.tab;
    }
    this.render();
  }

  public unmount(): void {
    if (this.toolbar) {
      this.toolbar.unmount();
      this.toolbar = null;
    }
    if (this.activeSubView) {
      this.activeSubView.unmount();
      this.activeSubView = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(params: RouteParams): void {
    if (params.tab && params.tab !== this.currentTab) {
      this.currentTab = params.tab;
      this.render();
    }
  }

  public getActiveSubView(): unknown {
    return this.activeSubView;
  }

  private render(): void {
    if (!this.container) return;

    // Clean up previous sub-view & toolbar
    if (this.toolbar) {
      this.toolbar.unmount();
      this.toolbar = null;
    }
    if (this.activeSubView) {
      this.activeSubView.unmount();
      this.activeSubView = null;
    }

    const tabs: Array<{ id: LibraryTab; label: string; icon: string }> = [
      { id: 'songs', label: 'Songs', icon: '🎵' },
      { id: 'albums', label: 'Albums', icon: '💿' },
      { id: 'artists', label: 'Artists', icon: '👤' },
      { id: 'genres', label: 'Genres', icon: '🏷️' },
      { id: 'folders', label: 'Folders', icon: '📁' },
      { id: 'favorites', label: 'Favorites', icon: '❤️' }
    ];

    this.container.innerHTML = `
      <section class="library-view" style="padding: var(--space-6); max-width: 1400px; margin: 0 auto; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto;">
        
        <!-- Header Banner (Template 3) -->
        <header style="position: relative; background: linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-6); display: flex; align-items: center; justify-content: space-between; overflow: hidden; backdrop-filter: blur(16px);">
          <div style="position: absolute; right: -20px; top: -20px; width: 180px; height: 180px; background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%); pointer-events: none; border-radius: 50%;"></div>
          
          <div style="display: flex; flex-direction: column; gap: 6px; z-index: 1;">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <h1 style="font-size: clamp(24px, 4vw, 32px); font-weight: 800; letter-spacing: -0.02em; color: var(--color-text-primary); margin: 0;">
                Library
              </h1>
              <span id="library-badge" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(168, 85, 247, 0.15); color: var(--color-purple-neon); border: 1px solid rgba(168, 85, 247, 0.3); padding: 3px 8px; border-radius: var(--radius-full);">
                Local Storage
              </span>
            </div>
            <p id="library-stats-label" style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">
              Your complete music collection. Loading stats...
            </p>
          </div>

          <!-- Quick Stats Pills (Tablet & Desktop) -->
          <div class="library-header-metrics" style="display: flex; align-items: center; gap: var(--space-3); z-index: 1;">
            <button id="library-scan-quick-btn" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: var(--radius-full); font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); color: #ffffff; box-shadow: var(--shadow-glow-purple); transition: all var(--duration-fast) var(--ease-smooth);">
              <span>+</span> Add Music / Scan
            </button>
          </div>
        </header>

        <!-- Category Navigation Tabs (Template 3) -->
        <nav role="tablist" aria-label="Library Navigation" style="display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-1); scrollbar-width: none;">
          ${tabs
            .map(
              tab => `
            <button
              role="tab"
              aria-selected="${this.currentTab === tab.id}"
              data-tab="${tab.id}"
              style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: ${this.currentTab === tab.id ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(59, 130, 246, 0.2) 100%)' : 'rgba(255, 255, 255, 0.03)'};
                color: ${this.currentTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};
                border: 1px solid ${this.currentTab === tab.id ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.08)'};
                box-shadow: ${this.currentTab === tab.id ? 'var(--shadow-glow-purple)' : 'none'};
                padding: 10px 20px;
                border-radius: var(--radius-full);
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: all var(--duration-fast) var(--ease-smooth);
                min-height: 44px;
              "
            >
              <span>${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `
            )
            .join('')}
        </nav>

        <!-- Sub-view Toolbar (for Songs / Filterable tabs) -->
        <div id="library-toolbar-slot"></div>

        <!-- Sub-view Viewport -->
        <div id="library-content-slot" style="flex: 1; min-height: 350px; display: flex; flex-direction: column;"></div>
      </section>
    `;

    this.bindTabEvents();
    this.bindHeaderEvents();
    this.updateStats();
    this.mountActiveTab();
  }

  private bindTabEvents(): void {
    if (!this.container) return;
    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as LibraryTab;
        if (tab && tab !== this.currentTab) {
          this.currentTab = tab;
          this.render();
        }
      });
    });
  }

  private bindHeaderEvents(): void {
    if (!this.container) return;
    const scanBtn = this.container.querySelector<HTMLButtonElement>('#library-scan-quick-btn');
    scanBtn?.addEventListener('click', () => {
      // Trigger folder rescan or quick file input where supported
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      (fileInput as any).webkitdirectory = true;
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', () => {
        document.body.removeChild(fileInput);
        this.render();
      });
      fileInput.click();
    });
  }

  private async updateStats(): Promise<void> {
    if (!this.container || !this.libraryService) return;
    try {
      const stats = await this.libraryService.getLibraryStats();
      const label = this.container.querySelector('#library-stats-label');
      if (label) {
        label.textContent = `Your complete music collection. ${stats.trackCount} songs • ${stats.albumCount} albums • ${stats.artistCount} artists`;
      }
    } catch (_e) {
      // Ignore
    }
  }

  private mountActiveTab(): void {
    if (!this.container) return;

    const toolbarSlot = this.container.querySelector<HTMLElement>('#library-toolbar-slot');
    const contentSlot = this.container.querySelector<HTMLElement>('#library-content-slot');
    if (!contentSlot) return;

    // Show toolbar on Songs and Favorites tabs
    if (this.currentTab === 'songs' && toolbarSlot) {
      this.toolbar = new LibraryToolbar({
        onChange: state => this.handleToolbarChange(state)
      });
      this.toolbar.mount(toolbarSlot);
    }

    switch (this.currentTab) {
      case 'songs': {
        const songsView = new SongsTabView({
          libraryService: this.libraryService,
          playbackManager: this.playbackManager,
          artworkService: this.artworkService
        });
        this.activeSubView = songsView;
        void songsView.mount(contentSlot, this.toolbar ? this.toolbar.getState() : undefined);
        break;
      }

      case 'albums': {
        const albumsView = new AlbumsTabView({
          libraryService: this.libraryService,
          playbackManager: this.playbackManager,
          artworkService: this.artworkService,
          onSelectAlbum: _album => {
            this.currentTab = 'songs';
            this.render();
          }
        });
        this.activeSubView = albumsView;
        void albumsView.mount(contentSlot);
        break;
      }

      case 'artists': {
        const artistsView = new ArtistsTabView({
          libraryService: this.libraryService,
          onSelectArtist: _artist => {
            this.currentTab = 'songs';
            this.render();
          }
        });
        this.activeSubView = artistsView;
        void artistsView.mount(contentSlot);
        break;
      }

      case 'genres': {
        const genresView = new GenresTabView({
          libraryService: this.libraryService,
          onSelectGenre: _genre => {
            this.currentTab = 'songs';
            this.render();
          }
        });
        this.activeSubView = genresView;
        void genresView.mount(contentSlot);
        break;
      }

      case 'folders': {
        const foldersView = new FoldersTabView({
          libraryService: this.libraryService,
          onSelectFolder: _folder => {
            this.currentTab = 'songs';
            this.render();
          }
        });
        this.activeSubView = foldersView;
        void foldersView.mount(contentSlot);
        break;
      }

      case 'favorites': {
        const favoritesView = new FavoritesTabView({
          libraryService: this.libraryService,
          playbackManager: this.playbackManager,
          artworkService: this.artworkService
        });
        this.activeSubView = favoritesView;
        void favoritesView.mount(contentSlot);
        break;
      }
    }
  }

  private handleToolbarChange(state: LibraryToolbarState): void {
    if (this.activeSubView instanceof SongsTabView) {
      this.activeSubView.applyFilter(state);
    }
  }
}

