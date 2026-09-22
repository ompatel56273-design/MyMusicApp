import { describe, it, expect } from 'vitest';
import { SearchRanker } from '../../src/services/search/search-ranker';
import type { ScoredMatch } from '../../src/services/search/search-types';
import type { Track } from '../../src/domain/entities/models';

describe('SearchRanker', () => {
  const createMockTrack = (id: string, title: string, playCount = 0): Track => ({
    id,
    fileId: `file_${id}`,
    title,
    durationMs: 180000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  });

  it('should rank higher scores first', () => {
    const track1 = createMockTrack('1', 'Bohemian Rhapsody', 10);
    const track2 = createMockTrack('2', 'Bohemian', 5);
    const track3 = createMockTrack('3', 'The Bohemians', 20);

    const matches: ScoredMatch<Track>[] = [
      { item: track1, entityType: 'track', entityId: '1', score: 80, quality: 'prefix', matchedField: 'title' },
      { item: track2, entityType: 'track', entityId: '2', score: 100, quality: 'exact', matchedField: 'title' },
      { item: track3, entityType: 'track', entityId: '3', score: 40, quality: 'substring', matchedField: 'title' }
    ];

    const ranked = SearchRanker.rankMatches(matches);
    expect(ranked[0]?.id).toBe('2'); // Score 100
    expect(ranked[1]?.id).toBe('1'); // Score 80
    expect(ranked[2]?.id).toBe('3'); // Score 40
  });

  it('should break ties using playCount popularity and alphabetical title', () => {
    const trackA = createMockTrack('a', 'Song Alpha', 5);
    const trackB = createMockTrack('b', 'Song Beta', 25);
    const trackC = createMockTrack('c', 'Song Charlie', 25);

    const matches: ScoredMatch<Track>[] = [
      { item: trackA, entityType: 'track', entityId: 'a', score: 80, quality: 'prefix', matchedField: 'title' },
      { item: trackB, entityType: 'track', entityId: 'b', score: 80, quality: 'prefix', matchedField: 'title' },
      { item: trackC, entityType: 'track', entityId: 'c', score: 80, quality: 'prefix', matchedField: 'title' }
    ];

    const ranked = SearchRanker.rankMatches(matches);
    expect(ranked[0]?.id).toBe('b'); // playCount 25, 'Song Beta' < 'Song Charlie'
    expect(ranked[1]?.id).toBe('c'); // playCount 25
    expect(ranked[2]?.id).toBe('a'); // playCount 5
  });

  it('should deduplicate entries with composite (entityType:entityId)', () => {
    const track1 = createMockTrack('1', 'Duplicated Song', 10);

    const matches: ScoredMatch<Track>[] = [
      { item: track1, entityType: 'track', entityId: '1', score: 100, quality: 'exact', matchedField: 'title' },
      { item: track1, entityType: 'track', entityId: '1', score: 60, quality: 'word_boundary', matchedField: 'artistName' }
    ];

    const ranked = SearchRanker.rankMatches(matches);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.id).toBe('1');
  });
});
