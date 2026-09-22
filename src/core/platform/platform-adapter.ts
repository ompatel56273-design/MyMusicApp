/**
 * Platform Capabilities Interface & Detector
 * Encapsulates platform feature detection without tying domain logic to browser globals.
 */

export interface PlatformCapabilities {
  hasWebAudio: boolean;
  hasIndexedDB: boolean;
  hasFileSystemAccess: boolean;
  hasMediaSession: boolean;
  hasWebGL: boolean;
  hasWebWorkers: boolean;
}

export class PlatformAdapter {
  private static cachedCapabilities?: PlatformCapabilities;

  public static getCapabilities(): PlatformCapabilities {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const isBrowser = typeof window !== 'undefined';

    const hasWebAudio = isBrowser && (
      'AudioContext' in window || 'webkitAudioContext' in window
    );

    const hasIndexedDB = isBrowser && 'indexedDB' in window;

    const hasFileSystemAccess = isBrowser && (
      'showDirectoryPicker' in window || 'showOpenFilePicker' in window
    );

    const hasMediaSession = isBrowser && 'mediaSession' in navigator;

    const hasWebGL = isBrowser && (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (
          canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        ));
      } catch {
        return false;
      }
    })();

    const hasWebWorkers = typeof Worker !== 'undefined';

    this.cachedCapabilities = {
      hasWebAudio,
      hasIndexedDB,
      hasFileSystemAccess,
      hasMediaSession,
      hasWebGL,
      hasWebWorkers
    };

    return this.cachedCapabilities;
  }
}
