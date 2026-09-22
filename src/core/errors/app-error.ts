/**
 * Application Error Hierarchy
 * Standardized across Audio, Scanner, Metadata, Database, and UI layers.
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface AppErrorOptions {
  severity?: ErrorSeverity | undefined;
  userMessage?: string | undefined;
  details?: Record<string, unknown> | undefined;
  cause?: Error | undefined;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    options: AppErrorOptions = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = options.severity ?? 'error';
    this.userMessage = options.userMessage ?? 'An unexpected error occurred.';
    this.details = options.details;
  }
}

export class AudioEngineError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown> | undefined, cause?: Error | undefined) {
    super(message, code, {
      severity: 'error',
      userMessage: 'Audio playback encountered an issue.',
      details,
      cause
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown> | undefined, cause?: Error | undefined) {
    super(message, code, {
      severity: 'error',
      userMessage: 'Database operation failed.',
      details,
      cause
    });
  }
}

export class ScannerError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown> | undefined, cause?: Error | undefined) {
    super(message, code, {
      severity: 'warning',
      userMessage: 'Library scan encountered an unreadable file or folder.',
      details,
      cause
    });
  }
}

export class MetadataError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown> | undefined, cause?: Error | undefined) {
    super(message, code, {
      severity: 'warning',
      userMessage: 'Could not parse media metadata.',
      details,
      cause
    });
  }
}
