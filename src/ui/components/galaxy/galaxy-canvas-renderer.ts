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

/**
 * High-Performance Pure HTML5 Canvas 2D Audio Galaxy Renderer.
 * Implements:
 * - Dynamic Level-of-Detail (LOD 1: Overview, LOD 2: Exploration, LOD 3: Detail, LOD 4: Focus)
 * - Viewport Spatial Culling
 * - Pointer Panning & Smooth / Immediate Zooming
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

  private camera: ViewportCamera = { x: 0, y: 0, zoom: 0.8 };
  private targetCamera: ViewportCamera = { x: 0, y: 0, zoom: 0.8 };

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

  constructor(callbacks?: GalaxyRendererCallbacks) {
    if (callbacks) this.callbacks = callbacks;
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
        this.centerOnCoordinates(node.x, node.y, 1.8);
      }
    }
    this.requestRedraw();
  }

  public setPlayingEntity(entityId: string | null): void {
    this.playingEntityId = entityId;
    this.requestRedraw();
  }

  public resetCamera(): void {
    this.centerOnCoordinates(0, 0, 0.8);
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

    // Keep animating if camera has not settled
    const isCameraMoving =
      Math.abs(this.targetCamera.x - this.camera.x) > 0.5 ||
      Math.abs(this.targetCamera.y - this.camera.y) > 0.5 ||
      Math.abs(this.targetCamera.zoom - this.camera.zoom) > 0.005;

    if (isCameraMoving && typeof requestAnimationFrame !== 'undefined') {
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

    // 1. Draw Space Background & Grid
    ctx.fillStyle = '#08080c';
    ctx.fillRect(0, 0, width, height);

    // Compute active Viewport Level of Detail (LOD)
    const currentLod = this.computeLOD(this.camera.zoom);

    // Coordinate transformation setup (Center origin + camera offset + scale)
    const centerX = width / 2;
    const centerY = height / 2;
    const zoom = this.camera.zoom;

    const toScreenX = (wx: number) => centerX + (wx - this.camera.x) * zoom;
    const toScreenY = (wy: number) => centerY + (wy - this.camera.y) * zoom;

    // Viewport bounding box in world coordinates (Spatial Culling)
    const margin = 100 / zoom;
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

    // 2. Draw Edges
    ctx.lineWidth = 1;
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

      ctx.strokeStyle = isHighlighted ? 'rgba(255, 107, 0, 0.7)' : edge.color;
      ctx.lineWidth = isHighlighted ? 2 : 0.8;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // 3. Draw Nodes
    for (const node of visibleNodes) {
      const sx = toScreenX(node.x);
      const sy = toScreenY(node.y);
      const screenRadius = Math.max(3, node.radius * zoom);

      const isSelected = node.id === this.selectedNodeId;
      const isFocused = node.id === this.focusedNodeId;
      const isPlaying = node.entityId === this.playingEntityId;

      // Glow effect for selected / playing node
      if (isSelected || isPlaying || isFocused) {
        ctx.beginPath();
        ctx.arc(sx, sy, screenRadius + 6, 0, Math.PI * 2);
        ctx.fillStyle = isPlaying ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 107, 0, 0.35)';
        ctx.fill();
      }

      // Main Node Disc
      ctx.beginPath();
      ctx.arc(sx, sy, screenRadius, 0, Math.PI * 2);
      ctx.fillStyle = isPlaying ? '#10b981' : node.color;
      ctx.fill();

      // Outline
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();

      // Node Labels (Render only when zoom level allows or node is selected/focused)
      if (zoom >= 0.6 || isSelected || isFocused || node.type === 'genre' || node.type === 'artist') {
        ctx.font = `${Math.max(10, Math.min(14, 11 * zoom))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, sx, sy + screenRadius + 4);
      }
    }
  }

  private drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Audio Galaxy is empty. Scan your music library to build the universe.', width / 2, height / 2);
  }

  private computeLOD(zoom: number): number {
    if (this.focusedNodeId) return 4;
    if (zoom < 0.5) return 1;
    if (zoom < 1.2) return 2;
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
      const hitRadius = Math.max(node.radius, 12 / zoom);

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
