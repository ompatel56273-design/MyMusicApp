import type { RouterService } from '../navigation/router-service';
import type { AppRoute, RouteState } from '../navigation/route-types';
import type { Disposable } from '../../core/types/common';

export interface NavItem {
  id: AppRoute;
  label: string;
  icon: string;
}

export class SidebarComponent {
  private container: HTMLElement | null = null;
  private readonly router: RouterService;
  private routerSub: Disposable | null = null;

  private navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: '⌂' },
    { id: 'library', label: 'Library', icon: '𝄤' },
    { id: 'playlists', label: 'Playlists', icon: '☰' },
    { id: 'galaxy', label: 'Galaxy', icon: '✦' },
    { id: 'settings', label: 'Settings', icon: '⚙' }
  ];

  constructor(router: RouterService) {
    this.router = router;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();

    this.routerSub = this.router.subscribe(state => {
      this.updateActiveNav(state);
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
      <aside
        class="glass-panel"
        role="navigation"
        aria-label="Primary Navigation"
        style="
          width: var(--sidebar-width);
          height: 100%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--glass-border);
          padding: var(--space-4);
          z-index: 5;
        "
      >
        <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3) var(--space-6);">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: var(--radius-sm);
            background: var(--color-accent-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            box-shadow: var(--shadow-glow);
          ">♫</div>
          <span style="font-size: 16px; font-weight: 700; letter-spacing: -0.02em;">Audio OS</span>
        </div>

        <nav style="display: flex; flex-direction: column; gap: var(--space-1); flex: 1;">
          ${this.navItems
            .map(
              item => `
            <button
              data-route="${item.id}"
              aria-current="${this.router.current.route === item.id ? 'page' : 'false'}"
              style="
                display: flex;
                align-items: center;
                gap: var(--space-3);
                padding: var(--space-3) var(--space-4);
                border-radius: var(--radius-md);
                border: 1px solid ${this.router.current.route === item.id ? 'var(--glass-border-highlight)' : 'transparent'};
                background: ${this.router.current.route === item.id ? 'var(--color-bg-surface-elevated)' : 'transparent'};
                color: ${this.router.current.route === item.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'};
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                text-align: left;
                width: 100%;
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              <span style="font-size: 16px; width: 20px; text-align: center;">${item.icon}</span>
              <span>${item.label}</span>
            </button>
          `
            )
            .join('')}
        </nav>
      </aside>
    `;

    // Bind navigation click events
    const navButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-route]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-route') as AppRoute;
        if (route) {
          this.router.navigate(route);
        }
      });
    });
  }

  private updateActiveNav(state: RouteState): void {
    if (!this.container) return;
    const navButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-route]');
    navButtons.forEach(btn => {
      const route = btn.getAttribute('data-route');
      const isActive = route === state.route;
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      btn.style.background = isActive ? 'var(--color-bg-surface-elevated)' : 'transparent';
      btn.style.color = isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)';
      btn.style.borderColor = isActive ? 'var(--glass-border-highlight)' : 'transparent';
    });
  }
}
