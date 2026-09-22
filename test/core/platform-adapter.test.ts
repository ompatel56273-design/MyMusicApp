import { describe, it, expect } from 'vitest';
import { PlatformAdapter } from '../../src/core/platform/platform-adapter';

describe('PlatformAdapter', () => {
  it('should return platform capability object', () => {
    const caps = PlatformAdapter.getCapabilities();
    expect(caps).toBeDefined();
    expect(typeof caps.hasWebWorkers).toBe('boolean');
    expect(typeof caps.hasWebAudio).toBe('boolean');
    expect(typeof caps.hasIndexedDB).toBe('boolean');
  });
});
