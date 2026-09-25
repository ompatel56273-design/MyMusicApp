import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissingFileScannerService } from '../../src/services/cleanup/missing-file-scanner-service';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type {
  ITrackRepository,
  IAudioFileRepository,
  IAlbumRepository,
  IArtistRepository,
  IHistoryRepository
} from '../../src/domain/repositories/repository-contracts';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('MissingFileScannerService', () => {
  let virtualFs: VirtualFilesystemAdapter;
  let eventBus: EventBus;
  let trackStore: Map<string, Track>;
  let audioFileStore: Map<string, AudioFile>;
  let mockTrackRepo: ITrackRepository;
  let mockAudioFileRepo: IAudioFileRepository;
  let mockAlbumRepo: IAlbumRepository;
  let mockArtistRepo: IArtistRepository;
  let mockHistoryRepo: IHistoryRepository;
  let scannerService: MissingFileScannerService;

  beforeEach(() => {
    virtualFs = new VirtualFilesystemAdapter();
    eventBus = new EventBus();
    trackStore = new Map();
    audioFileStore = new Map();

    mockTrackRepo = {
      getById: vi.fn().mockImplementation(async (id: string) => trackStore.get(id) || null),
      getByFileId: vi.fn(),
      list: vi.fn().mockImplementation(async () => ({
        items: Array.from(trackStore.values()),
        total: trackStore.size,
        offset: 0,
        limit: 100000
      })),
      save: vi.fn().mockImplementation(async (t: Track) => {
        trackStore.set(t.id, t);
      }),
      saveBatch: vi.fn().mockImplementation(async (tracks: readonly Track[]) => {
        tracks.forEach(t => trackStore.set(t.id, t));
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        trackStore.delete(id);
      }),
      setFavorite: vi.fn(),
      incrementPlayCount: vi.fn(),
      count: vi.fn().mockImplementation(async () => trackStore.size)
    };

    mockAudioFileRepo = {
      getById: vi.fn().mockImplementation(async (id: string) => audioFileStore.get(id) || null),
      getByPath: vi.fn().mockImplementation(async (path: string) => {
        for (const file of audioFileStore.values()) {
          if (file.path === path) return file;
        }
        return null;
      }),
      save: vi.fn().mockImplementation(async (f: AudioFile) => {
        audioFileStore.set(f.id, f);
      }),
      saveBatch: vi.fn().mockImplementation(async (files: readonly AudioFile[]) => {
        files.forEach(f => audioFileStore.set(f.id, f));
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        audioFileStore.delete(id);
      }),
      listAllPaths: vi.fn().mockImplementation(async () => {
        const map = new Map<string, { id: string; sizeBytes: number; modifiedTimeMs: number }>();
        for (const f of audioFileStore.values()) {
          map.set(f.path, { id: f.id, sizeBytes: f.sizeBytes, modifiedTimeMs: f.modifiedTimeMs });
        }
        return map;
      })
    };

    mockAlbumRepo = {
      getById: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn()
    };

    mockArtistRepo = {
      getById: vi.fn().mockResolvedValue(null),
      getByName: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
      save: vi.fn(),
      saveBatch: vi.fn(),
      delete: vi.fn()
    };

    mockHistoryRepo = {
      getRecent: vi.fn().mockResolvedValue([]),
      addRecord: vi.fn(),
      getResumePosition: vi.fn().mockResolvedValue(null),
      saveResumePosition: vi.fn(),
      clearResumePosition: vi.fn()
    };

    scannerService = new MissingFileScannerService({
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      filesystem: virtualFs,
      eventBus,
      albumRepo: mockAlbumRepo,
      artistRepo: mockArtistRepo,
      historyRepo: mockHistoryRepo
    });
  });

  const addTestTrack = (
    trackId: string,
    fileId: string,
    filePath: string,
    title: string,
    artist: string = 'Artist A',
    album: string = 'Album 1'
  ) => {
    trackStore.set(trackId, {
      id: trackId,
      fileId,
      title,
      artistId: 'art_1',
      artistName: artist,
      albumId: 'alb_1',
      albumTitle: album,
      durationMs: 180000,
      format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 0,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    });

    audioFileStore.set(fileId, {
      id: fileId,
      path: filePath,
      filename: filePath.split('/').pop() || 'file.mp3',
      extension: 'mp3',
      sizeBytes: 1024,
      modifiedTimeMs: Date.now(),
      availability: 'available'
    });
  };

  it('detects all files available when virtual filesystem has all entries', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/song1.mp3', 'Song 1');
    addTestTrack('t2', 'f2', 'C:/Music/song2.mp3', 'Song 2');
    virtualFs.addVirtualFile('C:/Music/song1.mp3');
    virtualFs.addVirtualFile('C:/Music/song2.mp3');

    const result = await scannerService.scanMissingFiles();
    expect(result.totalChecked).toBe(2);
    expect(result.availableCount).toBe(2);
    expect(result.missingCount).toBe(0);
    expect(result.unverifiableCount).toBe(0);
    expect(result.missingTracks.length).toBe(0);
  });

  it('detects one missing file correctly', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/song1.mp3', 'Song 1');
    addTestTrack('t2', 'f2', 'C:/Music/song2.mp3', 'Song 2');
    virtualFs.addVirtualFile('C:/Music/song1.mp3');
    // C:/Music/song2.mp3 is missing from filesystem

    const result = await scannerService.scanMissingFiles();
    expect(result.totalChecked).toBe(2);
    expect(result.availableCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.missingTracks.length).toBe(1);
    expect(result.missingTracks[0]?.trackId).toBe('t2');
    expect(result.missingTracks[0]?.path).toBe('C:/Music/song2.mp3');
  });

  it('detects multiple missing files across nested directories', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/Artist A/Album 1/track1.flac', 'Track 1', 'Artist A', 'Album 1');
    addTestTrack('t2', 'f2', 'C:/Music/Artist A/Album 2/track2.flac', 'Track 2', 'Artist A', 'Album 2');
    addTestTrack('t3', 'f3', 'C:/Music/Artist B/Album X/track3.flac', 'Track 3', 'Artist B', 'Album X');
    virtualFs.addVirtualFile('C:/Music/Artist A/Album 1/track1.flac');

    const result = await scannerService.scanMissingFiles();
    expect(result.totalChecked).toBe(3);
    expect(result.availableCount).toBe(1);
    expect(result.missingCount).toBe(2);
    expect(result.missingTracks.map(t => t.trackId)).toEqual(['t2', 't3']);
  });

  it('handles duplicate filenames in different folders safely', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/Rock/track01.mp3', 'Track 1 Rock');
    addTestTrack('t2', 'f2', 'C:/Music/Pop/track01.mp3', 'Track 1 Pop');
    virtualFs.addVirtualFile('C:/Music/Rock/track01.mp3');
    // Pop track01 is missing

    const result = await scannerService.scanMissingFiles();
    expect(result.availableCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.missingTracks[0]?.path).toBe('C:/Music/Pop/track01.mp3');
  });

  it('handles Unicode filenames and special characters correctly', async () => {
    const unicodePath = 'C:/Music/日本語/初音ミク - 世界で一番おひめさま (feat. supercell) [2024 Remaster].flac';
    addTestTrack('t_unicode', 'f_unicode', unicodePath, '世界で一番おひめさま');
    virtualFs.addVirtualFile(unicodePath);

    const result = await scannerService.scanMissingFiles();
    expect(result.availableCount).toBe(1);
    expect(result.missingCount).toBe(0);

    // Now remove from filesystem
    virtualFs.removeVirtualFile(unicodePath);
    const result2 = await scannerService.scanMissingFiles();
    expect(result2.availableCount).toBe(0);
    expect(result2.missingCount).toBe(1);
    expect(result2.missingTracks[0]?.path).toBe(unicodePath);
  });

  it('handles empty library without crashing', async () => {
    const result = await scannerService.scanMissingFiles();
    expect(result.totalChecked).toBe(0);
    expect(result.availableCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.unverifiableCount).toBe(0);
  });

  it('ensures scan operation is strictly read-only and does not mutate database', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/missing.mp3', 'Missing Song');
    expect(trackStore.size).toBe(1);

    await scannerService.scanMissingFiles();
    expect(trackStore.size).toBe(1);
    expect(mockTrackRepo.delete).not.toHaveBeenCalled();
    expect(mockAudioFileRepo.delete).not.toHaveBeenCalled();
  });

  it('cleans up only selected missing tracks and preserves unrelated tracks', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/song1.mp3', 'Song 1');
    addTestTrack('t2', 'f2', 'C:/Music/missing1.mp3', 'Missing 1');
    addTestTrack('t3', 'f3', 'C:/Music/missing2.mp3', 'Missing 2');
    virtualFs.addVirtualFile('C:/Music/song1.mp3');

    const listener = vi.fn();
    eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, listener);

    // Clean up only t2
    const cleanupResult = await scannerService.cleanupMissingTracks(['t2']);
    expect(cleanupResult.removedTrackCount).toBe(1);
    expect(cleanupResult.removedFileCount).toBe(1);

    // t1 and t3 should still be in database
    expect(trackStore.has('t1')).toBe(true);
    expect(trackStore.has('t2')).toBe(false);
    expect(trackStore.has('t3')).toBe(true);

    // AudioFile for t2 should be deleted, t1 and t3 preserved
    expect(audioFileStore.has('f1')).toBe(true);
    expect(audioFileStore.has('f2')).toBe(false);
    expect(audioFileStore.has('f3')).toBe(true);

    // LIBRARY_UPDATED should be published
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        tracksRemoved: 1
      })
    );
  });

  it('restoring a missing file makes it available on next scan', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/song1.mp3', 'Song 1');

    // First scan: missing
    const res1 = await scannerService.scanMissingFiles();
    expect(res1.missingCount).toBe(1);

    // User restores file to original location
    virtualFs.addVirtualFile('C:/Music/song1.mp3');

    // Second scan: available
    const res2 = await scannerService.scanMissingFiles();
    expect(res2.availableCount).toBe(1);
    expect(res2.missingCount).toBe(0);
  });

  it('handles partial filesystem errors without aborting entire scan', async () => {
    addTestTrack('t1', 'f1', 'C:/Music/song1.mp3', 'Song 1');
    addTestTrack('t2', 'f2', 'C:/Music/err.mp3', 'Error Track');
    addTestTrack('t3', 'f3', 'C:/Music/song3.mp3', 'Song 3');
    virtualFs.addVirtualFile('C:/Music/song1.mp3');
    virtualFs.addVirtualFile('C:/Music/song3.mp3');

    // Mock filesystem error on t2
    const origVerify = virtualFs.verifyFileAccessibility.bind(virtualFs);
    vi.spyOn(virtualFs, 'verifyFileAccessibility').mockImplementation(async (path: string) => {
      if (path === 'C:/Music/err.mp3') {
        throw new Error('I/O Device Busy');
      }
      return origVerify(path);
    });

    const result = await scannerService.scanMissingFiles();
    expect(result.totalChecked).toBe(3);
    expect(result.availableCount).toBe(2);
    expect(result.unverifiableCount).toBe(1);
    expect(result.unverifiableTracks[0]?.trackId).toBe('t2');
  });

  it('scans 5,000 tracks with high performance without O(N^2) loops', async () => {
    for (let i = 0; i < 5000; i++) {
      const path = `C:/Music/Artist_${i % 100}/Album_${i % 250}/track_${i}.mp3`;
      addTestTrack(`t_${i}`, `f_${i}`, path, `Track ${i}`);
      if (i % 20 !== 0) {
        // 95% available, 5% missing
        virtualFs.addVirtualFile(path);
      }
    }

    const startTime = performance.now();
    const result = await scannerService.scanMissingFiles();
    const duration = performance.now() - startTime;

    expect(result.totalChecked).toBe(5000);
    expect(result.availableCount).toBe(4750);
    expect(result.missingCount).toBe(250);
    expect(duration).toBeLessThan(1500); // 5,000 items checked in under 1.5 seconds
  });
});
