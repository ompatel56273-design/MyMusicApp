import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { RouterService } from '../navigation/router-service';
import type { IPlaybackManager, ILibraryService, IArtworkService, ILyricsService } from '../../services/contracts/service-contracts';
import { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';
import type { Disposable } from '../../core/types/common';
import type { Track } from '../../domain/entities/models';
import { ArtworkViewComponent } from '../components/player/artwork-view-component';
import { PlayerControlsComponent } from '../components/player/player-controls-component';
import { QueuePanelComponent } from '../components/player/queue-panel-component';
import { LyricsViewComponent } from '../components/player/lyrics-view-component';
import { AudioInfoPanelComponent } from '../components/player/audio-info-panel-component';
import { VisualizerComponent } from '../components/visualizer/visualizer-component';
import type { IAudioEngine, IVisualizerService } from '../../services/contracts/service-contracts';

export type NowPlayingTab = 'queue' | 'lyrics' | 'info' | 'visualizer';

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
  private visualizerComponent: VisualizerComponent | null = null;

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

    this.container.innerHTML = `
      <style>
        .now-playing-fullscreen {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-4) var(--space-6);
          box-sizing: border-box;
          overflow-y: auto;
          position: relative;
        }

        .np-ambient-glow {
          position: absolute;
          top: 10%;
          left: 20%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(6, 182, 212, 0.08) 50%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
          z-index: 0;
        }

        .np-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
          position: relative;
          z-index: 1;
        }

        .np-header-btn {
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          color: var(--color-text-primary);
          min-height: 44px;
          padding: 8px 18px;
          border-radius: var(--radius-full);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          transition: all var(--duration-fast) var(--ease-smooth);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .np-header-btn:hover {
          background: var(--glass-surface-hover);
          border-color: var(--glass-border-hover);
          transform: translateY(-1px);
        }

        .np-header-btn:focus-visible {
          outline: 2px solid var(--color-accent-primary);
          outline-offset: 2px;
        }

        .np-header-title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-muted);
        }

        .np-layout-split {
          display: grid;
          grid-template-columns: minmax(320px, 460px) 1fr;
          gap: var(--space-8);
          align-items: start;
          flex: 1;
          min-height: 0;
          position: relative;
          z-index: 1;
        }

        .np-hero-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          background: var(--glass-surface);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-2xl);
          padding: var(--space-6);
          box-sizing: border-box;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        }

        .np-meta-container {
          text-align: center;
          margin-bottom: var(--space-4);
          width: 100%;
        }

        .np-panel-section {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 480px;
          width: 100%;
          gap: var(--space-3);
        }

        .np-tab-bar {
          display: flex;
          gap: var(--space-2);
          background: var(--glass-surface);
          padding: 5px;
          border-radius: var(--radius-xl);
          border: 1px solid var(--glass-border);
          align-self: flex-start;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .np-tab-btn {
          min-height: 38px;
          padding: 8px 18px;
          border-radius: var(--radius-lg);
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
        }

        .np-tab-btn:focus-visible {
          outline: 2px solid var(--color-accent-primary);
          outline-offset: 2px;
        }

        /* Responsive Tablet Breakpoint (768px - 1199px) */
        @media (max-width: 1199px) and (min-width: 768px) {
          .np-layout-split {
            grid-template-columns: minmax(300px, 380px) 1fr;
            gap: var(--space-6);
          }
          .now-playing-fullscreen {
            padding: var(--space-4);
          }
          .np-hero-section {
            padding: var(--space-5);
          }
        }

        /* Responsive Mobile Breakpoint (<768px) */
        @media (max-width: 767px) {
          .now-playing-fullscreen {
            padding: var(--space-3);
            max-width: 100%;
          }
          .np-layout-split {
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
          }
          .np-hero-section {
            padding: var(--space-4);
            border-radius: var(--radius-xl);
          }
          .np-tab-bar {
            align-self: stretch;
            justify-content: space-around;
            overflow-x: auto;
          }
          .np-tab-btn {
            flex: 1;
            padding: 8px 10px;
            font-size: 12px;
            text-align: center;
          }
          .np-panel-section {
            min-height: 380px;
          }
        }
      </style>

      <section
        class="now-playing-fullscreen"
        role="region"
        aria-label="Now Playing Fullscreen View"
      >
        <div class="np-ambient-glow" aria-hidden="true"></div>

        <!-- Top Navigation Header -->
        <header class="np-header">
          <button
            id="np-back-btn"
            class="np-header-btn"
            aria-label="Back to Library"
          >
            <span aria-hidden="true">◀</span>
            <span>Back</span>
          </button>

          <span class="np-header-title">
            Now Playing
          </span>

          <button
            id="np-eq-shortcut-btn"
            class="np-header-btn"
            aria-label="Open Equalizer & Audio Settings"
          >
            <span aria-hidden="true">🎚</span>
            <span>EQ</span>
          </button>
        </header>

        <!-- Main 2-Column Split -->
        <div class="np-layout-split">
          <!-- Left: Hero Player Surface -->
          <div class="np-hero-section">
            <div id="np-artwork-slot" style="width: 100%;"></div>

            <!-- Track Metadata Header -->
            <div class="np-meta-container">
              <h2
                id="np-track-title"
                style="
                  font-size: 22px;
                  font-weight: 700;
                  letter-spacing: -0.02em;
                  color: var(--color-text-primary);
                  margin: 0 0 var(--space-1) 0;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                ${this.currentTrack?.title || 'No Track Selected'}
              </h2>

              <p
                id="np-track-artist"
                style="
                  font-size: 14px;
                  color: var(--color-text-secondary);
                  margin: 0 0 var(--space-2) 0;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                ${this.currentTrack?.artistName || 'Select music to begin playback'}
              </p>

              <div id="np-format-badge-slot" style="display: flex; justify-content: center; margin-top: var(--space-1);">
                ${this.renderFormatBadge(this.currentTrack)}
              </div>
            </div>

            <!-- Controls Slot -->
            <div id="np-controls-slot" style="width: 100%;"></div>
          </div>

          <!-- Right: Modular Tabbed Panel (Queue / Lyrics / Audio Info / Visualizer) -->
          <div class="np-panel-section">
            <!-- Right Tab Switcher -->
            <div class="np-tab-bar" role="tablist" aria-label="Now Playing View Modes">
              <button
                class="np-tab-btn np-tab-queue"
                data-tab="queue"
                role="tab"
                aria-selected="true"
                aria-controls="np-panel-content-slot"
              >
                Queue
              </button>
              <button
                class="np-tab-btn np-tab-lyrics"
                data-tab="lyrics"
                role="tab"
                aria-selected="false"
                aria-controls="np-panel-content-slot"
              >
                Lyrics
              </button>
              <button
                class="np-tab-btn np-tab-info"
                data-tab="info"
                role="tab"
                aria-selected="false"
                aria-controls="np-panel-content-slot"
              >
                Audio Info
              </button>
              <button
                class="np-tab-btn np-tab-visualizer"
                data-tab="visualizer"
                role="tab"
                aria-selected="false"
                aria-controls="np-panel-content-slot"
              >
                Visualizer
              </button>
            </div>

            <!-- Panel Content Slot -->
            <div id="np-panel-content-slot" role="tabpanel" style="flex: 1; min-height: 0; position: relative;"></div>
          </div>
        </div>
      </section>
    `;

    this.bindHeaderEvents();
    this.bindTabEvents();
    this.mountSubComponents();
  }

  private bindHeaderEvents(): void {
    if (!this.container) return;
    const backBtn = this.container.querySelector('#np-back-btn');
    backBtn?.addEventListener('click', () => {
      if (this.router) {
        this.router.navigate('library');
      } else if (typeof history !== 'undefined' && history.length > 1) {
        history.back();
      }
    });

    const eqBtn = this.container.querySelector('#np-eq-shortcut-btn');
    eqBtn?.addEventListener('click', () => {
      if (this.router) {
        this.router.navigate('settings');
      }
    });
  }

  private bindTabEvents(): void {
    if (!this.container) return;
    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('.np-tab-btn');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as NowPlayingTab;
        if (tab && tab !== this.activeTab) {
          this.switchTab(tab);
        }
      });
    });

    this.updateTabButtonStyles();
  }

  private switchTab(tab: NowPlayingTab): void {
    this.activeTab = tab;
    this.updateTabButtonStyles();
    this.renderActiveTabContent();
  }

  private updateTabButtonStyles(): void {
    if (!this.container) return;
    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('.np-tab-btn');

    tabButtons.forEach(btn => {
      const tab = btn.getAttribute('data-tab') as NowPlayingTab;
      const isSelected = tab === this.activeTab;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      if (isSelected) {
        btn.style.background = 'var(--color-accent-gradient)';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = 'var(--shadow-glow-purple)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-secondary)';
        btn.style.boxShadow = 'none';
      }
    });
  }

  private mountSubComponents(): void {
    if (!this.container) return;

    // 1. Mount Artwork Component
    const artworkSlot = this.container.querySelector<HTMLElement>('#np-artwork-slot');
    if (artworkSlot) {
      this.artworkComponent = new ArtworkViewComponent(this.artworkService);
      this.artworkComponent.mount(artworkSlot, this.currentTrack);
    }

    // 2. Mount Player Controls Component
    const controlsSlot = this.container.querySelector<HTMLElement>('#np-controls-slot');
    if (controlsSlot) {
      this.controlsComponent = new PlayerControlsComponent(this.playbackManager, {
        onToggleFavorite: async () => {
          if (this.currentTrack && this.libraryService) {
            await this.libraryService.toggleFavorite(this.currentTrack.id);
          }
        }
      });
      this.controlsComponent.mount(controlsSlot, this.currentTrack?.isFavorite ?? false);
    }

    // 3. Mount initial right panel tab
    this.renderActiveTabContent();
  }

  private renderActiveTabContent(): void {
    if (!this.container) return;
    const slot = this.container.querySelector<HTMLElement>('#np-panel-content-slot');
    if (!slot) return;

    // Teardown previous components
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
    if (this.visualizerComponent) {
      this.visualizerComponent.unmount();
      this.visualizerComponent = null;
    }

    slot.innerHTML = '';

    if (this.activeTab === 'queue') {
      this.queueComponent = new QueuePanelComponent(this.playbackManager, this.artworkService);
      this.queueComponent.mount(slot);
    } else if (this.activeTab === 'lyrics') {
      this.lyricsComponent = new LyricsViewComponent({
        lyricsService: this.lyricsService,
        playbackManager: this.playbackManager,
        eventBus: this.eventBus
      });
      this.lyricsComponent.mount(slot, this.currentTrack);
    } else if (this.activeTab === 'info') {
      this.audioInfoComponent = new AudioInfoPanelComponent();
      this.audioInfoComponent.mount(slot, this.currentTrack);
    } else if (this.activeTab === 'visualizer' && this.audioEngine) {
      this.visualizerComponent = new VisualizerComponent({
        audioEngine: this.audioEngine,
        visualizerService: this.visualizerService,
        playbackManager: this.playbackManager,
        eventBus: this.eventBus
      });
      void this.visualizerComponent.mount(slot);
    }
  }

  private subscribeToDomainEvents(): void {
    // 1. Track changed
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.TRACK_CHANGED, (e: any) => {
        this.currentTrack = e.currentTrack;
        this.updateMetadataHeader();
        if (this.artworkComponent) {
          this.artworkComponent.updateTrack(this.currentTrack);
        }
        if (this.lyricsComponent) {
          this.lyricsComponent.setTrack(this.currentTrack);
        }
        if (this.audioInfoComponent) {
          this.audioInfoComponent.setTrack(this.currentTrack);
        }
        if (this.controlsComponent) {
          this.controlsComponent.updateFavorite(this.currentTrack?.isFavorite ?? false);
          this.controlsComponent.updatePlaybackState(this.playbackManager.state === 'playing');
          this.controlsComponent.updateTime(this.playbackManager.positionMs, this.playbackManager.durationMs);
        }
      })
    );

    // 2. Playback state changed
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, (e: any) => {
        if (this.controlsComponent) {
          this.controlsComponent.updatePlaybackState(e.state === 'playing');
        }
      })
    );

    // 3. Playback time updated
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_TIME_UPDATED, (e: any) => {
        if (this.controlsComponent) {
          this.controlsComponent.updateTime(e.positionMs, e.durationMs);
        }
      })
    );

    // 4. Playback modes changed
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYBACK_MODES_CHANGED, (e: any) => {
        if (this.controlsComponent) {
          this.controlsComponent.updateModes(e.repeat, e.shuffle);
        }
      })
    );

    // 5. Favorite changed
    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.FAVORITE_CHANGED, (e: any) => {
        if (this.currentTrack && e.trackId === this.currentTrack.id) {
          (this.currentTrack as any).isFavorite = e.isFavorite;
          if (this.controlsComponent) {
            this.controlsComponent.updateFavorite(e.isFavorite);
          }
        }
      })
    );
  }

  private updateMetadataHeader(): void {
    if (!this.container) return;

    const titleEl = this.container.querySelector('#np-track-title');
    if (titleEl) {
      titleEl.textContent = this.currentTrack?.title || 'No Track Selected';
    }

    const artistEl = this.container.querySelector('#np-track-artist');
    if (artistEl) {
      artistEl.textContent = this.currentTrack?.artistName || 'Select music to begin playback';
    }

    const badgeSlot = this.container.querySelector('#np-format-badge-slot');
    if (badgeSlot) {
      badgeSlot.innerHTML = this.renderFormatBadge(this.currentTrack);
    }
  }

  private renderFormatBadge(track: Track | null): string {
    if (!track || !track.format) return '';
    const format = track.format;
    const isHiRes = (format.sampleRate && format.sampleRate > 48000) || (format.bitDepth && format.bitDepth > 16);
    const isLossless = format.isLossless;

    if (isHiRes) {
      return `
        <span
          style="
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border-radius: var(--radius-full);
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15));
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
            box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
          "
        >
          HI-RES • ${format.bitDepth ? `${format.bitDepth}B/` : ''}${format.sampleRate ? `${format.sampleRate / 1000}kHz` : ''}
        </span>
      `;
    }

    if (isLossless) {
      return `
        <span
          style="
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border-radius: var(--radius-full);
            background: linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(168, 85, 247, 0.15));
            color: var(--color-accent-secondary);
            border: 1px solid rgba(6, 182, 212, 0.4);
            box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
          "
        >
          LOSSLESS • ${format.container.toUpperCase()}
        </span>
      `;
    }

    return `
      <span
        style="
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: var(--radius-full);
          background: var(--glass-surface);
          color: var(--color-text-muted);
          border: 1px solid var(--glass-border);
        "
      >
        ${format.container.toUpperCase()}${format.bitrate ? ` • ${format.bitrate}k` : ''}
      </span>
    `;
  }
}
