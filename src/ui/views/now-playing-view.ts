import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { RouterService } from '../navigation/router-service';
import type {
  IPlaybackManager,
  ILibraryService,
  IArtworkService,
  ILyricsService,
  IAudioEngine,
  IVisualizerService
} from '../../services/contracts/service-contracts';
import { EventBus } from '../../core/events/event-bus';
import {
  DomainEvents,
  type TrackChangedEvent,
  type PlaybackStateChangedEvent,
  type PlaybackTimeUpdatedEvent,
  type PlaybackModesChangedEvent,
  type QueueChangedEvent,
  type FavoriteChangedEvent
} from '../../domain/events/domain-events';
import type { Disposable } from '../../core/types/common';
import type { Track } from '../../domain/entities/models';
import { ArtworkViewComponent } from '../components/player/artwork-view-component';
import { PlayerControlsComponent } from '../components/player/player-controls-component';
import { QueuePanelComponent } from '../components/player/queue-panel-component';
import { LyricsViewComponent } from '../components/player/lyrics-view-component';
import { AudioInfoPanelComponent } from '../components/player/audio-info-panel-component';
import { escapeHtml } from '../../core/security/html-sanitizer';
import { getIconSvg, type IconName } from '../icons/icon-registry';

export type NowPlayingTab = 'queue' | 'lyrics' | 'info';

export interface NowPlayingViewDependencies {
  playbackManager: IPlaybackManager;
  libraryService?: ILibraryService | undefined;
  artworkService?: IArtworkService | undefined;
  lyricsService?: ILyricsService | undefined;
  audioEngine?: IAudioEngine | undefined;
  visualizerService?: IVisualizerService | undefined;
  router?: RouterService | undefined;
  eventBus: EventBus;
}

/**
 * Phase 8 Complete Visual Rebuild of Now Playing View (Templates 6 & 7).
 * Features:
 * - Authoritative Desktop, Tablet, and Mobile Templates 6 & 7 layouts
 * - Left Player Hero: Vinyl artwork presentation, ambient radial glows, track title, artist, album, format badge
 * - Center / Right Tabbed Experience: Up Next live queue, Synced Lyrics with live cue highlighting, Audio Technical info
 * - Smooth playback controls, progress seek bar, volume slider, favorite toggle
 * - Full reactivity with PlaybackManager events and zero duplicate clock logic
 */
export class NowPlayingView implements IView {
  private container: HTMLElement | null = null;
  private readonly playbackManager: IPlaybackManager;
  private readonly libraryService?: ILibraryService | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly lyricsService?: ILyricsService | undefined;
  private readonly audioEngine?: IAudioEngine | undefined;
  private readonly visualizerService?: IVisualizerService | undefined;
  private readonly router?: RouterService | undefined;
  private readonly eventBus: EventBus;

  private artworkComponent: ArtworkViewComponent | null = null;
  private controlsComponent: PlayerControlsComponent | null = null;
  private queueComponent: QueuePanelComponent | null = null;
  private lyricsComponent: LyricsViewComponent | null = null;
  private audioInfoComponent: AudioInfoPanelComponent | null = null;

  private activeTab: NowPlayingTab = 'queue';
  private subscriptions: Disposable[] = [];
  private currentTrack: Track | null = null;

  constructor(deps: NowPlayingViewDependencies) {
    this.playbackManager = deps.playbackManager;
    this.libraryService = deps.libraryService;
    this.artworkService = deps.artworkService;
    this.lyricsService = deps.lyricsService;
    this.audioEngine = deps.audioEngine;
    this.visualizerService = deps.visualizerService;
    this.router = deps.router;
    this.eventBus = deps.eventBus;
    void this.audioEngine;
    void this.visualizerService;
  }

  public mount(container: HTMLElement, _params?: RouteParams): void {
    this.container = container;
    this.currentTrack = this.playbackManager.currentTrack;

    this.render();
    this.subscribeToDomainEvents();
  }

  public unmount(): void {
    for (const sub of this.subscriptions) {
      sub.dispose();
    }
    this.subscriptions = [];

    if (this.artworkComponent) {
      this.artworkComponent.unmount();
      this.artworkComponent = null;
    }
    if (this.controlsComponent) {
      this.controlsComponent.unmount();
      this.controlsComponent = null;
    }
    if (this.queueComponent) {
      this.queueComponent.unmount();
      this.queueComponent = null;
    }
    if (this.lyricsComponent) {
      this.lyricsComponent.unmount();
      this.lyricsComponent = null;
    }
    if (this.audioInfoComponent) {
      this.audioInfoComponent.unmount();
      this.audioInfoComponent = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public updateParams(_params: RouteParams): void {}

  private render(): void {
    if (!this.container) return;

    if (!this.currentTrack) {
      this.renderEmptyState();
      return;
    }

    const t = this.currentTrack;
    const isHiRes = (t.format?.sampleRate && t.format.sampleRate > 48000) || (t.format?.bitDepth && t.format.bitDepth > 16);
    const formatBadge = isHiRes
      ? `<span style="font-size: 10px; font-weight: var(--font-weight-extrabold); letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 10px; border-radius: var(--radius-full); background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);">HI-RES • ${t.format?.bitDepth || 24}BIT ${(t.format?.sampleRate ? t.format.sampleRate / 1000 : 96).toFixed(0)}KHZ</span>`
      : t.format?.isLossless
      ? `<span style="font-size: 10px; font-weight: var(--font-weight-extrabold); letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 10px; border-radius: var(--radius-full); background: linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%); border: 1px solid rgba(6, 182, 212, 0.4); color: var(--color-accent-cyan); box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);">LOSSLESS • ${(t.format?.codec || 'FLAC').toUpperCase()}</span>`
      : `<span style="font-size: 10px; font-weight: var(--font-weight-bold); letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 10px; border-radius: var(--radius-full); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); color: var(--color-text-muted);">${(t.format?.codec || 'AUDIO').toUpperCase()}</span>`;

    const tabs: Array<{ id: NowPlayingTab; label: string; icon: IconName }> = [
      { id: 'queue', label: 'Up Next', icon: 'list' },
      { id: 'lyrics', label: 'Synced Lyrics', icon: 'mic' },
      { id: 'info', label: 'Audio Info', icon: 'info' }
    ];

    this.container.innerHTML = `
      <style>
        .now-playing-page {
          padding: var(--space-6) var(--space-8);
          max-width: 1720px;
          margin: 0 auto;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          width: 100%;
          min-width: 0;
          color: var(--color-text-primary);
          font-family: var(--font-family-base);
        }

        /* 2-Column Responsive Layout (Templates 6 & 7 Desktop) */
        .now-playing-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
          gap: var(--space-8);
          align-items: start;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .np-player-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .np-side-column {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
          height: 100%;
        }

        /* Tab Navigation Bar */
        .np-tab-bar {
          display: flex;
          gap: var(--space-2);
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }
        .np-tab-bar::-webkit-scrollbar {
          display: none;
        }

        .np-tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          white-space: nowrap;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-height: 40px;
          box-sizing: border-box;
        }

        /* Tablet Responsive (< 1200px) */
        @media (min-width: 768px) and (max-width: 1199px) {
          .now-playing-page {
            padding: var(--space-5) var(--space-6);
            gap: var(--space-4);
          }

          .now-playing-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-6);
          }
        }

        /* Mobile Responsive (< 768px) */
        @media (max-width: 767px) {
          .now-playing-page {
            padding: var(--space-4) var(--space-3) calc(var(--mini-player-height) + var(--bottom-nav-height) + var(--space-8)) var(--space-3);
            gap: var(--space-4);
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .now-playing-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-4);
          }
        }
      </style>

      <section class="now-playing-page" aria-label="Now Playing Fullscreen Player">
        <!-- Top Bar Navigation (Templates 6 & 7) -->
        <div
          class="np-header-bar"
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            margin-bottom: var(--space-2);
          "
        >
          <button
            id="np-back-btn"
            aria-label="Back to Library"
            style="
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 8px 16px;
              border-radius: var(--radius-full);
              background: var(--glass-bg-subtle);
              border: 1px solid var(--glass-border);
              color: var(--color-text-secondary);
              font-size: var(--font-size-xs);
              font-weight: var(--font-weight-semibold);
              cursor: pointer;
              transition: all var(--duration-fast) var(--ease-smooth);
            "
          >
            <span style="display: flex;">${getIconSvg('chevron-left', { size: 16 })}</span>
            <span>Back</span>
          </button>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">
              ${getIconSvg('now-playing', { size: 16 })}
            </span>
            <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-text-muted);">
              Now Playing
            </span>
          </div>

          <div style="width: 72px;"></div>
        </div>

        <!-- 2-Column Responsive Layout (Templates 6 & 7) -->
        <div class="now-playing-grid-layout">
          <!-- Left Column: Artwork Hero + Track Info + Controls -->
          <div class="np-player-column">
            <!-- 1. Artwork Hero -->
            <div id="np-artwork-slot" style="width: 100%; display: flex; justify-content: center;"></div>

            <!-- 2. Track Metadata Info -->
            <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; max-width: 480px;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                ${formatBadge}
              </div>
              <h1
                id="np-track-title"
                style="
                  font-size: clamp(22px, 3.5vw, 30px);
                  font-weight: var(--font-weight-extrabold);
                  letter-spacing: -0.02em;
                  color: #ffffff;
                  margin: 0;
                  line-height: 1.25;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  max-width: 100%;
                "
                title="${escapeHtml(t.title)}"
              >
                ${escapeHtml(t.title)}
              </h1>
              <h2
                id="np-track-artist"
                style="
                  font-size: clamp(14px, 2vw, 17px);
                  font-weight: var(--font-weight-semibold);
                  color: var(--color-accent-cyan);
                  margin: 0;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  max-width: 100%;
                "
                title="${escapeHtml(t.artistName ?? 'Unknown Artist')}"
              >
                ${escapeHtml(t.artistName ?? 'Unknown Artist')}
              </h2>
              ${
                t.albumTitle
                  ? `
                <span
                  id="np-track-album"
                  style="font-size: var(--font-size-xs); color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;"
                  title="${escapeHtml(t.albumTitle)}"
                >
                  ${escapeHtml(t.albumTitle)}
                </span>
              `
                  : ''
              }
            </div>

            <!-- 3. Player Controls Component -->
            <div id="np-controls-slot" style="width: 100%;"></div>
          </div>

          <!-- Right Column: Tabs (Up Next, Synced Lyrics, Audio Info) -->
          <div class="np-side-column">
            <!-- Tab Switcher -->
            <nav role="tablist" aria-label="Now Playing View Tabs" class="np-tab-bar">
              ${tabs
                .map(
                  tab => `
                <button
                  role="tab"
                  aria-selected="${this.activeTab === tab.id}"
                  data-tab="${tab.id}"
                  class="np-tab-btn"
                  style="
                    background: ${this.activeTab === tab.id ? 'linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%)' : 'var(--glass-bg-subtle)'};
                    color: ${this.activeTab === tab.id ? '#ffffff' : 'var(--color-text-secondary)'};
                    border: 1px solid ${this.activeTab === tab.id ? 'var(--glass-border-interactive)' : 'var(--glass-border)'};
                    box-shadow: ${this.activeTab === tab.id ? '0 2px 14px rgba(124, 58, 237, 0.4)' : 'none'};
                  "
                >
                  <span style="display: flex;">${getIconSvg(tab.icon, { size: 14, color: this.activeTab === tab.id ? '#ffffff' : 'currentColor' })}</span>
                  <span>${tab.label}</span>
                </button>
              `
                )
                .join('')}
            </nav>

            <!-- Dynamic Tab Content Slot -->
            <div id="np-tab-content-slot" style="flex: 1; min-height: 380px; width: 100%;"></div>
          </div>
        </div>
      </section>
    `;

    this.mountChildComponents();
    this.bindTabEvents();

    // Back button
    this.container.querySelector<HTMLButtonElement>('#np-back-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });
  }

  private renderEmptyState(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <section class="now-playing-page" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: var(--space-8);">
        <div class="glass-panel" style="padding: var(--space-12) var(--space-8); border-radius: var(--radius-2xl); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); max-width: 520px; width: 100%; box-sizing: border-box; box-shadow: var(--shadow-elevation-medium);">
          <div style="color: var(--color-accent-purple-glow); display: flex; justify-content: center; margin-bottom: 16px;">
            ${getIconSvg('now-playing', { size: 54 })}
          </div>
          <h2 style="font-size: var(--font-size-xl); font-weight: var(--font-weight-extrabold); color: #ffffff; margin: 0 0 8px 0;">
            Nothing Playing Right Now
          </h2>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0 0 var(--space-6) 0; line-height: 1.6;">
            Select a song from your local library, search your collection, or start a playlist to begin listening with bit-perfect fidelity.
          </p>
          <div style="display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap;">
            <button
              id="np-empty-library-btn"
              style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; background: linear-gradient(135deg, var(--color-accent-purple) 0%, #9333ea 100%); border: 1px solid var(--glass-border-interactive); border-radius: var(--radius-full); color: #ffffff; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); cursor: pointer; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);"
            >
              <span style="display: flex;">${getIconSvg('library', { size: 14, color: '#ffffff' })}</span>
              <span>Open Library</span>
            </button>
            <button
              id="np-empty-search-btn"
              style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); border-radius: var(--radius-full); color: var(--color-text-primary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer;"
            >
              <span style="display: flex;">${getIconSvg('search', { size: 14 })}</span>
              <span>Search Music</span>
            </button>
          </div>
        </div>
      </section>
    `;

    this.container.querySelector('#np-empty-library-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#np-empty-search-btn')?.addEventListener('click', () => {
      this.router?.navigate('search');
    });
  }

  private mountChildComponents(): void {
    if (!this.container) return;

    // 1. Artwork Component
    const artworkSlot = this.container.querySelector<HTMLElement>('#np-artwork-slot');
    if (artworkSlot) {
      this.artworkComponent = new ArtworkViewComponent(this.artworkService);
      this.artworkComponent.mount(artworkSlot, this.currentTrack);
    }

    // 2. Player Controls Component
    const controlsSlot = this.container.querySelector<HTMLElement>('#np-controls-slot');
    if (controlsSlot) {
      this.controlsComponent = new PlayerControlsComponent(this.playbackManager, {
        onToggleFavorite: () => {
          if (this.currentTrack && this.libraryService) {
            void this.libraryService.toggleFavorite(this.currentTrack.id).then(isFav => {
              if (this.currentTrack) {
                (this.currentTrack as any).isFavorite = isFav;
              }
              this.controlsComponent?.updateFavorite(isFav);
            });
          }
        }
      });
      this.controlsComponent.mount(controlsSlot, this.currentTrack?.isFavorite ?? false);
      this.controlsComponent.updatePlaybackState(this.playbackManager.state === 'playing');
      this.controlsComponent.updateTime(this.playbackManager.positionMs, this.playbackManager.durationMs);
      this.controlsComponent.updateModes(this.playbackManager.repeatMode, this.playbackManager.shuffleMode);
      this.controlsComponent.updateVolume();
    }

    // 3. Mount Active Tab in Right Column
    this.mountActiveTab();
  }

  private mountActiveTab(): void {
    if (!this.container) return;
    const tabSlot = this.container.querySelector<HTMLElement>('#np-tab-content-slot');
    if (!tabSlot) return;

    tabSlot.innerHTML = '';

    if (this.activeTab === 'queue') {
      this.queueComponent = new QueuePanelComponent(this.playbackManager, this.artworkService);
      this.queueComponent.mount(tabSlot);
    } else if (this.activeTab === 'lyrics') {
      this.lyricsComponent = new LyricsViewComponent({
        lyricsService: this.lyricsService,
        playbackManager: this.playbackManager,
        eventBus: this.eventBus
      });
      this.lyricsComponent.mount(tabSlot, this.currentTrack);
    } else if (this.activeTab === 'info') {
      this.audioInfoComponent = new AudioInfoPanelComponent();
      this.audioInfoComponent.mount(tabSlot, this.currentTrack);
    }
  }

  private bindTabEvents(): void {
    if (!this.container) return;

    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('button[data-tab]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as NowPlayingTab;
        if (tab && tab !== this.activeTab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });
  }

  private subscribeToDomainEvents(): void {
    // 1. Track Changed
    this.subscriptions.push(
      this.eventBus.subscribe<TrackChangedEvent>(DomainEvents.TRACK_CHANGED, e => {
        this.currentTrack = e.currentTrack;
        if (!this.container) return;

        if (!this.currentTrack) {
          this.renderEmptyState();
        } else {
          this.render();
        }
      })
    );

    // 2. Playback State Changed
    this.subscriptions.push(
      this.eventBus.subscribe<PlaybackStateChangedEvent>(DomainEvents.PLAYBACK_STATE_CHANGED, e => {
        this.controlsComponent?.updatePlaybackState(e.state === 'playing');
      })
    );

    // 3. Playback Time Updated
    this.subscriptions.push(
      this.eventBus.subscribe<PlaybackTimeUpdatedEvent>(DomainEvents.PLAYBACK_TIME_UPDATED, e => {
        this.controlsComponent?.updateTime(e.positionMs, e.durationMs);
      })
    );

    // 4. Playback Modes Changed
    this.subscriptions.push(
      this.eventBus.subscribe<PlaybackModesChangedEvent>(DomainEvents.PLAYBACK_MODES_CHANGED, e => {
        this.controlsComponent?.updateModes(e.repeat, e.shuffle);
      })
    );

    // 5. Queue Changed
    this.subscriptions.push(
      this.eventBus.subscribe<QueueChangedEvent>(DomainEvents.QUEUE_CHANGED, () => {
        this.queueComponent?.updateQueue();
      })
    );

    // 6. Favorite Changed
    this.subscriptions.push(
      this.eventBus.subscribe<FavoriteChangedEvent>(DomainEvents.FAVORITE_CHANGED, e => {
        if (this.currentTrack && this.currentTrack.id === e.trackId) {
          (this.currentTrack as any).isFavorite = e.isFavorite;
          this.controlsComponent?.updateFavorite(e.isFavorite);
        }
      })
    );
  }
}
