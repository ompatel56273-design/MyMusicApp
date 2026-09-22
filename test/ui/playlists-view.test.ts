import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { PlaylistsView } from '../../src/ui/views/playlists-view';

setupMockDomEnvironment();
import { RouterService } from '../../src/ui/navigation/router-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { IPlaylistService, IPlaybackManager, PlaylistWithTracks } from '../../src/services/contracts/service-contracts';
import type { Playlist, Track } from '../../src/domain/entities/models';

describe('PlaylistsView', () => {
  let container: HTMLElement;
  let playlistService: IPlaylistService;
  let playbackManager: IPlaybackManager;
  let eventBus: EventBus;
  let router: RouterService;
  let view: PlaylistsView;

  let mockPlaylists: Playlist[];

  beforeEach(() => {
    container = document.createElement('div');
    eventBus = new EventBus();
    router = new RouterService('playlists');

    mockPlaylists = [
      {
        id: 'pl_1',
        name: 'Road Trip',
        description: 'Driving tunes',
        isSmart: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        trackCount: 3,
        durationMs: 600000
      },
      {
        id: 'pl_2',
        name: 'Chill Out',
        isSmart: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        trackCount: 1,
        durationMs: 180000
      }
    ];

    playlistService = {
      getPlaylist: vi.fn(async (id: string) => mockPlaylists.find(p => p.id === id) ?? null),
      listPlaylists: vi.fn(async () => ({ items: mockPlaylists, total: mockPlaylists.length, offset: 0, limit: 50 })),
      getPlaylistWithTracks: vi.fn(async (id: string): Promise<PlaylistWithTracks | null> => {
        const pl = mockPlaylists.find(p => p.id === id);
        if (!pl) return null;
        const mockTrack: Track = {
          id: 't_1',
          fileId: 'f_1',
          title: 'Highway Star',
          durationMs: 200000,
          format: { codec: 'flac', container: 'flac', bitrate: 900, sampleRate: 44100, bitDepth: 16, channels: 2, isLossless: true },
          dateAdded: Date.now(),
          dateModified: Date.now(),
          playCount: 0,
          isFavorite: false,
          hasLyrics: false,
          availability: 'available'
        };
        return {
          playlist: pl,
          items: [{ item: { id: 'item_1', playlistId: pl.id, trackId: mockTrack.id, position: 0, addedAt: Date.now() }, track: mockTrack }]
        };
      }),
      createPlaylist: vi.fn(async (name: string, description?: string) => {
        const pl: Playlist = {
          id: `pl_${Date.now()}`,
          name,
          description,
          isSmart: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trackCount: 0,
          durationMs: 0
        };
        mockPlaylists.push(pl);
        return pl;
      }),
      updatePlaylist: vi.fn(),
      deletePlaylist: vi.fn(async (id: string) => {
        mockPlaylists = mockPlaylists.filter(p => p.id !== id);
      }),
      addTracksToPlaylist: vi.fn(),
      removeTrackFromPlaylist: vi.fn(),
      reorderPlaylistItems: vi.fn()
    };

    playbackManager = {
      state: 'idle',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1.0,
      isMuted: false,
      playbackRate: 1.0,
      repeatMode: 'off',
      shuffleMode: 'off',
      queue: [],
      currentQueueIndex: -1,
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

    view = new PlaylistsView({
      playlistService,
      playbackManager,
      eventBus,
      router
    });
  });

  it('renders gallery with playlist cards', async () => {
    view.mount(container);
    await vi.waitFor(() => {
      const cards = container.querySelectorAll('.playlist-card');
      expect(cards.length).toBe(2);
    });

    expect(container.textContent).toContain('Road Trip');
    expect(container.textContent).toContain('Chill Out');
  });

  it('renders empty state when no playlists exist', async () => {
    mockPlaylists = [];
    view.mount(container);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No playlists created yet');
    });
  });

  it('filters playlists in gallery mode', async () => {
    view.mount(container);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.playlist-card').length).toBe(2);
    });

    const filterInput = container.querySelector<HTMLInputElement>('.playlist-filter-input');
    expect(filterInput).not.toBeNull();

    filterInput!.value = 'Road';
    filterInput!.dispatchEvent(new Event('input'));

    await vi.waitFor(() => {
      const cards = container.querySelectorAll('.playlist-card');
      expect(cards.length).toBe(1);
      expect(container.textContent).toContain('Road Trip');
      expect(container.textContent).not.toContain('Chill Out');
    });
  });

  it('navigates to detail view when a playlist card is clicked', async () => {
    view.mount(container);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.playlist-card').length).toBe(2);
    });

    const firstCard = container.querySelector<HTMLElement>('.playlist-card');
    firstCard?.click();

    await vi.waitFor(() => {
      expect(container.querySelector('.playlist-detail-view')).not.toBeNull();
      expect(container.textContent).toContain('Highway Star');
    });
  });

  it('quick play button on card triggers playbackManager.playTrack', async () => {
    view.mount(container);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.playlist-card').length).toBe(2);
    });

    const quickPlayBtn = container.querySelector<HTMLButtonElement>('.playlist-quick-play-btn');
    quickPlayBtn?.click();

    await vi.waitFor(() => {
      expect(playbackManager.playTrack).toHaveBeenCalled();
    });
  });

  it('subscribes to PLAYLIST_UPDATED and updates view', async () => {
    view.mount(container);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.playlist-card').length).toBe(2);
    });

    mockPlaylists.push({
      id: 'pl_3',
      name: 'Workout Beats',
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: 0,
      durationMs: 0
    });

    eventBus.publish(DomainEvents.PLAYLIST_UPDATED, {
      playlist: mockPlaylists[2]!,
      action: 'created'
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Workout Beats');
    });
  });

  it('unmount cleans up subscriptions and container', () => {
    view.mount(container);
    view.unmount();
    expect(container.innerHTML).toBe('');
  });
});
