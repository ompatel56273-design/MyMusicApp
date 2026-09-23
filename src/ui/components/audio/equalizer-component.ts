import type { IAudioEngine, IAudioSettingsService } from '../../../services/contracts/service-contracts';
import { EQUALIZER_ISO_FREQUENCIES } from '../../../services/audio/audio-types';
import type { AudioSettings, EqualizerPreset } from '../../../domain/entities/audio-settings';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface EqualizerComponentDependencies {
  audioEngine: IAudioEngine;
  audioSettingsService: IAudioSettingsService;
}

/**
 * Phase 10 10-Band ISO Graphic Equalizer UI Component (Template 8: Sound Your Way).
 * Features:
 * - Dynamic SVG EQ Response Curve with Bezier spline & neon gradient glow
 * - 10-Band individual frequency gain sliders [-12dB, +12dB] with tabular dB readouts
 * - Preamp stage slider with gain readout
 * - Preset selector & quick-select chips (Flat, Rock, Pop, Classical, Jazz, Vocal, Bass Boost)
 * - Custom preset creation (+ Save) and Reset Flat action
 * - Bypass/ON toggle with live DSP connection
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
    const curvePaths = this.calculateCurvePaths(s.equalizerBands);

    this.container.innerHTML = `
      <div
        class="equalizer-panel glass-panel"
        role="region"
        aria-label="10-Band Graphic Equalizer"
        style="
          padding: var(--space-6);
          border-radius: var(--radius-2xl);
          box-sizing: border-box;
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          width: 100%;
        "
      >
        <!-- Header & Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-4);">
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-accent-purple-glow); display: flex;">
                ${getIconSvg('equalizer', { size: 20 })}
              </span>
              <div>
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-cyan);">
                  Sound Your Way
                </span>
                <h3 style="font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 0 0; color: #ffffff;">
                  10-Band Graphic Equalizer
                </h3>
              </div>
            </div>

            <label style="display: inline-flex; align-items: center; gap: var(--space-2); margin-left: var(--space-2); padding: 4px 12px; border-radius: var(--radius-full); background: ${s.equalizerEnabled ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${s.equalizerEnabled ? 'var(--glass-border-interactive)' : 'var(--glass-border)'}; font-size: 12px; font-weight: 700; cursor: pointer; color: ${s.equalizerEnabled ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)'}; transition: all var(--duration-fast);">
              <input
                type="checkbox"
                id="eq-enable-toggle"
                ${s.equalizerEnabled ? 'checked' : ''}
                style="accent-color: var(--color-accent-purple); cursor: pointer;"
              />
              ${s.equalizerEnabled ? 'ACTIVE' : 'BYPASS'}
            </label>
          </div>

          <!-- Presets Dropdown & Action Buttons -->
          <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; max-width: 100%;">
            <label for="eq-preset-select" style="font-size: 12px; font-weight: 600; color: var(--color-text-muted);">Preset:</label>
            <select
              id="eq-preset-select"
              class="app-select"
              style="min-height: 40px; padding: 6px 14px; border-radius: var(--radius-full); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); color: #ffffff; font-size: 13px; font-weight: 600; cursor: pointer; min-width: 130px;"
            >
              <optgroup label="Built-in Presets">
                ${builtIns.map(p => `<option value="${p.id}" ${s.selectedPreset === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
              </optgroup>
              ${
                s.customPresets.length > 0
                  ? `
                <optgroup label="Custom Presets">
                  ${s.customPresets.map(p => `<option value="${p.id}" ${s.selectedPreset === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                </optgroup>
              `
                  : ''
              }
            </select>

            <button
              id="eq-save-preset-btn"
              aria-label="Save custom preset"
              style="min-height: 40px; padding: 6px 14px; border-radius: var(--radius-full); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--duration-fast); display: flex; align-items: center; gap: 4px;"
            >
              <span>+ Save</span>
            </button>

            <button
              id="eq-reset-btn"
              aria-label="Reset EQ to flat"
              style="min-height: 40px; padding: 6px 14px; border-radius: var(--radius-full); background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--duration-fast); display: flex; align-items: center; gap: 4px;"
            >
              <span>Reset Flat</span>
            </button>
          </div>
        </div>

        <!-- Dynamic EQ Response Curve Visualization -->
        <div
          class="eq-curve-container"
          style="
            background: rgba(0, 0, 0, 0.4);
            border-radius: var(--radius-xl);
            border: 1px solid var(--glass-border);
            padding: var(--space-3) var(--space-4);
            position: relative;
            overflow: hidden;
            width: 100%;
            box-sizing: border-box;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: var(--font-weight-extrabold); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted);">
              Frequency Response Curve (DSP)
            </span>
            <span style="font-size: 10px; color: var(--color-accent-cyan); font-weight: 600;">
              ${s.equalizerEnabled ? 'Real-time Biquad Filter Chain' : 'Filter Bypassed'}
            </span>
          </div>

          <svg
            id="eq-curve-svg"
            viewBox="0 0 640 120"
            preserveAspectRatio="none"
            style="width: 100%; height: 90px; display: block; overflow: visible;"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="eq-curve-stroke-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#7c3aed" />
                <stop offset="50%" stop-color="#a855f7" />
                <stop offset="100%" stop-color="#06b6d4" />
              </linearGradient>
              <linearGradient id="eq-curve-fill-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="rgba(124, 58, 237, 0.35)" />
                <stop offset="50%" stop-color="rgba(6, 182, 212, 0.1)" />
                <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
              </linearGradient>
              <filter id="eq-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <!-- Grid Lines (+12dB, 0dB baseline, -12dB) -->
            <line x1="0" y1="16" x2="640" y2="16" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
            <line x1="0" y1="60" x2="640" y2="60" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
            <line x1="0" y1="104" x2="640" y2="104" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />

            <!-- Filled Area Under Curve -->
            <path
              id="eq-curve-area"
              d="${curvePaths.area}"
              fill="url(#eq-curve-fill-grad)"
              opacity="${s.equalizerEnabled ? '1' : '0.25'}"
            />

            <!-- Stroke Curve -->
            <path
              id="eq-curve-line"
              d="${curvePaths.line}"
              fill="none"
              stroke="url(#eq-curve-stroke-grad)"
              stroke-width="2.5"
              stroke-linecap="round"
              filter="url(#eq-glow)"
              opacity="${s.equalizerEnabled ? '1' : '0.4'}"
            />

            <!-- Band Dot Markers -->
            ${curvePaths.points
              .map(
                (p, idx) => `
              <circle
                id="eq-dot-${idx}"
                cx="${p.x}"
                cy="${p.y}"
                r="3.5"
                fill="#ffffff"
                stroke="var(--color-accent-purple)"
                stroke-width="1.5"
                opacity="${s.equalizerEnabled ? '1' : '0.3'}"
              />
            `
              )
              .join('')}
          </svg>
        </div>

        <!-- Preset Quick-Select Chips -->
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none;">
          ${builtIns
            .map(
              p => `
            <button
              type="button"
              class="eq-chip-btn"
              data-preset-id="${p.id}"
              style="
                padding: 6px 14px;
                border-radius: var(--radius-full);
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: all var(--duration-fast) var(--ease-smooth);
                background: ${s.selectedPreset === p.id ? 'linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%)' : 'rgba(255, 255, 255, 0.04)'};
                color: ${s.selectedPreset === p.id ? '#ffffff' : 'var(--color-text-secondary)'};
                border: 1px solid ${s.selectedPreset === p.id ? 'var(--glass-border-interactive)' : 'var(--glass-border)'};
                box-shadow: ${s.selectedPreset === p.id ? '0 2px 10px rgba(124, 58, 237, 0.4)' : 'none'};
              "
            >
              ${escapeHtml(p.name)}
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Preamp Stage Slider -->
        <div style="padding: var(--space-3) var(--space-4); background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);">
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
            style="flex: 1; accent-color: var(--color-accent-purple); cursor: pointer;"
          />
          <span id="eq-preamp-val" style="font-size: 13px; font-weight: 700; color: #ffffff; min-width: 55px; text-align: right; font-variant-numeric: tabular-nums;">
            ${s.preampGainDb > 0 ? `+${s.preampGainDb.toFixed(1)}` : s.preampGainDb.toFixed(1)} dB
          </span>
        </div>

        <!-- 10 Frequency Sliders Grid -->
        <div
          class="eq-bands-grid"
          style="display: grid; grid-template-columns: repeat(10, 1fr); gap: var(--space-2); min-height: 230px; align-items: end; padding: var(--space-4) var(--space-2); background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); overflow-x: auto;"
        >
          ${EQUALIZER_ISO_FREQUENCIES.map((freq, i) => {
            const gain = s.equalizerBands[i] ?? 0;
            const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
            return `
              <div
                class="eq-band-col"
                style="display: flex; flex-direction: column; align-items: center; gap: var(--space-2); height: 100%; justify-content: flex-end; min-width: 32px;"
              >
                <span
                  id="eq-gain-val-${i}"
                  style="font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; color: ${gain !== 0 ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)'};"
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
                    accent-color: var(--color-accent-purple);
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
              valLabel.style.color = val !== 0 ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)';
            }

            const newBands = [...this.currentSettings.equalizerBands];
            newBands[index] = val;

            this.currentSettings = {
              ...this.currentSettings,
              equalizerBands: newBands,
              selectedPreset: 'custom'
            };

            this.updateCurveSvg(newBands);
            this.audioEngine.setEqualizerBandGain(index, val);
            this.schedulePersist();
          });
        });

        // 4. Preset selector & chips
        const presetSelect = this.container.querySelector<HTMLSelectElement>('#eq-preset-select');
        presetSelect?.addEventListener('change', () => {
          this.applyPreset(presetSelect.value);
        });

        const chipBtns = this.container.querySelectorAll<HTMLButtonElement>('.eq-chip-btn');
        chipBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const presetId = btn.getAttribute('data-preset-id');
            if (presetId) {
              this.applyPreset(presetId);
            }
          });
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

      private calculateCurvePaths(bands: readonly number[]): { line: string; area: string; points: Array<{ x: number; y: number }> } {
        const W = 640;
        const H = 120;
        const baseline = 60;
        const startX = 32;
        const stepX = (W - 64) / 9;

        const points = bands.map((gain, i) => {
          const clampedGain = Math.max(-12, Math.min(12, gain));
          const y = baseline - (clampedGain / 12) * 44;
          const x = startX + i * stepX;
          return { x, y };
        });

        if (points.length === 0) {
          return { line: '', area: '', points: [] };
        }

        let lineD = `M ${points[0]!.x} ${points[0]!.y}`;

        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i]!;
          const p1 = points[i + 1]!;
          const cp1x = p0.x + (p1.x - p0.x) * 0.5;
          const cp1y = p0.y;
          const cp2x = p1.x - (p1.x - p0.x) * 0.5;
          const cp2y = p1.y;
          lineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
        }

        const lastP = points[points.length - 1]!;
        const firstP = points[0]!;
        const areaD = `${lineD} L ${lastP.x} ${H} L ${firstP.x} ${H} Z`;

        return { line: lineD, area: areaD, points };
      }

      private updateCurveSvg(bands: readonly number[]): void {
        if (!this.container) return;
        const { line, area, points } = this.calculateCurvePaths(bands);

        const lineEl = this.container.querySelector<SVGPathElement>('#eq-curve-line');
        const areaEl = this.container.querySelector<SVGPathElement>('#eq-curve-area');

        if (lineEl) lineEl.setAttribute('d', line);
        if (areaEl) areaEl.setAttribute('d', area);

        points.forEach((p, idx) => {
          const dot = this.container?.querySelector<SVGCircleElement>(`#eq-dot-${idx}`);
          if (dot) {
            dot.setAttribute('cx', String(p.x));
            dot.setAttribute('cy', String(p.y));
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
