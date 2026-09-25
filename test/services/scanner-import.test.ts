import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IndexedDbAdapter } from '../../src/data/db/database-adapter';
import { TrackRepository } from '../../src/data/repositories/track-repository';
import { AudioFileRepository } from '../../src/data/repositories/audio-file-repository';
import { FolderRepository } from '../../src/data/repositories/folder-repository';
import { ArtistRepository } from '../../src/data/repositories/artist-repository';
import { AlbumRepository } from '../../src/data/repositories/album-repository';
import { ScannerService } from '../../src/services/scanner/scanner-service';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { LibraryService } from '../../src/services/library/library-service';
import { EventBus } from '../../src/core/events/event-bus';

describe('Scanner & Folder Import Pipeline Tests', () => {
  let dbAdapter: IndexedDbAdapter;
  let trackRepo: TrackRepository;
  let fileRepo: AudioFileRepository;
  let folderRepo: FolderRepository;
  let artistRepo: ArtistRepository;
  let albumRepo: AlbumRepository;
  let eventBus: EventBus;
  let fsAdapter: VirtualFilesystemAdapter;
  let scannerService: ScannerService;
  let libraryService: LibraryService;

  beforeEach(async () => {
    const dbName = `scan_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    dbAdapter = new IndexedDbAdapter(dbName, 1);
    await dbAdapter.open();

    trackRepo = new TrackRepository(dbAdapter);
    fileRepo = new AudioFileRepository(dbAdapter);
    folderRepo = new FolderRepository(dbAdapter);
    artistRepo = new ArtistRepository(dbAdapter);
    albumRepo = new AlbumRepository(dbAdapter);
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
      folderRepo,
      eventBus
    });
  });

  afterEach(() => {
    dbAdapter.close();
  });

  it('should recursively traverse deeply nested folder structures and import all audio files', async () => {
    // 5 levels of nesting
    const rootPath = 'C:/Music';
    fsAdapter.addVirtualFile('C:/Music/Artist A/Album 1/Disc 1/Sub/song01.mp3');
    fsAdapter.addVirtualFile('C:/Music/Artist A/Album 1/Disc 1/Sub/song02.mp3');
    fsAdapter.addVirtualFile('C:/Music/Artist A/Album 1/Disc 1/Sub/song03.flac');
    fsAdapter.addVirtualFile('C:/Music/Artist A/Album 2/song04.mp3');
    fsAdapter.addVirtualFile('C:/Music/Artist A/Album 2/song05.m4a');
    fsAdapter.addVirtualFile('C:/Music/Artist B/Album/song06.wav');
    fsAdapter.addVirtualFile('C:/Music/Artist B/Album/song07.ogg');
    fsAdapter.addVirtualFile('C:/Music/Other/song08.mp3');
    fsAdapter.addVirtualFile('C:/Music/Other/notes.txt'); // Non-audio file

    await scannerService.scanDirectory(rootPath);

    const tracksResult = await libraryService.listTracks();
    expect(tracksResult.total).toBe(8);
    expect(tracksResult.items.length).toBe(8);

    const stats = await libraryService.getLibraryStats();
    expect(stats.trackCount).toBe(8);

    // Verify all titles were properly extracted
    const titles = tracksResult.items.map(t => t.title).sort();
    expect(titles).toEqual([
      'song01',
      'song02',
      'song03',
      'song04',
      'song05',
      'song06',
      'song07',
      'song08'
    ]);
  });

  it('should import files with duplicate names in different subfolders without collision', async () => {
    // Two files named song01.mp3 in different folders
    const file1 = new File(['audio1'], 'song01.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file1, 'webkitRelativePath', { value: 'Music/Artist A/Album 1/song01.mp3' });

    const file2 = new File(['audio2'], 'song01.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(file2, 'webkitRelativePath', { value: 'Music/Artist B/Album 2/song01.mp3' });

    const result = await scannerService.importFiles([file1, file2]);
    expect(result.filesAdded).toBe(2);
    expect(result.filesSkipped).toBe(0);

    const libraryTracks = await libraryService.listTracks();
    expect(libraryTracks.total).toBe(2);
    expect(libraryTracks.items[0]?.id).not.toBe(libraryTracks.items[1]?.id);
  });

  it('should recognize and import all required audio formats (MP3, WAV, FLAC, M4A, AAC, OGG, OPUS, WEBM, AIFF)', async () => {
    const rootPath = 'C:/Formats';
    fsAdapter.addVirtualFile('C:/Formats/t1.mp3');
    fsAdapter.addVirtualFile('C:/Formats/t2.wav');
    fsAdapter.addVirtualFile('C:/Formats/t3.flac');
    fsAdapter.addVirtualFile('C:/Formats/t4.m4a');
    fsAdapter.addVirtualFile('C:/Formats/t5.aac');
    fsAdapter.addVirtualFile('C:/Formats/t6.ogg');
    fsAdapter.addVirtualFile('C:/Formats/t7.opus');
    fsAdapter.addVirtualFile('C:/Formats/t8.webm');
    fsAdapter.addVirtualFile('C:/Formats/t9.aiff');

    await scannerService.scanDirectory(rootPath);

    const tracksResult = await libraryService.listTracks();
    expect(tracksResult.total).toBe(9);
  });

  it('should skip duplicate records when rescanning the same directory', async () => {
    const rootPath = 'C:/Library';
    fsAdapter.addVirtualFile('C:/Library/track1.mp3');
    fsAdapter.addVirtualFile('C:/Library/track2.flac');

    // First scan
    await scannerService.scanDirectory(rootPath);
    let tracksResult = await libraryService.listTracks();
    expect(tracksResult.total).toBe(2);

    // Second scan (rescan)
    await scannerService.scanDirectory(rootPath);
    tracksResult = await libraryService.listTracks();
    expect(tracksResult.total).toBe(2);
  });

  it('should process a realistic 50+ music folder containing 52 audio files and 5 non-audio files', async () => {
    const files: File[] = [];

    // 52 audio files across various artists and albums inside muijk/
    for (let i = 1; i <= 52; i++) {
      const ext = i % 4 === 0 ? 'flac' : i % 3 === 0 ? 'wav' : i % 2 === 0 ? 'm4a' : 'mp3';
      const file = new File([`audio-content-${i}`], `song_${i}.${ext}`, {
        type: ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'flac' ? 'audio/flac' : 'audio/mp4'
      });
      const artist = `Artist_${Math.ceil(i / 10)}`;
      const album = `Album_${Math.ceil(i / 5)}`;
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `muijk/${artist}/${album}/song_${i}.${ext}`
      });
      files.push(file);
    }

    // 5 non-audio files
    const nonAudioFiles = ['notes.txt', 'cover.jpg', 'album.nfo', '.DS_Store', 'lyrics.pdf'];
    for (const name of nonAudioFiles) {
      const file = new File(['text'], name, { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `muijk/${name}`
      });
      files.push(file);
    }

    expect(files.length).toBe(57);

    const importResult = await scannerService.importFiles(files);

    expect(importResult.filesAdded).toBe(52);
    expect(importResult.filesSkipped).toBe(5); // 5 non-audio files skipped
    expect(importResult.unsupported).toBe(5);
    expect(importResult.filesFailed).toBe(0);

    const tracksResult = await libraryService.listTracks();
    expect(tracksResult.total).toBe(52);
    expect(tracksResult.items.length).toBe(52);

    const stats = await libraryService.getLibraryStats();
    expect(stats.trackCount).toBe(52);
  });
});
