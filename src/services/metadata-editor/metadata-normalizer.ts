import type { EditableMetadataFields, NormalizationOptions } from './metadata-write-types';

export class MetadataNormalizer {
  private static readonly LOWERCASE_WORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of',
    'on', 'or', 'so', 'the', 'to', 'up', 'yet', 'with', 'vs', 'v'
  ]);

  /**
   * Applies requested normalization operations to a set of metadata fields.
   */
  public static normalizeFields(
    fields: EditableMetadataFields,
    options: NormalizationOptions
  ): EditableMetadataFields {
    const normalized: EditableMetadataFields = { ...fields };

    const normStr = (val?: string): string | undefined => {
      if (!val) return val;
      let res = val;

      if (options.trimWhitespace) {
        res = res.trim();
      }

      if (options.collapseWhitespace) {
        res = res.replace(/\s+/g, ' ');
      }

      if (options.titleCase && res) {
        res = this.toTitleCase(res);
      }

      return res || undefined;
    };

    if (fields.title !== undefined) normalized.title = normStr(fields.title);
    if (fields.artist !== undefined) normalized.artist = normStr(fields.artist);
    if (fields.albumArtist !== undefined) normalized.albumArtist = normStr(fields.albumArtist);
    if (fields.album !== undefined) normalized.album = normStr(fields.album);
    if (fields.genre !== undefined) normalized.genre = normStr(fields.genre);
    if (fields.composer !== undefined) normalized.composer = normStr(fields.composer);

    if (options.removeComments) {
      normalized.comment = undefined;
    } else if (fields.comment !== undefined) {
      normalized.comment = normStr(fields.comment);
    }

    return normalized;
  }

  /**
   * Converts a string to Title Case while respecting common prepositions/conjunctions.
   */
  public static toTitleCase(str: string): string {
    if (!str || !str.trim()) return str;

    const words = str.split(' ');
    return words
      .map((word, index) => {
        const lower = word.toLowerCase();
        // Capitalize first and last words always, or words not in LOWERCASE_WORDS
        if (
          index === 0 ||
          index === words.length - 1 ||
          !this.LOWERCASE_WORDS.has(lower)
        ) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        return lower;
      })
      .join(' ');
  }
}
