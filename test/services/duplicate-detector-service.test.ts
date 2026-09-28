import { describe, it, expect, beforeEach } from 'vitest';
import { DuplicateDetectorService } from '../../src/services/duplicate/duplicate-detector-service';
import { EventBus } from '../../src/core/events/event-bus';
import type { Track, AudioFile } from '../../src/domain/entities/models';

class MockTrackRepo {
  public tracks: Track[] = [];

  async list() {
    return { items: this.tracks, total: this.tracks.length, offset: 0, limit: 10000 };
  }

  async getById(id: string) {
    return this.tracks.find(t => t.id === id) || null;
  }

  async delete(id: string) {
    this.tracks = this.tracks.filter(t => t.id !== id);
  }
}

class MockAudioFileRepo {
  public files: AudioFile[] = [];

  async getById(id: string) {
    return this.files.find(f => f.id === id) || null;
  }

  async delete(id: string) {
    this.files = this.files.filter(f => f.id !== id);
  }
}

describe('DuplicateDetectorService', () => {
  let trackRepo: MockTrackRepo;
  let audioFileRepo: MockAudioFileRepo;
  let eventBus: EventBus;
  let service: DuplicateDetectorService;

  beforeEach(() => {
    trackRepo = new MockTrackRepo();
    audioFileRepo = new MockAudioFileRepo();
    eventBus = new EventBus();
    service = new DuplicateDetectorService(trackRepo as any, audioFileRepo as any, eventBus);
  });

  it('should detect duplicate tracks with identical titles and durations', async () => {
    trackRepo.tracks = [
      {
        id: 'track1',
        fileId: 'file1',
        title: 'Numb',
        artistName: 'Linkin Park',
        albumTitle: 'Meteora',
        durationMs: 187000,
        format: { container: 'mp3', bitrate: 320000, sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 1000
      } as Track,
      {
        id: 'track2',
        fileId: 'file2',
        title: 'Numb',
        artistName: 'Linkin Park',
        albumTitle: 'Meteora',
        durationMs: 187500,
        format: { container: 'mp3', bitrate: 128000, sampleRate: 44100, channels: 2, isLossless: false },
        dateAdded: 2000
      } as Track
    ];

    audioFileRepo.files = [
      { id: 'file1', path: '/file1.mp3', filename: 'file1.mp3', extension: 'mp3', mimeType: 'audio/mpeg', sizeBytes: 5000000, dateAdded: 1000, dateModified: 1000, modifiedTimeMs: 1000, availability: 'available' } as unknown as AudioFile,
      { id: 'file2', path: '/file2.mp3', filename: 'file2.mp3', extension: 'mp3', mimeType: 'audio/mpeg', sizeBytes: 2000000, dateAdded: 2000, dateModified: 2000, modifiedTimeMs: 2000, availability: 'available' } as unknown as AudioFile
    ];

    const summary = await service.detectDuplicates();
    expect(summary.duplicateGroupsFound).toBe(1);
    expect(summary.groups[0]?.primaryTrack.id).toBe('track1'); // 320kbps selected over 128kbps
    expect(summary.groups[0]?.duplicateTracks[0]?.id).toBe('track2');
  });

  it('should NOT flag tracks with different version tags as duplicates', async () => {
    trackRepo.tracks = [
      {
        id: 'track1',
        fileId: 'file1',
        title: 'Numb (Acoustic)',
        artistName: 'Linkin Park',
        durationMs: 187000,
        format: { container: 'mp3', isLossless: false },
        dateAdded: 1000
      } as Track,
      {
        id: 'track2',
        fileId: 'file2',
        title: 'Numb (Live)',
        artistName: 'Linkin Park',
        durationMs: 187000,
        format: { container: 'mp3', isLossless: false },
        dateAdded: 2000
      } as Track
    ];

    const summary = await service.detectDuplicates();
    expect(summary.duplicateGroupsFound).toBe(0);
  });

  it('should resolve duplicates non-destructively', async () => {
    trackRepo.tracks = [
      { id: 'track1', fileId: 'file1', title: 'Song A', artistName: 'Artist A', durationMs: 200000, format: { container: 'mp3' }, dateAdded: 1000 } as Track,
      { id: 'track2', fileId: 'file2', title: 'Song A', artistName: 'Artist A', durationMs: 200000, format: { container: 'mp3' }, dateAdded: 2000 } as Track
    ];

    audioFileRepo.files = [
      { id: 'file1', path: '/file1.mp3', filename: 'file1.mp3', extension: 'mp3', mimeType: 'audio/mpeg', sizeBytes: 4000000, dateAdded: 1000, dateModified: 1000, modifiedTimeMs: 1000, availability: 'available' } as unknown as AudioFile,
      { id: 'file2', path: '/file2.mp3', filename: 'file2.mp3', extension: 'mp3', mimeType: 'audio/mpeg', sizeBytes: 4000000, dateAdded: 2000, dateModified: 2000, modifiedTimeMs: 2000, availability: 'available' } as unknown as AudioFile
    ];

    const summary = await service.detectDuplicates();
    const group = summary.groups[0]!;

    const removed = await service.resolveDuplicates([{
      groupId: group.id,
      keepTrackId: group.primaryTrack.id,
      removeTrackIds: group.duplicateTracks.map(t => t.id)
    }]);

    expect(removed).toBe(1);
    expect(trackRepo.tracks.length).toBe(1);
    expect(trackRepo.tracks[0]?.id).toBe('track1');
  });
});
