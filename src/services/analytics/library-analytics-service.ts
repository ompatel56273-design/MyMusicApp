import type {
  ITrackRepository,
  IAudioFileRepository,
  IArtistRepository,
  IAlbumRepository,
  IGenreRepository,
  IPlaylistRepository,
  IHistoryRepository
} from '../../domain/repositories/repository-contracts';
import type { Track } from '../../domain/entities/models';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';
import type { StatsService } from '../stats/stats-service';
import type {
  LibraryAnalyticsSnapshot,
  LibraryAnalyticsSummary,
  ArtistAnalyticsItem,
  AlbumAnalyticsItem,
  GenreAnalyticsItem,
  StorageAnalytics,
  FormatAnalyticsItem,
  TrackAnalyticsSummary,
  ListeningActivityItem,
  LibraryGrowthItem
} from '../../domain/entities/library-analytics-types';

export interface LibraryAnalyticsServiceDependencies {
  trackRepo: ITrackRepository;
  audioFileRepo?: IAudioFileRepository | undefined;
  artistRepo?: IArtistRepository | undefined;
  albumRepo?: IAlbumRepository | undefined;
  genreRepo?: IGenreRepository | undefined;
  playlistRepo?: IPlaylistRepository | undefined;
  historyRepo?: IHistoryRepository | undefined;
  statsService?: StatsService | undefined;
  libraryService?: any;
  libraryHealthService?: any;
  duplicateDetectorService?: any;
  eventBus?: EventBus | undefined;
}

/**
 * Authoritative Read-Only Library Analytics Service.
 * Derives comprehensive local-only analytics from application repositories, statistics,
 * health, and duplicate services without mutating data or duplicating sources of truth.
 */
export class LibraryAnalyticsService {
  private readonly logger = new Logger('LibraryAnalyticsService');
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo?: IAudioFileRepository | undefined;
  private readonly artistRepo?: IArtistRepository | undefined;
  private readonly albumRepo?: IAlbumRepository | undefined;
  private readonly genreRepo?: IGenreRepository | undefined;
  private readonly playlistRepo?: IPlaylistRepository | undefined;
  private readonly historyRepo?: IHistoryRepository | undefined;
  private readonly statsService?: StatsService | undefined;
  private readonly libraryHealthService?: any;
  private readonly duplicateDetectorService?: any;
  private readonly eventBus?: EventBus | undefined;

  private cachedSnapshot: LibraryAnalyticsSnapshot | null = null;

  constructor(deps: LibraryAnalyticsServiceDependencies) {
    this.trackRepo = deps.trackRepo;
    this.audioFileRepo = deps.audioFileRepo;
    this.artistRepo = deps.artistRepo;
    this.albumRepo = deps.albumRepo;
    this.genreRepo = deps.genreRepo;
    this.playlistRepo = deps.playlistRepo;
    this.historyRepo = deps.historyRepo;
    this.statsService = deps.statsService;
    this.libraryHealthService = deps.libraryHealthService;
    this.duplicateDetectorService = deps.duplicateDetectorService;
    this.eventBus = deps.eventBus;

    if (this.historyRepo) {
      // Retained reference for history-based analytics queries
    }

    this.subscribeEvents();
  }

  private subscribeEvents(): void {
    if (!this.eventBus) return;

    const invalidatingEvents = [
      DomainEvents.LIBRARY_UPDATED,
      DomainEvents.TRACK_CHANGED,
      DomainEvents.PLAYBACK_STATE_CHANGED,
      DomainEvents.FAVORITE_CHANGED,
      DomainEvents.PLAYLIST_UPDATED
    ];

    for (const evt of invalidatingEvents) {
      this.eventBus.subscribe(evt, () => {
        this.invalidateCache();
      });
    }
  }

  public getCachedSnapshot(): LibraryAnalyticsSnapshot | null {
    return this.cachedSnapshot;
  }

  public invalidateCache(): void {
    if (this.cachedSnapshot) {
      this.cachedSnapshot = null;
      this.logger.info('Library analytics cache invalidated.');
    }
  }

  /**
   * Computes an immutable analytics snapshot derived from authoritative repositories.
   */
  public async getAnalyticsSnapshot(options?: { forceRefresh?: boolean }): Promise<LibraryAnalyticsSnapshot> {
    if (this.cachedSnapshot && !options?.forceRefresh) {
      return this.cachedSnapshot;
    }

    const startTime = performance.now();

    try {
      // Fetch all tracks and file paths concurrently
      const [trackListResult, audioFileMap, artistListResult, albumListResult, genreListResult, playlistListResult] =
        await Promise.all([
          this.trackRepo.list({ limit: 50000 }),
          this.audioFileRepo && typeof this.audioFileRepo.listAllPaths === 'function'
            ? this.audioFileRepo.listAllPaths()
            : Promise.resolve(new Map<string, { id: string; sizeBytes: number; modifiedTimeMs: number }>()),
          this.artistRepo && typeof this.artistRepo.list === 'function' ? this.artistRepo.list({ limit: 1 }) : Promise.resolve({ total: 0, items: [], offset: 0, limit: 1 }),
          this.albumRepo && typeof this.albumRepo.list === 'function' ? this.albumRepo.list({ limit: 1 }) : Promise.resolve({ total: 0, items: [], offset: 0, limit: 1 }),
          this.genreRepo && typeof this.genreRepo.list === 'function' ? this.genreRepo.list({ limit: 1 }) : Promise.resolve({ total: 0, items: [], offset: 0, limit: 1 }),
          this.playlistRepo && typeof this.playlistRepo.list === 'function' ? this.playlistRepo.list({ limit: 1 }) : Promise.resolve({ total: 0, items: [], offset: 0, limit: 1 })
        ]);

      const tracks: readonly Track[] = trackListResult.items;

      // Compute statistics overview if service present
      const overviewStats = this.statsService
        ? await this.statsService.getOverview()
        : null;

      // File availability counts
      let availableTracks = 0;
      let missingTracks = 0;
      let unverifiableTracks = 0;
      let totalDurationMs = 0;
      let totalStorageBytes = 0;
      let favoriteTracksCount = 0;
      let totalPlays = 0;
      let neverPlayedCount = 0;

      let longestTrack: Track | null = null;
      let shortestTrack: Track | null = null;
      const favoriteTracks: Track[] = [];
      const playedTracks: { track: Track; playCount: number; lastPlayedAt?: number }[] = [];

      const artistMap = new Map<string, { artistName: string; artistId?: string; trackCount: number; playCount: number; artworkId?: string }>();
      const albumMap = new Map<string, { albumTitle: string; artistName: string; albumId?: string; trackCount: number; playCount: number; year?: number; artworkId?: string }>();
      const genreMap = new Map<string, { genreName: string; trackCount: number; playCount: number }>();
      const formatMap = new Map<string, { formatName: string; isLossless: boolean; trackCount: number; totalSizeBytes: number }>();

      let losslessCount = 0;
      let lossyCount = 0;

      for (const track of tracks) {
        // File availability
        const avail = (track.availability as string) || 'available';
        if (avail === 'missing') {
          missingTracks++;
        } else if (avail === 'unverifiable') {
          unverifiableTracks++;
        } else {
          availableTracks++;
        }

        // Duration & Size
        if (track.durationMs && track.durationMs > 0) {
          totalDurationMs += track.durationMs;

          if (!longestTrack || track.durationMs > (longestTrack.durationMs || 0)) {
            longestTrack = track;
          }
          if (!shortestTrack || (track.durationMs < (shortestTrack.durationMs || Infinity) && track.durationMs > 1000)) {
            shortestTrack = track;
          }
        }

        let fileSize = (track as any).fileSize ?? 0;
        if (fileSize === 0 && track.fileId) {
          for (const val of audioFileMap.values()) {
            if (val.id === track.fileId) {
              fileSize = val.sizeBytes;
              break;
            }
          }
        }
        totalStorageBytes += fileSize;

        // Favorites
        if (track.isFavorite) {
          favoriteTracksCount++;
          favoriteTracks.push(track);
        }

        // Plays
        const pCount = track.playCount || 0;
        totalPlays += pCount;
        if (pCount > 0) {
          const playedItem: { track: Track; playCount: number; lastPlayedAt?: number } = {
            track,
            playCount: pCount
          };
          if (track.lastPlayedAt !== undefined) {
            playedItem.lastPlayedAt = track.lastPlayedAt;
          }
          playedTracks.push(playedItem);
        } else {
          neverPlayedCount++;
        }

        // Artists
        const artistName = (track.artistName && track.artistName.trim()) || 'Unknown Artist';
        const existingArtist = artistMap.get(artistName);
        if (existingArtist) {
          existingArtist.trackCount++;
          existingArtist.playCount += pCount;
        } else {
          const artistItem: { artistName: string; artistId?: string; trackCount: number; playCount: number; artworkId?: string } = {
            artistName,
            trackCount: 1,
            playCount: pCount
          };
          if (track.artistId !== undefined) artistItem.artistId = track.artistId;
          if (track.artworkId !== undefined) artistItem.artworkId = track.artworkId;
          artistMap.set(artistName, artistItem);
        }

        // Albums
        const albumTitle = (track.albumTitle && track.albumTitle.trim()) || 'Unknown Album';
        const albumKey = `${albumTitle}:::${artistName}`;
        const existingAlbum = albumMap.get(albumKey);
        if (existingAlbum) {
          existingAlbum.trackCount++;
          existingAlbum.playCount += pCount;
        } else {
          const albumItem: { albumTitle: string; artistName: string; albumId?: string; trackCount: number; playCount: number; year?: number; artworkId?: string } = {
            albumTitle,
            artistName,
            trackCount: 1,
            playCount: pCount
          };
          if (track.albumId !== undefined) albumItem.albumId = track.albumId;
          if (track.year !== undefined) albumItem.year = track.year;
          if (track.artworkId !== undefined) albumItem.artworkId = track.artworkId;
          albumMap.set(albumKey, albumItem);
        }

        // Genres
        const genreName = (track.genreName && track.genreName.trim()) || 'Unknown Genre';
        const existingGenre = genreMap.get(genreName);
        if (existingGenre) {
          existingGenre.trackCount++;
          existingGenre.playCount += pCount;
        } else {
          genreMap.set(genreName, {
            genreName,
            trackCount: 1,
            playCount: pCount
          });
        }

        // Formats
        const container = (track.format?.container || 'unknown').toUpperCase();
        const isLossless = track.format?.isLossless ?? (container === 'FLAC' || container === 'WAV' || container === 'ALAC');
        if (isLossless) {
          losslessCount++;
        } else {
          lossyCount++;
        }

        const existingFormat = formatMap.get(container);
        if (existingFormat) {
          existingFormat.trackCount++;
          existingFormat.totalSizeBytes += fileSize;
        } else {
          formatMap.set(container, {
            formatName: container,
            isLossless,
            trackCount: 1,
            totalSizeBytes: fileSize
          });
        }
      }

      // Sort played tracks descending
      playedTracks.sort((a, b) => b.playCount - a.playCount);

      // Duplicate integration
      let duplicateGroupsCount = 0;
      let duplicateTracksCount = 0;
      if (this.duplicateDetectorService && typeof this.duplicateDetectorService.detectDuplicates === 'function') {
        try {
          const dupRes = await this.duplicateDetectorService.detectDuplicates();
          duplicateGroupsCount = dupRes.groups.length;
          duplicateTracksCount = dupRes.totalDuplicateCount;
        } catch {
          // Fallback if duplicate service fails
        }
      } else if (this.libraryHealthService && typeof this.libraryHealthService.getCachedSnapshot === 'function') {
        const cachedHealth = this.libraryHealthService.getCachedSnapshot();
        if (cachedHealth) {
          duplicateGroupsCount = cachedHealth.metrics.duplicateGroupsCount;
          duplicateTracksCount = cachedHealth.metrics.duplicateTracksCount;
        }
      }

      // Top artists
      const topArtists: ArtistAnalyticsItem[] = Array.from(artistMap.values())
        .sort((a, b) => b.playCount !== a.playCount ? b.playCount - a.playCount : b.trackCount - a.trackCount)
        .slice(0, 10)
        .map(a => {
          const item: ArtistAnalyticsItem = {
            artistName: a.artistName,
            trackCount: a.trackCount,
            playCount: a.playCount,
            totalListeningTimeMs: 0
          };
          if (a.artistId !== undefined) (item as any).artistId = a.artistId;
          if (a.artworkId !== undefined) (item as any).artworkId = a.artworkId;
          return item;
        });

      // Top albums
      const topAlbums: AlbumAnalyticsItem[] = Array.from(albumMap.values())
        .sort((a, b) => b.playCount !== a.playCount ? b.playCount - a.playCount : b.trackCount - a.trackCount)
        .slice(0, 10)
        .map(a => {
          const item: AlbumAnalyticsItem = {
            albumTitle: a.albumTitle,
            artistName: a.artistName,
            trackCount: a.trackCount,
            playCount: a.playCount
          };
          if (a.albumId !== undefined) (item as any).albumId = a.albumId;
          if (a.year !== undefined) (item as any).year = a.year;
          if (a.artworkId !== undefined) (item as any).artworkId = a.artworkId;
          return item;
        });

      // Genre breakdown
      const totalTracksCount = tracks.length || 1;
      const genreBreakdown: GenreAnalyticsItem[] = Array.from(genreMap.values())
        .sort((a, b) => b.trackCount - a.trackCount)
        .map(g => ({
          genreName: g.genreName,
          trackCount: g.trackCount,
          playCount: g.playCount,
          percentageShare: Math.round((g.trackCount / totalTracksCount) * 100)
        }));

      // Formats breakdown
      const formatBreakdown: FormatAnalyticsItem[] = Array.from(formatMap.values())
        .sort((a, b) => b.trackCount - a.trackCount)
        .map(f => ({
          formatName: f.formatName,
          isLossless: f.isLossless,
          trackCount: f.trackCount,
          totalSizeBytes: f.totalSizeBytes,
          percentageShare: Math.round((f.trackCount / totalTracksCount) * 100)
        }));

      // Storage Analytics
      const storage: StorageAnalytics = {
        totalStorageBytes,
        averageFileSizeBytes: tracks.length > 0 ? Math.round(totalStorageBytes / tracks.length) : 0,
        formats: formatBreakdown,
        losslessTrackCount: losslessCount,
        lossyTrackCount: lossyCount
      };

      // History & activity
      let recentHistory: readonly { historyId: string; track: Track; playedAt: number; durationListenedMs: number }[] = [];
      let activity: readonly ListeningActivityItem[] = [];

      if (this.statsService) {
        recentHistory = await this.statsService.getRecentHistory(15);
        activity = await this.statsService.getListeningActivity(7);
      }

      // Timeline growth
      const growthTimeline = this.computeGrowthTimeline(tracks);

      const endTime = performance.now();

      const summary: LibraryAnalyticsSummary = {
        totalTracks: tracks.length,
        totalArtists: artistListResult.total || artistMap.size,
        totalAlbums: albumListResult.total || albumMap.size,
        totalGenres: genreListResult.total || genreMap.size,
        totalPlaylists: playlistListResult.total || 0,
        totalDurationMs,
        totalStorageBytes,
        availableTracks,
        missingTracks,
        unverifiableTracks,
        duplicateGroupsCount,
        duplicateTracksCount,
        favoriteTracksCount,
        totalPlays: overviewStats?.totalPlays ?? totalPlays,
        totalListeningTimeMs: overviewStats?.totalListeningTimeMs ?? 0
      };

      const trackInsights: TrackAnalyticsSummary = {
        topPlayedTracks: playedTracks.slice(0, 10),
        recentlyPlayedTracks: recentHistory,
        favoriteTracks,
        neverPlayedCount,
        longestTrack,
        shortestTrack
      };

      this.cachedSnapshot = {
        timestamp: Date.now(),
        summary,
        topArtists,
        topAlbums,
        genreBreakdown,
        storage,
        trackInsights,
        activity,
        growthTimeline,
        calculationDurationMs: Math.round(endTime - startTime)
      };

      return this.cachedSnapshot;
    } catch (err) {
      this.logger.error('Failed to compute library analytics snapshot:', { error: String(err) });
      return this.createEmptySnapshot();
    }
  }

  private computeGrowthTimeline(tracks: readonly Track[]): readonly LibraryGrowthItem[] {
    const periodMap = new Map<string, { label: string; timestamp: number; count: number }>();

    for (const track of tracks) {
      const ts = (track as any).dateAdded || (track as any).createdAt;
      if (!ts) continue;

      const d = new Date(ts);
      const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const periodLabel = d.toLocaleDateString([], { month: 'short', year: 'numeric' });

      const existing = periodMap.get(periodKey);
      if (existing) {
        existing.count++;
      } else {
        periodMap.set(periodKey, {
          label: periodLabel,
          timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
          count: 1
        });
      }
    }

    return Array.from(periodMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(p => ({
        periodLabel: p.label,
        timestamp: p.timestamp,
        tracksAdded: p.count
      }));
  }

  private createEmptySnapshot(): LibraryAnalyticsSnapshot {
    return {
      timestamp: Date.now(),
      summary: {
        totalTracks: 0,
        totalArtists: 0,
        totalAlbums: 0,
        totalGenres: 0,
        totalPlaylists: 0,
        totalDurationMs: 0,
        totalStorageBytes: 0,
        availableTracks: 0,
        missingTracks: 0,
        unverifiableTracks: 0,
        duplicateGroupsCount: 0,
        duplicateTracksCount: 0,
        favoriteTracksCount: 0,
        totalPlays: 0,
        totalListeningTimeMs: 0
      },
      topArtists: [],
      topAlbums: [],
      genreBreakdown: [],
      storage: {
        totalStorageBytes: 0,
        averageFileSizeBytes: 0,
        formats: [],
        losslessTrackCount: 0,
        lossyTrackCount: 0
      },
      trackInsights: {
        topPlayedTracks: [],
        recentlyPlayedTracks: [],
        favoriteTracks: [],
        neverPlayedCount: 0,
        longestTrack: null,
        shortestTrack: null
      },
      activity: [],
      growthTimeline: [],
      calculationDurationMs: 0
    };
  }
}
