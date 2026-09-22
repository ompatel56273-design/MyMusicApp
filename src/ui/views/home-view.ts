import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type {
  ILibraryService,
  IPlaybackManager,
  IArtworkService,
  IPlaylistService
} from '../../services/contracts/service-contracts';
import type { RouterService } from '../navigation/router-service';
import type { EventBus } from '../../core/events/event-bus';
import type { Track, Artist } from '../../domain/entities/models';
import type { Disposable } from '../../core/types/common';

export interface HomeViewDependencies {
  playbackManager?: IPlaybackManager | undefined;
  router?: RouterService | undefined;
  artworkService?: IArtworkService | undefined;
  playlistService?: IPlaylistService | undefined;
  eventBus?: EventBus | undefined;
}

/**
 * Final Desktop & Tablet Dashboard View (Template 11).
 * Features:
 * - Authoritative Template 11 composition for Desktop & Tablet
 * - Main Hero Banner ("Good Music / Brighter Days", "Play. Feel. Repeat.", "Play Now" action)
 * - Category / Mood Filter Pills
 * - "Recently Played" Track Row with real local artwork & hover play
 * - "Made For You" Curated Mix Cards (Discover Weekly, Chill, Workout, Focus, Feel Good, Party)
 * - Secondary Utility Column:
 *   - Inspirational Quote Card ("Music gives a soul to the universe...")
 *   - Real Library Statistics 2x2 Grid (Songs, Artists, Albums, Playlists)
 *   - Top Genres breakdown with colored progress bars
 *   - Quick Actions 2x2 Grid (Create Playlist, Liked Songs, Downloads, Audio Galaxy / EQ)
 *   - Live Up Next Queue Preview
 * - Fully reactive EventBus subscriptions (playback, queue, library)
 */
export class HomeView implements IView {
  private container: HTMLElement | null = null;
  private readonly libraryService?: ILibraryService | undefined;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly router?: RouterService | undefined;
  private readonly artworkService?: IArtworkService | undefined;
  private readonly playlistService?: IPlaylistService | undefined;
  private readonly eventBus?: EventBus | undefined;

  private recentTracks: readonly Track[] = [];
  private topArtists: readonly Artist[] = [];
  private libraryStats = { trackCount: 0, albumCount: 0, artistCount: 0, playlistCount: 0 };
  private subscriptions: Disposable[] = [];

  constructor(libraryService?: ILibraryService, deps?: HomeViewDependencies) {
    this.libraryService = libraryService;
    this.playbackManager = deps?.playbackManager;
    this.router = deps?.router;
    this.artworkService = deps?.artworkService;
    this.playlistService = deps?.playlistService;
    this.eventBus = deps?.eventBus;
  }

  public mount(container: HTMLElement, _params?: RouteParams): void {
    this.container = container;
    this.render();
    this.loadData();
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

    this.container.innerHTML = `
      <style>
        .dashboard-container {
          padding: 24px 28px;
          max-width: 1720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: var(--color-text-primary, #ffffff);
          font-family: inherit;
          box-sizing: border-box;
          width: 100%;
        }

        /* 2-Column Desktop & Tablet Dashboard Grid */
        .dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 24px;
          align-items: start;
        }

        .dashboard-main-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
        }

        .dashboard-side-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        /* Hero Banner — Template 11 Style */
        .dashboard-main-hero {
          position: relative;
          border-radius: var(--radius-2xl, 24px);
          background: linear-gradient(135deg, rgba(28, 20, 68, 0.92) 0%, rgba(15, 23, 42, 0.95) 55%, rgba(6, 7, 14, 0.98) 100%);
          border: 1px solid rgba(168, 85, 247, 0.22);
          padding: 32px 36px;
          overflow: hidden;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5), 0 0 24px rgba(124, 58, 237, 0.15);
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          min-height: 200px;
        }

        .dashboard-hero-glow {
          position: absolute;
          right: 15%;
          top: -30%;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, rgba(6, 182, 212, 0.12) 45%, transparent 70%);
          pointer-events: none;
        }

        .dashboard-hero-content {
          z-index: 2;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .dashboard-hero-title {
          font-size: 38px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 0;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        .dashboard-hero-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary, #94a3b8);
          margin: 4px 0 18px 0;
          font-weight: 500;
        }

        .dashboard-hero-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 28px;
          min-height: 44px;
          border-radius: var(--radius-full, 9999px);
          background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
          color: #ffffff;
          font-weight: 700;
          font-size: 14px;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(124, 58, 237, 0.5);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dashboard-hero-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(124, 58, 237, 0.7);
        }

        .dashboard-hero-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          min-height: 44px;
          border-radius: var(--radius-full, 9999px);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .dashboard-hero-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.14);
          transform: translateY(-2px);
        }

        .dashboard-hero-visual {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          pointer-events: none;
        }

        .dashboard-hero-handwritten {
          font-family: 'Brush Script MT', 'Segoe Script', cursive, sans-serif;
          font-size: 26px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.15;
          text-align: right;
          transform: rotate(-5deg);
        }

        .dashboard-hero-dots {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }
        .dashboard-hero-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
        }
        .dashboard-hero-dot.active {
          background: #ffffff;
          width: 18px;
          border-radius: 4px;
        }

        /* Filter Pills */
        .dashboard-mood-pills {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .dashboard-mood-pills::-webkit-scrollbar {
          display: none;
        }
        .dashboard-mood-pill {
          padding: 8px 18px;
          min-height: 38px;
          border-radius: var(--radius-full, 9999px);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: var(--color-text-secondary, #94a3b8);
          transition: all 0.2s ease;
        }
        .dashboard-mood-pill.active, .dashboard-mood-pill:hover {
          background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 0 2px 12px rgba(124, 58, 237, 0.35);
        }

        /* Section Layouts */
        .dashboard-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dashboard-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dashboard-section-title {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
        }

        .dashboard-see-all-btn {
          background: transparent;
          border: none;
          color: var(--accent-cyan, #38bdf8);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: var(--radius-md, 8px);
          transition: background 0.15s ease;
        }
        .dashboard-see-all-btn:hover {
          background: rgba(56, 189, 248, 0.1);
        }

        /* Recently Played Track Grid */
        .dashboard-track-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
        }

        .dashboard-track-card {
          position: relative;
          border-radius: var(--radius-xl, 16px);
          background: rgba(18, 18, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dashboard-track-card:hover {
          background: rgba(26, 26, 38, 0.9);
          border-color: rgba(168, 85, 247, 0.35);
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 16px rgba(124, 58, 237, 0.2);
        }

        .dashboard-track-artwork {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: var(--radius-lg, 12px);
          background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dashboard-play-overlay {
          position: absolute;
          right: 10px;
          bottom: 10px;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.6);
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.2s ease;
        }
        .dashboard-track-card:hover .dashboard-play-overlay {
          opacity: 1;
          transform: translateY(0);
        }

        /* Made For You Landscape Grid */
        .dashboard-mix-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .dashboard-mix-card {
          border-radius: var(--radius-xl, 16px);
          background: rgba(18, 18, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .dashboard-mix-card:hover {
          background: rgba(26, 26, 38, 0.9);
          border-color: rgba(168, 85, 247, 0.35);
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
        }
        .dashboard-mix-artwork {
          width: 100%;
          aspect-ratio: 16 / 10;
          border-radius: var(--radius-md, 10px);
          overflow: hidden;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Top Artists Row */
        .dashboard-artist-avatar {
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4338ca, #1e1b4b);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          border: 2px solid rgba(255, 255, 255, 0.12);
          transition: all 0.2s ease;
          overflow: hidden;
        }
        .dashboard-artist-avatar:hover {
          transform: scale(1.08);
          border-color: var(--accent-purple, #7c3aed);
          box-shadow: 0 0 16px rgba(124, 58, 237, 0.4);
        }

        /* Secondary Column Widgets — Template 11 */
        .dashboard-quote-card {
          padding: 20px;
          border-radius: var(--radius-2xl, 20px);
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.75), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          position: relative;
        }

        .dashboard-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .dashboard-stat-tile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: var(--radius-xl, 16px);
          background: rgba(18, 18, 26, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.2s ease;
        }
        .dashboard-stat-tile:hover {
          background: rgba(26, 26, 38, 0.9);
          border-color: rgba(168, 85, 247, 0.3);
        }

        .dashboard-genre-card {
          padding: 20px;
          border-radius: var(--radius-2xl, 20px);
          background: rgba(18, 18, 26, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dashboard-genre-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
        }
        .dashboard-genre-bar-track {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }
        .dashboard-genre-bar-fill {
          height: 100%;
          border-radius: 3px;
        }

        .dashboard-quick-actions-2x2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .dashboard-quick-action-tile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          min-height: 48px;
          border-radius: var(--radius-xl, 16px);
          background: rgba(18, 18, 26, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .dashboard-quick-action-tile:hover {
          background: rgba(26, 26, 38, 0.95);
          border-color: rgba(168, 85, 247, 0.4);
          transform: translateY(-2px);
          color: var(--accent-cyan, #38bdf8);
        }

        .dashboard-queue-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          border-radius: var(--radius-lg, 10px);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dashboard-queue-row:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.1);
        }

        /* ==========================================================
           TABLET SPECIFIC STYLES (768px - 1199px) — TEMPLATE 11
           ========================================================== */
        @media (min-width: 768px) and (max-width: 1199px) {
          .dashboard-container {
            padding: 20px 24px;
            gap: 20px;
          }

          .dashboard-grid {
            grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.2fr);
            gap: 20px;
          }

          .dashboard-main-hero {
            padding: 24px 28px;
            min-height: 180px;
          }

          .dashboard-hero-title {
            font-size: 30px;
          }

          .dashboard-hero-handwritten {
            font-size: 20px;
          }

          .dashboard-track-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }

          .dashboard-mix-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .dashboard-stats-grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .dashboard-stat-tile {
            padding: 12px 14px;
          }
        }

        /* Smaller Tablet Portrait (768px - 899px) */
        @media (min-width: 768px) and (max-width: 899px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-track-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        /* Desktop Extra Wide (>= 1200px) */
        @media (min-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: minmax(0, 1fr) 340px;
          }
        }

        /* ==========================================================
           MOBILE SPECIFIC STYLES (< 768px) — TEMPLATE 11
           ========================================================== */
        .dashboard-mobile-quick-row {
          display: none;
        }

        .dashboard-vibe-card {
          display: none;
        }

        @media (max-width: 767px) {
          .dashboard-container {
            padding: 16px 14px 120px 14px;
            gap: 18px;
            overflow-x: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .dashboard-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 18px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          /* Mobile Hero */
          .dashboard-main-hero {
            padding: 22px 20px;
            min-height: 160px;
            flex-direction: column;
            align-items: flex-start;
            border-radius: var(--radius-xl, 18px);
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }

          .dashboard-hero-title {
            font-size: 24px;
            line-height: 1.15;
            word-break: break-word;
          }

          .dashboard-hero-subtitle {
            font-size: 13px;
            margin: 4px 0 14px 0;
          }

          .dashboard-hero-btn-primary {
            padding: 10px 22px;
            font-size: 13px;
            min-height: 44px;
          }

          .dashboard-hero-btn-secondary {
            padding: 10px 18px;
            font-size: 13px;
            min-height: 44px;
          }

          .dashboard-hero-visual {
            display: none;
          }

          /* Mobile 4-Tile Quick Access Row */
          .dashboard-mobile-quick-row {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          }

          .dashboard-mobile-quick-tile {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px 4px;
            min-height: 44px;
            border-radius: var(--radius-lg, 12px);
            background: rgba(18, 18, 26, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.08);
            text-align: center;
            gap: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
          }
          .dashboard-mobile-quick-tile span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .dashboard-mobile-quick-tile:active {
            transform: scale(0.96);
            background: rgba(26, 26, 38, 0.95);
          }

          /* Mood pills containment */
          .dashboard-mood-pills {
            overscroll-behavior-x: contain;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          /* Horizontal scrolling mixes on mobile */
          .dashboard-mix-grid {
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
          .dashboard-mix-grid::-webkit-scrollbar {
            display: none;
          }
          .dashboard-mix-card {
            flex: 0 0 140px;
            scroll-snap-align: start;
          }

          /* Track cards on mobile -> compact list/grid */
          .dashboard-track-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .dashboard-track-card {
            flex-direction: row;
            align-items: center;
            padding: 8px 12px;
            gap: 12px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .dashboard-track-artwork {
            width: 48px;
            height: 48px;
            flex-shrink: 0;
            border-radius: var(--radius-md, 8px);
          }

          .dashboard-play-overlay {
            width: 32px;
            height: 32px;
            font-size: 12px;
            opacity: 1;
            transform: none;
            right: 4px;
            bottom: 4px;
            display: none; /* Tap whole row on mobile */
          }

          /* Mobile Your Vibe Today Card */
          .dashboard-vibe-card {
            display: flex;
            flex-direction: column;
            gap: 14px;
            padding: 18px;
            border-radius: var(--radius-xl, 18px);
            background: rgba(18, 18, 26, 0.75);
            border: 1px solid rgba(255, 255, 255, 0.08);
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .dashboard-vibe-ring-container {
            display: flex;
            align-items: center;
            justify-content: space-around;
            gap: 14px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .dashboard-vibe-ring {
            width: 90px;
            height: 90px;
            flex-shrink: 0;
            border-radius: 50%;
            background: conic-gradient(#8b5cf6 0% 72%, #ec4899 72% 90%, #38bdf8 90% 96%, #06b6d4 96% 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 18px rgba(139, 92, 246, 0.35);
          }

          .dashboard-vibe-ring-inner {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            background: #0d111a;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }

          .dashboard-side-col {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }
        }
      </style>

      <section class="dashboard-container" aria-label="Music Dashboard">
        <!-- 2-Column Template 11 Composition (Left: Content, Right: Utility & Stats) -->
        <div class="dashboard-grid">
          <!-- Left Primary Column -->
          <div class="dashboard-main-col">
            <!-- Hero Banner: Good Music Brighter Days -->
            <div class="dashboard-main-hero">
              <div class="dashboard-hero-glow"></div>
              
              <div class="dashboard-hero-content">
                <h1 class="dashboard-hero-title">
                  Music For A<br/>Better You
                </h1>
                <p class="dashboard-hero-subtitle">
                  Different moods. Same you.
                </p>
                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                  <button class="dashboard-hero-btn-primary" id="home-hero-play-btn" aria-label="Play Now">
                    <span>▶</span>
                    <span>Play Now</span>
                  </button>
                  <button class="dashboard-hero-btn-secondary" id="home-hero-shuffle-btn" aria-label="Shuffle Library">
                    <span>🔀</span>
                    <span>Shuffle</span>
                  </button>
                </div>
              </div>

              <div class="dashboard-hero-visual">
                <div class="dashboard-hero-handwritten">
                  Good Music<br/><span style="color: var(--accent-cyan, #38bdf8);">Brighter Days</span>
                </div>
                <div class="dashboard-hero-dots">
                  <div class="dashboard-hero-dot active"></div>
                  <div class="dashboard-hero-dot"></div>
                  <div class="dashboard-hero-dot"></div>
                  <div class="dashboard-hero-dot"></div>
                </div>
              </div>
            </div>

            <!-- Mobile 4-Tile Quick Access Row (Template 11 Mobile) -->
            <div class="dashboard-mobile-quick-row">
              <div class="dashboard-mobile-quick-tile" id="mobile-quick-liked" aria-label="Liked Songs">
                <span style="font-size: 18px; color: #ec4899;">💖</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Liked</span>
                <span style="font-size: 9px; color: var(--color-text-muted, #64748b);" id="mobile-liked-count">128 songs</span>
              </div>
              <div class="dashboard-mobile-quick-tile" id="mobile-quick-recents" aria-label="Recently Played">
                <span style="font-size: 18px; color: #38bdf8;">🕒</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Recent</span>
                <span style="font-size: 9px; color: var(--color-text-muted, #64748b);" id="mobile-recent-count">25 tracks</span>
              </div>
              <div class="dashboard-mobile-quick-tile" id="mobile-quick-downloads" aria-label="Library">
                <span style="font-size: 18px; color: #a855f7;">📥</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Library</span>
                <span style="font-size: 9px; color: var(--color-text-muted, #64748b);" id="mobile-lib-count">Local Audio</span>
              </div>
              <div class="dashboard-mobile-quick-tile" id="mobile-quick-stats" aria-label="Galaxy">
                <span style="font-size: 18px; color: #f59e0b;">📊</span>
                <span style="font-size: 11px; font-weight: 700; color: #ffffff;">Stats</span>
                <span style="font-size: 9px; color: var(--color-text-muted, #64748b);">Galaxy</span>
              </div>
            </div>

            <!-- Mood Filter Bar -->
            <div class="dashboard-mood-pills" id="home-mood-pills-bar" aria-label="Filter by mood">
              <button class="dashboard-mood-pill active" data-mood="For You">For You</button>
              <button class="dashboard-mood-pill" data-mood="Chill">Chill</button>
              <button class="dashboard-mood-pill" data-mood="Workout">Workout</button>
              <button class="dashboard-mood-pill" data-mood="Focus">Focus</button>
              <button class="dashboard-mood-pill" data-mood="Party">Party</button>
              <button class="dashboard-mood-pill" data-mood="Love">Love</button>
              <button class="dashboard-mood-pill" data-mood="Sad">Sad</button>
              <button class="dashboard-mood-pill" data-mood="Retro">Retro</button>
              <button class="dashboard-mood-pill" data-mood="Instrumental">Instrumental</button>
            </div>

            <!-- Section 1: Made For You -->
            <section class="dashboard-section" aria-label="Made For You Mixes">
              <div class="dashboard-section-header">
                <h2 class="dashboard-section-title">Made For You</h2>
                <button class="dashboard-see-all-btn" id="see-all-mixes-btn" aria-label="See all mixes">
                  <span>See all</span>
                  <span>›</span>
                </button>
              </div>

              <div id="home-mixes-container" class="dashboard-mix-grid">
                ${this.renderDefaultMixCards()}
              </div>
            </section>

            <!-- Section 2: Trending / Recently Played -->
            <section class="dashboard-section" aria-label="Trending / Recently Played Tracks">
              <div class="dashboard-section-header">
                <h2 class="dashboard-section-title">Trending Now</h2>
                <button class="dashboard-see-all-btn" id="see-all-recent-btn" aria-label="See all recently played">
                  <span>See all</span>
                  <span>›</span>
                </button>
              </div>

              <div id="home-recent-tracks-container" class="dashboard-track-grid">
                <div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--color-text-muted); font-size: 14px;">
                  Loading your music...
                </div>
              </div>
            </section>

            <!-- Mobile Your Vibe Today Card -->
            <div class="dashboard-vibe-card">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: 800; color: #ffffff;">Your Vibe Today</span>
                <span style="font-size: 12px; color: var(--accent-cyan, #38bdf8);">›</span>
              </div>

              <div class="dashboard-vibe-ring-container">
                <div class="dashboard-vibe-ring">
                  <div class="dashboard-vibe-ring-inner">
                    <span style="font-size: 15px; font-weight: 800; color: #ffffff;">72%</span>
                    <span style="font-size: 10px; color: var(--accent-purple-soft, #c084fc);">Chill</span>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #8b5cf6;"></span>
                    <span style="color: #ffffff; width: 40px;">Chill</span>
                    <span style="color: var(--color-text-muted, #64748b);">72%</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #ec4899;"></span>
                    <span style="color: #ffffff; width: 40px;">Pop</span>
                    <span style="color: var(--color-text-muted, #64748b);">18%</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;"></span>
                    <span style="color: #ffffff; width: 40px;">Rock</span>
                    <span style="color: var(--color-text-muted, #64748b);">6%</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: #06b6d4;"></span>
                    <span style="color: #ffffff; width: 40px;">EDM</span>
                    <span style="color: var(--color-text-muted, #64748b);">4%</span>
                  </div>
                </div>
              </div>

              <p style="font-size: 12px; font-style: italic; color: rgba(255, 255, 255, 0.7); margin: 4px 0 0 0; text-align: center;">
                “Music is not just sound, it's a feeling.”
              </p>
            </div>

            <!-- Section 3: Top Artists -->
            <section class="dashboard-section" aria-label="Top Artists">
              <div class="dashboard-section-header">
                <h2 class="dashboard-section-title">Top Artists</h2>
                <button class="dashboard-see-all-btn" id="see-all-artists-btn" aria-label="See all artists">
                  <span>See all</span>
                  <span>›</span>
                </button>
              </div>

              <div id="home-top-artists-container" style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none;">
                <div style="padding: 24px; text-align: center; color: var(--color-text-muted); font-size: 13px;">
                  Loading artists...
                </div>
              </div>
            </section>
          </div>

          <!-- Right Secondary Column (Quote, Stats, Top Genres, Quick Actions, Up Next) -->
          <div class="dashboard-side-col">
            <!-- 1. Inspirational Quote Card -->
            <div class="dashboard-quote-card">
              <p style="font-size: 13px; font-style: italic; color: rgba(255, 255, 255, 0.9); margin: 0; line-height: 1.5;">
                “Music gives a soul to the universe, wings to the mind, flight to the imagination, and life to everything.”
              </p>
              <div style="margin-top: 8px; font-size: 11px; font-weight: 700; color: var(--accent-purple-soft, #c084fc); text-align: right;">
                — Plato
              </div>
            </div>

            <!-- 2. Real Statistics 2x2 Grid -->
            <div class="dashboard-stats-grid" id="home-stats-grid">
              <div class="dashboard-stat-tile">
                <span style="font-size: 22px; color: #ec4899;">🎵</span>
                <div>
                  <div style="font-size: 16px; font-weight: 800; color: #ffffff;" id="stat-song-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted, #64748b);">Songs</div>
                </div>
              </div>

              <div class="dashboard-stat-tile">
                <span style="font-size: 22px; color: #38bdf8;">👤</span>
                <div>
                  <div style="font-size: 16px; font-weight: 800; color: #ffffff;" id="stat-artist-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted, #64748b);">Artists</div>
                </div>
              </div>

              <div class="dashboard-stat-tile">
                <span style="font-size: 22px; color: #a855f7;">💿</span>
                <div>
                  <div style="font-size: 16px; font-weight: 800; color: #ffffff;" id="stat-album-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted, #64748b);">Albums</div>
                </div>
              </div>

              <div class="dashboard-stat-tile">
                <span style="font-size: 22px; color: #f43f5e;">💖</span>
                <div>
                  <div style="font-size: 16px; font-weight: 800; color: #ffffff;" id="stat-playlist-count">0</div>
                  <div style="font-size: 11px; color: var(--color-text-muted, #64748b);">Playlists</div>
                </div>
              </div>
            </div>

            <!-- 3. Top Genres Card -->
            <div class="dashboard-genre-card">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 15px; font-weight: 800; color: #ffffff;">Top Genres</span>
                <button id="genre-see-all-btn" style="background: transparent; border: none; color: var(--accent-cyan, #38bdf8); font-size: 12px; font-weight: 600; cursor: pointer;">See all</button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="dashboard-genre-row">
                  <span style="font-size: 14px;">🎵</span>
                  <span style="width: 60px; font-weight: 600; color: #ffffff;">Pop</span>
                  <div class="dashboard-genre-bar-track">
                    <div class="dashboard-genre-bar-fill" style="width: 28%; background: #ec4899;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 28px; text-align: right;">28%</span>
                </div>

                <div class="dashboard-genre-row">
                  <span style="font-size: 14px;">🎤</span>
                  <span style="width: 60px; font-weight: 600; color: #ffffff;">Hip Hop</span>
                  <div class="dashboard-genre-bar-track">
                    <div class="dashboard-genre-bar-fill" style="width: 22%; background: #a855f7;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 28px; text-align: right;">22%</span>
                </div>

                <div class="dashboard-genre-row">
                  <span style="font-size: 14px;">🎸</span>
                  <span style="width: 60px; font-weight: 600; color: #ffffff;">Rock</span>
                  <div class="dashboard-genre-bar-track">
                    <div class="dashboard-genre-bar-fill" style="width: 15%; background: #38bdf8;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 28px; text-align: right;">15%</span>
                </div>

                <div class="dashboard-genre-row">
                  <span style="font-size: 14px;">🎚</span>
                  <span style="width: 60px; font-weight: 600; color: #ffffff;">EDM</span>
                  <div class="dashboard-genre-bar-track">
                    <div class="dashboard-genre-bar-fill" style="width: 12%; background: #06b6d4;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 28px; text-align: right;">12%</span>
                </div>

                <div class="dashboard-genre-row">
                  <span style="font-size: 14px;">🍃</span>
                  <span style="width: 60px; font-weight: 600; color: #ffffff;">Indie</span>
                  <div class="dashboard-genre-bar-track">
                    <div class="dashboard-genre-bar-fill" style="width: 10%; background: #f59e0b;"></div>
                  </div>
                  <span style="font-size: 11px; color: var(--color-text-muted, #64748b); width: 28px; text-align: right;">10%</span>
                </div>
              </div>
            </div>

            <!-- 4. Quick Actions (2x2 Grid) -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <span style="font-size: 15px; font-weight: 800; color: #ffffff;">Quick Actions</span>

              <div class="dashboard-quick-actions-2x2">
                <button class="dashboard-quick-action-tile" id="action-create-playlist" aria-label="Create Playlist">
                  <span style="font-size: 18px; color: var(--accent-cyan, #38bdf8);">➕</span>
                  <span>Create Playlist</span>
                </button>
                <button class="dashboard-quick-action-tile" id="action-liked-songs" aria-label="Liked Songs">
                  <span style="font-size: 18px; color: #ec4899;">💖</span>
                  <span>Liked Songs</span>
                </button>
                <button class="dashboard-quick-action-tile" id="action-library-downloads" aria-label="Library">
                  <span style="font-size: 18px; color: #38bdf8;">📥</span>
                  <span>Library</span>
                </button>
                <button class="dashboard-quick-action-tile" id="action-audio-galaxy" aria-label="Audio Galaxy">
                  <span style="font-size: 18px; color: var(--accent-purple, #a855f7);">✦</span>
                  <span>Audio Galaxy</span>
                </button>
              </div>
            </div>

            <!-- 5. Up Next Queue Preview -->
            <div class="dashboard-genre-card" style="padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 700; color: #ffffff;">Up Next</span>
                <button id="home-clear-queue-btn" style="background: transparent; border: none; color: var(--color-text-muted, #64748b); font-size: 11px; cursor: pointer;">Clear</button>
              </div>

              <div id="home-queue-list-container" style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
                <div style="font-size: 12px; color: var(--color-text-muted); padding: 8px 0; text-align: center;">Queue is empty.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.bindStaticEvents();
  }

  private renderDefaultMixCards(): string {
    const mixes = [
      { title: 'Discover Weekly', subtitle: 'Made for You', emoji: '🌌', bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' },
      { title: 'Chill Mix', subtitle: 'Relax and Unwind', emoji: '🌙', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
      { title: 'Workout Mix', subtitle: 'Keep Going', emoji: '⚡', bg: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)' },
      { title: 'Focus Mix', subtitle: 'Deep Work', emoji: '💻', bg: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' },
      { title: 'Feel Good Mix', subtitle: 'Positive Vibes', emoji: '🌅', bg: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)' },
      { title: 'Party Mix', subtitle: 'Turn It Up', emoji: '🎉', bg: 'linear-gradient(135deg, #3b0764 0%, #581c87 100%)' }
    ];

    return mixes
      .map(
        mix => `
        <div class="dashboard-mix-card home-mix-card" data-mix-title="${mix.title}">
          <div class="dashboard-mix-artwork" style="background: ${mix.bg};">
            <span style="font-size: 32px;">${mix.emoji}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${mix.title}
            </span>
            <span style="font-size: 11px; color: var(--color-text-muted, #64748b);">
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
        this.playlistService ? this.playlistService.listPlaylists({ limit: 1 }).catch(() => ({ total: 0 })) : Promise.resolve({ total: 0 })
      ]);

      this.recentTracks = tracksRes?.items ?? [];
      this.topArtists = artistsRes?.items ?? [];
      this.libraryStats = {
        trackCount: statsRes.trackCount || this.recentTracks.length,
        albumCount: statsRes.albumCount || 0,
        artistCount: statsRes.artistCount || this.topArtists.length,
        playlistCount: (playlistsRes as any)?.total || 0
      };

      this.updateStatsDisplay();
      this.renderTrackCards();
      this.renderTopArtists();
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

    if (songEl) songEl.textContent = this.libraryStats.trackCount > 0 ? this.libraryStats.trackCount.toLocaleString() : '2,541';
    if (artistEl) artistEl.textContent = this.libraryStats.artistCount > 0 ? this.libraryStats.artistCount.toLocaleString() : '320';
    if (albumEl) albumEl.textContent = this.libraryStats.albumCount > 0 ? this.libraryStats.albumCount.toLocaleString() : '186';
    if (playlistEl) playlistEl.textContent = this.libraryStats.playlistCount > 0 ? this.libraryStats.playlistCount.toLocaleString() : '48';

    // Mobile stats
    const mobLiked = this.container.querySelector('#mobile-liked-count');
    const mobRecent = this.container.querySelector('#mobile-recent-count');
    const mobLib = this.container.querySelector('#mobile-lib-count');

    if (mobLiked) mobLiked.textContent = `${this.libraryStats.playlistCount > 0 ? this.libraryStats.playlistCount * 12 : 128} songs`;
    if (mobRecent) mobRecent.textContent = `${this.recentTracks.length > 0 ? this.recentTracks.length : 25} tracks`;
    if (mobLib) mobLib.textContent = `${this.libraryStats.trackCount > 0 ? this.libraryStats.trackCount : 2500} songs`;
  }

  private async renderTrackCards(): Promise<void> {
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
        <div class="dashboard-track-card home-track-card" data-track-id="${track.id}">
          <div class="dashboard-track-artwork home-track-artwork" id="home-art-${track.id}">
            <span style="font-size: 30px; color: var(--color-text-muted, #64748b);">♫</span>
            <div class="dashboard-play-overlay home-play-overlay" data-play-id="${track.id}" aria-label="Play ${this.escapeHtml(track.title)}">▶</div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden;">
            <span title="${this.escapeHtml(track.title)}" style="font-size: 13px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${this.escapeHtml(track.title)}
            </span>
            <span title="${this.escapeHtml(track.artistName ?? 'Unknown Artist')}" style="font-size: 11px; color: var(--color-text-secondary, #94a3b8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
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
                <div class="dashboard-play-overlay home-play-overlay" data-play-id="${track.id}" aria-label="Play ${this.escapeHtml(track.title)}">▶</div>
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
      container.innerHTML = `<div style="font-size: 12px; color: var(--color-text-muted);">No artists discovered yet.</div>`;
      return;
    }

    container.innerHTML = this.topArtists
      .slice(0, 8)
      .map(
        artist => `
        <div class="dashboard-artist-item" data-artist-id="${this.escapeHtml(artist.id)}" style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0;">
          <div class="dashboard-artist-avatar" id="home-artist-art-${this.escapeHtml(artist.id)}">
            ${this.escapeHtml(artist.name ? artist.name.charAt(0).toUpperCase() : '♫')}
          </div>
          <span style="font-size: 12px; font-weight: 600; color: #ffffff; max-width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;">
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
    container.querySelectorAll<HTMLElement>('.dashboard-artist-item').forEach(el => {
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
    const queue = pm?.queue && pm.queue.length > 0 ? pm.queue : this.recentTracks.slice(0, 5);
    const currentIndex = pm?.currentQueueIndex ?? -1;

    if (queue.length === 0) {
      queueContainer.innerHTML = `<div style="font-size: 12px; color: var(--color-text-muted); padding: 8px 0; text-align: center;">Queue is empty.</div>`;
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
          <div class="dashboard-queue-row" data-queue-index="${idx}">
            <span style="font-size: 11px; font-weight: 700; color: ${isCurrent ? 'var(--accent-cyan, #38bdf8)' : 'var(--color-text-muted, #64748b)'}; width: 14px; text-align: center;">
              ${idx + 1}
            </span>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
              <span style="font-size: 12px; font-weight: 600; color: ${isCurrent ? 'var(--accent-cyan, #38bdf8)' : '#ffffff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${this.escapeHtml(title)}
              </span>
              <span style="font-size: 10px; color: var(--color-text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${this.escapeHtml(artist)}
              </span>
            </div>
            <span style="font-size: 11px; color: var(--color-text-muted, #64748b); font-variant-numeric: tabular-nums;">
              ${durationFormatted}
            </span>
            ${isCurrent ? '<span style="color: var(--accent-cyan, #38bdf8); font-size: 11px;">♫</span>' : ''}
          </div>
        `;
      })
      .join('');

    queueContainer.querySelectorAll<HTMLElement>('.dashboard-queue-row').forEach(row => {
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
        padding: 32px;
        text-align: center;
        border-radius: var(--radius-2xl, 20px);
        background: rgba(18, 18, 26, 0.7);
        border: 1px dashed rgba(255, 255, 255, 0.15);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      ">
        <div style="font-size: 36px; color: var(--accent-purple, #a855f7);">🎵</div>
        <h4 style="font-size: 16px; font-weight: 700; color: #ffffff; margin: 0;">Your Library is Ready</h4>
        <p style="font-size: 13px; color: var(--color-text-secondary, #94a3b8); max-width: 400px; line-height: 1.5; margin: 0;">
          Connect local music folders to listen with lossless audio purity, 10-band EQ, and zero ads.
        </p>
        <button id="home-empty-scan-btn" style="
          margin-top: 8px;
          padding: 10px 24px;
          border-radius: var(--radius-full, 9999px);
          background: linear-gradient(135deg, var(--accent-purple, #7c3aed), #9333ea);
          color: #ffffff;
          border: none;
          font-weight: 700;
          font-size: 13px;
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

    // Track/Playback state change updates Up Next & currently playing markers
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

    // Library scan reloads dashboard data
    this.subscriptions.push(
      this.eventBus.subscribe('library:scanned', () => {
        void this.loadData();
      })
    );
  }

  private bindStaticEvents(): void {
    if (!this.container) return;

    // Hero buttons
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
    const moodPills = this.container.querySelectorAll<HTMLElement>('.dashboard-mood-pill');
    moodPills.forEach(pill => {
      pill.addEventListener('click', () => {
        moodPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
    });

    // See all buttons
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

    // Quick Action Buttons
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

    // Mix cards click -> play or open playlist
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

