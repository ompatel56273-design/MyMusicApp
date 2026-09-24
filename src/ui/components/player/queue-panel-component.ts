import type { Track } from '../../../domain/entities/models';
import type { IPlaybackManager, IArtworkService } from '../../../services/contracts/service-contracts';
import { QueueItemComponent } from './queue-item-component';
import { getIconSvg } from '../../icons/icon-registry';

/**
 * Phase 8 Queue Panel Component (Templates 6 & 7 / Up Next Panel).
 * Features:
 * - Real-time queue consumption from PlaybackManager
 * - Live track status, active playback equalizer indicator
 * - Clear queue & remove item actions
 */
export class QueuePanelComponent {
  private container: HTMLElement | null = null;
  private readonly playbackManager: IPlaybackManager;
  private readonly artworkService?: IArtworkService | undefined;

  private queueTracks: readonly Track[] = [];
  private activeIndex = -1;

  constructor(playbackManager: IPlaybackManager, artworkService?: IArtworkService) {
    this.playbackManager = playbackManager;
    this.artworkService = artworkService;
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    this.refreshQueueState();
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateQueue(): void {
    this.refreshQueueState();
    this.render();
  }

  private refreshQueueState(): void {
    this.activeIndex = this.playbackManager.currentQueueIndex;

    // Resolve tracks from QueueItem context or active track
    if ('getTracks' in (this.playbackManager as any)) {
      this.queueTracks = (this.playbackManager as any).getTracks?.() ?? [];
    } else if (this.playbackManager.currentTrack) {
      this.queueTracks = (this.playbackManager as any).queueManager?.getTracks?.() ?? [this.playbackManager.currentTrack];
    } else {
      this.queueTracks = [];
    }
  }

  private render(): void {
    if (!this.container) return;

    const count = this.queueTracks.length;
    const totalDurationMs = this.queueTracks.reduce((acc, t) => acc + (t.durationMs || 0), 0);
    const durationStr = this.formatTotalDuration(totalDurationMs);

    this.container.innerHTML = `
      <section
        class="queue-panel glass-panel"
        role="region"
        aria-label="Playback Queue"
        style="
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 380px;
          border-radius: var(--radius-2xl);
          padding: var(--space-5);
          box-sizing: border-box;
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(16px);
          width: 100%;
        "
      >
        <!-- Queue Header -->
        <header
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: var(--space-3);
            border-bottom: 1px solid var(--glass-border);
            margin-bottom: var(--space-3);
          "
        >
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--color-accent-purple-glow); display: flex;">
                ${getIconSvg('list', { size: 16 })}
              </span>
              <h3 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); letter-spacing: -0.01em; color: #ffffff; margin: 0;">
                Up Next
              </h3>
            </div>
            <span
              style="
                font-size: 10px;
                font-weight: var(--font-weight-extrabold);
                padding: 2px 8px;
                border-radius: var(--radius-full);
                background: rgba(124, 58, 237, 0.2);
                color: var(--color-accent-cyan);
                border: 1px solid var(--glass-border-interactive);
              "
            >
              ${count} ${count === 1 ? 'song' : 'songs'}
            </span>
          </div>

          ${
            count > 1
              ? `
            <button
              id="queue-clear-btn"
              aria-label="Clear upcoming queue"
              style="
                background: transparent;
                border: none;
                color: var(--color-text-muted);
                font-size: 11px;
                font-weight: var(--font-weight-semibold);
                cursor: pointer;
                padding: 4px 8px;
                border-radius: var(--radius-md);
                transition: color var(--duration-fast);
              "
            >
              Clear
            </button>
          `
              : ''
          }
        </header>

        <!-- Queue Items List -->
        <div
          id="qp-items-list"
          style="
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-right: 4px;
          "
        ></div>

        <!-- Footer -->
        <footer
          style="
            margin-top: auto;
            padding-top: var(--space-3);
            border-top: 1px solid var(--glass-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: var(--color-text-muted);
          "
        >
          <span>Queue Runtime:</span>
          <span style="font-weight: var(--font-weight-bold); color: #ffffff;">${durationStr}</span>
        </footer>
      </section>
    `;

    const listEl = this.container.querySelector<HTMLElement>('#qp-items-list');
    if (!listEl) return;

    if (this.queueTracks.length === 0) {
      listEl.innerHTML = `
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--color-text-muted);
            padding: var(--space-6) 0;
          "
        >
          <span style="color: var(--color-text-muted); display: flex; margin-bottom: 8px;">
            ${getIconSvg('list', { size: 28 })}
          </span>
          <p style="font-size: var(--font-size-xs); margin: 0;">Queue is empty.</p>
        </div>
      `;
      return;
    }

    this.queueTracks.forEach((track, idx) => {
      const isCurrent = idx === this.activeIndex;
      const itemNode = QueueItemComponent.create(
        track,
        idx,
        isCurrent,
        this.queueTracks.length,
        {
          onPlay: i => {
            void this.playbackManager.playQueueIndex(i);
          },
          onRemove: async i => {
            if ('removeFromQueue' in this.playbackManager) {
              await this.playbackManager.removeFromQueue(i);
              this.updateQueue();
            }
          },
          onMoveUp: async i => {
            if (i > 0) {
              if ('moveQueueItemUp' in this.playbackManager) {
                await this.playbackManager.moveQueueItemUp(i);
              } else if ('reorderQueue' in this.playbackManager) {
                await (this.playbackManager as any).reorderQueue(i, i - 1);
              }
              this.updateQueue();
            }
          },
          onMoveDown: async i => {
            if (i < this.queueTracks.length - 1) {
              if ('moveQueueItemDown' in this.playbackManager) {
                await this.playbackManager.moveQueueItemDown(i);
              } else if ('reorderQueue' in this.playbackManager) {
                await (this.playbackManager as any).reorderQueue(i, i + 1);
              }
              this.updateQueue();
            }
          }
        },
        this.artworkService
      );

      listEl.appendChild(itemNode);
    });

    // Clear queue button
    const clearBtn = this.container.querySelector<HTMLButtonElement>('#queue-clear-btn');
    clearBtn?.addEventListener('click', async () => {
      if ('clearQueue' in this.playbackManager) {
        await this.playbackManager.clearQueue(true);
        this.updateQueue();
      }
    });
  }

  private formatTotalDuration(ms: number): string {
    if (!ms || ms <= 0) return '0 min';
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin} min`;
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hrs} hr ${mins} min`;
  }
}
