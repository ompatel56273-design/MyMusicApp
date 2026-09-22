import type { Playlist } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';

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
    card.style.padding = 'var(--space-4)';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.cursor = 'pointer';
    card.style.transition = 'transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.07)';

    const durationStr = PlaylistCardComponent.formatDuration(playlist.durationMs);

    card.innerHTML = `
      <div class="playlist-art-wrap" style="position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--color-bg-surface-elevated); margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: center;">
        <div class="playlist-art-img" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(255, 120, 50, 0.15), rgba(120, 50, 255, 0.2));">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-accent-primary); opacity: 0.85;">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>

        <button
          class="playlist-quick-play-btn"
          aria-label="Play ${playlist.name}"
          style="position: absolute; bottom: var(--space-3); right: var(--space-3); width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--color-accent-primary); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); opacity: 0; transform: translateY(8px); transition: all 0.2s ease;"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-2); margin-bottom: var(--space-1);">
        <h3 class="playlist-name-text" style="font-size: 15px; font-weight: 600; color: var(--color-text-primary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
          ${playlist.name}
        </h3>
        <div class="playlist-actions-dropdown" style="position: relative;">
          <button
            class="playlist-menu-btn"
            aria-label="More options for ${playlist.name}"
            style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 2px 6px; font-size: 16px; border-radius: var(--radius-sm); line-height: 1;"
          >
            ⋮
          </button>
        </div>
      </div>

      <div style="font-size: 12px; color: var(--color-text-secondary); display: flex; justify-content: space-between; align-items: center;">
        <span>${playlist.trackCount} ${playlist.trackCount === 1 ? 'song' : 'songs'}</span>
        <span>${durationStr}</span>
      </div>
    `;

    // Hover styling
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.boxShadow = '0 12px 24px -6px rgba(0, 0, 0, 0.4)';
      card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      const playBtn = card.querySelector<HTMLElement>('.playlist-quick-play-btn');
      if (playBtn) {
        playBtn.style.opacity = '1';
        playBtn.style.transform = 'translateY(0)';
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      card.style.borderColor = 'rgba(255, 255, 255, 0.07)';
      const playBtn = card.querySelector<HTMLElement>('.playlist-quick-play-btn');
      if (playBtn) {
        playBtn.style.opacity = '0';
        playBtn.style.transform = 'translateY(8px)';
      }
    });

    // Artwork resolution if artworkId is present
    if (playlist.artworkId && artworkService) {
      const artContainer = card.querySelector<HTMLElement>('.playlist-art-img');
      void artworkService.getArtworkUrl(playlist.artworkId, 'medium').then(url => {
        if (url && artContainer) {
          artContainer.innerHTML = `<img src="${url}" alt="${playlist.name}" style="width: 100%; height: 100%; object-fit: cover;" />`;
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
