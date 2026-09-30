import type { IView } from '../view-interface';
import type { RouteParams } from '../../navigation/route-types';
import type {
  ILibraryService,
  IPlaybackManager,
  IArtworkService,
  IPlaylistService,
  ISearchService,
  IGalaxyService
} from '../../../services/contracts/service-contracts';
import type { StatsService } from '../../../services/stats/stats-service';
import type { RouterService } from '../../navigation/router-service';
import type { EventBus } from '../../../core/events/event-bus';
import type { Track, Album, Artist, Genre } from '../../../domain/entities/models';
import type { Disposable } from '../../../core/types/common';
import { escapeHtml } from '../../../core/security/html-sanitizer';
import { getIconSvg } from '../../icons/icon-registry';
import { TrackRowComponent } from '../../components/library/track-row-component';

export interface MobileGalaxyViewDependencies {
  galaxyService?: IGalaxyService | undefined;
  libraryService?: ILibraryService | undefined;
  playbackManager?: IPlaybackManager | undefined;
  statsService?: StatsService | undefined;
  artworkService?: IArtworkService | undefined;
  playlistService?: IPlaylistService | undefined;
  searchService?: ISearchService | undefined;
  router?: RouterService | undefined;
  eventBus?: EventBus | undefined;
}

export interface MobileOrbitNode {
  id: string;
  name: string;
  subtitle?: string;
  type: 'core' | 'genre' | 'artist' | 'album' | 'track';
  orbitRing: number; // 0 for core, 1 for inner, 2 for mid, 3 for outer
  radiusRatio: number; // 0 for core, 0.34 for inner, 0.62 for mid, 0.88 for outer
  nodeRadius: number; // radius in px
  baseAngle: number;
  angularVelocity: number;
  color: string;
  glowColor: string;
  // Current runtime coordinates
  x: number;
  y: number;
  currentAngle: number;
  parentId?: string | null;
  localOrbitRadius?: number;
  targetTrack?: Track;
  targetArtist?: Artist;
  targetAlbum?: Album;
  targetGenre?: Genre;
}

/**
 * MobileGalaxyView
 * Dedicated mobile Galaxy and Music Discovery experience.
 * Combines an interactive Canvas 2D Celestial Orbit visualizer with smooth vertical content scrolling.
 * 100% local-first, zero AI/cloud, touch-optimized (>=44px touch targets), high-DPI scaled.
 */
export class MobileGalaxyView implements IView {
  private container: HTMLElement | null = null;
  private readonly deps: MobileGalaxyViewDependencies;
  private subscriptions: Disposable[] = [];
  private searchQuery: string = '';

  // Library entities
  private artists: Artist[] = [];
  private genres: Genre[] = [];
  private albums: Album[] = [];
  private recentTracks: Track[] = [];
  private mostPlayedTracks: Track[] = [];
  private favoriteTracks: Track[] = [];
  private allTracks: Track[] = [];
  private isLoading = true;

  // Canvas 2D Orbit Visualization Engine
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private orbitNodes: MobileOrbitNode[] = [];
  private animationHandle: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private orbitClock = 0;
  private lastFrameTime = 0;
  private reducedMotion = false;
  private selectedOrbitNode: MobileOrbitNode | null = null;

  constructor(deps?: MobileGalaxyViewDependencies) {
    this.deps = deps || {};
  }

  public getOrbitNodes(): MobileOrbitNode[] {
    return this.orbitNodes;
  }

  public getOrbitClock(): number {
    return this.orbitClock;
  }

  public getSelectedOrbitNode(): MobileOrbitNode | null {
    return this.selectedOrbitNode;
  }

  public async mount(container: HTMLElement, _params?: RouteParams): Promise<void> {
    this.container = container;
    this.render();
    this.initCanvasEngine();
    await this.loadData();
  }

  public unmount(): void {
    this.stopAnimation();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.unbindCanvasEvents();
    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions = [];
    this.canvas = null;
    this.ctx = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(_params?: RouteParams): void {}

  public async loadData(): Promise<void> {
    if (!this.deps.libraryService) {
      this.isLoading = false;
      this.buildOrbitNodes();
      this.render();
      this.initCanvasEngine();
      return;
    }

    try {
      const [artistsRes, genresRes, albumsRes, tracksRes] = await Promise.all([
        this.deps.libraryService.listArtists({ offset: 0, limit: 12 }),
        this.deps.libraryService.listGenres ? this.deps.libraryService.listGenres({ offset: 0, limit: 10 }) : Promise.resolve({ items: [], total: 0 }),
        this.deps.libraryService.listAlbums({ offset: 0, limit: 12 }),
        this.deps.libraryService.listTracks({ offset: 0, limit: 100 })
      ]);

      this.artists = [...(artistsRes.items || [])];
      this.genres = [...(genresRes.items || [])];
      this.albums = [...(albumsRes.items || [])];
      this.allTracks = [...(tracksRes.items || [])];

      // Recently Added
      this.recentTracks = [...this.allTracks]
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, 6);

      // Most Played
      this.mostPlayedTracks = [...this.allTracks]
        .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
        .filter(t => (t.playCount || 0) > 0)
        .slice(0, 6);

      // Favorites
      this.favoriteTracks = this.allTracks.filter(t => t.isFavorite).slice(0, 6);

      this.buildOrbitNodes();
    } catch (_e) {
      this.buildOrbitNodes();
    } finally {
      this.isLoading = false;
      this.render();
      this.initCanvasEngine();
    }
  }

  /**
   * Constructs real orbital planetary nodes from active music library data.
   */
  private buildOrbitNodes(): void {
    // Preserve existing angles across library reloads and layout refreshes
    const existingAngles = new Map<string, number>();
    this.orbitNodes.forEach(n => {
      existingAngles.set(n.id, n.currentAngle);
    });

    const nodes: MobileOrbitNode[] = [];

    // Central Cosmic Core ("My Music")
    nodes.push({
      id: 'core',
      name: 'My Music',
      subtitle: `${this.allTracks.length || 0} tracks`,
      type: 'core',
      orbitRing: 0,
      radiusRatio: 0,
      nodeRadius: 16,
      baseAngle: 0,
      angularVelocity: 0,
      color: '#c084fc',
      glowColor: 'rgba(192, 132, 252, 0.7)',
      x: 0,
      y: 0,
      currentAngle: 0
    });

    // Ring 1: Inner Orbit — Genres (up to 4 genres)
    const activeGenres = this.genres.slice(0, 4);
    if (activeGenres.length === 0 && this.allTracks.length > 0) {
      const genreSet = new Set<string>();
      this.allTracks.forEach(t => {
        if (t.genreId) genreSet.add(t.genreId);
      });
      genreSet.forEach(g => {
        if (activeGenres.length < 4) activeGenres.push({ id: g, name: g, trackCount: 1 });
      });
    }

    const genrePalette = ['#a855f7', '#38bdf8', '#ec4899', '#10b981'];
    activeGenres.forEach((genre, idx) => {
      const baseAngle = (idx / Math.max(1, activeGenres.length)) * Math.PI * 2;
      const nodeId = `genre:${genre.id || genre.name}`;
      const persistentAngle = existingAngles.has(nodeId) ? existingAngles.get(nodeId)! : baseAngle;

      nodes.push({
        id: nodeId,
        name: genre.name,
        subtitle: `${genre.trackCount || 0} songs`,
        type: 'genre',
        orbitRing: 1,
        radiusRatio: 0.34,
        nodeRadius: 11,
        baseAngle,
        angularVelocity: 0.00045 * (idx % 2 === 0 ? 1 : -0.9),
        color: genrePalette[idx % genrePalette.length] || '#a855f7',
        glowColor: 'rgba(168, 85, 247, 0.5)',
        x: 0,
        y: 0,
        currentAngle: persistentAngle,
        targetGenre: genre
      });
    });

    // Ring 2: Middle Orbit — Featured Artists (up to 6 artists)
    const activeArtists = this.artists.slice(0, 6);
    const artistPalette = ['#6366f1', '#06b6d4', '#f59e0b', '#8b5cf6', '#14b8a6', '#f43f5e'];
    activeArtists.forEach((artist, idx) => {
      const baseAngle = (idx / Math.max(1, activeArtists.length)) * Math.PI * 2 + 0.4;
      const nodeId = `artist:${artist.id}`;
      const persistentAngle = existingAngles.has(nodeId) ? existingAngles.get(nodeId)! : baseAngle;

      nodes.push({
        id: nodeId,
        name: artist.name,
        subtitle: `${artist.trackCount || 0} songs`,
        type: 'artist',
        orbitRing: 2,
        radiusRatio: 0.62,
        nodeRadius: 9,
        baseAngle,
        angularVelocity: 0.00028 * (idx % 2 === 0 ? 1 : -0.85),
        color: artistPalette[idx % artistPalette.length] || '#6366f1',
        glowColor: 'rgba(99, 102, 241, 0.45)',
        x: 0,
        y: 0,
        currentAngle: persistentAngle,
        targetArtist: artist
      });
    });

    // Ring 3: Outer Orbit — Albums & Favorite Tracks (up to 8 items)
    const outerItems = (this.albums.length > 0 ? this.albums.slice(0, 4) : []).concat(
      this.recentTracks.length > 0 ? (this.recentTracks.slice(0, 4) as any) : []
    ).slice(0, 8);

    const outerPalette = ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#fb923c'];
    outerItems.forEach((item: any, idx) => {
      const isAlbum = 'title' in item;
      const title = isAlbum ? item.title : item.title;
      const subtitle = isAlbum ? (item.artistName || 'Album') : (item.artistName || 'Track');
      const baseAngle = (idx / Math.max(1, outerItems.length)) * Math.PI * 2 + 0.8;
      const nodeId = isAlbum ? `album:${item.id}` : `track:${item.id}`;
      const persistentAngle = existingAngles.has(nodeId) ? existingAngles.get(nodeId)! : baseAngle;

      nodes.push({
        id: nodeId,
        name: title,
        subtitle,
        type: isAlbum ? 'album' : 'track',
        orbitRing: 3,
        radiusRatio: 0.88,
        nodeRadius: 7,
        baseAngle,
        angularVelocity: 0.00018 * (idx % 2 === 0 ? 1 : -0.8),
        color: outerPalette[idx % outerPalette.length] || '#38bdf8',
        glowColor: 'rgba(56, 189, 248, 0.4)',
        x: 0,
        y: 0,
        currentAngle: persistentAngle,
        targetAlbum: isAlbum ? item : undefined,
        targetTrack: !isAlbum ? item : undefined
      });
    });

    this.orbitNodes = nodes;
  }

  /**
   * Deterministic step of orbital physics for animation and frame testing.
   */
  public stepOrbitPhysics(deltaMs: number = 16): void {
    if (this.reducedMotion) return;
    const safeDelta = Math.max(0, Math.min(deltaMs, 100));
    this.orbitClock += safeDelta;

    const width = this.canvas ? this.canvas.getBoundingClientRect().width : 360;
    const height = this.canvas ? this.canvas.getBoundingClientRect().height : 280;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.44;

    const nodeMap = new Map(this.orbitNodes.map(n => [n.id, n]));
    const resolved = new Set<string>();

    const resolveNode = (node: MobileOrbitNode) => {
      if (resolved.has(node.id)) return;

      if (node.orbitRing === 0 || !node.parentId || !nodeMap.has(node.parentId)) {
        if (node.orbitRing === 0) {
          node.x = centerX;
          node.y = centerY;
        } else {
          node.currentAngle += node.angularVelocity * safeDelta;
          const ringDist = node.radiusRatio * maxRadius;
          node.x = centerX + Math.cos(node.currentAngle) * ringDist;
          node.y = centerY + Math.sin(node.currentAngle) * ringDist;
        }
        resolved.add(node.id);
        return;
      }

      const parentNode = nodeMap.get(node.parentId)!;
      if (!resolved.has(parentNode.id)) {
        resolveNode(parentNode);
      }

      node.currentAngle += node.angularVelocity * safeDelta;
      const localRadius = node.localOrbitRadius || 32;
      node.x = parentNode.x + Math.cos(node.currentAngle) * localRadius;
      node.y = parentNode.y + Math.sin(node.currentAngle) * localRadius;
      resolved.add(node.id);
    };

    for (const node of this.orbitNodes) {
      resolveNode(node);
    }
  }

  private initCanvasEngine(): void {
    if (!this.container) return;

    this.canvas = this.container.querySelector<HTMLCanvasElement>('#mobile-galaxy-orbit-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.bindCanvasEvents();

    const canvasContainer = this.container.querySelector<HTMLElement>('#mobile-galaxy-canvas-container');
    if (canvasContainer && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(canvasContainer);
    }

    this.resizeCanvas();
    this.startAnimation();
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    const rect = container ? container.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width || 320, 200);
    const height = Math.max(rect.height || 280, 200);
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    if (this.ctx) {
      this.ctx.resetTransform?.();
      this.ctx.scale?.(dpr, dpr);
    }

    this.stepOrbitPhysics(0);
    this.draw();
  }

  private startAnimation(): void {
    this.stopAnimation();
    this.lastFrameTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const renderLoop = (time?: number) => {
      this.animationHandle = null;
      if (!this.canvas) return;

      const now = time ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const rawDelta = now - this.lastFrameTime;
      const dt = Math.min(Math.max(rawDelta, 0), 100);
      this.lastFrameTime = now;

      this.stepOrbitPhysics(dt);
      this.draw();

      if (this.canvas && typeof requestAnimationFrame !== 'undefined') {
        this.animationHandle = requestAnimationFrame(renderLoop);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationHandle = requestAnimationFrame(renderLoop);
    } else {
      this.draw();
    }
  }

  private stopAnimation(): void {
    if (this.animationHandle !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  public draw(): void {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    const ctx = this.ctx;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.44;

    // 1. Cosmic Background Gradient
    if (ctx.createRadialGradient) {
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, Math.max(width, height) * 0.7);
      bgGrad.addColorStop(0, '#1a1038');
      bgGrad.addColorStop(0.5, '#0d0c1e');
      bgGrad.addColorStop(1, '#06060c');
      ctx.fillStyle = bgGrad;
    } else {
      ctx.fillStyle = '#0d0c1e';
    }
    ctx.fillRect(0, 0, width, height);

    // 2. Concentric Orbital Trajectory Rings
    const rings = [0.34, 0.62, 0.88];
    rings.forEach((ratio, ringIdx) => {
      const r = ratio * maxRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = ringIdx === 0 ? 'rgba(168, 85, 247, 0.22)' : ringIdx === 1 ? 'rgba(99, 102, 241, 0.18)' : 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      ctx.setLineDash?.([4, 6]);
      ctx.stroke();
      ctx.setLineDash?.([]);
    });

    // 3. Central Core Star ("My Music")
    const coreNode = this.orbitNodes.find(n => n.orbitRing === 0);
    if (ctx.createRadialGradient) {
      const coreGlow = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, 32);
      coreGlow.addColorStop(0, 'rgba(192, 132, 252, 0.9)');
      coreGlow.addColorStop(0.4, 'rgba(147, 51, 234, 0.35)');
      coreGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, coreNode ? coreNode.nodeRadius : 14, 0, Math.PI * 2);
    ctx.fill();

    // Core Label
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#f3e8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('My Music', centerX, centerY + (coreNode ? coreNode.nodeRadius : 14) + 4);

    // 4. Orbiting Planetary Nodes
    for (const node of this.orbitNodes) {
      if (node.orbitRing === 0) continue;

      const isSelected = this.selectedOrbitNode?.id === node.id;

      // Glow halo
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.nodeRadius * (isSelected ? 2.8 : 2.0), 0, Math.PI * 2);
      ctx.fillStyle = node.glowColor;
      ctx.fill();

      // Planet sphere with 3D gradient
      if (ctx.createRadialGradient) {
        const sphereGrad = ctx.createRadialGradient(
          node.x - node.nodeRadius * 0.3,
          node.y - node.nodeRadius * 0.3,
          node.nodeRadius * 0.1,
          node.x,
          node.y,
          node.nodeRadius
        );
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.4, node.color);
        sphereGrad.addColorStop(1, '#0a0a14');
        ctx.fillStyle = sphereGrad;
      } else {
        ctx.fillStyle = node.color;
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.nodeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.nodeRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Planet label
      ctx.font = `${isSelected ? 'bold' : '600'} 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = node.name.length > 12 ? node.name.substring(0, 11) + '…' : node.name;
      ctx.fillText(label, node.x, node.y + node.nodeRadius + 3);
    }
  }

  private bindCanvasEvents(): void {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
  }

  private unbindCanvasEvents(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
  }

  private onCanvasPointerDown = (e: PointerEvent): void => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Hit test nodes with touch padding (nodeRadius + 14px)
    let closestNode: MobileOrbitNode | null = null;
    let closestDistSq = Infinity;

    for (const node of this.orbitNodes) {
      const dx = clickX - node.x;
      const dy = clickY - node.y;
      const distSq = dx * dx + dy * dy;
      const hitRadius = node.nodeRadius + 14;

      if (distSq <= hitRadius * hitRadius && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestNode = node;
      }
    }

    this.selectedOrbitNode = closestNode;
    this.updateOrbitHud();
    this.draw();
  };

  private updateOrbitHud(): void {
    if (!this.container) return;
    const hud = this.container.querySelector<HTMLElement>('#mobile-orbit-node-hud');
    if (!hud) return;

    if (!this.selectedOrbitNode) {
      hud.style.opacity = '0';
      hud.style.pointerEvents = 'none';
      hud.style.transform = 'translateY(6px)';
      return;
    }

    const node = this.selectedOrbitNode;
    const typeLabel = node.type.toUpperCase();

    hud.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${escapeHtml(node.color)}; box-shadow: 0 0 8px ${escapeHtml(node.color)}; flex-shrink: 0;"></div>
        <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHtml(node.name)}
            </span>
            <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: var(--color-accent-cyan, #38bdf8); background: rgba(56, 189, 248, 0.15); padding: 1px 5px; border-radius: 4px;">
              ${typeLabel}
            </span>
          </div>
          <span style="font-size: 11px; color: var(--color-text-secondary, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(node.subtitle || '')}
          </span>
        </div>
      </div>
      <button
        id="mobile-orbit-action-btn"
        style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-full, 9999px);
          background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          min-height: 40px;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
        "
        aria-label="Play or explore ${escapeHtml(node.name)}"
      >
        <span>${getIconSvg('play', { size: 12 })}</span>
        <span>Play</span>
      </button>
    `;

    hud.style.opacity = '1';
    hud.style.pointerEvents = 'auto';
    hud.style.transform = 'translateY(0)';

    const actionBtn = hud.querySelector<HTMLButtonElement>('#mobile-orbit-action-btn');
    actionBtn?.addEventListener('click', async () => {
      await this.handleNodeAction(node);
    });
  }

  private async handleNodeAction(node: MobileOrbitNode): Promise<void> {
    if (!this.deps.playbackManager) return;

    if (node.type === 'track' && node.targetTrack) {
      await this.deps.playbackManager.playTrack(node.targetTrack);
    } else if (node.type === 'artist' && this.deps.libraryService) {
      const res = await this.deps.libraryService.listTracks({ offset: 0, limit: 50 });
      const artistTracks = res.items.filter(t => t.artistName?.toLowerCase() === node.name.toLowerCase());
      if (artistTracks.length > 0) {
        await this.deps.playbackManager.playTrack(artistTracks[0]!);
      }
    } else if (node.type === 'genre' && this.deps.libraryService) {
      const res = await this.deps.libraryService.listTracks({ offset: 0, limit: 50 });
      const genreTracks = res.items.filter(
        t => t.genreId?.toLowerCase() === node.name.toLowerCase() || (t as any).genre?.toLowerCase() === node.name.toLowerCase()
      );
      if (genreTracks.length > 0) {
        await this.deps.playbackManager.playTrack(genreTracks[0]!);
      }
    } else if (node.type === 'album' && node.targetAlbum && this.deps.libraryService) {
      const res = await this.deps.libraryService.listTracks({ offset: 0, limit: 50 });
      const albumTracks = res.items.filter(t => t.albumId === node.targetAlbum?.id);
      if (albumTracks.length > 0) {
        await this.deps.playbackManager.playTrack(albumTracks[0]!);
      }
    } else if (node.type === 'core' && this.allTracks.length > 0) {
      await this.deps.playbackManager.playTrack(this.allTracks[0]!);
    }
  }

  private render(): void {
    if (!this.container) return;

    const filteredArtists = this.searchQuery
      ? this.artists.filter(a => a.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : this.artists;

    const filteredAlbums = this.searchQuery
      ? this.albums.filter(a =>
          a.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          (a.artistName && a.artistName.toLowerCase().includes(this.searchQuery.toLowerCase()))
        )
      : this.albums;

    const filteredGenres = this.searchQuery
      ? this.genres.filter(g => g.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : this.genres;

    this.container.innerHTML = `
      <style>
        .mobile-discovery-view {
          display: flex;
          flex-direction: column;
          gap: var(--space-5, 20px);
          padding: var(--space-4, 16px) var(--space-3, 12px) calc(var(--mini-player-height, 80px) + var(--bottom-nav-height, 64px) + var(--space-8, 32px)) var(--space-3, 12px);
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
          color: var(--color-text-primary, #ffffff);
          font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        }

        /* Discovery Hero Header */
        .mobile-discovery-hero {
          position: relative;
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid var(--glass-border-interactive, rgba(255, 255, 255, 0.15));
          border-radius: var(--radius-2xl, 24px);
          padding: var(--space-5, 20px) var(--space-4, 16px);
          display: flex;
          flex-direction: column;
          gap: var(--space-3, 12px);
          overflow: hidden;
          box-shadow: var(--shadow-elevation-medium, 0 8px 30px rgba(0, 0, 0, 0.4)), 0 0 24px rgba(124, 58, 237, 0.2);
          box-sizing: border-box;
          width: 100%;
        }

        .mobile-discovery-glow {
          position: absolute;
          right: -30px;
          top: -30px;
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, rgba(56, 189, 248, 0.15) 50%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }

        .mobile-discovery-search-wrapper {
          position: relative;
          width: 100%;
          box-sizing: border-box;
          z-index: 1;
        }

        .mobile-discovery-search-input {
          width: 100%;
          padding: 10px 14px 10px 38px;
          background: rgba(10, 14, 23, 0.85);
          border: 1px solid var(--glass-border-interactive, rgba(255, 255, 255, 0.15));
          border-radius: var(--radius-full, 9999px);
          color: var(--color-text-primary, #ffffff);
          font-size: 13px;
          font-weight: 500;
          outline: none;
          box-sizing: border-box;
          transition: all var(--duration-fast, 150ms);
        }

        /* Section Containers */
        .mobile-discovery-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-3, 12px);
          width: 100%;
          box-sizing: border-box;
        }

        .mobile-discovery-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px;
        }

        .mobile-discovery-section-title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: var(--color-text-primary, #ffffff);
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }

        /* Horizontal Carousels */
        .mobile-discovery-carousel {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 6px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .mobile-discovery-carousel::-webkit-scrollbar {
          display: none;
        }

        /* Artist Card */
        .mobile-discovery-artist-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          min-width: 96px;
          max-width: 110px;
          flex-shrink: 0;
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 6px;
          border-radius: var(--radius-xl, 16px);
          transition: all var(--duration-fast, 150ms);
        }
        .mobile-discovery-artist-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(59, 130, 246, 0.4) 100%);
          border: 2px solid var(--glass-border-interactive, rgba(255, 255, 255, 0.15));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          flex-shrink: 0;
        }
        .mobile-discovery-artist-name {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-text-primary, #ffffff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        /* Genre Pill Card */
        .mobile-discovery-genre-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-full, 9999px);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
          color: var(--color-text-primary, #ffffff);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          min-height: 44px;
          min-width: 44px;
          box-sizing: border-box;
          transition: all var(--duration-fast, 150ms);
        }
        .mobile-discovery-genre-pill:active {
          transform: scale(0.96);
          border-color: var(--color-accent-purple, #a855f7);
        }

        /* Album Card */
        .mobile-discovery-album-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 120px;
          max-width: 130px;
          flex-shrink: 0;
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 6px;
          border-radius: var(--radius-lg, 12px);
          text-align: left;
        }
        .mobile-discovery-album-art {
          width: 108px;
          height: 108px;
          border-radius: var(--radius-lg, 12px);
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(14, 165, 233, 0.3) 100%);
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }
        .mobile-discovery-album-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-primary, #ffffff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mobile-discovery-album-artist {
          font-size: 11px;
          color: var(--color-text-secondary, #94a3b8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Track List Container */
        .mobile-discovery-track-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: rgba(18, 24, 38, 0.4);
          border-radius: var(--radius-xl, 16px);
          border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
          padding: var(--space-2, 8px);
          overflow: hidden;
        }
      </style>

      <section class="mobile-discovery-view" aria-label="Music Galaxy Discovery">
        <!-- 1. Discovery Hero -->
        <header class="mobile-discovery-hero">
          <div class="mobile-discovery-glow"></div>
          <div style="display: flex; flex-direction: column; gap: 4px; z-index: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px;">
                <span>Music</span>
                <span style="background: linear-gradient(135deg, #c084fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Galaxy</span>
              </h1>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: rgba(124, 58, 237, 0.2); color: var(--color-accent-cyan, #38bdf8); border: 1px solid var(--glass-border-interactive, rgba(255, 255, 255, 0.15)); padding: 3px 10px; border-radius: var(--radius-full, 9999px);">
                Discovery
              </span>
            </div>
            <p style="margin: 0; font-size: 13px; color: var(--color-text-secondary, #94a3b8);">
              Discover your music universe. Local-first & lossless.
            </p>
          </div>

          <!-- Quick Search/Filter -->
          <div class="mobile-discovery-search-wrapper">
            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted, #64748b); display: flex;">
              ${getIconSvg('search', { size: 14 })}
            </span>
            <input
              type="search"
              id="mobile-discovery-search"
              class="mobile-discovery-search-input"
              placeholder="Filter galaxy by artist, album, genre..."
              value="${escapeHtml(this.searchQuery)}"
              aria-label="Filter discovery universe"
            />
          </div>
        </header>

        <!-- 2. Live Celestial Orbit Universe (Canvas 2D) -->
        <div class="mobile-galaxy-orbit-section" style="
          position: relative;
          width: 100%;
          border-radius: var(--radius-2xl, 24px);
          overflow: hidden;
          background: radial-gradient(circle at center, #181135 0%, #080812 100%);
          border: 1px solid var(--glass-border-interactive, rgba(255, 255, 255, 0.15));
          box-shadow: var(--shadow-elevation-medium, 0 8px 30px rgba(0, 0, 0, 0.5)), 0 0 24px rgba(124, 58, 237, 0.25);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        ">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); z-index: 2;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8;"></span>
              <span style="font-size: 13px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff;">Live Orbit Universe</span>
            </div>
            <span id="mobile-orbit-count-badge" style="font-size: 11px; font-weight: 600; color: var(--color-accent-cyan, #38bdf8); background: rgba(56, 189, 248, 0.12); padding: 2px 8px; border-radius: var(--radius-full, 9999px); border: 1px solid rgba(56, 189, 248, 0.25);">
              ${this.orbitNodes.length} bodies
            </span>
          </div>

          <div id="mobile-galaxy-canvas-container" style="
            width: 100%;
            height: 280px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            touch-action: none;
            user-select: none;
            box-sizing: border-box;
          ">
            <canvas id="mobile-galaxy-orbit-canvas" style="display: block; width: 100%; height: 100%; touch-action: none;"></canvas>

            <div id="mobile-orbit-node-hud" style="
              position: absolute;
              bottom: 10px;
              left: 12px;
              right: 12px;
              padding: 8px 12px;
              border-radius: var(--radius-xl, 16px);
              background: rgba(10, 14, 26, 0.88);
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              border: 1px solid rgba(255, 255, 255, 0.15);
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              opacity: 0;
              pointer-events: none;
              transform: translateY(6px);
              transition: opacity 0.2s ease, transform 0.2s ease;
              box-sizing: border-box;
            "></div>
          </div>
        </div>

        ${this.isLoading ? `
          <div style="padding: var(--space-8, 32px); text-align: center; color: var(--color-text-muted, #64748b);">
            <div style="font-size: 28px; margin-bottom: 8px;">✨</div>
            <div>Scanning your galaxy...</div>
          </div>
        ` : `
          <!-- 3. Featured Artists Carousel -->
          ${filteredArtists.length > 0 ? `
            <div class="mobile-discovery-section">
              <div class="mobile-discovery-section-header">
                <h2 class="mobile-discovery-section-title">
                  <span style="color: var(--color-accent-cyan, #38bdf8); display: flex;">${getIconSvg('user', { size: 16 })}</span>
                  <span>Featured Artists</span>
                </h2>
              </div>
              <div class="mobile-discovery-carousel" role="region" aria-label="Featured Artists">
                ${filteredArtists.map(artist => `
                  <button
                    class="mobile-discovery-artist-card"
                    data-artist-id="${escapeHtml(artist.id)}"
                    data-artist-name="${escapeHtml(artist.name)}"
                    aria-label="View artist ${escapeHtml(artist.name)}"
                  >
                    <div class="mobile-discovery-artist-avatar">
                      ${escapeHtml(artist.name ? artist.name.charAt(0).toUpperCase() : '♫')}
                    </div>
                    <span class="mobile-discovery-artist-name">${escapeHtml(artist.name)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 4. Genres Strip -->
          ${filteredGenres.length > 0 ? `
            <div class="mobile-discovery-section">
              <div class="mobile-discovery-section-header">
                <h2 class="mobile-discovery-section-title">
                  <span style="color: var(--color-accent-purple-glow, #c084fc); display: flex;">${getIconSvg('sparkles', { size: 16 })}</span>
                  <span>Explore Genres</span>
                </h2>
              </div>
              <div class="mobile-discovery-carousel" role="region" aria-label="Explore Genres">
                ${filteredGenres.map(genre => `
                  <button
                    class="mobile-discovery-genre-pill"
                    data-genre-name="${escapeHtml(genre.name)}"
                    aria-label="Explore genre ${escapeHtml(genre.name)}"
                  >
                    <span>${this.getGenreIcon(genre.name)}</span>
                    <span>${escapeHtml(genre.name)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 5. Albums Carousel -->
          ${filteredAlbums.length > 0 ? `
            <div class="mobile-discovery-section">
              <div class="mobile-discovery-section-header">
                <h2 class="mobile-discovery-section-title">
                  <span style="color: #ec4899; display: flex;">${getIconSvg('disc', { size: 16 })}</span>
                  <span>Albums</span>
                </h2>
              </div>
              <div class="mobile-discovery-carousel" role="region" aria-label="Albums Carousel">
                ${filteredAlbums.map(album => `
                  <button
                    class="mobile-discovery-album-card"
                    data-album-id="${escapeHtml(album.id)}"
                    data-album-title="${escapeHtml(album.title)}"
                    data-artist-name="${escapeHtml(album.artistName || '')}"
                    aria-label="Album ${escapeHtml(album.title)}"
                  >
                    <div class="mobile-discovery-album-art" data-album-id="${escapeHtml(album.id)}">
                      ${getIconSvg('disc', { size: 36, color: 'rgba(255, 255, 255, 0.4)' })}
                    </div>
                    <div class="mobile-discovery-album-title">${escapeHtml(album.title)}</div>
                    <div class="mobile-discovery-album-artist">${escapeHtml(album.artistName || 'Unknown Artist')}</div>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 6. Recently Added Tracks -->
          ${this.recentTracks.length > 0 ? `
            <div class="mobile-discovery-section">
              <div class="mobile-discovery-section-header">
                <h2 class="mobile-discovery-section-title">
                  <span style="color: #38bdf8; display: flex;">${getIconSvg('clock', { size: 16 })}</span>
                  <span>Recently Added</span>
                </h2>
              </div>
              <div class="mobile-discovery-track-list" id="discovery-recent-tracks-slot">
                <!-- Mounted dynamically -->
              </div>
            </div>
          ` : ''}

          <!-- 7. Most Played Tracks -->
          ${this.mostPlayedTracks.length > 0 ? `
            <div class="mobile-discovery-section">
              <div class="mobile-discovery-section-header">
                <h2 class="mobile-discovery-section-title">
                  <span style="color: #f59e0b; display: flex;">${getIconSvg('flame', { size: 16 })}</span>
                  <span>Most Played</span>
                </h2>
              </div>
              <div class="mobile-discovery-track-list" id="discovery-top-tracks-slot">
                <!-- Mounted dynamically -->
              </div>
            </div>
          ` : ''}

          <!-- 8. Favorites -->
          ${this.favoriteTracks.length > 0 ? `
            <div class="mobile-discovery-section">
              <div class="mobile-discovery-section-header">
                <h2 class="mobile-discovery-section-title">
                  <span style="color: var(--color-accent-pink, #ec4899); display: flex;">${getIconSvg('heart-filled', { size: 16, color: 'var(--color-accent-pink, #ec4899)' })}</span>
                  <span>Favorites</span>
                </h2>
              </div>
              <div class="mobile-discovery-track-list" id="discovery-fav-tracks-slot">
                <!-- Mounted dynamically -->
              </div>
            </div>
          ` : ''}
        `}
      </section>
    `;

    this.bindEvents();
    this.mountTrackLists();
    this.resolveAlbumArtwork();
  }

  private getGenreIcon(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('rock')) return '🎸';
    if (lower.includes('pop')) return '✨';
    if (lower.includes('electronic') || lower.includes('edm') || lower.includes('synth')) return '⚡';
    if (lower.includes('jazz')) return '🎷';
    if (lower.includes('classical')) return '🎻';
    if (lower.includes('ambient') || lower.includes('chill')) return '🌌';
    if (lower.includes('hip') || lower.includes('rap')) return '🎤';
    if (lower.includes('metal')) return '🔥';
    return '🎵';
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Search filter input
    const searchInput = this.container.querySelector<HTMLInputElement>('#mobile-discovery-search');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.render();
      this.initCanvasEngine();
      const updatedInput = this.container?.querySelector<HTMLInputElement>('#mobile-discovery-search');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
      }
    });

    // Artist cards click
    this.container.querySelectorAll<HTMLButtonElement>('.mobile-discovery-artist-card').forEach(btn => {
      btn.addEventListener('click', async () => {
        const artistName = btn.getAttribute('data-artist-name');
        if (artistName && this.deps.libraryService && this.deps.playbackManager) {
          const res = await this.deps.libraryService.listTracks({ offset: 0, limit: 50 });
          const artistTracks = res.items.filter(t => t.artistName?.toLowerCase() === artistName.toLowerCase());
          if (artistTracks.length > 0) {
            await this.deps.playbackManager.playTrack(artistTracks[0]!);
          }
        }
      });
    });

    // Genre pills click
    this.container.querySelectorAll<HTMLButtonElement>('.mobile-discovery-genre-pill').forEach(btn => {
      btn.addEventListener('click', async () => {
        const genreName = btn.getAttribute('data-genre-name');
        if (genreName && this.deps.libraryService && this.deps.playbackManager) {
          const res = await this.deps.libraryService.listTracks({ offset: 0, limit: 50 });
          const genreTracks = res.items.filter(
            t => t.genreId?.toLowerCase() === genreName.toLowerCase() || (t as any).genre?.toLowerCase() === genreName.toLowerCase()
          );
          if (genreTracks.length > 0) {
            await this.deps.playbackManager.playTrack(genreTracks[0]!);
          }
        }
      });
    });

    // Album cards click
    this.container.querySelectorAll<HTMLButtonElement>('.mobile-discovery-album-card').forEach(btn => {
      btn.addEventListener('click', async () => {
        const albumId = btn.getAttribute('data-album-id');
        if (albumId && this.deps.libraryService && this.deps.playbackManager) {
          const res = await this.deps.libraryService.listTracks({ offset: 0, limit: 50 });
          const albumTracks = res.items.filter(t => t.albumId === albumId);
          if (albumTracks.length > 0) {
            await this.deps.playbackManager.playTrack(albumTracks[0]!);
          }
        }
      });
    });
  }

  private mountTrackLists(): void {
    if (!this.container) return;

    const currentTrackId = this.deps.playbackManager?.currentTrack?.id;

    const renderTracksIntoSlot = (slotId: string, tracks: Track[]) => {
      const slot = this.container?.querySelector<HTMLElement>(`#${slotId}`);
      if (!slot) return;
      slot.innerHTML = '';
      tracks.forEach((track, index) => {
        const isPlaying = track.id === currentTrackId;
        const rowEl = TrackRowComponent.create(
          track,
          index,
          {
            onPlay: t => {
              void this.deps.playbackManager?.playTrack(t);
            },
            onToggleFavorite: async t => {
              if (this.deps.libraryService) {
                await this.deps.libraryService.toggleFavorite(t.id);
                await this.loadData();
              }
            }
          },
          this.deps.artworkService,
          isPlaying
        );
        slot.appendChild(rowEl);
      });
    };

    if (this.recentTracks.length > 0) {
      renderTracksIntoSlot('discovery-recent-tracks-slot', this.recentTracks);
    }
    if (this.mostPlayedTracks.length > 0) {
      renderTracksIntoSlot('discovery-top-tracks-slot', this.mostPlayedTracks);
    }
    if (this.favoriteTracks.length > 0) {
      renderTracksIntoSlot('discovery-fav-tracks-slot', this.favoriteTracks);
    }
  }

  private resolveAlbumArtwork(): void {
    if (!this.container || !this.deps.artworkService) return;
    const albumArtBoxes = this.container.querySelectorAll<HTMLElement>('.mobile-discovery-album-art');
    albumArtBoxes.forEach(box => {
      const albumId = box.getAttribute('data-album-id');
      if (albumId && this.deps.artworkService) {
        void this.deps.artworkService.getArtworkUrl(albumId, 'medium').then(url => {
          if (url && box) {
            box.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
          }
        });
      }
    });
  }

  public updatePlayingHighlights(): void {
    this.mountTrackLists();
  }
}
