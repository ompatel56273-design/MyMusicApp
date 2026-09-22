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

export interface PlaylistsViewDependencies {
  playlistService: IPlaylistService;
  playbackManager: IPlaybackManager;
  artworkService?: IArtworkService | undefined;
  eventBus: EventBus;
  router: RouterService;
}

export type PlaylistFilterCategory = 'all' | 'created' | 'liked' | 'following';

export class PlaylistsView implements IView {
  private container: HTMLElement | null = null;
  private readonly deps?: PlaylistsViewDependencies | undefined;
  private playlistSub: Disposable | null = null;
  private currentPlaylistId: string | null = null;
  private searchQuery: string = '';
  private activeCategory: PlaylistFilterCategory = 'all';

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
      // Fallback stub if dependencies were not provided
      this.container.innerHTML = `
        <section class="playlists-view" style="padding: var(--space-6); max-width: 1400px; margin: 0 auto;">
          <header style="margin-bottom: var(--space-6);">
            <h2 style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">Playlists</h2>
          </header>
          <div class="glass-panel" style="padding: var(--space-8); border-radius: var(--radius-lg); text-align: center; color: var(--color-text-muted);">
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
      // Playlist not found, return to gallery
      this.currentPlaylistId = null;
      this.deps.router.navigate('playlists');
      await this.renderGalleryView();
      return;
    }

    this.container.innerHTML = `
      <section class="playlists-view" style="padding: var(--space-6); max-width: 1400px; margin: 0 auto; box-sizing: border-box; overflow-y: auto; height: 100%;">
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

    const filtered = this.searchQuery
      ? allPlaylists.filter(
          p =>
            p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(this.searchQuery.toLowerCase()))
        )
      : allPlaylists;

    const categories: Array<{ id: PlaylistFilterCategory; label: string }> = [
      { id: 'all', label: 'All Playlists' },
      { id: 'created', label: 'Created by You' },
      { id: 'liked', label: 'Liked Playlists' },
      { id: 'following', label: 'Following' }
    ];

    this.container.innerHTML = `
      <section class="playlists-view" style="padding: var(--space-6); max-width: 1400px; margin: 0 auto; box-sizing: border-box; display: flex; flex-direction: column; gap: var(--space-5); overflow-y: auto; height: 100%;">
        
        <!-- Header Banner (Template 5) -->
        <header style="position: relative; background: linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.7) 100%); border: 1px solid var(--glass-border); border-radius: var(--radius-xl); padding: var(--space-6); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-4); overflow: hidden; backdrop-filter: blur(16px);">
          <div style="position: absolute; right: -20px; top: -20px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%); pointer-events: none; border-radius: 50%;"></div>
          
          <div style="display: flex; flex-direction: column; gap: 4px; z-index: 1;">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <h1 style="font-size: clamp(24px, 4vw, 32px); font-weight: 800; letter-spacing: -0.02em; color: var(--color-text-primary); margin: 0;">
                Playlists
              </h1>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(168, 85, 247, 0.15); color: var(--color-purple-neon); border: 1px solid rgba(168, 85, 247, 0.3); padding: 3px 8px; border-radius: var(--radius-full);">
                ${allPlaylists.length} Collections
              </span>
            </div>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0;">
              Your moods. Your moments. Your music.
            </p>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: var(--space-3); align-items: center; z-index: 1;">
            <button
              class="create-playlist-btn btn-primary"
              style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); border: none; border-radius: var(--radius-full); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: var(--shadow-glow-purple); transition: all var(--duration-fast) var(--ease-smooth); min-height: 44px;"
            >
              <span>+</span> Create Playlist
            </button>
          </div>
        </header>

        <!-- Category Tabs & Filter Toolbar (Template 5) -->
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3);">
          <nav role="tablist" aria-label="Playlist Categories" style="display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: 2px; scrollbar-width: none;">
            ${categories
              .map(
                cat => `
              <button
                role="tab"
                aria-selected="${this.activeCategory === cat.id}"
                data-category="${cat.id}"
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  background: ${this.activeCategory === cat.id ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(59, 130, 246, 0.25) 100%)' : 'rgba(255, 255, 255, 0.04)'};
                  color: ${this.activeCategory === cat.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};
                  border: 1px solid ${this.activeCategory === cat.id ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.08)'};
                  box-shadow: ${this.activeCategory === cat.id ? 'var(--shadow-glow-purple)' : 'none'};
                  padding: 8px 18px;
                  border-radius: var(--radius-full);
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  white-space: nowrap;
                  transition: all var(--duration-fast) var(--ease-smooth);
                  min-height: 40px;
                "
              >
                ${cat.label}
              </button>
            `
              )
              .join('')}
          </nav>

          <!-- Search / Filter Input -->
          <div style="position: relative; min-width: 220px; max-width: 320px;">
            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--color-text-muted); pointer-events: none;">🔍</span>
            <input
              type="text"
              class="playlist-filter-input"
              placeholder="Filter playlists..."
              value="${escapeHtml(this.searchQuery)}"
              aria-label="Filter playlists"
              style="width: 100%; padding: 8px 14px 8px 36px; background: rgba(10, 14, 23, 0.7); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: 13px; outline: none; box-sizing: border-box;"
            />
          </div>
        </div>

        <div class="playlists-grid-slot"></div>
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

    const createBtn = this.container.querySelector<HTMLButtonElement>('.create-playlist-btn');
    createBtn?.addEventListener('click', () => {
      PlaylistModalComponent.show({
        onSave: async (name, description) => {
          if (this.deps) {
            await this.deps.playlistService.createPlaylist(name, description);
          }
        }
      });
    });

    const gridSlot = this.container.querySelector<HTMLElement>('.playlists-grid-slot');
    if (!gridSlot) return;

    if (filtered.length === 0) {
      gridSlot.innerHTML = `
        <div class="glass-panel" style="padding: var(--space-12); border-radius: var(--radius-xl); text-align: center; color: var(--color-text-muted); background: rgba(18, 24, 38, 0.4); border: 1px solid var(--glass-border);">
          <div style="font-size: 44px; margin-bottom: var(--space-3);">📑</div>
          <p style="font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin-bottom: var(--space-2);">
            ${this.searchQuery ? 'No playlists match your search' : 'No playlists created yet'}
          </p>
          <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: var(--space-5); max-width: 420px; margin-left: auto; margin-right: auto;">
            ${this.searchQuery ? 'Try a different search term or clear the filter.' : 'Mix your favorite songs into custom collections and listening queues.'}
          </p>
          ${
            !this.searchQuery
              ? `<button class="empty-create-btn btn-primary" style="padding: 10px 24px; background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%); border: none; border-radius: var(--radius-full); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: var(--shadow-glow-purple); min-height: 44px;">
                  + Create Playlist
                </button>`
              : ''
          }
        </div>
      `;

      gridSlot.querySelector('.empty-create-btn')?.addEventListener('click', () => {
        PlaylistModalComponent.show({
          onSave: async (name, description) => {
            if (this.deps) {
              await this.deps.playlistService.createPlaylist(name, description);
            }
          }
        });
      });
    } else {
      const grid = document.createElement('div');
      grid.className = 'playlists-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
      grid.style.gap = 'var(--space-4)';

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

