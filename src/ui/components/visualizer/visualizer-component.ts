import type { IAudioEngine, IVisualizerService, IPlaybackManager } from '../../../services/contracts/service-contracts';
import { VisualizerCanvasRenderer } from './visualizer-canvas-renderer';
import type { VisualizerMode, VisualizerSettings } from '../../../domain/entities/visualizer-settings';
import { EventBus } from '../../../core/events/event-bus';
import { DomainEvents } from '../../../domain/events/domain-events';
import type { Disposable } from '../../../core/types/common';

export interface VisualizerComponentDependencies {
  audioEngine: IAudioEngine;
  visualizerService?: IVisualizerService | undefined;
  playbackManager?: IPlaybackManager | undefined;
  eventBus?: EventBus | undefined;
}

export class VisualizerComponent {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private readonly renderer: VisualizerCanvasRenderer;
  private readonly visualizerService?: IVisualizerService | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly eventBus?: EventBus | undefined;

  private currentSettings: VisualizerSettings = {
    enabled: true,
    mode: 'bars',
    fpsLimit: 60,
    colorTheme: 'accent'
  };

  private resizeObserver: ResizeObserver | null = null;
  private subscriptions: Disposable[] = [];
  private mediaQueryList: MediaQueryList | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(deps: VisualizerComponentDependencies) {
    this.renderer = new VisualizerCanvasRenderer(deps.audioEngine);
    this.visualizerService = deps.visualizerService;
    this.playbackManager = deps.playbackManager;
    this.eventBus = deps.eventBus;
  }

  public async mount(container: HTMLElement): Promise<void> {
    this.container = container;

    if (this.visualizerService) {
      this.currentSettings = await this.visualizerService.getSettings();
    }

    this.render();
    this.initCanvasAndRenderer();
    this.subscribeEvents();
  }

  public unmount(): void {
    if (this.renderer) {
      this.renderer.stop();
      this.renderer.detachCanvas();
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions = [];

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    const primaryModes: { id: VisualizerMode; label: string }[] = [
      { id: 'off', label: 'Off' },
      { id: 'bars', label: 'Spectrum Bars' },
      { id: 'waveform', label: 'Waveform' },
      { id: 'circular', label: 'Circular Spectrum' }
    ];

    const currentMode = !this.currentSettings.enabled ? 'off' : this.currentSettings.mode;

    this.container.innerHTML = `
      <div
        class="visualizer-container glass-panel"
        style="
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          border-radius: var(--radius-2xl);
          padding: var(--space-5);
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
        "
      >
        <!-- Top Toolbar -->
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-4);
            flex-wrap: wrap;
            gap: var(--space-3);
            z-index: 2;
          "
        >
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-secondary);">
                Live Spectrum
              </span>
              <h3 style="font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 0 0; color: var(--color-text-primary);">
                Audio Visualizer
              </h3>
            </div>
            <label style="display: inline-flex; align-items: center; gap: var(--space-2); margin-left: var(--space-2); padding: 4px 12px; border-radius: var(--radius-full); background: ${this.currentSettings.enabled && currentMode !== 'off' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${this.currentSettings.enabled && currentMode !== 'off' ? 'rgba(6, 182, 212, 0.4)' : 'var(--glass-border)'}; font-size: 12px; font-weight: 700; cursor: pointer; color: ${this.currentSettings.enabled && currentMode !== 'off' ? 'var(--color-accent-secondary)' : 'var(--color-text-muted)'}; transition: all var(--duration-fast);">
              <input
                type="checkbox"
                id="vis-enabled-toggle"
                ${this.currentSettings.enabled && currentMode !== 'off' ? 'checked' : ''}
                style="accent-color: var(--color-accent-secondary); cursor: pointer;"
              />
              ${this.currentSettings.enabled && currentMode !== 'off' ? 'ACTIVE' : 'OFF'}
            </label>
          </div>

          <!-- Mode Picker Chips -->
          <div
            role="radiogroup"
            aria-label="Visualizer Style Selection"
            style="display: flex; gap: 4px; background: rgba(0, 0, 0, 0.3); padding: 4px; border-radius: var(--radius-xl); border: 1px solid var(--glass-border); flex-wrap: wrap;"
          >
            ${primaryModes.map(m => {
              const isActive = (m.id === 'off' && (!this.currentSettings.enabled || currentMode === 'off')) ||
                (this.currentSettings.enabled && (currentMode === m.id || (m.id === 'bars' && currentMode === 'spectrum-bars') || (m.id === 'circular' && currentMode === 'circular-spectrum')));
              return `
                <button
                  type="button"
                  class="vis-mode-btn ${isActive ? 'active' : ''}"
                  data-mode="${m.id}"
                  role="radio"
                  aria-checked="${isActive ? 'true' : 'false'}"
                  tabindex="0"
                  style="
                    padding: 6px 14px;
                    border-radius: var(--radius-lg);
                    border: none;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    background: ${isActive ? 'var(--color-accent-gradient)' : 'transparent'};
                    color: ${isActive ? '#ffffff' : 'var(--color-text-secondary)'};
                    box-shadow: ${isActive ? 'var(--shadow-glow-purple)' : 'none'};
                    transition: all var(--duration-fast) var(--ease-smooth);
                  "
                >
                  ${m.label}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Canvas Surface -->
        <div style="flex: 1; position: relative; min-height: 220px; width: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.3); border-radius: var(--radius-xl); border: 1px solid var(--glass-border); overflow: hidden;">
          <canvas
            id="vis-canvas"
            aria-label="Real-time Audio Visualizer Canvas"
            role="img"
            style="width: 100%; height: 100%; display: block;"
          ></canvas>
        </div>
      </div>
    `;

    this.attachUiEvents();
  }

  private initCanvasAndRenderer(): void {
    if (!this.container) return;

    this.canvas = this.container.querySelector<HTMLCanvasElement>('#vis-canvas');
    if (!this.canvas) return;

    this.renderer.attachCanvas(this.canvas);

    // Detect prefers-reduced-motion
    let reducedMotion = false;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotion = this.mediaQueryList.matches;
      this.mediaQueryList.addEventListener('change', (e) => {
        this.renderer.setConfig({ reducedMotion: e.matches });
      });
    }

    this.renderer.setConfig({
      mode: this.currentSettings.enabled ? this.currentSettings.mode : 'off',
      colorTheme: this.currentSettings.colorTheme,
      fpsLimit: this.currentSettings.fpsLimit,
      reducedMotion
    });

    // ResizeObserver for canvas buffer sizing
    if (typeof ResizeObserver !== 'undefined' && this.canvas) {
      this.resizeObserver = new ResizeObserver(() => {
        this.renderer.resize();
      });
      this.resizeObserver.observe(this.canvas);
    }

    // Visibility handling (pause when tab hidden)
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.renderer.stop();
        } else if (this.shouldBeRunning()) {
          this.renderer.start();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    // Start rendering if currently playing and enabled
    if (this.shouldBeRunning()) {
      this.renderer.start();
    } else {
      this.renderer.stop();
    }
  }

  private attachUiEvents(): void {
    if (!this.container) return;

    // 1. Toggle enabled
    const toggle = this.container.querySelector<HTMLInputElement>('#vis-enabled-toggle');
    toggle?.addEventListener('change', async () => {
      const enabled = toggle.checked;
      const mode = enabled ? (this.currentSettings.mode === 'off' ? 'bars' : this.currentSettings.mode) : 'off';
      this.currentSettings = { ...this.currentSettings, enabled, mode };
      if (this.visualizerService) {
        await this.visualizerService.setEnabled(enabled);
      }
      if (enabled && this.shouldBeRunning()) {
        this.renderer.start();
      } else {
        this.renderer.stop();
      }
      this.render();
      this.initCanvasAndRenderer();
    });

    // 2. Mode buttons
    const modeBtns = this.container.querySelectorAll<HTMLButtonElement>('.vis-mode-btn');
    modeBtns.forEach(btn => {
      const selectMode = async () => {
        const mode = btn.getAttribute('data-mode') as VisualizerMode;
        if (mode) {
          const enabled = mode !== 'off';
          this.currentSettings = { ...this.currentSettings, mode, enabled };
          this.renderer.setConfig({ mode });
          if (this.visualizerService) {
            await this.visualizerService.setMode(mode);
          }
          if (enabled && this.shouldBeRunning()) {
            this.renderer.start();
          } else {
            this.renderer.stop();
          }
          this.render();
          this.initCanvasAndRenderer();
        }
      };

      btn.addEventListener('click', selectMode);
      btn.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void selectMode();
        }
      });
    });
  }

  private subscribeEvents(): void {
    if (!this.eventBus) return;

    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, (e: any) => {
        if (e.state === 'playing' && this.shouldBeRunning()) {
          this.renderer.start();
        } else if (e.state === 'paused' || e.state === 'stopped' || e.state === 'idle') {
          this.renderer.stop();
          this.renderer.drawFrame(); // Draw clean idle frame
        }
      })
    );
  }

  private shouldBeRunning(): boolean {
    if (!this.currentSettings.enabled || this.currentSettings.mode === 'off') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (this.playbackManager) {
      return this.playbackManager.state === 'playing';
    }
    return true;
  }
}
