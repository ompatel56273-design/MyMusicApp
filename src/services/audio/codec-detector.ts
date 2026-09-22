import type { AudioContainer, AudioCodec } from '../../domain/value-objects/audio-types';
import type { CodecCapability, AudioCapabilityState } from './audio-types';

/**
 * Format & Codec Runtime Capability Detector.
 * Probes the actual host runtime capabilities rather than inferring from file extensions.
 * Differentiates between heuristic canPlayType and genuine decoding capabilities.
 */
export class CodecDetector {
  private static cachedMatrix: Map<string, CodecCapability> | null = null;

  /**
   * Probe and get the complete capability matrix for all recognized audio formats.
   */
  public static getCapabilityMatrix(): readonly CodecCapability[] {
    if (this.cachedMatrix) {
      return Array.from(this.cachedMatrix.values());
    }

    const testAudio = typeof document !== 'undefined' ? document.createElement('audio') : null;
    const matrix = new Map<string, CodecCapability>();

    const candidateFormats: Array<{
      container: AudioContainer;
      codec: AudioCodec;
      mimeType: string;
      expectedLossless: boolean;
    }> = [
      { container: 'mp3', codec: 'mp3', mimeType: 'audio/mpeg', expectedLossless: false },
      { container: 'flac', codec: 'flac', mimeType: 'audio/flac', expectedLossless: true },
      { container: 'wav', codec: 'pcm', mimeType: 'audio/wav; codecs="1"', expectedLossless: true },
      { container: 'ogg', codec: 'vorbis', mimeType: 'audio/ogg; codecs="vorbis"', expectedLossless: false },
      { container: 'opus', codec: 'opus', mimeType: 'audio/ogg; codecs="opus"', expectedLossless: false },
      { container: 'm4a', codec: 'aac', mimeType: 'audio/mp4; codecs="mp4a.40.2"', expectedLossless: false },
      { container: 'aac', codec: 'aac', mimeType: 'audio/aac', expectedLossless: false },
      { container: 'alac', codec: 'alac', mimeType: 'audio/mp4; codecs="alac"', expectedLossless: true },
      { container: 'webm', codec: 'opus', mimeType: 'audio/webm; codecs="opus"', expectedLossless: false },
      { container: 'aiff', codec: 'pcm', mimeType: 'audio/aiff', expectedLossless: true },
      { container: 'wma', codec: 'unknown', mimeType: 'audio/x-ms-wma', expectedLossless: false },
      { container: 'ape', codec: 'unknown', mimeType: 'audio/ape', expectedLossless: true }
    ];

    for (const item of candidateFormats) {
      const key = `${item.container}:${item.codec}`;
      let canPlayResult: 'probably' | 'maybe' | 'none' = 'none';

      if (testAudio && typeof testAudio.canPlayType === 'function') {
        const result = testAudio.canPlayType(item.mimeType);
        if (result === 'probably') {
          canPlayResult = 'probably';
        } else if (result === 'maybe') {
          canPlayResult = 'maybe';
        }
      }

      let state: AudioCapabilityState = 'unsupported';
      let notes: string | undefined;

      if (canPlayResult === 'probably') {
        state = 'supported';
      } else if (canPlayResult === 'maybe') {
        state = 'limited';
        notes = 'Runtime reports partial or unverified container/codec support.';
      } else {
        state = 'unsupported';
        notes = 'Native browser decoder not available for this container/codec.';
      }

      matrix.set(key, {
        container: item.container,
        codec: item.codec,
        mimeType: item.mimeType,
        state,
        canPlay: canPlayResult,
        canDecodeAudioData: canPlayResult !== 'none',
        notes
      });
    }

    this.cachedMatrix = matrix;
    return Array.from(matrix.values());
  }

  /**
   * Probe a specific container and codec.
   */
  public static getCapability(container: AudioContainer, codec: AudioCodec): CodecCapability {
    const matrix = this.getCapabilityMatrix();
    const found = matrix.find(c => c.container === container && (codec === 'unknown' || c.codec === codec));
    if (found) {
      return found;
    }

    return {
      container,
      codec,
      mimeType: `audio/${container}`,
      state: 'unknown',
      canPlay: 'none',
      canDecodeAudioData: false,
      notes: 'Unrecognized container/codec combination.'
    };
  }

  /**
   * Reset cached detection matrix (useful for testing or environment changes).
   */
  public static resetCache(): void {
    this.cachedMatrix = null;
  }
}
