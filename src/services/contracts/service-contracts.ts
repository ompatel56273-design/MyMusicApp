import type {
  EntityId,
  PlaybackState,
  RepeatMode,
  ShuffleMode,
  ReplayGainData,
  AbLoopState
} from '../../domain/value-objects/audio-types';
import type {
  Track,
  Album,
  Artist,
  Playlist,
  PlaylistItem,
  Genre,
  Folder,
  QueueItem,
  Lyrics
} from '../../domain/entities/models';
import type {
  PaginationOptions,
  PaginatedResult,
  TrackFilter
} from '../../domain/repositories/repository-contracts';

/**
 * Single Authoritative Playback Controller Contract.
 * Exactly ONE instance owns playback state across the entire application.
 */
export interface IPlaybackManager {
  readonly state: PlaybackState;
  readonly currentTrack: Track | null;
  readonly positionMs: number;
  readonly durationMs: number;
  readonly volume: number;
  readonly isMuted: boolean;
  readonly playbackRate: number;
  readonly repeatMode: RepeatMode;
  readonly shuffleMode: ShuffleMode;
  readonly queue: readonly QueueItem[];
  readonly currentQueueIndex: number;
  getTracks?(): readonly Track[];
  getQueueTracks?(): readonly Track[];
  restoreQueue?(): Promise<void>;
  playTrack(track: Track, queueContext?: readonly Track[]): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  setRepeatMode(mode: RepeatMode): void;
  setShuffleMode(mode: ShuffleMode): void;
  addToQueue(tracks: readonly Track[], playNext?: boolean): Promise<void>;
  playQueueIndex(index: number): Promise<void>;
  removeFromQueue(index: number): Promise<void>;
  reorderQueue(fromIndex: number, toIndex: number): Promise<void>;
  clearQueue(): Promise<void>;
  setCrossfade?(enabled: boolean, durationSec?: number): void;
  readonly crossfadeEnabled?: boolean;
  readonly crossfadeDurationSec?: number;
  readonly abLoop?: AbLoopState;
  setLoopA?(positionMs?: number): void;
  setLoopB?(positionMs?: number): void;
  toggleAbLoop?(enabled?: boolean): void;
  clearAbLoop?(): void;
}

/**
 * Library Service Contract.
 */
export interface ILibraryService {
  getTrack(id: EntityId): Promise<Track | null>;
  listTracks(options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>>;
  getAlbum(id: EntityId): Promise<Album | null>;
  listAlbums(options?: PaginationOptions, artistId?: EntityId): Promise<PaginatedResult<Album>>;
  getArtist(id: EntityId): Promise<Artist | null>;
  listArtists(options?: PaginationOptions): Promise<PaginatedResult<Artist>>;
  toggleFavorite(trackId: EntityId): Promise<boolean>;
  getLibraryStats(): Promise<{ trackCount: number; albumCount: number; artistCount: number }>;
  listGenres(options?: PaginationOptions): Promise<PaginatedResult<Genre>>;
  listFolders(parentId?: EntityId): Promise<readonly Folder[]>;
}

/**
 * Scanner Service Contract.
 */
export interface IScannerService {
  readonly isScanning: boolean;
  scanDirectory(path: string): Promise<void>;
  cancelScan(): Promise<void>;
  importFiles?(files: readonly File[] | FileList): Promise<{ filesAdded: number; filesSkipped: number }>;
}

/**
 * Search Service Contract.
 */
export interface SearchResults {
  readonly tracks: readonly Track[];
  readonly albums: readonly Album[];
  readonly artists: readonly Artist[];
  readonly playlists: readonly Playlist[];
  readonly genres?: readonly Genre[] | undefined;
  readonly folders?: readonly Folder[] | undefined;
}

export interface ISearchService {
  search(query: string, limitPerCategory?: number): Promise<SearchResults>;
  searchTracks(query: string, options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>>;
  searchAlbums(query: string, options?: PaginationOptions): Promise<PaginatedResult<Album>>;
  searchArtists(query: string, options?: PaginationOptions): Promise<PaginatedResult<Artist>>;
  searchPlaylists(query: string, options?: PaginationOptions): Promise<PaginatedResult<Playlist>>;
}

import type {
  SmartRule,
  SmartMatchMode,
  SmartPlaylistSort,
  SmartPlaylistDefinition
} from '../../domain/value-objects/smart-playlist-types';

export interface PlaylistTrackItem {
  readonly item: PlaylistItem;
  readonly track: Track;
}

export interface PlaylistWithTracks {
  readonly playlist: Playlist;
  readonly items: readonly PlaylistTrackItem[];
}

/**
 * Playlist Service Contract.
 */
export interface IPlaylistService {
  getPlaylist(id: EntityId): Promise<Playlist | null>;
  getPlaylistWithTracks(id: EntityId): Promise<PlaylistWithTracks | null>;
  listPlaylists(options?: PaginationOptions): Promise<PaginatedResult<Playlist>>;
  createPlaylist(name: string, description?: string): Promise<Playlist>;
  updatePlaylist(id: EntityId, updates: Partial<Pick<Playlist, 'name' | 'description'>>): Promise<Playlist>;
  deletePlaylist(id: EntityId): Promise<void>;
  addTracksToPlaylist(playlistId: EntityId, trackIds: readonly EntityId[]): Promise<void>;
  removeTrackFromPlaylist(playlistId: EntityId, playlistItemId: EntityId): Promise<void>;
  reorderPlaylistItems(playlistId: EntityId, fromPosition: number, toPosition: number): Promise<void>;
  createSmartPlaylist?(
    name: string,
    description: string | undefined,
    rules: readonly SmartRule[],
    matchMode?: SmartMatchMode,
    sort?: SmartPlaylistSort,
    limit?: number | null
  ): Promise<Playlist>;
  updateSmartPlaylist?(
    id: EntityId,
    updates: Partial<Omit<SmartPlaylistDefinition, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Playlist>;
  evaluateSmartPlaylist?(id: EntityId): Promise<readonly Track[]>;
  duplicateSmartPlaylist?(id: EntityId): Promise<Playlist>;
  getSmartPlaylistDefinition?(id: EntityId): Promise<SmartPlaylistDefinition | null>;
  ensureBuiltInSmartPlaylists?(): Promise<void>;
}

/**
 * Lyrics Service Contract.
 */
export interface ILyricsService {
  getLyrics(trackId: EntityId): Promise<Lyrics | null>;
  saveLyrics(lyrics: Lyrics): Promise<void>;
  parseLrc(lrcContent: string, trackId?: EntityId): Lyrics;
  deleteLyrics(trackId: EntityId): Promise<void>;
}

/**
 * Artwork Service Contract.
 */
export interface IArtworkService {
  getArtworkUrl(artworkId: EntityId, size?: 'small' | 'medium' | 'large'): Promise<string | null>;
  evictCache(artworkId: EntityId): void;
}

import type { DspPipelineOptions, ReplayGainMode } from '../audio/audio-types';
import type { AudioSettings, EqualizerPreset } from '../../domain/entities/audio-settings';
import type { VisualizerSettings, VisualizerMode } from '../../domain/entities/visualizer-settings';
import type { GalaxyGraph, GalaxyFilterOptions, GalaxySettings } from '../../domain/entities/galaxy-types';
import type { AudioAnalysisMetrics } from '../audio/audio-types';

/**
 * Audio Galaxy Service Contract.
 */
export interface IGalaxyService {
  getGraph(filter?: GalaxyFilterOptions): Promise<GalaxyGraph>;
  invalidateCache(): void;
  getSettings(): Promise<GalaxySettings>;
  saveSettings(settings: Partial<GalaxySettings>): Promise<GalaxySettings>;
}

/**
 * Visualizer Service Contract.
 */
export interface IVisualizerService {
  getSettings(): Promise<VisualizerSettings>;
  saveSettings(settings: Partial<VisualizerSettings>): Promise<VisualizerSettings>;
  setMode(mode: VisualizerMode): Promise<VisualizerSettings>;
  setEnabled(enabled: boolean): Promise<VisualizerSettings>;
  resetToDefaults(): Promise<VisualizerSettings>;
}

/**
 * Audio Settings Service Contract.
 */
export interface IAudioSettingsService {
  getSettings(): Promise<AudioSettings>;
  saveSettings(settings: Partial<AudioSettings>): Promise<AudioSettings>;
  resetToDefaults(): Promise<AudioSettings>;
  getBuiltInPresets(): readonly EqualizerPreset[];
  saveCustomPreset(name: string, bands: readonly number[], preampGainDb?: number): Promise<EqualizerPreset>;
  deleteCustomPreset(presetId: string): Promise<void>;
  applyToAudioEngine(engine: IAudioEngine): Promise<void>;
}

/**
 * Specialized Low-Level Audio Engine Contract.
 */
export interface IAudioEngine {
  readonly sampleRate: number;
  readonly currentTime: number;
  loadBuffer(urlOrBlob: string | Blob, options?: { replayGain?: ReplayGainData | undefined }): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(timeSec: number): void;
  setGain(gain: number): void;
  setPlaybackRate(rate: number): void;
  getAnalysisData(): Uint8Array;
  getAnalysisMetrics(): AudioAnalysisMetrics;

  // Phase 12 DSP Controls
  setEqualizerEnabled(enabled: boolean): void;
  setEqualizerBands(gainsDb: readonly number[]): void;
  setEqualizerBandGain(bandIndex: number, gainDb: number): void;
  setPreampGain(gainDb: number): void;
  setReplayGainMode(mode: ReplayGainMode): void;
  setPreventClipping?(enabled: boolean): void;
  setBalance(balance: number): void;
  setLimiterEnabled(enabled: boolean): void;
  getDspOptions(): DspPipelineOptions;

  // Gapless & Crossfade Playback
  prepareNext?(urlOrBlob: string | Blob, options?: { replayGain?: ReplayGainData | undefined }): Promise<void>;
  hasPreparedNext?(): boolean;
  transitionToNext?(): Promise<void>;
  cancelPreload?(): void;
  startCrossfadeToNext?(durationSec: number): Promise<void>;
  cancelCrossfade?(): void;
  setCrossfade?(enabled: boolean, durationSec?: number): void;
  readonly isCrossfading?: boolean;
}
