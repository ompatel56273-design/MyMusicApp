import { describe, it, expect } from 'vitest';
import { AppLifecycle } from '../../src/app/lifecycle/app-lifecycle';
import { CoreTokens } from '../../src/app/container/service-tokens';

describe('AppLifecycle', () => {
  it('should initialize and reach running state', async () => {
    const lifecycle = new AppLifecycle();
    expect(lifecycle.getState()).toBe('uninitialized');

    await lifecycle.start();
    expect(lifecycle.getState()).toBe('running');

    const container = lifecycle.getContainer();
    expect(container.has(CoreTokens.Logger)).toBe(true);
    expect(container.has(CoreTokens.EventBus)).toBe(true);
  });

  it('should cleanly stop and transition to stopped state', async () => {
    const lifecycle = new AppLifecycle();
    await lifecycle.start();

    await lifecycle.stop();
    expect(lifecycle.getState()).toBe('stopped');
  });
});
