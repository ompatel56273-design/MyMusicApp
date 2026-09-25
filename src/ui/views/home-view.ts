import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type {
  ILibraryService,
  IPlaybackManager,
  IArtworkService,
  IPlaylistService,
  IDashboardService
} from '../../services/contracts/service-contracts';
import type { RouterService } from '../navigation/router-service';
import type { EventBus } from '../../core/events/event-bus';
import type { Track, Artist, Playlist } from '../../domain/entities/models';
import type { Disposable } from '../../core/types/common';
import { getIconSvg, type IconName } from '../icons/icon-registry';
import type { DashboardSectionId } from '../../domain/entities/dashboard-settings';
import { SUPPORTED_DASHBOARD_SECTIONS } from '../../domain/entities/dashboard-settings';
import { DomainEvents } from '../../domain/events/domain-events';

export interface HomeViewDependencies {
  playbackManager?: IPlaybackManager | undefined;
  router?: RouterService | undefined;
  artworkService?: IArtworkService | undefined;
  playlistService?: IPlaylistService | undefined;
  eventBus?: EventBus | undefined;
  dashboardService?: IDashboardService | undefined;
}

export interface DashboardHeroSlide {
  readonly id: string;
  readonly eyebrow: string;
  readonly eyebrowIcon: IconName;
  readonly title: string;
  readonly description: string;
  readonly secondaryLine1: string;
  readonly secondaryLine2: string;
  readonly primaryActionLabel: string;
  readonly primaryActionIcon: IconName;
  readonly secondaryActionLabel: string;
  readonly secondaryActionIcon: IconName;
  readonly variant: 'editorial' | 'split' | 'italic' | 'poster' | 'offset' | 'minimal';
}

export const HERO_SLIDES: readonly DashboardHeroSlide[] = [
  {
    id: 'slide-discovery',
    eyebrow: 'Morning Discovery',
    eyebrowIcon: 'sparkles',
    title: 'Music For A<br/><span class="hero-title-accent">Better You</span>',
    description: 'Different moods. Same you. Lossless audio quality with 10-band EQ.',
    secondaryLine1: 'Good Music',
    secondaryLine2: 'Brighter Days',
    primaryActionLabel: 'Play Now',
    primaryActionIcon: 'play',
    secondaryActionLabel: 'Shuffle',
    secondaryActionIcon: 'shuffle',
    variant: 'editorial'
  },
  {
    id: 'slide-audio-quality',
    eyebrow: 'Studio Grade Audio',
    eyebrowIcon: 'equalizer',
    title: 'Hear Every<br/><span class="hero-title-accent">Detail</span>',
    description: 'Your music. Your sound. Your way. Bit-perfect playback powered by 64-bit processing.',
    secondaryLine1: 'Pure Sound',
    secondaryLine2: 'Zero Compromise',
    primaryActionLabel: 'Listen In Hi-Res',
    primaryActionIcon: 'play',
    secondaryActionLabel: 'Tune EQ',
    secondaryActionIcon: 'equalizer',
    variant: 'split'
  },
  {
    id: 'slide-personal-library',
    eyebrow: 'Personal Sanctuary',
    eyebrowIcon: 'library',
    title: 'Your Music.<br/><span class="hero-title-accent">Your Space.</span>',
    description: 'Everything you love, organized your way. Smart playlists, custom tags, and local sync.',
    secondaryLine1: 'Your Library',
    secondaryLine2: 'Beautifully Curated',
    primaryActionLabel: 'Explore Library',
    primaryActionIcon: 'play',
    secondaryActionLabel: 'Shuffle All',
    secondaryActionIcon: 'shuffle',
    variant: 'italic'
  },
  {
    id: 'slide-deep-listening',
    eyebrow: 'Deep Listening',
    eyebrowIcon: 'headphones',
    title: 'Press Play.<br/><span class="hero-title-accent">Stay In The Moment.</span>',
    description: 'Designed around the way you listen. Seamless crossfade and ambient spatial visualizers.',
    secondaryLine1: 'Flow State',
    secondaryLine2: 'Endless Tracks',
    primaryActionLabel: 'Start Flow',
    primaryActionIcon: 'play',
    secondaryActionLabel: 'Random Vibe',
    secondaryActionIcon: 'shuffle',
    variant: 'poster'
  },
  {
    id: 'slide-collection',
    eyebrow: 'Archival Collection',
    eyebrowIcon: 'disc',
    title: 'Every Track<br/><span class="hero-title-accent">Has A Place.</span>',
    description: 'Your entire collection beautifully cataloged with rich metadata and high-res artwork.',
    secondaryLine1: 'Every Detail',
    secondaryLine2: 'In Perfect Harmony',
    primaryActionLabel: 'Play Collection',
    primaryActionIcon: 'play',
    secondaryActionLabel: 'Shuffle Artists',
    secondaryActionIcon: 'shuffle',
    variant: 'offset'
  },
  {
    id: 'slide-pure-music',
    eyebrow: 'Distraction Free',
    eyebrowIcon: 'galaxy',
    title: 'Less Noise.<br/><span class="hero-title-accent">More Music.</span>',
    description: 'An ad-free home for your collection. Clean interface built for true music lovers.',
    secondaryLine1: 'Pure Passion',
    secondaryLine2: 'Uninterrupted',
    primaryActionLabel: 'Play Favorites',
    primaryActionIcon: 'play',
    secondaryActionLabel: 'Quick Mix',
    secondaryActionIcon: 'shuffle',
    variant: 'minimal'
  }
];

/**
 * Phase 4 Complete Visual Rebuild of the Home View.
 * Matches approved Desktop Templates (1, 2, 11), Tablet Templates (1, 2, 11),
 * and Mobile Templates (1, 2, 11) using Phase 2 Design Tokens and Icon System.
 */
export class HomeView implements IView {
  private container: HTMLElement | null = null;
  private readonly libraryService?: ILibraryService | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly router?: RouterService | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly playlistService?: IPlaylistService | undefined;
  private readonly eventBus?: EventBus | undefined;
  private readonly dashboardService?: IDashboardService | undefined;

  private recentTracks: readonly Track[] = [];
  private topArtists: readonly Artist[] = [];
  private realPlaylists: readonly Playlist[] = [];
  private libraryStats = { trackCount: 0, albumCount: 0, artistCount: 0, playlistCount: 0 };
  private subscriptions: Disposable[] = [];
  private activeMood = 'For You';
  private activeSlideIndex = 0;

  constructor(libraryService?: ILibraryService, deps?: HomeViewDependencies) {
    this.libraryService = libraryService;
    this.playbackManager = deps?.playbackManager;
    this.router = deps?.router;
    this.artworkService = deps?.artworkService;
    this.playlistService = deps?.playlistService;
    this.eventBus = deps?.eventBus;
    this.dashboardService = deps?.dashboardService;
  }

  public getActiveMood(): string {
    return this.activeMood;
  }

  public mount(container: HTMLElement, _params?: RouteParams): void {
    this.container = container;
    this.render();
    void this.loadData();
    this.subscribeEvents();
  }

  public unmount(): void {
    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions = [];

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private render(): void {
    if (!this.container) return;

      const currentSlide = this.getActiveSlide();

      this.container.innerHTML = `
      <style>
        .home-view-container {
          padding: var(--space-6) var(--space-8);
          max-width: 1720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          color: var(--color-text-primary);
          font-family: var(--font-family-base);
          box-sizing: border-box;
          width: 100%;
          min-width: 0;
        }

        /* 2-Column Responsive Home Grid (Desktop & Tablet Landscape) */
        .home-grid-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: var(--space-6);
          align-items: start;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .home-main-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .home-side-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          min-width: 0;
          width: 100%;
          box-sizing: border-box;
        }

        /* Atmospheric Hero Banner — Matching Approved Templates 1, 2 & 11 */
        .home-hero-card {
          position: relative;
          border-radius: var(--radius-2xl);
          background: linear-gradient(135deg, rgba(30, 20, 70, 0.95) 0%, rgba(15, 23, 42, 0.95) 55%, rgba(10, 10, 20, 0.98) 100%);
          border: 1px solid var(--glass-border-interactive);
          padding: var(--space-8) var(--space-9);
          overflow: hidden;
          box-shadow: var(--shadow-elevation-high), 0 0 32px rgba(124, 58, 237, 0.2);
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          min-height: 250px;
          box-sizing: border-box;
          width: 100%;
          gap: var(--space-6);
          transition: border-color var(--duration-normal) var(--ease-smooth), box-shadow var(--duration-normal) var(--ease-smooth);
        }

        .home-hero-glow-1 {
          position: absolute;
          right: 20%;
          top: -35%;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%);
          pointer-events: none;
        }

        .home-hero-glow-2 {
          position: absolute;
          left: -10%;
          bottom: -40%;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(236, 72, 153, 0.2) 0%, transparent 65%);
          pointer-events: none;
        }

        .home-hero-content {
          z-index: 2;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          flex: 1;
          box-sizing: border-box;
        }

        .home-hero-greeting {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--color-accent-cyan);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.25);
          border-radius: var(--radius-full);
          width: fit-content;
          backdrop-filter: blur(8px);
        }

        .home-hero-title {
          font-size: var(--font-size-4xl);
          font-weight: var(--font-weight-extrabold);
          letter-spacing: -0.035em;
          line-height: 1.12;
          margin: 0;
          color: #ffffff;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
        }

        .hero-title-accent {
          background: linear-gradient(135deg, #ffffff 0%, var(--color-accent-cyan) 60%, var(--color-accent-purple-glow) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
        }

        /* Typography Composition Variants */
        .home-hero-card[data-variant="editorial"] .home-hero-title {
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .home-hero-card[data-variant="split"] .home-hero-title {
          text-transform: uppercase;
          letter-spacing: -0.02em;
          font-size: calc(var(--font-size-4xl) * 0.95);
        }

        .home-hero-card[data-variant="italic"] .home-hero-title {
          font-family: var(--font-family-serif, Georgia, serif);
          font-weight: 700;
          font-style: italic;
          letter-spacing: -0.02em;
        }

        .home-hero-card[data-variant="poster"] .home-hero-title {
          font-weight: 900;
          letter-spacing: -0.045em;
          line-height: 1.08;
        }

        .home-hero-card[data-variant="offset"] .home-hero-title {
          letter-spacing: -0.01em;
        }

        .home-hero-card[data-variant="minimal"] .home-hero-title {
          font-weight: 600;
          letter-spacing: -0.03em;
        }

        .home-hero-subtitle {
          font-size: var(--font-size-sm);
          color: rgba(241, 245, 249, 0.88);
          margin: 0 0 var(--space-3) 0;
          font-weight: var(--font-weight-normal);
          line-height: 1.55;
          max-width: 480px;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
        }

        .home-hero-actions {
          display: flex;
          gap: var(--space-3);
          align-items: center;
          flex-wrap: wrap;
        }

        .home-hero-btn-play {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 12px 28px;
          min-height: 46px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-accent-purple), #9333ea);
          color: #ffffff;
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(124, 58, 237, 0.55);
          transition: transform var(--duration-fast) var(--ease-smooth), box-shadow var(--duration-fast) var(--ease-smooth);
        }
        .home-hero-btn-play:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(124, 58, 237, 0.75);
        }

        .home-hero-btn-shuffle {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: 12px 24px;
          min-height: 46px;
          border-radius: var(--radius-full);
          background: var(--glass-bg-interactive);
          border: 1px solid var(--glass-border-interactive);
          color: var(--color-text-primary);
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: background var(--duration-fast) var(--ease-smooth), transform var(--duration-fast) var(--ease-smooth);
        }
        .home-hero-btn-shuffle:hover {
          background: var(--glass-bg-subtle);
          transform: translateY(-2px);
        }

        /* Secondary Right Poster Card */
        .home-hero-decor {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--space-4);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--glass-border-interactive);
          border-radius: var(--radius-xl);
          padding: var(--space-5) var(--space-6);
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          min-width: 220px;
          box-sizing: border-box;
        }

        .home-hero-tagline {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          gap: 2px;
        }

        .home-hero-tagline-primary {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }

        .home-hero-tagline-secondary {
          font-family: 'Brush Script MT', 'Segoe Script', 'Georgia', cursive, serif;
          font-size: 24px;
          font-style: italic;
          font-weight: 600;
          color: var(--color-accent-cyan);
          line-height: 1.2;
          text-shadow: 0 2px 10px rgba(6, 182, 212, 0.4);
        }

        .home-hero-controls {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .home-hero-nav-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          padding: 0;
          transition: all var(--duration-fast) var(--ease-smooth);
        }
        .home-hero-nav-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.35);
        }
        .home-hero-nav-btn:focus-visible {
          outline: 2px solid var(--color-accent-cyan);
          outline-offset: 2px;
        }

        .home-hero-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .home-hero-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          border: 1px solid transparent;
          padding: 0;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
        }
        .home-hero-dot:hover {
          background: rgba(255, 255, 255, 0.5);
        }
        .home-hero-dot.active {
          background: var(--color-accent-cyan);
          width: 24px;
          border-radius: var(--radius-full);
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
        }
        .home-hero-dot:focus-visible {
          outline: 2px solid var(--color-accent-cyan);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .home-hero-card,
          .home-hero-content,
          .home-hero-decor,
          .home-hero-dot,
          .home-hero-btn-play,
          .home-hero-btn-shuffle {
            transition: none !important;
            animation: none !important;
          }
        }

        /* Mobile 4-Tile Quick Access Row */
        .home-mobile-quick-row {
          display: none;
        }

        /* Category / Mood Filter Pills */
        .home-mood-pills {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          overscroll-behavior-x: contain;
        }
        .home-mood-pills::-webkit-scrollbar {
          display: none;
        }

        .home-mood-pill {
          padding: 8px 20px;
          min-height: 40px;
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          white-space: nowrap;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg-subtle);
          color: var(--color-text-secondary);
          transition: all var(--duration-fast) var(--ease-smooth);
        }
        .home-mood-pill.active, .home-mood-pill:hover {
          background: linear-gradient(135deg, var(--color-accent-purple), #9333ea);
          color: #ffffff;
          border-color: var(--glass-border-interactive);
          box-shadow: 0 2px 14px rgba(124, 58, 237, 0.4);
        }

        /* Section Layouts */
        .home-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .home-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .home-section-title {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-extrabold);
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
          margin: 0;
        }

        .home-see-all-btn {
          background: transparent;
          border: none;
          color: var(--color-accent-cyan);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          transition: background var(--duration-fast) var(--ease-smooth);
        }
        .home-see-all-btn:hover {
          background: rgba(6, 182, 212, 0.1);
        }

        /* Trending / Recently Played Grid */
        .home-track-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: var(--space-4);
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .home-track-card {
          position: relative;
          border-radius: var(--radius-xl);
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-width: 0;
          box-sizing: border-box;
        }
        .home-track-card:hover {
          background: var(--glass-bg-interactive);
          border-color: var(--glass-border-interactive);
          transform: translateY(-4px);
          box-shadow: var(--shadow-elevation-high), 0 0 20px rgba(124, 58, 237, 0.25);
        }

        .home-track-artwork {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .home-play-overlay {
          position: absolute;
          right: 10px;
          bottom: 10px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-accent-purple), #9333ea);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.6);
          opacity: 0;
          transform: translateY(8px);
          transition: all var(--duration-fast) var(--ease-smooth);
        }
        .home-track-card:hover .home-play-overlay {
          opacity: 1;
          transform: translateY(0);
        }

        /* Made For You Landscape Mix Grid */
        .home-mix-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-4);
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .home-mix-card {
          border-radius: var(--radius-xl);
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-width: 0;
          box-sizing: border-box;
        }
        .home-mix-card:hover {
          background: var(--glass-bg-interactive);
          border-color: var(--glass-border-interactive);
          transform: translateY(-3px);
          box-shadow: var(--shadow-elevation-medium), 0 0 16px rgba(124, 58, 237, 0.2);
        }
        .home-mix-artwork {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: var(--radius-md);
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Top Artists Row */
        .home-artist-avatar {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4338ca, #1e1b4b);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: var(--font-weight-bold);
          color: #ffffff;
          border: 2px solid var(--glass-border);
          transition: all var(--duration-fast) var(--ease-smooth);
          overflow: hidden;
        }
        .home-artist-avatar:hover {
          transform: scale(1.08);
          border-color: var(--color-accent-purple);
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.45);
        }

        /* Secondary Column Widgets (Template 11) */
        .home-quote-card {
          padding: var(--space-5);
          border-radius: var(--radius-2xl);
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.8), rgba(15, 23, 42, 0.9));
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-elevation-medium);
          position: relative;
          box-sizing: border-box;
          width: 100%;
        }

        .home-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
          width: 100%;
          box-sizing: border-box;
        }

        .home-stat-tile {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-xl);
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          transition: all var(--duration-fast) var(--ease-smooth);
          min-width: 0;
          box-sizing: border-box;
        }
        .home-stat-tile:hover {
          background: var(--glass-bg-interactive);
          border-color: var(--glass-border-interactive);
        }

        .home-genre-card {
          padding: var(--space-5);
          border-radius: var(--radius-2xl);
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          box-sizing: border-box;
          width: 100%;
        }

        .home-genre-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          font-size: var(--font-size-xs);
        }
        .home-genre-bar-track {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .home-genre-bar-fill {
          height: 100%;
          border-radius: 3px;
        }

        .home-quick-actions-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
          width: 100%;
          box-sizing: border-box;
        }

        .home-quick-action-tile {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          min-height: 52px;
          border-radius: var(--radius-xl);
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          color: var(--color-text-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          box-sizing: border-box;
        }
        .home-quick-action-tile:hover {
          background: var(--glass-bg-interactive);
          border-color: var(--glass-border-interactive);
          transform: translateY(-2px);
          color: var(--color-accent-cyan);
        }

        .home-queue-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: 8px 10px;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease-smooth);
          min-width: 0;
          box-sizing: border-box;
        }
        .home-queue-row:hover {
          background: var(--glass-bg-interactive);
          border-color: var(--glass-border);
        }

        /* ==========================================================
           TABLET RESPONSIVE STYLES (768px - 1199px)
           ========================================================== */
        @media (min-width: 768px) and (max-width: 1199px) {
          .home-view-container {
            padding: var(--space-5) var(--space-6);
            gap: var(--space-5);
          }

          .home-grid-layout {
            grid-template-columns: minmax(0, 1.7fr) minmax(0, 1.3fr);
            gap: var(--space-5);
          }

          .home-hero-card {
            padding: var(--space-6);
            min-height: 190px;
          }

          .home-hero-title {
            font-size: var(--font-size-3xl);
          }

          .home-hero-tagline {
            font-size: 22px;
          }

          .home-track-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: var(--space-3);
          }

          .home-mix-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: var(--space-3);
          }
        }

        /* Smaller Tablet Portrait (768px - 899px) */
        @media (min-width: 768px) and (max-width: 899px) {
          .home-grid-layout {
            grid-template-columns: 1fr;
          }
        }

        /* ==========================================================
           MOBILE RESPONSIVE STYLES (< 768px)
           ========================================================== */
        .home-vibe-card {
          display: none;
        }

        @media (max-width: 767px) {
          .home-view-container {
            padding: var(--space-4) var(--space-3) calc(var(--mini-player-height) + var(--bottom-nav-height) + var(--space-8)) var(--space-3);
            gap: var(--space-4);
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-grid-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-4);
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-hero-card {
            padding: var(--space-5) var(--space-4);
            min-height: 160px;
            flex-direction: column;
            align-items: flex-start;
            border-radius: var(--radius-xl);
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }

          .home-hero-title {
            font-size: var(--font-size-2xl);
            line-height: 1.15;
            word-break: break-word;
          }

          .home-hero-subtitle {
            font-size: var(--font-size-xs);
            margin: 2px 0 var(--space-3) 0;
          }

          .home-hero-btn-play, .home-hero-btn-shuffle {
            padding: 10px 20px;
            font-size: var(--font-size-xs);
            min-height: 44px;
          }

          .home-hero-decor {
            display: none;
          }

          /* Mobile 4-Tile Quick Access Row */
          .home-mobile-quick-row {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-mobile-quick-tile {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px 4px;
            min-height: 48px;
            border-radius: var(--radius-lg);
            background: var(--glass-bg-subtle);
            border: 1px solid var(--glass-border);
            text-align: center;
            gap: 4px;
            cursor: pointer;
            transition: all var(--duration-fast) var(--ease-smooth);
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
          }
          .home-mobile-quick-tile span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .home-mobile-quick-tile:active {
            transform: scale(0.96);
            background: var(--glass-bg-interactive);
          }

          /* Horizontal scrolling mixes on mobile */
          .home-mix-grid {
            display: flex;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scrollbar-width: none;
            gap: 12px;
            padding-bottom: 4px;
            scroll-snap-type: x mandatory;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }
          .home-mix-grid::-webkit-scrollbar {
            display: none;
          }
          .home-mix-card {
            flex: 0 0 150px;
            scroll-snap-align: start;
          }

          /* Track cards on mobile -> compact row format */
          .home-track-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-track-card {
            flex-direction: row;
            align-items: center;
            padding: 8px 12px;
            gap: 12px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-track-artwork {
            width: 48px;
            height: 48px;
            flex-shrink: 0;
            border-radius: var(--radius-md);
          }

          .home-play-overlay {
            display: none; /* Tap whole row on mobile */
          }

          /* Mobile Your Vibe Today Card */
          .home-vibe-card {
            display: flex;
            flex-direction: column;
            gap: var(--space-3);
            padding: var(--space-4);
            border-radius: var(--radius-xl);
            background: var(--glass-bg-subtle);
            border: 1px solid var(--glass-border);
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-vibe-ring-container {
            display: flex;
            align-items: center;
            justify-content: space-around;
            gap: 14px;
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .home-vibe-ring {
            width: 88px;
            height: 88px;
            flex-shrink: 0;
            border-radius: 50%;
            background: conic-gradient(var(--color-accent-purple) 0% 72%, var(--color-accent-pink) 72% 90%, var(--color-accent-cyan) 90% 96%, #06b6d4 96% 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
          }

          .home-vibe-ring-inner {
            width: 66px;
            height: 66px;
            border-radius: 50%;
            background: var(--color-bg-base);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
        }
      </style>

      <section class="home-view-container" aria-label="Music Dashboard">
        <div class="home-grid-layout">
          <!-- Left Main Content Column -->
          <div class="home-main-col">
            <!-- 1. Atmospheric Multi-Slide Hero Banner -->
            <div class="home-hero-card" data-variant="${currentSlide.variant}" aria-roledescription="carousel" aria-label="Featured music hero banner">
              <div class="home-hero-glow-1"></div>
              <div class="home-hero-glow-2"></div>
              
              <div class="home-hero-content" id="home-hero-slide-content" role="tabpanel" aria-live="polite">
                <div class="home-hero-greeting">
                  ${getIconSvg(currentSlide.eyebrowIcon, { size: 14, color: 'var(--color-accent-cyan)' })}
                  <span>${this.escapeHtml(currentSlide.eyebrow)}</span>
                </div>
                <h1 class="home-hero-title">
                  ${currentSlide.title}
                </h1>
                <p class="home-hero-subtitle">
                  ${this.escapeHtml(currentSlide.description)}
                </p>
                <div class="home-hero-actions">
                  <button class="home-hero-btn-play" id="home-hero-play-btn" aria-label="${this.escapeHtml(currentSlide.primaryActionLabel)}">
                    ${getIconSvg(currentSlide.primaryActionIcon, { size: 18, color: '#ffffff' })}
                    <span>${this.escapeHtml(currentSlide.primaryActionLabel)}</span>
                  </button>
                  <button class="home-hero-btn-shuffle" id="home-hero-shuffle-btn" aria-label="${this.escapeHtml(currentSlide.secondaryActionLabel)}">
                    ${getIconSvg(currentSlide.secondaryActionIcon, { size: 18, color: 'currentColor' })}
                    <span>${this.escapeHtml(currentSlide.secondaryActionLabel)}</span>
                  </button>
                </div>
              </div>

              <div class="home-hero-decor">
                <div class="home-hero-tagline">
                  <span class="home-hero-tagline-primary">${this.escapeHtml(currentSlide.secondaryLine1)}</span>
                  <span class="home-hero-tagline-secondary">${this.escapeHtml(currentSlide.secondaryLine2)}</span>
                </div>
                <div class="home-hero-controls" aria-label="Slide navigation">
                  <button class="home-hero-nav-btn" id="home-hero-prev-btn" aria-label="Previous slide">
                    ${getIconSvg('chevron-left', { size: 16, color: '#ffffff' })}
                  </button>
                  <div class="home-hero-dots" role="tablist" aria-label="Hero slide indicators">
                    ${HERO_SLIDES.map((slide, idx) => `
                      <button
                        class="home-hero-dot ${idx === this.activeSlideIndex ? 'active' : ''}"
                        role="tab"
                        id="hero-tab-${idx}"
                        aria-selected="${idx === this.activeSlideIndex ? 'true' : 'false'}"
                        aria-controls="home-hero-slide-content"
                        aria-label="Slide ${idx + 1} of ${HERO_SLIDES.length}: ${slide.eyebrow}"
                        data-slide-index="${idx}"
                        tabindex="${idx === this.activeSlideIndex ? '0' : '-1'}"
                      ><span style="display:none;">${idx + 1}</span></button>
                    `).join('')}
                  </div>
                  <button class="home-hero-nav-btn" id="home-hero-next-btn" aria-label="Next slide">
                    ${getIconSvg('chevron-right', { size: 16, color: '#ffffff' })}
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. Mobile 4-Tile Quick Access Row (Mobile Breakpoint) -->
            <div class="home-mobile-quick-row">
              <div class="home-mobile-quick-tile" id="mobile-quick-liked" aria-label="Liked Songs">
                <span style="color: var(--color-accent-pink);">${getIconSvg('heart-filled', { size: 20 })}</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Liked</span>
                <span style="font-size: 9px; color: var(--color-text-muted);" id="mobile-liked-count">Favorites</span>
              </div>
              <div class="home-mobile-quick-tile" id="mobile-quick-recents" aria-label="Recently Played">
                <span style="color: var(--color-accent-cyan);">${getIconSvg('clock', { size: 20 })}</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Recent</span>
                <span style="font-size: 9px; color: var(--color-text-muted);" id="mobile-recent-count">Tracks</span>
              </div>
              <div class="home-mobile-quick-tile" id="mobile-quick-downloads" aria-label="Library">
                <span style="color: var(--color-accent-purple-glow);">${getIconSvg('folder', { size: 20 })}</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Library</span>
                <span style="font-size: 9px; color: var(--color-text-muted);" id="mobile-lib-count">Local Audio</span>
              </div>
              <div class="home-mobile-quick-tile" id="mobile-quick-stats" aria-label="Audio Galaxy">
                <span style="color: #f59e0b;">${getIconSvg('galaxy', { size: 20 })}</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Galaxy</span>
                <span style="font-size: 9px; color: var(--color-text-muted);">Audio Map</span>
              </div>
            </div>

            <!-- 3. Category / Mood Filter Pills -->
            <div class="home-mood-pills" id="home-mood-pills-bar" aria-label="Filter by mood">
              <button class="home-mood-pill active" data-mood="For You">For You</button>
              <button class="home-mood-pill" data-mood="Chill">Chill</button>
              <button class="home-mood-pill" data-mood="Workout">Workout</button>
              <button class="home-mood-pill" data-mood="Focus">Focus</button>
              <button class="home-mood-pill" data-mood="Party">Party</button>
              <button class="home-mood-pill" data-mood="Love">Love</button>
              <button class="home-mood-pill" data-mood="Sad">Sad</button>
              <button class="home-mood-pill" data-mood="Retro">Retro</button>
              <button class="home-mood-pill" data-mood="Instrumental">Instrumental</button>
            </div>

            <!-- Dynamic User Customization Dashboard Sections Container -->
            <div id="home-dynamic-sections-container" style="display: flex; flex-direction: column; gap: var(--space-6); width: 100%;"></div>
          </div>

          <!-- Right Secondary Column (Quote, Stats, Top Genres, Quick Actions, Up Next) -->
          <div class="home-side-col">
            <!-- 1. Inspirational Quote Card -->
            <div class="home-quote-card">
              <p style="font-size: var(--font-size-xs); font-style: italic; color: rgba(255, 255, 255, 0.9); margin: 0; line-height: 1.6;">
                “Music gives a soul to the universe, wings to the mind, flight to the imagination, and life to everything.”
              </p>
              <div style="margin-top: 8px; font-size: 11px; font-weight: var(--font-weight-bold); color: var(--color-accent-purple-glow); text-align: right;">
                — Plato
              </div>
            </div>

            <!-- 2. Real Statistics 2x2 Grid -->
            <div class="home-stats-grid" id="home-stats-grid">
              <div class="home-stat-tile">
                <span style="color: var(--color-accent-pink);">${getIconSvg('music', { size: 22 })}</span>
                <div>
                  <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff;" id="stat-song-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Songs</div>
                </div>
              </div>

              <div class="home-stat-tile">
                <span style="color: var(--color-accent-cyan);">${getIconSvg('user', { size: 22 })}</span>
                <div>
                  <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff;" id="stat-artist-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Artists</div>
                </div>
              </div>

              <div class="home-stat-tile">
                <span style="color: var(--color-accent-purple-glow);">${getIconSvg('disc', { size: 22 })}</span>
                <div>
                  <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff;" id="stat-album-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Albums</div>
                </div>
              </div>

              <div class="home-stat-tile">
                <span style="color: #f43f5e;">${getIconSvg('playlist', { size: 22 })}</span>
                <div>
                  <div style="font-size: var(--font-size-base); font-weight: var(--font-weight-extrabold); color: #ffffff;" id="stat-playlist-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted);">Playlists</div>
                </div>
              </div>
            </div>

            <!-- 3. Top Genres Card -->
            <div class="home-genre-card">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-extrabold); color: #ffffff;">Top Genres</span>
                <button id="genre-see-all-btn" style="background: transparent; border: none; color: var(--color-accent-cyan); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); cursor: pointer;">See all</button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="home-genre-row">
                  <span>${getIconSvg('sparkles', { size: 14, color: 'var(--color-accent-pink)' })}</span>
                  <span style="width: 60px; font-weight: var(--font-weight-semibold); color: #ffffff;">Pop</span>
                  <div class="home-genre-bar-track">
                    <div class="home-genre-bar-fill" style="width: 28%; background: var(--color-accent-pink);"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted); width: 28px; text-align: right;">28%</span>
                </div>

                <div class="home-genre-row">
                  <span>${getIconSvg('headphones', { size: 14, color: 'var(--color-accent-purple-glow)' })}</span>
                  <span style="width: 60px; font-weight: var(--font-weight-semibold); color: #ffffff;">Hip Hop</span>
                  <div class="home-genre-bar-track">
                    <div class="home-genre-bar-fill" style="width: 22%; background: var(--color-accent-purple-glow);"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted); width: 28px; text-align: right;">22%</span>
                </div>

                <div class="home-genre-row">
                  <span>${getIconSvg('sound-wave', { size: 14, color: 'var(--color-accent-cyan)' })}</span>
                  <span style="width: 60px; font-weight: var(--font-weight-semibold); color: #ffffff;">Rock</span>
                  <div class="home-genre-bar-track">
                    <div class="home-genre-bar-fill" style="width: 15%; background: var(--color-accent-cyan);"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted); width: 28px; text-align: right;">15%</span>
                </div>

                <div class="home-genre-row">
                  <span>${getIconSvg('radio', { size: 14, color: '#06b6d4)' })}</span>
                  <span style="width: 60px; font-weight: var(--font-weight-semibold); color: #ffffff;">EDM</span>
                  <div class="home-genre-bar-track">
                    <div class="home-genre-bar-fill" style="width: 12%; background: #06b6d4;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted); width: 28px; text-align: right;">12%</span>
                </div>

                <div class="home-genre-row">
                  <span>${getIconSvg('music', { size: 14, color: '#f59e0b' })}</span>
                  <span style="width: 60px; font-weight: var(--font-weight-semibold); color: #ffffff;">Indie</span>
                  <div class="home-genre-bar-track">
                    <div class="home-genre-bar-fill" style="width: 10%; background: #f59e0b;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted); width: 28px; text-align: right;">10%</span>
                </div>
              </div>
            </div>

            <!-- 4. Quick Actions (2x2 Grid) -->
            <div style="display: flex; flex-direction: column; gap: var(--space-3);">
              <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-extrabold); color: #ffffff;">Quick Actions</span>

              <div class="home-quick-actions-2x2">
                <button class="home-quick-action-tile" id="action-create-playlist" aria-label="Create Playlist">
                  <span style="color: var(--color-accent-cyan);">${getIconSvg('plus', { size: 18 })}</span>
                  <span>New Playlist</span>
                </button>
                <button class="home-quick-action-tile" id="action-liked-songs" aria-label="Liked Songs">
                  <span style="color: var(--color-accent-pink);">${getIconSvg('heart', { size: 18 })}</span>
                  <span>Liked Songs</span>
                </button>
                <button class="home-quick-action-tile" id="action-library-downloads" aria-label="Local Library">
                  <span style="color: var(--color-accent-cyan);">${getIconSvg('folder', { size: 18 })}</span>
                  <span>Local Library</span>
                </button>
                <button class="home-quick-action-tile" id="action-audio-galaxy" aria-label="Audio Galaxy">
                  <span style="color: var(--color-accent-purple-glow);">${getIconSvg('galaxy', { size: 18 })}</span>
                  <span>Audio Galaxy</span>
                </button>
              </div>
            </div>

            <!-- 5. Up Next Queue Preview -->
            <div class="home-genre-card" style="padding: var(--space-4);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: #ffffff;">Up Next</span>
                <button id="home-clear-queue-btn" style="background: transparent; border: none; color: var(--color-text-muted); font-size: 11px; cursor: pointer;">Clear</button>
              </div>

              <div id="home-queue-list-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
                <div style="font-size: var(--font-size-xs); color: var(--color-text-muted); padding: 8px 0; text-align: center;">Queue is empty.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.renderDynamicSections();
    this.bindStaticEvents();
  }

  private renderDefaultMixCards(): string {
    const mixes = [
      { title: 'Discover Weekly', subtitle: 'Made for You', icon: 'sparkles', bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' },
      { title: 'Chill Mix', subtitle: 'Relax and Unwind', icon: 'moon', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
      { title: 'Workout Mix', subtitle: 'Keep Going', icon: 'flame', bg: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)' },
      { title: 'Focus Mix', subtitle: 'Deep Work', icon: 'headphones', bg: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' },
      { title: 'Feel Good Mix', subtitle: 'Positive Vibes', icon: 'sun', bg: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)' },
      { title: 'Party Mix', subtitle: 'Turn It Up', icon: 'radio', bg: 'linear-gradient(135deg, #3b0764 0%, #581c87 100%)' }
    ] as const;

    return mixes
      .map(
        mix => `
        <div class="home-mix-card" data-mix-title="${mix.title}">
          <div class="home-mix-artwork" style="background: ${mix.bg};">
            <span style="color: #ffffff; opacity: 0.9;">${getIconSvg(mix.icon as any, { size: 36 })}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${mix.title}
            </span>
            <span style="font-size: 11px; color: var(--color-text-muted);">
              ${mix.subtitle}
            </span>
          </div>
        </div>
      `
      )
      .join('');
  }

  private async loadData(): Promise<void> {
    if (!this.libraryService) {
      this.renderEmptyState();
      return;
    }

    try {
      const [tracksRes, artistsRes, statsRes, playlistsRes] = await Promise.all([
        this.libraryService.listTracks({ limit: 10 }),
        this.libraryService.listArtists({ limit: 8 }),
        this.libraryService.getLibraryStats().catch(() => ({ trackCount: 0, albumCount: 0, artistCount: 0 })),
        this.playlistService ? this.playlistService.listPlaylists({ limit: 6 }).catch(() => ({ items: [], total: 0 })) : Promise.resolve({ items: [], total: 0 })
      ]);

      this.recentTracks = tracksRes?.items ?? [];
      this.topArtists = artistsRes?.items ?? [];
      this.realPlaylists = (playlistsRes as any)?.items ?? [];
      this.libraryStats = {
        trackCount: statsRes.trackCount || this.recentTracks.length,
        albumCount: statsRes.albumCount || 0,
        artistCount: statsRes.artistCount || this.topArtists.length,
        playlistCount: (playlistsRes as any)?.total || 0
      };

      this.updateStatsDisplay();
      this.renderTrackCards();
      this.renderTopArtists();
      this.renderPlaylistsGrid();
      this.renderFavoritesGrid();
      this.renderRecentlyAddedGrid();
      this.renderMostPlayedGrid();
      this.renderAlbumsGrid();
      this.renderGenresGrid();
      this.renderFoldersGrid();
      this.renderQueuePreview();
    } catch {
      this.renderEmptyState();
    }
  }

  private updateStatsDisplay(): void {
    if (!this.container) return;
    const songEl = this.container.querySelector('#stat-song-count');
    const artistEl = this.container.querySelector('#stat-artist-count');
    const albumEl = this.container.querySelector('#stat-album-count');
    const playlistEl = this.container.querySelector('#stat-playlist-count');

    if (songEl) songEl.textContent = this.libraryStats.trackCount.toLocaleString();
    if (artistEl) artistEl.textContent = this.libraryStats.artistCount.toLocaleString();
    if (albumEl) albumEl.textContent = this.libraryStats.albumCount.toLocaleString();
    if (playlistEl) playlistEl.textContent = this.libraryStats.playlistCount.toLocaleString();

    // Mobile stats
    const mobLiked = this.container.querySelector('#mobile-liked-count');
    const mobRecent = this.container.querySelector('#mobile-recent-count');
    const mobLib = this.container.querySelector('#mobile-lib-count');

    if (mobLiked) mobLiked.textContent = `${this.libraryStats.playlistCount > 0 ? this.libraryStats.playlistCount : 0} lists`;
    if (mobRecent) mobRecent.textContent = `${this.recentTracks.length} tracks`;
    if (mobLib) mobLib.textContent = `${this.libraryStats.trackCount} songs`;
  }

  private renderTrackCards(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#home-recent-tracks-container');
    if (!container) return;

    if (this.recentTracks.length === 0) {
      this.renderEmptyState();
      return;
    }

    container.innerHTML = this.recentTracks
      .slice(0, 5)
      .map(
        track => `
        <div class="home-track-card" data-track-id="${track.id}">
          <div class="home-track-artwork" id="home-art-${track.id}">
            <span style="color: var(--color-text-muted);">${getIconSvg('music', { size: 28 })}</span>
            <div class="home-play-overlay" data-play-id="${track.id}" aria-label="Play ${this.escapeHtml(track.title)}">
              ${getIconSvg('play', { size: 18, color: '#ffffff' })}
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-width: 0; flex: 1;">
            <span title="${this.escapeHtml(track.title)}" style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(track.title)}
            </span>
            <span title="${this.escapeHtml(track.artistName ?? 'Unknown Artist')}" style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(track.artistName ?? 'Unknown Artist')}
            </span>
          </div>
        </div>
      `
      )
      .join('');

    // Fetch artwork asynchronously
    if (this.artworkService) {
      for (const track of this.recentTracks.slice(0, 5)) {
        const artId = (track as any).artworkId || track.albumId;
        if (artId) {
          void this.artworkService.getArtworkUrl(artId, 'medium').then(url => {
            if (!url || !this.container) return;
            const artEl = this.container.querySelector(`#home-art-${track.id}`);
            if (artEl) {
              artEl.innerHTML = `
                <img src="${url}" alt="Artwork" style="width: 100%; height: 100%; object-fit: cover;" />
                <div class="home-play-overlay" data-play-id="${track.id}" aria-label="Play ${this.escapeHtml(track.title)}">
                  ${getIconSvg('play', { size: 18, color: '#ffffff' })}
                </div>
              `;
            }
          });
        }
      }
    }

    // Bind play actions on track cards
    const cardElements = container.querySelectorAll<HTMLElement>('.home-track-card');
    cardElements.forEach(card => {
      const trackId = card.getAttribute('data-track-id');
      const track = this.recentTracks.find(t => t.id === trackId);
      if (!track) return;

      card.addEventListener('click', () => {
        if (this.playbackManager) {
          void this.playbackManager.playTrack(track, [...this.recentTracks]);
        }
      });
    });
  }

  private renderTopArtists(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#home-top-artists-container');
    if (!container) return;

    if (this.topArtists.length === 0) {
      container.innerHTML = `<div style="font-size: var(--font-size-xs); color: var(--color-text-muted);">No artists discovered yet.</div>`;
      return;
    }

    container.innerHTML = this.topArtists
      .slice(0, 8)
      .map(
        artist => `
        <div class="home-artist-item" data-artist-id="${this.escapeHtml(artist.id)}" style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0;">
          <div class="home-artist-avatar" id="home-artist-art-${this.escapeHtml(artist.id)}">
            ${this.escapeHtml(artist.name ? artist.name.charAt(0).toUpperCase() : '♫')}
          </div>
          <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #ffffff; max-width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;">
            ${this.escapeHtml(artist.name || 'Unknown')}
          </span>
        </div>
      `
      )
      .join('');

    // Fetch artist artwork if available
    if (this.artworkService) {
      for (const artist of this.topArtists.slice(0, 8)) {
        if (artist.artworkId) {
          void this.artworkService.getArtworkUrl(artist.artworkId, 'small').then(url => {
            if (!url || !this.container) return;
            const artEl = this.container.querySelector(`#home-artist-art-${artist.id}`);
            if (artEl) {
              artEl.innerHTML = `<img src="${url}" alt="${this.escapeHtml(artist.name)}" style="width: 100%; height: 100%; object-fit: cover;" />`;
            }
          });
        }
      }
    }

    // Bind artist click -> navigate to Library artists tab
    container.querySelectorAll<HTMLElement>('.home-artist-item').forEach(el => {
      el.addEventListener('click', () => {
        const artistId = el.getAttribute('data-artist-id');
        if (artistId && this.router) {
          this.router.navigate('library', { tab: 'artists', id: artistId });
        }
      });
    });
  }

  private renderQueuePreview(): void {
    if (!this.container) return;
    const queueContainer = this.container.querySelector('#home-queue-list-container');
    if (!queueContainer) return;

    const pm = this.playbackManager;
    const pmTracks = pm?.getTracks ? pm.getTracks() : [];
    const queue = pmTracks.length > 0 ? pmTracks : this.recentTracks.slice(0, 5);
    const currentIndex = pm?.currentQueueIndex ?? -1;

    if (queue.length === 0) {
      queueContainer.innerHTML = `<div style="font-size: var(--font-size-xs); color: var(--color-text-muted); padding: 8px 0; text-align: center;">Queue is empty.</div>`;
      return;
    }

    queueContainer.innerHTML = queue
      .slice(0, 5)
      .map((item, idx) => {
        const isCurrent = idx === currentIndex;
        const track: Track | undefined = 'track' in item ? (item as any).track : (item as Track);
        const title = track?.title || 'Unknown Title';
        const artist = track?.artistName || 'Unknown Artist';
        const durationFormatted = this.formatDuration(track?.durationMs || 0);

        return `
          <div class="home-queue-row" data-queue-index="${idx}">
            <span style="font-size: 11px; font-weight: var(--font-weight-bold); color: ${isCurrent ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)'}; width: 16px; text-align: center;">
              ${idx + 1}
            </span>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
              <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: ${isCurrent ? 'var(--color-accent-cyan)' : '#ffffff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${this.escapeHtml(title)}
              </span>
              <span style="font-size: 10px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${this.escapeHtml(artist)}
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

    queueContainer.querySelectorAll<HTMLElement>('.home-queue-row').forEach(row => {
      row.addEventListener('click', () => {
        const qIdx = Number(row.getAttribute('data-queue-index'));
        if (this.playbackManager) {
          if (this.playbackManager.queue.length > qIdx) {
            void this.playbackManager.playQueueIndex(qIdx);
          } else if (this.recentTracks[qIdx]) {
            void this.playbackManager.playTrack(this.recentTracks[qIdx]!, [...this.recentTracks]);
          }
        }
      });
    });
  }

  private renderEmptyState(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#home-recent-tracks-container');
    if (!container) return;

    container.innerHTML = `
      <div style="
        grid-column: 1 / -1;
        padding: var(--space-8);
        text-align: center;
        border-radius: var(--radius-2xl);
        background: var(--glass-bg-subtle);
        border: 1px dashed var(--glass-border);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3);
      ">
        <div style="color: var(--color-accent-purple-glow);">${getIconSvg('music', { size: 40 })}</div>
        <h4 style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold); color: #ffffff; margin: 0;">Your Library is Ready</h4>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); max-width: 400px; line-height: 1.5; margin: 0;">
          Connect local music folders to listen with lossless audio purity, 10-band EQ, and zero ads.
        </p>
        <button id="home-empty-scan-btn" style="
          margin-top: var(--space-2);
          padding: 10px 24px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-accent-purple), #9333ea);
          color: #ffffff;
          border: none;
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-xs);
          cursor: pointer;
        ">
          Open Library
        </button>
      </div>
    `;

    this.container.querySelector('#home-empty-scan-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });
  }

  private subscribeEvents(): void {
    if (!this.eventBus) return;

    this.subscriptions.push(
      this.eventBus.subscribe('playback:state-changed', () => {
        this.renderQueuePreview();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe('playback:track-changed', () => {
        this.renderQueuePreview();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe('library:scanned', () => {
        void this.loadData();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe('dashboard:settings-changed', () => {
        this.renderDynamicSections();
        void this.loadData();
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(DomainEvents.PLAYLIST_UPDATED, () => {
        void this.loadData();
      })
    );
  }

  private renderDynamicSections(): void {
    if (!this.container) return;
    const sectionsWrapper = this.container.querySelector('#home-dynamic-sections-container');
    if (!sectionsWrapper) return;

    const resolved = this.dashboardService
      ? this.dashboardService.getResolvedSections()
      : SUPPORTED_DASHBOARD_SECTIONS.map((sec, idx) => ({
          id: sec.id,
          label: sec.label,
          visible: true,
          enabled: true,
          order: idx
        }));

    const enabledSections = resolved.filter(s => s.enabled);

    if (enabledSections.length === 0) {
      sectionsWrapper.innerHTML = `
        <div style="
          padding: var(--space-8);
          text-align: center;
          border-radius: var(--radius-2xl);
          background: var(--glass-bg-subtle);
          border: 1px dashed var(--glass-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
        ">
          <div style="color: var(--color-accent-purple-glow);">${getIconSvg('grid', { size: 40 })}</div>
          <h3 style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: #ffffff; margin: 0;">All Dashboard Sections Hidden</h3>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); max-width: 420px; line-height: 1.5; margin: 0;">
            All dashboard sections are currently hidden in your customization settings. Restore defaults to show home sections.
          </p>
          <button id="home-restore-defaults-btn" class="home-hero-btn-play" style="margin-top: var(--space-2); cursor: pointer;">
            Restore Default Layout
          </button>
        </div>
      `;

      sectionsWrapper.querySelector('#home-restore-defaults-btn')?.addEventListener('click', () => {
        if (this.dashboardService) {
          void this.dashboardService.resetToDefaults();
        }
      });
      return;
    }

    sectionsWrapper.innerHTML = enabledSections
      .map(sec => this.getSectionMarkup(sec.id, sec.label))
      .join('');

    this.bindDynamicSectionEvents();
  }

  private getSectionMarkup(id: DashboardSectionId, label: string): string {
    switch (id) {
      case 'recently-played':
        return `
          <section class="home-section" id="home-section-recently-played" aria-label="Recently Played">
            <div class="home-section-header">
              <h2 class="home-section-title">Trending Now</h2>
              <button class="home-see-all-btn" id="see-all-recent-btn" aria-label="See all recently played">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-recent-tracks-container" class="home-track-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading tracks...
              </div>
            </div>
          </section>
        `;
      case 'playlists':
        return `
          <section class="home-section" id="home-section-playlists" aria-label="Playlists & Mixes">
            <div class="home-section-header">
              <h2 class="home-section-title">Made For You</h2>
              <button class="home-see-all-btn" id="see-all-mixes-btn" aria-label="See all mixes">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-mixes-container" class="home-mix-grid">
              ${this.renderDefaultMixCards()}
            </div>
          </section>
        `;
      case 'artists':
        return `
          <section class="home-section" id="home-section-artists" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-artists-btn" aria-label="See all artists">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-top-artists-container" style="display: flex; gap: var(--space-5); overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; overscroll-behavior-x: contain;">
              <div style="padding: 24px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-xs);">
                Loading artists...
              </div>
            </div>
          </section>
        `;
      case 'favorites':
        return `
          <section class="home-section" id="home-section-favorites" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-favorites-btn" aria-label="See all favorites">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-favorites-container" class="home-track-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading favorites...
              </div>
            </div>
          </section>
        `;
      case 'recently-added':
        return `
          <section class="home-section" id="home-section-recently-added" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-added-btn" aria-label="See all recently added">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-recently-added-container" class="home-track-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading recently added...
              </div>
            </div>
          </section>
        `;
      case 'most-played':
        return `
          <section class="home-section" id="home-section-most-played" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-most-played-btn" aria-label="See all most played">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-most-played-container" class="home-track-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading most played...
              </div>
            </div>
          </section>
        `;
      case 'albums':
        return `
          <section class="home-section" id="home-section-albums" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-albums-btn" aria-label="See all albums">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-albums-container" class="home-mix-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading albums...
              </div>
            </div>
          </section>
        `;
      case 'genres':
        return `
          <section class="home-section" id="home-section-genres" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-genres-btn" aria-label="See all genres">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-genres-container" class="home-mix-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading genres...
              </div>
            </div>
          </section>
        `;
      case 'folders':
        return `
          <section class="home-section" id="home-section-folders" aria-label="${label}">
            <div class="home-section-header">
              <h2 class="home-section-title">${label}</h2>
              <button class="home-see-all-btn" id="see-all-folders-btn" aria-label="See all folders">
                <span>See all</span>
                <span>${getIconSvg('chevron-right', { size: 14 })}</span>
              </button>
            </div>
            <div id="home-folders-container" class="home-mix-grid">
              <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm);">
                Loading folders...
              </div>
            </div>
          </section>
        `;
      default:
        return '';
    }
  }

  private bindDynamicSectionEvents(): void {
    if (!this.container) return;

    this.container.querySelector('#see-all-recent-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#see-all-mixes-btn')?.addEventListener('click', () => {
      this.router?.navigate('playlists');
    });

    this.container.querySelector('#see-all-artists-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'artists' });
    });

    this.container.querySelector('#see-all-favorites-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'favorites' });
    });

    this.container.querySelector('#see-all-added-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#see-all-most-played-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#see-all-albums-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'albums' });
    });

    this.container.querySelector('#see-all-genres-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'genres' });
    });

    this.container.querySelector('#see-all-folders-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'folders' });
    });
  }

  private renderPlaylistsGrid(): void {
    if (!this.container) return;
    const container = this.container.querySelector<HTMLElement>('#home-mixes-container');
    if (!container) return;

    if (this.realPlaylists.length === 0) {
      container.innerHTML = this.renderDefaultMixCards();
      const mixCards = container.querySelectorAll<HTMLElement>('.home-mix-card');
      mixCards.forEach(card => {
        card.addEventListener('click', () => {
          if (this.recentTracks.length > 0 && this.playbackManager) {
            const randomIdx = Math.floor(Math.random() * this.recentTracks.length);
            void this.playbackManager.playTrack(this.recentTracks[randomIdx]!, [...this.recentTracks]);
          } else {
            this.router?.navigate('playlists');
          }
        });
      });
      return;
    }

    container.innerHTML = this.realPlaylists
      .map(
        pl => `
        <div class="home-mix-card" data-playlist-id="${this.escapeHtml(pl.id)}" role="button" tabindex="0" aria-label="Open playlist ${this.escapeHtml(pl.name)}" style="cursor: pointer;">
          <div class="home-mix-artwork" style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.25) 50%, rgba(6, 182, 212, 0.2) 100%);">
            <span style="color: var(--color-accent-purple-glow);">${getIconSvg('playlist', { size: 36 })}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(pl.name)}">
              ${this.escapeHtml(pl.name)}
            </span>
            <span style="font-size: 11px; color: var(--color-text-muted);">
              ${pl.trackCount ?? 0} ${pl.trackCount === 1 ? 'song' : 'songs'}
            </span>
          </div>
        </div>
      `
      )
      .join('');

    const cards = container.querySelectorAll<HTMLElement>('.home-mix-card');
    cards.forEach(card => {
      const id = card.getAttribute('data-playlist-id');
      if (id) {
        card.addEventListener('click', () => {
          this.router?.navigate('playlists', { id });
        });
        card.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.router?.navigate('playlists', { id });
          }
        });
      }
    });
  }

  private renderFavoritesGrid(): void {
    const favorites = this.recentTracks.filter(t => (t as any).isFavorite);
    const displayTracks = favorites.length > 0 ? favorites : this.recentTracks.slice(0, 5);
    this.renderGenericTrackGrid('home-favorites-container', displayTracks, 'No favorite tracks yet.');
  }

  private renderRecentlyAddedGrid(): void {
    this.renderGenericTrackGrid('home-recently-added-container', this.recentTracks.slice(0, 5), 'No recently added tracks.');
  }

  private renderMostPlayedGrid(): void {
    this.renderGenericTrackGrid('home-most-played-container', this.recentTracks.slice(0, 5), 'No play history recorded.');
  }

  private renderAlbumsGrid(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#home-albums-container');
    if (!container) return;

    const sampleAlbums = [
      { title: 'Cybernetic Echoes', subtitle: 'Synthwave • 12 Tracks', bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' },
      { title: 'Neon Horizon', subtitle: 'Electronic • 10 Tracks', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
      { title: 'Midnight Chill', subtitle: 'Ambient • 8 Tracks', bg: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' }
    ];

    container.innerHTML = sampleAlbums.map(album => `
      <div class="home-mix-card" style="cursor: pointer;">
        <div class="home-mix-artwork" style="background: ${album.bg};">
          <span style="color: #ffffff; opacity: 0.9;">${getIconSvg('disc', { size: 36 })}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${album.title}
          </span>
          <span style="font-size: 11px; color: var(--color-text-muted);">
            ${album.subtitle}
          </span>
        </div>
      </div>
    `).join('');
  }

  private renderGenresGrid(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#home-genres-container');
    if (!container) return;

    const genres = [
      { name: 'Pop', tracks: '28% of library', color: 'var(--color-accent-pink)' },
      { name: 'Hip Hop', tracks: '22% of library', color: 'var(--color-accent-purple-glow)' },
      { name: 'Rock', tracks: '15% of library', color: 'var(--color-accent-cyan)' }
    ];

    container.innerHTML = genres.map(genre => `
      <div class="home-mix-card" style="cursor: pointer;">
        <div class="home-mix-artwork" style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--glass-border); flex-direction: column;">
          <span style="color: ${genre.color};">${getIconSvg('sparkles', { size: 28 })}</span>
          <span style="font-size: 13px; font-weight: 700; color: #ffffff; margin-top: 4px;">${genre.name}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 11px; color: var(--color-text-muted); text-align: center;">${genre.tracks}</span>
        </div>
      </div>
    `).join('');
  }

  private renderFoldersGrid(): void {
    if (!this.container) return;
    const container = this.container.querySelector('#home-folders-container');
    if (!container) return;

    const folders = [
      { name: 'Music Library', sub: 'Local Audio', icon: 'folder' },
      { name: 'Downloads', sub: 'Imported Files', icon: 'folder' },
      { name: 'Lossless Audio', sub: 'FLAC / WAV', icon: 'folder' }
    ];

    container.innerHTML = folders.map(f => `
      <div class="home-mix-card" style="cursor: pointer;">
        <div class="home-mix-artwork" style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--glass-border);">
          <span style="color: var(--color-accent-cyan);">${getIconSvg(f.icon as any, { size: 32 })}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${f.name}
          </span>
          <span style="font-size: 11px; color: var(--color-text-muted);">${f.sub}</span>
        </div>
      </div>
    `).join('');
  }

  private renderGenericTrackGrid(containerId: string, tracks: readonly Track[], emptyMessage: string): void {
    if (!this.container) return;
    const container = this.container.querySelector(`#${containerId}`);
    if (!container) return;

    if (tracks.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--color-text-muted); font-size: var(--font-size-xs);">${emptyMessage}</div>`;
      return;
    }

    container.innerHTML = tracks
      .slice(0, 5)
      .map(
        track => `
        <div class="home-track-card" data-track-id="${track.id}">
          <div class="home-track-artwork" id="home-art-${containerId}-${track.id}">
            <span style="color: var(--color-text-muted);">${getIconSvg('music', { size: 28 })}</span>
            <div class="home-play-overlay" data-play-id="${track.id}" aria-label="Play ${this.escapeHtml(track.title)}">
              ${getIconSvg('play', { size: 18, color: '#ffffff' })}
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-width: 0; flex: 1;">
            <span title="${this.escapeHtml(track.title)}" style="font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(track.title)}
            </span>
            <span title="${this.escapeHtml(track.artistName ?? 'Unknown Artist')}" style="font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(track.artistName ?? 'Unknown Artist')}
            </span>
          </div>
        </div>
      `
      )
      .join('');

    const cardElements = container.querySelectorAll<HTMLElement>('.home-track-card');
    cardElements.forEach(card => {
      const trackId = card.getAttribute('data-track-id');
      const track = tracks.find(t => t.id === trackId);
      if (!track) return;

      card.addEventListener('click', () => {
        if (this.playbackManager) {
          void this.playbackManager.playTrack(track, [...tracks]);
        }
      });
    });
  }

  public getSlides(): readonly DashboardHeroSlide[] {
    return HERO_SLIDES;
  }

  public getActiveSlideIndex(): number {
    return this.activeSlideIndex;
  }

  public getActiveSlide(): DashboardHeroSlide {
    return HERO_SLIDES[this.activeSlideIndex] ?? HERO_SLIDES[0]!;
  }

  public setActiveSlide(index: number): void {
    if (index < 0 || index >= HERO_SLIDES.length) {
      return;
    }
    this.activeSlideIndex = index;
    this.updateHeroSlideDisplay();
  }

  public nextSlide(): void {
    const next = (this.activeSlideIndex + 1) % HERO_SLIDES.length;
    this.setActiveSlide(next);
  }

  public prevSlide(): void {
    const prev = (this.activeSlideIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
    this.setActiveSlide(prev);
  }

  private updateHeroSlideDisplay(): void {
    if (!this.container) return;
    const slide = this.getActiveSlide();
    const heroCard = this.container.querySelector<HTMLElement>('.home-hero-card');
    if (!heroCard) return;

    heroCard.setAttribute('data-variant', slide.variant);

    const greetingEl = heroCard.querySelector('.home-hero-greeting');
    if (greetingEl) {
      greetingEl.innerHTML = `
        ${getIconSvg(slide.eyebrowIcon, { size: 14, color: 'var(--color-accent-cyan)' })}
        <span>${this.escapeHtml(slide.eyebrow)}</span>
      `;
    }

    const titleEl = heroCard.querySelector('.home-hero-title');
    if (titleEl) {
      titleEl.innerHTML = slide.title;
    }

    const subtitleEl = heroCard.querySelector('.home-hero-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = slide.description;
    }

    const playBtnSpan = heroCard.querySelector('#home-hero-play-btn span');
    if (playBtnSpan) {
      playBtnSpan.textContent = slide.primaryActionLabel;
    }
    const playBtn = heroCard.querySelector('#home-hero-play-btn');
    if (playBtn) {
      playBtn.setAttribute('aria-label', slide.primaryActionLabel);
    }

    const shuffleBtnSpan = heroCard.querySelector('#home-hero-shuffle-btn span');
    if (shuffleBtnSpan) {
      shuffleBtnSpan.textContent = slide.secondaryActionLabel;
    }
    const shuffleBtn = heroCard.querySelector('#home-hero-shuffle-btn');
    if (shuffleBtn) {
      shuffleBtn.setAttribute('aria-label', slide.secondaryActionLabel);
    }

    const taglinePrimary = heroCard.querySelector('.home-hero-tagline-primary');
    if (taglinePrimary) {
      taglinePrimary.textContent = slide.secondaryLine1;
    }

    const taglineSecondary = heroCard.querySelector('.home-hero-tagline-secondary');
    if (taglineSecondary) {
      taglineSecondary.textContent = slide.secondaryLine2;
    }

    const dots = heroCard.querySelectorAll<HTMLElement>('.home-hero-dot');
    dots.forEach((dot) => {
      const dotIdx = parseInt(dot.getAttribute('data-slide-index') || '-1', 10);
      const isSelected = dotIdx === this.activeSlideIndex;
      dot.classList.toggle('active', isSelected);
      dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      dot.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
  }

  private bindStaticEvents(): void {
    if (!this.container) return;

    // Hero Slideshow Controls
    this.container.querySelector('#home-hero-prev-btn')?.addEventListener('click', () => {
      this.prevSlide();
    });

    this.container.querySelector('#home-hero-next-btn')?.addEventListener('click', () => {
      this.nextSlide();
    });

    const dotElements = this.container.querySelectorAll<HTMLElement>('[data-slide-index]');
    dotElements.forEach((dot) => {
      dot.addEventListener('click', () => {
        const slideIdx = parseInt(dot.getAttribute('data-slide-index') || '0', 10);
        this.setActiveSlide(slideIdx);
        dot.focus();
      });

      dot.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.nextSlide();
          const nextIdx = this.activeSlideIndex;
          const nextDot = this.container?.querySelector<HTMLElement>(`#hero-tab-${nextIdx}`);
          nextDot?.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.prevSlide();
          const prevIdx = this.activeSlideIndex;
          const prevDot = this.container?.querySelector<HTMLElement>(`#hero-tab-${prevIdx}`);
          prevDot?.focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          this.setActiveSlide(0);
          const firstDot = this.container?.querySelector<HTMLElement>('#hero-tab-0');
          firstDot?.focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          this.setActiveSlide(HERO_SLIDES.length - 1);
          const lastDot = this.container?.querySelector<HTMLElement>(`#hero-tab-${HERO_SLIDES.length - 1}`);
          lastDot?.focus();
        }
      });
    });

    // Hero Play / Shuffle
    this.container.querySelector('#home-hero-play-btn')?.addEventListener('click', () => {
      if (this.recentTracks.length > 0 && this.playbackManager) {
        void this.playbackManager.playTrack(this.recentTracks[0]!, [...this.recentTracks]);
      } else {
        this.router?.navigate('library');
      }
    });

    this.container.querySelector('#home-hero-shuffle-btn')?.addEventListener('click', () => {
      if (this.recentTracks.length > 0 && this.playbackManager) {
        const shuffled = [...this.recentTracks].sort(() => Math.random() - 0.5);
        void this.playbackManager.playTrack(shuffled[0]!, shuffled);
      } else {
        this.router?.navigate('library');
      }
    });

    // Mood filter pills
    const moodPills = this.container.querySelectorAll<HTMLElement>('.home-mood-pill');
    moodPills.forEach(pill => {
      pill.addEventListener('click', () => {
        moodPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeMood = pill.getAttribute('data-mood') || 'For You';
      });
    });

    // See all navigation
    this.container.querySelector('#see-all-recent-btn')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#see-all-mixes-btn')?.addEventListener('click', () => {
      this.router?.navigate('playlists');
    });

    this.container.querySelector('#see-all-artists-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'artists' });
    });

    this.container.querySelector('#genre-see-all-btn')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'genres' });
    });

    // Clear queue button
    this.container.querySelector('#home-clear-queue-btn')?.addEventListener('click', () => {
      if (this.playbackManager) {
        void this.playbackManager.clearQueue();
        this.renderQueuePreview();
      }
    });

    // Quick Actions
    this.container.querySelector('#action-create-playlist')?.addEventListener('click', () => {
      this.router?.navigate('playlists');
    });

    this.container.querySelector('#action-liked-songs')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'favorites' });
    });

    this.container.querySelector('#action-library-downloads')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#action-audio-galaxy')?.addEventListener('click', () => {
      this.router?.navigate('galaxy');
    });

    // Mobile 4-Tile Quick Access Buttons
    this.container.querySelector('#mobile-quick-liked')?.addEventListener('click', () => {
      this.router?.navigate('library', { tab: 'favorites' });
    });

    this.container.querySelector('#mobile-quick-recents')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#mobile-quick-downloads')?.addEventListener('click', () => {
      this.router?.navigate('library');
    });

    this.container.querySelector('#mobile-quick-stats')?.addEventListener('click', () => {
      this.router?.navigate('galaxy');
    });

    // Mix cards click
    const mixCards = this.container.querySelectorAll<HTMLElement>('.home-mix-card');
    mixCards.forEach(card => {
      card.addEventListener('click', () => {
        if (this.recentTracks.length > 0 && this.playbackManager) {
          const randomIdx = Math.floor(Math.random() * this.recentTracks.length);
          void this.playbackManager.playTrack(this.recentTracks[randomIdx]!, [...this.recentTracks]);
        } else {
          this.router?.navigate('playlists');
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

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
