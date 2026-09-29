import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import { Logger } from '../../core/logging/logger';
import {
  BACKUP_FORMAT_IDENTIFIER,
  CURRENT_BACKUP_VERSION,
  type MyMusicBackupBundle,
  type BackupValidationResult,
  type BackupImportPreview,
  type BackupImportOptions,
  type BackupImportResult,
  type BackupTrackRecord,
  type BackupPlaylistRecord,
  type BackupPlaylistItemRecord,
  type BackupHistoryRecord,
  type BackupQueueRecord
} from './backup-types';
import { BackupValidator } from './backup-validator';
import { BackupSerializer } from './backup-serializer';
import { BackupMerger } from './backup-merger';
import { M3uService } from './m3u-service';
import type { Track, Playlist, PlaylistItem, PlaybackHistoryItem, QueueItem, AudioFile } from '../../domain/entities/models';
import type { EqualizerPreset } from '../../domain/entities/audio-settings';

export class BackupService {
  private readonly logger = new Logger('BackupService');

  constructor(
    private readonly dbAdapter: IDatabaseAdapter,
    private readonly eventBus?: EventBus
  ) {}

  /**
   * Generates a complete .mymusic backup bundle from current local application data.
   */
  public async createBackupBundle(): Promise<MyMusicBackupBundle> {
    this.logger.info('Collecting application data for backup snapshot...');

    const tracks = await this.dbAdapter.getAll<Track>(STORES.TRACKS);
    const audioFiles = await this.dbAdapter.getAll<AudioFile>(STORES.AUDIO_FILES);
    const playlists = await this.dbAdapter.getAll<Playlist>(STORES.PLAYLISTS);
    const playlistItems = await this.dbAdapter.getAll<PlaylistItem>(STORES.PLAYLIST_ITEMS);
    const history = await this.dbAdapter.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);
    const queue = await this.dbAdapter.getAll<QueueItem>(STORES.QUEUE_ITEMS);
    const rawSettings = await this.dbAdapter.getAll<{ key: string; value: any }>(STORES.SETTINGS);

    const audioFilePathMap = new Map<string, string>(audioFiles.map(af => [af.id, af.path]));

    // 1. Tracks payload
    const backupTracks: BackupTrackRecord[] = tracks.map(t => ({
      id: t.id,
      fileId: t.fileId,
      title: t.title,
      artistId: t.artistId,
      artistName: t.artistName,
      albumId: t.albumId,
      albumTitle: t.albumTitle,
      albumArtistId: t.albumArtistId,
      genreId: t.genreId,
      genreName: t.genreName,
      folderId: t.folderId,
      durationMs: t.durationMs,
      trackNumber: t.trackNumber,
      discNumber: t.discNumber,
      year: t.year,
      format: t.format,
      replayGain: t.replayGain,
      dateAdded: t.dateAdded,
      dateModified: t.dateModified,
      lastPlayedAt: t.lastPlayedAt,
      playCount: t.playCount,
      isFavorite: t.isFavorite,
      hasLyrics: t.hasLyrics,
      availability: t.availability,
      filePath: audioFilePathMap.get(t.fileId)
    }));

    // 2. Playlists payload
    const backupPlaylists: BackupPlaylistRecord[] = playlists.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isSmart: p.isSmart,
      smartRulesJson: p.smartRulesJson,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      trackCount: p.trackCount,
      durationMs: p.durationMs
    }));

    // 3. Playlist items payload
    const backupPlaylistItems: BackupPlaylistItemRecord[] = playlistItems.map(pi => ({
      id: pi.id,
      playlistId: pi.playlistId,
      trackId: pi.trackId,
      position: pi.position,
      addedAt: pi.addedAt
    }));

    // 4. History payload
    const backupHistory: BackupHistoryRecord[] = history.map(h => ({
      id: h.id,
      trackId: h.trackId,
      playedAt: h.playedAt,
      durationListenedMs: h.durationListenedMs,
      completed: h.completed
    }));

    // 5. Favorites payload
    const favorites = tracks.filter(t => t.isFavorite).map(t => t.id);

    // 6. Settings payload
    const settingsObj: Record<string, any> = {};
    for (const s of rawSettings) {
      if (s.key) {
        settingsObj[s.key] = s.value;
      }
    }

    // 7. EQ Presets
    const eqPresets: EqualizerPreset[] = settingsObj.audio_settings?.customPresets || [];

    // 8. Queue payload
    const backupQueue: BackupQueueRecord[] = queue.map(q => ({
      id: q.id,
      trackId: q.trackId,
      position: q.position,
      addedReason: q.addedReason
    }));

    const bundle: MyMusicBackupBundle = {
      format: BACKUP_FORMAT_IDENTIFIER,
      version: CURRENT_BACKUP_VERSION,
      createdAt: Date.now(),
      appVersion: '1.0.0',
      data: {
        tracks: backupTracks,
        playlists: backupPlaylists,
        playlistItems: backupPlaylistItems,
        history: backupHistory,
        favorites,
        settings: settingsObj,
        eqPresets,
        queue: backupQueue
      }
    };

    this.logger.info(`Backup snapshot created successfully (${tracks.length} tracks, ${playlists.length} playlists).`);
    return bundle;
  }

  /**
   * Export local library data into a downloadable .mymusic backup file.
   */
  public async exportBackupFile(): Promise<void> {
    const bundle = await this.createBackupBundle();
    const jsonStr = BackupSerializer.serialize(bundle);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `mymusic_backup_${dateStr}.mymusic`;

    BackupSerializer.triggerDownload(jsonStr, filename);
    this.logger.info(`Exported backup file "${filename}".`);
  }

  /**
   * Validates a given backup File or JSON content.
   */
  public async validateBackupFile(fileOrJson: File | string): Promise<BackupValidationResult> {
    let jsonStr: string;
    if (typeof fileOrJson === 'string') {
      jsonStr = fileOrJson;
    } else {
      jsonStr = await BackupSerializer.readFileAsText(fileOrJson);
    }

    let rawObj: unknown;
    try {
      rawObj = BackupSerializer.deserialize(jsonStr);
    } catch (err) {
      return {
        isValid: false,
        issues: [{ severity: 'error', message: (err as Error).message }],
        bundle: undefined
      };
    }

    return BackupValidator.validate(rawObj);
  }

  /**
   * Prepares an import preview before user commits to restore or merge.
   */
  public async getImportPreview(fileOrJson: File | string): Promise<{ validation: BackupValidationResult; preview?: BackupImportPreview | undefined }> {
    const validation = await this.validateBackupFile(fileOrJson);
    if (!validation.isValid || !validation.bundle) {
      return { validation, preview: undefined };
    }

    const preview = await BackupMerger.calculatePreview(this.dbAdapter, validation.bundle);
    return { validation, preview };
  }

  /**
   * Performs the actual restore or merge operation.
   */
  public async importBackup(fileOrJson: File | string, options: BackupImportOptions): Promise<BackupImportResult> {
    const { validation } = await this.getImportPreview(fileOrJson);
    if (!validation.isValid || !validation.bundle) {
      return {
        success: false,
        mode: options.mode,
        tracksImported: 0,
        playlistsImported: 0,
        historyImported: 0,
        favoritesImported: 0,
        settingsImported: false,
        warnings: [],
        errors: validation.issues.filter(i => i.severity === 'error').map(i => i.message)
      };
    }

    const result = await BackupMerger.executeImport(this.dbAdapter, validation.bundle, options.mode);

    if (result.success) {
      this.logger.info(`Backup import (${options.mode}) completed successfully.`);
      this.notifyDomainEvents(result);
    } else {
      this.logger.error(`Backup import (${options.mode}) failed with errors: ${result.errors.join(', ')}`);
    }

    return result;
  }

  /**
   * Export static playlist to M3U8 file format.
   */
  public async exportPlaylistM3u8(playlistId: string): Promise<void> {
    const playlist = await this.dbAdapter.get<Playlist>(STORES.PLAYLISTS, playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found.`);
    }

    const playlistItems = await this.dbAdapter.getAllByIndex<PlaylistItem>(
      STORES.PLAYLIST_ITEMS,
      'by_playlistId',
      playlistId
    );
    playlistItems.sort((a, b) => a.position - b.position);

    const tracks = await this.dbAdapter.getAll<Track>(STORES.TRACKS);
    const audioFiles = await this.dbAdapter.getAll<AudioFile>(STORES.AUDIO_FILES);

    const trackMap = new Map<string, Track>(tracks.map(t => [t.id, t]));
    const audioFileMap = new Map<string, string>(audioFiles.map(af => [af.id, af.path]));

    const itemsForExport: Array<{ track: Track; path?: string | undefined }> = [];
    for (const item of playlistItems) {
      const track = trackMap.get(item.trackId);
      if (track) {
        itemsForExport.push({
          track,
          path: audioFileMap.get(track.fileId)
        });
      }
    }

    const m3uStr = M3uService.generateM3u8(playlist.name, itemsForExport);
    const safeName = playlist.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    BackupSerializer.triggerDownload(m3uStr, `${safeName}.m3u8`);
  }

  /**
   * Import M3U/M3U8 file and resolve tracks against existing library.
   */
  public async importPlaylistM3u(m3uFile: File): Promise<{ playlist: Playlist; tracksMatched: number; totalEntries: number }> {
    const m3uContent = await BackupSerializer.readFileAsText(m3uFile);
    const parsed = M3uService.parseM3u(m3uContent);

    const playlistName = parsed.title || m3uFile.name.replace(/\.m3u8?$/i, '');
    const tracks = await this.dbAdapter.getAll<Track>(STORES.TRACKS);
    const audioFiles = await this.dbAdapter.getAll<AudioFile>(STORES.AUDIO_FILES);

    const pathMap = new Map<string, Track>();
    const titleArtistMap = new Map<string, Track>();

    const audioFileIdMap = new Map<string, string>(audioFiles.map(af => [af.id, af.path.toLowerCase()]));

    for (const t of tracks) {
      const p = audioFileIdMap.get(t.fileId);
      if (p) {
        pathMap.set(p, t);
      }
      const key = `${(t.title || '').toLowerCase()}|${(t.artistName || '').toLowerCase()}`;
      titleArtistMap.set(key, t);
    }

    const newPlaylistId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const playlistItemsToSave: PlaylistItem[] = [];
    let tracksMatched = 0;

    parsed.entries.forEach((entry, idx) => {
      let matchedTrack: Track | undefined;

      if (entry.path) {
        matchedTrack = pathMap.get(entry.path.toLowerCase());
      }

      if (!matchedTrack && entry.title) {
        const key = `${entry.title.toLowerCase()}|${(entry.artist || '').toLowerCase()}`;
        matchedTrack = titleArtistMap.get(key);
      }

      if (matchedTrack) {
        tracksMatched++;
        playlistItemsToSave.push({
          id: `pi_${newPlaylistId}_${idx}`,
          playlistId: newPlaylistId,
          trackId: matchedTrack.id,
          position: idx,
          addedAt: Date.now()
        });
      }
    });

    const newPlaylist: Playlist = {
      id: newPlaylistId,
      name: playlistName,
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: playlistItemsToSave.length,
      durationMs: 0
    };

    await this.dbAdapter.put(STORES.PLAYLISTS, newPlaylist);
    if (playlistItemsToSave.length > 0) {
      await this.dbAdapter.putBatch(STORES.PLAYLIST_ITEMS, playlistItemsToSave);
    }

    if (this.eventBus) {
      this.eventBus.publish(DomainEvents.PLAYLIST_UPDATED, { playlist: newPlaylist, action: 'created' });
    }

    return {
      playlist: newPlaylist,
      tracksMatched,
      totalEntries: parsed.entries.length
    };
  }

  private notifyDomainEvents(result: BackupImportResult): void {
    if (!this.eventBus) return;

    this.eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
      tracksAdded: result.tracksImported,
      tracksUpdated: 0,
      tracksRemoved: 0,
      timestamp: Date.now()
    });

    this.eventBus.publish(DomainEvents.HISTORY_UPDATED, { timestamp: Date.now() });

    this.eventBus.publish((DomainEvents as any).BACKUP_IMPORTED || 'backup:imported', {
      result,
      timestamp: Date.now()
    });
  }
}
