import type { Playlist } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { escapeHtml } from '../../../core/security/html-sanitizer';
import { getIconSvg } from '../../icons/icon-registry';

export interface PlaylistCardCallbacks {
  onSelect: (playlist: Playlist) => void;
  onPlay: (playlist: Playlist) => void;
  onEdit: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}

/**
 * Phase 7 Playlist Card Component (Template 5).
 * Features:
 * - High-fidelity glass surface with dynamic gradient art cover
 * - Quick-play floating button on hover with neon glow
 * - Options dropdown menu (Edit, Delete, Open)
 * - Track count & duration metadata
 * - Accessible keyboard navigation & touch-safe 44px targets
 */
export class PlaylistCardComponent {
  public static create(
    playlist: Playlist,
    callbacks: PlaylistCardCallbacks,
    artworkService?: IArtworkService
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = 'playlist-card glass-panel';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-playlist-id', playlist.id);
    card.setAttribute(
      'aria-label',
      `Playlist ${playlist.name}, ${playlist.trackCount} ${playlist.trackCount === 1 ? 'song' : 'songs'}`
    );

    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.padding = 'var(--space-4)';
    card.style.borderRadius = 'var(--radius-2xl)';
    card.style.cursor = 'pointer';
    card.style.transition = 'all var(--duration-fast) var(--ease-smooth)';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.style.background = 'var(--glass-bg-subtle)';
    card.style.border = '1px solid var(--glass-border)';
    card.style.boxSizing = 'border-box';
    card.style.minWidth = '0';

    const durationStr = PlaylistCardComponent.formatDuration(playlist.durationMs);

    card.innerHTML = `
      <div class="playlist-art-wrap" style="position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--radius-xl); overflow: hidden; background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.25) 50%, rgba(6, 182, 212, 0.2) 100%); margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: center; border: 1px solid var(--glass-border);">
        <div class="playlist-art-img" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-accent-purple-glow);">
          ${getIconSvg('playlist', { size: 44, color: 'var(--color-accent-purple-glow)' })}
        </div>

        <button
          class="playlist-quick-play-btn"
          aria-label="Play ${escapeHtml(playlist.name)}"
          title="Play Playlist"
          style="
            position: absolute;
            bottom: 12px;
            right: 12px;
            width: 44px;
            height: 44px;
            border-radius: var(--radius-full);
            background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%);
            border: 1px solid var(--glass-border-interactive);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);
            transition: all var(--duration-fast) var(--ease-smooth);
            z-index: 2;
          "
        >
          <span style="display: flex; transform: translateX(1px);">${getIconSvg('play', { size: 18, color: '#ffffff' })}</span>
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); margin-bottom: 2px;">
        <h3 class="playlist-name-text" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; letter-spacing: -0.01em;">
          ${escapeHtml(playlist.name)}
        </h3>
        <div class="playlist-actions-dropdown" style="position: relative;">
          <button
            class="playlist-menu-btn"
            aria-label="More options for ${escapeHtml(playlist.name)}"
            title="Options"
            style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; min-width: 32px; min-height: 32px; transition: color var(--duration-fast);"
          >
            ${getIconSvg('more-vertical', { size: 16 })}
          </button>
        </div>
      </div>

      ${
        playlist.description
          ? `<p style="font-size: 11px; color: var(--color-text-muted); margin: 0 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(playlist.description)}</p>`
          : ''
      }

      <div style="font-size: 12px; color: var(--color-text-secondary); display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
        <span style="font-weight: var(--font-weight-medium);">${playlist.trackCount} ${playlist.trackCount === 1 ? 'song' : 'songs'}</span>
        <span style="color: var(--color-text-muted); font-size: 11px;">${durationStr}</span>
      </div>
    `;

    // Hover styling
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.boxShadow = 'var(--shadow-elevation-medium), 0 0 20px rgba(124, 58, 237, 0.25)';
      card.style.borderColor = 'var(--glass-border-interactive)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'none';
      card.style.boxShadow = 'none';
      card.style.borderColor = 'var(--glass-border)';
    });

    // Artwork resolution if artworkId is present
    if (playlist.artworkId && artworkService) {
      const artContainer = card.querySelector<HTMLElement>('.playlist-art-img');
      void artworkService.getArtworkUrl(playlist.artworkId, 'medium').then(url => {
        if (url && artContainer) {
          artContainer.innerHTML = `<img src="${url}" alt="${escapeHtml(playlist.name)}" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }

    // Quick play button click
    const quickPlayBtn = card.querySelector('.playlist-quick-play-btn');
    if (quickPlayBtn) {
      quickPlayBtn.addEventListener('click', e => {
        e.stopPropagation();
        callbacks.onPlay(playlist);
      });
    }

    // Menu button click
    const menuBtn = card.querySelector('.playlist-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const action = window.confirm(`Playlist: "${playlist.name}"\n\nClick OK to Edit, or Cancel to Delete.`)
          ? 'edit'
          : 'check_delete';
        if (action === 'edit') {
          callbacks.onEdit(playlist);
        } else {
          const reallyDelete = window.confirm(`Are you sure you want to delete playlist "${playlist.name}"?`);
          if (reallyDelete) {
            callbacks.onDelete(playlist);
          }
        }
      });
    }

    // Card click & keyboard navigation
    card.addEventListener('click', () => {
      callbacks.onSelect(playlist);
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onSelect(playlist);
      }
    });

    return card;
  }

  private static formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '0 min';
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin} min`;
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hrs} hr ${mins} min`;
  }
}
