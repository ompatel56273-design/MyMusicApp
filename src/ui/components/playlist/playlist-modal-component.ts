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
    modal.style.maxWidth = '460px';
    modal.style.borderRadius = 'var(--radius-xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.5)';
    modal.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    modal.style.background = 'var(--color-bg-surface)';

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5);">
        <h2 id="playlist-modal-title" style="font-size: 20px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
          ${titleText}
        </h2>
        <button
          class="modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; font-size: 20px; color: var(--color-text-muted); cursor: pointer; padding: 4px;"
        >
          ✕
        </button>
      </div>

      <form class="playlist-modal-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="playlist-name-input" style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary);">
            Playlist Name <span style="color: var(--color-accent-primary);">*</span>
          </label>
          <input
            id="playlist-name-input"
            type="text"
            required
            maxlength="100"
            placeholder="e.g. Late Night Beats"
            value="${options.playlist?.name ?? ''}"
            style="width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 14px; outline: none;"
          />
          <span class="playlist-modal-error" style="font-size: 12px; color: #ff5555; display: none;"></span>
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
            style="width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 14px; outline: none; resize: vertical;"
          >${options.playlist?.description ?? ''}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2);">
          <button
            type="button"
            class="modal-cancel-btn"
            style="padding: var(--space-2) var(--space-5); background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 14px; font-weight: 500; cursor: pointer;"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="modal-submit-btn"
            style="padding: var(--space-2) var(--space-5); background: var(--color-accent-primary); border: none; border-radius: var(--radius-md); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);"
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
