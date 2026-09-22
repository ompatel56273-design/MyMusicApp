/**
 * Database Schema Definitions & Migration System
 * Reconciled against Docs/11_DATA_DATABASE_SCHEMA.md
 */

export const DB_NAME = 'MusicPlayerDB';
export const CURRENT_SCHEMA_VERSION = 2;

export const STORES = {
  TRACKS: 'tracks',
  AUDIO_FILES: 'audio_files',
  ARTISTS: 'artists',
  TRACK_ARTISTS: 'track_artists',
  ALBUMS: 'albums',
  GENRES: 'genres',
  FOLDERS: 'folders',
  PLAYLISTS: 'playlists',
  PLAYLIST_ITEMS: 'playlist_items',
  PLAYBACK_HISTORY: 'playback_history',
  PLAYBACK_POSITIONS: 'playback_positions',
  QUEUE_ITEMS: 'queue_items',
  SETTINGS: 'settings',
  LYRICS: 'lyrics'
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

export interface Migration {
  version: number;
  up(db: IDBDatabase, transaction: IDBTransaction): void;
}

/**
 * Migration definitions for incremental schema updates
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up(db: IDBDatabase) {
      // 1. Tracks Store
      if (!db.objectStoreNames.contains(STORES.TRACKS)) {
        const trackStore = db.createObjectStore(STORES.TRACKS, { keyPath: 'id' });
        trackStore.createIndex('by_fileId', 'fileId', { unique: false });
        trackStore.createIndex('by_artistId', 'artistId', { unique: false });
        trackStore.createIndex('by_albumId', 'albumId', { unique: false });
        trackStore.createIndex('by_genreId', 'genreId', { unique: false });
        trackStore.createIndex('by_folderId', 'folderId', { unique: false });
        trackStore.createIndex('by_isFavorite', 'isFavorite', { unique: false });
        trackStore.createIndex('by_title', 'title', { unique: false });
        trackStore.createIndex('by_dateAdded', 'dateAdded', { unique: false });
        trackStore.createIndex('by_album_track', ['albumId', 'trackNumber'], { unique: false });
      }

      // 2. Audio Files Store (Physical source file)
      if (!db.objectStoreNames.contains(STORES.AUDIO_FILES)) {
        const fileStore = db.createObjectStore(STORES.AUDIO_FILES, { keyPath: 'id' });
        fileStore.createIndex('by_path', 'path', { unique: true });
        fileStore.createIndex('by_scanSessionId', 'scanSessionId', { unique: false });
        fileStore.createIndex('by_availability', 'availability', { unique: false });
      }

      // 3. Artists Store
      if (!db.objectStoreNames.contains(STORES.ARTISTS)) {
        const artistStore = db.createObjectStore(STORES.ARTISTS, { keyPath: 'id' });
        artistStore.createIndex('by_name', 'name', { unique: false });
        artistStore.createIndex('by_sortName', 'sortName', { unique: false });
      }

      // 4. Track Artists (Many-to-Many join table)
      if (!db.objectStoreNames.contains(STORES.TRACK_ARTISTS)) {
        const linkStore = db.createObjectStore(STORES.TRACK_ARTISTS, { keyPath: ['trackId', 'artistId'] });
        linkStore.createIndex('by_trackId', 'trackId', { unique: false });
        linkStore.createIndex('by_artistId', 'artistId', { unique: false });
      }

      // 5. Albums Store
      if (!db.objectStoreNames.contains(STORES.ALBUMS)) {
        const albumStore = db.createObjectStore(STORES.ALBUMS, { keyPath: 'id' });
        albumStore.createIndex('by_title', 'title', { unique: false });
        albumStore.createIndex('by_artistId', 'artistId', { unique: false });
        albumStore.createIndex('by_year', 'year', { unique: false });
      }

      // 6. Genres Store
      if (!db.objectStoreNames.contains(STORES.GENRES)) {
        const genreStore = db.createObjectStore(STORES.GENRES, { keyPath: 'id' });
        genreStore.createIndex('by_name', 'name', { unique: true });
      }

      // 7. Folders Store
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        const folderStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
        folderStore.createIndex('by_path', 'path', { unique: true });
        folderStore.createIndex('by_parentId', 'parentId', { unique: false });
      }

      // 8. Playlists Store
      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) {
        const playlistStore = db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
        playlistStore.createIndex('by_name', 'name', { unique: false });
        playlistStore.createIndex('by_isSmart', 'isSmart', { unique: false });
      }

      // 9. Playlist Items Store
      if (!db.objectStoreNames.contains(STORES.PLAYLIST_ITEMS)) {
        const playlistItemStore = db.createObjectStore(STORES.PLAYLIST_ITEMS, { keyPath: 'id' });
        playlistItemStore.createIndex('by_playlistId', 'playlistId', { unique: false });
        playlistItemStore.createIndex('by_trackId', 'trackId', { unique: false });
        playlistItemStore.createIndex('by_playlist_pos', ['playlistId', 'position'], { unique: false });
      }

      // 10. Playback History Store
      if (!db.objectStoreNames.contains(STORES.PLAYBACK_HISTORY)) {
        const historyStore = db.createObjectStore(STORES.PLAYBACK_HISTORY, { keyPath: 'id' });
        historyStore.createIndex('by_trackId', 'trackId', { unique: false });
        historyStore.createIndex('by_playedAt', 'playedAt', { unique: false });
      }

      // 11. Playback Positions (Resume bookmarks)
      if (!db.objectStoreNames.contains(STORES.PLAYBACK_POSITIONS)) {
        const posStore = db.createObjectStore(STORES.PLAYBACK_POSITIONS, { keyPath: 'trackId' });
        posStore.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      }

      // 12. Queue Items Store
      if (!db.objectStoreNames.contains(STORES.QUEUE_ITEMS)) {
        const queueStore = db.createObjectStore(STORES.QUEUE_ITEMS, { keyPath: 'id' });
        queueStore.createIndex('by_position', 'position', { unique: false });
      }

      // 13. Settings Store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    }
  },
  {
    version: 2,
    up(db: IDBDatabase) {
      // 14. Lyrics Store
      if (!db.objectStoreNames.contains(STORES.LYRICS)) {
        const lyricsStore = db.createObjectStore(STORES.LYRICS, { keyPath: 'id' });
        lyricsStore.createIndex('by_trackId', 'trackId', { unique: true });
      }
    }
  }
];
