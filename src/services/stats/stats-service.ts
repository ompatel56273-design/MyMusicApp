import type {
  ITrackRepository,
  IArtistRepository,
  IAlbumRepository,
  IGenreRepository,
  IHistoryRepository
} from '../../domain/repositories/repository-contracts';
import type { Track, PlaybackHistoryItem } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { Logger } from '../../core/logging/logger';

export interface MusicStatsOverview {
  readonly totalSongs: number;
  readonly totalArtists: number;
  readonly totalAlbums: number;
  readonly totalGenres: number;
  readonly totalListeningTimeMs: number;
  readonly totalPlays: number;
  readonly favoriteSongsCount: number;
}

export interface TopSongItem {
  readonly track: Track;
  readonly playCount: number;
  readonly lastPlayedAt?: number | undefined;
}

export interface TopArtistItem {
  readonly artistName: string;
  readonly artistId?: EntityId | undefined;
  readonly playCount: number;
  readonly trackCount: number;
  readonly artworkId?: EntityId | undefined;
}

export interface TopAlbumItem {
  readonly albumTitle: string;
  readonly artistName: string;
  readonly albumId?: EntityId | undefined;
  readonly playCount: number;
  readonly trackCount: number;
  readonly year?: number | undefined;
  readonly artworkId?: EntityId | undefined;
}

export interface RecentHistoryItem {
  readonly historyId: string;
  readonly track: Track;
  readonly playedAt: number;
  readonly durationListenedMs: number;
  readonly completed: boolean;
}

export interface DailyActivityItem {
  readonly dateStr: string;
  readonly dayLabel: string;
  readonly timestamp: number;
  readonly playsCount: number;
  readonly durationMs: number;
}

export interface StatsServiceDependencies {
  trackRepo: ITrackRepository;
  artistRepo?: IArtistRepository | undefined;
  albumRepo?: IAlbumRepository | undefined;
  genreRepo?: IGenreRepository | undefined;
  historyRepo?: IHistoryRepository | undefined;
  dbAdapter?: IDatabaseAdapter | undefined;
}

/**
 * Music Statistics Service.
 * Aggregates real library and playback statistics from IndexedDB repositories.
 */
export class StatsService {
  private readonly logger = new Logger('StatsService');
  private readonly trackRepo: ITrackRepository;
  private readonly artistRepo?: IArtistRepository | undefined;
  private readonly albumRepo?: IAlbumRepository | undefined;
  private readonly genreRepo?: IGenreRepository | undefined;
  private readonly historyRepo?: IHistoryRepository | undefined;
  private readonly dbAdapter?: IDatabaseAdapter | undefined;

  constructor(deps: StatsServiceDependencies) {
    this.trackRepo = deps.trackRepo;
    this.artistRepo = deps.artistRepo;
    this.albumRepo = deps.albumRepo;
    this.genreRepo = deps.genreRepo;
    this.historyRepo = deps.historyRepo;
    this.dbAdapter = deps.dbAdapter;
  }

  /**
   * Retrieves high-level library and listening overview statistics.
   */
  public async getOverview(): Promise<MusicStatsOverview> {
    try {
      const [totalSongs, allTracksResult, artistsResult, albumsResult, genresResult] = await Promise.all([
        this.trackRepo.count(),
        this.trackRepo.list({ limit: 10000 }),
        this.artistRepo ? this.artistRepo.list({ limit: 10000 }) : Promise.resolve({ items: [], total: 0 }),
        this.albumRepo ? this.albumRepo.list({ limit: 10000 }) : Promise.resolve({ items: [], total: 0 }),
        this.genreRepo ? this.genreRepo.list({ limit: 10000 }) : Promise.resolve({ items: [], total: 0 })
      ]);

      const tracks = allTracksResult.items;
      let totalPlays = 0;
      let favoriteSongsCount = 0;

      for (const track of tracks) {
        totalPlays += (track.playCount || 0);
        if (track.isFavorite) {
          favoriteSongsCount++;
        }
      }

      // Calculate total listening time from playback history if available
      let totalListeningTimeMs = 0;
      if (this.dbAdapter) {
        try {
          const historyRecords = await this.dbAdapter.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);
          for (const item of historyRecords) {
            totalListeningTimeMs += (item.durationListenedMs || 0);
          }
        } catch {
          if (this.historyRepo) {
            const recent = await this.historyRepo.getRecent(1000);
            for (const item of recent) {
              totalListeningTimeMs += (item.durationListenedMs || 0);
            }
          }
        }
      } else if (this.historyRepo) {
        const recent = await this.historyRepo.getRecent(1000);
        for (const item of recent) {
          totalListeningTimeMs += (item.durationListenedMs || 0);
        }
      }

      // Calculate real artist count (excluding Unknown Artist)
      let totalArtists = artistsResult.items.filter(
        a => a.name && a.name.trim() && a.name.trim().toLowerCase() !== 'unknown artist'
      ).length;

      // Calculate real album count (excluding Unknown Album)
      let totalAlbums = albumsResult.items.filter(
        a => a.title && a.title.trim() && a.title.trim().toLowerCase() !== 'unknown album'
      ).length;

      // Calculate real genre count (excluding Unknown Genre)
      let totalGenres = genresResult.items.filter(
        g => g.name && g.name.trim() && g.name.trim().toLowerCase() !== 'unknown genre'
      ).length;

      // Fallback derivation directly from tracks if stores were not populated
      if (totalArtists === 0 && tracks.length > 0) {
        const unique = new Set<string>();
        for (const t of tracks) {
          if (t.artistName && t.artistName.trim() && t.artistName.trim().toLowerCase() !== 'unknown artist') {
            unique.add(t.artistName.trim().toLowerCase());
          }
        }
        totalArtists = unique.size;
      }

      if (totalAlbums === 0 && tracks.length > 0) {
        const unique = new Set<string>();
        for (const t of tracks) {
          if (t.albumTitle && t.albumTitle.trim() && t.albumTitle.trim().toLowerCase() !== 'unknown album') {
            unique.add(t.albumTitle.trim().toLowerCase());
          }
        }
        totalAlbums = unique.size;
      }

      if (totalGenres === 0 && tracks.length > 0) {
        const unique = new Set<string>();
        for (const t of tracks) {
          if (t.genreName && t.genreName.trim() && t.genreName.trim().toLowerCase() !== 'unknown genre') {
            unique.add(t.genreName.trim().toLowerCase());
          }
        }
        totalGenres = unique.size;
      }

      return {
        totalSongs,
        totalArtists,
        totalAlbums,
        totalGenres,
        totalListeningTimeMs,
        totalPlays,
        favoriteSongsCount
      };
    } catch (err) {
      this.logger.error('Failed to compute overview stats:', { error: String(err) });
      return {
        totalSongs: 0,
        totalArtists: 0,
        totalAlbums: 0,
        totalGenres: 0,
        totalListeningTimeMs: 0,
        totalPlays: 0,
        favoriteSongsCount: 0
      };
    }
  }

  /**
   * Retrieves most played tracks sorted by play count descending.
   * Only returns tracks that have actually been played (playCount > 0).
   */
  public async getTopSongs(limit: number = 10): Promise<readonly TopSongItem[]> {
    try {
      const result = await this.trackRepo.list({ limit: 10000 });
      const playedTracks = result.items.filter(t => (t.playCount || 0) > 0);
      playedTracks.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

      return playedTracks.slice(0, limit).map(track => {
        const item: TopSongItem = {
          track,
          playCount: track.playCount
        };
        if (track.lastPlayedAt !== undefined) {
          (item as any).lastPlayedAt = track.lastPlayedAt;
        }
        return item;
      });
    } catch (err) {
      this.logger.error('Failed to compute top songs:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves top artists aggregated by total play counts across their tracks.
   * Only returns artists with playCount > 0.
   */
  public async getTopArtists(limit: number = 10): Promise<readonly TopArtistItem[]> {
    try {
      const result = await this.trackRepo.list({ limit: 10000 });
      const artistMap = new Map<string, TopArtistItem>();

      for (const track of result.items) {
        const rawName = track.artistName?.trim();
        if (!rawName || rawName.toLowerCase() === 'unknown artist') {
          continue;
        }
        const name = rawName;
        const existing = artistMap.get(name);
        const pCount = track.playCount || 0;

        if (existing) {
          artistMap.set(name, {
            artistName: name,
            artistId: existing.artistId ?? track.artistId,
            playCount: existing.playCount + pCount,
            trackCount: existing.trackCount + 1,
            artworkId: existing.artworkId ?? track.artworkId
          });
        } else {
          const item: TopArtistItem = {
            artistName: name,
            playCount: pCount,
            trackCount: 1
          };
          if (track.artistId !== undefined) (item as any).artistId = track.artistId;
          if (track.artworkId !== undefined) (item as any).artworkId = track.artworkId;
          artistMap.set(name, item);
        }
      }

      const playedArtists = Array.from(artistMap.values()).filter(a => a.playCount > 0);
      playedArtists.sort((a, b) => b.playCount - a.playCount);

      return playedArtists.slice(0, limit);
    } catch (err) {
      this.logger.error('Failed to compute top artists:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves top albums aggregated by total play counts across their tracks.
   * Only returns albums with playCount > 0.
   */
  public async getTopAlbums(limit: number = 10): Promise<readonly TopAlbumItem[]> {
    try {
      const result = await this.trackRepo.list({ limit: 10000 });
      const albumMap = new Map<string, TopAlbumItem>();

      for (const track of result.items) {
        const rawTitle = track.albumTitle?.trim();
        if (!rawTitle || rawTitle.toLowerCase() === 'unknown album') {
          continue;
        }
        const title = rawTitle;
        const artist = (track.artistName && track.artistName.trim()) || 'Unknown Artist';
        const key = `${title}:::${artist}`;
        const existing = albumMap.get(key);
        const pCount = track.playCount || 0;

        if (existing) {
          albumMap.set(key, {
            albumTitle: title,
            artistName: artist,
            albumId: existing.albumId ?? track.albumId,
            playCount: existing.playCount + pCount,
            trackCount: existing.trackCount + 1,
            year: existing.year ?? track.year,
            artworkId: existing.artworkId ?? track.artworkId
          });
        } else {
          const item: TopAlbumItem = {
            albumTitle: title,
            artistName: artist,
            playCount: pCount,
            trackCount: 1
          };
          if (track.albumId !== undefined) (item as any).albumId = track.albumId;
          if (track.year !== undefined) (item as any).year = track.year;
          if (track.artworkId !== undefined) (item as any).artworkId = track.artworkId;
          albumMap.set(key, item);
        }
      }

      const playedAlbums = Array.from(albumMap.values()).filter(a => a.playCount > 0);
      playedAlbums.sort((a, b) => b.playCount - a.playCount);

      return playedAlbums.slice(0, limit);
    } catch (err) {
      this.logger.error('Failed to compute top albums:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves recent playback history enriched with Track metadata.
   */
  public async getRecentHistory(limit: number = 20): Promise<readonly RecentHistoryItem[]> {
    if (!this.historyRepo) return [];

    try {
      const historyRecords = await this.historyRepo.getRecent(limit * 2);
      const items: RecentHistoryItem[] = [];

      for (const record of historyRecords) {
        const track = await this.trackRepo.getById(record.trackId);
        if (track) {
          items.push({
            historyId: record.id,
            track,
            playedAt: record.playedAt,
            durationListenedMs: record.durationListenedMs,
            completed: record.completed
          });
        }
        if (items.length >= limit) {
          break;
        }
      }

      return items;
    } catch (err) {
      this.logger.error('Failed to retrieve recent history:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves listening activity binned by day for the past `days` (default 7).
   */
  public async getListeningActivity(days: number = 7): Promise<readonly DailyActivityItem[]> {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result: DailyActivityItem[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayLabel = dayNames[d.getDay()] ?? '';

      result.push({
        dateStr,
        dayLabel,
        timestamp: d.getTime(),
        playsCount: 0,
        durationMs: 0
      });
    }

    try {
      let historyRecords: readonly PlaybackHistoryItem[] = [];
      if (this.dbAdapter) {
        historyRecords = await this.dbAdapter.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);
      } else if (this.historyRepo) {
        historyRecords = await this.historyRepo.getRecent(500);
      }

      const activityMap = new Map<string, { playsCount: number; durationMs: number }>();
      for (const record of historyRecords) {
        const d = new Date(record.playedAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const existing = activityMap.get(dateStr) ?? { playsCount: 0, durationMs: 0 };
        existing.playsCount += 1;
        existing.durationMs += (record.durationListenedMs || 0);
        activityMap.set(dateStr, existing);
      }

      return result.map(item => {
        const stats = activityMap.get(item.dateStr);
        if (stats) {
          return {
            ...item,
            playsCount: stats.playsCount,
            durationMs: stats.durationMs
          };
        }
        return item;
      });
    } catch (err) {
      this.logger.error('Failed to compute listening activity:', { error: String(err) });
      return result;
    }
  }
}
