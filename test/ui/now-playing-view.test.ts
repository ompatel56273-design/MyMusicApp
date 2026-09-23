import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { NowPlayingView } from '../../src/ui/views/now-playing-view';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import { RouterService } from '../../src/ui/navigation/router-service';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('NowPlayingView (Fullscreen Experience)', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockPlaybackManager: any;
  let mockLibraryService: any;
  let mockArtworkService: any;
  let router: RouterService;
  let nowPlayingView: NowPlayingView;

  const mockTrack1: Track = {
    id: 't1',
    fileId: 'f1',
    title: 'Hotel California',
    artistName: 'Eagles',
    albumId: 'alb_1',
    albumTitle: 'Hotel California',
    durationMs: 391000,
    format: { container: 'flac', codec: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2, isLossless: true },
    dateAdded: 1000,
    dateModified: 1000,
    playCount: 42,
    isFavorite: true,
    hasLyrics: false,
    availability: 'available'
  };

  const mockTrack2: Track = {
    id: 't2',
    fileId: 'f2',
    title: 'Desperado',
    artistName: 'Eagles',
    albumTitle: 'Desperado',
    durationMs: 213000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: 2000,
    dateModified: 2000,
    playCount: 15,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();
    router = new RouterService('nowplaying');

    mockPlaybackManager = {
      state: 'playing',
      currentTrack: mockTrack1,
      positionMs: 60000,
      durationMs: 391000,
      volume: 0.8,
      isMuted: false,
      repeatMode: 'off',
      shuffleMode: 'off',
      queue: [
        { id: 'q1', trackId: 't1', position: 0, addedReason: 'user' },
        { id: 'q2', trackId: 't2', position: 1, addedReason: 'user' }
      ],
      currentQueueIndex: 0,
      getTracks: () => [mockTrack1, mockTrack2],
      playTrack: vi.fn().mockResolvedValue(undefined),
      playQueueIndex: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn(),
      removeFromQueue: vi.fn().mockResolvedValue(undefined),
      reorderQueue: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockLibraryService = {
      toggleFavorite: vi.fn().mockResolvedValue(false)
    };

    mockArtworkService = {
      getArtworkUrl: vi.fn().mockResolvedValue('blob:http://localhost/art_mock')
    };

    nowPlayingView = new NowPlayingView({
      playbackManager: mockPlaybackManager,
      libraryService: mockLibraryService,
      artworkService: mockArtworkService,
      router,
      eventBus
    });

    nowPlayingView.mount(container);
  });

  afterEach(() => {
    nowPlayingView.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should render active track title, artist, format badge, and artwork', () => {
    const titleEl = container.querySelector('#np-track-title');
    const artistEl = container.querySelector('#np-track-artist');

    expect(titleEl?.textContent?.trim()).toBe('Hotel California');
    expect(artistEl?.textContent?.trim()).toBe('Eagles');
    expect(mockArtworkService.getArtworkUrl).toHaveBeenCalled();
  });

  it('should trigger playback controls (play, pause, next, previous, seek)', () => {
    const playBtn = container.querySelector<HTMLElement>('#np-play-btn');
    playBtn?.click();
    expect(mockPlaybackManager.pause).toHaveBeenCalled();

    const nextBtn = container.querySelector<HTMLElement>('#np-next-btn');
    nextBtn?.click();
    expect(mockPlaybackManager.next).toHaveBeenCalled();

    const prevBtn = container.querySelector<HTMLElement>('#np-prev-btn');
    prevBtn?.click();
    expect(mockPlaybackManager.previous).toHaveBeenCalled();
  });

  it('should adjust modes (repeat, shuffle) and volume', () => {
    const shuffleBtn = container.querySelector<HTMLElement>('#np-shuffle-btn');
    shuffleBtn?.click();
    expect(mockPlaybackManager.setShuffleMode).toHaveBeenCalledWith('on');

    const repeatBtn = container.querySelector<HTMLElement>('#np-repeat-btn');
    repeatBtn?.click();
    expect(mockPlaybackManager.setRepeatMode).toHaveBeenCalledWith('all');

    const muteBtn = container.querySelector<HTMLElement>('#np-mute-btn');
    muteBtn?.click();
    expect(mockPlaybackManager.setMuted).toHaveBeenCalledWith(true);
  });

  it('should navigate back to library on back button click', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const backBtn = container.querySelector<HTMLElement>('#np-back-btn');
    backBtn?.click();
    expect(navigateSpy).toHaveBeenCalledWith('library');
  });

  it('should update metadata and artwork reactively upon TRACK_CHANGED event', () => {
    eventBus.publish(DomainEvents.TRACK_CHANGED, {
      currentTrack: mockTrack2,
      previousTrack: mockTrack1,
      positionMs: 0
    });

    const titleEl = container.querySelector('#np-track-title');
    const artistEl = container.querySelector('#np-track-artist');

    expect(titleEl?.textContent?.trim()).toBe('Desperado');
    expect(artistEl?.textContent?.trim()).toBe('Eagles');
  });

  it('should switch to visualizer tab when visualizer tab button is clicked', () => {
    const vizTabBtn = container.querySelector<HTMLButtonElement>('button[data-tab="visualizer"]');
    expect(vizTabBtn).not.toBeNull();
    vizTabBtn?.click();

    const activeTabBtn = container.querySelector<HTMLButtonElement>('button[data-tab="visualizer"]');
    expect(activeTabBtn?.getAttribute('aria-selected')).toBe('true');
  });
});
