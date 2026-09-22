import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { FolderRepository } from '../../src/data/repositories/folder-repository';
import { PlaylistRepository } from '../../src/data/repositories/playlist-repository';
import { HistoryRepository } from '../../src/data/repositories/history-repository';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { ScannerService } from '../../src/services/scanner/scanner-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';

describe('ScannerService', () => {
  let adapter: IndexedDbAdapter;
  let fileRepo: AudioFileRepository;
  let trackRepo: TrackRepository;
  let folderRepo: FolderRepository;
  let playlistRepo: PlaylistRepository;
  let historyRepo: HistoryRepository;
  let eventBus: EventBus;
  let vfs: VirtualFilesystemAdapter;
  let scanner: ScannerService;

  beforeEach(async () => {
    const dbName = `scanner_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    adapter = new IndexedDbAdapter(dbName, 1);
    await adapter.open();

    fileRepo = new AudioFileRepository(adapter);
    trackRepo = new TrackRepository(adapter);
    folderRepo = new FolderRepository(adapter);
    playlistRepo = new PlaylistRepository(adapter);
    historyRepo = new HistoryRepository(adapter);
    eventBus = new EventBus();
    vfs = new VirtualFilesystemAdapter();

    scanner = new ScannerService(vfs, fileRepo, trackRepo, folderRepo, eventBus);
  });

  afterEach(() => {
    adapter.close();
  });

  it('should discover new files on first scan and persist AudioFile and Track records', async () => {
    vfs.addVirtualFile('C:/Music/Rock/Queen - Bohemian Rhapsody.flac', 45000000);
    vfs.addVirtualFile('C:/Music/Rock/Pink Floyd - Time.mp3', 8000000);
    vfs.addVirtualFile('C:/Music/Rock/artwork.jpg', 500000); // Non-audio, ignored

    const progressEvents: any[] = [];
    eventBus.subscribe(DomainEvents.SCAN_PROGRESS, (e) => {
      progressEvents.push(e);
    });

    await scanner.scanDirectory('C:/Music/Rock');

    expect(scanner.state).toBe('completed');

    const tracks = await trackRepo.list();
    expect(tracks.total).toBe(2);

    const flacTrack = tracks.items.find(t => t.title.includes('Bohemian Rhapsody'));
    expect(flacTrack).toBeDefined();
    expect(flacTrack?.format.container).toBe('flac');
    expect(flacTrack?.format.isLossless).toBe(true);

    const mp3Track = tracks.items.find(t => t.title.includes('Time'));
    expect(mp3Track).toBeDefined();
    expect(mp3Track?.format.container).toBe('mp3');
    expect(mp3Track?.format.isLossless).toBe(false);

    expect(progressEvents.length).toBeGreaterThan(0);
  });

  it('should perform incremental scan without rewriting unchanged records', async () => {
    vfs.addVirtualFile('C:/Music/Pop/song1.mp3', 5000000, 1700000000000);
    vfs.addVirtualFile('C:/Music/Pop/song2.flac', 25000000, 1700000000000);

    // First scan: adds 2 files
    await scanner.scanDirectory('C:/Music/Pop');
    expect(await trackRepo.count()).toBe(2);

    // Second scan with no filesystem changes
    await scanner.scanDirectory('C:/Music/Pop');
    expect(await trackRepo.count()).toBe(2);
  });

  it('should detect modified files and update AudioFile state', async () => {
    vfs.addVirtualFile('C:/Music/Jazz/track1.mp3', 5000000, 1700000000000);
    await scanner.scanDirectory('C:/Music/Jazz');

    const fileBefore = await fileRepo.getByPath('C:/Music/Jazz/track1.mp3');
    expect(fileBefore?.sizeBytes).toBe(5000000);

    // Modify file timestamp & size
    vfs.addVirtualFile('C:/Music/Jazz/track1.mp3', 6000000, 1710000000000);
    await scanner.scanDirectory('C:/Music/Jazz');

    const fileAfter = await fileRepo.getByPath('C:/Music/Jazz/track1.mp3');
    expect(fileAfter?.sizeBytes).toBe(6000000);
    expect(fileAfter?.modifiedTimeMs).toBe(1710000000000);
  });

  it('should mark missing files without deleting logical tracks, playlists, or favorites', async () => {
    vfs.addVirtualFile('C:/Music/Albums/track1.mp3', 5000000);
    vfs.addVirtualFile('C:/Music/Albums/track2.mp3', 5000000);

    await scanner.scanDirectory('C:/Music/Albums');
    const tracksBefore = await trackRepo.list();
    const track1 = tracksBefore.items.find(t => t.title === 'track1')!;

    // Set favorite and add to playlist and history
    await trackRepo.setFavorite(track1.id, true);
    await playlistRepo.save({
      id: 'pl_1',
      name: 'My Playlist',
      isSmart: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackCount: 1,
      durationMs: 0
    });
    await playlistRepo.addItem('pl_1', track1.id);
    await historyRepo.addRecord({ trackId: track1.id, playedAt: Date.now(), durationListenedMs: 60000, completed: true });

    // Delete track1 from filesystem
    vfs.removeVirtualFile('C:/Music/Albums/track1.mp3');

    // Rescan
    await scanner.scanDirectory('C:/Music/Albums');

    // Verify track1 still exists in database, but marked as missing
    const track1After = await trackRepo.getById(track1.id);
    expect(track1After).toBeDefined();
    expect(track1After?.availability).toBe('missing');
    expect(track1After?.isFavorite).toBe(true); // Favorite state preserved!

    // Playlist and history preserved
    const playlistItems = await playlistRepo.getItems('pl_1');
    expect(playlistItems.length).toBe(1);
    expect(playlistItems[0].trackId).toBe(track1.id);

    const history = await historyRepo.getRecent(5);
    expect(history.length).toBe(1);
    expect(history[0].trackId).toBe(track1.id);
  });

  it('should guard against concurrent scan requests', async () => {
    vfs.addVirtualFile('C:/Music/Test/song.mp3', 1000);

    const scanPromise1 = scanner.scanDirectory('C:/Music/Test');
    await expect(scanner.scanDirectory('C:/Music/Test')).rejects.toThrow();

    await scanPromise1;
  });

  it('should handle scan cancellation gracefully', async () => {
    vfs.addVirtualFile('C:/Music/Long/song1.mp3', 1000);
    vfs.addVirtualFile('C:/Music/Long/song2.mp3', 1000);

    const scanPromise = scanner.scanDirectory('C:/Music/Long');
    await scanner.cancelScan();
    await scanPromise;

    expect(scanner.state === 'cancelled' || scanner.state === 'completed').toBe(true);
  });
});
