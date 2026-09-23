import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { SleepTimerService } from '../../src/services/playback/sleep-timer-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';

setupMockDomEnvironment();

describe('SleepTimerService', () => {
  let eventBus: EventBus;
  let mockPlaybackManager: any;
  let service: SleepTimerService;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new EventBus();
    mockPlaybackManager = {
      pause: vi.fn().mockResolvedValue(undefined),
      state: 'playing'
    };

    service = new SleepTimerService({
      playbackManager: mockPlaybackManager,
      eventBus
    });
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  it('initializes in inactive state', () => {
    const state = service.getState();
    expect(state.isActive).toBe(false);
    expect(state.durationMs).toBe(0);
    expect(state.endsAt).toBeNull();
    expect(service.getRemainingMs()).toBe(0);
  });

  it('starts timer with valid duration and broadcasts state', () => {
    const eventSpy = vi.fn();
    eventBus.subscribe(DomainEvents.SLEEP_TIMER_CHANGED, eventSpy);

    const now = Date.now();
    const state = service.startTimer(30);

    expect(state.isActive).toBe(true);
    expect(state.durationMs).toBe(30 * 60 * 1000);
    expect(state.endsAt).toBe(now + 30 * 60 * 1000);
    expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
      isActive: true,
      durationMs: 1800000
    }));
  });

  it('rejects zero, negative, and non-finite durations', () => {
    expect(() => service.startTimer(0)).toThrow(/positive number/);
    expect(() => service.startTimer(-15)).toThrow(/positive number/);
    expect(() => service.startTimer(NaN)).toThrow(/positive number/);
  });

  it('expires and invokes playbackManager.pause() when time elapses', async () => {
    const expiredSpy = vi.fn();
    eventBus.subscribe(DomainEvents.SLEEP_TIMER_EXPIRED, expiredSpy);

    service.startTimer(15);
    expect(service.getState().isActive).toBe(true);

    // Fast-forward 15 minutes
    vi.advanceTimersByTime(15 * 60 * 1000);
    await vi.runAllTimersAsync();

    expect(mockPlaybackManager.pause).toHaveBeenCalledTimes(1);
    expect(service.getState().isActive).toBe(false);
    expect(expiredSpy).toHaveBeenCalledWith(expect.objectContaining({
      durationMs: 15 * 60 * 1000
    }));
  });

  it('handles playbackManager.pause() throwing gracefully', async () => {
    mockPlaybackManager.pause = vi.fn().mockRejectedValue(new Error('Already paused'));

    service.startTimer(10);
    vi.advanceTimersByTime(10 * 60 * 1000);
    await vi.runAllTimersAsync();

    expect(service.getState().isActive).toBe(false);
  });

  it('cancels active timer cleanly', () => {
    service.startTimer(45);
    expect(service.getState().isActive).toBe(true);

    service.cancelTimer();
    const state = service.getState();
    expect(state.isActive).toBe(false);
    expect(state.endsAt).toBeNull();
    expect(service.getRemainingMs()).toBe(0);

    // Fast-forward 45 minutes to verify no delayed pause occurs
    vi.advanceTimersByTime(45 * 60 * 1000);
    expect(mockPlaybackManager.pause).not.toHaveBeenCalled();
  });

  it('extends timer from CURRENT endsAt timestamp without resetting from now', () => {
    const startTime = Date.now();
    service.startTimer(30);
    const initialEndsAt = service.getState().endsAt!;
    expect(initialEndsAt).toBe(startTime + 30 * 60 * 1000);

    // Advance 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(service.getRemainingMs()).toBe(20 * 60 * 1000);

    // Extend by 15 minutes
    service.extendTimer(15);
    const updatedState = service.getState();

    // EndsAt must be initialEndsAt + 15m, not Date.now() + 15m
    expect(updatedState.endsAt).toBe(initialEndsAt + 15 * 60 * 1000);
    expect(service.getRemainingMs()).toBe(35 * 60 * 1000);
  });

  it('extends timer starts a new timer if none is active', () => {
    const state = service.extendTimer(20);
    expect(state.isActive).toBe(true);
    expect(state.durationMs).toBe(20 * 60 * 1000);
  });

  it('recalculates on visibility change and expires if deadline was reached in background', async () => {
    service.startTimer(5);

    // Advance 6 minutes in background
    vi.advanceTimersByTime(6 * 60 * 1000);

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.runAllTimersAsync();

    expect(mockPlaybackManager.pause).toHaveBeenCalledTimes(1);
    expect(service.getState().isActive).toBe(false);
  });
});
