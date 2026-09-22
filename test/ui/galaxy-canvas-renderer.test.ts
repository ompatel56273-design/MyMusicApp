import { describe, it, expect, beforeEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { GalaxyCanvasRenderer } from '../../src/ui/components/galaxy/galaxy-canvas-renderer';
import type { GalaxyGraph } from '../../src/domain/entities/galaxy-types';

describe('GalaxyCanvasRenderer', () => {
  let canvas: HTMLCanvasElement;
  let renderer: GalaxyCanvasRenderer;

  const mockGraph: GalaxyGraph = {
    nodes: [
      { id: 'genre:1', type: 'genre', entityId: 'g1', label: 'Rock', x: 100, y: 100, radius: 36, color: '#a855f7', lodMin: 1, lodMax: 4, metadata: {} },
      { id: 'artist:1', type: 'artist', entityId: 'a1', label: 'Artist 1', x: 200, y: 200, radius: 24, color: '#3b82f6', lodMin: 1, lodMax: 4, metadata: {} },
      { id: 'album:1', type: 'album', entityId: 'al1', label: 'Album 1', x: 300, y: 300, radius: 16, color: '#ff6b00', lodMin: 2, lodMax: 4, metadata: {} },
      { id: 'track:1', type: 'track', entityId: 't1', label: 'Track 1', x: 400, y: 400, radius: 8, color: '#10b981', lodMin: 3, lodMax: 4, metadata: {} }
    ],
    edges: [
      { id: 'e1', sourceId: 'genre:1', targetId: 'artist:1', type: 'genre-artist', weight: 2, color: 'rgba(255,255,255,0.2)' },
      { id: 'e2', sourceId: 'artist:1', targetId: 'album:1', type: 'artist-album', weight: 2, color: 'rgba(255,255,255,0.2)' }
    ],
    totalNodes: 4,
    totalEdges: 2,
    createdAt: Date.now()
  };

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = new GalaxyCanvasRenderer();
    renderer.attachCanvas(canvas);
  });

  it('sets graph and performs draw without throwing', () => {
    renderer.setGraph(mockGraph);
    expect(() => renderer.draw()).not.toThrow();
  });

  it('supports zoom in, zoom out, and reset camera', () => {
    const initialZoom = renderer.getCamera().zoom;

    renderer.zoomIn();
    const zoomedIn = renderer.getCamera().zoom;
    expect(zoomedIn).toBeGreaterThan(initialZoom);

    renderer.zoomOut();
    const zoomedOut = renderer.getCamera().zoom;
    expect(zoomedOut).toBeLessThan(zoomedIn);

    renderer.resetCamera();
    expect(renderer.getCamera().x).toBe(0);
    expect(renderer.getCamera().y).toBe(0);
  });

  it('performs hit testing against node world coordinates', () => {
    renderer.setGraph(mockGraph);
    renderer.centerOnCoordinates(100, 100, 1.0);

    // Screen center corresponds to world coordinates (100, 100) where genre:1 is located
    const rect = canvas.getBoundingClientRect();
    const hit = renderer.hitTest(rect.width / 2, rect.height / 2);
    expect(hit?.id).toBe('genre:1');
  });

  it('highlights selected and playing nodes', () => {
    renderer.setGraph(mockGraph);
    renderer.setSelectedNode('artist:1');
    renderer.setPlayingEntity('t1');
    expect(() => renderer.draw()).not.toThrow();
  });

  it('detaches canvas cleanly', () => {
    expect(() => renderer.detachCanvas()).not.toThrow();
  });
});
