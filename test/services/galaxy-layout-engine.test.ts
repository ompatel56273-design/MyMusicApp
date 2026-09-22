import { describe, it, expect } from 'vitest';
import { GalaxyLayoutEngine } from '../../src/services/galaxy/galaxy-layout-engine';
import type { GalaxyNode, GalaxyEdge } from '../../src/domain/entities/galaxy-types';

describe('GalaxyLayoutEngine', () => {
  const layoutEngine = new GalaxyLayoutEngine();

  it('computes deterministic radial positions for genres, artists, albums, and tracks', () => {
    const nodes: GalaxyNode[] = [
      { id: 'genre:1', type: 'genre', entityId: 'g1', label: 'Rock', x: 0, y: 0, radius: 36, color: '#a855f7', lodMin: 1, lodMax: 4, metadata: {} },
      { id: 'artist:1', type: 'artist', entityId: 'a1', label: 'Artist 1', x: 0, y: 0, radius: 24, color: '#3b82f6', lodMin: 1, lodMax: 4, metadata: {} },
      { id: 'album:1', type: 'album', entityId: 'al1', label: 'Album 1', x: 0, y: 0, radius: 16, color: '#ff6b00', lodMin: 2, lodMax: 4, metadata: {} },
      { id: 'track:1', type: 'track', entityId: 't1', label: 'Track 1', x: 0, y: 0, radius: 8, color: '#10b981', lodMin: 3, lodMax: 4, metadata: {} }
    ];

    const edges: GalaxyEdge[] = [
      { id: 'e1', sourceId: 'genre:1', targetId: 'artist:1', type: 'genre-artist', weight: 2, color: '#fff' },
      { id: 'e2', sourceId: 'artist:1', targetId: 'album:1', type: 'artist-album', weight: 2, color: '#fff' },
      { id: 'e3', sourceId: 'album:1', targetId: 'track:1', type: 'album-track', weight: 1, color: '#fff' }
    ];

    const result = layoutEngine.computeLayout(nodes, edges);

    expect(result.length).toBe(4);
    // Node positions should be non-zero and finite
    result.forEach(n => {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    });

    // Check deterministic stability (running twice produces identical coordinates)
    const nodesCopy = JSON.parse(JSON.stringify(nodes));
    const edgesCopy = JSON.parse(JSON.stringify(edges));
    const result2 = layoutEngine.computeLayout(nodesCopy, edgesCopy);

    expect(result2[0]!.x).toBeCloseTo(result[0]!.x, 2);
    expect(result2[0]!.y).toBeCloseTo(result[0]!.y, 2);
    expect(result2[1]!.x).toBeCloseTo(result[1]!.x, 2);
    expect(result2[1]!.y).toBeCloseTo(result[1]!.y, 2);
  });

  it('handles orphan nodes gracefully without edge crashes', () => {
    const orphanNodes: GalaxyNode[] = [
      { id: 'artist:orphan', type: 'artist', entityId: 'ao', label: 'Orphan Artist', x: 0, y: 0, radius: 24, color: '#3b82f6', lodMin: 1, lodMax: 4, metadata: {} },
      { id: 'playlist:1', type: 'playlist', entityId: 'p1', label: 'Driving Mix', x: 0, y: 0, radius: 20, color: '#ec4899', lodMin: 2, lodMax: 4, metadata: {} }
    ];

    const result = layoutEngine.computeLayout(orphanNodes, []);
    expect(result.length).toBe(2);
    expect(Number.isFinite(result[0]!.x)).toBe(true);
    expect(Number.isFinite(result[1]!.x)).toBe(true);
  });
});
