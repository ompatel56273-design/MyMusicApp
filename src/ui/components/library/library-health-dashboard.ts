import type { LibraryHealthService } from '../../../services/library/library-health-service';
import type {
  LibraryHealthSnapshot,
  LibraryHealthProgress,
  LibraryHealthIssue
} from '../../../domain/entities/library-health-types';
import { getIconSvg } from '../../icons/icon-registry';

export interface LibraryHealthDashboardOptions {
  healthService: LibraryHealthService;
  onOpenDuplicates?: () => void;
  onNavigateMissingFiles?: () => void;
  onNavigateTab?: (tab: string, filter?: string) => void;
  onClose?: () => void;
}

export class LibraryHealthDashboard {
  private container: HTMLElement | null = null;
  private readonly healthService: LibraryHealthService;
  private readonly onOpenDuplicates?: (() => void) | undefined;
  private readonly onNavigateMissingFiles?: (() => void) | undefined;
  private readonly onNavigateTab?: ((tab: string, filter?: string) => void) | undefined;
  private readonly onClose?: (() => void) | undefined;

  private snapshot: LibraryHealthSnapshot | null = null;
  private progress: LibraryHealthProgress | null = null;
  private isVerifying = false;
  private abortController: AbortController | null = null;
  private selectedCategoryFilter: string = 'all';

  constructor(options: LibraryHealthDashboardOptions) {
    this.healthService = options.healthService;
    this.onOpenDuplicates = options.onOpenDuplicates;
    this.onNavigateMissingFiles = options.onNavigateMissingFiles;
    this.onNavigateTab = options.onNavigateTab;
    this.onClose = options.onClose;
    this.snapshot = this.healthService.getCachedSnapshot();
  }

  public mount(parent?: HTMLElement): void {
    const parentEl = parent || (typeof document !== 'undefined' ? document.body : null);
    if (!parentEl) return;

    this.container = document.createElement('div');
    this.container.id = 'library-health-dashboard-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 4, 8, 0.84);
      backdrop-filter: blur(14px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    parentEl.appendChild(this.container);
    this.render();

    // Auto-run verification on first load if no cached snapshot exists
    if (!this.snapshot) {
      void this.runVerification();
    }
  }

  public unmount(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.container) {
      if (typeof this.container.remove === 'function') {
        this.container.remove();
      } else if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
    }
  }

  public async runVerification(): Promise<void> {
    if (this.isVerifying) return;

    this.isVerifying = true;
    this.abortController = new AbortController();
    this.render();

    try {
      this.snapshot = await this.healthService.verifyLibraryHealth({
        signal: this.abortController.signal,
        onProgress: prog => {
          this.progress = prog;
          this.renderProgressOnly();
        }
      });
    } catch {
      // Snapshot fallback handled by service
    } finally {
      this.isVerifying = false;
      this.progress = null;
      this.abortController = null;
      this.render();
    }
  }

  private renderProgressOnly(): void {
    if (!this.container) return;
    const progressSlot = this.container.querySelector('#health-progress-slot');
    if (progressSlot && this.progress) {
      const pct = this.progress.totalItems > 0 ? Math.round((this.progress.processedItems / this.progress.totalItems) * 100) : 0;
      progressSlot.innerHTML = `
        <div style="
          padding: 14px 20px;
          background: rgba(124, 58, 237, 0.12);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="font-weight: 600; color: var(--color-accent-purple-glow);">${this.escapeHtml(this.progress.currentTaskDescription)}</span>
            <span style="font-weight: 700; color: #ffffff;">${pct}%</span>
          </div>
          <div style="width: 100%; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.1); overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: var(--gradient-primary); transition: width 0.15s ease;"></div>
          </div>
        </div>
      `;
    }
  }

  private render(): void {
    if (!this.container) return;

    const snapshot = this.snapshot;
    const metrics = snapshot?.metrics;
    const status = snapshot?.status || 'verification-incomplete';
    const issues = snapshot?.issues || [];

    const filteredIssues = this.filterIssues(issues);

    this.container.innerHTML = `
      <div class="glass-panel" style="
        width: 980px;
        max-width: 95vw;
        max-height: 90vh;
        border-radius: var(--radius-2xl);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--glass-border-interactive);
        box-shadow: var(--shadow-elevation-high), 0 0 40px rgba(124, 58, 237, 0.15);
        background: var(--color-bg-surface-elevated);
      ">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          border-bottom: 1px solid var(--glass-border);
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
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
              ${getIconSvg('heart', { size: 22 })}
            </div>
            <div>
              <h2 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.02em;">Library Health & Integrity</h2>
              <p style="font-size: 12px; color: var(--color-text-muted); margin: 2px 0 0 0;">
                Factual audit of audio files, metadata completeness, and duplicate records
              </p>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <button id="health-btn-verify" ${this.isVerifying ? 'disabled' : ''} style="
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 9px 20px;
              border-radius: var(--radius-full);
              font-size: 13px;
              font-weight: 700;
              cursor: ${this.isVerifying ? 'not-allowed' : 'pointer'};
              border: none;
              background: var(--gradient-primary);
              color: #ffffff;
              box-shadow: var(--shadow-glow-purple);
              opacity: ${this.isVerifying ? '0.6' : '1'};
              transition: all var(--duration-fast) var(--ease-smooth);
            ">
              <span>${getIconSvg('refresh', { size: 16, color: '#ffffff' })}</span>
              <span>${this.isVerifying ? 'Verifying...' : 'Verify Library'}</span>
            </button>
            <button id="health-btn-close" aria-label="Close Health Dashboard" style="
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
          <!-- Verification Progress Slot -->
          <div id="health-progress-slot"></div>

          <!-- Overall Factual Status Banner -->
          <div style="
            padding: 16px 20px;
            border-radius: var(--radius-lg);
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 1px solid ${status === 'all-clear' ? 'rgba(16, 185, 129, 0.3)' : status === 'needs-attention' ? 'rgba(245, 158, 11, 0.3)' : 'var(--glass-border)'};
            background: ${status === 'all-clear' ? 'rgba(16, 185, 129, 0.1)' : status === 'needs-attention' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(139, 92, 246, 0.1)'};
          ">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span style="
                padding: 4px 12px;
                border-radius: var(--radius-full);
                font-size: 12px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                background: ${status === 'all-clear' ? '#10b981' : status === 'needs-attention' ? '#f59e0b' : '#8b5cf6'};
                color: #ffffff;
              ">
                ${status === 'all-clear' ? 'All Checks Clear' : status === 'needs-attention' ? 'Needs Attention' : 'Verification Incomplete'}
              </span>
              <span style="font-size: 13px; color: var(--color-text-primary); font-weight: 500;">
                ${status === 'all-clear'
                  ? 'No missing files, duplicate records, or metadata issues detected.'
                  : status === 'needs-attention'
                  ? `Factual issues identified across ${issues.length} items.`
                  : 'Run verification to calculate complete library health audit.'}
              </span>
            </div>
            ${snapshot?.timestamp ? `
              <span style="font-size: 11px; color: var(--color-text-muted);">
                Last verified: ${new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ` : ''}
          </div>

          <!-- 4-Column Category Metrics Grid -->
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 16px;
          ">
            <!-- 1. Library Overview -->
            <div class="glass-card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--color-bg-surface-elevated);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Library Overview</span>
                <span style="color: var(--color-accent-purple-glow);">${getIconSvg('music', { size: 16 })}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${(metrics?.totalTracks || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Songs</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${(metrics?.totalAlbums || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Albums</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${(metrics?.totalArtists || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Artists</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${this.formatDuration(metrics?.totalDurationMs || 0)}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Total Time</div>
                </div>
              </div>
            </div>

            <!-- 2. File Availability -->
            <div class="glass-card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--color-bg-surface-elevated);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">File Availability</span>
                <span style="color: var(--color-accent-cyan);">${getIconSvg('folder', { size: 16 })}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #10b981;">${(metrics?.availableFiles || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Available</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: ${metrics?.missingFiles ? '#ef4444' : '#ffffff'};">${(metrics?.missingFiles || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Missing</div>
                  ${(metrics?.missingFiles || 0) > 0 ? `
                    <button id="health-btn-open-missing" style="
                      margin-top: 4px;
                      padding: 2px 6px;
                      border-radius: var(--radius-sm);
                      border: 1px solid var(--glass-border-interactive);
                      background: rgba(239, 68, 68, 0.15);
                      color: #ef4444;
                      font-size: 10px;
                      font-weight: 600;
                      cursor: pointer;
                    ">Clean up</button>
                  ` : ''}
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #f59e0b;">${(metrics?.unverifiableFiles || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Unverifiable</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${(metrics?.unsupportedFiles || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Unsupported</div>
                </div>
              </div>
            </div>

            <!-- 3. Duplicate Detection -->
            <div class="glass-card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--color-bg-surface-elevated);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Duplicate Detection</span>
                <span style="color: var(--color-accent-pink);">${getIconSvg('sparkles', { size: 16 })}</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span style="font-size: 18px; font-weight: 800; color: ${metrics?.duplicateGroupsCount ? 'var(--color-accent-purple-glow)' : '#ffffff'};">
                    ${metrics?.duplicateGroupsCount || 0} groups
                  </span>
                  <span style="font-size: 12px; color: var(--color-text-muted);">${metrics?.duplicateTracksCount || 0} extra tracks</span>
                </div>
                ${(metrics?.potentialSpaceSavingsBytes || 0) > 0 ? `
                  <button id="health-btn-open-dup" style="
                    margin-top: 4px;
                    padding: 4px 10px;
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--glass-border-interactive);
                    background: rgba(168, 85, 247, 0.15);
                    color: var(--color-accent-purple-glow);
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: center;
                  ">
                    Review Duplicates (${this.formatBytes(metrics?.potentialSpaceSavingsBytes || 0)})
                  </button>
                ` : `
                  <span style="font-size: 11px; color: var(--color-text-muted);">No duplicate clusters</span>
                `}
              </div>
            </div>

            <!-- 4. Metadata Completeness -->
            <div class="glass-card" style="padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--color-bg-surface-elevated);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Metadata Health</span>
                <span style="color: #fbbf24;">${getIconSvg('info', { size: 16 })}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #10b981;">${(metrics?.completeMetadataCount || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Complete</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: ${metrics?.missingArtistCount ? '#f59e0b' : '#ffffff'};">${(metrics?.missingArtistCount || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">No Artist</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: #ffffff;">${(metrics?.missingAlbumCount || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">No Album</div>
                </div>
                <div>
                  <div style="font-size: 18px; font-weight: 800; color: ${metrics?.invalidDurationCount ? '#ef4444' : '#ffffff'};">${(metrics?.invalidDurationCount || 0).toLocaleString()}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Bad Duration</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Issues Audit List Section -->
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <span style="font-size: 15px; font-weight: 700; color: #ffffff;">Audit Issues List (${issues.length})</span>

              <!-- Category Filter Pills -->
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${['all', 'missing-files', 'duplicates', 'missing-metadata', 'invalid-duration'].map(cat => `
                  <button class="health-filter-pill" data-cat="${cat}" style="
                    padding: 4px 12px;
                    border-radius: var(--radius-full);
                    font-size: 11px;
                    font-weight: 600;
                    border: 1px solid ${this.selectedCategoryFilter === cat ? 'var(--glass-border-interactive)' : 'var(--glass-border)'};
                    background: ${this.selectedCategoryFilter === cat ? 'var(--gradient-primary)' : 'rgba(255, 255, 255, 0.04)'};
                    color: ${this.selectedCategoryFilter === cat ? '#ffffff' : 'var(--color-text-muted)'};
                    cursor: pointer;
                  ">
                    ${cat.replace('-', ' ').toUpperCase()}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Issue Cards Container -->
            <div style="
              display: flex;
              flex-direction: column;
              gap: 8px;
              max-height: 280px;
              overflow-y: auto;
              padding-right: 4px;
            ">
              ${filteredIssues.length === 0 ? `
                <div style="padding: 32px; text-align: center; color: var(--color-text-muted); font-size: 13px;">
                  No issues found for selected category filter.
                </div>
              ` : filteredIssues.slice(0, 100).map(issue => `
                <div style="
                  padding: 10px 14px;
                  border-radius: var(--radius-md);
                  background: rgba(255, 255, 255, 0.03);
                  border: 1px solid var(--glass-border);
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 12px;
                ">
                  <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                    <span style="
                      font-size: 10px;
                      font-weight: 800;
                      padding: 2px 6px;
                      border-radius: 4px;
                      background: ${issue.severity === 'error' ? 'rgba(239, 68, 68, 0.2)' : issue.severity === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)'};
                      color: ${issue.severity === 'error' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#38bdf8'};
                    ">
                      ${issue.severity.toUpperCase()}
                    </span>
                    <span style="font-size: 13px; color: var(--color-text-primary); font-weight: 500; truncate;">
                      ${this.escapeHtml(issue.description)}
                    </span>
                  </div>

                  ${issue.category === 'duplicates' ? `
                    <button class="health-issue-action-btn" data-action="duplicates" style="
                      padding: 4px 10px;
                      border-radius: var(--radius-sm);
                      border: 1px solid var(--glass-border);
                      background: rgba(168, 85, 247, 0.15);
                      color: var(--color-accent-purple-glow);
                      font-size: 11px;
                      font-weight: 600;
                      cursor: pointer;
                    ">Resolve</button>
                  ` : issue.targetTab ? `
                    <button class="health-issue-action-btn" data-action="nav" data-tab="${issue.targetTab}" style="
                      padding: 4px 10px;
                      border-radius: var(--radius-sm);
                      border: 1px solid var(--glass-border);
                      background: transparent;
                      color: var(--color-text-secondary);
                      font-size: 11px;
                      font-weight: 500;
                      cursor: pointer;
                    ">Inspect</button>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private filterIssues(issues: readonly LibraryHealthIssue[]): readonly LibraryHealthIssue[] {
    if (this.selectedCategoryFilter === 'all') return issues;
    return issues.filter(i => i.category === this.selectedCategoryFilter);
  }

  private bindEvents(): void {
    if (!this.container) return;

    this.container.querySelector('#health-btn-close')?.addEventListener('click', () => {
      this.unmount();
      this.onClose?.();
    });

    this.container.querySelector('#health-btn-verify')?.addEventListener('click', () => {
      void this.runVerification();
    });

    this.container.querySelector('#health-btn-open-dup')?.addEventListener('click', () => {
      this.unmount();
      this.onOpenDuplicates?.();
    });

    this.container.querySelector('#health-btn-open-missing')?.addEventListener('click', () => {
      this.unmount();
      this.onNavigateMissingFiles?.();
    });

    const filterPills = this.container.querySelectorAll<HTMLButtonElement>('.health-filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const cat = pill.getAttribute('data-cat');
        if (cat) {
          this.selectedCategoryFilter = cat;
          this.render();
        }
      });
    });

    const actionBtns = this.container.querySelectorAll<HTMLButtonElement>('.health-issue-action-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'duplicates') {
          this.unmount();
          this.onOpenDuplicates?.();
        } else if (action === 'nav') {
          const tab = btn.getAttribute('data-tab');
          if (tab) {
            this.unmount();
            this.onNavigateTab?.(tab);
          }
        }
      });
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
    if (!ms || ms <= 0) return '0m';
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
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
