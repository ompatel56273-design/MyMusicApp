import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { IAudioEngine, IAudioSettingsService, IVisualizerService, IGalaxyService } from '../../services/contracts/service-contracts';
import type { VisualizerMode } from '../../domain/entities/visualizer-settings';
import { EqualizerComponent } from '../components/audio/equalizer-component';
import { ReplayGainControlsComponent } from '../components/audio/replaygain-controls-component';

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
    this.attachVisualizerSettingsListeners();
    this.attachGalaxySettingsListeners();
  }

  public unmount(): void {
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
      <section class="settings-view" style="padding: var(--space-6); max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-8);">
        <header>
          <h2 style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: var(--space-2);">
            Settings & Audio Processing
          </h2>
          <p style="font-size: 14px; color: var(--color-text-secondary); margin: 0;">
            Configure 10-band ISO graphic equalizer, ReplayGain normalization, visualizer, Audio Galaxy, stereo balance, and safeguards.
          </p>
        </header>

        <!-- Equalizer & DSP Slot -->
        <div id="settings-equalizer-slot"></div>

        <!-- ReplayGain & Stereo Balance Slot -->
        <div id="settings-replaygain-slot"></div>

        <!-- Visualizer Preferences Section -->
        <section class="glass-panel" style="padding: var(--space-6); border-radius: var(--radius-xl); display: flex; flex-direction: column; gap: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 var(--space-1) 0;">Audio Visualizer Preferences</h3>
              <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">
                Configure real-time canvas rendering modes and frame rate limits.
              </p>
            </div>
            <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 14px; font-weight: 500;">
              <input type="checkbox" id="settings-viz-enabled" style="accent-color: var(--color-accent-teal);" />
              Enable Visualizer
            </label>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-top: var(--space-2);">
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="settings-viz-mode" style="font-size: 13px; font-weight: 500; color: var(--color-text-secondary);">Default Visualizer Mode</label>
              <select id="settings-viz-mode" style="padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--color-text-primary); font-size: 13px;">
                <option value="bars">Bars (Frequency)</option>
                <option value="waveform">Waveform (Time Domain)</option>
                <option value="circular">Circular / Radial</option>
                <option value="spectrum">Filled Spectrum</option>
                <option value="particles">Energy Particles</option>
                <option value="minimal">Minimalist Meter</option>
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="settings-viz-fps" style="font-size: 13px; font-weight: 500; color: var(--color-text-secondary);">FPS Limit</label>
              <select id="settings-viz-fps" style="padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--color-text-primary); font-size: 13px;">
                <option value="30">30 FPS (Power Saver)</option>
                <option value="60">60 FPS (Default Smooth)</option>
                <option value="120">120 FPS (High Refresh)</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Audio Galaxy Preferences Section -->
        <section class="glass-panel" style="padding: var(--space-6); border-radius: var(--radius-xl); display: flex; flex-direction: column; gap: var(--space-4);">
          <div>
            <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 var(--space-1) 0;">Audio Galaxy Preferences</h3>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">
              Configure visual exploration graph detail level and node inclusions.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-top: var(--space-2);">
            <div style="display: flex; flex-direction: column; gap: var(--space-1);">
              <label for="settings-galaxy-lod" style="font-size: 13px; font-weight: 500; color: var(--color-text-secondary);">Initial Level of Detail</label>
              <select id="settings-galaxy-lod" style="padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: var(--color-text-primary); font-size: 13px;">
                <option value="1">LOD 1 — Macro Overview (Genres/Artists)</option>
                <option value="2">LOD 2 — Exploration (Artists/Albums)</option>
                <option value="3">LOD 3 — Detailed (Albums/Tracks)</option>
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: var(--space-2); justify-content: center;">
              <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px;">
                <input type="checkbox" id="settings-galaxy-playlists" style="accent-color: var(--color-accent-teal);" />
                Show Playlist Orbits
              </label>
              <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px;">
                <input type="checkbox" id="settings-galaxy-folders" style="accent-color: var(--color-accent-teal);" />
                Show Folder Orbits
              </label>
            </div>
          </div>
        </section>

        <!-- General Info & Local Storage -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-4);">
          <div class="glass-panel" style="padding: var(--space-6); border-radius: var(--radius-xl);">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: var(--space-2);">Local Storage & Privacy</h3>
            <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin: 0;">
              All database indexes, custom EQ presets, visualizer settings, galaxy coordinates, cached artwork, and playback history are stored strictly on your local device. Zero telemetry or remote requests.
            </p>
          </div>

          <div class="glass-panel" style="padding: var(--space-6); border-radius: var(--radius-xl);">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: var(--space-2);">Audio Safety Protection</h3>
            <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin: 0;">
              Hard-knee 20:1 brickwall safety compressor is active to prevent digital clipping when boosting EQ frequency bands and preamp gains.
            </p>
          </div>
        </div>
      </section>
    `;
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

