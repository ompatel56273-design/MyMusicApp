import { describe, it, expect } from 'vitest';
import { QueryNormalizer } from '../../src/services/search/query-normalizer';

describe('QueryNormalizer', () => {
  it('should normalize case and strip Unicode diacritics', () => {
    expect(QueryNormalizer.normalize('Mötley Crüe')).toBe('motley crue');
    expect(QueryNormalizer.normalize('Café del Mar')).toBe('cafe del mar');
    expect(QueryNormalizer.normalize('Björk')).toBe('bjork');
    expect(QueryNormalizer.normalize('Sigur Rós')).toBe('sigur ros');
    expect(QueryNormalizer.normalize('  QUEEN  ')).toBe('queen');
  });

  it('should strip punctuation and collapse whitespace', () => {
    expect(QueryNormalizer.normalize('AC/DC - Back in Black')).toBe('ac dc back in black');
    expect(QueryNormalizer.normalize('Song_Name_01 (Remix).mp3')).toBe('song name 01 remix mp3');
    expect(QueryNormalizer.normalize('   multiple    spaces   ')).toBe('multiple spaces');
  });

  it('should handle empty and invalid input safely', () => {
    expect(QueryNormalizer.normalize('')).toBe('');
    expect(QueryNormalizer.normalize('   ')).toBe('');
    expect(QueryNormalizer.tokenize('')).toEqual([]);
    expect(QueryNormalizer.tokenize('   ')).toEqual([]);
  });

  it('should evaluate match quality and compute heuristic scores', () => {
    const query = 'bohemian';
    const queryTokens = ['bohemian'];

    // Exact match
    const exact = QueryNormalizer.evaluateMatch('Bohemian', query, queryTokens);
    expect(exact.matches).toBe(true);
    expect(exact.quality).toBe('exact');
    expect(exact.score).toBe(100);

    // Prefix match
    const prefix = QueryNormalizer.evaluateMatch('Bohemian Rhapsody', query, queryTokens);
    expect(prefix.matches).toBe(true);
    expect(prefix.quality).toBe('prefix');
    expect(prefix.score).toBe(80);

    // Word boundary match
    const wordBoundary = QueryNormalizer.evaluateMatch('A Bohemian Tale', query, queryTokens);
    expect(wordBoundary.matches).toBe(true);
    expect(wordBoundary.quality).toBe('word_boundary');
    expect(wordBoundary.score).toBe(60);

    // Substring match
    const substring = QueryNormalizer.evaluateMatch('Thebohemians', query, queryTokens);
    expect(substring.matches).toBe(true);
    expect(substring.quality).toBe('substring');
    expect(substring.score).toBe(40);

    // No match
    const none = QueryNormalizer.evaluateMatch('Another Song', query, queryTokens);
    expect(none.matches).toBe(false);
    expect(none.quality).toBe('none');
    expect(none.score).toBe(0);
  });
});
