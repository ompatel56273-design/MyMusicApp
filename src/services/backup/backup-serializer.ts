import { type MyMusicBackupBundle } from './backup-types';

export class BackupSerializer {
  /**
   * Serializes a MyMusicBackupBundle into a formatted JSON string.
   */
  public static serialize(bundle: MyMusicBackupBundle): string {
    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Parses a raw JSON string into an untyped object for validation.
   */
  public static deserialize(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      throw new Error(`Failed to parse backup file as JSON: ${(err as Error).message}`);
    }
  }

  /**
   * Triggers a browser file download of the given content with a specified filename.
   */
  public static triggerDownload(content: string, filename: string): void {
    if (typeof document === 'undefined') {
      return; // Non-DOM environment protection
    }

    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Reads a File or Blob object and resolves to its text content.
   */
  public static async readFileAsText(file: File | Blob): Promise<string> {
    if (typeof file.text === 'function') {
      return file.text();
    }

    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file as string.'));
          }
        };

        reader.onerror = () => {
          reject(new Error(`File read error: ${reader.error?.message || 'Unknown error'}`));
        };

        reader.readAsText(file, 'utf-8');
      });
    }

    throw new Error('File reading is not supported in the current environment.');
  }
}
