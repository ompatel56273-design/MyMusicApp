/**
 * Authoritative Browser File Access Capability Detection.
 * Determines runtime support for File System Access API (showDirectoryPicker),
 * input file pickers, persistent handles in IndexedDB, and permission states.
 */

export interface FileAccessCapabilities {
  readonly hasDirectoryPicker: boolean;
  readonly hasFilePicker: boolean;
  readonly hasPersistentHandles: boolean;
  readonly hasPermissionQuery: boolean;
  readonly isMobile: boolean;
  readonly summary: string;
}

export type PermissionAccessStatus =
  | 'NOT_REQUESTED'
  | 'REQUESTING'
  | 'GRANTED'
  | 'DENIED'
  | 'UNAVAILABLE'
  | 'EXPIRED_OR_REVOKED';

export class FileAccessCapabilityService {
  private static instance?: FileAccessCapabilityService;

  public static getInstance(): FileAccessCapabilityService {
    if (!this.instance) {
      this.instance = new FileAccessCapabilityService();
    }
    return this.instance;
  }

  public getCapabilities(): FileAccessCapabilities {
    const hasDirectoryPicker =
      typeof window !== 'undefined' &&
      typeof (window as any).showDirectoryPicker === 'function';

    const hasFilePicker =
      typeof window !== 'undefined' &&
      (typeof (window as any).showOpenFilePicker === 'function' ||
        typeof document !== 'undefined');

    // Persistent handles supported when IndexedDB and showDirectoryPicker exist
    const hasPersistentHandles =
      hasDirectoryPicker &&
      typeof window !== 'undefined' &&
      'indexedDB' in window;

    const hasPermissionQuery =
      typeof FileSystemHandle !== 'undefined' &&
      typeof (FileSystemHandle.prototype as any).queryPermission === 'function';

    const isMobile = this.detectMobile();

    let summary = 'Full Directory Access';
    if (!hasDirectoryPicker) {
      summary = isMobile
        ? 'Mobile File Access'
        : 'Audio File Selection (Folder API unavailable)';
    }

    return {
      hasDirectoryPicker,
      hasFilePicker,
      hasPersistentHandles,
      hasPermissionQuery,
      isMobile,
      summary
    };
  }

  public async queryDirectoryPermission(
    handle: FileSystemDirectoryHandle
  ): Promise<PermissionAccessStatus> {
    try {
      if (typeof (handle as any).queryPermission === 'function') {
        const state = await (handle as any).queryPermission({ mode: 'read' });
        if (state === 'granted') return 'GRANTED';
        if (state === 'denied') return 'DENIED';
        return 'EXPIRED_OR_REVOKED';
      }
      return 'GRANTED';
    } catch {
      return 'EXPIRED_OR_REVOKED';
    }
  }

  public async requestDirectoryPermission(
    handle: FileSystemDirectoryHandle
  ): Promise<PermissionAccessStatus> {
    try {
      if (typeof (handle as any).requestPermission === 'function') {
        const state = await (handle as any).requestPermission({ mode: 'read' });
        if (state === 'granted') return 'GRANTED';
        if (state === 'denied') return 'DENIED';
        return 'EXPIRED_OR_REVOKED';
      }
      return 'GRANTED';
    } catch {
      return 'DENIED';
    }
  }

  private detectMobile(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const ua = navigator.userAgent || '';
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i;
    const isTouchDevice =
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 0 &&
      window.innerWidth <= 768;

    return mobileRegex.test(ua) || isTouchDevice;
  }
}
