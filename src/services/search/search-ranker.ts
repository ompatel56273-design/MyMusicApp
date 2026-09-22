import type { ScoredMatch } from './search-types';
import type { Track, Album, Artist, Playlist, Genre, Folder } from '../../domain/entities/models';

/**
 * Deterministic Relevance Ranker and Deduplicator for Search Results.
 * Applies heuristic scoring hierarchy and composite (entityType + ':' + entityId) deduplication.
 */
export class SearchRanker {
  /**
   * Sorts matches by score descending, secondary popularity/relevance metrics, and alphabetical name.
   */
  public static rankMatches<T extends Track | Album | Artist | Playlist | Genre | Folder>(
    matches: readonly ScoredMatch<T>[]
  ): readonly T[] {
    const sorted = [...matches].sort((a, b) => {
      // 1. Primary: Score descending
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      // 2. Secondary: Play count / Popularity if available
      const aPlayCount = 'playCount' in a.item && typeof a.item.playCount === 'number' ? a.item.playCount : 0;
      const bPlayCount = 'playCount' in b.item && typeof b.item.playCount === 'number' ? b.item.playCount : 0;
      if (bPlayCount !== aPlayCount) {
        return bPlayCount - aPlayCount;
      }

      // 3. Track count if applicable (e.g. for Artists, Albums, Playlists)
      const aTrackCount = 'trackCount' in a.item && typeof a.item.trackCount === 'number' ? a.item.trackCount : 0;
      const bTrackCount = 'trackCount' in b.item && typeof b.item.trackCount === 'number' ? b.item.trackCount : 0;
      if (bTrackCount !== aTrackCount) {
        return bTrackCount - aTrackCount;
      }

      // 4. Tertiary: Alphabetical title or name ascending
      const aName = ('title' in a.item ? a.item.title : 'name' in a.item ? a.item.name : '') || '';
      const bName = ('title' in b.item ? b.item.title : 'name' in b.item ? b.item.name : '') || '';
      return aName.localeCompare(bName);
    });

    // Deduplicate by composite key (entityType + ':' + entityId)
    const seen = new Set<string>();
    const deduplicated: T[] = [];

    for (const match of sorted) {
      const compositeKey = `${match.entityType}:${match.entityId}`;
      if (!seen.has(compositeKey)) {
        seen.add(compositeKey);
        deduplicated.push(match.item);
      }
    }

    return deduplicated;
  }
}
