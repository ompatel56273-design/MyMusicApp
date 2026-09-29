import type { Track } from '../../../domain/entities/models';
import type { MetadataEditorService } from '../../../services/metadata-editor/metadata-editor-service';
import type { BatchEditPayload, ArtworkPayload } from '../../../services/metadata-editor/metadata-write-types';
import { ArtworkWriter } from '../../../services/metadata-editor/artwork-writer';
import { getIconSvg } from '../../icons/icon-registry';

export interface BatchMetadataModalOptions {
  tracks: readonly Track[];
  metadataEditorService: MetadataEditorService;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export class BatchMetadataModal {
  public static async show(options: BatchMetadataModalOptions): Promise<HTMLElement> {
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
    overlay.setAttribute('aria-labelledby', 'batch-metadata-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '720px';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';
    modal.style.overflow = 'hidden';

    let pendingArtwork: ArtworkPayload | undefined = undefined;

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--glass-border);">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('edit', { size: 20 })}
            </span>
            <h2 id="batch-metadata-modal-title" style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
              Batch Metadata Editor
            </h2>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; display: block;">
            Editing ${tracks.length} selected tracks
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

        <div style="font-size: 12px; color: var(--color-text-muted); background: rgba(255,255,255,0.03); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
          Check the box next to a field to replace its value across all selected tracks. Unchecked fields remain unchanged.
        </div>

        <!-- Field Rows -->
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">

          <!-- Artist -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 140px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-artist" /> Artist
            </label>
            <input type="text" id="val-artist" placeholder="Enter artist name..." disabled style="flex: 1; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;" />
          </div>

          <!-- Album Artist -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 140px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-albumartist" /> Album Artist
            </label>
            <input type="text" id="val-albumartist" placeholder="Enter album artist..." disabled style="flex: 1; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;" />
          </div>

          <!-- Album -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 140px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-album" /> Album
            </label>
            <input type="text" id="val-album" placeholder="Enter album title..." disabled style="flex: 1; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;" />
          </div>

          <!-- Genre -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 140px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-genre" /> Genre
            </label>
            <input type="text" id="val-genre" placeholder="Enter genre..." disabled style="flex: 1; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;" />
          </div>

          <!-- Year -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 140px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-year" /> Year
            </label>
            <input type="number" id="val-year" placeholder="e.g. 2024" disabled style="width: 140px; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;" />
          </div>

          <!-- Sequential Track Numbering -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 220px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-tracknum" /> Assign Sequential Track #
            </label>
            <span style="font-size: 11px; color: var(--color-text-muted);">Start #:</span>
            <input type="number" id="val-tracknum-start" value="1" disabled style="width: 80px; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 12px;" />
          </div>

          <!-- Artwork Replacement -->
          <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 14, 23, 0.6); padding: 10px 14px; border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <label style="display: flex; align-items: center; gap: 8px; width: 140px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer;">
              <input type="checkbox" id="chk-artwork" /> Artwork
            </label>
            <div id="art-controls" style="display: flex; gap: 8px; align-items: center; opacity: 0.5; pointer-events: none;">
              <label style="padding: 6px 12px; background: rgba(168, 85, 247, 0.2); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-md); color: #ffffff; font-size: 11px; font-weight: 600; cursor: pointer;">
                <span>Replace Artwork</span>
                <input type="file" id="batch-art-file" accept="image/jpeg,image/png,image/webp" style="display: none;" />
              </label>
              <button type="button" id="batch-art-remove" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); color: #f87171; font-size: 11px; font-weight: 600; cursor: pointer;">
                Remove Artwork
              </button>
              <span id="batch-art-status" style="font-size: 11px; color: var(--color-accent-cyan);"></span>
            </div>
          </div>

        </div>

        <div id="batch-preview-panel" style="display: none; background: rgba(124, 58, 237, 0.08); border: 1px solid var(--glass-border-interactive); padding: var(--space-4); border-radius: var(--radius-xl); margin-top: var(--space-2);">
          <div style="font-size: 12px; font-weight: 700; color: var(--color-accent-cyan); text-transform: uppercase; margin-bottom: 8px;">
            Batch Preview Summary
          </div>
          <div id="batch-preview-summary" style="font-size: 12px; color: var(--color-text-secondary);"></div>
        </div>

        <div id="batch-msg" style="display: none; font-size: 12px; padding: 10px; border-radius: var(--radius-md);"></div>

      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--glass-border); background: rgba(10, 14, 23, 0.5);">
        <button type="button" id="btn-batch-cancel" style="padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button type="button" id="btn-batch-preview" style="padding: 10px 18px; background: rgba(168, 85, 247, 0.15); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-lg); color: var(--color-accent-purple-glow); font-size: 12px; font-weight: 700; cursor: pointer;">
          Preview Changes
        </button>
        <button type="button" id="btn-batch-apply" style="padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: none; border-radius: var(--radius-lg); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;">
          Apply Changes
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
    modal.querySelector('#btn-batch-cancel')?.addEventListener('click', close);

    const bindFieldToggle = (chkId: string, valId: string) => {
      const chk = modal.querySelector<HTMLInputElement>(`#${chkId}`);
      const input = modal.querySelector<HTMLInputElement>(`#${valId}`);
      chk?.addEventListener('change', () => {
        if (input) {
          input.disabled = !chk.checked;
          if (chk.checked) input.focus();
        }
      });
    };

    bindFieldToggle('chk-artist', 'val-artist');
    bindFieldToggle('chk-albumartist', 'val-albumartist');
    bindFieldToggle('chk-album', 'val-album');
    bindFieldToggle('chk-genre', 'val-genre');
    bindFieldToggle('chk-year', 'val-year');
    bindFieldToggle('chk-tracknum', 'val-tracknum-start');

    // Artwork checkbox toggle
    const chkArt = modal.querySelector<HTMLInputElement>('#chk-artwork');
    const artCtrl = modal.querySelector<HTMLElement>('#art-controls');
    chkArt?.addEventListener('change', () => {
      if (artCtrl) {
        artCtrl.style.opacity = chkArt.checked ? '1' : '0.5';
        artCtrl.style.pointerEvents = chkArt.checked ? 'auto' : 'none';
      }
    });

    const artFile = modal.querySelector<HTMLInputElement>('#batch-art-file');
    const artRemove = modal.querySelector<HTMLButtonElement>('#batch-art-remove');
    const artStatus = modal.querySelector<HTMLElement>('#batch-art-status');

    artFile?.addEventListener('change', async () => {
      const file = artFile.files?.[0];
      if (!file) return;
      const val = await ArtworkWriter.validateImage(file);
      if (!val.valid) {
        if (artStatus) artStatus.textContent = `Error: ${val.reason}`;
        return;
      }
      const buffer = new Uint8Array(await file.arrayBuffer());
      pendingArtwork = { action: 'replace', data: buffer, mimeType: val.mimeType || file.type };
      if (artStatus) artStatus.textContent = 'Replacement ready';
    });

    artRemove?.addEventListener('click', () => {
      pendingArtwork = { action: 'remove' };
      if (artStatus) artStatus.textContent = 'Removal ready';
    });

    const msgEl = modal.querySelector<HTMLElement>('#batch-msg')!;
    const showMsg = (txt: string, isError = true) => {
      msgEl.textContent = txt;
      msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      msgEl.style.color = isError ? '#f87171' : '#34d399';
      msgEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
      msgEl.style.display = 'block';
    };

    const buildPayload = (): BatchEditPayload => {
      const payload: BatchEditPayload = {};

      const chkArtist = modal.querySelector<HTMLInputElement>('#chk-artist')?.checked;
      if (chkArtist) {
        payload.artist = { strategy: 'replace', value: modal.querySelector<HTMLInputElement>('#val-artist')?.value.trim() || '' };
      }

      const chkAlbumArtist = modal.querySelector<HTMLInputElement>('#chk-albumartist')?.checked;
      if (chkAlbumArtist) {
        payload.albumArtist = { strategy: 'replace', value: modal.querySelector<HTMLInputElement>('#val-albumartist')?.value.trim() || '' };
      }

      const chkAlbum = modal.querySelector<HTMLInputElement>('#chk-album')?.checked;
      if (chkAlbum) {
        payload.album = { strategy: 'replace', value: modal.querySelector<HTMLInputElement>('#val-album')?.value.trim() || '' };
      }

      const chkGenre = modal.querySelector<HTMLInputElement>('#chk-genre')?.checked;
      if (chkGenre) {
        payload.genre = { strategy: 'replace', value: modal.querySelector<HTMLInputElement>('#val-genre')?.value.trim() || '' };
      }

      const chkYear = modal.querySelector<HTMLInputElement>('#chk-year')?.checked;
      if (chkYear) {
        const y = parseInt(modal.querySelector<HTMLInputElement>('#val-year')?.value.trim() || '', 10);
        payload.year = { strategy: 'replace', value: isNaN(y) ? 0 : y };
      }

      const chkTrackNum = modal.querySelector<HTMLInputElement>('#chk-tracknum')?.checked;
      if (chkTrackNum) {
        const start = parseInt(modal.querySelector<HTMLInputElement>('#val-tracknum-start')?.value.trim() || '1', 10);
        payload.trackNumbering = { enabled: true, startNumber: isNaN(start) ? 1 : start };
      }

      if (chkArt?.checked && pendingArtwork) {
        payload.artwork = pendingArtwork;
      }

      return payload;
    };

    modal.querySelector('#btn-batch-preview')?.addEventListener('click', async () => {
      try {
        const payload = buildPayload();
        const prevRes = await metadataEditorService.getBatchEditPreview(trackIds, payload);

        const panel = modal.querySelector<HTMLElement>('#batch-preview-panel')!;
        const summary = modal.querySelector<HTMLElement>('#batch-preview-summary')!;

        summary.innerHTML = `
          <div>Total Selected: <strong>${prevRes.totalSelected}</strong></div>
          <div>Writable Format: <strong style="color:#34d399;">${prevRes.writableCount}</strong></div>
          <div>Unsupported Read-Only: <strong style="color:#f87171;">${prevRes.unsupportedCount}</strong></div>
        `;
        panel.style.display = 'block';
      } catch (err: any) {
        showMsg(err.message || 'Failed to generate preview.');
      }
    });

    const applyBtn = modal.querySelector<HTMLButtonElement>('#btn-batch-apply')!;
    applyBtn.addEventListener('click', async () => {
      try {
        applyBtn.disabled = true;
        showMsg('Executing batch metadata write across files...', false);

        const payload = buildPayload();
        const res = await metadataEditorService.executeBatchEdit(trackIds, payload);

        showMsg(`Batch Complete! ${res.successCount} updated, ${res.skippedCount} skipped, ${res.failedCount} failed.`, false);
        setTimeout(() => {
          overlay.remove();
          if (options.onSuccess) options.onSuccess();
        }, 1000);
      } catch (err: any) {
        applyBtn.disabled = false;
        showMsg(`Batch Failed: ${err.message || 'Unknown error'}`);
      }
    });

    return overlay;
  }
}
