import { describe, it, expect, vi } from 'vitest';
import { VirtualTrackService } from '../../src/services/cue/virtual-track-service';
import { CueParser } from '../../src/services/cue/cue-parser';
import type { AudioFile, Track } from '../../src/domain/entities/models';

describe('VirtualTrackService', () => {
  const sourceFile: AudioFile = {
    id: 'src_file_123',
    path: 'music/DarkSide.flac',
    filename: 'DarkSide.flac',
    extension: 'flac',
    sizeBytes: 50000000,
    modifiedTimeMs: 1600000000000,
    availability: 'available'
  };

  const mockTrackRepo = {
    save: vi.fn().mockResolvedValue(undefined),
    getTrackById: vi.fn().mockResolvedValue(null)
  } as any;

  const mockAudioFileRepo = {
    getById: vi.fn().mockResolvedValue(sourceFile)
  } as any;

  const mockDbAdapter = {} as any;
  const mockEventBus = { publish: vi.fn() } as any;

  const sampleCue = `
PERFORMER "Pink Floyd"
TITLE "The Dark Side of the Moon"
FILE "DarkSide.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Speak to Me / Breathe"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "On the Run"
    INDEX 01 03:57:00
  TRACK 03 AUDIO
    TITLE "Time"
    INDEX 01 07:30:00
`;

  it('calculates virtual track start and end boundaries accurately', () => {
    const service = new VirtualTrackService(mockTrackRepo, mockAudioFileRepo, mockDbAdapter, mockEventBus);
    const parsed = CueParser.parse(sampleCue);

    const defs = service.createVirtualTrackDefinitions(parsed.cueSheet, sourceFile);
    expect(defs.length).toBe(3);

    // Track 01: starts at 0ms, ends at Track 02 start (3 * 60 + 57 = 237,000ms)
    expect(defs[0]!.trackNumber).toBe(1);
    expect(defs[0]!.startTimeMs).toBe(0);
    expect(defs[0]!.endTimeMs).toBe(237000);
    expect(defs[0]!.durationMs).toBe(237000);
    expect(defs[0]!.title).toBe('Speak to Me / Breathe');
    expect(defs[0]!.virtualTrackId).toBe(`cue_trk_${sourceFile.id}_1`);

    // Track 02: starts at 237,000ms, ends at Track 03 start (7 * 60 + 30 = 450,000ms)
    expect(defs[1]!.trackNumber).toBe(2);
    expect(defs[1]!.startTimeMs).toBe(237000);
    expect(defs[1]!.endTimeMs).toBe(450000);
    expect(defs[1]!.durationMs).toBe(213000);

    // Track 03: last track, ends at null or source file duration
    expect(defs[2]!.trackNumber).toBe(3);
    expect(defs[2]!.startTimeMs).toBe(450000);
  });

  it('imports virtual tracks into track repository without altering original source file', async () => {
    const service = new VirtualTrackService(mockTrackRepo, mockAudioFileRepo, mockDbAdapter, mockEventBus);
    const parsed = CueParser.parse(sampleCue);
    const defs = service.createVirtualTrackDefinitions(parsed.cueSheet, sourceFile);

    await service.importVirtualTracks(defs);

    expect(mockTrackRepo.save).toHaveBeenCalledTimes(3);
    const savedTrack: Track = mockTrackRepo.save.mock.calls[0][0];

    expect(savedTrack.id).toBe(`cue_trk_${sourceFile.id}_1`);
    expect(savedTrack.fileId).toBe(sourceFile.id);
    expect(savedTrack.isVirtualTrack).toBe(true);
    expect(savedTrack.virtualStartTimeMs).toBe(0);
    expect(savedTrack.virtualEndTimeMs).toBe(237000);
    expect(savedTrack.title).toBe('Speak to Me / Breathe');
    expect(savedTrack.artistName).toBe('Pink Floyd');
    expect(savedTrack.albumTitle).toBe('The Dark Side of the Moon');
  });
});
