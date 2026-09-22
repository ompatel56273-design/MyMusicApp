import type { IPlaybackManager, IArtworkService } from '../../services/contracts/service-contracts';
import type { RouterService } from '../navigation/router-service';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { Disposable } from '../../core/types/common';
import type { Track } from '../../domain/entities/models';

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
          z-index: 20;
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
            padding: 0 10px;
            gap: 6px;
          }

          .mini-info-col {
            width: auto;
            flex: 1;
            gap: 8px;
          }

          #mini-artwork-box {
            width: 40px !important;
            height: 40px !important;
          }

          #mini-track-title {
            font-size: 13px !important;
            max-width: 130px;
          }

          #mini-track-artist {
            font-size: 11px !important;
            max-width: 130px;
          }

          .mini-controls-col {
            max-width: none;
            flex: 0 0 auto;
          }

          .mini-controls-col > div:last-child {
            display: none !important; /* Hide progress bar text row on mobile */
          }

          #mini-shuffle-btn, #mini-repeat-btn {
            display: none !important;
          }

          #mini-prev-btn, #mini-next-btn {
            min-width: 36px !important;
            min-height: 36px !important;
            font-size: 15px !important;
          }

          #mini-play-btn {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            min-height: 40px !important;
            font-size: 14px !important;
          }

          .mini-aux-col {
            display: none !important;
          }
        }
      </style>

      <footer
        id="app-mini-player"
        class="glass-panel-elevated mini-player-bar"
        role="region"
        aria-label="Now Playing Mini Player"
      >
        <!-- Left: Track Info & Artwork -->
        <div id="mini-track-info" class="mini-info-col">
          <div
            id="mini-artwork-box"
            style="
              width: 52px;
              height: 52px;
              border-radius: var(--radius-md);
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              flex-shrink: 0;
              box-shadow: var(--shadow-sm);
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            <span style="font-size: 22px; color: var(--color-text-muted);" aria-hidden="true">♫</span>
          </div>

          <div style="display: flex; flex-direction: column; overflow: hidden; gap: 2px; min-width: 0;">
            <span id="mini-track-title" title="${title}" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-primary); letter-spacing: -0.01em;">
              ${title}
            </span>
            <span id="mini-track-artist" title="${artist}" style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${artist}
            </span>
          </div>

          <!-- Heart / Favorite Button -->
          <button
            id="mini-fav-btn"
            aria-label="${this.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
            aria-pressed="${this.isFavorite}"
            style="
              background: transparent;
              border: none;
              color: ${this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)'};
              font-size: 16px;
              cursor: pointer;
              min-width: 44px;
              min-height: 44px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              transition: transform var(--duration-fast) var(--ease-spring);
              flex-shrink: 0;
            "
          >
            ${this.isFavorite ? '♥' : '♡'}
          </button>
        </div>

        <!-- Center: Controls & Timeline -->
        <div class="mini-controls-col">
          <!-- Controls Row -->
          <div style="display: flex; align-items: center; gap: var(--space-3);">
            <button
              id="mini-shuffle-btn"
              aria-label="Toggle Shuffle"
              aria-pressed="${this.playbackManager.shuffleMode === 'on'}"
              style="
                background: transparent;
                border: none;
                color: ${this.playbackManager.shuffleMode === 'on' ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)'};
                font-size: 14px;
                cursor: pointer;
                min-width: 44px;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: color var(--duration-fast) var(--ease-smooth);
              "
            ><span aria-hidden="true">🔀</span></button>

            <button
              id="mini-prev-btn"
              aria-label="Previous Track"
              style="
                background: transparent;
                border: none;
                color: var(--color-text-primary);
                font-size: 18px;
                cursor: pointer;
                min-width: 44px;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: transform var(--duration-fast) var(--ease-smooth);
              "
            ><span aria-hidden="true">⏮</span></button>

            <!-- Large Play / Pause Glowing Button -->
            <button
              id="mini-play-btn"
              aria-label="${this.isPlaying ? 'Pause track' : 'Play track'}"
              aria-pressed="${this.isPlaying}"
              style="
                width: 46px;
                height: 46px;
                min-width: 46px;
                min-height: 46px;
                border-radius: var(--radius-full);
                background: var(--gradient-primary);
                border: none;
                color: #ffffff;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-shadow: var(--shadow-glow-purple);
                transition: transform var(--duration-fast) var(--ease-spring);
              "
            ><span aria-hidden="true">${playIcon}</span></button>

            <button
              id="mini-next-btn"
              aria-label="Next Track"
              style="
                background: transparent;
                border: none;
                color: var(--color-text-primary);
                font-size: 18px;
                cursor: pointer;
                min-width: 44px;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: transform var(--duration-fast) var(--ease-smooth);
              "
            ><span aria-hidden="true">⏭</span></button>

            <button
              id="mini-repeat-btn"
              aria-label="Cycle Repeat Mode"
              aria-pressed="${this.playbackManager.repeatMode !== 'off'}"
              style="
                background: transparent;
                border: none;
                color: ${this.playbackManager.repeatMode !== 'off' ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)'};
                font-size: 14px;
                cursor: pointer;
                min-width: 44px;
                min-height: 44px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: color var(--duration-fast) var(--ease-smooth);
              "
            ><span aria-hidden="true">${this.playbackManager.repeatMode === 'one' ? '🔂' : '🔁'}</span></button>
          </div>

          <!-- Timeline Row -->
          <div style="display: flex; align-items: center; gap: var(--space-3); width: 100%;">
            <span id="mini-time-current" style="font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; width: 35px; text-align: right; font-weight: 500;">
              ${this.formatTime(this.currentPositionMs)}
            </span>
            <input
              id="mini-progress-slider"
              type="range"
              min="0"
              max="${this.currentDurationMs || 100}"
              value="${this.currentPositionMs}"
              aria-label="Playback Progress"
              style="flex: 1; height: 4px; accent-color: var(--color-accent-purple-glow); cursor: pointer;"
            />
            <span id="mini-time-duration" style="font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; width: 35px; font-weight: 500;">
              ${this.formatTime(this.currentDurationMs)}
            </span>
          </div>
        </div>

        <!-- Right: Volume & Auxiliary Actions -->
        <div class="mini-aux-col">
          <!-- Volume Group -->
          <button
            id="mini-mute-btn"
            aria-label="${this.playbackManager.isMuted ? 'Unmute' : 'Mute'}"
            aria-pressed="${this.playbackManager.isMuted}"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-secondary);
              font-size: 16px;
              cursor: pointer;
              min-width: 44px;
              min-height: 44px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            "
          >
            <span aria-hidden="true">${this.playbackManager.isMuted ? '🔇' : '🔊'}</span>
          </button>
          <input
            id="mini-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="${this.playbackManager.volume}"
            aria-label="Volume"
            style="width: 80px; height: 4px; accent-color: var(--color-accent-purple-glow); cursor: pointer;"
          />

          <!-- Queue Toggle Button -->
          <button
            id="mini-queue-btn"
            aria-label="View Queue"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-secondary);
              font-size: 15px;
              cursor: pointer;
              min-width: 44px;
              min-height: 44px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            "
          >
            <span aria-hidden="true">📑</span>
          </button>

          <!-- Fullscreen / Expand Now Playing -->
          <button
            id="mini-fullscreen-btn"
            aria-label="Expand Now Playing"
            style="
              background: transparent;
              border: none;
              color: var(--color-text-secondary);
              font-size: 15px;
              cursor: pointer;
              min-width: 44px;
              min-height: 44px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            "
          >
            <span aria-hidden="true">⛶</span>
          </button>
        </div>
      </footer>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    const trackInfo = this.container.querySelector('#mini-track-info');
    trackInfo?.addEventListener('click', (e: Event) => {
      // Don't trigger if clicked on favorite button
      if ((e.target as HTMLElement).closest('#mini-fav-btn')) return;
      if (this.router) {
        this.router.navigate('nowplaying');
      }
    });

    const favBtn = this.container.querySelector<HTMLButtonElement>('#mini-fav-btn');
    favBtn?.addEventListener('click', () => {
      this.isFavorite = !this.isFavorite;
      if (favBtn) {
        favBtn.textContent = this.isFavorite ? '♥' : '♡';
        favBtn.style.color = this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)';
        favBtn.setAttribute('aria-pressed', String(this.isFavorite));
      }
    });

    const playBtn = this.container.querySelector('#mini-play-btn');
    playBtn?.addEventListener('click', () => {
      if (this.isPlaying) {
        void this.playbackManager.pause();
      } else {
        void this.playbackManager.resume();
      }
    });

    const prevBtn = this.container.querySelector('#mini-prev-btn');
    prevBtn?.addEventListener('click', () => void this.playbackManager.previous());

    const nextBtn = this.container.querySelector('#mini-next-btn');
    nextBtn?.addEventListener('click', () => void this.playbackManager.next());

    const shuffleBtn = this.container.querySelector('#mini-shuffle-btn');
    shuffleBtn?.addEventListener('click', () => {
      const next = this.playbackManager.shuffleMode === 'on' ? 'off' : 'on';
      this.playbackManager.setShuffleMode(next);
    });

    const repeatBtn = this.container.querySelector('#mini-repeat-btn');
    repeatBtn?.addEventListener('click', () => {
      const cur = this.playbackManager.repeatMode;
      const next = cur === 'off' ? 'all' : cur === 'all' ? 'one' : 'off';
      this.playbackManager.setRepeatMode(next);
    });

    const muteBtn = this.container.querySelector('#mini-mute-btn');
    muteBtn?.addEventListener('click', () => {
      this.playbackManager.setMuted(!this.playbackManager.isMuted);
    });

    const volumeSlider = this.container.querySelector<HTMLInputElement>('#mini-volume-slider');
    volumeSlider?.addEventListener('input', () => {
      const vol = parseFloat(volumeSlider.value);
      this.playbackManager.setVolume(vol);
    });

    const progressSlider = this.container.querySelector<HTMLInputElement>('#mini-progress-slider');
    progressSlider?.addEventListener('mousedown', () => {
      this.isSeeking = true;
    });
    progressSlider?.addEventListener('change', () => {
      this.isSeeking = false;
      const pos = parseInt(progressSlider.value, 10);
      void this.playbackManager.seek(pos);
    });

    // Queue button -> navigate to nowplaying
    this.container.querySelector('#mini-queue-btn')?.addEventListener('click', () => {
      this.router?.navigate('nowplaying');
    });

    // Fullscreen button -> navigate to nowplaying
    this.container.querySelector('#mini-fullscreen-btn')?.addEventListener('click', () => {
      this.router?.navigate('nowplaying');
    });
  }

  private subscribeToDomainEvents(): void {
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.TRACK_CHANGED, (e: any) => {
        this.currentTrack = e.currentTrack;
        this.isFavorite = this.currentTrack?.isFavorite ?? false;
        this.updateTrackInfo();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, (e: any) => {
        this.isPlaying = e.state === 'playing';
        this.updatePlayState();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_TIME_UPDATED, (e: any) => {
        this.currentPositionMs = e.positionMs;
        this.currentDurationMs = e.durationMs;
        this.updateTimeProgress();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_MODES_CHANGED, () => {
        this.updateModes();
      })
    );
  }

  private async updateTrackInfo(): Promise<void> {
    if (!this.container) return;
    const titleEl = this.container.querySelector('#mini-track-title');
    const artistEl = this.container.querySelector('#mini-track-artist');
    const artworkBox = this.container.querySelector('#mini-artwork-box');
    const favBtn = this.container.querySelector<HTMLButtonElement>('#mini-fav-btn');

    if (titleEl) titleEl.textContent = this.currentTrack?.title || 'No Track Selected';
    if (artistEl) artistEl.textContent = this.currentTrack?.artistName || 'Select a song to play';

    if (favBtn) {
      favBtn.textContent = this.isFavorite ? '♥' : '♡';
      favBtn.style.color = this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)';
      favBtn.setAttribute('aria-pressed', String(this.isFavorite));
    }

    if (artworkBox) {
      const artId = (this.currentTrack as any)?.artworkId || this.currentTrack?.albumId;
      if (this.artworkService && artId) {
        const url = await this.artworkService.getArtworkUrl(artId, 'small');
        if (url) {
          artworkBox.innerHTML = `<img src="${url}" alt="Album Artwork" style="width: 100%; height: 100%; object-fit: cover;" />`;
          return;
        }
      }
      artworkBox.innerHTML = `<span style="font-size: 22px; color: var(--color-text-muted);">♫</span>`;
    }
  }

  private updatePlayState(): void {
    if (!this.container) return;
    const playBtn = this.container.querySelector('#mini-play-btn');
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
      playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause track' : 'Play track');
      playBtn.setAttribute('aria-pressed', String(this.isPlaying));
    }
  }

  private updateTimeProgress(): void {
    if (!this.container || this.isSeeking) return;
    const timeCur = this.container.querySelector('#mini-time-current');
    const timeDur = this.container.querySelector('#mini-time-duration');
    const slider = this.container.querySelector<HTMLInputElement>('#mini-progress-slider');

    if (timeCur) timeCur.textContent = this.formatTime(this.currentPositionMs);
    if (timeDur) timeDur.textContent = this.formatTime(this.currentDurationMs);
    if (slider) {
      slider.max = String(this.currentDurationMs || 100);
      slider.value = String(this.currentPositionMs);
    }
  }

  private updateModes(): void {
    if (!this.container) return;
    const shuffleBtn = this.container.querySelector<HTMLButtonElement>('#mini-shuffle-btn');
    const repeatBtn = this.container.querySelector<HTMLButtonElement>('#mini-repeat-btn');

    if (shuffleBtn) {
      shuffleBtn.style.color = this.playbackManager.shuffleMode === 'on' ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)';
      shuffleBtn.setAttribute('aria-pressed', String(this.playbackManager.shuffleMode === 'on'));
    }
    if (repeatBtn) {
      repeatBtn.style.color = this.playbackManager.repeatMode !== 'off' ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)';
      repeatBtn.textContent = this.playbackManager.repeatMode === 'one' ? '🔂' : '🔁';
      repeatBtn.setAttribute('aria-pressed', String(this.playbackManager.repeatMode !== 'off'));
    }
  }

  private formatTime(ms: number): string {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}

