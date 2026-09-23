import { Logger } from '../core/logging/logger';
import { EventBus } from '../core/events/event-bus';
import { PlatformAdapter } from '../core/platform/platform-adapter';
import { AppShell } from '../ui/shell/app-shell';
import type {
  IPlaybackManager,
  ILibraryService,
  ISearchService,
  IPlaylistService,
  ILyricsService,
  IAudioEngine,
  IAudioSettingsService,
  IVisualizerService,
  IGalaxyService,
  IScannerService
} from '../services/contracts/service-contracts';
import { DatabaseManager } from '../data/db/database-manager';
import type { IDatabaseAdapter } from '../data/db/database-adapter';
import { STORES } from '../data/db/schema';
import { TrackRepository } from '../data/repositories/track-repository';
import { AudioFileRepository } from '../data/repositories/audio-file-repository';
import { ArtistRepository } from '../data/repositories/artist-repository';
import { AlbumRepository } from '../data/repositories/album-repository';
import { GenreRepository } from '../data/repositories/genre-repository';
import { FolderRepository } from '../data/repositories/folder-repository';
import { PlaylistRepository } from '../data/repositories/playlist-repository';
import { HistoryRepository } from '../data/repositories/history-repository';
import { QueueRepository } from '../data/repositories/queue-repository';
import { LyricsRepository } from '../data/repositories/lyrics-repository';

import { BrowserFilesystemAdapter } from '../services/scanner/browser-filesystem-adapter';
import { AudioEngine } from '../services/audio/audio-engine';
import { ArtworkService } from '../services/artwork/artwork-service';
import { MetadataReader } from '../services/metadata/metadata-reader';
import { MetadataService } from '../services/metadata/metadata-service';
import { ScannerService } from '../services/scanner/scanner-service';
import { LibraryService } from '../services/library/library-service';
import { PlaybackManager } from '../services/playback/playback-manager';
import { SearchService } from '../services/search/search-service';
import { PlaylistService } from '../services/playlist/playlist-service';
import { LyricsService } from '../services/lyrics/lyrics-service';
import { AudioSettingsService } from '../services/audio/audio-settings-service';
import { VisualizerService } from '../services/visualizer/visualizer-service';
import { GalaxyService } from '../services/galaxy/galaxy-service';
import { FileAccessCapabilityService } from '../services/scanner/file-access-capability';
import { LocalMusicOnboardingModal } from '../ui/components/onboarding/local-music-onboarding-modal';

export interface AppContext {
  logger: Logger;
  eventBus: EventBus;
  appShell?: AppShell | undefined;
}

/**
 * Application Bootstrap
 * Initializes database, repositories, audio engine, scanner, and root shell.
 */
export class AppBootstrap {
  private static instance?: AppBootstrap;
  private logger = new Logger('Bootstrap');
  private eventBus = new EventBus();
  private appShell?: AppShell | undefined;

  public static getInstance(): AppBootstrap {
    if (!this.instance) {
      this.instance = new AppBootstrap();
    }
    return this.instance;
  }

  public async init(services?: {
    playbackManager: IPlaybackManager;
    libraryService: ILibraryService;
    searchService: ISearchService;
    playlistService?: IPlaylistService;
    lyricsService?: ILyricsService;
    audioEngine?: IAudioEngine;
    audioSettingsService?: IAudioSettingsService;
    visualizerService?: IVisualizerService;
    galaxyService?: IGalaxyService;
    scannerService?: IScannerService;
  }): Promise<AppContext> {
    this.logger.info('Initializing Music Player App...');

    const capabilities = PlatformAdapter.getCapabilities();
    this.logger.info('Platform Capabilities detected:', capabilities as unknown as Record<string, unknown>);

    if (!capabilities.hasWebAudio) {
      this.logger.warn('Web Audio API is not supported in this runtime environment.');
    }

    if (!capabilities.hasIndexedDB) {
      this.logger.warn('IndexedDB is not supported in this runtime environment.');
    }

    if (services) {
      this.mountRootShell(services);
    } else {
      await this.initRealServices();
    }

    this.logger.info('Music Player App mounted successfully.');

    return {
      logger: this.logger,
      eventBus: this.eventBus,
      appShell: this.appShell
    };
  }

  private async initRealServices(): Promise<void> {
    const root = document.getElementById('app');
    if (!root) {
      this.logger.error('Root element "#app" not found in DOM.');
      return;
    }

    // 1. Initialize Database Adapter
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    const adapter = dbManager.getAdapter();

    // 2. Safe One-Time Demo Data Cleanup
    await this.cleanupDemoData(adapter);

    // 3. Initialize Repositories
    const trackRepo = new TrackRepository(adapter);
    const audioFileRepo = new AudioFileRepository(adapter);
    const artistRepo = new ArtistRepository(adapter);
    const albumRepo = new AlbumRepository(adapter);
    const genreRepo = new GenreRepository(adapter);
    const folderRepo = new FolderRepository(adapter);
    const playlistRepo = new PlaylistRepository(adapter);
    const historyRepo = new HistoryRepository(adapter);
    const queueRepo = new QueueRepository(adapter);
    const lyricsRepo = new LyricsRepository(adapter);

    // 4. Initialize Core Services
    const fsAdapter = new BrowserFilesystemAdapter();
    const audioEngine = new AudioEngine();
    const artworkService = new ArtworkService();
    const metadataReader = new MetadataReader();
    const metadataService = new MetadataService(
      metadataReader,
      artworkService,
      trackRepo,
      audioFileRepo,
      artistRepo,
      albumRepo,
      genreRepo,
      this.eventBus
    );
    const scannerService = new ScannerService(
      fsAdapter,
      audioFileRepo,
      trackRepo,
      folderRepo,
      this.eventBus,
      metadataService
    );
    const libraryService = new LibraryService({
      trackRepo,
      albumRepo,
      artistRepo,
      genreRepo,
      folderRepo,
      eventBus: this.eventBus
    });
    const playbackManager = new PlaybackManager({
      audioEngine,
      filesystem: fsAdapter,
      trackRepo,
      audioFileRepo,
      queueRepo,
      historyRepo,
      eventBus: this.eventBus,
      logger: this.logger
    });
    const searchService = new SearchService({
      trackRepo,
      albumRepo,
      artistRepo,
      playlistRepo,
      genreRepo,
      folderRepo
    });
    const playlistService = new PlaylistService({
      playlistRepo,
      trackRepo,
      eventBus: this.eventBus
    });
    const lyricsService = new LyricsService({
      lyricsRepo,
      trackRepo
    });
    const audioSettingsService = new AudioSettingsService(adapter);
    const visualizerService = new VisualizerService(adapter);
    const galaxyService = new GalaxyService({
      libraryService,
      playlistService,
      database: adapter
    });

    // 5. Check Persistent Directory Handle
    const capabilityService = FileAccessCapabilityService.getInstance();
    try {
      const savedHandleRecord = await adapter.get<{ key: string; handle: FileSystemDirectoryHandle; path: string; name: string }>(
        STORES.SETTINGS,
        'music_directory_handle'
      );
      if (savedHandleRecord && savedHandleRecord.handle) {
        const perm = await capabilityService.queryDirectoryPermission(savedHandleRecord.handle);
        if (perm === 'GRANTED') {
          fsAdapter.registerDirectoryHandle(savedHandleRecord.path, savedHandleRecord.handle);
          this.logger.info(`Reconnected saved music folder: ${savedHandleRecord.name}`);
        } else {
          this.logger.info(`Saved music folder permission status: ${perm}`);
        }
      }
    } catch (handleErr) {
      this.logger.warn('Could not restore saved music directory handle:', { error: String(handleErr) });
    }

    // 6. Mount AppShell
    this.appShell = new AppShell({
      playbackManager,
      libraryService,
      searchService,
      playlistService,
      artworkService,
      lyricsService,
      audioEngine,
      audioSettingsService,
      visualizerService,
      galaxyService,
      scannerService,
      fsAdapter,
      dbAdapter: adapter,
      eventBus: this.eventBus
    });
    this.appShell.mount(root);

    // 7. Check if library is empty and trigger first-launch onboarding if needed
    try {
      const stats = await libraryService.getLibraryStats();
      const isDismissed = typeof localStorage !== 'undefined' && (
        localStorage.getItem('mymusic_onboarding_dismissed') === 'true' ||
        localStorage.getItem('mymusic_onboarding_completed') === 'true'
      );
      if (stats.trackCount === 0 && !isDismissed) {
        const modal = new LocalMusicOnboardingModal({
          scannerService,
          fsAdapter,
          dbAdapter: adapter,
          libraryService,
          router: this.appShell?.getRouter(),
          eventBus: this.eventBus
        });
        modal.show();
      }
    } catch {
      // Non-fatal
    }
  }

  private mountRootShell(services: {
    playbackManager: IPlaybackManager;
    libraryService: ILibraryService;
    searchService: ISearchService;
    playlistService?: IPlaylistService;
    lyricsService?: ILyricsService;
    audioEngine?: IAudioEngine;
    audioSettingsService?: IAudioSettingsService;
    visualizerService?: IVisualizerService;
    galaxyService?: IGalaxyService;
    scannerService?: IScannerService;
  }): void {
    const root = document.getElementById('app');
    if (!root) {
      this.logger.error('Root element "#app" not found in DOM.');
      return;
    }

    this.appShell = new AppShell({
      playbackManager: services.playbackManager,
      libraryService: services.libraryService,
      searchService: services.searchService,
      playlistService: services.playlistService,
      lyricsService: services.lyricsService,
      audioEngine: services.audioEngine,
      audioSettingsService: services.audioSettingsService,
      visualizerService: services.visualizerService,
      galaxyService: services.galaxyService,
      scannerService: services.scannerService,
      eventBus: this.eventBus
    });
    this.appShell.mount(root);
  }

  /**
   * Safely cleans up any legacy demo/seed records from IndexedDB without touching real user data.
   */
  private async cleanupDemoData(adapter: IDatabaseAdapter): Promise<void> {
    try {
      const alreadyCleaned = await adapter.get<{ key: string; value: boolean }>(STORES.SETTINGS, 'demo_cleanup_v1');
      if (alreadyCleaned?.value) {
        return;
      }

      // Check tracks
      const allTracks = await adapter.getAll<{ id: string; source?: string; title?: string }>(STORES.TRACKS);
      for (const track of allTracks) {
        if (track.source === 'demo' || track.id.startsWith('demo_') || track.id.startsWith('mock_')) {
          await adapter.delete(STORES.TRACKS, track.id);
        }
      }

      // Check audio files
      const allFiles = await adapter.getAll<{ id: string; source?: string }>(STORES.AUDIO_FILES);
      for (const file of allFiles) {
        if (file.source === 'demo' || file.id.startsWith('demo_') || file.id.startsWith('mock_')) {
          await adapter.delete(STORES.AUDIO_FILES, file.id);
        }
      }

      // Check playlists
      const allPlaylists = await adapter.getAll<{ id: string; source?: string }>(STORES.PLAYLISTS);
      for (const pl of allPlaylists) {
        if (pl.source === 'demo' || pl.id.startsWith('demo_') || pl.id.startsWith('mock_')) {
          await adapter.delete(STORES.PLAYLISTS, pl.id);
        }
      }

      // Mark demo cleanup as done
      await adapter.put(STORES.SETTINGS, { key: 'demo_cleanup_v1', value: true, timestamp: Date.now() });
      this.logger.info('Safe demo data cleanup completed.');
    } catch (err) {
      this.logger.warn('Demo cleanup skipped or encountered error:', { error: String(err) });
    }
  }
}
