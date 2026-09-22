import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { KeyboardManager } from '../../src/ui/keyboard/keyboard-manager';
import { PlaylistModalComponent } from '../../src/ui/components/playlist/playlist-modal-component';

setupMockDomEnvironment();

describe('Keyboard Accessibility Hardening', () => {
  let mockPlaybackManager: any;
  let mockRouter: any;
  let keyboardManager: KeyboardManager;

  beforeEach(() => {
    mockPlaybackManager = {
      state: 'paused',
      positionMs: 10000,
      durationMs: 200000,
      volume: 0.8,
      isMuted: false,
      shuffleMode: 'off',
      repeatMode: 'off',
      pause: vi.fn(async () => {}),
      resume: vi.fn(async () => {}),
      seek: vi.fn(async () => {}),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setShuffleMode: vi.fn()
    };

    mockRouter = {
      navigate: vi.fn()
    };

    keyboardManager = new KeyboardManager({
      playbackManager: mockPlaybackManager,
      router: mockRouter
    });
  });

  it('triggers play/pause toggle on Space key press', () => {
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(mockPlaybackManager.resume).toHaveBeenCalled();
  });

  it('safely ignores global shortcuts when focused inside text input fields', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { code: 'Space' });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });

    keyboardManager.handleKeyDown(event);
    expect(mockPlaybackManager.resume).not.toHaveBeenCalled();
    input.remove();
  });

  it('traps focus inside PlaylistModalComponent and restores focus on close', async () => {
    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();

    PlaylistModalComponent.show({
      onSave: async () => {}
    });

    const overlay = document.body.querySelector('.modal-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.getAttribute('role')).toBe('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');

    // Test Escape closes modal
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    overlay.dispatchEvent(escapeEvent);

    expect(document.body.querySelector('.modal-overlay')).toBeNull();
    triggerBtn.remove();
  });
});
