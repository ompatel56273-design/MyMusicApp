import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type {
  IGalaxyService,
  IPlaybackManager,
  ILibraryService,
  IPlaylistService,
  ISearchService
} from '../../services/contracts/service-contracts';
import type { GalaxyGraph, GalaxyNode } from '../../domain/entities/galaxy-types';
import { GalaxyCanvasRenderer } from '../components/galaxy/galaxy-canvas-renderer';
import { GalaxyDetailPanel } from '../components/galaxy/galaxy-detail-panel';
import { RouterService } from '../navigation/router-service';
import { EventBus } from '../../core/events/event-bus';
import type { Disposable } from '../../core/types/common';

export interface GalaxyViewDependencies {
  galaxyService: IGalaxyService;
  playbackManager: IPlaybackManager;
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
  searchService?: ISearchService | undefined;
  router?: RouterService | undefined;
  eventBus?: EventBus | undefined;
}

/**
 * Audio Galaxy Interactive Screen (Phase 14).
 * Combines Canvas 2D visualization, search-and-center, pan/zoom camera toolbar,
 * contextual detail inspector, and semantic accessible list alternative.
 */
export class GalaxyView implements IView {
  private container: HTMLElement | null = null;
  private canvasRenderer: GalaxyCanvasRenderer | null = null;
  private detailPanel: GalaxyDetailPanel | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private subscriptions: Disposable[] = [];

  private readonly deps?: GalaxyViewDependencies | undefined;
  private currentGraph: GalaxyGraph | null = null;
  private selectedNode: GalaxyNode | null = null;
  private isAccessibleViewOpen = false;

  public getSelectedNode(): GalaxyNode | null {
    return this.selectedNode;
  }

  constructor(deps?: GalaxyViewDependencies) {
    this.deps = deps;
  }

  public async mount(container: HTMLElement, _params?: RouteParams): Promise<void> {
    this.container = container;
    this.render();

    if (!this.deps) {
      return;
    }

    await this.initGalaxy();
    this.subscribeEvents();
  }

  public unmount(): void {
    if (this.canvasRenderer) {
      this.canvasRenderer.detachCanvas();
      this.canvasRenderer = null;
    }

    if (this.detailPanel) {
      this.detailPanel.unmount();
      this.detailPanel = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions = [];

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <section class="galaxy-view" style="
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #08080c;
        overflow: hidden;
        user-select: none;
      ">
        <!-- Top Galaxy Control Header -->
        <header style="
          position: absolute;
          top: var(--space-4);
          left: var(--space-4);
          z-index: 10;
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        ">
          <div class="glass-panel" style="
            display: flex;
            align-items: center;
            gap: var(--space-3);
            padding: var(--space-2) var(--space-4);
            border-radius: var(--radius-full);
            background: rgba(18, 18, 26, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
          ">
            <span style="font-weight: 700; font-size: 14px; color: var(--color-accent-primary, #ff6b00); display: flex; align-items: center; gap: 6px;">
              <span>✦</span> Audio Galaxy
            </span>

            <!-- Search input inside Galaxy -->
            <div style="position: relative;">
              <input
                type="text"
                id="galaxy-search-input"
                placeholder="Search universe..."
                aria-label="Search Audio Galaxy entities"
                style="
                  padding: 4px 10px;
                  border-radius: var(--radius-full);
                  background: rgba(255, 255, 255, 0.08);
                  border: 1px solid rgba(255, 255, 255, 0.15);
                  color: var(--color-text-primary);
                  font-size: 12px;
                  width: 160px;
                  outline: none;
                "
              />
            </div>

            <!-- Accessible List Toggle -->
            <button
              id="galaxy-toggle-accessible"
              aria-label="Toggle Accessible Tree View"
              title="Accessible Outline View"
              style="
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: var(--color-text-secondary);
                padding: 4px 10px;
                border-radius: var(--radius-full);
                font-size: 12px;
                cursor: pointer;
              "
            >List View</button>
          </div>
        </header>

        <!-- Navigation / Camera Floating Toolbar -->
        <aside style="
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          z-index: 10;
          display: flex;
          gap: var(--space-2);
        ">
          <div class="glass-panel" style="
            display: flex;
            gap: 4px;
            padding: 4px;
            border-radius: var(--radius-full);
            background: rgba(18, 18, 26, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
          ">
            <button id="galaxy-zoom-in" aria-label="Zoom In" title="Zoom In" style="
              width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent;
              border: none; color: var(--color-text-primary); font-size: 16px; cursor: pointer;
            ">+</button>
            <button id="galaxy-zoom-out" aria-label="Zoom Out" title="Zoom Out" style="
              width: 32px; height: 32px; border-radius: var(--radius-full); background: transparent;
              border: none; color: var(--color-text-primary); font-size: 16px; cursor: pointer;
            ">−</button>
            <button id="galaxy-reset-camera" aria-label="Reset Camera" title="Reset View" style="
              padding: 0 10px; height: 32px; border-radius: var(--radius-full); background: transparent;
              border: none; color: var(--color-text-secondary); font-size: 12px; font-weight: 500; cursor: pointer;
            ">Reset</button>
          </div>
        </aside>

        <!-- Main Canvas Viewport -->
        <div id="galaxy-canvas-container" style="flex: 1; position: relative; width: 100%; height: 100%;">
          <canvas
            id="galaxy-canvas"
            aria-label="Audio Galaxy Interactive Map"
            role="region"
            tabindex="0"
            style="width: 100%; height: 100%; display: block;"
          ></canvas>
        </div>

        <!-- Contextual Detail Panel Container -->
        <div id="galaxy-detail-panel-slot"></div>

        <!-- Semantic Accessible Alternative (Hidden by default, accessible to screen readers & keyboard) -->
        <nav
          id="galaxy-accessible-nav"
          aria-label="Audio Galaxy Navigation"
          style="
            display: none;
            position: absolute;
            inset: 0;
            background: rgba(8, 8, 12, 0.96);
            padding: var(--space-8);
            overflow-y: auto;
            z-index: 15;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <h3 style="margin: 0; font-size: 20px;">Audio Galaxy Library Structure</h3>
            <button id="galaxy-close-accessible" style="
              background: rgba(255, 255, 255, 0.1); border: none; color: #fff; padding: 6px 14px;
              border-radius: var(--radius-md); cursor: pointer;
            ">Back to Galaxy</button>
          </div>
          <div id="galaxy-accessible-list"></div>
        </nav>
      </section>
    `;
  }

  private async initGalaxy(): Promise<void> {
    if (!this.container || !this.deps) return;

    const canvas = this.container.querySelector<HTMLCanvasElement>('#galaxy-canvas');
    if (!canvas) return;

    // 1. Initialize Canvas Renderer
    this.canvasRenderer = new GalaxyCanvasRenderer({
      onNodeClick: node => {
        this.selectedNode = node;
        this.canvasRenderer?.setSelectedNode(node.id);
        this.detailPanel?.setNode(node);
      },
      onNodeDoubleClick: node => {
        this.canvasRenderer?.setFocusedNode(node.id);
      },
      onBackgroundClick: () => {
        this.selectedNode = null;
        this.canvasRenderer?.setSelectedNode(null);
        this.canvasRenderer?.setFocusedNode(null);
        this.detailPanel?.setNode(null);
      }
    });

    this.canvasRenderer.attachCanvas(canvas);

    // 2. Initialize Detail Panel
    const detailSlot = this.container.querySelector<HTMLElement>('#galaxy-detail-panel-slot');
    if (detailSlot) {
      this.detailPanel = new GalaxyDetailPanel({
        playbackManager: this.deps.playbackManager,
        libraryService: this.deps.libraryService,
        playlistService: this.deps.playlistService,
        router: this.deps.router,
        onClose: () => {
          this.selectedNode = null;
          this.canvasRenderer?.setSelectedNode(null);
        },
        onFocus: node => {
          this.canvasRenderer?.setFocusedNode(node.id);
        }
      });
      this.detailPanel.mount(detailSlot);
    }

    // 3. Load Settings & Graph
    const settings = await this.deps.galaxyService.getSettings();
    this.canvasRenderer.setReducedMotion(settings.reducedMotion);

    this.currentGraph = await this.deps.galaxyService.getGraph({
      showPlaylists: settings.showPlaylists,
      showFolders: settings.showFolders
    });
    this.canvasRenderer.setGraph(this.currentGraph);
    this.renderAccessibleList();

    // 4. ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.canvasRenderer?.resize();
      });
      this.resizeObserver.observe(canvas);
    }

    // 5. Attach UI Controls
    this.attachUiControls();
  }

  private attachUiControls(): void {
    if (!this.container) return;

    const zoomInBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-zoom-in');
    const zoomOutBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-zoom-out');
    const resetBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-reset-camera');
    const searchInput = this.container.querySelector<HTMLInputElement>('#galaxy-search-input');
    const toggleAccessibleBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-toggle-accessible');
    const closeAccessibleBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-close-accessible');
    const canvas = this.container.querySelector<HTMLCanvasElement>('#galaxy-canvas');

    zoomInBtn?.addEventListener('click', () => this.canvasRenderer?.zoomIn());
    zoomOutBtn?.addEventListener('click', () => this.canvasRenderer?.zoomOut());
    resetBtn?.addEventListener('click', () => {
      this.selectedNode = null;
      this.canvasRenderer?.setSelectedNode(null);
      this.canvasRenderer?.setFocusedNode(null);
      this.canvasRenderer?.resetCamera();
      this.detailPanel?.setNode(null);
    });

    // Search inside Galaxy
    searchInput?.addEventListener('input', async () => {
      const query = searchInput.value.trim();
      if (!query || !this.deps?.searchService || !this.currentGraph) return;

      const results = await this.deps.searchService.search(query, 1);
      const match = results.tracks[0] || results.albums[0] || results.artists[0];
      if (match) {
        const node = this.currentGraph.nodes.find(n => n.entityId === match.id);
        if (node) {
          this.selectedNode = node;
          this.canvasRenderer?.setSelectedNode(node.id);
          this.canvasRenderer?.setFocusedNode(node.id);
          this.detailPanel?.setNode(node);
        }
      }
    });

    // Accessible view toggles
    const navEl = this.container.querySelector<HTMLElement>('#galaxy-accessible-nav');
    toggleAccessibleBtn?.addEventListener('click', () => {
      this.isAccessibleViewOpen = !this.isAccessibleViewOpen;
      if (navEl) navEl.style.display = this.isAccessibleViewOpen ? 'block' : 'none';
    });

    closeAccessibleBtn?.addEventListener('click', () => {
      this.isAccessibleViewOpen = false;
      if (navEl) navEl.style.display = 'none';
    });

    // Keyboard navigation
    canvas?.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.selectedNode = null;
        this.canvasRenderer?.setSelectedNode(null);
        this.canvasRenderer?.setFocusedNode(null);
        this.detailPanel?.setNode(null);
      } else if (e.key === '+' || e.key === '=') {
        this.canvasRenderer?.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        this.canvasRenderer?.zoomOut();
      } else if (e.key === 'r' || e.key === 'R') {
        this.canvasRenderer?.resetCamera();
      }
    });
  }

  private renderAccessibleList(): void {
    if (!this.container || !this.currentGraph) return;
    const listEl = this.container.querySelector<HTMLElement>('#galaxy-accessible-list');
    if (!listEl) return;

    const genres = this.currentGraph.nodes.filter(n => n.type === 'genre');
    const artists = this.currentGraph.nodes.filter(n => n.type === 'artist');
    const albums = this.currentGraph.nodes.filter(n => n.type === 'album');

    listEl.innerHTML = `
      <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-4);">
        <li>
          <h4>Genres (${genres.length})</h4>
          <ul>
            ${genres.map(g => `<li><strong>${this.escapeHtml(g.label)}</strong> (${g.metadata.trackCount ?? 0} tracks)</li>`).join('')}
          </ul>
        </li>
        <li>
          <h4>Artists (${artists.length})</h4>
          <ul>
            ${artists.map(a => `<li><strong>${this.escapeHtml(a.label)}</strong> (${a.metadata.albumCount ?? 0} albums, ${a.metadata.trackCount ?? 0} tracks)</li>`).join('')}
          </ul>
        </li>
        <li>
          <h4>Albums (${albums.length})</h4>
          <ul>
            ${albums.map(al => `<li><strong>${this.escapeHtml(al.label)}</strong> — ${this.escapeHtml(al.metadata.artistName ?? 'Unknown')} (${al.metadata.trackCount ?? 0} tracks)</li>`).join('')}
          </ul>
        </li>
      </ul>
    `;
  }

  private subscribeEvents(): void {
    if (!this.deps?.eventBus) return;

    // Track/Playback state change updates current glowing node
    this.subscriptions.push(
      this.deps.eventBus.subscribe('playback:state-changed', (event: any) => {
        if (event && event.track) {
          this.canvasRenderer?.setPlayingEntity(event.track.id);
        } else {
          this.canvasRenderer?.setPlayingEntity(null);
        }
      })
    );

    // Library scan invalidates graph cache
    this.subscriptions.push(
      this.deps.eventBus.subscribe('library:scanned', async () => {
        if (this.deps?.galaxyService) {
          this.deps.galaxyService.invalidateCache();
          this.currentGraph = await this.deps.galaxyService.getGraph();
          this.canvasRenderer?.setGraph(this.currentGraph);
          this.renderAccessibleList();
        }
      })
    );
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
