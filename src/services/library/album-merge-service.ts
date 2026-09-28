import type {
  IAlbumRepository,
  ITrackRepository
} from '../../domain/repositories/repository-contracts';
import type { Album, Track } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';
import type {
  AlbumMergeCandidateGroup,
  AlbumMergePreview,
  AlbumMergeResult
} from '../../domain/entities/album-merge-types';

export interface AlbumMergeServiceDependencies {
  albumRepo: IAlbumRepository;
  trackRepo: ITrackRepository;
  eventBus?: EventBus | undefined;
}

export class AlbumMergeService {
  private readonly logger = new Logger('AlbumMergeService');
  private readonly albumRepo: IAlbumRepository;
  private readonly trackRepo: ITrackRepository;
  private readonly eventBus?: EventBus | undefined;

  constructor(deps: AlbumMergeServiceDependencies) {
    this.albumRepo = deps.albumRepo;
    this.trackRepo = deps.trackRepo;
    this.eventBus = deps.eventBus;
  }

  /**
   * Normalizes album text for deterministic identity matching.
   * Handles case, Unicode variations, trailing/leading whitespace, and punctuation.
   */
  public normalizeIdentityKey(title: string, artistName?: string): string {
    const normTitle = (title || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const normArtist = (artistName || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return `${normTitle}:::${normArtist}`;
  }

  /**
   * Checks whether an album represents an unconfirmed/missing fallback record.
   */
  public isUnknownAlbum(title?: string): boolean {
    if (!title) return true;
    const clean = title.trim().toLowerCase();
    return clean === '' || clean === 'unknown album' || clean === 'unknown';
  }

  /**
   * Read-only analysis to detect candidate duplicate/fragmented albums.
   */
  public async findMergeCandidates(): Promise<readonly AlbumMergeCandidateGroup[]> {
    try {
      const albumListResult = await this.albumRepo.list({ limit: 10000 });
      const albums = albumListResult.items;

      // Group albums by normalized identity key
      const groupsMap = new Map<string, Album[]>();

      for (const album of albums) {
        // Exclude Unknown Album records from automatic grouping
        if (this.isUnknownAlbum(album.title)) {
          continue;
        }

        const key = this.normalizeIdentityKey(album.title, album.artistName);
        if (!key || key === ':::') {
          continue;
        }

        const list = groupsMap.get(key) || [];
        list.push(album);
        groupsMap.set(key, list);
      }

      const candidateGroups: AlbumMergeCandidateGroup[] = [];

      for (const [key, groupAlbums] of groupsMap.entries()) {
        if (groupAlbums.length < 2) {
          continue;
        }

        // Determine best canonical candidate: highest track count, longest duration, has artwork, has year
        const sorted = [...groupAlbums].sort((a, b) => {
          if ((b.artworkId ? 1 : 0) !== (a.artworkId ? 1 : 0)) {
            return (b.artworkId ? 1 : 0) - (a.artworkId ? 1 : 0);
          }
          if ((b.trackCount || 0) !== (a.trackCount || 0)) {
            return (b.trackCount || 0) - (a.trackCount || 0);
          }
          if ((b.durationMs || 0) !== (a.durationMs || 0)) {
            return (b.durationMs || 0) - (a.durationMs || 0);
          }
          return (a.dateAdded || 0) - (b.dateAdded || 0);
        });

        const canonicalAlbum = sorted[0];
        const totalTracks = groupAlbums.reduce((sum, a) => sum + (a.trackCount || 0), 0);
        const totalDurationMs = groupAlbums.reduce((sum, a) => sum + (a.durationMs || 0), 0);

        // Check matching reason
        const uniqueTitles = new Set(groupAlbums.map(a => a.title.trim()));
        let matchReason = 'Matching normalized album title and artist with separate database records.';
        if (uniqueTitles.size > 1) {
          matchReason = 'Case, punctuation, or whitespace variations in album title.';
        }

        candidateGroups.push({
          key,
          canonicalAlbumId: canonicalAlbum.id,
          albums: groupAlbums,
          totalTracks,
          totalDurationMs,
          confidence: uniqueTitles.size === 1 ? 'high' : 'medium',
          matchReason
        });
      }

      return candidateGroups;
    } catch (err) {
      this.logger.error('Failed to detect album merge candidates:', { error: String(err) });
      return [];
    }
  }

  /**
   * Generates a read-only preview of merging the specified albums into a canonical album.
   */
  public async getMergePreview(
    targetAlbumIds: readonly EntityId[],
    canonicalAlbumId: EntityId
  ): Promise<AlbumMergePreview> {
    if (targetAlbumIds.length < 2) {
      throw new Error('At least two albums must be selected for merging.');
    }

    if (!targetAlbumIds.includes(canonicalAlbumId)) {
      throw new Error('Canonical album must be one of the selected target albums.');
    }

    const albums: Album[] = [];
    for (const id of targetAlbumIds) {
      const album = await this.albumRepo.getById(id);
      if (!album) {
        throw new Error(`Album with ID "${id}" was not found in the repository.`);
      }
      albums.push(album);
    }

    const canonicalAlbum = albums.find(a => a.id === canonicalAlbumId)!;
    const mergedAlbums = albums.filter(a => a.id !== canonicalAlbumId);

    // Fetch all tracks belonging to these albums
    const allTracks: Track[] = [];
    for (const album of albums) {
      const trackResult = await this.trackRepo.list({ limit: 1000 }, { albumId: album.id });
      allTracks.push(...trackResult.items);
    }

    // Check for potential warnings
    const warnings: string[] = [];
    const years = new Set(albums.map(a => a.year).filter((y): y is number => typeof y === 'number' && y > 0));
    if (years.size > 1) {
      warnings.push(`Year discrepancy detected across selected albums: ${Array.from(years).join(', ')}.`);
    }

    const artists = new Set(albums.map(a => a.artistName?.trim()).filter(Boolean));
    if (artists.size > 1) {
      warnings.push(`Artist discrepancy detected across selected albums: ${Array.from(artists).join(', ')}.`);
    }

    const totalResultingDurationMs = allTracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

    return {
      canonicalAlbum,
      mergedAlbums,
      affectedTracks: allTracks,
      totalResultingTracks: allTracks.length,
      totalResultingDurationMs,
      warnings
    };
  }

  /**
   * Executes the album merge safely and deterministically.
   * Updates track relationships to point to canonical album, recalculates totals,
   * removes merged-away album records, and publishes library update event.
   */
  public async executeMerge(
    targetAlbumIds: readonly EntityId[],
    canonicalAlbumId: EntityId
  ): Promise<AlbumMergeResult> {
    const timestamp = Date.now();

    try {
      if (targetAlbumIds.length < 2) {
        throw new Error('At least two albums must be specified to execute a merge.');
      }

      if (!targetAlbumIds.includes(canonicalAlbumId)) {
        throw new Error('Canonical album ID must be included in target album IDs.');
      }

      // 1. Re-validate existence of canonical and target albums
      const canonicalAlbum = await this.albumRepo.getById(canonicalAlbumId);
      if (!canonicalAlbum) {
        throw new Error(`Canonical album "${canonicalAlbumId}" does not exist.`);
      }

      const otherAlbumIds = targetAlbumIds.filter(id => id !== canonicalAlbumId);

      // 2. Fetch all tracks belonging to the merged-away albums
      const tracksToUpdate: Track[] = [];
      const updatedTrackIds: EntityId[] = [];

      for (const albumId of targetAlbumIds) {
        const result = await this.trackRepo.list({ limit: 5000 }, { albumId });
        for (const track of result.items) {
          if (track.albumId !== canonicalAlbumId || track.albumTitle !== canonicalAlbum.title) {
            // Update track to point to canonical album while strictly preserving all other track fields
            const updatedTrack: Track = {
              ...track,
              albumId: canonicalAlbum.id,
              albumTitle: canonicalAlbum.title,
              albumArtistId: canonicalAlbum.artistId ?? track.albumArtistId,
              dateModified: timestamp
            };
            tracksToUpdate.push(updatedTrack);
            updatedTrackIds.push(track.id);
          }
        }
      }

      // 3. Save updated tracks in batch
      if (tracksToUpdate.length > 0) {
        await this.trackRepo.saveBatch(tracksToUpdate);
        this.logger.info(`Updated ${tracksToUpdate.length} tracks to canonical album "${canonicalAlbum.title}".`);
      }

      // 4. Fetch all tracks now in canonical album to calculate exact combined trackCount and duration
      const canonicalTracksResult = await this.trackRepo.list({ limit: 5000 }, { albumId: canonicalAlbumId });
      const combinedTracks = canonicalTracksResult.items;

      const updatedCanonicalAlbum: Album = {
        ...canonicalAlbum,
        trackCount: combinedTracks.length,
        durationMs: combinedTracks.reduce((sum, t) => sum + (t.durationMs || 0), 0)
      };
      await this.albumRepo.save(updatedCanonicalAlbum);

      // 5. Delete merged-away album records
      for (const oldId of otherAlbumIds) {
        await this.albumRepo.delete(oldId);
        this.logger.info(`Deleted merged-away album record "${oldId}".`);
      }

      // 6. Publish domain event to trigger reactive UI/cache updates
      if (this.eventBus) {
        this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
          tracksAdded: 0,
          tracksUpdated: tracksToUpdate.length,
          tracksRemoved: 0,
          timestamp
        });
      }

      return {
        success: true,
        canonicalAlbum: updatedCanonicalAlbum,
        mergedAlbumIds: otherAlbumIds,
        affectedTrackCount: tracksToUpdate.length,
        updatedTrackIds,
        timestamp
      };
    } catch (err) {
      const errorMessage = String(err);
      this.logger.error('Failed to execute album merge:', { error: errorMessage });
      return {
        success: false,
        canonicalAlbum: {
          id: canonicalAlbumId,
          title: '',
          trackCount: 0,
          durationMs: 0,
          isCompilation: false,
          dateAdded: timestamp
        },
        mergedAlbumIds: targetAlbumIds.filter(id => id !== canonicalAlbumId),
        affectedTrackCount: 0,
        updatedTrackIds: [],
        timestamp,
        errorMessage
      };
    }
  }
}
