import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { MediaSessionService } from '../../src/services/playback/media-session-service';
import { EventBus } from '../../src/core/events/event-bus';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('MediaSessionService', () => {
  let mockPlaybackManager: any;
  let eventBus: EventBus;
  let mediaSessionService: MediaSessionService;
  let mockMediaSession: any;
  let registeredHandlers: Map<string, Function>;

  const mockTrack: Track = {
    id: 'track-1',
    fileId: 'file-1',
    title: 'Test Song',
    artistName: 'Test Artist',
    albumTitle: 'Test Album',
    durationMs: 200000,
    format: { container: 'mp3', codec: 'mp3', isLossless: false, sampleRate: 44100, channels: 2 },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };
  (mockTrack as any).artworkUrl = 'http://example.com/cover.png';

  beforeEach(() => {
    registeredHandlers = new Map();
    mockMediaSession = {
      metadata: null,
      playbackState: 'none',
      setActionHandler: vi.fn((action: string, handler: Function | null) => {
        if (handler) {
          registeredHandlers.set(action, handler);
        } else {
          registeredHandlers.delete(action);
        }
      }),
      setPositionState: vi.fn()
    };

    // Global MediaMetadata mock
    (globalThis as any).MediaMetadata = class {
      title: string;
      artist: string;
      album: string;
      artwork: any[];
      constructor(init: any) {
        this.title = init.title;
        this.artist = init.artist;
        this.album = init.album;
        this.artwork = init.artwork;
      }
    };

    Object.defineProperty(navigator, 'mediaSession', {
      value: mockMediaSession,
      configurable: true,
      writable: true
    });

    mockPlaybackManager = {
      state: 'playing',
      currentTrack: mockTrack,
      positionMs: 45000,
      durationMs: 200000,
      playbackRate: 1.0,
      resume: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined)
    };

    eventBus = new EventBus();
    mediaSessionService = new MediaSessionService({
      playbackManager: mockPlaybackManager,
      eventBus
    });
  });

  afterEach(() => {
    mediaSessionService.dispose();
  });

  it('should initialize media session handlers and metadata on init()', async () => {
    mediaSessionService.init();

    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('previoustrack', expect.any(Function));
    expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));

    await mediaSessionService.updateMetadata(mockTrack);
    expect(mockMediaSession.metadata).not.toBeNull();
    expect(mockMediaSession.metadata.title).toBe('Test Song');
    expect(mockMediaSession.metadata.artist).toBe('Test Artist');
    expect(mockMediaSession.metadata.album).toBe('Test Album');
  });

  it('should route media session action handlers to PlaybackManager', () => {
    mediaSessionService.init();

    registeredHandlers.get('play')?.();
    expect(mockPlaybackManager.resume).toHaveBeenCalled();

    registeredHandlers.get('pause')?.();
    expect(mockPlaybackManager.pause).toHaveBeenCalled();

    registeredHandlers.get('nexttrack')?.();
    expect(mockPlaybackManager.next).toHaveBeenCalled();

    registeredHandlers.get('previoustrack')?.();
    expect(mockPlaybackManager.previous).toHaveBeenCalled();
  });

  it('should handle seek actions (seekto, seekbackward, seekforward)', () => {
    mediaSessionService.init();

    registeredHandlers.get('seekto')?.({ seekTime: 60 });
    expect(mockPlaybackManager.seek).toHaveBeenCalledWith(60000);

    registeredHandlers.get('seekbackward')?.({ seekOffset: 10 });
    expect(mockPlaybackManager.seek).toHaveBeenCalledWith(35000); // 45s - 10s = 35s = 35000ms

    registeredHandlers.get('seekforward')?.({ seekOffset: 15 });
    expect(mockPlaybackManager.seek).toHaveBeenCalledWith(60000); // 45s + 15s = 60s = 60000ms
  });

  it('should update metadata on track change event', async () => {
    mediaSessionService.init();

    const newTrack: Track = {
      ...mockTrack,
      id: 'track-2',
      title: 'New Song',
      artistName: 'New Artist',
      albumTitle: 'New Album'
    };

    eventBus.publish('playback:track-changed', { track: newTrack });
    await mediaSessionService.updateMetadata(newTrack);

    expect(mockMediaSession.metadata.title).toBe('New Song');
    expect(mockMediaSession.metadata.artist).toBe('New Artist');
  });

  it('should update position state on time updated event', () => {
    mediaSessionService.init();

    eventBus.publish('playback:time-updated', { positionMs: 50000, durationMs: 200000 });

    expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 200,
      position: 45,
      playbackRate: 1.0
    });
  });

  it('should update playback state on state changed event', () => {
    mediaSessionService.init();

    eventBus.publish('playback:state-changed', { state: 'paused' });
    expect(mockMediaSession.playbackState).toBe('paused');

    eventBus.publish('playback:state-changed', { state: 'playing' });
    expect(mockMediaSession.playbackState).toBe('playing');
  });

  it('should clean up subscriptions and media session state on dispose()', () => {
    mediaSessionService.init();
    mediaSessionService.dispose();

    expect(mockMediaSession.playbackState).toBe('none');
    expect(mockMediaSession.metadata).toBeNull();
  });
});
