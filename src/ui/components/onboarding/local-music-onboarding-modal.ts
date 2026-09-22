import { FileAccessCapabilityService, type PermissionAccessStatus } from '../../../services/scanner/file-access-capability';
import type { IScannerService } from '../../../services/contracts/service-contracts';
import type { BrowserFilesystemAdapter } from '../../../services/scanner/browser-filesystem-adapter';
import type { IDatabaseAdapter } from '../../../data/db/database-adapter';
import { STORES } from '../../../data/db/schema';
import { EventBus } from '../../../core/events/event-bus';
import { DomainEvents } from '../../../domain/events/domain-events';
import type { Disposable } from '../../../core/types/common';
import type { ScanProgressReport } from '../../../services/scanner/scanner-types';

export interface OnboardingModalOptions {
  scannerService: IScannerService;
  fsAdapter: BrowserFilesystemAdapter;
  dbAdapter?: IDatabaseAdapter | undefined;
  eventBus: EventBus;
  onComplete?: (() => void) | undefined;
}

/**
 * Local Music Access Onboarding Modal.
 * Explains privacy, local-only audio access, and lets users pick a music folder or audio files.
 */
export class LocalMusicOnboardingModal {
  private overlay: HTMLElement | null = null;
  private readonly capabilityService = FileAccessCapabilityService.getInstance();
  private readonly scannerService: IScannerService;
  private readonly fsAdapter: BrowserFilesystemAdapter;
  private readonly dbAdapter?: IDatabaseAdapter | undefined;
  private readonly eventBus: EventBus;
  private readonly onComplete?: (() => void) | undefined;
  private progressSub: Disposable | null = null;

  private permissionStatus: PermissionAccessStatus = 'NOT_REQUESTED';
  private isProcessing = false;
  private statusMessage = '';
  private progressReport: ScanProgressReport | null = null;

  constructor(options: OnboardingModalOptions) {
    this.scannerService = options.scannerService;
    this.fsAdapter = options.fsAdapter;
    this.dbAdapter = options.dbAdapter;
    this.eventBus = options.eventBus;
    this.onComplete = options.onComplete;
  }

  public show(): void {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'onboarding-modal-overlay';
    this.overlay.className = 'onboarding-modal-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'onboarding-modal-title');

    this.render();
    document.body.appendChild(this.overlay);

    this.subscribeProgress();
  }

  public close(): void {
    if (this.progressSub) {
      this.progressSub.dispose();
      this.progressSub = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;

    try {
      localStorage.setItem('mymusic_onboarding_dismissed', 'true');
    } catch {
      // Ignore
    }

    if (this.onComplete) {
      this.onComplete();
    }
  }

  private subscribeProgress(): void {
    this.progressSub = this.eventBus.subscribe(DomainEvents.SCAN_PROGRESS, (report: unknown) => {
      this.progressReport = report as ScanProgressReport;
      this.updateProgressDisplay();
      if (this.progressReport?.isComplete && this.isProcessing) {
        this.isProcessing = false;
        this.statusMessage = `Success! Added ${this.progressReport.filesAdded} songs to your library.`;
        this.render();
        setTimeout(() => this.close(), 1200);
      }
    });
  }

  private render(): void {
    if (!this.overlay) return;

    const caps = this.capabilityService.getCapabilities();

    this.overlay.innerHTML = `
      <style>
        .onboarding-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(4, 7, 18, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 16px;
          box-sizing: border-box;
          animation: fadeInModal 0.25s ease-out;
        }

        @keyframes fadeInModal {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }

        .onboarding-card {
          width: 100%;
          max-width: 520px;
          background: var(--glass-surface-modal, rgba(17, 24, 39, 0.95));
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
          border-radius: var(--radius-2xl, 24px);
          padding: 32px 28px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 20px;
          text-align: center;
        }

        .onboarding-icon-wrap {
          width: 64px;
          height: 64px;
          margin: 0 auto;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%);
          border: 1px solid rgba(168, 85, 247, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
        }

        .onboarding-title {
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .onboarding-subtitle {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-primary-light, #818cf8);
          margin: 0;
        }

        .onboarding-description {
          font-size: 14px;
          line-height: 1.5;
          color: var(--color-text-secondary, #94a3b8);
          margin: 0;
        }

        .onboarding-privacy-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg, 14px);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .onboarding-privacy-box span.priv-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .onboarding-privacy-box p {
          margin: 0;
          font-size: 12px;
          color: var(--color-text-muted, #94a3b8);
          line-height: 1.4;
        }

        .onboarding-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 6px;
        }

        .onboarding-btn {
          width: 100%;
          min-height: 48px;
          padding: 12px 20px;
          border-radius: var(--radius-xl, 16px);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-sizing: border-box;
          border: none;
        }

        .onboarding-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
        }
        .onboarding-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          transform: translateY(-1px);
        }

        .onboarding-btn-secondary {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
          color: #ffffff;
        }
        .onboarding-btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.12);
        }

        .onboarding-btn-tertiary {
          background: transparent;
          color: var(--color-text-muted, #94a3b8);
          font-weight: 500;
          padding: 8px;
          min-height: 36px;
        }
        .onboarding-btn-tertiary:hover {
          color: #ffffff;
        }

        .onboarding-progress-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .onboarding-progress-bar-bg {
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          overflow: hidden;
        }

        .onboarding-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #a855f7);
          border-radius: 999px;
          transition: width 0.15s ease;
        }

        @media (max-width: 480px) {
          .onboarding-card {
            padding: 24px 18px;
            border-radius: 20px;
          }
          .onboarding-title {
            font-size: 20px;
          }
        }
      </style>

      <div class="onboarding-card">
        <div class="onboarding-icon-wrap">🎵</div>
        
        <div>
          <h2 id="onboarding-modal-title" class="onboarding-title">Welcome to MyMusicApp</h2>
          <p class="onboarding-subtitle" style="margin-top: 4px;">Your Personal Audio Operating System</p>
        </div>

        <p class="onboarding-description">
          Give MyMusicApp access to your music so it can build your local library.
        </p>

        <div class="onboarding-privacy-box">
          <span class="priv-icon">🔒</span>
          <p>
            <strong>Your music stays on your device.</strong><br>
            No music is uploaded to any server. No cloud storage is required.
          </p>
        </div>

        ${this.statusMessage ? `
          <div style="font-size: 13px; color: ${this.permissionStatus === 'DENIED' ? '#f87171' : '#34d399'}; padding: 8px; border-radius: 8px; background: rgba(0,0,0,0.2);">
            ${this.escapeHtml(this.statusMessage)}
          </div>
        ` : ''}

        ${this.isProcessing ? `
          <div class="onboarding-progress-wrap">
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary, #cbd5e1);">
              <span id="onboarding-status-text">Scanning audio files...</span>
              <span id="onboarding-count-text">0 found</span>
            </div>
            <div class="onboarding-progress-bar-bg">
              <div id="onboarding-bar-fill" class="onboarding-progress-bar-fill" style="width: 30%;"></div>
            </div>
          </div>
        ` : `
          <div class="onboarding-actions">
            ${caps.hasDirectoryPicker ? `
              <button id="btn-choose-folder" class="onboarding-btn onboarding-btn-primary">
                <span>📁</span>
                <span>Choose Music Folder</span>
              </button>
            ` : ''}

            <button id="btn-choose-files" class="onboarding-btn ${caps.hasDirectoryPicker ? 'onboarding-btn-secondary' : 'onboarding-btn-primary'}">
              <span>🎵</span>
              <span>Choose Audio Files</span>
            </button>

            ${!caps.hasDirectoryPicker ? `
              <p style="font-size: 11px; color: var(--color-text-muted, #64748b); margin: 2px 0 0 0;">
                Folder access isn't supported by this browser. Select your music files instead.
              </p>
            ` : ''}

            <button id="btn-skip-onboarding" class="onboarding-btn onboarding-btn-tertiary">
              Continue Without Music
            </button>
          </div>
        `}

        <input type="file" id="onboarding-file-input" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.webm,.aiff,.aif,.alac" style="display: none;" />
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    const chooseFolderBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-choose-folder');
    if (chooseFolderBtn) {
      chooseFolderBtn.addEventListener('click', () => void this.handleChooseFolder());
    }

    const chooseFilesBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-choose-files');
    const fileInput = this.overlay.querySelector<HTMLInputElement>('#onboarding-file-input');
    if (chooseFilesBtn && fileInput) {
      chooseFilesBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          void this.handleFilesSelected(fileInput.files);
        }
      });
    }

    const skipBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-skip-onboarding');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.close());
    }
  }

  private async handleChooseFolder(): Promise<void> {
    if (typeof (window as any).showDirectoryPicker !== 'function') {
      this.statusMessage = 'Folder access is not supported by this browser. Please choose audio files instead.';
      this.render();
      return;
    }

    try {
      this.permissionStatus = 'REQUESTING';
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      if (!handle) {
        this.permissionStatus = 'NOT_REQUESTED';
        return;
      }

      this.permissionStatus = 'GRANTED';
      this.isProcessing = true;
      this.statusMessage = 'Scanning folder and building library...';
      this.render();

      // Register directory handle in adapter
      const rootPath = `folder://${handle.name}`;
      this.fsAdapter.registerDirectoryHandle(rootPath, handle);

      // Save handle in IndexedDB if adapter available
      if (this.dbAdapter) {
        try {
          await this.dbAdapter.put(STORES.SETTINGS, {
            key: 'music_directory_handle',
            handle,
            path: rootPath,
            name: handle.name,
            updatedAt: Date.now()
          });
        } catch (e) {
          // Non-fatal if handle persistence is unsupported
        }
      }

      // Execute scan
      await this.scannerService.scanDirectory(rootPath);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled folder picker
        this.permissionStatus = 'NOT_REQUESTED';
        this.isProcessing = false;
        this.render();
        return;
      }

      this.permissionStatus = 'DENIED';
      this.isProcessing = false;
      this.statusMessage = 'Music access was not granted or folder could not be read.';
      this.render();
    }
  }

  private async handleFilesSelected(files: FileList): Promise<void> {
    if (files.length === 0) return;

    try {
      this.isProcessing = true;
      this.statusMessage = `Importing ${files.length} audio files...`;
      this.render();

      if (this.scannerService.importFiles) {
        const result = await this.scannerService.importFiles(files);
        this.isProcessing = false;
        this.statusMessage = `Success! Added ${result.filesAdded} songs to your library.`;
        this.render();
        setTimeout(() => this.close(), 1200);
      } else {
        this.isProcessing = false;
        this.close();
      }
    } catch (err: any) {
      this.isProcessing = false;
      this.statusMessage = `Failed to import files: ${err?.message || 'Unknown error'}`;
      this.render();
    }
  }

  private updateProgressDisplay(): void {
    if (!this.overlay || !this.progressReport) return;
    const statusText = this.overlay.querySelector<HTMLElement>('#onboarding-status-text');
    const countText = this.overlay.querySelector<HTMLElement>('#onboarding-count-text');
    const barFill = this.overlay.querySelector<HTMLElement>('#onboarding-bar-fill');

    if (statusText && this.progressReport.currentFile) {
      const fileName = this.progressReport.currentFile.split('/').pop() || '';
      statusText.textContent = `Reading ${fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName}`;
    }
    if (countText) {
      countText.textContent = `${this.progressReport.filesDiscovered} discovered (${this.progressReport.filesAdded} added)`;
    }
    if (barFill) {
      const percent = this.progressReport.isComplete ? 100 : Math.min(95, Math.max(10, (this.progressReport.filesProcessed / Math.max(1, this.progressReport.filesDiscovered)) * 100));
      barFill.style.width = `${percent}%`;
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
