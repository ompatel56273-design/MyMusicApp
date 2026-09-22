import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { KeyboardManager } from '../../src/ui/keyboard/keyboard-manager';
import { RouterService } from '../../src/ui/navigation/router-service';

setupMockDomEnvironment();

describe('KeyboardManager', () => {
  let mockPlaybackManager: any;
  let router: RouterService;
  let keyboardManager: KeyboardManager;

  beforeEach(() => {
    mockPlaybackManager = {
      state: 'playing',
      positionMs: 20000,
      durationMs: 180000,
      volume: 0.8,
      isMuted: false,
      repeatMode: 'off',
      shuffleMode: 'off',
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn()
    };

    router = new RouterService('home');
    keyboardManager = new KeyboardManager({
      playbackManager: mockPlaybackManager,
      router
    });
    keyboardManager.init();
  });

  afterEach(() => {
    keyboardManager.dispose();
  });

  it('should toggle play/pause on Space key', () => {
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    keyboardManager.handleKeyDown(event);
    expect(mockPlaybackManager.pause).toHaveBeenCalled();

    mockPlaybackManager.state = 'paused';
    keyboardManager.handleKeyDown(event);
    expect(mockPlaybackManager.resume).toHaveBeenCalled();
  });

  it('should seek backward and forward on ArrowLeft and ArrowRight', () => {
    const leftEvent = new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true });
    keyboardManager.handleKeyDown(leftEvent);
    expect(mockPlaybackManager.seek).toHaveBeenCalledWith(15000);

    const rightEvent = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true });
    keyboardManager.handleKeyDown(rightEvent);
    expect(mockPlaybackManager.seek).toHaveBeenCalledWith(25000);
  });

  it('should adjust volume on ArrowUp and ArrowDown', () => {
    const upEvent = new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true });
    keyboardManager.handleKeyDown(upEvent);
    expect(mockPlaybackManager.setVolume).toHaveBeenCalledWith(0.85);

    const downEvent = new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true });
    keyboardManager.handleKeyDown(downEvent);
    expect(mockPlaybackManager.setVolume).toHaveBeenCalledWith(0.75);
  });

  it('should bypass shortcuts when focused inside an input field', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });

    keyboardManager.handleKeyDown(event);
    expect(mockPlaybackManager.pause).not.toHaveBeenCalled();
    expect(mockPlaybackManager.resume).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });
});
