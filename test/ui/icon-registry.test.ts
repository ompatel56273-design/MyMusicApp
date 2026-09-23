import { describe, it, expect } from 'vitest';
import { getIconSvg, createIconElement, type IconName } from '../../src/ui/icons/icon-registry';

describe('Icon Registry', () => {
  it('should render standard SVG string with default options', () => {
    const svg = getIconSvg('play');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('width="20"');
    expect(svg).toContain('height="20"');
    expect(svg).toContain('aria-hidden="true"');
  });

  it('should respect custom size, strokeWidth, and className', () => {
    const svg = getIconSvg('heart', {
      size: 32,
      strokeWidth: 3,
      className: 'custom-icon-class'
    });
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="32"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).toContain('class="app-icon custom-icon-class"');
  });

  it('should render accessible aria-label when provided', () => {
    const svg = getIconSvg('search', { ariaLabel: 'Search Library' });
    expect(svg).toContain('aria-label="Search Library"');
    expect(svg).toContain('role="img"');
    expect(svg).not.toContain('aria-hidden="true"');
  });

  it('should return null or SVGSVGElement depending on document presence', () => {
    const el = createIconElement('pause', { size: 24 });
    if (typeof document === 'undefined') {
      expect(el).toBeNull();
    } else {
      expect(el).toBeInstanceOf(SVGElement);
    }
  });

  it('should support all core icon names', () => {
    const sampleIcons: IconName[] = [
      'home',
      'library',
      'search',
      'playlist',
      'galaxy',
      'equalizer',
      'settings',
      'play',
      'pause',
      'skip-forward',
      'skip-back',
      'volume',
      'music',
      'disc',
      'sound-wave'
    ];

    sampleIcons.forEach(iconName => {
      const svg = getIconSvg(iconName);
      expect(svg).toContain('<svg');
    });
  });
});
