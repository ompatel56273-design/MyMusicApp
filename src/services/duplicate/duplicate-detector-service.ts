import type { ITrackRepository, IAudioFileRepository } from '../../domain/repositories/repository-contracts';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { Track } from '../../domain/entities/models';
import type {
  IDuplicateDetectorService
} from '../contracts/service-contracts';
import type {
  DuplicateGroup,
  DuplicateCandidate,
  DuplicateScanResult,
  DuplicateDetectionOptions,
  DuplicateResolutionAction,
  DuplicateResolutionResult,
  DuplicateMatchLevel
} from '../../domain/entities/duplicate-types';
import { Logger } from '../../core/logging/logger';

export interface DuplicateDetectorDependencies {
  readonly trackRepo: ITrackRepository;
  readonly audioFileRepo?: IAudioFileRepository | undefined;
  readonly eventBus?: EventBus | undefined;
}

const VERSION_MODIFIER_REGEX = /\b(remix|live|acoustic|instrumental|radio\s*edit|extended|deluxe|demo|cover|karaoke|orchestral|slowed|reverb|sped\s*up|clean|explicit|dub|vip|mix|edit|version)\b/gi;

/**
 * Robust, local-first Duplicate Detector Service for MyMusicApp.
 * Identifies duplicate audio tracks using layered heuristics, metadata fingerprinting,
 * and duration verification with strict false-positive protections.
 */
export class DuplicateDetectorService implements IDuplicateDetectorService {
  private readonly logger = new Logger('DuplicateDetectorService');
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo?: IAudioFileRepository | undefined;
  private readonly eventBus?: EventBus | undefined;

  constructor(deps: DuplicateDetectorDependencies) {
    this.trackRepo = deps.trackRepo;
    this.audioFileRepo = deps.audioFileRepo;
    this.eventBus = deps.eventBus;
  }

  public async detectDuplicates(options?: DuplicateDetectionOptions): Promise<DuplicateScanResult> {
    const durationToleranceMs = options?.durationToleranceMs ?? 1500;
    const includeLikely = options?.includeLikely ?? true;

    const allTracksResult = await this.trackRepo.list({ limit: 50000 });
    const tracks = allTracksResult.items;

    if (tracks.length < 2) {
      return {
        groups: [],
        totalDuplicateTracks: 0,
        totalGroups: 0,
        potentialSavingsBytes: 0,
        scannedAt: Date.now()
      };
    }

    const assignedTrackIds = new Set<string>();
    const groups: DuplicateGroup[] = [];

    // Pre-load audio file metadata for path and size
    const audioFileMap = new Map<string, { path: string; sizeBytes: number }>();
    if (this.audioFileRepo) {
      try {
        const pathData = await this.audioFileRepo.listAllPaths();
        for (const [path, info] of pathData.entries()) {
          audioFileMap.set(info.id, { path, sizeBytes: info.sizeBytes });
        }
      } catch {
        // Fallback
      }
    }

    // Pre-calculate normalized metadata for all tracks for fast lookup
    const trackInfos = tracks.map(track => {
      const rawTitle = track.title || '';
      const cleanedTitle = this.cleanTitle(rawTitle);
      const titleModifiers = this.extractModifiers(rawTitle);
      const rawArtist = (track.artistName && track.artistName.trim()) || '';
      const isUnknownArtist = !rawArtist || rawArtist.toLowerCase() === 'unknown artist';
      const normalizedArtist = isUnknownArtist ? '' : rawArtist.toLowerCase();
      const durationMs = track.durationMs || 0;
      const fileInfo = audioFileMap.get(track.fileId);
      const path = fileInfo?.path || (track as any).path || '';
      const fileSize = fileInfo?.sizeBytes || (track as any).fileSize || 0;

      return {
        track,
        rawTitle,
        cleanedTitle,
        titleModifiers,
        rawArtist,
        isUnknownArtist,
        normalizedArtist,
        durationMs,
        path,
        fileSize,
        bitrate: track.format?.bitrate || 0,
        format: (track.format?.container || '').toLowerCase()
      };
    });

    // Layer 1: Exact File Identity / Duplicate File Path or File ID
    const pathMap = new Map<string, typeof trackInfos>();
    for (const info of trackInfos) {
      if (info.path) {
        const existing = pathMap.get(info.path) ?? [];
        existing.push(info);
        pathMap.set(info.path, existing);
      }
    }

    for (const [path, list] of pathMap.entries()) {
      if (list.length > 1) {
        const primary = this.selectPrimaryTrack(list.map(i => i.track));
        const primaryInfo = list.find(i => i.track.id === primary.id);
        const primarySize = primaryInfo?.fileSize || 0;
        const candidates: DuplicateCandidate[] = [];
        let savings = 0;

        for (const item of list) {
          if (item.track.id !== primary.id && !assignedTrackIds.has(item.track.id)) {
            assignedTrackIds.add(item.track.id);
            const sizeDiff = (item.fileSize || 0) - primarySize;
            candidates.push({
              track: item.track,
              matchLevel: 'exact_file',
              confidenceScore: 1.0,
              reason: `Identical physical file path: ${path}`,
              fileSizeDiffBytes: sizeDiff
            });
            savings += item.fileSize || 0;
          }
        }

        if (candidates.length > 0) {
          assignedTrackIds.add(primary.id);
          groups.push({
            id: `dup_file_${primary.id}`,
            primaryTrack: primary,
            candidates,
            matchLevel: 'exact_file',
            reason: 'Identical audio file path registered multiple times',
            potentialSavingsBytes: savings
          });
        }
      }
    }

    // Layer 2 & 3: Metadata Fingerprint & Duration
    for (let i = 0; i < trackInfos.length; i++) {
      const t1 = trackInfos[i]!;
      if (assignedTrackIds.has(t1.track.id)) continue;

      const cluster: Array<{ info: typeof t1; matchLevel: DuplicateMatchLevel; reason: string; confidence: number }> = [];

      for (let j = i + 1; j < trackInfos.length; j++) {
        const t2 = trackInfos[j]!;
        if (assignedTrackIds.has(t2.track.id)) continue;

        const match = this.evaluateDuplicateMatch(t1, t2, durationToleranceMs, includeLikely);
        if (match) {
          cluster.push({
            info: t2,
            matchLevel: match.matchLevel,
            reason: match.reason,
            confidence: match.confidence
          });
        }
      }

      if (cluster.length > 0) {
        const clusterTracks = [t1.track, ...cluster.map(c => c.info.track)];
        const primary = this.selectPrimaryTrack(clusterTracks);
        const allClusterInfos = [t1, ...cluster.map(c => c.info)];
        const primaryInfo = allClusterInfos.find(ci => ci.track.id === primary.id);
        const primarySize = primaryInfo?.fileSize || 0;
        assignedTrackIds.add(primary.id);

        const candidates: DuplicateCandidate[] = [];
        let groupSavings = 0;
        let highestMatchLevel: DuplicateMatchLevel = 'likely_duplicate';

        for (const item of cluster) {
          if (item.info.track.id !== primary.id) {
            assignedTrackIds.add(item.info.track.id);
            const sizeDiff = (item.info.fileSize || 0) - primarySize;
            candidates.push({
              track: item.info.track,
              matchLevel: item.matchLevel,
              confidenceScore: item.confidence,
              reason: item.reason,
              fileSizeDiffBytes: sizeDiff
            });
            groupSavings += item.info.fileSize || 0;
            if (item.matchLevel === 'exact_metadata') highestMatchLevel = 'exact_metadata';
            else if (item.matchLevel === 'high_confidence' && highestMatchLevel !== 'exact_metadata') highestMatchLevel = 'high_confidence';
          }
        }

        // If primary was one of the cluster items, add t1 as candidate
        if (primary.id !== t1.track.id) {
          assignedTrackIds.add(t1.track.id);
          const sizeDiff = (t1.fileSize || 0) - primarySize;
          candidates.push({
            track: t1.track,
            matchLevel: cluster[0]?.matchLevel ?? 'high_confidence',
            confidenceScore: cluster[0]?.confidence ?? 0.85,
            reason: cluster[0]?.reason ?? 'Matching audio metadata',
            fileSizeDiffBytes: sizeDiff
          });
          groupSavings += t1.fileSize || 0;
        }

        if (candidates.length > 0) {
          groups.push({
            id: `dup_meta_${primary.id}`,
            primaryTrack: primary,
            candidates,
            matchLevel: highestMatchLevel,
            reason: candidates[0]?.reason || 'Matching title, artist, and duration',
            potentialSavingsBytes: groupSavings
          });
        }
      }
    }

    let totalDuplicateTracks = 0;
    let potentialSavingsBytes = 0;
    for (const g of groups) {
      totalDuplicateTracks += g.candidates.length;
      potentialSavingsBytes += g.potentialSavingsBytes;
    }

    return {
      groups,
      totalDuplicateTracks,
      totalGroups: groups.length,
      potentialSavingsBytes,
      scannedAt: Date.now()
    };
  }

  public async resolveDuplicates(
    actions: readonly DuplicateResolutionAction[]
  ): Promise<DuplicateResolutionResult> {
    let removedCount = 0;
    const errors: string[] = [];

    for (const action of actions) {
      if (action.action === 'remove_from_library') {
        try {
          await this.trackRepo.delete(action.trackId);
          removedCount++;
        } catch (err) {
          const msg = `Failed to remove track ${action.trackId} from library: ${String(err)}`;
          this.logger.error(msg);
          errors.push(msg);
        }
      }
    }

    if (removedCount > 0 && this.eventBus) {
      this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
        timestamp: Date.now(),
        reason: 'duplicate_resolution',
        count: removedCount
      });
    }

    return { removedCount, errors };
  }

  private evaluateDuplicateMatch(
    t1: {
      track: Track;
      rawTitle: string;
      cleanedTitle: string;
      titleModifiers: string[];
      rawArtist: string;
      isUnknownArtist: boolean;
      normalizedArtist: string;
      durationMs: number;
      fileSize: number;
    },
    t2: {
      track: Track;
      rawTitle: string;
      cleanedTitle: string;
      titleModifiers: string[];
      rawArtist: string;
      isUnknownArtist: boolean;
      normalizedArtist: string;
      durationMs: number;
      fileSize: number;
    },
    durationToleranceMs: number,
    includeLikely: boolean
  ): { matchLevel: DuplicateMatchLevel; reason: string; confidence: number } | null {
    // 1. Strict False-Positive Protection: Version Modifier Conflict
    // If one is "Song (Remix)" and the other is "Song", they are NEVER duplicates!
    if (!this.areModifiersCompatible(t1.titleModifiers, t2.titleModifiers)) {
      return null;
    }

    // 2. Strict False-Positive Protection: Different Known Artists
    // If both have known artists and they differ, they are NEVER duplicates!
    if (!t1.isUnknownArtist && !t2.isUnknownArtist && t1.normalizedArtist !== t2.normalizedArtist) {
      return null;
    }

    // 3. Cleaned title match check
    if (!t1.cleanedTitle || !t2.cleanedTitle) return null;
    if (t1.cleanedTitle !== t2.cleanedTitle) return null;

    // 4. Duration Check
    const durDiff = Math.abs(t1.durationMs - t2.durationMs);

    // If both have durations, check tolerance
    if (t1.durationMs > 0 && t2.durationMs > 0) {
      // More than 3 seconds difference -> NOT a duplicate (could be different cut/tempo/version)
      if (durDiff > Math.max(3000, durationToleranceMs)) {
        return null;
      }

      // Exact metadata match: Same artist, same title, duration <= durationToleranceMs
      if (!t1.isUnknownArtist && !t2.isUnknownArtist && t1.normalizedArtist === t2.normalizedArtist) {
        if (durDiff <= durationToleranceMs) {
          return {
            matchLevel: 'exact_metadata',
            reason: `Matching artist "${t1.rawArtist}", title "${t1.rawTitle}", and duration (diff ${Math.round(durDiff / 1000)}s)`,
            confidence: 0.95
          };
        }
      }

      // High confidence match: Title match, duration within 1.0s, one artist might be unknown or both unknown
      if (durDiff <= 1000) {
        return {
          matchLevel: 'high_confidence',
          reason: `Matching title and near-identical duration (diff ${(durDiff / 1000).toFixed(1)}s)`,
          confidence: 0.88
        };
      }

      if (includeLikely && durDiff <= durationToleranceMs) {
        return {
          matchLevel: 'likely_duplicate',
          reason: `Matching title and comparable duration (diff ${(durDiff / 1000).toFixed(1)}s)`,
          confidence: 0.75
        };
      }
    } else if (includeLikely && t1.fileSize > 0 && t2.fileSize > 0) {
      // If duration is 0 for both, fallback to file size check
      const sizeDiff = Math.abs(t1.fileSize - t2.fileSize);
      if (sizeDiff < 1024) {
        return {
          matchLevel: 'likely_duplicate',
          reason: 'Identical title and matching file size',
          confidence: 0.80
        };
      }
    }

    return null;
  }

  private cleanTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/\.(mp3|flac|wav|m4a|aac|ogg|wma|aiff|opus)$/i, '')
      .replace(/\[(official\s*audio|official\s*video|audio|lyrics|hd|4k|hq)\]/gi, '')
      .replace(/\((official\s*audio|official\s*video|audio|lyrics|hd|4k|hq)\)/gi, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractModifiers(title: string): string[] {
    const matches = title.match(VERSION_MODIFIER_REGEX);
    if (!matches) return [];
    return Array.from(new Set(matches.map(m => m.toLowerCase().trim())));
  }

  private areModifiersCompatible(m1: string[], m2: string[]): boolean {
    const s1 = new Set(m1);
    const s2 = new Set(m2);

    // If one has a specific modifier like "remix" or "live" and the other does not, they are NOT compatible
    for (const mod of s1) {
      if (!s2.has(mod)) return false;
    }
    for (const mod of s2) {
      if (!s1.has(mod)) return false;
    }
    return true;
  }

  /**
   * Deterministically selects the primary track to recommend keeping.
   * Prefers: lossless formats, higher bitrates, higher play counts, favorites,
   * tracks with artwork, and earliest added timestamp.
   */
  private selectPrimaryTrack(tracks: readonly Track[]): Track {
    const sorted = [...tracks].sort((a, b) => {
      // 1. Favorite status
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // 2. Play count
      const pDiff = (b.playCount || 0) - (a.playCount || 0);
      if (pDiff !== 0) return pDiff;

      // 3. Lossless format preference
      const isLosslessA = /flac|wav|alac|aiff/i.test(a.format?.container || '');
      const isLosslessB = /flac|wav|alac|aiff/i.test(b.format?.container || '');
      if (isLosslessA && !isLosslessB) return -1;
      if (!isLosslessA && isLosslessB) return 1;

      // 4. Bitrate
      const brA = a.format?.bitrate || 0;
      const brB = b.format?.bitrate || 0;
      if (brA !== brB) return brB - brA;

      // 5. Has Artwork
      if (a.artworkId && !b.artworkId) return -1;
      if (!a.artworkId && b.artworkId) return 1;

      // 6. Has real artist (not Unknown Artist)
      const hasRealArtistA = a.artistName && a.artistName.toLowerCase() !== 'unknown artist';
      const hasRealArtistB = b.artistName && b.artistName.toLowerCase() !== 'unknown artist';
      if (hasRealArtistA && !hasRealArtistB) return -1;
      if (!hasRealArtistA && hasRealArtistB) return 1;

      // 7. Earliest added
      const dateA = a.dateAdded || 0;
      const dateB = b.dateAdded || 0;
      if (dateA !== dateB) return dateA - dateB;

      // 8. Stable ID fallback
      return a.id.localeCompare(b.id);
    });

    return sorted[0]!;
  }
}
