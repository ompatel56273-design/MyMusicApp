import {
  BACKUP_FORMAT_IDENTIFIER,
  CURRENT_BACKUP_VERSION,
  type MyMusicBackupBundle,
  type BackupValidationResult,
  type ValidationIssue
} from './backup-types';

export class BackupValidator {
  /**
   * Performs strict validation on a raw parsed JSON object representing a backup bundle.
   */
  public static validate(rawObj: unknown): BackupValidationResult {
    const issues: ValidationIssue[] = [];

    if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
      return {
        isValid: false,
        issues: [{ severity: 'error', message: 'Backup file is not a valid JSON object.' }],
        bundle: undefined
      };
    }

    const bundle = rawObj as Record<string, any>;

    // 1. Format check
    if (bundle.format !== BACKUP_FORMAT_IDENTIFIER) {
      issues.push({
        severity: 'error',
        message: `Invalid format identifier "${bundle.format}". Expected "${BACKUP_FORMAT_IDENTIFIER}".`,
        field: 'format'
      });
    }

    // 2. Version check
    if (typeof bundle.version !== 'number' || bundle.version < 1) {
      issues.push({
        severity: 'error',
        message: `Invalid version "${bundle.version}". Version must be a positive number.`,
        field: 'version'
      });
    } else if (bundle.version > CURRENT_BACKUP_VERSION) {
      issues.push({
        severity: 'error',
        message: `Unsupported backup version v${bundle.version}. Current supported version is v${CURRENT_BACKUP_VERSION}. Please update MyMusicApp to restore this backup.`,
        field: 'version'
      });
    }

    // 3. Metadata check
    if (typeof bundle.createdAt !== 'number' || isNaN(bundle.createdAt)) {
      issues.push({
        severity: 'error',
        message: 'Invalid or missing creation timestamp (createdAt).',
        field: 'createdAt'
      });
    }

    // 4. Data payload check
    if (!bundle.data || typeof bundle.data !== 'object' || Array.isArray(bundle.data)) {
      issues.push({
        severity: 'error',
        message: 'Missing or invalid "data" payload object in backup.',
        field: 'data'
      });

      return {
        isValid: false,
        issues,
        bundle: undefined
      };
    }

    const data = bundle.data;

    // Validate Tracks
    if (!Array.isArray(data.tracks)) {
      issues.push({
        severity: 'error',
        message: '"data.tracks" must be an array.',
        field: 'data.tracks'
      });
    } else {
      const trackIds = new Set<string>();
      data.tracks.forEach((track: any, index: number) => {
        if (!track || typeof track !== 'object') {
          issues.push({
            severity: 'error',
            message: `Malformed track entry at index ${index}.`,
            field: `data.tracks[${index}]`
          });
          return;
        }

        if (typeof track.id !== 'string' || !track.id.trim()) {
          issues.push({
            severity: 'error',
            message: `Track at index ${index} missing a valid string ID.`,
            field: `data.tracks[${index}].id`
          });
        } else if (trackIds.has(track.id)) {
          issues.push({
            severity: 'error',
            message: `Duplicate track ID found: "${track.id}".`,
            field: `data.tracks[${index}].id`
          });
        } else {
          trackIds.add(track.id);
        }

        if (typeof track.title !== 'string') {
          issues.push({
            severity: 'warning',
            message: `Track "${track.id}" has invalid title.`,
            field: `data.tracks[${index}].title`
          });
        }

        if (typeof track.durationMs !== 'number' || track.durationMs < 0) {
          issues.push({
            severity: 'warning',
            message: `Track "${track.id}" has invalid durationMs.`,
            field: `data.tracks[${index}].durationMs`
          });
        }
      });
    }

    // Validate Playlists
    const playlistIds = new Set<string>();
    if (!Array.isArray(data.playlists)) {
      issues.push({
        severity: 'error',
        message: '"data.playlists" must be an array.',
        field: 'data.playlists'
      });
    } else {
      data.playlists.forEach((playlist: any, index: number) => {
        if (!playlist || typeof playlist !== 'object') {
          issues.push({
            severity: 'error',
            message: `Malformed playlist entry at index ${index}.`,
            field: `data.playlists[${index}]`
          });
          return;
        }

        if (typeof playlist.id !== 'string' || !playlist.id.trim()) {
          issues.push({
            severity: 'error',
            message: `Playlist at index ${index} missing valid string ID.`,
            field: `data.playlists[${index}].id`
          });
        } else if (playlistIds.has(playlist.id)) {
          issues.push({
            severity: 'error',
            message: `Duplicate playlist ID found: "${playlist.id}".`,
            field: `data.playlists[${index}].id`
          });
        } else {
          playlistIds.add(playlist.id);
        }

        if (typeof playlist.name !== 'string' || !playlist.name.trim()) {
          issues.push({
            severity: 'error',
            message: `Playlist "${playlist.id}" has missing or empty name.`,
            field: `data.playlists[${index}].name`
          });
        }

        if (playlist.isSmart && playlist.smartRulesJson) {
          try {
            JSON.parse(playlist.smartRulesJson);
          } catch (e) {
            issues.push({
              severity: 'warning',
              message: `Smart playlist "${playlist.name}" has malformed smartRulesJson JSON string.`,
              field: `data.playlists[${index}].smartRulesJson`
            });
          }
        }
      });
    }

    // Validate Playlist Items
    if (data.playlistItems !== undefined) {
      if (!Array.isArray(data.playlistItems)) {
        issues.push({
          severity: 'error',
          message: '"data.playlistItems" must be an array if provided.',
          field: 'data.playlistItems'
        });
      } else {
        const itemIds = new Set<string>();
        data.playlistItems.forEach((item: any, index: number) => {
          if (!item || typeof item !== 'object') {
            issues.push({
              severity: 'error',
              message: `Malformed playlist item entry at index ${index}.`,
              field: `data.playlistItems[${index}]`
            });
            return;
          }

          if (typeof item.id === 'string' && item.id.trim()) {
            if (itemIds.has(item.id)) {
              issues.push({
                severity: 'warning',
                message: `Duplicate playlist item ID: "${item.id}".`,
                field: `data.playlistItems[${index}].id`
              });
            } else {
              itemIds.add(item.id);
            }
          }

          if (playlistIds.size > 0 && typeof item.playlistId === 'string' && !playlistIds.has(item.playlistId)) {
            issues.push({
              severity: 'warning',
              message: `Playlist item at index ${index} references non-existent playlistId "${item.playlistId}".`,
              field: `data.playlistItems[${index}].playlistId`
            });
          }
        });
      }
    }

    // Validate History
    if (data.history !== undefined && !Array.isArray(data.history)) {
      issues.push({
        severity: 'error',
        message: '"data.history" must be an array if provided.',
        field: 'data.history'
      });
    }

    // Validate Favorites
    if (data.favorites !== undefined && !Array.isArray(data.favorites)) {
      issues.push({
        severity: 'error',
        message: '"data.favorites" must be an array if provided.',
        field: 'data.favorites'
      });
    }

    // Validate Settings
    if (data.settings !== undefined && (typeof data.settings !== 'object' || Array.isArray(data.settings))) {
      issues.push({
        severity: 'error',
        message: '"data.settings" must be an object if provided.',
        field: 'data.settings'
      });
    }

    const hasError = issues.some(issue => issue.severity === 'error');

    return {
      isValid: !hasError,
      issues,
      bundle: !hasError ? (bundle as unknown as MyMusicBackupBundle) : undefined
    };
  }
}
