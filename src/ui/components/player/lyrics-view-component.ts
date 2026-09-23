import type { ILyricsService, IPlaybackManager } from '../../../services/contracts/service-contracts';
import type { Track, Lyrics, LyricLine } from '../../../domain/entities/models';
import type { EventBus } from '../../../core/events/event-bus';
import { DomainEvents, type PlaybackTimeUpdatedEvent, type TrackChangedEvent } from '../../../domain/events/domain-events';
import type { Disposable } from '../../../core/types/common';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface LyricsViewDependencies {
  lyricsService?: ILyricsService | undefined;
  playbackManager: IPlaybackManager;
  eventBus: EventBus;
}

/**
 * Phase 8 Synced Lyrics View Component (Template 7).
 * Features:
 * - Real-time synchronization to playback time
 * - Glowing active lyric cue highlighting
 * - Auto-scroll to current lyric line
 * - Click-to-seek on any synced lyric line
 * - Graceful plain lyrics and empty states
 */
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
      this.renderEmptyState('No Lyrics Available', `No lyrics found for "${this.currentTrack.title}".`);
      return;
    }

    try {
      const lyrics = await this.lyricsService.getLyrics(this.currentTrack.id);
      this.currentLyrics = lyrics;

      if (!lyrics) {
        this.renderEmptyState('No Lyrics Available', `No lyrics found for "${this.currentTrack.title}".`);
        return;
      }

      this.renderLyrics(lyrics);
      this.syncToTime(this.playbackManager.positionMs);
    } catch (_err) {
      this.renderEmptyState('Unable to Load Lyrics', 'An error occurred while fetching lyrics.');
    }
  }

  private renderLoadingState(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="glass-panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 380px; padding: var(--space-8); border-radius: var(--radius-2xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); box-sizing: border-box;">
        <span style="color: var(--color-accent-purple-glow); display: flex; margin-bottom: 12px;">
          ${getIconSvg('sound-wave', { size: 36 })}
        </span>
        <p style="font-size: var(--font-size-sm); color: #ffffff; font-weight: var(--font-weight-bold); margin: 0 0 4px 0;">Loading Lyrics...</p>
      </div>
    `;
  }

  private renderEmptyState(title: string, msg: string): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="glass-panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 380px; padding: var(--space-8); border-radius: var(--radius-2xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); box-sizing: border-box;">
        <span style="color: var(--color-text-muted); display: flex; margin-bottom: 12px; opacity: 0.6;">
          ${getIconSvg('mic', { size: 36 })}
        </span>
        <h3 style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: #ffffff; margin: 0 0 4px 0;">${title}</h3>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0; max-width: 320px; line-height: 1.5;">${msg}</p>
      </div>
    `;
  }

  private renderLyrics(lyrics: Lyrics): void {
    if (!this.container) return;

    const isSynced = lyrics.type === 'synced' && lyrics.lines && lyrics.lines.length > 0;

    this.container.innerHTML = `
      <div
        class="glass-panel lyrics-container"
        style="
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 380px;
          border-radius: var(--radius-2xl);
          padding: var(--space-6) var(--space-5);
          box-sizing: border-box;
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(16px);
          position: relative;
          overflow: hidden;
          width: 100%;
        "
      >
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: var(--space-3); margin-bottom: var(--space-4);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('mic', { size: 16 })}
            </span>
            <span style="font-size: 11px; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff;">
              ${isSynced ? 'Synchronized Lyrics' : 'Lyrics'}
            </span>
          </div>
          ${
            isSynced
              ? `<span style="font-size: 10px; font-weight: var(--font-weight-extrabold); letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: var(--radius-full); background: rgba(124, 58, 237, 0.2); color: var(--color-accent-cyan); border: 1px solid var(--glass-border-interactive);">LIVE SYNC</span>`
              : ''
          }
        </div>

        <!-- Lyrics Scroll Content -->
        <div
          id="lyrics-scroll-body"
          style="
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
            padding: var(--space-4) 0;
            scrollbar-width: none;
            text-align: center;
            position: relative;
          "
        >
          ${
            isSynced
              ? lyrics.lines
                  .map(
                    (line: LyricLine, idx: number) =>
                      `<p class="lyric-cue lyric-cue-line" tabindex="0" role="button" aria-label="Seek to lyric: ${escapeHtml(line.text || 'line')}" data-cue-index="${idx}" data-start-time="${line.timeMs}" style="font-size: clamp(15px, 2vw, 19px); font-weight: var(--font-weight-bold); color: rgba(255, 255, 255, 0.4); margin: 0; padding: 10px 16px; border-radius: var(--radius-lg); cursor: pointer; transition: all 0.25s var(--ease-smooth); line-height: 1.45; user-select: none; outline: none;">${escapeHtml(line.text || '•••')}</p>`
                  )
                  .join('')
              : `
              <div class="plain-lyrics-content" style="font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.8; white-space: pre-wrap; text-align: left; padding: 0 var(--space-3);">
                ${escapeHtml(lyrics.plainText || '')}
              </div>
            `
          }
        </div>

        <!-- Resume Auto-Sync Floating Pill (shown on manual scroll) -->
        <button
          id="lyrics-resume-sync-btn"
          aria-label="Resume auto-scrolling to active lyric"
          style="
            display: none;
            position: absolute;
            bottom: var(--space-4);
            left: 50%;
            transform: translateX(-50%);
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%);
            color: #ffffff;
            font-size: 11px;
            font-weight: var(--font-weight-bold);
            border-radius: var(--radius-full);
            border: 1px solid var(--glass-border-interactive);
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(124, 58, 237, 0.5);
            z-index: 10;
            transition: all var(--duration-fast) var(--ease-smooth);
          "
        >
          <span style="display: flex;">${getIconSvg('sound-wave', { size: 12, color: '#ffffff' })}</span>
          <span>Resume Sync</span>
        </button>
      </div>
    `;

    const scrollBody = this.container.querySelector<HTMLElement>('#lyrics-scroll-body');
    const resumeBtn = this.container.querySelector<HTMLButtonElement>('#lyrics-resume-sync-btn');

    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        this.isUserScrolling = false;
        resumeBtn.style.display = 'none';
        const activeEl = this.container?.querySelector<HTMLElement>('.active-cue');
        activeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    if (scrollBody) {
      const handleUserScroll = () => {
        this.isUserScrolling = true;
        if (resumeBtn && isSynced) {
          resumeBtn.style.display = 'inline-flex';
        }
        if (this.userScrollTimeout) clearTimeout(this.userScrollTimeout);
        this.userScrollTimeout = setTimeout(() => {
          this.isUserScrolling = false;
          if (resumeBtn) resumeBtn.style.display = 'none';
        }, 5000);
      };

      scrollBody.addEventListener('wheel', handleUserScroll, { passive: true });
      scrollBody.addEventListener('touchmove', handleUserScroll, { passive: true });

      // Click & Keyboard to seek
      scrollBody.querySelectorAll<HTMLElement>('.lyric-cue-line').forEach(lineEl => {
        const seekAction = () => {
          const timeMs = Number(lineEl.getAttribute('data-start-time'));
          if (!isNaN(timeMs)) {
            void this.playbackManager.seek(timeMs);
          }
        };

        lineEl.addEventListener('click', seekAction);
        lineEl.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            seekAction();
          }
        });
      });
    }
  }

  private syncToTime(positionMs: number): void {
    if (!this.container || this.currentLyrics?.type !== 'synced' || !this.currentLyrics.lines) return;

    const lines = this.currentLyrics.lines;
    let activeIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (positionMs >= lines[i]!.timeMs) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx === this.activeCueIndex) return;
    this.activeCueIndex = activeIdx;

    const cueElements = this.container.querySelectorAll<HTMLElement>('.lyric-cue-line');
    cueElements.forEach((el, idx) => {
      if (idx === activeIdx) {
        el.classList.add('active-cue');
        el.style.color = '#ffffff';
        el.style.transform = 'scale(1.04)';
        el.style.textShadow = '0 0 16px rgba(124, 58, 237, 0.8), 0 0 8px rgba(6, 182, 212, 0.6)';
        el.style.background = 'rgba(255, 255, 255, 0.06)';
        el.style.border = '1px solid var(--glass-border-interactive)';

        if (!this.isUserScrolling) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        el.classList.remove('active-cue');
        el.style.color = 'rgba(255, 255, 255, 0.35)';
        el.style.transform = 'none';
        el.style.textShadow = 'none';
        el.style.background = 'transparent';
        el.style.border = '1px solid transparent';
      }
    });
  }
}
