import type { GalaxyNode, GalaxyGraph } from '../../../domain/entities/galaxy-types';

export type OrbitDirection = 1 | -1;

export interface HierarchyNodeState {
  node: GalaxyNode;
  id: string;
  parentId: string | null;
  childrenIds: string[];
  depth: number;

  // Orbit parameters
  orbitRadius: number;       // For root nodes: distance from center. For child nodes: local orbit radius from parent
  localOrbitRadius: number;  // Distance from parent body
  baseAngle: number;
  currentAngle: number;
  angularVelocity: number;   // rad/ms
  direction: OrbitDirection;

  // Coordinates
  localX: number;
  localY: number;
  worldX: number;
  worldY: number;
}

/**
 * Cycle-safe parent lookup to prevent infinite recursion.
 */
export function detectCycle(childParentMap: Map<string, string>, childId: string, parentId: string): boolean {
  let current: string | undefined = parentId;
  const visited = new Set<string>([childId]);

  while (current) {
    if (visited.has(current)) {
      return true; // Cycle detected
    }
    visited.add(current);
    current = childParentMap.get(current);
  }
  return false;
}

/**
 * Builds clean parent-child relationship maps from GalaxyGraph edges and explicit parentId metadata.
 */
export function buildParentChildMaps(graph: GalaxyGraph): {
  parentChildMap: Map<string, string[]>;
  childParentMap: Map<string, string>;
  nodeMap: Map<string, GalaxyNode>;
} {
  const parentChildMap = new Map<string, string[]>();
  const childParentMap = new Map<string, string>();
  const nodeMap = new Map<string, GalaxyNode>();

  graph.nodes.forEach(node => nodeMap.set(node.id, node));

  // Extract edges
  graph.edges.forEach(edge => {
    const validParentChildEdge =
      edge.type === 'genre-artist' ||
      edge.type === 'artist-album' ||
      edge.type === 'album-track' ||
      edge.type === 'artist-track' ||
      edge.type === 'genre-track' ||
      edge.type === 'playlist-track' ||
      edge.type === 'folder-track';

    if (validParentChildEdge && nodeMap.has(edge.sourceId) && nodeMap.has(edge.targetId)) {
      if (!detectCycle(childParentMap, edge.targetId, edge.sourceId)) {
        if (!parentChildMap.has(edge.sourceId)) {
          parentChildMap.set(edge.sourceId, []);
        }
        const existing = parentChildMap.get(edge.sourceId)!;
        if (!existing.includes(edge.targetId)) {
          existing.push(edge.targetId);
        }
        childParentMap.set(edge.targetId, edge.sourceId);
      }
    }
  });

  return { parentChildMap, childParentMap, nodeMap };
}

/**
 * Calculates node depth in hierarchy.
 */
export function calculateNodeDepth(
  nodeId: string,
  childParentMap: Map<string, string>,
  memo = new Map<string, number>()
): number {
  if (memo.has(nodeId)) return memo.get(nodeId)!;

  const parentId = childParentMap.get(nodeId);
  if (!parentId) {
    memo.set(nodeId, 0);
    return 0;
  }

  const depth = calculateNodeDepth(parentId, childParentMap, memo) + 1;
  memo.set(nodeId, depth);
  return depth;
}

/**
 * Solves recursive world positions topologically for arbitrary nesting depth.
 * Formula:
 *   Root node: world = center + (cos(angle) * orbitRadius, sin(angle) * orbitRadius)
 *   Child node: world = parent.world + (cos(localAngle) * localOrbitRadius, sin(localAngle) * localOrbitRadius)
 */
export function solveWorldPositionsRecursively(
  states: Map<string, HierarchyNodeState>,
  centerX: number = 0,
  centerY: number = 0
): void {
  const resolved = new Set<string>();

  const resolve = (state: HierarchyNodeState) => {
    if (resolved.has(state.id)) return;

    if (!state.parentId || !states.has(state.parentId)) {
      // Root Node (depth 0)
      if (state.orbitRadius === 0) {
        state.localX = 0;
        state.localY = 0;
        state.worldX = centerX;
        state.worldY = centerY;
      } else {
        state.localX = Math.cos(state.currentAngle) * state.orbitRadius;
        state.localY = Math.sin(state.currentAngle) * state.orbitRadius;
        state.worldX = centerX + state.localX;
        state.worldY = centerY + state.localY;
      }
      resolved.add(state.id);
      return;
    }

    // Child Node: Ensure parent position is resolved first
    const parentState = states.get(state.parentId)!;
    if (!resolved.has(parentState.id)) {
      resolve(parentState);
    }

    // Local position relative to parent
    state.localX = Math.cos(state.currentAngle) * state.localOrbitRadius;
    state.localY = Math.sin(state.currentAngle) * state.localOrbitRadius;

    // World position inherits parent's full world position
    state.worldX = parentState.worldX + state.localX;
    state.worldY = parentState.worldY + state.localY;
    resolved.add(state.id);
  };

  states.forEach(state => resolve(state));
}
