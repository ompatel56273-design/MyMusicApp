import type {
  SmartPlaylistDefinition,
  SmartRule,
  SmartRuleField,
  SmartRuleOperator
} from '../../domain/value-objects/smart-playlist-types';

const TEXT_FIELDS: SmartRuleField[] = ['title', 'artist', 'album', 'genre', 'folder', 'codec', 'format'];
const NUMERIC_FIELDS: SmartRuleField[] = ['playCount', 'skipCount', 'duration'];
const DATE_FIELDS: SmartRuleField[] = ['addedAt', 'lastPlayedAt'];
const BOOLEAN_FIELDS: SmartRuleField[] = ['favorite'];

const TEXT_OPERATORS: SmartRuleOperator[] = ['equals', 'contains', 'startsWith', 'endsWith'];
const NUMERIC_OPERATORS: SmartRuleOperator[] = [
  'equals',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual'
];
const DATE_OPERATORS: SmartRuleOperator[] = ['before', 'after', 'withinLast'];
const BOOLEAN_OPERATORS: SmartRuleOperator[] = ['is', 'isNot'];

export class SmartPlaylistValidator {
  public static validate(def: Partial<SmartPlaylistDefinition>): void {
    if (!def.name || !def.name.trim()) {
      throw new Error('Smart Playlist name cannot be empty');
    }

    if (def.limit !== undefined && def.limit !== null) {
      if (typeof def.limit !== 'number' || isNaN(def.limit) || def.limit <= 0 || !Number.isInteger(def.limit)) {
        throw new Error(`Invalid limit value: ${def.limit}. Limit must be a positive integer or null.`);
      }
    }

    if (def.matchMode && !['all', 'any'].includes(def.matchMode)) {
      throw new Error(`Invalid matchMode: ${def.matchMode}`);
    }

    if (def.sort) {
      const validSortFields = ['title', 'artist', 'album', 'duration', 'dateAdded', 'lastPlayed', 'playCount', 'rating', 'random'];
      if (!validSortFields.includes(def.sort.field)) {
        throw new Error(`Invalid sort field: ${def.sort.field}`);
      }
      if (!['asc', 'desc'].includes(def.sort.order)) {
        throw new Error(`Invalid sort order: ${def.sort.order}`);
      }
    }

    if (def.rules) {
      if (!Array.isArray(def.rules)) {
        throw new Error('Rules must be an array');
      }

      for (let i = 0; i < def.rules.length; i++) {
        this.validateRule(def.rules[i]!, i);
      }
    }
  }

  public static validateRule(rule: SmartRule, index = 0): void {
    if (!rule || typeof rule !== 'object') {
      throw new Error(`Invalid rule at index ${index}`);
    }

    const { field, operator, value } = rule;

    if (TEXT_FIELDS.includes(field)) {
      if (!TEXT_OPERATORS.includes(operator)) {
        throw new Error(`Invalid operator "${operator}" for text field "${field}" at index ${index}`);
      }
      if (typeof value !== 'string') {
        throw new Error(`Value for text field "${field}" at index ${index} must be a string`);
      }
    } else if (NUMERIC_FIELDS.includes(field)) {
      if (!NUMERIC_OPERATORS.includes(operator)) {
        throw new Error(`Invalid operator "${operator}" for numeric field "${field}" at index ${index}`);
      }
      if (typeof value !== 'number' || isNaN(value) || value < 0) {
        throw new Error(`Value for numeric field "${field}" at index ${index} must be a non-negative number`);
      }
    } else if (DATE_FIELDS.includes(field)) {
      if (!DATE_OPERATORS.includes(operator)) {
        throw new Error(`Invalid operator "${operator}" for date field "${field}" at index ${index}`);
      }
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`Value for date field "${field}" at index ${index} must be a valid numeric timestamp or day count`);
      }
    } else if (BOOLEAN_FIELDS.includes(field)) {
      if (!BOOLEAN_OPERATORS.includes(operator)) {
        throw new Error(`Invalid operator "${operator}" for boolean field "${field}" at index ${index}`);
      }
      if (typeof value !== 'boolean') {
        throw new Error(`Value for boolean field "${field}" at index ${index} must be a boolean`);
      }
    } else {
      throw new Error(`Unknown rule field "${field}" at index ${index}`);
    }
  }
}
