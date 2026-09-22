import type { Artist } from '../../../domain/entities/models';
import type { ILibraryService } from '../../../services/contracts/service-contracts';
import { VirtualScroller } from '../../components/virtual-scroller/virtual-scroller';
import { ArtistCardComponent } from '../../components/library/artist-card-component';

export interface ArtistsTabViewDependencies {
  libraryService: ILibraryService;
  onSelectArtist?: ((artist: Artist) => void) | undefined;
}

export class ArtistsTabView {
  private container: HTMLElement | null = null;
  private readonly libraryService: ILibraryService;
  private readonly onSelectArtist?: ((artist: Artist) => void) | undefined;

  private allArtists: Artist[] = [];
  private scroller: VirtualScroller<Artist> | null = null;

  constructor(deps: ArtistsTabViewDependencies) {
    this.libraryService = deps.libraryService;
    this.onSelectArtist = deps.onSelectArtist;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = `
      <div id="artists-viewport" style="overflow-y: auto; max-height: calc(100vh - 280px); min-height: 300px;">
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          Loading artists...
        </div>
      </div>
    `;

    await this.loadArtists();
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

  private async loadArtists(): Promise<void> {
    try {
      const result = await this.libraryService.listArtists({ offset: 0, limit: 1000 });
      this.allArtists = [...result.items];
      this.setupVirtualScroller();
    } catch (_err) {
      const viewport = this.container?.querySelector('#artists-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="padding: var(--space-8); text-align: center; color: var(--color-status-error);">
            Failed to load library artists.
          </div>
        `;
      }
    }
  }

  private setupVirtualScroller(): void {
    if (!this.container) return;
    const viewport = this.container.querySelector<HTMLElement>('#artists-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    if (this.allArtists.length === 0) {
      viewport.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          No artists found in library.
        </div>
      `;
      return;
    }

    this.scroller = new VirtualScroller<Artist>({
      container: viewport,
      items: this.allArtists,
      itemHeight: 68,
      overscan: 4,
      renderItem: artist => {
        return ArtistCardComponent.create(artist, {
          onSelect: a => {
            if (this.onSelectArtist) {
              this.onSelectArtist(a);
            }
          }
        });
      }
    });
  }
}
