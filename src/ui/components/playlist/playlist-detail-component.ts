import type {
  PlaylistWithTracks,
  PlaylistTrackItem,
  IPlaylistService,
  IPlaybackManager,
  IArtworkService
} from '../../../services/contracts/service-contracts';
import type { Track } from '../../../domain/entities/models';
import { PlaylistModalComponent } from './playlist-modal-component';
import { TrackRowComponent } from '../library/track-row-component';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface PlaylistDetailCallbacks {
  onBack: () => void;
  onRefresh: () => void;
  onToggleFavorite?: (track: Track) => void;
}

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

    const totalDurationStr = PlaylistDetailComponent.formatTotalDuration(playlist.durationMs);
    const availableTracks = items.filter(i => i.track.availability !== 'missing').map(i => i.track);

    // Header section
    const header = document.createElement('header');
    header.className = 'playlist-detail-header glass-panel';
    header.style.display = 'flex';
    header.style.flexWrap = 'wrap';
    header.style.gap = 'var(--space-6)';
    header.style.alignItems = 'center';
    header.style.padding = 'var(--space-6)';
    header.style.borderRadius = 'var(--radius-xl)';
    header.style.background = 'linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.7) 100%)';
    header.style.border = '1px solid var(--glass-border)';
    header.style.backdropFilter = 'blur(16px)';
    header.style.position = 'relative';
    header.style.overflow = 'hidden';

    header.innerHTML = `
      <div style="position: absolute; right: -30px; top: -30px; width: 220px; height: 220px; background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%); pointer-events: none; border-radius: 50%;"></div>
      
      <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2); z-index: 1;">
        <button
          class="playlist-back-btn"
          aria-label="Back to Playlists"
          style="display: inline-flex; align-items: center; gap: var(--space-2); background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); padding: 8px 16px; border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; min-height: 38px;"
        >
          ← Back to Playlists
        </button>
      </div>

      <div class="playlist-detail-art" style="width: 150px; height: 150px; border-radius: var(--radius-xl); overflow: hidden; background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-glow-purple); border: 1px solid rgba(255, 255, 255, 0.1); z-index: 1;">
        <span style="font-size: 54px; color: var(--color-purple-neon);">📑</span>
      </div>

      <div style="flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: var(--space-2); z-index: 1;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-purple-neon);">
          Playlist
        </span>
        <h1 style="font-size: clamp(24px, 4vw, 36px); font-weight: 800; color: var(--color-text-primary); margin: 0; letter-spacing: -0.02em; line-height: 1.2;">
          ${escapeHtml(playlist.name)}
        </h1>
        ${playlist.description ? `<p style="font-size: 14px; color: var(--color-text-secondary); margin: 0;">${escapeHtml(playlist.description)}</p>` : ''}
        
        <div style="display: flex; gap: var(--space-4); align-items: center; font-size: 13px; color: var(--color-text-muted); margin-top: var(--space-1);">
          <span style="font-weight: 600; color: var(--color-text-primary);">${playlist.trackCount} ${playlist.trackCount === 1 ? 'song' : 'songs'}</span>
          <span>•</span>
          <span>${totalDurationStr}</span>
        </div>

        <div class="playlist-action-bar" style="display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-3); align-items: center;">
          <button
            class="pl-play-all-btn btn-primary"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); border: none; border-radius: var(--radius-full); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: var(--shadow-glow-purple); min-height: 44px; transition: all 0.15s ease;"
          >
            <span>▶</span> Play
          </button>

          <button
            class="pl-shuffle-all-btn"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: 13px; font-weight: 600; cursor: pointer; min-height: 44px; transition: all 0.15s ease;"
          >
            🔀 Shuffle
          </button>

          <button
            class="pl-queue-all-btn"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: 13px; font-weight: 600; cursor: pointer; min-height: 44px; transition: all 0.15s ease;"
          >
            + Queue
          </button>

          <button
            class="pl-edit-btn"
            style="padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; min-height: 44px;"
          >
            Edit
          </button>

          <button
            class="pl-delete-btn"
            style="padding: 10px 18px; background: transparent; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-full); color: var(--color-status-error); font-size: 13px; font-weight: 600; cursor: pointer; min-height: 44px;"
          >
            Delete
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
        void services.playbackManager.addToQueue(availableTracks, false);
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
      const confirmDel = window.confirm(`Are you sure you want to delete playlist "${playlist.name}"?`);
      if (confirmDel) {
        await services.playlistService.deletePlaylist(playlist.id);
        callbacks.onBack();
      }
    });

    detailWrapper.appendChild(header);

    // Track table container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'playlist-track-table glass-panel';
    tableContainer.style.padding = 'var(--space-4)';
    tableContainer.style.borderRadius = 'var(--radius-lg)';
    tableContainer.style.display = 'flex';
    tableContainer.style.flexDirection = 'column';
    tableContainer.style.gap = 'var(--space-1)';

    if (items.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-8); color: var(--color-text-muted);">
          <p style="font-size: 15px; margin-bottom: var(--space-2);">This playlist has no songs yet.</p>
          <p style="font-size: 13px; color: var(--color-text-secondary);">Add songs from your Songs or Albums view.</p>
        </div>
      `;
    } else {
      // Column Header
      const colHeader = document.createElement('div');
      colHeader.style.display = 'grid';
      colHeader.style.gridTemplateColumns = '36px 40px 1fr 1fr 1fr 70px 60px 80px';
      colHeader.style.gap = 'var(--space-3)';
      colHeader.style.padding = 'var(--space-2) var(--space-4)';
      colHeader.style.fontSize = '12px';
      colHeader.style.fontWeight = '600';
      colHeader.style.color = 'var(--color-text-muted)';
      colHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
      colHeader.style.marginBottom = 'var(--space-2)';

      colHeader.innerHTML = `
        <div style="text-align: center;">#</div>
        <div></div>
        <div>TITLE</div>
        <div>ARTIST</div>
        <div>ALBUM</div>
        <div>FORMAT</div>
        <div style="text-align: right;">TIME</div>
        <div style="text-align: center;">ACTIONS</div>
      `;
      tableContainer.appendChild(colHeader);

      items.forEach((trackItem: PlaylistTrackItem, index: number) => {
        const row = PlaylistDetailComponent.createTrackRow(
          trackItem,
          index,
          items.length,
          playlist.id,
          availableTracks,
          services,
          callbacks
        );
        tableContainer.appendChild(row);
      });
    }

    detailWrapper.appendChild(tableContainer);
    container.appendChild(detailWrapper);
  }

  private static createTrackRow(
    trackItem: PlaylistTrackItem,
    index: number,
    totalCount: number,
    playlistId: string,
    availableTracks: readonly Track[],
    services: {
      playlistService: IPlaylistService;
      playbackManager: IPlaybackManager;
      artworkService?: IArtworkService | undefined;
    },
    callbacks: PlaylistDetailCallbacks
  ): HTMLElement {
    const { item, track } = trackItem;
    const isMissing = track.availability === 'missing';
    const durationStr = TrackRowComponent.formatDuration(track.durationMs);
    const formatBadge = TrackRowComponent.formatBadge(track);

    const row = document.createElement('div');
    row.className = `playlist-track-row ${isMissing ? 'track-missing' : ''}`;
    row.setAttribute('role', 'row');
    row.setAttribute('tabindex', '0');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '36px 40px 1fr 1fr 1fr 70px 60px 80px';
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
        ${index + 1}
      </div>

      <div class="track-row-art" style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--color-bg-surface-elevated); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
        <span style="font-size: 14px; color: var(--color-text-muted);">♫</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden;">
        <span class="track-title-text" style="font-size: 13px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${track.title}
        </span>
      </div>

      <div style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${track.artistName ?? 'Unknown Artist'}
      </div>

      <div style="font-size: 12px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${track.albumTitle ?? 'Unknown Album'}
      </div>

      <div>
        ${formatBadge}
      </div>

      <div style="font-size: 12px; color: var(--color-text-muted); text-align: right; font-variant-numeric: tabular-nums;">
        ${durationStr}
      </div>

      <div style="display: flex; justify-content: center; align-items: center; gap: 2px;">
        <button
          class="pl-move-up-btn"
          aria-label="Move up"
          ${index === 0 ? 'disabled style="opacity: 0.3; cursor: default;"' : 'style="cursor: pointer;"'}
          style="background: transparent; border: none; font-size: 12px; color: var(--color-text-muted); padding: 2px 4px;"
        >
          ▲
        </button>

        <button
          class="pl-move-down-btn"
          aria-label="Move down"
          ${index === totalCount - 1 ? 'disabled style="opacity: 0.3; cursor: default;"' : 'style="cursor: pointer;"'}
          style="background: transparent; border: none; font-size: 12px; color: var(--color-text-muted); padding: 2px 4px;"
        >
          ▼
        </button>

        <button
          class="pl-remove-item-btn"
          aria-label="Remove from playlist"
          style="background: transparent; border: none; font-size: 13px; color: #ff6666; cursor: pointer; padding: 2px 4px; margin-left: 2px;"
        >
          ✕
        </button>
      </div>
    `;

    // Row hover
    row.addEventListener('mouseenter', () => {
      row.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.backgroundColor = 'transparent';
    });

    // Artwork resolution
    const artBox = row.querySelector<HTMLElement>('.track-row-art');
    const artId = (track as any).artworkId || track.albumId;
    if (artBox && services.artworkService && artId) {
      void services.artworkService.getArtworkUrl(artId, 'small').then(url => {
        if (url && artBox) {
          artBox.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }

    // Row click (play track in context of available playlist tracks)
    if (!isMissing) {
      row.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        if (target.closest('.pl-move-up-btn') || target.closest('.pl-move-down-btn') || target.closest('.pl-remove-item-btn')) {
          return;
        }
        void services.playbackManager.playTrack(track, availableTracks);
      });
    }

    // Move Up button
    const moveUpBtn = row.querySelector('.pl-move-up-btn');
    if (moveUpBtn && index > 0) {
      moveUpBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await services.playlistService.reorderPlaylistItems(playlistId, index, index - 1);
        callbacks.onRefresh();
      });
    }

    // Move Down button
    const moveDownBtn = row.querySelector('.pl-move-down-btn');
    if (moveDownBtn && index < totalCount - 1) {
      moveDownBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await services.playlistService.reorderPlaylistItems(playlistId, index, index + 1);
        callbacks.onRefresh();
      });
    }

    // Remove item button
    const removeBtn = row.querySelector('.pl-remove-item-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await services.playlistService.removeTrackFromPlaylist(playlistId, item.id);
        callbacks.onRefresh();
      });
    }

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
}
