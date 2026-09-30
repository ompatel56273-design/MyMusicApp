import type { GalaxyNode, GalaxyGraph } from '../../../domain/entities/galaxy-types';
import { buildParentChildMaps, calculateNodeDepth } from './orbit-hierarchy';

export type OrbitDirection = 1 | -1; // 1 = Clockwise, -1 = Counter-Clockwise
export type LabelPosition = 'bottom' | 'top' | 'right' | 'left';
export type GalaxyCategory = 'standalone' | 'album' | 'artist' | 'genre';

export interface GalaxyOrbitTimingConfig {
  innerPeriodMs: number;     // Zone 1 (First Category / Standalone): 50,000ms (~50s / revolution)
  middlePeriodMs: number;    // Zone 2 (Second Category / Albums): 65,000ms (~65s / revolution)
  outerPeriodMs: number;     // Zone 3 (Third Category / Artists): 80,000ms (~80s / revolution)
  farOuterPeriodMs: number;  // Zone 4 (Fourth Category / Genres): 95,000ms (~95s / revolution)
  nestedPeriodMs: number;    // Child orbits around parents: 65,000ms (~65s / revolution)
  maxDeltaMs: number;        // Clamp for tab switching / backgrounding: 100ms
  mobileSpeedMultiplier: number; // Calm speed multiplier for mobile: 0.85
}

/**
 * Centralized Orbit Speed & Timing Configuration
 */
export const GALAXY_ORBIT_TIMING: GalaxyOrbitTimingConfig = {
  innerPeriodMs: 50_000,
  middlePeriodMs: 65_000,
  outerPeriodMs: 80_000,
  farOuterPeriodMs: 95_000,
  nestedPeriodMs: 65_000,
  maxDeltaMs: 100,
  mobileSpeedMultiplier: 0.85
};

export function getOrbitPeriodForLevel(level: number, isMobile = false): number {
  let period: number;
  if (level <= 1) period = GALAXY_ORBIT_TIMING.innerPeriodMs;
  else if (level === 2) period = GALAXY_ORBIT_TIMING.middlePeriodMs;
  else if (level === 3) period = GALAXY_ORBIT_TIMING.outerPeriodMs;
  else period = GALAXY_ORBIT_TIMING.farOuterPeriodMs;

  if (isMobile) {
    period /= GALAXY_ORBIT_TIMING.mobileSpeedMultiplier;
  }
  return period;
}

export interface OrbitLane {
  id: string;
  laneIndex: number;
  level: number;
  category: GalaxyCategory | 'core';
  name: string;
  radius: number;
  direction: OrbitDirection;
  speed: number;
  nodeIds: string[];
}

export interface OrbitNodeState {
  id: string; // Authoritative node identifier
  node: GalaxyNode;
  laneIndex: number;
  category: GalaxyCategory | 'core';
  orbitRadius: number;
  baseAngle: number;
  angle: number; // Persistent authoritative current angle
  currentAngle: number; // Alias for backward compatibility
  angularVelocity: number;
  direction: OrbitDirection;

  // Final Resolved World coordinates
  x: number;
  y: number;

  // Local offset coordinates relative to immediate parent
  localX: number;
  localY: number;

  // Recursive Parent-child hierarchy properties
  parentId: string | null;
  childrenIds: string[];
  depth: number;
  isParent: boolean;
  localOrbitRadius: number;
  localBaseAngle: number;
  localAngle: number; // Persistent authoritative local angle
  localCurrentAngle: number; // Alias for backward compatibility
  localAngularVelocity: number;

  // Visual geometry scale
  visualRadius: number;

  // Label placement & bounding box
  labelPosition: LabelPosition;
  labelWidth: number;
  labelHeight: number;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Deterministic string hash for consistent initial phase offsets.
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Assigns standardized visual radius based on hierarchy depth and category (V10.2 visual scale).
 * Sun: 42px, Genre: 20px (18-22px), Artist: 15px (14-17px), Album: 11px (10-13px), Standalone Song: 5px (4-6px)
 */
export function getScaledVisualRadius(depth: number, originalRadius: number, nodeType?: string): number {
  if (depth === 0 || nodeType === 'core') return 42; // Sun Core
  if (nodeType === 'genre') return 20; // Genre Planet (18-22px)
  if (nodeType === 'artist') return 15; // Artist Planet (14-17px)
  if (nodeType === 'album') return 11;  // Album Planet (10-13px)
  if (nodeType === 'track') return 5;   // Standalone Song / Track Moon (4-6px)
  return Math.max(4, Math.min(20, originalRadius));
}

/**
 * OrbitLayoutEngine V10.2 — Category-Preserving Multi-Ring Solar System Architecture
 * Features strict radial zone sequence:
 * SUN (Center) -> STANDALONE SONGS (Zone 1) -> ALBUMS (Zone 2) -> ARTISTS (Zone 3) -> GENRES (Zone 4)
 * Guarantees zero category mixing inside the same ring and compact standalone zone packing.
 */
export class OrbitLayoutEngine {
  private lanes: OrbitLane[] = [];
  private nodeStates = new Map<string, OrbitNodeState>();
  private graph: GalaxyGraph | null = null;
  private viewportWidth = 1000;
  private viewportHeight = 800;
  private orbitClock = 0;
  private expandedParentIds = new Set<string>();
  private isMobileViewport = false;

  public getLanes(): readonly OrbitLane[] {
    return this.lanes;
  }

  public getNodeState(nodeId: string): OrbitNodeState | undefined {
    return this.nodeStates.get(nodeId);
  }

  public getAllNodeStates(): OrbitNodeState[] {
    return Array.from(this.nodeStates.values());
  }

  public getOrbitClock(): number {
    return this.orbitClock;
  }

  public getMaxWorldRadius(): number {
    let maxR = 0;
    this.lanes.forEach(l => {
      if (l.radius > maxR) maxR = l.radius;
    });
    this.nodeStates.forEach(s => {
      const r = Math.hypot(s.x, s.y) + s.visualRadius;
      if (r > maxR) maxR = r;
    });
    return Math.max(maxR, 200);
  }

  public setIsMobileViewport(isMobile: boolean): void {
    this.isMobileViewport = isMobile;
  }

  public setExpandedParents(parentIds: string[]): void {
    this.expandedParentIds = new Set(parentIds);
  }

  public toggleParentExpansion(parentId: string): void {
    if (this.expandedParentIds.has(parentId)) {
      this.expandedParentIds.delete(parentId);
    } else {
      this.expandedParentIds.add(parentId);
    }
    if (this.graph) {
      this.buildLayout(this.graph, this.viewportWidth, this.viewportHeight);
    }
  }

  /**
   * Builds the category-preserving multi-ring solar system layout.
   */
  public buildLayout(graph: GalaxyGraph, viewportWidth: number, viewportHeight: number): void {
    this.graph = graph;
    this.viewportWidth = Math.max(viewportWidth, 200);
    this.viewportHeight = Math.max(viewportHeight, 200);
    this.isMobileViewport = this.viewportWidth <= 768;

    // Snapshot existing persistent angles before rebuild so motion remains smooth!
    const existingAngles = new Map<string, { angle: number; localAngle: number }>();
    this.nodeStates.forEach((state, id) => {
      existingAngles.set(id, {
        angle: state.angle ?? state.currentAngle,
        localAngle: state.localAngle ?? state.localCurrentAngle
      });
    });

    this.nodeStates.clear();
    this.lanes = [];

    if (!graph || graph.nodes.length === 0) {
      return;
    }

    const minDimension = Math.min(this.viewportWidth, this.viewportHeight);
    const scaleFactor = Math.min(1, Math.max(0.65, minDimension / 800));
    const minFirstOrbitRadius = Math.max(120, Math.round(160 * scaleFactor));

    // 1. Extract Parent-Child Hierarchy Relationships across arbitrary depths
    const { parentChildMap, childParentMap } = buildParentChildMaps(graph);

    // Compute node depths
    const depthMemo = new Map<string, number>();
    graph.nodes.forEach(n => calculateNodeDepth(n.id, childParentMap, depthMemo));

    // 2. Identify Core Sun Node (Center 0, 0, Level 0)
    const coreSunNode = graph.nodes.find(n => (n.type as string) === 'core' || n.id === 'core');

    if (coreSunNode) {
      const coreLane: OrbitLane = {
        id: 'lane_0_core',
        laneIndex: 0,
        level: 0,
        category: 'core',
        name: 'Sun Core',
        radius: 0,
        direction: 1,
        speed: 0,
        nodeIds: [coreSunNode.id]
      };
      this.lanes.push(coreLane);

      coreSunNode.radius = 42;
      this.nodeStates.set(coreSunNode.id, {
        id: coreSunNode.id,
        node: coreSunNode,
        laneIndex: 0,
        category: 'core',
        orbitRadius: 0,
        baseAngle: 0,
        angle: 0,
        currentAngle: 0,
        angularVelocity: 0,
        direction: 1,
        x: 0,
        y: 0,
        localX: 0,
        localY: 0,
        parentId: null,
        childrenIds: parentChildMap.get(coreSunNode.id) || [],
        depth: 0,
        isParent: true,
        localOrbitRadius: 0,
        localBaseAngle: 0,
        localAngle: 0,
        localCurrentAngle: 0,
        localAngularVelocity: 0,
        visualRadius: 42,
        labelPosition: 'bottom',
        labelWidth: Math.min(120, coreSunNode.label.length * 7.5 + 16),
        labelHeight: 18
      });
    }

    // 3. Classify Primary Root Planets into 4 Strict Categories (V10 MANDATORY RADIAL ORDER):
    // SUN (Center) -> Zone 1: Standalone Songs -> Zone 2: Albums -> Zone 3: Artists -> Zone 4: Genres
    // Primary category planets always orbit the Sun directly in their assigned zone by entity type.
    const standaloneNodes: GalaxyNode[] = [];
    const albumNodes: GalaxyNode[] = [];
    const artistNodes: GalaxyNode[] = [];
    const genreNodes: GalaxyNode[] = [];
    const nestedChildNodes = new Set<string>();
    const hasCore = Boolean(coreSunNode);

    // Identify nested child nodes
    graph.nodes.forEach(node => {
      if (childParentMap.has(node.id)) {
        if (!hasCore) {
          nestedChildNodes.add(node.id);
        } else if (node.type === 'track' && this.expandedParentIds.has(childParentMap.get(node.id)!)) {
          nestedChildNodes.add(node.id);
        }
      }
    });

    graph.nodes.forEach(node => {
      if (node.id === 'core' || (node.type as string) === 'core') return;
      if (nestedChildNodes.has(node.id)) return; // Handled as nested satellites

      const t = node.type as string;
      if (t === 'track') standaloneNodes.push(node);
      else if (t === 'album') albumNodes.push(node);
      else if (t === 'artist') artistNodes.push(node);
      else if (t === 'genre') genreNodes.push(node);
      else standaloneNodes.push(node);
    });

    const categoryGroups: Array<{
      category: GalaxyCategory;
      name: string;
      nodes: GalaxyNode[];
      ringStep: number;
      categoryGap: number;
      minPlanetGap: number;
      maxCapacity: number;
      targetArc: number;
    }> = [
      {
        category: 'standalone',
        name: 'Standalone Songs',
        nodes: standaloneNodes,
        ringStep: Math.round(28 * scaleFactor),
        categoryGap: Math.round(80 * scaleFactor),
        minPlanetGap: 18,
        maxCapacity: 28,
        targetArc: 24
      },
      {
        category: 'album',
        name: 'Albums',
        nodes: albumNodes,
        ringStep: Math.round(54 * scaleFactor),
        categoryGap: Math.round(90 * scaleFactor),
        minPlanetGap: 30,
        maxCapacity: 8,
        targetArc: 52
      },
      {
        category: 'artist',
        name: 'Artists',
        nodes: artistNodes,
        ringStep: Math.round(64 * scaleFactor),
        categoryGap: Math.round(105 * scaleFactor),
        minPlanetGap: 36,
        maxCapacity: 6,
        targetArc: 66
      },
      {
        category: 'genre',
        name: 'Genres',
        nodes: genreNodes,
        ringStep: Math.round(76 * scaleFactor),
        categoryGap: Math.round(115 * scaleFactor),
        minPlanetGap: 44,
        maxCapacity: 5,
        targetArc: 84
      }
    ];

    let currentSunLaneIndex = 1;
    let currentOrbitRadius = minFirstOrbitRadius;

    // 4. Sequential Radial Allocator across Category Zones (Center Outward)
    categoryGroups.forEach(group => {
      if (group.nodes.length === 0) return;

      const categoryLanes = this.allocateCategoryRings(
        group.nodes,
        currentOrbitRadius,
        currentSunLaneIndex,
        group.category,
        group.name,
        group.ringStep,
        group.minPlanetGap,
        group.maxCapacity,
        group.targetArc
      );

      categoryLanes.forEach(subLane => {
        this.lanes.push(subLane.lane);

        subLane.allocatedNodes.forEach(item => {
          const scaledRadius = getScaledVisualRadius(subLane.lane.level, item.node.radius, item.node.type);
          item.node.radius = scaledRadius;
          const children = parentChildMap.get(item.node.id) || [];
          const prev = existingAngles.get(item.node.id);
          const persistentAngle = prev !== undefined ? prev.angle : item.angle;

          this.nodeStates.set(item.node.id, {
            id: item.node.id,
            node: item.node,
            laneIndex: subLane.lane.laneIndex,
            category: group.category,
            orbitRadius: subLane.lane.radius,
            baseAngle: item.angle,
            angle: persistentAngle,
            currentAngle: persistentAngle,
            angularVelocity: subLane.lane.speed,
            direction: subLane.lane.direction,
            x: Math.cos(persistentAngle) * subLane.lane.radius,
            y: Math.sin(persistentAngle) * subLane.lane.radius,
            localX: Math.cos(persistentAngle) * subLane.lane.radius,
            localY: Math.sin(persistentAngle) * subLane.lane.radius,
            parentId: null,
            childrenIds: children,
            depth: subLane.lane.level,
            isParent: children.length > 0,
            localOrbitRadius: 0,
            localBaseAngle: 0,
            localAngle: 0,
            localCurrentAngle: 0,
            localAngularVelocity: 0,
            visualRadius: scaledRadius,
            labelPosition: 'bottom',
            labelWidth: Math.min(120, item.node.label.length * 7.5 + 16),
            labelHeight: 18
          });
        });
        currentSunLaneIndex++;
      });

      const outerRingRadius = categoryLanes.length > 0 ? categoryLanes[categoryLanes.length - 1]!.lane.radius : currentOrbitRadius;
      currentOrbitRadius = outerRingRadius + group.categoryGap;
    });

    // Enforce Angular Collision Resolution Pass on all root planet ring node states
    const laneMap = new Map<number, OrbitNodeState[]>();
    this.nodeStates.forEach(state => {
      if (state.parentId === null && state.laneIndex > 0) {
        const list = laneMap.get(state.laneIndex) || [];
        list.push(state);
        laneMap.set(state.laneIndex, list);
      }
    });

    laneMap.forEach((statesOnLane) => {
      if (statesOnLane.length <= 1) return;
      statesOnLane.sort((a, b) => a.angle - b.angle);
      const isStandalone = statesOnLane[0]!.category === 'standalone';
      const MIN_PLANET_GAP = isStandalone ? 18 : 36;
      const radius = statesOnLane[0]!.orbitRadius;

      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < statesOnLane.length; i++) {
          const curr = statesOnLane[i]!;
          const next = statesOnLane[(i + 1) % statesOnLane.length]!;

          const minDistance = curr.visualRadius + next.visualRadius + MIN_PLANET_GAP;
          const minAngularSep = minDistance / radius;

          let diff = next.angle - curr.angle;
          if (i === statesOnLane.length - 1) {
            diff += Math.PI * 2;
          }

          if (diff < minAngularSep) {
            const shift = (minAngularSep - diff) / 2;
            curr.angle -= shift;
            curr.currentAngle = curr.angle;
            next.angle += shift;
            next.currentAngle = next.angle;
          }
        }
      }

      statesOnLane.forEach(state => {
        state.x = Math.cos(state.angle) * state.orbitRadius;
        state.y = Math.sin(state.angle) * state.orbitRadius;
        state.localX = state.x;
        state.localY = state.y;
      });
    });

    // 5. Recursively Attach Hierarchical Child Orbits distributed across 360° around parent
    const attachChildOrbitsRecursively = (parentId: string) => {
      const parentState = this.nodeStates.get(parentId);
      if (!parentState) return;

      const childrenIds = parentChildMap.get(parentId) || [];
      const childrenNodes = graph.nodes.filter(n => childrenIds.includes(n.id) && nestedChildNodes.has(n.id));

      if (childrenNodes.length === 0) return;

      const childDepth = parentState.depth + 1;
      const maxChildrenPerNestedLane = 6;
      let remainingChildren = [...childrenNodes];
      let nestedLaneIndex = 0;

      while (remainingChildren.length > 0) {
        const batchCount = Math.min(remainingChildren.length, maxChildrenPerNestedLane);
        const batch = remainingChildren.slice(0, batchCount);
        remainingChildren = remainingChildren.slice(batchCount);

        const maxChildRadiusInBatch = Math.max(
          ...batch.map(c => getScaledVisualRadius(childDepth, c.radius, c.type))
        );
        let currentLocalRadius = parentState.visualRadius + maxChildRadiusInBatch + 36 + nestedLaneIndex * 24;

        const childDirection: OrbitDirection = (childDepth % 2 === 0 ? -1 : 1) as OrbitDirection;
        const periodMs = getOrbitPeriodForLevel(childDepth, this.isMobileViewport);
        const childSpeed = childDirection * ((Math.PI * 2) / periodMs);
        const nestedLanePhaseOffset = nestedLaneIndex * (Math.PI / 3) + (hashString(parentId) % 100) / 100;

        batch.forEach((childNode, idx) => {
          const scaledRadius = getScaledVisualRadius(childDepth, childNode.radius, childNode.type);
          childNode.radius = scaledRadius;

          const localAngle = (idx / batch.length) * Math.PI * 2 + nestedLanePhaseOffset;
          const grandChildren = parentChildMap.get(childNode.id) || [];
          const prev = existingAngles.get(childNode.id);
          const persistentLocalAngle = prev !== undefined ? prev.localAngle : localAngle;

          this.nodeStates.set(childNode.id, {
            id: childNode.id,
            node: childNode,
            laneIndex: -1,
            category: parentState.category,
            orbitRadius: currentLocalRadius,
            baseAngle: localAngle,
            angle: persistentLocalAngle,
            currentAngle: persistentLocalAngle,
            angularVelocity: childSpeed,
            direction: childDirection,
            x: parentState.x + Math.cos(persistentLocalAngle) * currentLocalRadius,
            y: parentState.y + Math.sin(persistentLocalAngle) * currentLocalRadius,
            localX: Math.cos(persistentLocalAngle) * currentLocalRadius,
            localY: Math.sin(persistentLocalAngle) * currentLocalRadius,
            parentId: parentId,
            childrenIds: grandChildren,
            depth: childDepth,
            isParent: grandChildren.length > 0,
            localOrbitRadius: currentLocalRadius,
            localBaseAngle: localAngle,
            localAngle: persistentLocalAngle,
            localCurrentAngle: persistentLocalAngle,
            localAngularVelocity: childSpeed,
            visualRadius: scaledRadius,
            labelPosition: 'bottom',
            labelWidth: Math.min(100, childNode.label.length * 7 + 12),
            labelHeight: 16
          });

          if (grandChildren.length > 0) {
            attachChildOrbitsRecursively(childNode.id);
          }
        });

        nestedLaneIndex++;
      }
    };

    Array.from(this.nodeStates.keys()).forEach(parentId => {
      attachChildOrbitsRecursively(parentId);
    });

    // 6. Initial Physics Step & Collision-Safe Label Placement
    this.stepPhysics(0);
    this.resolveLabelCollisions();
  }

  /**
   * Allocates category-pure concentric orbit rings for a specific category zone.
   * Never mixes different categories inside the same ring.
   */
  private allocateCategoryRings(
    nodes: GalaxyNode[],
    startRadius: number,
    startLaneIndex: number,
    category: GalaxyCategory,
    categoryName: string,
    ringStep: number,
    minPlanetGap: number,
    maxCapacityLimit: number,
    targetArcPerNode: number
  ): Array<{ lane: OrbitLane; allocatedNodes: Array<{ node: GalaxyNode; angle: number }> }> {
    const result: Array<{ lane: OrbitLane; allocatedNodes: Array<{ node: GalaxyNode; angle: number }> }> = [];
    if (nodes.length === 0) return result;

    let remainingNodes = [...nodes];
    let laneIdx = startLaneIndex;
    let currentRadius = startRadius;

    while (remainingNodes.length > 0) {
      const circumference = 2 * Math.PI * currentRadius;
      const ringCapacity = Math.min(maxCapacityLimit, Math.max(3, Math.floor(circumference / targetArcPerNode)));

      const batchCount = Math.min(remainingNodes.length, ringCapacity);
      const batch = remainingNodes.slice(0, batchCount);
      remainingNodes = remainingNodes.slice(batchCount);

      // Level 1 = Clockwise (+1), Level 2 = Counter-Clockwise (-1), Level 3 = Clockwise (+1), Level 4 = Counter-Clockwise (-1)
      const laneLevel = laneIdx;
      const direction: OrbitDirection = (laneLevel % 2 === 1 ? 1 : -1) as OrbitDirection;
      const periodMs = getOrbitPeriodForLevel(laneLevel, this.isMobileViewport);
      const signedSpeed = direction * ((Math.PI * 2) / periodMs);

      // Stagger phase offset per ring to prevent radial alignment with adjacent rings
      const subRingIndex = result.length;
      const lanePhaseOffset = (laneLevel * Math.PI / 3) + subRingIndex * (Math.PI / Math.max(1, batch.length * 0.5));

      const allocatedNodes: Array<{ node: GalaxyNode; angle: number }> = [];
      batch.forEach((node, idx) => {
        const angle = lanePhaseOffset + (idx / batch.length) * Math.PI * 2;
        allocatedNodes.push({ node, angle });
      });

      this.resolveAngularCollisions(allocatedNodes, currentRadius, minPlanetGap);

      const ringName = result.length === 0 ? categoryName : `${categoryName} Orbit ${result.length + 1}`;
      const lane: OrbitLane = {
        id: `lane_${laneIdx}_${category}`,
        laneIndex: laneIdx,
        level: laneLevel,
        category,
        name: ringName,
        radius: currentRadius,
        direction,
        speed: signedSpeed,
        nodeIds: batch.map(n => n.id)
      };

      result.push({ lane, allocatedNodes });
      laneIdx++;
      currentRadius += ringStep;
    }

    return result;
  }

  /**
   * Ensures nodes on the same orbital ring maintain minimum angular separation based on visual radii + minPlanetGap.
   */
  private resolveAngularCollisions(items: Array<{ node: GalaxyNode; angle: number }>, radius: number, minPlanetGap = 36): void {
    if (items.length <= 1 || radius <= 0) return;

    items.sort((a, b) => a.angle - b.angle);

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < items.length; i++) {
        const current = items[i]!;
        const next = items[(i + 1) % items.length]!;

        const radA = getScaledVisualRadius(1, current.node.radius, current.node.type);
        const radB = getScaledVisualRadius(1, next.node.radius, next.node.type);
        const minDistance = radA + radB + minPlanetGap;
        const minAngularSep = minDistance / radius;

        let angularDiff = next.angle - current.angle;
        if (i === items.length - 1) {
          angularDiff += Math.PI * 2;
        }

        if (angularDiff < minAngularSep) {
          const shift = (minAngularSep - angularDiff) / 2;
          current.angle -= shift;
          next.angle += shift;
        }
      }
    }
  }

  /**
   * Advances orbital physics clock using frame-rate independent clamped delta-time and solves world positions recursively.
   */
  public stepPhysics(deltaMs: number = 16): void {
    const safeDelta = Math.max(0, Math.min(deltaMs, GALAXY_ORBIT_TIMING.maxDeltaMs));
    this.orbitClock += safeDelta;

    const allStates = Array.from(this.nodeStates.values());

    // 1. Incrementally advance authoritative angles
    allStates.forEach(state => {
      if (state.parentId === null) {
        if (state.orbitRadius === 0) {
          state.angle = 0;
          state.currentAngle = 0;
        } else {
          state.angle += state.angularVelocity * safeDelta;
          state.currentAngle = state.angle;
        }
      } else {
        state.localAngle += state.localAngularVelocity * safeDelta;
        state.localCurrentAngle = state.localAngle;
        state.angle = state.localAngle;
        state.currentAngle = state.localAngle;
      }
    });

    // 2. Solve World Positions Recursively
    const resolved = new Set<string>();

    const resolvePosition = (state: OrbitNodeState) => {
      if (resolved.has(state.node.id)) return;

      if (state.parentId === null || !this.nodeStates.has(state.parentId)) {
        if (state.orbitRadius === 0) {
          state.localX = 0;
          state.localY = 0;
          state.x = 0;
          state.y = 0;
        } else {
          state.localX = Math.cos(state.angle) * state.orbitRadius;
          state.localY = Math.sin(state.angle) * state.orbitRadius;
          state.x = state.localX;
          state.y = state.localY;
        }
        state.node.x = state.x;
        state.node.y = state.y;
        resolved.add(state.node.id);
        return;
      }

      const parentState = this.nodeStates.get(state.parentId)!;
      if (!resolved.has(parentState.node.id)) {
        resolvePosition(parentState);
      }

      state.localX = Math.cos(state.localAngle) * state.localOrbitRadius;
      state.localY = Math.sin(state.localAngle) * state.localOrbitRadius;

      state.x = parentState.x + state.localX;
      state.y = parentState.y + state.localY;
      state.node.x = state.x;
      state.node.y = state.y;
      resolved.add(state.id);
    };

    allStates.forEach(state => resolvePosition(state));
  }

  /**
   * Explicitly resets all node angles back to their initial layout base angles.
   */
  public resetAngles(): void {
    this.orbitClock = 0;
    this.nodeStates.forEach(state => {
      state.angle = state.baseAngle;
      state.currentAngle = state.baseAngle;
      state.localAngle = state.localBaseAngle;
      state.localCurrentAngle = state.localBaseAngle;
    });
    this.stepPhysics(0);
  }

  /**
   * Chooses optimal collision-free placement for text labels with radial outward placement and fallback.
   */
  public resolveLabelCollisions(): void {
    const placedBoxes: BoundingBox[] = [];
    const positions: LabelPosition[] = ['bottom', 'top', 'right', 'left'];

    this.nodeStates.forEach(state => {
      const r = state.visualRadius;
      const w = state.labelWidth;
      const h = state.labelHeight;

      let bestPos: LabelPosition = 'bottom';
      let minOverlap = Infinity;

      for (const pos of positions) {
        let box: BoundingBox;
        if (pos === 'bottom') {
          box = { x1: state.x - w / 2, y1: state.y + r + 6, x2: state.x + w / 2, y2: state.y + r + 6 + h };
        } else if (pos === 'top') {
          box = { x1: state.x - w / 2, y1: state.y - r - 6 - h, x2: state.x + w / 2, y2: state.y - r - 6 };
        } else if (pos === 'right') {
          box = { x1: state.x + r + 8, y1: state.y - h / 2, x2: state.x + r + 8 + w, y2: state.y + h / 2 };
        } else {
          box = { x1: state.x - r - 8 - w, y1: state.y - h / 2, x2: state.x - r - 8, y2: state.y + h / 2 };
        }

        let overlapCount = 0;
        for (const existing of placedBoxes) {
          if (!(box.x2 < existing.x1 || box.x1 > existing.x2 || box.y2 < existing.y1 || box.y1 > existing.y2)) {
            overlapCount++;
          }
        }

        if (overlapCount < minOverlap) {
          minOverlap = overlapCount;
          bestPos = pos;
        }

        if (minOverlap === 0) break;
      }

      state.labelPosition = bestPos;

      let winningBox: BoundingBox;
      if (bestPos === 'bottom') {
        winningBox = { x1: state.x - w / 2, y1: state.y + r + 6, x2: state.x + w / 2, y2: state.y + r + 6 + h };
      } else if (bestPos === 'top') {
        winningBox = { x1: state.x - w / 2, y1: state.y - r - 6 - h, x2: state.x + w / 2, y2: state.y - r - 6 };
      } else if (bestPos === 'right') {
        winningBox = { x1: state.x + r + 8, y1: state.y - h / 2, x2: state.x + r + 8 + w, y2: state.y + h / 2 };
      } else {
        winningBox = { x1: state.x - r - 8 - w, y1: state.y - h / 2, x2: state.x - r - 8, y2: state.y + h / 2 };
      }
      placedBoxes.push(winningBox);
    });
  }
}
