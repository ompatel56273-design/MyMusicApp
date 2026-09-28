import type { EntityId, RepeatMode, ShuffleMode } from '../value-objects/audio-types';
import type {
  Track,
  AudioFile,
  Artist,
  Album,
  Genre,
  Folder,
  Playlist,
  PlaylistItem,
  QueueItem,
  PlaybackHistoryItem,
  PlaybackPosition,
  Lyrics
} from '../entities/models';

export interface PaginationOptions {
  readonly offset?: number;
  readonly limit?: number;
  readonly sortBy?: string;
  readonly sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface TrackFilter {
  readonly artistId?: EntityId;
  readonly albumId?: EntityId;
  readonly genreId?: EntityId;
  readonly folderId?: EntityId;
  readonly isFavorite?: boolean;
  readonly search?: string;
}

export interface ITrackRepository {
  getById(id: EntityId): Promise<Track | null>;
  getByFileId(fileId: EntityId): Promise<Track | null>;
  list(options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>>;
  save(track: Track): Promise<void>;
  saveBatch(tracks: readonly Track[]): Promise<void>;
  delete(id: EntityId): Promise<void>;
  setFavorite(id: EntityId, isFavorite: boolean): Promise<void>;
  incrementPlayCount(id: EntityId, timestamp: number): Promise<void>;
  count(): Promise<number>;
}

export interface IAudioFileRepository {
  getById(id: EntityId): Promise<AudioFile | null>;
  getByPath(path: string): Promise<AudioFile | null>;
  save(file: AudioFile): Promise<void>;
  saveBatch(files: readonly AudioFile[]): Promise<void>;
  delete(id: EntityId): Promise<void>;
  listAllPaths(): Promise<Map<string, { id: EntityId; sizeBytes: number; modifiedTimeMs: number }>>;
}

export interface IArtistRepository {
  getById(id: EntityId): Promise<Artist | null>;
  getByName(name: string): Promise<Artist | null>;
  list(options?: PaginationOptions): Promise<PaginatedResult<Artist>>;
  save(artist: Artist): Promise<void>;
  saveBatch(artists: readonly Artist[]): Promise<void>;
  delete(id: EntityId): Promise<void>;
}

export interface IAlbumRepository {
  getById(id: EntityId): Promise<Album | null>;
  list(options?: PaginationOptions, artistId?: EntityId): Promise<PaginatedResult<Album>>;
  save(album: Album): Promise<void>;
  saveBatch(albums: readonly Album[]): Promise<void>;
  delete(id: EntityId): Promise<void>;
}

export interface IGenreRepository {
  getById(id: EntityId): Promise<Genre | null>;
  getByName(name: string): Promise<Genre | null>;
  list(options?: PaginationOptions): Promise<PaginatedResult<Genre>>;
  save(genre: Genre): Promise<void>;
}

export interface IFolderRepository {
  getById(id: EntityId): Promise<Folder | null>;
  getByPath(path: string): Promise<Folder | null>;
  listChildren(parentId?: EntityId): Promise<readonly Folder[]>;
  save(folder: Folder): Promise<void>;
  delete(id: EntityId): Promise<void>;
}

export interface IPlaylistRepository {
  getById(id: EntityId): Promise<Playlist | null>;
  list(options?: PaginationOptions): Promise<PaginatedResult<Playlist>>;
  save(playlist: Playlist): Promise<void>;
  delete(id: EntityId): Promise<void>;
  getItems(playlistId: EntityId): Promise<readonly PlaylistItem[]>;
  setItems(playlistId: EntityId, items: readonly PlaylistItem[]): Promise<void>;
  addItem(playlistId: EntityId, trackId: EntityId, position?: number): Promise<void>;
  removeItem(playlistId: EntityId, itemId: EntityId): Promise<void>;
}

export interface IHistoryRepository {
  getRecent(limit?: number): Promise<readonly PlaybackHistoryItem[]>;
  addRecord(record: Omit<PlaybackHistoryItem, 'id'>): Promise<void>;
  getResumePosition(trackId: EntityId): Promise<PlaybackPosition | null>;
  saveResumePosition(position: PlaybackPosition): Promise<void>;
  clearResumePosition(trackId: EntityId): Promise<void>;
}

export interface QueueMetadata {
  readonly activeIndex: number;
  readonly activeTrackId?: EntityId | undefined;
  readonly repeatMode?: RepeatMode | undefined;
  readonly shuffleMode?: ShuffleMode | undefined;
  readonly updatedAt: number;
}

export interface IQueueRepository {
  getQueue(): Promise<readonly QueueItem[]>;
  saveQueue(items: readonly QueueItem[]): Promise<void>;
  clearQueue(): Promise<void>;
  getQueueMetadata?(): Promise<QueueMetadata | null>;
  saveQueueMetadata?(metadata: QueueMetadata): Promise<void>;
}

export interface ILyricsRepository {
  getByTrackId(trackId: EntityId): Promise<Lyrics | null>;
  save(lyrics: Lyrics): Promise<void>;
  deleteByTrackId(trackId: EntityId): Promise<void>;
}

