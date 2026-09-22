import { describe, it, expect } from 'vitest';
import { LrcParser } from '../../src/services/lyrics/lrc-parser';

describe('LrcParser', () => {
  it('parses standard [mm:ss.xx] timestamped cues correctly', () => {
    const lrc = `
[00:12.50]First line
[00:15.80]Second line
[01:02.00]Third line
    `;
    const result = LrcParser.parse(lrc, 'track_1');

    expect(result.trackId).toBe('track_1');
    expect(result.type).toBe('synced');
    expect(result.lines).toHaveLength(3);

    expect(result.lines[0]).toEqual({
      timeMs: 12500,
      text: 'First line'
    });
    expect(result.lines[1]).toEqual({
      timeMs: 15800,
      text: 'Second line'
    });
    expect(result.lines[2]).toEqual({
      timeMs: 62000,
      text: 'Third line'
    });
  });

  it('parses 3-digit millisecond timestamps [mm:ss.xxx]', () => {
    const lrc = `
[00:05.123]Line with ms
[02:10.999]Ending cue
    `;
    const result = LrcParser.parse(lrc, 'track_2');
    expect(result.type).toBe('synced');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].timeMs).toBe(5123);
    expect(result.lines[1].timeMs).toBe(130999);
  });

  it('parses second-precision timestamps [mm:ss]', () => {
    const lrc = `
[00:04]Intro
[00:10]Verse
    `;
    const result = LrcParser.parse(lrc);
    expect(result.type).toBe('synced');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].timeMs).toBe(4000);
    expect(result.lines[1].timeMs).toBe(10000);
  });

  it('extracts metadata tags and applies offset if specified', () => {
    const lrc = `
[ti:Test Title]
[ar:Test Artist]
[al:Test Album]
[by:Author]
[offset:500]
[00:10.00]Line with +500ms offset
    `;
    const raw = LrcParser.parseRaw(lrc);
    expect(raw.metadata.title).toBe('Test Title');
    expect(raw.metadata.artist).toBe('Test Artist');
    expect(raw.metadata.album).toBe('Test Album');
    expect(raw.metadata.by).toBe('Author');
    expect(raw.metadata.offsetMs).toBe(500);

    const result = LrcParser.parse(lrc);
    expect(result.offsetMs).toBe(500);
    expect(result.lines[0].timeMs).toBe(10500);
  });

  it('handles negative offset correctly without dropping below 0ms', () => {
    const lrc = `
[offset:-2000]
[00:01.00]Line clamped
[00:05.00]Line shifted
    `;
    const result = LrcParser.parse(lrc);
    expect(result.lines[0].timeMs).toBe(0); // 1000 - 2000 clamped to 0
    expect(result.lines[1].timeMs).toBe(3000); // 5000 - 2000 = 3000
  });

  it('handles multiple timestamps per line and sorts cues chronologically', () => {
    const lrc = `
[00:10.00][00:30.00]Chorus repeats twice
[00:05.00]Verse 1
    `;
    const result = LrcParser.parse(lrc);
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toEqual({ timeMs: 5000, text: 'Verse 1' });
    expect(result.lines[1]).toEqual({ timeMs: 10000, text: 'Chorus repeats twice' });
    expect(result.lines[2]).toEqual({ timeMs: 30000, text: 'Chorus repeats twice' });
  });

  it('falls back to plain lyrics when no timestamps are detected', () => {
    const plain = `
Just some plain lyrics
Without any time codes
Multiple lines of text
    `;
    const result = LrcParser.parse(plain, 'track_plain');
    expect(result.type).toBe('plain');
    expect(result.plainText).toBe(plain.trim());
    expect(result.lines).toEqual([]);
  });

  it('gracefully handles empty or whitespace-only input', () => {
    const result = LrcParser.parse('   \n\t   ');
    expect(result.type).toBe('plain');
    expect(result.lines).toEqual([]);
    expect(result.plainText).toBe('');
  });

  it('handles malformed tags without throwing exceptions', () => {
    const malformed = `
[invalid tag]
[99:99:99] Bad format
[00:10.00] Valid line
[00:abc] Bad time
    `;
    const result = LrcParser.parse(malformed);
    expect(result.type).toBe('synced');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].text).toBe('Valid line');
  });
});
