import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type {
  IGalaxyService,
  IPlaybackManager,
  ILibraryService,
  IPlaylistService,
  ISearchService,
  IArtworkService
} from '../../services/contracts/service-contracts';
import type { StatsService } from '../../services/stats/stats-service';
import type { GalaxyGraph, GalaxyNode } from '../../domain/entities/galaxy-types';
import { GalaxyCanvasRenderer } from '../components/galaxy/galaxy-canvas-renderer';
import { GalaxyDetailPanel } from '../components/galaxy/galaxy-detail-panel';
import { RouterService } from '../navigation/router-service';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { Disposable } from '../../core/types/common';
import { getIconSvg } from '../icons/icon-registry';

export interface GalaxyViewDependencies {
  galaxyService: IGalaxyService;
  playbackManager: IPlaybackManager;
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
  searchService?: ISearchService | undefined;
  statsService?: StatsService | undefined;
  artworkService?: IArtworkService | undefined;
  router?: RouterService | undefined;
  eventBus?: EventBus | undefined;
}

/**
 * Audio Galaxy Interactive Screen (Template 10).
 * Implements:
 * - Cosmic Header with View Selectors (Galaxy View / List View / Map View) & In-Galaxy Search
 * - Canvas 2D Celestial Orbit Visualization with Real Library Data
 * - Floating Camera Controls (Zoom In, Zoom Out, Reset Center)
 * - Right Explore Sidebar: "Explore Genres" & "Recently Played Planets" (Desktop / Tablet)
 * - Bottom Discover Banner ("Discover More Music" with Explore Now)
 * - Contextual Glassmorphic Node Detail Panel with Real Artwork & Relational Tracks
 * - Full Keyboard & Accessible Outline Navigation
 */
export class GalaxyView implements IView {
  private container: HTMLElement | null = null;
  private canvasRenderer: GalaxyCanvasRenderer | null = null;
  private detailPanel: GalaxyDetailPanel | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private subscriptions: Disposable[] = [];
  private visibilityHandler: (() => void) | null = null;

  private readonly deps?: GalaxyViewDependencies | undefined;
  private currentGraph: GalaxyGraph | null = null;
  private selectedNode: GalaxyNode | null = null;
  private isAccessibleViewOpen = false;
  private keyboardFocusIndex = 0;

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

    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
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
      <section class="galaxy-view-container" style="
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #06060a;
        color: var(--color-text-primary, #ffffff);
        overflow: hidden;
        user-select: none;
      ">
        <style>
          .galaxy-view-container {
            font-family: inherit;
          }
          .galaxy-header-pill {
            padding: 6px 16px;
            border-radius: var(--radius-full, 9999px);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.05);
            color: var(--color-text-secondary, #94a3b8);
            transition: all 0.2s ease;
          }
          .galaxy-header-pill.active, .galaxy-header-pill:hover {
            background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.25);
            box-shadow: 0 0 16px rgba(124, 58, 237, 0.35);
          }
          .galaxy-sidebar-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            border-radius: var(--radius-lg, 12px);
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            cursor: pointer;
            transition: all 0.18s ease;
          }
          .galaxy-sidebar-item:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(168, 85, 247, 0.35);
            transform: translateX(3px);
          }
          .galaxy-tool-btn {
            width: 36px;
            height: 36px;
            border-radius: var(--radius-full, 9999px);
            background: rgba(18, 18, 26, 0.85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: var(--color-text-primary, #ffffff);
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .galaxy-tool-btn:hover {
            background: var(--accent-purple, #7c3aed);
            border-color: #ffffff;
            box-shadow: 0 0 12px rgba(124, 58, 237, 0.5);
          }

          @media (max-width: 1199px) {
            #galaxy-sidebar-panel {
              width: 260px !important;
            }
          }
          @media (max-width: 768px) {
            .galaxy-main-body {
              flex-direction: column !important;
            }
            #galaxy-sidebar-panel {
              display: none !important;
            }
            .galaxy-mobile-explore {
              display: flex !important;
            }
            #galaxy-discover-banner {
              display: none !important;
            }
            .galaxy-header-subtitle {
              display: none !important;
            }
          }
        </style>

        <!-- Top Header (Template 10) -->
        <header style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          background: rgba(6, 6, 10, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          z-index: 10;
          flex-shrink: 0;
          gap: 16px;
        ">
          <div>
            <h1 style="
              margin: 0;
              font-size: 22px;
              font-weight: 800;
              letter-spacing: -0.02em;
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              <span>Music</span>
              <span style="
                background: linear-gradient(135deg, #c084fc, #38bdf8);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              ">Galaxy</span>
            </h1>
            <p class="galaxy-header-subtitle" style="margin: 3px 0 0 0; font-size: 13px; color: var(--color-text-secondary, #94a3b8);">
              Explore your music in a whole new universe.
            </p>
          </div>

          <!-- Controls: View Switchers & Search -->
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <!-- Search Bar -->
            <div style="position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 12px; color: var(--color-text-muted, #64748b); font-size: 13px;">🔍</span>
              <input
                type="text"
                id="galaxy-search-input"
                placeholder="Search universe..."
                aria-label="Search Audio Galaxy entities"
                style="
                  padding: 7px 14px 7px 34px;
                  border-radius: var(--radius-full, 9999px);
                  background: rgba(255, 255, 255, 0.06);
                  border: 1px solid rgba(255, 255, 255, 0.12);
                  color: var(--color-text-primary, #ffffff);
                  font-size: 12px;
                  width: 170px;
                  outline: none;
                  transition: all 0.2s ease;
                "
              />
            </div>

            <!-- View Modes -->
            <div style="display: flex; gap: 6px; background: rgba(0, 0, 0, 0.35); padding: 3px; border-radius: var(--radius-full, 9999px); border: 1px solid rgba(255, 255, 255, 0.08);">
              <button class="galaxy-header-pill active" id="galaxy-view-mode-galaxy">Galaxy View</button>
              <button class="galaxy-header-pill" id="galaxy-toggle-accessible" aria-label="Toggle Accessible Tree View">List View</button>
              <button class="galaxy-header-pill" id="galaxy-view-mode-map">Map View</button>
            </div>
          </div>
        </header>

        <!-- Main Workspace (Canvas + Explore Side Panel) -->
        <div class="galaxy-main-body" style="
          flex: 1;
          display: flex;
          position: relative;
          width: 100%;
          height: calc(100% - 69px);
          overflow: hidden;
        ">
          <!-- Central Canvas Viewport -->
          <div id="galaxy-canvas-container" style="
            flex: 1;
            position: relative;
            height: 100%;
            background: #06060a;
            overflow: hidden;
          ">
            <canvas
              id="galaxy-canvas"
              aria-label="Audio Galaxy Interactive Map"
              role="region"
              tabindex="0"
              style="width: 100%; height: 100%; display: block; outline: none;"
            ></canvas>

            <!-- Atmospheric Aesthetic Tag (Template 10) -->
            <div style="
              position: absolute;
              top: 20px;
              right: 24px;
              font-family: 'Brush Script MT', 'Segoe Script', cursive, sans-serif;
              font-size: 20px;
              color: rgba(255, 255, 255, 0.4);
              transform: rotate(-6deg);
              pointer-events: none;
              line-height: 1.2;
              text-align: right;
            ">
              Different Music<br/><span style="color: var(--accent-cyan, #38bdf8); font-size: 17px;">Same Sky</span>
            </div>

            <!-- Floating Camera Toolbar (Bottom-Left) -->
            <aside style="
              position: absolute;
              bottom: 24px;
              left: 24px;
              z-index: 10;
              display: flex;
              gap: 8px;
            ">
              <div class="glass-panel" style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px;
                border-radius: var(--radius-full, 9999px);
                background: rgba(18, 18, 26, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
              ">
                <button class="galaxy-tool-btn" id="galaxy-zoom-in" aria-label="Zoom In" title="Zoom In">+</button>
                <button class="galaxy-tool-btn" id="galaxy-zoom-out" aria-label="Zoom Out" title="Zoom Out">−</button>
                <button id="galaxy-reset-camera" aria-label="Reset Camera" title="Reset View" style="
                  padding: 0 14px;
                  height: 36px;
                  border-radius: var(--radius-full, 9999px);
                  background: rgba(255, 255, 255, 0.08);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  color: var(--color-text-secondary, #94a3b8);
                  font-size: 12px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.15s ease;
                ">Reset</button>
              </div>
            </aside>

            <!-- Bottom Discover Banner (Template 10) -->
            <div id="galaxy-discover-banner" class="glass-panel" style="
              position: absolute;
              bottom: 24px;
              left: 200px;
              right: 24px;
              max-width: 520px;
              padding: 16px 20px;
              border-radius: var(--radius-2xl, 20px);
              background: linear-gradient(135deg, rgba(30, 27, 75, 0.85), rgba(15, 23, 42, 0.85));
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border: 1px solid rgba(168, 85, 247, 0.25);
              box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(124, 58, 237, 0.15);
              z-index: 5;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
            ">
              <div>
                <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff;">Discover More Music</h4>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--color-text-secondary, #94a3b8);">
                  Let the galaxy guide your next favorite song.
                </p>
              </div>
              <button id="galaxy-explore-now-btn" style="
                padding: 8px 16px;
                border-radius: var(--radius-full, 9999px);
                background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
                color: #ffffff;
                border: none;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
                transition: all 0.15s ease;
              ">Explore Now →</button>
            </div>

            <!-- Mobile Explore Planets Horizontal Row (Mobile Template 10) -->
            <div class="galaxy-mobile-explore" style="
              display: none;
              position: absolute;
              bottom: 16px;
              left: 16px;
              right: 16px;
              overflow-x: auto;
              gap: 10px;
              padding-bottom: 4px;
              z-index: 8;
            " id="galaxy-mobile-planets-list"></div>
          </div>

          <!-- Contextual Detail Panel Container -->
          <div id="galaxy-detail-panel-slot"></div>

          <!-- Right Sidebar (Template 10: Explore Genres & Recently Played Planets) -->
          <aside id="galaxy-sidebar-panel" style="
            width: 300px;
            height: 100%;
            background: rgba(10, 10, 16, 0.85);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-left: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            padding: 20px;
            gap: 24px;
            z-index: 6;
            flex-shrink: 0;
          ">
            <!-- Section 1: Explore Genres -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff;">Explore Genres</h3>
                <span style="font-size: 12px; color: var(--accent-cyan, #38bdf8); cursor: pointer;" id="galaxy-see-all-genres">See all</span>
              </div>
              <div id="galaxy-genres-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
            </div>

            <!-- Section 2: Recently Played Planets / Galaxy Highlights -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #ffffff;">Recently Played Planets</h3>
                <span style="font-size: 12px; color: var(--accent-cyan, #38bdf8); cursor: pointer;" id="galaxy-see-all-planets">See all</span>
              </div>
              <div id="galaxy-planets-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
            </div>
          </aside>
        </div>

        <!-- Semantic Accessible Alternative (Full Screen Overlay) -->
        <nav
          id="galaxy-accessible-nav"
          aria-label="Audio Galaxy Navigation"
          style="
            display: none;
            position: absolute;
            inset: 0;
            background: rgba(8, 8, 12, 0.98);
            padding: 32px;
            overflow-y: auto;
            z-index: 30;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 16px;">
            <h3 style="margin: 0; font-size: 22px; font-weight: 700;">Audio Galaxy Library Structure</h3>
            <button id="galaxy-close-accessible" style="
              background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
              border: none;
              color: #fff;
              padding: 8px 18px;
              border-radius: var(--radius-full, 9999px);
              cursor: pointer;
              font-weight: 600;
              font-size: 13px;
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
        void this.detailPanel?.setNode(node);
      },
      onNodeDoubleClick: node => {
        this.canvasRenderer?.setFocusedNode(node.id);
      },
      onBackgroundClick: () => {
        this.selectedNode = null;
        this.canvasRenderer?.setSelectedNode(null);
        this.canvasRenderer?.setFocusedNode(null);
        void this.detailPanel?.setNode(null);
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
        artworkService: this.deps.artworkService,
        router: this.deps.router,
        eventBus: this.deps.eventBus,
        onClose: () => {
          this.selectedNode = null;
          this.canvasRenderer?.setSelectedNode(null);
        },
        onFocus: node => {
          this.canvasRenderer?.setFocusedNode(node.id);
        },
        onFavoriteToggled: (node, isFav) => {
          if (this.currentGraph) {
            const match = this.currentGraph.nodes.find(n => n.id === node.id);
            if (match) {
              match.metadata.isFavorite = isFav;
              this.canvasRenderer?.requestRedraw();
            }
          }
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
    await this.renderExplorePanels();

    // Render empty state overlay if no graph nodes exist
    if (this.currentGraph.nodes.length === 0) {
      const canvasContainer = this.container.querySelector<HTMLElement>('#galaxy-canvas-container');
      if (canvasContainer) {
        const emptyOverlay = document.createElement('div');
        emptyOverlay.id = 'galaxy-empty-state';
        emptyOverlay.style.cssText = 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 15; padding: 24px; pointer-events: auto;';
        emptyOverlay.innerHTML = `
          <div class="glass-panel" style="padding: var(--space-8); border-radius: var(--radius-2xl); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); text-align: center; max-width: 440px; box-shadow: var(--shadow-elevation-medium);">
            <div style="color: var(--color-accent-purple-glow); display: flex; justify-content: center; margin-bottom: 12px;">
              ${getIconSvg('galaxy', { size: 48 })}
            </div>
            <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0 0 8px 0;">
              Your Music Galaxy is Empty
            </h3>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0 0 var(--space-5) 0; line-height: 1.5;">
              Scan your local music files or connect your music folder to chart an interactive constellation of genres, artists, and albums.
            </p>
            <button
              id="galaxy-empty-open-library"
              style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-full); color: #ffffff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);"
            >
              <span style="display: flex;">${getIconSvg('library', { size: 14, color: '#ffffff' })}</span>
              <span>Open Library</span>
            </button>
          </div>
        `;
        canvasContainer.appendChild(emptyOverlay);

        emptyOverlay.querySelector('#galaxy-empty-open-library')?.addEventListener('click', () => {
          this.deps?.router?.navigate('library');
        });
      }
    }

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

  private async renderExplorePanels(): Promise<void> {
    if (!this.container || !this.currentGraph) return;

    const genresList = this.container.querySelector<HTMLElement>('#galaxy-genres-list');
    const planetsList = this.container.querySelector<HTMLElement>('#galaxy-planets-list');
    const mobilePlanetsList = this.container.querySelector<HTMLElement>('#galaxy-mobile-planets-list');

    const genres = this.currentGraph.nodes.filter(n => n.type === 'genre');
    const artists = this.currentGraph.nodes.filter(n => n.type === 'artist');
    const albums = this.currentGraph.nodes.filter(n => n.type === 'album');

    // 1. Render Genre List
    if (genresList) {
      if (genres.length === 0) {
        genresList.innerHTML = `<div style="font-size: 13px; color: var(--color-text-muted);">No genres discovered yet.</div>`;
      } else {
        genresList.innerHTML = genres
          .slice(0, 8)
          .map(g => `
            <div class="galaxy-sidebar-item" data-node-id="${this.escapeHtml(g.id)}">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="
                  width: 28px;
                  height: 28px;
                  border-radius: var(--radius-full, 9999px);
                  background: ${g.color}33;
                  border: 1px solid ${g.color};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  color: ${g.color};
                ">✦</div>
                <div>
                  <div style="font-size: 13px; font-weight: 600; color: #ffffff;">${this.escapeHtml(g.label)}</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">${g.metadata.trackCount ?? 0} songs</div>
                </div>
              </div>
              <span style="color: var(--color-text-muted); font-size: 14px;">›</span>
            </div>
          `)
          .join('');

        genresList.querySelectorAll<HTMLElement>('.galaxy-sidebar-item').forEach(el => {
          el.addEventListener('click', () => {
            const nodeId = el.getAttribute('data-node-id');
            if (nodeId) {
              const node = this.currentGraph?.nodes.find(n => n.id === nodeId);
              if (node) {
                this.selectedNode = node;
                this.canvasRenderer?.setSelectedNode(node.id);
                this.canvasRenderer?.setFocusedNode(node.id);
                void this.detailPanel?.setNode(node);
              }
            }
          });
        });
      }
    }

    // 2. Render Recently Played Planets / Real Listening History
    if (planetsList) {
      let recentItems: Array<{ id: string; label: string; subtext: string; color: string; nodeId?: string }> = [];

      if (this.deps?.statsService) {
        try {
          const history = await this.deps.statsService.getRecentHistory(6);
          recentItems = history.map(h => {
            const matchingNode = this.currentGraph?.nodes.find(n => n.entityId === h.track.id);
            return {
              id: h.track.id,
              label: h.track.title,
              subtext: h.track.artistName || 'Unknown Artist',
              color: '#10b981',
              nodeId: matchingNode?.id || `track:${h.track.id}`
            };
          });
        } catch {
          recentItems = [];
        }
      }

      if (recentItems.length === 0) {
        // Fallback to top library items
        const fallback = [...albums, ...artists].slice(0, 5);
        recentItems = fallback.map(item => ({
          id: item.entityId,
          label: item.label,
          subtext: `${item.metadata.trackCount ?? 0} songs`,
          color: item.color,
          nodeId: item.id
        }));
      }

      if (recentItems.length === 0) {
        planetsList.innerHTML = `<div style="font-size: 13px; color: var(--color-text-muted);">Explore the galaxy to discover music.</div>`;
      } else {
        planetsList.innerHTML = recentItems
          .map(h => `
            <div class="galaxy-sidebar-item" data-node-id="${this.escapeHtml(h.nodeId || '')}">
              <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                <div style="
                  width: 32px;
                  height: 32px;
                  border-radius: 8px;
                  background: linear-gradient(135deg, ${h.color}88, #1e1b4b);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: 700;
                  color: #ffffff;
                  flex-shrink: 0;
                ">🪐</div>
                <div style="min-width: 0; flex: 1;">
                  <div style="font-size: 13px; font-weight: 600; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${this.escapeHtml(h.label)}
                  </div>
                  <div style="font-size: 11px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(h.subtext)}</div>
                </div>
              </div>
              <span style="color: var(--color-text-muted); font-size: 14px; margin-left: 8px;">›</span>
            </div>
          `)
          .join('');

        planetsList.querySelectorAll<HTMLElement>('.galaxy-sidebar-item').forEach(el => {
          el.addEventListener('click', () => {
            const nodeId = el.getAttribute('data-node-id');
            if (nodeId) {
              const node = this.currentGraph?.nodes.find(n => n.id === nodeId);
              if (node) {
                this.selectedNode = node;
                this.canvasRenderer?.setSelectedNode(node.id);
                this.canvasRenderer?.setFocusedNode(node.id);
                void this.detailPanel?.setNode(node);
              }
            }
          });
        });
      }
    }

    // 3. Render Mobile Horizontal Planets Card Row
    if (mobilePlanetsList) {
      const mobileNodes = [...genres, ...albums, ...artists].slice(0, 8);
      mobilePlanetsList.innerHTML = mobileNodes
        .map(n => `
          <div class="glass-panel" data-node-id="${this.escapeHtml(n.id)}" style="
            flex-shrink: 0;
            padding: 8px 14px;
            border-radius: var(--radius-full, 9999px);
            background: rgba(18, 18, 26, 0.9);
            border: 1px solid ${n.color}88;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          ">
            <span style="color: ${n.color}; font-size: 12px;">●</span>
            <span style="font-size: 12px; font-weight: 600; color: #ffffff;">${this.escapeHtml(n.label)}</span>
          </div>
        `)
        .join('');

      mobilePlanetsList.querySelectorAll<HTMLElement>('[data-node-id]').forEach(el => {
        el.addEventListener('click', () => {
          const nodeId = el.getAttribute('data-node-id');
          if (nodeId) {
            const node = this.currentGraph?.nodes.find(n => n.id === nodeId);
            if (node) {
              this.selectedNode = node;
              this.canvasRenderer?.setSelectedNode(node.id);
              this.canvasRenderer?.setFocusedNode(node.id);
              void this.detailPanel?.setNode(node);
            }
          }
        });
      });
    }
  }

  private attachUiControls(): void {
    if (!this.container) return;

    const zoomInBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-zoom-in');
    const zoomOutBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-zoom-out');
    const resetBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-reset-camera');
    const searchInput = this.container.querySelector<HTMLInputElement>('#galaxy-search-input');
    const toggleAccessibleBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-toggle-accessible');
    const closeAccessibleBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-close-accessible');
    const exploreNowBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-explore-now-btn');
    const canvas = this.container.querySelector<HTMLCanvasElement>('#galaxy-canvas');

    zoomInBtn?.addEventListener('click', () => this.canvasRenderer?.zoomIn());
    zoomOutBtn?.addEventListener('click', () => this.canvasRenderer?.zoomOut());
    resetBtn?.addEventListener('click', () => {
      this.selectedNode = null;
      this.canvasRenderer?.setSelectedNode(null);
      this.canvasRenderer?.setFocusedNode(null);
      this.canvasRenderer?.resetCamera();
      void this.detailPanel?.setNode(null);
    });

    exploreNowBtn?.addEventListener('click', () => {
      if (this.currentGraph && this.currentGraph.nodes.length > 0) {
        const randomNode = this.currentGraph.nodes[Math.floor(Math.random() * this.currentGraph.nodes.length)];
        if (randomNode) {
          this.selectedNode = randomNode;
          this.canvasRenderer?.setSelectedNode(randomNode.id);
          this.canvasRenderer?.setFocusedNode(randomNode.id);
          void this.detailPanel?.setNode(randomNode);
        }
      } else if (this.deps?.router) {
        this.deps.router.navigate('library');
      }
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
          void this.detailPanel?.setNode(node);
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
      if (!this.currentGraph || this.currentGraph.nodes.length === 0) return;

      const cam = this.canvasRenderer?.getCamera() || { x: 0, y: 0, zoom: 1 };
      const panStep = 60 / cam.zoom;

      if (e.key === 'Escape') {
        this.selectedNode = null;
        this.canvasRenderer?.setSelectedNode(null);
        this.canvasRenderer?.setFocusedNode(null);
        void this.detailPanel?.setNode(null);
      } else if (e.key === '+' || e.key === '=') {
        this.canvasRenderer?.zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        this.canvasRenderer?.zoomOut();
      } else if (e.key === 'r' || e.key === 'R') {
        this.canvasRenderer?.resetCamera();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.canvasRenderer?.centerOnCoordinates(cam.x, cam.y - panStep);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.canvasRenderer?.centerOnCoordinates(cam.x, cam.y + panStep);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.canvasRenderer?.centerOnCoordinates(cam.x - panStep, cam.y);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.canvasRenderer?.centerOnCoordinates(cam.x + panStep, cam.y);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const total = this.currentGraph.nodes.length;
        if (e.shiftKey) {
          this.keyboardFocusIndex = (this.keyboardFocusIndex - 1 + total) % total;
        } else {
          this.keyboardFocusIndex = (this.keyboardFocusIndex + 1) % total;
        }
        const focusedNode = this.currentGraph.nodes[this.keyboardFocusIndex];
        if (focusedNode) {
          this.canvasRenderer?.setFocusedNode(focusedNode.id);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        const focusedNode = this.currentGraph.nodes[this.keyboardFocusIndex];
        if (focusedNode) {
          this.selectedNode = focusedNode;
          this.canvasRenderer?.setSelectedNode(focusedNode.id);
          void this.detailPanel?.setNode(focusedNode);
        }
      } else if (e.key === 'p' || e.key === 'P') {
        const nodeToPlay = this.selectedNode || this.currentGraph.nodes[this.keyboardFocusIndex];
        if (nodeToPlay) {
          void this.handleQuickPlay(nodeToPlay);
        }
      }
    });
  }

  private async handleQuickPlay(node: GalaxyNode): Promise<void> {
    if (!this.deps) return;
    const pm = this.deps.playbackManager;

    if (node.type === 'track') {
      const track = await this.deps.libraryService.getTrack(node.entityId);
      if (track) await pm.playTrack(track);
    } else if (node.type === 'album') {
      const res = await this.deps.libraryService.listTracks({ limit: 100 }, { albumId: node.entityId });
      if (res.items.length > 0) await pm.playTrack(res.items[0]!, res.items);
    } else if (node.type === 'artist') {
      const res = await this.deps.libraryService.listTracks({ limit: 100 }, { artistId: node.entityId });
      if (res.items.length > 0) await pm.playTrack(res.items[0]!, res.items);
    } else if (node.type === 'genre') {
      const res = await this.deps.libraryService.listTracks({ limit: 100 }, { genreId: node.entityId });
      if (res.items.length > 0) await pm.playTrack(res.items[0]!, res.items);
    }
  }

  private renderAccessibleList(): void {
    if (!this.container || !this.currentGraph) return;
    const listEl = this.container.querySelector<HTMLElement>('#galaxy-accessible-list');
    if (!listEl) return;

    const genres = this.currentGraph.nodes.filter(n => n.type === 'genre');
    const artists = this.currentGraph.nodes.filter(n => n.type === 'artist');
    const albums = this.currentGraph.nodes.filter(n => n.type === 'album');

    listEl.innerHTML = `
      <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-6, 24px);">
        <li>
          <h4 style="color: var(--accent-purple, #a855f7); font-size: 16px; margin-bottom: 8px;">Genres (${genres.length})</h4>
          <ul style="padding-left: 20px;">
            ${genres.map(g => `<li style="margin-bottom: 4px;"><button class="galaxy-accessible-item-btn" data-node-id="${this.escapeHtml(g.id)}" style="background: none; border: none; color: inherit; font: inherit; cursor: pointer; text-decoration: underline;"><strong>${this.escapeHtml(g.label)}</strong></button> (${g.metadata.trackCount ?? 0} tracks)</li>`).join('')}
          </ul>
        </li>
        <li>
          <h4 style="color: #38bdf8; font-size: 16px; margin-bottom: 8px;">Artists (${artists.length})</h4>
          <ul style="padding-left: 20px;">
            ${artists.map(a => `<li style="margin-bottom: 4px;"><button class="galaxy-accessible-item-btn" data-node-id="${this.escapeHtml(a.id)}" style="background: none; border: none; color: inherit; font: inherit; cursor: pointer; text-decoration: underline;"><strong>${this.escapeHtml(a.label)}</strong></button> (${a.metadata.albumCount ?? 0} albums, ${a.metadata.trackCount ?? 0} tracks)</li>`).join('')}
          </ul>
        </li>
        <li>
          <h4 style="color: #ff6b00; font-size: 16px; margin-bottom: 8px;">Albums (${albums.length})</h4>
          <ul style="padding-left: 20px;">
            ${albums.map(al => `<li style="margin-bottom: 4px;"><button class="galaxy-accessible-item-btn" data-node-id="${this.escapeHtml(al.id)}" style="background: none; border: none; color: inherit; font: inherit; cursor: pointer; text-decoration: underline;"><strong>${this.escapeHtml(al.label)}</strong></button> — ${this.escapeHtml(al.metadata.artistName ?? 'Unknown')} (${al.metadata.trackCount ?? 0} tracks)</li>`).join('')}
          </ul>
        </li>
      </ul>
    `;

    listEl.querySelectorAll<HTMLButtonElement>('.galaxy-accessible-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nodeId = btn.getAttribute('data-node-id');
        if (nodeId && this.currentGraph) {
          const node = this.currentGraph.nodes.find(n => n.id === nodeId);
          if (node) {
            this.selectedNode = node;
            this.canvasRenderer?.setSelectedNode(node.id);
            this.canvasRenderer?.setFocusedNode(node.id);
            void this.detailPanel?.setNode(node);
            this.isAccessibleViewOpen = false;
            const navEl = this.container?.querySelector<HTMLElement>('#galaxy-accessible-nav');
            if (navEl) navEl.style.display = 'none';
          }
        }
      });
    });
  }

  private subscribeEvents(): void {
    if (!this.deps?.eventBus) return;

    // Track/Playback state change updates current glowing node
    this.subscriptions.push(
      this.deps.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, (event: any) => {
        if (event && event.track) {
          this.canvasRenderer?.setPlayingEntity(event.track.id);
        } else {
          this.canvasRenderer?.setPlayingEntity(null);
        }
      })
    );

    this.subscriptions.push(
      this.deps.eventBus.subscribe(DomainEvents.TRACK_CHANGED, (event: any) => {
        if (event && event.currentTrack) {
          this.canvasRenderer?.setPlayingEntity(event.currentTrack.id);
        } else {
          this.canvasRenderer?.setPlayingEntity(null);
        }
      })
    );

    // Favorite state change
    this.subscriptions.push(
      this.deps.eventBus.subscribe(DomainEvents.FAVORITE_CHANGED, (event: any) => {
        if (event && event.trackId && this.currentGraph) {
          const node = this.currentGraph.nodes.find(n => n.entityId === event.trackId);
          if (node) {
            node.metadata.isFavorite = event.isFavorite;
            this.canvasRenderer?.requestRedraw();
          }
        }
      })
    );

    // Library scan invalidates graph cache
    const onLibraryRefresh = async () => {
      if (this.deps?.galaxyService) {
        this.deps.galaxyService.invalidateCache();
        this.currentGraph = await this.deps.galaxyService.getGraph();
        this.canvasRenderer?.setGraph(this.currentGraph);
        this.renderAccessibleList();
        await this.renderExplorePanels();
      }
    };

    this.subscriptions.push(this.deps.eventBus.subscribe('library:scanned', onLibraryRefresh));
    this.subscriptions.push(this.deps.eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, onLibraryRefresh));

    // Tab visibility handling (pause animation when tab hidden)
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.canvasRenderer?.setSelectedNode(null);
        } else {
          this.canvasRenderer?.requestRedraw();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
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

