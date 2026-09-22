import type { IPlaybackManager } from '../../services/contracts/service-contracts';
import type { RouterService } from '../navigation/router-service';

export interface KeyboardManagerOptions {
  playbackManager: IPlaybackManager;
  router: RouterService;
}

/**
 * Global Keyboard Shortcuts Manager.
 * Safely ignores shortcuts when typing inside editable inputs or textareas.
 */
export class KeyboardManager {
  private readonly playbackManager: IPlaybackManager;
  private readonly router: RouterService;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: KeyboardManagerOptions) {
    this.playbackManager = options.playbackManager;
    this.router = options.router;
  }

  public init(): void {
    if (this.keydownHandler || typeof window === 'undefined') return;

    this.keydownHandler = (e: KeyboardEvent) => {
      this.handleKeyDown(e);
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  public handleKeyDown(e: KeyboardEvent): void {
    // 1. Check if user is typing inside an editable field
    const target = e.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      const isContentEditable = target.isContentEditable || target.getAttribute('contenteditable') === 'true';

      if (isInput || isContentEditable) {
        // Only allow Escape to blur
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }
    }

    // 2. Process Global Shortcuts
    switch (e.code) {
      case 'Space': {
        e.preventDefault();
        if (this.playbackManager.state === 'playing') {
          void this.playbackManager.pause();
        } else {
          void this.playbackManager.resume();
        }
        break;
      }

      case 'ArrowLeft': {
        e.preventDefault();
        const currentMs = this.playbackManager.positionMs;
        void this.playbackManager.seek(Math.max(0, currentMs - 5000));
        break;
      }

      case 'ArrowRight': {
        e.preventDefault();
        const currentMs = this.playbackManager.positionMs;
        const durMs = this.playbackManager.durationMs;
        void this.playbackManager.seek(Math.min(durMs || Infinity, currentMs + 5000));
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        const curVol = this.playbackManager.volume;
        this.playbackManager.setVolume(Math.round(Math.min(1.0, curVol + 0.05) * 100) / 100);
        break;
      }

      case 'ArrowDown': {
        e.preventDefault();
        const curVol = this.playbackManager.volume;
        this.playbackManager.setVolume(Math.round(Math.max(0.0, curVol - 0.05) * 100) / 100);
        break;
      }

      case 'KeyM': {
        e.preventDefault();
        this.playbackManager.setMuted(!this.playbackManager.isMuted);
        break;
      }

      case 'KeyS': {
        e.preventDefault();
        const nextMode = this.playbackManager.shuffleMode === 'on' ? 'off' : 'on';
        this.playbackManager.setShuffleMode(nextMode);
        break;
      }

      case 'KeyR': {
        e.preventDefault();
        const curMode = this.playbackManager.repeatMode;
        const nextMode = curMode === 'off' ? 'all' : curMode === 'all' ? 'one' : 'off';
        this.playbackManager.setRepeatMode(nextMode);
        break;
      }

      case 'Slash': {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('#global-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        } else {
          this.router.navigate('search');
        }
        break;
      }
    }
  }

  public dispose(): void {
    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }
}
