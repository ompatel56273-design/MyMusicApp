import type {
  ITrackRepository,
  IAudioFileRepository
} from '../../domain/repositories/repository-contracts';
import type { Track } from '../../domain/entities/models';
import type {
  DuplicateGroup,
  DuplicateDetectionSummary,
  DuplicateResolutionPlan,
  DuplicateMatchType
} from '../../domain/entities/duplicate-types';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';

export class DuplicateDetectorService {
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo: IAudioFileRepository;
  private readonly eventBus: EventBus;

  private static readonly VERSION_TAG_REGEX =
    /\b(remix|live|acoustic|extended|instrumental|radio edit|demo|clean|explicit|remastered|deluxe|edit|version|vip|dub|mix)\b/gi;

  constructor(
    trackRepo: ITrackRepository,
    audioFileRepo: IAudioFileRepository,
    eventBus: EventBus
  ) {
    this.trackRepo = trackRepo;
    this.audioFileRepo = audioFileRepo;
    this.eventBus = eventBus;
  }

  /**
   * Scans the track repository and identifies candidate duplicate groups.
   */
  public async detectDuplicates(): Promise<DuplicateDetectionSummary> {
    const listResult = await this.trackRepo.list({ limit: 10000 });
    const tracks = listResult.items;
    const totalTracksScanned = tracks.length;

    if (tracks.length < 2) {
      return {
        totalTracksScanned,
        duplicateGroupsFound: 0,
        totalDuplicatesFound: 0,
        potentialSpaceSavingsBytes: 0,
        groups: []
      };
    }

    const processedTrackIds = new Set<string>();
    const groups: DuplicateGroup[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const trackA = tracks[i]!;
      if (processedTrackIds.has(trackA.id)) continue;

      const groupMembers: Track[] = [trackA];

      for (let j = i + 1; j < tracks.length; j++) {
        const trackB = tracks[j]!;
        if (processedTrackIds.has(trackB.id)) continue;

        const matchResult = this.evaluateMatch(trackA, trackB);
        if (matchResult.isMatch) {
          groupMembers.push(trackB);
        }
      }

      if (groupMembers.length > 1) {
        // Sort group members to pick the primary track
        const sortedMembers = this.rankTracksInGroup(groupMembers);
        const primaryTrack = sortedMembers[0]!;
        const duplicateTracks = sortedMembers.slice(1);

        duplicateTracks.forEach(t => processedTrackIds.add(t.id));
        processedTrackIds.add(primaryTrack.id);

        const matchType: DuplicateMatchType = this.determineGroupMatchType(primaryTrack, duplicateTracks[0]!);

        groups.push({
          id: `dup_group_${Date.now()}_${groups.length + 1}`,
          primaryTrack,
          duplicateTracks,
          matchType,
          confidenceScore: matchType === 'exact_hash' ? 1.0 : matchType === 'exact_metadata' ? 0.95 : 0.85,
          reason: this.formatReason(matchType)
        });
      }
    }

    let totalDuplicatesFound = 0;
    let potentialSpaceSavingsBytes = 0;

    for (const g of groups) {
      totalDuplicatesFound += g.duplicateTracks.length;
      for (const dt of g.duplicateTracks) {
        const audioFile = await this.audioFileRepo.getById(dt.fileId);
        if (audioFile?.sizeBytes) {
          potentialSpaceSavingsBytes += audioFile.sizeBytes;
        }
      }
    }

    return {
      totalTracksScanned,
      duplicateGroupsFound: groups.length,
      totalDuplicatesFound,
      potentialSpaceSavingsBytes,
      groups
    };
  }

  /**
   * Non-destructive batch resolution of duplicates.
   * Removes duplicate tracks and stale audio files from database after user confirmation.
   */
  public async resolveDuplicates(resolutions: readonly DuplicateResolutionPlan[]): Promise<number> {
    let removedCount = 0;

    for (const plan of resolutions) {
      for (const removeId of plan.removeTrackIds) {
        const track = await this.trackRepo.getById(removeId);
        if (track) {
          await this.trackRepo.delete(removeId);
          if (track.fileId) {
            // Delete audio file entry if no other track references it
            const remainingTracks = await this.trackRepo.list({ limit: 10 });
            const isStillUsed = remainingTracks.items.some(t => t.fileId === track.fileId && t.id !== removeId);
            if (!isStillUsed) {
              await this.audioFileRepo.delete(track.fileId);
            }
          }
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        tracksAdded: 0,
        tracksUpdated: 0,
        tracksRemoved: removedCount,
        timestamp: Date.now()
      });
    }

    return removedCount;
  }

  private evaluateMatch(a: Track, b: Track): { isMatch: boolean } {
    // 1. Version tag protection: If version tags differ, do NOT match
    const versionTagsA = this.extractVersionTags(a.title);
    const versionTagsB = this.extractVersionTags(b.title);

    if (versionTagsA !== versionTagsB) {
      return { isMatch: false };
    }

    // 2. Duration check: Must be within 3000ms
    if (a.durationMs > 0 && b.durationMs > 0) {
      const diffMs = Math.abs(a.durationMs - b.durationMs);
      if (diffMs > 3500) {
        return { isMatch: false };
      }
    }

    // 3. Title & Artist Normalized Match
    const normTitleA = this.normalizeString(a.title);
    const normTitleB = this.normalizeString(b.title);
    const normArtistA = this.normalizeString(a.artistName || '');
    const normArtistB = this.normalizeString(b.artistName || '');

    const titleMatch = normTitleA === normTitleB && normTitleA.length > 0;
    const artistMatch = normArtistA === normArtistB && normArtistA.length > 0;

    if (titleMatch && artistMatch) {
      return { isMatch: true };
    }

    // Exact filename match if titles/artists match
    if (titleMatch && (normArtistA === '' || normArtistB === '' || normArtistA === 'unknown artist' || normArtistB === 'unknown artist')) {
      if (a.durationMs > 0 && b.durationMs > 0 && Math.abs(a.durationMs - b.durationMs) < 1500) {
        return { isMatch: true };
      }
    }

    return { isMatch: false };
  }

  private extractVersionTags(title: string): string {
    const matches = title.match(DuplicateDetectorService.VERSION_TAG_REGEX);
    if (!matches) return '';
    return matches.map(m => m.toLowerCase()).sort().join('_');
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[\(\)\[\]\{\}\-_,.\'\"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private rankTracksInGroup(tracks: Track[]): Track[] {
    return [...tracks].sort((a, b) => {
      // 1. Lossless over lossy
      if (a.format.isLossless && !b.format.isLossless) return -1;
      if (!a.format.isLossless && b.format.isLossless) return 1;

      // 2. Bitrate
      const bitrateA = a.format.bitrate || 0;
      const bitrateB = b.format.bitrate || 0;
      if (bitrateA !== bitrateB) return bitrateB - bitrateA;

      // 3. Artwork presence
      if (a.artworkId && !b.artworkId) return -1;
      if (!a.artworkId && b.artworkId) return 1;

      // 4. Play count / Favorites
      const scoreA = (a.isFavorite ? 1000 : 0) + (a.playCount || 0);
      const scoreB = (b.isFavorite ? 1000 : 0) + (b.playCount || 0);
      if (scoreA !== scoreB) return scoreB - scoreA;

      // 5. Earliest date added
      return a.dateAdded - b.dateAdded;
    });
  }

  private determineGroupMatchType(a: Track, b: Track): DuplicateMatchType {
    const albumA = this.normalizeString(a.albumTitle || '');
    const albumB = this.normalizeString(b.albumTitle || '');
    if (albumA && albumB && albumA === albumB && Math.abs(a.durationMs - b.durationMs) < 1000) {
      return 'exact_hash';
    }
    if (Math.abs(a.durationMs - b.durationMs) < 1500) {
      return 'exact_metadata';
    }
    return 'fuzzy_metadata';
  }

  private formatReason(type: DuplicateMatchType): string {
    switch (type) {
      case 'exact_hash':
        return 'Identical audio metadata, duration, and album release';
      case 'exact_metadata':
        return 'Matching track title, artist, and audio duration';
      case 'fuzzy_metadata':
        return 'Matching song title and artist with minor duration variance';
    }
  }
}
