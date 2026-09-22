import type { Track } from '../../../domain/entities/models';
import type { ILibraryService, IPlaybackManager, IArtworkService } from '../../../services/contracts/service-contracts';
import { VirtualScroller } from '../../components/virtual-scroller/virtual-scroller';
import { TrackRowComponent } from '../../components/library/track-row-component';
import type { LibraryToolbarState } from '../../components/library/library-toolbar';

export interface SongsTabViewDependencies {
  libraryService: ILibraryService;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
}

export class SongsTabView {
  private container: HTMLElement | null = null;
  private readonly libraryService: ILibraryService;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;

  private allTracks: Track[] = [];
  private filteredTracks: Track[] = [];
  private scroller: VirtualScroller<Track> | null = null;
  private filterState: LibraryToolbarState = {
    searchQuery: '',
    sortBy: 'title',
    sortDirection: 'asc',
    formatFilter: 'all'
  };

  constructor(deps: SongsTabViewDependencies) {
    this.libraryService = deps.libraryService;
    this.playbackManager = deps.playbackManager;
    this.artworkService = deps.artworkService;
  }

  public async mount(container: HTMLElement, filterOverride?: Partial<LibraryToolbarState>): Promise<void> {
    this.container = container;
    if (filterOverride) {
      this.filterState = { ...this.filterState, ...filterOverride };
    }

    this.container.innerHTML = `
      <div class="songs-tab-container glass-panel" style="display: flex; flex-direction: column; flex: 1; min-height: 400px; background: rgba(18, 24, 38, 0.4); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); padding: var(--space-3); overflow: hidden;">
        <!-- Songs Table Header (Template 3) -->
        <div
          class="songs-table-header"
          style="
            display: grid;
            grid-template-columns: 36px 40px 1fr 1fr 1fr 70px 60px 40px;
            gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
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

        <div id="songs-viewport" style="flex: 1; overflow-y: auto; max-height: calc(100vh - 320px); min-height: 300px;">
          <div id="songs-loading" style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">
            <div style="font-size: 28px; margin-bottom: 8px;">🎵</div>
            <div>Loading songs...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadTracks();
  }

  public unmount(): void {
    if (this.scroller) {
      this.scroller.dispose();
      this.scroller = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public applyFilter(filter: LibraryToolbarState): void {
    this.filterState = filter;
    this.applyFilteringAndSorting();
    if (this.scroller) {
      this.scroller.setItems(this.filteredTracks);
    }
  }

  public getRenderedCount(): number {
    return this.scroller ? this.scroller.getRenderedCount() : 0;
  }

  private async loadTracks(): Promise<void> {
    try {
      const result = await this.libraryService.listTracks({ offset: 0, limit: 10000 });
      this.allTracks = [...result.items];
      this.applyFilteringAndSorting();
      this.setupVirtualScroller();
    } catch (_err) {
      const viewport = this.container?.querySelector('#songs-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="padding: var(--space-8); text-align: center; color: var(--color-status-error);">
            Failed to load library songs.
          </div>
        `;
      }
    }
  }

  private setupVirtualScroller(): void {
    if (!this.container) return;
    const viewport = this.container.querySelector<HTMLElement>('#songs-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    if (this.filteredTracks.length === 0) {
      viewport.innerHTML = `
        <div style="padding: var(--space-12); text-align: center; color: var(--color-text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">🎶</div>
          <div style="font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px;">No songs found</div>
          <div style="font-size: 13px;">No audio tracks match your active search or filter criteria.</div>
        </div>
      `;
      return;
    }

    this.scroller = new VirtualScroller<Track>({
      container: viewport,
      items: this.filteredTracks,
      itemHeight: 56,
      overscan: 5,
      renderItem: (track, index) => {
        return TrackRowComponent.create(
          track,
          index,
          {
            onPlay: t => this.handlePlayTrack(t),
            onToggleFavorite: t => void this.handleToggleFavorite(t)
          },
          this.artworkService
        );
      }
    });
  }

  private applyFilteringAndSorting(): void {
    let tracks = [...this.allTracks];

    // Format Filter
    if (this.filterState.formatFilter && this.filterState.formatFilter !== 'all') {
      const fmt = this.filterState.formatFilter.toLowerCase();
      if (fmt === 'lossless') {
        tracks = tracks.filter(t => t.format.isLossless);
      } else {
        tracks = tracks.filter(t => t.format.container.toLowerCase() === fmt || t.format.codec.toLowerCase() === fmt);
      }
    }

    // Search Query Filter
    if (this.filterState.searchQuery) {
      const q = this.filterState.searchQuery.toLowerCase();
      tracks = tracks.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          (t.artistName && t.artistName.toLowerCase().includes(q)) ||
          (t.albumTitle && t.albumTitle.toLowerCase().includes(q))
      );
    }

    // Sorting
    const sortField = this.filterState.sortBy;
    const isAsc = this.filterState.sortDirection === 'asc';

    tracks.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'artist':
          comparison = (a.artistName || '').localeCompare(b.artistName || '');
          break;
        case 'album':
          comparison = (a.albumTitle || '').localeCompare(b.albumTitle || '');
          break;
        case 'duration':
          comparison = (a.durationMs || 0) - (b.durationMs || 0);
          break;
        case 'dateAdded':
          comparison = a.dateAdded - b.dateAdded;
          break;
        case 'playCount':
          comparison = (a.playCount || 0) - (b.playCount || 0);
          break;
        case 'title':
        default:
          comparison = a.title.localeCompare(b.title);
          break;
      }
      return isAsc ? comparison : -comparison;
    });

    this.filteredTracks = tracks;
  }

  private handlePlayTrack(track: Track): void {
    if (this.playbackManager) {
      void this.playbackManager.playTrack(track, this.filteredTracks);
    }
  }

  private async handleToggleFavorite(track: Track): Promise<void> {
    const nextState = await this.libraryService.toggleFavorite(track.id);
    const index = this.allTracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      this.allTracks[index] = { ...this.allTracks[index]!, isFavorite: nextState };
      this.applyFilteringAndSorting();
      if (this.scroller) {
        this.scroller.setItems(this.filteredTracks);
      }
    }
  }
}

