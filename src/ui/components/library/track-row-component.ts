import type { Track } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { escapeHtml } from '../../../core/security/html-sanitizer';
import { getIconSvg } from '../../icons/icon-registry';

export interface TrackRowCallbacks {
  onPlay: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
  onPlayNext?: ((track: Track) => void) | undefined;
  onAddToQueue?: ((track: Track) => void) | undefined;
  onAddToPlaylist?: ((track: Track) => void) | undefined;
  onInspect?: ((track: Track) => void) | undefined;
}

export class TrackRowComponent {
  public static create(
    track: Track,
    index: number,
    callbacks: TrackRowCallbacks,
    artworkService?: IArtworkService,
    isPlaying: boolean = false
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `track-row ${track.availability === 'missing' ? 'track-missing' : ''} ${isPlaying ? 'track-row-playing' : ''}`;
    row.setAttribute('role', 'row');
    row.setAttribute('tabindex', '0');
    row.setAttribute('data-track-id', track.id);
    row.setAttribute('aria-label', `${track.title} by ${track.artistName ?? 'Unknown Artist'}`);

    const isMissing = track.availability === 'missing';
    const durationStr = TrackRowComponent.formatDuration(track.durationMs);
    const formatBadge = TrackRowComponent.formatBadge(track);

    row.style.alignItems = 'center';
    row.style.height = '56px';
    row.style.boxSizing = 'border-box';
    row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.04)';
    row.style.borderRadius = 'var(--radius-md)';
    row.style.cursor = isMissing ? 'not-allowed' : 'pointer';
    row.style.opacity = isMissing ? '0.45' : '1';
    row.style.transition = 'all var(--duration-fast) var(--ease-smooth)';
    row.style.background = isPlaying ? 'rgba(124, 58, 237, 0.15)' : 'transparent';
    row.style.borderColor = isPlaying ? 'rgba(168, 85, 247, 0.35)' : 'transparent';

    row.innerHTML = `
      <div class="track-row-index" style="font-size: 12px; font-weight: 600; color: ${isPlaying ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)'}; text-align: center;">
        ${isPlaying ? `<span style="color: var(--color-accent-cyan); display: flex; justify-content: center;">${getIconSvg('audio-bars', { size: 14 })}</span>` : (track.trackNumber ?? index + 1)}
      </div>

      <div class="track-row-art" style="width: 38px; height: 38px; border-radius: var(--radius-sm); background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid var(--glass-border);">
        <span style="color: var(--color-accent-purple-glow);">${getIconSvg('music', { size: 18 })}</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
        <span class="track-title-text" title="${escapeHtml(track.title)}" style="font-size: 13px; font-weight: var(--font-weight-semibold); color: ${isPlaying ? 'var(--color-accent-cyan)' : 'var(--color-text-primary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
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

      <div style="font-size: 12px; color: var(--color-text-muted); text-align: right; font-variant-numeric: tabular-nums; font-weight: 500;">
        ${durationStr}
      </div>

      <div style="display: flex; justify-content: center; align-items: center; gap: 4px;">
        ${callbacks.onAddToPlaylist ? `
        <button
          class="track-add-playlist-btn"
          aria-label="Add ${escapeHtml(track.title)} to playlist"
          title="Add to playlist"
          style="background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-full); transition: all 0.15s ease;"
        >
          ${getIconSvg('plus', { size: 16 })}
        </button>
        ` : ''}
        <button
          class="track-fav-btn"
          aria-label="${track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
          aria-pressed="${track.isFavorite}"
          style="background: transparent; border: none; cursor: pointer; color: ${track.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)'}; padding: 4px; min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-full); transition: all 0.15s ease;"
        >
          ${getIconSvg(track.isFavorite ? 'heart-filled' : 'heart', { size: 18, color: track.isFavorite ? 'var(--color-accent-pink)' : 'currentColor' })}
        </button>
      </div>
    `;

    // Row hover effect
    row.addEventListener('mouseenter', () => {
      row.style.background = isPlaying ? 'rgba(124, 58, 237, 0.25)' : 'rgba(255, 255, 255, 0.04)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = isPlaying ? 'rgba(124, 58, 237, 0.15)' : 'transparent';
    });

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
        callbacks.onInspect?.(track);
      });

      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          callbacks.onPlay(track);
          callbacks.onInspect?.(track);
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

    const color = isLossless ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)';
    const bg = isLossless ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.06)';

    return `
      <span style="
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: ${color};
        background: ${bg};
        padding: 2px 7px;
        border-radius: var(--radius-sm);
        white-space: nowrap;
        border: 1px solid ${isLossless ? 'rgba(168, 85, 247, 0.3)' : 'transparent'};
      ">
        ${badgeText}
      </span>
    `;
  }
}
