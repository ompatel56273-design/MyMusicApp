import type { DuplicateDetectorService } from '../../../services/duplicate/duplicate-detector-service';
import type { DuplicateDetectionSummary, DuplicateResolutionPlan } from '../../../domain/entities/duplicate-types';
import { getIconSvg } from '../../icons/icon-registry';

export interface DuplicateModalOptions {
  duplicateDetectorService: DuplicateDetectorService;
  onResolved?: () => void;
}

export class DuplicateDetectionModal {
  private container: HTMLElement | null = null;
  private readonly duplicateDetectorService: DuplicateDetectorService;
  private readonly onResolved?: (() => void) | undefined;
  private summary: DuplicateDetectionSummary | null = null;
  private selectedTrackIds = new Set<string>();
  private isScanning = true;
  private isResolving = false;

  constructor(options: DuplicateModalOptions) {
    this.duplicateDetectorService = options.duplicateDetectorService;
    this.onResolved = options.onResolved;
  }

  public mount(parent: HTMLElement = document.body): void {
    this.container = document.createElement('div');
    this.container.id = 'duplicate-detection-modal-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 4, 8, 0.82);
      backdrop-filter: blur(12px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    parent.appendChild(this.container);
    this.render();
    this.runScan();
  }

  public unmount(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }

  private async runScan(): Promise<void> {
    this.isScanning = true;
    this.render();

    try {
      this.summary = await this.duplicateDetectorService.detectDuplicates();
      this.selectedTrackIds.clear();
      if (this.summary) {
        for (const group of this.summary.groups) {
          for (const dup of group.duplicateTracks) {
            this.selectedTrackIds.add(dup.id);
          }
        }
      }
    } catch {
      this.summary = {
        totalTracksScanned: 0,
        duplicateGroupsFound: 0,
        totalDuplicatesFound: 0,
        potentialSpaceSavingsBytes: 0,
        groups: []
      };
    } finally {
      this.isScanning = false;
      this.render();
    }
  }

  private render(): void {
    if (!this.container) return;

    if (this.isScanning) {
      this.container.innerHTML = `
        <div class="glass-panel" style="
          width: 480px;
          padding: 32px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          text-align: center;
          box-shadow: var(--shadow-xl);
          border: 1px solid var(--glass-border);
        ">
          <div style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid rgba(168, 85, 247, 0.2); border-top-color: var(--color-accent-purple-glow); animation: spin 1s linear infinite;"></div>
          <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
          <span style="font-size: 16px; font-weight: 600; color: var(--color-text-primary);">Analyzing Library for Duplicates...</span>
          <span style="font-size: 13px; color: var(--color-text-muted);">Comparing audio metadata, durations, and file hashes</span>
        </div>
      `;
      return;
    }

    const groups = this.summary?.groups || [];
    const totalSelected = this.selectedTrackIds.size;
    const formattedBytes = this.formatBytes(this.summary?.potentialSpaceSavingsBytes || 0);

    this.container.innerHTML = `
      <div class="glass-panel" style="
        width: 760px;
        max-width: 95vw;
        max-height: 85vh;
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--glass-border);
        box-shadow: var(--shadow-xl);
        background: var(--color-bg-surface-elevated);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--glass-border);
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: var(--radius-md);
              background: rgba(168, 85, 247, 0.15);
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--color-accent-purple-glow);
            ">
              ${getIconSvg('library', { size: 20 })}
            </div>
            <div>
              <h2 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Duplicate Detection</h2>
              <p style="font-size: 12px; color: var(--color-text-muted); margin: 2px 0 0 0;">
                Scanned ${this.summary?.totalTracksScanned || 0} tracks • Found ${this.summary?.duplicateGroupsFound || 0} duplicate groups (${this.summary?.totalDuplicatesFound || 0} extra copies)
              </p>
            </div>
          </div>
          <button id="dup-modal-close" style="
            background: transparent;
            border: none;
            color: var(--color-text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ✕
          </button>
        </div>

        <!-- Summary Bar -->
        ${groups.length > 0 ? `
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            background: rgba(168, 85, 247, 0.08);
            border-bottom: 1px solid var(--glass-border);
          ">
            <span style="font-size: 13px; color: var(--color-text-secondary); font-weight: 500;">
              Potential disk space savings: <strong style="color: var(--color-accent-purple-glow);">${formattedBytes}</strong>
            </span>
            <div style="display: flex; gap: 8px;">
              <button id="dup-select-all" style="
                background: transparent;
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
                padding: 4px 12px;
                border-radius: var(--radius-sm);
                font-size: 12px;
                cursor: pointer;
              ">Select All</button>
              <button id="dup-deselect-all" style="
                background: transparent;
                border: 1px solid var(--glass-border);
                color: var(--color-text-secondary);
                padding: 4px 12px;
                border-radius: var(--radius-sm);
                font-size: 12px;
                cursor: pointer;
              ">Deselect All</button>
            </div>
          </div>
        ` : ''}

        <!-- Content Area -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        ">
          ${groups.length === 0 ? `
            <div style="text-align: center; padding: 48px 20px; color: var(--color-text-muted);">
              <div style="font-size: 32px; margin-bottom: 12px;">✨</div>
              <h3 style="font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px;">No Duplicates Found</h3>
              <p style="font-size: 13px; margin: 0;">Your local music library has 0 duplicate audio tracks!</p>
            </div>
          ` : groups.map((g, idx) => `
            <div style="
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid var(--glass-border);
              border-radius: var(--radius-md);
              padding: 16px;
              display: flex;
              flex-direction: column;
              gap: 12px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; font-weight: 600; color: var(--color-accent-purple-glow);">Group #${idx + 1} — ${g.reason}</span>
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(168, 85, 247, 0.15); color: var(--color-accent-purple-glow);">
                  ${Math.round(g.confidenceScore * 100)}% Match
                </span>
              </div>

              <!-- Primary Track (Keep) -->
              <div style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                background: rgba(16, 185, 129, 0.08);
                border: 1px solid rgba(16, 185, 129, 0.25);
                border-radius: var(--radius-sm);
              ">
                <span style="font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #10b981; color: #ffffff;">KEEP</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 13px; font-weight: 600; color: var(--color-text-primary); truncate;">${this.escapeHtml(g.primaryTrack.title)}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">${this.escapeHtml(g.primaryTrack.artistName || 'Unknown Artist')} • ${this.formatDuration(g.primaryTrack.durationMs)} • ${g.primaryTrack.format.container.toUpperCase()} ${g.primaryTrack.format.bitrate ? `(${Math.round(g.primaryTrack.format.bitrate / 1000)} kbps)` : ''}</div>
                </div>
              </div>

              <!-- Duplicate Tracks (Remove) -->
              ${g.duplicateTracks.map(dup => {
                const isChecked = this.selectedTrackIds.has(dup.id);
                return `
                  <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    background: ${isChecked ? 'rgba(239, 68, 68, 0.08)' : 'transparent'};
                    border: 1px solid ${isChecked ? 'rgba(239, 68, 68, 0.25)' : 'var(--glass-border)'};
                    border-radius: var(--radius-sm);
                  ">
                    <input type="checkbox" class="dup-checkbox" data-track-id="${dup.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                    <span style="font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.2); color: #ef4444;">REMOVE</span>
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 13px; font-weight: 500; color: var(--color-text-primary); truncate;">${this.escapeHtml(dup.title)}</div>
                      <div style="font-size: 11px; color: var(--color-text-muted);">${this.escapeHtml(dup.artistName || 'Unknown Artist')} • ${this.formatDuration(dup.durationMs)} • ${dup.format.container.toUpperCase()} ${dup.format.bitrate ? `(${Math.round(dup.format.bitrate / 1000)} kbps)` : ''}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `).join('')}
        </div>

        <!-- Footer -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-top: 1px solid var(--glass-border);
          background: rgba(0, 0, 0, 0.2);
        ">
          <span style="font-size: 12px; color: var(--color-text-muted);">
            ${totalSelected} track(s) selected for deletion
          </span>
          <div style="display: flex; gap: 12px;">
            <button id="dup-btn-cancel" style="
              padding: 8px 16px;
              border-radius: var(--radius-md);
              border: 1px solid var(--glass-border);
              background: transparent;
              color: var(--color-text-primary);
              font-size: 13px;
              cursor: pointer;
            ">Cancel</button>
            <button id="dup-btn-resolve" ${totalSelected === 0 || this.isResolving ? 'disabled' : ''} style="
              padding: 8px 20px;
              border-radius: var(--radius-md);
              border: none;
              background: var(--gradient-primary);
              color: #ffffff;
              font-size: 13px;
              font-weight: 600;
              cursor: ${totalSelected === 0 || this.isResolving ? 'not-allowed' : 'pointer'};
              opacity: ${totalSelected === 0 || this.isResolving ? '0.5' : '1'};
              box-shadow: var(--shadow-glow-purple);
            ">
              ${this.isResolving ? 'Removing Duplicates...' : `Remove Selected (${totalSelected})`}
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelector('#dup-modal-close')?.addEventListener('click', () => this.unmount());
    this.container.querySelector('#dup-btn-cancel')?.addEventListener('click', () => this.unmount());

    this.container.querySelector('#dup-select-all')?.addEventListener('click', () => {
      if (!this.summary) return;
      for (const group of this.summary.groups) {
        for (const dup of group.duplicateTracks) {
          this.selectedTrackIds.add(dup.id);
        }
      }
      this.render();
    });

    this.container.querySelector('#dup-deselect-all')?.addEventListener('click', () => {
      this.selectedTrackIds.clear();
      this.render();
    });

    const checkboxes = this.container.querySelectorAll<HTMLInputElement>('.dup-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-track-id');
        if (id) {
          if (cb.checked) this.selectedTrackIds.add(id);
          else this.selectedTrackIds.delete(id);
        }
        this.render();
      });
    });

    this.container.querySelector('#dup-btn-resolve')?.addEventListener('click', async () => {
      if (this.selectedTrackIds.size === 0 || !this.summary || this.isResolving) return;

      this.isResolving = true;
      this.render();

      const plans: DuplicateResolutionPlan[] = [];
      for (const group of this.summary.groups) {
        const removeTrackIds = group.duplicateTracks
          .filter(d => this.selectedTrackIds.has(d.id))
          .map(d => d.id);

        if (removeTrackIds.length > 0) {
          plans.push({
            groupId: group.id,
            keepTrackId: group.primaryTrack.id,
            removeTrackIds
          });
        }
      }

      await this.duplicateDetectorService.resolveDuplicates(plans);
      this.isResolving = false;
      this.unmount();
      this.onResolved?.();
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private formatDuration(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
