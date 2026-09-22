import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LyricsService } from '../../src/services/lyrics/lyrics-service';
import type { ILyricsRepository, ITrackRepository } from '../../src/domain/repositories/repository-contracts';
import type { Lyrics } from '../../src/domain/entities/models';

describe('LyricsService', () => {
  let mockRepo: ILyricsRepository;
  let mockTrackRepo: ITrackRepository;
  let service: LyricsService;

  beforeEach(() => {
    mockRepo = {
      getByTrackId: vi.fn(),
      save: vi.fn(),
      deleteByTrackId: vi.fn()
    };
    mockTrackRepo = {
      getById: vi.fn(),
      getAll: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      getByAlbumId: vi.fn(),
      getByArtistId: vi.fn(),
      search: vi.fn()
    } as unknown as ITrackRepository;

    service = new LyricsService({
      lyricsRepo: mockRepo,
      trackRepo: mockTrackRepo
    });
  });

  it('retrieves lyrics by track ID from repository', async () => {
    const mockLyrics: Lyrics = {
      id: 'lyr_1',
      trackId: 'track_1',
      type: 'synced',
      plainText: '',
      lines: [{ timeMs: 1000, text: 'Hello' }],
      updatedAt: 123456789
    };
    (mockRepo.getByTrackId as any).mockResolvedValue(mockLyrics);

    const result = await service.getLyrics('track_1');
    expect(mockRepo.getByTrackId).toHaveBeenCalledWith('track_1');
    expect(result).toEqual(mockLyrics);
  });

  it('saves lyrics and updates timestamp and track flag', async () => {
    const lyricsToSave: Lyrics = {
      id: 'lyr_new',
      trackId: 'track_2',
      type: 'plain',
      plainText: 'Simple lyrics',
      lines: [],
      updatedAt: 0
    };

    (mockTrackRepo.getById as any).mockResolvedValue({
      id: 'track_2',
      title: 'Track 2',
      hasLyrics: false
    });

    await service.saveLyrics(lyricsToSave);

    expect(mockRepo.save).toHaveBeenCalled();
    const savedArg = (mockRepo.save as any).mock.calls[0][0];
    expect(savedArg.trackId).toBe('track_2');
    expect(mockTrackRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'track_2',
        hasLyrics: true
      })
    );
  });

  it('deletes lyrics by track ID and resets track flag', async () => {
    (mockTrackRepo.getById as any).mockResolvedValue({
      id: 'track_del',
      title: 'Track Del',
      hasLyrics: true
    });

    await service.deleteLyrics('track_del');
    expect(mockRepo.deleteByTrackId).toHaveBeenCalledWith('track_del');
    expect(mockTrackRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'track_del',
        hasLyrics: false
      })
    );
  });

  it('parses raw LRC strings through service parseLrc method', () => {
    const lrc = '[00:05.00]Song lyrics line';
    const parsed = service.parseLrc(lrc, 'track_3');
    expect(parsed.trackId).toBe('track_3');
    expect(parsed.type).toBe('synced');
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].text).toBe('Song lyrics line');
  });
});
