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
      abLoop: { pointA: null, pointB: null, isActive: false, enabled: false },
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn(),
      setLoopA: vi.fn(),
      setLoopB: vi.fn(),
      clearAbLoop: vi.fn()
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

  it('should toggle mute, shuffle, and repeat modes on KeyM, KeyS, and KeyR', () => {
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyM' }));
    expect(mockPlaybackManager.setMuted).toHaveBeenCalledWith(true);

    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyS' }));
    expect(mockPlaybackManager.setShuffleMode).toHaveBeenCalledWith('on');

    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(mockPlaybackManager.setRepeatMode).toHaveBeenCalledWith('all');
  });

  it('should trigger next and previous track on KeyN and KeyP', () => {
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyN' }));
    expect(mockPlaybackManager.next).toHaveBeenCalled();

    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyP' }));
    expect(mockPlaybackManager.previous).toHaveBeenCalled();
  });

  it('should handle hardware media keys (MediaTrackNext, MediaTrackPrevious, MediaPlayPause, MediaStop)', () => {
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'MediaTrackNext' }));
    expect(mockPlaybackManager.next).toHaveBeenCalled();

    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'MediaTrackPrevious' }));
    expect(mockPlaybackManager.previous).toHaveBeenCalled();

    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'MediaPlayPause' }));
    expect(mockPlaybackManager.pause).toHaveBeenCalled();

    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'MediaStop' }));
    expect(mockPlaybackManager.pause).toHaveBeenCalled();
  });

  it('should cycle A/B loop state on KeyL', () => {
    // 1. Initial state (pointA: null, pointB: null) -> setLoopA
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyL' }));
    expect(mockPlaybackManager.setLoopA).toHaveBeenCalled();

    // 2. Point A set (pointA: 1000, pointB: null) -> setLoopB
    mockPlaybackManager.abLoop = { pointA: 1000, pointB: null, isActive: false, enabled: false };
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyL' }));
    expect(mockPlaybackManager.setLoopB).toHaveBeenCalled();

    // 3. Both set (pointA: 1000, pointB: 5000, isActive: true) -> clearAbLoop
    mockPlaybackManager.abLoop = { pointA: 1000, pointB: 5000, isActive: true, enabled: true };
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyL' }));
    expect(mockPlaybackManager.clearAbLoop).toHaveBeenCalled();
  });

  it('should focus search on Slash key', () => {
    const navSpy = vi.spyOn(router, 'navigate');
    keyboardManager.handleKeyDown(new KeyboardEvent('keydown', { code: 'Slash' }));
    expect(navSpy).toHaveBeenCalledWith('search');
  });

  it('should blur active element on Escape key', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true });
    Object.defineProperty(event, 'target', { value: input, writable: false });

    keyboardManager.handleKeyDown(event);
    expect(document.activeElement).not.toBe(input);

    document.body.removeChild(input);
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
