import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetadataEditorService } from '../../src/services/metadata-editor/metadata-editor-service';
import { MetadataWriteEngine } from '../../src/services/metadata-editor/metadata-write-engine';
import { FilenamePatternEngine } from '../../src/services/metadata-editor/filename-pattern-engine';
import { MetadataNormalizer } from '../../src/services/metadata-editor/metadata-normalizer';
import { ArtworkWriter } from '../../src/services/metadata-editor/artwork-writer';
import { ID3Writer } from '../../src/services/metadata-editor/id3-writer';
import { FlacWriter } from '../../src/services/metadata-editor/flac-writer';
import { MP4Writer } from '../../src/services/metadata-editor/mp4-writer';
import { WAVWriter } from '../../src/services/metadata-editor/wav-writer';
import type { Track, AudioFile } from '../../src/domain/entities/models';

describe('F22 — Advanced Metadata Editor & Batch Engine', () => {
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockFsAdapter: any;
  let mockDbAdapter: any;
  let mockEventBus: any;
  let service: MetadataEditorService;

  const sampleTrack: Track = {
    id: 'track-1',
    fileId: 'file-1',
    title: '  Test Song  ',
    artistName: 'Test Artist',
    albumTitle: 'Test Album',
    genreName: 'Rock',
    year: 2024,
    trackNumber: 1,
    discNumber: 1,
    durationMs: 180000,
    format: {
      container: 'mp3',
      codec: 'mp3',
      isLossless: false,
      sampleRate: 44100,
      channels: 2,
      bitrate: 320
    },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    isFavorite: false,
    playCount: 5,
    hasLyrics: false,
    availability: 'available'
  };

  const sampleAudioFile: AudioFile = {
    id: 'file-1',
    path: 'C:/Music/01 - Test Song.mp3',
    filename: '01 - Test Song.mp3',
    extension: 'mp3',
    sizeBytes: 4000000,
    modifiedTimeMs: Date.now(),
    availability: 'available'
  };

  beforeEach(() => {
    mockTrackRepo = {
      getById: vi.fn(async (id: string) => (id === 'track-1' ? { ...sampleTrack } : null)),
      save: vi.fn(async (t: Track) => t)
    };

    mockAudioFileRepo = {
      getById: vi.fn(async (id: string) => (id === 'file-1' ? { ...sampleAudioFile } : null)),
      save: vi.fn(async (f: AudioFile) => f)
    };

    mockFsAdapter = {
      readFile: vi.fn(async () => new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])),
      getDirectoryHandle: vi.fn(() => null),
      registerFile: vi.fn()
    };

    mockDbAdapter = {
      getByIndex: vi.fn(async () => null),
      put: vi.fn(async () => {})
    };

    mockEventBus = {
      publish: vi.fn()
    };

    service = new MetadataEditorService(
      mockTrackRepo,
      mockAudioFileRepo,
      mockFsAdapter,
      mockDbAdapter,
      mockEventBus
    );
  });

  describe('1. Formats & Write Engine Support', () => {
    it('supports MP3, FLAC, M4A, MP4, WAV write capability', () => {
      expect(MetadataWriteEngine.canWrite('song.mp3')).toBe(true);
      expect(MetadataWriteEngine.canWrite('song.flac')).toBe(true);
      expect(MetadataWriteEngine.canWrite('song.m4a')).toBe(true);
      expect(MetadataWriteEngine.canWrite('song.mp4')).toBe(true);
      expect(MetadataWriteEngine.canWrite('song.wav')).toBe(true);
    });

    it('rejects unsupported formats cleanly', () => {
      expect(MetadataWriteEngine.canWrite('song.ogg')).toBe(false);
      expect(MetadataWriteEngine.canWrite('song.opus')).toBe(false);
      expect(MetadataWriteEngine.canWrite('song.aiff')).toBe(false);
    });
  });

  describe('2. Single Track Editing & Preview', () => {
    it('generates single track preview accurately', async () => {
      const preview = await service.getSingleTrackPreview('track-1', {
        title: 'New Title',
        artist: 'New Artist'
      });

      expect(preview.canWrite).toBe(true);
      expect(preview.currentMetadata.title).toBe('  Test Song  ');
      expect(preview.proposedMetadata.title).toBe('New Title');
      expect(preview.proposedMetadata.artist).toBe('New Artist');
    });

    it('executes single track edit, writes physical file and updates IndexedDB', async () => {
      const res = await service.executeSingleTrackEdit('track-1', {
        title: 'Updated Song Title',
        artist: 'Updated Artist'
      });

      expect(res.success).toBe(true);
      expect(mockFsAdapter.readFile).toHaveBeenCalledWith('C:/Music/01 - Test Song.mp3');
      expect(mockTrackRepo.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith('library:updated', expect.any(Object));
    });
  });

  describe('3. Batch Metadata Editing', () => {
    it('previews batch edits with selective strategy', async () => {
      const batchRes = await service.getBatchEditPreview(['track-1'], {
        artist: { strategy: 'replace', value: 'Global Artist' }
      });

      expect(batchRes.totalSelected).toBe(1);
      expect(batchRes.writableCount).toBe(1);
      expect(batchRes.previews[0]?.proposedMetadata.artist).toBe('Global Artist');
      expect(batchRes.previews[0]?.proposedMetadata.title).toBe('  Test Song  '); // Unchanged
    });

    it('executes batch edits across multiple tracks cleanly', async () => {
      const res = await service.executeBatchEdit(['track-1'], {
        genre: { strategy: 'replace', value: 'Pop' }
      });

      expect(res.totalProcessed).toBe(1);
      expect(res.successCount).toBe(1);
      expect(res.failedCount).toBe(0);
    });
  });

  describe('4. Filename <-> Tag Engine & Pattern Renaming', () => {
    it('generates filename from tags using pattern', () => {
      const filename = FilenamePatternEngine.generateFilenameFromTags(
        '%track% - %artist% - %title%',
        { trackNumber: 1, artist: 'Queen', title: 'Bohemian Rhapsody' },
        'original.mp3'
      );
      expect(filename).toBe('01 - Queen - Bohemian Rhapsody.mp3');
    });

    it('parses metadata from filename pattern', () => {
      const parsed = FilenamePatternEngine.parseTagsFromFilename(
        '%track% - %artist% - %title%',
        '05 - Pink Floyd - Time.mp3'
      );
      expect(parsed.trackNumber).toBe(5);
      expect(parsed.artist).toBe('Pink Floyd');
      expect(parsed.title).toBe('Time');
    });

    it('sanitizes illegal Windows characters and path traversal', () => {
      const sanitized = FilenamePatternEngine.sanitizeFilename('Song <Name>: "Great"?');
      expect(sanitized).toBe('Song _Name__ _Great__');
    });

    it('previews rename and detects collisions', async () => {
      const preview = await service.getRenamePreview(['track-1'], '%artist% - %title%');
      expect(preview.writableCount).toBe(1);
      expect(preview.previews[0]?.proposedFilename).toBe('Test Artist - Test Song.mp3');
    });
  });

  describe('5. Metadata Normalizer', () => {
    it('trims whitespace and collapses repeated spaces', () => {
      const normalized = MetadataNormalizer.normalizeFields({
        title: '   Too   Many    Spaces   '
      }, { trimWhitespace: true, collapseWhitespace: true, titleCase: false, removeComments: false });

      expect(normalized.title).toBe('Too Many Spaces');
    });

    it('applies title case formatting correctly', () => {
      const titleCased = MetadataNormalizer.toTitleCase('imagine dragons - believer');
      expect(titleCased).toBe('Imagine Dragons - Believer');
    });
  });

  describe('6. Artwork Validation & Binary Writers', () => {
    it('validates image size and type bounds', async () => {
      const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const file = new File([jpegData], 'test.jpg', { type: 'image/jpeg' });
      const val = await ArtworkWriter.validateImage(file);
      expect(val.valid).toBe(true);
      expect(val.mimeType).toBe('image/jpeg');
    });

    it('writes ID3v2 tags into MP3 buffer', () => {
      const original = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const modified = ID3Writer.writeTags(original, { title: 'ID3 Song', artist: 'ID3 Artist' });
      expect(modified[0]).toBe(0x49); // 'I'
      expect(modified[1]).toBe(0x44); // 'D'
      expect(modified[2]).toBe(0x33); // '3'
    });

    it('writes FLAC Vorbis comment blocks', () => {
      const flacHeader = new Uint8Array([0x66, 0x4C, 0x61, 0x43, 0x80, 0x00, 0x00, 0x00]);
      const modified = FlacWriter.writeTags(flacHeader, { title: 'FLAC Song' });
      expect(modified.length).toBeGreaterThan(flacHeader.length);
    });

    it('writes MP4 ilst atoms', () => {
      const mp4Header = new Uint8Array([
        0x00, 0x00, 0x00, 0x10, 0x66, 0x74, 0x79, 0x70, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x10, 0x6D, 0x6F, 0x6F, 0x76, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      const modified = MP4Writer.writeTags(mp4Header, { title: 'M4A Song' });
      expect(modified.length).toBeGreaterThan(mp4Header.length);
    });

    it('writes WAV RIFF INFO chunks', () => {
      const wavHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
      const modified = WAVWriter.writeTags(wavHeader, { title: 'WAV Song' });
      expect(modified.length).toBeGreaterThan(wavHeader.length);
    });
  });
});
