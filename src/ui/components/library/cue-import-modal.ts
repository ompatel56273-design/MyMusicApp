import type { AudioFile } from '../../../domain/entities/models';
import type { VirtualTrackService } from '../../../services/cue/virtual-track-service';
import type { ParsedCueResult } from '../../../services/cue/cue-types';
import { CueParser } from '../../../services/cue/cue-parser';
import { CueTimeUtil } from '../../../services/cue/cue-time';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface CueImportModalOptions {
  virtualTrackService: VirtualTrackService;
  sourceAudioFile?: AudioFile | undefined;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export class CueImportModal {
  public static async show(options: CueImportModalOptions): Promise<HTMLElement> {
    const { virtualTrackService, sourceAudioFile } = options;

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
    overlay.setAttribute('aria-labelledby', 'cue-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '680px';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';
    modal.style.overflow = 'hidden';

    let parsedResult: ParsedCueResult | null = null;

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--glass-border);">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('disc', { size: 20 })}
            </span>
            <h2 id="cue-modal-title" style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
              Import CUE Sheet Virtual Tracks
            </h2>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; display: block;">
            ${sourceAudioFile ? `Source: ${escapeHtml(sourceAudioFile.filename)}` : 'Select a local .cue sheet file to parse track boundaries'}
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

        <div style="display: flex; gap: var(--space-3); align-items: center;">
          <label style="padding: 10px 18px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border-radius: var(--radius-lg); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <span>${getIconSvg('plus', { size: 16 })}</span>
            <span>Select .cue File</span>
            <input type="file" id="cue-file-input" accept=".cue,text/plain" style="display: none;" />
          </label>
          <span id="cue-filename-label" style="font-size: 12px; color: var(--color-text-muted);">No file selected.</span>
        </div>

        <div id="cue-preview-panel" style="display: none; background: rgba(10, 14, 23, 0.7); border: 1px solid var(--glass-border); padding: var(--space-4); border-radius: var(--radius-xl);">
          <div id="cue-album-header" style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px;"></div>
          <div id="cue-performer-header" style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 12px;"></div>

          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 6px;">
            Detected Virtual Tracks
          </div>
          <div id="cue-track-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; font-size: 12px;"></div>
        </div>

        <div id="cue-msg" style="display: none; font-size: 12px; padding: 10px; border-radius: var(--radius-md);"></div>

      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--glass-border); background: rgba(10, 14, 23, 0.5);">
        <button type="button" id="btn-cue-cancel" style="padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button type="button" id="btn-cue-import" disabled style="padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: none; border-radius: var(--radius-lg); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer; opacity: 0.5;">
          Confirm Import
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
    modal.querySelector('#btn-cue-cancel')?.addEventListener('click', close);

    const msgEl = modal.querySelector<HTMLElement>('#cue-msg')!;
    const showMsg = (txt: string, isError = true) => {
      msgEl.textContent = txt;
      msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      msgEl.style.color = isError ? '#f87171' : '#34d399';
      msgEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
      msgEl.style.display = 'block';
    };

    const cueFileInput = modal.querySelector<HTMLInputElement>('#cue-file-input')!;
    const cueFilenameLabel = modal.querySelector<HTMLElement>('#cue-filename-label')!;
    const previewPanel = modal.querySelector<HTMLElement>('#cue-preview-panel')!;
    const albumHeader = modal.querySelector<HTMLElement>('#cue-album-header')!;
    const performerHeader = modal.querySelector<HTMLElement>('#cue-performer-header')!;
    const trackList = modal.querySelector<HTMLElement>('#cue-track-list')!;
    const importBtn = modal.querySelector<HTMLButtonElement>('#btn-cue-import')!;

    cueFileInput.addEventListener('change', async () => {
      const file = cueFileInput.files?.[0];
      if (!file) return;

      cueFilenameLabel.textContent = file.name;

      try {
        const text = await file.text();
        parsedResult = CueParser.parse(text);

        if (!parsedResult.validation.valid) {
          const errMsgs = parsedResult.validation.errors.map(e => e.message).join('\n');
          showMsg(`Validation Errors:\n${errMsgs}`);
          importBtn.disabled = true;
          importBtn.style.opacity = '0.5';
          return;
        }

        if (parsedResult.validation.warnings.length > 0) {
          showMsg(`Warnings:\n${parsedResult.validation.warnings.map(w => w.message).join('\n')}`, false);
        } else {
          msgEl.style.display = 'none';
        }

        albumHeader.textContent = parsedResult.cueSheet.title || 'Untitled Album';
        performerHeader.textContent = `Artist: ${parsedResult.cueSheet.performer || 'Unknown Artist'}`;

        trackList.innerHTML = '';
        const defaultFile: AudioFile = sourceAudioFile || {
          id: `src_${Date.now()}`,
          path: parsedResult.cueSheet.files[0]?.filename || 'audio.flac',
          filename: parsedResult.cueSheet.files[0]?.filename || 'audio.flac',
          extension: 'flac',
          sizeBytes: 0,
          modifiedTimeMs: Date.now(),
          availability: 'available'
        };

        const defs = virtualTrackService.createVirtualTrackDefinitions(parsedResult.cueSheet, defaultFile);

        defs.forEach(d => {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.padding = '4px 0';
          row.style.borderBottom = '1px solid rgba(255,255,255,0.04)';

          row.innerHTML = `
            <span>#${String(d.trackNumber).padStart(2, '0')} — ${escapeHtml(d.title)} (${escapeHtml(d.performer || '')})</span>
            <span style="color: var(--color-accent-cyan); font-weight: 600;">${CueTimeUtil.formatCueTime(d.startTimeMs)} [${Math.round(d.durationMs / 1000)}s]</span>
          `;
          trackList.appendChild(row);
        });

        previewPanel.style.display = 'block';
        importBtn.disabled = false;
        importBtn.style.opacity = '1';
      } catch (err: any) {
        showMsg(`Failed to parse CUE file: ${err?.message || 'Unknown error'}`);
        importBtn.disabled = true;
        importBtn.style.opacity = '0.5';
      }
    });

    importBtn.addEventListener('click', async () => {
      if (!parsedResult || !parsedResult.cueSheet) return;

      try {
        importBtn.disabled = true;
        showMsg('Importing virtual tracks into library...', false);

        const defaultFile: AudioFile = sourceAudioFile || {
          id: `src_${Date.now()}`,
          path: parsedResult.cueSheet.files[0]?.filename || 'audio.flac',
          filename: parsedResult.cueSheet.files[0]?.filename || 'audio.flac',
          extension: 'flac',
          sizeBytes: 0,
          modifiedTimeMs: Date.now(),
          availability: 'available'
        };

        const defs = virtualTrackService.createVirtualTrackDefinitions(parsedResult.cueSheet, defaultFile);
        await virtualTrackService.importVirtualTracks(defs);

        showMsg(`Successfully imported ${defs.length} virtual tracks!`, false);
        setTimeout(() => {
          overlay.remove();
          if (options.onSuccess) options.onSuccess();
        }, 800);
      } catch (err: any) {
        importBtn.disabled = false;
        showMsg(`Import Failed: ${err?.message || 'Unknown error'}`);
      }
    });

    return overlay;
  }
}
