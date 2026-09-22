import type { IAudioEngine, IAudioSettingsService } from '../../../services/contracts/service-contracts';
import { EQUALIZER_ISO_FREQUENCIES } from '../../../services/audio/audio-types';
import type { AudioSettings, EqualizerPreset } from '../../../domain/entities/audio-settings';

export interface EqualizerComponentDependencies {
  audioEngine: IAudioEngine;
  audioSettingsService: IAudioSettingsService;
}

/**
 * 10-Band ISO Graphic Equalizer UI Component.
 * Supports individual frequency band gain sliders [-12dB, +12dB], Preamp slider,
 * Preset dropdown, bypass toggle, reset, keyboard accessibility, and real-time DSP application.
 */
export class EqualizerComponent {
  private container: HTMLElement | null = null;
  private readonly audioEngine: IAudioEngine;
  private readonly settingsService: IAudioSettingsService;
  private currentSettings: AudioSettings | null = null;
  private debounceTimer: any = null;

  constructor(deps: EqualizerComponentDependencies) {
    this.audioEngine = deps.audioEngine;
    this.settingsService = deps.audioSettingsService;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    this.currentSettings = await this.settingsService.getSettings();
    this.render();
  }

  public unmount(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container || !this.currentSettings) return;

    const s = this.currentSettings;
    const builtIns = this.settingsService.getBuiltInPresets();

    this.container.innerHTML = `
      <div class="equalizer-panel glass-panel" style="padding: var(--space-6); border-radius: var(--radius-xl); box-sizing: border-box;">
        <!-- Header & Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <h3 style="font-size: 18px; font-weight: 700; margin: 0; color: var(--color-text-primary);">
              10-Band Graphic Equalizer
            </h3>
            <label style="display: inline-flex; align-items: center; gap: var(--space-2); font-size: 13px; font-weight: 600; cursor: pointer; color: ${s.equalizerEnabled ? 'var(--color-accent-primary, #ff6b00)' : 'var(--color-text-muted)'};">
              <input
                type="checkbox"
                id="eq-enable-toggle"
                ${s.equalizerEnabled ? 'checked' : ''}
                style="accent-color: var(--color-accent-primary, #ff6b00); cursor: pointer;"
              />
              ${s.equalizerEnabled ? 'ENABLED' : 'BYPASS'}
            </label>
          </div>

          <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
            <!-- Presets Selector -->
            <label for="eq-preset-select" style="font-size: 13px; color: var(--color-text-secondary);">Preset:</label>
            <select
              id="eq-preset-select"
              style="padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); background: var(--color-bg-surface-elevated, #2a2a2a); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--color-text-primary); font-size: 13px; cursor: pointer;"
            >
              <optgroup label="Built-in Presets">
                ${builtIns.map(p => `<option value="${p.id}" ${s.selectedPreset === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
              </optgroup>
              ${s.customPresets.length > 0 ? `
                <optgroup label="Custom Presets">
                  ${s.customPresets.map(p => `<option value="${p.id}" ${s.selectedPreset === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                </optgroup>
              ` : ''}
            </select>

            <button
              id="eq-save-preset-btn"
              style="padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); color: var(--color-text-primary); font-size: 12px; cursor: pointer;"
            >
              + Save Preset
            </button>

            <button
              id="eq-reset-btn"
              style="padding: var(--space-1) var(--space-3); border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); color: var(--color-text-muted); font-size: 12px; cursor: pointer;"
            >
              Reset Flat
            </button>
          </div>
        </div>

        <!-- Preamp Stage Slider -->
        <div style="margin-bottom: var(--space-6); padding: var(--space-3) var(--space-4); background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);">
          <span style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary); min-width: 90px;">
            Preamp Gain:
          </span>
          <input
            type="range"
            id="eq-preamp-slider"
            min="-12"
            max="12"
            step="0.5"
            value="${s.preampGainDb}"
            aria-label="Preamp Gain dB"
            aria-valuemin="-12"
            aria-valuemax="12"
            aria-valuenow="${s.preampGainDb}"
            style="flex: 1; accent-color: var(--color-accent-primary, #ff6b00); cursor: pointer;"
          />
          <span id="eq-preamp-val" style="font-size: 13px; font-weight: 700; color: var(--color-text-primary); min-width: 55px; text-align: right;">
            ${s.preampGainDb > 0 ? `+${s.preampGainDb.toFixed(1)}` : s.preampGainDb.toFixed(1)} dB
          </span>
        </div>

        <!-- 10 Frequency Sliders Grid -->
        <div
          class="eq-bands-grid"
          style="display: grid; grid-template-columns: repeat(10, 1fr); gap: var(--space-2); min-height: 220px; align-items: end; padding: var(--space-4) 0; border-top: 1px solid rgba(255, 255, 255, 0.06); border-bottom: 1px solid rgba(255, 255, 255, 0.06);"
        >
          ${EQUALIZER_ISO_FREQUENCIES.map((freq, i) => {
            const gain = s.equalizerBands[i] ?? 0;
            const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
            return `
              <div
                class="eq-band-col"
                style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2); height: 100%; justify-content: flex-end;"
              >
                <span
                  id="eq-gain-val-${i}"
                  style="font-size: 11px; font-weight: 600; color: ${gain !== 0 ? 'var(--color-accent-primary, #ff6b00)' : 'var(--color-text-muted)'};"
                >
                  ${gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
                </span>
                <input
                  type="range"
                  class="eq-band-slider"
                  data-band-index="${i}"
                  min="-12"
                  max="12"
                  step="0.5"
                  value="${gain}"
                  aria-label="Equalizer ${label}Hz Gain"
                  aria-valuemin="-12"
                  aria-valuemax="12"
                  aria-valuenow="${gain}"
                  style="
                    writing-mode: vertical-lr;
                    direction: rtl;
                    height: 140px;
                    width: 24px;
                    margin: 0;
                    accent-color: var(--color-accent-primary, #ff6b00);
                    cursor: pointer;
                  "
                />
                <span style="font-size: 12px; font-weight: 600; color: var(--color-text-secondary);">
                  ${label}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    if (!this.container || !this.currentSettings) return;

    // 1. Enable/Bypass toggle
    const toggle = this.container.querySelector<HTMLInputElement>('#eq-enable-toggle');
    toggle?.addEventListener('change', () => {
      if (!this.currentSettings) return;
      const enabled = toggle.checked;
      this.currentSettings = { ...this.currentSettings, equalizerEnabled: enabled };
      this.audioEngine.setEqualizerEnabled(enabled);
      this.schedulePersist();
      this.render();
    });

    // 2. Preamp slider
    const preampSlider = this.container.querySelector<HTMLInputElement>('#eq-preamp-slider');
    const preampVal = this.container.querySelector<HTMLElement>('#eq-preamp-val');
    preampSlider?.addEventListener('input', () => {
      if (!this.currentSettings) return;
      const val = parseFloat(preampSlider.value);
      if (preampVal) {
        preampVal.textContent = `${val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)} dB`;
      }
      this.currentSettings = { ...this.currentSettings, preampGainDb: val };
      this.audioEngine.setPreampGain(val);
      this.schedulePersist();
    });

    // 3. 10 Band sliders
    const bandSliders = this.container.querySelectorAll<HTMLInputElement>('.eq-band-slider');
    bandSliders.forEach(slider => {
      slider.addEventListener('input', () => {
        if (!this.currentSettings) return;
        const index = parseInt(slider.getAttribute('data-band-index') || '0', 10);
        const val = parseFloat(slider.value);

        const valLabel = this.container?.querySelector<HTMLElement>(`#eq-gain-val-${index}`);
        if (valLabel) {
          valLabel.textContent = `${val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}`;
          valLabel.style.color = val !== 0 ? 'var(--color-accent-primary, #ff6b00)' : 'var(--color-text-muted)';
        }

        const newBands = [...this.currentSettings.equalizerBands];
        newBands[index] = val;

        this.currentSettings = {
          ...this.currentSettings,
          equalizerBands: newBands,
          selectedPreset: 'custom'
        };

        this.audioEngine.setEqualizerBandGain(index, val);
        this.schedulePersist();
      });
    });

    // 4. Preset selector
    const presetSelect = this.container.querySelector<HTMLSelectElement>('#eq-preset-select');
    presetSelect?.addEventListener('change', () => {
      this.applyPreset(presetSelect.value);
    });

    // 5. Reset button
    const resetBtn = this.container.querySelector<HTMLButtonElement>('#eq-reset-btn');
    resetBtn?.addEventListener('click', async () => {
      this.currentSettings = await this.settingsService.resetToDefaults();
      await this.settingsService.applyToAudioEngine(this.audioEngine);
      this.render();
    });

    // 6. Save preset button
    const saveBtn = this.container.querySelector<HTMLButtonElement>('#eq-save-preset-btn');
    saveBtn?.addEventListener('click', async () => {
      if (!this.currentSettings) return;
      const name = window.prompt('Enter custom preset name:');
      if (name && name.trim()) {
        await this.settingsService.saveCustomPreset(
          name.trim(),
          this.currentSettings.equalizerBands,
          this.currentSettings.preampGainDb
        );
        this.currentSettings = await this.settingsService.getSettings();
        this.render();
      }
    });
  }

  private applyPreset(presetId: string): void {
    if (!this.currentSettings) return;

    let targetPreset: EqualizerPreset | undefined;
    const builtIn = this.settingsService.getBuiltInPresets().find(p => p.id === presetId);
    if (builtIn) {
      targetPreset = builtIn;
    } else {
      targetPreset = this.currentSettings.customPresets.find(p => p.id === presetId);
    }

    if (targetPreset) {
      this.currentSettings = {
        ...this.currentSettings,
        selectedPreset: targetPreset.id,
        equalizerBands: [...targetPreset.bands],
        preampGainDb: targetPreset.preampGainDb
      };

      this.audioEngine.setEqualizerBands(targetPreset.bands);
      this.audioEngine.setPreampGain(targetPreset.preampGainDb);
      this.schedulePersist();
      this.render();
    }
  }

  private schedulePersist(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      if (this.currentSettings) {
        void this.settingsService.saveSettings(this.currentSettings);
      }
    }, 300);
  }
}
