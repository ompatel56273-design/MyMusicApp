import { QueryNormalizer } from './query-normalizer';
import type { ISearchService, ILibraryService, IPlaylistService } from '../contracts/service-contracts';
import type { Track, Album, Artist, Playlist, Genre, Folder } from '../../domain/entities/models';
import type { AppRoute } from '../../ui/navigation/route-types';

export type GlobalSearchResultCategory =
  | 'settings'
  | 'pages'
  | 'folders'
  | 'tracks'
  | 'artists'
  | 'albums'
  | 'playlists'
  | 'genres';

export interface GlobalSearchResultItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly category: GlobalSearchResultCategory;
  readonly icon: string;
  readonly score: number;
  readonly route: AppRoute;
  readonly params?: Record<string, any> | undefined;
  readonly data?: Track | Album | Artist | Playlist | Genre | Folder | undefined;
}

export interface GroupedGlobalSearchResults {
  readonly query: string;
  readonly totalMatches: number;
  readonly settings: readonly GlobalSearchResultItem[];
  readonly pages: readonly GlobalSearchResultItem[];
  readonly folders: readonly GlobalSearchResultItem[];
  readonly tracks: readonly GlobalSearchResultItem[];
  readonly artists: readonly GlobalSearchResultItem[];
  readonly albums: readonly GlobalSearchResultItem[];
  readonly playlists: readonly GlobalSearchResultItem[];
  readonly genres: readonly GlobalSearchResultItem[];
}

interface StaticAppResource {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly category: 'settings' | 'pages';
  readonly icon: string;
  readonly keywords: readonly string[];
  readonly route: AppRoute;
  readonly params?: Record<string, any> | undefined;
}

const STATIC_APP_RESOURCES: readonly StaticAppResource[] = [
  // Settings Sections
  {
    id: 'setting-music-access',
    title: 'Local Music Access',
    subtitle: 'Manage indexed music directories and folder access',
    category: 'settings',
    icon: 'folder',
    keywords: ['music', 'folder', 'directory', 'directories', 'access', 'scan', 'path', 'local', 'music access'],
    route: 'settings',
    params: { section: 'music-access', id: 'music-access' }
  },
  {
    id: 'setting-playback',
    title: 'Playback Preferences',
    subtitle: 'Autoplay, gapless playback, crossfade, and resume',
    category: 'settings',
    icon: 'play',
    keywords: ['playback', 'autoplay', 'gapless', 'crossfade', 'resume', 'player preferences', 'play'],
    route: 'settings',
    params: { section: 'playback', id: 'playback' }
  },
  {
    id: 'setting-audio',
    title: 'Audio DSP & EQ',
    subtitle: '10-band graphic equalizer, preamp, bass boost, and ReplayGain',
    category: 'settings',
    icon: 'volume',
    keywords: ['equalizer', 'eq', 'dsp', 'audio', 'bass', 'treble', 'replaygain', 'preamp', 'sound', 'volume', 'graphic eq', 'audio dsp'],
    route: 'settings',
    params: { section: 'audio', id: 'audio' }
  },
  {
    id: 'setting-appearance',
    title: 'Theme & Style',
    subtitle: 'Dark/light mode, accent palettes, ambient glow, and layout density',
    category: 'settings',
    icon: 'settings',
    keywords: ['theme', 'style', 'appearance', 'dark', 'light', 'accent', 'colors', 'ambient', 'design', 'density'],
    route: 'settings',
    params: { section: 'appearance', id: 'appearance' }
  },
  {
    id: 'setting-dashboard',
    title: 'Dashboard Customization',
    subtitle: 'Configure home view modules and hero banner layout',
    category: 'settings',
    icon: 'grid',
    keywords: ['dashboard', 'home customization', 'widgets', 'layout', 'modules', 'cards'],
    route: 'settings',
    params: { section: 'dashboard', id: 'dashboard' }
  },
  {
    id: 'setting-visualizer',
    title: 'Audio Visualizer',
    subtitle: 'Frequency bars, wave forms, circular spectrum, and cinema mode',
    category: 'settings',
    icon: 'maximize',
    keywords: ['visualizer', 'spectrum', 'waves', 'frequency', 'cinema', 'fullscreen', 'audio effects', 'canvas'],
    route: 'settings',
    params: { section: 'visualizer', id: 'visualizer' }
  },
  {
    id: 'setting-galaxy',
    title: 'Audio Galaxy Settings',
    subtitle: 'Constellation clustering, star orbits, and celestial nodes',
    category: 'settings',
    icon: 'galaxy',
    keywords: ['galaxy', 'galaxy settings', 'stars', 'constellation', 'orbit', 'celestial', '3d', '2d'],
    route: 'settings',
    params: { section: 'galaxy', id: 'galaxy' }
  },
  {
    id: 'setting-storage',
    title: 'Storage & Database',
    subtitle: 'Local IndexedDB storage, track cache, and database maintenance',
    category: 'settings',
    icon: 'library',
    keywords: ['storage', 'database', 'indexeddb', 'clear data', 'cache', 'memory', 'reset', 'db'],
    route: 'settings',
    params: { section: 'storage', id: 'storage' }
  },
  {
    id: 'setting-backup',
    title: 'Data & Backup',
    subtitle: 'Export and restore playlists, favorites, and library metadata',
    category: 'settings',
    icon: 'download',
    keywords: ['backup', 'export', 'import', 'restore', 'save', 'data', 'json', 'data backup'],
    route: 'settings',
    params: { section: 'backup', id: 'backup' }
  },
  {
    id: 'setting-devices',
    title: 'Audio Output Devices',
    subtitle: 'Select speakers, headphones, or external audio interfaces',
    category: 'settings',
    icon: 'volume',
    keywords: ['devices', 'output', 'audio output', 'speakers', 'headphones', 'sink', 'audio device', 'hardware'],
    route: 'settings',
    params: { section: 'devices', id: 'devices' }
  },
  {
    id: 'setting-privacy',
    title: 'Privacy & Telemetry',
    subtitle: '100% offline, local-first data isolation and zero tracking',
    category: 'settings',
    icon: 'settings',
    keywords: ['privacy', 'telemetry', 'tracking', 'local', 'offline', 'data isolation', 'security'],
    route: 'settings',
    params: { section: 'privacy', id: 'privacy' }
  },
  {
    id: 'setting-about',
    title: 'About & Architecture',
    subtitle: 'MyMusicApp version, audio engine specs, and license',
    category: 'settings',
    icon: 'info',
    keywords: ['about', 'architecture', 'version', 'info', 'specs', 'mymusicapp', 'help'],
    route: 'settings',
    params: { section: 'about', id: 'about' }
  },

  // Application Pages & Views
  {
    id: 'page-home',
    title: 'Home Dashboard',
    subtitle: 'Discovery, trending mixes, and quick access',
    category: 'pages',
    icon: 'home',
    keywords: ['home', 'dashboard', 'trending', 'recent', 'discovery', 'feed'],
    route: 'home'
  },
  {
    id: 'page-library',
    title: 'Music Library',
    subtitle: 'Browse all tracks, albums, artists, genres, and folders',
    category: 'pages',
    icon: 'library',
    keywords: ['library', 'music library', 'collection', 'my music'],
    route: 'library'
  },
  {
    id: 'page-library-songs',
    title: 'Library: Songs',
    subtitle: 'All indexed music tracks in your library',
    category: 'pages',
    icon: 'music',
    keywords: ['songs', 'tracks', 'all songs', 'track list'],
    route: 'library',
    params: { tab: 'songs' }
  },
  {
    id: 'page-library-albums',
    title: 'Library: Albums',
    subtitle: 'Browse collection by album releases',
    category: 'pages',
    icon: 'disc',
    keywords: ['albums', 'discography', 'records'],
    route: 'library',
    params: { tab: 'albums' }
  },
  {
    id: 'page-library-artists',
    title: 'Library: Artists',
    subtitle: 'Browse collection by performing artists',
    category: 'pages',
    icon: 'user',
    keywords: ['artists', 'bands', 'singers', 'performers'],
    route: 'library',
    params: { tab: 'artists' }
  },
  {
    id: 'page-library-genres',
    title: 'Library: Genres',
    subtitle: 'Filter music by musical genres and categories',
    category: 'pages',
    icon: 'sparkles',
    keywords: ['genres', 'styles', 'categories', 'genre'],
    route: 'library',
    params: { tab: 'genres' }
  },
  {
    id: 'page-library-folders',
    title: 'Library: Folders',
    subtitle: 'Direct filesystem folder browser for indexed files',
    category: 'pages',
    icon: 'folder',
    keywords: ['folders', 'folder browser', 'filesystem', 'directories'],
    route: 'library',
    params: { tab: 'folders' }
  },
  {
    id: 'page-library-favorites',
    title: 'Library: Favorites',
    subtitle: 'Your starred and favorite tracks',
    category: 'pages',
    icon: 'heart-filled',
    keywords: ['favorites', 'starred', 'liked', 'favs', 'hearts', 'favorite songs'],
    route: 'library',
    params: { tab: 'favorites' }
  },
  {
    id: 'page-playlists',
    title: 'Playlists Hub',
    subtitle: 'Custom playlists, favorites, and smart mixes',
    category: 'pages',
    icon: 'playlist',
    keywords: ['playlists', 'playlist', 'custom playlists', 'mixes', 'collections'],
    route: 'playlists'
  },
  {
    id: 'page-galaxy',
    title: 'Music Galaxy',
    subtitle: 'Interactive celestial discovery & constellation universe',
    category: 'pages',
    icon: 'galaxy',
    keywords: ['galaxy', 'universe', 'celestial', 'constellation', 'discovery', 'music galaxy'],
    route: 'galaxy'
  },
  {
    id: 'page-nowplaying',
    title: 'Now Playing',
    subtitle: 'Fullscreen player with lyrics, audio info, and queue',
    category: 'pages',
    icon: 'now-playing',
    keywords: ['now playing', 'player', 'fullscreen', 'lyrics', 'queue', 'up next', 'audio info'],
    route: 'nowplaying'
  },
  {
    id: 'page-stats',
    title: 'Listening Statistics',
    subtitle: 'Playback analytics, top artists, top genres, and play counts',
    category: 'pages',
    icon: 'flame',
    keywords: ['stats', 'statistics', 'analytics', 'listening stats', 'history', 'top played'],
    route: 'stats'
  },
  {
    id: 'page-settings',
    title: 'Application Settings',
    subtitle: 'Audio DSP, themes, storage, and system preferences',
    category: 'pages',
    icon: 'settings',
    keywords: ['settings', 'preferences', 'configuration', 'options', 'setup'],
    route: 'settings'
  }
];

export interface GlobalSearchDependencies {
  searchService?: ISearchService | undefined;
  libraryService?: ILibraryService | undefined;
  playlistService?: IPlaylistService | undefined;
}

export class GlobalSearchService {
  public readonly searchService?: ISearchService | undefined;
  public readonly libraryService?: ILibraryService | undefined;
  public readonly playlistService?: IPlaylistService | undefined;

  constructor(deps?: GlobalSearchDependencies) {
    this.searchService = deps?.searchService;
    this.libraryService = deps?.libraryService;
    this.playlistService = deps?.playlistService;
  }

  public async searchGlobal(query: string, limitPerCategory = 4): Promise<GroupedGlobalSearchResults> {
    const raw = query?.trim() ?? '';
    const normalized = QueryNormalizer.normalize(raw);

    if (!normalized) {
      return {
        query: raw,
        totalMatches: 0,
        settings: [],
        pages: [],
        folders: [],
        tracks: [],
        artists: [],
        albums: [],
        playlists: [],
        genres: []
      };
    }

    const tokens = QueryNormalizer.tokenize(normalized);

    // 1. Search Static Application Resources (Settings & Pages)
    const matchedSettings: GlobalSearchResultItem[] = [];
    const matchedPages: GlobalSearchResultItem[] = [];

    for (const res of STATIC_APP_RESOURCES) {
      let bestScore = 0;

      // Title match
      const titleEval = QueryNormalizer.evaluateMatch(res.title, normalized, tokens);
      if (titleEval.matches && titleEval.score > bestScore) {
        bestScore = titleEval.score;
      }

      // Subtitle match
      const subEval = QueryNormalizer.evaluateMatch(res.subtitle, normalized, tokens);
      if (subEval.matches && Math.round(subEval.score * 0.8) > bestScore) {
        bestScore = Math.round(subEval.score * 0.8);
      }

      // Keywords match
      for (const kw of res.keywords) {
        const kwEval = QueryNormalizer.evaluateMatch(kw, normalized, tokens);
        if (kwEval.matches && kwEval.score > bestScore) {
          bestScore = kwEval.score;
        }
      }

      if (bestScore > 0) {
        const item: GlobalSearchResultItem = {
          id: res.id,
          title: res.title,
          subtitle: res.subtitle,
          category: res.category,
          icon: res.icon,
          score: bestScore,
          route: res.route,
          params: res.params
        };

        if (res.category === 'settings') {
          matchedSettings.push(item);
        } else {
          matchedPages.push(item);
        }
      }
    }

    // Sort static results by score
    matchedSettings.sort((a, b) => b.score - a.score);
    matchedPages.sort((a, b) => b.score - a.score);

    // 2. Search Dynamic Music & Filesystem Entities via SearchService
    const matchedFolders: GlobalSearchResultItem[] = [];
    const matchedTracks: GlobalSearchResultItem[] = [];
    const matchedArtists: GlobalSearchResultItem[] = [];
    const matchedAlbums: GlobalSearchResultItem[] = [];
    const matchedPlaylists: GlobalSearchResultItem[] = [];
    const matchedGenres: GlobalSearchResultItem[] = [];

    if (this.searchService) {
      try {
        const musicResults = await this.searchService.search(raw, 10);

        // Folders
        if (musicResults.folders) {
          for (const f of musicResults.folders) {
            const evalRes = QueryNormalizer.evaluateMatch(f.name, normalized, tokens);
            matchedFolders.push({
              id: f.id,
              title: f.name,
              subtitle: f.path || 'Indexed Folder',
              category: 'folders',
              icon: 'folder',
              score: evalRes.score || 50,
              route: 'library',
              params: { tab: 'folders' },
              data: f
            });
          }
        }

        // Tracks
        if (musicResults.tracks) {
          for (const t of musicResults.tracks) {
            const evalRes = QueryNormalizer.evaluateMatch(t.title, normalized, tokens);
            matchedTracks.push({
              id: t.id,
              title: t.title,
              subtitle: `${t.artistName || 'Unknown Artist'} • ${t.albumTitle || 'Unknown Album'}`,
              category: 'tracks',
              icon: 'music',
              score: evalRes.score || 50,
              route: 'library',
              params: { tab: 'songs' },
              data: t
            });
          }
        }

        // Artists
        if (musicResults.artists) {
          for (const a of musicResults.artists) {
            const evalRes = QueryNormalizer.evaluateMatch(a.name, normalized, tokens);
            matchedArtists.push({
              id: a.id,
              title: a.name,
              subtitle: `${a.trackCount ?? 0} tracks`,
              category: 'artists',
              icon: 'user',
              score: evalRes.score || 50,
              route: 'library',
              params: { tab: 'artists' },
              data: a
            });
          }
        }

        // Albums
        if (musicResults.albums) {
          for (const al of musicResults.albums) {
            const evalRes = QueryNormalizer.evaluateMatch(al.title, normalized, tokens);
            matchedAlbums.push({
              id: al.id,
              title: al.title,
              subtitle: `${al.artistName || 'Unknown Artist'} • ${al.trackCount ?? 0} tracks`,
              category: 'albums',
              icon: 'disc',
              score: evalRes.score || 50,
              route: 'library',
              params: { tab: 'albums' },
              data: al
            });
          }
        }

        // Playlists
        if (musicResults.playlists) {
          for (const p of musicResults.playlists) {
            const evalRes = QueryNormalizer.evaluateMatch(p.name, normalized, tokens);
            matchedPlaylists.push({
              id: p.id,
              title: p.name,
              subtitle: `${p.trackCount ?? 0} tracks`,
              category: 'playlists',
              icon: 'playlist',
              score: evalRes.score || 50,
              route: 'playlists',
              data: p
            });
          }
        }

        // Genres
        if (musicResults.genres) {
          for (const g of musicResults.genres) {
            const evalRes = QueryNormalizer.evaluateMatch(g.name, normalized, tokens);
            matchedGenres.push({
              id: g.id,
              title: g.name,
              subtitle: `${g.trackCount ?? 0} tracks`,
              category: 'genres',
              icon: 'sparkles',
              score: evalRes.score || 50,
              route: 'library',
              params: { tab: 'genres' },
              data: g
            });
          }
        }
      } catch (_e) {
        // Continue with static results if search service fails
      }
    }

    const slicedSettings = matchedSettings.slice(0, limitPerCategory);
    const slicedPages = matchedPages.slice(0, limitPerCategory);
    const slicedFolders = matchedFolders.slice(0, limitPerCategory);
    const slicedTracks = matchedTracks.slice(0, limitPerCategory);
    const slicedArtists = matchedArtists.slice(0, limitPerCategory);
    const slicedAlbums = matchedAlbums.slice(0, limitPerCategory);
    const slicedPlaylists = matchedPlaylists.slice(0, limitPerCategory);
    const slicedGenres = matchedGenres.slice(0, limitPerCategory);

    const totalMatches =
      slicedSettings.length +
      slicedPages.length +
      slicedFolders.length +
      slicedTracks.length +
      slicedArtists.length +
      slicedAlbums.length +
      slicedPlaylists.length +
      slicedGenres.length;

    return {
      query: raw,
      totalMatches,
      settings: slicedSettings,
      pages: slicedPages,
      folders: slicedFolders,
      tracks: slicedTracks,
      artists: slicedArtists,
      albums: slicedAlbums,
      playlists: slicedPlaylists,
      genres: slicedGenres
    };
  }
}
