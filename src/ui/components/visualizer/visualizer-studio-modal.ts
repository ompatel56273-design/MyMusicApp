import type { IPlaybackManager, IAudioEngine, IArtworkService } from '../../../services/contracts/service-contracts';
import { VisualizerEngine } from '../../../services/visualizer/visualizer-engine';
import { VisualizerPresetRegistry } from '../../../services/visualizer/visualizer-preset-registry';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';
import { DomainEvents } from '../../../domain/events/domain-events';
import type { EventBus } from '../../../core/events/event-bus';
import type { Disposable } from '../../../core/types/common';

export interface VisualizerStudioModalOptions {
  audioEngine?: IAudioEngine | undefined;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
  eventBus?: EventBus | undefined;
  initialPresetId?: string | undefined;
  onClose?: () => void;
}

export class VisualizerStudioModal {
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private engine: VisualizerEngine | null = null;
  private presetRegistry = VisualizerPresetRegistry.getInstance();

  private readonly audioEngine?: IAudioEngine | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly eventBus?: EventBus | undefined;

  private isControlsVisible = true;
  private idleTimeoutId: any = null;
  private eventSubscriptions: Disposable[] = [];
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  public static show(options: VisualizerStudioModalOptions): VisualizerStudioModal {
    const modal = new VisualizerStudioModal(options);
    modal.mount();
    return modal;
  }

  constructor(private readonly options: VisualizerStudioModalOptions) {
    this.audioEngine = options.audioEngine;
    this.playbackManager = options.playbackManager;
    this.artworkService = options.artworkService;
    this.eventBus = options.eventBus;
  }

  public mount(): void {
    if (this.overlay || typeof document === 'undefined') return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'visualizer-studio-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.inset = '0';
    this.overlay.style.zIndex = '9999';
    this.overlay.style.backgroundColor = '#04060c';
    this.overlay.style.display = 'flex';
    this.overlay.style.flexDirection = 'column';
    this.overlay.style.overflow = 'hidden';
    this.overlay.style.userSelect = 'none';

    this.overlay.innerHTML = `
      <!-- WebGL Canvas Layer -->
      <canvas id="viz-studio-canvas" style="position: absolute; inset: 0; width: 100%; height: 100%; display: block;"></canvas>

      <!-- WebGL Fallback Notification Banner (Hidden by default) -->
      <div id="viz-fallback-banner" style="display: none; position: absolute; top: 20px; left: 50%; transform: translateX(-50%); z-index: 100; background: rgba(239, 68, 68, 0.2); backdrop-filter: blur(12px); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-xl); padding: 12px 24px; color: #fca5a5; font-size: 13px; font-weight: 600; text-align: center;">
        <span style="display: inline-block; margin-right: 6px;">⚠️</span>
        <span id="viz-fallback-msg">WebGL 2.0 is unavailable. Falling back to non-accelerated mode.</span>
      </div>

      <!-- Floating Top Header Controls -->
      <div id="viz-top-hud" class="glass-panel" style="position: absolute; top: 16px; left: 20px; right: 20px; z-index: 50; display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: rgba(10, 14, 28, 0.65); backdrop-filter: blur(16px); border-radius: var(--radius-2xl); border: 1px solid var(--glass-border-interactive); transition: opacity 0.3s ease, transform 0.3s ease;">

        <!-- Studio Brand & Preset Selector -->
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('maximize', { size: 20 })}
            </span>
            <span style="font-size: 14px; font-weight: 800; color: #ffffff; letter-spacing: 0.04em;">
              3D VISUALIZER STUDIO
            </span>
          </div>

          <!-- Preset Pills -->
          <div id="viz-preset-pills" style="display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;">
            ${this.renderPresetPills()}
          </div>
        </div>

        <!-- Top Right Actions -->
        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="viz-fullscreen-btn" title="Toggle Fullscreen (F)" style="background: rgba(255, 255, 255, 0.08); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: 8px 12px; color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>${getIconSvg('maximize', { size: 14 })}</span>
            <span class="viz-btn-label">Fullscreen</span>
          </button>

          <button id="viz-close-btn" title="Exit Visualizer (Esc)" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-lg); padding: 8px 14px; color: #f87171; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span>${getIconSvg('close', { size: 14 })}</span>
            <span>Exit</span>
          </button>
        </div>
      </div>

      <!-- Floating Bottom Control Panel -->
      <div id="viz-bottom-hud" class="glass-panel" style="position: absolute; bottom: 16px; left: 20px; right: 20px; z-index: 50; display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: rgba(10, 14, 28, 0.65); backdrop-filter: blur(16px); border-radius: var(--radius-2xl); border: 1px solid var(--glass-border-interactive); transition: opacity 0.3s ease, transform 0.3s ease;">

        <!-- Playing Track Pill -->
        <div id="viz-track-badge" style="display: flex; align-items: center; gap: 12px; min-width: 220px; max-width: 320px;">
          <div id="viz-track-art" style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--glass-border);">
            ${getIconSvg('disc', { size: 22 })}
          </div>
          <div style="display: flex; flex-direction: column; overflow: hidden;">
            <div id="viz-track-title" style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              No track playing
            </div>
            <div id="viz-track-artist" style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              MyMusicApp Engine
            </div>
          </div>
        </div>

        <!-- Audio Reactive Sliders & FPS Selector -->
        <div style="display: flex; align-items: center; gap: 20px; font-size: 12px; color: var(--color-text-secondary);">

          <!-- Sensitivity Slider -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Sensitivity</span>
            <input type="range" id="viz-sensitivity-slider" min="0.2" max="2.5" step="0.1" value="1.0" style="width: 80px; accent-color: var(--color-accent-purple);" />
            <span id="viz-sensitivity-val" style="font-size: 11px; font-weight: 700; color: #ffffff; min-width: 24px;">1.0x</span>
          </div>

          <!-- Smoothing Slider -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Smoothing</span>
            <input type="range" id="viz-smoothing-slider" min="0.0" max="0.95" step="0.05" value="0.75" style="width: 80px; accent-color: var(--color-accent-cyan);" />
            <span id="viz-smoothing-val" style="font-size: 11px; font-weight: 700; color: #ffffff; min-width: 28px;">0.75</span>
          </div>

          <!-- Beat Intensity Slider -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Beat Boost</span>
            <input type="range" id="viz-beat-slider" min="0.2" max="2.5" step="0.1" value="1.0" style="width: 80px; accent-color: var(--color-accent-pink);" />
            <span id="viz-beat-val" style="font-size: 11px; font-weight: 700; color: #ffffff; min-width: 24px;">1.0x</span>
          </div>

          <!-- FPS Limiter Select -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>FPS</span>
            <select id="viz-fps-select" style="padding: 4px 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: #ffffff; font-size: 11px; font-weight: 700; cursor: pointer;">
              <option value="30">30 FPS</option>
              <option value="45">45 FPS</option>
              <option value="60" selected>60 FPS</option>
              <option value="90">90 FPS</option>
              <option value="120">120 FPS</option>
            </select>
          </div>

        </div>

        <!-- Mini Play/Pause & Info Hint -->
        <div style="display: flex; align-items: center; gap: 12px;">
          <button id="viz-play-pause-btn" style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: none; color: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${getIconSvg('play', { size: 16 })}
          </button>
          <span style="font-size: 11px; color: var(--color-text-muted);">
            [Tab] Hide Controls &nbsp;•&nbsp; [V] Preset
          </span>
        </div>

      </div>
    `;

    document.body.appendChild(this.overlay);

    this.canvas = this.overlay.querySelector<HTMLCanvasElement>('#viz-studio-canvas')!;

    // Initialize Visualizer Engine
    this.engine = new VisualizerEngine({
      audioEngine: this.audioEngine,
      config: {
        presetId: this.options.initialPresetId || 'neon-nebula'
      },
      onFallback: (reason) => {
        this.showFallback(reason);
      },
      onPresetChanged: (presetId) => {
        this.updatePillActiveState(presetId);
      }
    });

    this.engine.attachCanvas(this.canvas);
    this.engine.start();

    // Bind UI controls & events
    this.bindControlEvents();
    this.bindKeyboardEvents();
    this.bindIdleAutoHide();
    this.updateTrackBadge();

    // Subscribe to domain playback changes
    if (this.eventBus) {
      const sub = this.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, () => {
        this.updateTrackBadge();
      });
      this.eventSubscriptions.push(sub);
    }

    // Resize listener
    const onWindowResize = () => {
      this.engine?.resize();
    };
    window.addEventListener('resize', onWindowResize);
    this.eventSubscriptions.push({
      dispose: () => window.removeEventListener('resize', onWindowResize)
    });
  }

  private renderPresetPills(): string {
    const list = this.presetRegistry.listPresets();
    const currentId = this.options.initialPresetId || 'neon-nebula';

    return list.map(p => `
      <button
        class="viz-preset-pill ${p.id === currentId ? 'active' : ''}"
        data-preset-id="${p.id}"
        style="
          padding: 6px 14px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
          border: 1px solid ${p.id === currentId ? 'var(--color-accent-purple-glow)' : 'var(--glass-border)'};
          background: ${p.id === currentId ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)'};
          color: ${p.id === currentId ? '#ffffff' : 'var(--color-text-secondary)'};
        "
      >
        ${escapeHtml(p.name)}
      </button>
    `).join('');
  }

  private updatePillActiveState(activeId: string): void {
    if (!this.overlay) return;
    const pills = this.overlay.querySelectorAll<HTMLButtonElement>('.viz-preset-pill');
    pills.forEach(pill => {
      const id = pill.getAttribute('data-preset-id');
      const isActive = id === activeId;
      pill.style.border = isActive ? '1px solid var(--color-accent-purple-glow)' : '1px solid var(--glass-border)';
      pill.style.background = isActive ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.05)';
      pill.style.color = isActive ? '#ffffff' : 'var(--color-text-secondary)';
    });
  }

  private bindControlEvents(): void {
    if (!this.overlay) return;

    // Preset pills click
    this.overlay.querySelectorAll('.viz-preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-preset-id');
        if (id && this.engine) {
          this.engine.setPreset(id);
        }
      });
    });

    // Sensitivity Slider
    const sensSlider = this.overlay.querySelector<HTMLInputElement>('#viz-sensitivity-slider')!;
    const sensVal = this.overlay.querySelector<HTMLElement>('#viz-sensitivity-val')!;
    sensSlider.addEventListener('input', () => {
      const val = parseFloat(sensSlider.value);
      sensVal.textContent = `${val.toFixed(1)}x`;
      this.engine?.updateConfig({ sensitivity: val });
    });

    // Smoothing Slider
    const smoothSlider = this.overlay.querySelector<HTMLInputElement>('#viz-smoothing-slider')!;
    const smoothVal = this.overlay.querySelector<HTMLElement>('#viz-smoothing-val')!;
    smoothSlider.addEventListener('input', () => {
      const val = parseFloat(smoothSlider.value);
      smoothVal.textContent = val.toFixed(2);
      this.engine?.updateConfig({ smoothing: val });
    });

    // Beat Intensity Slider
    const beatSlider = this.overlay.querySelector<HTMLInputElement>('#viz-beat-slider')!;
    const beatVal = this.overlay.querySelector<HTMLElement>('#viz-beat-val')!;
    beatSlider.addEventListener('input', () => {
      const val = parseFloat(beatSlider.value);
      beatVal.textContent = `${val.toFixed(1)}x`;
      this.engine?.updateConfig({ beatIntensity: val });
    });

    // FPS Limiter Select
    const fpsSelect = this.overlay.querySelector<HTMLSelectElement>('#viz-fps-select')!;
    fpsSelect.addEventListener('change', () => {
      const fps = parseInt(fpsSelect.value, 10) || 60;
      this.engine?.updateConfig({ fpsLimit: fps });
    });

    // Fullscreen Toggle
    const fsBtn = this.overlay.querySelector<HTMLButtonElement>('#viz-fullscreen-btn')!;
    fsBtn.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Close button
    const closeBtn = this.overlay.querySelector<HTMLButtonElement>('#viz-close-btn')!;
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    // Play / Pause Button
    const playPauseBtn = this.overlay.querySelector<HTMLButtonElement>('#viz-play-pause-btn')!;
    playPauseBtn.addEventListener('click', () => {
      if (!this.playbackManager) return;
      if (this.playbackManager.state === 'playing') {
        void this.playbackManager.pause();
      } else {
        void this.playbackManager.resume();
      }
    });
  }

  private bindKeyboardEvents(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        this.engine?.cycleNextPreset();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleControls();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.playbackManager) {
          if (this.playbackManager.state === 'playing') {
            void this.playbackManager.pause();
          } else {
            void this.playbackManager.resume();
          }
        }
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  private bindIdleAutoHide(): void {
    const onMouseMove = () => {
      this.showControls();
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = setTimeout(() => {
        if (this.isControlsVisible && document.fullscreenElement) {
          this.hideControls();
        }
      }, 3500);
    };

    window.addEventListener('mousemove', onMouseMove);
    this.eventSubscriptions.push({
      dispose: () => window.removeEventListener('mousemove', onMouseMove)
    });
  }

  private toggleControls(): void {
    if (this.isControlsVisible) {
      this.hideControls();
    } else {
      this.showControls();
    }
  }

  private hideControls(): void {
    if (!this.overlay) return;
    this.isControlsVisible = false;
    const topHud = this.overlay.querySelector<HTMLElement>('#viz-top-hud');
    const bottomHud = this.overlay.querySelector<HTMLElement>('#viz-bottom-hud');
    if (topHud) {
      topHud.style.opacity = '0';
      topHud.style.transform = 'translateY(-20px)';
      topHud.style.pointerEvents = 'none';
    }
    if (bottomHud) {
      bottomHud.style.opacity = '0';
      bottomHud.style.transform = 'translateY(20px)';
      bottomHud.style.pointerEvents = 'none';
    }
  }

  private showControls(): void {
    if (!this.overlay) return;
    this.isControlsVisible = true;
    const topHud = this.overlay.querySelector<HTMLElement>('#viz-top-hud');
    const bottomHud = this.overlay.querySelector<HTMLElement>('#viz-bottom-hud');
    if (topHud) {
      topHud.style.opacity = '1';
      topHud.style.transform = 'translateY(0)';
      topHud.style.pointerEvents = 'auto';
    }
    if (bottomHud) {
      bottomHud.style.opacity = '1';
      bottomHud.style.transform = 'translateY(0)';
      bottomHud.style.pointerEvents = 'auto';
    }
  }

  private toggleFullscreen(): void {
    if (!this.overlay) return;
    if (!document.fullscreenElement) {
      this.overlay.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  private updateTrackBadge(): void {
    if (!this.overlay || !this.playbackManager) return;
    const track = this.playbackManager.currentTrack;
    const titleEl = this.overlay.querySelector<HTMLElement>('#viz-track-title');
    const artistEl = this.overlay.querySelector<HTMLElement>('#viz-track-artist');
    const artEl = this.overlay.querySelector<HTMLElement>('#viz-track-art');
    const playPauseBtn = this.overlay.querySelector<HTMLElement>('#viz-play-pause-btn');

    if (titleEl) titleEl.textContent = track ? track.title : 'No track playing';
    if (artistEl) artistEl.textContent = track ? (track.artistName || 'Unknown Artist') : 'MyMusicApp Engine';

    if (artEl && track) {
      if (track.artworkId && this.artworkService) {
        void this.artworkService.getArtworkUrl(track.artworkId, 'small').then(url => {
          if (url && artEl) {
            artEl.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
          }
        });
      } else {
        artEl.innerHTML = getIconSvg('disc', { size: 22 });
      }
    }

    if (playPauseBtn) {
      const isPlaying = this.playbackManager.state === 'playing';
      playPauseBtn.innerHTML = getIconSvg(isPlaying ? 'pause' : 'play', { size: 16 });
      this.engine?.setPaused(!isPlaying);
    }
  }

  private showFallback(reason: string): void {
    if (!this.overlay) return;
    const banner = this.overlay.querySelector<HTMLElement>('#viz-fallback-banner');
    const msg = this.overlay.querySelector<HTMLElement>('#viz-fallback-msg');
    if (banner && msg) {
      msg.textContent = reason;
      banner.style.display = 'block';
    }
  }

  public close(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }

    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    this.eventSubscriptions.forEach(sub => sub.dispose());
    this.eventSubscriptions = [];

    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.options.onClose) {
      this.options.onClose();
    }
  }
}
