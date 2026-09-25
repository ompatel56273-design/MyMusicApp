import type { ILibraryService } from '../contracts/service-contracts';
import type {
  ITrackRepository,
  IAlbumRepository,
  IArtistRepository,
  IGenreRepository,
  IFolderRepository,
  PaginationOptions,
  PaginatedResult,
  TrackFilter
} from '../../domain/repositories/repository-contracts';
import type { Track, Album, Artist, Genre, Folder } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';

export interface LibraryServiceRepositories {
  trackRepo: ITrackRepository;
  albumRepo: IAlbumRepository;
  artistRepo: IArtistRepository;
  genreRepo?: IGenreRepository | undefined;
  folderRepo?: IFolderRepository | undefined;
  eventBus: EventBus;
}

/**
 * Concrete Library Service.
 * Implements high-level library queries, pagination, stats, and favorite toggling.
 */
export class LibraryService implements ILibraryService {
  private readonly logger = new Logger('LibraryService');
  private readonly trackRepo: ITrackRepository;
  private readonly albumRepo: IAlbumRepository;
  private readonly artistRepo: IArtistRepository;
  private readonly genreRepo?: IGenreRepository | undefined;
  private readonly folderRepo?: IFolderRepository | undefined;
  private readonly eventBus: EventBus;

  constructor(repos: LibraryServiceRepositories) {
    this.trackRepo = repos.trackRepo;
    this.albumRepo = repos.albumRepo;
    this.artistRepo = repos.artistRepo;
    this.genreRepo = repos.genreRepo;
    this.folderRepo = repos.folderRepo;
    this.eventBus = repos.eventBus;
  }

  public async getTrack(id: EntityId): Promise<Track | null> {
    return this.trackRepo.getById(id);
  }

  public async listTracks(options?: PaginationOptions, filter?: TrackFilter): Promise<PaginatedResult<Track>> {
    return this.trackRepo.list(options, filter);
  }

  public async getAlbum(id: EntityId): Promise<Album | null> {
    return this.albumRepo.getById(id);
  }

  public async listAlbums(options?: PaginationOptions, artistId?: EntityId): Promise<PaginatedResult<Album>> {
    return this.albumRepo.list(options, artistId);
  }

  public async getArtist(id: EntityId): Promise<Artist | null> {
    return this.artistRepo.getById(id);
  }

  public async listArtists(options?: PaginationOptions): Promise<PaginatedResult<Artist>> {
    return this.artistRepo.list(options);
  }

  public async listGenres(options?: PaginationOptions): Promise<PaginatedResult<Genre>> {
    if (this.genreRepo) {
      return this.genreRepo.list(options);
    }
    return { items: [], total: 0, offset: options?.offset ?? 0, limit: options?.limit ?? 50 };
  }

  public async listFolders(parentId?: EntityId): Promise<readonly Folder[]> {
    if (this.folderRepo) {
      return this.folderRepo.listChildren(parentId);
    }
    return [];
  }

  public async toggleFavorite(trackId: EntityId): Promise<boolean> {
    const track = await this.trackRepo.getById(trackId);
    if (!track) {
      this.logger.warn(`Cannot toggle favorite for nonexistent track: ${trackId}`);
      return false;
    }

    const nextState = !track.isFavorite;
    await this.trackRepo.setFavorite(trackId, nextState);

    this.eventBus.publish(DomainEvents.FAVORITE_CHANGED, {
      trackId,
      isFavorite: nextState
    });

    return nextState;
  }

  public async getLibraryStats(): Promise<{ trackCount: number; albumCount: number; artistCount: number }> {
    const [trackCount, albumsResult, artistsResult, allTracksResult] = await Promise.all([
      this.trackRepo.count(),
      this.albumRepo.list({ offset: 0, limit: 10000 }),
      this.artistRepo.list({ offset: 0, limit: 10000 }),
      this.trackRepo.list({ limit: 10000 })
    ]);

    const realArtistsInRepo = (artistsResult.items || []).filter(a => a.name && a.name.toLowerCase() !== 'unknown artist');
    const realAlbumsInRepo = (albumsResult.items || []).filter(a => a.title && a.title.toLowerCase() !== 'unknown album');

    let artistCount = artistsResult.total > 0 && artistsResult.items.length === artistsResult.total ? realArtistsInRepo.length : artistsResult.total;
    let albumCount = albumsResult.total > 0 && albumsResult.items.length === albumsResult.total ? realAlbumsInRepo.length : albumsResult.total;

    if (artistCount === 0 && allTracksResult.items.length > 0) {
      const distinctArtists = new Set<string>();
      for (const t of allTracksResult.items) {
        if (t.artistName && t.artistName.toLowerCase() !== 'unknown artist') {
          distinctArtists.add(t.artistName.trim().toLowerCase());
        }
      }
      artistCount = distinctArtists.size;
    }

    if (albumCount === 0 && allTracksResult.items.length > 0) {
      const distinctAlbums = new Set<string>();
      for (const t of allTracksResult.items) {
        if (t.albumTitle && t.albumTitle.toLowerCase() !== 'unknown album') {
          const key = `${t.albumTitle.trim().toLowerCase()}:::${(t.artistName || '').trim().toLowerCase()}`;
          distinctAlbums.add(key);
        }
      }
      albumCount = distinctAlbums.size;
    }

    return {
      trackCount,
      albumCount,
      artistCount
    };
  }
}
