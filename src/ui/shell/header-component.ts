import type { RouterService } from '../navigation/router-service';
import type { RouteState } from '../navigation/route-types';
import type { Disposable } from '../../core/types/common';

export class HeaderComponent {
  private container: HTMLElement | null = null;
  private readonly router: RouterService;
  private routerSub: Disposable | null = null;

  constructor(router: RouterService) {
    this.router = router;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();

    this.routerSub = this.router.subscribe(state => {
      this.updateTitle(state);
    });
  }

  public unmount(): void {
    if (this.routerSub) {
      this.routerSub.dispose();
      this.routerSub = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <header
        class="glass-panel"
        role="banner"
        style="
          height: var(--header-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-6);
          border-bottom: 1px solid var(--glass-border);
          z-index: 10;
        "
      >
        <div style="display: flex; align-items: center; gap: var(--space-4);">
          <div style="display: flex; gap: var(--space-1);">
            <button
              id="nav-back-btn"
              aria-label="Go Back"
              style="
                width: 32px;
                height: 32px;
                border-radius: var(--radius-sm);
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >‹</button>
            <button
              id="nav-forward-btn"
              aria-label="Go Forward"
              style="
                width: 32px;
                height: 32px;
                border-radius: var(--radius-sm);
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >›</button>
          </div>

          <h1 id="header-route-title" style="font-size: 16px; font-weight: 600; text-transform: capitalize;">
            ${this.router.current.route}
          </h1>
        </div>

        <div style="flex: 1; max-width: 420px; margin: 0 var(--space-6);">
          <div style="position: relative; display: flex; align-items: center;">
            <input
              id="global-search-input"
              type="search"
              placeholder="Search music, artists, albums... (/)"
              aria-label="Search local library"
              style="
                width: 100%;
                height: 36px;
                background: var(--color-bg-surface-elevated);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-full);
                padding: 0 var(--space-4) 0 var(--space-8);
                color: var(--color-text-primary);
                font-size: 13px;
                outline: none;
                transition: border-color var(--duration-fast) var(--ease-smooth);
              "
            />
            <span style="position: absolute; left: 10px; color: var(--color-text-muted); font-size: 13px; pointer-events: none;">🔍</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <span style="font-size: 12px; color: var(--color-text-secondary); background: var(--color-bg-surface-elevated); padding: 4px 10px; border-radius: var(--radius-full); border: 1px solid var(--glass-border);">
            Local-First • Audio OS
          </span>
        </div>
      </header>
    `;

    // Bind Back / Forward buttons
    const backBtn = this.container.querySelector('#nav-back-btn');
    backBtn?.addEventListener('click', () => this.router.back());

    const fwdBtn = this.container.querySelector('#nav-forward-btn');
    fwdBtn?.addEventListener('click', () => this.router.forward());

    // Bind Search Input
    const searchInput = this.container.querySelector<HTMLInputElement>('#global-search-input');
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (this.router.current.route !== 'search') {
        this.router.navigate('search', { query });
      } else {
        this.router.navigate('search', { query });
      }
    });
  }

  private updateTitle(state: RouteState): void {
    if (!this.container) return;
    const titleEl = this.container.querySelector('#header-route-title');
    if (titleEl) {
      titleEl.textContent = state.route.charAt(0).toUpperCase() + state.route.slice(1);
    }
  }
}
