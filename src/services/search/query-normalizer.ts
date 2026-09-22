import type { MatchQuality } from './search-types';

/**
 * Normalizes query strings and target field strings for deterministic matching.
 * Uses standard Unicode NFKD decomposition to strip diacritics and case folding.
 */
export class QueryNormalizer {
  /**
   * Normalizes text by decomposing Unicode diacritics, lowercasing, and stripping punctuation.
   */
  public static normalize(text: string): string {
    if (!text) return '';

    return text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // Strip diacritics / accents
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Replace punctuation with space
      .replace(/\s+/g, ' ') // Collapse multiple whitespace
      .trim();
  }

  /**
   * Splits normalized text into individual word tokens.
   */
  public static tokenize(text: string): readonly string[] {
    const normalized = this.normalize(text);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  /**
   * Evaluates match quality and computes an implementation heuristic score:
   * - Exact full-phrase match: 100
   * - Prefix match: 80
   * - Word boundary prefix: 60
   * - Substring match: 40
   */
  public static evaluateMatch(
    fieldValue: string | undefined | null,
    normalizedQuery: string,
    queryTokens: readonly string[]
  ): { matches: boolean; quality: MatchQuality; score: number } {
    if (!fieldValue || !normalizedQuery) {
      return { matches: false, quality: 'none', score: 0 };
    }

    const normField = this.normalize(fieldValue);
    if (!normField) {
      return { matches: false, quality: 'none', score: 0 };
    }

    // 1. Exact match
    if (normField === normalizedQuery) {
      return { matches: true, quality: 'exact', score: 100 };
    }

    // 2. Prefix match (field starts with query)
    if (normField.startsWith(normalizedQuery)) {
      return { matches: true, quality: 'prefix', score: 80 };
    }

    // 3. Word-boundary prefix (any word in field starts with query or all query tokens match word starts)
    const fieldTokens = normField.split(' ');
    const allTokensMatchPrefix = queryTokens.every(qTok =>
      fieldTokens.some(fTok => fTok.startsWith(qTok))
    );

    if (allTokensMatchPrefix) {
      return { matches: true, quality: 'word_boundary', score: 60 };
    }

    // 4. Substring match
    if (normField.includes(normalizedQuery)) {
      return { matches: true, quality: 'substring', score: 40 };
    }

    return { matches: false, quality: 'none', score: 0 };
  }
}
