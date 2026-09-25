import { BaseFilesystemAdapter, type IFilesystemAdapter, type DiscoveredFileEntry } from './filesystem-adapter';
import { ScannerError } from '../../core/errors/app-error';
import { Logger } from '../../core/logging/logger';

/**
 * Browser-native File System Access API Adapter.
 * Traverses user-selected directories via FileSystemDirectoryHandle with permission safety.
 */
export class BrowserFilesystemAdapter extends BaseFilesystemAdapter implements IFilesystemAdapter {
  private readonly logger = new Logger('BrowserFilesystemAdapter');
  private rootHandles = new Map<string, FileSystemDirectoryHandle>();
  private fileMap = new Map<string, File>();

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  public registerDirectoryHandle(path: string, handle: FileSystemDirectoryHandle): void {
    const normalized = this.normalizePath(path);
    this.rootHandles.set(normalized, handle);
  }

  public getDirectoryHandle(path: string): FileSystemDirectoryHandle | undefined {
    const normalized = this.normalizePath(path);
    return this.rootHandles.get(normalized);
  }

  public registerFile(path: string, file: File): void {
    const normalized = this.normalizePath(path);
    this.fileMap.set(normalized, file);
  }

  public getRegisteredFile(path: string): File | undefined {
    const normalized = this.normalizePath(path);
    return this.fileMap.get(normalized);
  }

  public async readFile(path: string): Promise<Uint8Array> {
    const normalized = this.normalizePath(path);

    // 1. Check if directly registered in fileMap
    const directFile = this.fileMap.get(normalized);
    if (directFile) {
      const arrayBuffer = await directFile.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // 2. Find matching root handle
    let matchedRoot = '';
    let relativePath = '';
    for (const [root] of this.rootHandles) {
      if (normalized === root || normalized.startsWith(root + '/')) {
        if (root.length > matchedRoot.length) {
          matchedRoot = root;
          relativePath = normalized.substring(root.length).replace(/^\/+/, '');
        }
      }
    }

    const rootHandle = this.rootHandles.get(matchedRoot);
    if (!rootHandle) {
      throw new ScannerError(`No file or root handle found for file path: ${path}`, 'ERR_HANDLE_NOT_FOUND');
    }

    const segments = relativePath.split('/');
    let currentDir = rootHandle;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!;
      currentDir = await currentDir.getDirectoryHandle(seg);
    }

    const fileName = segments[segments.length - 1]!;
    const fileHandle = await currentDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
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
    const handle = this.rootHandles.get(normalizedRoot);

    if (!handle) {
      throw new ScannerError(
        `Directory handle not found for root: ${normalizedRoot}`,
        'ERR_SCANNER_HANDLE_NOT_FOUND',
        { rootPath: normalizedRoot }
      );
    }

    let filesDiscovered = 0;
    let directoriesDiscovered = 0;

    const traverseHandle = async (
      dirHandle: FileSystemDirectoryHandle,
      currentPath: string
    ): Promise<void> => {
      if (options?.signal?.aborted) return;

      try {
        directoriesDiscovered++;
        if (options?.onDirectory) {
          try {
            await options.onDirectory(currentPath);
          } catch (dirCbErr) {
            options?.onError?.(currentPath, dirCbErr as Error);
          }
        }

        // Iterate entries safely
        let entriesIterable: AsyncIterable<[string, FileSystemHandle]>;
        try {
          entriesIterable = (dirHandle as any).entries();
        } catch (entriesErr) {
          this.logger.warn(`Failed to open directory entries for: ${currentPath}`, { error: entriesErr });
          options?.onError?.(currentPath, entriesErr as Error);
          return;
        }

        for await (const [name, entryHandle] of entriesIterable) {
          if (options?.signal?.aborted) break;

          const entryPath = `${currentPath}/${name}`;

          try {
            if (entryHandle.kind === 'file') {
              if (this.isAudioFile(name)) {
                try {
                  const file = await (entryHandle as FileSystemFileHandle).getFile();
                  const ext = this.getAudioExtension(name) || '';

                  filesDiscovered++;
                  await onFile({
                    path: entryPath,
                    name,
                    extension: ext,
                    sizeBytes: file.size,
                    modifiedTimeMs: file.lastModified,
                    parentPath: currentPath
                  });
                } catch (fileErr) {
                  this.logger.warn(`Failed to read file metadata for: ${entryPath}`, { error: fileErr });
                  options?.onError?.(entryPath, fileErr as Error);
                }
              } else {
                try {
                  await options?.onUnsupported?.(entryPath, name);
                } catch (unsupportedErr) {
                  options?.onError?.(entryPath, unsupportedErr as Error);
                }
              }
            } else if (entryHandle.kind === 'directory') {
              // Recurse safely into sub-directory
              try {
                await traverseHandle(entryHandle as FileSystemDirectoryHandle, entryPath);
              } catch (subDirErr) {
                this.logger.warn(`Failed to traverse sub-directory: ${entryPath}`, { error: subDirErr });
                options?.onError?.(entryPath, subDirErr as Error);
              }
            }
          } catch (entryErr) {
            this.logger.warn(`Error processing entry: ${entryPath}`, { error: entryErr });
            options?.onError?.(entryPath, entryErr as Error);
          }
        }
      } catch (dirErr) {
        this.logger.error(`Error reading directory: ${currentPath}`, dirErr);
        options?.onError?.(currentPath, dirErr as Error);
      }
    };

    await traverseHandle(handle, normalizedRoot);

    return { filesDiscovered, directoriesDiscovered };
  }
}
