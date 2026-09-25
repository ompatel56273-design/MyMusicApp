import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { StatsView } from '../../src/ui/views/stats-view';

setupMockDomEnvironment();

describe('StatsView with Library Analytics Integration', () => {
  let mockStatsService: any;
  let mockAnalyticsService: any;
  let statsView: StatsView;
  let container: HTMLElement;

  const mockAnalyticsSnapshot: any = {
    timestamp: 1600000000000,
    summary: {
      totalTracks: 83,
      totalArtists: 5,
      totalAlbums: 10,
      totalGenres: 4,
      totalPlaylists: 2,
      totalDurationMs: 12000000,
      totalStorageBytes: 500000000,
      availableTracks: 80,
      missingTracks: 3,
      unverifiableTracks: 0,
      duplicateGroupsCount: 1,
      duplicateTracksCount: 1,
      favoriteTracksCount: 12,
      totalPlays: 150,
      totalListeningTimeMs: 10000000
    },
    topArtists: [
      { artistName: 'Linkin Park', trackCount: 20, playCount: 80, totalListeningTimeMs: 5000000 }
    ],
    topAlbums: [
      { albumTitle: 'Meteora', artistName: 'Linkin Park', trackCount: 12, playCount: 50, year: 2003 }
    ],
    genreBreakdown: [
      { genreName: 'Rock', trackCount: 40, playCount: 90, percentageShare: 48 }
    ],
    storage: {
      totalStorageBytes: 500000000,
      averageFileSizeBytes: 6024096,
      formats: [
        { formatName: 'MP3', isLossless: false, trackCount: 60, totalSizeBytes: 300000000, percentageShare: 72 },
        { formatName: 'FLAC', isLossless: true, trackCount: 23, totalSizeBytes: 200000000, percentageShare: 28 }
      ],
      losslessTrackCount: 23,
      lossyTrackCount: 60
    },
    trackInsights: {
      topPlayedTracks: [],
      recentlyPlayedTracks: [],
      favoriteTracks: [],
      neverPlayedCount: 10,
      longestTrack: null,
      shortestTrack: null
    },
    activity: [
      { dateStr: '2026-09-25', dayLabel: 'Fri', timestamp: Date.now(), playsCount: 10, durationMs: 1800000 }
    ],
    growthTimeline: [],
    calculationDurationMs: 15
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockStatsService = {
      getOverview: vi.fn().mockResolvedValue({
        totalSongs: 83,
        totalArtists: 5,
        totalAlbums: 10,
        totalGenres: 4,
        totalListeningTimeMs: 10000000,
        totalPlays: 150,
        favoriteSongsCount: 12
      }),
      getTopSongs: vi.fn().mockResolvedValue([]),
      getTopArtists: vi.fn().mockResolvedValue([]),
      getTopAlbums: vi.fn().mockResolvedValue([]),
      getRecentHistory: vi.fn().mockResolvedValue([]),
      getListeningActivity: vi.fn().mockResolvedValue([])
    };

    mockAnalyticsService = {
      getAnalyticsSnapshot: vi.fn().mockResolvedValue(mockAnalyticsSnapshot),
      getCachedSnapshot: vi.fn().mockReturnValue(mockAnalyticsSnapshot)
    };
  });

  afterEach(() => {
    if (statsView) {
      statsView.unmount();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should render header, overview metrics, storage & formats section, and genre breakdown', async () => {
    statsView = new StatsView({
      statsService: mockStatsService,
      analyticsService: mockAnalyticsService
    });

    statsView.mount(container);

    // Wait for loadStatistics async promise
    await statsView.loadStatistics();

    expect(container.textContent).toContain('Music Statistics');
    expect(container.textContent).toContain('83'); // Total songs
    expect(container.textContent).toContain('Audio Storage & Formats');
    expect(container.textContent).toContain('Lossless Tracks');
    expect(container.textContent).toContain('FLAC');
    expect(container.textContent).toContain('Genre Distribution');
    expect(container.textContent).toContain('Rock');
  });

  it('should refresh stats when Refresh button is clicked', async () => {
    statsView = new StatsView({
      statsService: mockStatsService,
      analyticsService: mockAnalyticsService
    });

    statsView.mount(container);
    await statsView.loadStatistics();

    const refreshBtn = container.querySelector<HTMLButtonElement>('#stats-refresh-btn');
    expect(refreshBtn).not.toBeNull();

    refreshBtn?.click();
    expect(mockAnalyticsService.getAnalyticsSnapshot).toHaveBeenCalled();
  });
});
