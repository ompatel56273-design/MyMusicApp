import type { VirtualScrollerOptions, VirtualWindow } from './virtual-types';

/**
 * Lightweight, zero-dependency native Virtual Scroller.
 * Bounds DOM node rendering to viewport height + overscan buffer,
 * ensuring constant DOM memory regardless of whether library size is 100 or 100,000 items.
 */
export class VirtualScroller<T> {
  private readonly container: HTMLElement;
  private items: readonly T[];
  private readonly itemHeight: number;
  private readonly overscan: number;
  private readonly renderItem: (item: T, index: number) => HTMLElement;
  private readonly onItemUnmount?: ((element: HTMLElement, item: T, index: number) => void) | undefined;

  private viewportEl: HTMLElement;
  private topSpacerEl: HTMLElement;
  private contentEl: HTMLElement;
  private bottomSpacerEl: HTMLElement;

  private currentStartIndex = -1;
  private currentEndIndex = -1;
  private scrollRafId: number | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Track mounted elements for lifecycle disposal
  private renderedElements: Map<number, { element: HTMLElement; item: T }> = new Map();

  constructor(options: VirtualScrollerOptions<T>) {
    this.container = options.container;
    this.items = options.items;
    this.itemHeight = Math.max(1, options.itemHeight);
    this.overscan = options.overscan !== undefined ? options.overscan : 4;
    this.renderItem = options.renderItem;
    this.onItemUnmount = options.onItemUnmount;

    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'virtual-viewport';
    this.viewportEl.style.position = 'relative';
    this.viewportEl.style.width = '100%';

    this.topSpacerEl = document.createElement('div');
    this.topSpacerEl.className = 'virtual-spacer-top';
    this.topSpacerEl.style.width = '100%';
    this.topSpacerEl.style.height = '0px';

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'virtual-content';
    this.contentEl.style.width = '100%';

    this.bottomSpacerEl = document.createElement('div');
    this.bottomSpacerEl.className = 'virtual-spacer-bottom';
    this.bottomSpacerEl.style.width = '100%';
    this.bottomSpacerEl.style.height = '0px';

    this.viewportEl.appendChild(this.topSpacerEl);
    this.viewportEl.appendChild(this.contentEl);
    this.viewportEl.appendChild(this.bottomSpacerEl);

    this.container.appendChild(this.viewportEl);

    this.bindEvents();
    this.updateWindow();
  }

  public setItems(items: readonly T[]): void {
    this.items = items;
    this.updateWindow(true);
  }

  public getItems(): readonly T[] {
    return this.items;
  }

  public getWindow(): VirtualWindow {
    return {
      startIndex: Math.max(0, this.currentStartIndex),
      endIndex: Math.max(0, this.currentEndIndex),
      renderedCount: this.renderedElements.size,
      topSpacerHeight: parseFloat(this.topSpacerEl.style.height || '0'),
      bottomSpacerHeight: parseFloat(this.bottomSpacerEl.style.height || '0')
    };
  }

  public getRenderedCount(): number {
    return this.renderedElements.size;
  }

  public scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
    if (index < 0 || index >= this.items.length) return;
    const targetTop = index * this.itemHeight;
    this.container.scrollTo({ top: targetTop, behavior });
  }

  public refresh(): void {
    this.updateWindow(true);
  }

  public dispose(): void {
    if (this.scrollListener) {
      this.container.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }

    if (this.scrollRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.unmountAllRendered();

    if (this.container.contains(this.viewportEl)) {
      this.container.removeChild(this.viewportEl);
    }
  }

  private bindEvents(): void {
    this.scrollListener = () => {
      if (typeof requestAnimationFrame !== 'undefined') {
        if (this.scrollRafId !== null) return;
        this.scrollRafId = requestAnimationFrame(() => {
          this.scrollRafId = null;
          this.updateWindow();
        });
      } else {
        this.updateWindow();
      }
    };

    this.container.addEventListener('scroll', this.scrollListener, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateWindow();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  private updateWindow(force = false): void {
    const totalItems = this.items.length;
    if (totalItems === 0) {
      this.unmountAllRendered();
      this.topSpacerEl.style.height = '0px';
      this.bottomSpacerEl.style.height = '0px';
      this.currentStartIndex = 0;
      this.currentEndIndex = 0;
      return;
    }

    const scrollTop = Math.max(0, this.container.scrollTop || 0);
    const clientHeight = this.container.clientHeight || 600;

    const visibleStartIndex = Math.floor(scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(clientHeight / this.itemHeight);

    const startIndex = Math.max(0, visibleStartIndex - this.overscan);
    const endIndex = Math.min(totalItems, visibleStartIndex + visibleCount + this.overscan);

    if (!force && startIndex === this.currentStartIndex && endIndex === this.currentEndIndex) {
      return;
    }

    this.currentStartIndex = startIndex;
    this.currentEndIndex = endIndex;

    // Calculate spacer heights
    const topHeight = startIndex * this.itemHeight;
    const bottomHeight = Math.max(0, (totalItems - endIndex) * this.itemHeight);

    this.topSpacerEl.style.height = `${topHeight}px`;
    this.bottomSpacerEl.style.height = `${bottomHeight}px`;

    // Unmount items outside the window
    for (const [idx, entry] of this.renderedElements.entries()) {
      if (idx < startIndex || idx >= endIndex) {
        if (this.onItemUnmount) {
          this.onItemUnmount(entry.element, entry.item, idx);
        }
        if (this.contentEl.contains(entry.element)) {
          this.contentEl.removeChild(entry.element);
        }
        this.renderedElements.delete(idx);
      }
    }

    // Mount/Render new items inside the window
    // Clear and re-append in deterministic sequence
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i]!;
      let entry = this.renderedElements.get(i);

      if (!entry) {
        const el = this.renderItem(item, i);
        entry = { element: el, item };
        this.renderedElements.set(i, entry);
      }
      fragment.appendChild(entry.element);
    }

    this.contentEl.innerHTML = '';
    this.contentEl.appendChild(fragment);
  }

  private unmountAllRendered(): void {
    for (const [idx, entry] of this.renderedElements.entries()) {
      if (this.onItemUnmount) {
        this.onItemUnmount(entry.element, entry.item, idx);
      }
    }
    this.renderedElements.clear();
    this.contentEl.innerHTML = '';
  }
}
