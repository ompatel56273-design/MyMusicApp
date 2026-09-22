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
    card.style.padding = '12px 18px';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.cursor = 'pointer';
    card.style.height = '68px';
    card.style.boxSizing = 'border-box';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    card.style.border = '1px solid var(--glass-border)';
    card.style.transition = 'all var(--duration-fast) var(--ease-smooth)';

    card.innerHTML = `
      <div style="width: 46px; height: 46px; border-radius: var(--radius-full); background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1.5px solid rgba(168, 85, 247, 0.4); box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);">
        <span style="font-size: 20px;">👤</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
        <span style="font-size: 14px; font-weight: 700; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(artist.name)}
        </span>
        <span style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
          ${artist.trackCount ? artist.trackCount + ' songs' : 'Artist'} • ${artist.albumCount ? artist.albumCount + ' albums' : 'Local Artist'}
        </span>
      </div>

      <span style="font-size: 16px; color: var(--color-text-muted); opacity: 0.6;">›</span>
    `;

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      card.style.background = 'rgba(255, 255, 255, 0.06)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'none';
      card.style.borderColor = 'var(--glass-border)';
      card.style.background = 'rgba(255, 255, 255, 0.03)';
    });

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

