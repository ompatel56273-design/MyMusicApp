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

    const tabs: Array<{ id: LibraryTab; label: string }> = [
      { id: 'songs', label: 'Songs' },
      { id: 'albums', label: 'Albums' },
      { id: 'artists', label: 'Artists' },
      { id: 'genres', label: 'Genres' },
      { id: 'folders', label: 'Folders' },
      { id: 'favorites', label: 'Favorites' }
    ];

    this.container.innerHTML = `
      <section class="library-view" style="padding: var(--space-6); max-width: 1300px; margin: 0 auto; height: 100%; box-sizing: border-box; display: flex; flex-direction: column;">
        <header style="margin-bottom: var(--space-4);">
          <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-4);">
            <h2 style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text-primary);">
              Music Library
            </h2>
            <span id="library-stats-label" style="font-size: 13px; color: var(--color-text-muted);"></span>
          </div>

          <nav role="tablist" style="display: flex; gap: var(--space-2); border-bottom: 1px solid var(--glass-border); padding-bottom: var(--space-3);">
            ${tabs
              .map(
                tab => `
              <button
                role="tab"
                aria-selected="${this.currentTab === tab.id}"
                data-tab="${tab.id}"
                style="
                  background: ${this.currentTab === tab.id ? 'var(--color-bg-surface-elevated)' : 'transparent'};
                  color: ${this.currentTab === tab.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
                  border: 1px solid ${this.currentTab === tab.id ? 'var(--glass-border-highlight)' : 'transparent'};
                  padding: var(--space-2) var(--space-4);
                  border-radius: var(--radius-full);
                  font-size: 13px;
                  font-weight: 500;
                  cursor: pointer;
                  transition: all var(--duration-fast) var(--ease-smooth);
                "
              >
                ${tab.label}
              </button>
            `
              )
              .join('')}
          </nav>
        </header>

        <!-- Sub-view Toolbar (for Songs / Filterable tabs) -->
        <div id="library-toolbar-slot"></div>

        <!-- Sub-view Viewport -->
        <div id="library-content-slot" style="flex: 1; min-height: 0;"></div>
      </section>
    `;

    this.bindTabEvents();
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

  private async updateStats(): Promise<void> {
    if (!this.container || !this.libraryService) return;
    try {
      const stats = await this.libraryService.getLibraryStats();
      const label = this.container.querySelector('#library-stats-label');
      if (label) {
        label.textContent = `${stats.trackCount} tracks • ${stats.albumCount} albums • ${stats.artistCount} artists`;
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

    // Show toolbar only on Songs and Favorites
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
