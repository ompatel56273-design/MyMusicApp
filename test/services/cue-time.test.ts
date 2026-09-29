import { describe, it, expect } from 'vitest';
import { CueTimeUtil } from '../../src/services/cue/cue-time';

describe('CueTimeUtil', () => {
  it('converts MM:SS:FF cue timestamp object to exact milliseconds', () => {
    // 00:00:00 -> 0ms
    expect(CueTimeUtil.cueTimeToMilliseconds({ minutes: 0, seconds: 0, frames: 0 })).toBe(0);

    // 01:00:00 -> 60,000ms
    expect(CueTimeUtil.cueTimeToMilliseconds({ minutes: 1, seconds: 0, frames: 0 })).toBe(60000);

    // 00:01:00 -> 1,000ms
    expect(CueTimeUtil.cueTimeToMilliseconds({ minutes: 0, seconds: 1, frames: 0 })).toBe(1000);

    // 00:00:75 -> 1,000ms (75 frames = 1 second)
    expect(CueTimeUtil.cueTimeToMilliseconds({ minutes: 0, seconds: 0, frames: 75 })).toBe(1000);

    // 00:00:37 -> Math.floor((37 * 1000) / 75) = 493ms
    expect(CueTimeUtil.cueTimeToMilliseconds({ minutes: 0, seconds: 0, frames: 37 })).toBe(493);
  });

  it('converts formatted string MM:SS:FF to CueTime object and milliseconds', () => {
    const timeObj = CueTimeUtil.parseCueTimeString('02:35:45');
    expect(timeObj).not.toBeNull();
    expect(timeObj).toEqual({ minutes: 2, seconds: 35, frames: 45 });
    expect(CueTimeUtil.cueTimeToMilliseconds(timeObj!)).toBe((2 * 60 + 35) * 1000 + Math.floor((45 * 1000) / 75));
    expect(CueTimeUtil.parseCueTimeString('00:00:00')).toEqual({ minutes: 0, seconds: 0, frames: 0 });
  });

  it('converts milliseconds back to CueTime object', () => {
    const timeObj = CueTimeUtil.millisecondsToCueTime(65493);
    expect(timeObj.minutes).toBe(1);
    expect(timeObj.seconds).toBe(5);
    expect(timeObj.frames).toBe(36);
  });

  it('formats milliseconds to MM:SS:FF standard string', () => {
    expect(CueTimeUtil.formatCueTime(0)).toBe('00:00:00');
    expect(CueTimeUtil.formatCueTime(60000)).toBe('01:00:00');
    expect(CueTimeUtil.formatCueTime(65493)).toBe('01:05:36');
  });

  it('handles invalid format strings gracefully by returning null', () => {
    expect(CueTimeUtil.parseCueTimeString('invalid')).toBeNull();
    expect(CueTimeUtil.parseCueTimeString('12:34')).toBeNull();
    expect(CueTimeUtil.parseCueTimeString('99:99:99')).toBeNull();
  });
});
