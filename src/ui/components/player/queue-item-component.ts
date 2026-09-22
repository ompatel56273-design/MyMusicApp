import type { Track } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';

export interface QueueItemCallbacks {
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export class QueueItemComponent {
  public static create(
    track: Track,
    index: number,
    isActive: boolean,
    totalCount: number,
    callbacks: QueueItemCallbacks,
    artworkService?: IArtworkService
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `queue-item-row ${isActive ? 'queue-item-active' : ''}`;
    row.setAttribute('role', 'listitem');
    row.setAttribute('tabindex', '0');
    row.setAttribute('data-queue-index', String(index));
    row.setAttribute('aria-label', `${isActive ? 'Now Playing: ' : ''}${track.title} by ${track.artistName ?? 'Unknown'}`);

    const durationStr = QueueItemComponent.formatDuration(track.durationMs);

    row.style.display = 'grid';
    row.style.gridTemplateColumns = '28px 36px 1fr 50px 64px';
    row.style.alignItems = 'center';
    row.style.gap = 'var(--space-3)';
    row.style.padding = 'var(--space-2) var(--space-3)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.background = isActive ? 'var(--color-bg-surface-elevated)' : 'transparent';
    row.style.border = isActive ? '1px solid var(--glass-border-highlight)' : '1px solid transparent';
    row.style.cursor = 'pointer';
    row.style.transition = 'all var(--duration-fast) var(--ease-smooth)';
    row.style.height = '48px';
    row.style.boxSizing = 'border-box';

    const indexOrPlaying = isActive
      ? `<span style="color: var(--color-accent-primary); font-size: 14px;">▶</span>`
      : `<span style="color: var(--color-text-muted); font-size: 12px;">${index + 1}</span>`;

    row.innerHTML = `
      <div style="text-align: center; display: flex; align-items: center; justify-content: center;">
        ${indexOrPlaying}
      </div>

      <div class="queue-row-art" style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--color-bg-surface); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
        <span style="font-size: 13px; color: var(--color-text-muted);">♫</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden;">
        <span style="font-size: 13px; font-weight: ${isActive ? '600' : '400'}; color: ${isActive ? 'var(--color-accent-primary)' : 'var(--color-text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${track.title}
        </span>
        <span style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${track.artistName ?? 'Unknown Artist'}
        </span>
      </div>

      <div style="font-size: 11px; color: var(--color-text-muted); text-align: right; font-variant-numeric: tabular-nums;">
        ${durationStr}
      </div>

      <div style="display: flex; align-items: center; gap: 2px; justify-content: flex-end;">
        <button
          class="queue-move-up-btn"
          aria-label="Move track up"
          ${index === 0 ? 'disabled' : ''}
          style="background: transparent; border: none; font-size: 10px; cursor: ${index === 0 ? 'default' : 'pointer'}; color: ${index === 0 ? 'rgba(255,255,255,0.1)' : 'var(--color-text-muted)'}; padding: 2px;"
        >▲</button>
        <button
          class="queue-move-down-btn"
          aria-label="Move track down"
          ${index === totalCount - 1 ? 'disabled' : ''}
          style="background: transparent; border: none; font-size: 10px; cursor: ${index === totalCount - 1 ? 'default' : 'pointer'}; color: ${index === totalCount - 1 ? 'rgba(255,255,255,0.1)' : 'var(--color-text-muted)'}; padding: 2px;"
        >▼</button>
        <button
          class="queue-remove-btn"
          aria-label="Remove from queue"
          style="background: transparent; border: none; font-size: 12px; cursor: pointer; color: var(--color-text-muted); padding: 2px; margin-left: 2px;"
        >✕</button>
      </div>
    `;

    // Load thumbnail artwork
    const artBox = row.querySelector('.queue-row-art');
    const artId = (track as any).artworkId || track.albumId;
    if (artBox && artworkService && artId) {
      void artworkService.getArtworkUrl(artId, 'small').then(url => {
        if (url && artBox) {
          artBox.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }

    // Bind item events
    row.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target && target.closest('button')) return;
      callbacks.onPlay(index);
    });

    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onPlay(index);
      }
    });

    const upBtn = row.querySelector('.queue-move-up-btn');
    upBtn?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onMoveUp(index);
    });

    const downBtn = row.querySelector('.queue-move-down-btn');
    downBtn?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onMoveDown(index);
    });

    const removeBtn = row.querySelector('.queue-remove-btn');
    removeBtn?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onRemove(index);
    });

    return row;
  }

  private static formatDuration(ms?: number): string {
    if (!ms || isNaN(ms) || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}
