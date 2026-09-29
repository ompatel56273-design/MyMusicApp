import type { Track, AudioFile } from '../../domain/entities/models';
import type { AudioContainer } from '../../domain/value-objects/audio-types';

export interface EditableMetadataFields {
  title?: string | undefined;
  artist?: string | undefined;
  albumArtist?: string | undefined;
  album?: string | undefined;
  genre?: string | undefined;
  year?: number | undefined;
  trackNumber?: number | undefined;
  totalTracks?: number | undefined;
  discNumber?: number | undefined;
  totalDiscs?: number | undefined;
  composer?: string | undefined;
  comment?: string | undefined;
}

export type ArtworkWriteAction = 'keep' | 'replace' | 'remove';

export interface ArtworkPayload {
  action: ArtworkWriteAction;
  data?: Uint8Array | undefined;
  mimeType?: string | undefined;
}

export interface SingleTrackEditPayload extends EditableMetadataFields {
  artwork?: ArtworkPayload | undefined;
}

export type BatchFieldStrategy = 'keep' | 'replace';

export interface BatchFieldOption<T> {
  strategy: BatchFieldStrategy;
  value?: T | undefined;
}

export interface BatchEditPayload {
  title?: BatchFieldOption<string> | undefined;
  artist?: BatchFieldOption<string> | undefined;
  albumArtist?: BatchFieldOption<string> | undefined;
  album?: BatchFieldOption<string> | undefined;
  genre?: BatchFieldOption<string> | undefined;
  year?: BatchFieldOption<number> | undefined;
  trackNumbering?: {
    enabled: boolean;
    startNumber: number;
  } | undefined;
  composer?: BatchFieldOption<string> | undefined;
  comment?: BatchFieldOption<string> | undefined;
  artwork?: ArtworkPayload | undefined;
}

export interface NormalizationOptions {
  trimWhitespace: boolean;
  collapseWhitespace: boolean;
  titleCase: boolean;
  removeComments: boolean;
}

export interface TrackChangePreview {
  track: Track;
  audioFile?: AudioFile | undefined;
  currentMetadata: EditableMetadataFields & { artworkMime?: string | undefined };
  proposedMetadata: EditableMetadataFields & { artworkAction?: ArtworkWriteAction | undefined };
  proposedFilename?: string | undefined;
  canWrite: boolean;
  reasonIfCannotWrite?: string | undefined;
}

export interface BatchPreviewResult {
  previews: readonly TrackChangePreview[];
  totalSelected: number;
  writableCount: number;
  unsupportedCount: number;
  collisions: readonly string[];
}

export interface SingleTrackWriteResult {
  success: boolean;
  trackId: string;
  updatedTrack?: Track | undefined;
  newFilePath?: string | undefined;
  error?: string | undefined;
}

export interface BatchWriteResult {
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  results: readonly {
    trackId: string;
    title: string;
    status: 'success' | 'failed' | 'skipped';
    reason?: string | undefined;
    newFilePath?: string | undefined;
  }[];
}

export const SUPPORTED_WRITE_CONTAINERS: readonly AudioContainer[] = [
  'mp3',
  'flac',
  'm4a',
  'aac',
  'wav'
];
