import type { GalaxyNode, GalaxyGraph } from '../../../domain/entities/galaxy-types';

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
 * High-Performance Pure HTML5 Canvas 2D Audio Galaxy Renderer (Template 10).
 * Implements:
 * - Cosmic Starfield & Multi-layer Nebula Background
 * - Glowing Central Core ("My Music" cosmic anchor)
 * - Concentric Orbital Trajectory Rings
 * - Spherical 3D Planetary Gradients & Atmospheric Glows
 * - Saturn-style Planetary Rings for Major Nodes
 * - Dynamic Level-of-Detail (LOD 1: Overview to LOD 4: Deep Focus)
 * - Spatial Culling & Viewport Clipping
 * - Pointer Drag Panning, Smooth Camera Interpolation & Mouse Wheel Zooming
 * - Node Selection & Neighborhood Edge Highlighting
 * - High-DPI devicePixelRatio Support
 */
export class GalaxyCanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private callbacks: GalaxyRendererCallbacks = {};

  private graph: GalaxyGraph | null = null;
  private selectedNodeId: string | null = null;
  private focusedNodeId: string | null = null;
  private playingEntityId: string | null = null;
  private reducedMotion = false;

  private camera: ViewportCamera = { x: 0, y: 0, zoom: 0.75 };
  private targetCamera: ViewportCamera = { x: 0, y: 0, zoom: 0.75 };

  // Static cosmic starfield in world space for parallax/depth
  private stars: CosmicStar[] = [];

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
  private isNeedsRedraw = true;
  private pulsePhase = 0;

  constructor(callbacks?: GalaxyRendererCallbacks) {
    if (callbacks) this.callbacks = callbacks;
    this.initCosmicStars();
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
    this.requestRedraw();
  }

  public detachCanvas(): void {
    this.unbindEvents();
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
  }

  public setGraph(graph: GalaxyGraph): void {
    this.graph = graph;
    this.requestRedraw();
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public setSelectedNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    this.requestRedraw();
  }

  public setFocusedNode(nodeId: string | null): void {
    this.focusedNodeId = nodeId;
    if (nodeId && this.graph) {
      const node = this.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        this.centerOnCoordinates(node.x, node.y, 1.6);
      }
    }
    this.requestRedraw();
  }

  public setPlayingEntity(entityId: string | null): void {
    this.playingEntityId = entityId;
    this.requestRedraw();
  }

  public resetCamera(): void {
    this.centerOnCoordinates(0, 0, 0.75);
  }

  public zoomIn(): void {
    this.setZoomTarget(this.camera.zoom * 1.35);
  }

  public zoomOut(): void {
    this.setZoomTarget(this.camera.zoom / 1.35);
  }

  public centerOnCoordinates(worldX: number, worldY: number, targetZoom?: number): void {
    this.targetCamera.x = worldX;
    this.targetCamera.y = worldY;
    if (targetZoom !== undefined) {
      this.targetCamera.zoom = Math.max(0.15, Math.min(3.5, targetZoom));
    }

    if (this.reducedMotion) {
      this.camera.x = this.targetCamera.x;
      this.camera.y = this.targetCamera.y;
      this.camera.zoom = this.targetCamera.zoom;
      this.requestRedraw();
    } else {
      this.startAnimation();
    }
  }

  public getCamera(): ViewportCamera {
    return { ...this.camera };
  }

  public resize(): void {
    if (!this.canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 100);
    const height = Math.max(rect.height, 100);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    if (this.ctx) {
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    }
    this.requestRedraw();
  }

  public requestRedraw(): void {
    this.isNeedsRedraw = true;
    if (typeof requestAnimationFrame !== 'undefined' && this.animationHandle === null) {
      this.animationHandle = requestAnimationFrame(this.renderLoop);
    } else if (typeof requestAnimationFrame === 'undefined') {
      this.draw();
    }
  }

  private startAnimation(): void {
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
    if (this.animationHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  private renderLoop = (): void => {
    this.animationHandle = null;
    this.pulsePhase = (this.pulsePhase + 0.03) % (Math.PI * 2);

    // Smooth camera interpolation towards target
    if (!this.reducedMotion) {
      const lerpFactor = 0.18;
      const dx = this.targetCamera.x - this.camera.x;
      const dy = this.targetCamera.y - this.camera.y;
      const dz = this.targetCamera.zoom - this.camera.zoom;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(dz) > 0.005) {
        this.camera.x += dx * lerpFactor;
        this.camera.y += dy * lerpFactor;
        this.camera.zoom += dz * lerpFactor;
        this.isNeedsRedraw = true;
      } else {
        this.camera.x = this.targetCamera.x;
        this.camera.y = this.targetCamera.y;
        this.camera.zoom = this.targetCamera.zoom;
      }
    }

    if (this.isNeedsRedraw) {
      this.draw();
      this.isNeedsRedraw = false;
    }

    // Keep animating if camera moving or playing/selected node pulsing
    const isCameraMoving =
      Math.abs(this.targetCamera.x - this.camera.x) > 0.5 ||
      Math.abs(this.targetCamera.y - this.camera.y) > 0.5 ||
      Math.abs(this.targetCamera.zoom - this.camera.zoom) > 0.005;

    if ((isCameraMoving || this.playingEntityId || this.selectedNodeId) && typeof requestAnimationFrame !== 'undefined') {
      this.animationHandle = requestAnimationFrame(this.renderLoop);
    }
  };

  public draw(): void {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const centerX = width / 2;
    const centerY = height / 2;

    const toScreenX = (wx: number) => centerX + (wx - this.camera.x) * zoom;
    const toScreenY = (wy: number) => centerY + (wy - this.camera.y) * zoom;

    // 1. Deep Space Background
    ctx.fillStyle = '#06060a';
    ctx.fillRect(0, 0, width, height);

    // 2. Cosmic Nebula Gradients
    const originScreenX = toScreenX(0);
    const originScreenY = toScreenY(0);

    // Large ambient purple / blue nebula at origin
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

    // 4. Concentric Orbital Trajectory Rings
    const orbitRadii = [250, 400, 700, 1100, 1250];
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < orbitRadii.length; i++) {
      const r = orbitRadii[i]! * zoom;
      ctx.beginPath();
      ctx.arc(originScreenX, originScreenY, r, 0, Math.PI * 2);
      ctx.strokeStyle = i === 2 ? 'rgba(168, 85, 247, 0.22)' : 'rgba(255, 255, 255, 0.06)';
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([4, 6]);
      }
      ctx.stroke();
    }
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 5. Central Glowing Core ("My Music" Cosmic Anchor)
    const coreRadius = Math.max(16, 44 * zoom);
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

    ctx.beginPath();
    ctx.arc(originScreenX, originScreenY, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e0e7ff';
    ctx.stroke();

    // Center Core Text
    if (zoom >= 0.35) {
      ctx.font = `700 ${Math.max(10, Math.min(15, 13 * zoom))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('My Music', originScreenX, originScreenY);
    }

    // Compute active Viewport Level of Detail (LOD)
    const currentLod = this.computeLOD(zoom);

    // Spatial culling bounds in world space
    const margin = 120 / zoom;
    const worldMinX = this.camera.x - centerX / zoom - margin;
    const worldMaxX = this.camera.x + centerX / zoom + margin;
    const worldMinY = this.camera.y - centerY / zoom - margin;
    const worldMaxY = this.camera.y + centerY / zoom + margin;

    if (!this.graph || this.graph.nodes.length === 0) {
      this.drawEmptyState(ctx, width, height);
      return;
    }

    // Collect culled visible nodes
    const visibleNodes: GalaxyNode[] = [];
    const visibleNodeMap = new Map<string, GalaxyNode>();

    for (const node of this.graph.nodes) {
      // LOD Check
      if (node.lodMin > currentLod && node.id !== this.focusedNodeId && node.id !== this.selectedNodeId) {
        continue;
      }
      // Viewport Bounds Check
      if (node.x >= worldMinX && node.x <= worldMaxX && node.y >= worldMinY && node.y <= worldMaxY) {
        visibleNodes.push(node);
        visibleNodeMap.set(node.id, node);
      }
    }

    // 6. Draw Edges with subtle glowing connections
    for (const edge of this.graph.edges) {
      const source = visibleNodeMap.get(edge.sourceId);
      const target = visibleNodeMap.get(edge.targetId);
      if (!source || !target) continue;

      const sx = toScreenX(source.x);
      const sy = toScreenY(source.y);
      const tx = toScreenX(target.x);
      const ty = toScreenY(target.y);

      const isHighlighted =
        source.id === this.selectedNodeId ||
        target.id === this.selectedNodeId ||
        source.id === this.focusedNodeId ||
        target.id === this.focusedNodeId;

      ctx.strokeStyle = isHighlighted ? 'rgba(236, 72, 153, 0.85)' : edge.color;
      ctx.lineWidth = isHighlighted ? 2.2 : 0.9;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // 6b. Draw Recent History Constellation Trail
    const recentNodes = visibleNodes
      .filter(n => n.metadata.recentPlayOrder !== undefined)
      .sort((a, b) => (a.metadata.recentPlayOrder || 0) - (b.metadata.recentPlayOrder || 0));

    if (recentNodes.length > 1) {
      ctx.save();
      for (let i = 0; i < recentNodes.length - 1; i++) {
        const n1 = recentNodes[i]!;
        const n2 = recentNodes[i + 1]!;
        const sx1 = toScreenX(n1.x);
        const sy1 = toScreenY(n1.y);
        const sx2 = toScreenX(n2.x);
        const sy2 = toScreenY(n2.y);

        const progress = 1 - i / recentNodes.length;
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.4 * progress).toFixed(2)})`;
        ctx.lineWidth = 1.5;
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([3, 5]);
        }
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
      }
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // 7. Draw Nodes with 3D Spherical Gradients & Saturn-like Rings
    const renderedLabelBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

    // Sort nodes to draw and register labels in hierarchy order (selected/playing/genres/artists first)
    const priorityOrder: Record<string, number> = { genre: 1, artist: 2, album: 3, playlist: 4, folder: 5, track: 6 };
    const sortedNodes = [...visibleNodes].sort((a, b) => {
      const aSelected = a.id === this.selectedNodeId || a.id === this.focusedNodeId || a.entityId === this.playingEntityId ? 0 : 1;
      const bSelected = b.id === this.selectedNodeId || b.id === this.focusedNodeId || b.entityId === this.playingEntityId ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99);
    });

    for (const node of sortedNodes) {
      const sx = toScreenX(node.x);
      const sy = toScreenY(node.y);
      const screenRadius = Math.max(4, node.radius * zoom);

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

      // Outer atmospheric glow
      try {
        const atmoGrad = ctx.createRadialGradient(sx, sy, screenRadius * 0.7, sx, sy, screenRadius * 1.8);
        atmoGrad.addColorStop(0, isPlaying ? 'rgba(16, 185, 129, 0.6)' : isFavorite ? 'rgba(251, 191, 36, 0.5)' : `${node.color}99`);
        atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(sx, sy, screenRadius * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = atmoGrad;
        ctx.fill();
      } catch {
        // Fallback
      }

      // Saturn-like concentric planetary ring for genre and large artist nodes
      if ((node.type === 'genre' || (node.type === 'artist' && screenRadius >= 18)) && zoom >= 0.4 && typeof ctx.ellipse === 'function') {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(sx, sy, screenRadius * 1.9, screenRadius * 0.65, -Math.PI / 8, 0, Math.PI * 2);
        ctx.strokeStyle = isPlaying ? 'rgba(16, 185, 129, 0.7)' : `${node.color}aa`;
        ctx.lineWidth = Math.max(1.5, screenRadius * 0.12);
        ctx.stroke();
        ctx.restore();
      }

      // 3D Spherical Sphere Fill
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
        ctx.fillStyle = isPlaying ? '#10b981' : isFavorite ? '#fbbf24' : node.color;
        ctx.fill();
      }

      // Rim outline
      ctx.lineWidth = isSelected ? 2.5 : isFocused ? 2 : 1;
      ctx.strokeStyle = isSelected ? '#ffffff' : isFocused ? '#38bdf8' : isFavorite ? '#fbbf24' : 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();

      // Node Labels with Collision Detection
      const isHighPriority = isSelected || isFocused || isPlaying || node.type === 'genre' || (node.type === 'artist' && zoom >= 0.4);
      const shouldAttemptLabel = isHighPriority || (node.type === 'album' && zoom >= 0.5) || (node.type === 'track' && zoom >= 0.6) || (zoom >= 0.7);

      if (shouldAttemptLabel) {
        const fontSize = Math.max(10, Math.min(14, 11 * zoom));
        const fontStr = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.font = fontStr;

        const labelText = node.label.length > 24 ? node.label.substring(0, 22) + '…' : node.label;
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const pad = 4;
        const boxX1 = sx - textWidth / 2 - pad;
        const boxX2 = sx + textWidth / 2 + pad;
        const boxY1 = sy + screenRadius + 2;
        const boxY2 = sy + screenRadius + fontSize + (node.metadata.trackCount !== undefined && (zoom >= 0.75 || isSelected || node.type === 'genre') ? fontSize + 8 : 6);

        let collides = false;
        if (!isHighPriority) {
          for (const box of renderedLabelBoxes) {
            if (!(boxX2 < box.x1 || boxX1 > box.x2 || boxY2 < box.y1 || boxY1 > box.y2)) {
              collides = true;
              break;
            }
          }
        }

        if (!collides || isHighPriority) {
          renderedLabelBoxes.push({ x1: boxX1, y1: boxY1, x2: boxX2, y2: boxY2 });

          ctx.font = fontStr;
          ctx.fillStyle = isSelected ? '#ffffff' : isFocused ? '#38bdf8' : 'rgba(255, 255, 255, 0.95)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(labelText, sx, sy + screenRadius + 4);

          // Subtitle (Track count or Favorite Star)
          const trackCount = node.metadata.trackCount;
          if (trackCount !== undefined && (zoom >= 0.75 || isSelected || node.type === 'genre')) {
            ctx.font = `400 ${Math.max(9, fontSize - 2)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            ctx.fillStyle = isFavorite ? '#fbbf24' : 'rgba(255, 255, 255, 0.6)';
            ctx.fillText(isFavorite ? `★ ${trackCount} songs` : `${trackCount} songs`, sx, sy + screenRadius + fontSize + 6);
          }
        }
      }
    }
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Audio Galaxy is empty. Scan your music library to populate your galaxy.', width / 2, height / 2);
  }

  private computeLOD(zoom: number): number {
    if (this.focusedNodeId) return 4;
    if (zoom < 0.45) return 1;
    if (zoom < 1.1) return 2;
    return 3;
  }

  public hitTest(screenX: number, screenY: number): GalaxyNode | null {
    if (!this.canvas || !this.graph) return null;
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const zoom = this.camera.zoom;

    // Convert screen coordinates to world coordinates
    const worldX = this.camera.x + (screenX - centerX) / zoom;
    const worldY = this.camera.y + (screenY - centerY) / zoom;

    // Search closest node within its radius (iterating in reverse so top nodes hit first)
    for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
      const node = this.graph.nodes[i]!;
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const distSq = dx * dx + dy * dy;
      const hitRadius = Math.max(node.radius, 14 / zoom);

      if (distSq <= hitRadius * hitRadius) {
        return node;
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
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbindEvents(): void {
    if (!this.canvas) return;

    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
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
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;

    this.targetCamera.x = this.cameraStartX - dx / this.camera.zoom;
    this.targetCamera.y = this.cameraStartY - dy / this.camera.zoom;
    this.camera.x = this.targetCamera.x;
    this.camera.y = this.targetCamera.y;

    this.requestRedraw();
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

