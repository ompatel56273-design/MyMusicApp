import type { GalaxyNode, GalaxyGraph } from '../../../domain/entities/galaxy-types';
import { OrbitLayoutEngine } from './orbit-layout-engine';
import { GalaxyProjection } from './galaxy-projection';

export interface ViewportCamera {
  x: number; // Viewport center X in world space
  y: number; // Viewport center Y in world space
  zoom: number; // Scale factor (0.1x to 4.0x)
}

export interface GalaxyRendererCallbacks {
  onNodeClick?: (node: GalaxyNode) => void;
  onNodeDoubleClick?: (node: GalaxyNode) => void;
  onBackgroundClick?: () => void;
  onCameraChange?: (camera: ViewportCamera) => void;
}

interface CosmicStar {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
}

/**
 * High-Performance Pure HTML5 Canvas 2D Audio Galaxy Renderer v7 (Clean Solar System).
 * Driven by OrbitLayoutEngine + GalaxyProjection:
 * - Clean Solar System Hierarchy (Sun -> Genres -> Artists -> Albums -> Track Moons)
 * - Max 6 Genre planets around central Sun
 * - Track labels hidden by default
 * - Nested Orbit Hierarchies with moving parent orbits
 */
export class GalaxyCanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private callbacks: GalaxyRendererCallbacks = {};

  private rawGraph: GalaxyGraph | null = null;
  private graph: GalaxyGraph | null = null;
  private selectedNodeId: string | null = null;
  private focusedNodeId: string | null = null;
  private playingEntityId: string | null = null;
  private reducedMotion = false;
  private expandedParentIds = new Set<string>();

  private camera: ViewportCamera = { x: 0, y: 0, zoom: 0.60 };
  private targetCamera: ViewportCamera = { x: 0, y: 0, zoom: 0.60 };

  // Static cosmic starfield in world space for parallax/depth
  private stars: CosmicStar[] = [];

  // Decoupled Collision-Free Orbit Layout Engine
  private layoutEngine = new OrbitLayoutEngine();

  // Pointer drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private lastPointerUpTime = 0;
  private lastClickedNodeId: string | null = null;

  // Animation frame loop
  private animationHandle: number | null = null;
  private pulsePhase = 0;

  constructor(callbacks?: GalaxyRendererCallbacks) {
    if (callbacks) this.callbacks = callbacks;
    this.initCosmicStars();
  }

  public getLayoutEngine(): OrbitLayoutEngine {
    return this.layoutEngine;
  }

  public getOrbitClock(): number {
    return this.layoutEngine.getOrbitClock();
  }

  public stepOrbitPhysics(deltaMs: number = 16): void {
    if (this.reducedMotion) return;
    this.layoutEngine.stepPhysics(deltaMs);
  }

  private initCosmicStars(): void {
    this.stars = [];
    const starColors = ['#ffffff', '#a855f7', '#38bdf8', '#c084fc', '#e0e7ff'];
    for (let i = 0; i < 180; i++) {
      const radius = 200 + Math.random() * 2200;
      const angle = Math.random() * Math.PI * 2;
      this.stars.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: Math.random() < 0.15 ? 2.2 : Math.random() * 1.5 + 0.5,
        opacity: 0.2 + Math.random() * 0.7,
        color: starColors[Math.floor(Math.random() * starColors.length)] || '#ffffff'
      });
    }
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.bindEvents();
    this.resize();
    this.startAnimation();
  }

  public detachCanvas(): void {
    this.unbindEvents();
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
  }

  private hoveredNodeId: string | null = null;

  public getUsableViewport(): { width: number; height: number; centerX: number; centerY: number } {
    if (!this.canvas) {
      return { width: 1000, height: 800, centerX: 500, centerY: 400 };
    }
    const rect = this.canvas.getBoundingClientRect();
    const rawWidth = Math.max(rect.width || this.canvas.clientWidth || 0, 100);
    const rawHeight = Math.max(rect.height || this.canvas.clientHeight || 0, 100);

    return { width: rawWidth, height: rawHeight, centerX: rawWidth / 2, centerY: rawHeight / 2 };
  }

  private computeAutoFitZoom(width?: number, height?: number): number {
    const usable = this.getUsableViewport();
    const useWidth = width ? Math.min(width, usable.width) : usable.width;
    const useHeight = height ? Math.min(height, usable.height) : usable.height;

    const isMobile = useWidth <= 768;
    this.layoutEngine.setIsMobileViewport(isMobile);

    const maxWorldR = this.layoutEngine.getMaxWorldRadius();
    const minDim = Math.min(useWidth, useHeight);

    const TARGET_FILL_RATIO = isMobile ? 0.38 : 0.43;
    const outermostVisualRadius = 22;
    const viewportSafetyPadding = isMobile ? 16 : 24;
    const outerExtent = maxWorldR + outermostVisualRadius + viewportSafetyPadding;

    const targetZoom = (minDim * TARGET_FILL_RATIO) / Math.max(outerExtent, 150);
    const minZoomLimit = isMobile ? 0.20 : 0.40;
    return Math.max(minZoomLimit, Math.min(1.40, targetZoom));
  }

  public setGraph(graph: GalaxyGraph): void {
    this.rawGraph = graph;
    const projected = GalaxyProjection.projectGraph(graph, { expandedNodeIds: this.expandedParentIds });
    this.graph = projected;
    const width = this.canvas ? this.canvas.getBoundingClientRect().width : 1000;
    const height = this.canvas ? this.canvas.getBoundingClientRect().height : 800;

    this.layoutEngine.buildLayout(projected, width, height);
    const fitZoom = this.computeAutoFitZoom(width, height);
    this.targetCamera = { x: 0, y: 0, zoom: fitZoom };
    this.camera = { x: 0, y: 0, zoom: fitZoom };
    this.requestRedraw();
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public setSelectedNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    if (nodeId) {
      if (this.expandedParentIds.has(nodeId)) {
        this.expandedParentIds.delete(nodeId);
      } else {
        this.expandedParentIds.add(nodeId);
      }
    } else {
      this.expandedParentIds.clear();
    }
    if (this.rawGraph) {
      const projected = GalaxyProjection.projectGraph(this.rawGraph, { expandedNodeIds: this.expandedParentIds });
      this.graph = projected;
      const width = this.canvas ? this.canvas.getBoundingClientRect().width : 1000;
      const height = this.canvas ? this.canvas.getBoundingClientRect().height : 800;
      this.layoutEngine.buildLayout(projected, width, height);
    }
    this.requestRedraw();
  }

  public setFocusedNode(nodeId: string | null): void {
    this.focusedNodeId = nodeId;
    this.requestRedraw();
  }

  public setPlayingEntity(entityId: string | null): void {
    this.playingEntityId = entityId;
    this.requestRedraw();
  }

  public getCamera(): ViewportCamera {
    return { ...this.camera };
  }

  public resetCamera(): void {
    const width = this.canvas ? this.canvas.getBoundingClientRect().width : 1000;
    const height = this.canvas ? this.canvas.getBoundingClientRect().height : 800;
    const fitZoom = this.computeAutoFitZoom(width, height);
    this.targetCamera = { x: 0, y: 0, zoom: fitZoom };
    this.requestRedraw();
  }

  public zoomIn(): void {
    this.setZoomTarget(this.camera.zoom * 1.25);
  }

  public zoomOut(): void {
    this.setZoomTarget(this.camera.zoom * 0.8);
  }

  public centerOnCoordinates(x: number, y: number, zoom?: number): void {
    this.targetCamera.x = x;
    this.targetCamera.y = y;
    this.camera.x = x;
    this.camera.y = y;
    if (zoom !== undefined) {
      this.targetCamera.zoom = zoom;
      this.camera.zoom = zoom;
    }
    this.requestRedraw();
  }

  public resize(): void {
    if (!this.canvas) return;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 100);
    const height = Math.max(rect.height, 100);
    const targetPixelWidth = Math.floor(width * dpr);
    const targetPixelHeight = Math.floor(height * dpr);

    const sizeChanged = this.canvas.width !== targetPixelWidth || this.canvas.height !== targetPixelHeight;

    if (sizeChanged) {
      this.canvas.width = targetPixelWidth;
      this.canvas.height = targetPixelHeight;

      if (this.ctx) {
        this.ctx.resetTransform?.();
        this.ctx.scale?.(dpr, dpr);
      }
    }

    if (this.graph) {
      this.layoutEngine.buildLayout(this.graph, width, height);
    }

    this.requestRedraw();
  }

  public requestRedraw(): void {
    if (typeof requestAnimationFrame !== 'undefined' && this.animationHandle === null) {
      this.animationHandle = requestAnimationFrame(this.renderLoop);
    } else if (typeof requestAnimationFrame === 'undefined') {
      this.draw();
    }
  }

  private lastFrameTimestamp: number | null = null;

  private startAnimation(): void {
    this.lastFrameTimestamp = null;
    if (typeof requestAnimationFrame === 'undefined') {
      this.camera.x = this.targetCamera.x;
      this.camera.y = this.targetCamera.y;
      this.camera.zoom = this.targetCamera.zoom;
      this.draw();
      return;
    }
    if (this.animationHandle === null) {
      this.animationHandle = requestAnimationFrame(this.renderLoop);
    }
  }

  private stopAnimation(): void {
    this.lastFrameTimestamp = null;
    if (this.animationHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  private renderLoop = (timestamp?: number): void => {
    this.animationHandle = null;
    if (!this.canvas) return;

    const now = timestamp ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (this.lastFrameTimestamp === null) {
      this.lastFrameTimestamp = now;
    }
    const rawDelta = now - this.lastFrameTimestamp;
    const deltaMs = Math.min(Math.max(rawDelta, 0), 100);
    this.lastFrameTimestamp = now;

    this.pulsePhase = (this.pulsePhase + 0.03) % (Math.PI * 2);

    // Step authoritative orbital physics forward driven by real elapsed time
    this.stepOrbitPhysics(deltaMs);

    // Camera interpolation towards target
    if (!this.reducedMotion) {
      const lerpFactor = 0.18;
      const dx = this.targetCamera.x - this.camera.x;
      const dy = this.targetCamera.y - this.camera.y;
      const dz = this.targetCamera.zoom - this.camera.zoom;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(dz) > 0.005) {
        this.camera.x += dx * lerpFactor;
        this.camera.y += dy * lerpFactor;
        this.camera.zoom += dz * lerpFactor;
      } else {
        this.camera.x = this.targetCamera.x;
        this.camera.y = this.targetCamera.y;
        this.camera.zoom = this.targetCamera.zoom;
      }
    }

    // Always draw current positions every frame because bodies are continuously orbiting
    this.draw();

    // Continuously schedule next animation frame while canvas is attached
    if (this.canvas && typeof requestAnimationFrame !== 'undefined') {
      this.animationHandle = requestAnimationFrame(this.renderLoop);
    }
  };

  public draw(): void {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : (this.canvas.clientWidth || 800);
    const height = rect.height > 0 ? rect.height : (this.canvas.clientHeight || 600);

    const usable = this.getUsableViewport();
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const centerX = usable.centerX;
    const centerY = usable.centerY;

    const toScreenX = (wx: number) => centerX + (wx - this.camera.x) * zoom;
    const toScreenY = (wy: number) => centerY + (wy - this.camera.y) * zoom;

    // 1. Deep Space Background
    ctx.fillStyle = '#06060a';
    ctx.fillRect(0, 0, width, height);

    // 2. Cosmic Nebula Gradients
    const originScreenX = toScreenX(0);
    const originScreenY = toScreenY(0);

    if (ctx.createRadialGradient) {
      try {
        const nebulaRadius = Math.max(120, 1100 * zoom);
        const nebulaGrad = ctx.createRadialGradient(
          originScreenX,
          originScreenY,
          10,
          originScreenX,
          originScreenY,
          nebulaRadius
        );
        nebulaGrad.addColorStop(0, 'rgba(124, 58, 237, 0.28)');
        nebulaGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.12)');
        nebulaGrad.addColorStop(0.7, 'rgba(139, 92, 246, 0.04)');
        nebulaGrad.addColorStop(1, 'rgba(6, 6, 10, 0)');

        ctx.fillStyle = nebulaGrad;
        ctx.fillRect(0, 0, width, height);
      } catch {
        // Fallback
      }
    }

    // 3. Cosmic Background Stars
    for (const star of this.stars) {
      const sx = toScreenX(star.x);
      const sy = toScreenY(star.y);
      if (sx >= -10 && sx <= width + 10 && sy >= -10 && sy <= height + 10) {
        ctx.beginPath();
        ctx.arc(sx, sy, star.size * Math.min(1.2, Math.max(0.5, zoom)), 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.opacity;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // 4. Concentric Orbit Lane Trajectory Rings
    ctx.save();
    ctx.lineWidth = 1;
    const lanes = this.layoutEngine.getLanes();
    const ringStep = lanes.length > 25 ? Math.max(1, Math.floor(lanes.length / 12)) : 1;

    for (let i = 0; i < lanes.length; i += ringStep) {
      const lane = lanes[i]!;
      if (lane.radius <= 0) continue;
      const r = lane.radius * zoom;
      ctx.beginPath();
      ctx.arc(originScreenX, originScreenY, r, 0, Math.PI * 2);
      ctx.strokeStyle = lane.direction === 1 ? 'rgba(168, 85, 247, 0.22)' : 'rgba(56, 189, 248, 0.2)';
      if (ctx.setLineDash) {
        ctx.setLineDash(lane.direction === 1 ? [6, 6] : [3, 4]);
      }
      ctx.stroke();
    }
    if (ctx.setLineDash) {
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 5. Central Glowing Core ("My Music" Cosmic Anchor)
    const coreRadius = Math.max(16, 44 * zoom);
    if (ctx.createRadialGradient) {
      try {
        const coreGrad = ctx.createRadialGradient(
          originScreenX,
          originScreenY,
          coreRadius * 0.2,
          originScreenX,
          originScreenY,
          coreRadius * 2.2
        );
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.2, '#c084fc');
        coreGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.55)');
        coreGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');

        ctx.beginPath();
        ctx.arc(originScreenX, originScreenY, coreRadius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();
      } catch {
        // Fallback
      }
    }

    ctx.beginPath();
    ctx.arc(originScreenX, originScreenY, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e0e7ff';
    ctx.stroke();

    if (!this.graph || this.graph.nodes.length === 0) {
      this.drawEmptyState(ctx, width, height);
      return;
    }

    // 6. Draw Nested Child Orbit Rings
    const allStates = this.layoutEngine.getAllNodeStates();
    const stateMap = new Map(allStates.map(s => [s.node.id, s]));
    const drawnRings = new Set<string>();

    allStates.forEach(state => {
      if (state.parentId && stateMap.has(state.parentId)) {
        const ringKey = `${state.parentId}:${state.localOrbitRadius}`;
        if (drawnRings.has(ringKey)) return;
        drawnRings.add(ringKey);

        const parentState = stateMap.get(state.parentId)!;
        const psx = toScreenX(parentState.x);
        const psy = toScreenY(parentState.y);
        const ringRadius = state.localOrbitRadius * zoom;

        if (ringRadius > 0) {
          ctx.beginPath();
          ctx.arc(psx, psy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = state.direction === 1 ? 'rgba(251, 191, 36, 0.35)' : 'rgba(56, 189, 248, 0.3)';
          ctx.lineWidth = 1;
          if (ctx.setLineDash) ctx.setLineDash([2, 3]);
          ctx.stroke();
          if (ctx.setLineDash) ctx.setLineDash([]);
        }
      }
    });

    // 7. Sort states for priority rendering (Smallest bodies first, Big planets on top)
    const sortedStates = [...allStates].sort((a, b) => {
      const aSelected = a.node.id === this.selectedNodeId || a.node.id === this.focusedNodeId ? 1 : 0;
      const bSelected = b.node.id === this.selectedNodeId || b.node.id === this.focusedNodeId ? 1 : 0;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return b.depth - a.depth; // Deeper children rendered under parents
    });

    // Render bodies
    for (const state of sortedStates) {
      const node = state.node;
      const sx = toScreenX(state.x);
      const sy = toScreenY(state.y);
      const screenRadius = Math.max(3.5, state.visualRadius * zoom);

      // Spatial viewport culling check with generous margin for multi-ring outer orbits
      const cullingMargin = Math.max(800, width * 0.8);
      if (sx < -cullingMargin || sx > width + cullingMargin || sy < -cullingMargin || sy > height + cullingMargin) {
        continue;
      }

      const isSelected = node.id === this.selectedNodeId;
      const isFocused = node.id === this.focusedNodeId;
      const isPlaying = node.entityId === this.playingEntityId;
      const isFavorite = node.metadata.isFavorite;

      // Glow effect for selected / playing node
      if (isSelected || isPlaying || isFocused) {
        const pulse = Math.sin(this.pulsePhase) * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, screenRadius + 8 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = isPlaying ? 'rgba(16, 185, 129, 0.4)' : isFocused ? 'rgba(56, 189, 248, 0.4)' : 'rgba(236, 72, 153, 0.4)';
        ctx.fill();
      }

      // Golden aura for Favorites
      if (isFavorite && !isSelected && !isPlaying) {
        ctx.beginPath();
        ctx.arc(sx, sy, screenRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 3D Spherical Sphere Fill
      if (ctx.createRadialGradient) {
        try {
          const sphereGrad = ctx.createRadialGradient(
            sx - screenRadius * 0.35,
            sy - screenRadius * 0.35,
            screenRadius * 0.1,
            sx,
            sy,
            screenRadius
          );
          sphereGrad.addColorStop(0, '#ffffff');
          sphereGrad.addColorStop(0.3, isPlaying ? '#34d399' : isFavorite ? '#fbbf24' : node.color);
          sphereGrad.addColorStop(1, isPlaying ? '#065f46' : isFavorite ? '#78350f' : '#111827');

          ctx.beginPath();
          ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
          ctx.fillStyle = sphereGrad;
          ctx.fill();
        } catch {
          ctx.beginPath();
          ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
      }

      // Rim outline
      ctx.lineWidth = isSelected ? 2.5 : isFocused ? 2 : 1;
      ctx.strokeStyle = isSelected ? '#ffffff' : isFocused ? '#38bdf8' : isFavorite ? '#fbbf24' : 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();

      // Saturn-Style Planetary Rings for Major Artists & Genres (matching Reference Design)
      if ((node.type === 'artist' || node.type === 'genre') && screenRadius >= 8 && typeof ctx.translate === 'function' && typeof ctx.rotate === 'function' && typeof ctx.ellipse === 'function') {
        try {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(-Math.PI / 6); // 30-degree tilt angle
          ctx.beginPath();
          ctx.ellipse(0, 0, screenRadius * 1.75, screenRadius * 0.52, 0, 0, Math.PI * 2);
          ctx.strokeStyle = node.color ? node.color + '77' : 'rgba(168, 85, 247, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        } catch {
          // Fallback if Canvas context doesn't support ellipse in mock DOM
        }
      }
    }

    // 8. Render Labels with Strict Collision Prevention & Level LOD Filtering
    const placedLabelBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    // Dedicated Authoritative Center Core Label ("My Music")
    // Rendered once in the final label layer cleanly positioned below the central Sun/Core planet
    const coreState = allStates.find(s => s.node.id === 'core' || (s.node.type as string) === 'core');
    const isCoreSelected = coreState ? coreState.node.id === this.selectedNodeId : false;
    const isCoreFocused = coreState ? coreState.node.id === this.focusedNodeId : false;
    const isCoreHovered = coreState ? coreState.node.id === this.hoveredNodeId : false;

    if (zoom >= 0.35 || isCoreSelected || isCoreFocused || isCoreHovered) {
      const coreLabel = coreState?.node.label || 'My Music';
      const csx = originScreenX;
      const coreVisualRadius = Math.max(16, (coreState?.visualRadius || 44) * zoom);
      const csy = originScreenY + coreVisualRadius + 6;
      const fontSize = Math.max(10, Math.min(14, 12 * zoom));

      ctx.save();
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = isCoreSelected ? '#ffffff' : isCoreFocused ? '#38bdf8' : isCoreHovered ? '#c084fc' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.fillText(coreLabel, csx, csy);
      ctx.restore();

      const approxWidth = Math.min(120, coreLabel.length * fontSize * 0.65 + 10);
      const approxHeight = fontSize + 4;
      placedLabelBoxes.push({
        x1: csx - approxWidth / 2,
        y1: csy,
        x2: csx + approxWidth / 2,
        y2: csy + approxHeight
      });
    }

    for (const state of sortedStates) {
      const node = state.node;

      // Exclude central Sun/Core ("My Music") from generic celestial-node label rendering
      // (rendered exclusively through the dedicated center-label path above)
      if (node.id === 'core' || (node.type as string) === 'core' || (node.label === 'My Music' && state.orbitRadius === 0)) {
        continue;
      }

      const sx = toScreenX(state.x);
      const sy = toScreenY(state.y);
      const screenRadius = Math.max(3.5, state.visualRadius * zoom);

      const cullingMargin = Math.max(800, width * 0.8);
      if (sx < -cullingMargin || sx > width + cullingMargin || sy < -cullingMargin || sy > height + cullingMargin) continue;

      const isSelected = node.id === this.selectedNodeId;
      const isFocused = node.id === this.focusedNodeId;
      const isHovered = node.id === this.hoveredNodeId;

      // Level-of-Detail (LOD) label filtering to prevent text label clutter:
      const isStandaloneTrack = node.type === 'track' || state.category === 'standalone';
      if (isStandaloneTrack && zoom < 1.25 && !isSelected && !isFocused && !isHovered) {
        continue;
      }
      if (node.type === 'album' && zoom < 0.6 && !isSelected && !isFocused && !isHovered) {
        continue;
      }
      if (node.type === 'artist' && zoom < 0.45 && !isSelected && !isFocused && !isHovered) {
        continue;
      }

      const fontSize = Math.max(9, Math.min(13, 11 * zoom));
      const maxChars = 16;
      const labelText = node.label.length > maxChars ? node.label.substring(0, maxChars - 2) + '…' : node.label;
      const pos = state.labelPosition || 'bottom';

      // Screen bounding box calculation
      const approxWidth = Math.min(120, labelText.length * fontSize * 0.65 + 10);
      const approxHeight = fontSize + 4;
      let labelBox: { x1: number; y1: number; x2: number; y2: number };

      if (pos === 'bottom') {
        labelBox = { x1: sx - approxWidth / 2, y1: sy + screenRadius + 2, x2: sx + approxWidth / 2, y2: sy + screenRadius + 2 + approxHeight };
      } else if (pos === 'top') {
        labelBox = { x1: sx - approxWidth / 2, y1: sy - screenRadius - 2 - approxHeight, x2: sx + approxWidth / 2, y2: sy - screenRadius - 2 };
      } else if (pos === 'right') {
        labelBox = { x1: sx + screenRadius + 4, y1: sy - approxHeight / 2, x2: sx + screenRadius + 4 + approxWidth, y2: sy + approxHeight / 2 };
      } else {
        labelBox = { x1: sx - screenRadius - 4 - approxWidth, y1: sy - approxHeight / 2, x2: sx - screenRadius - 4, y2: sy + approxHeight / 2 };
      }

      // Skip label if it collides with any already rendered label on screen (unless selected or focused)
      if (!isSelected && !isFocused && !isHovered) {
        let collides = false;
        for (const existing of placedLabelBoxes) {
          if (!(labelBox.x2 < existing.x1 || labelBox.x1 > existing.x2 || labelBox.y2 < existing.y1 || labelBox.y1 > existing.y2)) {
            collides = true;
            break;
          }
        }
        if (collides) continue;
      }

      placedLabelBoxes.push(labelBox);

      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = isSelected ? '#ffffff' : isFocused ? '#38bdf8' : isHovered ? '#a855f7' : 'rgba(255, 255, 255, 0.92)';

      if (pos === 'bottom') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labelText, sx, sy + screenRadius + 4);
      } else if (pos === 'top') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(labelText, sx, sy - screenRadius - 4);
      } else if (pos === 'right') {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, sx + screenRadius + 6, sy);
      } else {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, sx - screenRadius - 6, sy);
      }
    }

    this.updateDiscoverBannerPosition(width, height, toScreenX, toScreenY, zoom);
  }

  private updateDiscoverBannerPosition(
    containerWidth: number,
    containerHeight: number,
    toScreenX: (wx: number) => number,
    toScreenY: (wy: number) => number,
    zoom: number
  ): void {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('galaxy-discover-banner');
    if (!banner) return;

    const isMobile = containerWidth < 600;
    const isTablet = containerWidth >= 600 && containerWidth < 900;
    const bannerWidth = isMobile ? Math.min(280, containerWidth - 32) : isTablet ? 340 : 380;
    const bannerHeight = isMobile ? 54 : 68;

    banner.style.maxWidth = `${bannerWidth}px`;

    const margin = 24;
    const candidates = [
      {
        id: 'bottom-right',
        x1: containerWidth - margin - bannerWidth,
        y1: containerHeight - margin - bannerHeight,
        x2: containerWidth - margin,
        y2: containerHeight - margin,
        style: { top: 'auto', bottom: `${margin}px`, left: 'auto', right: `${margin}px` },
        basePenalty: 0
      },
      {
        id: 'top-right',
        x1: containerWidth - margin - bannerWidth,
        y1: margin + 40,
        x2: containerWidth - margin,
        y2: margin + 40 + bannerHeight,
        style: { top: `${margin + 40}px`, bottom: 'auto', left: 'auto', right: `${margin}px` },
        basePenalty: 25
      },
      {
        id: 'bottom-center-right',
        x1: containerWidth - margin - bannerWidth,
        y1: containerHeight - margin - bannerHeight - 75,
        x2: containerWidth - margin,
        y2: containerHeight - margin - 75,
        style: { top: 'auto', bottom: `${margin + 75}px`, left: 'auto', right: `${margin}px` },
        basePenalty: 45
      },
      {
        id: 'top-left',
        x1: margin,
        y1: margin + 40,
        x2: margin + bannerWidth,
        y2: margin + 40 + bannerHeight,
        style: { top: `${margin + 40}px`, bottom: 'auto', left: `${margin}px`, right: 'auto' },
        basePenalty: 65
      }
    ];

    const sunSX = toScreenX(0);
    const sunSY = toScreenY(0);
    const sunRadius = Math.max(70, 110 * zoom);
    const allStates = this.layoutEngine.getAllNodeStates();

    let bestCandidate = candidates[0]!;
    let minScore = Infinity;

    for (const cand of candidates) {
      let score = cand.basePenalty;

      // 1. Sun Collision Check
      if (
        cand.x1 < sunSX + sunRadius &&
        cand.x2 > sunSX - sunRadius &&
        cand.y1 < sunSY + sunRadius &&
        cand.y2 > sunSY - sunRadius
      ) {
        score += 10000;
      }

      // 2. Zoom Controls Collision Check (bottom-left area: x <= 190, y >= containerHeight - 90)
      if (cand.x1 < 190 && cand.y2 > containerHeight - 90) {
        score += 10000;
      }

      // 3. Planet / Node Collisions Check
      for (const state of allStates) {
        const nx = toScreenX(state.x);
        const ny = toScreenY(state.y);
        const nr = Math.max(5, state.visualRadius * zoom);

        if (nx < -50 || nx > containerWidth + 50 || ny < -50 || ny > containerHeight + 50) continue;

        if (nx + nr >= cand.x1 && nx - nr <= cand.x2 && ny + nr >= cand.y1 && ny - nr <= cand.y2) {
          if (state.node.type === 'genre' || state.node.type === 'artist') {
            score += 200;
          } else if (state.node.type === 'album') {
            score += 100;
          } else {
            score += 15;
          }
        }
      }

      if (score < minScore) {
        minScore = score;
        bestCandidate = cand;
      }
    }

    if (banner.dataset.appliedPos !== bestCandidate.id) {
      banner.dataset.appliedPos = bestCandidate.id;
      banner.style.top = bestCandidate.style.top;
      banner.style.bottom = bestCandidate.style.bottom;
      banner.style.left = bestCandidate.style.left;
      banner.style.right = bestCandidate.style.right;
    }
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Audio Galaxy is empty. Scan your music library to populate your galaxy.', width / 2, height / 2);
  }

  public hitTest(screenX: number, screenY: number): GalaxyNode | null {
    if (!this.canvas || !this.graph) return null;
    const usable = this.getUsableViewport();
    const zoom = this.camera.zoom;

    // Convert screen coordinates to world coordinates
    const worldX = this.camera.x + (screenX - usable.centerX) / zoom;
    const worldY = this.camera.y + (screenY - usable.centerY) / zoom;

    const states = this.layoutEngine.getAllNodeStates();
    for (let i = states.length - 1; i >= 0; i--) {
      const state = states[i]!;
      const dx = worldX - state.x;
      const dy = worldY - state.y;
      const distSq = dx * dx + dy * dy;
      const hitRadius = Math.max(state.node.radius, 14 / zoom);

      if (distSq <= hitRadius * hitRadius) {
        return state.node;
      }
    }
    return null;
  }

  private setZoomTarget(zoom: number): void {
    this.targetCamera.zoom = Math.max(0.15, Math.min(3.5, zoom));
    if (this.reducedMotion) {
      this.camera.zoom = this.targetCamera.zoom;
      this.requestRedraw();
    } else {
      this.startAnimation();
    }
  }

  private bindEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbindEvents(): void {
    if (!this.canvas) return;

    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.cameraStartX = this.targetCamera.x;
    this.cameraStartY = this.targetCamera.y;
    this.canvas?.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      this.targetCamera.x = this.cameraStartX - dx / this.camera.zoom;
      this.targetCamera.y = this.cameraStartY - dy / this.camera.zoom;
      this.camera.x = this.targetCamera.x;
      this.camera.y = this.targetCamera.y;

      this.requestRedraw();
      return;
    }

    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    const newHoverId = hit ? hit.id : null;
    if (newHoverId !== this.hoveredNodeId) {
      this.hoveredNodeId = newHoverId;
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
      this.requestRedraw();
    }
  };

  private onPointerLeave = (): void => {
    if (this.hoveredNodeId !== null) {
      this.hoveredNodeId = null;
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
      }
      this.requestRedraw();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.canvas) return;
    this.isDragging = false;
    this.canvas.releasePointerCapture?.(e.pointerId);

    const dist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
    if (dist < 6) {
      // Click detected
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const hitNode = this.hitTest(clickX, clickY);

      const now = performance.now();
      const isDouble = now - this.lastPointerUpTime < 300 && this.lastClickedNodeId === (hitNode?.id ?? null);
      this.lastPointerUpTime = now;
      this.lastClickedNodeId = hitNode?.id ?? null;

      if (hitNode) {
        if (isDouble) {
          this.callbacks.onNodeDoubleClick?.(hitNode);
        } else {
          this.setSelectedNode(hitNode.id);
          this.callbacks.onNodeClick?.(hitNode);
        }
      } else {
        this.callbacks.onBackgroundClick?.();
      }
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.88 : 1.14;
    this.setZoomTarget(this.camera.zoom * zoomFactor);
  };
}
