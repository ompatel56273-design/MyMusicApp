import { QueryNormalizer } from './query-normalizer';
import { SearchRanker } from './search-ranker';
import type { ScoredMatch } from './search-types';
import type {
  ITrackRepository,
  IAlbumRepository,
  IArtistRepository,
  IPlaylistRepository,
  IGenreRepository,
  IFolderRepository,
  PaginationOptions,
  PaginatedResult,
  TrackFilter
} from '../../domain/repositories/repository-contracts';
import type { Track, Album, Artist, Playlist, Genre, Folder } from '../../domain/entities/models';
import type { ISearchService, SearchResults } from '../contracts/service-contracts';

export interface SearchServiceRepositories {
  trackRepo: ITrackRepository;
  albumRepo: IAlbumRepository;
  artistRepo: IArtistRepository;
  playlistRepo: IPlaylistRepository;
  genreRepo?: IGenreRepository | undefined;
  folderRepo?: IFolderRepository | undefined;
}

/**
 * Concrete Search Service.
 * Implements local multi-entity search across tracks, albums, artists, playlists, genres, and folders.
 */
export class SearchService implements ISearchService {
  private readonly trackRepo: ITrackRepository;
  private readonly albumRepo: IAlbumRepository;
  private readonly artistRepo: IArtistRepository;
  private readonly playlistRepo: IPlaylistRepository;
  private readonly genreRepo?: IGenreRepository | undefined;
  private readonly folderRepo?: IFolderRepository | undefined;

  constructor(repos: SearchServiceRepositories) {
    this.trackRepo = repos.trackRepo;
    this.albumRepo = repos.albumRepo;
    this.artistRepo = repos.artistRepo;
    this.playlistRepo = repos.playlistRepo;
    this.genreRepo = repos.genreRepo;
    this.folderRepo = repos.folderRepo;
  }

  /**
   * Unified search across all library entity categories.
   */
  public async search(query: string, limitPerCategory = 5): Promise<SearchResults> {
    const normalizedQuery = QueryNormalizer.normalize(query);
    if (!normalizedQuery) {
      return {
        tracks: [],
        albums: [],
        artists: [],
        playlists: [],
        genres: [],
        folders: []
      };
    }

    const queryTokens = QueryNormalizer.tokenize(normalizedQuery);
    const limit = Math.max(1, limitPerCategory);

    const [tracksResult, albumsResult, artistsResult, playlistsResult, genresResult, foldersResult] = await Promise.all([
      this.findMatchingTracks(normalizedQuery, queryTokens),
      this.findMatchingAlbums(normalizedQuery, queryTokens),
      this.findMatchingArtists(normalizedQuery, queryTokens),
      this.findMatchingPlaylists(normalizedQuery, queryTokens),
      this.findMatchingGenres(normalizedQuery, queryTokens),
      this.findMatchingFolders(normalizedQuery, queryTokens)
    ]);

    return {
      tracks: tracksResult.slice(0, limit),
      albums: albumsResult.slice(0, limit),
      artists: artistsResult.slice(0, limit),
      playlists: playlistsResult.slice(0, limit),
      genres: genresResult.slice(0, limit),
      folders: foldersResult.slice(0, limit)
    };
  }

  public async searchTracks(query: string, options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>> {
    const normalizedQuery = QueryNormalizer.normalize(query);
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 50);

    if (!normalizedQuery) {
      return this.trackRepo.list(options, filter);
    }

    const queryTokens = QueryNormalizer.tokenize(normalizedQuery);
    const allMatches = await this.findMatchingTracks(normalizedQuery, queryTokens, filter);

    const total = allMatches.length;
    const items = allMatches.slice(offset, offset + limit);

    return {
      items,
      total,
      offset,
      limit
    };
  }

  public async searchAlbums(query: string, options?: PaginationOptions): Promise<PaginatedResult<Album>> {
    const normalizedQuery = QueryNormalizer.normalize(query);
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 50);

    if (!normalizedQuery) {
      return this.albumRepo.list(options);
    }

    const queryTokens = QueryNormalizer.tokenize(normalizedQuery);
    const allMatches = await this.findMatchingAlbums(normalizedQuery, queryTokens);

    const total = allMatches.length;
    const items = allMatches.slice(offset, offset + limit);

    return {
      items,
      total,
      offset,
      limit
    };
  }

  public async searchArtists(query: string, options?: PaginationOptions): Promise<PaginatedResult<Artist>> {
    const normalizedQuery = QueryNormalizer.normalize(query);
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 50);

    if (!normalizedQuery) {
      return this.artistRepo.list(options);
    }

    const queryTokens = QueryNormalizer.tokenize(normalizedQuery);
    const allMatches = await this.findMatchingArtists(normalizedQuery, queryTokens);

    const total = allMatches.length;
    const items = allMatches.slice(offset, offset + limit);

    return {
      items,
      total,
      offset,
      limit
    };
  }

  public async searchPlaylists(query: string, options?: PaginationOptions): Promise<PaginatedResult<Playlist>> {
    const normalizedQuery = QueryNormalizer.normalize(query);
    const offset = Math.max(0, options?.offset ?? 0);
    const limit = Math.max(1, options?.limit ?? 50);

    if (!normalizedQuery) {
      return this.playlistRepo.list(options);
    }

    const queryTokens = QueryNormalizer.tokenize(normalizedQuery);
    const allMatches = await this.findMatchingPlaylists(normalizedQuery, queryTokens);

    const total = allMatches.length;
    const items = allMatches.slice(offset, offset + limit);

    return {
      items,
      total,
      offset,
      limit
    };
  }

  // --- Entity Match Finding Helpers ---

  private async findMatchingTracks(
    normalizedQuery: string,
    queryTokens: readonly string[],
    filter?: TrackFilter
  ): Promise<readonly Track[]> {
    const paginated = await this.trackRepo.list({ offset: 0, limit: 10000 }, filter);
    const matches: ScoredMatch<Track>[] = [];

    for (const track of paginated.items) {
      let bestScore = 0;
      let bestQuality: any = 'none';
      let matchedField = '';

      // Check title (primary)
      const titleEval = QueryNormalizer.evaluateMatch(track.title, normalizedQuery, queryTokens);
      if (titleEval.matches && titleEval.score > bestScore) {
        bestScore = titleEval.score;
        bestQuality = titleEval.quality;
        matchedField = 'title';
      }

      // Check artistName
      if (track.artistName) {
        const artistEval = QueryNormalizer.evaluateMatch(track.artistName, normalizedQuery, queryTokens);
        if (artistEval.matches && artistEval.score * 0.9 > bestScore) {
          bestScore = Math.round(artistEval.score * 0.9);
          bestQuality = artistEval.quality;
          matchedField = 'artistName';
        }
      }

      // Check albumTitle
      if (track.albumTitle) {
        const albumEval = QueryNormalizer.evaluateMatch(track.albumTitle, normalizedQuery, queryTokens);
        if (albumEval.matches && albumEval.score * 0.8 > bestScore) {
          bestScore = Math.round(albumEval.score * 0.8);
          bestQuality = albumEval.quality;
          matchedField = 'albumTitle';
        }
      }

      // Check genreName
      if (track.genreName) {
        const genreEval = QueryNormalizer.evaluateMatch(track.genreName, normalizedQuery, queryTokens);
        if (genreEval.matches && genreEval.score * 0.7 > bestScore) {
          bestScore = Math.round(genreEval.score * 0.7);
          bestQuality = genreEval.quality;
          matchedField = 'genreName';
        }
      }

      if (bestScore > 0) {
        matches.push({
          item: track,
          entityType: 'track',
          entityId: track.id,
          score: bestScore,
          quality: bestQuality,
          matchedField
        });
      }
    }

    return SearchRanker.rankMatches(matches);
  }

  private async findMatchingAlbums(normalizedQuery: string, queryTokens: readonly string[]): Promise<readonly Album[]> {
    const paginated = await this.albumRepo.list({ offset: 0, limit: 10000 });
    const matches: ScoredMatch<Album>[] = [];

    for (const album of paginated.items) {
      let bestScore = 0;
      let bestQuality: any = 'none';
      let matchedField = '';

      const titleEval = QueryNormalizer.evaluateMatch(album.title, normalizedQuery, queryTokens);
      if (titleEval.matches && titleEval.score > bestScore) {
        bestScore = titleEval.score;
        bestQuality = titleEval.quality;
        matchedField = 'title';
      }

      if (album.sortTitle) {
        const sortEval = QueryNormalizer.evaluateMatch(album.sortTitle, normalizedQuery, queryTokens);
        if (sortEval.matches && sortEval.score > bestScore) {
          bestScore = sortEval.score;
          bestQuality = sortEval.quality;
          matchedField = 'sortTitle';
        }
      }

      if (album.artistName) {
        const artistEval = QueryNormalizer.evaluateMatch(album.artistName, normalizedQuery, queryTokens);
        if (artistEval.matches && artistEval.score * 0.85 > bestScore) {
          bestScore = Math.round(artistEval.score * 0.85);
          bestQuality = artistEval.quality;
          matchedField = 'artistName';
        }
      }

      if (bestScore > 0) {
        matches.push({
          item: album,
          entityType: 'album',
          entityId: album.id,
          score: bestScore,
          quality: bestQuality,
          matchedField
        });
      }
    }

    return SearchRanker.rankMatches(matches);
  }

  private async findMatchingArtists(normalizedQuery: string, queryTokens: readonly string[]): Promise<readonly Artist[]> {
    const paginated = await this.artistRepo.list({ offset: 0, limit: 10000 });
    const matches: ScoredMatch<Artist>[] = [];

    for (const artist of paginated.items) {
      let bestScore = 0;
      let bestQuality: any = 'none';
      let matchedField = '';

      const nameEval = QueryNormalizer.evaluateMatch(artist.name, normalizedQuery, queryTokens);
      if (nameEval.matches && nameEval.score > bestScore) {
        bestScore = nameEval.score;
        bestQuality = nameEval.quality;
        matchedField = 'name';
      }

      if (artist.sortName) {
        const sortEval = QueryNormalizer.evaluateMatch(artist.sortName, normalizedQuery, queryTokens);
        if (sortEval.matches && sortEval.score > bestScore) {
          bestScore = sortEval.score;
          bestQuality = sortEval.quality;
          matchedField = 'sortName';
        }
      }

      if (bestScore > 0) {
        matches.push({
          item: artist,
          entityType: 'artist',
          entityId: artist.id,
          score: bestScore,
          quality: bestQuality,
          matchedField
        });
      }
    }

    return SearchRanker.rankMatches(matches);
  }

  private async findMatchingPlaylists(normalizedQuery: string, queryTokens: readonly string[]): Promise<readonly Playlist[]> {
    const paginated = await this.playlistRepo.list({ offset: 0, limit: 10000 });
    const matches: ScoredMatch<Playlist>[] = [];

    for (const playlist of paginated.items) {
      let bestScore = 0;
      let bestQuality: any = 'none';
      let matchedField = '';

      const nameEval = QueryNormalizer.evaluateMatch(playlist.name, normalizedQuery, queryTokens);
      if (nameEval.matches && nameEval.score > bestScore) {
        bestScore = nameEval.score;
        bestQuality = nameEval.quality;
        matchedField = 'name';
      }

      if (playlist.description) {
        const descEval = QueryNormalizer.evaluateMatch(playlist.description, normalizedQuery, queryTokens);
        if (descEval.matches && descEval.score * 0.7 > bestScore) {
          bestScore = Math.round(descEval.score * 0.7);
          bestQuality = descEval.quality;
          matchedField = 'description';
        }
      }

      if (bestScore > 0) {
        matches.push({
          item: playlist,
          entityType: 'playlist',
          entityId: playlist.id,
          score: bestScore,
          quality: bestQuality,
          matchedField
        });
      }
    }

    return SearchRanker.rankMatches(matches);
  }

  private async findMatchingGenres(normalizedQuery: string, queryTokens: readonly string[]): Promise<readonly Genre[]> {
    if (!this.genreRepo) return [];

    const paginated = await this.genreRepo.list({ offset: 0, limit: 10000 });
    const matches: ScoredMatch<Genre>[] = [];

    for (const genre of paginated.items) {
      const nameEval = QueryNormalizer.evaluateMatch(genre.name, normalizedQuery, queryTokens);
      if (nameEval.matches) {
        matches.push({
          item: genre,
          entityType: 'genre',
          entityId: genre.id,
          score: nameEval.score,
          quality: nameEval.quality,
          matchedField: 'name'
        });
      }
    }

    return SearchRanker.rankMatches(matches);
  }

  private async findMatchingFolders(normalizedQuery: string, queryTokens: readonly string[]): Promise<readonly Folder[]> {
    if (!this.folderRepo) return [];

    const folders = await this.folderRepo.listChildren();
    const matches: ScoredMatch<Folder>[] = [];

    for (const folder of folders) {
      let bestScore = 0;
      let bestQuality: any = 'none';
      let matchedField = '';

      const nameEval = QueryNormalizer.evaluateMatch(folder.name, normalizedQuery, queryTokens);
      if (nameEval.matches && nameEval.score > bestScore) {
        bestScore = nameEval.score;
        bestQuality = nameEval.quality;
        matchedField = 'name';
      }

      const pathEval = QueryNormalizer.evaluateMatch(folder.path, normalizedQuery, queryTokens);
      if (pathEval.matches && pathEval.score * 0.6 > bestScore) {
        bestScore = Math.round(pathEval.score * 0.6);
        bestQuality = pathEval.quality;
        matchedField = 'path';
      }

      if (bestScore > 0) {
        matches.push({
          item: folder,
          entityType: 'folder',
          entityId: folder.id,
          score: bestScore,
          quality: bestQuality,
          matchedField
        });
      }
    }

    return SearchRanker.rankMatches(matches);
  }
}
