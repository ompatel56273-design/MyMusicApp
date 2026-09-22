export interface VirtualScrollerOptions<T> {
  container: HTMLElement;
  items: readonly T[];
  itemHeight: number;
  overscan?: number | undefined;
  renderItem: (item: T, index: number) => HTMLElement;
  onItemUnmount?: ((element: HTMLElement, item: T, index: number) => void) | undefined;
}

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  renderedCount: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
}
