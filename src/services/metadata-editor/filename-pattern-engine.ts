import type { EditableMetadataFields } from './metadata-write-types';

export class FilenamePatternEngine {
  private static readonly TOKEN_REGEX = /%(title|artist|album|albumartist|genre|year|track|disc|composer)%/gi;

  /**
   * Generates a new filename from track metadata using a tokenized pattern (e.g. "%track% - %artist% - %title%").
   */
  public static generateFilenameFromTags(
    pattern: string,
    metadata: EditableMetadataFields,
    originalFilenameOrExt: string
  ): string {
    const ext = this.extractExtension(originalFilenameOrExt);

    let result = pattern;

    result = result.replace(/%title%/gi, metadata.title || 'Untitled');
    result = result.replace(/%artist%/gi, metadata.artist || 'Unknown Artist');
    result = result.replace(/%album%/gi, metadata.album || 'Unknown Album');
    result = result.replace(/%albumartist%/gi, metadata.albumArtist || metadata.artist || 'Unknown Artist');
    result = result.replace(/%genre%/gi, metadata.genre || 'Unknown Genre');
    result = result.replace(/%year%/gi, metadata.year ? String(metadata.year) : '');
    result = result.replace(/%composer%/gi, metadata.composer || '');

    result = result.replace(/%track%/gi, metadata.trackNumber !== undefined ? String(metadata.trackNumber).padStart(2, '0') : '');
    result = result.replace(/%disc%/gi, metadata.discNumber !== undefined ? String(metadata.discNumber) : '');

    // Sanitize the resulting base filename
    const sanitizedBase = this.sanitizeFilename(result);
    return ext ? `${sanitizedBase}.${ext}` : sanitizedBase;
  }

  /**
   * Parses metadata values from a given filename using a pattern (e.g. "%track% - %artist% - %title%").
   */
  public static parseTagsFromFilename(pattern: string, filename: string): EditableMetadataFields {
    const baseName = this.removeExtension(filename);

    // Build regex pattern by replacing tokens with capture groups
    const tokens: string[] = [];
    const regexPattern = pattern.replace(this.TOKEN_REGEX, (_match, tokenName) => {
      tokens.push(tokenName.toLowerCase());
      return '(.*?)';
    });

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    const match = baseName.match(regex);

    if (!match) {
      return {};
    }

    const fields: EditableMetadataFields = {};

    tokens.forEach((token, idx) => {
      const val = (match[idx + 1] || '').trim();
      if (!val) return;

      switch (token) {
        case 'title':
          fields.title = val;
          break;
        case 'artist':
          fields.artist = val;
          break;
        case 'album':
          fields.album = val;
          break;
        case 'albumartist':
          fields.albumArtist = val;
          break;
        case 'genre':
          fields.genre = val;
          break;
        case 'year':
          const yr = parseInt(val, 10);
          if (!isNaN(yr) && yr > 1800 && yr < 2100) fields.year = yr;
          break;
        case 'track':
          const trk = parseInt(val, 10);
          if (!isNaN(trk) && trk > 0) fields.trackNumber = trk;
          break;
        case 'disc':
          const dsc = parseInt(val, 10);
          if (!isNaN(dsc) && dsc > 0) fields.discNumber = dsc;
          break;
        case 'composer':
          fields.composer = val;
          break;
      }
    });

    return fields;
  }

  /**
   * Sanitizes invalid characters and reserved Windows filenames.
   */
  public static sanitizeFilename(filename: string): string {
    if (!filename || !filename.trim()) {
      return 'Untitled';
    }

    // 1. Remove path traversal markers
    let clean = filename.replace(/\\/g, '/').replace(/\.\.\//g, '').replace(/\.\.\\/g, '');

    // Get just the basename if a path was passed
    if (clean.includes('/')) {
      clean = clean.split('/').pop() || 'Untitled';
    }

    // 2. Remove invalid Windows / POSIX characters: < > : " / \ | ? * and control chars
    clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

    // 3. Remove consecutive spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    // 4. Remove trailing periods or spaces
    clean = clean.replace(/[\.\s]+$/, '');

    // 5. Prevent Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(clean)) {
      clean = `${clean}_file`;
    }

    return clean || 'Untitled';
  }

  private static extractExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length <= 1) return '';
    return parts[parts.length - 1]!.toLowerCase();
  }

  private static removeExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length <= 1) return filename;
    parts.pop();
    return parts.join('.');
  }
}
