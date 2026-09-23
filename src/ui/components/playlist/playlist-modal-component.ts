import type { Playlist } from '../../../domain/entities/models';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface PlaylistModalOptions {
  playlist?: Playlist | undefined; // If provided, edit mode; otherwise, create mode
  onSave: (name: string, description?: string) => Promise<void> | void;
  onCancel?: (() => void) | undefined;
}

/**
 * Phase 7 Playlist Modal Component (Template 5).
 * Features:
 * - High-fidelity glass modal with Phase 2 tokens
 * - Lucide icons and keyboard accessibility
 * - Trap focus and Escape key handling
 */
export class PlaylistModalComponent {
  public static show(options: PlaylistModalOptions): HTMLElement {
    const isEdit = !!options.playlist;
    const titleText = isEdit ? 'Edit Playlist' : 'Create Playlist';
    const submitText = isEdit ? 'Save Changes' : 'Create Playlist';

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
    overlay.setAttribute('aria-labelledby', 'playlist-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '480px';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';

    modal.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--color-accent-purple-glow); display: flex;">
            ${getIconSvg('playlist', { size: 20 })}
          </span>
          <h2 id="playlist-modal-title" style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0; letter-spacing: -0.01em;">
            ${titleText}
          </h2>
        </div>
        <button
          class="modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: color var(--duration-fast);"
        >
          ${getIconSvg('close', { size: 16 })}
        </button>
      </div>

      <form class="playlist-modal-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="playlist-name-input" style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary);">
            Playlist Name <span style="color: var(--color-accent-pink);">*</span>
          </label>
          <input
            id="playlist-name-input"
            type="text"
            required
            maxlength="100"
            placeholder="e.g. Late Night Synthwave"
            value="${escapeHtml(options.playlist?.name ?? '')}"
            style="width: 100%; box-sizing: border-box; padding: 12px 16px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-lg); color: #ffffff; font-size: var(--font-size-sm); outline: none; transition: all var(--duration-fast);"
          />
          <span class="playlist-modal-error" style="font-size: 12px; color: var(--color-status-error); display: none;"></span>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="playlist-desc-input" style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-text-secondary);">
            Description (optional)
          </label>
          <textarea
            id="playlist-desc-input"
            rows="3"
            maxlength="300"
            placeholder="Add an optional mood, genre, or notes..."
            style="width: 100%; box-sizing: border-box; padding: 12px 16px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: #ffffff; font-size: var(--font-size-sm); outline: none; resize: vertical; font-family: inherit;"
          >${escapeHtml(options.playlist?.description ?? '')}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-3);">
          <button
            type="button"
            class="modal-cancel-btn"
            style="padding: 10px 20px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-secondary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer; min-height: 42px; transition: all var(--duration-fast);"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="modal-submit-btn btn-primary"
            style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-full); color: #ffffff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5); min-height: 42px;"
          >
            <span style="display: flex;">${getIconSvg('sparkles', { size: 14, color: '#ffffff' })}</span>
            <span>${submitText}</span>
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

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });

    form?.addEventListener('submit', async e => {
      e.preventDefault();
      const name = nameInput?.value.trim() ?? '';
      const description = descInput?.value.trim() || undefined;

      if (!name) {
        if (errorSpan) {
          errorSpan.textContent = 'Playlist name is required.';
          errorSpan.style.display = 'block';
        }
        nameInput?.focus();
        return;
      }

      try {
        const submitBtn = modal.querySelector<HTMLButtonElement>('.modal-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving...';
        }

        await options.onSave(name, description);
        close();
      } catch (err: any) {
        if (errorSpan) {
          errorSpan.textContent = err?.message || 'Failed to save playlist.';
          errorSpan.style.display = 'block';
        }
        const submitBtn = modal.querySelector<HTMLButtonElement>('.modal-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitText;
        }
      }
    });

    return overlay;
  }
}
