import type { RouteParams } from '../navigation/route-types';

/**
 * Standard View Lifecycle Contract.
 * Every screen view implements mount and unmount to prevent DOM/event memory leaks.
 */
export interface IView {
  mount(container: HTMLElement, params?: RouteParams): void;
  unmount(): void;
  updateParams?(params: RouteParams): void;
}
