import type { Track } from '../../../domain/entities/models';
import type { ILibraryService, IPlaybackManager } from '../../../services/contracts/service-contracts';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface RemoveTrackConfirmModalOptions {
  track: Track;
  libraryService: ILibraryService;
  playbackManager?: IPlaybackManager | undefined;
  onRemoved?: () => void;
  onCancel?: () => void;
}

export class RemoveTrackConfirmModal {
  public static async show(options: RemoveTrackConfirmModalOptions): Promise<HTMLElement> {
    const { track, libraryService, playbackManager, onRemoved, onCancel } = options;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.78)';
    overlay.style.backdropFilter = 'blur(12px)';
    (overlay.style as any).webkitBackdropFilter = 'blur(12px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1100';
    overlay.style.padding = 'var(--space-4)';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'remove-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '460px';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(244, 63, 94, 0.2)';
    modal.style.border = '1px solid rgba(244, 63, 94, 0.35)';
    modal.style.background = 'linear-gradient(135deg, rgba(28, 15, 25, 0.98) 0%, rgba(12, 14, 26, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';
    modal.style.overflow = 'hidden';

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-5) var(--space-6); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: #f43f5e; display: flex;">
            ${getIconSvg('trash', { size: 20 })}
          </span>
          <h2 id="remove-modal-title" style="font-size: var(--font-size-base, 16px); font-weight: var(--font-weight-extrabold, 700); color: #ffffff; margin: 0;">
            Remove from Library
          </h2>
        </div>
        <button
          class="modal-close-btn"
          id="remove-modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; color: var(--color-text-muted, #94a3b8); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;"
        >
          ${getIconSvg('close', { size: 16 })}
        </button>
      </div>

      <!-- Body -->
      <div style="padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4);">
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #ffffff;">
          Remove <strong style="color: var(--color-accent-cyan, #38bdf8);">"${escapeHtml(track.title)}"</strong> by <span style="color: var(--color-text-secondary, #cbd5e1);">${escapeHtml(track.artistName ?? 'Unknown Artist')}</span> from your library?
        </p>

        <div style="padding: 12px 14px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-lg, 12px); display: flex; align-items: flex-start; gap: 10px;">
          <span style="color: var(--color-accent-cyan, #38bdf8); display: flex; flex-shrink: 0; margin-top: 1px;">
            ${getIconSvg('info', { size: 16 })}
          </span>
          <span style="font-size: 12px; color: var(--color-text-secondary, #cbd5e1); line-height: 1.4;">
            The audio file will <strong>NOT</strong> be deleted from your computer. Only the library database record will be removed.
          </span>
        </div>
      </div>

      <!-- Footer Actions -->
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; padding: var(--space-4) var(--space-6); border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(0, 0, 0, 0.2);">
        <button
          id="remove-modal-cancel-btn"
          style="
            padding: 8px 18px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: var(--radius-full, 9999px);
            color: var(--color-text-secondary, #cbd5e1);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
          "
        >
          Cancel
        </button>
        <button
          id="remove-modal-confirm-btn"
          style="
            padding: 8px 20px;
            background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
            border: 1px solid rgba(244, 63, 94, 0.4);
            border-radius: var(--radius-full, 9999px);
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
          "
        >
          <span>${getIconSvg('trash', { size: 14, color: '#ffffff' })}</span>
          <span>Remove from Library</span>
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    };

    overlay.querySelector('#remove-modal-close-btn')?.addEventListener('click', () => {
      closeModal();
      onCancel?.();
    });

    overlay.querySelector('#remove-modal-cancel-btn')?.addEventListener('click', () => {
      closeModal();
      onCancel?.();
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal();
        onCancel?.();
      }
    });

    overlay.querySelector('#remove-modal-confirm-btn')?.addEventListener('click', async () => {
      closeModal();

      // Safe playback handling
      if (playbackManager) {
        if (playbackManager.currentTrack?.id === track.id) {
          try {
            await playbackManager.next();
          } catch {
            await playbackManager.stop();
          }
        }
      }

      if (libraryService.removeTrackFromLibrary) {
        await libraryService.removeTrackFromLibrary(track.id);
      }
      onRemoved?.();
    });

    return overlay;
  }
}
