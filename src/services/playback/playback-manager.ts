import { Logger } from '../../core/logging/logger';
import { EventBus } from '../../core/events/event-bus';
import { AudioEngineError } from '../../core/errors/app-error';
import { DomainEvents } from '../../domain/events/domain-events';
import type { PlaybackState, RepeatMode, ShuffleMode, AbLoopState } from '../../domain/value-objects/audio-types';
import type { Track, QueueItem, PlaybackHistoryItem, PlaybackPosition } from '../../domain/entities/models';
import type {
  ITrackRepository,
  IAudioFileRepository,
  IQueueRepository,
  IHistoryRepository
} from '../../domain/repositories/repository-contracts';
import type { IPlaybackManager, IAudioEngine } from '../contracts/service-contracts';
import type { IFilesystemAdapter } from '../scanner/filesystem-adapter';
import { QueueManager } from './queue-manager';
import type { AudioEngine } from '../audio/audio-engine';

export interface PlaybackManagerDependencies {
  audioEngine: IAudioEngine;
  filesystem: IFilesystemAdapter;
  trackRepo: ITrackRepository;
  audioFileRepo: IAudioFileRepository;
  queueRepo?: IQueueRepository | undefined;
  historyRepo?: IHistoryRepository | undefined;
  eventBus: EventBus;
  logger?: Logger | undefined;
}

/**
 * Authoritative Single Playback Controller.
 * Implements IPlaybackManager and orchestrates all playback state transitions,
 * queue progression, position persistence, history tracking, and error recovery.
 */
export class PlaybackManager implements IPlaybackManager {
  private readonly logger: Logger;
  private readonly audioEngine: IAudioEngine;
  private readonly filesystem: IFilesystemAdapter;
  private readonly trackRepo: ITrackRepository;
  private readonly audioFileRepo: IAudioFileRepository;
  private readonly queueRepo?: IQueueRepository | undefined;
  private readonly historyRepo?: IHistoryRepository | undefined;
  private readonly eventBus: EventBus;
  private readonly queueManager = new QueueManager();

  private currentState: PlaybackState = 'idle';
  private currentTrackEntity: Track | null = null;
  private currentPositionMs = 0;
  private currentDurationMs = 0;
  private currentVolume = 1.0;
  private isMutedValue = false;
  private currentPlaybackRate = 1.0;

  // Stale async operation guard
  private operationToken = 0;
  private preloadToken = 0;
  private preloadedTrack: Track | null = null;
  private preloadPromise: Promise<void> | null = null;

  // Crossfade state
  private crossfadeEnabledValue = false;
  private crossfadeDurationSecValue = 3;
  private isCrossfadingActive = false;

  // Position persistence & history tracking
  private lastPositionPersistTime = 0;
  private sessionListenStartMs = 0;
  private sessionListenedMs = 0;
  private hasCountedPlay = false;

  // A/B Loop State
  private abLoopState: AbLoopState = {
    enabled: true,
    pointA: null,
    pointB: null,
    trackId: null,
    isActive: false
  };

  constructor(deps: PlaybackManagerDependencies) {
    this.logger = deps.logger ?? new Logger('PlaybackManager');
    this.audioEngine = deps.audioEngine;
    this.filesystem = deps.filesystem;
    this.trackRepo = deps.trackRepo;
    this.audioFileRepo = deps.audioFileRepo;
    this.queueRepo = deps.queueRepo;
    this.historyRepo = deps.historyRepo;
    this.eventBus = deps.eventBus;

    this.setupAudioEngineCallbacks();
  }

  private setupAudioEngineCallbacks(): void {
    if ('setCallbacks' in this.audioEngine && typeof (this.audioEngine as AudioEngine).setCallbacks === 'function') {
      (this.audioEngine as AudioEngine).setCallbacks({
        onTimeUpdate: (sec, durSec) => this.handleTimeUpdate(sec, durSec),
        onEnded: () => void this.handleTrackEnded(),
        onBuffering: (buffering) => this.handleBuffering(buffering),
        onError: (err) => this.handleAudioError(err),
        onStateChange: (isPlaying) => this.handleStateChange(isPlaying)
      });
    }
  }

  public get state(): PlaybackState {
    return this.currentState;
  }

  public get currentTrack(): Track | null {
    return this.currentTrackEntity;
  }

  public get positionMs(): number {
    return this.currentPositionMs;
  }

  public get durationMs(): number {
    return this.currentDurationMs;
  }

  public get volume(): number {
    return this.currentVolume;
  }

  public get isMuted(): boolean {
    return this.isMutedValue;
  }

  public get playbackRate(): number {
    return this.currentPlaybackRate;
  }

  public get crossfadeEnabled(): boolean {
    return this.crossfadeEnabledValue;
  }

  public get crossfadeDurationSec(): number {
    return this.crossfadeDurationSecValue;
  }

  public setCrossfade(enabled: boolean, durationSec?: number): void {
    this.crossfadeEnabledValue = enabled;
    if (durationSec !== undefined) {
      this.crossfadeDurationSecValue = Math.max(1, Math.min(12, durationSec));
    }
    this.audioEngine.setCrossfade?.(this.crossfadeEnabledValue, this.crossfadeDurationSecValue);
    if (!this.crossfadeEnabledValue && this.isCrossfadingActive) {
      this.audioEngine.cancelCrossfade?.();
      this.isCrossfadingActive = false;
    }
  }

  public get repeatMode(): RepeatMode {
    return this.queueManager.getRepeatMode();
  }

  public get shuffleMode(): ShuffleMode {
    return this.queueManager.getShuffleMode();
  }

  public get abLoop(): AbLoopState {
    return { ...this.abLoopState };
  }

  private updateAbLoopState(updates: Partial<AbLoopState>): void {
    const currentTrackId = this.currentTrackEntity?.id ?? null;
    const durMs = this.currentDurationMs || 0;

    let enabled = updates.enabled !== undefined ? updates.enabled : this.abLoopState.enabled;
    let pointA = updates.pointA !== undefined ? updates.pointA : this.abLoopState.pointA;
    let pointB = updates.pointB !== undefined ? updates.pointB : this.abLoopState.pointB;
    let trackId = updates.trackId !== undefined ? updates.trackId : (this.abLoopState.trackId ?? currentTrackId);

    if (pointA !== null) {
      if (typeof pointA !== 'number' || isNaN(pointA) || !isFinite(pointA)) {
        pointA = null;
      } else {
        pointA = Math.max(0, Math.min(durMs > 0 ? durMs : Infinity, Math.round(pointA)));
      }
    }

    if (pointB !== null) {
      if (typeof pointB !== 'number' || isNaN(pointB) || !isFinite(pointB)) {
        pointB = null;
      } else {
        pointB = Math.max(0, Math.min(durMs > 0 ? durMs : Infinity, Math.round(pointB)));
      }
    }

    // Point B set without Point A -> Point A defaults to 0
    if (pointB !== null && pointA === null) {
      pointA = 0;
    }

    let isActive = false;
    if (enabled && pointA !== null && pointB !== null && trackId && currentTrackId === trackId) {
      if (pointB - pointA >= 100) {
        isActive = true;
      }
    }

    this.abLoopState = {
      enabled,
      pointA,
      pointB,
      trackId: trackId ?? currentTrackId,
      isActive
    };

    this.eventBus.publish(DomainEvents.AB_LOOP_CHANGED, {
      abLoop: this.abLoop
    });
  }

  public setLoopA(positionMs?: number): void {
    const targetPos = positionMs !== undefined ? positionMs : this.currentPositionMs;
    const trackId = this.currentTrackEntity?.id ?? null;
    this.updateAbLoopState({
      pointA: targetPos,
      trackId
    });
  }

  public setLoopB(positionMs?: number): void {
    const targetPos = positionMs !== undefined ? positionMs : this.currentPositionMs;
    const trackId = this.currentTrackEntity?.id ?? null;
    this.updateAbLoopState({
      pointB: targetPos,
      trackId
    });
  }

  public toggleAbLoop(enabled?: boolean): void {
    const newEnabled = enabled !== undefined ? enabled : !this.abLoopState.enabled;
    this.updateAbLoopState({ enabled: newEnabled });
  }

  public clearAbLoop(): void {
    this.abLoopState = {
      enabled: this.abLoopState.enabled,
      pointA: null,
      pointB: null,
      trackId: null,
      isActive: false
    };
    this.eventBus.publish(DomainEvents.AB_LOOP_CHANGED, {
      abLoop: this.abLoop
    });
  }

  public get queue(): readonly QueueItem[] {
    return this.queueManager.getItems();
  }

  public get currentQueueIndex(): number {
    return this.queueManager.getActiveIndex();
  }

  public getTracks(): readonly Track[] {
    return this.queueManager.getTracks();
  }

  public getQueueTracks(): readonly Track[] {
    return this.queueManager.getTracks();
  }

  /**
   * Restore persisted queue and playback context from IndexedDB.
   * Validates all track IDs against TrackRepository and safely discards missing/corrupted tracks.
   */
  public async restoreQueue(): Promise<void> {
    if (!this.queueRepo) return;

    try {
      // 1. Fetch raw persisted queue items and metadata
      const [persistedItems, metadata] = await Promise.all([
        this.queueRepo.getQueue().catch(() => []),
        this.queueRepo.getQueueMetadata ? this.queueRepo.getQueueMetadata().catch(() => null) : Promise.resolve(null)
      ]);

      if (!persistedItems || persistedItems.length === 0) {
        this.logger.info('No persisted playback queue found.');
        return;
      }

      // 2. Fetch and validate tracks from TrackRepository
      const validatedTracks: Track[] = [];
      const validatedItems: QueueItem[] = [];

      // Safely filter and sort items by position
      const validItems = (persistedItems || []).filter((item): item is QueueItem => !!item && typeof item === 'object');
      const sortedItems = validItems.sort((a, b) => (a.position || 0) - (b.position || 0));

      for (const item of sortedItems) {
        if (!item || !item.trackId) continue;

        try {
          const track = await this.trackRepo.getById(item.trackId);
          if (track && track.availability !== 'missing') {
            validatedTracks.push(track);
            validatedItems.push({
              id: item.id || `queue_${track.id}_${validatedItems.length}`,
              trackId: track.id,
              position: validatedItems.length,
              addedReason: item.addedReason || 'user'
            });
          } else {
            this.logger.warn(`Restored track ${item.trackId} no longer available in library, removing from queue.`);
          }
        } catch (err) {
          this.logger.warn(`Error resolving track ${item.trackId} during queue restore:`, { error: String(err) });
        }
      }

      if (validatedTracks.length === 0) {
        this.logger.info('All persisted queue tracks were invalid or removed.');
        await this.queueRepo.clearQueue().catch(() => {});
        return;
      }

      // 3. Restore activeIndex & modes
      let targetIndex = metadata?.activeIndex ?? 0;

      if (metadata?.activeTrackId) {
        const foundIdx = validatedTracks.findIndex(t => t.id === metadata.activeTrackId);
        if (foundIdx !== -1) {
          targetIndex = foundIdx;
        }
      }

      targetIndex = Math.max(0, Math.min(validatedTracks.length - 1, targetIndex));

      if (metadata?.repeatMode) {
        this.queueManager.setRepeatMode(metadata.repeatMode);
      }
      if (metadata?.shuffleMode) {
        this.queueManager.setShuffleMode(metadata.shuffleMode);
      }

      // 4. Set restored queue into QueueManager
      this.queueManager.restoreQueue(validatedTracks, validatedItems, targetIndex);

      // 5. Restore currentTrackEntity without auto-playing
      const activeTrack = validatedTracks[targetIndex] || null;
      if (activeTrack) {
        this.currentTrackEntity = activeTrack;
        this.currentDurationMs = activeTrack.durationMs || 0;
        this.currentPositionMs = 0;

        if (this.historyRepo) {
          try {
            const savedPos = await this.historyRepo.getResumePosition(activeTrack.id);
            if (savedPos && savedPos.positionMs > 0 && savedPos.positionMs < this.currentDurationMs) {
              this.currentPositionMs = savedPos.positionMs;
            }
          } catch {
            // ignore position restore errors
          }
        }

        this.transitionToState('idle');

        this.eventBus.publish(DomainEvents.TRACK_CHANGED, {
          currentTrack: activeTrack,
          previousTrack: null,
          positionMs: this.currentPositionMs
        });
      }

      // 6. Broadcast queue changed & modes changed to UI components
      this.emitQueueChanged();

      if (metadata?.repeatMode || metadata?.shuffleMode) {
        this.eventBus.publish(DomainEvents.PLAYBACK_MODES_CHANGED, {
          repeat: this.queueManager.getRepeatMode(),
          shuffle: this.queueManager.getShuffleMode()
        });
      }

      // 7. If any invalid tracks were pruned during restoration, update database
      if (validatedTracks.length !== persistedItems.length) {
        void this.syncQueueToRepository();
      }

      this.logger.info(`Playback queue restored successfully (${validatedTracks.length} tracks, activeIndex: ${targetIndex}).`);
    } catch (err) {
      this.logger.error('Failed to restore playback queue from IndexedDB:', { error: String(err) });
      this.queueManager.clear();
      this.emitQueueChanged();
    }
  }

  /**
   * Play a track, optionally providing a full queue context.
   */
  public async playTrack(track: Track, queueContext?: readonly Track[]): Promise<void> {
    const token = ++this.operationToken;

    // Check missing availability
    if (track.availability === 'missing') {
      this.transitionToState('error');
      const err = new AudioEngineError(`Track "${track.title}" physical file is missing.`, 'FILE_MISSING');
      this.logger.warn(err.message, { trackId: track.id });
      throw err;
    }

    // Record previous track's position & flush history if applicable
    await this.persistCurrentPosition();

    // Reset session listening metrics for new track
    this.sessionListenStartMs = Date.now();
    this.sessionListenedMs = 0;
    this.hasCountedPlay = false;

    // Set or update queue
    if (queueContext && queueContext.length > 0) {
      const idx = queueContext.findIndex(t => t.id === track.id);
      this.queueManager.setQueue(queueContext, idx !== -1 ? idx : 0);
      this.emitQueueChanged();
      void this.syncQueueToRepository();
    } else {
      // Add track to queue if not present
      const tracks = this.queueManager.getTracks();
      const existingIdx = tracks.findIndex(t => t.id === track.id);
      if (existingIdx === -1) {
        this.queueManager.addTracks([track]);
        this.queueManager.setActiveIndex(this.queueManager.getTracks().length - 1);
        this.emitQueueChanged();
        void this.syncQueueToRepository();
      } else {
        this.queueManager.setActiveIndex(existingIdx);
      }
    }

    const previousTrack = this.currentTrackEntity;
    if (previousTrack?.id !== track.id) {
      this.clearAbLoop();
    }
    this.currentTrackEntity = track;
    this.currentDurationMs = track.durationMs || 0;
    this.currentPositionMs = 0;
    this.transitionToState('loading');

    this.eventBus.publish(DomainEvents.TRACK_CHANGED, {
      currentTrack: track,
      previousTrack,
      positionMs: 0
    });

    try {
      // Read physical audio file
      const audioFile = await this.audioFileRepo.getById(track.fileId);
      if (!audioFile || audioFile.availability === 'missing') {
        throw new AudioEngineError(`Audio file record ${track.fileId} is missing or deleted.`, 'FILE_NOT_FOUND');
      }

      const fileBuffer = await this.filesystem.readFile(audioFile.path);
      const blob = new Blob([fileBuffer.buffer as ArrayBuffer], { type: track.format.container ? `audio/${track.format.container}` : 'audio/mpeg' });

      if (token !== this.operationToken) return;

      this.cancelPreload();
      await this.audioEngine.loadBuffer(blob, { replayGain: track.replayGain });

      if (token !== this.operationToken) return;

      this.transitionToState('ready');
      await this.audioEngine.play();
      this.transitionToState('playing');

      // Preload next track in queue in the background for gapless transition
      this.preloadPromise = this.preloadNextTrack();
    } catch (err) {
      if (token !== this.operationToken) return;
      this.cancelPreload();
      this.transitionToState('error');
      const audioErr = err instanceof AudioEngineError ? err : new AudioEngineError('Playback initialization failed', 'PLAY_INIT_ERROR', undefined, err as Error);
      this.logger.error('Failed to play track:', { trackId: track.id, error: audioErr.message });
      throw audioErr;
    }
  }

  public async pause(): Promise<void> {
    if (this.currentState === 'playing') {
      if (this.isCrossfadingActive) {
        this.audioEngine.cancelCrossfade?.();
        this.isCrossfadingActive = false;
      }
      this.audioEngine.pause();
      this.transitionToState('paused');
      await this.persistCurrentPosition();
      this.updateListeningDuration();
    }
  }

  public async resume(): Promise<void> {
    if (this.currentState === 'paused' || this.currentState === 'ready') {
      if (this.isCrossfadingActive) {
        this.audioEngine.cancelCrossfade?.();
        this.isCrossfadingActive = false;
      }
      this.sessionListenStartMs = Date.now();
      await this.audioEngine.play();
      this.transitionToState('playing');

      if (!this.preloadedTrack) {
        this.preloadPromise = this.preloadNextTrack();
      }
    }
  }

  public async stop(): Promise<void> {
    this.cancelPreload();
    this.audioEngine.stop();
    await this.persistCurrentPosition();
    this.currentPositionMs = 0;
    this.transitionToState('stopped');
  }

  public async seek(positionMs: number): Promise<void> {
    let clamped = Math.max(0, Math.min(this.currentDurationMs || Infinity, positionMs));
    if (this.abLoopState.isActive && this.abLoopState.pointB !== null && this.abLoopState.pointA !== null) {
      if (clamped >= this.abLoopState.pointB) {
        clamped = this.abLoopState.pointA;
      }
    }
    this.currentPositionMs = clamped;
    this.cancelPreload();
    this.audioEngine.seek(clamped / 1000.0);

    this.eventBus.publish(DomainEvents.PLAYBACK_TIME_UPDATED, {
      positionMs: this.currentPositionMs,
      durationMs: this.currentDurationMs
    });

    await this.persistCurrentPosition();

    if (this.currentState === 'playing' || this.currentState === 'ready') {
      this.preloadPromise = this.preloadNextTrack();
    }
  }

  public async next(): Promise<void> {
    this.clearAbLoop();
    this.cancelPreload();
    const nextIdx = this.queueManager.getNextIndex();
    if (nextIdx !== null) {
      const tracks = this.queueManager.getTracks();
      const nextTrack = tracks[nextIdx];
      if (nextTrack) {
        this.queueManager.setActiveIndex(nextIdx);
        this.emitQueueChanged();
        void this.syncQueueToRepository();
        await this.playTrack(nextTrack);
        return;
      }
    }

    // End of queue reached and repeat mode is off
    await this.stop();
  }

  public async previous(): Promise<void> {
    this.clearAbLoop();
    this.cancelPreload();
    const currentSec = this.currentPositionMs / 1000.0;
    const prevIdx = this.queueManager.getPreviousIndex(currentSec, 3.0);

    if (prevIdx !== null) {
      const tracks = this.queueManager.getTracks();
      const prevTrack = tracks[prevIdx];
      if (prevTrack) {
        if (prevIdx === this.queueManager.getActiveIndex() && currentSec > 3.0) {
          // Restart track from 0
          await this.seek(0);
          return;
        }

        this.queueManager.setActiveIndex(prevIdx);
        this.emitQueueChanged();
        void this.syncQueueToRepository();
        await this.playTrack(prevTrack);
        return;
      }
    }

    await this.seek(0);
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.audioEngine.setGain(this.isMutedValue ? 0 : this.currentVolume);
  }

  public setMuted(muted: boolean): void {
    this.isMutedValue = muted;
    this.audioEngine.setGain(this.isMutedValue ? 0 : this.currentVolume);
  }

  public setPlaybackRate(rate: number): void {
    this.currentPlaybackRate = rate;
    this.audioEngine.setPlaybackRate(rate);
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.queueManager.setRepeatMode(mode);
    this.eventBus.publish(DomainEvents.PLAYBACK_MODES_CHANGED, {
      repeat: this.queueManager.getRepeatMode(),
      shuffle: this.queueManager.getShuffleMode()
    });
    void this.syncQueueToRepository();

    this.cancelPreload();
    if (this.currentState === 'playing' || this.currentState === 'ready') {
      this.preloadPromise = this.preloadNextTrack();
    }
  }

  public setShuffleMode(mode: ShuffleMode): void {
    this.queueManager.setShuffleMode(mode);
    this.eventBus.publish(DomainEvents.PLAYBACK_MODES_CHANGED, {
      repeat: this.queueManager.getRepeatMode(),
      shuffle: this.queueManager.getShuffleMode()
    });
    this.emitQueueChanged();
    void this.syncQueueToRepository();

    this.cancelPreload();
    if (this.currentState === 'playing' || this.currentState === 'ready') {
      this.preloadPromise = this.preloadNextTrack();
    }
  }

  public async addToQueue(tracks: readonly Track[] | Track, playNext = false): Promise<void> {
    const trackList = Array.isArray(tracks) ? tracks : [tracks];
    this.queueManager.addTracks(trackList, playNext);
    this.emitQueueChanged();
    await this.syncQueueToRepository();

    this.cancelPreload();
    if (this.currentState === 'playing' || this.currentState === 'ready') {
      this.preloadPromise = this.preloadNextTrack();
    }
  }

  public async playNext(tracks: readonly Track[] | Track): Promise<void> {
    await this.addToQueue(tracks, true);
  }

  public getQueue(): readonly QueueItem[] {
    return this.queueManager.getItems();
  }

  public getUpcomingTracks(): readonly Track[] {
    return this.queueManager.getUpcomingTracks();
  }

  public async playQueueIndex(index: number): Promise<void> {
    this.cancelPreload();
    const tracks = this.queueManager.getTracks();
    if (index < 0 || index >= tracks.length) return;
    const track = tracks[index];
    if (track) {
      this.queueManager.setActiveIndex(index);
      this.emitQueueChanged();
      void this.syncQueueToRepository();
      await this.playTrack(track);
    }
  }

  public async removeFromQueue(index: number): Promise<void> {
    const wasActive = index === this.queueManager.getActiveIndex();
    this.queueManager.removeTrack(index);
    if (wasActive) {
      this.currentTrackEntity = this.queueManager.getActiveTrack();
    }
    this.emitQueueChanged();
    await this.syncQueueToRepository();

    this.cancelPreload();
    if (this.currentState === 'playing' || this.currentState === 'ready') {
      this.preloadPromise = this.preloadNextTrack();
    }
  }

  public async reorderQueue(fromIndex: number, toIndex: number): Promise<void> {
    this.queueManager.reorder(fromIndex, toIndex);
    this.emitQueueChanged();
    await this.syncQueueToRepository();

    this.cancelPreload();
    if (this.currentState === 'playing' || this.currentState === 'ready') {
      this.preloadPromise = this.preloadNextTrack();
    }
  }

  public async moveQueueItemUp(index: number): Promise<void> {
    if (this.queueManager.moveUp(index)) {
      this.emitQueueChanged();
      await this.syncQueueToRepository();

      this.cancelPreload();
      if (this.currentState === 'playing' || this.currentState === 'ready') {
        this.preloadPromise = this.preloadNextTrack();
      }
    }
  }

  public async moveQueueItemDown(index: number): Promise<void> {
    if (this.queueManager.moveDown(index)) {
      this.emitQueueChanged();
      await this.syncQueueToRepository();

      this.cancelPreload();
      if (this.currentState === 'playing' || this.currentState === 'ready') {
        this.preloadPromise = this.preloadNextTrack();
      }
    }
  }

  public async moveQueueItemToTop(index: number): Promise<void> {
    if (this.queueManager.moveToTop(index)) {
      this.emitQueueChanged();
      await this.syncQueueToRepository();

      this.cancelPreload();
      if (this.currentState === 'playing' || this.currentState === 'ready') {
        this.preloadPromise = this.preloadNextTrack();
      }
    }
  }

  public async moveQueueItemToBottom(index: number): Promise<void> {
    if (this.queueManager.moveToBottom(index)) {
      this.emitQueueChanged();
      await this.syncQueueToRepository();

      this.cancelPreload();
      if (this.currentState === 'playing' || this.currentState === 'ready') {
        this.preloadPromise = this.preloadNextTrack();
      }
    }
  }

  public async clearQueue(preserveCurrent = false): Promise<void> {
    this.cancelPreload();
    this.queueManager.clear(preserveCurrent);
    if (!preserveCurrent) {
      // If full clear, keep current state intact or update
    }
    this.emitQueueChanged();
    await this.syncQueueToRepository();
  }

  /**
   * Returns in-flight preload Promise for testing/synchronization.
   */
  public getPreloadPromise(): Promise<void> | null {
    return this.preloadPromise;
  }

  /**
   * Preloads the next upcoming track in the queue for seamless gapless playback.
   */
  private async preloadNextTrack(): Promise<void> {
    if (this.currentState !== 'playing' && this.currentState !== 'ready') return;
    if (!this.audioEngine.prepareNext) return;

    const nextIdx = this.queueManager.getNextIndex();
    if (nextIdx === null) {
      this.cancelPreload();
      return;
    }

    const tracks = this.queueManager.getTracks();
    const nextTrack = tracks[nextIdx];
    if (!nextTrack || nextTrack.availability === 'missing') {
      this.cancelPreload();
      return;
    }

    // If already preloaded and engine still has it prepared, skip redundant load
    if (this.preloadedTrack?.id === nextTrack.id && this.audioEngine.hasPreparedNext?.()) {
      return;
    }

    const token = ++this.preloadToken;

    try {
      const audioFile = await this.audioFileRepo.getById(nextTrack.fileId);
      if (!audioFile || audioFile.availability === 'missing') {
        if (token === this.preloadToken) {
          this.cancelPreload();
        }
        return;
      }

      const fileBuffer = await this.filesystem.readFile(audioFile.path);
      if (token !== this.preloadToken) return;

      const blob = new Blob([fileBuffer.buffer as ArrayBuffer], {
        type: nextTrack.format.container ? `audio/${nextTrack.format.container}` : 'audio/mpeg'
      });

      await this.audioEngine.prepareNext(blob, { replayGain: nextTrack.replayGain });
      if (token !== this.preloadToken) return;

      this.preloadedTrack = nextTrack;
      this.logger.debug(`Preloaded next track "${nextTrack.title}" for gapless playback.`);
    } catch (err) {
      if (token === this.preloadToken) {
        this.preloadedTrack = null;
        if (this.audioEngine.cancelPreload) {
          this.audioEngine.cancelPreload();
        }
        this.logger.warn(`Gapless preload failed for track "${nextTrack.title}":`, { error: String(err) });
      }
    }
  }

  /**
   * Cancels in-flight preloading and resets prepared standby track.
   */
  /**
   * Cancels in-flight preloading and resets prepared standby track and crossfades.
   */
  private cancelPreload(): void {
    this.preloadToken++;
    this.preloadedTrack = null;
    this.preloadPromise = null;
    if (this.isCrossfadingActive) {
      this.isCrossfadingActive = false;
    }
    if (this.audioEngine.cancelCrossfade) {
      this.audioEngine.cancelCrossfade();
    }
    if (this.audioEngine.cancelPreload) {
      this.audioEngine.cancelPreload();
    }
  }

  private handleTimeUpdate(sec: number, durSec: number): void {
    this.currentPositionMs = Math.round(sec * 1000);
    if (durSec > 0) {
      this.currentDurationMs = Math.round(durSec * 1000);
    }

    // A/B Loop Boundary Check: takes immediate precedence over Crossfade and Gapless
    if (
      this.abLoopState.isActive &&
      this.abLoopState.pointB !== null &&
      this.abLoopState.pointA !== null &&
      this.currentPositionMs >= this.abLoopState.pointB
    ) {
      const targetSec = this.abLoopState.pointA / 1000.0;
      this.audioEngine.seek(targetSec);
      this.currentPositionMs = this.abLoopState.pointA;

      this.eventBus.publish(DomainEvents.PLAYBACK_TIME_UPDATED, {
        positionMs: this.currentPositionMs,
        durationMs: this.currentDurationMs
      });
      return;
    }

    this.eventBus.publish(DomainEvents.PLAYBACK_TIME_UPDATED, {
      positionMs: this.currentPositionMs,
      durationMs: this.currentDurationMs
    });

    this.updateListeningDuration();

    // Throttled database position save (every 5 seconds)
    const now = Date.now();
    if (now - this.lastPositionPersistTime >= 5000) {
      this.lastPositionPersistTime = now;
      void this.persistCurrentPosition();
    }

    // Trigger crossfade transition if enabled and threshold reached (disabled if A/B loop is active)
    if (
      !this.abLoopState.isActive &&
      this.crossfadeEnabledValue &&
      !this.isCrossfadingActive &&
      this.currentState === 'playing' &&
      durSec > 0 &&
      this.preloadedTrack &&
      this.audioEngine.hasPreparedNext?.() &&
      this.audioEngine.startCrossfadeToNext
    ) {
      const remainingSec = durSec - sec;
      const effectiveDuration = Math.min(this.crossfadeDurationSecValue, durSec / 2);
      if (remainingSec <= effectiveDuration && remainingSec >= 0) {
        const nextIdx = this.queueManager.getNextIndex();
        if (nextIdx !== null) {
          const tracks = this.queueManager.getTracks();
          const nextTrack = tracks[nextIdx];
          if (nextTrack && nextTrack.id === this.preloadedTrack.id) {
            this.isCrossfadingActive = true;
            void this.triggerCrossfade(nextIdx, nextTrack, effectiveDuration);
          }
        }
      }
    }
  }

  private async triggerCrossfade(nextIdx: number, nextTrack: Track, effectiveDuration: number): Promise<void> {
    try {
      if (!this.audioEngine.startCrossfadeToNext) {
        this.isCrossfadingActive = false;
        return;
      }

      await this.audioEngine.startCrossfadeToNext(effectiveDuration);

      // Record listening duration / history for outgoing track
      const outgoingTrack = this.currentTrackEntity;
      this.updateListeningDuration();
      if (outgoingTrack && !this.hasCountedPlay) {
        this.hasCountedPlay = true;
        void this.recordPlaybackHistory(true, outgoingTrack);
      }

      const previousTrack = this.currentTrackEntity;
      this.queueManager.setActiveIndex(nextIdx);
      this.emitQueueChanged();
      void this.syncQueueToRepository();

      this.currentTrackEntity = nextTrack;
      this.currentDurationMs = nextTrack.durationMs || 0;
      this.currentPositionMs = 0;
      this.sessionListenStartMs = Date.now();
      this.sessionListenedMs = 0;
      this.hasCountedPlay = false;

      this.transitionToState('playing');
      this.eventBus.publish(DomainEvents.TRACK_CHANGED, {
        currentTrack: nextTrack,
        previousTrack,
        positionMs: 0
      });

      this.preloadedTrack = null;
      this.preloadPromise = this.preloadNextTrack();
    } catch (err) {
      this.isCrossfadingActive = false;
      this.logger.warn('Crossfade transition trigger failed:', { error: String(err) });
    }
  }

  private updateListeningDuration(): void {
    if (this.currentState === 'playing' && this.sessionListenStartMs > 0) {
      const now = Date.now();
      this.sessionListenedMs += (now - this.sessionListenStartMs);
      this.sessionListenStartMs = now;
    }

    // Check listening history threshold: >= 30 seconds (30,000ms) or >= 50% of track
    if (!this.hasCountedPlay && this.currentTrackEntity && this.currentDurationMs > 0) {
      const halfDurationMs = this.currentDurationMs * 0.5;
      const thresholdMs = Math.min(30000, halfDurationMs);

      if (this.sessionListenedMs >= thresholdMs) {
        this.hasCountedPlay = true;
        void this.recordPlaybackHistory(false);
      }
    }
  }

  private async handleTrackEnded(): Promise<void> {
    // If crossfading was active, the outgoing track finished its gain ramp-down.
    // The incoming track is already playing as active track, so ignore onEnded from the old track.
    if (this.isCrossfadingActive || (this.audioEngine.isCrossfading)) {
      this.isCrossfadingActive = false;
      return;
    }

    // If A/B loop is active, loop back to Point A and do not advance queue or trigger gapless transition
    if (this.abLoopState.isActive && this.abLoopState.pointA !== null) {
      const targetSec = this.abLoopState.pointA / 1000.0;
      this.audioEngine.seek(targetSec);
      this.currentPositionMs = this.abLoopState.pointA;
      void this.audioEngine.play();
      return;
    }

    this.updateListeningDuration();
    if (this.currentTrackEntity && !this.hasCountedPlay) {
      this.hasCountedPlay = true;
      await this.recordPlaybackHistory(true);
    }

    // Attempt seamless gapless transition if next track is prepared
    if (
      this.preloadedTrack &&
      this.audioEngine.hasPreparedNext?.() &&
      this.audioEngine.transitionToNext
    ) {
      const nextIdx = this.queueManager.getNextIndex();
      if (nextIdx !== null) {
        const tracks = this.queueManager.getTracks();
        const nextTrack = tracks[nextIdx];
        if (nextTrack && nextTrack.id === this.preloadedTrack.id) {
          try {
            await this.audioEngine.transitionToNext();

            const previousTrack = this.currentTrackEntity;
            this.queueManager.setActiveIndex(nextIdx);
            this.emitQueueChanged();
            void this.syncQueueToRepository();

            this.currentTrackEntity = nextTrack;
            this.currentDurationMs = nextTrack.durationMs || 0;
            this.currentPositionMs = 0;
            this.sessionListenStartMs = Date.now();
            this.sessionListenedMs = 0;
            this.hasCountedPlay = false;

            this.transitionToState('playing');
            this.eventBus.publish(DomainEvents.TRACK_CHANGED, {
              currentTrack: nextTrack,
              previousTrack,
              positionMs: 0
            });
            this.preloadedTrack = null;
            this.preloadPromise = this.preloadNextTrack();
            return;
          } catch (err) {
            this.logger.warn('Gapless transition failed, falling back to sequential play:', { error: String(err) });
          }
        }
      }
    }

    // Fallback to sequential next
    await this.next();
  }

  private handleBuffering(isBuffering: boolean): void {
    if (isBuffering && this.currentState === 'playing') {
      this.transitionToState('loading');
    } else if (!isBuffering && this.currentState === 'loading') {
      this.transitionToState('playing');
    }
  }

  private handleAudioError(err: AudioEngineError): void {
    this.transitionToState('error');
    this.logger.error('AudioEngine reported an error:', { error: err.message, code: err.code });
  }

  private handleStateChange(isPlaying: boolean): void {
    if (isPlaying && this.currentState !== 'playing') {
      this.transitionToState('playing');
    } else if (!isPlaying && this.currentState === 'playing') {
      this.transitionToState('playing');
    }
  }

  private transitionToState(newState: PlaybackState): void {
    this.currentState = newState;
    this.eventBus.publish(DomainEvents.PLAYBACK_STATE_CHANGED, {
      state: this.currentState,
      track: this.currentTrackEntity,
      positionMs: this.currentPositionMs,
      durationMs: this.currentDurationMs
    });
  }

  private emitQueueChanged(): void {
    this.eventBus.publish(DomainEvents.QUEUE_CHANGED, {
      items: this.queueManager.getItems(),
      activeIndex: this.queueManager.getActiveIndex()
    });
  }

  private async persistCurrentPosition(): Promise<void> {
    if (!this.historyRepo || !this.currentTrackEntity) return;

    try {
      const positionData: PlaybackPosition = {
        trackId: this.currentTrackEntity.id,
        positionMs: this.currentPositionMs,
        updatedAt: Date.now()
      };
      await this.historyRepo.saveResumePosition(positionData);
    } catch (err) {
      this.logger.warn('Failed to persist playback position:', { error: String(err) });
    }
  }

  private async recordPlaybackHistory(completed: boolean, trackToRecord?: Track): Promise<void> {
    const targetTrack = trackToRecord ?? this.currentTrackEntity;
    if (!targetTrack) return;

    try {
      // 1. Record history item
      if (this.historyRepo) {
        const historyRecord: Omit<PlaybackHistoryItem, 'id'> = {
          trackId: targetTrack.id,
          playedAt: Date.now(),
          durationListenedMs: this.sessionListenedMs,
          completed
        };
        await this.historyRepo.addRecord(historyRecord);
      }

      // 2. Increment track play count & update lastPlayedAt
      await this.trackRepo.incrementPlayCount(targetTrack.id, Date.now());
      const updatedTrack = await this.trackRepo.getById(targetTrack.id);
      if (updatedTrack && this.currentTrackEntity?.id === targetTrack.id) {
        this.currentTrackEntity = updatedTrack;
      }
    } catch (err) {
      this.logger.warn('Failed to record playback history:', { error: String(err) });
    }
  }

  private async syncQueueToRepository(): Promise<void> {
    if (!this.queueRepo) return;

    try {
      const items = this.queueManager.getItems();
      const activeIndex = this.queueManager.getActiveIndex();
      const activeTrack = this.queueManager.getActiveTrack();

      if (items.length === 0) {
        await this.queueRepo.clearQueue();
      } else {
        await this.queueRepo.saveQueue(items);
        if (this.queueRepo.saveQueueMetadata) {
          await this.queueRepo.saveQueueMetadata({
            activeIndex,
            activeTrackId: activeTrack?.id,
            repeatMode: this.queueManager.getRepeatMode(),
            shuffleMode: this.queueManager.getShuffleMode(),
            updatedAt: Date.now()
          });
        }
      }
    } catch (err) {
      this.logger.warn('Failed to sync queue to repository:', { error: String(err) });
    }
  }
}
