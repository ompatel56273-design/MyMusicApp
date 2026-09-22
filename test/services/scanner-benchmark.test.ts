import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { FolderRepository } from '../../src/data/repositories/folder-repository';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { ScannerService } from '../../src/services/scanner/scanner-service';
import { EventBus } from '../../src/core/events/event-bus';

describe('Scanner Large-Library Benchmark', () => {
  let adapter: IndexedDbAdapter;
  let fileRepo: AudioFileRepository;
  let trackRepo: TrackRepository;
  let folderRepo: FolderRepository;
  let eventBus: EventBus;
  let vfs: VirtualFilesystemAdapter;
  let scanner: ScannerService;

  beforeEach(async () => {
    const dbName = `scanner_bench_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    adapter = new IndexedDbAdapter(dbName, 1);
    await adapter.open();

    fileRepo = new AudioFileRepository(adapter);
    trackRepo = new TrackRepository(adapter);
    folderRepo = new FolderRepository(adapter);
    eventBus = new EventBus();
    vfs = new VirtualFilesystemAdapter();

    scanner = new ScannerService(vfs, fileRepo, trackRepo, folderRepo, eventBus);
  });

  afterEach(() => {
    adapter.close();
  });

  it('should benchmark initial scan vs incremental unchanged scan on 2,500 files', async () => {
    const totalFiles = 2500;
    const baseDir = 'C:/Music/BigLibrary';

    for (let i = 1; i <= totalFiles; i++) {
      const folderNum = Math.floor(i / 100);
      const ext = i % 2 === 0 ? 'flac' : 'mp3';
      vfs.addVirtualFile(`${baseDir}/Artist_${folderNum}/Album_${folderNum}/Track_${i}.${ext}`, 10000000 + i, 1700000000000);
    }

    // Benchmark 1: Initial Scan (discovery + indexing)
    const initialStart = performance.now();
    await scanner.scanDirectory(baseDir);
    const initialDurationMs = performance.now() - initialStart;

    const countAfterFirst = await trackRepo.count();
    expect(countAfterFirst).toBe(totalFiles);

    // Benchmark 2: Incremental Scan (all 2,500 files unchanged)
    const incrementalStart = performance.now();
    await scanner.scanDirectory(baseDir);
    const incrementalDurationMs = performance.now() - incrementalStart;

    const countAfterSecond = await trackRepo.count();
    expect(countAfterSecond).toBe(totalFiles);

    // Benchmark 3: Incremental Scan with 50 modified files and 50 missing files
    for (let i = 1; i <= 50; i++) {
      // Modify
      const ext = i % 2 === 0 ? 'flac' : 'mp3';
      vfs.addVirtualFile(`${baseDir}/Artist_0/Album_0/Track_${i}.${ext}`, 12000000, 1710000000000);
      // Remove
      const delExt = (totalFiles - i + 1) % 2 === 0 ? 'flac' : 'mp3';
      vfs.removeVirtualFile(`${baseDir}/Artist_${Math.floor((totalFiles - i + 1) / 100)}/Album_${Math.floor((totalFiles - i + 1) / 100)}/Track_${totalFiles - i + 1}.${delExt}`);
    }

    const diffStart = performance.now();
    await scanner.scanDirectory(baseDir);
    const diffDurationMs = performance.now() - diffStart;

    console.info(`[Scanner Large-Library Benchmark Results]
      Initial Scan (2,500 files): ${initialDurationMs.toFixed(2)}ms (${(initialDurationMs / totalFiles).toFixed(3)}ms/file)
      Incremental Unchanged Scan: ${incrementalDurationMs.toFixed(2)}ms (High-speed bypass)
      Incremental Diff Scan (50 changed, 50 missing): ${diffDurationMs.toFixed(2)}ms
    `);

    expect(initialDurationMs).toBeLessThan(10000); // under 10s for 2.5k files
    expect(incrementalDurationMs).toBeLessThan(initialDurationMs); // Unchanged scan is faster than initial scan
  }, 15000);
});
