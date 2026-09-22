/**
 * Core Security Sanitization Utilities
 * Prevents XSS / HTML Injection by escaping untrusted metadata before DOM rendering.
 */

/**
 * Escapes special HTML characters in untrusted strings.
 * Handles null, undefined, numbers, and strings cleanly.
 * Preserves unicode and emojis safely.
 */
export function escapeHtml(input: string | number | null | undefined): string {
  if (input === null || input === undefined) {
    return '';
  }

  const str = String(input);
  if (!str) {
    return '';
  }

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
