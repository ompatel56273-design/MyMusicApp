import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type {
  IAudioEngine,
  IAudioSettingsService,
  IVisualizerService,
  IGalaxyService,
  IScannerService,
  ILibraryService,
  IPlaybackManager
} from '../../services/contracts/service-contracts';
import type { VisualizerMode } from '../../domain/entities/visualizer-settings';
import type { RepeatMode, ShuffleMode } from '../../domain/value-objects/audio-types';
import { EqualizerComponent } from '../components/audio/equalizer-component';
import { ReplayGainControlsComponent } from '../components/audio/replaygain-controls-component';
import { ThemeManager, type ThemePreference, type ResolvedTheme } from '../theme/theme-manager';
import type { AccentThemeId, AccentThemeDefinition } from '../theme/accent-theme';
import type { BrowserFilesystemAdapter } from '../../services/scanner/browser-filesystem-adapter';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { FileAccessCapabilityService } from '../../services/scanner/file-access-capability';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { ScanProgressReport } from '../../services/scanner/scanner-types';
import type { Disposable } from '../../core/types/common';
import type { RouterService } from '../navigation/router-service';
import { SleepTimerService } from '../../services/playback/sleep-timer-service';
import { SleepTimerModalComponent } from '../components/player/sleep-timer-modal';
import { getIconSvg } from '../icons/icon-registry';

export interface SettingsViewDependencies {
  audioEngine?: IAudioEngine | undefined;
  audioSettingsService?: IAudioSettingsService | undefined;
  visualizerService?: IVisualizerService | undefined;
  galaxyService?: IGalaxyService | undefined;
  scannerService?: IScannerService | undefined;
  libraryService?: ILibraryService | undefined;
  playbackManager?: IPlaybackManager | undefined;
  sleepTimerService?: SleepTimerService | undefined;
  fsAdapter?: BrowserFilesystemAdapter | undefined;
  dbAdapter?: IDatabaseAdapter | undefined;
  eventBus?: EventBus | undefined;
  router?: RouterService | undefined;
}

export type SettingsSectionId =
  | 'music-access'
  | 'playback'
  | 'audio'
  | 'appearance'
  | 'visualizer'
  | 'galaxy'
  | 'storage'
  | 'devices'
  | 'privacy'
  | 'about';

interface SectionNavItem {
  id: SettingsSectionId;
  label: string;
  icon: string;
}

/**
 * SettingsView - Comprehensive presentation layer for Desktop, Tablet, and Mobile Template 9.
 * Rebuilt strictly against Template 9 visual specifications, using Phase 2 design tokens,
 * full responsive layouts (320px - 1920px), real service integrations, and zero fake state.
 */
export class SettingsView implements IView {
  private container: HTMLElement | null = null;
  private readonly audioEngine?: IAudioEngine | undefined;
  private readonly audioSettingsService?: IAudioSettingsService | undefined;
  private readonly visualizerService?: IVisualizerService | undefined;
  private readonly galaxyService?: IGalaxyService | undefined;
  private readonly scannerService?: IScannerService | undefined;
  private readonly libraryService?: ILibraryService | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly sleepTimerService?: SleepTimerService | undefined;
  private readonly fsAdapter?: BrowserFilesystemAdapter | undefined;
  private readonly dbAdapter?: IDatabaseAdapter | undefined;
  private readonly eventBus?: EventBus | undefined;
  private readonly router?: RouterService | undefined;
  private readonly capabilityService = FileAccessCapabilityService.getInstance();

  private equalizerComponent: EqualizerComponent | null = null;
  private replayGainComponent: ReplayGainControlsComponent | null = null;
  private themeUnsub: (() => void) | null = null;
  private accentUnsub: (() => void) | null = null;
  private ambientUnsub: (() => void) | null = null;
  private dynamicArtworkUnsub: (() => void) | null = null;
  private playerLayoutUnsub: (() => void) | null = null;
  private densityUnsub: (() => void) | null = null;
  private eventBusSubs: Disposable[] = [];
  private connectedFolderName: string | null = null;
  private activeSection: SettingsSectionId = 'music-access';

  private readonly sections: SectionNavItem[] = [
    { id: 'music-access', label: 'Local Music Access', icon: 'folder' },
    { id: 'playback', label: 'Playback Preferences', icon: 'play' },
    { id: 'audio', label: 'Audio DSP & EQ', icon: 'volume' },
    { id: 'appearance', label: 'Theme & Style', icon: 'settings' },
    { id: 'visualizer', label: 'Audio Visualizer', icon: 'maximize' },
    { id: 'galaxy', label: 'Audio Galaxy', icon: 'galaxy' },
    { id: 'storage', label: 'Storage & Database', icon: 'library' },
    { id: 'devices', label: 'Audio Output', icon: 'volume' },
    { id: 'privacy', label: 'Privacy & Architecture', icon: 'check' },
    { id: 'about', label: 'About & Diagnostics', icon: 'music' }
  ];

  constructor(deps?: SettingsViewDependencies) {
    this.audioEngine = deps?.audioEngine;
    this.audioSettingsService = deps?.audioSettingsService;
    this.visualizerService = deps?.visualizerService;
    this.galaxyService = deps?.galaxyService;
    this.scannerService = deps?.scannerService;
    this.libraryService = deps?.libraryService;
    this.playbackManager = deps?.playbackManager;
    this.sleepTimerService = deps?.sleepTimerService;
    this.fsAdapter = deps?.fsAdapter;
    this.dbAdapter = deps?.dbAdapter;
    this.eventBus = deps?.eventBus;
    this.router = deps?.router;
  }

  public mount(container: HTMLElement, params?: RouteParams): void {
    this.container = container;
    const requestedSection = (params as any)?.section || (params?.tab as any);
    if (requestedSection && this.sections.some(s => s.id === requestedSection)) {
      this.activeSection = requestedSection as SettingsSectionId;
    }

    this.render();
    this.mountSubComponents();
    this.attachNavigationEvents();
    this.attachThemeListeners();
    this.attachPlaybackSettingsListeners();
    this.attachVisualizerSettingsListeners();
    this.attachGalaxySettingsListeners();
    this.attachMusicAccessListeners();
    this.attachStorageListeners();
    this.attachDeviceListeners();
    this.attachEventBusSubscriptions();
    this.refreshAllStats();
  }

  public unmount(): void {
    if (this.themeUnsub) {
      this.themeUnsub();
      this.themeUnsub = null;
    }
    if (this.accentUnsub) {
      this.accentUnsub();
      this.accentUnsub = null;
    }
    if (this.ambientUnsub) {
      this.ambientUnsub();
      this.ambientUnsub = null;
    }
    if (this.dynamicArtworkUnsub) {
      this.dynamicArtworkUnsub();
      this.dynamicArtworkUnsub = null;
    }
    if (this.playerLayoutUnsub) {
      this.playerLayoutUnsub();
      this.playerLayoutUnsub = null;
    }
    if (this.densityUnsub) {
      this.densityUnsub();
      this.densityUnsub = null;
    }
    for (const sub of this.eventBusSubs) {
      sub.dispose();
    }
    this.eventBusSubs = [];

    if (this.equalizerComponent) {
      this.equalizerComponent.unmount();
      this.equalizerComponent = null;
    }
    if (this.replayGainComponent) {
      this.replayGainComponent.unmount();
      this.replayGainComponent = null;
    }

    const modal = document.querySelector('#settings-confirm-modal-overlay');
    if (modal) {
      modal.remove();
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(params?: RouteParams): void {
    const requestedSection = (params as any)?.section || (params?.tab as any);
    if (requestedSection && this.sections.some(s => s.id === requestedSection)) {
      this.switchToSection(requestedSection as SettingsSectionId);
    }
  }

  private render(): void {
    if (!this.container) return;
    const caps = this.capabilityService.getCapabilities();

    this.container.innerHTML = `
      <style>
        .settings-view-root {
          padding: var(--space-6);
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          box-sizing: border-box;
          position: relative;
          width: 100%;
          min-width: 0;
        }

        /* Hero Banner */
        .settings-hero-card {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.22), rgba(6, 182, 212, 0.12), rgba(15, 23, 42, 0.75));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-2xl);
          padding: var(--space-8);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: var(--shadow-lg);
          box-sizing: border-box;
        }

        .settings-hero-glow {
          position: absolute;
          top: -30%;
          right: -5%;
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
        }

        .settings-hero-chips {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-top: var(--space-4);
          flex-wrap: wrap;
        }

        .settings-hero-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          border: 1px solid var(--glass-border);
          background: var(--glass-surface);
          color: var(--color-text-secondary);
        }

        /* Desktop & Tablet Grid */
        .settings-main-layout {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr) 300px;
          gap: var(--space-6);
          align-items: start;
          width: 100%;
          box-sizing: border-box;
        }

        /* Sub-Navigation Sidebar */
        .settings-nav-panel {
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-2xl);
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: 4px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          position: sticky;
          top: var(--space-4);
          box-sizing: border-box;
        }

        .settings-nav-btn {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 10px 14px;
          border-radius: var(--radius-lg);
          border: 1px solid transparent;
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          text-align: left;
          width: 100%;
          box-sizing: border-box;
          min-height: 44px;
        }

        .settings-nav-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--color-text-primary);
        }

        .settings-nav-btn.active {
          background: var(--color-accent-gradient);
          color: #ffffff;
          box-shadow: var(--shadow-glow-purple);
        }

        /* Central Content Area */
        .settings-sections-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .settings-card {
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-2xl);
          padding: var(--space-6);
          box-sizing: border-box;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .settings-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: var(--space-3);
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .settings-card-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 2px 0 0 0;
        }

        .settings-card-category {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-accent-secondary);
        }

        /* Right Side Info Area */
        .settings-sidebar-info {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          box-sizing: border-box;
        }

        .settings-info-card {
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-2xl);
          padding: var(--space-5);
          box-sizing: border-box;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        /* Grids & Form Controls */
        .settings-theme-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-3);
          width: 100%;
          box-sizing: border-box;
        }

        .settings-theme-option {
          background: var(--color-bg-surface-elevated);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          cursor: pointer;
          min-height: 120px;
          justify-content: center;
          transition: all var(--duration-fast) var(--ease-smooth);
          user-select: none;
          box-sizing: border-box;
          text-align: center;
        }

        .settings-theme-option:hover {
          border-color: var(--glass-border-highlight);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .settings-theme-option.active {
          border-color: var(--color-accent-primary);
          background: var(--color-accent-subtle);
          box-shadow: var(--shadow-glow);
        }

        /* Accent Theme Selection Grid */
        .settings-accent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: var(--space-3);
          width: 100%;
        }

        .settings-accent-option {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 12px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          transition: all var(--duration-fast) var(--ease-smooth);
          outline: none;
        }

        .settings-accent-option:hover {
          background: var(--glass-bg-subtle-hover);
          border-color: var(--glass-border-interactive);
          transform: translateY(-1px);
        }

        .settings-accent-option:focus-visible {
          border-color: var(--color-accent-primary);
          box-shadow: var(--shadow-glow);
        }

        .settings-accent-option.active {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent-primary);
          box-shadow: 0 0 16px var(--color-accent-muted);
        }

        .settings-accent-swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform var(--duration-fast);
        }

        .settings-accent-option:hover .settings-accent-swatch {
          transform: scale(1.08);
        }

        .settings-accent-details {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .settings-accent-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .settings-accent-desc {
          font-size: 11px;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }

        .settings-ambient-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
          width: 100%;
        }

        .settings-ambient-option {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          user-select: none;
          outline: none;
        }

        .settings-ambient-option:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--glass-border-interactive);
          transform: translateY(-1px);
        }

        .settings-ambient-option:focus-visible {
          border-color: var(--color-accent-primary);
          box-shadow: var(--shadow-glow);
        }

        .settings-ambient-option.active {
          background: var(--color-accent-subtle);
          border-color: var(--color-accent-primary);
          box-shadow: 0 0 16px var(--color-accent-muted);
        }

        .settings-ambient-swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-bg-surface-elevated);
          border: 1px solid var(--glass-border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .settings-ambient-check {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--color-accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-form-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-xl);
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .settings-form-row-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 180px;
          flex: 1;
        }

        .settings-form-row-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .settings-form-row-desc {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .settings-input-control {
          background: var(--color-bg-surface-elevated);
          border: 1px solid var(--glass-border);
          color: var(--color-text-primary);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 500;
          min-height: 40px;
          box-sizing: border-box;
        }

        .settings-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-lg);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          border: 1px solid var(--glass-border);
          background: var(--glass-surface);
          color: var(--color-text-primary);
          min-height: 44px;
          box-sizing: border-box;
          user-select: none;
        }

        .settings-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .settings-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .settings-action-btn-primary {
          background: var(--color-accent-gradient);
          color: #ffffff;
          border: none;
          box-shadow: var(--shadow-glow-purple);
        }

        .settings-action-btn-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .settings-action-btn-danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
          border-color: rgba(239, 68, 68, 0.5);
        }

        /* Stats Table */
        .settings-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: var(--space-3);
          width: 100%;
        }

        .settings-stat-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .settings-stat-number {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-text-primary);
          font-variant-numeric: tabular-nums;
        }

        .settings-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Tablet Responsive (768px - 1199px) */
        @media (max-width: 1199px) and (min-width: 768px) {
          .settings-main-layout {
            grid-template-columns: 220px minmax(0, 1fr);
          }
          .settings-sidebar-info {
            display: none;
          }
          .settings-view-root {
            padding: var(--space-4);
          }
          .settings-hero-card {
            padding: var(--space-6);
          }
        }

        /* Mobile Responsive (< 768px) */
        @media (max-width: 767px) {
          .settings-view-root {
            padding: var(--space-3);
            gap: var(--space-4);
          }
          .settings-hero-card {
            padding: var(--space-5);
            border-radius: var(--radius-xl);
          }
          .settings-main-layout {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }
          .settings-sidebar-info {
            display: none;
          }
          .settings-nav-panel {
            position: static;
            flex-direction: row;
            overflow-x: auto;
            border-radius: var(--radius-xl);
            padding: 4px;
            max-width: 100%;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .settings-nav-panel::-webkit-scrollbar {
            display: none;
          }
          .settings-nav-btn {
            flex: 0 0 auto;
            padding: 8px 14px;
            font-size: 12px;
            min-height: 40px;
          }
          .settings-theme-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .settings-form-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          .settings-form-row > select,
          .settings-form-row > button {
            width: 100%;
          }
        }
      </style>

      <section class="settings-view-root" role="region" aria-label="Settings Studio">
        <!-- Template 9 Studio Hero Banner -->
        <header class="settings-hero-card">
          <div class="settings-hero-glow" aria-hidden="true"></div>
          <div style="position: relative; z-index: 1;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-accent-secondary);">
              Personal Audio Operating System
            </span>
            <h1 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; margin: var(--space-1) 0 var(--space-2) 0; color: var(--color-text-primary);">
              Settings & Preferences
            </h1>
            <p style="font-size: 14px; font-weight: 500; color: var(--color-text-secondary); margin: 0; max-width: 620px; line-height: 1.5;">
              Configure local music access, audio DSP equalization, dynamic ReplayGain normalization, real-time visualizer, Audio Galaxy, and local storage.
            </p>

            <div class="settings-hero-chips">
              <span id="settings-chip-folder" class="settings-hero-chip">
                <span>📁</span>
                <span id="settings-chip-folder-text">Checking Access...</span>
              </span>
              <span id="settings-chip-theme" class="settings-hero-chip">
                <span>🎨</span>
                <span id="settings-chip-theme-text">Dark Atmosphere</span>
              </span>
              <span id="settings-chip-dsp" class="settings-hero-chip">
                <span>🎚</span>
                <span id="settings-chip-dsp-text">Audio DSP Active (48kHz)</span>
              </span>
            </div>
          </div>
        </header>

        <!-- Main Layout: Navigation Sidebar + Central Content + Right-Side Info -->
        <div class="settings-main-layout">
          <!-- Sub-Navigation Panel -->
          <nav class="settings-nav-panel" role="tablist" aria-label="Settings Categories">
            ${this.sections
              .map(
                s => `
              <button
                class="settings-nav-btn ${s.id === this.activeSection ? 'active' : ''}"
                data-target="section-${s.id}"
                role="tab"
                aria-selected="${s.id === this.activeSection ? 'true' : 'false'}"
                aria-controls="section-${s.id}"
                id="tab-${s.id}"
              >
                <span style="display: flex; align-items: center;">${getIconSvg(s.icon as any, { size: 18 })}</span>
                <span>${s.label}</span>
              </button>
            `
              )
              .join('')}
          </nav>

          <!-- Central Content Sections -->
          <div class="settings-sections-wrapper" role="tabpanel" id="settings-tab-panel">
            <!-- 1. Local Music Access Section -->
            <section id="section-music-access" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Local Filesystem</span>
                  <h2 class="settings-card-title">Local Music Access</h2>
                </div>
                <span id="settings-music-access-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: rgba(148, 163, 184, 0.15); color: var(--color-text-secondary); border: 1px solid rgba(148, 163, 184, 0.3);">
                  Checking status...
                </span>
              </div>

              <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 20px;">🔒</span>
                <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.4;">
                  <strong>Your audio stays on your local device.</strong> MyMusicApp operates fully local-first via File System Access API and IndexedDB. Zero cloud uploads or remote tracking.
                </p>
              </div>

              <!-- Real-time Scan Progress Container -->
              <div id="settings-scan-progress-box" style="display: none; flex-direction: column; gap: 8px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: var(--radius-lg); padding: 14px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span id="settings-scan-status-text" style="font-size: 13px; font-weight: 700; color: #818cf8;">
                    Scanning Music Library...
                  </span>
                  <span id="settings-scan-progress-count" style="font-size: 12px; font-weight: 600; color: var(--color-text-secondary);">
                    0 files
                  </span>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: var(--radius-full); overflow: hidden;">
                  <div id="settings-scan-progress-bar" style="width: 30%; height: 100%; background: var(--color-accent-gradient); transition: width 0.2s ease;"></div>
                </div>
                <span id="settings-scan-current-file" style="font-size: 11px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  Starting scanner...
                </span>
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px;">
                <button id="settings-btn-rescan" class="settings-action-btn settings-action-btn-primary">
                  <span>🔄</span>
                  <span>Rescan Music</span>
                </button>

                ${caps.hasDirectoryPicker ? `
                  <button id="settings-btn-change-folder" class="settings-action-btn">
                    <span>📁</span>
                    <span>Change Music Folder</span>
                  </button>
                ` : `
                  <span style="font-size: 12px; color: var(--color-text-muted); align-self: center;">
                    Directory picker not supported by this browser.
                  </span>
                `}

                <button id="settings-btn-choose-files" class="settings-action-btn">
                  <span>🎵</span>
                  <span>Choose Audio Files</span>
                </button>
              </div>

              <input type="file" id="settings-file-input" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.webm,.aiff,.aif,.alac" style="display: none;" />
            </section>

            <!-- 2. Playback Preferences Section -->
            <section id="section-playback" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Transport & Queue</span>
                  <h2 class="settings-card-title">Playback Preferences</h2>
                </div>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Default Playback Rate</span>
                  <span class="settings-form-row-desc">Speed factor for audio playback (0.5x - 2.0x)</span>
                </div>
                <select id="settings-playback-rate" class="settings-input-control">
                  <option value="0.75">0.75x (Slow)</option>
                  <option value="1.0" selected>1.0x (Normal)</option>
                  <option value="1.25">1.25x (Fast)</option>
                  <option value="1.5">1.5x (Accelerated)</option>
                  <option value="2.0">2.0x (Double Speed)</option>
                </select>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Repeat Mode</span>
                  <span class="settings-form-row-desc">Looping behavior when queue reaches completion</span>
                </div>
                <select id="settings-repeat-mode" class="settings-input-control">
                  <option value="off">Off (Stop at queue end)</option>
                  <option value="all">Repeat All (Loop queue)</option>
                  <option value="one">Repeat One (Loop single track)</option>
                </select>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Shuffle Behavior</span>
                  <span class="settings-form-row-desc">Randomize track playback ordering</span>
                </div>
                <select id="settings-shuffle-mode" class="settings-input-control">
                  <option value="off">Sequential (Play in order)</option>
                  <option value="all">Shuffle All (Random queue order)</option>
                </select>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Crossfade Playback</span>
                  <span class="settings-form-row-desc">Smoothly blend consecutive tracks with overlapping volume ramps</span>
                </div>
                <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px; font-weight: 700; color: var(--color-text-primary); background: rgba(255, 255, 255, 0.04); padding: 6px 14px; border-radius: var(--radius-full); border: 1px solid var(--glass-border);">
                  <input type="checkbox" id="settings-crossfade-enabled" style="accent-color: var(--color-accent-secondary);" />
                  Enable Crossfade
                </label>
              </div>

              <div class="settings-form-row" id="settings-crossfade-duration-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Crossfade Duration</span>
                  <span class="settings-form-row-desc">Transition overlap length between tracks (1s – 12s)</span>
                </div>
                <select id="settings-crossfade-duration" class="settings-input-control">
                  <option value="1">1 Second</option>
                  <option value="2">2 Seconds</option>
                  <option value="3" selected>3 Seconds (Default)</option>
                  <option value="4">4 Seconds</option>
                  <option value="5">5 Seconds</option>
                  <option value="6">6 Seconds</option>
                  <option value="8">8 Seconds</option>
                  <option value="10">10 Seconds</option>
                  <option value="12">12 Seconds</option>
                </select>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Direct Equalizer Navigation</span>
                  <span class="settings-form-row-desc">Open the dedicated 10-Band Graphic Equalizer view</span>
                </div>
                <button id="settings-btn-go-audio" class="settings-action-btn">
                  <span>🎚</span>
                  <span>Open Audio & EQ View</span>
                </button>
              </div>

              <div class="settings-form-row" style="border-top: 1px solid var(--glass-border); padding-top: var(--space-4); margin-top: var(--space-2);">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Sleep Timer</span>
                  <span id="settings-sleep-timer-status" class="settings-form-row-desc">
                    ${this.sleepTimerService?.getState().isActive
                      ? `Active: Pausing playback in ${Math.ceil(this.sleepTimerService.getState().remainingMs / 60000)} minutes.`
                      : 'Automatically pause playback after a set duration. (Currently Inactive)'}
                  </span>
                </div>
                <button id="settings-btn-sleep-timer" class="settings-action-btn">
                  <span>🌙</span>
                  <span id="settings-btn-sleep-timer-text">
                    ${this.sleepTimerService?.getState().isActive ? 'Manage Sleep Timer' : 'Set Sleep Timer'}
                  </span>
                </button>
              </div>
            </section>

            <!-- 3. Audio DSP & Equalizer Section -->
            <div id="section-audio" style="display: flex; flex-direction: column; gap: var(--space-6); width: 100%;" tabindex="-1">
              <div id="settings-equalizer-slot"></div>
              <div id="settings-replaygain-slot"></div>
            </div>

            <!-- 4. Theme & Appearance Section -->
            <section id="section-appearance" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Interface Aesthetics</span>
                  <h2 class="settings-card-title">Theme & Appearance</h2>
                </div>
                <span id="settings-theme-status-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: rgba(168, 85, 247, 0.15); color: var(--color-accent-primary); border: 1px solid rgba(168, 85, 247, 0.3);">
                  Dark Atmosphere Active
                </span>
              </div>

              <div class="settings-theme-grid">
                <div class="settings-theme-option" data-theme-val="dark" role="button" tabindex="0" aria-label="Select Dark Atmosphere Theme">
                  <span style="font-size: 28px;">🌙</span>
                  <span style="font-size: 14px; font-weight: 700; color: var(--color-text-primary);">Dark Atmosphere</span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">Cinematic dark aesthetic with neon glow</span>
                </div>
                <div class="settings-theme-option" data-theme-val="light" role="button" tabindex="0" aria-label="Select Light Mode Theme">
                  <span style="font-size: 28px;">☀️</span>
                  <span style="font-size: 14px; font-weight: 700; color: var(--color-text-primary);">Light Mode</span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">Crisp bright interface with vibrant contrast</span>
                </div>
                <div class="settings-theme-option" data-theme-val="system" role="button" tabindex="0" aria-label="Select System Match Theme">
                  <span style="font-size: 28px;">💻</span>
                  <span style="font-size: 14px; font-weight: 700; color: var(--color-text-primary);">System Match</span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">Dynamically syncs with OS color mode</span>
                </div>
              </div>

              <!-- Accent Color Theme Selection -->
              <div style="margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Accent Color</h3>
                    <p style="font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0 0;">Personalize highlights, glows, sliders, and interactive controls across the app</p>
                  </div>
                  <span id="settings-accent-status-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: var(--color-accent-muted); color: var(--color-accent-primary); border: 1px solid var(--glass-border-highlight);">
                    Neon Purple Active
                  </span>
                </div>

                <div class="settings-accent-grid" role="radiogroup" aria-label="Accent Color Selection">
                  ${ThemeManager.getInstance().getAvailableAccentThemes().map(theme => `
                    <div
                      class="settings-accent-option ${theme.id === ThemeManager.getInstance().getAccentTheme() ? 'active' : ''}"
                      data-accent-val="${theme.id}"
                      role="radio"
                      tabindex="0"
                      aria-checked="${theme.id === ThemeManager.getInstance().getAccentTheme() ? 'true' : 'false'}"
                      aria-label="Select ${theme.name} Accent Theme"
                    >
                      <div class="settings-accent-swatch" style="background: ${theme.gradient}; box-shadow: 0 0 12px ${theme.glowColor}66;">
                        <span class="settings-accent-check" style="display: ${theme.id === ThemeManager.getInstance().getAccentTheme() ? 'flex' : 'none'};">${getIconSvg('check', { size: 14, color: '#ffffff' })}</span>
                      </div>
                      <div class="settings-accent-details">
                        <span class="settings-accent-name">${theme.name}</span>
                        <span class="settings-accent-desc">${theme.description}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Ambient Background Mode Selection -->
              <div style="margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Ambient Background</h3>
                    <p style="font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0 0;">Subtle animated or static atmospheric background visuals behind the application</p>
                  </div>
                  <span id="settings-ambient-status-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: var(--color-accent-muted); color: var(--color-accent-primary); border: 1px solid var(--glass-border-highlight);">
                    ${ThemeManager.getInstance().getAmbientModeDefinition().name} Active
                  </span>
                </div>

                <div class="settings-ambient-grid" role="radiogroup" aria-label="Ambient Background Selection">
                  ${ThemeManager.getInstance().getAvailableAmbientModes().map(mode => `
                    <div
                      class="settings-ambient-option ${mode.id === ThemeManager.getInstance().getAmbientMode() ? 'active' : ''}"
                      data-ambient-val="${mode.id}"
                      role="radio"
                      tabindex="0"
                      aria-checked="${mode.id === ThemeManager.getInstance().getAmbientMode() ? 'true' : 'false'}"
                      aria-label="Select ${mode.name} Ambient Mode"
                    >
                      <div class="settings-ambient-swatch">
                        <span style="font-size: 16px;">${mode.animated ? '✨' : '🎨'}</span>
                        <span class="settings-ambient-check" style="display: ${mode.id === ThemeManager.getInstance().getAmbientMode() ? 'flex' : 'none'};">${getIconSvg('check', { size: 14, color: '#ffffff' })}</span>
                      </div>
                      <div class="settings-accent-details">
                        <span class="settings-accent-name">${mode.name}</span>
                        <span class="settings-accent-desc">${mode.description}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Dynamic Artwork Colors Toggle -->
              <div style="margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--glass-border);">
                <div class="settings-form-row" style="background: transparent; border: none; padding: 0;">
                  <div class="settings-form-row-label">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="settings-form-row-title">Dynamic Artwork Colors</span>
                      <span id="settings-dynamic-artwork-status-badge" style="font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: var(--radius-full); background: ${ThemeManager.getInstance().isDynamicArtworkColorsEnabled() ? 'var(--color-accent-muted)' : 'rgba(255, 255, 255, 0.05)'}; color: ${ThemeManager.getInstance().isDynamicArtworkColorsEnabled() ? 'var(--color-accent-primary)' : 'var(--color-text-muted)'}; border: 1px solid var(--glass-border);">
                        ${ThemeManager.getInstance().isDynamicArtworkColorsEnabled() ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <span class="settings-form-row-desc">Extract atmospheric color accents dynamically from currently displayed album artwork</span>
                  </div>
                  <input
                    type="checkbox"
                    id="settings-toggle-dynamic-artwork"
                    style="accent-color: var(--color-accent-primary); width: 22px; height: 22px; cursor: pointer;"
                    ${ThemeManager.getInstance().isDynamicArtworkColorsEnabled() ? 'checked' : ''}
                    aria-label="Toggle Dynamic Artwork Colors"
                  />
                </div>
              </div>

              <!-- Player Layout Mode Selection -->
              <div style="margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Player Layout</h3>
                    <p style="font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0 0;">Adjust the visual arrangement and scale of the full-screen playback presentation</p>
                  </div>
                  <span id="settings-layout-status-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: var(--color-accent-muted); color: var(--color-accent-primary); border: 1px solid var(--glass-border-highlight);">
                    ${ThemeManager.getInstance().getPlayerLayoutDefinition().name} Active
                  </span>
                </div>

                <div class="settings-ambient-grid" role="radiogroup" aria-label="Player Layout Selection">
                  ${ThemeManager.getInstance().getAvailablePlayerLayouts().map(layout => `
                    <div
                      class="settings-player-layout-option settings-layout-option ${layout.id === ThemeManager.getInstance().getPlayerLayout() ? 'active' : ''}"
                      data-layout-val="${layout.id}"
                      role="radio"
                      tabindex="0"
                      aria-checked="${layout.id === ThemeManager.getInstance().getPlayerLayout() ? 'true' : 'false'}"
                      aria-label="Select ${layout.name} Player Layout"
                    >
                      <div class="settings-ambient-swatch">
                        <span style="font-size: 16px;">${getIconSvg(layout.icon as any, { size: 16 })}</span>
                        <span class="settings-ambient-check" style="display: ${layout.id === ThemeManager.getInstance().getPlayerLayout() ? 'flex' : 'none'};">${getIconSvg('check', { size: 14, color: '#ffffff' })}</span>
                      </div>
                      <div class="settings-accent-details">
                        <span class="settings-accent-name">${layout.name}</span>
                        <span class="settings-accent-desc">${layout.description}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Library Information Density Selection -->
              <div style="margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--glass-border);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Library Information Density</h3>
                    <p style="font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0 0;">Adjust row heights, artwork sizing, and spacing across tracks, albums, artists, playlists, and folders</p>
                  </div>
                  <span id="settings-density-status-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: var(--color-accent-muted); color: var(--color-accent-primary); border: 1px solid var(--glass-border-highlight);">
                    ${ThemeManager.getInstance().getLibraryDensityDefinition().name} Active
                  </span>
                </div>

                <div class="settings-ambient-grid" role="radiogroup" aria-label="Library Density Selection">
                  ${ThemeManager.getInstance().getAvailableLibraryDensities().map(density => `
                    <div
                      class="settings-density-option settings-library-density-option ${density.id === ThemeManager.getInstance().getLibraryDensity() ? 'active' : ''}"
                      data-density-val="${density.id}"
                      role="radio"
                      tabindex="0"
                      aria-checked="${density.id === ThemeManager.getInstance().getLibraryDensity() ? 'true' : 'false'}"
                      aria-label="Select ${density.name} Library Density"
                    >
                      <div class="settings-ambient-swatch">
                        <span style="font-size: 16px;">${getIconSvg(density.icon as any, { size: 16 })}</span>
                        <span class="settings-ambient-check" style="display: ${density.id === ThemeManager.getInstance().getLibraryDensity() ? 'flex' : 'none'};">${getIconSvg('check', { size: 14, color: '#ffffff' })}</span>
                      </div>
                      <div class="settings-accent-details">
                        <span class="settings-accent-name">${density.name}</span>
                        <span class="settings-accent-desc">${density.description}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </section>

            <!-- 5. Audio Visualizer Preferences Section -->
            <section id="section-visualizer" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Real-time Graphics</span>
                  <h2 class="settings-card-title">Audio Visualizer Preferences</h2>
                </div>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Visualizer Style</span>
                  <span class="settings-form-row-desc">Select visual presentation style or disable visualizer</span>
                </div>
                <select id="settings-viz-mode" class="settings-input-control" aria-label="Visualizer Style">
                  <option value="off">Off</option>
                  <option value="bars">Spectrum Bars</option>
                  <option value="waveform">Waveform</option>
                  <option value="circular">Circular Spectrum</option>
                </select>
              </div>

              <div class="settings-ambient-grid" role="radiogroup" aria-label="Visualizer Style Selection" style="margin-top: var(--space-4);">
                <div class="settings-viz-style-option settings-viz-option" data-viz-style="off" role="radio" tabindex="0" aria-checked="false" aria-label="Off">
                  <div class="settings-ambient-swatch">
                    <span style="font-size: 16px;">🚫</span>
                  </div>
                  <div class="settings-accent-details">
                    <span class="settings-accent-name">Off</span>
                    <span class="settings-accent-desc">No visualizer processing or rendering</span>
                  </div>
                </div>
                <div class="settings-viz-style-option settings-viz-option" data-viz-style="bars" role="radio" tabindex="0" aria-checked="false" aria-label="Spectrum Bars">
                  <div class="settings-ambient-swatch">
                    <span style="font-size: 16px;">📊</span>
                  </div>
                  <div class="settings-accent-details">
                    <span class="settings-accent-name">Spectrum Bars</span>
                    <span class="settings-accent-desc">Frequency-domain animated vertical bars</span>
                  </div>
                </div>
                <div class="settings-viz-style-option settings-viz-option" data-viz-style="waveform" role="radio" tabindex="0" aria-checked="false" aria-label="Waveform">
                  <div class="settings-ambient-swatch">
                    <span style="font-size: 16px;">〰️</span>
                  </div>
                  <div class="settings-accent-details">
                    <span class="settings-accent-name">Waveform</span>
                    <span class="settings-accent-desc">Continuous time-domain oscilloscope wave</span>
                  </div>
                </div>
                <div class="settings-viz-style-option settings-viz-option" data-viz-style="circular" role="radio" tabindex="0" aria-checked="false" aria-label="Circular Spectrum">
                  <div class="settings-ambient-swatch">
                    <span style="font-size: 16px;">⭕</span>
                  </div>
                  <div class="settings-accent-details">
                    <span class="settings-accent-name">Circular Spectrum</span>
                    <span class="settings-accent-desc">Radial frequency distribution around a circle</span>
                  </div>
                </div>
              </div>

              <div class="settings-form-row" style="margin-top: var(--space-4);">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Frame Rate Target</span>
                  <span class="settings-form-row-desc">Target FPS cap for Canvas visualizer rendering</span>
                </div>
                <select id="settings-viz-fps" class="settings-input-control" aria-label="Frame Rate Target">
                  <option value="60">60 FPS (Smooth Motion)</option>
                  <option value="30">30 FPS (Power Efficient)</option>
                </select>
              </div>
            </section>

            <!-- 6. Audio Galaxy Configuration Section -->
            <section id="section-galaxy" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Cosmic Map</span>
                  <h2 class="settings-card-title">Audio Galaxy Preferences</h2>
                </div>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Default Level of Detail (LOD)</span>
                  <span class="settings-form-row-desc">Initial zoom depth when entering Audio Galaxy view</span>
                </div>
                <select id="settings-galaxy-lod" class="settings-input-control">
                  <option value="1">LOD 1 - Macro Genres</option>
                  <option value="2">LOD 2 - Artists & Bands</option>
                  <option value="3">LOD 3 - Full Track Constellations</option>
                </select>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Playlist Orbits</span>
                  <span class="settings-form-row-desc">Render custom user playlists as planetary orbits</span>
                </div>
                <input type="checkbox" id="settings-galaxy-playlists" style="accent-color: var(--color-accent-primary); width: 20px; height: 20px;" />
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Folder Orbits</span>
                  <span class="settings-form-row-desc">Render filesystem directories as celestial belts</span>
                </div>
                <input type="checkbox" id="settings-galaxy-folders" style="accent-color: var(--color-accent-primary); width: 20px; height: 20px;" />
              </div>
            </section>

            <!-- 7. Storage & Database Section -->
            <section id="section-storage" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">IndexedDB Engine</span>
                  <h2 class="settings-card-title">Storage & Library Management</h2>
                </div>
              </div>

              <!-- Statistics Grid -->
              <div class="settings-stats-grid">
                <div class="settings-stat-box">
                  <span id="settings-stat-tracks" class="settings-stat-number">0</span>
                  <span class="settings-stat-label">Tracks</span>
                </div>
                <div class="settings-stat-box">
                  <span id="settings-stat-albums" class="settings-stat-number">0</span>
                  <span class="settings-stat-label">Albums</span>
                </div>
                <div class="settings-stat-box">
                  <span id="settings-stat-artists" class="settings-stat-number">0</span>
                  <span class="settings-stat-label">Artists</span>
                </div>
                <div class="settings-stat-box">
                  <span id="settings-stat-genres" class="settings-stat-number">0</span>
                  <span class="settings-stat-label">Genres</span>
                </div>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Rebuild Library Index</span>
                  <span class="settings-form-row-desc">Rescan connected folders and recalculate library indices</span>
                </div>
                <button id="settings-btn-rebuild-index" class="settings-action-btn">
                  <span>⚡</span>
                  <span>Rebuild Index</span>
                </button>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Clear Playback History</span>
                  <span class="settings-form-row-desc">Remove listening logs and recently played timestamps</span>
                </div>
                <button id="settings-btn-clear-history" class="settings-action-btn settings-action-btn-danger">
                  <span>🗑</span>
                  <span>Clear History</span>
                </button>
              </div>

              <div class="settings-form-row">
                <div class="settings-form-row-label">
                  <span class="settings-form-row-title">Reset Local Database</span>
                  <span class="settings-form-row-desc">Clear IndexedDB library tables (Source audio files remain untouched)</span>
                </div>
                <button id="settings-btn-reset-db" class="settings-action-btn settings-action-btn-danger">
                  <span>⚠️</span>
                  <span>Reset Database</span>
                </button>
              </div>
            </section>

            <!-- 8. Audio Output & Devices Section -->
            <section id="section-devices" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Hardware</span>
                  <h2 class="settings-card-title">Audio Output & Devices</h2>
                </div>
              </div>

              <div id="settings-devices-list" style="display: flex; flex-direction: column; gap: 8px;">
                <div style="padding: 12px 16px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); font-size: 13px; color: var(--color-text-secondary);">
                  Scanning connected audio devices...
                </div>
              </div>
            </section>

            <!-- 9. Data & Privacy Section -->
            <section id="section-privacy" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">Security & Privacy</span>
                  <h2 class="settings-card-title">Privacy & Architecture</h2>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4);">
                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px;">🔒</span>
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Local-First Architecture</h3>
                  </div>
                  <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0; line-height: 1.5;">
                    Your tracks, metadata, playlists, EQ curves, visualizer presets, and history are stored exclusively inside local IndexedDB. Zero cloud telemetry.
                  </p>
                </div>

                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px;">🛡</span>
                    <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Audio Safety Limiter</h3>
                  </div>
                  <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0; line-height: 1.5;">
                    A 20:1 brickwall safety compressor protects your ears and audio hardware from digital clipping when boosting EQ bands or preamp levels.
                  </p>
                </div>
              </div>
            </section>

            <!-- 10. About & Diagnostics Section -->
            <section id="section-about" class="settings-card" tabindex="-1">
              <div class="settings-card-header">
                <div>
                  <span class="settings-card-category">System Information</span>
                  <h2 class="settings-card-title">About MyMusicApp</h2>
                </div>
              </div>

              <div class="settings-stats-grid">
                <div class="settings-stat-box">
                  <span class="settings-stat-number" style="font-size: 18px;">1.0.0</span>
                  <span class="settings-stat-label">Version</span>
                </div>
                <div class="settings-stat-box">
                  <span class="settings-stat-number" style="font-size: 18px;">Web Audio API</span>
                  <span class="settings-stat-label">DSP Engine</span>
                </div>
                <div class="settings-stat-box">
                  <span class="settings-stat-number" style="font-size: 18px;">IndexedDB v2</span>
                  <span class="settings-stat-label">Database</span>
                </div>
                <div class="settings-stat-box">
                  <span class="settings-stat-number" style="font-size: 18px;">Local-First</span>
                  <span class="settings-stat-label">Architecture</span>
                </div>
              </div>
            </section>
          </div>

          <!-- Right-Side Information Area (Desktop Template 9) -->
          <aside class="settings-sidebar-info" aria-label="Library & System Overview">
            <!-- Local Music Profile Card -->
            <div class="settings-info-card">
              <div style="display: flex; align-items: center; gap: var(--space-3);">
                <div style="width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--color-accent-gradient); display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-glow-purple);">
                  <span style="font-size: 20px;">🎧</span>
                </div>
                <div>
                  <h3 style="font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin: 0;">Local Audio Profile</h3>
                  <span id="settings-profile-storage-type" style="font-size: 11px; font-weight: 600; color: var(--color-accent-secondary);">
                    On-Device Storage
                  </span>
                </div>
              </div>

              <div style="border-top: 1px solid var(--glass-border); padding-top: var(--space-3); display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: var(--color-text-secondary);">Active Folder</span>
                  <span id="settings-profile-folder-name" style="color: var(--color-text-primary); font-weight: 600;">None</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: var(--color-text-secondary);">Indexed Tracks</span>
                  <span id="settings-profile-tracks-count" style="color: var(--color-text-primary); font-weight: 600;">0</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                  <span style="color: var(--color-text-secondary);">Database Status</span>
                  <span style="color: #34d399; font-weight: 600;">Online</span>
                </div>
              </div>
            </div>

            <!-- Audio DSP Status Card -->
            <div class="settings-info-card">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">🎚</span>
                <h3 style="font-size: 14px; font-weight: 700; color: var(--color-text-primary); margin: 0;">DSP Pipeline Status</h3>
              </div>
              <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">
                10 ISO bands active with real-time spline frequency interpolation and ReplayGain normalization.
              </p>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  private attachNavigationEvents(): void {
    if (!this.container) return;
    const navBtns = this.container.querySelectorAll<HTMLButtonElement>('.settings-nav-btn');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target')?.replace('section-', '') as SettingsSectionId;
        if (targetId) {
          this.switchToSection(targetId);
        }
      });
    });

    const goAudioBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-go-audio');
    goAudioBtn?.addEventListener('click', () => {
      if (this.router) {
        this.router.navigate('nowplaying');
      }
    });
  }

  public switchToSection(sectionId: SettingsSectionId): void {
    if (!this.container) return;
    this.activeSection = sectionId;

    const navBtns = this.container.querySelectorAll<HTMLButtonElement>('.settings-nav-btn');
    navBtns.forEach(btn => {
      const target = btn.getAttribute('data-target');
      const isActive = target === `section-${sectionId}`;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const targetSection = this.container.querySelector<HTMLElement>(`#section-${sectionId}`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetSection.focus();
    }
  }

  private mountSubComponents(): void {
    if (!this.container) return;

    if (this.audioEngine && this.audioSettingsService) {
      const eqSlot = this.container.querySelector<HTMLElement>('#settings-equalizer-slot');
      if (eqSlot) {
        this.equalizerComponent = new EqualizerComponent({
          audioEngine: this.audioEngine,
          audioSettingsService: this.audioSettingsService
        });
        void this.equalizerComponent.mount(eqSlot);
      }

      const rgSlot = this.container.querySelector<HTMLElement>('#settings-replaygain-slot');
      if (rgSlot) {
        this.replayGainComponent = new ReplayGainControlsComponent({
          audioEngine: this.audioEngine,
          audioSettingsService: this.audioSettingsService
        });
        void this.replayGainComponent.mount(rgSlot);
      }
    }
  }

  private attachThemeListeners(): void {
    if (!this.container) return;
    const themeManager = ThemeManager.getInstance();
    const options = this.container.querySelectorAll<HTMLElement>('.settings-theme-option');
    const badge = this.container.querySelector<HTMLElement>('#settings-theme-status-badge');
    const chipText = this.container.querySelector<HTMLElement>('#settings-chip-theme-text');

    const updateThemeDisplay = (pref: ThemePreference, resolved: ResolvedTheme) => {
      options.forEach(opt => {
        const val = opt.getAttribute('data-theme-val');
        opt.classList.toggle('active', val === pref);
      });

      const label = pref === 'system' ? `System Match (${resolved === 'dark' ? 'Dark' : 'Light'})` : pref === 'light' ? 'Light Mode Active' : 'Dark Atmosphere Active';
      if (badge) badge.textContent = label;
      if (chipText) chipText.textContent = label;
    };

    updateThemeDisplay(themeManager.getPreference(), themeManager.getResolvedTheme());

    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const pref = opt.getAttribute('data-theme-val') as ThemePreference;
        if (pref) {
          themeManager.setPreference(pref);
        }
      });
      opt.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const pref = opt.getAttribute('data-theme-val') as ThemePreference;
          if (pref) {
            themeManager.setPreference(pref);
          }
        }
      });
    });

    this.themeUnsub = themeManager.subscribe((resolved, pref) => {
      updateThemeDisplay(pref, resolved);
    });

    // Accent Theme Listeners
    const accentOptions = this.container.querySelectorAll<HTMLElement>('.settings-accent-option');
    const accentBadge = this.container.querySelector<HTMLElement>('#settings-accent-status-badge');

    const updateAccentDisplay = (accentId: AccentThemeId, def: AccentThemeDefinition) => {
      accentOptions.forEach(opt => {
        const val = opt.getAttribute('data-accent-val');
        const isActive = val === accentId;
        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
        const check = opt.querySelector<HTMLElement>('.settings-accent-check');
        if (check) check.style.display = isActive ? 'flex' : 'none';
      });

      if (accentBadge) {
        accentBadge.textContent = `${def.name} Active`;
        accentBadge.style.background = def.mutedBackground;
        accentBadge.style.color = def.primaryColor;
        accentBadge.style.borderColor = def.borderHighlight;
      }
    };

    updateAccentDisplay(themeManager.getAccentTheme(), themeManager.getAccentThemeDefinition());

    accentOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const accent = opt.getAttribute('data-accent-val') as AccentThemeId;
        if (accent) {
          themeManager.setAccentTheme(accent);
        }
      });
      opt.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const accent = opt.getAttribute('data-accent-val') as AccentThemeId;
          if (accent) {
            themeManager.setAccentTheme(accent);
          }
        }
      });
    });

    this.accentUnsub = themeManager.subscribeAccent((accentId, def) => {
      updateAccentDisplay(accentId, def);
    });

    // Ambient Background Listeners
    const ambientOptions = this.container.querySelectorAll<HTMLElement>('.settings-ambient-option');
    const ambientBadge = this.container.querySelector<HTMLElement>('#settings-ambient-status-badge');

    const updateAmbientDisplay = (modeId: any, def: any) => {
      ambientOptions.forEach(opt => {
        const val = opt.getAttribute('data-ambient-val');
        const isActive = val === modeId;
        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
        const check = opt.querySelector<HTMLElement>('.settings-ambient-check');
        if (check) check.style.display = isActive ? 'flex' : 'none';
      });

      if (ambientBadge) {
        ambientBadge.textContent = `${def.name} Active`;
      }
    };

    updateAmbientDisplay(themeManager.getAmbientMode(), themeManager.getAmbientModeDefinition());

    ambientOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const mode = opt.getAttribute('data-ambient-val');
        if (mode) {
          themeManager.setAmbientMode(mode);
        }
      });
      opt.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const mode = opt.getAttribute('data-ambient-val');
          if (mode) {
            themeManager.setAmbientMode(mode);
          }
        }
      });
    });

    this.ambientUnsub = themeManager.subscribeAmbient((modeId, def) => {
      updateAmbientDisplay(modeId, def);
    });

    // Dynamic Artwork Colors Listeners
    const dynamicToggle = this.container.querySelector<HTMLInputElement>('#settings-toggle-dynamic-artwork');
    const dynamicBadge = this.container.querySelector<HTMLElement>('#settings-dynamic-artwork-status-badge');

    const updateDynamicArtworkDisplay = (enabled: boolean) => {
      if (dynamicToggle) dynamicToggle.checked = enabled;
      if (dynamicBadge) {
        dynamicBadge.textContent = enabled ? 'Enabled' : 'Disabled';
        dynamicBadge.style.background = enabled ? 'var(--color-accent-muted)' : 'rgba(255, 255, 255, 0.05)';
        dynamicBadge.style.color = enabled ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
      }
    };

    updateDynamicArtworkDisplay(themeManager.isDynamicArtworkColorsEnabled());

    dynamicToggle?.addEventListener('change', () => {
      themeManager.setDynamicArtworkColorsEnabled(dynamicToggle.checked);
    });

    this.dynamicArtworkUnsub = themeManager.subscribeDynamicArtworkColors((enabled) => {
      updateDynamicArtworkDisplay(enabled);
    });

    // Player Layout Listeners
    const layoutOptions = this.container.querySelectorAll<HTMLElement>('.settings-layout-option');
    const layoutBadge = this.container.querySelector<HTMLElement>('#settings-layout-status-badge');

    const updateLayoutDisplay = (layoutId: string, def: any) => {
      layoutOptions.forEach(opt => {
        const val = opt.getAttribute('data-layout-val');
        const isActive = val === layoutId;
        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
        const check = opt.querySelector<HTMLElement>('.settings-ambient-check');
        if (check) check.style.display = isActive ? 'flex' : 'none';
      });

      if (layoutBadge) {
        layoutBadge.textContent = `${def.name} Active`;
      }
    };

    updateLayoutDisplay(themeManager.getPlayerLayout(), themeManager.getPlayerLayoutDefinition());

    layoutOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const layout = opt.getAttribute('data-layout-val');
        if (layout) {
          themeManager.setPlayerLayout(layout);
        }
      });
      opt.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const layout = opt.getAttribute('data-layout-val');
          if (layout) {
            themeManager.setPlayerLayout(layout);
          }
        }
      });
    });

    this.playerLayoutUnsub = themeManager.subscribePlayerLayout((layoutId, def) => {
      updateLayoutDisplay(layoutId, def);
    });

    // Library Density Listeners
    const densityOptions = this.container.querySelectorAll<HTMLElement>('.settings-density-option');
    const densityBadge = this.container.querySelector<HTMLElement>('#settings-density-status-badge');

    const updateDensityDisplay = (densityId: string, def: any) => {
      densityOptions.forEach(opt => {
        const val = opt.getAttribute('data-density-val');
        const isActive = val === densityId;
        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
        const check = opt.querySelector<HTMLElement>('.settings-ambient-check');
        if (check) check.style.display = isActive ? 'flex' : 'none';
      });

      if (densityBadge) {
        densityBadge.textContent = `${def.name} Active`;
      }
    };

    updateDensityDisplay(themeManager.getLibraryDensity(), themeManager.getLibraryDensityDefinition());

    densityOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const density = opt.getAttribute('data-density-val');
        if (density) {
          themeManager.setLibraryDensity(density);
        }
      });
      opt.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const density = opt.getAttribute('data-density-val');
          if (density) {
            themeManager.setLibraryDensity(density);
          }
        }
      });
    });

    this.densityUnsub = themeManager.subscribeLibraryDensity((densityId, def) => {
      updateDensityDisplay(densityId, def);
    });
  }

  private attachPlaybackSettingsListeners(): void {
    if (!this.container || !this.playbackManager) return;

    const rateSelect = this.container.querySelector<HTMLSelectElement>('#settings-playback-rate');
    const repeatSelect = this.container.querySelector<HTMLSelectElement>('#settings-repeat-mode');
    const shuffleSelect = this.container.querySelector<HTMLSelectElement>('#settings-shuffle-mode');

    if (rateSelect) rateSelect.value = String(this.playbackManager.playbackRate || 1.0);
    if (repeatSelect) repeatSelect.value = this.playbackManager.repeatMode;
    if (shuffleSelect) shuffleSelect.value = this.playbackManager.shuffleMode;

    rateSelect?.addEventListener('change', () => {
      if (this.playbackManager) {
        this.playbackManager.setPlaybackRate(Number(rateSelect.value));
      }
    });

    repeatSelect?.addEventListener('change', () => {
      if (this.playbackManager) {
        this.playbackManager.setRepeatMode(repeatSelect.value as RepeatMode);
      }
    });

    shuffleSelect?.addEventListener('change', () => {
      if (this.playbackManager) {
        this.playbackManager.setShuffleMode(shuffleSelect.value as ShuffleMode);
      }
    });

    const sleepTimerBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-sleep-timer');
    sleepTimerBtn?.addEventListener('click', () => {
      if (this.sleepTimerService && this.eventBus) {
        SleepTimerModalComponent.show({
          sleepTimerService: this.sleepTimerService,
          eventBus: this.eventBus
        });
      }
    });

    const crossfadeEnabledCheckbox = this.container.querySelector<HTMLInputElement>('#settings-crossfade-enabled');
    const crossfadeDurationSelect = this.container.querySelector<HTMLSelectElement>('#settings-crossfade-duration');
    const crossfadeDurationRow = this.container.querySelector<HTMLElement>('#settings-crossfade-duration-row');

    if (this.audioSettingsService) {
      void this.audioSettingsService.getSettings().then(settings => {
        if (crossfadeEnabledCheckbox) {
          crossfadeEnabledCheckbox.checked = settings.crossfadeEnabled;
        }
        if (crossfadeDurationSelect) {
          crossfadeDurationSelect.value = String(settings.crossfadeDurationSec);
        }
        if (crossfadeDurationRow) {
          crossfadeDurationRow.style.opacity = settings.crossfadeEnabled ? '1' : '0.5';
        }
      });
    }

    crossfadeEnabledCheckbox?.addEventListener('change', async () => {
      const enabled = crossfadeEnabledCheckbox.checked;
      if (crossfadeDurationRow) {
        crossfadeDurationRow.style.opacity = enabled ? '1' : '0.5';
      }
      if (this.playbackManager) {
        this.playbackManager.setCrossfade?.(enabled);
      }
      if (this.audioEngine) {
        this.audioEngine.setCrossfade?.(enabled);
      }
      if (this.audioSettingsService) {
        await this.audioSettingsService.saveSettings({ crossfadeEnabled: enabled });
      }
    });

    crossfadeDurationSelect?.addEventListener('change', async () => {
      const duration = Number(crossfadeDurationSelect.value);
      if (this.playbackManager) {
        this.playbackManager.setCrossfade?.(crossfadeEnabledCheckbox?.checked ?? false, duration);
      }
      if (this.audioEngine) {
        this.audioEngine.setCrossfade?.(crossfadeEnabledCheckbox?.checked ?? false, duration);
      }
      if (this.audioSettingsService) {
        await this.audioSettingsService.saveSettings({ crossfadeDurationSec: duration });
      }
    });
  }

  private attachVisualizerSettingsListeners(): void {
    if (!this.container || !this.visualizerService) return;

    const modeSelect = this.container.querySelector<HTMLSelectElement>('#settings-viz-mode');
    const fpsSelect = this.container.querySelector<HTMLSelectElement>('#settings-viz-fps');
    const styleOptions = this.container.querySelectorAll<HTMLElement>('.settings-viz-style-option');

    const updateUIState = (settings: { enabled?: boolean; mode?: VisualizerMode } | null | undefined) => {
      if (!settings) return;
      const activeMode = !settings.enabled ? 'off' : (settings.mode || 'off');
      if (modeSelect) modeSelect.value = activeMode;

      styleOptions.forEach(opt => {
        const val = opt.getAttribute('data-viz-style');
        const isActive = (val === 'off' && activeMode === 'off') ||
          (val === activeMode) ||
          (val === 'bars' && activeMode === 'spectrum-bars') ||
          (val === 'circular' && activeMode === 'circular-spectrum');

        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-checked', isActive ? 'true' : 'false');

        const checkEl = opt.querySelector('.settings-ambient-check');
        if (checkEl) {
          (checkEl as HTMLElement).style.display = isActive ? 'flex' : 'none';
        }
      });
    };

    void this.visualizerService.getSettings().then(settings => {
      updateUIState(settings);
      if (fpsSelect) fpsSelect.value = String(settings.fpsLimit);
    });

    modeSelect?.addEventListener('change', async () => {
      const selectedMode = modeSelect.value as VisualizerMode;
      if (this.visualizerService) {
        const updated = await this.visualizerService.setMode(selectedMode);
        updateUIState(updated);
      }
    });

    styleOptions.forEach(opt => {
      const handleSelect = async () => {
        const val = opt.getAttribute('data-viz-style') as VisualizerMode;
        if (val && this.visualizerService) {
          const updated = await this.visualizerService.setMode(val);
          updateUIState(updated);
        }
      };

      opt.addEventListener('click', handleSelect);
      opt.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleSelect();
        }
      });
    });

    fpsSelect?.addEventListener('change', () => {
      if (this.visualizerService) {
        void this.visualizerService.saveSettings({ fpsLimit: Number(fpsSelect.value) });
      }
    });
  }

  private attachGalaxySettingsListeners(): void {
    if (!this.container || !this.galaxyService) return;

    const lodSelect = this.container.querySelector<HTMLSelectElement>('#settings-galaxy-lod');
    const playlistsCheckbox = this.container.querySelector<HTMLInputElement>('#settings-galaxy-playlists');
    const foldersCheckbox = this.container.querySelector<HTMLInputElement>('#settings-galaxy-folders');

    void this.galaxyService.getSettings().then(settings => {
      if (lodSelect) lodSelect.value = String(settings.defaultLOD);
      if (playlistsCheckbox) playlistsCheckbox.checked = settings.showPlaylists;
      if (foldersCheckbox) foldersCheckbox.checked = settings.showFolders;
    });

    lodSelect?.addEventListener('change', () => {
      if (this.galaxyService) {
        void this.galaxyService.saveSettings({ defaultLOD: Number(lodSelect.value) });
      }
    });

    playlistsCheckbox?.addEventListener('change', () => {
      if (this.galaxyService) {
        void this.galaxyService.saveSettings({ showPlaylists: playlistsCheckbox.checked });
      }
    });

    foldersCheckbox?.addEventListener('change', () => {
      if (this.galaxyService) {
        void this.galaxyService.saveSettings({ showFolders: foldersCheckbox.checked });
      }
    });
  }

  private attachMusicAccessListeners(): void {
    if (!this.container) return;

    const rescanBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-rescan');
    const changeFolderBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-change-folder');
    const chooseFilesBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-choose-files');
    const fileInput = this.container.querySelector<HTMLInputElement>('#settings-file-input');

    rescanBtn?.addEventListener('click', async () => {
      if (!this.scannerService || this.scannerService.isScanning) return;
      this.showScanProgress('Preparing rescan...', 0, 0);

      try {
        const root = this.connectedFolderName ? `folder://${this.connectedFolderName}` : '';
        if (root && this.fsAdapter?.getDirectoryHandle(root)) {
          await this.scannerService.scanDirectory(root);
        } else {
          this.showScanError('No active directory connection found. Please choose a folder.');
        }
      } catch (err: any) {
        this.showScanError(`Rescan error: ${err?.message || 'Unknown error'}`);
      }
      this.refreshAllStats();
    });

    changeFolderBtn?.addEventListener('click', async () => {
      if (typeof (window as any).showDirectoryPicker !== 'function') return;

      try {
        const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
          mode: 'read'
        });

        if (!handle) return;

        const rootPath = `folder://${handle.name}`;
        this.connectedFolderName = handle.name;

        if (this.fsAdapter) {
          this.fsAdapter.registerDirectoryHandle(rootPath, handle);
        }

        if (this.dbAdapter) {
          await this.dbAdapter.put(STORES.SETTINGS, {
            key: 'music_directory_handle',
            handle,
            path: rootPath,
            name: handle.name,
            updatedAt: Date.now()
          });
        }

        if (this.scannerService) {
          this.showScanProgress(`Scanning folder "${handle.name}"...`, 0, 0);
          await this.scannerService.scanDirectory(rootPath);
        }

        this.refreshAllStats();
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          this.showScanError('Failed to access folder.');
        }
      }
    });

    if (chooseFilesBtn && fileInput) {
      chooseFilesBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files.length > 0 && this.scannerService?.importFiles) {
          this.showScanProgress(`Importing ${fileInput.files.length} audio files...`, 0, fileInput.files.length);
          const res = await this.scannerService.importFiles(fileInput.files);
          this.hideScanProgress(`Imported ${res.filesAdded} audio tracks successfully.`);
          this.refreshAllStats();
        }
      });
    }
  }

  private attachStorageListeners(): void {
    if (!this.container) return;

    const rebuildBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-rebuild-index');
    const clearHistoryBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-clear-history');
    const resetDbBtn = this.container.querySelector<HTMLButtonElement>('#settings-btn-reset-db');

    rebuildBtn?.addEventListener('click', async () => {
      if (!this.scannerService || this.scannerService.isScanning) return;
      const root = this.connectedFolderName ? `folder://${this.connectedFolderName}` : '';
      if (root && this.fsAdapter?.getDirectoryHandle(root)) {
        await this.scannerService.scanDirectory(root);
      }
      this.refreshAllStats();
    });

    clearHistoryBtn?.addEventListener('click', () => {
      this.showConfirmationModal(
        'Clear Playback History',
        'Are you sure you want to clear your local playback history logs? Your music files and playlists will not be affected.',
        async () => {
          if (this.dbAdapter) {
            await this.dbAdapter.clear(STORES.PLAYBACK_HISTORY);
          }
          this.refreshAllStats();
        }
      );
    });

    resetDbBtn?.addEventListener('click', () => {
      this.showConfirmationModal(
        'Reset Local Music Database',
        'This will clear all IndexedDB music tables (tracks, albums, artists, genres). Your source audio files on your device will NOT be deleted.',
        async () => {
          if (this.dbAdapter) {
            await Promise.all([
              this.dbAdapter.clear(STORES.TRACKS),
              this.dbAdapter.clear(STORES.ALBUMS),
              this.dbAdapter.clear(STORES.ARTISTS),
              this.dbAdapter.clear(STORES.GENRES),
              this.dbAdapter.clear(STORES.AUDIO_FILES),
              this.dbAdapter.clear(STORES.FOLDERS)
            ]);
          }
          this.refreshAllStats();
        }
      );
    });
  }

  private attachDeviceListeners(): void {
    if (!this.container) return;
    const devList = this.container.querySelector<HTMLElement>('#settings-devices-list');
    if (!devList) return;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then(devices => {
          const audioOuts = devices.filter(d => d.kind === 'audiooutput' || d.kind === 'audioinput');
          if (audioOuts.length > 0) {
            devList.innerHTML = audioOuts
              .map(
                d => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg);">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span>${d.kind === 'audiooutput' ? '🔊' : '🎙'}</span>
                  <span style="font-size: 13px; font-weight: 600; color: var(--color-text-primary);">${d.label || (d.kind === 'audiooutput' ? 'System Audio Output' : 'Audio Input Device')}</span>
                </div>
                <span style="font-size: 11px; font-weight: 700; color: #34d399; background: rgba(52, 211, 153, 0.15); padding: 2px 8px; border-radius: var(--radius-full);">Active</span>
              </div>
            `
              )
              .join('');
          } else {
            devList.innerHTML = `
              <div style="padding: 12px 16px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); font-size: 13px; color: var(--color-text-secondary);">
                Default System Audio Device (Web Audio Output)
              </div>
            `;
          }
        })
        .catch(() => {
          devList.innerHTML = `
            <div style="padding: 12px 16px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); font-size: 13px; color: var(--color-text-secondary);">
              Default System Audio Device
            </div>
          `;
        });
    } else {
      devList.innerHTML = `
        <div style="padding: 12px 16px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); font-size: 13px; color: var(--color-text-secondary);">
          Standard Web Audio Output
        </div>
      `;
    }
  }

  private attachEventBusSubscriptions(): void {
    if (!this.eventBus) return;

    this.eventBusSubs.push(
      this.eventBus.subscribe(DomainEvents.SCAN_PROGRESS, (report: ScanProgressReport) => {
        if (!report) return;
        this.showScanProgress(
          report.currentFile ? `Scanning: ${report.currentFile}` : 'Processing audio files...',
          report.filesProcessed,
          report.filesDiscovered
        );
      })
    );

    this.eventBusSubs.push(
      this.eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, () => {
        this.hideScanProgress('Library scan completed successfully!');
        this.refreshAllStats();
      })
    );

    this.eventBusSubs.push(
      this.eventBus.subscribe(DomainEvents.SLEEP_TIMER_CHANGED, () => {
        if (!this.container || !this.sleepTimerService) return;
        const statusEl = this.container.querySelector<HTMLElement>('#settings-sleep-timer-status');
        const btnTextEl = this.container.querySelector<HTMLElement>('#settings-btn-sleep-timer-text');
        const state = this.sleepTimerService.getState();

        if (statusEl) {
          statusEl.textContent = state.isActive
            ? `Active: Pausing playback in ${Math.ceil(state.remainingMs / 60000)} minutes.`
            : 'Automatically pause playback after a set duration. (Currently Inactive)';
        }
        if (btnTextEl) {
          btnTextEl.textContent = state.isActive ? 'Manage Sleep Timer' : 'Set Sleep Timer';
        }
      })
    );
  }

  private showScanProgress(statusText: string, processed: number, total: number): void {
    if (!this.container) return;
    const box = this.container.querySelector<HTMLElement>('#settings-scan-progress-box');
    const status = this.container.querySelector<HTMLElement>('#settings-scan-status-text');
    const count = this.container.querySelector<HTMLElement>('#settings-scan-progress-count');
    const bar = this.container.querySelector<HTMLElement>('#settings-scan-progress-bar');
    const current = this.container.querySelector<HTMLElement>('#settings-scan-current-file');

    if (box) box.style.display = 'flex';
    if (status) status.textContent = statusText;
    if (count) count.textContent = total > 0 ? `${processed} / ${total} files` : `${processed} files`;
    if (bar) {
      const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 30;
      bar.style.width = `${pct}%`;
    }
    if (current) current.textContent = statusText;
  }

  private hideScanProgress(message: string): void {
    if (!this.container) return;
    const box = this.container.querySelector<HTMLElement>('#settings-scan-progress-box');
    const status = this.container.querySelector<HTMLElement>('#settings-scan-status-text');
    if (status) status.textContent = message;

    setTimeout(() => {
      if (box) box.style.display = 'none';
    }, 3000);
  }

  private showScanError(msg: string): void {
    if (!this.container) return;
    const box = this.container.querySelector<HTMLElement>('#settings-scan-progress-box');
    const status = this.container.querySelector<HTMLElement>('#settings-scan-status-text');
    if (box) box.style.display = 'flex';
    if (status) {
      status.textContent = msg;
      status.style.color = '#ef4444';
    }
  }

  private refreshAllStats(): void {
    if (!this.container) return;

    // 1. Folder connection & badge
    const badge = this.container.querySelector<HTMLElement>('#settings-music-access-badge');
    const folderChip = this.container.querySelector<HTMLElement>('#settings-chip-folder-text');
    const profileFolder = this.container.querySelector<HTMLElement>('#settings-profile-folder-name');
    const profileTracks = this.container.querySelector<HTMLElement>('#settings-profile-tracks-count');

    if (this.dbAdapter) {
      void this.dbAdapter
        .get<{ key: string; name: string }>(STORES.SETTINGS, 'music_directory_handle')
        .then(record => {
          if (record && record.name) {
            this.connectedFolderName = record.name;
            if (badge) {
              badge.textContent = `Folder: ${record.name} (Connected)`;
              badge.style.background = 'rgba(52, 211, 153, 0.15)';
              badge.style.color = '#34d399';
              badge.style.borderColor = 'rgba(52, 211, 153, 0.3)';
            }
            if (folderChip) folderChip.textContent = `Connected: ${record.name}`;
            if (profileFolder) profileFolder.textContent = record.name;
          } else {
            this.fallbackBadgeFromStats();
          }
        })
        .catch(() => this.fallbackBadgeFromStats());
    } else {
      this.fallbackBadgeFromStats();
    }

    // 2. Library counts
    if (this.libraryService) {
      void this.libraryService.getLibraryStats().then(stats => {
        const statTracks = this.container?.querySelector<HTMLElement>('#settings-stat-tracks');
        const statAlbums = this.container?.querySelector<HTMLElement>('#settings-stat-albums');
        const statArtists = this.container?.querySelector<HTMLElement>('#settings-stat-artists');

        if (statTracks) statTracks.textContent = String(stats.trackCount);
        if (statAlbums) statAlbums.textContent = String(stats.albumCount);
        if (statArtists) statArtists.textContent = String(stats.artistCount);
        if (profileTracks) profileTracks.textContent = String(stats.trackCount);
      });
    }

    if (this.dbAdapter) {
      void this.dbAdapter.count(STORES.GENRES).then(cnt => {
        const statGenres = this.container?.querySelector<HTMLElement>('#settings-stat-genres');
        if (statGenres) statGenres.textContent = String(cnt);
      });
    }
  }

  private fallbackBadgeFromStats(): void {
    if (!this.container || !this.libraryService) return;
    const badge = this.container.querySelector<HTMLElement>('#settings-music-access-badge');
    const folderChip = this.container.querySelector<HTMLElement>('#settings-chip-folder-text');

    void this.libraryService.getLibraryStats().then(stats => {
      if (stats.trackCount > 0) {
        if (badge) {
          badge.textContent = `${stats.trackCount} Local Tracks Available`;
          badge.style.background = 'rgba(99, 102, 241, 0.15)';
          badge.style.color = '#818cf8';
          badge.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        }
        if (folderChip) folderChip.textContent = `${stats.trackCount} Local Tracks`;
      } else {
        if (badge) {
          badge.textContent = 'Not Connected';
          badge.style.background = 'rgba(148, 163, 184, 0.15)';
          badge.style.color = 'var(--color-text-secondary)';
          badge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        }
        if (folderChip) folderChip.textContent = 'Not Connected';
      }
    });
  }

  private showConfirmationModal(title: string, message: string, onConfirm: () => Promise<void> | void): void {
    const existing = document.querySelector('#settings-confirm-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'settings-confirm-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'settings-modal-title');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      box-sizing: border-box;
    `;

    overlay.innerHTML = `
      <div style="background: var(--color-bg-surface-elevated); border: 1px solid var(--glass-border); border-radius: var(--radius-2xl); padding: var(--space-6); max-width: 440px; width: 100%; box-shadow: var(--shadow-2xl); display: flex; flex-direction: column; gap: var(--space-4);">
        <h3 id="settings-modal-title" style="margin: 0; font-size: 18px; font-weight: 700; color: var(--color-text-primary);">${title}</h3>
        <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.5;">${message}</p>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: var(--space-2);">
          <button id="settings-modal-cancel-btn" class="settings-action-btn" style="min-height: 40px;">Cancel</button>
          <button id="settings-modal-confirm-btn" class="settings-action-btn settings-action-btn-danger" style="min-height: 40px;">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector<HTMLButtonElement>('#settings-modal-cancel-btn');
    const confirmBtn = overlay.querySelector<HTMLButtonElement>('#settings-modal-confirm-btn');

    cancelBtn?.focus();

    cancelBtn?.addEventListener('click', () => overlay.remove());
    confirmBtn?.addEventListener('click', async () => {
      overlay.remove();
      await onConfirm();
    });

    overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        overlay.remove();
      }
    });
  }
}
