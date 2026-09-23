import type { Track } from '../../../domain/entities/models';
import type { IArtworkService, IPlaybackManager } from '../../../services/contracts/service-contracts';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface TrackInspectorDependencies {
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
}

/**
 * Desktop Template 3 Right Inspector & Up Next Panel Component.
 * Displays real technical audio specifications and live queue for the selected/active track.
 */
export class TrackInspectorComponent {
  private container: HTMLElement | null = null;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private selectedTrack: Track | null = null;

  constructor(deps: TrackInspectorDependencies) {
    this.playbackManager = deps.playbackManager;
    this.artworkService = deps.artworkService;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public inspectTrack(track: Track | null): void {
    this.selectedTrack = track;
    this.render();
  }

  public updateQueue(): void {
    const queueListEl = this.container?.querySelector('#inspector-queue-list');
    if (queueListEl) {
      queueListEl.innerHTML = this.renderQueueItems();
      this.bindQueueEvents();
    }
  }

  private render(): void {
    if (!this.container) return;

    const track = this.selectedTrack || this.playbackManager?.currentTrack || null;

    this.container.innerHTML = `
      <aside
        class="library-inspector-panel"
        aria-label="Track Inspector"
        style="
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        "
      >
        <!-- 1. Track Inspector Details Card (Template 3) -->
        <div
          class="glass-panel"
          style="
            border-radius: var(--radius-2xl);
            background: linear-gradient(135deg, rgba(30, 20, 68, 0.65) 0%, rgba(15, 23, 42, 0.85) 100%);
            border: 1px solid var(--glass-border);
            padding: var(--space-5);
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
            box-shadow: var(--shadow-elevation-medium);
            box-sizing: border-box;
          "
        >
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-accent-cyan); text-transform: uppercase; letter-spacing: 0.08em;">
              ${getIconSvg('info', { size: 14, color: 'var(--color-accent-cyan)' })}
              <span>Track Inspector</span>
            </div>
            ${track?.format?.isLossless ? `
              <span style="font-size: 10px; font-weight: var(--font-weight-extrabold); color: #ffffff; background: linear-gradient(135deg, var(--color-accent-purple), var(--color-accent-pink)); padding: 2px 8px; border-radius: var(--radius-full); box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);">
                LOSSLESS
              </span>
            ` : ''}
          </div>

          ${track ? this.renderTrackDetails(track) : this.renderNoTrackSelected()}
        </div>

        <!-- 2. Up Next Queue Panel (Template 3) -->
        <div
          class="glass-panel"
          style="
            border-radius: var(--radius-2xl);
            background: var(--glass-bg-subtle);
            border: 1px solid var(--glass-border);
            padding: var(--space-5);
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
            box-sizing: border-box;
          "
        >
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; text-transform: uppercase; letter-spacing: 0.08em;">
              ${getIconSvg('now-playing', { size: 14, color: 'var(--color-accent-purple-glow)' })}
              <span>Up Next</span>
            </div>
            <button id="inspector-clear-queue-btn" style="background: transparent; border: none; color: var(--color-text-muted); font-size: 11px; cursor: pointer; padding: 2px 6px;">
              Clear
            </button>
          </div>

          <div id="inspector-queue-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; overscroll-behavior-y: contain;">
            ${this.renderQueueItems()}
          </div>
        </div>
      </aside>
    `;

    this.loadArtwork(track);
    this.bindQueueEvents();
  }

  private renderTrackDetails(track: Track): string {
    const fmt = track.format || { container: 'Audio', isLossless: false };
    const sampleRateStr = fmt.sampleRate ? `${(fmt.sampleRate / 1000).toFixed(1)} kHz` : 'Standard';
    const bitDepthStr = fmt.bitDepth ? `${fmt.bitDepth}-bit` : (fmt.isLossless ? '16/24-bit' : '16-bit');
    const channelsStr = fmt.channels === 1 ? 'Mono 1.0' : (fmt.channels === 2 ? 'Stereo 2.0' : `${fmt.channels ?? 2} Ch`);
    const bitrateStr = fmt.bitrate ? `${Math.round(fmt.bitrate)} kbps` : (fmt.isLossless ? 'Lossless VBR' : '320 kbps');
    const fileSizeStr = (track as any).fileSize ? `${((track as any).fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Local storage';

    return `
      <div style="display: flex; gap: var(--space-3); align-items: center;">
        <div id="inspector-artwork-slot" style="width: 64px; height: 64px; border-radius: var(--radius-md); background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border: 1px solid var(--glass-border);">
          <span style="color: var(--color-text-muted);">${getIconSvg('music', { size: 28 })}</span>
        </div>
        <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
          <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(track.title)}">
            ${escapeHtml(track.title)}
          </span>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;" title="${escapeHtml(track.artistName ?? 'Unknown Artist')}">
            ${escapeHtml(track.artistName ?? 'Unknown Artist')}
          </span>
          <span style="font-size: 11px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;" title="${escapeHtml(track.albumTitle ?? 'Unknown Album')}">
            ${escapeHtml(track.albumTitle ?? 'Unknown Album')}
          </span>
        </div>
      </div>

      <!-- Technical Audio Specifications Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: var(--space-2); background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-lg); padding: var(--space-3); border: 1px solid rgba(255, 255, 255, 0.05);">
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 10px; color: var(--color-text-muted); text-transform: uppercase;">Format / Codec</span>
          <span style="font-size: 12px; font-weight: var(--font-weight-semibold); color: #ffffff;">${(fmt.container || 'AUDIO').toUpperCase()} / ${(fmt.codec || 'Native').toUpperCase()}</span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 10px; color: var(--color-text-muted); text-transform: uppercase;">Sample Rate</span>
          <span style="font-size: 12px; font-weight: var(--font-weight-semibold); color: var(--color-accent-cyan);">${sampleRateStr}</span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 10px; color: var(--color-text-muted); text-transform: uppercase;">Bit Depth</span>
          <span style="font-size: 12px; font-weight: var(--font-weight-semibold); color: #ffffff;">${bitDepthStr}</span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 10px; color: var(--color-text-muted); text-transform: uppercase;">Channels</span>
          <span style="font-size: 12px; font-weight: var(--font-weight-semibold); color: #ffffff;">${channelsStr}</span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 10px; color: var(--color-text-muted); text-transform: uppercase;">Bitrate</span>
          <span style="font-size: 12px; font-weight: var(--font-weight-semibold); color: #ffffff;">${bitrateStr}</span>
        </div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 10px; color: var(--color-text-muted); text-transform: uppercase;">Storage</span>
          <span style="font-size: 12px; font-weight: var(--font-weight-semibold); color: #ffffff;">${fileSizeStr}</span>
        </div>
      </div>
    `;
  }

  private renderNoTrackSelected(): string {
    return `
      <div style="padding: var(--space-4) 0; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-xs);">
        Select or play any track in your library to inspect lossless audio bitrates, sample rates, and format codecs.
      </div>
    `;
  }

  private renderQueueItems(): string {
    const queue = this.playbackManager?.queue ?? [];
    const currentIndex = this.playbackManager?.currentQueueIndex ?? -1;

    if (queue.length === 0) {
      return `<div style="font-size: var(--font-size-xs); color: var(--color-text-muted); padding: 12px 0; text-align: center;">Queue is empty.</div>`;
    }

    return queue
      .slice(0, 6)
      .map((item, idx) => {
        const isCurrent = idx === currentIndex;
        const track: any = (item as any).track || item;
        const title = track?.title || `Track ${idx + 1}`;
        const artist = track?.artistName || 'In queue';
        const durationFormatted = track?.durationMs ? this.formatDuration(track.durationMs) : '--:--';

        return `
          <div class="inspector-queue-row" data-queue-index="${idx}" style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius-md); background: ${isCurrent ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.02)'}; border: 1px solid ${isCurrent ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.04)'}; cursor: pointer; transition: all var(--duration-fast) var(--ease-smooth);">
            <span style="font-size: 11px; font-weight: var(--font-weight-bold); color: ${isCurrent ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)'}; width: 14px; text-align: center;">
              ${idx + 1}
            </span>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: ${isCurrent ? 'var(--color-accent-cyan)' : '#ffffff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(title)}
              </span>
              <span style="font-size: 10px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(artist)}
              </span>
            </div>
            <span style="font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums;">
              ${durationFormatted}
            </span>
            ${isCurrent ? `<span style="color: var(--color-accent-cyan); display: flex;">${getIconSvg('audio-bars', { size: 12 })}</span>` : ''}
          </div>
        `;
      })
      .join('');
  }

  private loadArtwork(track: Track | null): void {
    if (!track || !this.artworkService || !this.container) return;
    const artId = (track as any).artworkId || track.albumId;
    if (artId) {
      void this.artworkService.getArtworkUrl(artId, 'medium').then(url => {
        if (!url || !this.container) return;
        const artSlot = this.container.querySelector('#inspector-artwork-slot');
        if (artSlot) {
          artSlot.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }
  }

  private bindQueueEvents(): void {
    if (!this.container) return;

    this.container.querySelector('#inspector-clear-queue-btn')?.addEventListener('click', () => {
      if (this.playbackManager) {
        void this.playbackManager.clearQueue();
        this.updateQueue();
      }
    });

    this.container.querySelectorAll<HTMLElement>('.inspector-queue-row').forEach(row => {
      row.addEventListener('click', () => {
        const qIdx = Number(row.getAttribute('data-queue-index'));
        if (this.playbackManager && this.playbackManager.queue.length > qIdx) {
          void this.playbackManager.playQueueIndex(qIdx);
        }
      });
    });
  }

  private formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
