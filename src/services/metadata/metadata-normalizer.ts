import type { ExtractedMetadata } from './metadata-types';
import type { ArtistRole } from '../../domain/value-objects/audio-types';

export interface NormalizedArtistEntry {
  readonly name: string;
  readonly role: ArtistRole;
}

export interface NormalizedMetadataResult {
  readonly title: string;
  readonly primaryArtist: string;
  readonly hasRealArtist: boolean;
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
    let extractedArtist: string | undefined;
    let extractedAlbum: string | undefined;
    let extractedTrackNumber: number | undefined;

    // Check filename for fallback metadata if embedded tags are incomplete
    if (fallbackFilename) {
      const lastDot = fallbackFilename.lastIndexOf('.');
      const base = lastDot > 0 ? fallbackFilename.substring(0, lastDot).trim() : fallbackFilename.trim();
      const parts = base.split(/\s*-\s*/);

      if (parts.length === 2) {
        const p0 = parts[0]!.trim();
        const numMatch = p0.match(/^(\d+)[\.\s]*$/);
        if (numMatch && numMatch[1]) {
          extractedTrackNumber = parseInt(numMatch[1], 10);
        } else if (p0.length > 0) {
          extractedArtist = p0;
        }
      } else if (parts.length >= 3) {
        const p0 = parts[0]!.trim();
        const p1 = parts[1]!.trim();
        const numMatch = p0.match(/^(\d+)[\.\s]*$/);
        if (numMatch && numMatch[1]) {
          extractedTrackNumber = parseInt(numMatch[1], 10);
          if (p1.length > 0) extractedArtist = p1;
        } else {
          if (p0.length > 0) extractedArtist = p0;
          if (p1.length > 0) extractedAlbum = p1;
        }
      }
    }

    // 1. Normalize Title (Precedence: embedded title -> filename -> "Unknown Track")
    let title = (raw.title || '').trim();
    if (!title && fallbackFilename) {
      const lastDot = fallbackFilename.lastIndexOf('.');
      title = lastDot > 0 ? fallbackFilename.substring(0, lastDot).trim() : fallbackFilename.trim();
    }
    if (!title) {
      title = 'Unknown Track';
    }

    // 2. Multi-Artist Extraction
    const artistList: NormalizedArtistEntry[] = [];
    const rawArtist = (raw.artist || '').trim();
    const effectiveArtist = rawArtist || extractedArtist || '';
    const hasRealArtist = !!effectiveArtist && effectiveArtist.toLowerCase() !== 'unknown artist';

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
    } else if (effectiveArtist) {
      const tokens = effectiveArtist.split(this.ARTIST_DELIMITERS).map(s => s.trim()).filter(Boolean);
      if (tokens.length > 0) {
        artistList.push({ name: tokens[0]!, role: 'primary' });
        for (let i = 1; i < tokens.length; i++) {
          if (!artistList.some(item => item.name.toLowerCase() === tokens[i]!.toLowerCase())) {
            artistList.push({ name: tokens[i]!, role: 'featured' });
          }
        }
      } else {
        artistList.push({ name: effectiveArtist, role: 'primary' });
      }
    }

    const primaryArtist = artistList.length > 0 ? artistList[0]!.name : (effectiveArtist || 'Unknown Artist');

    // 3. Album & Album Artist
    const albumTitle = (raw.album || '').trim() || extractedAlbum || undefined;
    const albumArtist = (raw.albumArtist || '').trim() || (raw.isCompilation ? 'Various Artists' : undefined);

    // 4. Genre
    const genreName = (raw.genre || '').trim() || undefined;

    // 5. Track & Disc Numbers
    const trackNumber = (raw.trackNumber && raw.trackNumber > 0) ? raw.trackNumber : extractedTrackNumber;
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
      hasRealArtist,
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
