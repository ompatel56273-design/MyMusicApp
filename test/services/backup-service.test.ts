import { describe, it, expect, beforeEach } from 'vitest';
import { BackupService } from '../../src/services/backup/backup-service';
import { BackupValidator } from '../../src/services/backup/backup-validator';
import { M3uService } from '../../src/services/backup/m3u-service';
import { STORES, type StoreName } from '../../src/data/db/schema';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import { EventBus } from '../../src/core/events/event-bus';
import type { Track, Playlist, AudioFile } from '../../src/domain/entities/models';

class MockDbAdapter implements IDatabaseAdapter {
  private stores = new Map<string, Map<any, any>>();

  constructor() {
    Object.values(STORES).forEach(store => {
      this.stores.set(store, new Map());
    });
  }

  public open(): Promise<void> { return Promise.resolve(); }
  public close(): void {}
  public isOpen(): boolean { return true; }

  public async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    const store = this.stores.get(storeName);
    return (store?.get(key) as T) || null;
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    const store = this.stores.get(storeName);
    return Array.from(store?.values() || []);
  }

  public async getByIndex<T>(storeName: StoreName, _indexName: string, _key: IDBValidKey): Promise<T | null> {
    return this.get<T>(storeName, _key);
  }

  public async getAllByIndex<T>(storeName: StoreName, _indexName: string, query?: IDBValidKey): Promise<T[]> {
    const all = await this.getAll<T>(storeName);
    if (query !== undefined) {
      return all.filter((item: any) => item.playlistId === query || item.trackId === query);
    }
    return all;
  }

  public async put<T>(storeName: StoreName, value: T): Promise<void> {
    const store = this.stores.get(storeName);
    if (!store) return;
    const key = (value as any).id || (value as any).key || (value as any).trackId;
    store.set(key, value);
  }

  public async putBatch<T>(storeName: StoreName, values: readonly T[]): Promise<void> {
    for (const val of values) {
      await this.put(storeName, val);
    }
  }

  public async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    const store = this.stores.get(storeName);
    store?.delete(key);
  }

  public async clear(storeName: StoreName): Promise<void> {
    const store = this.stores.get(storeName);
    store?.clear();
  }

  public async count(storeName: StoreName): Promise<number> {
    const store = this.stores.get(storeName);
    return store?.size || 0;
  }

  public async transaction<T>(
    _storeNames: StoreName[],
    _mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    return callback({} as IDBTransaction);
  }
}

describe('F27 — Local Backup, Snapshot & Migration Engine', () => {
  let dbAdapter: MockDbAdapter;
  let eventBus: EventBus;
  let backupService: BackupService;

  beforeEach(() => {
    dbAdapter = new MockDbAdapter();
    eventBus = new EventBus();
    backupService = new BackupService(dbAdapter, eventBus);
  });

  describe('1. Backup Schema & Validator', () => {
    it('validates a correct .mymusic bundle successfully', () => {
      const validBundle = {
        format: 'mymusic',
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        data: {
          tracks: [
            {
              id: 'tr_1',
              fileId: 'file_1',
              title: 'Cosmic Horizons',
              artistName: 'Starlight Symphony',
              albumTitle: 'Deep Space',
              durationMs: 240000,
              format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, bitrate: 320, channels: 2, isLossless: false },
              dateAdded: 1700000000000,
              dateModified: 1700000000000,
              playCount: 12,
              isFavorite: true,
              hasLyrics: false
            }
          ],
          playlists: [
            {
              id: 'pl_1',
              name: 'Chill Waves',
              isSmart: false,
              createdAt: 1700000000000,
              updatedAt: 1700000000000,
              trackCount: 1,
              durationMs: 240000
            }
          ],
          playlistItems: [
            { id: 'pi_1', playlistId: 'pl_1', trackId: 'tr_1', position: 0, addedAt: 1700000000000 }
          ],
          history: [
            { id: 'h_1', trackId: 'tr_1', playedAt: 1700000000000, durationListenedMs: 240000, completed: true }
          ],
          favorites: ['tr_1'],
          settings: { theme: 'dark' },
          eqPresets: []
        }
      };

      const result = BackupValidator.validate(validBundle);
      expect(result.isValid).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.bundle).toBeDefined();
    });

    it('rejects backup files with invalid format identifier', () => {
      const invalidBundle = {
        format: 'unknown_format',
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        data: { tracks: [], playlists: [], playlistItems: [], history: [], favorites: [], settings: {}, eqPresets: [] }
      };

      const result = BackupValidator.validate(invalidBundle);
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Invalid format identifier'))).toBe(true);
    });

    it('rejects backup files with unsupported future versions', () => {
      const futureBundle = {
        format: 'mymusic',
        version: 99,
        createdAt: Date.now(),
        appVersion: '2.0.0',
        data: { tracks: [], playlists: [], playlistItems: [], history: [], favorites: [], settings: {}, eqPresets: [] }
      };

      const result = BackupValidator.validate(futureBundle);
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Unsupported backup version'))).toBe(true);
    });

    it('flags duplicate track IDs as validation errors', () => {
      const dupeBundle = {
        format: 'mymusic',
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        data: {
          tracks: [
            { id: 'tr_dup', fileId: 'f1', title: 'Song A', durationMs: 100 },
            { id: 'tr_dup', fileId: 'f2', title: 'Song B', durationMs: 200 }
          ],
          playlists: [],
          playlistItems: [],
          history: [],
          favorites: [],
          settings: {},
          eqPresets: []
        }
      };

      const result = BackupValidator.validate(dupeBundle);
      expect(result.isValid).toBe(false);
      expect(result.issues.some(i => i.message.includes('Duplicate track ID'))).toBe(true);
    });
  });

  describe('2. Empty Library Export & Snapshot Generation', () => {
    it('exports an empty library into a valid backup snapshot', async () => {
      const bundle = await backupService.createBackupBundle();

      expect(bundle.format).toBe('mymusic');
      expect(bundle.version).toBe(1);
      expect(bundle.createdAt).toBeGreaterThan(0);
      expect(bundle.data.tracks).toEqual([]);
      expect(bundle.data.playlists).toEqual([]);
      expect(bundle.data.history).toEqual([]);
      expect(bundle.data.favorites).toEqual([]);
    });

    it('exports a populated library with all domain entities and settings', async () => {
      const track: Track = {
        id: 't1',
        fileId: 'f1',
        title: 'Nebula Resonance',
        artistName: 'Cosmic Voyager',
        albumTitle: 'Starlight',
        durationMs: 300000,
        format: { container: 'flac', codec: 'flac', sampleRate: 96000, bitrate: 1411, channels: 2, isLossless: true },
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 42,
        isFavorite: true,
        hasLyrics: false,
        availability: 'available'
      };

      const playlist: Playlist = {
        id: 'p1',
        name: 'Space Ambient',
        isSmart: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        trackCount: 1,
        durationMs: 300000
      };

      await dbAdapter.put(STORES.TRACKS, track);
      await dbAdapter.put(STORES.PLAYLISTS, playlist);
      await dbAdapter.put(STORES.SETTINGS, { key: 'theme', value: 'dark' });

      const bundle = await backupService.createBackupBundle();

      expect(bundle.data.tracks.length).toBe(1);
      expect(bundle.data.tracks[0].title).toBe('Nebula Resonance');
      expect(bundle.data.playlists.length).toBe(1);
      expect(bundle.data.playlists[0].name).toBe('Space Ambient');
      expect(bundle.data.favorites).toContain('t1');
      expect(bundle.data.settings.theme).toBe('dark');
    });
  });

  describe('3. Restore Mode vs Merge Mode', () => {
    const existingTrack: Track = {
      id: 'existing_t1',
      fileId: 'f1',
      title: 'Existing Track',
      artistName: 'Artist A',
      albumTitle: 'Album A',
      durationMs: 180000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, bitrate: 320, channels: 2, isLossless: false },
      dateAdded: 1000000,
      dateModified: 1000000,
      playCount: 5,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    };

    const existingPlaylist: Playlist = {
      id: 'existing_p1',
      name: 'Old Playlist',
      isSmart: false,
      createdAt: 1000000,
      updatedAt: 1000000,
      trackCount: 1,
      durationMs: 180000
    };

    beforeEach(async () => {
      await dbAdapter.put(STORES.TRACKS, existingTrack);
      await dbAdapter.put(STORES.PLAYLISTS, existingPlaylist);
    });

    it('RESTORE MODE: wipes current library and imports backup snapshot state', async () => {
      const backupJson = JSON.stringify({
        format: 'mymusic',
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        data: {
          tracks: [
            {
              id: 'restored_t1',
              fileId: 'rf1',
              title: 'Restored Song',
              artistName: 'Restored Artist',
              durationMs: 200000,
              format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, bitrate: 320, channels: 2, isLossless: false },
              dateAdded: Date.now(),
              dateModified: Date.now(),
              playCount: 100,
              isFavorite: true,
              hasLyrics: false
            }
          ],
          playlists: [
            { id: 'restored_p1', name: 'Restored Playlist', isSmart: false, createdAt: Date.now(), updatedAt: Date.now(), trackCount: 1, durationMs: 200000 }
          ],
          playlistItems: [{ id: 'rpi_1', playlistId: 'restored_p1', trackId: 'restored_t1', position: 0, addedAt: Date.now() }],
          history: [],
          favorites: ['restored_t1'],
          settings: { theme: 'light' },
          eqPresets: []
        }
      });

      const result = await backupService.importBackup(backupJson, { mode: 'restore' });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('restore');
      expect(result.tracksImported).toBe(1);

      const dbTracks = await dbAdapter.getAll<Track>(STORES.TRACKS);
      expect(dbTracks.length).toBe(1);
      expect(dbTracks[0].id).toBe('restored_t1');

      const dbPlaylists = await dbAdapter.getAll<Playlist>(STORES.PLAYLISTS);
      expect(dbPlaylists.length).toBe(1);
      expect(dbPlaylists[0].name).toBe('Restored Playlist');
    });

    it('MERGE MODE: safely integrates non-overlapping records without overwriting current data', async () => {
      const backupJson = JSON.stringify({
        format: 'mymusic',
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        data: {
          tracks: [
            {
              id: 'new_merged_t1',
              fileId: 'nf1',
              title: 'New Merged Track',
              artistName: 'Artist B',
              albumTitle: 'Album B',
              durationMs: 220000,
              format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, bitrate: 320, channels: 2, isLossless: false },
              dateAdded: Date.now(),
              dateModified: Date.now(),
              playCount: 15,
              isFavorite: true,
              hasLyrics: false
            }
          ],
          playlists: [
            { id: 'new_merged_p1', name: 'New Merged Playlist', isSmart: false, createdAt: Date.now(), updatedAt: Date.now(), trackCount: 1, durationMs: 220000 }
          ],
          playlistItems: [],
          history: [],
          favorites: ['new_merged_t1'],
          settings: {},
          eqPresets: []
        }
      });

      const result = await backupService.importBackup(backupJson, { mode: 'merge' });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('merge');

      const dbTracks = await dbAdapter.getAll<Track>(STORES.TRACKS);
      expect(dbTracks.length).toBe(2);

      const trackTitles = dbTracks.map(t => t.title);
      expect(trackTitles).toContain('Existing Track');
      expect(trackTitles).toContain('New Merged Track');

      const dbPlaylists = await dbAdapter.getAll<Playlist>(STORES.PLAYLISTS);
      expect(dbPlaylists.length).toBe(2);
    });

    it('MERGE MODE: updates play counts and favorites when matching tracks exist by title and artist', async () => {
      const backupJson = JSON.stringify({
        format: 'mymusic',
        version: 1,
        createdAt: Date.now(),
        appVersion: '1.0.0',
        data: {
          tracks: [
            {
              id: 'import_matching_id',
              fileId: 'f1',
              title: 'Existing Track',
              artistName: 'Artist A',
              albumTitle: 'Album A',
              durationMs: 180000,
              format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, bitrate: 320, channels: 2, isLossless: false },
              dateAdded: 1000000,
              dateModified: 1000000,
              playCount: 99,
              isFavorite: true,
              hasLyrics: false
            }
          ],
          playlists: [],
          playlistItems: [],
          history: [],
          favorites: ['import_matching_id'],
          settings: {},
          eqPresets: []
        }
      });

      await backupService.importBackup(backupJson, { mode: 'merge' });

      const dbTrack = await dbAdapter.get<Track>(STORES.TRACKS, 'existing_t1');
      expect(dbTrack).toBeDefined();
      expect(dbTrack?.playCount).toBe(99);
      expect(dbTrack?.isFavorite).toBe(true);
    });
  });

  describe('4. M3U / M3U8 Playlist Support', () => {
    it('generates standard M3U8 string from tracks', () => {
      const track: Track = {
        id: 't_m3u',
        fileId: 'f_m3u',
        title: 'Solar Flare',
        artistName: 'Sun Orchestra',
        durationMs: 184000,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, bitrate: 320, channels: 2, isLossless: false },
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 1,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      };

      const m3uStr = M3uService.generateM3u8('My Workout Mix', [
        { track, path: 'C:/Music/solar_flare.mp3' }
      ]);

      expect(m3uStr).toContain('#EXTM3U');
      expect(m3uStr).toContain('#PLAYLIST:My Workout Mix');
      expect(m3uStr).toContain('#EXTINF:184,Sun Orchestra - Solar Flare');
      expect(m3uStr).toContain('C:/Music/solar_flare.mp3');
    });

    it('parses valid M3U file content into structured entries', () => {
      const m3uContent = `
#EXTM3U
#PLAYLIST:Atmospheric Chill
#EXTINF:210,Lunar Drift - Orbit 9
/music/lunar_drift.flac
#EXTINF:195,Starlight - Galaxy Wave
/music/galaxy_wave.mp3
      `;

      const result = M3uService.parseM3u(m3uContent);

      expect(result.title).toBe('Atmospheric Chill');
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].title).toBe('Orbit 9');
      expect(result.entries[0].artist).toBe('Lunar Drift');
      expect(result.entries[0].durationSec).toBe(210);
      expect(result.entries[0].path).toBe('/music/lunar_drift.flac');
    });

    it('imports M3U file and matches tracks against existing library', async () => {
      const track: Track = {
        id: 'tr_m3u_matched',
        fileId: 'af_m3u_matched',
        title: 'Orbit 9',
        artistName: 'Lunar Drift',
        durationMs: 210000,
        format: { container: 'flac', codec: 'flac', sampleRate: 44100, bitrate: 1411, channels: 2, isLossless: true },
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 3,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      };
      const audioFile: AudioFile = {
        id: 'af_m3u_matched',
        path: '/music/lunar_drift.flac',
        filename: 'lunar_drift.flac',
        extension: 'flac',
        sizeBytes: 15000000,
        modifiedTimeMs: Date.now(),
        availability: 'available'
      };

      await dbAdapter.put(STORES.TRACKS, track);
      await dbAdapter.put(STORES.AUDIO_FILES, audioFile);

      const m3uFile = new File(
        [
          `#EXTM3U
#PLAYLIST:Space Chill
#EXTINF:210,Lunar Drift - Orbit 9
/music/lunar_drift.flac`
        ],
        'space_chill.m3u8',
        { type: 'text/plain' }
      );

      const result = await backupService.importPlaylistM3u(m3uFile);

      expect(result.playlist.name).toBe('Space Chill');
      expect(result.tracksMatched).toBe(1);
      expect(result.totalEntries).toBe(1);

      const savedPlaylist = await dbAdapter.get<Playlist>(STORES.PLAYLISTS, result.playlist.id);
      expect(savedPlaylist).toBeDefined();
    });
  });

  describe('5. Import Preview Metrics', () => {
    it('calculates preview stats accurately before modification', async () => {
      const bundleJson = JSON.stringify({
        format: 'mymusic',
        version: 1,
        createdAt: 1759140460000,
        appVersion: '1.0.0',
        data: {
          tracks: [
            {
              id: 'prev_tr1',
              fileId: 'f1',
              title: 'Preview Song 1',
              durationMs: 120000,
              filePath: '/non_existent/song1.mp3'
            }
          ],
          playlists: [
            { id: 'prev_pl1', name: 'Preview Playlist', isSmart: false, createdAt: 1759140460000, updatedAt: 1759140460000, trackCount: 1, durationMs: 120000 }
          ],
          playlistItems: [],
          history: [],
          favorites: ['prev_tr1'],
          settings: {},
          eqPresets: []
        }
      });

      const { validation, preview } = await backupService.getImportPreview(bundleJson);

      expect(validation.isValid).toBe(true);
      expect(preview).toBeDefined();
      expect(preview?.totalTracksInBackup).toBe(1);
      expect(preview?.totalPlaylistsInBackup).toBe(1);
      expect(preview?.tracksMissingFile).toBe(1);
      expect(preview?.warnings.length).toBeGreaterThan(0);
    });
  });
});
