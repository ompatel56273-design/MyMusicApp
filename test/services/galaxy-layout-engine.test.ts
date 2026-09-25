import { describe, it, expect } from 'vitest';
import { GalaxyLayoutEngine } from '../../src/services/galaxy/galaxy-layout-engine';
import type { GalaxyNode } from '../../src/domain/entities/galaxy-types';

describe('GalaxyLayoutEngine', () => {
  it('should distribute unparented tracks across concentric orbital shells without overlap', () => {
    const engine = new GalaxyLayoutEngine();
    const nodes: GalaxyNode[] = [];

    for (let i = 0; i < 83; i++) {
      nodes.push({
        id: `track_${i}`,
        entityId: `track_${i}`,
        type: 'track',
        label: `Song Title ${i}`,
        x: 0,
        y: 0,
        radius: 8,
        color: '#10b981',
        lodMin: 1,
        lodMax: 4,
        metadata: {}
      });
    }

    const result = engine.computeLayout(nodes, []);
    expect(result.length).toBe(83);

    // Verify distance clearance between node pairs
    let overlapsFound = 0;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const n1 = result[i]!;
        const n2 = result[j]!;
        const dist = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        if (dist < 15) {
          overlapsFound++;
        }
      }
    }

    expect(overlapsFound).toBe(0);
  });
});
