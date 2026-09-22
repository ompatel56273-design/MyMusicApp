import type { Playlist } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface PlaylistCardCallbacks {
  onSelect: (playlist: Playlist) => void;
  onPlay: (playlist: Playlist) => void;
  onEdit: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}

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
    card.style.padding = '14px';
    card.style.borderRadius = 'var(--radius-xl)';
    card.style.cursor = 'pointer';
    card.style.transition = 'all var(--duration-fast) var(--ease-smooth)';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    card.style.border = '1px solid var(--glass-border)';

    const durationStr = PlaylistCardComponent.formatDuration(playlist.durationMs);

    card.innerHTML = `
      <div class="playlist-art-wrap" style="position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--radius-lg); overflow: hidden; background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%); margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.06);">
        <div class="playlist-art-img" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 38px; color: var(--color-purple-neon);">📑</span>
        </div>

        <button
          class="playlist-quick-play-btn"
          aria-label="Play ${escapeHtml(playlist.name)}"
          style="position: absolute; bottom: 10px; right: 10px; width: 44px; height: 44px; border-radius: var(--radius-full); background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: var(--shadow-glow-purple); opacity: 0.9; transform: scale(0.95); transition: all 0.2s ease;"
        >
          <span style="font-size: 16px; margin-left: 2px;">▶</span>
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); margin-bottom: var(--space-1);">
        <h3 class="playlist-name-text" style="font-size: 14px; font-weight: 700; color: var(--color-text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
          ${escapeHtml(playlist.name)}
        </h3>
        <div class="playlist-actions-dropdown" style="position: relative;">
          <button
            class="playlist-menu-btn"
            aria-label="More options for ${escapeHtml(playlist.name)}"
            title="Options"
            style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 2px 8px; font-size: 16px; border-radius: var(--radius-sm); line-height: 1; min-width: 32px; min-height: 32px; display: flex; align-items: center; justify-content: center;"
          >
            ⋮
          </button>
        </div>
      </div>

      <div style="font-size: 12px; color: var(--color-text-secondary); display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
        <span>${playlist.trackCount} ${playlist.trackCount === 1 ? 'song' : 'songs'}</span>
        <span style="color: var(--color-text-muted);">${durationStr}</span>
      </div>
    `;

    // Hover styling
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.boxShadow = 'var(--shadow-glow-purple)';
      card.style.borderColor = 'rgba(168, 85, 247, 0.4)';
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

