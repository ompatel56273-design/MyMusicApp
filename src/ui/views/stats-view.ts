import type { IView } from './view-interface';
import type { RouteParams } from '../navigation/route-types';
import type { StatsService, MusicStatsOverview, TopSongItem, TopArtistItem, TopAlbumItem, RecentHistoryItem, DailyActivityItem } from '../../services/stats/stats-service';
import type { IPlaybackManager, IArtworkService } from '../../services/contracts/service-contracts';
import type { RouterService } from '../navigation/router-service';
import type { EventBus } from '../../core/events/event-bus';
import type { Disposable } from '../../core/types/common';
import { DomainEvents } from '../../domain/events/domain-events';
import { getIconSvg } from '../icons/icon-registry';

export interface StatsViewDependencies {
  statsService: StatsService;
  playbackManager?: IPlaybackManager | undefined;
  artworkService?: IArtworkService | undefined;
  router?: RouterService | undefined;
  eventBus?: EventBus | undefined;
}

/**
 * Music Statistics View.
 * Displays real library analytics, listening time, top charts, and playback history.
 */
export class StatsView implements IView {
  private container: HTMLElement | null = null;
  private readonly statsService: StatsService;
  private readonly playbackManager?: IPlaybackManager | undefined;
  private readonly eventBus?: EventBus | undefined;

  private overview: MusicStatsOverview = {
    totalSongs: 0,
    totalArtists: 0,
    totalAlbums: 0,
    totalGenres: 0,
    totalListeningTimeMs: 0,
    totalPlays: 0,
    favoriteSongsCount: 0
  };
  private topSongs: readonly TopSongItem[] = [];
  private topArtists: readonly TopArtistItem[] = [];
  private topAlbums: readonly TopAlbumItem[] = [];
  private recentHistory: readonly RecentHistoryItem[] = [];
  private activity: readonly DailyActivityItem[] = [];

  private isLoading = true;
  private subscriptions: Disposable[] = [];

  constructor(deps: StatsViewDependencies) {
    this.statsService = deps.statsService;
    this.playbackManager = deps.playbackManager;
    this.eventBus = deps.eventBus;
  }

  public mount(container: HTMLElement, _params?: RouteParams): void {
    this.container = container;
    this.render();
    void this.loadStatistics();
    this.subscribeEvents();
  }

  public unmount(): void {
    this.subscriptions.forEach(s => s.dispose());
    this.subscriptions = [];
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  private subscribeEvents(): void {
    if (!this.eventBus) return;

    // Refresh stats when playback state changes or library updates
    const sub1 = this.eventBus.subscribe(DomainEvents.PLAYBACK_STATE_CHANGED, () => {
      void this.loadStatistics();
    });
    const sub2 = this.eventBus.subscribe(DomainEvents.LIBRARY_UPDATED, () => {
      void this.loadStatistics();
    });

    this.subscriptions.push(sub1, sub2);
  }

  public async loadStatistics(): Promise<void> {
    this.isLoading = true;
    try {
      const [overview, topSongs, topArtists, topAlbums, recentHistory, activity] = await Promise.all([
        this.statsService.getOverview(),
        this.statsService.getTopSongs(10),
        this.statsService.getTopArtists(8),
        this.statsService.getTopAlbums(8),
        this.statsService.getRecentHistory(15),
        this.statsService.getListeningActivity(7)
      ]);

      this.overview = overview;
      this.topSongs = topSongs;
      this.topArtists = topArtists;
      this.topAlbums = topAlbums;
      this.recentHistory = recentHistory;
      this.activity = activity;
    } catch (err) {
      console.error('Failed to load music statistics:', err);
    } finally {
      this.isLoading = false;
      this.render();
      this.bindEvents();
    }
  }

  private formatListeningTime(ms: number): string {
    if (!ms || ms <= 0) return '0 min';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }
    return `${hours}h ${minutes}m`;
  }

  private formatDuration(ms: number): string {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private formatRelativeTime(timestamp: number): string {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;

    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  private render(): void {
    if (!this.container) return;

    if (this.isLoading) {
      this.container.innerHTML = `
        <div style="padding: var(--space-8); display: flex; align-items: center; justify-content: center; min-height: 300px; color: var(--color-text-muted);">
          <span>Loading statistics...</span>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <style>
        .stats-view-container {
          padding: var(--space-6) var(--space-8);
          max-width: 1600px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          color: var(--color-text-primary);
          font-family: var(--font-family-base);
          box-sizing: border-box;
          width: 100%;
        }

        .stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-4);
        }

        .stats-header-titles {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .stats-header-title {
          font-size: clamp(24px, 3.5vw, 32px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .stats-header-subtitle {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
          margin: 0;
        }

        .stats-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          min-height: 44px;
          min-width: 44px;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          border: 1px solid var(--glass-border);
          background: var(--color-bg-surface-elevated);
          color: var(--color-text-primary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--duration-fast);
        }

        .stats-refresh-btn:hover {
          border-color: var(--color-accent-purple-glow);
          background: rgba(255, 255, 255, 0.1);
        }

        /* Overview Metrics Cards */
        .stats-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .stats-metric-card {
          background: var(--color-bg-surface-elevated);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          backdrop-filter: blur(12px);
          transition: transform var(--duration-fast), border-color var(--duration-fast);
        }

        .stats-metric-card:hover {
          transform: translateY(-2px);
          border-color: var(--glass-border-highlight);
        }

        .stats-metric-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stats-metric-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .stats-metric-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .stats-metric-value {
          font-size: clamp(20px, 2.5vw, 26px);
          font-weight: 800;
          color: #ffffff;
          line-height: 1.1;
        }

        /* Activity Section */
        .stats-activity-card {
          background: var(--color-bg-surface-elevated);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .stats-section-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .stats-activity-chart {
          display: flex;
          align-items: flex-end;
          gap: var(--space-3);
          height: 140px;
          padding-top: var(--space-4);
          box-sizing: border-box;
        }

        .stats-activity-bar-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
          gap: var(--space-2);
        }

        .stats-activity-bar-track {
          width: 100%;
          max-width: 36px;
          height: 90px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: var(--radius-sm);
          position: relative;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }

        .stats-activity-bar-fill {
          width: 100%;
          background: var(--gradient-primary);
          border-radius: var(--radius-sm);
          transition: height 0.4s ease;
          min-height: 4px;
        }

        .stats-activity-label {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          font-weight: 500;
        }

        /* Two-Column Grid for Rankings */
        .stats-rankings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
        }

        .stats-panel-card {
          background: var(--color-bg-surface-elevated);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          overflow: hidden;
        }

        .stats-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .stats-row-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 8px var(--space-3);
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          transition: background var(--duration-fast), border-color var(--duration-fast);
        }

        .stats-row-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--glass-border);
        }

        .stats-rank-badge {
          font-size: var(--font-size-xs);
          font-weight: 800;
          color: var(--color-text-muted);
          width: 24px;
          text-align: center;
          flex-shrink: 0;
        }

        .stats-rank-badge.top-1 { color: #f59e0b; }
        .stats-rank-badge.top-2 { color: #94a3b8; }
        .stats-rank-badge.top-3 { color: #b45309; }

        .stats-item-art {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          flex-shrink: 0;
          overflow: hidden;
        }

        .stats-item-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .stats-item-title {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stats-item-sub {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stats-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: var(--radius-full);
          color: var(--color-accent-purple-glow);
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .stats-play-btn {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--duration-fast);
          flex-shrink: 0;
        }

        .stats-play-btn:hover {
          color: #ffffff;
          background: var(--color-primary);
        }

        /* Empty States */
        .stats-empty-state {
          padding: var(--space-6) var(--space-4);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-text-muted);
        }

        .stats-empty-icon {
          color: var(--color-text-dim);
          margin-bottom: var(--space-1);
        }

        .stats-empty-title {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .stats-empty-desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
          max-width: 320px;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .stats-rankings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .stats-view-container {
            padding: var(--space-4);
            gap: var(--space-4);
          }

          .stats-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .stats-metrics-grid {
            grid-template-columns: 1fr;
          }

          .stats-activity-chart {
            gap: var(--space-1);
          }
        }
      </style>

      <div class="stats-view-container">
        <!-- Header -->
        <header class="stats-header">
          <div class="stats-header-titles">
            <h1 class="stats-header-title">
              <span style="color: var(--color-accent-purple-glow); display: flex;">
                ${getIconSvg('bar-chart', { size: 28 })}
              </span>
              Music Statistics
            </h1>
            <p class="stats-header-subtitle">Real-time listening habits & local library analytics</p>
          </div>
          <button class="stats-refresh-btn" id="stats-refresh-btn" aria-label="Refresh statistics">
            ${getIconSvg('refresh', { size: 16 })}
            <span>Refresh</span>
          </button>
        </header>

        <!-- Overview Metrics Grid -->
        <section class="stats-metrics-grid" aria-label="Library & Listening Metrics">
          <!-- Total Songs -->
          <div class="stats-metric-card">
            <div class="stats-metric-icon" style="background: rgba(139, 92, 246, 0.15); color: var(--color-accent-purple-glow);">
              ${getIconSvg('music', { size: 22 })}
            </div>
            <div class="stats-metric-info">
              <span class="stats-metric-label">Total Songs</span>
              <span class="stats-metric-value">${this.overview.totalSongs.toLocaleString()}</span>
            </div>
          </div>

          <!-- Total Artists -->
          <div class="stats-metric-card">
            <div class="stats-metric-icon" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa;">
              ${getIconSvg('user', { size: 22 })}
            </div>
            <div class="stats-metric-info">
              <span class="stats-metric-label">Artists</span>
              <span class="stats-metric-value">${this.overview.totalArtists.toLocaleString()}</span>
            </div>
          </div>

          <!-- Total Albums -->
          <div class="stats-metric-card">
            <div class="stats-metric-icon" style="background: rgba(236, 72, 153, 0.15); color: #f472b6;">
              ${getIconSvg('disc', { size: 22 })}
            </div>
            <div class="stats-metric-info">
              <span class="stats-metric-label">Albums</span>
              <span class="stats-metric-value">${this.overview.totalAlbums.toLocaleString()}</span>
            </div>
          </div>

          <!-- Total Genres -->
          <div class="stats-metric-card">
            <div class="stats-metric-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
              ${getIconSvg('sparkles', { size: 22 })}
            </div>
            <div class="stats-metric-info">
              <span class="stats-metric-label">Genres</span>
              <span class="stats-metric-value">${this.overview.totalGenres.toLocaleString()}</span>
            </div>
          </div>

          <!-- Total Listening Time -->
          <div class="stats-metric-card">
            <div class="stats-metric-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
              ${getIconSvg('clock', { size: 22 })}
            </div>
            <div class="stats-metric-info">
              <span class="stats-metric-label">Time Listened</span>
              <span class="stats-metric-value">${this.formatListeningTime(this.overview.totalListeningTimeMs)}</span>
            </div>
          </div>

          <!-- Total Plays -->
          <div class="stats-metric-card">
            <div class="stats-metric-icon" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">
              ${getIconSvg('trending', { size: 22 })}
            </div>
            <div class="stats-metric-info">
              <span class="stats-metric-label">Total Plays</span>
              <span class="stats-metric-value">${this.overview.totalPlays.toLocaleString()}</span>
            </div>
          </div>
        </section>

        <!-- Listening Activity (Past 7 Days) -->
        <section class="stats-activity-card" aria-label="Recent Listening Activity">
          <div class="stats-section-title">
            <span>Listening Activity (Past 7 Days)</span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: normal;">
              ${this.activity.reduce((acc, a) => acc + a.playsCount, 0)} plays this week
            </span>
          </div>
          ${this.renderActivityChart()}
        </section>

        <!-- Top Played Songs -->
        <section class="stats-panel-card" aria-label="Most Played Songs">
          <div class="stats-section-title">
            <span>Most Played Songs</span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: normal;">
              Top tracks by plays
            </span>
          </div>
          ${this.renderTopSongsList()}
        </section>

        <!-- Rankings Grid: Top Artists & Top Albums -->
        <div class="stats-rankings-grid">
          <!-- Top Artists -->
          <section class="stats-panel-card" aria-label="Top Artists">
            <div class="stats-section-title">
              <span>Top Artists</span>
            </div>
            ${this.renderTopArtistsList()}
          </section>

          <!-- Top Albums -->
          <section class="stats-panel-card" aria-label="Top Albums">
            <div class="stats-section-title">
              <span>Top Albums</span>
            </div>
            ${this.renderTopAlbumsList()}
          </section>
        </div>

        <!-- Recent Listening History -->
        <section class="stats-panel-card" aria-label="Listening History">
          <div class="stats-section-title">
            <span>Recent Listening History</span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: normal;">
              ${this.recentHistory.length} recent sessions
            </span>
          </div>
          ${this.renderRecentHistoryList()}
        </section>
      </div>
    `;
  }

  private renderActivityChart(): string {
    const maxPlays = Math.max(...this.activity.map(a => a.playsCount), 1);

    return `
      <div class="stats-activity-chart">
        ${this.activity
          .map(item => {
            const pct = Math.max((item.playsCount / maxPlays) * 100, item.playsCount > 0 ? 10 : 4);
            return `
              <div class="stats-activity-bar-wrap" title="${item.dateStr}: ${item.playsCount} plays (${this.formatListeningTime(item.durationMs)})">
                <div class="stats-activity-bar-track">
                  <div class="stats-activity-bar-fill" style="height: ${pct}%;"></div>
                </div>
                <span class="stats-activity-label">${item.dayLabel}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderTopSongsList(): string {
    if (this.topSongs.length === 0) {
      return `
        <div class="stats-empty-state">
          <div class="stats-empty-icon">${getIconSvg('music', { size: 36 })}</div>
          <div class="stats-empty-title">No Top Tracks Yet</div>
          <div class="stats-empty-desc">Play songs from your library to start building your listening statistics and charts.</div>
        </div>
      `;
    }

    return `
      <div class="stats-list">
        ${this.topSongs
          .map((item, index) => {
            const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            return `
              <div class="stats-row-item">
                <span class="stats-rank-badge ${rankClass}">#${index + 1}</span>
                <div class="stats-item-art">
                  ${getIconSvg('disc', { size: 20 })}
                </div>
                <div class="stats-item-info">
                  <span class="stats-item-title" title="${item.track.title}">${item.track.title}</span>
                  <span class="stats-item-sub" title="${item.track.artistName || 'Unknown Artist'} • ${item.track.albumTitle || 'Unknown Album'}">
                    ${item.track.artistName || 'Unknown Artist'} • ${item.track.albumTitle || 'Unknown Album'}
                  </span>
                </div>
                <span class="stats-count-badge">
                  ${getIconSvg('play', { size: 10 })}
                  ${item.playCount} ${item.playCount === 1 ? 'play' : 'plays'}
                </span>
                <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); min-width: 40px; text-align: right;">
                  ${this.formatDuration(item.track.durationMs)}
                </span>
                <button
                  class="stats-play-btn"
                  data-play-track-id="${item.track.id}"
                  aria-label="Play ${item.track.title}"
                >
                  ${getIconSvg('play', { size: 16 })}
                </button>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderTopArtistsList(): string {
    if (this.topArtists.length === 0) {
      return `
        <div class="stats-empty-state">
          <div class="stats-empty-icon">${getIconSvg('user', { size: 36 })}</div>
          <div class="stats-empty-title">No Artist Data Yet</div>
          <div class="stats-empty-desc">Artist rankings are calculated automatically from your completed playback sessions.</div>
        </div>
      `;
    }

    return `
      <div class="stats-list">
        ${this.topArtists
          .map((item, index) => {
            const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            return `
              <div class="stats-row-item">
                <span class="stats-rank-badge ${rankClass}">#${index + 1}</span>
                <div class="stats-item-art" style="border-radius: var(--radius-full);">
                  ${getIconSvg('user', { size: 20 })}
                </div>
                <div class="stats-item-info">
                  <span class="stats-item-title" title="${item.artistName}">${item.artistName}</span>
                  <span class="stats-item-sub">${item.trackCount} ${item.trackCount === 1 ? 'track' : 'tracks'} in library</span>
                </div>
                <span class="stats-count-badge">
                  ${item.playCount} ${item.playCount === 1 ? 'play' : 'plays'}
                </span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderTopAlbumsList(): string {
    if (this.topAlbums.length === 0) {
      return `
        <div class="stats-empty-state">
          <div class="stats-empty-icon">${getIconSvg('disc', { size: 36 })}</div>
          <div class="stats-empty-title">No Album Data Yet</div>
          <div class="stats-empty-desc">Album rankings are calculated from aggregated track listening activity.</div>
        </div>
      `;
    }

    return `
      <div class="stats-list">
        ${this.topAlbums
          .map((item, index) => {
            const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
            return `
              <div class="stats-row-item">
                <span class="stats-rank-badge ${rankClass}">#${index + 1}</span>
                <div class="stats-item-art">
                  ${getIconSvg('disc', { size: 20 })}
                </div>
                <div class="stats-item-info">
                  <span class="stats-item-title" title="${item.albumTitle}">${item.albumTitle}</span>
                  <span class="stats-item-sub" title="${item.artistName}">${item.artistName}${item.year ? ` • ${item.year}` : ''}</span>
                </div>
                <span class="stats-count-badge">
                  ${item.playCount} ${item.playCount === 1 ? 'play' : 'plays'}
                </span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderRecentHistoryList(): string {
    if (this.recentHistory.length === 0) {
      return `
        <div class="stats-empty-state">
          <div class="stats-empty-icon">${getIconSvg('clock', { size: 36 })}</div>
          <div class="stats-empty-title">No Listening History</div>
          <div class="stats-empty-desc">Your playback sessions will be recorded here locally with duration and timestamps.</div>
        </div>
      `;
    }

    return `
      <div class="stats-list">
        ${this.recentHistory
          .map(item => `
            <div class="stats-row-item">
              <div class="stats-item-art">
                ${getIconSvg('music', { size: 18 })}
              </div>
              <div class="stats-item-info">
                <span class="stats-item-title" title="${item.track.title}">${item.track.title}</span>
                <span class="stats-item-sub" title="${item.track.artistName || 'Unknown Artist'} • ${item.track.albumTitle || 'Unknown Album'}">
                  ${item.track.artistName || 'Unknown Artist'} • ${item.track.albumTitle || 'Unknown Album'}
                </span>
              </div>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-muted);">
                ${this.formatRelativeTime(item.playedAt)}
              </span>
              <button
                class="stats-play-btn"
                data-play-track-id="${item.track.id}"
                aria-label="Play ${item.track.title}"
              >
                ${getIconSvg('play', { size: 16 })}
              </button>
            </div>
          `)
          .join('')}
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Refresh Button
    const refreshBtn = this.container.querySelector<HTMLButtonElement>('#stats-refresh-btn');
    refreshBtn?.addEventListener('click', () => {
      void this.loadStatistics();
    });

    // Play Buttons for Top Songs & History
    const playButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-play-track-id]');
    playButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const trackId = btn.getAttribute('data-play-track-id');
        if (!trackId || !this.playbackManager) return;

        const song = this.topSongs.find(s => s.track.id === trackId)?.track ??
                     this.recentHistory.find(h => h.track.id === trackId)?.track;

        if (song) {
          void this.playbackManager.playTrack(song);
        }
      });
    });
  }
}
