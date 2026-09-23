import type { SleepTimerService } from '../../../services/playback/sleep-timer-service';
import type { EventBus } from '../../../core/events/event-bus';
import { DomainEvents } from '../../../domain/events/domain-events';
import type { Disposable } from '../../../core/types/common';
import { getIconSvg } from '../../icons/icon-registry';

export interface SleepTimerModalOptions {
  sleepTimerService: SleepTimerService;
  eventBus: EventBus;
  onClose?: () => void;
}

/**
 * Sleep Timer Modal Component.
 * Provides quick preset duration selection, custom minute inputs,
 * real-time active countdown display, and cancellation / extension actions.
 */
export class SleepTimerModalComponent {
  private static activeInstance: HTMLElement | null = null;

  public static show(options: SleepTimerModalOptions): HTMLElement {
    // If an existing modal is open, remove it
    if (this.activeInstance) {
      this.close();
    }

    const { sleepTimerService, eventBus, onClose } = options;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay sleep-timer-modal-overlay';
    overlay.id = 'sleep-timer-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '1000';
    overlay.style.padding = 'var(--space-4)';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'sleep-timer-modal-title');

    const modal = document.createElement('div');
    modal.className = 'glass-panel modal-content';
    modal.style.width = '100%';
    modal.style.maxWidth = '460px';
    modal.style.borderRadius = 'var(--radius-2xl)';
    modal.style.padding = 'var(--space-6)';
    modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(124, 58, 237, 0.25)';
    modal.style.border = '1px solid var(--glass-border-interactive)';
    modal.style.background = 'linear-gradient(135deg, rgba(20, 15, 45, 0.98) 0%, rgba(10, 14, 28, 0.98) 100%)';
    modal.style.boxSizing = 'border-box';
    modal.style.color = 'var(--color-text-primary)';
    modal.style.fontFamily = 'var(--font-family-base)';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.activeInstance = overlay;

    let sub: Disposable | null = null;

    const renderContent = () => {
      const state = sleepTimerService.getState();
      const presets = [5, 10, 15, 30, 45, 60, 90, 120];

      if (state.isActive) {
        const remainingSec = Math.ceil(state.remainingMs / 1000);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        const timeDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;

        modal.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-accent-purple-glow); display: flex;">
                ${getIconSvg('moon', { size: 22 })}
              </span>
              <h2 id="sleep-timer-modal-title" style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
                Sleep Timer Active
              </h2>
            </div>
            <button
              id="sleep-timer-close-btn"
              aria-label="Close dialog"
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
                transition: color var(--duration-fast);
              "
            >
              ${getIconSvg('close', { size: 20 })}
            </button>
          </div>

          <div style="text-align: center; padding: var(--space-4) 0; display: flex; flex-direction: column; align-items: center; gap: var(--space-2);">
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
              Music will pause in
            </span>
            <div id="sleep-timer-countdown-display" style="font-size: clamp(36px, 6vw, 48px); font-weight: 800; color: #ffffff; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;">
              ${timeDisplay}
            </div>
            <span style="font-size: var(--font-size-xs); color: var(--color-accent-cyan);">
              Ends at ${new Date(state.endsAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <!-- Quick Extension & Cancellation Actions -->
          <div style="display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-4);">
            <div style="display: flex; gap: var(--space-2); justify-content: center;">
              <button
                id="sleep-timer-extend-5"
                class="btn-extend-timer"
                style="
                  flex: 1;
                  min-height: 44px;
                  padding: 8px 12px;
                  border-radius: var(--radius-md);
                  border: 1px solid var(--glass-border);
                  background: var(--color-bg-surface-elevated);
                  color: var(--color-text-primary);
                  font-size: var(--font-size-xs);
                  font-weight: 600;
                  cursor: pointer;
                "
              >
                +5 Min
              </button>
              <button
                id="sleep-timer-extend-15"
                class="btn-extend-timer"
                style="
                  flex: 1;
                  min-height: 44px;
                  padding: 8px 12px;
                  border-radius: var(--radius-md);
                  border: 1px solid var(--glass-border);
                  background: var(--color-bg-surface-elevated);
                  color: var(--color-text-primary);
                  font-size: var(--font-size-xs);
                  font-weight: 600;
                  cursor: pointer;
                "
              >
                +15 Min
              </button>
            </div>

            <button
              id="sleep-timer-cancel-btn"
              style="
                width: 100%;
                min-height: 44px;
                padding: 10px;
                border-radius: var(--radius-md);
                border: 1px solid rgba(239, 68, 68, 0.4);
                background: rgba(239, 68, 68, 0.12);
                color: #fca5a5;
                font-size: var(--font-size-sm);
                font-weight: 600;
                cursor: pointer;
                transition: background var(--duration-fast);
              "
            >
              Cancel Sleep Timer
            </button>
          </div>
        `;
      } else {
        modal.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--color-accent-purple-glow); display: flex;">
                ${getIconSvg('moon', { size: 22 })}
              </span>
              <h2 id="sleep-timer-modal-title" style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0;">
                Sleep Timer
              </h2>
            </div>
            <button
              id="sleep-timer-close-btn"
              aria-label="Close dialog"
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
                transition: color var(--duration-fast);
              "
            >
              ${getIconSvg('close', { size: 20 })}
            </button>
          </div>

          <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); margin: 0 0 var(--space-4) 0;">
            Automatically pause playback when the timer runs out.
          </p>

          <!-- Preset Chips Grid -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); margin-bottom: var(--space-4);">
            ${presets
              .map(mins => `
                <button
                  class="sleep-timer-preset-btn"
                  data-minutes="${mins}"
                  style="
                    min-height: 44px;
                    padding: 8px;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--glass-border);
                    background: var(--color-bg-surface-elevated);
                    color: var(--color-text-primary);
                    font-size: var(--font-size-xs);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all var(--duration-fast);
                  "
                >
                  ${mins}m
                </button>
              `)
              .join('')}
          </div>

          <!-- Custom Duration Form -->
          <form id="sleep-timer-custom-form" style="display: flex; gap: var(--space-2); align-items: center;">
            <div style="flex: 1; position: relative; display: flex; align-items: center;">
              <input
                id="sleep-timer-custom-input"
                type="number"
                min="1"
                max="720"
                placeholder="Custom minutes"
                aria-label="Custom duration in minutes"
                style="
                  width: 100%;
                  height: 44px;
                  padding: 0 var(--space-3);
                  border-radius: var(--radius-md);
                  border: 1px solid var(--glass-border);
                  background: var(--color-bg-surface-elevated);
                  color: #ffffff;
                  font-size: var(--font-size-sm);
                  box-sizing: border-box;
                "
              />
            </div>
            <button
              type="submit"
              id="sleep-timer-custom-submit"
              style="
                min-height: 44px;
                padding: 0 var(--space-4);
                border-radius: var(--radius-md);
                border: none;
                background: var(--gradient-primary);
                color: #ffffff;
                font-size: var(--font-size-xs);
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
              "
            >
              Set Timer
            </button>
          </form>
        `;
      }

      bindModalEvents();
    };

    const bindModalEvents = () => {
      // Close button
      modal.querySelector('#sleep-timer-close-btn')?.addEventListener('click', () => {
        cleanup();
        onClose?.();
      });

      // Preset click
      const presetBtns = modal.querySelectorAll<HTMLButtonElement>('.sleep-timer-preset-btn');
      presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const mins = Number(btn.getAttribute('data-minutes'));
          if (mins > 0) {
            sleepTimerService.startTimer(mins);
            renderContent();
          }
        });
      });

      // Custom form
      const customForm = modal.querySelector<HTMLFormElement>('#sleep-timer-custom-form');
      customForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = modal.querySelector<HTMLInputElement>('#sleep-timer-custom-input');
        const mins = Number(input?.value);
        if (mins > 0 && Number.isFinite(mins)) {
          sleepTimerService.startTimer(mins);
          renderContent();
        }
      });

      // Extend buttons
      modal.querySelector('#sleep-timer-extend-5')?.addEventListener('click', () => {
        sleepTimerService.extendTimer(5);
        renderContent();
      });
      modal.querySelector('#sleep-timer-extend-15')?.addEventListener('click', () => {
        sleepTimerService.extendTimer(15);
        renderContent();
      });

      // Cancel button
      modal.querySelector('#sleep-timer-cancel-btn')?.addEventListener('click', () => {
        sleepTimerService.cancelTimer();
        renderContent();
      });
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        onClose?.();
      }
    };

    const handleOverlayClick = (e: MouseEvent) => {
      if (e.target === overlay) {
        cleanup();
        onClose?.();
      }
    };

    const cleanup = () => {
      if (sub) {
        sub.dispose();
        sub = null;
      }
      document.removeEventListener('keydown', handleKeydown);
      overlay.removeEventListener('click', handleOverlayClick);
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
      if (SleepTimerModalComponent.activeInstance === overlay) {
        SleepTimerModalComponent.activeInstance = null;
      }
    };

    document.addEventListener('keydown', handleKeydown);
    overlay.addEventListener('click', handleOverlayClick);

    // Subscribe to sleep timer updates to refresh countdown in real time
    sub = eventBus.subscribe(DomainEvents.SLEEP_TIMER_CHANGED, () => {
      if (SleepTimerModalComponent.activeInstance === overlay) {
        renderContent();
      }
    });

    renderContent();
    return overlay;
  }

  public static close(): void {
    if (this.activeInstance) {
      const closeBtn = this.activeInstance.querySelector<HTMLButtonElement>('#sleep-timer-close-btn');
      if (closeBtn) {
        closeBtn.click();
      } else {
        this.activeInstance.remove();
        this.activeInstance = null;
      }
    }
  }
}
