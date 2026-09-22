import type { Disposable } from '../types/common';

export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

export interface IEventBus {
  publish<T = unknown>(event: string, data: T): void;
  subscribe<T = unknown>(event: string, handler: EventHandler<T>): Disposable;
  clear(): void;
}

/**
 * High-performance, decoupled synchronous/asynchronous EventBus.
 * Used for inter-layer messaging without violating architectural boundaries.
 */
export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();

  public publish<T = unknown>(event: string, data: T): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    for (const handler of eventHandlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[EventBus] Error in async handler for event "${event}":`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${event}":`, err);
      }
    }
  }

  public subscribe<T = unknown>(event: string, handler: EventHandler<T>): Disposable {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const set = this.handlers.get(event)!;
    set.add(handler as EventHandler<any>);

    return {
      dispose: () => {
        set.delete(handler as EventHandler<any>);
        if (set.size === 0) {
          this.handlers.delete(event);
        }
      }
    };
  }

  public getHandlerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  public clear(): void {
    this.handlers.clear();
  }
}
