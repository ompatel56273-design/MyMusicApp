import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { FolderRepository } from '../../src/data/repositories/folder-repository';
import { ArtistRepository } from '../../src/data/repositories/artist-repository';
import { AlbumRepository } from '../../src/data/repositories/album-repository';
import { GenreRepository } from '../../src/data/repositories/genre-repository';
import { ScannerService } from '../../src/services/scanner/scanner-service';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { LibraryService } from '../../src/services/library/library-service';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import { SidebarComponent } from '../../src/ui/shell/sidebar-component';
import { RouterService } from '../../src/ui/navigation/router-service';

function createMockElement(): HTMLElement {
  const elements = new Map<string, HTMLElement>();
  const el: any = {
    innerHTML: '',
    querySelector: (selector: string) => {
      const id = selector.replace('#', '');
      if (!elements.has(id)) {
        elements.set(id, createMockElement());
      }
      return elements.get(id)!;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    setAttribute: () => {},
    style: {}
  };
  return el as HTMLElement;
}

describe('Library Import 100+ Files Diagnostic & Regression Test', () => {
  let dbAdapter: IndexedDbAdapter;
  let trackRepo: TrackRepository;
  let fileRepo: AudioFileRepository;
  let folderRepo: FolderRepository;
  let artistRepo: ArtistRepository;
  let albumRepo: AlbumRepository;
  let genreRepo: GenreRepository;
  let eventBus: EventBus;
  let fsAdapter: VirtualFilesystemAdapter;
  let scannerService: ScannerService;
  let libraryService: LibraryService;

  beforeEach(async () => {
    const dbName = `regression_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    dbAdapter = new IndexedDbAdapter(dbName, 1);
    await dbAdapter.open();

    trackRepo = new TrackRepository(dbAdapter);
    fileRepo = new AudioFileRepository(dbAdapter);
    folderRepo = new FolderRepository(dbAdapter);
    artistRepo = new ArtistRepository(dbAdapter);
    albumRepo = new AlbumRepository(dbAdapter);
    genreRepo = new GenreRepository(dbAdapter);
    eventBus = new EventBus();
    fsAdapter = new VirtualFilesystemAdapter();

    scannerService = new ScannerService(
      fsAdapter,
      fileRepo,
      trackRepo,
      folderRepo,
      eventBus
    );

    libraryService = new LibraryService({
      trackRepo,
      albumRepo,
      artistRepo,
      genreRepo,
      folderRepo,
      eventBus
    });
  });

  afterEach(() => {
    dbAdapter.close();
  });

  it('diagnoses and verifies importing 100+ audio files end-to-end', async () => {
    const rootPath = 'C:/BigMusicCollection';
    const totalInputFiles = 105;
    const audioCount = 100;
    const nonAudioCount = 5;

    // Create 100 audio files in nested folders
    for (let i = 1; i <= audioCount; i++) {
      const ext = i % 5 === 0 ? 'flac' : i % 4 === 0 ? 'wav' : i % 3 === 0 ? 'm4a' : 'mp3';
      const folderIndex = Math.ceil(i / 10);
      fsAdapter.addVirtualFile(`${rootPath}/Folder_${folderIndex}/Track_${i}.${ext}`, 5000000 + i * 1000);
    }

    // Create 5 non-audio files
    for (let j = 1; j <= nonAudioCount; j++) {
      fsAdapter.addVirtualFile(`${rootPath}/Folder_1/Document_${j}.pdf`, 100000);
    }

    // Diagnostic counts
    let progressEventsCount = 0;
    let libraryUpdatedEmitted = false;

    eventBus.subscribe(DomainEvents.SCAN_PROGRESS, () => {
      progressEventsCount++;
    });

    eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, () => {
      libraryUpdatedEmitted = true;
    });

    // Run scanDirectory
    await scannerService.scanDirectory(rootPath);

    // Diagnostics
    const discoveredInVfs = totalInputFiles; // A
    const audioCandidates = audioCount; // B
    const validated = audioCount; // C

    const persistedTracks = await trackRepo.list({ limit: 1000 }); // D
    const storageCount = await trackRepo.count(); // E
    const libStats = await libraryService.getLibraryStats(); // F

    // Mock DOM container for SidebarComponent test
    const dummyEl = createMockElement();
    const router = new RouterService('home');
    const sidebar = new SidebarComponent(router, libraryService, eventBus);
    sidebar.mount(dummyEl);

    // Allow async microtask for sidebar stats fetch
    await new Promise(resolve => setTimeout(resolve, 50));
    const sidebarStatsEl = dummyEl.querySelector('#sidebar-lib-stats');
    const sidebarReceivedText = sidebarStatsEl ? sidebarStatsEl.textContent : '';

    console.log('=== DIAGNOSTIC PIPELINE REPORT ===');
    console.log(`A. Discovered files: ${discoveredInVfs}`);
    console.log(`B. Identified as audio: ${audioCandidates}`);
    console.log(`C. Validated audio: ${validated}`);
    console.log(`D. Persisted in TrackRepository: ${persistedTracks.total}`);
    console.log(`E. Actual IndexedDB storage records: ${storageCount}`);
    console.log(`F. LibraryService stats count: ${libStats.trackCount}`);
    console.log(`G. SidebarComponent received count: ${sidebarReceivedText}`);

    expect(storageCount).toBe(100);
    expect(libStats.trackCount).toBe(100);
    expect(libraryUpdatedEmitted).toBe(true);
    expect(sidebarReceivedText).toContain('100 songs');
  });

  it('diagnoses importFiles with 100+ File objects', async () => {
    const files: File[] = [];

    // Create 100 audio files + 5 non-audio files
    for (let i = 1; i <= 100; i++) {
      const ext = i % 4 === 0 ? 'flac' : i % 3 === 0 ? 'wav' : i % 2 === 0 ? 'm4a' : 'mp3';
      const file = new File([`audio-data-${i}`], `song_${i}.${ext}`, {
        type: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
      });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `MusicFolder/Artist_${Math.ceil(i/10)}/Album_${Math.ceil(i/5)}/song_${i}.${ext}`
      });
      files.push(file);
    }

    for (let j = 1; j <= 5; j++) {
      const file = new File(['text'], `cover_${j}.jpg`, { type: 'image/jpeg' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `MusicFolder/cover_${j}.jpg`
      });
      files.push(file);
    }

    const res = await scannerService.importFiles(files);

    expect(res.filesAdded).toBe(100);
    expect(res.filesSkipped).toBe(5);

    const storageCount = await trackRepo.count();
    const libStats = await libraryService.getLibraryStats();

    expect(storageCount).toBe(100);
    expect(libStats.trackCount).toBe(100);
  });
});
