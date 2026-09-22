import type { GalaxyNode } from '../../../domain/entities/galaxy-types';
import type { IPlaybackManager, ILibraryService, IPlaylistService } from '../../../services/contracts/service-contracts';
import { RouterService } from '../../navigation/router-service';

export interface GalaxyDetailPanelDependencies {
  playbackManager: IPlaybackManager;
  libraryService: ILibraryService;
  playlistService?: IPlaylistService | undefined;
  router?: RouterService | undefined;
  onClose?: () => void;
  onFocus?: (node: GalaxyNode) => void;
}

/**
 * Contextual Audio Galaxy Node Inspector and Detail Drawer.
 * Renders verified entity metadata and delegates playback/navigation actions.
 */
export class GalaxyDetailPanel {
  private container: HTMLElement | null = null;
  private currentNode: GalaxyNode | null = null;
  private readonly deps: GalaxyDetailPanelDependencies;

  constructor(deps: GalaxyDetailPanelDependencies) {
    this.deps = deps;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  public setNode(node: GalaxyNode | null): void {
    this.currentNode = node;
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

    this.container.innerHTML = `
      <div class="glass-panel" style="
        position: absolute;
        top: var(--space-4);
        right: var(--space-4);
        width: 320px;
        max-width: calc(100vw - 32px);
        background: rgba(18, 18, 26, 0.88);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: var(--radius-xl);
        padding: var(--space-5);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="
              display: inline-block;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: ${node.color};
              margin-bottom: var(--space-1);
            ">${typeBadge}</span>
            <h3 style="font-size: 18px; font-weight: 700; margin: 0; line-height: 1.3; word-break: break-word;">
              ${this.escapeHtml(title)}
            </h3>
            ${subtext ? `<p style="font-size: 13px; color: var(--color-text-secondary); margin: var(--space-1) 0 0 0;">${this.escapeHtml(subtext)}</p>` : ''}
          </div>
          <button id="galaxy-detail-close" aria-label="Close Inspector" style="
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: var(--color-text-secondary);
            width: 28px;
            height: 28px;
            border-radius: var(--radius-full);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          ">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-2); font-size: 13px; color: var(--color-text-muted);">
          ${meta.albumTitle ? `<div><span style="color: var(--color-text-secondary);">Album:</span> ${this.escapeHtml(meta.albumTitle)}</div>` : ''}
          ${meta.year ? `<div><span style="color: var(--color-text-secondary);">Year:</span> ${meta.year}</div>` : ''}
          ${meta.albumCount !== undefined ? `<div><span style="color: var(--color-text-secondary);">Albums:</span> ${meta.albumCount}</div>` : ''}
          ${meta.trackCount !== undefined && node.type !== 'track' ? `<div><span style="color: var(--color-text-secondary);">Total Tracks:</span> ${meta.trackCount}</div>` : ''}
          ${meta.durationMs ? `<div><span style="color: var(--color-text-secondary);">Duration:</span> ${this.formatDuration(meta.durationMs)}</div>` : ''}
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: var(--space-2); margin-top: var(--space-1);">
          <button id="galaxy-detail-play" style="
            flex: 1;
            padding: var(--space-2) var(--space-3);
            background: var(--color-accent-primary, #ff6b00);
            color: #ffffff;
            border: none;
            border-radius: var(--radius-md);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
          ">▶ Play</button>

          <button id="galaxy-detail-focus" style="
            padding: var(--space-2) var(--space-3);
            background: rgba(255, 255, 255, 0.1);
            color: var(--color-text-primary);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: var(--radius-md);
            font-weight: 500;
            font-size: 13px;
            cursor: pointer;
          ">Focus</button>

          ${node.type === 'album' || node.type === 'artist' ? `
            <button id="galaxy-detail-open" style="
              padding: var(--space-2) var(--space-3);
              background: rgba(255, 255, 255, 0.06);
              color: var(--color-text-secondary);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: var(--radius-md);
              font-size: 13px;
              cursor: pointer;
            ">Library</button>
          ` : ''}
        </div>
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

    const openBtn = this.container.querySelector<HTMLButtonElement>('#galaxy-detail-open');
    openBtn?.addEventListener('click', () => {
      if (this.deps.router) {
        if (node.type === 'album') {
          this.deps.router.navigate('library', { tab: 'albums', id: node.entityId });
        } else if (node.type === 'artist') {
          this.deps.router.navigate('library', { tab: 'artists', id: node.entityId });
        }
      }
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
      const res = await this.deps.libraryService.listTracks({ limit: 100 }, { albumId: node.entityId });
      if (res.items.length > 0) {
        await pm.playTrack(res.items[0]!, res.items);
      }
    } else if (node.type === 'artist') {
      const res = await this.deps.libraryService.listTracks({ limit: 100 }, { artistId: node.entityId });
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
