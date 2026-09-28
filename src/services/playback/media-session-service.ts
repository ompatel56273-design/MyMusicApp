import type { IPlaybackManager, IArtworkService } from '../contracts/service-contracts';
import type { EventBus } from '../../core/events/event-bus';
import type { Disposable } from '../../core/types/common';
import type { Track } from '../../domain/entities/models';

export interface MediaSessionServiceOptions {
  playbackManager: IPlaybackManager;
  eventBus: EventBus;
  artworkService?: IArtworkService | undefined;
}

/**
 * Media Session Integration Service.
 * Connects the web Media Session API (hardware media keys, lock screen, system notification media controls)
 * directly to the authoritative PlaybackManager without duplicating audio state or logic.
 */
export class MediaSessionService implements Disposable {
  private readonly playbackManager: IPlaybackManager;
  private readonly eventBus: EventBus;
  private readonly artworkService?: IArtworkService | undefined;
  private subscriptions: Disposable[] = [];
  private isInitialized = false;

  constructor(options: MediaSessionServiceOptions) {
    this.playbackManager = options.playbackManager;
    this.eventBus = options.eventBus;
    this.artworkService = options.artworkService;
  }

  public init(): void {
    if (this.isInitialized || typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    this.isInitialized = true;
    this.setupActionHandlers();
    this.setupEventListeners();

    void this.updateMetadata(this.playbackManager.currentTrack);
    this.updatePlaybackState(this.playbackManager.state);
    this.updatePositionState();
  }

  private setupActionHandlers(): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const safeSetHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Platform or browser may not support all action types
      }
    };

    safeSetHandler('play', () => {
      void this.playbackManager.resume();
    });

    safeSetHandler('pause', () => {
      void this.playbackManager.pause();
    });

    safeSetHandler('previoustrack', () => {
      void this.playbackManager.previous();
    });

    safeSetHandler('nexttrack', () => {
      void this.playbackManager.next();
    });

    safeSetHandler('seekto', (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        void this.playbackManager.seek(details.seekTime * 1000);
      }
    });

    safeSetHandler('seekbackward', (details) => {
      const offsetMs = (details.seekOffset || 5) * 1000;
      const target = Math.max(0, this.playbackManager.positionMs - offsetMs);
      void this.playbackManager.seek(target);
    });

    safeSetHandler('seekforward', (details) => {
      const offsetMs = (details.seekOffset || 5) * 1000;
      const dur = this.playbackManager.durationMs || Infinity;
      const target = Math.min(dur, this.playbackManager.positionMs + offsetMs);
      void this.playbackManager.seek(target);
    });

    safeSetHandler('stop', () => {
      void this.playbackManager.pause();
    });
  }

  private setupEventListeners(): void {
    const trackSub = this.eventBus.subscribe('playback:track-changed', (event: any) => {
      const track = event?.track ?? this.playbackManager.currentTrack;
      void this.updateMetadata(track);
    });

    const stateSub = this.eventBus.subscribe('playback:state-changed', (event: any) => {
      const state = event?.state ?? this.playbackManager.state;
      this.updatePlaybackState(state);
      this.updatePositionState();
    });

    const timeSub = this.eventBus.subscribe('playback:time-updated', () => {
      this.updatePositionState();
    });

    this.subscriptions.push(trackSub, stateSub, timeSub);
  }

  public async updateMetadata(track: Track | null): Promise<void> {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const title = track.title || 'Unknown Title';
    const artist = track.artistName || 'Unknown Artist';
    const album = track.albumTitle || 'Unknown Album';
    let artworkUrl = (track as any).artworkUrl || (track as any).coverArtUrl || '';

    if (!artworkUrl && track.artworkId && this.artworkService) {
      try {
        const fetchedUrl = await this.artworkService.getArtworkUrl(track.artworkId, 'large');
        if (fetchedUrl) artworkUrl = fetchedUrl;
      } catch {
        // Fallback gracefully
      }
    }

    const artwork: MediaImage[] = [];
    if (artworkUrl) {
      artwork.push({
        src: artworkUrl,
        sizes: '512x512',
        type: 'image/png'
      });
    }

    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork
      });
    }
  }

  public updatePlaybackState(state: string): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (state === 'playing') {
      navigator.mediaSession.playbackState = 'playing';
    } else if (state === 'paused') {
      navigator.mediaSession.playbackState = 'paused';
    } else {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  public updatePositionState(): void {
    if (
      typeof window === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }

    const durationSec = (this.playbackManager.durationMs || 0) / 1000;
    const positionSec = (this.playbackManager.positionMs || 0) / 1000;

    if (
      !isNaN(durationSec) &&
      !isNaN(positionSec) &&
      durationSec > 0 &&
      positionSec >= 0 &&
      positionSec <= durationSec
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          position: positionSec,
          playbackRate: this.playbackManager.playbackRate || 1.0
        });
      } catch {
        // Ignore edge cases during rapid playback transition
      }
    }
  }

  public dispose(): void {
    this.subscriptions.forEach((sub) => sub.dispose());
    this.subscriptions = [];

    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // Ignore disposal errors
      }
    }
    this.isInitialized = false;
  }
}
