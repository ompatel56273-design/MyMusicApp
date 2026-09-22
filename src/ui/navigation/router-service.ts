import type { AppRoute, RouteParams, RouteState } from './route-types';
import type { Disposable } from '../../core/types/common';

export type RouteListener = (state: RouteState) => void;

/**
 * Lightweight, client-side Router Service.
 * Manages route transitions, history stack, and active parameters.
 */
export class RouterService {
  private history: RouteState[] = [];
  private currentIndex = -1;
  private listeners = new Set<RouteListener>();

  constructor(initialRoute: AppRoute = 'home', initialParams: RouteParams = {}) {
    this.navigate(initialRoute, initialParams);
  }

  public get current(): RouteState {
    return this.history[this.currentIndex] ?? {
      route: 'home',
      params: {},
      timestamp: Date.now()
    };
  }

  public navigate(route: AppRoute, params: RouteParams = {}): void {
    const newState: RouteState = {
      route,
      params,
      timestamp: Date.now()
    };

    // If navigating to the exact same route and params, skip duplicate push
    const current = this.current;
    if (
      current.route === route &&
      JSON.stringify(current.params) === JSON.stringify(params) &&
      this.history.length > 0
    ) {
      return;
    }

    // Truncate forward history if navigating from a past index
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(newState);
    this.currentIndex = this.history.length - 1;

    // Cap history size to 50
    if (this.history.length > 50) {
      this.history.shift();
      this.currentIndex--;
    }

    this.notifyListeners(newState);
  }

  public back(): boolean {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const state = this.history[this.currentIndex]!;
      this.notifyListeners(state);
      return true;
    }
    return false;
  }

  public forward(): boolean {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const state = this.history[this.currentIndex]!;
      this.notifyListeners(state);
      return true;
    }
    return false;
  }

  public subscribe(listener: RouteListener): Disposable {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  }

  private notifyListeners(state: RouteState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[RouterService] Error in route listener:', err);
      }
    }
  }
}
