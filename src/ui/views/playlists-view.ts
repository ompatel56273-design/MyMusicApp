import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type {
  IPlaylistService,
  IPlaybackManager,
  IArtworkService,
  PlaylistWithTracks
} from '../../services/contracts/service-contracts';
import type { Playlist } from '../../domain/entities/models';
import type { EventBus } from '../../core/events/event-bus';
import type { Disposable } from '../../core/types/common';
import type { RouterService } from '../navigation/router-service';
import { DomainEvents, type PlaylistUpdatedEvent } from '../../domain/events/domain-events';
import { PlaylistCardComponent } from '../components/playlist/playlist-card-component';
import { PlaylistModalComponent } from '../components/playlist/playlist-modal-component';
import { PlaylistDetailComponent } from '../components/playlist/playlist-detail-component';
import { escapeHtml } from '../../core/security/html-sanitizer';
import { getIconSvg, type IconName } from '../icons/icon-registry';

export interface PlaylistsViewDependencies {
  playlistService: IPlaylistService;
  playbackManager: IPlaybackManager;
  artworkService?: IArtworkService | undefined;
  eventBus: EventBus;
  router: RouterService;
}

export type PlaylistFilterCategory = 'all' | 'created' | 'liked' | 'recent' | 'popular';
export type PlaylistSortOption = 'recent' | 'name' | 'tracks' | 'duration';

/**
 * Phase 7 Complete Visual Rebuild of Playlists View (Template 5).
 * Features:
 * - Authoritative Desktop, Tablet, and Mobile Template 5 layouts
 * - Atmospheric Hero Banner with neon glows, live library stats, and "+ Create Playlist" action
 * - Filter Toolbar with category pills (All, My Playlists, Favorites, Recent, Popular) and Search
 * - 2-Column Desktop Layout with Discovery and Playlist Stats right panel
 * - High-fidelity Playlists Grid with cover art, quick-play floating buttons, and option dropdowns
 * - Comprehensive Playlist Detail View with full track table, playback integration, and remove actions
 * - Accessible Modal for Creating and Editing Playlists
 * - Real data consumption via PlaylistService without modifying protected logic.
 */
export class PlaylistsView implements IView {
  private container: HTMLElement | null = null;
  private readonly deps?: PlaylistsViewDependencies | undefined;
  private playlistSub: Disposable | null = null;
  private currentPlaylistId: string | null = null;
  private searchQuery: string = '';
  private activeCategory: PlaylistFilterCategory = 'all';
  private currentSort: PlaylistSortOption = 'recent';

  constructor(deps?: PlaylistsViewDependencies) {
    this.deps = deps;
  }

  public mount(container: HTMLElement, params?: RouteParams): void {
    this.container = container;
    this.currentPlaylistId = params?.id ?? null;

    if (this.deps?.eventBus) {
      this.playlistSub = this.deps.eventBus.subscribe<PlaylistUpdatedEvent>(
        DomainEvents.PLAYLIST_UPDATED,
        () => {
          void this.render();
        }
      );
    }

    void this.render();
  }

  public unmount(): void {
    if (this.playlistSub) {
      this.playlistSub.dispose();
      this.playlistSub = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(params: RouteParams): void {
    if (params.id !== undefined && params.id !== this.currentPlaylistId) {
      this.currentPlaylistId = params.id ?? null;
      void this.render();
    }
  }

  private async render(): Promise<void> {
    if (!this.container) return;

    if (!this.deps) {
      this.container.innerHTML = `
        <section class="playlists-view-container" style="padding: var(--space-6) var(--space-8); max-width: 1720px; margin: 0 auto;">
          <header style="margin-bottom: var(--space-6);">
            <h1 style="font-size: 28px; font-weight: 800; color: #ffffff;">Playlists</h1>
          </header>
          <div class="glass-panel" style="padding: var(--space-8); border-radius: var(--radius-2xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border);">
            <p style="font-size: 14px;">No playlist service attached.</p>
          </div>
        </section>
      `;
      return;
    }

    if (this.currentPlaylistId) {
      await this.renderDetailView(this.currentPlaylistId);
    } else {
      await this.renderGalleryView();
    }
  }

  private async renderDetailView(playlistId: string): Promise<void> {
    if (!this.container || !this.deps) return;

    const data: PlaylistWithTracks | null = await this.deps.playlistService.getPlaylistWithTracks(playlistId);
    if (!data) {
      this.currentPlaylistId = null;
      this.deps.router.navigate('playlists');
      await this.renderGalleryView();
      return;
    }

    this.container.innerHTML = `
      <style>
        .playlists-detail-container {
          padding: var(--space-6) var(--space-8);
          max-width: 1720px;
          margin: 0 auto;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          width: 100%;
          min-width: 0;
          color: var(--color-text-primary);
          font-family: var(--font-family-base);
        }
        @media (max-width: 767px) {
          .playlists-detail-container {
            padding: var(--space-4) var(--space-3) calc(var(--mini-player-height) + var(--bottom-nav-height) + var(--space-8)) var(--space-3);
            gap: var(--space-4);
          }
        }
      </style>
      <section class="playlists-detail-container" aria-label="Playlist Details">
        <div id="playlist-detail-slot"></div>
      </section>
    `;

    const detailSlot = this.container.querySelector<HTMLElement>('#playlist-detail-slot');
    if (detailSlot) {
      PlaylistDetailComponent.render(
        detailSlot,
        data,
        {
          playlistService: this.deps.playlistService,
          playbackManager: this.deps.playbackManager,
          artworkService: this.deps.artworkService
        },
        {
          onBack: () => {
            this.currentPlaylistId = null;
            this.deps?.router.navigate('playlists');
            void this.renderGalleryView();
          },
          onRefresh: () => {
            void this.renderDetailView(playlistId);
          }
        }
      );
    }
  }

  private async renderGalleryView(): Promise<void> {
    if (!this.container || !this.deps) return;

    const paginated = await this.deps.playlistService.listPlaylists({ offset: 0, limit: 100 });
    if (!this.container) return;
    const allPlaylists = paginated.items;

    // Filter by search query
    let filtered = this.searchQuery
      ? allPlaylists.filter(
          p =>
            p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(this.searchQuery.toLowerCase()))
        )
      : [...allPlaylists];

    // Filter by category
    if (this.activeCategory === 'recent') {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (this.activeCategory === 'popular') {
      filtered.sort((a, b) => (b.trackCount || 0) - (a.trackCount || 0));
    }

    // Sort
    if (this.currentSort === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.currentSort === 'tracks') {
      filtered.sort((a, b) => (b.trackCount || 0) - (a.trackCount || 0));
    } else if (this.currentSort === 'duration') {
      filtered.sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
    } else if (this.currentSort === 'recent') {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    const totalTracks = allPlaylists.reduce((acc, p) => acc + (p.trackCount || 0), 0);
    const totalDurationMs = allPlaylists.reduce((acc, p) => acc + (p.durationMs || 0), 0);
    const totalHours = Math.round(totalDurationMs / 3600000);

    const categories: Array<{ id: PlaylistFilterCategory; label: string; icon: IconName }> = [
      { id: 'all', label: 'All Playlists', icon: 'sparkles' },
      { id: 'created', label: 'My Playlists', icon: 'user' },
      { id: 'liked', label: 'Favorites', icon: 'heart' },
      { id: 'recent', label: 'Recently Created', icon: 'clock' },
      { id: 'popular', label: 'Most Tracks', icon: 'flame' }
    ];

    this.container.innerHTML = `
      <style>
        .playlists-view-container {
          padding: var(--space-6) var(--space-8);
          max-width: 1720px;
          margin: 0 auto;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          width: 100%;
          min-width: 0;
          color: var(--color-text-primary);
          font-family: var(--font-family-base);
        }

        /* 2-Column Layout (Desktop Template 5) */
        .playlists-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: var(--space-6);
          align-items: start;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .playlists-main-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .playlists-side-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        /* Hero Banner */
        .playlists-hero-banner {
          position: relative;
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-2xl);
          padding: var(--space-6) var(--space-8);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
          overflow: hidden;
          box-shadow: var(--shadow-elevation-medium), 0 0 24px rgba(124, 58, 237, 0.2);
          box-sizing: border-box;
          width: 100%;
        }

        .playlists-hero-glow {
          position: absolute;
          right: -30px;
          top: -40px;
          width: 260px;
          height: 260px;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, rgba(236, 72, 153, 0.15) 50%, transparent 70%);
          pointer-events: none;
          border-radius: 50%;
        }

        /* Category Filter Tabs */
        .playlist-cat-tabs {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
          z-index: 1;
        }
        .playlist-cat-tabs::-webkit-scrollbar {
          display: none;
        }

        .playlist-cat-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-height: 40px;
          box-sizing: border-box;
        }

        /* Tablet Responsive (< 1200px) */
        @media (min-width: 768px) and (max-width: 1199px) {
          .playlists-view-container {
            padding: var(--space-5) var(--space-6);
            gap: var(--space-4);
          }

          .playlists-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-5);
          }
        }

        /* Mobile Responsive (< 768px) */
        @media (max-width: 767px) {
          .playlists-view-container {
            padding: var(--space-4) var(--space-3) calc(var(--mini-player-height) + var(--bottom-nav-height) + var(--space-8)) var(--space-3);
            gap: var(--space-4);
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .playlists-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-4);
          }

          .playlists-hero-banner {
            padding: var(--space-5) var(--space-4);
            border-radius: var(--radius-xl);
          }
        }
      </style>

      <section class="playlists-view-container" aria-label="Playlists Hub">
        <!-- 1. Playlists Hero Banner (Template 5) -->
        <header class="playlists-hero-banner">
          <div class="playlists-hero-glow"></div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; z-index: 1;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="color: var(--color-accent-purple-glow); display: flex;">
                ${getIconSvg('playlist', { size: 24 })}
              </span>
              <h1 style="font-size: clamp(24px, 4vw, 32px); font-weight: var(--font-weight-extrabold); letter-spacing: -0.02em; color: #ffffff; margin: 0;">
                Playlists
              </h1>
              <span style="font-size: 11px; font-weight: var(--font-weight-extrabold); text-transform: uppercase; letter-spacing: 0.08em; background: rgba(124, 58, 237, 0.2); color: var(--color-accent-cyan); border: 1px solid var(--glass-border-interactive); padding: 3px 10px; border-radius: var(--radius-full);">
                ${allPlaylists.length} Collections
              </span>
            </div>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0;">
              Your moods. Your moments. Your bit-perfect lossless audio collections.
            </p>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: var(--space-3); align-items: center; z-index: 1;">
            <button
              class="create-playlist-btn btn-primary"
              style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 22px;
                background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%);
                border: 1px solid var(--glass-border-interactive);
                border-radius: var(--radius-full);
                color: #ffffff;
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-bold);
                cursor: pointer;
                box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);
                transition: all var(--duration-fast) var(--ease-smooth);
                min-height: 44px;
              "
            >
              <span style="display: flex;">${getIconSvg('plus', { size: 16, color: '#ffffff' })}</span>
              <span>Create Playlist</span>
            </button>
          </div>
        </header>

        <!-- 2. Category Tabs & Filter Toolbar (Template 5) -->
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3);">
          <nav role="tablist" aria-label="Playlist Categories" class="playlist-cat-tabs">
            ${categories
              .map(
                cat => `
              <button
                role="tab"
                aria-selected="${this.activeCategory === cat.id}"
                data-category="${cat.id}"
                class="playlist-cat-btn"
                style="
                  background: ${this.activeCategory === cat.id ? 'linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%)' : 'var(--glass-bg-subtle)'};
                  color: ${this.activeCategory === cat.id ? '#ffffff' : 'var(--color-text-secondary)'};
                  border: 1px solid ${this.activeCategory === cat.id ? 'var(--glass-border-interactive)' : 'var(--glass-border)'};
                  box-shadow: ${this.activeCategory === cat.id ? '0 2px 14px rgba(124, 58, 237, 0.4)' : 'none'};
                "
              >
                <span style="display: flex;">${getIconSvg(cat.icon, { size: 14, color: this.activeCategory === cat.id ? '#ffffff' : 'currentColor' })}</span>
                <span>${cat.label}</span>
              </button>
            `
              )
              .join('')}
          </nav>

          <!-- Search / Filter Input -->
          <div style="display: flex; align-items: center; gap: var(--space-2); min-width: 240px;">
            <div style="position: relative; flex: 1;">
              <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; display: flex;">
                ${getIconSvg('search', { size: 15 })}
              </span>
              <input
                type="search"
                class="playlist-filter-input"
                placeholder="Filter playlists..."
                value="${escapeHtml(this.searchQuery)}"
                aria-label="Filter playlists"
                style="
                  width: 100%;
                  padding: 10px 14px 10px 38px;
                  background: rgba(10, 14, 23, 0.85);
                  border: 1px solid var(--glass-border-interactive);
                  border-radius: var(--radius-full);
                  color: var(--color-text-primary);
                  font-size: var(--font-size-xs);
                  outline: none;
                  box-sizing: border-box;
                  transition: all var(--duration-fast);
                "
              />
            </div>
          </div>
        </div>

        <!-- 3. Dynamic 2-Column Layout -->
        <div class="playlists-grid-layout">
          <div class="playlists-main-column">
            <div class="playlists-grid-slot" style="width: 100%;"></div>
          </div>

          <!-- Right Discovery & Playlist Stats Panel (Desktop Template 5) -->
          <aside class="playlists-side-column">
            <!-- 1. Quick Playlist Stats -->
            <div
              class="glass-panel"
              style="
                background: var(--glass-bg-subtle);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-2xl);
                padding: var(--space-5);
                display: flex;
                flex-direction: column;
                gap: var(--space-4);
                box-sizing: border-box;
              "
            >
              <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; text-transform: uppercase; letter-spacing: 0.08em;">
                ${getIconSvg('bar-chart', { size: 14, color: 'var(--color-accent-cyan)' })}
                <span>Playlist Stats</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-3); display: flex; flex-direction: column;">
                  <span style="font-size: 11px; color: var(--color-text-muted);">Collections</span>
                  <span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: #ffffff; margin-top: 2px;">${allPlaylists.length}</span>
                </div>
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); padding: var(--space-3); display: flex; flex-direction: column;">
                  <span style="font-size: 11px; color: var(--color-text-muted);">Total Songs</span>
                  <span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-extrabold); color: var(--color-accent-cyan); margin-top: 2px;">${totalTracks}</span>
                </div>
              </div>

              <div style="font-size: 12px; color: var(--color-text-secondary); display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--glass-border); padding-top: var(--space-3);">
                <span>Total Runtime:</span>
                <span style="font-weight: var(--font-weight-bold); color: #ffffff;">${totalHours > 0 ? `${totalHours} hrs` : `${Math.round(totalDurationMs / 60000)} mins`}</span>
              </div>
            </div>

            <!-- 2. Lossless Audio Curations -->
            <div
              class="glass-panel"
              style="
                background: linear-gradient(135deg, rgba(30, 20, 70, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-2xl);
                padding: var(--space-5);
                display: flex;
                flex-direction: column;
                gap: var(--space-3);
                box-sizing: border-box;
              "
            >
              <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-accent-pink); text-transform: uppercase; letter-spacing: 0.08em;">
                ${getIconSvg('sparkles', { size: 14, color: 'var(--color-accent-pink)' })}
                <span>Lossless Curations</span>
              </div>
              <h3 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: #ffffff; margin: 0;">
                Smart Playlist Mixes
              </h3>
              <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0; line-height: 1.5;">
                Create playlists based on bit-depth, format, genres, and favorite tracks.
              </p>
              <button
                id="quick-create-playlist-side-btn"
                style="
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  padding: 8px 16px;
                  border-radius: var(--radius-full);
                  background: var(--glass-bg-interactive);
                  border: 1px solid var(--glass-border-interactive);
                  color: var(--color-text-primary);
                  font-size: 12px;
                  font-weight: var(--font-weight-semibold);
                  cursor: pointer;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  margin-top: 4px;
                "
              >
                <span>+ New Collection</span>
                <span>${getIconSvg('chevron-right', { size: 12 })}</span>
              </button>
            </div>
          </aside>
        </div>
      </section>
    `;

    const filterInput = this.container.querySelector<HTMLInputElement>('.playlist-filter-input');
    filterInput?.addEventListener('input', e => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      void this.renderGalleryView();
    });

    const categoryButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-category]');
    categoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-category') as PlaylistFilterCategory;
        if (cat) {
          this.activeCategory = cat;
          void this.renderGalleryView();
        }
      });
    });

    const openCreateModal = () => {
      PlaylistModalComponent.show({
        onSave: async (name, description) => {
          if (this.deps) {
            await this.deps.playlistService.createPlaylist(name, description);
          }
        }
      });
    };

    this.container.querySelector<HTMLButtonElement>('.create-playlist-btn')?.addEventListener('click', openCreateModal);
    this.container.querySelector<HTMLButtonElement>('#quick-create-playlist-side-btn')?.addEventListener('click', openCreateModal);

    const gridSlot = this.container.querySelector<HTMLElement>('.playlists-grid-slot');
    if (!gridSlot) return;

    if (filtered.length === 0) {
      gridSlot.innerHTML = `
        <div class="glass-panel" style="padding: var(--space-12) var(--space-6); border-radius: var(--radius-2xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px dashed var(--glass-border);">
          <div style="display: flex; justify-content: center; margin-bottom: 14px; color: var(--color-accent-purple-glow);">
            ${getIconSvg('playlist', { size: 44 })}
          </div>
          <p style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: var(--color-text-primary); margin: 0 0 6px 0;">
            ${this.searchQuery ? 'No playlists match your search' : 'No playlists created yet'}
          </p>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0 0 var(--space-5) 0; max-width: 420px; margin-left: auto; margin-right: auto; line-height: 1.5;">
            ${this.searchQuery ? 'Try a different search term or clear the filter.' : 'Mix your favorite songs into custom collections and listening queues.'}
          </p>
          ${
            !this.searchQuery
              ? `<button class="empty-create-btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 24px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-full); color: #ffffff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5); min-height: 44px;">
                  <span style="display: flex;">${getIconSvg('plus', { size: 16, color: '#ffffff' })}</span>
                  <span>+ Create Playlist</span>
                </button>`
              : ''
          }
        </div>
      `;

      gridSlot.querySelector('.empty-create-btn')?.addEventListener('click', openCreateModal);
    } else {
      const grid = document.createElement('div');
      grid.className = 'playlists-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(210px, 1fr))';
      grid.style.gap = 'var(--space-4)';
      grid.style.width = '100%';
      grid.style.boxSizing = 'border-box';

      filtered.forEach((playlist: Playlist) => {
        const card = PlaylistCardComponent.create(
          playlist,
          {
            onSelect: p => {
              this.currentPlaylistId = p.id;
              this.deps?.router.navigate('playlists', { id: p.id });
              void this.renderDetailView(p.id);
            },
            onPlay: async p => {
              if (this.deps) {
                const data = await this.deps.playlistService.getPlaylistWithTracks(p.id);
                if (data && data.items.length > 0) {
                  const available = data.items
                    .filter(i => i.track.availability !== 'missing')
                    .map(i => i.track);
                  if (available.length > 0) {
                    await this.deps.playbackManager.playTrack(available[0]!, available);
                  }
                }
              }
            },
            onEdit: p => {
              PlaylistModalComponent.show({
                playlist: p,
                onSave: async (name, description) => {
                  if (this.deps) {
                    await this.deps.playlistService.updatePlaylist(p.id, { name, description });
                  }
                }
              });
            },
            onDelete: async p => {
              if (this.deps) {
                await this.deps.playlistService.deletePlaylist(p.id);
              }
            }
          },
          this.deps?.artworkService
        );

        grid.appendChild(card);
      });

      gridSlot.appendChild(grid);
    }
  }
}
