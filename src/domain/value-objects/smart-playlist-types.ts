import type { EntityId } from './audio-types';

export type SmartRuleField =
  | 'title'
  | 'artist'
  | 'album'
  | 'genre'
  | 'folder'
  | 'codec'
  | 'format'
  | 'playCount'
  | 'skipCount'
  | 'duration'
  | 'addedAt'
  | 'lastPlayedAt'
  | 'favorite';

export type TextOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith';
export type NumericOperator = 'equals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual';
export type DateOperator = 'before' | 'after' | 'withinLast';
export type BooleanOperator = 'is' | 'isNot';

export type SmartRuleOperator = TextOperator | NumericOperator | DateOperator | BooleanOperator;

export interface SmartRule {
  readonly field: SmartRuleField;
  readonly operator: SmartRuleOperator;
  readonly value: string | number | boolean;
}

export type SmartMatchMode = 'all' | 'any';

export type SmartSortField =
  | 'title'
  | 'artist'
  | 'album'
  | 'duration'
  | 'dateAdded'
  | 'lastPlayed'
  | 'playCount'
  | 'rating'
  | 'random';

export type SmartSortOrder = 'asc' | 'desc';

export interface SmartPlaylistSort {
  readonly field: SmartSortField;
  readonly order: SmartSortOrder;
}

export interface SmartPlaylistDefinition {
  readonly id: EntityId;
  readonly name: string;
  readonly description?: string | undefined;
  readonly rules: readonly SmartRule[];
  readonly matchMode: SmartMatchMode;
  readonly sort: SmartPlaylistSort;
  readonly limit: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly enabled: boolean;
}
