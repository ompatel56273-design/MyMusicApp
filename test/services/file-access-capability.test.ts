import { describe, it, expect } from 'vitest';
import { FileAccessCapabilityService } from '../../src/services/scanner/file-access-capability';

describe('FileAccessCapabilityService', () => {
  it('returns singleton instance', () => {
    const s1 = FileAccessCapabilityService.getInstance();
    const s2 = FileAccessCapabilityService.getInstance();
    expect(s1).toBe(s2);
  });

  it('detects capabilities in current environment', () => {
    const service = FileAccessCapabilityService.getInstance();
    const caps = service.getCapabilities();

    expect(typeof caps.hasDirectoryPicker).toBe('boolean');
    expect(typeof caps.hasFilePicker).toBe('boolean');
    expect(typeof caps.hasPersistentHandles).toBe('boolean');
    expect(typeof caps.isMobile).toBe('boolean');
    expect(typeof caps.summary).toBe('string');
  });

  it('queries directory permission gracefully', async () => {
    const service = FileAccessCapabilityService.getInstance();
    const mockHandle = {
      queryPermission: async () => 'granted'
    } as unknown as FileSystemDirectoryHandle;

    const status = await service.queryDirectoryPermission(mockHandle);
    expect(status).toBe('GRANTED');
  });

  it('handles denied directory permission', async () => {
    const service = FileAccessCapabilityService.getInstance();
    const mockHandle = {
      queryPermission: async () => 'denied'
    } as unknown as FileSystemDirectoryHandle;

    const status = await service.queryDirectoryPermission(mockHandle);
    expect(status).toBe('DENIED');
  });
});
