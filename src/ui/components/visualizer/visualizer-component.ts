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

    const modes: VisualizerMode[] = ['bars', 'waveform', 'circular', 'spectrum', 'particles', 'minimal'];

    this.container.innerHTML = `
      <div
        class="visualizer-container glass-panel"
        style="
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          border-radius: var(--radius-xl);
          padding: var(--space-4);
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        "
      >
        <!-- Top Toolbar -->
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--space-3);
            flex-wrap: wrap;
            gap: var(--space-2);
            z-index: 2;
          "
        >
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-accent-primary, #ff6b00);">
              Audio Visualizer
            </span>
            <label style="display: inline-flex; align-items: center; gap: var(--space-1); font-size: 12px; cursor: pointer; color: var(--color-text-secondary);">
              <input
                type="checkbox"
                id="vis-enabled-toggle"
                ${this.currentSettings.enabled ? 'checked' : ''}
                style="accent-color: var(--color-accent-primary, #ff6b00); cursor: pointer;"
              />
              ${this.currentSettings.enabled ? 'Active' : 'Off'}
            </label>
          </div>

          <!-- Mode Picker -->
          <div style="display: flex; gap: 4px; background: rgba(0, 0, 0, 0.3); padding: 2px; border-radius: var(--radius-md);">
            ${modes.map(m => `
              <button
                type="button"
                class="vis-mode-btn"
                data-mode="${m}"
                style="
                  padding: 4px 10px;
                  border-radius: var(--radius-sm);
                  border: none;
                  font-size: 11px;
                  font-weight: 600;
                  text-transform: capitalize;
                  cursor: pointer;
                  background: ${this.currentSettings.mode === m ? 'var(--color-accent-primary, #ff6b00)' : 'transparent'};
                  color: ${this.currentSettings.mode === m ? '#ffffff' : 'var(--color-text-secondary)'};
                  transition: all 0.15s ease;
                "
              >
                ${m}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Canvas Surface -->
        <div style="flex: 1; position: relative; min-height: 200px; width: 100%; display: flex; align-items: center; justify-content: center;">
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
      mode: this.currentSettings.mode,
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

    // Start rendering if currently playing
    if (this.shouldBeRunning()) {
      this.renderer.start();
    }
  }

  private attachUiEvents(): void {
    if (!this.container) return;

    // 1. Toggle enabled
    const toggle = this.container.querySelector<HTMLInputElement>('#vis-enabled-toggle');
    toggle?.addEventListener('change', async () => {
      const enabled = toggle.checked;
      this.currentSettings = { ...this.currentSettings, enabled };
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
      btn.addEventListener('click', async () => {
        const mode = btn.getAttribute('data-mode') as VisualizerMode;
        if (mode) {
          this.currentSettings = { ...this.currentSettings, mode };
          this.renderer.setConfig({ mode });
          if (this.visualizerService) {
            await this.visualizerService.setMode(mode);
          }
          this.render();
          this.initCanvasAndRenderer();
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
    if (!this.currentSettings.enabled) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (this.playbackManager) {
      return this.playbackManager.state === 'playing';
    }
    return true;
  }
}
