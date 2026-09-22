import type { LyricLine, Lyrics } from '../../domain/entities/models';
import type { EntityId } from '../../domain/value-objects/audio-types';

export interface ParsedLrcResult {
  readonly type: 'synced' | 'plain';
  readonly lines: readonly LyricLine[];
  readonly plainText: string;
  readonly metadata: {
    title?: string;
    artist?: string;
    album?: string;
    offsetMs?: number;
    by?: string;
  };
}

/**
 * Pure TypeScript LRC Parser.
 * Handles standard timestamps, milliseconds/hundredths, multi-cue lines,
 * metadata tags ([ti:], [ar:], [al:], [offset:]), and plain text fallback.
 */
export class LrcParser {
  private static readonly TIMESTAMP_REGEX = /\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g;
  private static readonly METADATA_REGEX = /^\[(ti|ar|al|by|offset|length):([^\]]*)\]/i;

  public static parse(content: string, trackId: EntityId = 'unknown_track'): Lyrics {
    const result = this.parseRaw(content);

    return {
      id: `lyr_${trackId}_${Date.now()}`,
      trackId,
      type: result.type,
      plainText: result.plainText,
      lines: result.lines,
      offsetMs: result.metadata.offsetMs,
      updatedAt: Date.now()
    };
  }

  public static parseRaw(content: string): ParsedLrcResult {
    if (!content || !content.trim()) {
      return {
        type: 'plain',
        lines: [],
        plainText: '',
        metadata: {}
      };
    }

    const lines = content.split(/\r?\n/);
    const cues: LyricLine[] = [];
    const plainLines: string[] = [];
    const metadata: { title?: string; artist?: string; album?: string; offsetMs?: number; by?: string } = {};

    let hasTimestamps = false;
    let globalOffsetMs = 0;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      // 1. Check for metadata tags
      const metaMatch = trimmed.match(this.METADATA_REGEX);
      if (metaMatch && metaMatch[1] && metaMatch[2] !== undefined) {
        const tag = metaMatch[1].toLowerCase();
        const value = metaMatch[2].trim();

        if (tag === 'ti') metadata.title = value;
        else if (tag === 'ar') metadata.artist = value;
        else if (tag === 'al') metadata.album = value;
        else if (tag === 'by') metadata.by = value;
        else if (tag === 'offset') {
          const parsedOffset = parseInt(value, 10);
          if (!isNaN(parsedOffset)) {
            globalOffsetMs = parsedOffset;
            metadata.offsetMs = parsedOffset;
          }
        }
        continue;
      }

      // 2. Extract timestamps and text
      const timestampMatches: Array<{ match: string; timeMs: number }> = [];
      let match: RegExpExecArray | null;

      // Reset regex index
      this.TIMESTAMP_REGEX.lastIndex = 0;
      while ((match = this.TIMESTAMP_REGEX.exec(trimmed)) !== null) {
        const minStr = match[1];
        const secStr = match[2];
        const fracStr = match[3];

        if (minStr !== undefined && secStr !== undefined) {
          const minutes = parseInt(minStr, 10);
          const seconds = parseInt(secStr, 10);
          let ms = 0;

          if (fracStr) {
            if (fracStr.length === 1) ms = parseInt(fracStr, 10) * 100;
            else if (fracStr.length === 2) ms = parseInt(fracStr, 10) * 10;
            else ms = parseInt(fracStr.substring(0, 3), 10);
          }

          const totalMs = minutes * 60000 + seconds * 1000 + ms;
          timestampMatches.push({ match: match[0], timeMs: totalMs });
        }
      }

      if (timestampMatches.length > 0) {
        hasTimestamps = true;
        // Strip timestamps from line text
        const text = trimmed.replace(this.TIMESTAMP_REGEX, '').trim();

        for (const tm of timestampMatches) {
          cues.push({
            timeMs: Math.max(0, tm.timeMs + globalOffsetMs),
            text
          });
        }
        plainLines.push(text);
      } else {
        // Plain text line
        plainLines.push(trimmed);
      }
    }

    if (!hasTimestamps) {
      return {
        type: 'plain',
        lines: [],
        plainText: plainLines.join('\n'),
        metadata
      };
    }

    // Sort cues chronologically
    cues.sort((a, b) => a.timeMs - b.timeMs);

    return {
      type: 'synced',
      lines: cues,
      plainText: plainLines.filter(l => l.length > 0).join('\n'),
      metadata
    };
  }
}
