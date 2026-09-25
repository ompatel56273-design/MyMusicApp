import type { Album } from '../../../domain/entities/models';
import type { ILibraryService, IPlaybackManager, IArtworkService } from '../../../services/contracts/service-contracts';
import type { AlbumMergeService } from '../../../services/library/album-merge-service';
import { VirtualScroller } from '../../components/virtual-scroller/virtual-scroller';
import { AlbumCardComponent } from '../../components/library/album-card-component';
import { AlbumMergeModal } from '../../components/library/album-merge-modal';
import { getIconSvg } from '../../icons/icon-registry';

export interface AlbumsTabViewDependencies {
  libraryService: ILibraryService;
  albumMergeService?: AlbumMergeService | undefined;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
  onSelectAlbum?: ((album: Album) => void) | undefined;
}

export class AlbumsTabView {
  private container: HTMLElement | null = null;
  private readonly libraryService: ILibraryService;
  private readonly albumMergeService?: AlbumMergeService | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly onSelectAlbum?: ((album: Album) => void) | undefined;

  private allAlbums: Album[] = [];
  private scroller: VirtualScroller<Album> | null = null;

  constructor(deps: AlbumsTabViewDependencies) {
    this.libraryService = deps.libraryService;
    this.albumMergeService = deps.albumMergeService;
    this.playbackManager = deps.playbackManager;
    this.artworkService = deps.artworkService;
    this.onSelectAlbum = deps.onSelectAlbum;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--color-text-secondary);" id="albums-count-label">
            Albums
          </span>
          ${this.albumMergeService ? `
            <button id="albums-btn-merge" style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 6px 14px;
              border-radius: var(--radius-full);
              border: 1px solid var(--glass-border-interactive);
              background: rgba(124, 58, 237, 0.15);
              color: var(--color-accent-purple-glow);
              font-size: 12px;
              font-weight: 700;
              cursor: pointer;
              transition: all var(--duration-fast);
            ">
              <span>${getIconSvg('disc', { size: 14 })}</span>
              <span>Merge Duplicate Albums</span>
            </button>
          ` : ''}
        </div>
        <div id="albums-viewport" style="overflow-y: auto; max-height: calc(100vh - 320px); min-height: 300px;">
          <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
            Loading albums...
          </div>
        </div>
      </div>
    `;

    this.bindHeaderEvents();
    await this.loadAlbums();
  }

  private bindHeaderEvents(): void {
    const mergeBtn = this.container?.querySelector('#albums-btn-merge');
    mergeBtn?.addEventListener('click', () => {
      if (this.albumMergeService) {
        AlbumMergeModal.show({
          albumMergeService: this.albumMergeService,
          onMerged: () => {
            void this.loadAlbums();
          }
        });
      }
    });
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

  private async loadAlbums(): Promise<void> {
    try {
      const result = await this.libraryService.listAlbums({ offset: 0, limit: 1000 });
      this.allAlbums = [...result.items];
      this.setupVirtualScroller();
    } catch (_err) {
      const viewport = this.container?.querySelector('#albums-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="padding: var(--space-8); text-align: center; color: var(--color-status-error);">
            Failed to load library albums.
          </div>
        `;
      }
    }
  }

  private setupVirtualScroller(): void {
    if (!this.container) return;
    const viewport = this.container.querySelector<HTMLElement>('#albums-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    if (this.allAlbums.length === 0) {
      viewport.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          No albums found in library.
        </div>
      `;
      return;
    }

    this.scroller = new VirtualScroller<Album>({
      container: viewport,
      items: this.allAlbums,
      itemHeight: 250,
      overscan: 3,
      renderItem: album => {
        return AlbumCardComponent.create(
          album,
          {
            onSelect: a => {
              if (this.onSelectAlbum) {
                this.onSelectAlbum(a);
              }
            },
            onPlay: a => void this.playAlbum(a)
          },
          this.artworkService
        );
      }
    });
  }

  private async playAlbum(album: Album): Promise<void> {
    if (!this.playbackManager) return;
    const result = await this.libraryService.listTracks({ offset: 0, limit: 500 }, { albumId: album.id });
    if (result.items.length > 0) {
      const first = result.items[0]!;
      void this.playbackManager.playTrack(first, result.items);
    }
  }
}
