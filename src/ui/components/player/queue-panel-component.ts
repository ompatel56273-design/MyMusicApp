import type { Track } from '../../../domain/entities/models';
import type { IPlaybackManager, IArtworkService } from '../../../services/contracts/service-contracts';
import { QueueItemComponent } from './queue-item-component';

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
      // If direct queue tracks are accessible
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
          max-height: calc(100vh - 180px);
          border-radius: var(--radius-xl);
          padding: var(--space-5);
          box-sizing: border-box;
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        "
      >
        <!-- Queue Header -->
        <header
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: var(--space-4);
            border-bottom: 1px solid var(--glass-border);
            margin-bottom: var(--space-3);
          "
        >
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <h3 style="font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--color-text-primary); margin: 0;">
              Up Next
            </h3>
            <span
              style="
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: var(--radius-full);
                background: rgba(168, 85, 247, 0.15);
                color: var(--color-accent-primary);
                border: 1px solid rgba(168, 85, 247, 0.3);
              "
            >
              ${count}
            </span>
            ${totalDurationMs > 0 ? `
              <span style="font-size: 12px; color: var(--color-text-muted);">
                • ${durationStr}
              </span>
            ` : ''}
          </div>

          <button
            id="queue-clear-btn"
            aria-label="Clear play queue"
            ${count === 0 ? 'disabled' : ''}
            style="
              background: ${count === 0 ? 'transparent' : 'rgba(239, 68, 68, 0.1)'};
              border: 1px solid ${count === 0 ? 'transparent' : 'rgba(239, 68, 68, 0.25)'};
              color: ${count === 0 ? 'var(--color-text-muted)' : '#f87171'};
              padding: 6px 14px;
              border-radius: var(--radius-full);
              font-size: 12px;
              font-weight: 600;
              cursor: ${count === 0 ? 'default' : 'pointer'};
              opacity: ${count === 0 ? '0.4' : '1'};
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            Clear
          </button>
        </header>

        <!-- Queue Items List -->
        <div
          id="queue-items-viewport"
          role="list"
          style="
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding-right: 2px;
          "
        ></div>
      </section>
    `;

    this.bindHeaderEvents();
    this.renderItems();
  }

  private bindHeaderEvents(): void {
    if (!this.container) return;
    const clearBtn = this.container.querySelector('#queue-clear-btn');
    clearBtn?.addEventListener('click', () => {
      void this.playbackManager.clearQueue();
    });
  }

  private renderItems(): void {
    if (!this.container) return;
    const listEl = this.container.querySelector('#queue-items-viewport');
    if (!listEl) return;

    if (this.queueTracks.length === 0) {
      listEl.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          <span style="font-size: 32px; margin-bottom: var(--space-2); opacity: 0.6;">🎵</span>
          <p style="font-size: 14px; font-weight: 500; margin-bottom: var(--space-1); color: var(--color-text-secondary);">Queue is empty</p>
          <p style="font-size: 12px; margin: 0;">Play songs from your library to build a queue.</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    const totalCount = this.queueTracks.length;

    this.queueTracks.forEach((track, index) => {
      const isActive = index === this.activeIndex;
      const itemEl = QueueItemComponent.create(
        track,
        index,
        isActive,
        totalCount,
        {
          onPlay: idx => void this.playbackManager.playQueueIndex(idx),
          onRemove: idx => void this.playbackManager.removeFromQueue(idx),
          onMoveUp: idx => void this.playbackManager.reorderQueue(idx, Math.max(0, idx - 1)),
          onMoveDown: idx => void this.playbackManager.reorderQueue(idx, Math.min(totalCount - 1, idx + 1))
        },
        this.artworkService
      );
      fragment.appendChild(itemEl);
    });

    listEl.innerHTML = '';
    listEl.appendChild(fragment);
  }

  private formatTotalDuration(ms: number): string {
    if (!ms || isNaN(ms) || ms <= 0) return '0 min';
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin} min`;
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hrs} hr ${mins} min`;
  }
}
