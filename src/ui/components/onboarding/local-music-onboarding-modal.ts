import { FileAccessCapabilityService, type PermissionAccessStatus } from '../../../services/scanner/file-access-capability';
import type { IScannerService, ILibraryService } from '../../../services/contracts/service-contracts';
import type { BrowserFilesystemAdapter } from '../../../services/scanner/browser-filesystem-adapter';
import type { IDatabaseAdapter } from '../../../data/db/database-adapter';
import { STORES } from '../../../data/db/schema';
import { EventBus } from '../../../core/events/event-bus';
import { DomainEvents } from '../../../domain/events/domain-events';
import type { Disposable } from '../../../core/types/common';
import type { ScanProgressReport } from '../../../services/scanner/scanner-types';
import type { RouterService } from '../../navigation/router-service';

export interface OnboardingModalOptions {
  scannerService: IScannerService;
  fsAdapter: BrowserFilesystemAdapter;
  dbAdapter?: IDatabaseAdapter | undefined;
  libraryService?: ILibraryService | undefined;
  router?: RouterService | undefined;
  eventBus: EventBus;
  onComplete?: (() => void) | undefined;
}

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

/**
 * LocalMusicOnboardingModal - 5-Step First-Launch Wizard.
 * Step 1: Welcome & Overview
 * Step 2: Privacy & Local Access Explanation
 * Step 3: Choose Folder / File Selection
 * Step 4: Real-time Scanner Progress
 * Step 5: Library Ready & Stats Summary
 */
export class LocalMusicOnboardingModal {
  private overlay: HTMLElement | null = null;
  private readonly capabilityService = FileAccessCapabilityService.getInstance();
  private readonly scannerService: IScannerService;
  private readonly fsAdapter: BrowserFilesystemAdapter;
  private readonly dbAdapter?: IDatabaseAdapter | undefined;
  private readonly libraryService?: ILibraryService | undefined;
  private readonly router?: RouterService | undefined;
  private readonly eventBus: EventBus;
  private readonly onComplete?: (() => void) | undefined;

  private progressSub: Disposable | null = null;
  private updateSub: Disposable | null = null;

  private currentStep: OnboardingStep = 1;
  private permissionStatus: PermissionAccessStatus = 'NOT_REQUESTED';
  private statusMessage = '';
  private progressReport: ScanProgressReport | null = null;
  private libraryStats = { trackCount: 0, albumCount: 0, artistCount: 0 };

  constructor(options: OnboardingModalOptions) {
    this.scannerService = options.scannerService;
    this.fsAdapter = options.fsAdapter;
    this.dbAdapter = options.dbAdapter;
    this.libraryService = options.libraryService;
    this.router = options.router;
    this.eventBus = options.eventBus;
    this.onComplete = options.onComplete;
  }

  public getStep(): OnboardingStep {
    return this.currentStep;
  }

  public show(initialStep: OnboardingStep = 1): void {
    if (this.overlay) return;
    this.currentStep = initialStep;

    this.overlay = document.createElement('div');
    this.overlay.id = 'onboarding-modal-overlay';
    this.overlay.className = 'onboarding-modal-overlay';
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-labelledby', 'onboarding-modal-title');

    this.render();
    document.body.appendChild(this.overlay);

    this.subscribeEvents();
  }

  public close(): void {
    if (this.progressSub) {
      this.progressSub.dispose();
      this.progressSub = null;
    }
    if (this.updateSub) {
      this.updateSub.dispose();
      this.updateSub = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mymusic_onboarding_dismissed', 'true');
        localStorage.setItem('mymusic_onboarding_completed', 'true');
      }
    } catch {
      // Ignore
    }

    if (this.dbAdapter) {
      void this.dbAdapter.put(STORES.SETTINGS, {
        key: 'onboarding_state',
        completed: true,
        updatedAt: Date.now()
      });
    }

    if (this.onComplete) {
      this.onComplete();
    }
  }

  public setStep(step: OnboardingStep): void {
    this.currentStep = step;
    this.render();
  }

  private subscribeEvents(): void {
    this.progressSub = this.eventBus.subscribe(DomainEvents.SCAN_PROGRESS, (report: unknown) => {
      this.progressReport = report as ScanProgressReport;
      if (this.currentStep === 4) {
        this.updateProgressDisplay();
      }
    });

    this.updateSub = this.eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, async () => {
      if (this.libraryService) {
        this.libraryStats = await this.libraryService.getLibraryStats();
      }
      if (this.currentStep === 4) {
        this.currentStep = 5;
        this.render();
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
          background: rgba(4, 7, 18, 0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: var(--space-4, 16px);
          box-sizing: border-box;
          animation: fadeInModal 0.25s ease-out;
        }

        @keyframes fadeInModal {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }

        .onboarding-card {
          width: 100%;
          max-width: 560px;
          background: var(--color-bg-surface-elevated, rgba(17, 24, 39, 0.95));
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
          border-radius: var(--radius-2xl, 24px);
          padding: 32px 28px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(168, 85, 247, 0.18);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 18px;
          text-align: center;
          position: relative;
        }

        .onboarding-step-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-bottom: 4px;
        }

        .onboarding-step-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          transition: all 0.25s ease;
        }

        .onboarding-step-dot.active {
          width: 24px;
          background: var(--color-accent-primary, #a855f7);
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }

        .onboarding-icon-wrap {
          width: 64px;
          height: 64px;
          margin: 0 auto;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%);
          border: 1px solid rgba(168, 85, 247, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(168, 85, 247, 0.25);
        }

        .onboarding-title {
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .onboarding-subtitle {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-accent-secondary, #06b6d4);
          margin: 4px 0 0 0;
        }

        .onboarding-description {
          font-size: 14px;
          line-height: 1.5;
          color: var(--color-text-secondary, #94a3b8);
          margin: 0;
        }

        .onboarding-feature-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-xl, 16px);
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
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
          border: 1px solid transparent;
        }

        .onboarding-btn-primary {
          background: var(--color-accent-gradient, linear-gradient(135deg, #a855f7 0%, #06b6d4 100%));
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(168, 85, 247, 0.35);
        }
        .onboarding-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(168, 85, 247, 0.45);
        }

        .onboarding-btn-secondary {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.12);
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
          min-height: 38px;
        }
        .onboarding-btn-tertiary:hover {
          color: #ffffff;
        }

        .onboarding-stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 6px 0;
        }

        .onboarding-stat-chip {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg, 12px);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .onboarding-stat-val {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
        }

        .onboarding-stat-lbl {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary, #94a3b8);
          text-transform: uppercase;
          letter-spacing: 0.05em;
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
        <!-- Step Progress Dots -->
        <div class="onboarding-step-indicator" aria-label="Onboarding Progress">
          <div class="onboarding-step-dot ${this.currentStep === 1 ? 'active' : ''}"></div>
          <div class="onboarding-step-dot ${this.currentStep === 2 ? 'active' : ''}"></div>
          <div class="onboarding-step-dot ${this.currentStep === 3 ? 'active' : ''}"></div>
          <div class="onboarding-step-dot ${this.currentStep === 4 ? 'active' : ''}"></div>
          <div class="onboarding-step-dot ${this.currentStep === 5 ? 'active' : ''}"></div>
        </div>

        ${this.renderStepContent(caps)}
      </div>
    `;

    this.bindEvents();
  }

  private renderStepContent(caps: { hasDirectoryPicker: boolean; summary: string }): string {
    switch (this.currentStep) {
      case 1:
        return `
          <div class="onboarding-icon-wrap">🎵</div>
          <div>
            <h2 id="onboarding-modal-title" class="onboarding-title">Welcome to MyMusicApp</h2>
            <p class="onboarding-subtitle">Your Personal Audio Operating System</p>
          </div>
          <p class="onboarding-description">
            A high-fidelity, local-first audio player designed for music collectors. Enjoy pristine lossless playback, 10-band DSP equalization, and celestial music exploration.
          </p>
          <div class="onboarding-feature-box">
            <span style="font-size: 22px;">🌌</span>
            <div>
              <strong style="font-size: 13px; color: #ffffff;">Audio Galaxy & EQ Studio</strong>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--color-text-secondary);">
                Interactive music visualization, real-time waveform spectrums, and dynamic ReplayGain normalization.
              </p>
            </div>
          </div>
          <div class="onboarding-actions">
            <button id="btn-onboarding-next" class="onboarding-btn onboarding-btn-primary">
              <span>Get Started</span>
              <span>→</span>
            </button>
            <button id="btn-onboarding-skip" class="onboarding-btn onboarding-btn-tertiary">
              Skip Tour
            </button>
          </div>
        `;

      case 2:
        return `
          <div class="onboarding-icon-wrap">🔒</div>
          <div>
            <h2 id="onboarding-modal-title" class="onboarding-title">Local-First Architecture</h2>
            <p class="onboarding-subtitle">100% On-Device Privacy</p>
          </div>
          <p class="onboarding-description">
            MyMusicApp connects directly to your device's audio files without uploading your music to any server or cloud database.
          </p>
          <div class="onboarding-feature-box">
            <span style="font-size: 22px;">🛡</span>
            <div>
              <strong style="font-size: 13px; color: #ffffff;">Zero Remote Telemetry</strong>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--color-text-secondary);">
                Your library index, playlists, listening history, and EQ presets remain entirely inside your browser IndexedDB.
              </p>
            </div>
          </div>
          <div style="font-size: 12px; color: var(--color-accent-secondary); background: rgba(6, 182, 212, 0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(6, 182, 212, 0.25);">
            Browser Capability: ${this.escapeHtml(caps.summary)}
          </div>
          <div class="onboarding-actions">
            <button id="btn-onboarding-next" class="onboarding-btn onboarding-btn-primary">
              <span>Connect Local Music</span>
              <span>→</span>
            </button>
            <button id="btn-onboarding-back" class="onboarding-btn onboarding-btn-tertiary">
              Back
            </button>
          </div>
        `;

      case 3:
        return `
          <div class="onboarding-icon-wrap">📁</div>
          <div>
            <h2 id="onboarding-modal-title" class="onboarding-title">Select Your Music Folder</h2>
            <p class="onboarding-subtitle">Import Your Audio Library</p>
          </div>
          <p class="onboarding-description">
            Choose a folder containing your MP3, FLAC, AAC, WAV, or ALAC audio files to build your local collection.
          </p>

          ${this.statusMessage ? `
            <div style="font-size: 13px; color: ${this.permissionStatus === 'DENIED' ? '#f87171' : '#34d399'}; padding: 10px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);">
              ${this.escapeHtml(this.statusMessage)}
            </div>
          ` : ''}

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

            <button id="btn-onboarding-skip" class="onboarding-btn onboarding-btn-tertiary">
              Continue Without Music
            </button>
          </div>

          <input type="file" id="onboarding-file-input" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.webm,.aiff,.aif,.alac" style="display: none;" />
        `;

      case 4:
        return `
          <div class="onboarding-icon-wrap">🔄</div>
          <div>
            <h2 id="onboarding-modal-title" class="onboarding-title">Scanning Music Library</h2>
            <p class="onboarding-subtitle">Extracting ID3 / FLAC Metadata & Artwork</p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 14px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #ffffff; font-weight: 600;">
              <span id="onboarding-status-text">Processing audio files...</span>
              <span id="onboarding-count-text">0 files</span>
            </div>
            <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.08); border-radius: 999px; overflow: hidden;">
              <div id="onboarding-bar-fill" style="width: 30%; height: 100%; background: var(--color-accent-gradient); border-radius: 999px; transition: width 0.2s ease;"></div>
            </div>
            <span id="onboarding-file-text" style="font-size: 11px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;">
              Indexing tracks...
            </span>
          </div>

          <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0;">
            Extracting sample rates, bitrates, embedded album art, and artist links.
          </p>
        `;

      case 5:
        return `
          <div class="onboarding-icon-wrap" style="background: linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(6, 182, 212, 0.25)); border-color: rgba(52, 211, 153, 0.4);">✓</div>
          <div>
            <h2 id="onboarding-modal-title" class="onboarding-title">Library is Ready!</h2>
            <p class="onboarding-subtitle" style="color: #34d399;">Local Indexing Completed</p>
          </div>

          <div class="onboarding-stats-row">
            <div class="onboarding-stat-chip">
              <span class="onboarding-stat-val">${this.libraryStats.trackCount}</span>
              <span class="onboarding-stat-lbl">Tracks</span>
            </div>
            <div class="onboarding-stat-chip">
              <span class="onboarding-stat-val">${this.libraryStats.albumCount}</span>
              <span class="onboarding-stat-lbl">Albums</span>
            </div>
            <div class="onboarding-stat-chip">
              <span class="onboarding-stat-val">${this.libraryStats.artistCount}</span>
              <span class="onboarding-stat-lbl">Artists</span>
            </div>
          </div>

          <p class="onboarding-description">
            Your local audio files are ready for playback, custom playlist curation, and Audio Galaxy exploration.
          </p>

          <div class="onboarding-actions">
            <button id="btn-ready-library" class="onboarding-btn onboarding-btn-primary">
              <span>Open Library</span>
              <span>→</span>
            </button>
            <button id="btn-ready-home" class="onboarding-btn onboarding-btn-secondary">
              Go to Home
            </button>
          </div>
        `;
    }
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    const nextBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-onboarding-next');
    nextBtn?.addEventListener('click', () => {
      this.currentStep = (this.currentStep + 1) as OnboardingStep;
      this.render();
    });

    const backBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-onboarding-back');
    backBtn?.addEventListener('click', () => {
      this.currentStep = (this.currentStep - 1) as OnboardingStep;
      this.render();
    });

    const skipBtns = this.overlay.querySelectorAll<HTMLButtonElement>('#btn-onboarding-skip');
    skipBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

    const chooseFolderBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-choose-folder');
    chooseFolderBtn?.addEventListener('click', () => void this.handleChooseFolder());

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

    const readyLibBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-ready-library');
    readyLibBtn?.addEventListener('click', () => {
      this.close();
      this.router?.navigate('library');
    });

    const readyHomeBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-ready-home');
    readyHomeBtn?.addEventListener('click', () => {
      this.close();
      this.router?.navigate('home');
    });
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
      this.currentStep = 4;
      this.render();

      const rootPath = `folder://${handle.name}`;
      this.fsAdapter.registerDirectoryHandle(rootPath, handle);

      if (this.dbAdapter) {
        try {
          await this.dbAdapter.put(STORES.SETTINGS, {
            key: 'music_directory_handle',
            handle,
            path: rootPath,
            name: handle.name,
            updatedAt: Date.now()
          });
        } catch {
          // Non-fatal
        }
      }

      await this.scannerService.scanDirectory(rootPath);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.permissionStatus = 'NOT_REQUESTED';
        this.currentStep = 3;
        this.render();
        return;
      }

      this.permissionStatus = 'DENIED';
      this.currentStep = 3;
      this.statusMessage = 'Folder permission was not granted. Please retry or choose audio files.';
      this.render();
    }
  }

  private async handleFilesSelected(files: FileList): Promise<void> {
    if (files.length === 0) return;

    try {
      this.currentStep = 4;
      this.render();

      if (this.scannerService.importFiles) {
        await this.scannerService.importFiles(files);
      }
      if (this.libraryService) {
        this.libraryStats = await this.libraryService.getLibraryStats();
      }
      this.currentStep = 5;
      this.render();
    } catch (err: any) {
      this.currentStep = 3;
      this.statusMessage = `Failed to import files: ${err?.message || 'Unknown error'}`;
      this.render();
    }
  }

  private updateProgressDisplay(): void {
    if (!this.overlay || !this.progressReport) return;
    const statusText = this.overlay.querySelector<HTMLElement>('#onboarding-status-text');
    const countText = this.overlay.querySelector<HTMLElement>('#onboarding-count-text');
    const barFill = this.overlay.querySelector<HTMLElement>('#onboarding-bar-fill');
    const fileText = this.overlay.querySelector<HTMLElement>('#onboarding-file-text');

    if (statusText) {
      statusText.textContent = this.progressReport.isComplete ? 'Scan Complete!' : 'Indexing Audio Files...';
    }
    if (countText) {
      countText.textContent = `${this.progressReport.filesProcessed} / ${this.progressReport.filesDiscovered} files`;
    }
    if (fileText && this.progressReport.currentFile) {
      const name = this.progressReport.currentFile.split('/').pop() || this.progressReport.currentFile;
      fileText.textContent = `Reading: ${name}`;
    }
    if (barFill) {
      const pct = this.progressReport.filesDiscovered > 0
        ? Math.min(100, Math.round((this.progressReport.filesProcessed / this.progressReport.filesDiscovered) * 100))
        : 35;
      barFill.style.width = `${pct}%`;
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
