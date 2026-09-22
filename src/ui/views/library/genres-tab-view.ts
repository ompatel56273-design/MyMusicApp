import type { Genre } from '../../../domain/entities/models';
import type { ILibraryService } from '../../../services/contracts/service-contracts';
import { VirtualScroller } from '../../components/virtual-scroller/virtual-scroller';
import { GenreCardComponent } from '../../components/library/genre-card-component';

export interface GenresTabViewDependencies {
  libraryService: ILibraryService;
  onSelectGenre?: ((genre: Genre) => void) | undefined;
}

export class GenresTabView {
  private container: HTMLElement | null = null;
  private readonly libraryService: ILibraryService;
  private readonly onSelectGenre?: ((genre: Genre) => void) | undefined;

  private allGenres: Genre[] = [];
  private scroller: VirtualScroller<Genre> | null = null;

  constructor(deps: GenresTabViewDependencies) {
    this.libraryService = deps.libraryService;
    this.onSelectGenre = deps.onSelectGenre;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.container.innerHTML = `
      <div id="genres-viewport" style="overflow-y: auto; max-height: calc(100vh - 280px); min-height: 300px;">
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          Loading genres...
        </div>
      </div>
    `;

    await this.loadGenres();
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

  private async loadGenres(): Promise<void> {
    try {
      const result = await this.libraryService.listGenres({ offset: 0, limit: 500 });
      this.allGenres = [...result.items];
      this.setupVirtualScroller();
    } catch (_err) {
      const viewport = this.container?.querySelector('#genres-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="padding: var(--space-8); text-align: center; color: var(--color-status-error);">
            Failed to load library genres.
          </div>
        `;
      }
    }
  }

  private setupVirtualScroller(): void {
    if (!this.container) return;
    const viewport = this.container.querySelector<HTMLElement>('#genres-viewport');
    if (!viewport) return;

    viewport.innerHTML = '';

    if (this.allGenres.length === 0) {
      viewport.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
          No genres found in library.
        </div>
      `;
      return;
    }

    this.scroller = new VirtualScroller<Genre>({
      container: viewport,
      items: this.allGenres,
      itemHeight: 60,
      overscan: 4,
      renderItem: genre => {
        return GenreCardComponent.create(genre, {
          onSelect: g => {
            if (this.onSelectGenre) {
              this.onSelectGenre(g);
            }
          }
        });
      }
    });
  }
}
