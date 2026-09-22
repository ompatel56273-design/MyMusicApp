import type { QueueItem, Track } from '../../domain/entities/models';
import type { RepeatMode, ShuffleMode } from '../../domain/value-objects/audio-types';

/**
 * Encapsulates in-memory queue management, shuffle permutations, and repeat navigation.
 */
export class QueueManager {
  private items: QueueItem[] = [];
  private tracks: Track[] = [];
  private activeIndex = -1;
  private repeatModeValue: RepeatMode = 'off';
  private shuffleModeValue: ShuffleMode = 'off';

  // Array of indices mapping shuffle order -> original linear order
  private shuffleIndices: number[] = [];

  public getItems(): readonly QueueItem[] {
    return [...this.items];
  }

  public getTracks(): readonly Track[] {
    return [...this.tracks];
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getActiveTrack(): Track | null {
    if (this.activeIndex >= 0 && this.activeIndex < this.tracks.length) {
      return this.tracks[this.activeIndex] ?? null;
    }
    return null;
  }

  public getRepeatMode(): RepeatMode {
    return this.repeatModeValue;
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.repeatModeValue = mode;
  }

  public getShuffleMode(): ShuffleMode {
    return this.shuffleModeValue;
  }

  public setShuffleMode(mode: ShuffleMode): void {
    if (this.shuffleModeValue === mode) return;
    this.shuffleModeValue = mode;

    if (mode === 'on') {
      this.generateShuffleIndices();
    } else {
      this.shuffleIndices = [];
    }
  }

  /**
   * Set a completely new queue context with a starting track.
   */
  public setQueue(tracks: readonly Track[], startIndex = 0): void {
    this.tracks = [...tracks];
    this.items = this.tracks.map((t, idx) => ({
      id: `queue_${Date.now()}_${idx}`,
      trackId: t.id,
      position: idx,
      addedReason: 'user'
    }));

    this.activeIndex = Math.max(0, Math.min(this.tracks.length - 1, startIndex));

    if (this.shuffleModeValue === 'on') {
      this.generateShuffleIndices();
    }
  }

  /**
   * Add tracks to the current queue.
   */
  public addTracks(newTracks: readonly Track[], playNext = false): void {
    if (newTracks.length === 0) return;

    if (this.tracks.length === 0) {
      this.setQueue(newTracks, 0);
      return;
    }

    if (playNext && this.activeIndex >= 0) {
      const insertAt = this.activeIndex + 1;
      this.tracks.splice(insertAt, 0, ...newTracks);
    } else {
      this.tracks.push(...newTracks);
    }

    this.rebuildQueueItems();

    if (this.shuffleModeValue === 'on') {
      this.generateShuffleIndices();
    }
  }

  public removeTrack(index: number): void {
    if (index < 0 || index >= this.tracks.length) return;

    this.tracks.splice(index, 1);
    if (this.activeIndex > index) {
      this.activeIndex--;
    } else if (this.activeIndex >= this.tracks.length) {
      this.activeIndex = this.tracks.length - 1;
    }

    this.rebuildQueueItems();

    if (this.shuffleModeValue === 'on') {
      this.generateShuffleIndices();
    }
  }

  public reorder(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.tracks.length || toIndex < 0 || toIndex >= this.tracks.length) {
      return;
    }

    const [movedTrack] = this.tracks.splice(fromIndex, 1);
    if (!movedTrack) return;

    this.tracks.splice(toIndex, 0, movedTrack);

    if (this.activeIndex === fromIndex) {
      this.activeIndex = toIndex;
    } else if (fromIndex < this.activeIndex && toIndex >= this.activeIndex) {
      this.activeIndex--;
    } else if (fromIndex > this.activeIndex && toIndex <= this.activeIndex) {
      this.activeIndex++;
    }

    this.rebuildQueueItems();

    if (this.shuffleModeValue === 'on') {
      this.generateShuffleIndices();
    }
  }

  public clear(): void {
    this.tracks = [];
    this.items = [];
    this.activeIndex = -1;
    this.shuffleIndices = [];
  }

  public setActiveIndex(index: number): void {
    if (index >= 0 && index < this.tracks.length) {
      this.activeIndex = index;
    }
  }

  /**
   * Determine the next track index respecting repeat mode and shuffle.
   */
  public getNextIndex(): number | null {
    if (this.tracks.length === 0) return null;

    if (this.repeatModeValue === 'one') {
      return this.activeIndex >= 0 ? this.activeIndex : 0;
    }

    if (this.shuffleModeValue === 'on' && this.shuffleIndices.length === this.tracks.length) {
      const currentShufflePos = this.shuffleIndices.indexOf(this.activeIndex);
      if (currentShufflePos !== -1 && currentShufflePos + 1 < this.shuffleIndices.length) {
        return this.shuffleIndices[currentShufflePos + 1]!;
      }
      if (this.repeatModeValue === 'all') {
        return this.shuffleIndices[0] ?? null;
      }
      return null;
    }

    // Normal linear order
    if (this.activeIndex + 1 < this.tracks.length) {
      return this.activeIndex + 1;
    }

    if (this.repeatModeValue === 'all') {
      return 0;
    }

    return null;
  }

  /**
   * Determine the previous track index respecting restart threshold.
   * @param currentTimeSec Current playback position in seconds
   * @param thresholdSec Threshold (e.g. 3.0s) above which track restarts instead of skipping back
   */
  public getPreviousIndex(currentTimeSec = 0, thresholdSec = 3.0): number | null {
    if (this.tracks.length === 0) return null;

    // If currently playing past restart threshold, restart current track
    if (currentTimeSec > thresholdSec && this.activeIndex >= 0) {
      return this.activeIndex;
    }

    if (this.shuffleModeValue === 'on' && this.shuffleIndices.length === this.tracks.length) {
      const currentShufflePos = this.shuffleIndices.indexOf(this.activeIndex);
      if (currentShufflePos > 0) {
        return this.shuffleIndices[currentShufflePos - 1]!;
      }
      if (this.repeatModeValue === 'all') {
        return this.shuffleIndices[this.shuffleIndices.length - 1] ?? null;
      }
      return this.activeIndex;
    }

    // Normal linear order
    if (this.activeIndex - 1 >= 0) {
      return this.activeIndex - 1;
    }

    if (this.repeatModeValue === 'all') {
      return this.tracks.length - 1;
    }

    return this.activeIndex >= 0 ? this.activeIndex : 0;
  }

  private rebuildQueueItems(): void {
    this.items = this.tracks.map((t, idx) => ({
      id: `queue_${t.id}_${idx}`,
      trackId: t.id,
      position: idx,
      addedReason: 'user'
    }));
  }

  private generateShuffleIndices(): void {
    const n = this.tracks.length;
    if (n <= 1) {
      this.shuffleIndices = n === 1 ? [0] : [];
      return;
    }

    // Fisher-Yates shuffle
    const indices = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = indices[i]!;
      indices[i] = indices[j]!;
      indices[j] = temp;
    }

    // Ensure active track is placed first in the shuffle order for seamless playback
    if (this.activeIndex >= 0) {
      const activePos = indices.indexOf(this.activeIndex);
      if (activePos > 0) {
        indices.splice(activePos, 1);
        indices.unshift(this.activeIndex);
      }
    }

    this.shuffleIndices = indices;
  }
}
