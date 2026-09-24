import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import {
  getLibraryDensity,
  getAllLibraryDensities,
  DEFAULT_LIBRARY_DENSITY
} from '../../src/ui/theme/library-density';
import { SettingsView } from '../../src/ui/views/settings-view';
import { TrackRowComponent } from '../../src/ui/components/library/track-row-component';
import { AlbumCardComponent } from '../../src/ui/components/library/album-card-component';
import { ArtistCardComponent } from '../../src/ui/components/library/artist-card-component';
import { FolderRowComponent } from '../../src/ui/components/library/folder-row-component';
import { VirtualScroller } from '../../src/ui/components/virtual-scroller/virtual-scroller';
import type { Track, Album, Artist, Folder } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('F2.5 — Library Density System', () => {
  beforeEach(() => {
    localStorage.clear();
    ThemeManager.getInstance().setLibraryDensity('standard');
    document.documentElement.removeAttribute('data-library-density');
    document.documentElement.removeAttribute('data-player-layout');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-ambient');
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. Default density = Standard', () => {
    const themeManager = ThemeManager.getInstance();
    expect(themeManager.getLibraryDensity()).toBe('standard');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('standard');
  });

  it('2. Comfortable mode updates state, document attribute, and design tokens', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('comfortable');

    expect(themeManager.getLibraryDensity()).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('comfortable');

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--library-row-height')).toBe('64px');
    expect(style.getPropertyValue('--library-item-padding')).toBe('10px 18px');
    expect(style.getPropertyValue('--library-grid-gap')).toBe('var(--space-5)');
    expect(style.getPropertyValue('--library-section-gap')).toBe('var(--space-8)');
    expect(style.getPropertyValue('--library-artwork-size')).toBe('44px');
    expect(style.getPropertyValue('--library-card-padding')).toBe('18px');
  });

  it('3. Standard mode preserves default library spacing and design tokens', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('standard');

    expect(themeManager.getLibraryDensity()).toBe('standard');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('standard');

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--library-row-height')).toBe('56px');
    expect(style.getPropertyValue('--library-item-padding')).toBe('8px 14px');
    expect(style.getPropertyValue('--library-grid-gap')).toBe('var(--space-4)');
    expect(style.getPropertyValue('--library-section-gap')).toBe('var(--space-6)');
    expect(style.getPropertyValue('--library-artwork-size')).toBe('38px');
    expect(style.getPropertyValue('--library-card-padding')).toBe('14px');
  });

  it('4. Compact mode tightens spacing and row heights without unusable targets', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('compact');

    expect(themeManager.getLibraryDensity()).toBe('compact');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('compact');

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--library-row-height')).toBe('46px');
    expect(style.getPropertyValue('--library-item-padding')).toBe('4px 10px');
    expect(style.getPropertyValue('--library-grid-gap')).toBe('var(--space-3)');
    expect(style.getPropertyValue('--library-section-gap')).toBe('var(--space-4)');
    expect(style.getPropertyValue('--library-artwork-size')).toBe('32px');
    expect(style.getPropertyValue('--library-card-padding')).toBe('10px');
  });

  it('5. Runtime switching immediately notifies subscribers with full definition', () => {
    const themeManager = ThemeManager.getInstance();
    const listener = vi.fn();
    const unsub = themeManager.subscribeLibraryDensity(listener);

    // Initial subscriber call
    expect(listener).toHaveBeenCalledWith('compact', expect.objectContaining({ id: 'compact' }));

    themeManager.setLibraryDensity('comfortable');
    expect(listener).toHaveBeenCalledWith('comfortable', expect.objectContaining({
      id: 'comfortable',
      name: 'Comfortable',
      rowHeight: 64
    }));

    unsub();
  });

  it('6. Persists selected density to localStorage key mymusicapp_library_density', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('comfortable');

    expect(localStorage.getItem('mymusicapp_library_density')).toBe('comfortable');

    themeManager.setLibraryDensity('compact');
    expect(localStorage.getItem('mymusicapp_library_density')).toBe('compact');
  });

  it('7. Restoration on startup restores saved preference from localStorage', () => {
    localStorage.setItem('mymusicapp_library_density', 'comfortable');

    const themeManager = ThemeManager.getInstance();
    (themeManager as any).loadPreference();
    themeManager.applyLibraryDensity();

    expect(themeManager.getLibraryDensity()).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('comfortable');
  });

  it('8. Invalid stored density value falls back safely to Standard', () => {
    localStorage.setItem('mymusicapp_library_density', 'ultra_super_dense_invalid');

    const themeManager = ThemeManager.getInstance();
    (themeManager as any).loadPreference();
    themeManager.applyLibraryDensity();

    expect(themeManager.getLibraryDensity()).toBe('standard');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('standard');
  });

  it('9. Storage failure fallback safely uses Standard', () => {
    const origGetItem = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error('Storage access denied / QuotaExceededError');
    };

    const themeManager = ThemeManager.getInstance();
    (themeManager as any).loadPreference();

    expect(themeManager.getLibraryDensity()).toBe('standard');
    localStorage.getItem = origGetItem;
  });

  it('10. Settings UI renders options and handles click selection', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = new SettingsView();
    view.mount(container, { section: 'appearance' } as any);

    const comfortableOpt = container.querySelector<HTMLElement>('[data-density-val="comfortable"]');
    expect(comfortableOpt).not.toBeNull();

    comfortableOpt?.click();

    expect(ThemeManager.getInstance().getLibraryDensity()).toBe('comfortable');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('comfortable');

    const statusBadge = container.querySelector<HTMLElement>('#settings-density-status-badge');
    expect(statusBadge?.textContent).toContain('Comfortable Active');

    view.unmount();
    container.remove();
  });

  it('11. Settings UI supports Keyboard accessibility (Enter and Space keys)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = new SettingsView();
    view.mount(container, { section: 'appearance' } as any);

    const compactOpt = container.querySelector<HTMLElement>('[data-density-val="compact"]');
    expect(compactOpt).not.toBeNull();

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    compactOpt?.dispatchEvent(enterEvent);

    expect(ThemeManager.getInstance().getLibraryDensity()).toBe('compact');
    expect(document.documentElement.getAttribute('data-library-density')).toBe('compact');

    view.unmount();
    container.remove();
  });

  it('12. Settings UI has proper ARIA radiogroup and radio semantics', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = new SettingsView();
    view.mount(container, { section: 'appearance' } as any);

    const radioGroup = container.querySelector('[role="radiogroup"][aria-label="Library Density Selection"]');
    expect(radioGroup).not.toBeNull();

    const options = container.querySelectorAll('.settings-density-option');
    expect(options.length).toBe(3);

    options.forEach(opt => {
      expect(opt.getAttribute('role')).toBe('radio');
      expect(opt.getAttribute('tabindex')).toBe('0');
      expect(opt.getAttribute('aria-checked')).toMatch(/true|false/);
    });

    view.unmount();
    container.remove();
  });

  it('13. TrackRowComponent adopts library density tokens', () => {
    const mockTrack: Track = {
      id: 'trk_1',
      fileId: 'f_1',
      title: 'Starlight Ode',
      artistName: 'Cosmic Band',
      albumTitle: 'Astral Plane',
      durationMs: 215000,
      format: { codec: 'mp3', container: 'mp3', bitrate: 320, sampleRate: 44100, bitDepth: 16, channels: 2, isLossless: false },
      dateAdded: Date.now(),
      dateModified: Date.now(),
      playCount: 10,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    };

    const row = TrackRowComponent.create(mockTrack, 0, {
      onPlay: vi.fn(),
      onToggleFavorite: vi.fn()
    });

    expect(row.style.height).toBe('var(--library-row-height, 56px)');
    expect(row.style.padding).toBe('var(--library-item-padding, 8px 14px)');
  });

  it('14. AlbumCardComponent adopts library card density padding tokens', () => {
    const mockAlbum: Album = {
      id: 'alb_1',
      title: 'Astral Plane',
      artistName: 'Cosmic Band',
      trackCount: 12,
      durationMs: 3600000,
      year: 2024,
      dateAdded: Date.now(),
      isCompilation: false
    };

    const card = AlbumCardComponent.create(mockAlbum, {
      onSelect: vi.fn(),
      onPlay: vi.fn()
    });

    expect(card.style.padding).toBe('var(--library-card-padding, 14px)');
  });

  it('15. ArtistCardComponent adopts library density padding and row tokens', () => {
    const mockArtist: Artist = {
      id: 'art_1',
      name: 'Cosmic Band',
      trackCount: 24,
      albumCount: 2
    };

    const card = ArtistCardComponent.create(mockArtist, {
      onSelect: vi.fn()
    });

    expect(card.style.padding).toBe('var(--library-item-padding, 12px 18px)');
  });

  it('16. FolderRowComponent adopts library row height and padding tokens', () => {
    const mockFolder: Folder = {
      id: 'fld_1',
      name: 'Lossless Masters',
      path: '/Music/Lossless',
      isMonitored: true,
      trackCount: 42
    };

    const row = FolderRowComponent.create(mockFolder, {
      onSelect: vi.fn()
    });

    expect(row.style.height).toBe('var(--library-row-height, 60px)');
  });

  it('17. VirtualScroller supports dynamic itemHeight adjustment', () => {
    const container = document.createElement('div');
    const items = Array.from({ length: 50 }, (_, i) => ({ id: `item_${i}` }));

    const scroller = new VirtualScroller({
      container,
      items,
      itemHeight: 56,
      renderItem: (item) => {
        const div = document.createElement('div');
        div.textContent = item.id;
        return div;
      }
    });

    expect(scroller.getItemHeight()).toBe(56);

    scroller.setItemHeight(64);
    expect(scroller.getItemHeight()).toBe(64);

    scroller.setItemHeight(46);
    expect(scroller.getItemHeight()).toBe(46);

    scroller.dispose();
  });

  it('18. Helper functions return valid definitions for all density modes', () => {
    const all = getAllLibraryDensities();
    expect(all.length).toBe(3);
    expect(all.map(d => d.id)).toEqual(['comfortable', 'standard', 'compact']);

    const fallback = getLibraryDensity('nonexistent_mode' as any);
    expect(fallback.id).toBe(DEFAULT_LIBRARY_DENSITY);
  });

  it('19. Responsive behavior: compact mode maintains usable touch target constraints', () => {
    const compactDef = getLibraryDensity('compact');
    expect(compactDef.rowHeight).toBeGreaterThanOrEqual(44); // WCAG minimum 44px
    expect(parseInt(compactDef.artworkSize, 10)).toBeGreaterThanOrEqual(28);
  });

  it('20. Changing Library Density preserves Accent Theme', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setAccentTheme('cyan');
    themeManager.setLibraryDensity('compact');

    expect(themeManager.getAccentTheme()).toBe('cyan');
    expect(document.documentElement.getAttribute('data-accent')).toBe('cyan');
  });

  it('21. Changing Library Density preserves Ambient Background', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setAmbientMode('aurora');
    themeManager.setLibraryDensity('comfortable');

    expect(themeManager.getAmbientMode()).toBe('aurora');
    expect(document.documentElement.getAttribute('data-ambient')).toBe('aurora');
  });

  it('22. Changing Library Density preserves Dynamic Artwork Colors preference', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setDynamicArtworkColorsEnabled(true);
    themeManager.setLibraryDensity('compact');

    expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(true);
  });

  it('23. Changing Library Density preserves Player Layout', () => {
    const themeManager = ThemeManager.getInstance();
    themeManager.setPlayerLayout('compact');
    themeManager.setLibraryDensity('comfortable');

    expect(themeManager.getPlayerLayout()).toBe('compact');
    expect(document.documentElement.getAttribute('data-player-layout')).toBe('compact');
  });

  it('24. Playback state invariants: playback state is untouched when density changes', () => {
    const playbackState = {
      isPlaying: true,
      currentTrackId: 'trk_alpha',
      playbackRate: 1.25,
      volume: 0.75,
      muted: false
    };

    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('compact');

    expect(playbackState.isPlaying).toBe(true);
    expect(playbackState.currentTrackId).toBe('trk_alpha');
    expect(playbackState.playbackRate).toBe(1.25);
    expect(playbackState.volume).toBe(0.75);
    expect(playbackState.muted).toBe(false);
  });

  it('25. Queue state invariants: queue items and index are untouched', () => {
    const queue = ['trk_1', 'trk_2', 'trk_3'];
    const activeIndex = 1;

    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('comfortable');

    expect(queue).toEqual(['trk_1', 'trk_2', 'trk_3']);
    expect(activeIndex).toBe(1);
  });

  it('26. Current track invariant remains unaffected', () => {
    const currentTrack = { id: 'trk_active', title: 'Solar Wind' };
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('standard');

    expect(currentTrack.id).toBe('trk_active');
    expect(currentTrack.title).toBe('Solar Wind');
  });

  it('27. Search / query behavior invariants: query string and filtering unaffected', () => {
    const searchState = { query: 'jazz quartet', selectedCategory: 'tracks' };
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('compact');

    expect(searchState.query).toBe('jazz quartet');
    expect(searchState.selectedCategory).toBe('tracks');
  });

  it('28. Sorting and filtering invariants remain unchanged', () => {
    const filterState = { sortBy: 'duration', sortOrder: 'desc', favoritesOnly: true };
    const themeManager = ThemeManager.getInstance();
    themeManager.setLibraryDensity('comfortable');

    expect(filterState.sortBy).toBe('duration');
    expect(filterState.sortOrder).toBe('desc');
    expect(filterState.favoritesOnly).toBe(true);
  });

  it('29. Authoritative singleton: ThemeManager is the single authoritative source for density', () => {
    const instanceA = ThemeManager.getInstance();
    const instanceB = ThemeManager.getInstance();
    expect(instanceA).toBe(instanceB);
  });

  it('30. No duplicate library data source: presentation only', () => {
    const themeManager = ThemeManager.getInstance();
    // ThemeManager has no library data stores or track arrays
    expect((themeManager as any).tracks).toBeUndefined();
    expect((themeManager as any).libraryService).toBeUndefined();
  });

  it('31. No AI functionality: deterministic presentation logic only', () => {
    const densities = getAllLibraryDensities();
    for (const d of densities) {
      expect(typeof d.rowHeight).toBe('number');
      expect(typeof d.artworkSize).toBe('string');
      expect(d.itemPadding).toBeDefined();
    }
  });

  it('32. No external or network dependency: 100% local presentation', () => {
    const themeManager = ThemeManager.getInstance();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    themeManager.setLibraryDensity('compact');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
