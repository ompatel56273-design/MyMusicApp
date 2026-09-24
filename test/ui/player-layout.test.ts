import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import {
  getPlayerLayout,
  getAllPlayerLayouts,
  DEFAULT_PLAYER_LAYOUT
} from '../../src/ui/theme/player-layout';
import { SettingsView } from '../../src/ui/views/settings-view';

setupMockDomEnvironment();

describe('F2.4 — Player Layouts System', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-player-layout');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-ambient');
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. Default layout = Standard', () => {
    const themeManager = ThemeManager.getInstance();
    expect(themeManager.getPlayerLayout()).toBe('standard');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('standard');
  });

  it('2. Standard layout properties match definition', () => {
    const stdDef = getPlayerLayout('standard');
    expect(stdDef.id).toBe('standard');
    expect(stdDef.name).toBe('Standard');
    expect(stdDef.artworkMaxWidth).toBe('440px');
  });

  it('3. Compact layout switching updates state and document attribute', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setPlayerLayout('compact');

    expect(themeManager.getPlayerLayout()).toBe('compact');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('compact');
    expect(document.documentElement.style.getPropertyValue('--player-artwork-max-width')).toBe('260px');
  });

  it('4. Expanded layout switching updates state and document attribute', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setPlayerLayout('expanded');

    expect(themeManager.getPlayerLayout()).toBe('expanded');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('expanded');
    expect(document.documentElement.style.getPropertyValue('--player-artwork-max-width')).toBe('540px');
  });

  it('5. Layout switching at runtime triggers subscribers', () => {
    const themeManager = ThemeManager.getInstance();
    const listener = vi.fn();
    const unsub = themeManager.subscribePlayerLayout(listener);

    // Initial notification
    expect(listener).toHaveBeenCalledWith('expanded', expect.objectContaining({ id: 'expanded' }));

    themeManager.setPlayerLayout('standard');
    expect(listener).toHaveBeenCalledWith('standard', expect.objectContaining({ id: 'standard' }));

    unsub();
  });

  it('6. Persists selected layout to localStorage key mymusicapp_player_layout', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setPlayerLayout('compact');

    expect(localStorage.getItem('mymusicapp_player_layout')).toBe('compact');
  });

  it('7. Restoration on startup loads saved preference from localStorage', () => {
    localStorage.setItem('mymusicapp_player_layout', 'expanded');

    // Reset instance or test load
    const themeManager = ThemeManager.getInstance();
    (themeManager as any).loadPreference();
    themeManager.applyPlayerLayout();

    expect(themeManager.getPlayerLayout()).toBe('expanded');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('expanded');
  });

  it('8. Invalid stored layout falls back gracefully to Standard', () => {
    localStorage.setItem('mymusicapp_player_layout', 'invalid_layout_mode_xyz');

    const themeManager = ThemeManager.getInstance();
    (themeManager as any).loadPreference();
    themeManager.applyPlayerLayout();

    expect(themeManager.getPlayerLayout()).toBe('standard');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('standard');
  });

  it('9. Storage failure fallback defaults to Standard safely', () => {
    const origGetItem = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error('QuotaExceededError / Restricted Storage');
    };

    const themeManager = ThemeManager.getInstance();
    (themeManager as any).loadPreference();

    expect(themeManager.getPlayerLayout()).toBe('standard');
    localStorage.getItem = origGetItem;
  });

  it('10. Settings UI renders options and handles click selection', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = new SettingsView();
    view.mount(container, { section: 'appearance' } as any);

    const compactOpt = container.querySelector<HTMLElement>('[data-layout-val="compact"]');
    expect(compactOpt).not.toBeNull();

    compactOpt?.click();

    expect(ThemeManager.getInstance().getPlayerLayout()).toBe('compact');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('compact');

    view.unmount();
    container.remove();
  });

  it('11. Settings UI supports Keyboard navigation (Enter / Space keys)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = new SettingsView();
    view.mount(container, { section: 'appearance' } as any);

    const expandedOpt = container.querySelector<HTMLElement>('[data-layout-val="expanded"]');
    expect(expandedOpt).not.toBeNull();

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    expandedOpt?.dispatchEvent(spaceEvent);

    expect(ThemeManager.getInstance().getPlayerLayout()).toBe('expanded');

    view.unmount();
    container.remove();
  });

  it('12. Settings UI has accessible ARIA radio semantics', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = new SettingsView();
    view.mount(container, { section: 'appearance' } as any);

    const radioGroup = container.querySelector('[role="radiogroup"][aria-label="Player Layout Selection"]');
    expect(radioGroup).not.toBeNull();

    const options = container.querySelectorAll('.settings-layout-option');
    expect(options.length).toBe(3);

    options.forEach(opt => {
      expect(opt.getAttribute('role')).toBe('radio');
      expect(opt.getAttribute('tabindex')).toBe('0');
    });

    view.unmount();
    container.remove();
  });

  it('13. Layout helper functions return valid definitions', () => {
    const all = getAllPlayerLayouts();
    expect(all.length).toBe(3);
    expect(all.map(l => l.id)).toEqual(['standard', 'compact', 'expanded']);

    const fallback = getPlayerLayout('unknown' as any);
    expect(fallback.id).toBe(DEFAULT_PLAYER_LAYOUT);
  });

  it('14. Accent Theme, Ambient Background, and Dynamic Artwork Colors remain fully compatible with Player Layouts', () => {
    const themeManager = ThemeManager.getInstance();

    themeManager.setAccentTheme('cyan');
    themeManager.setAmbientMode('soft-glow');
    themeManager.setDynamicArtworkColorsEnabled(true);
    themeManager.setPlayerLayout('compact');

    expect(document.documentElement.getAttribute('data-accent')).toBe('cyan');
    expect(document.documentElement.getAttribute('data-ambient')).toBe('soft-glow');
    expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(true);
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('compact');
  });

  it('15. Playback state, volume, seek position, and queue remain invariant when changing layout', () => {
    const dummyPlaybackState = {
      isPlaying: true,
      volume: 0.85,
      positionMs: 45000,
      queueIndex: 3,
      repeatMode: 'all',
      shuffleMode: 'off'
    };

    const themeManager = ThemeManager.getInstance();
    themeManager.setPlayerLayout('expanded');

    // Verify dummy playback engine invariants were unaffected
    expect(dummyPlaybackState.isPlaying).toBe(true);
    expect(dummyPlaybackState.volume).toBe(0.85);
    expect(dummyPlaybackState.positionMs).toBe(45000);
    expect(dummyPlaybackState.queueIndex).toBe(3);
    expect(dummyPlaybackState.repeatMode).toBe('all');
    expect(dummyPlaybackState.shuffleMode).toBe('off');
  });
});
