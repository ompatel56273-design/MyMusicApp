import { describe, it, expect } from 'vitest';
import { CueParser } from '../../src/services/cue/cue-parser';

describe('CueParser', () => {
  const sampleCue = `
REM GENRE "Progressive Rock"
REM DATE 1973
PERFORMER "Pink Floyd"
TITLE "The Dark Side of the Moon"
FILE "DarkSide.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Speak to Me / Breathe"
    PERFORMER "Pink Floyd"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "On the Run"
    INDEX 00 03:57:00
    INDEX 01 03:59:70
  TRACK 03 AUDIO
    TITLE "Time"
    INDEX 01 07:31:00
`;

  it('parses album level metadata (PERFORMER, TITLE, REM)', () => {
    const result = CueParser.parse(sampleCue);
    expect(result.validation.valid).toBe(true);
    expect(result.cueSheet.performer).toBe('Pink Floyd');
    expect(result.cueSheet.title).toBe('The Dark Side of the Moon');
    expect(result.cueSheet.remComments.length).toBe(2);
  });

  it('parses audio file declaration and tracks', () => {
    const result = CueParser.parse(sampleCue);
    expect(result.cueSheet.files.length).toBe(1);
    expect(result.cueSheet.files[0]!.filename).toBe('DarkSide.flac');

    const tracks = result.cueSheet.files[0]!.tracks;
    expect(tracks.length).toBe(3);

    expect(tracks[0]!.trackNumber).toBe(1);
    expect(tracks[0]!.title).toBe('Speak to Me / Breathe');
    expect(tracks[0]!.index01?.number).toBe(1);

    expect(tracks[1]!.trackNumber).toBe(2);
    expect(tracks[1]!.title).toBe('On the Run');
    expect(tracks[1]!.index00?.number).toBe(0); // INDEX 00 pregap
    expect(tracks[1]!.index01?.number).toBe(1); // INDEX 01 track start

    expect(tracks[2]!.trackNumber).toBe(3);
    expect(tracks[2]!.title).toBe('Time');
  });

  it('handles empty input gracefully with validation errors', () => {
    const result = CueParser.parse('');
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
  });

  it('handles unquoted single word titles and performers', () => {
    const raw = `
PERFORMER Queen
TITLE News
FILE song.wav WAVE
  TRACK 01 AUDIO
    TITLE WeWillRockYou
    INDEX 01 00:00:00
`;
    const result = CueParser.parse(raw);
    expect(result.cueSheet.performer).toBe('Queen');
    expect(result.cueSheet.title).toBe('News');
    expect(result.cueSheet.files[0]!.tracks[0]!.title).toBe('WeWillRockYou');
  });
});
