import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { HomeView } from '../../src/ui/views/home-view';
import { EventBus } from '../../src/core/events/event-bus';
import type { ILibraryService, IPlaybackManager, IArtworkService, IPlaylistService } from '../../src/services/contracts/service-contracts';
import { RouterService } from '../../src/ui/navigation/router-service';

setupMockDomEnvironment();

describe('HomeView Rebuild Component', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockLibraryService: any;
  let mockPlaybackManager: any;
  let mockArtworkService: any;
  let mockPlaylistService: any;
  let router: RouterService;
  let homeView: HomeView;

  const sampleTracks: any[] = [
    {
      id: 'track-1',
      title: 'Midnight City',
      artistName: 'M83',
      albumTitle: 'Hurry Up, We\'re Dreaming',
      durationMs: 243000,
      path: '/music/midnight.mp3',
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 10,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    },
    {
      id: 'track-2',
      title: 'Starboy',
      artistName: 'The Weeknd',
      albumTitle: 'Starboy',
      durationMs: 230000,
      path: '/music/starboy.mp3',
      format: { container: 'flac', codec: 'flac', sampleRate: 48000, bitDepth: 24, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 20,
      isFavorite: true,
      hasLyrics: true,
      availability: 'available'
    }
  ];

  const sampleArtists: any[] = [
    { id: 'art-1', name: 'M83', trackCount: 12, albumCount: 2 },
    { id: 'art-2', name: 'The Weeknd', trackCount: 45, albumCount: 4 }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();
    router = new RouterService('home');

    mockLibraryService = {
      listTracks: vi.fn().mockResolvedValue({ items: sampleTracks, total: 2 }),
      listArtists: vi.fn().mockResolvedValue({ items: sampleArtists, total: 2 }),
      getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 150, albumCount: 12, artistCount: 25 })
    };

    mockPlaybackManager = {
      playTrack: vi.fn().mockResolvedValue(undefined),
      playQueueIndex: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined),
      queue: sampleTracks,
      currentQueueIndex: 0
    };

    mockArtworkService = {
      getArtworkUrl: vi.fn().mockResolvedValue('blob:http://localhost/artwork-uuid')
    };

    mockPlaylistService = {
      listPlaylists: vi.fn().mockResolvedValue({ items: [], total: 5 })
    };

    homeView = new HomeView(mockLibraryService as ILibraryService, {
      playbackManager: mockPlaybackManager as IPlaybackManager,
      router,
      artworkService: mockArtworkService as IArtworkService,
      playlistService: mockPlaylistService as IPlaylistService,
      eventBus
    });
  });

  afterEach(() => {
    homeView.unmount();
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  it('mounts properly and renders hero, mood pills, quick actions, stats, and mixes', async () => {
    homeView.mount(container);
    expect(container.innerHTML).toContain('Music For A');
    expect(container.innerHTML).toContain('Made For You');
    expect(container.querySelector('#home-dynamic-sections-container')).not.toBeNull();
    expect(container.querySelector('#home-section-recently-played')).not.toBeNull();
    expect(container.innerHTML).toContain('Top Artists');
    expect(container.innerHTML).toContain('Top Genres');
    expect(container.innerHTML).toContain('Quick Actions');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockLibraryService.listTracks).toHaveBeenCalled();
    expect(mockLibraryService.getLibraryStats).toHaveBeenCalled();
  });

  it('handles mood pill selection and toggles active state', () => {
    homeView.mount(container);
    const pills = Array.from(container.querySelectorAll('.home-mood-pill'));
    expect(pills.length).toBeGreaterThan(0);

    const chillPill = pills.find(p => p.getAttribute('data-mood') === 'Chill');
    expect(chillPill).toBeDefined();

    chillPill?.dispatchEvent(new Event('click'));
    expect(chillPill?.classList.contains('active')).toBe(true);
  });

  it('triggers playback when play now button is clicked', async () => {
    homeView.mount(container);
    await new Promise(resolve => setTimeout(resolve, 50));

    const playBtn = container.querySelector('#home-hero-play-btn');
    expect(playBtn).toBeDefined();

    playBtn?.dispatchEvent(new Event('click'));
    expect(mockPlaybackManager.playTrack).toHaveBeenCalledWith(sampleTracks[0], expect.any(Array));
  });

  it('triggers shuffle playback when shuffle button is clicked', async () => {
    homeView.mount(container);
    await new Promise(resolve => setTimeout(resolve, 50));

    const shuffleBtn = container.querySelector('#home-hero-shuffle-btn');
    expect(shuffleBtn).toBeDefined();

    shuffleBtn?.dispatchEvent(new Event('click'));
    expect(mockPlaybackManager.playTrack).toHaveBeenCalled();
  });

  it('navigates to respective routes on quick action clicks', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    homeView.mount(container);

    const createPlaylistBtn = container.querySelector('#action-create-playlist');
    createPlaylistBtn?.dispatchEvent(new Event('click'));
    expect(navigateSpy).toHaveBeenCalledWith('playlists');

    const likedBtn = container.querySelector('#action-liked-songs');
    likedBtn?.dispatchEvent(new Event('click'));
    expect(navigateSpy).toHaveBeenCalledWith('library', { tab: 'favorites' });

    const galaxyBtn = container.querySelector('#action-audio-galaxy');
    galaxyBtn?.dispatchEvent(new Event('click'));
    expect(navigateSpy).toHaveBeenCalledWith('galaxy');
  });

  it('renders empty state when library has no songs', async () => {
    mockLibraryService.listTracks = vi.fn().mockResolvedValue({ items: [], total: 0 });
    homeView.mount(container);
    await new Promise(resolve => setTimeout(resolve, 50));

    const recentContainer = container.querySelector('#home-recent-tracks-container');
    expect(recentContainer?.innerHTML).toContain('Your Library is Ready');
  });
});
