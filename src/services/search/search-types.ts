import type { Track, Album, Artist, Playlist, Genre, Folder } from '../../domain/entities/models';

export type SearchEntityType = 'track' | 'album' | 'artist' | 'playlist' | 'genre' | 'folder';

export type MatchQuality = 'exact' | 'prefix' | 'word_boundary' | 'substring' | 'none';

export interface ScoredMatch<T> {
  readonly item: T;
  readonly entityType: SearchEntityType;
  readonly entityId: string;
  readonly score: number;
  readonly quality: MatchQuality;
  readonly matchedField: string;
}

export interface SearchOptions {
  readonly limitPerCategory?: number | undefined;
  readonly includeGenres?: boolean | undefined;
  readonly includeFolders?: boolean | undefined;
}

export interface RankedSearchResults {
  readonly tracks: readonly Track[];
  readonly albums: readonly Album[];
  readonly artists: readonly Artist[];
  readonly playlists: readonly Playlist[];
  readonly genres: readonly Genre[];
  readonly folders: readonly Folder[];
  readonly totalMatches: number;
}
