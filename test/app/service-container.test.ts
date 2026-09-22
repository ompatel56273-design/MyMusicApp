import { describe, it, expect } from 'vitest';
import { ServiceContainer, createToken } from '../../src/app/container/service-container';
import { AppError } from '../../src/core/errors/app-error';

describe('ServiceContainer', () => {
  it('should register and resolve singleton instances', () => {
    const container = new ServiceContainer();
    const token = createToken<{ value: number }>('TestSingleton');

    container.registerSingleton(token, { value: 100 });
    const resolved = container.resolve(token);

    expect(resolved.value).toBe(100);
  });

  it('should resolve factories lazily and cache as singleton', () => {
    const container = new ServiceContainer();
    const token = createToken<{ id: string }>('TestFactory');
    let callCount = 0;

    container.registerFactory(token, () => {
      callCount++;
      return { id: `item-${callCount}` };
    });

    const res1 = container.resolve(token);
    const res2 = container.resolve(token);

    expect(callCount).toBe(1);
    expect(res1.id).toBe('item-1');
    expect(res2.id).toBe('item-1');
  });

  it('should throw AppError when resolving an unregistered token', () => {
    const container = new ServiceContainer();
    const token = createToken<string>('Unregistered');

    expect(() => container.resolve(token)).toThrow(AppError);
  });

  it('should correctly report has() for registered tokens', () => {
    const container = new ServiceContainer();
    const token = createToken<string>('Registered');

    expect(container.has(token)).toBe(false);
    container.registerSingleton(token, 'hello');
    expect(container.has(token)).toBe(true);
  });
});
