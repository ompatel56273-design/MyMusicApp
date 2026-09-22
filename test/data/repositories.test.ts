import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { ArtistRepository } from '../../src/data/repositories/artist-repository';
import { AlbumRepository } from '../../src/data/repositories/album-repository';
import { GenreRepository } from '../../src/data/repositories/genre-repository';
import { FolderRepository } from '../../src/data/repositories/folder-repository';
import { PlaylistRepository } from '../../src/data/repositories/playlist-repository';
import { HistoryRepository } from '../../src/data/repositories/history-repository';
import { QueueRepository } from '../../src/data/repositories/queue-repository';
import type { Track, AudioFile, Artist, Album, Genre, Folder, QueueItem, Playlist } from '../../src/domain/entities/models';

describe('Concrete Repositories', () => {
  let adapter: IndexedDbAdapter;
  let trackRepo: TrackRepository;
  let fileRepo: AudioFileRepository;
  let artistRepo: ArtistRepository;
  let albumRepo: AlbumRepository;
  let genreRepo: GenreRepository;
  let folderRepo: FolderRepository;
  let playlistRepo: PlaylistRepository;
  let historyRepo: HistoryRepository;
  let queueRepo: QueueRepository;
  let currentDbName: string;

  beforeEach(async () => {
    currentDbName = `repo_test_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    adapter = new IndexedDbAdapter(currentDbName, 1);
    await adapter.open();
    trackRepo = new TrackRepository(adapter);
    fileRepo = new AudioFileRepository(adapter);
    artistRepo = new ArtistRepository(adapter);
    albumRepo = new AlbumRepository(adapter);
    genreRepo = new GenreRepository(adapter);
    folderRepo = new FolderRepository(adapter);
    playlistRepo = new PlaylistRepository(adapter);
    historyRepo = new HistoryRepository(adapter);
    queueRepo = new QueueRepository(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it('should maintain Track vs AudioFile separation with cross-reference', async () => {
    const file: AudioFile = {
      id: 'file_flac_1',
      path: '/music/classic/symphony.flac',
      filename: 'symphony.flac',
      extension: 'flac',
      sizeBytes: 45000000,
      modifiedTimeMs: 1600000000000,
      availability: 'available'
    };
    await fileRepo.save(file);

    const track: Track = {
      id: 'track_sym_1',
      fileId: file.id,
      title: 'Symphony No. 5',
      artistName: 'Beethoven',
      durationMs: 420000,
      format: { container: 'flac', codec: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2, isLossless: true },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    };
    await trackRepo.save(track);

    const fetchedTrack = await trackRepo.getByFileId(file.id);
    expect(fetchedTrack).toBeDefined();
    expect(fetchedTrack?.title).toBe('Symphony No. 5');

    const fetchedFile = await fileRepo.getByPath('/music/classic/symphony.flac');
    expect(fetchedFile?.sizeBytes).toBe(45000000);
  });

  it('should paginate and filter tracks accurately', async () => {
    const tracks: Track[] = [];
    for (let i = 1; i <= 15; i++) {
      tracks.push({
        id: `t_${i}`,
        fileId: `f_${i}`,
        title: `Song ${i.toString().padStart(2, '0')}`,
        durationMs: 180000,
        format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: Date.now() + i,
        dateModified: Date.now(),
        playCount: 0,
        isFavorite: i % 2 === 0, // Even songs are favorite
        hasLyrics: false,
        availability: 'available'
      });
    }

    await trackRepo.saveBatch(tracks);

    // Page 1: 10 items
    const page1 = await trackRepo.list({ offset: 0, limit: 10 });
    expect(page1.total).toBe(15);
    expect(page1.items.length).toBe(10);

    // Page 2: 5 items
    const page2 = await trackRepo.list({ offset: 10, limit: 10 });
    expect(page2.items.length).toBe(5);

    // Favorites only filter
    const favs = await trackRepo.list(undefined, { isFavorite: true });
    expect(favs.total).toBe(7); // 2, 4, 6, 8, 10, 12, 14
  });

  it('should support album, genre, folder, history, and queue CRUD operations', async () => {
    // Album
    const album: Album = {
      id: 'alb_abbey',
      title: 'Abbey Road',
      artistId: 'art_beatles',
      year: 1969,
      trackCount: 17,
      durationMs: 2800000,
      isCompilation: false,
      dateAdded: Date.now()
    };
    await albumRepo.save(album);
    const fetchedAlbum = await albumRepo.getById('alb_abbey');
    expect(fetchedAlbum?.title).toBe('Abbey Road');

    // Genre
    const genre: Genre = { id: 'gen_prog', name: 'Progressive Rock', trackCount: 42 };
    await genreRepo.save(genre);
    const fetchedGenre = await genreRepo.getByName('Progressive Rock');
    expect(fetchedGenre?.id).toBe('gen_prog');

    // Folder
    const folder: Folder = { id: 'fol_root', path: '/music', name: 'music', isMonitored: true, trackCount: 100 };
    await folderRepo.save(folder);
    const fetchedFolder = await folderRepo.getByPath('/music');
    expect(fetchedFolder?.name).toBe('music');

    // History
    await historyRepo.addRecord({ trackId: 't_1', playedAt: Date.now(), durationListenedMs: 180000, completed: true });
    const recent = await historyRepo.getRecent(10);
    expect(recent.length).toBe(1);

    // Queue
    const queueItems: QueueItem[] = [{ id: 'q_1', trackId: 't_1', position: 0 }];
    await queueRepo.saveQueue(queueItems);
    const fetchedQueue = await queueRepo.getQueue();
    expect(fetchedQueue.length).toBe(1);
  });

  it('should support playlist operations and cascade delete items on playlist deletion', async () => {
    const playlist: Playlist = {
      id: 'pl_rock',
      name: 'Rock Classics',
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: 2,
      durationMs: 400000
    };
    await playlistRepo.save(playlist);

    await playlistRepo.addItem('pl_rock', 'track_1', 0);
    await playlistRepo.addItem('pl_rock', 'track_2', 1);

    const items = await playlistRepo.getItems('pl_rock');
    expect(items.length).toBe(2);
    expect(items[0].trackId).toBe('track_1');
    expect(items[1].trackId).toBe('track_2');

    // Delete playlist and verify items cascade delete
    await playlistRepo.delete('pl_rock');
    const itemsAfter = await playlistRepo.getItems('pl_rock');
    expect(itemsAfter.length).toBe(0);
  });

  it('should persist data across database close and reopen', async () => {
    const artist: Artist = {
      id: 'art_queen',
      name: 'Queen',
      trackCount: 50,
      albumCount: 15
    };
    await artistRepo.save(artist);

    // Close database connection
    adapter.close();

    // Reopen same database name
    const reopenedAdapter = new IndexedDbAdapter(currentDbName, 1);
    await reopenedAdapter.open();
    const reopenedArtistRepo = new ArtistRepository(reopenedAdapter);

    const fetched = await reopenedArtistRepo.getById('art_queen');
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Queen');

    reopenedAdapter.close();
  });
});
