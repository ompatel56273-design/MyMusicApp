import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/events/event-bus';

describe('EventBus', () => {
  it('should publish events to registered subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test:event', handler);
    bus.publish('test:event', { payload: 42 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ payload: 42 });
  });

  it('should allow unsubscribing via dispose()', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const sub = bus.subscribe('test:event', handler);
    bus.publish('test:event', { first: true });

    sub.dispose();
    bus.publish('test:event', { second: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple subscribers independently', () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.subscribe('multi:event', handler1);
    bus.subscribe('multi:event', handler2);

    bus.publish('multi:event', 'data');

    expect(handler1).toHaveBeenCalledWith('data');
    expect(handler2).toHaveBeenCalledWith('data');
  });
});
