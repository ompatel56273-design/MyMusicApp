export interface DiscoveredFileEntry {
  readonly path: string;
  readonly name: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly modifiedTimeMs: number;
  readonly parentPath: string;
}

export interface IFilesystemAdapter {
  isAvailable(): boolean;
  normalizePath(rawPath: string): string;
  isAudioFile(filename: string): boolean;
  getAudioExtension(filename: string): string | null;
  readFile(path: string): Promise<Uint8Array>;
  traverseDirectory(
    rootPath: string,
    onFile: (entry: DiscoveredFileEntry) => void | Promise<void>,
    options?: {
      onDirectory?: (dirPath: string) => void | Promise<void>;
      onUnsupported?: (entryPath: string, filename: string) => void | Promise<void>;
      onError?: (path: string, error: Error) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ filesDiscovered: number; directoriesDiscovered: number }>;
}

export { SUPPORTED_AUDIO_EXTENSIONS_SET as SUPPORTED_AUDIO_EXTENSIONS } from '../../core/audio/audio-validator';
import { getAudioExtension as validateAudioExt, isSupportedAudioFile } from '../../core/audio/audio-validator';

/**
 * Base Filesystem Adapter with standard path normalization and audio extension validation.
 */
export class BaseFilesystemAdapter {
  public normalizePath(rawPath: string): string {
    if (!rawPath) return '';

    // Convert backslashes to forward slashes
    let normalized = rawPath.replace(/\\/g, '/');

    // Handle Windows drive letter prefix (e.g., "C:" or "c:/")
    let drivePrefix = '';
    const driveMatch = /^([a-zA-Z]:)/.exec(normalized);
    if (driveMatch) {
      drivePrefix = driveMatch[1]!.toUpperCase();
      normalized = normalized.substring(driveMatch[1]!.length);
    }

    const isAbsolute = normalized.startsWith('/');

    // Split path segments & resolve '.' and '..'
    const rawSegments = normalized.split('/');
    const resolvedSegments: string[] = [];

    for (const seg of rawSegments) {
      if (seg === '' || seg === '.') {
        continue;
      }
      if (seg === '..') {
        if (resolvedSegments.length > 0 && resolvedSegments[resolvedSegments.length - 1] !== '..') {
          resolvedSegments.pop();
        } else if (!isAbsolute && !drivePrefix) {
          resolvedSegments.push('..');
        }
      } else {
        resolvedSegments.push(seg);
      }
    }

    let result = resolvedSegments.join('/');

    if (drivePrefix) {
      result = drivePrefix + (result ? '/' + result : '');
    } else if (isAbsolute) {
      result = '/' + result;
    }

    return result || (isAbsolute ? '/' : drivePrefix);
  }

  public getAudioExtension(filename: string): string | null {
    return validateAudioExt(filename);
  }

  public isAudioFile(filename: string): boolean {
    return isSupportedAudioFile(filename);
  }
}

/**
 * In-Memory / Virtual Filesystem Adapter.
 * Provides high-speed, deterministic traversal for testing, synthetic benchmarks, and non-DOM environments.
 */
export class VirtualFilesystemAdapter extends BaseFilesystemAdapter implements IFilesystemAdapter {
  private files = new Map<string, DiscoveredFileEntry>();
  private buffers = new Map<string, Uint8Array>();
  private directories = new Set<string>();

  public isAvailable(): boolean {
    return true;
  }

  public addVirtualFile(path: string, sizeBytes: number = 1024, modifiedTimeMs: number = Date.now(), buffer?: Uint8Array): void {
    const normalized = this.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    const parentPath = lastSlash !== -1 ? normalized.substring(0, lastSlash) : '';
    const name = lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;
    const lastDot = name.lastIndexOf('.');
    const extension = lastDot !== -1 ? name.substring(lastDot + 1).toLowerCase() : '';

    this.files.set(normalized, {
      path: normalized,
      name,
      extension,
      sizeBytes,
      modifiedTimeMs,
      parentPath
    });

    if (buffer) {
      this.buffers.set(normalized, buffer);
    }

    if (parentPath) {
      this.directories.add(parentPath);
    }
  }

  public async readFile(path: string): Promise<Uint8Array> {
    const normalized = this.normalizePath(path);
    const buf = this.buffers.get(normalized);
    if (buf) {
      return buf;
    }
    const entry = this.files.get(normalized);
    if (!entry) {
      throw new Error(`File not found: ${normalized}`);
    }
    return new Uint8Array(entry.sizeBytes);
  }

  public removeVirtualFile(path: string): boolean {
    const normalized = this.normalizePath(path);
    this.buffers.delete(normalized);
    return this.files.delete(normalized);
  }

  public clear(): void {
    this.files.clear();
    this.buffers.clear();
    this.directories.clear();
  }

  public async traverseDirectory(
    rootPath: string,
    onFile: (entry: DiscoveredFileEntry) => void | Promise<void>,
    options?: {
      onDirectory?: (dirPath: string) => void | Promise<void>;
      onUnsupported?: (entryPath: string, filename: string) => void | Promise<void>;
      onError?: (path: string, error: Error) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ filesDiscovered: number; directoriesDiscovered: number }> {
    const normalizedRoot = this.normalizePath(rootPath);
    let filesCount = 0;
    let dirsCount = 0;

    for (const dir of this.directories) {
      if (options?.signal?.aborted) break;
      if (dir === normalizedRoot || dir.startsWith(normalizedRoot + '/')) {
        dirsCount++;
        if (options?.onDirectory) {
          try {
            await options.onDirectory(dir);
          } catch (e) {
            options.onError?.(dir, e as Error);
          }
        }
      }
    }

    for (const [filePath, entry] of this.files) {
      if (options?.signal?.aborted) break;
      if (filePath.startsWith(normalizedRoot + '/') || filePath === normalizedRoot) {
        if (this.isAudioFile(entry.name)) {
          filesCount++;
          try {
            await onFile(entry);
          } catch (e) {
            options?.onError?.(filePath, e as Error);
          }
        } else {
          try {
            await options?.onUnsupported?.(filePath, entry.name);
          } catch (e) {
            options?.onError?.(filePath, e as Error);
          }
        }
      }
    }

    return { filesDiscovered: filesCount, directoriesDiscovered: dirsCount };
  }
}
