import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { IAudioEngine, IAudioSettingsService, IVisualizerService, IGalaxyService } from '../../services/contracts/service-contracts';
import type { VisualizerMode } from '../../domain/entities/visualizer-settings';
import { EqualizerComponent } from '../components/audio/equalizer-component';
import { ReplayGainControlsComponent } from '../components/audio/replaygain-controls-component';
import { ThemeManager, type ThemePreference, type ResolvedTheme } from '../theme/theme-manager';

export interface SettingsViewDependencies {
  audioEngine?: IAudioEngine | undefined;
  audioSettingsService?: IAudioSettingsService | undefined;
  visualizerService?: IVisualizerService | undefined;
  galaxyService?: IGalaxyService | undefined;
}

export class SettingsView implements IView {
  private container: HTMLElement | null = null;
  private readonly audioEngine?: IAudioEngine | undefined;
  private readonly audioSettingsService?: IAudioSettingsService | undefined;
  private readonly visualizerService?: IVisualizerService | undefined;
  private readonly galaxyService?: IGalaxyService | undefined;

  private equalizerComponent: EqualizerComponent | null = null;
  private replayGainComponent: ReplayGainControlsComponent | null = null;
  private themeUnsub: (() => void) | null = null;

  constructor(deps?: SettingsViewDependencies) {
    this.audioEngine = deps?.audioEngine;
    this.audioSettingsService = deps?.audioSettingsService;
    this.visualizerService = deps?.visualizerService;
    this.galaxyService = deps?.galaxyService;
  }

  public mount(container: HTMLElement, _params?: RouteParams): void {
    this.container = container;
    this.render();
    this.mountSubComponents();
    this.attachThemeListeners();
    this.attachVisualizerSettingsListeners();
    this.attachGalaxySettingsListeners();
  }

  public unmount(): void {
    if (this.themeUnsub) {
      this.themeUnsub();
      this.themeUnsub = null;
    }
    if (this.equalizerComponent) {
      this.equalizerComponent.unmount();
      this.equalizerComponent = null;
    }
    if (this.replayGainComponent) {
      this.replayGainComponent.unmount();
      this.replayGainComponent = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <style>
        .settings-view {
          padding: var(--space-6);
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          box-sizing: border-box;
          position: relative;
          width: 100%;
        }

        .settings-hero {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(6, 182, 212, 0.15), rgba(15, 23, 42, 0.7));
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

        .settings-grid-layout {
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: var(--space-6);
          align-items: start;
          width: 100%;
          box-sizing: border-box;
        }

        .settings-nav-card {
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

        .settings-nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 10px 16px;
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

        .settings-nav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--color-text-primary);
        }

        .settings-nav-item.active {
          background: var(--color-accent-gradient);
          color: #ffffff;
          box-shadow: var(--shadow-glow-purple);
        }

        .settings-content-area {
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
        }

        .settings-theme-option:hover {
          border-color: var(--glass-border-highlight);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .settings-theme-option.active {
          border-color: var(--color-accent-primary);
          background: rgba(168, 85, 247, 0.12);
          box-shadow: var(--shadow-glow-purple);
        }

        .settings-controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: var(--space-4);
          width: 100%;
          box-sizing: border-box;
        }

        /* Tablet Responsive (768px - 1199px) */
        @media (max-width: 1199px) and (min-width: 768px) {
          .settings-grid-layout {
            grid-template-columns: 220px minmax(0, 1fr);
            gap: var(--space-4);
          }
          .settings-view {
            padding: var(--space-4);
          }
        }

        /* Mobile Responsive (<768px) */
        @media (max-width: 767px) {
          .settings-view {
            padding: var(--space-3);
            gap: var(--space-4);
          }
          .settings-hero {
            padding: var(--space-5);
            border-radius: var(--radius-xl);
          }
          .settings-grid-layout {
            display: flex;
            flex-direction: column;
            gap: var(--space-4);
          }
          .settings-nav-card {
            position: static;
            flex-direction: row;
            overflow-x: auto;
            border-radius: var(--radius-xl);
            padding: 4px;
            max-width: 100%;
            scrollbar-width: none;
          }
          .settings-nav-item {
            flex: 0 0 auto;
            padding: 8px 14px;
            font-size: 12px;
          }
          .settings-theme-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .settings-controls-grid {
            grid-template-columns: 1fr !important;
          }
        }
      </style>

      <section class="settings-view" role="region" aria-label="Settings Studio">
        <!-- Template 9 Studio Hero Banner -->
        <header class="settings-hero">
          <div
            style="
              position: absolute;
              top: -40%;
              right: -5%;
              width: 380px;
              height: 380px;
              background: radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%);
              filter: blur(60px);
              pointer-events: none;
            "
            aria-hidden="true"
          ></div>
          <div style="position: relative; z-index: 1;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--color-accent-secondary);">
              Personal Audio Operating System
            </span>
            <h2 style="font-size: 32px; font-weight: 800; letter-spacing: -0.03em; margin: var(--space-1) 0 var(--space-2) 0; color: var(--color-text-primary);">
              Settings
            </h2>
            <p style="font-size: 14px; font-weight: 500; color: var(--color-text-secondary); margin: 0; max-width: 560px; line-height: 1.5;">
              Customize your music experience. Configure themes, audio DSP equalization, dynamic ReplayGain normalization, real-time visualizer, and Audio Galaxy.
            </p>
          </div>
        </header>

        <!-- Main Layout with Category Sidebar & Content Cards -->
        <div class="settings-grid-layout">
          <!-- Category Sidebar Nav -->
          <nav class="settings-nav-card" aria-label="Settings Categories">
            <button class="settings-nav-item active" data-target="section-audio">
              <span aria-hidden="true">🎚</span>
              <span>Audio & Equalizer</span>
            </button>
            <button class="settings-nav-item" data-target="section-appearance">
              <span aria-hidden="true">🎨</span>
              <span>Theme & Style</span>
            </button>
            <button class="settings-nav-item" data-target="section-visualizer">
              <span aria-hidden="true">📊</span>
              <span>Visualizer</span>
            </button>
            <button class="settings-nav-item" data-target="section-galaxy">
              <span aria-hidden="true">🌌</span>
              <span>Audio Galaxy</span>
            </button>
            <button class="settings-nav-item" data-target="section-privacy">
              <span aria-hidden="true">🛡</span>
              <span>Privacy & Storage</span>
            </button>
          </nav>

          <!-- Content Sections -->
          <div class="settings-content-area">
            <!-- 1. Equalizer & DSP Slot -->
            <div id="section-audio" style="display: flex; flex-direction: column; gap: var(--space-6); width: 100%;">
              <div id="settings-equalizer-slot"></div>
              <div id="settings-replaygain-slot"></div>
            </div>

            <!-- 2. Theme & Appearance Section -->
            <div id="section-appearance" class="settings-card">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-primary);">
                    Interface Aesthetics
                  </span>
                  <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 2px 0 0 0;">
                    Theme & Appearance
                  </h3>
                </div>
                <span id="settings-theme-status-badge" style="font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-full); background: rgba(168, 85, 247, 0.15); color: var(--color-accent-primary); border: 1px solid rgba(168, 85, 247, 0.3);">
                  Dark Atmosphere Active
                </span>
              </div>

              <div class="settings-theme-grid">
                <div class="settings-theme-option" data-theme-val="dark" role="button" tabindex="0" aria-label="Select Dark Atmosphere Theme">
                  <span style="font-size: 26px;">🌙</span>
                  <span style="font-size: 13px; font-weight: 700; color: var(--color-text-primary);">Dark Atmosphere</span>
                  <span style="font-size: 11px; color: var(--color-text-muted); text-align: center;">Cinematic dark theme with neon accents</span>
                </div>
                <div class="settings-theme-option" data-theme-val="light" role="button" tabindex="0" aria-label="Select Light Mode Theme">
                  <span style="font-size: 26px;">☀️</span>
                  <span style="font-size: 13px; font-weight: 700; color: var(--color-text-primary);">Light Mode</span>
                  <span style="font-size: 11px; color: var(--color-text-muted); text-align: center;">Bright interface with vibrant accent palette</span>
                </div>
                <div class="settings-theme-option" data-theme-val="system" role="button" tabindex="0" aria-label="Select System Match Theme">
                  <span style="font-size: 26px;">💻</span>
                  <span style="font-size: 13px; font-weight: 700; color: var(--color-text-primary);">System Match</span>
                  <span style="font-size: 11px; color: var(--color-text-muted); text-align: center;">Automatically follows your device appearance</span>
                </div>
              </div>
            </div>

            <!-- 3. Visualizer Preferences Section -->
            <section id="section-visualizer" class="settings-card">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: var(--space-3); flex-wrap: wrap; gap: var(--space-2);">
                <div>
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-secondary);">
                    Real-time Graphics
                  </span>
                  <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 2px 0 0 0;">
                    Audio Visualizer Preferences
                  </h3>
                </div>
                <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px; font-weight: 700; color: var(--color-text-primary); background: rgba(255, 255, 255, 0.04); padding: 6px 14px; border-radius: var(--radius-full); border: 1px solid var(--glass-border);">
                  <input type="checkbox" id="settings-viz-enabled" style="accent-color: var(--color-accent-secondary);" />
                  Enable Visualizer
                </label>
              </div>

              <div class="settings-controls-grid">
                <div style="display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; width: 100%;">
                  <label for="settings-viz-mode" style="font-size: 12px; font-weight: 600; color: var(--color-text-muted);">Default Visualizer Mode</label>
                  <select id="settings-viz-mode" class="app-select" aria-label="Default Visualizer Mode">
                    <option value="bars">Bars (Frequency Spectrogram)</option>
                    <option value="waveform">Waveform (Time Domain Oscilloscope)</option>
                    <option value="circular">Circular / Radial Energy</option>
                    <option value="spectrum">Filled Spectrum Flow</option>
                    <option value="particles">Energy Particle Cloud</option>
                    <option value="minimal">Minimalist Meter</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; width: 100%;">
                  <label for="settings-viz-fps" style="font-size: 12px; font-weight: 600; color: var(--color-text-muted);">FPS Frame Rate Limit</label>
                  <select id="settings-viz-fps" class="app-select" aria-label="FPS Frame Rate Limit">
                    <option value="30">30 FPS (Power Saver)</option>
                    <option value="60">60 FPS (Default Smooth)</option>
                    <option value="120">120 FPS (High Refresh Pro)</option>
                  </select>
                </div>
              </div>
            </section>

            <!-- 4. Audio Galaxy Preferences Section -->
            <section id="section-galaxy" class="settings-card">
              <div style="border-bottom: 1px solid var(--glass-border); padding-bottom: var(--space-3);">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-primary);">
                  Cosmic Library Graph
                </span>
                <h3 style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 2px 0 0 0;">
                  Audio Galaxy Preferences
                </h3>
              </div>

              <div class="settings-controls-grid">
                <div style="display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; width: 100%;">
                  <label for="settings-galaxy-lod" style="font-size: 12px; font-weight: 600; color: var(--color-text-muted);">Initial Level of Detail (LOD)</label>
                  <select id="settings-galaxy-lod" class="app-select" aria-label="Initial Level of Detail">
                    <option value="1">LOD 1 — Macro Overview (Genres / Artists)</option>
                    <option value="2">LOD 2 — Exploration (Artists / Albums)</option>
                    <option value="3">LOD 3 — Detailed (Albums / Tracks)</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: var(--space-2); justify-content: center; min-width: 0;">
                  <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--color-text-primary);">
                    <input type="checkbox" id="settings-galaxy-playlists" style="accent-color: var(--color-accent-primary);" />
                    Show Playlist Orbits
                  </label>
                  <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--color-text-primary);">
                    <input type="checkbox" id="settings-galaxy-folders" style="accent-color: var(--color-accent-primary);" />
                    Show Folder Orbits
                  </label>
                </div>
              </div>
            </section>

            <!-- 5. General Info, Privacy & Safety -->
            <section id="section-privacy" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); width: 100%; box-sizing: border-box;">
              <div class="settings-card">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <span style="font-size: 18px;">🔒</span>
                  <h3 style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
                    Local-First Architecture
                  </h3>
                </div>
                <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin: 0;">
                  All database indexes, custom EQ presets, visualizer settings, galaxy coordinates, cached artwork, and playback history are stored strictly on your local device. Zero cloud telemetry or remote tracking.
                </p>
              </div>

              <div class="settings-card">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  <span style="font-size: 18px;">🛡</span>
                  <h3 style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin: 0;">
                    Audio Safety Protection
                  </h3>
                </div>
                <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin: 0;">
                  Hard-knee 20:1 brickwall safety compressor is active to prevent digital clipping when boosting EQ frequency bands and preamp gains.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    `;

    this.bindNavigationEvents();
  }

  private bindNavigationEvents(): void {
    if (!this.container) return;
    const navItems = this.container.querySelectorAll<HTMLButtonElement>('.settings-nav-item');
    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        navItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        if (targetId && this.container) {
          const targetEl = this.container.querySelector(`#${targetId}`);
          targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
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

    const updateUI = (resolved: ResolvedTheme, pref: ThemePreference) => {
      options.forEach(opt => {
        const val = opt.getAttribute('data-theme-val') as ThemePreference;
        const isActive = val === pref;
        opt.classList.toggle('active', isActive);
        opt.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      if (badge) {
        if (pref === 'system') {
          badge.textContent = `System Match (${resolved === 'dark' ? 'Dark' : 'Light'}) Active`;
        } else if (pref === 'light') {
          badge.textContent = 'Light Mode Active';
        } else {
          badge.textContent = 'Dark Atmosphere Active';
        }
      }
    };

    options.forEach(opt => {
      const handleSelect = () => {
        const val = opt.getAttribute('data-theme-val') as ThemePreference;
        if (val) {
          themeManager.setPreference(val);
        }
      };

      opt.addEventListener('click', handleSelect);
      opt.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      });
    });

    this.themeUnsub = themeManager.subscribe((resolved, pref) => {
      updateUI(resolved, pref);
    });
  }

  private attachVisualizerSettingsListeners(): void {
    if (!this.container || !this.visualizerService) return;

    const enabledCheckbox = this.container.querySelector<HTMLInputElement>('#settings-viz-enabled');
    const modeSelect = this.container.querySelector<HTMLSelectElement>('#settings-viz-mode');
    const fpsSelect = this.container.querySelector<HTMLSelectElement>('#settings-viz-fps');

    void this.visualizerService.getSettings().then(settings => {
      if (enabledCheckbox) enabledCheckbox.checked = settings.enabled;
      if (modeSelect) modeSelect.value = settings.mode;
      if (fpsSelect) fpsSelect.value = String(settings.fpsLimit);
    });

    enabledCheckbox?.addEventListener('change', () => {
      if (this.visualizerService) {
        void this.visualizerService.setEnabled(enabledCheckbox.checked);
      }
    });

    modeSelect?.addEventListener('change', () => {
      if (this.visualizerService) {
        void this.visualizerService.setMode(modeSelect.value as VisualizerMode);
      }
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
}
