import { createToken } from './service-container';
import type { Logger } from '../../core/logging/logger';
import type { EventBus } from '../../core/events/event-bus';
import type {
  ITrackRepository,
  IAudioFileRepository,
  IAlbumRepository,
  IArtistRepository,
  IGenreRepository,
  IFolderRepository,
  IPlaylistRepository,
  IHistoryRepository,
  IQueueRepository,
  ILyricsRepository
} from '../../domain/repositories/repository-contracts';
import type {
  IPlaybackManager,
  ILibraryService,
  IScannerService,
  ISearchService,
  IPlaylistService,
  IArtworkService,
  ILyricsService,
  IAudioEngine
} from '../../services/contracts/service-contracts';

export const CoreTokens = {
  Logger: createToken<Logger>('Logger'),
  EventBus: createToken<EventBus>('EventBus')
} as const;

export const RepositoryTokens = {
  TrackRepository: createToken<ITrackRepository>('ITrackRepository'),
  AudioFileRepository: createToken<IAudioFileRepository>('IAudioFileRepository'),
  AlbumRepository: createToken<IAlbumRepository>('IAlbumRepository'),
  ArtistRepository: createToken<IArtistRepository>('IArtistRepository'),
  GenreRepository: createToken<IGenreRepository>('IGenreRepository'),
  FolderRepository: createToken<IFolderRepository>('IFolderRepository'),
  PlaylistRepository: createToken<IPlaylistRepository>('IPlaylistRepository'),
  HistoryRepository: createToken<IHistoryRepository>('IHistoryRepository'),
  QueueRepository: createToken<IQueueRepository>('IQueueRepository'),
  LyricsRepository: createToken<ILyricsRepository>('ILyricsRepository')
} as const;

export const ServiceTokens = {
  PlaybackManager: createToken<IPlaybackManager>('IPlaybackManager'),
  LibraryService: createToken<ILibraryService>('ILibraryService'),
  ScannerService: createToken<IScannerService>('IScannerService'),
  SearchService: createToken<ISearchService>('ISearchService'),
  PlaylistService: createToken<IPlaylistService>('IPlaylistService'),
  ArtworkService: createToken<IArtworkService>('IArtworkService'),
  LyricsService: createToken<ILyricsService>('ILyricsService'),
  AudioEngine: createToken<IAudioEngine>('IAudioEngine'),
  AudioSettingsService: createToken<import('../../services/contracts/service-contracts').IAudioSettingsService>('IAudioSettingsService'),
  VisualizerService: createToken<import('../../services/contracts/service-contracts').IVisualizerService>('IVisualizerService'),
  GalaxyService: createToken<import('../../services/contracts/service-contracts').IGalaxyService>('IGalaxyService'),
  DashboardService: createToken<import('../../services/contracts/service-contracts').IDashboardService>('IDashboardService')
} as const;
