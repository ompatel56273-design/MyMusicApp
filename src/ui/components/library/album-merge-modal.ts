import type { AlbumMergeService } from '../../../services/library/album-merge-service';
import type {
  AlbumMergeCandidateGroup,
  AlbumMergePreview
} from '../../../domain/entities/album-merge-types';
import type { EntityId } from '../../../domain/value-objects/audio-types';
import { getIconSvg } from '../../icons/icon-registry';

export interface AlbumMergeModalOptions {
  albumMergeService: AlbumMergeService;
  onMerged?: () => void;
  onClose?: () => void;
}

/**
 * Album Merge Modal Component.
 * Allows inspecting candidate fragmented albums, choosing a canonical album,
 * previewing affected tracks, and executing safe consolidation.
 */
export class AlbumMergeModal {
  private static activeInstance: AlbumMergeModal | null = null;
  private container: HTMLElement | null = null;
  private readonly albumMergeService: AlbumMergeService;
  private readonly onMerged?: (() => void) | undefined;
  private readonly onClose?: (() => void) | undefined;

  private candidates: readonly AlbumMergeCandidateGroup[] = [];
  private selectedGroup: AlbumMergeCandidateGroup | null = null;
  private selectedCanonicalId: EntityId | null = null;
  private preview: AlbumMergePreview | null = null;
  private isLoading = true;
  private isMerging = false;
  private statusMessage: { type: 'success' | 'error'; text: string } | null = null;

  constructor(options: AlbumMergeModalOptions) {
    this.albumMergeService = options.albumMergeService;
    this.onMerged = options.onMerged;
    this.onClose = options.onClose;
  }

  public static show(options: AlbumMergeModalOptions): AlbumMergeModal {
    if (this.activeInstance) {
      this.activeInstance.unmount();
    }
    const modal = new AlbumMergeModal(options);
    modal.mount();
    this.activeInstance = modal;
    return modal;
  }

  public static close(): void {
    if (this.activeInstance) {
      this.activeInstance.unmount();
      this.activeInstance = null;
    }
  }

  public mount(parent?: HTMLElement): void {
    const parentEl = parent || (typeof document !== 'undefined' ? document.body : null);
    if (!parentEl) return;

    this.container = document.createElement('div');
    this.container.id = 'album-merge-modal-overlay';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 4, 8, 0.85);
      backdrop-filter: blur(14px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      color: var(--color-text-primary);
      font-family: var(--font-family-base);
    `;
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-labelledby', 'album-merge-modal-title');

    parentEl.appendChild(this.container);
    this.render();
    void this.loadCandidates();
  }

  public unmount(): void {
    if (this.container) {
      if (typeof this.container.remove === 'function') {
        this.container.remove();
      } else if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
    }
    if (AlbumMergeModal.activeInstance === this) {
      AlbumMergeModal.activeInstance = null;
    }
    this.onClose?.();
  }

  public async loadCandidates(): Promise<void> {
    this.isLoading = true;
    this.render();

    try {
      this.candidates = await this.albumMergeService.findMergeCandidates();
    } catch {
      this.candidates = [];
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private async selectGroupForReview(group: AlbumMergeCandidateGroup): Promise<void> {
    this.selectedGroup = group;
    this.selectedCanonicalId = group.canonicalAlbumId;
    this.isLoading = true;
    this.statusMessage = null;
    this.render();

    try {
      const albumIds = group.albums.map(a => a.id);
      this.preview = await this.albumMergeService.getMergePreview(albumIds, this.selectedCanonicalId);
    } catch (err) {
      this.statusMessage = { type: 'error', text: String(err) };
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private async handleCanonicalChange(newCanonicalId: EntityId): Promise<void> {
    if (!this.selectedGroup) return;
    this.selectedCanonicalId = newCanonicalId;

    try {
      const albumIds = this.selectedGroup.albums.map(a => a.id);
      this.preview = await this.albumMergeService.getMergePreview(albumIds, newCanonicalId);
      this.render();
    } catch (err) {
      this.statusMessage = { type: 'error', text: String(err) };
      this.render();
    }
  }

  private async executeSelectedMerge(): Promise<void> {
    if (!this.selectedGroup || !this.selectedCanonicalId || this.isMerging) return;

    this.isMerging = true;
    this.render();

    const albumIds = this.selectedGroup.albums.map(a => a.id);
    const result = await this.albumMergeService.executeMerge(albumIds, this.selectedCanonicalId);

    this.isMerging = false;

    if (result.success) {
      this.statusMessage = {
        type: 'success',
        text: `Successfully consolidated ${result.mergedAlbumIds.length + 1} albums into "${result.canonicalAlbum.title}" (${result.affectedTrackCount} tracks updated).`
      };
      this.selectedGroup = null;
      this.preview = null;
      this.onMerged?.();
      void this.loadCandidates();
    } else {
      this.statusMessage = {
        type: 'error',
        text: result.errorMessage || 'Failed to complete album merge.'
      };
      this.render();
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="glass-panel" style="
        width: 860px;
        max-width: 95vw;
        max-height: 90vh;
        border-radius: var(--radius-2xl);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--glass-border-interactive);
        box-shadow: var(--shadow-elevation-high), 0 0 40px rgba(124, 58, 237, 0.2);
        background: var(--color-bg-surface-elevated);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          border-bottom: 1px solid var(--glass-border);
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%);
        ">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="
              width: 40px;
              height: 40px;
              border-radius: var(--radius-md);
              background: var(--gradient-primary);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              box-shadow: var(--shadow-glow-purple);
            ">
              ${getIconSvg('disc', { size: 22 })}
            </div>
            <div>
              <h2 id="album-merge-modal-title" style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.02em;">
                Album Merging & Consolidation
              </h2>
              <p style="font-size: 12px; color: var(--color-text-muted); margin: 2px 0 0 0;">
                Consolidate fragmented or duplicate album entities without altering audio files on disk
              </p>
            </div>
          </div>

          <button id="album-merge-btn-close" aria-label="Close dialog" style="
            background: transparent;
            border: none;
            color: var(--color-text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          ">
            ✕
          </button>
        </div>

        <!-- Scrollable Content -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        ">
          ${this.statusMessage ? `
            <div style="
              padding: 12px 16px;
              border-radius: var(--radius-md);
              display: flex;
              align-items: center;
              gap: 10px;
              font-size: 13px;
              font-weight: 600;
              background: ${this.statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
              border: 1px solid ${this.statusMessage.type === 'success' ? '#10b981' : '#ef4444'};
              color: ${this.statusMessage.type === 'success' ? '#10b981' : '#ef4444'};
            ">
              <span>${this.statusMessage.text}</span>
            </div>
          ` : ''}

          ${this.isLoading ? `
            <div style="padding: 40px; text-align: center; color: var(--color-text-muted); font-size: 14px;">
              Analyzing library for duplicate album candidates...
            </div>
          ` : this.selectedGroup && this.preview ? this.renderPreviewStep() : this.renderCandidateListStep()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderCandidateListStep(): string {
    if (this.candidates.length === 0) {
      return `
        <div style="
          padding: 48px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--color-text-muted);
        ">
          <div style="color: #10b981;">
            ${getIconSvg('check', { size: 40 })}
          </div>
          <h3 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 0;">No Album Duplicates Detected</h3>
          <p style="font-size: 13px; max-width: 420px; margin: 0;">
            All album records in your library have distinct identities. No fragmented candidate groups found.
          </p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 700; color: #ffffff;">
            Detected Merge Candidates (${this.candidates.length} groups)
          </span>
          <span style="font-size: 12px; color: var(--color-text-muted);">
            Click a candidate group to review and choose a canonical album
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${this.candidates.map((group, idx) => `
            <div class="glass-card" style="
              padding: 16px 20px;
              border-radius: var(--radius-lg);
              border: 1px solid var(--glass-border);
              background: rgba(255, 255, 255, 0.03);
              display: flex;
              flex-direction: column;
              gap: 12px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 15px; font-weight: 800; color: #ffffff;">
                      ${this.escapeHtml(group.albums[0]?.title || 'Untitled')}
                    </span>
                    <span style="
                      font-size: 10px;
                      font-weight: 700;
                      padding: 2px 8px;
                      border-radius: var(--radius-full);
                      background: ${group.confidence === 'high' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'};
                      color: ${group.confidence === 'high' ? '#10b981' : '#f59e0b'};
                      text-transform: uppercase;
                    ">
                      ${group.confidence} confidence
                    </span>
                  </div>
                  <span style="font-size: 12px; color: var(--color-text-muted);">
                    Artist: <strong style="color: var(--color-text-secondary);">${this.escapeHtml(group.albums[0]?.artistName || 'Unknown Artist')}</strong> • ${group.totalTracks} total tracks across ${group.albums.length} records
                  </span>
                  <span style="font-size: 11px; color: var(--color-accent-cyan); margin-top: 2px;">
                    ${group.matchReason}
                  </span>
                </div>

                <button class="album-merge-btn-review" data-group-index="${idx}" style="
                  padding: 8px 18px;
                  border-radius: var(--radius-full);
                  border: 1px solid var(--glass-border-interactive);
                  background: var(--gradient-primary);
                  color: #ffffff;
                  font-size: 12px;
                  font-weight: 700;
                  cursor: pointer;
                  white-space: nowrap;
                  box-shadow: var(--shadow-glow-purple);
                ">
                  Review & Merge
                </button>
              </div>

              <!-- List of Fragmented Albums in this Group -->
              <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.06);
              ">
                ${group.albums.map(a => `
                  <div style="
                    padding: 8px 12px;
                    border-radius: var(--radius-md);
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    font-size: 11px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                  ">
                    <span style="font-weight: 700; color: #ffffff; truncate;">"${this.escapeHtml(a.title)}"</span>
                    <span style="color: var(--color-text-muted);">${a.trackCount || 0} tracks • ${a.year || 'No year'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderPreviewStep(): string {
    if (!this.selectedGroup || !this.preview) return '';

    const canonical = this.preview.canonicalAlbum;
    const tracks = this.preview.affectedTracks;

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Back navigation button -->
        <div>
          <button id="album-merge-btn-back" style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: var(--radius-md);
            border: 1px solid var(--glass-border);
            background: rgba(255, 255, 255, 0.04);
            color: var(--color-text-secondary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          ">
            ← Back to Candidates
          </button>
        </div>

        <!-- Canonical Album Picker -->
        <div class="glass-card" style="
          padding: 16px 20px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--glass-border-interactive);
          background: rgba(124, 58, 237, 0.08);
          display: flex;
          flex-direction: column;
          gap: 12px;
        ">
          <span style="font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.04em;">
            1. Select Canonical Album
          </span>
          <p style="font-size: 12px; color: var(--color-text-muted); margin: 0;">
            The canonical album's title, artwork, and metadata will be preserved. All tracks will point to this record.
          </p>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${this.selectedGroup.albums.map(album => {
              const isSelected = album.id === this.selectedCanonicalId;
              return `
                <label style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 10px 14px;
                  border-radius: var(--radius-md);
                  border: 1px solid ${isSelected ? 'var(--color-accent-purple)' : 'var(--glass-border)'};
                  background: ${isSelected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.02)'};
                  cursor: pointer;
                ">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input
                      type="radio"
                      name="canonical-album-choice"
                      value="${album.id}"
                      ${isSelected ? 'checked' : ''}
                      class="canonical-album-radio"
                      style="cursor: pointer; accent-color: var(--color-accent-purple);"
                    />
                    <div style="display: flex; flex-direction: column;">
                      <span style="font-size: 13px; font-weight: 700; color: #ffffff;">"${this.escapeHtml(album.title)}"</span>
                      <span style="font-size: 11px; color: var(--color-text-muted);">${album.artistName || 'Unknown Artist'}${album.year ? ` • ${album.year}` : ''}</span>
                    </div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-secondary); font-weight: 600;">
                    ${album.trackCount || 0} tracks currently
                  </span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Warnings if any -->
        ${this.preview.warnings.length > 0 ? `
          <div style="
            padding: 12px 16px;
            border-radius: var(--radius-md);
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            display: flex;
            flex-direction: column;
            gap: 4px;
          ">
            <span style="font-size: 12px; font-weight: 700; color: #f59e0b;">Merge Warnings:</span>
            ${this.preview.warnings.map(w => `
              <span style="font-size: 11px; color: var(--color-text-secondary);">• ${this.escapeHtml(w)}</span>
            `).join('')}
          </div>
        ` : ''}

        <!-- Affected Tracks List -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 13px; font-weight: 700; color: #ffffff;">
              2. Affected Tracks (${tracks.length} tracks will belong to "${this.escapeHtml(canonical.title)}")
            </span>
            <span style="font-size: 11px; color: var(--color-text-muted);">
              Track IDs and physical files are 100% preserved
            </span>
          </div>

          <div style="
            max-height: 200px;
            overflow-y: auto;
            border-radius: var(--radius-md);
            border: 1px solid var(--glass-border);
            background: rgba(0, 0, 0, 0.2);
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          ">
            ${tracks.map((t, idx) => `
              <div style="
                padding: 6px 10px;
                border-radius: var(--radius-sm);
                background: rgba(255, 255, 255, 0.02);
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 12px;
              ">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                  <span style="font-size: 10px; color: var(--color-text-muted); width: 18px;">${idx + 1}.</span>
                  <span style="font-weight: 600; color: var(--color-text-primary); truncate;">${this.escapeHtml(t.title)}</span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">(${this.escapeHtml(t.albumTitle || 'Unknown')})</span>
                </div>
                <span style="font-size: 10px; color: var(--color-accent-purple-glow); font-weight: 600;">
                  ID preserved
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Confirm Action Button -->
        <div style="
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--glass-border);
        ">
          <button id="album-merge-btn-cancel-preview" style="
            padding: 10px 20px;
            border-radius: var(--radius-full);
            border: 1px solid var(--glass-border);
            background: transparent;
            color: var(--color-text-secondary);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          ">
            Cancel
          </button>
          <button id="album-merge-btn-confirm" ${this.isMerging ? 'disabled' : ''} style="
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: var(--radius-full);
            border: none;
            background: var(--gradient-primary);
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            cursor: ${this.isMerging ? 'not-allowed' : 'pointer'};
            box-shadow: var(--shadow-glow-purple);
            opacity: ${this.isMerging ? '0.6' : '1'};
          ">
            <span>${this.isMerging ? 'Merging Albums...' : 'Confirm & Merge Albums'}</span>
          </button>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelector('#album-merge-btn-close')?.addEventListener('click', () => {
      this.unmount();
    });

    const reviewButtons = this.container.querySelectorAll<HTMLButtonElement>('.album-merge-btn-review');
    reviewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-group-index'));
        const group = this.candidates[idx];
        if (group) {
          void this.selectGroupForReview(group);
        }
      });
    });

    this.container.querySelector('#album-merge-btn-back')?.addEventListener('click', () => {
      this.selectedGroup = null;
      this.preview = null;
      this.render();
    });

    this.container.querySelector('#album-merge-btn-cancel-preview')?.addEventListener('click', () => {
      this.selectedGroup = null;
      this.preview = null;
      this.render();
    });

    const canonicalRadios = this.container.querySelectorAll<HTMLInputElement>('.canonical-album-radio');
    canonicalRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          void this.handleCanonicalChange(radio.value);
        }
      });
    });

    this.container.querySelector('#album-merge-btn-confirm')?.addEventListener('click', () => {
      void this.executeSelectedMerge();
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
