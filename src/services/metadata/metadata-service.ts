import type { IMetadataReader, ExtractedMetadata } from './metadata-types';
import { MetadataNormalizer } from './metadata-normalizer';
import type { ArtworkService } from '../artwork/artwork-service';
import type {
  ITrackRepository,
  IAudioFileRepository,
  IArtistRepository,
  IAlbumRepository,
  IGenreRepository
} from '../../domain/repositories/repository-contracts';
import type { Track, Artist, Album, Genre } from '../../domain/entities/models';
import type { AudioContainer, EntityId } from '../../domain/value-objects/audio-types';
import { Logger } from '../../core/logging/logger';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';

export class MetadataService {
  private readonly reader: IMetadataReader;
  private readonly artworkService: ArtworkService;
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo: IAudioFileRepository;
  private readonly artistRepo: IArtistRepository;
  private readonly albumRepo: IAlbumRepository;
  private readonly genreRepo: IGenreRepository;
  private readonly eventBus: EventBus;
  private readonly logger = new Logger('MetadataService');

  constructor(
    reader: IMetadataReader,
    artworkService: ArtworkService,
    trackRepo: ITrackRepository,
    audioFileRepo: IAudioFileRepository,
    artistRepo: IArtistRepository,
    albumRepo: IAlbumRepository,
    genreRepo: IGenreRepository,
    eventBus: EventBus
  ) {
    this.reader = reader;
    this.artworkService = artworkService;
    this.trackRepo = trackRepo;
    this.audioFileRepo = audioFileRepo;
    this.artistRepo = artistRepo;
    this.albumRepo = albumRepo;
    this.genreRepo = genreRepo;
    this.eventBus = eventBus;
  }

  /**
   * Enriches an existing Track with parsed binary metadata buffer
   */
  public async enrichTrackMetadata(
    trackId: EntityId,
    fileBuffer: Uint8Array,
    containerHint?: AudioContainer
  ): Promise<Track | null> {
    const track = await this.trackRepo.getById(trackId);
    if (!track) {
      this.logger.warn(`Track not found for enrichment: ${trackId}`);
      return null;
    }

    const audioFile = await this.audioFileRepo.getById(track.fileId);
    const container = containerHint || (audioFile?.extension as AudioContainer) || track.format.container;

    try {
      const rawMetadata: ExtractedMetadata = await this.reader.readMetadata(fileBuffer, container);
      const normalized = MetadataNormalizer.normalize(rawMetadata, audioFile?.filename);

      // 1. Process Embedded Artwork
      let artworkId = track.artworkId;
      if (rawMetadata.artwork) {
        const registeredId = this.artworkService.registerArtwork(rawMetadata.artwork);
        if (registeredId) {
          artworkId = registeredId;
        }
      }

      // 2. Resolve / Create Artist (Never create 'Unknown Artist' entities)
      let artistId = track.artistId;
      const cleanArtist = normalized.primaryArtist?.trim();
      const hasValidArtist = normalized.hasRealArtist && cleanArtist && cleanArtist.toLowerCase() !== 'unknown artist';

      if (hasValidArtist) {
        let artist = await this.artistRepo.getByName(cleanArtist);
        if (!artist) {
          const allArtists = await this.artistRepo.list({ limit: 2000 });
          artist = allArtists.items.find(a => a.name.trim().toLowerCase() === cleanArtist.toLowerCase()) || null;
        }
        if (!artist) {
          artistId = `artist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newArtist: Artist = {
            id: artistId,
            name: cleanArtist,
            trackCount: 1,
            albumCount: normalized.albumTitle ? 1 : 0
          };
          await this.artistRepo.save(newArtist);
        } else {
          artistId = artist.id;
          if (track.artistId !== artist.id) {
            await this.artistRepo.save({
              ...artist,
              trackCount: (artist.trackCount || 0) + 1,
              albumCount: normalized.albumTitle ? Math.max(artist.albumCount, 1) : artist.albumCount
            });
          }
        }
      }

      // 3. Resolve / Create Album (Case-insensitive deduplication)
      let albumId = track.albumId;
      const cleanAlbum = normalized.albumTitle?.trim();
      const hasValidAlbum = cleanAlbum && cleanAlbum.toLowerCase() !== 'unknown album';

      if (hasValidAlbum) {
        let album: Album | null = null;
        const allAlbums = await this.albumRepo.list({ limit: 2000 }, artistId);
        album = allAlbums.items.find(
          a => a.title.trim().toLowerCase() === cleanAlbum.toLowerCase() &&
               (!artistId || !a.artistId || a.artistId === artistId)
        ) || null;

        if (!album) {
          albumId = `album_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newAlbum: Album = {
            id: albumId,
            title: cleanAlbum,
            artistId,
            artistName: hasValidArtist ? cleanArtist : track.artistName,
            year: normalized.year,
            trackCount: 1,
            durationMs: normalized.durationMs,
            artworkId,
            isCompilation: normalized.isCompilation,
            dateAdded: Date.now()
          };
          await this.albumRepo.save(newAlbum);
        } else {
          albumId = album.id;
          if (track.albumId !== album.id) {
            await this.albumRepo.save({
              ...album,
              trackCount: (album.trackCount || 0) + 1,
              durationMs: (album.durationMs || 0) + (normalized.durationMs || 0)
            });
          }
        }
      }

      // 4. Resolve / Create Genre (Case-insensitive deduplication)
      let genreId = track.genreId;
      const cleanGenre = normalized.genreName?.trim();
      const hasValidGenre = cleanGenre && cleanGenre.toLowerCase() !== 'unknown genre';

      if (hasValidGenre) {
        let genre = await this.genreRepo.getByName(cleanGenre);
        if (!genre) {
          const allGenres = await this.genreRepo.list({ limit: 500 });
          genre = allGenres.items.find(g => g.name.trim().toLowerCase() === cleanGenre.toLowerCase()) || null;
        }
        if (!genre) {
          genreId = `genre_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newGenre: Genre = {
            id: genreId,
            name: cleanGenre,
            trackCount: 1
          };
          await this.genreRepo.save(newGenre);
        } else {
          genreId = genre.id;
          if (track.genreId !== genre.id) {
            await this.genreRepo.save({
              ...genre,
              trackCount: (genre.trackCount || 0) + 1
            });
          }
        }
      }

      // 5. Update Track (Strictly Preserving User State: isFavorite, playCount, lastPlayedAt)
      const updatedTrack: Track = {
        ...track,
        title: normalized.title,
        artistId,
        artistName: hasValidArtist ? cleanArtist : (track.artistName && track.artistName !== 'Unknown Artist' ? track.artistName : undefined),
        albumId,
        albumTitle: hasValidAlbum ? cleanAlbum : (track.albumTitle && track.albumTitle !== 'Unknown Album' ? track.albumTitle : undefined),
        genreId,
        genreName: hasValidGenre ? cleanGenre : track.genreName,
        artworkId,
        trackNumber: normalized.trackNumber ?? track.trackNumber,
        discNumber: normalized.discNumber ?? track.discNumber,
        year: normalized.year ?? track.year,
        durationMs: normalized.durationMs > 0 ? normalized.durationMs : track.durationMs,
        format: {
          ...track.format,
          container: rawMetadata.container,
          codec: rawMetadata.codec,
          sampleRate: rawMetadata.sampleRate ?? track.format.sampleRate,
          bitDepth: rawMetadata.bitDepth ?? track.format.bitDepth,
          channels: rawMetadata.channels ?? track.format.channels,
          isLossless: rawMetadata.isLossless,
          bitrate: rawMetadata.bitrate ?? track.format.bitrate
        },
        replayGain: rawMetadata.replayGain ?? track.replayGain,
        dateModified: Date.now()
      };

      await this.trackRepo.save(updatedTrack);

      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        tracksAdded: 0,
        tracksUpdated: 1,
        tracksRemoved: 0,
        timestamp: Date.now()
      });

      return updatedTrack;
    } catch (err) {
      this.logger.error(`Error enriching metadata for track: ${trackId}`, err);
      return track;
    }
  }

  /**
   * Batch processes a list of files with bounded concurrency
   */
  public async batchEnrichTracks(
    items: readonly { trackId: EntityId; buffer: Uint8Array; container?: AudioContainer }[]
  ): Promise<number> {
    let enrichedCount = 0;
    for (const item of items) {
      const res = await this.enrichTrackMetadata(item.trackId, item.buffer, item.container);
      if (res) enrichedCount++;
    }
    return enrichedCount;
  }
}
