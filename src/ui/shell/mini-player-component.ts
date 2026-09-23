import type { IPlaybackManager, IArtworkService } from '../../services/contracts/service-contracts';
import type { RouterService } from '../navigation/router-service';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { Disposable } from '../../core/types/common';
import type { Track } from '../../domain/entities/models';
import type { ShuffleMode, RepeatMode } from '../../domain/value-objects/audio-types';
import { getIconSvg } from '../icons/icon-registry';

export interface MiniPlayerDependencies {
  playbackManager: IPlaybackManager;
  artworkService?: IArtworkService | undefined;
  router?: RouterService | undefined;
  eventBus: EventBus;
}

export class MiniPlayerComponent {
  private container: HTMLElement | null = null;
  private readonly playbackManager: IPlaybackManager;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly router?: RouterService | undefined;
  private readonly eventBus: EventBus;

  private subscriptions: Disposable[] = [];
  private currentTrack: Track | null = null;
  private isPlaying = false;
  private currentPositionMs = 0;
  private currentDurationMs = 0;
  private isSeeking = false;
  private isFavorite = false;

  constructor(deps: MiniPlayerDependencies) {
    this.playbackManager = deps.playbackManager;
    this.artworkService = deps.artworkService;
    this.router = deps.router;
    this.eventBus = deps.eventBus;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.currentTrack = this.playbackManager.currentTrack;
    this.isPlaying = this.playbackManager.state === 'playing';
    this.currentPositionMs = this.playbackManager.positionMs;
    this.currentDurationMs = this.playbackManager.durationMs;
    this.isFavorite = this.currentTrack?.isFavorite ?? false;

    this.render();
    this.bindEvents();
    this.subscribeToDomainEvents();
  }

  public unmount(): void {
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
    this.subscriptions = [];

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    const title = this.currentTrack?.title || 'No Track Selected';
    const artist = this.currentTrack?.artistName || 'Select a song to play';
    const playIcon = this.isPlaying ? '⏸' : '▶';

    this.container.innerHTML = `
      <style>
        .mini-player-bar {
          height: var(--mini-player-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-6);
          border-top: 1px solid var(--glass-border);
          z-index: var(--z-player);
          gap: var(--space-4);
          position: relative;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
        }

        .mini-info-col {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 280px;
          min-width: 0;
          cursor: pointer;
        }

        .mini-controls-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
          max-width: 580px;
          min-width: 0;
        }

        .mini-aux-col {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 260px;
          justify-content: flex-end;
          min-width: 0;
        }

        /* Mobile Mini Player (< 768px) */
        @media (max-width: 767px) {
          .mini-player-bar {
            height: 60px;
            padding: 0 12px;
            gap: 8px;
          }

          .mini-info-col {
            width: auto;
            flex: 1;
            gap: 10px;
          }

          #mini-artwork-box {
            width: 40px !important;
            height: 40px !important;
          }

          #mini-track-title {
            font-size: 13px !important;
            max-width: 140px;
          }

          #mini-track-artist {
            font-size: 11px !important;
            max-width: 140px;
          }

          .mini-controls-col {
            max-width: none;
            flex: 0 0 auto;
          }

          .mini-controls-col > div:last-child {
            display: none !important;
          }

          .mini-controls-col > div:first-child {
            gap: 10px !important;
          }

          #mini-shuffle-btn, #mini-repeat-btn, #mini-prev-btn {
            display: none !important;
          }

          #mini-play-btn {
            width: 38px !important;
            height: 38px !important;
          }

          .mini-aux-col {
            display: none !important;
          }
        }
      </style>

      <div
        class="glass-panel-elevated mini-player-bar"
        role="region"
        aria-label="Audio Playback Controls"
      >
        <!-- Left: Track Info & Artwork -->
        <div class="mini-info-col" id="mini-track-info">
          <div
            id="mini-artwork-box"
            style="
              width: 48px;
              height: 48px;
              border-radius: var(--radius-sm);
              overflow: hidden;
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--color-text-muted);
            "
          >
            ${getIconSvg('disc', { size: 22 })}
          </div>

          <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
            <span
              id="mini-track-title"
              class="text-truncate"
              style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); line-height: 1.3;"
            >
              ${title}
            </span>
            <span
              id="mini-track-artist"
              class="text-truncate"
              style="font-size: 12px; color: var(--color-text-muted);"
            >
              ${artist}
            </span>
          </div>

          <button
            id="mini-fav-btn"
            aria-label="${this.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
            style="
              background: transparent;
              border: none;
              color: ${this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)'};
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 6px;
              border-radius: var(--radius-full);
              flex-shrink: 0;
              margin-left: 2px;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            ${getIconSvg(this.isFavorite ? 'heart-filled' : 'heart', { size: 18 })}
          </button>
        </div>

        <!-- Center: Primary Controls & Scrub Bar -->
        <div class="mini-controls-col">
          <!-- Control Buttons Row -->
          <div style="display: flex; align-items: center; gap: var(--space-4);">
            <button
              id="mini-shuffle-btn"
              aria-label="Toggle Shuffle"
              aria-pressed="${this.playbackManager.shuffleMode !== 'off'}"
              style="
                background: transparent;
                border: none;
                color: ${this.playbackManager.shuffleMode !== 'off' ? 'var(--color-accent-purple-glow)' : 'var(--color-text-secondary)'};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px;
                border-radius: var(--radius-full);
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              ${getIconSvg('shuffle', { size: 16 })}
            </button>

            <button
              id="mini-prev-btn"
              aria-label="Previous Track"
              style="
                background: transparent;
                border: none;
                color: var(--color-text-primary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px;
                border-radius: var(--radius-full);
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              ${getIconSvg('skip-back', { size: 20 })}
            </button>

            <!-- Circular Glowing Play/Pause Button -->
            <button
              id="mini-play-btn"
              aria-label="${this.isPlaying ? 'Pause track' : 'Play track'}"
              aria-pressed="${this.isPlaying ? 'true' : 'false'}"
              style="
                width: 42px;
                height: 42px;
                border-radius: var(--radius-full);
                background: var(--gradient-primary);
                border: none;
                color: #ffffff;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                box-shadow: 0 0 16px rgba(168, 85, 247, 0.5);
                transition: all var(--duration-fast) var(--ease-spring);
              "
            >${playIcon}</button>

            <button
              id="mini-next-btn"
              aria-label="Next Track"
              style="
                background: transparent;
                border: none;
                color: var(--color-text-primary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px;
                border-radius: var(--radius-full);
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              ${getIconSvg('skip-forward', { size: 20 })}
            </button>

            <button
              id="mini-repeat-btn"
              aria-label="Toggle Repeat"
              aria-pressed="${this.playbackManager.repeatMode !== 'off'}"
              style="
                background: transparent;
                border: none;
                color: ${this.playbackManager.repeatMode !== 'off' ? 'var(--color-accent-purple-glow)' : 'var(--color-text-secondary)'};
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 6px;
                border-radius: var(--radius-full);
                transition: all var(--duration-fast) var(--ease-smooth);
              "
            >
              ${getIconSvg('repeat', { size: 16 })}
            </button>
          </div>

          <!-- Scrub Bar Row -->
          <div style="display: flex; align-items: center; gap: var(--space-3); width: 100%;">
            <span
              id="mini-time-current"
              style="font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; min-width: 32px; text-align: right;"
            >
              ${this.formatTime(this.currentPositionMs)}
            </span>

            <div style="flex: 1; position: relative; display: flex; align-items: center;">
              <input
                id="mini-progress-slider"
                type="range"
                min="0"
                max="${this.currentDurationMs || 100}"
                value="${this.currentPositionMs}"
                aria-label="Track playback progress"
                aria-valuemin="0"
                aria-valuemax="${this.currentDurationMs || 100}"
                aria-valuenow="${this.currentPositionMs}"
                style="width: 100%;"
              />
            </div>

            <span
              id="mini-time-total"
              style="font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; min-width: 32px;"
            >
              ${this.formatTime(this.currentDurationMs)}
            </span>
          </div>
        </div>

        <!-- Right: Volume & Auxiliary Actions -->
        <div class="mini-aux-col">
          <!-- Volume Mute Toggle -->
          <button
            id="mini-mute-btn"
            aria-label="${this.playbackManager.isMuted ? 'Unmute' : 'Mute'}"
            aria-pressed="${this.playbackManager.isMuted ? 'true' : 'false'}"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 6px;
            "
          >
            ${getIconSvg(this.playbackManager.isMuted ? 'volume-mute' : 'volume', { size: 18 })}
          </button>

          <!-- Volume Slider -->
          <div style="width: 80px; display: flex; align-items: center;">
            <input
              id="mini-volume-slider"
              type="range"
              min="0"
              max="100"
              value="${Math.round((this.playbackManager.volume ?? 1) * 100)}"
              aria-label="Audio Volume"
              style="width: 100%;"
            />
          </div>

          <!-- Queue Toggle / View -->
          <button
            id="mini-queue-btn"
            aria-label="Toggle Queue"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 6px;
              border-radius: var(--radius-full);
            "
          >
            ${getIconSvg('playlist', { size: 18 })}
          </button>

          <!-- Fullscreen / Expand to Now Playing -->
          <button
            id="mini-expand-btn"
            aria-label="Open Now Playing"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-secondary);
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 6px;
              border-radius: var(--radius-full);
            "
          >
            ${getIconSvg('maximize', { size: 16 })}
          </button>
        </div>
      </div>
    `;

    this.updateSliderTrackFill();
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Track Info click -> Navigate to Now Playing
    this.container.querySelector('#mini-track-info')?.addEventListener('click', (e: Event) => {
      if ((e.target as HTMLElement).closest('#mini-fav-btn')) return;
      if (this.router) {
        this.router.navigate('nowplaying');
      }
    });

    // Favorite toggle
    this.container.querySelector('#mini-fav-btn')?.addEventListener('click', () => {
      this.isFavorite = !this.isFavorite;
      const favBtn = this.container?.querySelector<HTMLButtonElement>('#mini-fav-btn');
      if (favBtn) {
        favBtn.style.color = this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)';
        favBtn.innerHTML = getIconSvg(this.isFavorite ? 'heart-filled' : 'heart', { size: 18 });
      }
      if (this.currentTrack) {
        this.eventBus.publish(DomainEvents.FAVORITE_CHANGED, {
          trackId: this.currentTrack.id,
          isFavorite: this.isFavorite
        });
      }
    });

    // Play/Pause Button
    this.container.querySelector('#mini-play-btn')?.addEventListener('click', async () => {
      if (this.isPlaying) {
        await this.playbackManager.pause();
      } else {
        await this.playbackManager.resume();
      }
    });

    // Next / Prev Buttons
    this.container.querySelector('#mini-next-btn')?.addEventListener('click', async () => {
      await this.playbackManager.next();
    });

    this.container.querySelector('#mini-prev-btn')?.addEventListener('click', async () => {
      await this.playbackManager.previous();
    });

    // Shuffle Button
    this.container.querySelector('#mini-shuffle-btn')?.addEventListener('click', () => {
      const nextMode: ShuffleMode = this.playbackManager.shuffleMode === 'off' ? 'on' : 'off';
      this.playbackManager.setShuffleMode(nextMode);
      const btn = this.container?.querySelector<HTMLButtonElement>('#mini-shuffle-btn');
      if (btn) {
        const active = nextMode !== 'off';
        btn.style.color = active ? 'var(--color-accent-purple-glow)' : 'var(--color-text-secondary)';
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    });

    // Repeat Button
    this.container.querySelector('#mini-repeat-btn')?.addEventListener('click', () => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(this.playbackManager.repeatMode);
      const nextMode: RepeatMode = modes[(currentIndex + 1) % modes.length]!;
      this.playbackManager.setRepeatMode(nextMode);
      const btn = this.container?.querySelector<HTMLButtonElement>('#mini-repeat-btn');
      if (btn) {
        const active = nextMode !== 'off';
        btn.style.color = active ? 'var(--color-accent-purple-glow)' : 'var(--color-text-secondary)';
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    });

    // Progress Scrub Slider
    const progressSlider = this.container.querySelector<HTMLInputElement>('#mini-progress-slider');
    progressSlider?.addEventListener('input', () => {
      this.isSeeking = true;
      const val = Number(progressSlider.value);
      const timeCurrent = this.container?.querySelector('#mini-time-current');
      if (timeCurrent) timeCurrent.textContent = this.formatTime(val);
      this.updateSliderTrackFill();
    });

    progressSlider?.addEventListener('change', async () => {
      const val = Number(progressSlider.value);
      await this.playbackManager.seek(val);
      this.isSeeking = false;
    });

    // Mute Button
    this.container.querySelector('#mini-mute-btn')?.addEventListener('click', () => {
      const nextMuted = !this.playbackManager.isMuted;
      this.playbackManager.setMuted(nextMuted);
      const muteBtn = this.container?.querySelector('#mini-mute-btn');
      if (muteBtn) {
        muteBtn.innerHTML = getIconSvg(nextMuted ? 'volume-mute' : 'volume', { size: 18 });
      }
    });

    // Volume Slider
    const volumeSlider = this.container.querySelector<HTMLInputElement>('#mini-volume-slider');
    volumeSlider?.addEventListener('input', () => {
      const vol = Number(volumeSlider.value) / 100;
      this.playbackManager.setVolume(vol);
      if (this.playbackManager.isMuted && vol > 0) {
        this.playbackManager.setMuted(false);
      }
    });

    // Expand to Now Playing
    this.container.querySelector('#mini-expand-btn')?.addEventListener('click', () => {
      if (this.router) {
        this.router.navigate('nowplaying');
      }
    });
  }

  private subscribeToDomainEvents(): void {
    // Track Changed
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.TRACK_CHANGED, (payload: any) => {
        if (!payload) return;
        this.currentTrack = payload.currentTrack ?? null;
        this.currentPositionMs = payload.positionMs ?? 0;
        this.currentDurationMs = this.currentTrack?.durationMs ?? 0;
        this.isFavorite = this.currentTrack?.isFavorite ?? false;
        this.updateTrackInfo();
      })
    );

    // Playback State Changed
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, (payload: any) => {
        if (!payload) return;
        this.isPlaying = payload.state === 'playing';
        if (payload.positionMs !== undefined && !this.isSeeking) {
          this.currentPositionMs = payload.positionMs;
        }
        if (payload.durationMs !== undefined) {
          this.currentDurationMs = payload.durationMs;
        }
        this.updatePlayState();
      })
    );

    // Playback Progress / Time Updated
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_TIME_UPDATED, (payload: any) => {
        if (!payload || this.isSeeking) return;
        this.currentPositionMs = payload.positionMs;
        this.currentDurationMs = payload.durationMs;
        this.updateProgress();
      })
    );
  }

  private updateTrackInfo(): void {
    if (!this.container) return;
    const titleEl = this.container.querySelector('#mini-track-title');
    const artistEl = this.container.querySelector('#mini-track-artist');
    const totalEl = this.container.querySelector('#mini-time-total');
    const slider = this.container.querySelector<HTMLInputElement>('#mini-progress-slider');
    const favBtn = this.container.querySelector<HTMLButtonElement>('#mini-fav-btn');

    if (titleEl) titleEl.textContent = this.currentTrack?.title || 'No Track Selected';
    if (artistEl) artistEl.textContent = this.currentTrack?.artistName || 'Select a song to play';
    if (totalEl) totalEl.textContent = this.formatTime(this.currentDurationMs);
    if (slider) {
      slider.max = String(this.currentDurationMs || 100);
      slider.value = String(this.currentPositionMs);
    }
    if (favBtn) {
      favBtn.style.color = this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)';
      favBtn.innerHTML = getIconSvg(this.isFavorite ? 'heart-filled' : 'heart', { size: 18 });
    }

    this.updateArtwork();
    this.updateSliderTrackFill();
  }

  private updatePlayState(): void {
    if (!this.container) return;
    const playBtn = this.container.querySelector<HTMLButtonElement>('#mini-play-btn');
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
      playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause' : 'Play');
    }
  }

  private updateProgress(): void {
    if (!this.container || this.isSeeking) return;
    const currentEl = this.container.querySelector('#mini-time-current');
    const slider = this.container.querySelector<HTMLInputElement>('#mini-progress-slider');

    if (currentEl) currentEl.textContent = this.formatTime(this.currentPositionMs);
    if (slider) {
      slider.value = String(this.currentPositionMs);
      slider.setAttribute('aria-valuenow', String(this.currentPositionMs));
    }
    this.updateSliderTrackFill();
  }

  private async updateArtwork(): Promise<void> {
    if (!this.container) return;
    const artBox = this.container.querySelector<HTMLElement>('#mini-artwork-box');
    if (!artBox) return;

    if (this.currentTrack && this.artworkService) {
      try {
        const artworkId = (this.currentTrack as any).artworkId ?? this.currentTrack.id;
        const url = await this.artworkService.getArtworkUrl(artworkId);
        if (url) {
          artBox.innerHTML = `<img src="${url}" alt="${this.currentTrack.title}" style="width: 100%; height: 100%; object-fit: cover;" />`;
          return;
        }
      } catch {
        // Fallback
      }
    }
    artBox.innerHTML = getIconSvg('disc', { size: 22 });
  }

  private updateSliderTrackFill(): void {
    if (!this.container) return;
    const slider = this.container.querySelector<HTMLInputElement>('#mini-progress-slider');
    if (!slider) return;

    const max = Number(slider.max) || 100;
    const val = Number(slider.value) || 0;
    const pct = Math.min(100, Math.max(0, (val / max) * 100));

    slider.style.background = `linear-gradient(to right, var(--color-accent-purple-glow) ${pct}%, rgba(255, 255, 255, 0.15) ${pct}%)`;
  }

  private formatTime(ms: number): string {
    if (!ms || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}
