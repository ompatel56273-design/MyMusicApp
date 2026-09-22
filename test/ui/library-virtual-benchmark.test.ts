import { describe, it, expect } from 'vitest';
import { setupMockDomEnvironment, MockElement } from '../helpers/mock-dom';
import { VirtualScroller } from '../../src/ui/components/virtual-scroller/virtual-scroller';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('Library Large-Dataset Virtualization Benchmark', () => {
  it('should benchmark virtual scrolling over 10,000 synthetic tracks with bounded DOM rendering', () => {
    const trackCount = 10000;
    const tracks: Track[] = [];

    for (let i = 1; i <= trackCount; i++) {
      tracks.push({
        id: `bench_t_${i}`,
        fileId: `bench_f_${i}`,
        title: `Synthetic Song ${i}`,
        artistName: `Artist ${i % 100}`,
        albumTitle: `Album ${i % 250}`,
        durationMs: 210000,
        format: {
          container: i % 2 === 0 ? 'flac' : 'mp3',
          codec: i % 2 === 0 ? 'flac' : 'mp3',
          sampleRate: 44100,
          channels: 2,
          isLossless: i % 2 === 0
        },
        dateAdded: 1700000000 + i,
        dateModified: 1700000000 + i,
        playCount: i % 25,
        isFavorite: i % 10 === 0,
        hasLyrics: false,
        availability: 'available'
      });
    }

    const container = document.createElement('div') as unknown as MockElement & HTMLElement;
    container.clientHeight = 600; // Viewport height
    container.scrollTop = 0;
    document.body.appendChild(container as unknown as Node);

    let unmountedCount = 0;

    const scroller = new VirtualScroller<Track>({
      container,
      items: tracks,
      itemHeight: 56,
      overscan: 4,
      renderItem: track => {
        const row = document.createElement('div');
        row.className = 'track-row';
        row.setAttribute('data-id', track.id);
        row.textContent = track.title;
        return row;
      },
      onItemUnmount: () => {
        unmountedCount++;
      }
    });

    // Initial DOM assertion
    const initialRendered = scroller.getRenderedCount();
    // 600px viewport / 56px itemHeight ≈ 11 visible items + (4 * 2) overscan ≈ 19 items
    expect(initialRendered).toBeLessThanOrEqual(30);

    // Simulate 100 rapid scroll operations across 10,000 items
    const scrollIterations = 100;
    const scrollStart = performance.now();

    for (let step = 1; step <= scrollIterations; step++) {
      // Scroll to varied positions across 10,000 items (total scrollable height = 10,000 * 56 = 560,000px)
      const targetScroll = (step * 5000) % 550000;
      container.scrollTo({ top: targetScroll });

      const currentRendered = scroller.getRenderedCount();
      // Bounded DOM check: must remain <= 40 items regardless of position in 10,000 items
      expect(currentRendered).toBeLessThanOrEqual(40);
    }

    const totalScrollTimeMs = performance.now() - scrollStart;
    const avgScrollLatencyMs = totalScrollTimeMs / scrollIterations;

    console.info(`[Virtual Scroller Benchmark Results]
      Total Dataset: ${trackCount} tracks
      Scroll Steps: ${scrollIterations}
      Total Execution Time: ${totalScrollTimeMs.toFixed(2)}ms
      Average Window Recalculation Latency: ${avgScrollLatencyMs.toFixed(3)}ms/scroll
      Rendered DOM Node Count: ${scroller.getRenderedCount()} nodes (Bounded <= 40)
      Unmounted/Recycled Node Events: ${unmountedCount}
    `);

    // Verify benchmark targets
    expect(avgScrollLatencyMs).toBeLessThan(10); // Under 10ms per window recalculation
    expect(unmountedCount).toBeGreaterThan(0);  // Confirmed unmounting lifecycle

    scroller.dispose();
    document.body.removeChild(container as unknown as Node);
  });
});
