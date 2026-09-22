import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { MiniPlayerComponent } from '../../src/ui/shell/mini-player-component';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('MiniPlayerComponent', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockPlaybackManager: any;
  let miniPlayer: MiniPlayerComponent;

  const mockTrack: Track = {
    id: 't1',
    fileId: 'f1',
    title: 'Bohemian Rhapsody',
    artistName: 'Queen',
    albumTitle: 'A Night at the Opera',
    durationMs: 354000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: 1,
    dateModified: 1,
    playCount: 10,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();

    mockPlaybackManager = {
      state: 'idle',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 0.9,
      isMuted: false,
      repeatMode: 'off',
      shuffleMode: 'off',
      playTrack: vi.fn(),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn()
    };

    miniPlayer = new MiniPlayerComponent({
      playbackManager: mockPlaybackManager,
      eventBus
    });
    miniPlayer.mount(container);
  });

  afterEach(() => {
    miniPlayer.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should render default idle state and respond to track and playback changes', () => {
    const titleEl = container.querySelector('#mini-track-title');
    expect(titleEl?.textContent?.trim()).toBe('No Track Selected');

    // Simulate Track Changed Event
    eventBus.publish(DomainEvents.TRACK_CHANGED, {
      currentTrack: mockTrack,
      previousTrack: null,
      positionMs: 0
    });

    expect(titleEl?.textContent?.trim()).toBe('Bohemian Rhapsody');

    const artistEl = container.querySelector('#mini-track-artist');
    expect(artistEl?.textContent?.trim()).toBe('Queen');
  });

  it('should reflect play/pause state transitions', () => {
    const playBtn = container.querySelector<HTMLButtonElement>('#mini-play-btn');
    expect(playBtn?.textContent?.trim()).toBe('▶');

    eventBus.publish(DomainEvents.PLAYBACK_STATE_CHANGED, {
      state: 'playing',
      track: mockTrack,
      positionMs: 1000,
      durationMs: 354000
    });

    expect(playBtn?.textContent?.trim()).toBe('⏸');
  });

  it('should invoke playback controls upon user interaction', () => {
    const nextBtn = container.querySelector<HTMLButtonElement>('#mini-next-btn');
    nextBtn?.click();
    expect(mockPlaybackManager.next).toHaveBeenCalled();

    const prevBtn = container.querySelector<HTMLButtonElement>('#mini-prev-btn');
    prevBtn?.click();
    expect(mockPlaybackManager.previous).toHaveBeenCalled();

    const muteBtn = container.querySelector<HTMLButtonElement>('#mini-mute-btn');
    muteBtn?.click();
    expect(mockPlaybackManager.setMuted).toHaveBeenCalledWith(true);
  });
});
