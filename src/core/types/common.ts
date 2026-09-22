/**
 * Core type definitions for Music Player App
 * Part of Phase 0 - Project Foundation
 */

export type EntityId = string;

export interface Disposable {
  dispose(): void | Promise<void>;
}

export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export const Ok = <T>(data: T): Result<T, never> => ({
  success: true,
  data
});

export const Err = <E>(error: E): Result<never, E> => ({
  success: false,
  error
});

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
}
