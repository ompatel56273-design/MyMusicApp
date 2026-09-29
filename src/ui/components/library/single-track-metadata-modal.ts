import type { Track } from '../../../domain/entities/models';
import type { MetadataEditorService } from '../../../services/metadata-editor/metadata-editor-service';
import type { SingleTrackEditPayload, ArtworkPayload } from '../../../services/metadata-editor/metadata-write-types';
import { ArtworkWriter } from '../../../services/metadata-editor/artwork-writer';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface SingleTrackMetadataModalOptions {
  track: Track;
  metadataEditorService: MetadataEditorService;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export class SingleTrackMetadataModal {
  public static async show(options: SingleTrackMetadataModalOptions): Promise<HTMLElement> {
    const { track, metadataEditorService } = options;

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
    overlay.setAttribute('aria-labelledby', 'edit-metadata-modal-title');

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

    let pendingArtwork: ArtworkPayload | undefined = undefined;

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--glass-border);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="color: var(--color-accent-purple-glow); display: flex;">
            ${getIconSvg('edit', { size: 20 })}
          </span>
          <h2 id="edit-metadata-modal-title" style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
            Edit Metadata — ${escapeHtml(track.title)}
          </h2>
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

        <!-- Artwork Section -->
        <div style="display: flex; gap: var(--space-4); align-items: center; background: rgba(255, 255, 255, 0.03); padding: var(--space-3) var(--space-4); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
          <div id="art-preview-box" style="width: 72px; height: 72px; border-radius: var(--radius-md); background: rgba(168, 85, 247, 0.15); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--glass-border); flex-shrink: 0;">
            <span style="color: var(--color-accent-purple-glow);">${getIconSvg('music', { size: 28 })}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <span style="font-size: 12px; font-weight: 700; color: #ffffff;">Embedded Artwork</span>
            <div style="display: flex; gap: 8px;">
              <label style="padding: 6px 12px; background: rgba(168, 85, 247, 0.2); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-md); color: #ffffff; font-size: 11px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                <span>Replace</span>
                <input type="file" id="art-file-input" accept="image/jpeg,image/png,image/webp" style="display: none;" />
              </label>
              <button type="button" id="art-remove-btn" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); color: #f87171; font-size: 11px; font-weight: 600; cursor: pointer;">
                Remove
              </button>
            </div>
          </div>
        </div>

        <!-- Form Fields Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">

          <div style="grid-column: span 2; display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Title</label>
            <input type="text" id="meta-title" value="${escapeHtml(track.title)}" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Artist</label>
            <input type="text" id="meta-artist" value="${escapeHtml(track.artistName || '')}" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Album Artist</label>
            <input type="text" id="meta-albumartist" value="${escapeHtml(track.artistName || '')}" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="grid-column: span 2; display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Album</label>
            <input type="text" id="meta-album" value="${escapeHtml(track.albumTitle || '')}" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Genre</label>
            <input type="text" id="meta-genre" value="${escapeHtml(track.genreName || '')}" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Year</label>
            <input type="number" id="meta-year" value="${track.year || ''}" placeholder="e.g. 2024" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Track Number / Total</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="meta-tracknum" value="${track.trackNumber || ''}" placeholder="Track #" style="width: 50%; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
              <input type="number" id="meta-tracktotal" placeholder="Total" style="width: 50%; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Disc Number / Total</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="meta-discnum" value="${track.discNumber || ''}" placeholder="Disc #" style="width: 50%; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
              <input type="number" id="meta-disctotal" placeholder="Total" style="width: 50%; padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Composer</label>
            <input type="text" id="meta-composer" placeholder="Composer" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 700; color: var(--color-text-secondary); text-transform: uppercase;">Comment</label>
            <input type="text" id="meta-comment" placeholder="Comment" style="padding: 8px 12px; background: rgba(10, 14, 23, 0.85); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 13px;" />
          </div>

        </div>

        <div id="preview-panel" style="display: none; background: rgba(124, 58, 237, 0.08); border: 1px solid var(--glass-border-interactive); padding: var(--space-4); border-radius: var(--radius-xl); margin-top: var(--space-2);">
          <div style="font-size: 12px; font-weight: 700; color: var(--color-accent-cyan); text-transform: uppercase; margin-bottom: 8px;">
            Modification Preview
          </div>
          <div id="preview-content" style="font-size: 12px; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 4px;"></div>
        </div>

        <div id="meta-msg" style="display: none; font-size: 12px; padding: 10px; border-radius: var(--radius-md);"></div>

      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--glass-border); background: rgba(10, 14, 23, 0.5);">
        <button type="button" id="btn-cancel" style="padding: 10px 18px; background: transparent; border: 1px solid var(--glass-border); border-radius: var(--radius-lg); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
        <button type="button" id="btn-preview" style="padding: 10px 18px; background: rgba(168, 85, 247, 0.15); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-lg); color: var(--color-accent-purple-glow); font-size: 12px; font-weight: 700; cursor: pointer;">
          Preview Changes
        </button>
        <button type="button" id="btn-save" style="padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: none; border-radius: var(--radius-lg); color: #ffffff; font-size: 12px; font-weight: 700; cursor: pointer;">
          Save Changes
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
    modal.querySelector('#btn-cancel')?.addEventListener('click', close);

    const msgEl = modal.querySelector<HTMLElement>('#meta-msg')!;
    const showMsg = (txt: string, isError = true) => {
      msgEl.textContent = txt;
      msgEl.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
      msgEl.style.color = isError ? '#f87171' : '#34d399';
      msgEl.style.border = isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
      msgEl.style.display = 'block';
    };

    // Artwork handling
    const artFileInput = modal.querySelector<HTMLInputElement>('#art-file-input')!;
    const artRemoveBtn = modal.querySelector<HTMLButtonElement>('#art-remove-btn')!;
    const artPreviewBox = modal.querySelector<HTMLElement>('#art-preview-box')!;

    artFileInput.addEventListener('change', async () => {
      const file = artFileInput.files?.[0];
      if (!file) return;

      const val = await ArtworkWriter.validateImage(file);
      if (!val.valid) {
        showMsg(`Artwork Error: ${val.reason}`);
        return;
      }

      const buffer = new Uint8Array(await file.arrayBuffer());
      pendingArtwork = {
        action: 'replace',
        data: buffer,
        mimeType: val.mimeType || file.type
      };

      const url = URL.createObjectURL(file);
      artPreviewBox.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" />`;
      showMsg('Artwork replacement ready for preview/save.', false);
    });

    artRemoveBtn.addEventListener('click', () => {
      pendingArtwork = { action: 'remove' };
      artPreviewBox.innerHTML = `<span style="font-size: 11px; color: var(--color-status-error); text-align: center;">Removed</span>`;
      showMsg('Artwork marked for removal.', false);
    });

    // Extract payload helper
    const getPayloadFromInputs = (): SingleTrackEditPayload => {
      const titleVal = modal.querySelector<HTMLInputElement>('#meta-title')?.value.trim();
      const artistVal = modal.querySelector<HTMLInputElement>('#meta-artist')?.value.trim();
      const albumArtistVal = modal.querySelector<HTMLInputElement>('#meta-albumartist')?.value.trim();
      const albumVal = modal.querySelector<HTMLInputElement>('#meta-album')?.value.trim();
      const genreVal = modal.querySelector<HTMLInputElement>('#meta-genre')?.value.trim();
      const yearVal = modal.querySelector<HTMLInputElement>('#meta-year')?.value.trim();
      const trackNumVal = modal.querySelector<HTMLInputElement>('#meta-tracknum')?.value.trim();
      const trackTotVal = modal.querySelector<HTMLInputElement>('#meta-tracktotal')?.value.trim();
      const discNumVal = modal.querySelector<HTMLInputElement>('#meta-discnum')?.value.trim();
      const discTotVal = modal.querySelector<HTMLInputElement>('#meta-disctotal')?.value.trim();
      const composerVal = modal.querySelector<HTMLInputElement>('#meta-composer')?.value.trim();
      const commentVal = modal.querySelector<HTMLInputElement>('#meta-comment')?.value.trim();

      return {
        title: titleVal || track.title,
        artist: artistVal || track.artistName,
        albumArtist: albumArtistVal || undefined,
        album: albumVal || track.albumTitle,
        genre: genreVal || track.genreName,
        year: yearVal ? parseInt(yearVal, 10) : undefined,
        trackNumber: trackNumVal ? parseInt(trackNumVal, 10) : undefined,
        totalTracks: trackTotVal ? parseInt(trackTotVal, 10) : undefined,
        discNumber: discNumVal ? parseInt(discNumVal, 10) : undefined,
        totalDiscs: discTotVal ? parseInt(discTotVal, 10) : undefined,
        composer: composerVal || undefined,
        comment: commentVal || undefined,
        artwork: pendingArtwork
      };
    };

    // Preview button
    modal.querySelector('#btn-preview')?.addEventListener('click', async () => {
      try {
        const edits = getPayloadFromInputs();
        const prev = await metadataEditorService.getSingleTrackPreview(track.id, edits);
        const panel = modal.querySelector<HTMLElement>('#preview-panel')!;
        const content = modal.querySelector<HTMLElement>('#preview-content')!;

        if (!prev.canWrite) {
          showMsg(prev.reasonIfCannotWrite || 'Metadata editing is not supported for this file format.');
          panel.style.display = 'none';
          return;
        }

        content.innerHTML = `
          <div><strong>Title:</strong> ${escapeHtml(prev.currentMetadata.title || '')} ➔ <span style="color:#ffffff;">${escapeHtml(prev.proposedMetadata.title || '')}</span></div>
          <div><strong>Artist:</strong> ${escapeHtml(prev.currentMetadata.artist || '')} ➔ <span style="color:#ffffff;">${escapeHtml(prev.proposedMetadata.artist || '')}</span></div>
          <div><strong>Album:</strong> ${escapeHtml(prev.currentMetadata.album || '')} ➔ <span style="color:#ffffff;">${escapeHtml(prev.proposedMetadata.album || '')}</span></div>
          <div><strong>Genre:</strong> ${escapeHtml(prev.currentMetadata.genre || '')} ➔ <span style="color:#ffffff;">${escapeHtml(prev.proposedMetadata.genre || '')}</span></div>
          <div><strong>Year:</strong> ${prev.currentMetadata.year || ''} ➔ <span style="color:#ffffff;">${prev.proposedMetadata.year || ''}</span></div>
          <div><strong>Track #:</strong> ${prev.currentMetadata.trackNumber || ''} ➔ <span style="color:#ffffff;">${prev.proposedMetadata.trackNumber || ''}</span></div>
          ${pendingArtwork ? `<div><strong>Artwork:</strong> <span style="color:var(--color-accent-cyan);">${pendingArtwork.action.toUpperCase()}</span></div>` : ''}
        `;
        panel.style.display = 'block';
      } catch (err: any) {
        showMsg(err.message || 'Failed to preview metadata changes.');
      }
    });

    // Save button
    const saveBtn = modal.querySelector<HTMLButtonElement>('#btn-save')!;
    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        showMsg('Writing metadata back to file and verifying...', false);

        const edits = getPayloadFromInputs();
        const res = await metadataEditorService.executeSingleTrackEdit(track.id, edits);

        if (res.success) {
          showMsg('Metadata saved and library refreshed!', false);
          setTimeout(() => {
            overlay.remove();
            if (options.onSuccess) options.onSuccess();
          }, 600);
        } else {
          saveBtn.disabled = false;
          showMsg(`Save Failed: ${res.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        saveBtn.disabled = false;
        showMsg(`Save Failed: ${err.message || 'Unknown error'}`);
      }
    });

    return overlay;
  }
}
