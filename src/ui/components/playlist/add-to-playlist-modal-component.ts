import type { IPlaylistService } from '../../../services/contracts/service-contracts';
import type { EntityId } from '../../../domain/value-objects/audio-types';

export interface AddToPlaylistModalOptions {
  trackIds: readonly EntityId[];
  playlistService: IPlaylistService;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export class AddToPlaylistModalComponent {
  public static async show(options: AddToPlaylistModalOptions): Promise<HTMLElement> {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';
    overlay.style.padding = 'var(--space-4)';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'add-playlist-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '420px';
    modal.style.borderRadius = 'var(--radius-xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.5)';
    modal.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    modal.style.background = 'var(--color-bg-surface)';

    const countText = options.trackIds.length === 1 ? '1 track' : `${options.trackIds.length} tracks`;

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
        <div>
          <h2 id="add-playlist-modal-title" style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
            Add to Playlist
          </h2>
          <span style="font-size: 12px; color: var(--color-text-muted);">
            Adding ${countText}
          </span>
        </div>
        <button
          class="modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; font-size: 20px; color: var(--color-text-muted); cursor: pointer; padding: 4px;"
        >
          ✕
        </button>
      </div>

      <div class="new-playlist-quick-wrap" style="margin-bottom: var(--space-4); display: flex; gap: var(--space-2);">
        <input
          type="text"
          class="new-pl-inline-input"
          placeholder="New playlist name..."
          style="flex: 1; padding: var(--space-2) var(--space-3); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 13px; outline: none;"
        />
        <button
          type="button"
          class="create-add-btn"
          style="padding: var(--space-2) var(--space-3); background: var(--color-accent-primary); border: none; border-radius: var(--radius-md); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;"
        >
          + Create & Add
        </button>
      </div>

      <div style="font-size: 12px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: var(--space-2);">
        Select Existing Playlist:
      </div>

      <div class="playlist-list-container" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-4);">
        <div style="text-align: center; padding: var(--space-4); color: var(--color-text-muted); font-size: 13px;">
          Loading playlists...
        </div>
      </div>

      <div class="modal-msg" style="font-size: 12px; color: #ff5555; display: none; margin-bottom: var(--space-3);"></div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      if (options.onCancel) options.onCancel();
    };

    modal.querySelector('.modal-close-btn')?.addEventListener('click', close);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    const msgEl = modal.querySelector<HTMLElement>('.modal-msg');
    const inlineInput = modal.querySelector<HTMLInputElement>('.new-pl-inline-input');
    const createBtn = modal.querySelector<HTMLButtonElement>('.create-add-btn');
    const listContainer = modal.querySelector<HTMLElement>('.playlist-list-container');

    // Load playlists
    const paginated = await options.playlistService.listPlaylists({ offset: 0, limit: 100 });
    if (listContainer) {
      if (paginated.items.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: var(--space-4); color: var(--color-text-muted); font-size: 13px;">
            No playlists yet. Enter a name above to create one.
          </div>
        `;
      } else {
        listContainer.innerHTML = '';
        for (const pl of paginated.items) {
          const itemBtn = document.createElement('button');
          itemBtn.className = 'playlist-select-item';
          itemBtn.style.display = 'flex';
          itemBtn.style.alignItems = 'center';
          itemBtn.style.justifyContent = 'space-between';
          itemBtn.style.width = '100%';
          itemBtn.style.padding = 'var(--space-2) var(--space-3)';
          itemBtn.style.background = 'rgba(255, 255, 255, 0.03)';
          itemBtn.style.border = '1px solid rgba(255, 255, 255, 0.06)';
          itemBtn.style.borderRadius = 'var(--radius-md)';
          itemBtn.style.color = 'var(--color-text-primary)';
          itemBtn.style.fontSize = '13px';
          itemBtn.style.textAlign = 'left';
          itemBtn.style.cursor = 'pointer';
          itemBtn.style.transition = 'all 0.15s ease';

          itemBtn.innerHTML = `
            <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pl.name}</span>
            <span style="font-size: 11px; color: var(--color-text-muted);">${pl.trackCount} ${pl.trackCount === 1 ? 'song' : 'songs'}</span>
          `;

          itemBtn.addEventListener('mouseenter', () => {
            itemBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            itemBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          });
          itemBtn.addEventListener('mouseleave', () => {
            itemBtn.style.background = 'rgba(255, 255, 255, 0.03)';
            itemBtn.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          });

          itemBtn.addEventListener('click', async () => {
            try {
              await options.playlistService.addTracksToPlaylist(pl.id, options.trackIds);
              overlay.remove();
              if (options.onSuccess) options.onSuccess();
            } catch (err: any) {
              if (msgEl) {
                msgEl.textContent = err.message || 'Failed to add tracks to playlist.';
                msgEl.style.display = 'block';
              }
            }
          });

          listContainer.appendChild(itemBtn);
        }
      }
    }

    // Create & Add action
    createBtn?.addEventListener('click', async () => {
      const name = inlineInput?.value.trim() ?? '';
      if (!name) {
        if (msgEl) {
          msgEl.textContent = 'Please enter a playlist name.';
          msgEl.style.display = 'block';
        }
        inlineInput?.focus();
        return;
      }

      try {
        const newPl = await options.playlistService.createPlaylist(name);
        await options.playlistService.addTracksToPlaylist(newPl.id, options.trackIds);
        overlay.remove();
        if (options.onSuccess) options.onSuccess();
      } catch (err: any) {
        if (msgEl) {
          msgEl.textContent = err.message || 'Failed to create and add tracks.';
          msgEl.style.display = 'block';
        }
      }
    });

    return overlay;
  }
}
