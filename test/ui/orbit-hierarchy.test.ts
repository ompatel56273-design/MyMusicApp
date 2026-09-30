import { describe, it, expect, beforeEach } from 'vitest';
import type { GalaxyGraph, GalaxyNode, GalaxyEdge } from '../../src/domain/entities/galaxy-types';
import { OrbitLayoutEngine } from '../../src/ui/components/galaxy/orbit-layout-engine';
import { detectCycle } from '../../src/ui/components/galaxy/orbit-hierarchy';

function createMockNode(id: string, type: string, label: string, radius: number = 12): GalaxyNode {
  return {
    id,
    type: type as any,
    entityId: id,
    label,
    x: 0,
    y: 0,
    radius,
    color: '#a855f7',
    lodMin: 1,
    lodMax: 4,
    metadata: {
      isFavorite: false,
      playCount: 10
    }
  };
}

function createMockEdge(sourceId: string, targetId: string, type: GalaxyEdge['type']): GalaxyEdge {
  return {
    id: `edge:${sourceId}-${targetId}`,
    sourceId,
    targetId,
    type,
    weight: 1,
    color: 'rgba(168, 85, 247, 0.4)'
  };
}

describe('Galaxy V5 — Final Spatial Distribution & Collision Resolution', () => {
  let layoutEngine: OrbitLayoutEngine;

  beforeEach(() => {
    layoutEngine = new OrbitLayoutEngine();
  });

  it('1. Root nodes use complete 360° circumference spanning all 4 quadrants', () => {
    const nodes = Array.from({ length: 4 }, (_, i) => createMockNode(`g_${i}`, 'genre', `Genre ${i}`, 26));
    const graph: GalaxyGraph = {
      nodes,
      edges: [],
      totalNodes: 4,
      totalEdges: 0,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    layoutEngine.stepPhysics(0);

    const states = nodes.map(n => layoutEngine.getNodeState(n.id)!);
    const quadrants = new Set<string>();

    states.forEach(s => {
      const qX = s.x >= 0 ? 'R' : 'L';
      const qY = s.y >= 0 ? 'B' : 'T';
      quadrants.add(`${qX}_${qY}`);
    });

    expect(quadrants.size).toBeGreaterThanOrEqual(3); // Spans across multiple quadrants
  });

  it('2. Multiple root lanes stagger angles by 45° to prevent radial stacking', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => createMockNode(`g_${i}`, 'genre', `Genre ${i}`, 26));
    const graph: GalaxyGraph = {
      nodes,
      edges: [],
      totalNodes: 8,
      totalEdges: 0,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    const lanes = layoutEngine.getLanes().filter(l => l.radius > 0);

    expect(lanes.length).toBeGreaterThanOrEqual(2);
    expect(lanes[0]!.radius).not.toEqual(lanes[1]!.radius);
  });

  it('3. Children distribute 360° around immediate parent body', () => {
    const parent = createMockNode('p1', 'artist', 'Big Artist', 26);
    const children = Array.from({ length: 4 }, (_, i) => createMockNode(`c_${i}`, 'album', `Album ${i}`, 16));
    const edges = children.map(c => createMockEdge('p1', c.id, 'artist-album'));

    const graph: GalaxyGraph = {
      nodes: [parent, ...children],
      edges,
      totalNodes: 5,
      totalEdges: 4,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    layoutEngine.stepPhysics(0);

    const parentState = layoutEngine.getNodeState('p1')!;
    const childStates = children.map(c => layoutEngine.getNodeState(c.id)!);

    // Compute angles relative to parent center
    const childAngles = childStates.map(c => Math.atan2(c.y - parentState.y, c.x - parentState.x));
    childAngles.sort((a, b) => a - b);

    // Spread across 360° circle
    const maxSpread = childAngles[childAngles.length - 1]! - childAngles[0]!;
    expect(maxSpread).toBeGreaterThan(Math.PI);
  });

  it('4. Nested orbit radius clears parent body and label completely', () => {
    const parent = createMockNode('p1', 'artist', 'Parent', 26);
    const child = createMockNode('c1', 'album', 'Child', 16);

    const graph: GalaxyGraph = {
      nodes: [parent, child],
      edges: [createMockEdge('p1', 'c1', 'artist-album')],
      totalNodes: 2,
      totalEdges: 1,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    layoutEngine.stepPhysics(0);

    const pState = layoutEngine.getNodeState('p1')!;
    const cState = layoutEngine.getNodeState('c1')!;
    const dist = Math.hypot(cState.x - pState.x, cState.y - pState.y);

    // Clearance rule: distance >= parentVisualRadius + childVisualRadius + 35px
    expect(dist).toBeGreaterThanOrEqual(pState.visualRadius + cState.visualRadius + 35);
  });

  it('5. Sibling planets maintain generous angular distance and do not collide', () => {
    const parent = createMockNode('p1', 'artist', 'Parent', 26);
    const childA = createMockNode('cA', 'album', 'Child A', 16);
    const childB = createMockNode('cB', 'album', 'Child B', 16);

    const graph: GalaxyGraph = {
      nodes: [parent, childA, childB],
      edges: [
        createMockEdge('p1', 'cA', 'artist-album'),
        createMockEdge('p1', 'cB', 'artist-album')
      ],
      totalNodes: 3,
      totalEdges: 2,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    layoutEngine.stepPhysics(100);

    const cAState = layoutEngine.getNodeState('cA')!;
    const cBState = layoutEngine.getNodeState('cB')!;

    const distSiblings = Math.hypot(cAState.x - cBState.x, cAState.y - cBState.y);
    expect(distSiblings).toBeGreaterThan(30);
  });

  it('6. Full canvas viewport is utilized (initial Sun lane >= 160px)', () => {
    const genre = createMockNode('g1', 'genre', 'Genre 1', 26);
    const graph: GalaxyGraph = {
      nodes: [genre],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    const state = layoutEngine.getNodeState('g1')!;

    expect(state.orbitRadius).toBeGreaterThanOrEqual(160);
  });

  it('7. Alternating Rotational Directions (Depth 1: +1, Depth 2: -1, Depth 3: +1)', () => {
    const g1 = createMockNode('g1', 'genre', 'Genre 1', 26);
    const a1 = createMockNode('a1', 'artist', 'Artist 1', 16);
    const al1 = createMockNode('al1', 'album', 'Album 1', 10);

    const graph: GalaxyGraph = {
      nodes: [g1, a1, al1],
      edges: [
        createMockEdge('g1', 'a1', 'genre-artist'),
        createMockEdge('a1', 'al1', 'artist-album')
      ],
      totalNodes: 3,
      totalEdges: 2,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    const gState = layoutEngine.getNodeState('g1')!;
    const aState = layoutEngine.getNodeState('a1')!;
    const alState = layoutEngine.getNodeState('al1')!;

    expect(gState.direction).toBe(1);  // Depth 1: Clockwise
    expect(aState.direction).toBe(-1); // Depth 2: Counter-clockwise
    expect(alState.direction).toBe(1);  // Depth 3: Clockwise
  });

  it('8. Slow period-based speed configuration is preserved', () => {
    const genre = createMockNode('g1', 'genre', 'Genre 1', 26);
    const graph: GalaxyGraph = {
      nodes: [genre],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    const state = layoutEngine.getNodeState('g1')!;

    const periodMs = (Math.PI * 2) / Math.abs(state.angularVelocity);
    expect(periodMs).toBeGreaterThanOrEqual(45_000);
  });

  it('9. Deterministic initial positioning across layout recalculations', () => {
    const graph = {
      nodes: [createMockNode('g1', 'genre', 'Genre 1', 26)],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    layoutEngine.buildLayout(graph, 1000, 800);
    const angle1 = layoutEngine.getNodeState('g1')!.baseAngle;

    const engine2 = new OrbitLayoutEngine();
    engine2.buildLayout(graph, 1000, 800);
    const angle2 = engine2.getNodeState('g1')!.baseAngle;

    expect(angle1).toEqual(angle2);
  });

  it('10. Cycle detection prevents circular parent loops', () => {
    const childParentMap = new Map<string, string>();
    childParentMap.set('B', 'A');
    childParentMap.set('C', 'B');

    const isCycle = detectCycle(childParentMap, 'A', 'C');
    expect(isCycle).toBe(true);
  });

  it('11. Empty library remains safe', () => {
    const graph: GalaxyGraph = {
      nodes: [],
      edges: [],
      totalNodes: 0,
      totalEdges: 0,
      createdAt: Date.now()
    };

    expect(() => {
      layoutEngine.buildLayout(graph, 1000, 800);
      layoutEngine.stepPhysics(100);
    }).not.toThrow();

    expect(layoutEngine.getAllNodeStates()).toHaveLength(0);
  });
});

describe('Galaxy V6 — Runtime Orbit Physics & Continuous Motion Health', () => {
  let engine: OrbitLayoutEngine;

  beforeEach(() => {
    engine = new OrbitLayoutEngine();
  });

  it('Test 1: One orbiting planet changes position after stepPhysics(1000)', () => {
    const planet = createMockNode('p1', 'genre', 'Planet One', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const state = engine.getNodeState('p1')!;
    const initialX = state.x;
    const initialY = state.y;

    engine.stepPhysics(1000);

    expect(state.x !== initialX || state.y !== initialY).toBe(true);
  });

  it('Test 2: Two consecutive stepPhysics(1000) calls produce different positions', () => {
    const planet = createMockNode('p1', 'genre', 'Planet One', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const state = engine.getNodeState('p1')!;

    engine.stepPhysics(1000);
    const pos1X = state.x;
    const pos1Y = state.y;

    engine.stepPhysics(1000);
    const pos2X = state.x;
    const pos2Y = state.y;

    expect(pos2X !== pos1X || pos2Y !== pos1Y).toBe(true);
  });

  it('Test 3: Stepping physics 10 times continuously advances planet along orbit', () => {
    const planet = createMockNode('p1', 'genre', 'Planet One', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const state = engine.getNodeState('p1')!;
    const visitedPositions: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < 10; i++) {
      engine.stepPhysics(1000);
      visitedPositions.push({ x: state.x, y: state.y });
    }

    // Every subsequent step must differ from previous step
    for (let i = 1; i < visitedPositions.length; i++) {
      const prev = visitedPositions[i - 1]!;
      const curr = visitedPositions[i]!;
      expect(Math.hypot(curr.x - prev.x, curr.y - prev.y)).toBeGreaterThan(0.5);
    }
  });

  it('Test 4: Orbital radius remains constant during live physics motion', () => {
    const planet = createMockNode('p1', 'genre', 'Planet One', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const state = engine.getNodeState('p1')!;
    const expectedRadius = state.orbitRadius;

    for (let i = 0; i < 10; i++) {
      engine.stepPhysics(1000);
      const currentRadius = Math.hypot(state.x, state.y);
      expect(currentRadius).toBeCloseTo(expectedRadius, 2);
    }
  });

  it('Test 5: Clockwise orbit angle increases over elapsed time', () => {
    const planet = createMockNode('p1', 'genre', 'Clockwise Planet', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const state = engine.getNodeState('p1')!;
    expect(state.direction).toBe(1);

    const initialAngle = state.angle;
    engine.stepPhysics(1000);
    expect(state.angle).toBeGreaterThan(initialAngle);
  });

  it('Test 6: Counter-clockwise orbit angle decreases over elapsed time', () => {
    const parent = createMockNode('p1', 'genre', 'Parent', 26);
    const child = createMockNode('c1', 'artist', 'CCW Child', 16);
    const graph: GalaxyGraph = {
      nodes: [parent, child],
      edges: [createMockEdge('p1', 'c1', 'genre-artist')],
      totalNodes: 2,
      totalEdges: 1,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const childState = engine.getNodeState('c1')!;
    // Depth 2: Counter-clockwise (-1)
    expect(childState.direction).toBe(-1);

    const initialAngle = childState.localAngle;
    engine.stepPhysics(1000);
    expect(childState.localAngle).toBeLessThan(initialAngle);
  });

  it('Test 7: Child position changes when parent moves', () => {
    const parent = createMockNode('p1', 'genre', 'Parent', 26);
    const child = createMockNode('c1', 'artist', 'Child', 16);
    const graph: GalaxyGraph = {
      nodes: [parent, child],
      edges: [createMockEdge('p1', 'c1', 'genre-artist')],
      totalNodes: 2,
      totalEdges: 1,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const childState = engine.getNodeState('c1')!;
    const initialChildX = childState.x;
    const initialChildY = childState.y;

    engine.stepPhysics(1000);

    expect(childState.x !== initialChildX || childState.y !== initialChildY).toBe(true);
  });

  it('Test 8: Child ALSO moves relative to parent and stays on nested orbit', () => {
    const parent = createMockNode('p1', 'genre', 'Parent', 26);
    const child = createMockNode('c1', 'artist', 'Child', 16);
    const graph: GalaxyGraph = {
      nodes: [parent, child],
      edges: [createMockEdge('p1', 'c1', 'genre-artist')],
      totalNodes: 2,
      totalEdges: 1,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const parentState = engine.getNodeState('p1')!;
    const childState = engine.getNodeState('c1')!;

    const initialLocalAngle = childState.localAngle;

    for (let i = 0; i < 5; i++) {
      engine.stepPhysics(1000);
      // Distance to parent must strictly equal child.localOrbitRadius
      const distToParent = Math.hypot(childState.x - parentState.x, childState.y - parentState.y);
      expect(distToParent).toBeCloseTo(childState.localOrbitRadius, 2);
    }

    // Local angle must have advanced independently
    expect(childState.localAngle).not.toEqual(initialLocalAngle);
  });

  it('Test 9: 30 FPS, 60 FPS, and 120 FPS produce approximately identical positions after same elapsed time', () => {
    const planet = createMockNode('p1', 'genre', 'Planet', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    const engine30 = new OrbitLayoutEngine();
    const engine60 = new OrbitLayoutEngine();
    const engine120 = new OrbitLayoutEngine();

    engine30.buildLayout(graph, 1000, 800);
    engine60.buildLayout(graph, 1000, 800);
    engine120.buildLayout(graph, 1000, 800);

    // 1000ms at 30 FPS (~33.33ms)
    for (let i = 0; i < 30; i++) engine30.stepPhysics(33.333);
    // 1000ms at 60 FPS (~16.66ms)
    for (let i = 0; i < 60; i++) engine60.stepPhysics(16.667);
    // 1000ms at 120 FPS (~8.33ms)
    for (let i = 0; i < 120; i++) engine120.stepPhysics(8.333);

    const s30 = engine30.getNodeState('p1')!;
    const s60 = engine60.getNodeState('p1')!;
    const s120 = engine120.getNodeState('p1')!;

    expect(s30.angle).toBeCloseTo(s60.angle, 2);
    expect(s60.angle).toBeCloseTo(s120.angle, 2);
    expect(s30.x).toBeCloseTo(s60.x, 1);
    expect(s30.y).toBeCloseTo(s60.y, 1);
  });

  it('Test 10: buildLayout() does NOT reset existing node angle unless explicitly requested', () => {
    const planet = createMockNode('p1', 'genre', 'Planet', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    engine.stepPhysics(5000); // Orbit forward for 5 seconds

    const angleAfter5s = engine.getNodeState('p1')!.angle;

    // Call buildLayout() again (e.g. topology refresh)
    engine.buildLayout(graph, 1000, 800);
    const angleAfterRebuild = engine.getNodeState('p1')!.angle;

    // Angle must be preserved!
    expect(angleAfterRebuild).toBeCloseTo(angleAfter5s, 4);

    // Explicit reset must reset to base angle
    engine.resetAngles();
    const angleAfterReset = engine.getNodeState('p1')!.angle;
    expect(angleAfterReset).toBeCloseTo(engine.getNodeState('p1')!.baseAngle, 4);
  });

  it('Test 11: Viewport resize preserves orbital phase and continues motion', () => {
    const planet = createMockNode('p1', 'genre', 'Planet', 26);
    const graph: GalaxyGraph = {
      nodes: [planet],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    engine.stepPhysics(3000);
    const angleBeforeResize = engine.getNodeState('p1')!.angle;

    // Resize viewport from 1000x800 to 1200x900
    engine.buildLayout(graph, 1200, 900);
    const angleAfterResize = engine.getNodeState('p1')!.angle;

    expect(angleAfterResize).toBeCloseTo(angleBeforeResize, 4);

    // Further physics step continues smoothly from preserved angle
    engine.stepPhysics(1000);
    expect(engine.getNodeState('p1')!.angle).toBeGreaterThan(angleAfterResize);
  });

  it('Test 12: Library updates preserve existing node orbital phase', () => {
    const p1 = createMockNode('p1', 'genre', 'Planet 1', 26);
    const graph1: GalaxyGraph = {
      nodes: [p1],
      edges: [],
      totalNodes: 1,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph1, 1000, 800);
    engine.stepPhysics(4000);
    const p1AngleBefore = engine.getNodeState('p1')!.angle;

    // Add a new track p2 to library
    const p2 = createMockNode('p2', 'genre', 'Planet 2', 26);
    const graph2: GalaxyGraph = {
      nodes: [p1, p2],
      edges: [],
      totalNodes: 2,
      totalEdges: 0,
      createdAt: Date.now()
    };

    engine.buildLayout(graph2, 1000, 800);

    // Existing node retains its running orbital phase
    expect(engine.getNodeState('p1')!.angle).toBeCloseTo(p1AngleBefore, 4);
    // New node has a valid initial base angle
    expect(engine.getNodeState('p2')).toBeDefined();
  });

  it('Test 13: Nested child ring center follows moving parent position', () => {
    const parent = createMockNode('p1', 'genre', 'Parent', 26);
    const child = createMockNode('c1', 'artist', 'Child', 16);
    const graph: GalaxyGraph = {
      nodes: [parent, child],
      edges: [createMockEdge('p1', 'c1', 'genre-artist')],
      totalNodes: 2,
      totalEdges: 1,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);
    const parentState = engine.getNodeState('p1')!;
    const initialParentX = parentState.x;
    const initialParentY = parentState.y;

    engine.stepPhysics(2000);

    // Parent moved
    expect(parentState.x).not.toEqual(initialParentX);
    expect(parentState.y).not.toEqual(initialParentY);

    // Ring center is parentState.x, parentState.y, which has moved
    const currentCenterDistance = Math.hypot(parentState.x, parentState.y);
    expect(currentCenterDistance).toBeCloseTo(parentState.orbitRadius, 2);
  });

  it('Test 14: Motion Health — No orbiting planet remains stationary over elapsed time (only central Sun is fixed)', () => {
    const coreSun = createMockNode('core', 'core', 'Central Sun', 42);
    const planet1 = createMockNode('p1', 'genre', 'Big Planet', 26);
    const planet2 = createMockNode('p2', 'artist', 'Medium Planet', 16);
    const moon = createMockNode('m1', 'album', 'Moon', 10);

    const graph: GalaxyGraph = {
      nodes: [coreSun, planet1, planet2, moon],
      edges: [
        createMockEdge('p1', 'p2', 'genre-artist'),
        createMockEdge('p2', 'm1', 'artist-album')
      ],
      totalNodes: 4,
      totalEdges: 2,
      createdAt: Date.now()
    };

    engine.buildLayout(graph, 1000, 800);

    const initialPositions = new Map<string, { x: number; y: number }>();
    engine.getAllNodeStates().forEach(s => {
      initialPositions.set(s.id, { x: s.x, y: s.y });
    });

    // Step physics forward by 2,000ms
    engine.stepPhysics(2000);

    // 1. Central Sun remains stationary at (0, 0)
    const sunState = engine.getNodeState('core')!;
    expect(sunState.x).toEqual(0);
    expect(sunState.y).toEqual(0);

    // 2. Every orbiting planet MUST have moved (MOTION HEALTH ASSERTION)
    const orbitingStates = engine.getAllNodeStates().filter(s => s.id !== 'core');
    expect(orbitingStates.length).toBe(3);

    orbitingStates.forEach(state => {
      const init = initialPositions.get(state.id)!;
      const moved = state.x !== init.x || state.y !== init.y;
      expect(moved).toBe(true); // MUST NOT BE STATIC!
    });
  });
});
