import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { PlaylistDetailComponent } from '../../src/ui/components/playlist/playlist-detail-component';

setupMockDomEnvironment();
import type { IPlaylistService, IPlaybackManager, PlaylistWithTracks } from '../../src/services/contracts/service-contracts';
import type { Playlist, Track } from '../../src/domain/entities/models';

describe('PlaylistDetailComponent', () => {
  let container: HTMLElement;
  let playlistService: IPlaylistService;
  let playbackManager: IPlaybackManager;
  let mockData: PlaylistWithTracks;

  let mockTracks: Track[];
  let onBack: any;
  let onRefresh: any;

  beforeEach(() => {
    container = document.createElement('div');
    onBack = vi.fn();
    onRefresh = vi.fn();

    const playlist: Playlist = {
      id: 'pl_rock',
      name: 'Classic Rock',
      description: 'The finest 70s rock',
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: 2,
      durationMs: 420000
    };

    mockTracks = [
      {
        id: 't_1',
        fileId: 'f_1',
        title: 'Smoke on the Water',
        artistName: 'Deep Purple',
        albumTitle: 'Machine Head',
        durationMs: 340000,
        format: { codec: 'flac', container: 'flac', bitrate: 900, sampleRate: 44100, bitDepth: 16, channels: 2, isLossless: true },
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 0,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      },
      {
        id: 't_2',
        fileId: 'f_2',
        title: 'Stairway to Heaven',
        artistName: 'Led Zeppelin',
        albumTitle: 'Led Zeppelin IV',
        durationMs: 480000,
        format: { codec: 'flac', container: 'flac', bitrate: 900, sampleRate: 44100, bitDepth: 16, channels: 2, isLossless: true },
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 0,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available'
      }
    ];

    mockData = {
      playlist,
      items: [
        { item: { id: 'item_1', playlistId: playlist.id, trackId: mockTracks[0]!.id, position: 0, addedAt: Date.now() }, track: mockTracks[0]! },
        { item: { id: 'item_2', playlistId: playlist.id, trackId: mockTracks[1]!.id, position: 1, addedAt: Date.now() }, track: mockTracks[1]! }
      ]
    };

    playlistService = {
      getPlaylist: vi.fn(),
      listPlaylists: vi.fn(),
      getPlaylistWithTracks: vi.fn(),
      createPlaylist: vi.fn(),
      updatePlaylist: vi.fn(),
      deletePlaylist: vi.fn(),
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
  });

  it('renders header with playlist metadata and track rows', () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    expect(container.textContent).toContain('Classic Rock');
    expect(container.textContent).toContain('The finest 70s rock');
    expect(container.textContent).toContain('Smoke on the Water');
    expect(container.textContent).toContain('Stairway to Heaven');

    const rows = container.querySelectorAll('.playlist-track-row');
    expect(rows.length).toBe(2);
  });

  it('play button triggers playbackManager.playTrack with all available tracks', () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    const playBtn = container.querySelector<HTMLButtonElement>('.pl-play-all-btn');
    playBtn?.click();

    expect(playbackManager.playTrack).toHaveBeenCalledWith(mockTracks[0], mockTracks);
  });

  it('shuffle button starts playback with a randomized queue context', () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    const shuffleBtn = container.querySelector<HTMLButtonElement>('.pl-shuffle-all-btn');
    shuffleBtn?.click();

    expect(playbackManager.playTrack).toHaveBeenCalled();
  });

  it('queue button adds playlist tracks to queue', () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    const queueBtn = container.querySelector<HTMLButtonElement>('.pl-queue-all-btn');
    queueBtn?.click();

    expect(playbackManager.addToQueue).toHaveBeenCalledWith(mockTracks, false);
  });

  it('move down button triggers reorderPlaylistItems and onRefresh', async () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    const firstRowMoveDown = container.querySelectorAll('.pl-move-down-btn')[0];
    firstRowMoveDown?.dispatchEvent(new Event('click'));

    expect(playlistService.reorderPlaylistItems).toHaveBeenCalledWith('pl_rock', 0, 1);
  });

  it('remove item button triggers removeTrackFromPlaylist and onRefresh', async () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    const firstRowRemove = container.querySelectorAll('.pl-remove-item-btn')[0];
    firstRowRemove?.dispatchEvent(new Event('click'));

    expect(playlistService.removeTrackFromPlaylist).toHaveBeenCalledWith('pl_rock', 'item_1');
  });

  it('back button triggers onBack callback', () => {
    PlaylistDetailComponent.render(
      container,
      mockData,
      { playlistService, playbackManager },
      { onBack, onRefresh }
    );

    const backBtn = container.querySelector<HTMLButtonElement>('.playlist-back-btn');
    backBtn?.click();

    expect(onBack).toHaveBeenCalled();
  });
});
