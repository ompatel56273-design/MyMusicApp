import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { FolderRepository } from '../../src/data/repositories/folder-repository';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { ScannerService } from '../../src/services/scanner/scanner-service';
import { EventBus } from '../../src/core/events/event-bus';

describe('ScannerService File Import', () => {
  let adapter: IndexedDbAdapter;
  let fileRepo: AudioFileRepository;
  let trackRepo: TrackRepository;
  let folderRepo: FolderRepository;
  let vfs: VirtualFilesystemAdapter;
  let eventBus: EventBus;
  let scanner: ScannerService;

  beforeEach(async () => {
    const dbName = `scanner_import_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    adapter = new IndexedDbAdapter(dbName, 1);
    await adapter.open();

    fileRepo = new AudioFileRepository(adapter);
    trackRepo = new TrackRepository(adapter);
    folderRepo = new FolderRepository(adapter);
    vfs = new VirtualFilesystemAdapter();
    eventBus = new EventBus();
    scanner = new ScannerService(vfs, fileRepo, trackRepo, folderRepo, eventBus);
  });

  afterEach(() => {
    adapter.close();
  });

  it('imports valid audio files and skips unsupported non-audio files', async () => {
    const file1 = new File(['mock mp3 content'], 'song_one.mp3', { type: 'audio/mpeg', lastModified: 1000 });
    const file2 = new File(['mock flac content'], 'song_two.flac', { type: 'audio/flac', lastModified: 2000 });
    const nonAudio = new File(['fake doc'], 'notes.txt', { type: 'text/plain', lastModified: 3000 });

    const result = await scanner.importFiles([file1, file2, nonAudio]);

    expect(result.filesAdded).toBe(2);
    expect(result.filesSkipped).toBe(1);

    const count = await trackRepo.count();
    expect(count).toBe(2);

    const tracks = await trackRepo.list();
    const titles = tracks.items.map(t => t.title);
    expect(titles).toContain('song_one');
    expect(titles).toContain('song_two');
  });

  it('prevents duplicate tracks on re-importing the same files', async () => {
    const file1 = new File(['mock mp3 content'], 'song_one.mp3', { type: 'audio/mpeg', lastModified: 1000 });

    const result1 = await scanner.importFiles([file1]);
    expect(result1.filesAdded).toBe(1);

    const result2 = await scanner.importFiles([file1]);
    expect(result2.filesAdded).toBe(0);
    expect(result2.filesSkipped).toBe(1);

    const count = await trackRepo.count();
    expect(count).toBe(1);
  });
});
