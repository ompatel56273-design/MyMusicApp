import type { IAudioEngine, IAudioSettingsService } from '../../../services/contracts/service-contracts';
import type { ReplayGainMode } from '../../../services/audio/audio-types';
import type { AudioSettings } from '../../../domain/entities/audio-settings';

export interface ReplayGainControlsDependencies {
  audioEngine: IAudioEngine;
  audioSettingsService: IAudioSettingsService;
}

export class ReplayGainControlsComponent {
  private container: HTMLElement | null = null;
  private readonly audioEngine: IAudioEngine;
  private readonly settingsService: IAudioSettingsService;
  private currentSettings: AudioSettings | null = null;

  constructor(deps: ReplayGainControlsDependencies) {
    this.audioEngine = deps.audioEngine;
    this.settingsService = deps.audioSettingsService;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.currentSettings = await this.settingsService.getSettings();
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container || !this.currentSettings) return;

    const currentMode = this.currentSettings.replayGainMode;
    const balance = this.currentSettings.balance;

    this.container.innerHTML = `
      <div class="replaygain-panel glass-panel" style="padding: var(--space-6); border-radius: var(--radius-2xl); box-sizing: border-box; display: flex; flex-direction: column; gap: var(--space-6); background: var(--glass-surface); border: 1px solid var(--glass-border); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);">
        <!-- ReplayGain Section -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); flex-wrap: wrap; gap: var(--space-2);">
            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-secondary);">
                Dynamics Processing
              </span>
              <h4 style="font-size: 16px; font-weight: 700; margin: 2px 0 0 0; color: var(--color-text-primary);">
                ReplayGain Volume Normalization
              </h4>
            </div>
            <span style="font-size: 11px; color: #4ade80; font-weight: 700; background: rgba(74, 222, 128, 0.12); border: 1px solid rgba(74, 222, 128, 0.25); padding: 3px 10px; border-radius: var(--radius-full);">
              Peak Limiting Active
            </span>
          </div>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0 0 var(--space-4) 0; line-height: 1.5;">
            Levels loudness across different albums and files using authoritative track and album tags.
          </p>

          <div style="display: flex; gap: var(--space-3);" role="radiogroup" aria-label="ReplayGain Mode">
            ${(['off', 'track', 'album'] as ReplayGainMode[]).map(mode => `
              <button
                type="button"
                class="rg-mode-btn"
                data-mode="${mode}"
                role="radio"
                aria-checked="${currentMode === mode}"
                style="
                  flex: 1;
                  min-height: 42px;
                  padding: var(--space-2) var(--space-4);
                  border-radius: var(--radius-lg);
                  font-size: 13px;
                  font-weight: 600;
                  text-transform: capitalize;
                  cursor: pointer;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  border: 1px solid ${currentMode === mode ? 'rgba(168, 85, 247, 0.4)' : 'var(--glass-border)'};
                  background: ${currentMode === mode ? 'var(--color-accent-gradient)' : 'var(--glass-surface)'};
                  color: ${currentMode === mode ? '#ffffff' : 'var(--color-text-secondary)'};
                  box-shadow: ${currentMode === mode ? 'var(--shadow-glow-purple)' : 'none'};
                "
              >
                ${mode}
              </button>
            `).join('')}
          </div>

          <div style="margin-top: var(--space-4); display: flex; align-items: center; justify-content: space-between; background: rgba(0, 0, 0, 0.2); padding: 12px 16px; border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
            <div>
              <span style="font-size: 13px; font-weight: 700; color: var(--color-text-primary); display: block;">
                Prevent Clipping Peak Limiting
              </span>
              <span style="font-size: 11px; color: var(--color-text-muted);">
                Automatically scales down gain boost if track/album peak exceeds 0 dBFS.
              </span>
            </div>
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input
                type="checkbox"
                id="rg-prevent-clipping-toggle"
                ${this.currentSettings.preventClipping ? 'checked' : ''}
                style="accent-color: var(--color-accent-primary); width: 18px; height: 18px; cursor: pointer;"
              />
            </label>
          </div>
        </div>

        <!-- Stereo Balance Section -->
        <div style="border-top: 1px solid var(--glass-border); padding-top: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-primary);">
                Pan & Output
              </span>
              <h4 style="font-size: 16px; font-weight: 700; margin: 2px 0 0 0; color: var(--color-text-primary);">
                Stereo Balance
              </h4>
            </div>
            <span id="balance-readout" style="font-size: 12px; font-weight: 700; color: var(--color-accent-primary); background: rgba(168, 85, 247, 0.12); padding: 2px 10px; border-radius: var(--radius-full); border: 1px solid rgba(168, 85, 247, 0.25);">
              ${balance === 0 ? 'Center' : balance < 0 ? `${Math.abs(Math.round(balance * 100))}% Left` : `${Math.round(balance * 100)}% Right`}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: var(--space-3); background: rgba(0, 0, 0, 0.2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-xl); border: 1px solid var(--glass-border);">
            <span style="font-size: 12px; color: var(--color-text-muted); font-weight: 700;">L</span>
            <input
              type="range"
              id="stereo-balance-slider"
              min="-1"
              max="1"
              step="0.05"
              value="${balance}"
              aria-label="Stereo Balance"
              aria-valuemin="-1"
              aria-valuemax="1"
              aria-valuenow="${balance}"
              style="flex: 1; accent-color: var(--color-accent-primary); cursor: pointer;"
            />
            <span style="font-size: 12px; color: var(--color-text-muted); font-weight: 700;">R</span>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.container) return;

    // 1. ReplayGain mode buttons
    const buttons = this.container.querySelectorAll<HTMLButtonElement>('.rg-mode-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.getAttribute('data-mode') as ReplayGainMode;
        if (mode && this.currentSettings) {
          this.currentSettings = { ...this.currentSettings, replayGainMode: mode };
          this.audioEngine.setReplayGainMode(mode);
          await this.settingsService.saveSettings({ replayGainMode: mode });
          this.render();
        }
      });
    });

    // 2. Prevent Clipping toggle
    const clippingToggle = this.container.querySelector<HTMLInputElement>('#rg-prevent-clipping-toggle');
    clippingToggle?.addEventListener('change', async () => {
      if (!this.currentSettings) return;
      const enabled = clippingToggle.checked;
      this.currentSettings = { ...this.currentSettings, preventClipping: enabled };
      this.audioEngine.setPreventClipping?.(enabled);
      await this.settingsService.saveSettings({ preventClipping: enabled });
    });

    // 2. Stereo Balance slider
    const balanceSlider = this.container.querySelector<HTMLInputElement>('#stereo-balance-slider');
    const readout = this.container.querySelector<HTMLElement>('#balance-readout');

    balanceSlider?.addEventListener('input', () => {
      if (!this.currentSettings) return;
      const val = parseFloat(balanceSlider.value);
      this.currentSettings = { ...this.currentSettings, balance: val };
      this.audioEngine.setBalance(val);

      if (readout) {
        readout.textContent = val === 0 ? 'Center' : val < 0 ? `${Math.abs(Math.round(val * 100))}% Left` : `${Math.round(val * 100)}% Right`;
      }
    });

    balanceSlider?.addEventListener('change', async () => {
      if (this.currentSettings) {
        await this.settingsService.saveSettings({ balance: this.currentSettings.balance });
      }
    });
  }
}
