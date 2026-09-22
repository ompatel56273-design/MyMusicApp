import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../../src/core/logging/logger';

describe('Logger', () => {
  it('should redact user paths in logged messages for privacy', () => {
    const logger = new Logger('Test');
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.info('Scanning C:\\Users\\ompat\\Music\\track.mp3');

    expect(consoleSpy).toHaveBeenCalled();
    const loggedMessage = consoleSpy.mock.calls[0][0];
    expect(loggedMessage).toContain('<REDACTED_USER_PATH>');
    expect(loggedMessage).not.toContain('ompat');

    consoleSpy.mockRestore();
  });

  it('should respect minimum log levels', () => {
    const logger = new Logger('Test');
    logger.setMinLevel('error');

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('should be ignored');
    logger.info('should be ignored');
    logger.error('should be logged');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
