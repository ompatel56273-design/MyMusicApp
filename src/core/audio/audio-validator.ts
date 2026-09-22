/**
 * Authoritative Audio File Validation Utility.
 * Central single-source-of-truth for supported audio extensions and MIME types.
 */

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.m4a',
  '.aac',
  '.wav',
  '.flac',
  '.ogg',
  '.opus',
  '.webm',
  '.aiff',
  '.aif',
  '.alac',
  '.wma',
  '.ape'
] as const;

export type SupportedAudioExtension = typeof SUPPORTED_AUDIO_EXTENSIONS[number];

export const SUPPORTED_AUDIO_EXTENSIONS_SET = new Set<string>(
  SUPPORTED_AUDIO_EXTENSIONS.map(ext => ext.replace(/^\./, '').toLowerCase())
);

export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/aiff',
  'audio/x-aiff',
  'audio/alac',
  'audio/x-alac'
] as const;

export const SUPPORTED_AUDIO_MIME_TYPES_SET = new Set<string>(
  SUPPORTED_AUDIO_MIME_TYPES.map(m => m.toLowerCase())
);

/**
 * Extracts normalized lowercase audio extension (without dot) if recognized.
 */
export function getAudioExtension(filenameOrPath: string): string | null {
  if (!filenameOrPath) return null;
  const lastDot = filenameOrPath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filenameOrPath.length - 1) {
    return null;
  }
  const ext = filenameOrPath.substring(lastDot + 1).toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS_SET.has(ext) ? ext : null;
}

/**
 * Checks if a filename, path, or File object is a supported audio file.
 */
export function isSupportedAudioFile(fileOrPath: File | string): boolean {
  if (typeof fileOrPath === 'string') {
    return getAudioExtension(fileOrPath) !== null;
  }

  if (fileOrPath && typeof fileOrPath === 'object') {
    // 1. Check MIME type if available
    if (fileOrPath.type) {
      const mime = fileOrPath.type.toLowerCase();
      if (SUPPORTED_AUDIO_MIME_TYPES_SET.has(mime) || mime.startsWith('audio/')) {
        // Also verify extension if present
        const ext = getAudioExtension(fileOrPath.name);
        if (ext !== null) return true;
        // If it starts with audio/ and has a recognized extension or generic audio MIME
        if (SUPPORTED_AUDIO_MIME_TYPES_SET.has(mime)) return true;
      }
    }

    // 2. Fall back to filename extension validation
    if (fileOrPath.name) {
      return getAudioExtension(fileOrPath.name) !== null;
    }
  }

  return false;
}

/**
 * Maps a file extension to a standard audio MIME type.
 */
export function getAudioMimeType(extensionOrPath: string): string {
  const ext = (getAudioExtension(extensionOrPath) || extensionOrPath.replace(/^\./, '')).toLowerCase();
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
    case 'alac':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'ogg':
      return 'audio/ogg';
    case 'opus':
      return 'audio/opus';
    case 'webm':
      return 'audio/webm';
    case 'aiff':
    case 'aif':
      return 'audio/aiff';
    default:
      return 'audio/mpeg';
  }
}
