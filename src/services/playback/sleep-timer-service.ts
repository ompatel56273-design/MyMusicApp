import { Logger } from '../../core/logging/logger';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { IPlaybackManager } from '../contracts/service-contracts';

export interface SleepTimerState {
  readonly isActive: boolean;
  readonly startedAt: number | null;
  readonly durationMs: number;
  readonly endsAt: number | null;
  readonly remainingMs: number;
}

export interface SleepTimerServiceDependencies {
  playbackManager: IPlaybackManager;
  eventBus: EventBus;
  logger?: Logger | undefined;
}

/**
 * Authoritative Single Sleep Timer Service.
 * Orchestrates drift-free countdowns using timestamp comparisons,
 * handles tab visibility recalculations, and pauses playback upon expiration.
 */
export class SleepTimerService {
  private readonly logger: Logger;
  private readonly playbackManager: IPlaybackManager;
  private readonly eventBus: EventBus;

  private isActive = false;
  private startedAt: number | null = null;
  private durationMs = 0;
  private endsAt: number | null = null;

  private timeoutHandle: any = null;
  private tickerIntervalHandle: any = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(deps: SleepTimerServiceDependencies) {
    this.logger = deps.logger ?? new Logger('SleepTimerService');
    this.playbackManager = deps.playbackManager;
    this.eventBus = deps.eventBus;

    this.bindVisibilityListener();
  }

  /**
   * Starts a new sleep timer for the given duration in minutes.
   * @param minutes Positive duration between 1 and 720 minutes (max 12 hours).
   */
  public startTimer(minutes: number): SleepTimerState {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error(`Sleep timer duration must be a positive number, received: ${minutes}`);
    }

    const clampedMinutes = Math.min(Math.max(1, Math.round(minutes)), 720);
    this.clearTimers();

    const now = Date.now();
    this.isActive = true;
    this.startedAt = now;
    this.durationMs = clampedMinutes * 60 * 1000;
    this.endsAt = now + this.durationMs;

    this.scheduleTimeout(this.durationMs);
    this.startTicker();
    this.emitStateChanged();

    this.logger.info(`Sleep timer started for ${clampedMinutes} minutes (ends at: ${new Date(this.endsAt).toLocaleTimeString()})`);
    return this.getState();
  }

  /**
   * Extends an active sleep timer by adding minutes to the CURRENT endsAt timestamp.
   * If no timer is active, starts a new timer.
   */
  public extendTimer(minutes: number): SleepTimerState {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error(`Extension minutes must be a positive number, received: ${minutes}`);
    }

    if (!this.isActive || !this.endsAt) {
      return this.startTimer(minutes);
    }

    const addMs = Math.round(minutes * 60 * 1000);
    this.durationMs += addMs;
    this.endsAt += addMs;

    const remainingMs = Math.max(0, this.endsAt - Date.now());
    this.clearTimers();
    this.scheduleTimeout(remainingMs);
    this.startTicker();
    this.emitStateChanged();

    this.logger.info(`Sleep timer extended by ${minutes} minutes (new remaining: ${Math.round(remainingMs / 60000)}m)`);
    return this.getState();
  }

  /**
   * Cancels the active sleep timer.
   */
  public cancelTimer(): void {
    if (!this.isActive) return;

    this.clearTimers();
    this.isActive = false;
    this.startedAt = null;
    this.durationMs = 0;
    this.endsAt = null;

    this.emitStateChanged();
    this.logger.info('Sleep timer cancelled');
  }

  /**
   * Retrieves the current authoritative timer state with exact timestamp-derived remaining time.
   */
  public getState(): SleepTimerState {
    const remainingMs = this.getRemainingMs();
    return {
      isActive: this.isActive,
      startedAt: this.startedAt,
      durationMs: this.durationMs,
      endsAt: this.endsAt,
      remainingMs
    };
  }

  /**
   * Returns remaining milliseconds derived directly from timestamps (zero drift).
   */
  public getRemainingMs(): number {
    if (!this.isActive || !this.endsAt) return 0;
    return Math.max(0, this.endsAt - Date.now());
  }

  /**
   * Cleans up all timers and global event listeners.
   */
  public dispose(): void {
    this.clearTimers();
    this.isActive = false;

    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  private scheduleTimeout(delayMs: number): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    this.timeoutHandle = setTimeout(() => {
      void this.handleExpiration();
    }, delayMs);
  }

  private startTicker(): void {
    if (this.tickerIntervalHandle) {
      clearInterval(this.tickerIntervalHandle);
      this.tickerIntervalHandle = null;
    }

    this.tickerIntervalHandle = setInterval(() => {
      if (!this.isActive) {
        this.clearTimers();
        return;
      }

      const remaining = this.getRemainingMs();
      if (remaining <= 0) {
        void this.handleExpiration();
      } else {
        this.emitStateChanged();
      }
    }, 1000);
  }

  private clearTimers(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    if (this.tickerIntervalHandle) {
      clearInterval(this.tickerIntervalHandle);
      this.tickerIntervalHandle = null;
    }
  }

  private async handleExpiration(): Promise<void> {
    if (!this.isActive) return;

    this.logger.info('Sleep timer expired. Pausing playback...');
    const duration = this.durationMs;

    this.clearTimers();
    this.isActive = false;
    this.startedAt = null;
    this.durationMs = 0;
    this.endsAt = null;

    try {
      // Pause playback using existing authoritative PlaybackManager API
      await this.playbackManager.pause();
    } catch (err) {
      this.logger.warn('PlaybackManager.pause() threw during sleep timer expiration (playback may already be paused/idle):', {
        error: String(err)
      });
    }

    this.eventBus.publish(DomainEvents.SLEEP_TIMER_EXPIRED, {
      timestamp: Date.now(),
      durationMs: duration
    });
    this.emitStateChanged();
  }

  private bindVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isActive && this.endsAt) {
        const remainingMs = this.endsAt - Date.now();
        if (remainingMs <= 0) {
          void this.handleExpiration();
        } else {
          // Reschedule timeout to ensure exact remaining delay after backgrounding
          this.scheduleTimeout(remainingMs);
          this.emitStateChanged();
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private emitStateChanged(): void {
    this.eventBus.publish(DomainEvents.SLEEP_TIMER_CHANGED, this.getState());
  }
}
