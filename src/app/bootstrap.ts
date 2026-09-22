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
  IGalaxyService
} from '../services/contracts/service-contracts';
import { DEFAULT_AUDIO_SETTINGS } from '../domain/entities/audio-settings';
import { BUILT_IN_EQ_PRESETS } from '../services/audio/eq-presets';
import { DEFAULT_VISUALIZER_SETTINGS } from '../domain/entities/visualizer-settings';
import { DEFAULT_GALAXY_SETTINGS } from '../domain/entities/galaxy-types';

export interface AppContext {
  logger: Logger;
  eventBus: EventBus;
  appShell?: AppShell | undefined;
}

/**
 * Application Bootstrap
 * Initializes core foundation services, logs environment status, and mounts root shell.
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
  }): Promise<AppContext> {
    this.logger.info('Initializing Music Player App (Phase 14 Audio Galaxy)...');

    const capabilities = PlatformAdapter.getCapabilities();
    this.logger.info('Platform Capabilities detected:', capabilities as unknown as Record<string, unknown>);

    if (!capabilities.hasWebAudio) {
      this.logger.warn('Web Audio API is not supported in this runtime environment.');
    }

    if (!capabilities.hasIndexedDB) {
      this.logger.warn('IndexedDB is not supported in this runtime environment.');
    }

    this.mountRootShell(services);

    this.logger.info('Phase 14 Core UI & Navigation Shell mounted successfully.');

    return {
      logger: this.logger,
      eventBus: this.eventBus,
      appShell: this.appShell
    };
  }

  private mountRootShell(services?: {
    playbackManager: IPlaybackManager;
    libraryService: ILibraryService;
    searchService: ISearchService;
    playlistService?: IPlaylistService;
    lyricsService?: ILyricsService;
    audioEngine?: IAudioEngine;
    audioSettingsService?: IAudioSettingsService;
    visualizerService?: IVisualizerService;
    galaxyService?: IGalaxyService;
  }): void {
    const root = document.getElementById('app');
    if (!root) {
      this.logger.error('Root element "#app" not found in DOM.');
      return;
    }

    if (services) {
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
        eventBus: this.eventBus
      });
      this.appShell.mount(root);
    } else {
      // Stub fallback shell when initializing standalone without full service container
      const stubPlaybackManager: IPlaybackManager = {
        state: 'idle',
        currentTrack: null,
        positionMs: 0,
        durationMs: 0,
        volume: 1.0,
        isMuted: false,
        playbackRate: 1.0,
        repeatMode: 'off',
        shuffleMode: 'off',
        queue: [],
        currentQueueIndex: -1,
        playTrack: async () => {},
        pause: async () => {},
        resume: async () => {},
        stop: async () => {},
        seek: async () => {},
        next: async () => {},
        previous: async () => {},
        setVolume: () => {},
        setMuted: () => {},
        setPlaybackRate: () => {},
        setRepeatMode: () => {},
        setShuffleMode: () => {},
        addToQueue: async () => {},
        playQueueIndex: async () => {},
        removeFromQueue: async () => {},
        reorderQueue: async () => {},
        clearQueue: async () => {}
      };

      const stubLibraryService: ILibraryService = {
        getTrack: async () => null,
        listTracks: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        getAlbum: async () => null,
        listAlbums: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        getArtist: async () => null,
        listArtists: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        toggleFavorite: async () => false,
        getLibraryStats: async () => ({ trackCount: 0, albumCount: 0, artistCount: 0 }),
        listGenres: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        listFolders: async () => []
      };

      const stubSearchService: ISearchService = {
        search: async () => ({ tracks: [], albums: [], artists: [], playlists: [] }),
        searchTracks: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        searchAlbums: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        searchArtists: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        searchPlaylists: async () => ({ items: [], total: 0, offset: 0, limit: 50 })
      };

      const stubPlaylistService: IPlaylistService = {
        getPlaylist: async () => null,
        getPlaylistWithTracks: async () => null,
        listPlaylists: async () => ({ items: [], total: 0, offset: 0, limit: 50 }),
        createPlaylist: async name => ({
          id: 'pl_stub',
          name,
          isSmart: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trackCount: 0,
          durationMs: 0
        }),
        updatePlaylist: async (id, updates) => ({
          id,
          name: updates.name ?? 'Stub',
          description: updates.description,
          isSmart: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          trackCount: 0,
          durationMs: 0
        }),
        deletePlaylist: async () => {},
        addTracksToPlaylist: async () => {},
        removeTrackFromPlaylist: async () => {},
        reorderPlaylistItems: async () => {}
      };

      const stubLyricsService: ILyricsService = {
        getLyrics: async () => null,
        saveLyrics: async () => {},
        deleteLyrics: async () => {},
        parseLrc: (content: string, trackId = 'stub_track') => ({
          id: 'stub_lyrics',
          trackId,
          type: 'plain',
          plainText: content,
          lines: [],
          updatedAt: Date.now()
        })
      };

      const stubAudioSettingsService: IAudioSettingsService = {
        getSettings: async () => DEFAULT_AUDIO_SETTINGS,
        saveSettings: async partial => ({ ...DEFAULT_AUDIO_SETTINGS, ...partial }),
        resetToDefaults: async () => DEFAULT_AUDIO_SETTINGS,
        getBuiltInPresets: () => BUILT_IN_EQ_PRESETS,
        saveCustomPreset: async name => ({
          id: 'custom_stub',
          name,
          isBuiltIn: false,
          bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          preampGainDb: 0
        }),
        deleteCustomPreset: async () => {},
        applyToAudioEngine: async () => {}
      };

      const stubVisualizerService: IVisualizerService = {
        getSettings: async () => DEFAULT_VISUALIZER_SETTINGS,
        saveSettings: async partial => ({ ...DEFAULT_VISUALIZER_SETTINGS, ...partial }),
        setMode: async mode => ({ ...DEFAULT_VISUALIZER_SETTINGS, mode }),
        setEnabled: async enabled => ({ ...DEFAULT_VISUALIZER_SETTINGS, enabled }),
        resetToDefaults: async () => DEFAULT_VISUALIZER_SETTINGS
      };

      const stubGalaxyService: IGalaxyService = {
        getGraph: async () => ({ nodes: [], edges: [], totalNodes: 0, totalEdges: 0, createdAt: Date.now() }),
        invalidateCache: () => {},
        getSettings: async () => DEFAULT_GALAXY_SETTINGS,
        saveSettings: async partial => ({ ...DEFAULT_GALAXY_SETTINGS, ...partial })
      };

      this.appShell = new AppShell({
        playbackManager: stubPlaybackManager,
        libraryService: stubLibraryService,
        searchService: stubSearchService,
        playlistService: stubPlaylistService,
        lyricsService: stubLyricsService,
        audioSettingsService: stubAudioSettingsService,
        visualizerService: stubVisualizerService,
        galaxyService: stubGalaxyService,
        eventBus: this.eventBus
      });
      this.appShell.mount(root);
    }
  }
}
