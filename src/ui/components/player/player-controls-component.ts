import type { IPlaybackManager } from '../../../services/contracts/service-contracts';
import type { RepeatMode, ShuffleMode } from '../../../domain/value-objects/audio-types';

export interface PlayerControlsCallbacks {
  onToggleFavorite: () => void;
}

export class PlayerControlsComponent {
  private container: HTMLElement | null = null;
  private readonly playbackManager: IPlaybackManager;
  private readonly callbacks: PlayerControlsCallbacks;

  private isPlaying = false;
  private isSeeking = false;
  private currentPositionMs = 0;
  private currentDurationMs = 0;
  private isFavorite = false;

  constructor(playbackManager: IPlaybackManager, callbacks: PlayerControlsCallbacks) {
    this.playbackManager = playbackManager;
    this.callbacks = callbacks;
    this.isPlaying = playbackManager.state === 'playing';
    this.currentPositionMs = playbackManager.positionMs;
    this.currentDurationMs = playbackManager.durationMs;
  }

  public mount(container: HTMLElement, isFavorite = false): void {
    this.container = container;
    this.isFavorite = isFavorite;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updatePlaybackState(isPlaying: boolean): void {
    this.isPlaying = isPlaying;
    if (!this.container) return;
    const playBtn = this.container.querySelector('#np-play-btn');
    if (playBtn) {
      playBtn.textContent = isPlaying ? '⏸' : '▶';
      playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    }
  }

  public updateTime(positionMs: number, durationMs: number): void {
    this.currentPositionMs = positionMs;
    this.currentDurationMs = durationMs;

    if (!this.container || this.isSeeking) return;

    const timeCur = this.container.querySelector('#np-time-current');
    const timeDur = this.container.querySelector('#np-time-duration');
    const slider = this.container.querySelector<HTMLInputElement>('#np-progress-slider');

    if (timeCur) timeCur.textContent = this.formatTime(positionMs);
    if (timeDur) timeDur.textContent = this.formatTime(durationMs);
    if (slider) {
      slider.max = String(durationMs || 100);
      slider.value = String(positionMs);
      slider.setAttribute('aria-valuenow', String(positionMs));
      slider.setAttribute('aria-valuemax', String(durationMs || 100));
    }
  }

  public updateModes(repeatMode: RepeatMode, shuffleMode: ShuffleMode): void {
    if (!this.container) return;

    const shuffleBtn = this.container.querySelector<HTMLButtonElement>('#np-shuffle-btn');
    const repeatBtn = this.container.querySelector<HTMLButtonElement>('#np-repeat-btn');

    if (shuffleBtn) {
      shuffleBtn.style.color = shuffleMode === 'on' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
      shuffleBtn.setAttribute('aria-label', `Toggle Shuffle (Currently ${shuffleMode})`);
    }

    if (repeatBtn) {
      repeatBtn.style.color = repeatMode !== 'off' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
      repeatBtn.textContent = repeatMode === 'one' ? '🔂' : '🔁';
      repeatBtn.setAttribute('aria-label', `Cycle Repeat Mode (Currently ${repeatMode})`);
    }
  }

  public updateFavorite(isFavorite: boolean): void {
    this.isFavorite = isFavorite;
    if (!this.container) return;
    const favBtn = this.container.querySelector<HTMLButtonElement>('#np-fav-btn');
    if (favBtn) {
      favBtn.textContent = isFavorite ? '★' : '☆';
      favBtn.style.color = isFavorite ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
      favBtn.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    }
  }

  public updateVolume(): void {
    if (!this.container) return;
    const muteBtn = this.container.querySelector<HTMLButtonElement>('#np-mute-btn');
    const volSlider = this.container.querySelector<HTMLInputElement>('#np-volume-slider');

    if (muteBtn) {
      muteBtn.textContent = this.playbackManager.isMuted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', this.playbackManager.isMuted ? 'Unmute' : 'Mute');
    }
    if (volSlider) {
      volSlider.value = String(this.playbackManager.volume);
    }
  }

  private render(): void {
    if (!this.container) return;

    const playIcon = this.isPlaying ? '⏸' : '▶';
    const shuffleColor = this.playbackManager.shuffleMode === 'on' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
    const repeatColor = this.playbackManager.repeatMode !== 'off' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
    const repeatIcon = this.playbackManager.repeatMode === 'one' ? '🔂' : '🔁';
    const favColor = this.isFavorite ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';

    this.container.innerHTML = `
      <div class="player-controls-container" style="display: flex; flex-direction: column; gap: var(--space-4); width: 100%;">
        <!-- Scrubber Progress Bar -->
        <div style="display: flex; flex-direction: column; gap: var(--space-1);">
          <div style="display: flex; align-items: center; gap: var(--space-3); width: 100%;">
            <span id="np-time-current" style="font-size: 12px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; width: 40px; text-align: right;">
              ${this.formatTime(this.currentPositionMs)}
            </span>
            <input
              id="np-progress-slider"
              type="range"
              min="0"
              max="${this.currentDurationMs || 100}"
              value="${this.currentPositionMs}"
              role="slider"
              aria-label="Playback progress scrubber"
              aria-valuenow="${this.currentPositionMs}"
              aria-valuemin="0"
              aria-valuemax="${this.currentDurationMs || 100}"
              style="flex: 1; height: 6px; accent-color: var(--color-accent-primary); cursor: pointer;"
            />
            <span id="np-time-duration" style="font-size: 12px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; width: 40px;">
              ${this.formatTime(this.currentDurationMs)}
            </span>
          </div>
        </div>

        <!-- Primary Playback Controls -->
        <div style="display: flex; align-items: center; justify-content: center; gap: var(--space-6);">
          <button
            id="np-shuffle-btn"
            aria-label="Toggle Shuffle"
            style="background: transparent; border: none; font-size: 18px; cursor: pointer; color: ${shuffleColor}; transition: transform 0.1s;"
          >🔀</button>

          <button
            id="np-prev-btn"
            aria-label="Previous Track"
            style="background: transparent; border: none; color: var(--color-text-primary); font-size: 22px; cursor: pointer; transition: transform 0.1s;"
          >⏮</button>

          <button
            id="np-play-btn"
            aria-label="${this.isPlaying ? 'Pause' : 'Play'}"
            style="
              width: 56px;
              height: 56px;
              border-radius: var(--radius-full);
              background: var(--color-accent-gradient);
              border: none;
              color: #ffffff;
              font-size: 22px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: var(--shadow-glow);
              transition: transform 0.15s ease;
            "
          >${playIcon}</button>

          <button
            id="np-next-btn"
            aria-label="Next Track"
            style="background: transparent; border: none; color: var(--color-text-primary); font-size: 22px; cursor: pointer; transition: transform 0.1s;"
          >⏭</button>

          <button
            id="np-repeat-btn"
            aria-label="Cycle Repeat Mode"
            style="background: transparent; border: none; font-size: 18px; cursor: pointer; color: ${repeatColor}; transition: transform 0.1s;"
          >${repeatIcon}</button>
        </div>

        <!-- Secondary Controls: Volume & Favorite -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: var(--space-2); padding: 0 var(--space-4);">
          <button
            id="np-fav-btn"
            aria-label="${this.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
            style="background: transparent; border: none; font-size: 20px; cursor: pointer; color: ${favColor};"
          >
            ${this.isFavorite ? '★' : '☆'}
          </button>

          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <button
              id="np-mute-btn"
              aria-label="Toggle Mute"
              style="background: transparent; border: none; font-size: 16px; cursor: pointer; color: var(--color-text-secondary);"
            >
              ${this.playbackManager.isMuted ? '🔇' : '🔊'}
            </button>
            <input
              id="np-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="${this.playbackManager.volume}"
              aria-label="Volume level"
              style="width: 100px; height: 4px; accent-color: var(--color-accent-primary); cursor: pointer;"
            />
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    const playBtn = this.container.querySelector('#np-play-btn');
    playBtn?.addEventListener('click', () => {
      if (this.isPlaying) {
        void this.playbackManager.pause();
      } else {
        void this.playbackManager.resume();
      }
    });

    const prevBtn = this.container.querySelector('#np-prev-btn');
    prevBtn?.addEventListener('click', () => void this.playbackManager.previous());

    const nextBtn = this.container.querySelector('#np-next-btn');
    nextBtn?.addEventListener('click', () => void this.playbackManager.next());

    const shuffleBtn = this.container.querySelector('#np-shuffle-btn');
    shuffleBtn?.addEventListener('click', () => {
      const next = this.playbackManager.shuffleMode === 'on' ? 'off' : 'on';
      this.playbackManager.setShuffleMode(next);
    });

    const repeatBtn = this.container.querySelector('#np-repeat-btn');
    repeatBtn?.addEventListener('click', () => {
      const cur = this.playbackManager.repeatMode;
      const next = cur === 'off' ? 'all' : cur === 'all' ? 'one' : 'off';
      this.playbackManager.setRepeatMode(next);
    });

    const favBtn = this.container.querySelector('#np-fav-btn');
    favBtn?.addEventListener('click', () => {
      this.callbacks.onToggleFavorite();
    });

    const muteBtn = this.container.querySelector('#np-mute-btn');
    muteBtn?.addEventListener('click', () => {
      this.playbackManager.setMuted(!this.playbackManager.isMuted);
      this.updateVolume();
    });

    const volumeSlider = this.container.querySelector<HTMLInputElement>('#np-volume-slider');
    volumeSlider?.addEventListener('input', () => {
      const vol = parseFloat(volumeSlider.value);
      this.playbackManager.setVolume(vol);
      this.updateVolume();
    });

    const progressSlider = this.container.querySelector<HTMLInputElement>('#np-progress-slider');
    progressSlider?.addEventListener('mousedown', () => {
      this.isSeeking = true;
    });
    progressSlider?.addEventListener('input', () => {
      const val = parseInt(progressSlider.value, 10);
      const timeCur = this.container?.querySelector('#np-time-current');
      if (timeCur) timeCur.textContent = this.formatTime(val);
    });
    progressSlider?.addEventListener('change', () => {
      this.isSeeking = false;
      const pos = parseInt(progressSlider.value, 10);
      void this.playbackManager.seek(pos);
    });
  }

  private formatTime(ms: number): string {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
