import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { ILibraryService } from '../../services/contracts/service-contracts';

export class HomeView implements IView {
  private container: HTMLElement | null = null;

  constructor(_libraryService?: ILibraryService) {
  }

  public mount(container: HTMLElement, _params?: RouteParams): void {
    this.container = container;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="home-view" style="padding: var(--space-6); max-width: 1200px; margin: 0 auto;">
        <header style="margin-bottom: var(--space-8);">
          <h2 style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: var(--space-2);">
            Welcome Home
          </h2>
          <p style="font-size: 14px; color: var(--color-text-secondary);">
            Your personal local audio space. Pure, private, and ad-free.
          </p>
        </header>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6);">
          <div class="glass-panel" style="padding: var(--space-6); border-radius: var(--radius-lg); background: var(--color-bg-surface);">
            <div style="font-size: 13px; font-weight: 600; color: var(--color-accent-primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">
              Library Overview
            </div>
            <p style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">
              Organized locally with embedded metadata, high-resolution artwork, and lossless sound purity.
            </p>
          </div>

          <div class="glass-panel" style="padding: var(--space-6); border-radius: var(--radius-lg); background: var(--color-bg-surface);">
            <div style="font-size: 13px; font-weight: 600; color: var(--color-accent-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-2);">
              Audio Engine
            </div>
            <p style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">
              10-Band EQ, ReplayGain normalization, safety limiting, and accurate real-time analysis active.
            </p>
          </div>
        </div>
      </section>
    `;
  }
}
