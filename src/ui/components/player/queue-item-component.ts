import type { Track } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface QueueItemCallbacks {
  onPlay: (index: number) => void;
  onRemove: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

/**
 * Phase 8 Queue Item Component.
 * Features:
 * - Lucide SVGs for playing equalizer wave, move buttons, and delete
 * - Flexible signature for backwards compatibility
 * - Touch-friendly 44px targets and active track styling
 */
export class QueueItemComponent {
  public static create(
    track: Track,
    index: number,
    isActive: boolean,
    arg4?: number | Partial<QueueItemCallbacks>,
    arg5?: Partial<QueueItemCallbacks> | IArtworkService,
    arg6?: IArtworkService
  ): HTMLElement {
    let callbacks: Partial<QueueItemCallbacks> = {};
    let artworkService: IArtworkService | undefined;
    let totalCount = 100;

    if (typeof arg4 === 'number') {
      totalCount = arg4;
      callbacks = (arg5 as Partial<QueueItemCallbacks>) || {};
      artworkService = arg6;
    } else if (arg4 && typeof arg4 === 'object') {
      callbacks = arg4;
      artworkService = arg5 as IArtworkService;
    }

    const row = document.createElement('div');
    row.className = `queue-item-row ${isActive ? 'queue-item-active' : ''}`;
    row.setAttribute('role', 'listitem');
    row.setAttribute('tabindex', '0');
    row.setAttribute('data-queue-index', String(index));
    row.setAttribute('aria-label', `${isActive ? 'Now Playing: ' : ''}${track.title} by ${track.artistName ?? 'Unknown'}`);

    const durationStr = QueueItemComponent.formatDuration(track.durationMs);

    row.style.display = 'grid';
    row.style.gridTemplateColumns = '24px 38px 1fr 48px 68px';
    row.style.alignItems = 'center';
    row.style.gap = 'var(--space-3)';
    row.style.padding = '8px 12px';
    row.style.borderRadius = 'var(--radius-lg)';
    row.style.background = isActive ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%)' : 'rgba(255, 255, 255, 0.02)';
    row.style.border = isActive ? '1px solid var(--glass-border-interactive)' : '1px solid var(--glass-border)';
    if (isActive) {
      row.style.borderLeft = '3px solid var(--color-accent-purple)';
      row.style.boxShadow = '0 0 16px rgba(124, 58, 237, 0.2)';
    }
    row.style.cursor = 'pointer';
    row.style.transition = 'all var(--duration-fast) var(--ease-smooth)';
    row.style.minHeight = '48px';
    row.style.boxSizing = 'border-box';

    const indexOrPlaying = isActive
      ? `<span style="color: var(--color-accent-cyan); display: flex; justify-content: center;">${getIconSvg('sound-wave', { size: 14 })}</span>`
      : `<span style="color: var(--color-text-muted); font-size: 11px; font-weight: 500;">${index + 1}</span>`;

    row.innerHTML = `
      <div style="text-align: center; display: flex; align-items: center; justify-content: center;">
        ${indexOrPlaying}
      </div>

      <div class="queue-row-art" style="width: 38px; height: 38px; border-radius: var(--radius-md); background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
        <span style="color: var(--color-text-muted); display: flex;">${getIconSvg('music', { size: 16 })}</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
        <span style="font-size: var(--font-size-xs); font-weight: ${isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)'}; color: ${isActive ? '#ffffff' : 'var(--color-text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(track.title)}
        </span>
        <span style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
          ${escapeHtml(track.artistName ?? 'Unknown Artist')}
        </span>
      </div>

      <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); text-align: right; font-variant-numeric: tabular-nums;">
        ${durationStr}
      </div>

      <div style="display: flex; align-items: center; gap: 2px; justify-content: flex-end;">
        <button
          class="queue-move-up-btn"
          aria-label="Move track up"
          ${index === 0 ? 'disabled' : ''}
          style="min-width: 24px; min-height: 24px; background: transparent; border: none; cursor: ${index === 0 ? 'default' : 'pointer'}; color: ${index === 0 ? 'rgba(255,255,255,0.1)' : 'var(--color-text-muted)'}; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); padding: 0;"
        >
          ${getIconSvg('chevron-up', { size: 12 })}
        </button>
        <button
          class="queue-move-down-btn"
          aria-label="Move track down"
          ${index === totalCount - 1 ? 'disabled' : ''}
          style="min-width: 24px; min-height: 24px; background: transparent; border: none; cursor: ${index === totalCount - 1 ? 'default' : 'pointer'}; color: ${index === totalCount - 1 ? 'rgba(255,255,255,0.1)' : 'var(--color-text-muted)'}; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); padding: 0;"
        >
          ${getIconSvg('chevron-down', { size: 12 })}
        </button>
        <button
          class="queue-remove-btn"
          aria-label="Remove from queue"
          style="min-width: 24px; min-height: 24px; background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); padding: 0;"
        >
          ${getIconSvg('close', { size: 12 })}
        </button>
      </div>
    `;

    // Load thumbnail artwork
    const artBox = row.querySelector<HTMLElement>('.queue-row-art');
    const artId = (track as any).artworkId || track.albumId;
    if (artBox && artworkService && artId) {
      void artworkService.getArtworkUrl(artId, 'small').then(url => {
        if (url && artBox) {
          artBox.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`;
        }
      });
    }

    // Hover effect
    row.addEventListener('mouseenter', () => {
      if (!isActive) {
        row.style.background = 'var(--glass-bg-subtle-hover)';
      }
    });
    row.addEventListener('mouseleave', () => {
      if (!isActive) {
        row.style.background = 'rgba(255, 255, 255, 0.02)';
      }
    });

    // Play action on click
    row.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target.closest('.queue-remove-btn') || target.closest('.queue-move-up-btn') || target.closest('.queue-move-down-btn')) return;
      callbacks.onPlay?.(index);
    });

    // Keyboard navigation
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onPlay?.(index);
      }
    });

    // Button actions
    row.querySelector('.queue-move-up-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onMoveUp?.(index);
    });

    row.querySelector('.queue-move-down-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onMoveDown?.(index);
    });

    row.querySelector('.queue-remove-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onRemove?.(index);
    });

    return row;
  }

  private static formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
