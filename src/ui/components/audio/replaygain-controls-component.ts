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
      <div class="replaygain-panel glass-panel" style="padding: var(--space-6); border-radius: var(--radius-xl); box-sizing: border-box; display: flex; flex-direction: column; gap: var(--space-6);">
        <!-- ReplayGain Section -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <h4 style="font-size: 15px; font-weight: 700; margin: 0; color: var(--color-text-primary);">
              ReplayGain Volume Normalization
            </h4>
            <span style="font-size: 12px; color: var(--color-accent-primary, #ff6b00); font-weight: 600;">
              Peak Limiting Active
            </span>
          </div>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0 0 var(--space-4) 0; line-height: 1.5;">
            Levels loudness using authoritative track and album ReplayGain tags. Safeguards against clipping with automatic peak attenuation.
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
                  padding: var(--space-2) var(--space-3);
                  border-radius: var(--radius-md);
                  font-size: 13px;
                  font-weight: 600;
                  text-transform: capitalize;
                  cursor: pointer;
                  transition: all var(--duration-fast, 0.15s) ease;
                  border: 1px solid ${currentMode === mode ? 'var(--color-accent-primary, #ff6b00)' : 'rgba(255, 255, 255, 0.12)'};
                  background: ${currentMode === mode ? 'var(--color-accent-primary, #ff6b00)' : 'rgba(255, 255, 255, 0.04)'};
                  color: ${currentMode === mode ? '#ffffff' : 'var(--color-text-secondary)'};
                "
              >
                ${mode}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Stereo Balance Section -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2);">
            <h4 style="font-size: 15px; font-weight: 700; margin: 0; color: var(--color-text-primary);">
              Stereo Balance
            </h4>
            <span id="balance-readout" style="font-size: 12px; font-weight: 600; color: var(--color-text-primary);">
              ${balance === 0 ? 'Center' : balance < 0 ? `${Math.abs(Math.round(balance * 100))}% Left` : `${Math.round(balance * 100)}% Right`}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="font-size: 12px; color: var(--color-text-muted); font-weight: 600;">L</span>
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
              style="flex: 1; accent-color: var(--color-accent-primary, #ff6b00); cursor: pointer;"
            />
            <span style="font-size: 12px; color: var(--color-text-muted); font-weight: 600;">R</span>
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
