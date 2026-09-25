import type { ExtractedMetadata } from './metadata-types';
import type { ArtistRole } from '../../domain/value-objects/audio-types';

export interface NormalizedArtistEntry {
  readonly name: string;
  readonly role: ArtistRole;
}

export interface NormalizedMetadataResult {
  readonly title: string;
  readonly primaryArtist: string;
  readonly allArtists: readonly NormalizedArtistEntry[];
  readonly albumTitle?: string | undefined;
  readonly albumArtist?: string | undefined;
  readonly genreName?: string | undefined;
  readonly trackNumber?: number | undefined;
  readonly discNumber?: number | undefined;
  readonly year?: number | undefined;
  readonly durationMs: number;
  readonly isCompilation: boolean;
}

export class MetadataNormalizer {
  /**
   * Multi-artist delimiters: feat., ft., featuring, with, vs., ;, /, &
   */
  private static readonly ARTIST_DELIMITERS = /\s+(?:feat\.|ft\.|featuring|with|vs\.)\s+|[;/&]\s*/i;

  public static normalize(raw: ExtractedMetadata, fallbackFilename?: string): NormalizedMetadataResult {
    // Standardize raw strings
    let rawTitle = (raw.title || '').trim();
    let rawArtist = (raw.artist || '').trim();

    // 1. Filename Parsing Fallback if embedded title or artist is missing
    if ((!rawTitle || !rawArtist) && fallbackFilename) {
      const lastDot = fallbackFilename.lastIndexOf('.');
      const baseName = lastDot > 0 ? fallbackFilename.substring(0, lastDot).trim() : fallbackFilename.trim();

      if (!rawTitle && rawArtist) {
        // Artist is known, use baseName as title fallback
        rawTitle = baseName;
      } else if (!rawTitle || !rawArtist) {
        // Pattern: "01 - Artist - Title" or "Artist - Title"
        const matchWithTrack = baseName.match(/^(\d+)[\s._-]+\s*(.+?)\s+-\s+(.+)$/);
        const matchSimple = baseName.match(/^(.+?)\s+-\s+(.+)$/);

        if (matchWithTrack) {
          if (!rawArtist) rawArtist = matchWithTrack[2]!.trim();
          if (!rawTitle) rawTitle = matchWithTrack[3]!.trim();
        } else if (matchSimple) {
          if (!rawArtist) rawArtist = matchSimple[1]!.trim();
          if (!rawTitle) rawTitle = matchSimple[2]!.trim();
        } else if (!rawTitle) {
          rawTitle = baseName;
        }
      }
    }

    let title = rawTitle || 'Unknown Track';

    // 2. Multi-Artist Extraction
    const artistList: NormalizedArtistEntry[] = [];

    if (raw.artists && raw.artists.length > 0) {
      for (const a of raw.artists) {
        const trimmed = a.trim();
        if (trimmed && !artistList.some(item => item.name.toLowerCase() === trimmed.toLowerCase())) {
          artistList.push({
            name: trimmed,
            role: artistList.length === 0 ? 'primary' : 'featured'
          });
        }
      }
    } else if (rawArtist) {
      // Split on delimiters
      const tokens = rawArtist.split(this.ARTIST_DELIMITERS).map(s => s.trim()).filter(Boolean);
      if (tokens.length > 0) {
        artistList.push({ name: tokens[0], role: 'primary' });
        for (let i = 1; i < tokens.length; i++) {
          if (!artistList.some(item => item.name.toLowerCase() === tokens[i].toLowerCase())) {
            artistList.push({ name: tokens[i], role: 'featured' });
          }
        }
      } else {
        artistList.push({ name: rawArtist, role: 'primary' });
      }
    }

    const primaryArtist = artistList.length > 0 ? artistList[0].name : (rawArtist || 'Unknown Artist');

    // 3. Album & Album Artist
    const albumTitle = (raw.album || '').trim() || undefined;
    const albumArtist = (raw.albumArtist || '').trim() || (raw.isCompilation ? 'Various Artists' : undefined);

    // 4. Genre
    const genreName = (raw.genre || '').trim() || undefined;

    // 5. Track & Disc Numbers
    const trackNumber = raw.trackNumber && raw.trackNumber > 0 ? raw.trackNumber : undefined;
    const discNumber = raw.discNumber && raw.discNumber > 0 ? raw.discNumber : undefined;

    // 6. Year
    let year = raw.year;
    if (!year && raw.date) {
      const m = raw.date.match(/\b(19\d\d|20\d\d)\b/);
      if (m && m[1]) year = parseInt(m[1], 10);
    }

    // 7. Compilation Flag
    const isCompilation = !!raw.isCompilation ||
      (albumArtist ? albumArtist.toLowerCase() === 'various artists' : false);

    return {
      title,
      primaryArtist,
      allArtists: artistList.length > 0 ? artistList : [{ name: primaryArtist, role: 'primary' }],
      albumTitle,
      albumArtist,
      genreName,
      trackNumber,
      discNumber,
      year: year && year > 1900 && year < 2100 ? year : undefined,
      durationMs: raw.durationMs && raw.durationMs > 0 ? raw.durationMs : 0,
      isCompilation
    };
  }
}
