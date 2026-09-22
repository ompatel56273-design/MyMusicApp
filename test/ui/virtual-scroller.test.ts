import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment, MockElement } from '../helpers/mock-dom';
import { VirtualScroller } from '../../src/ui/components/virtual-scroller/virtual-scroller';

setupMockDomEnvironment();

describe('VirtualScroller Engine', () => {
  let container: HTMLElement;
  let scroller: VirtualScroller<{ id: string; name: string }> | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    (container as any).clientHeight = 500;
    (container as any).scrollTop = 0;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (scroller) {
      scroller.dispose();
      scroller = null;
    }
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should maintain bounded DOM rendering for a 1,000-item dataset', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: `item_${i}`, name: `Item ${i}` }));

    scroller = new VirtualScroller({
      container,
      items,
      itemHeight: 50,
      overscan: 3,
      renderItem: item => {
        const el = document.createElement('div');
        el.className = 'virtual-row';
        el.textContent = item.name;
        return el;
      }
    });

    const initialWindow = scroller.getWindow();
    expect(initialWindow.startIndex).toBe(0);
    // clientHeight = 500, itemHeight = 50 -> 10 visible + 3 overscan = ~13 items
    expect(initialWindow.endIndex).toBeLessThanOrEqual(15);
    expect(scroller.getRenderedCount()).toBeLessThanOrEqual(15);
    // Spacers
    expect(initialWindow.topSpacerHeight).toBe(0);
    expect(initialWindow.bottomSpacerHeight).toBeGreaterThan(45000);
  });

  it('should dynamically update window and spacers upon scrolling', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: `item_${i}`, name: `Item ${i}` }));

    scroller = new VirtualScroller({
      container,
      items,
      itemHeight: 40,
      overscan: 2,
      renderItem: item => {
        const el = document.createElement('div');
        el.textContent = item.name;
        return el;
      }
    });

    // Scroll down to 1,000px (item index 25)
    (container as unknown as MockElement).scrollTo({ top: 1000 });

    const win = scroller.getWindow();
    // visibleStart = 1000 / 40 = 25. overscan = 2 -> startIndex = 23
    expect(win.startIndex).toBe(23);
    expect(win.topSpacerHeight).toBe(23 * 40);
    expect(scroller.getRenderedCount()).toBeLessThanOrEqual(20);
  });

  it('should clean up all children and listeners on dispose', () => {
    const items = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
    scroller = new VirtualScroller({
      container,
      items,
      itemHeight: 50,
      renderItem: item => {
        const el = document.createElement('div');
        el.textContent = item.name;
        return el;
      }
    });

    expect(container.querySelector('.virtual-viewport')).toBeDefined();
    scroller.dispose();
    scroller = null;
    expect(container.querySelector('.virtual-viewport')).toBeNull();
  });
});
