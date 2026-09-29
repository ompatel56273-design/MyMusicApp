import type { CueTime } from './cue-types';

export class CueTimeUtil {
  public static readonly FRAMES_PER_SECOND = 75;
  public static readonly MS_PER_FRAME = 1000 / 75; // 13.333333333333334 ms

  /**
   * Converts a CUE timestamp (minutes, seconds, frames) or string "MM:SS:FF" into integer milliseconds.
   */
  public static cueTimeToMilliseconds(time: CueTime | string): number {
    if (typeof time === 'string') {
      const parsed = this.parseCueTimeString(time);
      if (!parsed) return 0;
      time = parsed;
    }

    const { minutes, seconds, frames } = time;
    const totalSeconds = minutes * 60 + seconds;
    const framesMs = Math.floor((frames * 1000) / this.FRAMES_PER_SECOND);
    return totalSeconds * 1000 + framesMs;
  }

  /**
   * Converts milliseconds into a structured CueTime object (minutes, seconds, frames).
   */
  public static millisecondsToCueTime(ms: number): CueTime {
    if (ms <= 0 || isNaN(ms)) {
      return { minutes: 0, seconds: 0, frames: 0 };
    }

    const totalSeconds = Math.floor(ms / 1000);
    const remainderMs = ms % 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.min(74, Math.floor((remainderMs * this.FRAMES_PER_SECOND) / 1000));

    return { minutes, seconds, frames };
  }

  /**
   * Formats a CueTime or milliseconds as "MM:SS:FF" string (zero-padded).
   */
  public static formatCueTime(timeOrMs: CueTime | number): string {
    const cueTime = typeof timeOrMs === 'number' ? this.millisecondsToCueTime(timeOrMs) : timeOrMs;
    const mm = String(cueTime.minutes).padStart(2, '0');
    const ss = String(cueTime.seconds).padStart(2, '0');
    const ff = String(cueTime.frames).padStart(2, '0');
    return `${mm}:${ss}:${ff}`;
  }

  /**
   * Parses a CUE timestamp string "MM:SS:FF" into a CueTime object.
   */
  public static parseCueTimeString(timeStr: string): CueTime | null {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.trim().split(':');
    if (parts.length !== 3) return null;

    const minutes = parseInt(parts[0]!, 10);
    const seconds = parseInt(parts[1]!, 10);
    const frames = parseInt(parts[2]!, 10);

    if (isNaN(minutes) || isNaN(seconds) || isNaN(frames)) return null;
    if (minutes < 0 || seconds < 0 || seconds >= 60 || frames < 0 || frames >= 75) return null;

    return { minutes, seconds, frames };
  }
}
