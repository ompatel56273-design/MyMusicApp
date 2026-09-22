import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { ISearchService } from '../../services/contracts/service-contracts';

export class SearchView implements IView {
  private container: HTMLElement | null = null;
  private currentQuery = '';

  constructor(_searchService?: ISearchService) {
  }

  public mount(container: HTMLElement, params?: RouteParams): void {
    this.container = container;
    if (params?.query) {
      this.currentQuery = params.query;
    }
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(params: RouteParams): void {
    if (params.query !== undefined && params.query !== this.currentQuery) {
      this.currentQuery = params.query;
      this.render();
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="search-view" style="padding: var(--space-6); max-width: 1200px; margin: 0 auto;">
        <header style="margin-bottom: var(--space-6);">
          <h2 style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: var(--space-2);">
            Search & Discovery
          </h2>
          <p style="font-size: 14px; color: var(--color-text-secondary);">
            Find songs, albums, artists, genres, playlists, and folders across your local library.
          </p>
        </header>

        <div class="glass-panel" style="padding: var(--space-8); border-radius: var(--radius-lg); text-align: center; color: var(--color-text-muted);">
          ${
            this.currentQuery
              ? `<p style="font-size: 14px;">Results for query: <strong>"${this.currentQuery}"</strong></p>`
              : `<p style="font-size: 14px;">Type in the search bar above or press <kbd style="background: var(--color-bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--glass-border); font-family: monospace;">/</kbd> to begin searching.</p>`
          }
        </div>
      </section>
    `;
  }
}
