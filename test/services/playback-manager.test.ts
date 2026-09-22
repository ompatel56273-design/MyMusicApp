import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/events/event-bus';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track, AudioFile } from '../../src/domain/entities/models';
import type { IAudioEngine } from '../../src/services/contracts/service-contracts';
import { DomainEvents } from '../../src/domain/events/domain-events';

describe('PlaybackManager', () => {
  let eventBus: EventBus;
  let filesystem: VirtualFilesystemAdapter;
  let mockAudioEngine: IAudioEngine;
  let mockTrackRepo: any;
  let mockAudioFileRepo: any;
  let mockQueueRepo: any;
  let mockHistoryRepo: any;
  let playbackManager: PlaybackManager;

  const mockTrack1: Track = {
    id: 'track_1',
    fileId: 'file_1',
    title: 'Test Song 1',
    artistName: 'Artist 1',
    durationMs: 180000,
    format: { container: 'mp3', codec: 'mp3', sampleRate: 44100, channels: 2, isLossless: false },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: false,
    hasLyrics: false,
    availability: 'available'
  };

  const mockTrack2: Track = {
    id: 'track_2',
    fileId: 'file_2',
    title: 'Test Song 2',
    artistName: 'Artist 2',
    durationMs: 240000,
    format: { container: 'flac', codec: 'flac', sampleRate: 96000, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 0,
    isFavorite: true,
    hasLyrics: false,
    availability: 'available'
  };

  const mockFile1: AudioFile = {
    id: 'file_1',
    path: 'C:/Music/song1.mp3',
    filename: 'song1.mp3',
    extension: '.mp3',
    sizeBytes: 1024,
    modifiedTimeMs: Date.now(),
    availability: 'available'
  };

  const mockFile2: AudioFile = {
    id: 'file_2',
    path: 'C:/Music/song2.flac',
    filename: 'song2.flac',
    extension: '.flac',
    sizeBytes: 2048,
    modifiedTimeMs: Date.now(),
    availability: 'available'
  };

  beforeEach(() => {
    eventBus = new EventBus();
    filesystem = new VirtualFilesystemAdapter();
    filesystem.addVirtualFile('C:/Music/song1.mp3', 1024, Date.now(), new Uint8Array([1, 2, 3]));
    filesystem.addVirtualFile('C:/Music/song2.flac', 2048, Date.now(), new Uint8Array([4, 5, 6]));

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
      getById: vi.fn((id: string) => Promise.resolve(id === 'track_1' ? mockTrack1 : id === 'track_2' ? mockTrack2 : null)),
      save: vi.fn().mockResolvedValue(undefined),
      incrementPlayCount: vi.fn().mockResolvedValue(undefined)
    };

    mockAudioFileRepo = {
      getById: vi.fn((id: string) => Promise.resolve(id === 'file_1' ? mockFile1 : id === 'file_2' ? mockFile2 : null))
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

  it('should initialize with idle state and default audio controls', () => {
    expect(playbackManager.state).toBe('idle');
    expect(playbackManager.currentTrack).toBeNull();
    expect(playbackManager.volume).toBe(1.0);
    expect(playbackManager.isMuted).toBe(false);
    expect(playbackManager.repeatMode).toBe('off');
    expect(playbackManager.shuffleMode).toBe('off');
    expect(playbackManager.queue).toHaveLength(0);
  });

  it('should load and play a track while transitioning states and emitting events', async () => {
    const trackEvents: any[] = [];
    const stateEvents: any[] = [];

    eventBus.subscribe(DomainEvents.TRACK_CHANGED, (e: any) => {
      trackEvents.push(e);
    });
    eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, (e: any) => {
      stateEvents.push(e);
    });

    await playbackManager.playTrack(mockTrack1, [mockTrack1, mockTrack2]);

    expect(mockAudioEngine.loadBuffer).toHaveBeenCalled();
    expect(mockAudioEngine.play).toHaveBeenCalled();
    expect(playbackManager.state).toBe('playing');
    expect(playbackManager.currentTrack?.id).toBe('track_1');
    expect(playbackManager.queue).toHaveLength(2);
    expect(trackEvents.length).toBeGreaterThanOrEqual(1);
    expect(stateEvents.map((s: any) => s.state)).toContain('playing');
  });

  it('should handle pause, resume, and stop operations', async () => {
    await playbackManager.playTrack(mockTrack1);

    await playbackManager.pause();
    expect(playbackManager.state).toBe('paused');
    expect(mockAudioEngine.pause).toHaveBeenCalled();

    await playbackManager.resume();
    expect(playbackManager.state).toBe('playing');

    await playbackManager.stop();
    expect(playbackManager.state).toBe('stopped');
    expect(mockAudioEngine.stop).toHaveBeenCalled();
  });

  it('should handle seeking accurately', async () => {
    await playbackManager.playTrack(mockTrack1);

    await playbackManager.seek(45000);
    expect(playbackManager.positionMs).toBe(45000);
    expect(mockAudioEngine.seek).toHaveBeenCalledWith(45);
  });

  it('should advance to next track in queue and support repeat mode', async () => {
    await playbackManager.playTrack(mockTrack1, [mockTrack1, mockTrack2]);

    await playbackManager.next();
    expect(playbackManager.currentTrack?.id).toBe('track_2');
    expect(playbackManager.currentQueueIndex).toBe(1);

    // End of queue with repeat 'off'
    await playbackManager.next();
    expect(playbackManager.state).toBe('stopped');

    // With repeat 'all', wraps around
    playbackManager.setRepeatMode('all');
    await playbackManager.playTrack(mockTrack2, [mockTrack1, mockTrack2]);
    await playbackManager.next();
    expect(playbackManager.currentTrack?.id).toBe('track_1');
  });

  it('should handle queue manipulation (add, remove, reorder, clear)', async () => {
    await playbackManager.addToQueue([mockTrack1, mockTrack2]);
    expect(playbackManager.queue).toHaveLength(2);

    await playbackManager.reorderQueue(0, 1);
    expect(playbackManager.queue[0]?.trackId).toBe('track_2');

    await playbackManager.removeFromQueue(0);
    expect(playbackManager.queue).toHaveLength(1);

    await playbackManager.clearQueue();
    expect(playbackManager.queue).toHaveLength(0);
  });

  it('should jump to specific track index via playQueueIndex', async () => {
    await playbackManager.addToQueue([mockTrack1, mockTrack2]);
    await playbackManager.playQueueIndex(1);

    expect(playbackManager.currentTrack?.id).toBe('track_2');
    expect(playbackManager.currentQueueIndex).toBe(1);
  });
});
