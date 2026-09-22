import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { LyricsViewComponent } from '../../src/ui/components/player/lyrics-view-component';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { IPlaybackManager, ILyricsService } from '../../src/services/contracts/service-contracts';
import type { Track, Lyrics } from '../../src/domain/entities/models';

describe('LyricsViewComponent', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockPlaybackManager: IPlaybackManager;
  let mockLyricsService: ILyricsService;
  let component: LyricsViewComponent;

  const sampleTrack: Track = {
    id: 'track_test_1',
    title: 'Test Song',
    artistId: 'art_1',
    artistName: 'Test Artist',
    albumId: 'alb_1',
    albumTitle: 'Test Album',
    durationMs: 180000,
    fileId: 'file_1',
    format: {
      container: 'flac',
      codec: 'flac',
      bitrate: 900,
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      isLossless: true
    },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: true,
    availability: 'available'
  };

  const sampleSyncLyrics: Lyrics = {
    id: 'lyr_1',
    trackId: 'track_test_1',
    type: 'synced',
    plainText: '',
    lines: [
      { timeMs: 1000, text: 'First line of the song' },
      { timeMs: 4000, text: 'Second line follows' },
      { timeMs: 8000, text: 'Third line reaches chorus' }
    ],
    updatedAt: Date.now()
  };

  beforeEach(() => {
    container = document.createElement('div');
    eventBus = new EventBus();

    mockPlaybackManager = {
      state: 'playing',
      currentTrack: sampleTrack,
      positionMs: 0,
      durationMs: 180000,
      volume: 1.0,
      isMuted: false,
      playbackRate: 1.0,
      repeatMode: 'off',
      shuffleMode: 'off',
      queue: [],
      currentQueueIndex: 0,
      playTrack: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn(),
      addToQueue: vi.fn(),
      playQueueIndex: vi.fn(),
      removeFromQueue: vi.fn(),
      reorderQueue: vi.fn(),
      clearQueue: vi.fn()
    };

    mockLyricsService = {
      getLyrics: vi.fn().mockResolvedValue(sampleSyncLyrics),
      saveLyrics: vi.fn(),
      deleteLyrics: vi.fn(),
      parseLrc: vi.fn()
    };

    component = new LyricsViewComponent({
      lyricsService: mockLyricsService,
      playbackManager: mockPlaybackManager,
      eventBus
    });
  });

  afterEach(() => {
    if (component) {
      component.unmount();
    }
  });

  it('renders loading state initially and then renders synchronized cues', async () => {
    component.mount(container, sampleTrack);

    // Wait for microtasks to resolve getLyrics
    await new Promise(resolve => setTimeout(resolve, 10));

    const lineElements = container.querySelectorAll('.lyric-cue');
    expect(lineElements.length).toBe(3);
    expect(lineElements[0].textContent).toBe('First line of the song');
    expect(lineElements[1].textContent).toBe('Second line follows');
    expect(lineElements[2].textContent).toBe('Third line reaches chorus');
  });

  it('highlights the active line based on playback time updates', async () => {
    component.mount(container, sampleTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Time at 4.5s should activate line index 1 (4000ms cue)
    eventBus.publish(DomainEvents.PLAYBACK_TIME_UPDATED, { positionMs: 4500, durationMs: 180000 });

    const lineElements = container.querySelectorAll('.lyric-cue');
    expect(lineElements[1].classList.contains('active-cue')).toBe(true);
    expect(lineElements[0].classList.contains('active-cue')).toBe(false);
    expect(lineElements[2].classList.contains('active-cue')).toBe(false);

    // Time at 8.2s should activate line index 2 (8000ms cue)
    eventBus.publish(DomainEvents.PLAYBACK_TIME_UPDATED, { positionMs: 8200, durationMs: 180000 });
    expect(lineElements[2].classList.contains('active-cue')).toBe(true);
    expect(lineElements[1].classList.contains('active-cue')).toBe(false);
  });

  it('invokes playbackManager.seek() when a synchronized cue is clicked', async () => {
    component.mount(container, sampleTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    const lineElements = container.querySelectorAll<HTMLElement>('.lyric-cue');
    lineElements[2].click(); // Click 3rd line (8000ms)

    expect(mockPlaybackManager.seek).toHaveBeenCalledWith(8000);
  });

  it('renders plain text correctly for unsynchronized lyrics', async () => {
    (mockLyricsService.getLyrics as any).mockResolvedValueOnce({
      id: 'lyr_plain',
      trackId: 'track_test_1',
      type: 'plain',
      plainText: 'Just some poetry lyrics\nNo timestamps here',
      lines: [],
      updatedAt: Date.now()
    });

    component.mount(container, sampleTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    const plainEl = container.querySelector('.plain-lyrics-content');
    expect(plainEl).not.toBeNull();
    expect(plainEl?.textContent).toContain('Just some poetry lyrics');
    expect(plainEl?.textContent).toContain('No timestamps here');
  });

  it('renders unavailable state when track has no lyrics', async () => {
    (mockLyricsService.getLyrics as any).mockResolvedValueOnce(null);

    component.mount(container, sampleTrack);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(container.textContent).toContain('No Lyrics Available');
    expect(container.textContent).toContain('No lyrics found for "Test Song"');
  });

  it('cleans up event subscriptions on unmount', () => {
    component.mount(container, sampleTrack);
    component.unmount();

    expect(container.innerHTML).toBe('');
    // Emitting event after unmount should not throw
    expect(() => {
      eventBus.publish(DomainEvents.PLAYBACK_TIME_UPDATED, { positionMs: 5000, durationMs: 180000 });
    }).not.toThrow();
  });
});
