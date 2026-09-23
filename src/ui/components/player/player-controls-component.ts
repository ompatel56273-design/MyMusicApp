import type { IPlaybackManager } from '../../../services/contracts/service-contracts';
import type { RepeatMode, ShuffleMode } from '../../../domain/value-objects/audio-types';
import { getIconSvg } from '../../icons/icon-registry';

export interface PlayerControlsCallbacks {
  onToggleFavorite: () => void;
}

/**
 * Phase 8 Player Controls Component (Templates 6 & 7).
 * Features:
 * - High-fidelity playback controls with neon glow
 * - Accurate seek bar with hover thumb and smooth position updates
 * - Volume slider with instant mute toggle
 * - Lucide icons for play, pause, next, previous, shuffle, repeat, and favorite
 */
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
      playBtn.innerHTML = getIconSvg(isPlaying ? 'pause' : 'play', { size: 22, color: '#ffffff' });
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
      const active = shuffleMode === 'on';
      shuffleBtn.style.color = active ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)';
      shuffleBtn.innerHTML = getIconSvg('shuffle', { size: 18, color: active ? 'var(--color-accent-cyan)' : 'currentColor' });
      shuffleBtn.setAttribute('aria-label', `Toggle Shuffle (Currently ${shuffleMode})`);
    }

    if (repeatBtn) {
      const active = repeatMode !== 'off';
      repeatBtn.style.color = active ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)';
      repeatBtn.innerHTML = getIconSvg('repeat', { size: 18, color: active ? 'var(--color-accent-purple-glow)' : 'currentColor' });
      repeatBtn.setAttribute('aria-label', `Cycle Repeat Mode (Currently ${repeatMode})`);
    }
  }

  public updateFavorite(isFavorite: boolean): void {
    this.isFavorite = isFavorite;
    if (!this.container) return;
    const favBtn = this.container.querySelector<HTMLButtonElement>('#np-fav-btn');
    if (favBtn) {
      favBtn.innerHTML = getIconSvg(isFavorite ? 'heart-filled' : 'heart', {
        size: 20,
        color: isFavorite ? 'var(--color-accent-pink)' : 'currentColor'
      });
      favBtn.style.color = isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)';
      favBtn.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    }
  }

  public updateVolume(): void {
    if (!this.container) return;
    const muteBtn = this.container.querySelector<HTMLButtonElement>('#np-mute-btn');
    const volSlider = this.container.querySelector<HTMLInputElement>('#np-volume-slider');

    if (muteBtn) {
      const isMuted = this.playbackManager.isMuted;
      muteBtn.innerHTML = getIconSvg(isMuted ? 'volume-mute' : 'volume', { size: 18 });
      muteBtn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
    }
    if (volSlider) {
      volSlider.value = String(this.playbackManager.volume);
    }
  }

  private render(): void {
    if (!this.container) return;

    const playIconSvg = getIconSvg(this.isPlaying ? 'pause' : 'play', { size: 22, color: '#ffffff' });
    const isShuffle = this.playbackManager.shuffleMode === 'on';
    const isRepeat = this.playbackManager.repeatMode !== 'off';

    this.container.innerHTML = `
      <div
        class="player-controls-container"
        style="
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          width: 100%;
          max-width: 580px;
          margin: 0 auto;
          box-sizing: border-box;
        "
      >
        <!-- 1. Seek / Progress Bar -->
        <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
          <div style="position: relative; width: 100%; display: flex; align-items: center;">
            <input
              id="np-progress-slider"
              type="range"
              min="0"
              max="${this.currentDurationMs || 100}"
              value="${this.currentPositionMs}"
              aria-label="Track Progress"
              aria-valuemin="0"
              aria-valuemax="${this.currentDurationMs || 100}"
              aria-valuenow="${this.currentPositionMs}"
              style="
                width: 100%;
                height: 6px;
                border-radius: var(--radius-full);
                background: rgba(255, 255, 255, 0.1);
                outline: none;
                cursor: pointer;
                accent-color: var(--color-accent-purple);
                transition: height var(--duration-fast);
              "
            />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums;">
            <span id="np-time-current">${this.formatTime(this.currentPositionMs)}</span>
            <span id="np-time-duration">${this.formatTime(this.currentDurationMs)}</span>
          </div>
        </div>

        <!-- 2. Main Playback Control Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <!-- Shuffle Button -->
          <button
            id="np-shuffle-btn"
            aria-label="Toggle Shuffle (Currently ${this.playbackManager.shuffleMode})"
            title="Shuffle"
            style="
              background: transparent;
              border: none;
              color: ${isShuffle ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)'};
              cursor: pointer;
              padding: 8px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 44px;
              min-height: 44px;
              transition: all var(--duration-fast);
            "
          >
            ${getIconSvg('shuffle', { size: 18, color: isShuffle ? 'var(--color-accent-cyan)' : 'currentColor' })}
          </button>

          <!-- Previous Button -->
          <button
            id="np-prev-btn"
            aria-label="Previous Track"
            title="Previous"
            style="
              background: var(--glass-bg-subtle);
              border: 1px solid var(--glass-border);
              color: var(--color-text-primary);
              cursor: pointer;
              padding: 8px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 44px;
              min-height: 44px;
              transition: all var(--duration-fast);
            "
          >
            ${getIconSvg('skip-back', { size: 20 })}
          </button>

          <!-- Large Play / Pause Button -->
          <button
            id="np-play-btn"
            aria-label="${this.isPlaying ? 'Pause' : 'Play'}"
            title="${this.isPlaying ? 'Pause' : 'Play'}"
            style="
              width: 58px;
              height: 58px;
              border-radius: 50%;
              background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%);
              border: 1px solid var(--glass-border-interactive);
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              box-shadow: 0 4px 20px rgba(124, 58, 237, 0.55);
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            ${playIconSvg}
          </button>

          <!-- Next Button -->
          <button
            id="np-next-btn"
            aria-label="Next Track"
            title="Next"
            style="
              background: var(--glass-bg-subtle);
              border: 1px solid var(--glass-border);
              color: var(--color-text-primary);
              cursor: pointer;
              padding: 8px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 44px;
              min-height: 44px;
              transition: all var(--duration-fast);
            "
          >
            ${getIconSvg('skip-forward', { size: 20 })}
          </button>

          <!-- Repeat Button -->
          <button
            id="np-repeat-btn"
            aria-label="Cycle Repeat Mode (Currently ${this.playbackManager.repeatMode})"
            title="Repeat"
            style="
              background: transparent;
              border: none;
              color: ${isRepeat ? 'var(--color-accent-purple-glow)' : 'var(--color-text-muted)'};
              cursor: pointer;
              padding: 8px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 44px;
              min-height: 44px;
              transition: all var(--duration-fast);
            "
          >
            ${getIconSvg('repeat', { size: 18, color: isRepeat ? 'var(--color-accent-purple-glow)' : 'currentColor' })}
          </button>
        </div>

        <!-- 3. Bottom Utility Bar: Favorite + Volume -->
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-top: 1px solid var(--glass-border); padding-top: var(--space-3);">
          <!-- Favorite Heart Button -->
          <button
            id="np-fav-btn"
            aria-label="${this.isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
            title="Favorite"
            style="
              background: transparent;
              border: none;
              color: ${this.isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)'};
              cursor: pointer;
              padding: 6px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              min-width: 44px;
              min-height: 44px;
              transition: all var(--duration-fast);
            "
          >
            ${getIconSvg(this.isFavorite ? 'heart-filled' : 'heart', {
              size: 20,
              color: this.isFavorite ? 'var(--color-accent-pink)' : 'currentColor'
            })}
          </button>

          <!-- Volume Controls -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <button
              id="np-mute-btn"
              aria-label="${this.playbackManager.isMuted ? 'Unmute' : 'Mute'}"
              title="Mute / Unmute"
              style="
                background: transparent;
                border: none;
                color: var(--color-text-muted);
                cursor: pointer;
                padding: 6px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 44px;
                min-height: 44px;
              "
            >
              ${getIconSvg(this.playbackManager.isMuted ? 'volume-mute' : 'volume', { size: 18 })}
            </button>
            <input
              id="np-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="${this.playbackManager.volume}"
              aria-label="Volume Slider"
              style="
                width: 100px;
                height: 4px;
                border-radius: var(--radius-full);
                background: rgba(255, 255, 255, 0.15);
                outline: none;
                cursor: pointer;
                accent-color: var(--color-accent-cyan);
              "
            />
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Play / Pause
    const playBtn = this.container.querySelector<HTMLButtonElement>('#np-play-btn');
    playBtn?.addEventListener('click', () => {
      if (this.isPlaying) {
        void this.playbackManager.pause();
      } else {
        void this.playbackManager.resume();
      }
    });

    // Next
    const nextBtn = this.container.querySelector<HTMLButtonElement>('#np-next-btn');
    nextBtn?.addEventListener('click', () => {
      void this.playbackManager.next();
    });

    // Previous
    const prevBtn = this.container.querySelector<HTMLButtonElement>('#np-prev-btn');
    prevBtn?.addEventListener('click', () => {
      void this.playbackManager.previous();
    });

    // Shuffle
    const shuffleBtn = this.container.querySelector<HTMLButtonElement>('#np-shuffle-btn');
    shuffleBtn?.addEventListener('click', () => {
      const nextMode: ShuffleMode = this.playbackManager.shuffleMode === 'on' ? 'off' : 'on';
      this.playbackManager.setShuffleMode(nextMode);
      this.updateModes(this.playbackManager.repeatMode, nextMode);
    });

    // Repeat
    const repeatBtn = this.container.querySelector<HTMLButtonElement>('#np-repeat-btn');
    repeatBtn?.addEventListener('click', () => {
      let nextMode: RepeatMode = 'off';
      if (this.playbackManager.repeatMode === 'off') nextMode = 'all';
      else if (this.playbackManager.repeatMode === 'all') nextMode = 'one';
      this.playbackManager.setRepeatMode(nextMode);
      this.updateModes(nextMode, this.playbackManager.shuffleMode);
    });

    // Favorite
    const favBtn = this.container.querySelector<HTMLButtonElement>('#np-fav-btn');
    favBtn?.addEventListener('click', () => {
      this.callbacks.onToggleFavorite();
    });

    // Progress Slider Seeking
    const progressSlider = this.container.querySelector<HTMLInputElement>('#np-progress-slider');
    progressSlider?.addEventListener('input', () => {
      this.isSeeking = true;
      const targetMs = Number(progressSlider.value);
      const timeCur = this.container?.querySelector('#np-time-current');
      if (timeCur) timeCur.textContent = this.formatTime(targetMs);
    });

    progressSlider?.addEventListener('change', () => {
      const targetMs = Number(progressSlider.value);
      this.isSeeking = false;
      void this.playbackManager.seek(targetMs);
    });

    // Volume Slider & Mute
    const volSlider = this.container.querySelector<HTMLInputElement>('#np-volume-slider');
    volSlider?.addEventListener('input', () => {
      const val = Number(volSlider.value);
      this.playbackManager.setVolume(val);
      if (this.playbackManager.isMuted && val > 0) {
        this.playbackManager.setMuted(false);
      }
      this.updateVolume();
    });

    const muteBtn = this.container.querySelector<HTMLButtonElement>('#np-mute-btn');
    muteBtn?.addEventListener('click', () => {
      const nextMute = !this.playbackManager.isMuted;
      this.playbackManager.setMuted(nextMute);
      this.updateVolume();
    });
  }

  private formatTime(ms: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
