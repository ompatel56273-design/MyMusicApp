import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import type {
  MyMusicBackupBundle,
  BackupImportPreview,
  BackupImportResult,
  ImportMode,
  BackupTrackRecord,
  BackupPlaylistRecord
} from './backup-types';
import type { Track, Playlist, PlaylistItem, PlaybackHistoryItem, AudioFile } from '../../domain/entities/models';
import type { AvailabilityState } from '../../domain/value-objects/audio-types';

export class BackupMerger {
  /**
   * Calculates a detailed preview comparing the backup bundle against current local database state.
   */
  public static async calculatePreview(
    dbAdapter: IDatabaseAdapter,
    bundle: MyMusicBackupBundle
  ): Promise<BackupImportPreview> {
    const data = bundle.data;
    const warnings: string[] = [];
    const errors: string[] = [];

    // Fetch current DB records
    const existingTracks = await dbAdapter.getAll<Track>(STORES.TRACKS);
    const existingAudioFiles = await dbAdapter.getAll<AudioFile>(STORES.AUDIO_FILES);
    const existingPlaylists = await dbAdapter.getAll<Playlist>(STORES.PLAYLISTS);
    const existingHistory = await dbAdapter.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);

    const trackIdMap = new Map<string, Track>(existingTracks.map(t => [t.id, t]));
    const compositeTrackMap = new Map<string, Track>();
    existingTracks.forEach(t => {
      const key = this.getTrackCompositeKey(t.title, t.artistName, t.albumTitle);
      compositeTrackMap.set(key, t);
    });

    const audioFilePathSet = new Set<string>(existingAudioFiles.map(af => af.path.toLowerCase()));

    let tracksToAdd = 0;
    let tracksToUpdate = 0;
    let tracksExisting = 0;
    let tracksMissingFile = 0;

    for (const bTrack of data.tracks) {
      const existingById = trackIdMap.get(bTrack.id);
      const existingByComp = compositeTrackMap.get(
        this.getTrackCompositeKey(bTrack.title, bTrack.artistName, bTrack.albumTitle)
      );

      if (existingById || existingByComp) {
        tracksExisting++;
        tracksToUpdate++;
      } else {
        tracksToAdd++;
      }

      // Check audio file availability
      const pathToCheck = bTrack.filePath || (bTrack.format as any)?.path;
      if (pathToCheck && !audioFilePathSet.has(pathToCheck.toLowerCase())) {
        tracksMissingFile++;
      }
    }

    // Playlist stats
    const playlistIdMap = new Map<string, Playlist>(existingPlaylists.map(p => [p.id, p]));
    const playlistNameMap = new Map<string, Playlist>(existingPlaylists.map(p => [p.name.toLowerCase(), p]));

    let playlistsToAdd = 0;
    let playlistsToMerge = 0;
    let smartPlaylistsCount = 0;

    for (const bPlaylist of data.playlists) {
      if (bPlaylist.isSmart) {
        smartPlaylistsCount++;
      }

      const existingById = playlistIdMap.get(bPlaylist.id);
      const existingByName = playlistNameMap.get(bPlaylist.name.toLowerCase());

      if (existingById || existingByName) {
        playlistsToMerge++;
      } else {
        playlistsToAdd++;
      }
    }

    // History stats
    const existingHistorySet = new Set<string>(existingHistory.map(h => `${h.trackId}_${h.playedAt}`));
    let historyToAdd = 0;

    for (const bHist of data.history) {
      if (!existingHistorySet.has(`${bHist.trackId}_${bHist.playedAt}`)) {
        historyToAdd++;
      }
    }

    // Favorites stats
    const favoritesToSync = data.favorites.length;

    if (tracksMissingFile > 0) {
      warnings.push(
        `${tracksMissingFile} track(s) in the backup reference audio files not currently scanned in your local library. They will be imported as metadata references.`
      );
    }

    return {
      createdAt: bundle.createdAt,
      version: bundle.version,
      appVersion: bundle.appVersion,
      totalTracksInBackup: data.tracks.length,
      totalPlaylistsInBackup: data.playlists.length,
      totalSmartPlaylistsInBackup: smartPlaylistsCount,
      totalHistoryInBackup: data.history.length,
      totalFavoritesInBackup: data.favorites.length,
      totalEqPresetsInBackup: data.eqPresets.length,

      tracksToAdd,
      tracksToUpdate,
      tracksExisting,
      tracksMissingFile,

      playlistsToAdd,
      playlistsToMerge,

      historyToAdd,
      favoritesToSync,

      warnings,
      errors
    };
  }

  /**
   * Executes the restore or merge operation transactionally into IndexedDB.
   */
  public static async executeImport(
    dbAdapter: IDatabaseAdapter,
    bundle: MyMusicBackupBundle,
    mode: ImportMode
  ): Promise<BackupImportResult> {
    const data = bundle.data;
    const warnings: string[] = [];
    const errors: string[] = [];

    let tracksImported = 0;
    let playlistsImported = 0;
    let historyImported = 0;
    let favoritesImported = 0;
    let settingsImported = false;

    try {
      if (mode === 'restore') {
        // RESTORE MODE: Wipe existing application stores cleanly
        await dbAdapter.clear(STORES.TRACKS);
        await dbAdapter.clear(STORES.PLAYLISTS);
        await dbAdapter.clear(STORES.PLAYLIST_ITEMS);
        await dbAdapter.clear(STORES.PLAYBACK_HISTORY);
        await dbAdapter.clear(STORES.QUEUE_ITEMS);

        // Batch put tracks
        const tracksToPut: Track[] = data.tracks.map(t => this.convertBackupTrackToEntity(t));
        await dbAdapter.putBatch(STORES.TRACKS, tracksToPut);
        tracksImported = tracksToPut.length;

        // Batch put playlists
        const playlistsToPut: Playlist[] = data.playlists.map(p => this.convertBackupPlaylistToEntity(p));
        await dbAdapter.putBatch(STORES.PLAYLISTS, playlistsToPut);
        playlistsImported = playlistsToPut.length;

        // Batch put playlist items
        const playlistItemsToPut: PlaylistItem[] = data.playlistItems.map(pi => ({
          id: pi.id,
          playlistId: pi.playlistId,
          trackId: pi.trackId,
          position: pi.position,
          addedAt: pi.addedAt
        }));
        await dbAdapter.putBatch(STORES.PLAYLIST_ITEMS, playlistItemsToPut);

        // Batch put history items
        const historyToPut: PlaybackHistoryItem[] = data.history.map(h => ({
          id: h.id,
          trackId: h.trackId,
          playedAt: h.playedAt,
          durationListenedMs: h.durationListenedMs,
          completed: h.completed
        }));
        await dbAdapter.putBatch(STORES.PLAYBACK_HISTORY, historyToPut);
        historyImported = historyToPut.length;

        // Restore settings if present
        if (data.settings && Object.keys(data.settings).length > 0) {
          for (const [key, val] of Object.entries(data.settings)) {
            await dbAdapter.put(STORES.SETTINGS, { key, value: val });
          }
          settingsImported = true;
        }

        // Restore favorites count
        favoritesImported = data.favorites.length;
      } else {
        // MERGE MODE: Non-destructive integration
        const existingTracks = await dbAdapter.getAll<Track>(STORES.TRACKS);
        const existingPlaylists = await dbAdapter.getAll<Playlist>(STORES.PLAYLISTS);
        const existingPlaylistItems = await dbAdapter.getAll<PlaylistItem>(STORES.PLAYLIST_ITEMS);
        const existingHistory = await dbAdapter.getAll<PlaybackHistoryItem>(STORES.PLAYBACK_HISTORY);

        const trackIdMap = new Map<string, Track>(existingTracks.map(t => [t.id, t]));
        const compositeTrackMap = new Map<string, Track>();
        existingTracks.forEach(t => {
          compositeTrackMap.set(this.getTrackCompositeKey(t.title, t.artistName, t.albumTitle), t);
        });

        // Track ID mapping for re-mapped IDs
        const trackIdRemap = new Map<string, string>();

        for (const bTrack of data.tracks) {
          const compKey = this.getTrackCompositeKey(bTrack.title, bTrack.artistName, bTrack.albumTitle);
          const existingById = trackIdMap.get(bTrack.id);
          const existingByComp = compositeTrackMap.get(compKey);

          if (existingById) {
            // Update stats
            const mergedTrack: Track = {
              ...existingById,
              playCount: Math.max(existingById.playCount || 0, bTrack.playCount || 0),
              lastPlayedAt: Math.max(existingById.lastPlayedAt || 0, bTrack.lastPlayedAt || 0),
              isFavorite: existingById.isFavorite || bTrack.isFavorite || false
            };
            await dbAdapter.put(STORES.TRACKS, mergedTrack);
            trackIdRemap.set(bTrack.id, existingById.id);
          } else if (existingByComp) {
            const mergedTrack: Track = {
              ...existingByComp,
              playCount: Math.max(existingByComp.playCount || 0, bTrack.playCount || 0),
              lastPlayedAt: Math.max(existingByComp.lastPlayedAt || 0, bTrack.lastPlayedAt || 0),
              isFavorite: existingByComp.isFavorite || bTrack.isFavorite || false
            };
            await dbAdapter.put(STORES.TRACKS, mergedTrack);
            trackIdRemap.set(bTrack.id, existingByComp.id);
          } else {
            // New track
            const newTrackEntity = this.convertBackupTrackToEntity(bTrack);
            await dbAdapter.put(STORES.TRACKS, newTrackEntity);
            trackIdMap.set(newTrackEntity.id, newTrackEntity);
            trackIdRemap.set(bTrack.id, newTrackEntity.id);
            tracksImported++;
          }

          if (bTrack.isFavorite) {
            favoritesImported++;
          }
        }

        // Merge Playlists
        const playlistIdMap = new Map<string, Playlist>(existingPlaylists.map(p => [p.id, p]));
        const playlistNameMap = new Map<string, Playlist>(existingPlaylists.map(p => [p.name.toLowerCase(), p]));
        const playlistIdRemap = new Map<string, string>();

        for (const bPlaylist of data.playlists) {
          const existingById = playlistIdMap.get(bPlaylist.id);
          const existingByName = playlistNameMap.get(bPlaylist.name.toLowerCase());

          if (existingById) {
            playlistIdRemap.set(bPlaylist.id, existingById.id);
          } else if (existingByName) {
            playlistIdRemap.set(bPlaylist.id, existingByName.id);
          } else {
            const newPlaylist = this.convertBackupPlaylistToEntity(bPlaylist);
            await dbAdapter.put(STORES.PLAYLISTS, newPlaylist);
            playlistIdMap.set(newPlaylist.id, newPlaylist);
            playlistIdRemap.set(bPlaylist.id, newPlaylist.id);
            playlistsImported++;
          }
        }

        // Merge Playlist Items
        const existingItemsSet = new Set<string>(
          existingPlaylistItems.map(pi => `${pi.playlistId}_${pi.trackId}`)
        );

        for (const bItem of data.playlistItems) {
          const targetPlaylistId = playlistIdRemap.get(bItem.playlistId) || bItem.playlistId;
          const targetTrackId = trackIdRemap.get(bItem.trackId) || bItem.trackId;

          const key = `${targetPlaylistId}_${targetTrackId}`;
          if (!existingItemsSet.has(key)) {
            const newItem: PlaylistItem = {
              id: bItem.id,
              playlistId: targetPlaylistId,
              trackId: targetTrackId,
              position: bItem.position,
              addedAt: bItem.addedAt
            };
            await dbAdapter.put(STORES.PLAYLIST_ITEMS, newItem);
            existingItemsSet.add(key);
          }
        }

        // Merge History
        const existingHistSet = new Set<string>(existingHistory.map(h => `${h.trackId}_${h.playedAt}`));
        for (const bHist of data.history) {
          const targetTrackId = trackIdRemap.get(bHist.trackId) || bHist.trackId;
          const key = `${targetTrackId}_${bHist.playedAt}`;
          if (!existingHistSet.has(key)) {
            const newHist: PlaybackHistoryItem = {
              id: bHist.id,
              trackId: targetTrackId,
              playedAt: bHist.playedAt,
              durationListenedMs: bHist.durationListenedMs,
              completed: bHist.completed
            };
            await dbAdapter.put(STORES.PLAYBACK_HISTORY, newHist);
            existingHistSet.add(key);
            historyImported++;
          }
        }
      }

      return {
        success: true,
        mode,
        tracksImported,
        playlistsImported,
        historyImported,
        favoritesImported,
        settingsImported,
        warnings,
        errors
      };
    } catch (err) {
      errors.push(`Database import failed: ${(err as Error).message}`);
      return {
        success: false,
        mode,
        tracksImported: 0,
        playlistsImported: 0,
        historyImported: 0,
        favoritesImported: 0,
        settingsImported: false,
        warnings,
        errors
      };
    }
  }

  private static convertBackupTrackToEntity(bTrack: BackupTrackRecord): Track {
    const rawContainer = bTrack.format?.container || 'mp3';
    const validContainers = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'webm', 'alac', 'aiff', 'wma', 'ape', 'unknown'];
    const container = validContainers.includes(rawContainer) ? (rawContainer as any) : 'mp3';

    const rawCodec = bTrack.format?.codec || 'mp3';
    const validCodecs = ['mp3', 'flac', 'pcm', 'vorbis', 'aac', 'opus', 'alac', 'unknown'];
    const codec = validCodecs.includes(rawCodec) ? (rawCodec as any) : 'mp3';

    const rawAvailability = bTrack.availability || 'available';
    const validAvail = ['available', 'missing', 'unsupported', 'corrupt'];
    const availability: AvailabilityState = validAvail.includes(rawAvailability) ? (rawAvailability as AvailabilityState) : 'available';

    return {
      id: bTrack.id,
      fileId: bTrack.fileId || `file_${bTrack.id}`,
      title: bTrack.title || 'Untitled Track',
      artistId: bTrack.artistId,
      artistName: bTrack.artistName || 'Unknown Artist',
      albumId: bTrack.albumId,
      albumTitle: bTrack.albumTitle || 'Unknown Album',
      albumArtistId: bTrack.albumArtistId,
      genreId: bTrack.genreId,
      genreName: bTrack.genreName,
      folderId: bTrack.folderId,
      durationMs: bTrack.durationMs || 0,
      trackNumber: bTrack.trackNumber,
      discNumber: bTrack.discNumber,
      year: bTrack.year,
      format: {
        container,
        codec,
        sampleRate: bTrack.format?.sampleRate || 44100,
        bitrate: bTrack.format?.bitrate,
        channels: bTrack.format?.channels || 2,
        isLossless: !!bTrack.format?.isLossless
      },
      replayGain: bTrack.replayGain,
      dateAdded: bTrack.dateAdded || Date.now(),
      dateModified: bTrack.dateModified || Date.now(),
      lastPlayedAt: bTrack.lastPlayedAt,
      playCount: bTrack.playCount || 0,
      isFavorite: !!bTrack.isFavorite,
      hasLyrics: !!bTrack.hasLyrics,
      availability
    };
  }

  private static convertBackupPlaylistToEntity(bPlaylist: BackupPlaylistRecord): Playlist {
    return {
      id: bPlaylist.id,
      name: bPlaylist.name || 'Untitled Playlist',
      description: bPlaylist.description,
      isSmart: !!bPlaylist.isSmart,
      smartRulesJson: bPlaylist.smartRulesJson,
      createdAt: bPlaylist.createdAt || Date.now(),
      updatedAt: bPlaylist.updatedAt || Date.now(),
      trackCount: bPlaylist.trackCount || 0,
      durationMs: bPlaylist.durationMs || 0
    };
  }

  private static getTrackCompositeKey(title: string, artist?: string, album?: string): string {
    return `${(title || '').toLowerCase().trim()}|${(artist || '').toLowerCase().trim()}|${(album || '').toLowerCase().trim()}`;
  }
}
