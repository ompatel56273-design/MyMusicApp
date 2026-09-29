import type { Track } from '../../domain/entities/models';

export interface M3UTrackEntry {
  readonly title: string;
  readonly artist?: string | undefined;
  readonly durationSec?: number | undefined;
  readonly path: string;
}

export interface M3UParsedResult {
  readonly title?: string | undefined;
  readonly entries: readonly M3UTrackEntry[];
}

export class M3uService {
  /**
   * Generates a standard UTF-8 M3U8 playlist content string from a list of tracks and playlist name.
   */
  public static generateM3u8(playlistName: string, tracksWithPaths: Array<{ track: Track; path?: string | undefined }>): string {
    const lines: string[] = ['#EXTM3U', `#PLAYLIST:${playlistName}`];

    for (const item of tracksWithPaths) {
      const { track, path } = item;
      const durationSec = Math.round((track.durationMs || 0) / 1000);
      const artistStr = track.artistName || 'Unknown Artist';
      const titleStr = track.title || 'Untitled Track';

      lines.push(`#EXTINF:${durationSec},${artistStr} - ${titleStr}`);
      lines.push(path || track.title || `track_${track.id}`);
    }

    return lines.join('\n');
  }

  /**
   * Parses an M3U or M3U8 playlist text content.
   */
  public static parseM3u(m3uContent: string): M3UParsedResult {
    const lines = m3uContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const entries: M3UTrackEntry[] = [];
    let playlistTitle: string | undefined;

    let currentDuration: number | undefined;
    let currentTitle: string | undefined;
    let currentArtist: string | undefined;

    for (const line of lines) {
      if (line.startsWith('#PLAYLIST:')) {
        playlistTitle = line.substring('#PLAYLIST:'.length).trim();
        continue;
      }

      if (line.startsWith('#EXTINF:')) {
        const payload = line.substring('#EXTINF:'.length).trim();
        const commaIdx = payload.indexOf(',');

        if (commaIdx !== -1) {
          const durStr = payload.substring(0, commaIdx).trim();
          const dur = parseInt(durStr, 10);
          if (!isNaN(dur)) {
            currentDuration = dur;
          }

          const infoStr = payload.substring(commaIdx + 1).trim();
          const dashIdx = infoStr.indexOf(' - ');
          if (dashIdx !== -1) {
            currentArtist = infoStr.substring(0, dashIdx).trim();
            currentTitle = infoStr.substring(dashIdx + 3).trim();
          } else {
            currentTitle = infoStr;
          }
        }
        continue;
      }

      if (line.startsWith('#')) {
        continue;
      }

      const trackPath = line;
      const entryTitle = currentTitle || this.extractFilenameWithoutExtension(trackPath);

      entries.push({
        title: entryTitle,
        artist: currentArtist,
        durationSec: currentDuration,
        path: trackPath
      });

      currentDuration = undefined;
      currentTitle = undefined;
      currentArtist = undefined;
    }

    return {
      title: playlistTitle,
      entries
    };
  }

  private static extractFilenameWithoutExtension(filePath: string): string {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1] || filePath;
    const dotIdx = filename.lastIndexOf('.');
    if (dotIdx > 0) {
      return filename.substring(0, dotIdx);
    }
    return filename;
  }
}
