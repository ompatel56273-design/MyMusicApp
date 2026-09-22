import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/core/security/html-sanitizer';

describe('Security HTML Escaping', () => {
  it('escapes script tags to prevent execution', () => {
    const malicious = '<script>alert(1)</script>';
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escaped).not.toContain('<script>');
  });

  it('escapes event handler image injection', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escaped).not.toContain('<img');
  });

  it('escapes double quotes, single quotes, ampersands, and brackets', () => {
    const input = `Rock & "Roll" 'N' <Roll>`;
    const escaped = escapeHtml(input);
    expect(escaped).toBe('Rock &amp; &quot;Roll&quot; &#039;N&#039; &lt;Roll&gt;');
  });

  it('preserves ordinary unicode characters and emojis', () => {
    const input = '🎵 Beethoven - Symphony No. 9 🎻 (Für Elise)';
    const escaped = escapeHtml(input);
    expect(escaped).toBe('🎵 Beethoven - Symphony No. 9 🎻 (Für Elise)');
  });

  it('handles null, undefined, and empty string safely', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('handles numbers gracefully', () => {
    expect(escapeHtml(2024)).toBe('2024');
    expect(escapeHtml(0)).toBe('0');
  });
});
