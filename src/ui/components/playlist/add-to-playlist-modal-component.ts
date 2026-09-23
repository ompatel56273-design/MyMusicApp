import type { IPlaylistService } from '../../../services/contracts/service-contracts';
import type { EntityId } from '../../../domain/value-objects/audio-types';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface AddToPlaylistModalOptions {
  trackIds: readonly EntityId[];
  playlistService: IPlaylistService;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Phase 7 Add to Playlist Modal Component.
 * Allows quick selection of existing playlist or inline creation of a new playlist.
 */
export class AddToPlaylistModalComponent {
  public static async show(options: AddToPlaylistModalOptions): Promise<HTMLElement> {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(12px)';
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
    modal.style.maxWidth = '440px';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';

    const countText = options.trackIds.length === 1 ? '1 track' : `${options.trackIds.length} tracks`;

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('playlist', { size: 18 })}
            </span>
            <h2 id="add-playlist-modal-title" style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
              Add to Playlist
            </h2>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; display: block;">
            Adding ${countText}
          </span>
        </div>
        <button
          class="modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: color var(--duration-fast);"
        >
          ${getIconSvg('close', { size: 16 })}
        </button>
      </div>

      <div class="new-playlist-quick-wrap" style="margin-bottom: var(--space-4); display: flex; gap: var(--space-2);">
        <input
          type="text"
          class="new-pl-inline-input"
          placeholder="New playlist name..."
          style="flex: 1; padding: 10px 14px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: var(--font-size-xs); outline: none;"
        />
        <button
          type="button"
          class="create-add-btn"
          style="padding: 10px 16px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-md); color: #ffffff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px;"
        >
          <span>+ Create & Add</span>
        </button>
      </div>

      <div style="font-size: 11px; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-secondary); margin-bottom: var(--space-2);">
        Select Existing Playlist:
      </div>

      <div class="playlist-list-container" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4);">
        <div style="text-align: center; padding: var(--space-4); color: var(--color-text-muted); font-size: 13px;">
          Loading playlists...
        </div>
      </div>

      <div class="modal-msg" style="font-size: 12px; color: var(--color-status-error); display: none; margin-bottom: var(--space-3);"></div>
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
    const showMsg = (txt: string, isError = true) => {
      if (!msgEl) return;
      msgEl.textContent = txt;
      msgEl.style.color = isError ? 'var(--color-status-error)' : 'var(--color-accent-cyan)';
      msgEl.style.display = 'block';
    };

    // Load playlists list
    const listContainer = modal.querySelector<HTMLElement>('.playlist-list-container');
    try {
      const res = await options.playlistService.listPlaylists({ offset: 0, limit: 100 });
      const playlists = res.items;

      if (!listContainer) return overlay;

      if (playlists.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-xs);">
            No playlists found. Create one above!
          </div>
        `;
      } else {
        listContainer.innerHTML = '';
        playlists.forEach(p => {
          const itemBtn = document.createElement('button');
          itemBtn.className = 'pl-select-item-btn';
          itemBtn.style.display = 'flex';
          itemBtn.style.alignItems = 'center';
          itemBtn.style.justifyContent = 'space-between';
          itemBtn.style.width = '100%';
          itemBtn.style.padding = '10px 14px';
          itemBtn.style.background = 'var(--glass-bg-subtle)';
          itemBtn.style.border = '1px solid var(--glass-border)';
          itemBtn.style.borderRadius = 'var(--radius-lg)';
          itemBtn.style.color = '#ffffff';
          itemBtn.style.fontSize = 'var(--font-size-xs)';
          itemBtn.style.cursor = 'pointer';
          itemBtn.style.textAlign = 'left';
          itemBtn.style.transition = 'all var(--duration-fast)';

          itemBtn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-accent-purple-glow); display: flex;">${getIconSvg('playlist', { size: 16 })}</span>
              <span style="font-weight: var(--font-weight-semibold);">${escapeHtml(p.name)}</span>
            </div>
            <span style="font-size: 11px; color: var(--color-text-muted);">${p.trackCount} ${p.trackCount === 1 ? 'track' : 'tracks'}</span>
          `;

          itemBtn.addEventListener('mouseenter', () => {
            itemBtn.style.background = 'var(--glass-bg-subtle-hover)';
            itemBtn.style.borderColor = 'var(--glass-border-interactive)';
          });
          itemBtn.addEventListener('mouseleave', () => {
            itemBtn.style.background = 'var(--glass-bg-subtle)';
            itemBtn.style.borderColor = 'var(--glass-border)';
          });

          itemBtn.addEventListener('click', async () => {
            try {
              itemBtn.disabled = true;
              await options.playlistService.addTracksToPlaylist(p.id, options.trackIds);
              showMsg(`Added to "${p.name}"!`, false);
              setTimeout(() => {
                close();
                if (options.onSuccess) options.onSuccess();
              }, 500);
            } catch (err: any) {
              itemBtn.disabled = false;
              showMsg(err?.message || 'Failed to add tracks.');
            }
          });

          listContainer.appendChild(itemBtn);
        });
      }
    } catch (_e) {
      if (listContainer) {
        listContainer.innerHTML = `<div style="color: var(--color-status-error); padding: 8px; text-align: center;">Failed to load playlists.</div>`;
      }
    }

    // Inline create & add
    const inlineInput = modal.querySelector<HTMLInputElement>('.new-pl-inline-input');
    const inlineCreateBtn = modal.querySelector<HTMLButtonElement>('.create-add-btn');

    const handleCreateAndAdd = async () => {
      const name = inlineInput?.value.trim();
      if (!name) {
        showMsg('Please enter a playlist name.');
        inlineInput?.focus();
        return;
      }

      try {
        if (inlineCreateBtn) inlineCreateBtn.disabled = true;
        const newPl = await options.playlistService.createPlaylist(name);
        await options.playlistService.addTracksToPlaylist(newPl.id, options.trackIds);
        showMsg(`Created "${name}" and added tracks!`, false);
        setTimeout(() => {
          close();
          if (options.onSuccess) options.onSuccess();
        }, 500);
      } catch (err: any) {
        if (inlineCreateBtn) inlineCreateBtn.disabled = false;
        showMsg(err?.message || 'Failed to create playlist.');
      }
    };

    inlineCreateBtn?.addEventListener('click', handleCreateAndAdd);
    inlineInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleCreateAndAdd();
      }
    });

    return overlay;
  }
}
