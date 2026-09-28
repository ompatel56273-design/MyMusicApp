import type {
  ITrackRepository,
  IArtistRepository,
  IAlbumRepository,
  IGenreRepository,
  IFolderRepository,
  IHistoryRepository
} from '../../domain/repositories/repository-contracts';
import type { Track, PlaybackHistoryItem, Artist, Album, Genre } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { Logger } from '../../core/logging/logger';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';

export interface MusicStatsOverview {
  readonly totalSongs: number;
  readonly totalArtists: number;
  readonly totalAlbums: number;
  readonly totalGenres: number;
  readonly totalFolders?: number | undefined;
  readonly totalListeningTimeMs: number;
  readonly totalPlays: number;
  readonly uniqueTracksPlayed: number;
  readonly uniqueArtistsPlayed: number;
  readonly uniqueAlbumsPlayed: number;
  readonly averageListeningDurationMs: number;
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

export interface TimeRangeStats {
  readonly timeRange: 'today' | 'last7days' | 'last30days' | 'all';
  readonly playCount: number;
  readonly totalListeningTimeMs: number;
  readonly uniqueTracksCount: number;
  readonly uniqueArtistsCount: number;
  readonly topGenre: string | null;
  readonly topArtist: string | null;
  readonly completedPlays: number;
}

export interface FavoriteStats {
  readonly totalFavorites: number;
  readonly favoriteArtistsCount: number;
  readonly favoriteAlbumsCount: number;
  readonly topFavoriteGenre: string | null;
  readonly favoriteTracks: readonly Track[];
}

export interface StatsServiceDependencies {
  trackRepo: ITrackRepository;
  artistRepo?: IArtistRepository | undefined;
  albumRepo?: IAlbumRepository | undefined;
  genreRepo?: IGenreRepository | undefined;
  folderRepo?: IFolderRepository | undefined;
  historyRepo?: IHistoryRepository | undefined;
  dbAdapter?: IDatabaseAdapter | undefined;
  eventBus?: EventBus | undefined;
}

/**
 * Music Statistics Service (F20).
 * Aggregates real library intelligence, listening history, and playback statistics
 * from IndexedDB repositories without duplicating state or fabricating data.
 */
export class StatsService {
  private readonly logger = new Logger('StatsService');
  private readonly trackRepo: ITrackRepository;
  private readonly artistRepo?: IArtistRepository | undefined;
  private readonly albumRepo?: IAlbumRepository | undefined;
  private readonly genreRepo?: IGenreRepository | undefined;
  private readonly folderRepo?: IFolderRepository | undefined;
  private readonly historyRepo?: IHistoryRepository | undefined;
  private readonly dbAdapter?: IDatabaseAdapter | undefined;
  private readonly eventBus?: EventBus | undefined;

  constructor(deps: StatsServiceDependencies) {
    this.trackRepo = deps.trackRepo;
    this.artistRepo = deps.artistRepo;
    this.albumRepo = deps.albumRepo;
    this.genreRepo = deps.genreRepo;
    this.folderRepo = deps.folderRepo;
    this.historyRepo = deps.historyRepo;
    this.dbAdapter = deps.dbAdapter;
    this.eventBus = deps.eventBus;
  }

  /**
   * Retrieves high-level library and listening overview statistics.
   */
  public async getOverview(): Promise<MusicStatsOverview> {
    try {
      const [totalSongs, allTracksResult, artistsResult, albumsResult, genresResult, foldersCount] = await Promise.all([
        this.trackRepo.count(),
        this.trackRepo.list({ limit: 50000 }),
        this.artistRepo ? this.artistRepo.list({ limit: 50000 }) : Promise.resolve({ items: [] as Artist[], total: 0, offset: 0, limit: 1 }),
        this.albumRepo ? this.albumRepo.list({ limit: 50000 }) : Promise.resolve({ items: [] as Album[], total: 0, offset: 0, limit: 1 }),
        this.genreRepo ? this.genreRepo.list({ limit: 50000 }) : Promise.resolve({ items: [] as Genre[], total: 0, offset: 0, limit: 1 }),
        this.folderRepo ? (await this.folderRepo.listChildren()).length : 0
      ]);

      const tracks = allTracksResult.items || [];
      let totalPlays = 0;
      let favoriteSongsCount = 0;
      let uniqueTracksPlayed = 0;

      const distinctArtists = new Set<string>();
      const distinctAlbums = new Set<string>();
      const distinctGenres = new Set<string>();
      const playedArtists = new Set<string>();
      const playedAlbums = new Set<string>();

      for (const track of tracks) {
        const pCount = track.playCount || 0;
        totalPlays += pCount;

        if (pCount > 0) {
          uniqueTracksPlayed++;
          if (track.artistName && track.artistName.toLowerCase() !== 'unknown artist') {
            playedArtists.add(track.artistName.trim().toLowerCase());
          }
          if (track.albumTitle && track.albumTitle.toLowerCase() !== 'unknown album') {
            const key = `${track.albumTitle.trim().toLowerCase()}:::${(track.artistName || '').trim().toLowerCase()}`;
            playedAlbums.add(key);
          }
        }

        if (track.isFavorite) {
          favoriteSongsCount++;
        }
        if (track.artistName && track.artistName.toLowerCase() !== 'unknown artist') {
          distinctArtists.add(track.artistName.trim().toLowerCase());
        }
        if (track.albumTitle && track.albumTitle.toLowerCase() !== 'unknown album') {
          const key = `${track.albumTitle.trim().toLowerCase()}:::${(track.artistName || '').trim().toLowerCase()}`;
          distinctAlbums.add(key);
        }
        if (track.genreName && track.genreName.toLowerCase() !== 'unknown genre') {
          distinctGenres.add(track.genreName.trim().toLowerCase());
        }
      }

      const realArtistsRepoCount = (artistsResult.items || []).filter((a: Artist) => a.name && a.name.toLowerCase() !== 'unknown artist').length;
      const realAlbumsRepoCount = (albumsResult.items || []).filter((a: Album) => a.title && a.title.toLowerCase() !== 'unknown album').length;
      const realGenresRepoCount = (genresResult.items || []).filter((g: Genre) => g.name && g.name.toLowerCase() !== 'unknown genre').length;

      const totalArtists = Math.max(realArtistsRepoCount, distinctArtists.size);
      const totalAlbums = Math.max(realAlbumsRepoCount, distinctAlbums.size);
      const totalGenres = Math.max(realGenresRepoCount, distinctGenres.size);
      const totalFolders = typeof foldersCount === 'number' ? foldersCount : 0;

      // Calculate total listening time and session count from history
      let totalListeningTimeMs = 0;
      let totalSessions = 0;

      const historyRecords = await this.fetchHistoryRecords(50000);
      for (const item of historyRecords) {
        totalListeningTimeMs += (item.durationListenedMs || 0);
        totalSessions++;
      }

      const averageListeningDurationMs = totalSessions > 0 ? Math.round(totalListeningTimeMs / totalSessions) : 0;

      return {
        totalSongs,
        totalArtists,
        totalAlbums,
        totalGenres,
        totalFolders,
        totalListeningTimeMs,
        totalPlays,
        uniqueTracksPlayed,
        uniqueArtistsPlayed: playedArtists.size,
        uniqueAlbumsPlayed: playedAlbums.size,
        averageListeningDurationMs,
        favoriteSongsCount
      };
    } catch (err) {
      this.logger.error('Failed to compute overview stats:', { error: String(err) });
      return {
        totalSongs: 0,
        totalArtists: 0,
        totalAlbums: 0,
        totalGenres: 0,
        totalFolders: 0,
        totalListeningTimeMs: 0,
        totalPlays: 0,
        uniqueTracksPlayed: 0,
        uniqueArtistsPlayed: 0,
        uniqueAlbumsPlayed: 0,
        averageListeningDurationMs: 0,
        favoriteSongsCount: 0
      };
    }
  }

  /**
   * Retrieves most played tracks sorted by play count descending with deterministic tie-breaking:
   * 1. playCount descending
   * 2. lastPlayedAt descending
   * 3. title alphabetical ascending
   */
  public async getTopSongs(limit: number = 10): Promise<readonly TopSongItem[]> {
    try {
      const result = await this.trackRepo.list({ limit: 50000 });
      const playedTracks = (result.items || []).filter(t => (t.playCount || 0) > 0);

      playedTracks.sort((a, b) => {
        const diff = (b.playCount || 0) - (a.playCount || 0);
        if (diff !== 0) return diff;
        const lastPlayDiff = (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
        if (lastPlayDiff !== 0) return lastPlayDiff;
        return (a.title || '').localeCompare(b.title || '');
      });

      return playedTracks.slice(0, limit).map(track => ({
        track,
        playCount: track.playCount || 0,
        lastPlayedAt: track.lastPlayedAt
      }));
    } catch (err) {
      this.logger.error('Failed to compute top songs:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves top artists aggregated by total play counts across their tracks with deterministic tie-breaking:
   * 1. Aggregated playCount descending
   * 2. trackCount descending
   * 3. artistName alphabetical ascending
   */
  public async getTopArtists(limit: number = 10): Promise<readonly TopArtistItem[]> {
    try {
      const result = await this.trackRepo.list({ limit: 50000 });
      const artistMap = new Map<string, TopArtistItem>();

      for (const track of result.items || []) {
        const name = track.artistName?.trim();
        if (!name || name.toLowerCase() === 'unknown artist') {
          continue;
        }
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
            trackCount: 1,
            artistId: track.artistId,
            artworkId: track.artworkId
          };
          artistMap.set(name, item);
        }
      }

      const playedArtists = Array.from(artistMap.values()).filter(a => a.playCount > 0);
      playedArtists.sort((a, b) => {
        const diff = b.playCount - a.playCount;
        if (diff !== 0) return diff;
        const countDiff = b.trackCount - a.trackCount;
        if (countDiff !== 0) return countDiff;
        return a.artistName.localeCompare(b.artistName);
      });

      return playedArtists.slice(0, limit);
    } catch (err) {
      this.logger.error('Failed to compute top artists:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves top albums aggregated by total play counts across their tracks with deterministic tie-breaking:
   * 1. Aggregated playCount descending
   * 2. trackCount descending
   * 3. albumTitle alphabetical ascending
   */
  public async getTopAlbums(limit: number = 10): Promise<readonly TopAlbumItem[]> {
    try {
      const result = await this.trackRepo.list({ limit: 50000 });
      const albumMap = new Map<string, TopAlbumItem>();

      for (const track of result.items || []) {
        const title = track.albumTitle?.trim();
        if (!title || title.toLowerCase() === 'unknown album') {
          continue;
        }
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
            trackCount: 1,
            albumId: track.albumId,
            year: track.year,
            artworkId: track.artworkId
          };
          albumMap.set(key, item);
        }
      }

      const playedAlbums = Array.from(albumMap.values()).filter(a => a.playCount > 0);
      playedAlbums.sort((a, b) => {
        const diff = b.playCount - a.playCount;
        if (diff !== 0) return diff;
        const countDiff = b.trackCount - a.trackCount;
        if (countDiff !== 0) return countDiff;
        return a.albumTitle.localeCompare(b.albumTitle);
      });

      return playedAlbums.slice(0, limit);
    } catch (err) {
      this.logger.error('Failed to compute top albums:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves unique recently played Track instances without duplicate tracks,
   * sorted by most recent playback timestamp descending.
   */
  public async getRecentlyPlayedTracks(limit: number = 20): Promise<readonly Track[]> {
    try {
      const historyRecords = await this.fetchHistoryRecords(500);
      const uniqueTracks: Track[] = [];
      const seenIds = new Set<string>();

      for (const record of historyRecords) {
        if (!record.trackId || seenIds.has(record.trackId)) continue;
        seenIds.add(record.trackId);

        const track = await this.trackRepo.getById(record.trackId);
        if (track && track.availability !== 'missing') {
          uniqueTracks.push(track);
        }

        if (uniqueTracks.length >= limit) {
          break;
        }
      }

      return uniqueTracks;
    } catch (err) {
      this.logger.error('Failed to retrieve recently played tracks:', { error: String(err) });
      return [];
    }
  }

  /**
   * Retrieves recent individual playback history entries enriched with Track metadata.
   */
  public async getRecentHistory(limit: number = 20, order: 'desc' | 'asc' = 'desc'): Promise<readonly RecentHistoryItem[]> {
    try {
      let historyRecords = await this.fetchHistoryRecords(limit * 2);
      if (order === 'asc') {
        historyRecords = [...historyRecords].sort((a, b) => a.playedAt - b.playedAt);
      }

      const items: RecentHistoryItem[] = [];

      for (const record of historyRecords) {
        const track = await this.trackRepo.getById(record.trackId);
        if (track && track.availability !== 'missing') {
          items.push({
            historyId: record.id,
            track,
            playedAt: record.playedAt,
            durationListenedMs: record.durationListenedMs || 0,
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
   * Computes listening statistics for a specific time range.
   */
  public async getTimeRangeStats(timeRange: 'today' | 'last7days' | 'last30days' | 'all'): Promise<TimeRangeStats> {
    try {
      const now = Date.now();
      let startTime = 0;

      if (timeRange === 'today') {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        startTime = todayStart.getTime();
      } else if (timeRange === 'last7days') {
        startTime = now - 7 * 24 * 60 * 60 * 1000;
      } else if (timeRange === 'last30days') {
        startTime = now - 30 * 24 * 60 * 60 * 1000;
      }

      const records = await this.fetchHistoryRecords(10000);
      const filtered = startTime > 0 ? records.filter(r => r.playedAt >= startTime) : records;

      let totalListeningTimeMs = 0;
      let completedPlays = 0;
      const uniqueTrackIds = new Set<string>();
      const artistPlayCounts = new Map<string, number>();
      const genrePlayCounts = new Map<string, number>();

      for (const record of filtered) {
        totalListeningTimeMs += (record.durationListenedMs || 0);
        if (record.completed) completedPlays++;
        if (record.trackId) uniqueTrackIds.add(record.trackId);

        const track = await this.trackRepo.getById(record.trackId);
        if (track) {
          if (track.artistName && track.artistName.toLowerCase() !== 'unknown artist') {
            const aName = track.artistName.trim();
            artistPlayCounts.set(aName, (artistPlayCounts.get(aName) || 0) + 1);
          }
          if (track.genreName && track.genreName.toLowerCase() !== 'unknown genre') {
            const gName = track.genreName.trim();
            genrePlayCounts.set(gName, (genrePlayCounts.get(gName) || 0) + 1);
          }
        }
      }

      let topArtist: string | null = null;
      let maxArtistPlays = 0;
      for (const [artist, count] of artistPlayCounts.entries()) {
        if (count > maxArtistPlays) {
          maxArtistPlays = count;
          topArtist = artist;
        }
      }

      let topGenre: string | null = null;
      let maxGenrePlays = 0;
      for (const [genre, count] of genrePlayCounts.entries()) {
        if (count > maxGenrePlays) {
          maxGenrePlays = count;
          topGenre = genre;
        }
      }

      return {
        timeRange,
        playCount: filtered.length,
        totalListeningTimeMs,
        uniqueTracksCount: uniqueTrackIds.size,
        uniqueArtistsCount: artistPlayCounts.size,
        topGenre,
        topArtist,
        completedPlays
      };
    } catch (err) {
      this.logger.error(`Failed to compute time range stats for "${timeRange}":`, { error: String(err) });
      return {
        timeRange,
        playCount: 0,
        totalListeningTimeMs: 0,
        uniqueTracksCount: 0,
        uniqueArtistsCount: 0,
        topGenre: null,
        topArtist: null,
        completedPlays: 0
      };
    }
  }

  /**
   * Retrieves favorite statistics across the user's collection.
   */
  public async getFavoriteStats(): Promise<FavoriteStats> {
    try {
      const allTracks = await this.trackRepo.list({ limit: 50000 });
      const favoriteTracks = (allTracks.items || []).filter(t => t.isFavorite && t.availability !== 'missing');

      favoriteTracks.sort((a, b) => (b.playCount || 0) - (a.playCount || 0) || (b.dateAdded || 0) - (a.dateAdded || 0));

      const favoriteArtists = new Set<string>();
      const favoriteAlbums = new Set<string>();
      const genreCounts = new Map<string, number>();

      for (const track of favoriteTracks) {
        if (track.artistName && track.artistName.toLowerCase() !== 'unknown artist') {
          favoriteArtists.add(track.artistName.trim().toLowerCase());
        }
        if (track.albumTitle && track.albumTitle.toLowerCase() !== 'unknown album') {
          favoriteAlbums.add(`${track.albumTitle.trim().toLowerCase()}:::${(track.artistName || '').trim().toLowerCase()}`);
        }
        if (track.genreName && track.genreName.toLowerCase() !== 'unknown genre') {
          const g = track.genreName.trim();
          genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        }
      }

      let topFavoriteGenre: string | null = null;
      let maxGCount = 0;
      for (const [genre, count] of genreCounts.entries()) {
        if (count > maxGCount) {
          maxGCount = count;
          topFavoriteGenre = genre;
        }
      }

      return {
        totalFavorites: favoriteTracks.length,
        favoriteArtistsCount: favoriteArtists.size,
        favoriteAlbumsCount: favoriteAlbums.size,
        topFavoriteGenre,
        favoriteTracks
      };
    } catch (err) {
      this.logger.error('Failed to compute favorite stats:', { error: String(err) });
      return {
        totalFavorites: 0,
        favoriteArtistsCount: 0,
        favoriteAlbumsCount: 0,
        topFavoriteGenre: null,
        favoriteTracks: []
      };
    }
  }

  /**
   * Deletes a single history record and broadcasts update event.
   */
  public async deleteHistoryItem(historyId: string): Promise<void> {
    if (!historyId) return;

    try {
      if (this.historyRepo && typeof this.historyRepo.deleteRecord === 'function') {
        await this.historyRepo.deleteRecord(historyId);
      } else if (this.dbAdapter) {
        await this.dbAdapter.delete(STORES.PLAYBACK_HISTORY, historyId);
      }
      this.eventBus?.publish(DomainEvents.HISTORY_UPDATED, { action: 'deleted', historyId });
      this.eventBus?.publish(DomainEvents.LIBRARY_UPDATED, { tracksAdded: 0, tracksUpdated: 0, tracksRemoved: 0, timestamp: Date.now() });
    } catch (err) {
      this.logger.error(`Failed to delete history item "${historyId}":`, { error: String(err) });
    }
  }

  /**
   * Clears all playback history records safely and broadcasts update event.
   */
  public async clearAllHistory(): Promise<void> {
    try {
      if (this.historyRepo && typeof this.historyRepo.clearHistory === 'function') {
        await this.historyRepo.clearHistory();
      } else if (this.dbAdapter) {
        await this.dbAdapter.clear(STORES.PLAYBACK_HISTORY);
      }
      this.eventBus?.publish(DomainEvents.HISTORY_UPDATED, { action: 'cleared' });
      this.eventBus?.publish(DomainEvents.LIBRARY_UPDATED, { tracksAdded: 0, tracksUpdated: 0, tracksRemoved: 0, timestamp: Date.now() });
      this.logger.info('Playback history cleared successfully.');
    } catch (err) {
      this.logger.error('Failed to clear playback history:', { error: String(err) });
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
      const historyRecords = await this.fetchHistoryRecords(50000);

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

  private async fetchHistoryRecords(limit = 1000): Promise<readonly PlaybackHistoryItem[]> {
    if (this.dbAdapter) {
      try {
        const records = await this.dbAdapter.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);
        records.sort((a, b) => b.playedAt - a.playedAt);
        return records.slice(0, limit);
      } catch {
        // Fallback to history repo
      }
    }
    if (this.historyRepo) {
      return this.historyRepo.getRecent(limit);
    }
    return [];
  }
}
