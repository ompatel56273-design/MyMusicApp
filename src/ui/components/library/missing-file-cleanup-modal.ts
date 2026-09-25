import type { IMissingFileScannerService } from '../../../services/contracts/service-contracts';
import type {
  MissingFileScanSummary,
  MissingFileScanResultItem,
  MissingFileScanProgress
} from '../../../domain/entities/cleanup-types';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface MissingFileCleanupModalProps {
  readonly cleanupService: IMissingFileScannerService;
  readonly onClose: () => void;
  readonly onCompleted?: (() => void) | undefined;
}

type ModalState = 'idle' | 'scanning' | 'results' | 'confirming' | 'cleaning' | 'done';

/**
 * Production Missing-File Cleanup Modal Component.
 * Provides interactive scanning, verification summary, track selection, and safe database record removal.
 */
export class MissingFileCleanupModalComponent {
  private readonly cleanupService: IMissingFileScannerService;
  private readonly onClose: () => void;
  private readonly onCompleted?: (() => void) | undefined;

  private backdropEl: HTMLElement | null = null;
  private state: ModalState = 'idle';
  private abortController: AbortController | null = null;
  private currentProgress: MissingFileScanProgress | null = null;
  private scanSummary: MissingFileScanSummary | null = null;
  private selectedTrackIds = new Set<string>();
  private cleanedCount = 0;

  constructor(props: MissingFileCleanupModalProps) {
    this.cleanupService = props.cleanupService;
    this.onClose = props.onClose;
    this.onCompleted = props.onCompleted;
  }

  public mount(container: HTMLElement): void {
    this.backdropEl = document.createElement('div');
    this.backdropEl.id = 'missing-file-cleanup-modal-backdrop';
    this.backdropEl.className = 'app-modal-backdrop';
    this.backdropEl.setAttribute('role', 'dialog');
    this.backdropEl.setAttribute('aria-modal', 'true');
    this.backdropEl.setAttribute('aria-labelledby', 'cleanup-modal-title');
    this.backdropEl.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: var(--z-modal, 1000);
      background: rgba(6, 6, 10, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4, 16px);
      box-sizing: border-box;
      animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    container.appendChild(this.backdropEl);
    this.render();
  }

  public unmount(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.backdropEl) {
      this.backdropEl.remove();
      this.backdropEl = null;
    }
  }

  private render(): void {
    if (!this.backdropEl) return;

    this.backdropEl.innerHTML = `
      <div
        class="glass-panel-elevated"
        style="
          width: 100%;
          max-width: 720px;
          max-height: 88vh;
          background: linear-gradient(145deg, rgba(26, 26, 36, 0.95) 0%, rgba(15, 15, 23, 0.98) 100%);
          border: 1px solid var(--glass-border-interactive, rgba(255, 255, 255, 0.15));
          border-radius: var(--radius-2xl, 24px);
          box-shadow: var(--shadow-elevation-high, 0 20px 48px rgba(0, 0, 0, 0.6)), 0 0 32px rgba(124, 58, 237, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
        "
      >
        <!-- Modal Header -->
        <header
          style="
            padding: var(--space-5, 20px) var(--space-6, 24px);
            border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-3, 12px);
          "
        >
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; color: #f87171;">
              ${getIconSvg('trash', { size: 18, color: '#f87171' })}
            </div>
            <div>
              <h2 id="cleanup-modal-title" style="margin: 0; font-size: var(--font-size-lg, 18px); font-weight: var(--font-weight-bold, 700); color: #ffffff;">
                Missing-File Library Cleanup
              </h2>
              <p style="margin: 2px 0 0; font-size: var(--font-size-xs, 12px); color: var(--color-text-secondary, #a1a1aa);">
                Find and remove broken track records without modifying files on disk
              </p>
            </div>
          </div>

          <button
            id="cleanup-close-btn"
            aria-label="Close cleanup dialog"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-muted, #71717a);
              cursor: pointer;
              padding: 8px;
              border-radius: var(--radius-full, 9999px);
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all var(--duration-fast, 150ms) ease;
            "
          >
            ${getIconSvg('close', { size: 20 })}
          </button>
        </header>

        <!-- Modal Body Content -->
        <div style="padding: var(--space-6, 24px); overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-4, 16px);">
          ${this.renderBodyState()}
        </div>

        <!-- Modal Footer -->
        <footer
          style="
            padding: var(--space-4, 16px) var(--space-6, 24px);
            border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
            background: rgba(10, 10, 15, 0.6);
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: var(--space-3, 12px);
          "
        >
          ${this.renderFooterActions()}
        </footer>
      </div>
    `;

    this.bindEvents();
  }

  private renderBodyState(): string {
    switch (this.state) {
      case 'idle':
        return `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: rgba(124, 58, 237, 0.08); border: 1px solid rgba(124, 58, 237, 0.2); border-radius: var(--radius-lg, 12px); padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
              <span style="color: var(--color-accent-purple-glow, #c084fc); flex-shrink: 0; margin-top: 2px;">
                ${getIconSvg('info', { size: 20 })}
              </span>
              <div style="font-size: var(--font-size-xs, 13px); line-height: 1.5; color: var(--color-text-secondary, #d4d4d8);">
                <strong style="color: #ffffff;">How Missing-File Cleanup works:</strong><br/>
                • Verifies all tracks in your local library against their registered file paths.<br/>
                • Identifies tracks whose underlying files were deleted, moved, or renamed outside the app.<br/>
                • Allows you to selectively remove stale database records.<br/>
                • <strong style="color: #38bdf8;">Your actual audio files on disk will NEVER be modified or deleted.</strong>
              </div>
            </div>

            <div style="display: flex; justify-content: center; padding: 24px 0;">
              <button
                id="cleanup-start-scan-btn"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 10px;
                  padding: 12px 28px;
                  border-radius: var(--radius-full, 9999px);
                  background: linear-gradient(135deg, var(--color-accent-purple, #7c3aed) 0%, #9333ea 100%);
                  color: #ffffff;
                  font-weight: var(--font-weight-bold, 700);
                  font-size: var(--font-size-sm, 14px);
                  border: none;
                  cursor: pointer;
                  box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
                  transition: all var(--duration-fast, 150ms) ease;
                "
              >
                ${getIconSvg('search', { size: 18, color: '#ffffff' })}
                <span>Scan Library for Missing Files</span>
              </button>
            </div>
          </div>
        `;

      case 'scanning':
        const prog = this.currentProgress || { current: 0, total: 0, percent: 0 };
        return `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; gap: 20px;">
            <div style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; inset: 0; border: 3px solid rgba(124, 58, 237, 0.2); border-top-color: var(--color-accent-purple, #7c3aed); border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span style="color: var(--color-accent-purple, #a855f7);">${getIconSvg('music', { size: 24 })}</span>
            </div>

            <div style="text-align: center; width: 100%; max-width: 460px;">
              <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #ffffff;">Checking Library Files…</h3>
              <p style="margin: 0 0 14px; font-size: 13px; color: var(--color-text-secondary, #a1a1aa);">
                Verifying file existence and permissions: ${prog.current} of ${prog.total} tracks (${prog.percent}%)
              </p>

              <!-- Progress Bar -->
              <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 999px; overflow: hidden;">
                <div style="height: 100%; width: ${prog.percent}%; background: linear-gradient(90deg, #7c3aed, #06b6d4); border-radius: 999px; transition: width 0.15s ease-out;"></div>
              </div>

              ${prog.currentPath ? `
                <p style="margin: 10px 0 0; font-size: 11px; color: var(--color-text-muted, #71717a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace;">
                  ${escapeHtml(prog.currentPath)}
                </p>
              ` : ''}
            </div>
          </div>
        `;

      case 'results':
      case 'confirming':
        if (!this.scanSummary) return '';
        const s = this.scanSummary;
        const missingCount = s.missingCount;

        return `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Metrics Bar -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px;">
              <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--glass-border); border-radius: 12px; padding: 10px 14px; text-align: center;">
                <div style="font-size: 11px; color: var(--color-text-secondary); text-transform: uppercase;">Checked</div>
                <div style="font-size: 18px; font-weight: 800; color: #ffffff; margin-top: 2px;">${s.totalChecked}</div>
              </div>
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 10px 14px; text-align: center;">
                <div style="font-size: 11px; color: #34d399; text-transform: uppercase;">Available</div>
                <div style="font-size: 18px; font-weight: 800; color: #34d399; margin-top: 2px;">${s.availableCount}</div>
              </div>
              <div style="background: ${missingCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${missingCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--glass-border)'}; border-radius: 12px; padding: 10px 14px; text-align: center;">
                <div style="font-size: 11px; color: ${missingCount > 0 ? '#f87171' : 'var(--color-text-secondary)'}; text-transform: uppercase;">Missing</div>
                <div style="font-size: 18px; font-weight: 800; color: ${missingCount > 0 ? '#f87171' : '#ffffff'}; margin-top: 2px;">${s.missingCount}</div>
              </div>
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; padding: 10px 14px; text-align: center;">
                <div style="font-size: 11px; color: #fbbf24; text-transform: uppercase;">Unverifiable</div>
                <div style="font-size: 18px; font-weight: 800; color: #fbbf24; margin-top: 2px;">${s.unverifiableCount}</div>
              </div>
            </div>

            ${this.state === 'confirming' ? `
              <!-- Confirmation Warning Banner -->
              <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 16px; display: flex; gap: 12px; align-items: center;">
                <span style="color: #f87171; flex-shrink: 0;">${getIconSvg('info', { size: 24, color: '#f87171' })}</span>
                <div style="font-size: 13px; color: #fecaca; line-height: 1.4;">
                  <strong style="color: #ffffff; font-size: 14px;">Confirm Library Cleanup</strong><br/>
                  Are you sure you want to remove <strong>${this.selectedTrackIds.size} missing track record(s)</strong> from your library database?
                  <div style="margin-top: 4px; font-size: 11px; color: #fca5a5;">
                    ✓ Your actual physical files on disk will NEVER be deleted or modified.
                  </div>
                </div>
              </div>
            ` : ''}

            ${missingCount === 0 ? `
              <div style="padding: 36px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div style="width: 52px; height: 52px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; color: #34d399;">
                  ${getIconSvg('check', { size: 28, color: '#34d399' })}
                </div>
                <h3 style="margin: 0; font-size: 16px; color: #ffffff;">All Library Files Accessible</h3>
                <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary); max-width: 400px;">
                  All ${s.availableCount} verified tracks correspond to accessible audio files in your local storage.
                </p>
              </div>
            ` : `
              <!-- Missing Tracks List & Selection Controls -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button
                    id="cleanup-select-all-btn"
                    style="background: var(--glass-bg-subtle, rgba(255,255,255,0.06)); border: 1px solid var(--glass-border); color: #ffffff; padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; font-weight: 600;"
                  >
                    Select All (${s.missingTracks.length})
                  </button>
                  <button
                    id="cleanup-deselect-all-btn"
                    style="background: transparent; border: 1px solid var(--glass-border); color: var(--color-text-secondary); padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer;"
                  >
                    Deselect All
                  </button>
                </div>
                <div style="font-size: 12px; color: var(--color-text-secondary); font-weight: 600;">
                  Selected: <span style="color: #ffffff;">${this.selectedTrackIds.size}</span> / ${s.missingTracks.length}
                </div>
              </div>

              <div
                style="
                  max-height: 260px;
                  overflow-y: auto;
                  background: rgba(0, 0, 0, 0.3);
                  border: 1px solid var(--glass-border);
                  border-radius: 12px;
                  padding: 4px;
                "
              >
                ${s.missingTracks.map(item => this.renderTrackRow(item)).join('')}
              </div>
            `}
          </div>
        `;

      case 'cleaning':
        return `
          <div style="padding: 40px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div style="width: 48px; height: 48px; border: 3px solid rgba(239, 68, 68, 0.2); border-top-color: #f87171; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <h3 style="margin: 0; font-size: 16px; color: #ffffff;">Removing Stale Library Records…</h3>
            <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary);">
              Cleaning up selected track references and updating library indices.
            </p>
          </div>
        `;

      case 'done':
        return `
          <div style="padding: 36px 16px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; color: #34d399;">
              ${getIconSvg('check', { size: 30, color: '#34d399' })}
            </div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">Library Cleaned Successfully!</h3>
            <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary); max-width: 420px;">
              Removed <strong>${this.cleanedCount}</strong> stale track record(s) from your local library database. Audio Galaxy and Library tallies have been updated.
            </p>
          </div>
        `;
    }
  }

  private renderTrackRow(item: MissingFileScanResultItem): string {
    const isSelected = this.selectedTrackIds.has(item.trackId);
    return `
      <div
        class="cleanup-track-row"
        data-track-id="${item.trackId}"
        style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 8px;
          background: ${isSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent'};
          cursor: pointer;
          transition: background 0.15s ease;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        "
      >
        <input
          type="checkbox"
          class="cleanup-track-checkbox"
          data-track-id="${item.trackId}"
          ${isSelected ? 'checked' : ''}
          style="cursor: pointer; width: 16px; height: 16px; accent-color: #ef4444;"
        />
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 13px; font-weight: 600; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(item.trackTitle)}
          </div>
          <div style="font-size: 11px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(item.artistName)} • ${escapeHtml(item.albumTitle)}
          </div>
          <div style="font-size: 10px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace;">
            ${escapeHtml(item.path)}
          </div>
        </div>
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 8px; border-radius: 999px;">
          Missing
        </span>
      </div>
    `;
  }

  private renderFooterActions(): string {
    switch (this.state) {
      case 'idle':
        return `
          <button id="cleanup-cancel-btn" style="background: transparent; border: 1px solid var(--glass-border); color: var(--color-text-secondary); padding: 8px 18px; border-radius: 999px; font-size: 13px; cursor: pointer;">
            Cancel
          </button>
        `;

      case 'scanning':
        return `
          <button id="cleanup-abort-scan-btn" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 8px 18px; border-radius: 999px; font-size: 13px; cursor: pointer; font-weight: 600;">
            Cancel Scan
          </button>
        `;

      case 'results':
        const count = this.scanSummary?.missingCount ?? 0;
        return `
          <button id="cleanup-rescan-btn" style="background: transparent; border: 1px solid var(--glass-border); color: var(--color-text-secondary); padding: 8px 18px; border-radius: 999px; font-size: 13px; cursor: pointer;">
            Rescan
          </button>
          ${count > 0 ? `
            <button
              id="cleanup-proceed-btn"
              ${this.selectedTrackIds.size === 0 ? 'disabled' : ''}
              style="
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                border: none;
                color: #ffffff;
                padding: 8px 20px;
                border-radius: 999px;
                font-size: 13px;
                font-weight: 700;
                cursor: ${this.selectedTrackIds.size === 0 ? 'not-allowed' : 'pointer'};
                opacity: ${this.selectedTrackIds.size === 0 ? '0.5' : '1'};
                box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
              "
            >
              Remove Selected (${this.selectedTrackIds.size})
            </button>
          ` : `
            <button id="cleanup-done-btn" style="background: var(--color-accent-purple, #7c3aed); border: none; color: #ffffff; padding: 8px 20px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer;">
              Done
            </button>
          `}
        `;

      case 'confirming':
        return `
          <button id="cleanup-back-to-results-btn" style="background: transparent; border: 1px solid var(--glass-border); color: var(--color-text-secondary); padding: 8px 18px; border-radius: 999px; font-size: 13px; cursor: pointer;">
            Back
          </button>
          <button
            id="cleanup-execute-btn"
            style="
              background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
              border: none;
              color: #ffffff;
              padding: 8px 22px;
              border-radius: 999px;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 4px 18px rgba(239, 68, 68, 0.5);
            "
          >
            Confirm & Remove (${this.selectedTrackIds.size})
          </button>
        `;

      case 'cleaning':
        return '';

      case 'done':
        return `
          <button id="cleanup-finish-btn" style="background: linear-gradient(135deg, var(--color-accent-purple, #7c3aed) 0%, #9333ea 100%); border: none; color: #ffffff; padding: 8px 22px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer;">
            Close
          </button>
        `;
    }
  }

  private bindEvents(): void {
    if (!this.backdropEl) return;

    // Close button
    this.backdropEl.querySelector('#cleanup-close-btn')?.addEventListener('click', () => this.handleClose());
    this.backdropEl.querySelector('#cleanup-cancel-btn')?.addEventListener('click', () => this.handleClose());
    this.backdropEl.querySelector('#cleanup-done-btn')?.addEventListener('click', () => this.handleClose());
    this.backdropEl.querySelector('#cleanup-finish-btn')?.addEventListener('click', () => this.handleClose());

    // Start scan button
    this.backdropEl.querySelector('#cleanup-start-scan-btn')?.addEventListener('click', () => this.startScan());
    this.backdropEl.querySelector('#cleanup-rescan-btn')?.addEventListener('click', () => this.startScan());

    // Abort scan button
    this.backdropEl.querySelector('#cleanup-abort-scan-btn')?.addEventListener('click', () => {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.state = 'idle';
      this.render();
    });

    // Select all / Deselect all
    this.backdropEl.querySelector('#cleanup-select-all-btn')?.addEventListener('click', () => {
      if (this.scanSummary) {
        this.selectedTrackIds = new Set(this.scanSummary.missingTracks.map(t => t.trackId));
        this.render();
      }
    });

    this.backdropEl.querySelector('#cleanup-deselect-all-btn')?.addEventListener('click', () => {
      this.selectedTrackIds.clear();
      this.render();
    });

    // Row selection toggles
    this.backdropEl.querySelectorAll('.cleanup-track-checkbox').forEach(cb => {
      cb.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const trackId = target.dataset['trackId'];
        if (!trackId) return;

        if (target.checked) {
          this.selectedTrackIds.add(trackId);
        } else {
          this.selectedTrackIds.delete(trackId);
        }
        this.render();
      });
    });

    // Proceed to confirmation
    this.backdropEl.querySelector('#cleanup-proceed-btn')?.addEventListener('click', () => {
      if (this.selectedTrackIds.size > 0) {
        this.state = 'confirming';
        this.render();
      }
    });

    // Back from confirmation
    this.backdropEl.querySelector('#cleanup-back-to-results-btn')?.addEventListener('click', () => {
      this.state = 'results';
      this.render();
    });

    // Execute cleanup
    this.backdropEl.querySelector('#cleanup-execute-btn')?.addEventListener('click', () => this.executeCleanup());
  }

  private async startScan(): Promise<void> {
    this.state = 'scanning';
    this.currentProgress = { current: 0, total: 0, percent: 0 };
    this.abortController = new AbortController();
    this.render();

    try {
      const summary = await this.cleanupService.scanMissingFiles({
        signal: this.abortController.signal,
        onProgress: (prog) => {
          this.currentProgress = prog;
          if (this.state === 'scanning') {
            this.render();
          }
        }
      });

      this.scanSummary = summary;
      // Default select all missing tracks
      this.selectedTrackIds = new Set(summary.missingTracks.map(t => t.trackId));
      this.state = 'results';
      this.render();
    } catch (err: unknown) {
      if (this.abortController?.signal.aborted) {
        this.state = 'idle';
      } else {
        this.state = 'idle';
      }
      this.render();
    } finally {
      this.abortController = null;
    }
  }

  private async executeCleanup(): Promise<void> {
    if (this.selectedTrackIds.size === 0) return;

    this.state = 'cleaning';
    this.render();

    try {
      const result = await this.cleanupService.cleanupMissingTracks(Array.from(this.selectedTrackIds));
      this.cleanedCount = result.removedTrackCount;
      this.state = 'done';
      this.onCompleted?.();
      this.render();
    } catch {
      this.state = 'results';
      this.render();
    }
  }

  private handleClose(): void {
    this.unmount();
    this.onClose();
  }
}
