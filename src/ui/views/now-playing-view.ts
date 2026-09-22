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
      <section
        class="now-playing-fullscreen"
        role="region"
        aria-label="Now Playing Fullscreen View"
        style="
          display: flex;
          flex-direction: column;
          height: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: var(--space-4) var(--space-6);
          box-sizing: border-box;
          overflow-y: auto;
        "
      >
        <!-- Top Navigation Header -->
        <header
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: var(--space-4);
          "
        >
          <button
            id="np-back-btn"
            aria-label="Back to Library"
            style="
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              color: var(--color-text-primary);
              padding: 6px 14px;
              border-radius: var(--radius-full);
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: var(--space-2);
            "
          >
            <span>◀</span>
            <span>Back</span>
          </button>

          <span style="font-size: 14px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-text-muted);">
            Now Playing
          </span>

          <button
            id="np-eq-shortcut-btn"
            aria-label="Open Equalizer & Audio Settings"
            style="
              background: var(--color-bg-surface-elevated);
              border: 1px solid var(--glass-border);
              color: var(--color-text-primary);
              padding: 6px 14px;
              border-radius: var(--radius-full);
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: var(--space-2);
            "
          >
            <span>🎚</span>
            <span>EQ</span>
          </button>
        </header>

        <!-- Main 2-Column Split -->
        <div
          class="np-layout-split"
          style="
            display: grid;
            grid-template-columns: minmax(320px, 460px) 1fr;
            gap: var(--space-8);
            align-items: start;
            flex: 1;
            min-height: 0;
          "
        >
          <!-- Left: Hero Player Surface -->
          <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
            <div id="np-artwork-slot" style="width: 100%;"></div>

            <!-- Track Metadata Header -->
            <div style="text-align: center; margin-bottom: var(--space-4); width: 100%;">
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

          <!-- Right: Modular Tabbed Panel (Queue / Lyrics / Audio Info) -->
          <div style="display: flex; flex-direction: column; height: 100%; min-height: 480px; width: 100%; gap: var(--space-3);">
            
            <!-- Right Tab Switcher -->
            <div
              class="np-tab-bar"
              style="
                display: flex;
                gap: var(--space-2);
                background: rgba(255, 255, 255, 0.04);
                padding: 4px;
                border-radius: var(--radius-lg);
                border: 1px solid rgba(255, 255, 255, 0.08);
                align-self: flex-start;
              "
            >
              <button
                class="np-tab-btn np-tab-queue"
                data-tab="queue"
                style="padding: 6px 16px; border-radius: var(--radius-md); border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
              >
                Queue
              </button>
              <button
                class="np-tab-btn np-tab-lyrics"
                data-tab="lyrics"
                style="padding: 6px 16px; border-radius: var(--radius-md); border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
              >
                Lyrics
              </button>
              <button
                class="np-tab-btn np-tab-info"
                data-tab="info"
                style="padding: 6px 16px; border-radius: var(--radius-md); border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
              >
                Audio Info
              </button>
              <button
                class="np-tab-btn np-tab-visualizer"
                data-tab="visualizer"
                style="padding: 6px 16px; border-radius: var(--radius-md); border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
              >
                Visualizer
              </button>
            </div>

            <!-- Panel Content Slot -->
            <div id="np-panel-content-slot" style="flex: 1; min-height: 0; position: relative;"></div>
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
      if (tab === this.activeTab) {
        btn.style.background = 'var(--color-accent-primary, #ff6b00)';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-secondary, #aaaaaa)';
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
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border-radius: var(--radius-sm);
            background: linear-gradient(135deg, rgba(255, 170, 0, 0.2), rgba(255, 100, 0, 0.1));
            color: #ffaa00;
            border: 1px solid rgba(255, 170, 0, 0.3);
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
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            border-radius: var(--radius-sm);
            background: rgba(255, 255, 255, 0.08);
            color: var(--color-text-primary);
            border: 1px solid rgba(255, 255, 255, 0.15);
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
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.04);
          color: var(--color-text-muted);
          border: 1px solid rgba(255, 255, 255, 0.08);
        "
      >
        ${format.container.toUpperCase()}${format.bitrate ? ` • ${format.bitrate}k` : ''}
      </span>
    `;
  }
}
