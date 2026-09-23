import type { GalaxyNode } from '../../../domain/entities/galaxy-types';
import type {
  IPlaybackManager,
  ILibraryService,
  IPlaylistService,
  IArtworkService
} from '../../../services/contracts/service-contracts';
import { RouterService } from '../../navigation/router-service';
import { EventBus } from '../../../core/events/event-bus';
import { DomainEvents } from '../../../domain/events/domain-events';

export interface GalaxyDetailPanelDependencies {
  playbackManager: IPlaybackManager;
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
  artworkService?: IArtworkService | undefined;
  router?: RouterService | undefined;
  eventBus?: EventBus | undefined;
  onClose?: () => void;
  onFocus?: (node: GalaxyNode) => void;
  onFavoriteToggled?: (node: GalaxyNode, isFavorite: boolean) => void;
}

/**
 * Contextual Audio Galaxy Node Inspector and Detail Drawer.
 * Renders verified entity metadata, real artwork, track listings, and delegates playback/queue actions.
 */
export class GalaxyDetailPanel {
  private container: HTMLElement | null = null;
  private currentNode: GalaxyNode | null = null;
  private readonly deps: GalaxyDetailPanelDependencies;
  private currentArtworkUrl: string | null = null;

  constructor(deps: GalaxyDetailPanelDependencies) {
    this.deps = deps;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  public async setNode(node: GalaxyNode | null): Promise<void> {
    this.currentNode = node;
    this.currentArtworkUrl = null;

    if (node && node.artworkId && this.deps.artworkService) {
      try {
        this.currentArtworkUrl = await this.deps.artworkService.getArtworkUrl(node.artworkId, 'small');
      } catch {
        this.currentArtworkUrl = null;
      }
    }

    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

    if (!this.currentNode) {
      this.container.innerHTML = '';
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';
    const node = this.currentNode;
    const meta = node.metadata;

    const typeBadge = node.type.toUpperCase();
    const title = node.label;
    const subtext = meta.artistName || (meta.trackCount !== undefined ? `${meta.trackCount} Tracks` : '');
    const isFav = !!meta.isFavorite;

    this.container.innerHTML = `
      <div class="glass-panel" style="
        position: absolute;
        top: var(--space-4, 16px);
        right: var(--space-4, 16px);
        width: 340px;
        max-width: calc(100vw - 32px);
        max-height: calc(100% - 32px);
        background: rgba(15, 15, 24, 0.94);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
        border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.14));
        border-radius: var(--radius-2xl, 24px);
        padding: var(--space-5, 20px);
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.65), 0 0 24px rgba(124, 58, 237, 0.2);
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
        overflow-y: auto;
        box-sizing: border-box;
        animation: fadeIn 0.2s ease-out;
      ">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div style="display: flex; gap: 12px; min-width: 0; flex: 1;">
            ${
              this.currentArtworkUrl
                ? `<img src="${this.currentArtworkUrl}" alt="${this.escapeHtml(title)}" style="width: 52px; height: 52px; border-radius: var(--radius-lg, 12px); object-fit: cover; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);" />`
                : `<div style="width: 52px; height: 52px; border-radius: var(--radius-lg, 12px); background: linear-gradient(135deg, ${node.color}55, rgba(0,0,0,0.6)); border: 1px solid ${node.color}; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: #ffffff;">✦</div>`
            }
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="
                  display: inline-block;
                  font-size: 10px;
                  font-weight: 800;
                  text-transform: uppercase;
                  letter-spacing: 0.1em;
                  color: ${node.color};
                ">${typeBadge}</span>
                ${isFav ? `<span style="color: #fbbf24; font-size: 11px;">★ Favorite</span>` : ''}
              </div>
              <h3 id="galaxy-detail-title" style="font-size: 16px; font-weight: 700; margin: 2px 0 0 0; color: var(--color-text-primary, #ffffff); line-height: 1.3; word-break: break-word;">
                ${this.escapeHtml(title)}
              </h3>
              ${subtext ? `<p style="font-size: 12px; color: var(--color-text-secondary, #94a3b8); margin: 2px 0 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(subtext)}</p>` : ''}
            </div>
          </div>
          <button id="galaxy-detail-close" aria-label="Close Inspector" style="
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--color-text-secondary, #94a3b8);
            width: 28px;
            height: 28px;
            border-radius: var(--radius-full, 9999px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            flex-shrink: 0;
            transition: all 0.15s ease;
          ">✕</button>
        </div>

        <!-- Metadata Section -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2, 6px); font-size: 12px; color: var(--color-text-muted, #64748b); background: rgba(0, 0, 0, 0.35); padding: 10px 12px; border-radius: var(--radius-lg, 12px); border: 1px solid rgba(255, 255, 255, 0.06);">
          ${meta.albumTitle && node.type !== 'album' ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Album:</span> ${this.escapeHtml(meta.albumTitle)}</div>` : ''}
          ${meta.artistName && node.type !== 'artist' ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Artist:</span> ${this.escapeHtml(meta.artistName)}</div>` : ''}
          ${meta.year ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Year:</span> ${meta.year}</div>` : ''}
          ${meta.albumCount !== undefined ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Albums:</span> ${meta.albumCount}</div>` : ''}
          ${meta.trackCount !== undefined && node.type !== 'track' ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Total Songs:</span> ${meta.trackCount}</div>` : ''}
          ${meta.playCount !== undefined ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Plays:</span> ${meta.playCount}</div>` : ''}
          ${meta.durationMs ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 600;">Duration:</span> ${this.formatDuration(meta.durationMs)}</div>` : ''}
        </div>

        <!-- Primary Action Buttons -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="galaxy-detail-play" style="
            flex: 1;
            min-width: 100px;
            padding: 9px 14px;
            background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
            color: #ffffff;
            border: none;
            border-radius: var(--radius-lg, 12px);
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.15s ease;
          "><span>▶</span> Play</button>

          <button id="galaxy-detail-queue" style="
            padding: 9px 12px;
            background: rgba(255, 255, 255, 0.08);
            color: var(--color-text-primary, #ffffff);
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: var(--radius-lg, 12px);
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
          ">+ Queue</button>

          <button id="galaxy-detail-favorite" aria-label="Toggle Favorite" style="
            padding: 9px 12px;
            background: ${isFav ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255, 255, 255, 0.08)'};
            color: ${isFav ? '#fbbf24' : 'var(--color-text-secondary, #94a3b8)'};
            border: 1px solid ${isFav ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255, 255, 255, 0.14)'};
            border-radius: var(--radius-lg, 12px);
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
          ">★</button>

          <button id="galaxy-detail-focus" style="
            padding: 9px 12px;
            background: rgba(255, 255, 255, 0.06);
            color: var(--color-text-secondary, #94a3b8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: var(--radius-lg, 12px);
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.15s ease;
          ">Center</button>
        </div>

        <!-- Relational Track List (if present) -->
        ${
          meta.trackList && meta.trackList.length > 0
            ? `
          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted, #64748b); letter-spacing: 0.06em;">
              Included Tracks (${meta.trackList.length})
            </span>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; max-height: 140px; overflow-y: auto; padding-right: 4px;">
              ${meta.trackList
                .slice(0, 15)
                .map(
                  (t, idx) => `
                <div class="galaxy-detail-track-row" data-track-id="${t.id}" style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 5px 8px;
                  border-radius: var(--radius-md, 8px);
                  background: rgba(255, 255, 255, 0.03);
                  font-size: 12px;
                  cursor: pointer;
                  transition: background 0.12s ease;
                ">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; color: var(--color-text-primary, #ffffff);">
                    <span style="color: var(--color-text-muted); margin-right: 6px;">${idx + 1}.</span>${this.escapeHtml(t.title)}
                  </span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">${t.durationMs ? this.formatDuration(t.durationMs) : ''}</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }

        <!-- Relational Album List (for Artist) -->
        ${
          meta.albumList && meta.albumList.length > 0
            ? `
          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted, #64748b); letter-spacing: 0.06em;">
              Albums (${meta.albumList.length})
            </span>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px; max-height: 110px; overflow-y: auto;">
              ${meta.albumList
                .map(
                  al => `
                <div style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 5px 8px;
                  border-radius: var(--radius-md, 8px);
                  background: rgba(255, 255, 255, 0.03);
                  font-size: 12px;
                ">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-primary, #ffffff);">
                    ${this.escapeHtml(al.title)}
                  </span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">${al.year ? al.year : ''}</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.container || !this.currentNode) return;

    const node = this.currentNode;

    const closeBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-detail-close');
    closeBtn?.addEventListener('click', () => {
      this.setNode(null);
      this.deps.onClose?.();
    });

    const focusBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-detail-focus');
    focusBtn?.addEventListener('click', () => {
      this.deps.onFocus?.(node);
    });

    const playBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-detail-play');
    playBtn?.addEventListener('click', () => {
      void this.handlePlayback(node);
    });

    const queueBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-detail-queue');
    queueBtn?.addEventListener('click', () => {
      void this.handleQueue(node);
    });

    const favBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-detail-favorite');
    favBtn?.addEventListener('click', async () => {
      if (node.type === 'track') {
        const isFav = await this.deps.libraryService.toggleFavorite(node.entityId);
        node.metadata.isFavorite = isFav;
        this.deps.onFavoriteToggled?.(node, isFav);
        this.deps.eventBus?.publish(DomainEvents.FAVORITE_CHANGED, {
          trackId: node.entityId,
          isFavorite: isFav
        });
        this.render();
      }
    });

    // Sub-track click in detail panel
    const trackRows = this.container.querySelectorAll<HTMLElement>('.galaxy-detail-track-row');
    trackRows.forEach(row => {
      row.addEventListener('click', async () => {
        const trackId = row.getAttribute('data-track-id');
        if (trackId) {
          const track = await this.deps.libraryService.getTrack(trackId);
          if (track) {
            await this.deps.playbackManager.playTrack(track);
          }
        }
      });
    });
  }

  private async handlePlayback(node: GalaxyNode): Promise<void> {
    const pm = this.deps.playbackManager;

    if (node.type === 'track') {
      const track = await this.deps.libraryService.getTrack(node.entityId);
      if (track) {
        await pm.playTrack(track);
      }
    } else if (node.type === 'album') {
      const res = await this.deps.libraryService.listTracks({ limit: 200 }, { albumId: node.entityId });
      if (res.items.length > 0) {
        await pm.playTrack(res.items[0]!, res.items);
      }
    } else if (node.type === 'artist') {
      const res = await this.deps.libraryService.listTracks({ limit: 200 }, { artistId: node.entityId });
      if (res.items.length > 0) {
        await pm.playTrack(res.items[0]!, res.items);
      }
    } else if (node.type === 'genre') {
      const res = await this.deps.libraryService.listTracks({ limit: 200 }, { genreId: node.entityId });
      if (res.items.length > 0) {
        await pm.playTrack(res.items[0]!, res.items);
      }
    } else if (node.type === 'playlist' && this.deps.playlistService) {
      const plWithTracks = await this.deps.playlistService.getPlaylistWithTracks(node.entityId);
      if (plWithTracks && plWithTracks.items.length > 0) {
        const tracks = plWithTracks.items.map(i => i.track);
        await pm.playTrack(tracks[0]!, tracks);
      }
    }
  }

  private async handleQueue(node: GalaxyNode): Promise<void> {
    const pm = this.deps.playbackManager;

    if (node.type === 'track') {
      const track = await this.deps.libraryService.getTrack(node.entityId);
      if (track) {
        await pm.addToQueue([track]);
      }
    } else if (node.type === 'album') {
      const res = await this.deps.libraryService.listTracks({ limit: 200 }, { albumId: node.entityId });
      if (res.items.length > 0) {
        await pm.addToQueue(res.items);
      }
    } else if (node.type === 'artist') {
      const res = await this.deps.libraryService.listTracks({ limit: 200 }, { artistId: node.entityId });
      if (res.items.length > 0) {
        await pm.addToQueue(res.items);
      }
    } else if (node.type === 'genre') {
      const res = await this.deps.libraryService.listTracks({ limit: 200 }, { genreId: node.entityId });
      if (res.items.length > 0) {
        await pm.addToQueue(res.items);
      }
    } else if (node.type === 'playlist' && this.deps.playlistService) {
      const plWithTracks = await this.deps.playlistService.getPlaylistWithTracks(node.entityId);
      if (plWithTracks && plWithTracks.items.length > 0) {
        await pm.addToQueue(plWithTracks.items.map(i => i.track));
      }
    }
  }

  private formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
