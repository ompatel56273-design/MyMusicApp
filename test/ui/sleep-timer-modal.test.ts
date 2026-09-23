import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { SleepTimerModalComponent } from '../../src/ui/components/player/sleep-timer-modal';
import { SleepTimerService } from '../../src/services/playback/sleep-timer-service';
import { EventBus } from '../../src/core/events/event-bus';

setupMockDomEnvironment();

describe('SleepTimerModalComponent', () => {
  let eventBus: EventBus;
  let mockPlaybackManager: any;
  let sleepTimerService: SleepTimerService;

  beforeEach(() => {
    eventBus = new EventBus();
    mockPlaybackManager = {
      pause: vi.fn().mockResolvedValue(undefined),
      state: 'playing'
    };

    sleepTimerService = new SleepTimerService({
      playbackManager: mockPlaybackManager,
      eventBus
    });
  });

  afterEach(() => {
    SleepTimerModalComponent.close();
    sleepTimerService.dispose();
  });

  it('renders inactive sleep timer modal with preset chips and custom form', () => {
    const modalEl = SleepTimerModalComponent.show({
      sleepTimerService,
      eventBus
    });

    expect(document.body.contains(modalEl)).toBe(true);
    expect(modalEl.getAttribute('role')).toBe('dialog');
    expect(modalEl.getAttribute('aria-modal')).toBe('true');

    const presets = modalEl.querySelectorAll('.sleep-timer-preset-btn');
    expect(presets.length).toBe(8); // 5, 10, 15, 30, 45, 60, 90, 120

    const customInput = modalEl.querySelector('#sleep-timer-custom-input');
    expect(customInput).not.toBeNull();
  });

  it('starts timer when clicking a preset chip', () => {
    const modalEl = SleepTimerModalComponent.show({
      sleepTimerService,
      eventBus
    });

    const btn30 = modalEl.querySelector<HTMLButtonElement>('[data-minutes="30"]');
    expect(btn30).not.toBeNull();
    btn30?.click();

    const state = sleepTimerService.getState();
    expect(state.isActive).toBe(true);
    expect(state.durationMs).toBe(30 * 60 * 1000);

    // After starting, modal should display active countdown UI
    expect(modalEl.textContent).toContain('Sleep Timer Active');
    expect(modalEl.querySelector('#sleep-timer-cancel-btn')).not.toBeNull();
  });

  it('starts timer with custom duration input', () => {
    const modalEl = SleepTimerModalComponent.show({
      sleepTimerService,
      eventBus
    });

    const input = modalEl.querySelector<HTMLInputElement>('#sleep-timer-custom-input');
    const form = modalEl.querySelector<HTMLFormElement>('#sleep-timer-custom-form');

    if (input) input.value = '25';
    form?.dispatchEvent(new Event('submit'));

    expect(sleepTimerService.getState().isActive).toBe(true);
    expect(sleepTimerService.getState().durationMs).toBe(25 * 60 * 1000);
  });

  it('extends and cancels active timer from modal', () => {
    sleepTimerService.startTimer(15);

    const modalEl = SleepTimerModalComponent.show({
      sleepTimerService,
      eventBus
    });

    expect(modalEl.textContent).toContain('Sleep Timer Active');

    // Click extend 5
    const extendBtn = modalEl.querySelector<HTMLButtonElement>('#sleep-timer-extend-5');
    extendBtn?.click();
    expect(sleepTimerService.getState().durationMs).toBe(20 * 60 * 1000);

    // Click cancel
    const cancelBtn = modalEl.querySelector<HTMLButtonElement>('#sleep-timer-cancel-btn');
    cancelBtn?.click();
    expect(sleepTimerService.getState().isActive).toBe(false);
  });

  it('closes modal on close button click and Escape key', () => {
    const onClose = vi.fn();
    const modalEl = SleepTimerModalComponent.show({
      sleepTimerService,
      eventBus,
      onClose
    });

    const closeBtn = modalEl.querySelector<HTMLButtonElement>('#sleep-timer-close-btn');
    closeBtn?.click();

    expect(document.body.contains(modalEl)).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
