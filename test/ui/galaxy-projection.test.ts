import { describe, it, expect } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { GalaxyProjection } from '../../src/ui/components/galaxy/galaxy-projection';
import { OrbitLayoutEngine } from '../../src/ui/components/galaxy/orbit-layout-engine';
import type { GalaxyGraph, GalaxyNode, GalaxyEdge } from '../../src/domain/entities/galaxy-types';

describe('GalaxyProjection — Audio Galaxy V9 Multi-Orbit Solar System Data Projection', () => {
  const createLargeMockGraph = (trackCount: number, artistCount: number = 10, genreCount: number = 12): GalaxyGraph => {
    const nodes: GalaxyNode[] = [
      { id: 'core', type: 'genre', entityId: 'core', label: 'My Music', x: 0, y: 0, radius: 42, color: '#7c3aed', lodMin: 1, lodMax: 4, metadata: {} }
    ];
    const edges: GalaxyEdge[] = [];

    // Create Genres
    for (let g = 1; g <= genreCount; g++) {
      nodes.push({
        id: `genre:${g}`,
        type: 'genre',
        entityId: `g${g}`,
        label: `Genre ${g}`,
        x: 0,
        y: 0,
        radius: 25,
        color: '#a855f7',
        lodMin: 1,
        lodMax: 4,
        metadata: { trackCount: Math.ceil(trackCount / genreCount) }
      });
    }

    // Create Artists
    for (let a = 1; a <= artistCount; a++) {
      const gId = `genre:${((a - 1) % genreCount) + 1}`;
      const artistId = `artist:${a}`;
      nodes.push({
        id: artistId,
        type: 'artist',
        entityId: `a${a}`,
        label: `Artist ${a}`,
        x: 0,
        y: 0,
        radius: 18,
        color: '#3b82f6',
        lodMin: 2,
        lodMax: 4,
        metadata: { trackCount: Math.ceil(trackCount / artistCount) }
      });
      edges.push({
        id: `e_g_a_${a}`,
        sourceId: gId,
        targetId: artistId,
        type: 'genre-artist',
        weight: 1,
        color: '#ffffff'
      });
    }

    // Create Tracks
    for (let t = 1; t <= trackCount; t++) {
      const aId = `artist:${((t - 1) % artistCount) + 1}`;
      const trackId = `track:${t}`;
      nodes.push({
        id: trackId,
        type: 'track',
        entityId: `t${t}`,
        label: `Cosmic Track ${t}`,
        x: 0,
        y: 0,
        radius: 6,
        color: '#10b981',
        lodMin: 3,
        lodMax: 4,
        metadata: {}
      });
      edges.push({
        id: `e_a_t_${t}`,
        sourceId: aId,
        targetId: trackId,
        type: 'artist-track',
        weight: 1,
        color: '#ffffff'
      });
    }

    return {
      nodes,
      edges,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      createdAt: Date.now()
    };
  };

  it('1. 100 tracks preserve all major categories without artificial slicing', () => {
    const rawGraph = createLargeMockGraph(100, 15, 10);
    const projected = GalaxyProjection.projectGraph(rawGraph);

    // All genres and artists are preserved
    const genreNodes = projected.nodes.filter(n => n.type === 'genre' && n.id !== 'core');
    expect(genreNodes.length).toBe(10);
    const artistNodes = projected.nodes.filter(n => n.type === 'artist');
    expect(artistNodes.length).toBe(15);
  });

  it('2. 500 tracks preserve genre and artist categories cleanly', () => {
    const rawGraph = createLargeMockGraph(500, 30, 20);
    const projected = GalaxyProjection.projectGraph(rawGraph);

    const genreNodes = projected.nodes.filter(n => n.type === 'genre' && n.id !== 'core');
    expect(genreNodes.length).toBe(20);
    const artistNodes = projected.nodes.filter(n => n.type === 'artist');
    expect(artistNodes.length).toBe(30);
  });

  it('3. Standalone tracks remain small dots (radius 5-8px)', () => {
    const rawGraph = createLargeMockGraph(50, 5, 3);
    const projected = GalaxyProjection.projectGraph(rawGraph);

    const trackNodes = projected.nodes.filter(n => n.type === 'track');
    trackNodes.forEach(t => {
      expect(t.radius).toBeGreaterThanOrEqual(5);
      expect(t.radius).toBeLessThanOrEqual(8);
    });
  });

  it('4. Empty library works cleanly', () => {
    const emptyGraph: GalaxyGraph = { nodes: [], edges: [], totalNodes: 0, totalEdges: 0, createdAt: Date.now() };
    const projected = GalaxyProjection.projectGraph(emptyGraph);

    expect(projected.nodes.length).toBe(1);
    expect(projected.nodes[0]!.id).toBe('core');
  });

  it('5. Single-track library works cleanly', () => {
    const rawGraph = createLargeMockGraph(1, 1, 1);
    const projected = GalaxyProjection.projectGraph(rawGraph);

    expect(projected.nodes.length).toBeGreaterThanOrEqual(2);
    expect(projected.nodes.some(n => n.id === 'core')).toBe(true);
  });

  it('6. OrbitLayoutEngine builds clean V9 layout for projected graph', () => {
    const rawGraph = createLargeMockGraph(200, 15, 8);
    const projected = GalaxyProjection.projectGraph(rawGraph);
    const engine = new OrbitLayoutEngine();

    engine.buildLayout(projected, 1000, 800);
    const states = engine.getAllNodeStates();

    expect(states.length).toEqual(projected.nodes.length);
    const sunState = engine.getNodeState('core');
    expect(sunState?.x).toBe(0);
    expect(sunState?.y).toBe(0);
  });
});
