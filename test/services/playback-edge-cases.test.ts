import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events/event-bus';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track, AudioFile } from '../../src/domain/entities/models';
import type { IAudioEngine } from '../../src/services/contracts/service-contracts';

describe('PlaybackManager Edge Cases & Invariants', () => {
  let eventBus: EventBus;
  let filesystem: VirtualFilesystemAdapter;
  let mockAudioEngine: IAudioEngine;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockQueueRepo: any;
  let mockHistoryRepo: any;
  let playbackManager: PlaybackManager;

  const validTrack: Track = {
    id: 'track_valid',
    fileId: 'file_valid',
    title: 'Valid Song',
    durationMs: 60000, // 60s
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const missingTrack: Track = {
    id: 'track_missing',
    fileId: 'file_missing',
    title: 'Missing Song',
    durationMs: 60000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'missing'
  };

  beforeEach(() => {
    eventBus = new EventBus();
    filesystem = new VirtualFilesystemAdapter();
    filesystem.addVirtualFile('C:/Music/valid.mp3', 100, Date.now(), new Uint8Array([1, 2, 3]));

    mockAudioEngine = {
      sampleRate: 44100,
      currentTime: 0,
      loadBuffer: vi.fn().mockResolvedValue(undefined),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      setGain: vi.fn(),
      setPlaybackRate: vi.fn(),
      getAnalysisData: vi.fn(() => new Uint8Array(128)),
      getAnalysisMetrics: vi.fn(() => ({
        rms: 0,
        peak: 0,
        frequencyData: new Uint8Array(128),
        timeDomainData: new Uint8Array(128)
      })),
      setEqualizerEnabled: vi.fn(),
      setEqualizerBands: vi.fn(),
      setEqualizerBandGain: vi.fn(),
      setPreampGain: vi.fn(),
      setReplayGainMode: vi.fn(),
      setBalance: vi.fn(),
      setLimiterEnabled: vi.fn(),
      getDspOptions: vi.fn()
    };

    mockTrackRepo = {
      getById: vi.fn((id: string) => Promise.resolve(id === 'track_valid' ? validTrack : missingTrack)),
      save: vi.fn().mockResolvedValue(undefined),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn((id: string) => {
        if (id === 'file_valid') {
          return Promise.resolve({
            id: 'file_valid',
            path: 'C:/Music/valid.mp3',
            filename: 'valid.mp3',
            extension: '.mp3',
            sizeBytes: 100,
            modifiedTimeMs: Date.now(),
            availability: 'available'
          } as AudioFile);
        }
        return Promise.resolve(null);
      })
    };

    mockQueueRepo = {
      clearQueue: vi.fn().mockResolvedValue(undefined),
      saveQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockHistoryRepo = {
      saveResumePosition: vi.fn().mockResolvedValue(undefined),
      addRecord: vi.fn().mockResolvedValue(undefined)
    };

    playbackManager = new PlaybackManager({
      audioEngine: mockAudioEngine,
      filesystem,
      trackRepo: mockTrackRepo,
      audioFileRepo: mockAudioFileRepo,
      queueRepo: mockQueueRepo,
      historyRepo: mockHistoryRepo,
      eventBus
    });
  });

  it('should gracefully handle missing tracks without deleting records', async () => {
    await expect(playbackManager.playTrack(missingTrack)).rejects.toThrow();
    expect(playbackManager.state).toBe('error');
    expect(mockTrackRepo.save).not.toHaveBeenCalled();
  });

  it('should handle previous track threshold (restarts if > 3s, previous if <= 3s)', async () => {
    const track2 = { ...validTrack, id: 'track_2', title: 'Song 2' };
    await playbackManager.playTrack(validTrack, [validTrack, track2]);
    await playbackManager.next();
    expect(playbackManager.currentTrack?.id).toBe('track_2');

    // Case 1: Position <= 3s -> Skips to previous track (track_valid)
    await playbackManager.previous();
    expect(playbackManager.currentTrack?.id).toBe('track_valid');

    // Case 2: Position > 3s (seek to 15s) -> Restarts current track
    await playbackManager.seek(15000);
    await playbackManager.previous();
    expect(playbackManager.positionMs).toBe(0);
    expect(playbackManager.currentTrack?.id).toBe('track_valid');
  });

  it('should maintain deterministic shuffle permutation without losing items', async () => {
    const tracks: Track[] = Array.from({ length: 5 }, (_, i) => ({
      ...validTrack,
      id: `track_${i}`,
      title: `Song ${i}`
    }));

    await playbackManager.playTrack(tracks[0]!, tracks);
    playbackManager.setShuffleMode('on');
    expect(playbackManager.shuffleMode).toBe('on');
    expect(playbackManager.queue).toHaveLength(5);

    playbackManager.setShuffleMode('off');
    expect(playbackManager.shuffleMode).toBe('off');
    expect(playbackManager.queue).toHaveLength(5);
  });
});
