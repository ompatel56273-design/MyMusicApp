import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { StatsView } from '../../src/ui/views/stats-view';
import type { StatsService } from '../../src/services/stats/stats-service';
import { EventBus } from '../../src/core/events/event-bus';

setupMockDomEnvironment();

describe('StatsView', () => {
  let mockStatsService: any;
  let mockPlaybackManager: any;
  let eventBus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    eventBus = new EventBus();
    container = document.createElement('div');

    mockStatsService = {
      getOverview: vi.fn().mockResolvedValue({
        totalSongs: 120,
        totalArtists: 35,
        totalAlbums: 18,
        totalGenres: 8,
        totalListeningTimeMs: 7200000, // 2 hours
        totalPlays: 350,
        favoriteSongsCount: 25
      }),
      getTopSongs: vi.fn().mockResolvedValue([
        {
          track: {
            id: 'track_1',
            title: 'Electric Dreams',
            artistName: 'Cyber Artist',
            albumTitle: 'Neon Odyssey',
            durationMs: 215000,
            playCount: 42,
            availability: 'available'
          },
          playCount: 42
        }
      ]),
      getTopArtists: vi.fn().mockResolvedValue([
        {
          artistName: 'Cyber Artist',
          playCount: 95,
          trackCount: 6
        }
      ]),
      getTopAlbums: vi.fn().mockResolvedValue([
        {
          albumTitle: 'Neon Odyssey',
          artistName: 'Cyber Artist',
          playCount: 95,
          trackCount: 6
        }
      ]),
      getRecentHistory: vi.fn().mockResolvedValue([
        {
          historyId: 'h_1',
          track: {
            id: 'track_1',
            title: 'Electric Dreams',
            artistName: 'Cyber Artist',
            albumTitle: 'Neon Odyssey',
            durationMs: 215000,
            playCount: 42,
            availability: 'available'
          },
          playedAt: Date.now() - 60000,
          durationListenedMs: 215000,
          completed: true
        }
      ]),
      getListeningActivity: vi.fn().mockResolvedValue([
        { dateStr: '2026-09-23', dayLabel: 'Wed', timestamp: Date.now(), playsCount: 15, durationMs: 1800000 }
      ])
    };

    mockPlaybackManager = {
      playTrack: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('mounts and renders real overview statistics correctly', async () => {
    const view = new StatsView({
      statsService: mockStatsService as unknown as StatsService,
      playbackManager: mockPlaybackManager,
      eventBus
    });

    view.mount(container);
    await view.loadStatistics();

    const text = container.textContent || '';
    expect(text).toContain('Music Statistics');
    expect(text).toContain('120'); // Total songs
    expect(text).toContain('35'); // Artists
    expect(text).toContain('18'); // Albums
    expect(text).toContain('2h 0m'); // Time listened
    expect(text).toContain('350'); // Total plays
    expect(text).toContain('Electric Dreams');
    expect(text).toContain('Cyber Artist');
    expect(text).toContain('Neon Odyssey');

    view.unmount();
    expect(container.innerHTML).toBe('');
  });

  it('triggers track playback when clicking play button on top songs', async () => {
    const view = new StatsView({
      statsService: mockStatsService as unknown as StatsService,
      playbackManager: mockPlaybackManager,
      eventBus
    });

    view.mount(container);
    await view.loadStatistics();

    const playBtn = container.querySelector<HTMLButtonElement>('[data-play-track-id="track_1"]');
    expect(playBtn).not.toBeNull();

    playBtn?.click();
    expect(mockPlaybackManager.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'track_1', title: 'Electric Dreams' })
    );

    view.unmount();
  });

  it('renders honest empty states when library has no listening history', async () => {
    mockStatsService.getOverview.mockResolvedValue({
      totalSongs: 0,
      totalArtists: 0,
      totalAlbums: 0,
      totalGenres: 0,
      totalListeningTimeMs: 0,
      totalPlays: 0,
      favoriteSongsCount: 0
    });
    mockStatsService.getTopSongs.mockResolvedValue([]);
    mockStatsService.getTopArtists.mockResolvedValue([]);
    mockStatsService.getTopAlbums.mockResolvedValue([]);
    mockStatsService.getRecentHistory.mockResolvedValue([]);
    mockStatsService.getListeningActivity.mockResolvedValue([]);

    const view = new StatsView({
      statsService: mockStatsService as unknown as StatsService,
      playbackManager: mockPlaybackManager,
      eventBus
    });

    view.mount(container);
    await view.loadStatistics();

    const text = container.textContent || '';
    expect(text).toContain('No Top Tracks Yet');
    expect(text).toContain('No Artist Data Yet');
    expect(text).toContain('No Album Data Yet');
    expect(text).toContain('No Listening History');
    expect(text).toContain('0 min');

    view.unmount();
  });
});
