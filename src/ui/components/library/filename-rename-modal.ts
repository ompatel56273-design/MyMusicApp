import type { Track } from '../../../domain/entities/models';
import type { MetadataEditorService } from '../../../services/metadata-editor/metadata-editor-service';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface FilenameRenameModalOptions {
  tracks: readonly Track[];
  metadataEditorService: MetadataEditorService;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export class FilenameRenameModal {
  public static async show(options: FilenameRenameModalOptions): Promise<HTMLElement> {
    const { tracks, metadataEditorService } = options;
    const trackIds = tracks.map(t => t.id);

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
    overlay.setAttribute('aria-labelledby', 'rename-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '640px';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';
    modal.style.overflow = 'hidden';

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--glass-border);">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('folder', { size: 20 })}
            </span>
            <h2 id="rename-modal-title" style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
              Rename Files using Metadata Patterns
            </h2>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; display: block;">
            Renaming ${tracks.length} audio files
          </span>
        </div>
        <button
          class="modal-close-btn"
          aria-label="Close dialog"
          style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;"
        >
          ${getIconSvg('close', { size: 16 })}
        </button>
      </div>

      <!-- Body Content -->
      <div class="modal-body-scroll" style="flex: 1; overflow-y: auto; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4);">

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">
            Filename Pattern
          </label>
          <input
            type="text"
            id="pattern-input"
            value="%track% - %artist% - %title%"
            placeholder="e.g. %track% - %artist% - %title%"
            style="padding: 10px 14px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-md); color: #ffffff; font-size: 13px; outline: none;"
          />
          <span style="font-size: 11px; color: var(--color-text-muted);">
            Available tokens: %title%, %artist%, %album%, %albumartist%, %genre%, %year%, %track%, %disc%
          </span>
        </div>

        <div style="display: flex; gap: 8px;">
          <button type="button" class="preset-btn" data-preset="%track% - %artist% - %title%" style="padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: #ffffff; font-size: 11px; cursor: pointer;">%track% - %artist% - %title%</button>
          <button type="button" class="preset-btn" data-preset="%track% - %title%" style="padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: #ffffff; font-size: 11px; cursor: pointer;">%track% - %title%</button>
          <button type="button" class="preset-btn" data-preset="%artist% - %title%" style="padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); color: #ffffff; font-size: 11px; cursor: pointer;">%artist% - %title%</button>
        </div>

        <div id="rename-preview-box" style="background: rgba(10, 14, 23, 0.7); border: 1px solid var(--glass-border); padding: var(--space-4); border-radius: var(--radius-xl); max-height: 220px; overflow-y: auto;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 8px;">
            Preview Results
          </div>
          <div id="rename-preview-list" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--color-text-secondary);">
            Click "Generate Preview" to inspect proposed filenames.
          </div>
        </div>

        <div id="rename-msg" style="display: none; font-size: 12px; padding: 10px; border-radius: var(--radius-md);"></div>

      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--glass-border); background: rgba(10, 14, 23, 0.5);">
        <button type="button" id="btn-rename-cancel" style="padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button type="button" id="btn-rename-preview" style="padding: 10px 18px; background: rgba(168, 85, 247, 0.15); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-lg); color: var(--color-accent-purple-glow); font-size: 12px; font-weight: 700; cursor: pointer;">
          Generate Preview
        </button>
        <button type="button" id="btn-rename-execute" style="padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: none; border-radius: var(--radius-lg); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;">
          Apply Renaming
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      if (options.onCancel) options.onCancel();
    };

    modal.querySelector('.modal-close-btn')?.addEventListener('click', close);
    modal.querySelector('#btn-rename-cancel')?.addEventListener('click', close);

    const patternInput = modal.querySelector<HTMLInputElement>('#pattern-input')!;
    modal.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-preset');
        if (val) patternInput.value = val;
      });
    });

    const msgEl = modal.querySelector<HTMLElement>('#rename-msg')!;
    const showMsg = (txt: string, isError = true) => {
      msgEl.textContent = txt;
      msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      msgEl.style.color = isError ? '#f87171' : '#34d399';
      msgEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
      msgEl.style.display = 'block';
    };

    const previewList = modal.querySelector<HTMLElement>('#rename-preview-list')!;

    const generatePreview = async () => {
      try {
        const pat = patternInput.value.trim();
        if (!pat) {
          showMsg('Please enter a valid filename pattern.');
          return;
        }

        const prev = await metadataEditorService.getRenamePreview(trackIds, pat);
        previewList.innerHTML = '';

        if (prev.collisions.length > 0) {
          showMsg(`Filename Collisions Detected:\n${prev.collisions.join('\n')}`);
        } else {
          msgEl.style.display = 'none';
        }

        prev.previews.forEach(p => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
          row.style.padding = '4px 0';

          row.innerHTML = `
            <span style="truncate">${escapeHtml(p.audioFile?.filename || p.track.title)}</span>
            <span style="color: var(--color-accent-cyan); font-weight: 600;">➔ ${escapeHtml(p.proposedFilename || '')}</span>
          `;
          previewList.appendChild(row);
        });
      } catch (err: any) {
        showMsg(err.message || 'Failed to generate rename preview.');
      }
    };

    modal.querySelector('#btn-rename-preview')?.addEventListener('click', generatePreview);

    const execBtn = modal.querySelector<HTMLButtonElement>('#btn-rename-execute')!;
    execBtn.addEventListener('click', async () => {
      try {
        execBtn.disabled = true;
        showMsg('Executing physical file rename operation...', false);

        const pat = patternInput.value.trim();
        const res = await metadataEditorService.executeRename(trackIds, pat);

        showMsg(`Renaming Complete! ${res.successCount} renamed, ${res.failedCount} failed.`, false);
        setTimeout(() => {
          overlay.remove();
          if (options.onSuccess) options.onSuccess();
        }, 1000);
      } catch (err: any) {
        execBtn.disabled = false;
        showMsg(`Renaming Failed: ${err.message || 'Unknown error'}`);
      }
    });

    return overlay;
  }
}
