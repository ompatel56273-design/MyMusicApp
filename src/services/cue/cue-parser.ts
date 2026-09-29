import type {
  CueSheet,
  CueFileParsed,
  CueTrackParsed,
  CueIndex,
  ParsedCueResult,
  CueValidationError,
  CueValidationWarning
} from './cue-types';
import { CueTimeUtil } from './cue-time';

export class CueParser {
  /**
   * Parses raw CUE sheet text into a normalized CueSheet object with validation results.
   */
  public static parse(rawText: string, customCueId?: string): ParsedCueResult {
    const errors: CueValidationError[] = [];
    const warnings: CueValidationWarning[] = [];

    const lines = rawText.split(/\r?\n/);
    let title: string | undefined = undefined;
    let performer: string | undefined = undefined;
    let composer: string | undefined = undefined;
    let catalog: string | undefined = undefined;
    const remComments: string[] = [];

    const files: CueFileParsed[] = [];
    let currentFile: { filename: string; fileType: string; tracks: CueTrackParsed[] } | null = null;
    let currentTrack: {
      trackNumber: number;
      dataType: string;
      title?: string;
      performer?: string;
      composer?: string;
      isrc?: string;
      flags?: string[];
      index00?: CueIndex;
      index01?: CueIndex;
      pregap?: any;
      postgap?: any;
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const rawLine = lines[i]!;
      const trimmed = rawLine.trim();

      if (!trimmed) continue;

      // Handle REM comments
      if (trimmed.toUpperCase().startsWith('REM ')) {
        const commentBody = trimmed.substring(4).trim();
        remComments.push(commentBody);

        // Check for REM COMPOSER / REM DATE
        if (commentBody.toUpperCase().startsWith('COMPOSER ')) {
          const compVal = this.parseQuotedOrRest(commentBody.substring(9));
          if (compVal && !composer) composer = compVal;
        }
        continue;
      }

      // Tokenize line: first word is command
      const spaceIdx = trimmed.indexOf(' ');
      const command = (spaceIdx !== -1 ? trimmed.substring(0, spaceIdx) : trimmed).toUpperCase();
      const rest = spaceIdx !== -1 ? trimmed.substring(spaceIdx + 1).trim() : '';

      switch (command) {
        case 'CATALOG':
          catalog = this.parseQuotedOrRest(rest);
          break;

        case 'TITLE': {
          const val = this.parseQuotedOrRest(rest);
          if (currentTrack) {
            currentTrack.title = val;
          } else {
            title = val;
          }
          break;
        }

        case 'PERFORMER': {
          const val = this.parseQuotedOrRest(rest);
          if (currentTrack) {
            currentTrack.performer = val;
          } else {
            performer = val;
          }
          break;
        }

        case 'COMPOSER': {
          const val = this.parseQuotedOrRest(rest);
          if (currentTrack) {
            currentTrack.composer = val;
          } else {
            composer = val;
          }
          break;
        }

        case 'FILE': {
          const fileMatch = rest.match(/^(?:"([^"]+)"|(\S+))\s+(.*)$/i);
          if (fileMatch) {
            const fname = fileMatch[1] || fileMatch[2] || 'unknown';
            const ftype = (fileMatch[3] || 'WAVE').trim().toUpperCase();

            // Save previous track if any
            if (currentTrack && currentFile) {
              currentFile.tracks.push(currentTrack as CueTrackParsed);
              currentTrack = null;
            }

            currentFile = {
              filename: fname,
              fileType: ftype,
              tracks: []
            };
            files.push(currentFile);
          } else {
            warnings.push({
              code: 'MALFORMED_FILE_DECLARATION',
              message: `Malformed FILE line at line ${lineNum}: "${trimmed}"`,
              line: lineNum
            });
          }
          break;
        }

        case 'TRACK': {
          const trackMatch = rest.match(/^(\d+)\s+(\S+)/i);
          if (trackMatch) {
            const trackNum = parseInt(trackMatch[1]!, 10);
            const dataType = trackMatch[2]!.toUpperCase();

            // If no FILE declared yet, create a default fallback file
            if (!currentFile) {
              currentFile = { filename: 'unknown.flac', fileType: 'WAVE', tracks: [] };
              files.push(currentFile);
              warnings.push({
                code: 'TRACK_BEFORE_FILE',
                message: `TRACK declared before FILE at line ${lineNum}. Created default file handle.`,
                line: lineNum
              });
            }

            // Save previous track if any
            if (currentTrack && currentFile) {
              currentFile.tracks.push(currentTrack as CueTrackParsed);
            }

            currentTrack = {
              trackNumber: trackNum,
              dataType
            };
          } else {
            warnings.push({
              code: 'MALFORMED_TRACK_DECLARATION',
              message: `Malformed TRACK line at line ${lineNum}: "${trimmed}"`,
              line: lineNum
            });
          }
          break;
        }

        case 'INDEX': {
          if (!currentTrack) {
            warnings.push({
              code: 'INDEX_WITHOUT_TRACK',
              message: `INDEX declared without active TRACK at line ${lineNum}`,
              line: lineNum
            });
            break;
          }

          const indexMatch = rest.match(/^(\d+)\s+(\d{2}:\d{2}:\d{2})/);
          if (indexMatch) {
            const idxNum = parseInt(indexMatch[1]!, 10);
            const timeStr = indexMatch[2]!;
            const timeObj = CueTimeUtil.parseCueTimeString(timeStr);

            if (timeObj) {
              const posMs = CueTimeUtil.cueTimeToMilliseconds(timeObj);
              const idxRecord: CueIndex = { number: idxNum, time: timeObj, positionMs: posMs };

              if (idxNum === 0) {
                currentTrack.index00 = idxRecord;
              } else if (idxNum === 1) {
                currentTrack.index01 = idxRecord;
              }
            } else {
              errors.push({
                code: 'INVALID_INDEX_TIMESTAMP',
                message: `Invalid INDEX timestamp "${timeStr}" at line ${lineNum}`,
                line: lineNum
              });
            }
          } else {
            warnings.push({
              code: 'MALFORMED_INDEX_DECLARATION',
              message: `Malformed INDEX declaration at line ${lineNum}: "${trimmed}"`,
              line: lineNum
            });
          }
          break;
        }

        case 'PREGAP': {
          if (currentTrack) {
            const timeObj = CueTimeUtil.parseCueTimeString(rest);
            if (timeObj) currentTrack.pregap = timeObj;
          }
          break;
        }

        case 'POSTGAP': {
          if (currentTrack) {
            const timeObj = CueTimeUtil.parseCueTimeString(rest);
            if (timeObj) currentTrack.postgap = timeObj;
          }
          break;
        }

        case 'FLAGS': {
          if (currentTrack) {
            currentTrack.flags = rest.split(/\s+/).map(f => f.toUpperCase());
          }
          break;
        }

        case 'ISRC': {
          if (currentTrack) {
            currentTrack.isrc = this.parseQuotedOrRest(rest);
          }
          break;
        }

        default:
          // Ignore unhandled/unknown CUE lines safely
          break;
      }
    }

    // Flush final track
    if (currentTrack && currentFile) {
      currentFile.tracks.push(currentTrack as CueTrackParsed);
    }

    // Validation checks
    if (files.length === 0) {
      errors.push({ code: 'NO_FILES_FOUND', message: 'No FILE declarations found in CUE sheet.' });
    }

    let totalTracks = 0;
    const trackNumbersSet = new Set<number>();

    for (const f of files) {
      for (const trk of f.tracks) {
        totalTracks++;
        if (!trk.index01) {
          errors.push({
            code: 'MISSING_INDEX_01',
            message: `Track ${trk.trackNumber} is missing required INDEX 01.`
          });
        }
        if (trackNumbersSet.has(trk.trackNumber)) {
          warnings.push({
            code: 'DUPLICATE_TRACK_NUMBER',
            message: `Duplicate track number ${trk.trackNumber} detected in CUE sheet.`
          });
        } else {
          trackNumbersSet.add(trk.trackNumber);
        }
      }
    }

    if (totalTracks === 0) {
      errors.push({ code: 'NO_TRACKS_FOUND', message: 'No TRACK declarations found in CUE sheet.' });
    }

    const cueId = customCueId || `cue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const cueSheet: CueSheet = {
      id: cueId,
      title,
      performer,
      composer,
      catalog,
      remComments,
      files,
      rawText
    };

    return {
      cueSheet,
      validation: {
        valid: errors.length === 0,
        errors,
        warnings
      }
    };
  }

  private static parseQuotedOrRest(str: string): string {
    const trimmed = str.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    // Also handle case where closing quote is missing or trailing chars exist
    const match = trimmed.match(/^"([^"]*)"/);
    if (match) {
      return match[1]!;
    }
    return trimmed;
  }
}
