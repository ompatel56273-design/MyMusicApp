import type { Playlist } from '../../../domain/entities/models';

export interface PlaylistModalOptions {
  playlist?: Playlist | undefined; // If provided, edit mode; otherwise, create mode
  onSave: (name: string, description?: string) => Promise<void> | void;
  onCancel?: (() => void) | undefined;
}

export class PlaylistModalComponent {
  public static show(options: PlaylistModalOptions): HTMLElement {
    const isEdit = !!options.playlist;
    const titleText = isEdit ? 'Edit Playlist' : 'Create Playlist';
    const submitText = isEdit ? 'Save Changes' : 'Create Playlist';

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
    overlay.setAttribute('aria-labelledby', 'playlist-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '480px';
    modal.style.borderRadius = 'var(--radius-xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.7)';
    modal.style.border = '1px solid var(--glass-border-highlight)';
    modal.style.background = 'rgba(15, 23, 42, 0.95)';
    modal.style.backdropFilter = 'blur(20px)';

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5);">
        <h2 id="playlist-modal-title" style="font-size: 20px; font-weight: 800; color: var(--color-text-primary); margin: 0; letter-spacing: -0.01em;">
          ${titleText}
        </h2>
        <button
          class="modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; font-size: 18px; color: var(--color-text-muted); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;"
        >
          ✕
        </button>
      </div>

      <form class="playlist-modal-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="playlist-name-input" style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary);">
            Playlist Name <span style="color: var(--color-purple-neon);">*</span>
          </label>
          <input
            id="playlist-name-input"
            type="text"
            required
            maxlength="100"
            placeholder="e.g. Late Night Beats"
            value="${options.playlist?.name ?? ''}"
            style="width: 100%; box-sizing: border-box; padding: 12px 16px; background: rgba(10, 14, 23, 0.8); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 14px; outline: none; transition: border-color var(--duration-fast);"
          />
          <span class="playlist-modal-error" style="font-size: 12px; color: var(--color-status-error); display: none;"></span>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="playlist-desc-input" style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary);">
            Description (optional)
          </label>
          <textarea
            id="playlist-desc-input"
            rows="3"
            maxlength="300"
            placeholder="Add an optional description"
            style="width: 100%; box-sizing: border-box; padding: 12px 16px; background: rgba(10, 14, 23, 0.8); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 14px; outline: none; resize: vertical;"
          >${options.playlist?.description ?? ''}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-3);">
          <button
            type="button"
            class="modal-cancel-btn"
            style="padding: 10px 20px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; min-height: 42px;"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="modal-submit-btn btn-primary"
            style="padding: 10px 24px; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); border: none; border-radius: var(--radius-full); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: var(--shadow-glow-purple); min-height: 42px;"
          >
            ${submitText}
          </button>
        </div>
      </form>
    `;

    const previousActiveElement = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const nameInput = modal.querySelector<HTMLInputElement>('#playlist-name-input');
    const descInput = modal.querySelector<HTMLTextAreaElement>('#playlist-desc-input');
    const errorSpan = modal.querySelector<HTMLElement>('.playlist-modal-error');
    const form = modal.querySelector<HTMLFormElement>('.playlist-modal-form');
    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.modal-cancel-btn');

    if (nameInput) {
      setTimeout(() => nameInput.focus(), 50);
    }

    const close = () => {
      overlay.remove();
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try {
          previousActiveElement.focus();
        } catch {}
      }
      if (options.onCancel) options.onCancel();
    };

    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

        if (focusables.length === 0) return;

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;

        if (e.shiftKey) {
          if (document.activeElement === first || !modal.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !modal.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const rawName = nameInput?.value ?? '';
      const trimmedName = rawName.trim();
      if (!trimmedName) {
        if (errorSpan) {
          errorSpan.textContent = 'Playlist name cannot be empty.';
          errorSpan.style.display = 'block';
        }
        if (nameInput) nameInput.focus();
        return;
      }

      const description = descInput?.value.trim() || undefined;

      try {
        await options.onSave(trimmedName, description);
        overlay.remove();
      } catch (err: any) {
        if (errorSpan) {
          errorSpan.textContent = err.message || 'Failed to save playlist.';
          errorSpan.style.display = 'block';
        }
      }
    });

    return overlay;
  }
}
