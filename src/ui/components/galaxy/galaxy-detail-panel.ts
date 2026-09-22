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
        background: rgba(18, 18, 26, 0.92);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12));
        border-radius: var(--radius-2xl, 24px);
        padding: var(--space-5, 20px);
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(124, 58, 237, 0.15);
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: var(--space-4, 16px);
        animation: fadeIn 0.2s ease-out;
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="min-width: 0; flex: 1;">
            <span style="
              display: inline-block;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: ${node.color};
              margin-bottom: var(--space-1, 4px);
            ">${typeBadge} PLANET</span>
            <h3 style="font-size: 18px; font-weight: 700; margin: 0; color: var(--color-text-primary, #ffffff); line-height: 1.3; word-break: break-word;">
              ${this.escapeHtml(title)}
            </h3>
            ${subtext ? `<p style="font-size: 13px; color: var(--color-text-secondary, #94a3b8); margin: var(--space-1, 4px) 0 0 0;">${this.escapeHtml(subtext)}</p>` : ''}
          </div>
          <button id="galaxy-detail-close" aria-label="Close Inspector" style="
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--color-text-secondary, #94a3b8);
            width: 32px;
            height: 32px;
            border-radius: var(--radius-full, 9999px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
            transition: all 0.15s ease;
          ">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--space-2, 8px); font-size: 13px; color: var(--color-text-muted, #64748b); background: rgba(0, 0, 0, 0.25); padding: 12px; border-radius: var(--radius-lg, 12px); border: 1px solid rgba(255, 255, 255, 0.05);">
          ${meta.albumTitle ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 500;">Album:</span> ${this.escapeHtml(meta.albumTitle)}</div>` : ''}
          ${meta.artistName && node.type !== 'artist' ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 500;">Artist:</span> ${this.escapeHtml(meta.artistName)}</div>` : ''}
          ${meta.year ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 500;">Year:</span> ${meta.year}</div>` : ''}
          ${meta.albumCount !== undefined ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 500;">Albums:</span> ${meta.albumCount}</div>` : ''}
          ${meta.trackCount !== undefined && node.type !== 'track' ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 500;">Total Songs:</span> ${meta.trackCount}</div>` : ''}
          ${meta.durationMs ? `<div><span style="color: var(--color-text-secondary, #94a3b8); font-weight: 500;">Duration:</span> ${this.formatDuration(meta.durationMs)}</div>` : ''}
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: var(--space-2, 8px); margin-top: var(--space-1, 4px);">
          <button id="galaxy-detail-play" style="
            flex: 1;
            padding: 10px 14px;
            background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
            color: #ffffff;
            border: none;
            border-radius: var(--radius-lg, 12px);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.15s ease;
          "><span>▶</span> Play Planet</button>

          <button id="galaxy-detail-focus" style="
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.08);
            color: var(--color-text-primary, #ffffff);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: var(--radius-lg, 12px);
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s ease;
          ">Center</button>

          ${node.type === 'album' || node.type === 'artist' ? `
            <button id="galaxy-detail-open" style="
              padding: 10px 14px;
              background: rgba(255, 255, 255, 0.05);
              color: var(--color-text-secondary, #94a3b8);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: var(--radius-lg, 12px);
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s ease;
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
