import type {
  PlaylistWithTracks,
  PlaylistTrackItem,
  IPlaylistService,
  IPlaybackManager,
  IArtworkService
} from '../../../services/contracts/service-contracts';
import type { Track } from '../../../domain/entities/models';
import { PlaylistModalComponent } from './playlist-modal-component';
import { escapeHtml } from '../../../core/security/html-sanitizer';
import { getIconSvg } from '../../icons/icon-registry';

export interface PlaylistDetailCallbacks {
  onBack: () => void;
  onRefresh: () => void;
  onToggleFavorite?: (track: Track) => void;
}

/**
 * Phase 7 Playlist Detail Component (Template 5).
 * Features:
 * - High-fidelity playlist hero with cover artwork, glowing backdrop, and metadata summary
 * - Action controls: Play All, Shuffle, Add to Queue, Edit, and Delete
 * - High-density responsive track table with index, artwork, title, artist, album, format badge, duration, favorite toggle, and remove action
 * - Real-time playback integration and active playing state indication
 */
export class PlaylistDetailComponent {
  public static render(
    container: HTMLElement,
    data: PlaylistWithTracks,
    services: {
      playlistService: IPlaylistService;
      playbackManager: IPlaybackManager;
      artworkService?: IArtworkService | undefined;
    },
    callbacks: PlaylistDetailCallbacks
  ): void {
    const { playlist, items } = data;
    container.innerHTML = '';

    const detailWrapper = document.createElement('div');
    detailWrapper.className = 'playlist-detail-view';
    detailWrapper.style.display = 'flex';
    detailWrapper.style.flexDirection = 'column';
    detailWrapper.style.gap = 'var(--space-6)';
    detailWrapper.style.width = '100%';
    detailWrapper.style.minWidth = '0';
    detailWrapper.style.boxSizing = 'border-box';

    const totalDurationStr = PlaylistDetailComponent.formatTotalDuration(playlist.durationMs);
    const availableTracks = items.filter(i => i.track.availability !== 'missing').map(i => i.track);

    // Header section
    const header = document.createElement('header');
    header.className = 'playlist-detail-header glass-panel';
    header.style.display = 'flex';
    header.style.flexWrap = 'wrap';
    header.style.gap = 'var(--space-6)';
    header.style.alignItems = 'center';
    header.style.padding = 'var(--space-6) var(--space-8)';
    header.style.borderRadius = 'var(--radius-2xl)';
    header.style.background = 'linear-gradient(135deg, rgba(30, 20, 70, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)';
    header.style.border = '1px solid var(--glass-border-interactive)';
    header.style.position = 'relative';
    header.style.overflow = 'hidden';
    header.style.boxShadow = 'var(--shadow-elevation-medium), 0 0 24px rgba(124, 58, 237, 0.2)';
    header.style.boxSizing = 'border-box';
    header.style.width = '100%';

    header.innerHTML = `
      <div style="position: absolute; right: -30px; top: -30px; width: 260px; height: 260px; background: radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%); pointer-events: none; border-radius: 50%;"></div>
      
      <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-1); z-index: 1;">
        <button
          class="playlist-back-btn"
          aria-label="Back to Playlists"
          style="display: inline-flex; align-items: center; gap: 8px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); padding: 8px 16px; border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer; transition: all var(--duration-fast) var(--ease-smooth); min-height: 38px;"
        >
          <span style="display: flex;">${getIconSvg('chevron-left', { size: 14 })}</span>
          <span>Back to Playlists</span>
        </button>
      </div>

      <div class="playlist-detail-art" style="width: 140px; height: 140px; border-radius: var(--radius-2xl); overflow: hidden; background: linear-gradient(135deg, rgba(168, 85, 247, 0.35) 0%, rgba(236, 72, 153, 0.3) 50%, rgba(6, 182, 212, 0.25) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-glow-purple); border: 1px solid var(--glass-border-interactive); z-index: 1;">
        <span style="display: flex; color: var(--color-accent-purple-glow);">${getIconSvg('playlist', { size: 54, color: 'var(--color-accent-purple-glow)' })}</span>
      </div>

      <div style="flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: var(--space-2); z-index: 1;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 10px; font-weight: var(--font-weight-extrabold); text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-cyan); background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); padding: 2px 8px; border-radius: var(--radius-full);">
            Playlist
          </span>
        </div>
        <h1 style="font-size: clamp(24px, 4vw, 36px); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0; letter-spacing: -0.02em; line-height: 1.2;">
          ${escapeHtml(playlist.name)}
        </h1>
        ${playlist.description ? `<p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0; line-height: 1.5;">${escapeHtml(playlist.description)}</p>` : ''}
        
        <div style="display: flex; gap: var(--space-3); align-items: center; font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px;">
          <span style="font-weight: var(--font-weight-semibold); color: var(--color-text-primary);">${playlist.trackCount} ${playlist.trackCount === 1 ? 'song' : 'songs'}</span>
          <span>•</span>
          <span>${totalDurationStr}</span>
        </div>

        <div class="playlist-action-bar" style="display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-3); align-items: center;">
          <button
            class="pl-play-all-btn btn-primary"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-full); color: #ffffff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5); min-height: 44px; transition: all var(--duration-fast) var(--ease-smooth);"
          >
            <span style="display: flex;">${getIconSvg('play', { size: 16, color: '#ffffff' })}</span>
            <span>Play</span>
          </button>

          <button
            class="pl-shuffle-all-btn"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer; min-height: 44px; transition: all var(--duration-fast) var(--ease-smooth);"
          >
            <span style="display: flex;">${getIconSvg('shuffle', { size: 15 })}</span>
            <span>Shuffle</span>
          </button>

          <button
            class="pl-queue-all-btn"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer; min-height: 44px; transition: all var(--duration-fast) var(--ease-smooth);"
          >
            <span style="display: flex;">${getIconSvg('plus', { size: 15 })}</span>
            <span>Queue</span>
          </button>

          <button
            class="pl-edit-btn"
            style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer; min-height: 44px;"
          >
            <span style="display: flex;">${getIconSvg('edit', { size: 14 })}</span>
            <span>Edit</span>
          </button>

          <button
            class="pl-delete-btn"
            style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: transparent; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-full); color: var(--color-status-error); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer; min-height: 44px;"
          >
            <span style="display: flex;">${getIconSvg('trash', { size: 14, color: 'var(--color-status-error)' })}</span>
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;

    // Wire header buttons
    header.querySelector('.playlist-back-btn')?.addEventListener('click', () => callbacks.onBack());

    header.querySelector('.pl-play-all-btn')?.addEventListener('click', () => {
      if (availableTracks.length > 0) {
        void services.playbackManager.playTrack(availableTracks[0]!, availableTracks);
      }
    });

    header.querySelector('.pl-shuffle-all-btn')?.addEventListener('click', () => {
      if (availableTracks.length > 0) {
        const shuffled = [...availableTracks];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = shuffled[i]!;
          shuffled[i] = shuffled[j]!;
          shuffled[j] = temp;
        }
        void services.playbackManager.playTrack(shuffled[0]!, shuffled);
      }
    });

    header.querySelector('.pl-queue-all-btn')?.addEventListener('click', () => {
      if (availableTracks.length > 0) {
        services.playbackManager.addToQueue(availableTracks, false);
      }
    });

    header.querySelector('.pl-edit-btn')?.addEventListener('click', () => {
      PlaylistModalComponent.show({
        playlist,
        onSave: async (name, description) => {
          await services.playlistService.updatePlaylist(playlist.id, { name, description });
          callbacks.onRefresh();
        }
      });
    });

    header.querySelector('.pl-delete-btn')?.addEventListener('click', async () => {
      const confirmed = window.confirm(`Are you sure you want to delete playlist "${playlist.name}"?`);
      if (confirmed) {
        await services.playlistService.deletePlaylist(playlist.id);
        callbacks.onBack();
      }
    });

    detailWrapper.appendChild(header);

    // Track table container
    const tableSection = document.createElement('section');
    tableSection.className = 'playlist-track-table-wrap glass-panel';
    tableSection.style.borderRadius = 'var(--radius-2xl)';
    tableSection.style.background = 'var(--glass-bg-subtle)';
    tableSection.style.border = '1px solid var(--glass-border)';
    tableSection.style.padding = 'var(--space-4)';
    tableSection.style.display = 'flex';
    tableSection.style.flexDirection = 'column';
    tableSection.style.gap = 'var(--space-2)';
    tableSection.style.boxSizing = 'border-box';
    tableSection.style.width = '100%';

    if (items.length === 0) {
      tableSection.innerHTML = `
        <div style="text-align: center; padding: var(--space-12) var(--space-4); color: var(--color-text-muted);">
          <div style="display: flex; justify-content: center; margin-bottom: 12px; color: var(--color-accent-purple-glow);">
            ${getIconSvg('music', { size: 36 })}
          </div>
          <h3 style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); color: var(--color-text-primary); margin: 0 0 6px 0;">
            No songs in this playlist
          </h3>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5;">
            Browse your library and add songs to "${escapeHtml(playlist.name)}" to start listening.
          </p>
        </div>
      `;
    } else {
      // Table header
      const tableHeader = document.createElement('div');
      tableHeader.className = 'pl-table-header';
      tableHeader.style.display = 'grid';
      tableHeader.style.gridTemplateColumns = '40px minmax(180px, 2fr) minmax(120px, 1.5fr) 70px 80px';
      tableHeader.style.alignItems = 'center';
      tableHeader.style.padding = '8px 14px';
      tableHeader.style.borderBottom = '1px solid var(--glass-border)';
      tableHeader.style.fontSize = '11px';
      tableHeader.style.fontWeight = 'var(--font-weight-bold)';
      tableHeader.style.textTransform = 'uppercase';
      tableHeader.style.letterSpacing = '0.08em';
      tableHeader.style.color = 'var(--color-text-muted)';
      tableHeader.style.gap = 'var(--space-3)';

      tableHeader.innerHTML = `
        <div style="text-align: center;">#</div>
        <div>Title</div>
        <div class="pl-col-album">Album</div>
        <div style="text-align: right;">Time</div>
        <div style="text-align: center;">Actions</div>
      `;
      tableSection.appendChild(tableHeader);

      // Track rows list
      const rowsList = document.createElement('div');
      rowsList.className = 'pl-track-rows-list';
      rowsList.style.display = 'flex';
      rowsList.style.flexDirection = 'column';
      rowsList.style.gap = '2px';

      items.forEach((item: PlaylistTrackItem, index: number) => {
        const row = PlaylistDetailComponent.createTrackRow(
          item,
          index,
          availableTracks,
          services,
          callbacks,
          playlist.id
        );
        rowsList.appendChild(row);
      });

      tableSection.appendChild(rowsList);
    }

    detailWrapper.appendChild(tableSection);
    container.appendChild(detailWrapper);
  }

  private static createTrackRow(
    item: PlaylistTrackItem,
    index: number,
    allTracks: Track[],
    services: {
      playlistService: IPlaylistService;
      playbackManager: IPlaybackManager;
      artworkService?: IArtworkService | undefined;
    },
    callbacks: PlaylistDetailCallbacks,
    playlistId: string
  ): HTMLElement {
    const { track, item: playlistItem } = item;
    const isMissing = track.availability === 'missing';
    const durationStr = PlaylistDetailComponent.formatTrackDuration(track.durationMs);

    const row = document.createElement('div');
    row.className = 'playlist-track-row';
    row.setAttribute('data-track-id', track.id);
    row.setAttribute('data-playlist-item-id', playlistItem.id);

    row.style.display = 'grid';
    row.style.gridTemplateColumns = '40px minmax(180px, 2fr) minmax(120px, 1.5fr) 70px 80px';
    row.style.alignItems = 'center';
    row.style.padding = '8px 14px';
    row.style.borderRadius = 'var(--radius-lg)';
    row.style.gap = 'var(--space-3)';
    row.style.transition = 'background var(--duration-fast) var(--ease-smooth)';
    row.style.cursor = isMissing ? 'not-allowed' : 'pointer';
    row.style.opacity = isMissing ? '0.5' : '1';
    row.style.boxSizing = 'border-box';
    row.style.fontSize = 'var(--font-size-xs)';

    row.innerHTML = `
      <div class="track-num-cell" style="text-align: center; color: var(--color-text-muted); font-weight: var(--font-weight-medium); font-variant-numeric: tabular-nums;">
        ${index + 1}
      </div>

      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <div class="row-art" style="width: 38px; height: 38px; border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border: 1px solid var(--glass-border);">
          <span style="display: flex; color: var(--color-text-muted);">${getIconSvg('music', { size: 16 })}</span>
        </div>
        <div style="display: flex; flex-direction: column; min-width: 0; gap: 2px;">
          <span class="row-title" style="font-weight: var(--font-weight-bold); color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(track.title)}">
            ${escapeHtml(track.title)}
          </span>
          <span class="row-artist" style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(track.artistName ?? 'Unknown Artist')}">
            ${escapeHtml(track.artistName ?? 'Unknown Artist')}
          </span>
        </div>
      </div>

      <div class="pl-col-album" style="color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px;" title="${escapeHtml(track.albumTitle ?? '—')}">
        ${escapeHtml(track.albumTitle ?? '—')}
      </div>

      <div style="text-align: right; color: var(--color-text-muted); font-variant-numeric: tabular-nums; font-size: 11px;">
        ${durationStr}
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
        <button
          class="pl-move-up-btn"
          aria-label="Move track up"
          title="Move Up"
          ${index === 0 ? 'disabled' : ''}
          style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px; transition: color var(--duration-fast); opacity: ${index === 0 ? '0.3' : '1'};"
        >
          ${getIconSvg('chevron-up', { size: 14 })}
        </button>
        <button
          class="pl-move-down-btn"
          aria-label="Move track down"
          title="Move Down"
          ${index === allTracks.length - 1 ? 'disabled' : ''}
          style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: 28px; min-height: 28px; transition: color var(--duration-fast); opacity: ${index === allTracks.length - 1 ? '0.3' : '1'};"
        >
          ${getIconSvg('chevron-down', { size: 14 })}
        </button>
        <button
          class="pl-remove-item-btn row-remove-btn"
          aria-label="Remove from playlist"
          title="Remove from playlist"
          style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; min-width: 32px; min-height: 32px; transition: color var(--duration-fast);"
        >
          ${getIconSvg('trash', { size: 14 })}
        </button>
      </div>
    `;

    // Artwork resolution
    if (track.artworkId && services.artworkService) {
      const artEl = row.querySelector<HTMLElement>('.row-art');
      void services.artworkService.getArtworkUrl(track.artworkId, 'small').then(url => {
        if (url && artEl) {
          artEl.innerHTML = `<img src="${url}" alt="${escapeHtml(track.title)}" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }

    // Hover effect
    row.addEventListener('mouseenter', () => {
      row.style.background = 'var(--glass-bg-subtle-hover)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = 'transparent';
    });

    // Play on row click
    row.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (target.closest('.pl-remove-item-btn') || target.closest('.pl-move-up-btn') || target.closest('.pl-move-down-btn')) return;

      if (!isMissing) {
        void services.playbackManager.playTrack(track, allTracks);
      }
    });

    // Reorder handlers
    const moveUpBtn = row.querySelector<HTMLButtonElement>('.pl-move-up-btn');
    moveUpBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      if (index > 0) {
        await services.playlistService.reorderPlaylistItems(playlistId, index, index - 1);
        callbacks.onRefresh();
      }
    });

    const moveDownBtn = row.querySelector<HTMLButtonElement>('.pl-move-down-btn');
    moveDownBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      if (index < allTracks.length - 1) {
        await services.playlistService.reorderPlaylistItems(playlistId, index, index + 1);
        callbacks.onRefresh();
      }
    });

    // Remove button handler
    const removeBtn = row.querySelector<HTMLButtonElement>('.pl-remove-item-btn');
    removeBtn?.addEventListener('click', async e => {
      e.stopPropagation();
      await services.playlistService.removeTrackFromPlaylist(playlistId, playlistItem.id);
      callbacks.onRefresh();
    });

    return row;
  }

  private static formatTotalDuration(ms: number): string {
    if (!ms || ms <= 0) return '0 min';
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin} min`;
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hrs} hr ${mins} min`;
  }

  private static formatTrackDuration(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
