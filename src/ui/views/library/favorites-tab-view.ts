import type { Track } from '../../../domain/entities/models';
import type { ILibraryService, IPlaybackManager, IArtworkService } from '../../../services/contracts/service-contracts';
import { VirtualScroller } from '../../components/virtual-scroller/virtual-scroller';
import { TrackRowComponent } from '../../components/library/track-row-component';
import { ThemeManager } from '../../theme/theme-manager';

export interface FavoritesTabViewDependencies {
  libraryService: ILibraryService;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
}

export class FavoritesTabView {
  private container: HTMLElement | null = null;
  private readonly libraryService: ILibraryService;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;

  private favoriteTracks: Track[] = [];
  private scroller: VirtualScroller<Track> | null = null;
  private densityUnsub: (() => void) | null = null;

  constructor(deps: FavoritesTabViewDependencies) {
    this.libraryService = deps.libraryService;
    this.playbackManager = deps.playbackManager;
    this.artworkService = deps.artworkService;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = `
      <div class="favorites-tab-container" style="display: flex; flex-direction: column; height: 100%; min-height: 400px;">
        <div
          class="songs-table-header"
          style="
            display: grid;
            grid-template-columns: 36px 40px 1fr 1fr 1fr 70px 60px 40px;
            gap: var(--space-3);
            padding: var(--space-2) var(--space-4);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-text-muted);
            border-bottom: 1px solid var(--glass-border);
            margin-bottom: var(--space-2);
          "
        >
          <div style="text-align: center;">#</div>
          <div></div>
          <div>Title</div>
          <div>Artist</div>
          <div>Album</div>
          <div>Format</div>
          <div style="text-align: right;">Time</div>
          <div style="text-align: center;">Fav</div>
        </div>

        <div id="favorites-viewport" style="flex: 1; overflow-y: auto; max-height: calc(100vh - 280px); min-height: 300px;">
          <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
            Loading favorite songs...
          </div>
        </div>
      </div>
    `;

    this.densityUnsub = ThemeManager.getInstance().subscribeLibraryDensity((_densityId, densityDef) => {
      if (this.scroller) {
        this.scroller.setItemHeight(densityDef.rowHeight);
      }
    });

    await this.loadFavorites();
  }

  public unmount(): void {
    if (this.densityUnsub) {
      this.densityUnsub();
      this.densityUnsub = null;
    }
    if (this.scroller) {
      this.scroller.dispose();
      this.scroller = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private async loadFavorites(): Promise<void> {
    try {
      const result = await this.libraryService.listTracks({ offset: 0, limit: 10000 }, { isFavorite: true });
      this.favoriteTracks = [...result.items];
      this.setupVirtualScroller();
    } catch (_err) {
      const viewport = this.container?.querySelector('#favorites-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="padding: var(--space-8); text-align: center; color: var(--color-status-error);">
            Failed to load favorites.
          </div>
        `;
      }
    }
  }

  private setupVirtualScroller(): void {
    if (!this.container) return;
    const viewport = this.container.querySelector<HTMLElement>('#favorites-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    if (this.favoriteTracks.length === 0) {
      viewport.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          No favorite tracks yet. Click the ★ icon on any track to add it here.
        </div>
      `;
      return;
    }

    const densityDef = ThemeManager.getInstance().getLibraryDensityDefinition();

    this.scroller = new VirtualScroller<Track>({
      container: viewport,
      items: this.favoriteTracks,
      itemHeight: densityDef.rowHeight,
      overscan: 5,
      renderItem: (track, index) => {
        return TrackRowComponent.create(
          track,
          index,
          {
            onPlay: t => {
              if (this.playbackManager) {
                void this.playbackManager.playTrack(t, this.favoriteTracks);
              }
            },
            onToggleFavorite: t => void this.handleToggleFavorite(t)
          },
          this.artworkService
        );
      }
    });
  }

  private async handleToggleFavorite(track: Track): Promise<void> {
    await this.libraryService.toggleFavorite(track.id);
    this.favoriteTracks = this.favoriteTracks.filter(t => t.id !== track.id);
    if (this.scroller) {
      this.scroller.setItems(this.favoriteTracks);
    }
    if (this.favoriteTracks.length === 0) {
      this.setupVirtualScroller();
    }
  }
}
