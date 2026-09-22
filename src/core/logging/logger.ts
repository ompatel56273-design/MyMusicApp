import type { ILogger, LogLevel } from '../types/common';

/**
 * Privacy-preserving, leveled logger.
 * Sanitizes absolute file paths to protect user privacy.
 */
export class Logger implements ILogger {
  private readonly namespace: string;
  private minLevel: LogLevel = 'info';

  constructor(namespace: string = 'App') {
    this.namespace = namespace;
    // Check development environment portably
    const isDev = (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) ||
                  (typeof globalThis !== 'undefined' && (globalThis as any).__DEV__);
    if (isDev) {
      this.minLevel = 'debug';
    }
  }

  public setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('DEBUG', message), this.sanitizeContext(context));
    }
  }

  public info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('INFO', message), this.sanitizeContext(context));
    }
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('WARN', message), this.sanitizeContext(context));
    }
  }

  public error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(
        this.formatMessage('ERROR', message),
        error instanceof Error ? error.message : error,
        this.sanitizeContext(context)
      );
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.namespace}] ${this.sanitize(message)}`;
  }

  /**
   * Redacts user home and absolute paths for privacy
   */
  private sanitize(input: string): string {
    // Redact Windows and Unix absolute user paths
    return input
      .replace(/[A-Za-z]:\\[Uu]sers\\[^\\]+/g, '<REDACTED_USER_PATH>')
      .replace(/\/home\/[^\/]+/g, '<REDACTED_USER_PATH>')
      .replace(/\/Users\/[^\/]+/g, '<REDACTED_USER_PATH>');
  }

  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[this.minLevel];
  }
}
