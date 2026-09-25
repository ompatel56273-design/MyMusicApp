import type { Track } from './models';
import type { EntityId } from '../value-objects/audio-types';

/**
 * High-level Library Summary Metrics
 */
export interface LibraryAnalyticsSummary {
  readonly totalTracks: number;
  readonly totalArtists: number;
  readonly totalAlbums: number;
  readonly totalGenres: number;
  readonly totalPlaylists: number;
  readonly totalDurationMs: number;
  readonly totalStorageBytes: number;
  readonly availableTracks: number;
  readonly missingTracks: number;
  readonly unverifiableTracks: number;
  readonly duplicateGroupsCount: number;
  readonly duplicateTracksCount: number;
  readonly favoriteTracksCount: number;
  readonly totalPlays: number;
  readonly totalListeningTimeMs: number;
}

/**
 * Per-Artist Analytics Breakdown
 */
export interface ArtistAnalyticsItem {
  readonly artistName: string;
  readonly artistId?: EntityId | undefined;
  readonly trackCount: number;
  readonly playCount: number;
  readonly totalListeningTimeMs: number;
  readonly artworkId?: EntityId | undefined;
}

/**
 * Per-Album Analytics Breakdown
 */
export interface AlbumAnalyticsItem {
  readonly albumTitle: string;
  readonly artistName: string;
  readonly albumId?: EntityId | undefined;
  readonly trackCount: number;
  readonly playCount: number;
  readonly year?: number | undefined;
  readonly artworkId?: EntityId | undefined;
}

/**
 * Per-Genre Analytics Breakdown
 */
export interface GenreAnalyticsItem {
  readonly genreName: string;
  readonly trackCount: number;
  readonly playCount: number;
  readonly percentageShare: number;
}

/**
 * Format / Audio Specs Analytics Breakdown
 */
export interface FormatAnalyticsItem {
  readonly formatName: string;
  readonly isLossless: boolean;
  readonly trackCount: number;
  readonly totalSizeBytes: number;
  readonly percentageShare: number;
}

/**
 * Storage & Audio File Analytics
 */
export interface StorageAnalytics {
  readonly totalStorageBytes: number;
  readonly averageFileSizeBytes: number;
  readonly formats: readonly FormatAnalyticsItem[];
  readonly losslessTrackCount: number;
  readonly lossyTrackCount: number;
}

/**
 * Detailed Track Insights
 */
export interface TrackAnalyticsSummary {
  readonly topPlayedTracks: readonly { readonly track: Track; readonly playCount: number; readonly lastPlayedAt?: number | undefined }[];
  readonly recentlyPlayedTracks: readonly { readonly historyId: string; readonly track: Track; readonly playedAt: number; readonly durationListenedMs: number }[];
  readonly favoriteTracks: readonly Track[];
  readonly neverPlayedCount: number;
  readonly longestTrack: Track | null;
  readonly shortestTrack: Track | null;
}

/**
 * Activity over time (daily / weekly)
 */
export interface ListeningActivityItem {
  readonly dateStr: string;
  readonly dayLabel: string;
  readonly timestamp: number;
  readonly playsCount: number;
  readonly durationMs: number;
}

/**
 * Library Growth Analytics Timeline
 */
export interface LibraryGrowthItem {
  readonly periodLabel: string;
  readonly timestamp: number;
  readonly tracksAdded: number;
}

/**
 * Complete Immutable Library Analytics Snapshot
 */
export interface LibraryAnalyticsSnapshot {
  readonly timestamp: number;
  readonly summary: LibraryAnalyticsSummary;
  readonly topArtists: readonly ArtistAnalyticsItem[];
  readonly topAlbums: readonly AlbumAnalyticsItem[];
  readonly genreBreakdown: readonly GenreAnalyticsItem[];
  readonly storage: StorageAnalytics;
  readonly trackInsights: TrackAnalyticsSummary;
  readonly activity: readonly ListeningActivityItem[];
  readonly growthTimeline: readonly LibraryGrowthItem[];
  readonly calculationDurationMs: number;
}
