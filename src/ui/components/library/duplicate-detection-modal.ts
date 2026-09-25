import type {
  IDuplicateDetectorService
} from '../../../services/contracts/service-contracts';
import type {
  DuplicateScanResult,
  DuplicateResolutionAction
} from '../../../domain/entities/duplicate-types';
import { getIconSvg } from '../../icons/icon-registry';

export interface DuplicateDetectionModalOptions {
  duplicateDetector: IDuplicateDetectorService;
  onCompleted?: () => void;
  onClose?: () => void;
}

/**
 * Duplicate Detection & Library Resolution Modal.
 * Discovers duplicate tracks using layered detection heuristics (exact file,
 * metadata fingerprint, duration) and provides non-destructive database-only cleanup.
 */
export class DuplicateDetectionModalComponent {
  private static activeInstance: HTMLElement | null = null;

  public static show(options: DuplicateDetectionModalOptions): HTMLElement {
    if (this.activeInstance) {
      this.close();
    }

    const { duplicateDetector, onCompleted, onClose } = options;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay duplicate-modal-overlay';
    overlay.id = 'duplicate-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.78)';
    overlay.style.backdropFilter = 'blur(14px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1100';
    overlay.style.padding = 'var(--space-4)';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'duplicate-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '760px';
    modal.style.maxHeight = '88vh';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 32px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';
    modal.style.color = 'var(--color-text-primary)';
    modal.style.fontFamily = 'var(--font-family-base)';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.activeInstance = overlay;

    const closeModal = () => {
      DuplicateDetectionModalComponent.close();
      onClose?.();
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handleKeyDown);
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Initial Loading State
    modal.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(124, 58, 237, 0.4); display: flex; align-items: center; justify-content: center; color: var(--color-accent-purple-glow);">
            ${getIconSvg('filter', { size: 18 })}
          </div>
          <div>
            <h2 id="duplicate-modal-title" style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">Duplicate Detection</h2>
            <span style="font-size: 12px; color: var(--color-text-secondary);">Analyzing local library...</span>
          </div>
        </div>
        <button id="dup-close-btn" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px; border-radius: var(--radius-md); display: flex;">
          ${getIconSvg('close', { size: 20 })}
        </button>
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 16px;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(124, 58, 237, 0.2); border-top-color: var(--color-accent-cyan); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <span style="font-size: 14px; color: var(--color-text-secondary);">Scanning tracks and comparing audio fingerprints...</span>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;

    modal.querySelector('#dup-close-btn')?.addEventListener('click', closeModal);

    // Run Detection
    void (async () => {
      try {
        const scanResult: DuplicateScanResult = await duplicateDetector.detectDuplicates();
        this.renderResults(modal, scanResult, duplicateDetector, closeModal, onCompleted);
      } catch (err) {
        modal.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">Duplicate Detection</h2>
            <button id="dup-err-close-btn" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px;">
              ${getIconSvg('close', { size: 20 })}
            </button>
          </div>
          <div style="padding: 40px 20px; text-align: center; color: #ef4444; font-size: 14px;">
            Error detecting duplicates: ${String(err)}
          </div>
        `;
        modal.querySelector('#dup-err-close-btn')?.addEventListener('click', closeModal);
      }
    })();

    return overlay;
  }

  public static close(): void {
    if (this.activeInstance) {
      this.activeInstance.remove();
      this.activeInstance = null;
    }
  }

  private static renderResults(
    modal: HTMLElement,
    result: DuplicateScanResult,
    duplicateDetector: IDuplicateDetectorService,
    closeModal: () => void,
    onCompleted?: () => void
  ): void {
    if (result.groups.length === 0) {
      modal.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; color: #10b981;">
              ${getIconSvg('check', { size: 20 })}
            </div>
            <div>
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">Duplicate Detection</h2>
              <span style="font-size: 12px; color: var(--color-text-secondary);">Analysis complete</span>
            </div>
          </div>
          <button id="dup-empty-close-btn" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px;">
            ${getIconSvg('close', { size: 20 })}
          </button>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px 20px; gap: 12px; text-align: center;">
          <div style="color: #10b981;">${getIconSvg('check', { size: 48 })}</div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #ffffff;">No Duplicates Found</h3>
          <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary); max-width: 420px; line-height: 1.5;">
            Every track in your music library has unique audio content and metadata. No duplicate items detected.
          </p>
          <button id="dup-done-btn" style="margin-top: 16px; padding: 10px 24px; border-radius: var(--radius-full); background: var(--color-accent-purple); color: #ffffff; border: none; font-size: 13px; font-weight: 600; cursor: pointer;">
            Close
          </button>
        </div>
      `;
      modal.querySelector('#dup-empty-close-btn')?.addEventListener('click', closeModal);
      modal.querySelector('#dup-done-btn')?.addEventListener('click', closeModal);
      return;
    }

    const formatBytes = (bytes: number): string => {
      if (bytes <= 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    };

    const formatDur = (ms: number): string => {
      if (!ms || ms <= 0) return '0:00';
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const badgeColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
      exact_file: { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.4)', text: '#f472b6', label: 'Exact File' },
      exact_metadata: { bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', text: '#38bdf8', label: 'Exact Metadata' },
      high_confidence: { bg: 'rgba(124, 58, 237, 0.15)', border: 'rgba(124, 58, 237, 0.4)', text: '#a78bfa', label: 'High Confidence' },
      likely_duplicate: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24', label: 'Likely Duplicate' }
    };

    modal.innerHTML = `
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: rgba(124, 58, 237, 0.2); border: 1px solid rgba(124, 58, 237, 0.4); display: flex; align-items: center; justify-content: center; color: var(--color-accent-purple-glow);">
            ${getIconSvg('filter', { size: 18 })}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">Duplicate Detection</h2>
            <span style="font-size: 12px; color: var(--color-text-secondary);">
              ${result.totalGroups} groups found • ${result.totalDuplicateTracks} candidate duplicates
            </span>
          </div>
        </div>
        <button id="dup-results-close-btn" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; padding: 6px;">
          ${getIconSvg('close', { size: 20 })}
        </button>
      </div>

      <!-- Stats Banner -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-lg); background: rgba(255, 255, 255, 0.04); border: 1px solid var(--glass-border); margin-bottom: var(--space-3); flex-shrink: 0; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--color-accent-cyan); font-weight: 600;">Potential Storage Savings:</span>
          <span style="color: #ffffff; font-weight: 700;">${formatBytes(result.potentialSavingsBytes)}</span>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="dup-select-all" style="background: transparent; border: none; color: var(--color-accent-purple-glow); cursor: pointer; font-size: 12px; font-weight: 600;">Select All</button>
          <span style="color: var(--color-text-dim);">|</span>
          <button id="dup-deselect-all" style="background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 12px;">Deselect All</button>
        </div>
      </div>

      <!-- Scrollable Groups List -->
      <div id="dup-groups-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px; min-height: 200px;">
        ${result.groups
          .map(group => {
            const badge = badgeColors[group.matchLevel] ?? badgeColors.high_confidence!;
            return `
            <div class="dup-group-card" style="border: 1px solid var(--glass-border); border-radius: var(--radius-xl); background: rgba(255, 255, 255, 0.02); overflow: hidden;">
              <!-- Group Header -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                  <span style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${escapeHtml(group.primaryTrack.title)}
                  </span>
                  <span style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap;">
                    by ${escapeHtml(group.primaryTrack.artistName ?? 'Unknown Artist')}
                  </span>
                </div>
                <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: var(--radius-full); background: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.text}; flex-shrink: 0;">
                  ${badge.label}
                </span>
              </div>

              <!-- Group Content -->
              <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px;">
                <!-- Primary Track (Keep) -->
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25);">
                  <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #10b981; background: rgba(16, 185, 129, 0.2); padding: 2px 6px; border-radius: var(--radius-sm); flex-shrink: 0;">
                    KEEP
                  </span>
                  <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 12px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml(group.primaryTrack.title)}
                    </span>
                    <span style="font-size: 11px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml((group.primaryTrack as any).path || group.primaryTrack.albumTitle || group.primaryTrack.id)}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-text-secondary); flex-shrink: 0;">
                    <span>${(group.primaryTrack.format?.container || 'audio').toUpperCase()}</span>
                    <span>•</span>
                    <span>${group.primaryTrack.format?.bitrate ? `${group.primaryTrack.format.bitrate} kbps` : ''}</span>
                    <span>•</span>
                    <span style="font-variant-numeric: tabular-nums;">${formatDur(group.primaryTrack.durationMs)}</span>
                  </div>
                </div>

                <!-- Duplicate Candidates (ToRemove) -->
                ${group.candidates
                  .map(candidate => `
                  <label style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); cursor: pointer;">
                    <input type="checkbox" class="dup-candidate-checkbox" data-track-id="${candidate.track.id}" checked style="accent-color: var(--color-accent-purple); width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;" />
                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 12px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${escapeHtml(candidate.track.title)}
                        </span>
                        <span style="font-size: 10px; color: #f87171; background: rgba(239, 68, 68, 0.15); padding: 1px 5px; border-radius: var(--radius-sm); white-space: nowrap;">
                          Duplicate
                        </span>
                      </div>
                      <span style="font-size: 11px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHtml((candidate.track as any).path || candidate.reason)}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--color-text-secondary); flex-shrink: 0;">
                      <span>${(candidate.track.format?.container || 'audio').toUpperCase()}</span>
                      <span>•</span>
                      <span>${candidate.track.format?.bitrate ? `${candidate.track.format.bitrate} kbps` : ''}</span>
                      <span>•</span>
                      <span style="font-variant-numeric: tabular-nums;">${formatDur(candidate.track.durationMs)}</span>
                    </div>
                  </label>
                `)
                  .join('')}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>

      <!-- Footer Actions -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: var(--space-4); margin-top: var(--space-2); border-top: 1px solid var(--glass-border); flex-shrink: 0;">
        <span style="font-size: 11px; color: var(--color-text-muted);">
          Non-destructive: Removes records from library only. Audio files on disk are safe.
        </span>
        <div style="display: flex; align-items: center; gap: var(--space-3);">
          <button id="dup-cancel-btn" style="padding: 10px 20px; border-radius: var(--radius-full); background: transparent; border: 1px solid var(--glass-border-interactive); color: var(--color-text-secondary); font-size: 13px; font-weight: 600; cursor: pointer;">
            Cancel
          </button>
          <button id="dup-resolve-btn" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: var(--radius-full); background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; border: none; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);">
            <span>Remove Selected (<span id="dup-selected-count">${result.totalDuplicateTracks}</span>)</span>
          </button>
        </div>
      </div>
    `;

    modal.querySelector('#dup-results-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#dup-cancel-btn')?.addEventListener('click', closeModal);

    const checkboxes = modal.querySelectorAll<HTMLInputElement>('.dup-candidate-checkbox');
    const selectedCountEl = modal.querySelector('#dup-selected-count');

    const updateCount = () => {
      let count = 0;
      checkboxes.forEach(cb => {
        if (cb.checked) count++;
      });
      if (selectedCountEl) selectedCountEl.textContent = String(count);
    };

    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateCount);
    });

    modal.querySelector('#dup-select-all')?.addEventListener('click', () => {
      checkboxes.forEach(cb => { cb.checked = true; });
      updateCount();
    });

    modal.querySelector('#dup-deselect-all')?.addEventListener('click', () => {
      checkboxes.forEach(cb => { cb.checked = false; });
      updateCount();
    });

    modal.querySelector('#dup-resolve-btn')?.addEventListener('click', () => {
      const actions: DuplicateResolutionAction[] = [];
      checkboxes.forEach(cb => {
        if (cb.checked) {
          const trackId = cb.getAttribute('data-track-id');
          if (trackId) {
            actions.push({ trackId, action: 'remove_from_library' });
          }
        }
      });

      if (actions.length === 0) {
        alert('Please select at least one duplicate track to remove.');
        return;
      }

      if (!confirm(`Are you sure you want to remove ${actions.length} duplicate track(s) from your library? (Audio files will not be deleted from disk)`)) {
        return;
      }

      void (async () => {
        const resolveBtn = modal.querySelector<HTMLButtonElement>('#dup-resolve-btn');
        if (resolveBtn) {
          resolveBtn.disabled = true;
          resolveBtn.textContent = 'Removing...';
        }

        const res = await duplicateDetector.resolveDuplicates(actions);
        alert(`Successfully removed ${res.removedCount} duplicate track(s) from your library.`);
        closeModal();
        onCompleted?.();
      })();
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
