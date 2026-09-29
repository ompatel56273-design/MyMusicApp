import type { Track } from '../../../domain/entities/models';
import type { MetadataEditorService } from '../../../services/metadata-editor/metadata-editor-service';
import type { NormalizationOptions } from '../../../services/metadata-editor/metadata-write-types';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface NormalizationModalOptions {
  tracks: readonly Track[];
  metadataEditorService: MetadataEditorService;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export class NormalizationModal {
  public static async show(options: NormalizationModalOptions): Promise<HTMLElement> {
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
    overlay.setAttribute('aria-labelledby', 'norm-modal-title');

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
              ${getIconSvg('sparkles', { size: 20 })}
            </span>
            <h2 id="norm-modal-title" style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
              Metadata Normalization Engine
            </h2>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; display: block;">
            Normalizing ${tracks.length} selected tracks
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

        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #ffffff; cursor: pointer;">
            <input type="checkbox" id="norm-trim" checked /> Trim leading & trailing whitespace
          </label>
          <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #ffffff; cursor: pointer;">
            <input type="checkbox" id="norm-collapse" checked /> Collapse unnecessary repeated spaces
          </label>
          <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #ffffff; cursor: pointer;">
            <input type="checkbox" id="norm-titlecase" /> Apply Title Case formatting (e.g. "imagine dragons" ➔ "Imagine Dragons")
          </label>
          <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #ffffff; cursor: pointer;">
            <input type="checkbox" id="norm-comments" /> Remove unwanted comment tags
          </label>
        </div>

        <div id="norm-preview-panel" style="display: none; background: rgba(124, 58, 237, 0.08); border: 1px solid var(--glass-border-interactive); padding: var(--space-4); border-radius: var(--radius-xl); max-height: 200px; overflow-y: auto;">
          <div style="font-size: 12px; font-weight: 700; color: var(--color-accent-cyan); text-transform: uppercase; margin-bottom: 8px;">
            Normalization Preview
          </div>
          <div id="norm-preview-list" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--color-text-secondary);"></div>
        </div>

        <div id="norm-msg" style="display: none; font-size: 12px; padding: 10px; border-radius: var(--radius-md);"></div>

      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--glass-border); background: rgba(10, 14, 23, 0.5);">
        <button type="button" id="btn-norm-cancel" style="padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button type="button" id="btn-norm-preview" style="padding: 10px 18px; background: rgba(168, 85, 247, 0.15); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-lg); color: var(--color-accent-purple-glow); font-size: 12px; font-weight: 700; cursor: pointer;">
          Preview Changes
        </button>
        <button type="button" id="btn-norm-execute" style="padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: none; border-radius: var(--radius-lg); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;">
          Apply Normalization
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
    modal.querySelector('#btn-norm-cancel')?.addEventListener('click', close);

    const msgEl = modal.querySelector<HTMLElement>('#norm-msg')!;
    const showMsg = (txt: string, isError = true) => {
      msgEl.textContent = txt;
      msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      msgEl.style.color = isError ? '#f87171' : '#34d399';
      msgEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
      msgEl.style.display = 'block';
    };

    const buildOptions = (): NormalizationOptions => ({
      trimWhitespace: modal.querySelector<HTMLInputElement>('#norm-trim')?.checked ?? true,
      collapseWhitespace: modal.querySelector<HTMLInputElement>('#norm-collapse')?.checked ?? true,
      titleCase: modal.querySelector<HTMLInputElement>('#norm-titlecase')?.checked ?? false,
      removeComments: modal.querySelector<HTMLInputElement>('#norm-comments')?.checked ?? false
    });

    const panel = modal.querySelector<HTMLElement>('#norm-preview-panel')!;
    const list = modal.querySelector<HTMLElement>('#norm-preview-list')!;

    modal.querySelector('#btn-norm-preview')?.addEventListener('click', async () => {
      try {
        const opts = buildOptions();
        const prevRes = await metadataEditorService.getNormalizationPreview(trackIds, opts);

        list.innerHTML = '';
        prevRes.previews.forEach(p => {
          const item = document.createElement('div');
          item.innerHTML = `
            <strong>${escapeHtml(p.currentMetadata.title || '')}</strong> ➔ <span style="color:#ffffff;">${escapeHtml(p.proposedMetadata.title || '')}</span>
          `;
          list.appendChild(item);
        });

        panel.style.display = 'block';
      } catch (err: any) {
        showMsg(err.message || 'Failed to preview normalization.');
      }
    });

    const execBtn = modal.querySelector<HTMLButtonElement>('#btn-norm-execute')!;
    execBtn.addEventListener('click', async () => {
      try {
        execBtn.disabled = true;
        showMsg('Applying normalization changes across files...', false);

        const opts = buildOptions();
        const res = await metadataEditorService.executeNormalization(trackIds, opts);

        showMsg(`Normalization Complete! ${res.successCount} updated, ${res.failedCount} failed.`, false);
        setTimeout(() => {
          overlay.remove();
          if (options.onSuccess) options.onSuccess();
        }, 1000);
      } catch (err: any) {
        execBtn.disabled = false;
        showMsg(`Normalization Failed: ${err.message || 'Unknown error'}`);
      }
    });

    return overlay;
  }
}
