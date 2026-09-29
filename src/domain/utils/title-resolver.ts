import type { Track } from '../entities/models';

/**
 * Common audio file extensions to strip when deriving title from filename.
 */
const AUDIO_EXTENSION_REGEX = /\.(mp3|flac|wav|ogg|m4a|aac|opus|alac|wma|aiff|aif|ape|mka|dsd|dsf|dff)$/i;

/**
 * Cleans a filename string for human display:
 * 1. Strips directory paths
 * 2. Strips audio extension
 * 3. Cleans track number prefixes if present
 * 4. Converts underscores to spaces
 * 5. Collapses multiple spaces
 * 6. Preserves Unicode, Japanese/Korean, hyphens, parentheses, etc.
 */
export function cleanFilenameTitle(filenameOrPath: string): string {
  if (!filenameOrPath || !filenameOrPath.trim()) return '';

  // Extract base filename (handles both '/' and '\')
  const cleanPath = filenameOrPath.replace(/\\/g, '/');
  const baseName = cleanPath.substring(cleanPath.lastIndexOf('/') + 1).trim();

  // Strip audio extension
  let withoutExt = baseName.replace(AUDIO_EXTENSION_REGEX, '').trim();
  if (!withoutExt) withoutExt = baseName;

  // Replace underscores with space
  withoutExt = withoutExt.replace(/_/g, ' ');

  // Remove leading track number prefix like "01 - " or "01. " or "01 " if followed by text
  const strippedPrefix = withoutExt.replace(/^(\d{1,3})[\s._-]+\s*/, '').trim();
  if (strippedPrefix) {
    withoutExt = strippedPrefix;
  }

  // Collapse multiple whitespace
  withoutExt = withoutExt.replace(/\s+/g, ' ').trim();

  return withoutExt;
}

/**
 * Title Resolution Strategy:
 * Priority:
 * 1. Valid embedded metadata title (if non-empty string and not just extension/empty)
 * 2. Existing normalized title
 * 3. Filename-derived fallback
 * 4. Fallback: 'Unknown Title'
 */
export function resolveDisplayTitle(
  trackOrTitle?: Partial<Track> | { title?: string; path?: string; filename?: string; fileId?: string } | string | null | undefined
): string {
  if (!trackOrTitle) {
    return 'Unknown Title';
  }

  if (typeof trackOrTitle === 'string') {
    const trimmed = trackOrTitle.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown track' || trimmed.toLowerCase() === 'unknown title') {
      return 'Unknown Title';
    }
    // If string ends with an audio extension or contains raw filename format
    if (AUDIO_EXTENSION_REGEX.test(trimmed) || (trimmed.includes('_') && !trimmed.includes(' '))) {
      const cleaned = cleanFilenameTitle(trimmed);
      return cleaned || trimmed;
    }
    return trimmed;
  }

  const title = trackOrTitle.title ? trackOrTitle.title.trim() : '';

  // 1. If we have a valid non-empty title that is not just 'Unknown Track' / 'Unknown Title'
  if (title && title.toLowerCase() !== 'unknown track' && title.toLowerCase() !== 'unknown title') {
    // If title has file extension or raw filename underscores without spaces
    if (AUDIO_EXTENSION_REGEX.test(title) || (title.includes('_') && !title.includes(' '))) {
      const cleaned = cleanFilenameTitle(title);
      if (cleaned) return cleaned;
    }
    return title;
  }

  // 2. Fallback to filename / path if available
  const filename = (trackOrTitle as any).filename || (trackOrTitle as any).path || (trackOrTitle as any).audioFile?.filename;
  if (filename && typeof filename === 'string' && filename.trim()) {
    const cleaned = cleanFilenameTitle(filename);
    if (cleaned) return cleaned;
  }

  return 'Unknown Title';
}
