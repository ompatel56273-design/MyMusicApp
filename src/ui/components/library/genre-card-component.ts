import type { Genre } from '../../../domain/entities/models';

export interface GenreCardCallbacks {
  onSelect: (genre: Genre) => void;
}

export class GenreCardComponent {
  public static create(genre: Genre, callbacks: GenreCardCallbacks): HTMLElement {
    const card = document.createElement('div');
    card.className = 'genre-card glass-panel';
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-genre-id', genre.id);
    card.setAttribute('aria-label', `Genre: ${genre.name}`);

    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.padding = 'var(--space-3) var(--space-4)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.cursor = 'pointer';
    card.style.height = '56px';
    card.style.boxSizing = 'border-box';
    card.style.transition = 'background-color 0.15s ease';

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--space-3); overflow: hidden;">
        <span style="font-size: 16px; color: var(--color-accent-primary);">🏷️</span>
        <span style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${genre.name}
        </span>
      </div>
      <span style="font-size: 12px; color: var(--color-text-muted);">
        ${genre.trackCount ? genre.trackCount + ' songs' : ''}
      </span>
    `;

    card.addEventListener('click', () => callbacks.onSelect(genre));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onSelect(genre);
      }
    });

    return card;
  }
}
