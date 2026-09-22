import { describe, it, expect, vi } from 'vitest';
import { RouterService } from '../../src/ui/navigation/router-service';

describe('RouterService', () => {
  it('should initialize with the default route and empty params', () => {
    const router = new RouterService('home');
    expect(router.current.route).toBe('home');
    expect(router.current.params).toEqual({});
  });

  it('should navigate to new routes and notify subscribers', () => {
    const router = new RouterService('home');
    const subscriber = vi.fn();
    const sub = router.subscribe(subscriber);

    router.navigate('library', { tab: 'artists' });

    expect(router.current.route).toBe('library');
    expect(router.current.params).toEqual({ tab: 'artists' });
    expect(subscriber).toHaveBeenCalledWith(router.current);

    sub.dispose();
  });

  it('should support back and forward history traversal', () => {
    const router = new RouterService('home');
    router.navigate('library');
    router.navigate('settings');

    expect(router.current.route).toBe('settings');

    expect(router.back()).toBe(true);
    expect(router.current.route).toBe('library');

    expect(router.back()).toBe(true);
    expect(router.current.route).toBe('home');

    expect(router.back()).toBe(false);

    expect(router.forward()).toBe(true);
    expect(router.current.route).toBe('library');
  });

  it('should not push duplicate state if navigating to the same route and params', () => {
    const router = new RouterService('home');
    router.navigate('library', { tab: 'songs' });
    router.navigate('library', { tab: 'songs' });

    expect(router.back()).toBe(true);
    expect(router.current.route).toBe('home');
  });
});
