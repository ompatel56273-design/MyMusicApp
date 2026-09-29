import type { EntityId, AudioFormatInfo } from '../../domain/value-objects/audio-types';
import type { AudioFile } from '../../domain/entities/models';

export interface CueTime {
  readonly minutes: number;
  readonly seconds: number;
  readonly frames: number; // 75 frames per second
}

export interface CueIndex {
  readonly number: number; // e.g. 0 or 1
  readonly time: CueTime;
  readonly positionMs: number;
}

export interface CueTrackParsed {
  readonly trackNumber: number;
  readonly dataType: string; // e.g. "AUDIO"
  readonly title?: string | undefined;
  readonly performer?: string | undefined;
  readonly composer?: string | undefined;
  readonly isrc?: string | undefined;
  readonly flags?: readonly string[] | undefined;
  readonly index00?: CueIndex | undefined;
  readonly index01?: CueIndex | undefined;
  readonly pregap?: CueTime | undefined;
  readonly postgap?: CueTime | undefined;
}

export interface CueFileParsed {
  readonly filename: string;
  readonly fileType: string; // e.g. "WAVE", "MP3", "FLAC"
  readonly tracks: readonly CueTrackParsed[];
}

export interface CueSheet {
  readonly id: EntityId;
  readonly title?: string | undefined;
  readonly performer?: string | undefined;
  readonly composer?: string | undefined;
  readonly catalog?: string | undefined;
  readonly remComments: readonly string[];
  readonly files: readonly CueFileParsed[];
  readonly rawText?: string | undefined;
}

export interface CueValidationError {
  readonly code: string;
  readonly message: string;
  readonly line?: number | undefined;
}

export interface CueValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly line?: number | undefined;
}

export interface CueValidationResult {
  readonly valid: boolean;
  readonly errors: readonly CueValidationError[];
  readonly warnings: readonly CueValidationWarning[];
}

export interface ParsedCueResult {
  readonly cueSheet: CueSheet;
  readonly validation: CueValidationResult;
}

export interface VirtualTrackDefinition {
  readonly virtualTrackId: EntityId;
  readonly sourceFileId: EntityId;
  readonly sourcePath: string;
  readonly trackNumber: number;
  readonly title: string;
  readonly performer?: string | undefined;
  readonly albumTitle?: string | undefined;
  readonly albumArtistName?: string | undefined;
  readonly genreName?: string | undefined;
  readonly year?: number | undefined;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly pregapMs?: number | undefined;
  readonly postgapMs?: number | undefined;
  readonly sourceFormat: AudioFormatInfo;
  readonly cueSheetId: EntityId;
}

export interface CueImportPreview {
  readonly cueSheet: CueSheet;
  readonly sourceAudioFile?: AudioFile | undefined;
  readonly virtualTracks: readonly VirtualTrackDefinition[];
  readonly validation: CueValidationResult;
}
