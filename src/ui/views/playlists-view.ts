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

export interface PlaylistsViewDependencies {
  playlistService: IPlaylistService;
  playbackManager: IPlaybackManager;
  artworkService?: IArtworkService | undefined;
  eventBus: EventBus;
  router: RouterService;
}

export class PlaylistsView implements IView {
  private container: HTMLElement | null = null;
  private readonly deps?: PlaylistsViewDependencies | undefined;
  private playlistSub: Disposable | null = null;
  private currentPlaylistId: string | null = null;
  private searchQuery: string = '';

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

  private async render(): Promise<void> {
    if (!this.container) return;

    if (!this.deps) {
      // Fallback stub if dependencies were not provided
      this.container.innerHTML = `
        <section class="playlists-view" style="padding: var(--space-6); max-width: 1200px; margin: 0 auto;">
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
      <section class="playlists-view" style="padding: var(--space-6); max-width: 1200px; margin: 0 auto; box-sizing: border-box;">
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

    this.container.innerHTML = `
      <section class="playlists-view" style="padding: var(--space-6); max-width: 1200px; margin: 0 auto; box-sizing: border-box;">
        <header style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-6);">
          <div>
            <h2 style="font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: var(--space-2); color: var(--color-text-primary);">
              Playlists
            </h2>
            <p style="font-size: 14px; color: var(--color-text-secondary); margin: 0;">
              Create custom mixes and playlists from your local collection.
            </p>
          </div>

          <div style="display: flex; gap: var(--space-3); align-items: center;">
            <input
              type="text"
              class="playlist-filter-input"
              placeholder="Filter playlists..."
              value="${this.searchQuery}"
              style="padding: var(--space-2) var(--space-3); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-md); color: var(--color-text-primary); font-size: 13px; outline: none; width: 180px;"
            />

            <button
              class="create-playlist-btn"
              style="display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-accent-primary); border: none; border-radius: var(--radius-md); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(255, 107, 0, 0.35); transition: transform 0.15s ease;"
            >
              + New Playlist
            </button>
          </div>
        </header>

        <div class="playlists-grid-slot"></div>
      </section>
    `;

    const filterInput = this.container.querySelector<HTMLInputElement>('.playlist-filter-input');
    filterInput?.addEventListener('input', e => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      void this.renderGalleryView();
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
        <div class="glass-panel" style="padding: var(--space-8); border-radius: var(--radius-lg); text-align: center; color: var(--color-text-muted);">
          <div style="font-size: 40px; margin-bottom: var(--space-3); opacity: 0.5;">♫</div>
          <p style="font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin-bottom: var(--space-1);">
            ${this.searchQuery ? 'No playlists match your search' : 'No playlists created yet'}
          </p>
          <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: var(--space-4);">
            ${this.searchQuery ? 'Try a different search term.' : 'Mix your favorite songs into custom collections.'}
          </p>
          ${
            !this.searchQuery
              ? `<button class="empty-create-btn" style="padding: var(--space-2) var(--space-5); background: var(--color-accent-primary); border: none; border-radius: var(--radius-md); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;">
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
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
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
