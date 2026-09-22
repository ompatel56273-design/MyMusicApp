import type { ILyricsService, IPlaybackManager } from '../../../services/contracts/service-contracts';
import type { Track, Lyrics, LyricLine } from '../../../domain/entities/models';
import type { EventBus } from '../../../core/events/event-bus';
import { DomainEvents, type PlaybackTimeUpdatedEvent, type TrackChangedEvent } from '../../../domain/events/domain-events';
import type { Disposable } from '../../../core/types/common';

export interface LyricsViewDependencies {
  lyricsService?: ILyricsService | undefined;
  playbackManager: IPlaybackManager;
  eventBus: EventBus;
}

export class LyricsViewComponent {
  private container: HTMLElement | null = null;
  private readonly lyricsService?: ILyricsService | undefined;
  private readonly playbackManager: IPlaybackManager;
  private readonly eventBus: EventBus;

  private currentTrack: Track | null = null;
  private currentLyrics: Lyrics | null = null;
  private activeCueIndex = -1;
  private subscriptions: Disposable[] = [];
  private isUserScrolling = false;
  private userScrollTimeout: any = null;

  constructor(deps: LyricsViewDependencies) {
    this.lyricsService = deps.lyricsService;
    this.playbackManager = deps.playbackManager;
    this.eventBus = deps.eventBus;
  }

  public mount(container: HTMLElement, track: Track | null): void {
    this.container = container;
    this.currentTrack = track;
    this.activeCueIndex = -1;

    this.subscribeEvents();
    void this.loadAndRenderLyrics();
  }

  public unmount(): void {
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
    this.subscriptions = [];

    if (this.userScrollTimeout) {
      clearTimeout(this.userScrollTimeout);
      this.userScrollTimeout = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.currentLyrics = null;
  }

  public setTrack(track: Track | null): void {
    if (this.currentTrack?.id === track?.id) return;
    this.currentTrack = track;
    this.activeCueIndex = -1;
    void this.loadAndRenderLyrics();
  }

  private subscribeEvents(): void {
    // Time update subscription for sync
    this.subscriptions.push(
      this.eventBus.subscribe<PlaybackTimeUpdatedEvent>(
        DomainEvents.PLAYBACK_TIME_UPDATED,
        e => {
          this.syncToTime(e.positionMs);
        }
      )
    );

    // Track change subscription
    this.subscriptions.push(
      this.eventBus.subscribe<TrackChangedEvent>(
        DomainEvents.TRACK_CHANGED,
        e => {
          this.setTrack(e.currentTrack);
        }
      )
    );
  }

  private async loadAndRenderLyrics(): Promise<void> {
    if (!this.container) return;

    if (!this.currentTrack) {
      this.renderEmptyState('No Track Playing', 'Select a track to view lyrics.');
      return;
    }

    this.renderLoadingState();

    if (!this.lyricsService) {
      this.renderEmptyState('No Lyrics Available', 'Lyrics service is not available.');
      return;
    }

    const lyrics = await this.lyricsService.getLyrics(this.currentTrack.id);
    if (!this.container) return;

    this.currentLyrics = lyrics;

    if (!lyrics || (!lyrics.plainText.trim() && lyrics.lines.length === 0)) {
      this.renderEmptyState(
        'No Lyrics Available',
        `No lyrics found for "${this.currentTrack.title}".`
      );
      return;
    }

    if (lyrics.type === 'synced' && lyrics.lines.length > 0) {
      this.renderSyncedLyrics(lyrics);
      this.syncToTime(this.playbackManager.positionMs);
    } else {
      this.renderPlainLyrics(lyrics);
    }
  }

  private renderLoadingState(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="glass-panel" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); border-radius: var(--radius-xl); color: var(--color-text-muted); box-sizing: border-box;">
        <div style="font-size: 32px; margin-bottom: var(--space-3); animation: pulse 1.5s infinite;">♫</div>
        <p style="font-size: 14px; margin: 0;">Loading lyrics...</p>
      </div>
    `;
  }

  private renderEmptyState(title: string, message: string): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="glass-panel lyrics-empty-state" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); border-radius: var(--radius-xl); text-align: center; color: var(--color-text-muted); box-sizing: border-box;">
        <div style="font-size: 40px; margin-bottom: var(--space-3); opacity: 0.4;">📜</div>
        <h3 style="font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 var(--space-1) 0;">
          ${title}
        </h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin: 0 0 var(--space-4) 0; max-width: 320px;">
          ${message}
        </p>
        <button
          class="add-lyrics-btn"
          style="display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease;"
        >
          + Add Lyrics (LRC)
        </button>
      </div>
    `;

    const addBtn = this.container.querySelector('.add-lyrics-btn');
    addBtn?.addEventListener('click', () => {
      this.promptAddLyrics();
    });
  }

  private renderPlainLyrics(lyrics: Lyrics): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="glass-panel lyrics-plain-container" style="height: 100%; overflow-y: auto; padding: var(--space-8) var(--space-6); border-radius: var(--radius-xl); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: var(--space-3);">
          <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted);">
            Plain Text Lyrics
          </span>
          <button class="edit-lyrics-btn" style="background: transparent; border: none; font-size: 12px; color: var(--color-accent-primary); cursor: pointer;">
            Edit
          </button>
        </div>
        <div class="plain-lyrics-content" style="font-size: 16px; line-height: 2; color: var(--color-text-primary); white-space: pre-wrap; font-family: var(--font-family-base, sans-serif); text-align: center;"></div>
      </div>
    `;

    const contentEl = this.container.querySelector<HTMLElement>('.plain-lyrics-content');
    if (contentEl) {
      // Safe text rendering to prevent XSS
      contentEl.textContent = lyrics.plainText;
    }

    this.container.querySelector('.edit-lyrics-btn')?.addEventListener('click', () => {
      this.promptAddLyrics(lyrics.plainText);
    });
  }

  private renderSyncedLyrics(lyrics: Lyrics): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="glass-panel lyrics-synced-container" style="height: 100%; overflow-y: auto; padding: var(--space-8) var(--space-6); border-radius: var(--radius-xl); box-sizing: border-box; scroll-behavior: smooth; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: var(--space-3);">
          <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-accent-primary);">
            Synchronized Lyrics
          </span>
          <button class="edit-lyrics-btn" style="background: transparent; border: none; font-size: 12px; color: var(--color-text-muted); cursor: pointer;">
            Edit LRC
          </button>
        </div>
        <div class="cues-list" style="display: flex; flex-direction: column; gap: var(--space-4); padding: 40px 0; text-align: center;"></div>
      </div>
    `;

    const cuesList = this.container.querySelector<HTMLElement>('.cues-list');
    const scrollContainer = this.container.querySelector<HTMLElement>('.lyrics-synced-container');

    if (scrollContainer) {
      scrollContainer.addEventListener('wheel', () => this.handleUserScroll(), { passive: true });
      scrollContainer.addEventListener('touchstart', () => this.handleUserScroll(), { passive: true });
    }

    if (cuesList) {
      lyrics.lines.forEach((cue: LyricLine, index: number) => {
        const cueEl = document.createElement('div');
        cueEl.className = `lyric-cue lyric-cue-${index}`;
        cueEl.setAttribute('data-cue-index', index.toString());
        cueEl.setAttribute('role', 'button');
        cueEl.setAttribute('tabindex', '0');
        cueEl.setAttribute('aria-label', `Jump to ${cue.text || 'instrumental'}`);

        cueEl.style.fontSize = '18px';
        cueEl.style.fontWeight = '500';
        cueEl.style.lineHeight = '1.6';
        cueEl.style.color = 'var(--color-text-muted)';
        cueEl.style.opacity = '0.35';
        cueEl.style.cursor = 'pointer';
        cueEl.style.transition = 'all 0.25s ease';
        cueEl.style.padding = 'var(--space-2) var(--space-4)';
        cueEl.style.borderRadius = 'var(--radius-md)';

        // Safe text rendering
        cueEl.textContent = cue.text || '♫';

        // Hover effect
        cueEl.addEventListener('mouseenter', () => {
          if (this.activeCueIndex !== index) {
            cueEl.style.opacity = '0.7';
          }
        });
        cueEl.addEventListener('mouseleave', () => {
          if (this.activeCueIndex !== index) {
            cueEl.style.opacity = '0.35';
          }
        });

        // Click to seek
        cueEl.addEventListener('click', () => {
          void this.playbackManager.seek(cue.timeMs);
        });

        cuesList.appendChild(cueEl);
      });
    }

    this.container.querySelector('.edit-lyrics-btn')?.addEventListener('click', () => {
      this.promptAddLyrics(lyrics.plainText);
    });
  }

  private handleUserScroll(): void {
    this.isUserScrolling = true;
    if (this.userScrollTimeout) clearTimeout(this.userScrollTimeout);
    this.userScrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 3000);
  }

  private syncToTime(positionMs: number): void {
    if (!this.container || !this.currentLyrics || this.currentLyrics.type !== 'synced') return;

    const lines = this.currentLyrics.lines;
    if (lines.length === 0) return;

    // Find active cue: highest index where line.timeMs <= positionMs
    let newActiveIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.timeMs <= positionMs) {
        newActiveIndex = i;
      } else {
        break;
      }
    }

    if (newActiveIndex === this.activeCueIndex) return;
    this.activeCueIndex = newActiveIndex;

    // Update DOM cue elements
    const allCues = this.container.querySelectorAll<HTMLElement>('.lyric-cue');
    allCues.forEach((el, index) => {
      if (index === this.activeCueIndex) {
        el.classList.add('active-cue');
        el.style.color = 'var(--color-text-primary, #ffffff)';
        el.style.opacity = '1';
        el.style.fontWeight = '700';
        el.style.fontSize = '21px';
        el.style.transform = 'scale(1.04)';
        el.style.textShadow = '0 0 16px rgba(255, 120, 50, 0.4)';

        // Auto-scroll into center if user is not actively manually scrolling
        if (!this.isUserScrolling) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        el.classList.remove('active-cue');
        el.style.color = 'var(--color-text-muted)';
        el.style.opacity = '0.35';
        el.style.fontWeight = '500';
        el.style.fontSize = '18px';
        el.style.transform = 'scale(1)';
        el.style.textShadow = 'none';
      }
    });
  }

  private promptAddLyrics(existingContent = ''): void {
    if (!this.currentTrack || !this.lyricsService) return;

    const input = window.prompt(
      `Paste LRC or Plain Lyrics for "${this.currentTrack.title}":`,
      existingContent
    );

    if (input !== null && input.trim()) {
      const parsed = this.lyricsService.parseLrc(input, this.currentTrack.id);
      void this.lyricsService.saveLyrics(parsed).then(() => {
        void this.loadAndRenderLyrics();
      });
    }
  }
}
