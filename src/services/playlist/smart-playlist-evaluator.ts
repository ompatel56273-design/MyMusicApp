import type { Track } from '../../domain/entities/models';
import type {
  SmartPlaylistDefinition,
  SmartRule
} from '../../domain/value-objects/smart-playlist-types';

export class SmartPlaylistEvaluator {
  public static evaluate(
    tracks: readonly Track[],
    definition: SmartPlaylistDefinition
  ): Track[] {
    if (definition.enabled === false) {
      return [];
    }

    const rules = definition.rules || [];

    // 1. Filter tracks
    const filtered = tracks.filter(track => {
      if (rules.length === 0) return true;

      if (definition.matchMode === 'any') {
        return rules.some(rule => this.evaluateRule(track, rule));
      } else {
        // default 'all'
        return rules.every(rule => this.evaluateRule(track, rule));
      }
    });

    // 2. Sort filtered tracks
    const sorted = [...filtered].sort((a, b) => this.compareTracks(a, b, definition.sort));

    // 3. Apply limit
    if (definition.limit !== null && definition.limit !== undefined && definition.limit > 0) {
      return sorted.slice(0, definition.limit);
    }

    return sorted;
  }

  public static evaluateRule(track: Track, rule: SmartRule): boolean {
    const { field, operator, value } = rule;

    switch (field) {
      case 'title':
        return this.evalText(track.title || '', operator, String(value));
      case 'artist':
        return this.evalText(track.artistName || '', operator, String(value));
      case 'album':
        return this.evalText(track.albumTitle || '', operator, String(value));
      case 'genre':
        return this.evalText(track.genreName || '', operator, String(value));
      case 'folder':
        return this.evalText((track as any).folderPath || (track as any).folderId || '', operator, String(value));
      case 'codec':
        return this.evalText(track.format?.codec || '', operator, String(value));
      case 'format':
        return this.evalText(track.format?.container || '', operator, String(value));

      case 'playCount':
        return this.evalNumeric(track.playCount || 0, operator, Number(value));
      case 'skipCount':
        return this.evalNumeric((track as any).skipCount || 0, operator, Number(value));
      case 'duration': {
        const numVal = Number(value);
        // If target value is in seconds (< 100000), convert track.durationMs to seconds
        const trackSec = track.durationMs / 1000;
        const targetSec = numVal < 100000 ? numVal : numVal / 1000;
        return this.evalNumeric(trackSec, operator, targetSec);
      }

      case 'addedAt':
        return this.evalDate(track.dateAdded || 0, operator, Number(value));
      case 'lastPlayedAt':
        return this.evalDate(track.lastPlayedAt || 0, operator, Number(value));

      case 'favorite':
        return this.evalBoolean(!!track.isFavorite, operator, Boolean(value));

      default:
        return false;
    }
  }

  private static evalText(actual: string, operator: string, target: string): boolean {
    const act = actual.toLowerCase();
    const tgt = target.toLowerCase();

    switch (operator) {
      case 'equals':
        return act === tgt;
      case 'contains':
        return act.includes(tgt);
      case 'startsWith':
        return act.startsWith(tgt);
      case 'endsWith':
        return act.endsWith(tgt);
      default:
        return false;
    }
  }

  private static evalNumeric(actual: number, operator: string, target: number): boolean {
    switch (operator) {
      case 'equals':
        return actual === target;
      case 'greaterThan':
        return actual > target;
      case 'greaterThanOrEqual':
        return actual >= target;
      case 'lessThan':
        return actual < target;
      case 'lessThanOrEqual':
        return actual <= target;
      default:
        return false;
    }
  }

  private static evalDate(actualMs: number, operator: string, targetVal: number): boolean {
    if (!actualMs || actualMs <= 0) {
      return false; // Non-existent date timestamp
    }

    switch (operator) {
      case 'before':
        return actualMs < targetVal;
      case 'after':
        return actualMs > targetVal;
      case 'withinLast': {
        // targetVal can be in days (e.g. 7, 30) or milliseconds
        const daysInMs = targetVal < 10000 ? targetVal * 24 * 60 * 60 * 1000 : targetVal;
        const cutoff = Date.now() - daysInMs;
        return actualMs >= cutoff;
      }
      default:
        return false;
    }
  }

  private static evalBoolean(actual: boolean, operator: string, target: boolean): boolean {
    switch (operator) {
      case 'is':
        return actual === target;
      case 'isNot':
        return actual !== target;
      default:
        return false;
    }
  }

  private static compareTracks(
    a: Track,
    b: Track,
    sort: SmartPlaylistDefinition['sort']
  ): number {
    const isDesc = sort.order === 'desc';
    let cmp = 0;

    switch (sort.field) {
      case 'title':
        cmp = (a.title || '').localeCompare(b.title || '');
        break;
      case 'artist':
        cmp = (a.artistName || '').localeCompare(b.artistName || '');
        break;
      case 'album':
        cmp = (a.albumTitle || '').localeCompare(b.albumTitle || '');
        break;
      case 'duration':
        cmp = a.durationMs - b.durationMs;
        break;
      case 'dateAdded':
        cmp = (a.dateAdded || 0) - (b.dateAdded || 0);
        break;
      case 'lastPlayed':
        cmp = (a.lastPlayedAt || 0) - (b.lastPlayedAt || 0);
        break;
      case 'playCount':
        cmp = (a.playCount || 0) - (b.playCount || 0);
        break;
      case 'rating':
        cmp = ((a as any).rating || 0) - ((b as any).rating || 0);
        break;
      case 'random':
        // Deterministic string hash comparison for stable random sorting
        cmp = this.hashString(a.id) - this.hashString(b.id);
        break;
      default:
        cmp = (a.title || '').localeCompare(b.title || '');
        break;
    }

    return isDesc ? -cmp : cmp;
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
