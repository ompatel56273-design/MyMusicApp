import type { IView } from './view-interface';
import type { RouteParams, LibraryTab } from '../navigation/route-types';
import type { ILibraryService, IPlaybackManager, IArtworkService, IScannerService } from '../../services/contracts/service-contracts';
import type { BrowserFilesystemAdapter } from '../../services/scanner/browser-filesystem-adapter';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { Disposable } from '../../core/types/common';
import { LibraryToolbar, type LibraryToolbarState } from '../components/library/library-toolbar';
import { TrackInspectorComponent } from '../components/library/track-inspector-component';
import { SongsTabView } from './library/songs-tab-view';
import { AlbumsTabView } from './library/albums-tab-view';
import { ArtistsTabView } from './library/artists-tab-view';
import { GenresTabView } from './library/genres-tab-view';
import { FoldersTabView } from './library/folders-tab-view';
import { FavoritesTabView } from './library/favorites-tab-view';
import { getIconSvg, type IconName } from '../icons/icon-registry';

import type { DuplicateDetectorService } from '../../services/duplicate/duplicate-detector-service';
import { DuplicateDetectionModal } from '../components/library/duplicate-detection-modal';

export interface LibraryViewDependencies {
  libraryService: ILibraryService;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
  scannerService?: IScannerService | undefined;
  fsAdapter?: BrowserFilesystemAdapter | undefined;
  eventBus?: EventBus | undefined;
  duplicateDetectorService?: DuplicateDetectorService | undefined;
}

/**
 * Phase 5 Complete Visual Rebuild of Library View (Template 3).
 * Features:
 * - Authoritative Template 3 composition for Desktop, Tablet, and Mobile
 * - Neon/Glass Library Header Banner with Local Storage badge and Live Stats counters
 * - Tab navigation with Phase 2 tokens and Lucide SVGs (Songs, Albums, Artists, Genres, Folders, Favorites)
 * - Interactive Filter Toolbar (Search input, Format filter, Sort selector, Sort direction toggle)
 * - High-Density Songs Table with active playing row visualizer and favorite toggles
 * - Desktop Template 3 Right Inspector & Up Next Queue Panel
 * - Responsive 2-column Desktop layout, fluid Tablet layout, and dedicated Mobile view.
 */
export class LibraryView implements IView {
  private container: HTMLElement | null = null;
  private currentTab: LibraryTab = 'songs';
  private readonly libraryService: ILibraryService;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly scannerService?: IScannerService | undefined;
  private readonly fsAdapter?: BrowserFilesystemAdapter | undefined;
  private readonly eventBus?: EventBus | undefined;
  private readonly duplicateDetectorService?: DuplicateDetectorService | undefined;
  private libraryUpdateSub: Disposable | null = null;

  private toolbar: LibraryToolbar | null = null;
  private inspector: TrackInspectorComponent | null = null;
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
      this.scannerService = depsOrService.scannerService;
      this.fsAdapter = depsOrService.fsAdapter;
      this.eventBus = depsOrService.eventBus;
      this.duplicateDetectorService = depsOrService.duplicateDetectorService;
    } else {
      this.libraryService = depsOrService as ILibraryService;
    }
  }

  public mount(container: HTMLElement, params?: RouteParams): void {
    this.container = container;
    if (params?.tab) {
      this.currentTab = params.tab;
    }

    if (this.eventBus) {
      this.libraryUpdateSub = this.eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, async () => {
        await this.updateStats();
        this.mountActiveTab();
      });
    }

    this.render();
  }

  public unmount(): void {
    if (this.libraryUpdateSub) {
      this.libraryUpdateSub.dispose();
      this.libraryUpdateSub = null;
    }
    if (this.toolbar) {
      this.toolbar.unmount();
      this.toolbar = null;
    }
    if (this.inspector) {
      this.inspector.unmount();
      this.inspector = null;
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

    // Clean up previous sub-view, toolbar, & inspector
    if (this.toolbar) {
      this.toolbar.unmount();
      this.toolbar = null;
    }
    if (this.inspector) {
      this.inspector.unmount();
      this.inspector = null;
    }
    if (this.activeSubView) {
      this.activeSubView.unmount();
      this.activeSubView = null;
    }

    const tabs: Array<{ id: LibraryTab; label: string; icon: IconName }> = [
      { id: 'songs', label: 'Songs', icon: 'music' },
      { id: 'albums', label: 'Albums', icon: 'disc' },
      { id: 'artists', label: 'Artists', icon: 'user' },
      { id: 'genres', label: 'Genres', icon: 'sparkles' },
      { id: 'folders', label: 'Folders', icon: 'folder' },
      { id: 'favorites', label: 'Favorites', icon: 'heart' }
    ];

    this.container.innerHTML = `
      <style>
        .library-view-container {
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

        /* 2-Column Desktop Grid for Library (Template 3) */
        .library-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: var(--space-6);
          align-items: start;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .library-main-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .library-inspector-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        /* Library Header Banner (Template 3) */
        .library-hero-banner {
          position: relative;
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-2xl);
          padding: var(--space-6) var(--space-8);
          display: flex;
          align-items: center;
          justify-content: space-between;
          overflow: hidden;
          box-shadow: var(--shadow-elevation-medium), 0 0 24px rgba(124, 58, 237, 0.15);
          box-sizing: border-box;
          width: 100%;
        }

        .library-banner-glow {
          position: absolute;
          right: -30px;
          top: -40px;
          width: 240px;
          height: 240px;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, rgba(6, 182, 212, 0.1) 50%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }

        /* Category Tabs Bar */
        .library-nav-tabs {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overscroll-behavior-x: contain;
        }
        .library-nav-tabs::-webkit-scrollbar {
          display: none;
        }

        .library-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 10px 22px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-height: 44px;
          box-sizing: border-box;
        }

        /* Mobile Shortcut Grid */
        .library-mobile-shortcuts {
          display: none;
        }

        /* Tablet Responsive (< 1200px) */
        @media (min-width: 768px) and (max-width: 1199px) {
          .library-view-container {
            padding: var(--space-5) var(--space-6);
            gap: var(--space-4);
          }

          .library-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-5);
          }

          .library-inspector-column {
            display: none; /* Tablet priority on wide library content */
          }
        }

        /* Mobile Responsive (< 768px) */
        @media (max-width: 767px) {
          .library-view-container {
            padding: var(--space-4) var(--space-3) calc(var(--mini-player-height) + var(--bottom-nav-height) + var(--space-8)) var(--space-3);
            gap: var(--space-4);
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .library-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-4);
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .library-inspector-column {
            display: none;
          }

          .library-hero-banner {
            padding: var(--space-4);
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-3);
            border-radius: var(--radius-xl);
          }

          .library-header-metrics {
            width: 100%;
          }

          #library-scan-quick-btn {
            width: 100%;
            justify-content: center;
          }

          /* 2-Column Mobile Shortcuts */
          .library-mobile-shortcuts {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            width: 100%;
            box-sizing: border-box;
          }

          .library-mobile-shortcut-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-radius: var(--radius-xl);
            background: var(--glass-bg-subtle);
            border: 1px solid var(--glass-border);
            cursor: pointer;
            transition: all var(--duration-fast) var(--ease-smooth);
            min-height: 48px;
            box-sizing: border-box;
          }
          .library-mobile-shortcut-card:active {
            transform: scale(0.97);
            background: var(--glass-bg-interactive);
          }
        }
      </style>

      <section class="library-view-container" aria-label="Music Library">
        <!-- 1. Library Header Banner (Template 3) -->
        <header class="library-hero-banner">
          <div class="library-banner-glow"></div>
          
          <div style="display: flex; flex-direction: column; gap: 6px; z-index: 1;">
            <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
              <h1 style="font-size: clamp(24px, 4vw, 32px); font-weight: var(--font-weight-extrabold); letter-spacing: -0.02em; color: #ffffff; margin: 0;">
                Library
              </h1>
              <span id="library-badge" style="font-size: 11px; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.05em; background: rgba(124, 58, 237, 0.2); color: var(--color-accent-cyan); border: 1px solid var(--glass-border-interactive); padding: 3px 10px; border-radius: var(--radius-full);">
                Local Audio Purity
              </span>
            </div>
            <p id="library-stats-label" style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0;">
              Your complete audio collection. Loading stats...
            </p>
          </div>

          <!-- Quick Actions Button (Add Music / Scan + Find Duplicates) -->
          <div class="library-header-metrics" style="display: flex; align-items: center; gap: var(--space-3); z-index: 1;">
            <button id="library-scan-quick-btn" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; border: none; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); color: #ffffff; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5); transition: all var(--duration-fast) var(--ease-smooth);">
              <span>${getIconSvg('plus', { size: 16, color: '#ffffff' })}</span>
              <span>Add Music / Scan</span>
            </button>
            ${this.duplicateDetectorService ? `
              <button id="library-duplicates-btn" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; border: 1px solid var(--glass-border-interactive); background: rgba(168, 85, 247, 0.12); color: var(--color-text-primary); transition: all var(--duration-fast) var(--ease-smooth);">
                <span>${getIconSvg('sparkles', { size: 16, color: 'var(--color-accent-purple-glow)' })}</span>
                <span>Find Duplicates</span>
              </button>
            ` : ''}
          </div>
        </header>

        <!-- 2. Mobile 2-Column Shortcut Navigation Grid (Mobile View) -->
        <div class="library-mobile-shortcuts">
          <div class="library-mobile-shortcut-card" data-shortcut-tab="songs">
            <span style="color: var(--color-accent-cyan);">${getIconSvg('music', { size: 20 })}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff;">Songs</span>
              <span style="font-size: 10px; color: var(--color-text-muted);" id="mob-songs-count">Tracks</span>
            </div>
          </div>
          <div class="library-mobile-shortcut-card" data-shortcut-tab="albums">
            <span style="color: var(--color-accent-purple-glow);">${getIconSvg('disc', { size: 20 })}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff;">Albums</span>
              <span style="font-size: 10px; color: var(--color-text-muted);" id="mob-albums-count">Albums</span>
            </div>
          </div>
          <div class="library-mobile-shortcut-card" data-shortcut-tab="artists">
            <span style="color: var(--color-accent-pink);">${getIconSvg('user', { size: 20 })}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff;">Artists</span>
              <span style="font-size: 10px; color: var(--color-text-muted);" id="mob-artists-count">Artists</span>
            </div>
          </div>
          <div class="library-mobile-shortcut-card" data-shortcut-tab="favorites">
            <span style="color: #f43f5e;">${getIconSvg('heart', { size: 20 })}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff;">Favorites</span>
              <span style="font-size: 10px; color: var(--color-text-muted);">Liked</span>
            </div>
          </div>
        </div>

        <!-- 3. Category Navigation Tabs (Template 3) -->
        <nav role="tablist" aria-label="Library Navigation" class="library-nav-tabs">
          ${tabs
            .map(
              tab => `
            <button
              role="tab"
              aria-selected="${this.currentTab === tab.id}"
              data-tab="${tab.id}"
              class="library-tab-btn"
              style="
                background: ${this.currentTab === tab.id ? 'linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%)' : 'var(--glass-bg-subtle)'};
                color: ${this.currentTab === tab.id ? '#ffffff' : 'var(--color-text-secondary)'};
                border: 1px solid ${this.currentTab === tab.id ? 'var(--glass-border-interactive)' : 'var(--glass-border)'};
                box-shadow: ${this.currentTab === tab.id ? '0 2px 14px rgba(124, 58, 237, 0.4)' : 'none'};
              "
            >
              <span>${getIconSvg(tab.icon, { size: 16, color: this.currentTab === tab.id ? '#ffffff' : 'currentColor' })}</span>
              <span>${tab.label}</span>
            </button>
          `
            )
            .join('')}
        </nav>

        <!-- 4. Sub-view 2-Column Grid Layout (Desktop) -->
        <div class="library-grid-layout">
          <div class="library-main-column">
            <!-- Filter Toolbar Slot -->
            <div id="library-toolbar-slot"></div>

            <!-- Sub-view Viewport -->
            <div id="library-content-slot" style="flex: 1; min-height: 400px; display: flex; flex-direction: column; min-width: 0; width: 100%;"></div>
          </div>

          <!-- Right Track Inspector Column (Desktop Template 3) -->
          <div class="library-inspector-column" id="library-inspector-slot"></div>
        </div>
      </section>
    `;

    this.bindTabEvents();
    this.bindHeaderEvents();
    this.bindMobileShortcutEvents();
    void this.updateStats();
    this.mountInspector();
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

  private bindMobileShortcutEvents(): void {
    if (!this.container) return;
    const shortcutCards = this.container.querySelectorAll<HTMLElement>('.library-mobile-shortcut-card');
    shortcutCards.forEach(card => {
      card.addEventListener('click', () => {
        const tab = card.getAttribute('data-shortcut-tab') as LibraryTab;
        if (tab && tab !== this.currentTab) {
          this.currentTab = tab;
          this.render();
        }
      });
    });
  }

  private bindHeaderEvents(): void {
    if (!this.container) return;
    const dupBtn = this.container.querySelector<HTMLButtonElement>('#library-duplicates-btn');
    dupBtn?.addEventListener('click', () => {
      if (this.duplicateDetectorService) {
        const modal = new DuplicateDetectionModal({
          duplicateDetectorService: this.duplicateDetectorService,
          onResolved: async () => {
            await this.updateStats();
            this.mountActiveTab();
          }
        });
        modal.mount();
      }
    });

    const scanBtn = this.container.querySelector<HTMLButtonElement>('#library-scan-quick-btn');
    scanBtn?.addEventListener('click', async () => {
      console.log('[FolderPicker] selection started');

      // 1. If showDirectoryPicker is supported in the browser environment, try it first
      if (typeof (window as any).showDirectoryPicker === 'function') {
        try {
          const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
            mode: 'read'
          });

          if (handle) {
            console.log(`[FolderPicker] selected directory: ${handle.name}`);
            const rootPath = `folder://${handle.name}`;

            if (this.fsAdapter) {
              this.fsAdapter.registerDirectoryHandle(rootPath, handle);
            }

            if (this.scannerService) {
              await this.scannerService.scanDirectory(rootPath);
            }

            await this.updateStats();
            this.mountActiveTab();
            return;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            console.log('[FolderPicker] user cancelled directory selection');
            return;
          }
          console.warn('[FolderPicker] showDirectoryPicker fallback to webkitdirectory:', err);
        }
      }

      // 2. Browser folder upload fallback (<input type="file" webkitdirectory multiple>)
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      (fileInput as any).webkitdirectory = true;
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', async () => {
        try {
          const files = fileInput.files;
          const rawCount = files ? files.length : 0;
          console.log(`[FolderPicker] raw files received: ${rawCount}`);

          if (files && rawCount > 0) {
            const firstFile = files[0];
            const dirName = (firstFile as any)?.webkitRelativePath
              ? (firstFile as any).webkitRelativePath.split('/')[0]
              : 'Selected Folder';
            console.log(`[FolderPicker] selected directory: ${dirName}`);

            if (this.scannerService?.importFiles) {
              const res = await this.scannerService.importFiles(files);
              console.log('[FolderPicker] import result:', res);
            }
          }
        } catch (importErr) {
          console.error('[FolderPicker] import failed:', importErr);
        } finally {
          if (fileInput.parentElement) {
            fileInput.parentElement.removeChild(fileInput);
          }
          await this.updateStats();
          this.mountActiveTab();
        }
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
        label.textContent = `Your complete audio collection. ${stats.trackCount.toLocaleString()} songs • ${stats.albumCount.toLocaleString()} albums • ${stats.artistCount.toLocaleString()} artists`;
      }

      // Update mobile shortcuts count
      const mobSongs = this.container.querySelector('#mob-songs-count');
      const mobAlbums = this.container.querySelector('#mob-albums-count');
      const mobArtists = this.container.querySelector('#mob-artists-count');
      if (mobSongs) mobSongs.textContent = `${stats.trackCount} tracks`;
      if (mobAlbums) mobAlbums.textContent = `${stats.albumCount} albums`;
      if (mobArtists) mobArtists.textContent = `${stats.artistCount} artists`;
    } catch (_e) {
      // Ignore
    }
  }

  private mountInspector(): void {
    if (!this.container) return;
    const inspectorSlot = this.container.querySelector<HTMLElement>('#library-inspector-slot');
    if (!inspectorSlot) return;

    this.inspector = new TrackInspectorComponent({
      playbackManager: this.playbackManager,
      artworkService: this.artworkService
    });
    this.inspector.mount(inspectorSlot);
  }

  private mountActiveTab(): void {
    if (!this.container) return;

    const toolbarSlot = this.container.querySelector<HTMLElement>('#library-toolbar-slot');
    const contentSlot = this.container.querySelector<HTMLElement>('#library-content-slot');
    if (!contentSlot) return;

    // Show toolbar on Songs tab
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
