import type { EntityId } from '../../domain/value-objects/audio-types';

export type ScannerState =
  | 'idle'
  | 'preparing'
  | 'scanning'
  | 'synchronizing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ScanRoot {
  readonly id: EntityId;
  readonly path: string;
  readonly name: string;
  readonly isMonitored: boolean;
  readonly lastScannedAt?: number | undefined;
  readonly trackCount: number;
}

export interface ScanSessionStats {
  readonly sessionId: EntityId;
  readonly rootPath: string;
  readonly startTime: number;
  readonly endTime?: number | undefined;
  readonly state: ScannerState;
  readonly filesDiscovered: number;
  readonly filesAdded: number;
  readonly filesUpdated: number;
  readonly filesUnchanged: number;
  readonly filesMissing: number;
  readonly errors: readonly { readonly path: string; readonly message: string }[];
}

export interface ScanProgressReport {
  readonly sessionId: EntityId;
  readonly rootPath: string;
  readonly state: ScannerState;
  readonly currentFile?: string | undefined;
  readonly currentDirectory?: string | undefined;
  readonly filesDiscovered: number;
  readonly filesProcessed: number;
  readonly filesAdded: number;
  readonly filesUpdated: number;
  readonly filesMissing: number;
  readonly isComplete: boolean;
}
