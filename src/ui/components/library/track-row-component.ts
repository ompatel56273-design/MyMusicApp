import type { Track } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface TrackRowCallbacks {
  onPlay: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
  onPlayNext?: ((track: Track) => void) | undefined;
  onAddToQueue?: ((track: Track) => void) | undefined;
  onAddToPlaylist?: ((track: Track) => void) | undefined;
}

export class TrackRowComponent {
  public static create(
    track: Track,
    index: number,
    callbacks: TrackRowCallbacks,
    artworkService?: IArtworkService
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `track-row ${track.availability === 'missing' ? 'track-missing' : ''}`;
    row.setAttribute('role', 'row');
    row.setAttribute('tabindex', '0');
    row.setAttribute('data-track-id', track.id);
    row.setAttribute('aria-label', `${track.title} by ${track.artistName ?? 'Unknown Artist'}`);

    const isMissing = track.availability === 'missing';
    const durationStr = TrackRowComponent.formatDuration(track.durationMs);
    const formatBadge = TrackRowComponent.formatBadge(track);

    row.style.display = 'grid';
    row.style.gridTemplateColumns = '36px 40px 1fr 1fr 1fr 70px 60px 40px';
    row.style.alignItems = 'center';
    row.style.gap = 'var(--space-3)';
    row.style.padding = 'var(--space-2) var(--space-4)';
    row.style.height = '56px';
    row.style.boxSizing = 'border-box';
    row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.04)';
    row.style.borderRadius = 'var(--radius-sm)';
    row.style.cursor = isMissing ? 'not-allowed' : 'pointer';
    row.style.opacity = isMissing ? '0.45' : '1';
    row.style.transition = 'background-color 0.15s ease';

    row.innerHTML = `
      <div style="font-size: 12px; color: var(--color-text-muted); text-align: center;">
        ${track.trackNumber ?? index + 1}
      </div>

      <div class="track-row-art" style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--color-bg-surface-elevated); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
        <span style="font-size: 14px; color: var(--color-text-muted);">♫</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden;">
        <span class="track-title-text" title="${escapeHtml(track.title)}" style="font-size: 13px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(track.title)}
        </span>
      </div>

      <div title="${escapeHtml(track.artistName ?? 'Unknown Artist')}" style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${escapeHtml(track.artistName ?? 'Unknown Artist')}
      </div>

      <div title="${escapeHtml(track.albumTitle ?? 'Unknown Album')}" style="font-size: 12px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${escapeHtml(track.albumTitle ?? 'Unknown Album')}
      </div>

      <div>
        ${formatBadge}
      </div>

      <div style="font-size: 12px; color: var(--color-text-muted); text-align: right; font-variant-numeric: tabular-nums;">
        ${durationStr}
      </div>

      <div style="display: flex; justify-content: center; align-items: center; gap: 4px;">
        ${callbacks.onAddToPlaylist ? `
        <button
          class="track-add-playlist-btn"
          aria-label="Add ${escapeHtml(track.title)} to playlist"
          title="Add to playlist"
          style="background: transparent; border: none; font-size: 14px; cursor: pointer; color: var(--color-text-muted); padding: 2px; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;"
        >
          <span aria-hidden="true">+</span>
        </button>
        ` : ''}
        <button
          class="track-fav-btn"
          aria-label="${track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
          aria-pressed="${track.isFavorite}"
          style="background: transparent; border: none; font-size: 14px; cursor: pointer; color: ${track.isFavorite ? 'var(--color-accent-primary)' : 'var(--color-text-muted)'}; padding: 2px; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;"
        >
          <span aria-hidden="true">${track.isFavorite ? '★' : '☆'}</span>
        </button>
      </div>
    `;

    // Artwork resolution
    const artBox = row.querySelector('.track-row-art');
    const artId = (track as any).artworkId || track.albumId;
    if (artBox && artworkService && artId) {
      void artworkService.getArtworkUrl(artId, 'small').then(url => {
        if (url && artBox) {
          artBox.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }

    // Row interaction events
    if (!isMissing) {
      row.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        if (target && (target.closest('.track-fav-btn') || target.closest('.track-add-playlist-btn'))) return;
        callbacks.onPlay(track);
      });

      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          callbacks.onPlay(track);
        }
      });
    }

    const favBtn = row.querySelector('.track-fav-btn');
    favBtn?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onToggleFavorite(track);
    });

    const addPlBtn = row.querySelector('.track-add-playlist-btn');
    addPlBtn?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onAddToPlaylist?.(track);
    });

    return row;
  }

  public static formatDuration(ms?: number): string {
    if (!ms || isNaN(ms) || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }

  public static formatBadge(track: Track): string {
    if (!track.format) return '';
    const container = track.format.container ? track.format.container.toUpperCase() : '';
    const isLossless = track.format.isLossless;
    const isHiRes = track.format.sampleRate && track.format.sampleRate > 48000;

    let badgeText = container || (isLossless ? 'LOSSLESS' : 'AUDIO');
    if (isHiRes && track.format.bitDepth) {
      badgeText = `${track.format.bitDepth}b/${Math.round((track.format.sampleRate ?? 0) / 1000)}k`;
    }

    const color = isLossless ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
    const bg = isLossless ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.06)';

    return `
      <span style="
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: ${color};
        background: ${bg};
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        white-space: nowrap;
      ">
        ${badgeText}
      </span>
    `;
  }
}
