import { describe, it, expect } from 'vitest';
import { AppError, AudioEngineError, DatabaseError } from '../../src/core/errors/app-error';

describe('AppError Hierarchy', () => {
  it('should construct AppError with proper code and severity', () => {
    const err = new AppError('File missing', 'ERR_FILE_NOT_FOUND', { severity: 'error' });
    expect(err.name).toBe('AppError');
    expect(err.code).toBe('ERR_FILE_NOT_FOUND');
    expect(err.severity).toBe('error');
  });

  it('should construct specialized AudioEngineError', () => {
    const audioErr = new AudioEngineError('Decode failure', 'ERR_AUDIO_DECODE');
    expect(audioErr.name).toBe('AudioEngineError');
    expect(audioErr.code).toBe('ERR_AUDIO_DECODE');
    expect(audioErr.userMessage).toContain('Audio playback');
  });

  it('should construct specialized DatabaseError', () => {
    const dbErr = new DatabaseError('Query failed', 'ERR_DB_QUERY');
    expect(dbErr.name).toBe('DatabaseError');
    expect(dbErr.code).toBe('ERR_DB_QUERY');
  });
});
