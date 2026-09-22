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

    // Color gradient mapping based on genre name
    const colors = GenreCardComponent.getGenreGradient(genre.name);

    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.padding = '14px 20px';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.cursor = 'pointer';
    card.style.height = '64px';
    card.style.boxSizing = 'border-box';
    card.style.background = colors.bg;
    card.style.border = `1px solid ${colors.border}`;
    card.style.transition = 'all var(--duration-fast) var(--ease-smooth)';

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--space-3); overflow: hidden;">
        <span style="font-size: 20px;">${colors.icon}</span>
        <span style="font-size: 14px; font-weight: 700; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${genre.name}
        </span>
      </div>
      <span style="font-size: 12px; font-weight: 600; color: var(--color-text-secondary); background: rgba(0, 0, 0, 0.25); padding: 3px 8px; border-radius: var(--radius-full);">
        ${genre.trackCount ? genre.trackCount + ' songs' : '0 songs'}
      </span>
    `;

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = `0 4px 20px ${colors.glow}`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'none';
      card.style.boxShadow = 'none';
    });

    card.addEventListener('click', () => callbacks.onSelect(genre));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onSelect(genre);
      }
    });

    return card;
  }

  private static getGenreGradient(name: string): { bg: string; border: string; glow: string; icon: string } {
    const n = name.toLowerCase();
    if (n.includes('rock') || n.includes('metal')) {
      return {
        bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.15) 100%)',
        border: 'rgba(239, 68, 68, 0.35)',
        glow: 'rgba(239, 68, 68, 0.2)',
        icon: '🎸'
      };
    }
    if (n.includes('pop') || n.includes('dance')) {
      return {
        bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(219, 39, 119, 0.15) 100%)',
        border: 'rgba(236, 72, 153, 0.35)',
        glow: 'rgba(236, 72, 153, 0.2)',
        icon: '🎤'
      };
    }
    if (n.includes('electronic') || n.includes('edm') || n.includes('house')) {
      return {
        bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)',
        border: 'rgba(6, 182, 212, 0.35)',
        glow: 'rgba(6, 182, 212, 0.2)',
        icon: '⚡'
      };
    }
    if (n.includes('jazz') || n.includes('blues') || n.includes('soul')) {
      return {
        bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)',
        border: 'rgba(245, 158, 11, 0.35)',
        glow: 'rgba(245, 158, 11, 0.2)',
        icon: '🎷'
      };
    }
    if (n.includes('classical') || n.includes('ambient') || n.includes('acoustic')) {
      return {
        bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)',
        border: 'rgba(168, 85, 247, 0.35)',
        glow: 'rgba(168, 85, 247, 0.2)',
        icon: '🎻'
      };
    }
    return {
      bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)',
      border: 'rgba(168, 85, 247, 0.3)',
      glow: 'rgba(168, 85, 247, 0.15)',
      icon: '🏷️'
    };
  }
}

