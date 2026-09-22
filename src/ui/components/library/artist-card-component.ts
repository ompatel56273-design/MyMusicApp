import type { Artist } from '../../../domain/entities/models';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface ArtistCardCallbacks {
  onSelect: (artist: Artist) => void;
}

export class ArtistCardComponent {
  public static create(artist: Artist, callbacks: ArtistCardCallbacks): HTMLElement {
    const card = document.createElement('div');
    card.className = 'artist-card glass-panel';
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-artist-id', artist.id);
    card.setAttribute('aria-label', `Artist: ${artist.name}`);

    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = 'var(--space-4)';
    card.style.padding = 'var(--space-3) var(--space-4)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.cursor = 'pointer';
    card.style.height = '64px';
    card.style.boxSizing = 'border-box';
    card.style.transition = 'background-color 0.15s ease';

    card.innerHTML = `
      <div style="width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--color-bg-surface-elevated); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid var(--glass-border);">
        <span style="font-size: 20px; color: var(--color-text-muted);">👤</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
        <span style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(artist.name)}
        </span>
        <span style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
          ${artist.trackCount ? artist.trackCount + ' songs' : 'Artist'}
        </span>
      </div>
    `;

    card.addEventListener('click', () => callbacks.onSelect(artist));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onSelect(artist);
      }
    });

    return card;
  }
}
