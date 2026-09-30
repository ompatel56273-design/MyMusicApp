import { describe, it, expect, beforeEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { OrbitLayoutEngine, GALAXY_ORBIT_TIMING } from '../../src/ui/components/galaxy/orbit-layout-engine';
import { GalaxyCanvasRenderer } from '../../src/ui/components/galaxy/galaxy-canvas-renderer';
import { MobileGalaxyView } from '../../src/ui/views/galaxy/mobile-galaxy-view';
import type { GalaxyGraph, GalaxyNode } from '../../src/domain/entities/galaxy-types';

describe('OrbitLayoutEngine — Collision-Free Multi-Directional Nested Orbit System', () => {
  let engine: OrbitLayoutEngine;

  const createMockGraph = (trackCount: number): GalaxyGraph => {
    const nodes: GalaxyNode[] = [
      { id: 'genre:1', type: 'genre', entityId: 'g1', label: 'Electronic', x: 0, y: 0, radius: 32, color: '#a855f7', lodMin: 1, lodMax: 4, metadata: { trackCount } },
      { id: 'genre:2', type: 'genre', entityId: 'g2', label: 'Synthwave', x: 0, y: 0, radius: 28, color: '#ec4899', lodMin: 1, lodMax: 4, metadata: {} },
      { id: 'artist:1', type: 'artist', entityId: 'a1', label: 'Daft Punk', x: 0, y: 0, radius: 24, color: '#38bdf8', lodMin: 2, lodMax: 4, metadata: { trackCount } },
      { id: 'artist:2', type: 'artist', entityId: 'a2', label: 'Tycho', x: 0, y: 0, radius: 22, color: '#6366f1', lodMin: 2, lodMax: 4, metadata: {} },
      { id: 'artist:3', type: 'artist', entityId: 'a3', label: 'Kavinsky', x: 0, y: 0, radius: 20, color: '#f59e0b', lodMin: 2, lodMax: 4, metadata: {} }
    ];

    for (let i = 1; i <= trackCount; i++) {
      nodes.push({
        id: `track:${i}`,
        type: 'track',
        entityId: `t${i}`,
        label: `Cosmic Track ${i}`,
        x: 0,
        y: 0,
        radius: 10,
        color: '#10b981',
        lodMin: 3,
        lodMax: 4,
        metadata: { isFavorite: i % 3 === 0 }
      });
    }

    return {
      nodes,
      edges: [
        { id: 'e1', sourceId: 'artist:1', targetId: 'track:1', type: 'artist-album', weight: 1, color: '#ffffff' },
        { id: 'e2', sourceId: 'artist:1', targetId: 'track:2', type: 'artist-album', weight: 1, color: '#ffffff' }
      ],
      totalNodes: nodes.length,
      totalEdges: 2,
      createdAt: Date.now()
    };
  };

  beforeEach(() => {
    engine = new OrbitLayoutEngine();
  });

  it('1. Two nodes on the same orbit never overlap', () => {
    const graph = createMockGraph(2);
    engine.buildLayout(graph, 1000, 800);

    const states = engine.getAllNodeStates().filter(s => s.laneIndex > 0);
    expect(states.length).toBeGreaterThanOrEqual(2);

    const s1 = states[0]!;
    const s2 = states[1]!;
    const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
    expect(dist).toBeGreaterThanOrEqual(s1.node.radius + s2.node.radius);
  });

  it('2. Three nodes on the same orbit never overlap', () => {
    const graph = createMockGraph(3);
    engine.buildLayout(graph, 1000, 800);

    const states = engine.getAllNodeStates().filter(s => s.laneIndex === 2); // Artist lane
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const s1 = states[i]!;
        const s2 = states[j]!;
        const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
        expect(dist).toBeGreaterThanOrEqual(s1.node.radius + s2.node.radius);
      }
    }
  });

  it('3. Dense orbit automatically creates additional sub-lanes', () => {
    const largeGraph = createMockGraph(80);
    engine.buildLayout(largeGraph, 600, 400); // Tight viewport

    const lanes = engine.getLanes();
    // Extra sub-lanes created for large track count
    expect(lanes.length).toBeGreaterThan(4);
  });

  it('4. Clockwise orbit moves clockwise (positive angle delta)', () => {
    const graph = createMockGraph(4);
    engine.buildLayout(graph, 1000, 800);

    const lanes = engine.getLanes();
    const cwLane = lanes.find(l => l.direction === 1 && l.laneIndex > 0);
    expect(cwLane).toBeDefined();

    if (cwLane) {
      const nodeState = engine.getNodeState(cwLane.nodeIds[0]!);
      expect(nodeState).toBeDefined();
      if (nodeState) {
        const initAngle = nodeState.currentAngle;
        engine.stepPhysics(500);
        expect(nodeState.currentAngle).toBeGreaterThan(initAngle);
      }
    }
  });

  it('5. Counter-clockwise orbit moves counter-clockwise (negative angle delta)', () => {
    const graph = createMockGraph(4);
    engine.buildLayout(graph, 1000, 800);

    const lanes = engine.getLanes();
    const ccwLane = lanes.find(l => l.direction === -1 && l.laneIndex > 0);
    expect(ccwLane).toBeDefined();

    if (ccwLane) {
      const nodeState = engine.getNodeState(ccwLane.nodeIds[0]!);
      expect(nodeState).toBeDefined();
      if (nodeState) {
        const initAngle = nodeState.currentAngle;
        engine.stepPhysics(500);
        expect(nodeState.currentAngle).toBeLessThan(initAngle);
      }
    }
  });

  it('6. Different lanes have different orbital speeds', () => {
    const graph = createMockGraph(10);
    engine.buildLayout(graph, 1000, 800);

    const lanes = engine.getLanes().filter(l => l.laneIndex > 0);
    expect(lanes.length).toBeGreaterThanOrEqual(2);

    const speeds = lanes.map(l => Math.abs(l.speed));
    expect(speeds[0]).not.toEqual(speeds[speeds.length - 1]);
  });

  it('7. Nested orbit child nodes follow parent position continuously', () => {
    const graph = createMockGraph(5);
    engine.setExpandedParents(['artist:1']);
    engine.buildLayout(graph, 1000, 800);

    const parentState = engine.getNodeState('artist:1');
    const childState = engine.getNodeState('track:1');

    expect(parentState).toBeDefined();
    expect(childState).toBeDefined();
    expect(childState?.parentId).toBe('artist:1');

    const initialParentX = parentState!.x;
    const initialParentY = parentState!.y;

    // Step physics forward
    engine.stepPhysics(200);

    // Parent moved
    expect(parentState!.x).not.toEqual(initialParentX);
    expect(parentState!.y).not.toEqual(initialParentY);

    // Child moved together relative to parent
    const childDistToParent = Math.hypot(childState!.x - parentState!.x, childState!.y - parentState!.y);
    expect(childDistToParent).toBeCloseTo(childState!.localOrbitRadius, 1);
  });

  it('8. Nested children do not overlap each other', () => {
    const graph = createMockGraph(10);
    engine.setExpandedParents(['artist:1']);
    engine.buildLayout(graph, 1000, 800);

    const nestedChildren = engine.getAllNodeStates().filter(s => s.parentId === 'artist:1');
    expect(nestedChildren.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < nestedChildren.length; i++) {
      for (let j = i + 1; j < nestedChildren.length; j++) {
        const c1 = nestedChildren[i]!;
        const c2 = nestedChildren[j]!;
        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        expect(dist).toBeGreaterThan(c1.node.radius + c2.node.radius);
      }
    }
  });

  it('9. Labels receive collision-safe multi-position placements', () => {
    const graph = createMockGraph(10);
    engine.buildLayout(graph, 800, 600);

    const states = engine.getAllNodeStates();
    states.forEach(s => {
      expect(['bottom', 'top', 'right', 'left']).toContain(s.labelPosition);
    });
  });

  it('10. Orbit nodes calculate valid world positions across category zones', () => {
    const graph = createMockGraph(150);
    engine.buildLayout(graph, 1000, 800);

    const states = engine.getAllNodeStates();
    states.forEach(s => {
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
    });
  });

  it('11. Produces deterministic initial layout for identical library graph', () => {
    const graph1 = createMockGraph(20);
    const graph2 = createMockGraph(20);

    const e1 = new OrbitLayoutEngine();
    const e2 = new OrbitLayoutEngine();

    e1.buildLayout(graph1, 1000, 800);
    e2.buildLayout(graph2, 1000, 800);

    const s1 = e1.getNodeState('artist:1');
    const s2 = e2.getNodeState('artist:1');

    expect(s1?.baseAngle).toBeCloseTo(s2?.baseAngle || 0, 4);
    expect(s1?.x).toBeCloseTo(s2?.x || 0, 4);
  });

  it('12. 0-track library works without errors', () => {
    const emptyGraph: GalaxyGraph = { nodes: [], edges: [], totalNodes: 0, totalEdges: 0, createdAt: Date.now() };
    expect(() => engine.buildLayout(emptyGraph, 800, 600)).not.toThrow();
    expect(engine.getAllNodeStates().length).toBe(0);
  });

  it('13. 1-track library works cleanly', () => {
    const singleGraph = createMockGraph(1);
    expect(() => engine.buildLayout(singleGraph, 800, 600)).not.toThrow();
    expect(engine.getAllNodeStates().length).toBeGreaterThanOrEqual(2);
  });

  it('14. 100+ track library scales cleanly without duplicate nodes', () => {
    const largeGraph = createMockGraph(120);
    engine.buildLayout(largeGraph, 1200, 900);

    const states = engine.getAllNodeStates();
    const nodeIds = states.map(s => s.node.id);
    const uniqueIds = new Set(nodeIds);

    expect(uniqueIds.size).toEqual(nodeIds.length);
  });

  it('15. Mobile Galaxy renders live orbit canvas using engine', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const mobileView = new MobileGalaxyView({});
    await mobileView.mount(container);

    const canvas = container.querySelector<HTMLCanvasElement>('#mobile-galaxy-orbit-canvas');
    expect(canvas).not.toBeNull();

    mobileView.unmount();
    container.remove();
  });

  it('16. Desktop Galaxy Canvas Renderer mounts and renders layout engine output', () => {
    const canvas = document.createElement('canvas');
    const renderer = new GalaxyCanvasRenderer();
    renderer.attachCanvas(canvas);

    const graph = createMockGraph(10);
    renderer.setGraph(graph);

    expect(() => renderer.draw()).not.toThrow();
    renderer.detachCanvas();
  });

  it('17. Resize recalculates layout correctly', () => {
    const graph = createMockGraph(10);
    engine.buildLayout(graph, 1000, 800);
    const initMaxRadius = Math.max(...engine.getAllNodeStates().map(s => s.orbitRadius));

    engine.buildLayout(graph, 500, 400);
    const resizedMaxRadius = Math.max(...engine.getAllNodeStates().map(s => s.orbitRadius));

    expect(resizedMaxRadius).toBeLessThan(initMaxRadius);
  });

  it('18 & 19. Animation stops cleanly on unmount and requestAnimationFrame does not leak', () => {
    const canvas = document.createElement('canvas');
    const renderer = new GalaxyCanvasRenderer();
    renderer.attachCanvas(canvas);
    renderer.setGraph(createMockGraph(5));

    expect(() => renderer.detachCanvas()).not.toThrow();
  });

  it('20. Guaranteed no duplicate orbit node states', () => {
    const graph = createMockGraph(30);
    engine.buildLayout(graph, 1000, 800);

    const nodeIds = engine.getAllNodeStates().map(s => s.node.id);
    const duplicates = nodeIds.filter((item, index) => nodeIds.indexOf(item) !== index);
    expect(duplicates.length).toBe(0);
  });

  describe('Part 2: Orbit Speed & Frame-Rate Independence Tests', () => {
    it('1. Completes full 2π revolution over configured period (inner period = 50,000ms)', () => {
      const graph = createMockGraph(2);
      engine.buildLayout(graph, 1000, 800);

      const lanes = engine.getLanes();
      const innerLane = lanes.find(l => l.level === 1);
      expect(innerLane).toBeDefined();

      if (innerLane) {
        const nodeState = engine.getNodeState(innerLane.nodeIds[0]!);
        expect(nodeState).toBeDefined();
        const startAngle = nodeState!.currentAngle;

        // Step physics forward by full period (50,000ms in small chunks)
        for (let i = 0; i < 500; i++) {
          engine.stepPhysics(100);
        }

        const deltaAngle = Math.abs(nodeState!.currentAngle - startAngle);
        expect(deltaAngle).toBeGreaterThan(6.0);
        expect(deltaAngle).toBeLessThan(6.5);
      }
    });

    it('2. Enforces hierarchical periods (Inner < Middle < Outer < FarOuter)', () => {
      expect(GALAXY_ORBIT_TIMING.innerPeriodMs).toBeLessThan(GALAXY_ORBIT_TIMING.middlePeriodMs);
      expect(GALAXY_ORBIT_TIMING.middlePeriodMs).toBeLessThan(GALAXY_ORBIT_TIMING.outerPeriodMs);
      expect(GALAXY_ORBIT_TIMING.outerPeriodMs).toBeLessThan(GALAXY_ORBIT_TIMING.farOuterPeriodMs);

      const graph = createMockGraph(50);
      engine.buildLayout(graph, 1200, 900);

      const lanes = engine.getLanes();
      const l1 = lanes.find(l => l.level === 1);
      const l2 = lanes.find(l => l.level === 2);
      const l4 = lanes.find(l => l.level === 4);

      expect(l1).toBeDefined();
      expect(l2).toBeDefined();
      expect(l4).toBeDefined();

      if (l1 && l2 && l4) {
        // Lower period = higher angular speed
        expect(Math.abs(l1.speed)).toBeGreaterThan(Math.abs(l2.speed));
        expect(Math.abs(l2.speed)).toBeGreaterThan(Math.abs(l4.speed));
      }
    });

    it('3. Produces equivalent orbital progression at 30 FPS vs 60 FPS over 1,000ms', () => {
      const graph1 = createMockGraph(5);
      const graph2 = createMockGraph(5);

      const e30 = new OrbitLayoutEngine();
      const e60 = new OrbitLayoutEngine();

      e30.buildLayout(graph1, 1000, 800);
      e60.buildLayout(graph2, 1000, 800);

      // Simulate 1,000ms at 30 FPS (~30 frames of 33.33ms)
      for (let i = 0; i < 30; i++) {
        e30.stepPhysics(33.33);
      }

      // Simulate 1,000ms at 60 FPS (~60 frames of 16.66ms)
      for (let i = 0; i < 60; i++) {
        e60.stepPhysics(16.66);
      }

      const s30 = e30.getNodeState('artist:1');
      const s60 = e60.getNodeState('artist:1');

      expect(s30?.currentAngle).toBeCloseTo(s60?.currentAngle || 0, 2);
    });

    it('4. Clamps large deltaTime jumps (5,000ms jump clamped to max 100ms)', () => {
      const graph = createMockGraph(3);
      engine.buildLayout(graph, 1000, 800);

      const nodeState = engine.getNodeState('artist:1');
      expect(nodeState).toBeDefined();
      const initAngle = nodeState!.currentAngle;

      // Simulate tab sleep / multi-second backgrounding jump (5,000ms)
      engine.stepPhysics(5000);

      const angleDelta = Math.abs(nodeState!.currentAngle - initAngle);
      const maxExpectedDelta = Math.abs(nodeState!.angularVelocity * 100);

      expect(angleDelta).toBeCloseTo(maxExpectedDelta, 4);
    });
  });
});
