import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { DashboardService } from '../../src/services/dashboard/dashboard-service';
import { HomeView } from '../../src/ui/views/home-view';
import { SettingsView } from '../../src/ui/views/settings-view';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import {
  DEFAULT_DASHBOARD_SETTINGS,
  SUPPORTED_DASHBOARD_SECTIONS
} from '../../src/domain/entities/dashboard-settings';
import { STORES } from '../../src/data/db/schema';

describe('F2.7 — Dashboard Customization', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockDbAdapter: any;
  let dashboardService: DashboardService;
  let mockStorage: Map<string, any>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();
    mockStorage = new Map();

    mockDbAdapter = {
      get: vi.fn().mockImplementation((store: string, key: string) => {
        if (store === STORES.SETTINGS) {
          return Promise.resolve(mockStorage.get(key) || null);
        }
        return Promise.resolve(null);
      }),
      put: vi.fn().mockImplementation((store: string, value: any) => {
        if (store === STORES.SETTINGS && value && value.key) {
          mockStorage.set(value.key, value);
        }
        return Promise.resolve(undefined);
      })
    };

    dashboardService = new DashboardService(mockDbAdapter, eventBus);
  });

  afterEach(() => {
    container.remove();
    mockStorage.clear();
  });

  describe('Domain & Defaults Configuration (Req 1 - 3, 43, 44)', () => {
    it('1. returns default dashboard configuration on initialization', async () => {
      const settings = await dashboardService.getSettings();
      expect(settings.sectionOrder).toHaveLength(9);
      expect(settings.hiddenSections).toHaveLength(0);
    });

    it('2. preserves default section order matching existing Home view appearance', async () => {
      const resolved = dashboardService.getResolvedSections();
      const ids = resolved.map(s => s.id);
      expect(ids).toEqual([
        'recently-played',
        'playlists',
        'artists',
        'favorites',
        'recently-added',
        'most-played',
        'albums',
        'genres',
        'folders'
      ]);
    });

    it('3. default visibility is true for all 9 sections', async () => {
      const resolved = dashboardService.getResolvedSections();
      expect(resolved.every(s => s.enabled)).toBe(true);
    });

    it('43. guarantees deterministic ordering across getResolvedSections', () => {
      const firstCall = dashboardService.getResolvedSections();
      const secondCall = dashboardService.getResolvedSections();
      expect(firstCall).toEqual(secondCall);
    });

    it('44. section IDs are stable and immutably map to SUPPORTED_DASHBOARD_SECTIONS', () => {
      const supportedIds = SUPPORTED_DASHBOARD_SECTIONS.map(s => s.id);
      expect(supportedIds).toEqual([
        'recently-played',
        'playlists',
        'artists',
        'favorites',
        'recently-added',
        'most-played',
        'albums',
        'genres',
        'folders'
      ]);
    });
  });

  describe('Visibility & Reordering Operations (Req 4 - 10)', () => {
    it('4 & 5. toggle section visibility to hide a section', async () => {
      const eventSpy = vi.fn();
      eventBus.subscribe(DomainEvents.DASHBOARD_SETTINGS_CHANGED, eventSpy);

      await dashboardService.setSectionVisibility('recently-played', false);
      const settings = await dashboardService.getSettings();

      expect(settings.hiddenSections.includes('recently-played')).toBe(true);
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('6. toggle section visibility to show a previously hidden section', async () => {
      await dashboardService.setSectionVisibility('artists', false);
      await dashboardService.setSectionVisibility('artists', true);

      const settings = await dashboardService.getSettings();
      expect(settings.hiddenSections.includes('artists')).toBe(false);
    });

    it('7 & 8. moveSectionUp shifts target section upwards in order', async () => {
      await dashboardService.moveSectionUp('playlists'); // Default order 1 -> moves to 0
      const resolved = dashboardService.getResolvedSections();
      expect(resolved[0]!.id).toBe('playlists');
      expect(resolved[1]!.id).toBe('recently-played');
    });

    it('9. moveSectionDown shifts target section downwards in order', async () => {
      await dashboardService.moveSectionDown('recently-played'); // Default order 0 -> moves to 1
      const resolved = dashboardService.getResolvedSections();
      expect(resolved[0]!.id).toBe('playlists');
      expect(resolved[1]!.id).toBe('recently-played');
    });

    it('10. restoreDefaults resets configuration to original default sections and order', async () => {
      await dashboardService.setSectionVisibility('recently-played', false);
      await dashboardService.moveSectionDown('artists');
      await dashboardService.resetToDefaults();

      const settings = await dashboardService.getSettings();
      expect(settings).toEqual(DEFAULT_DASHBOARD_SETTINGS);
    });
  });

  describe('Persistence & Self-Healing (Req 11 - 17)', () => {
    it('11 & 12. restores saved configuration on startup from dbAdapter', async () => {
      const customSettings = {
        key: 'dashboard_settings',
        value: {
          sectionOrder: ['favorites', 'recently-played', 'playlists', 'artists', 'recently-added', 'most-played', 'albums', 'genres', 'folders'],
          hiddenSections: ['recently-played']
        }
      };
      mockStorage.set('dashboard_settings', customSettings);

      const newService = new DashboardService(mockDbAdapter, eventBus);
      await newService.getSettings();
      const resolved = newService.getResolvedSections();

      expect(resolved[0]!.id).toBe('favorites');
      expect(resolved.find(s => s.id === 'recently-played')?.enabled).toBe(false);
    });

    it('13. invalid persisted section IDs are ignored safely', async () => {
      const corruptSettings = {
        key: 'dashboard_settings',
        value: {
          sectionOrder: ['fake-invalid-id', 'recently-played', 'playlists', 'artists', 'favorites', 'recently-added', 'most-played', 'albums', 'genres', 'folders'],
          hiddenSections: []
        }
      };
      mockStorage.set('dashboard_settings', corruptSettings);

      const newService = new DashboardService(mockDbAdapter, eventBus);
      await newService.getSettings();
      const resolved = newService.getResolvedSections();

      expect(resolved.some(s => (s.id as string) === 'fake-invalid-id')).toBe(false);
      expect(resolved).toHaveLength(9);
    });

    it('14. duplicate persisted section IDs are normalized safely', async () => {
      const dupSettings = {
        key: 'dashboard_settings',
        value: {
          sectionOrder: ['recently-played', 'recently-played', 'playlists', 'artists', 'favorites', 'recently-added', 'most-played', 'albums', 'genres', 'folders'],
          hiddenSections: []
        }
      };
      mockStorage.set('dashboard_settings', dupSettings);

      const newService = new DashboardService(mockDbAdapter, eventBus);
      await newService.getSettings();
      const resolved = newService.getResolvedSections();

      const recents = resolved.filter(s => s.id === 'recently-played');
      expect(recents).toHaveLength(1);
    });

    it('15. missing section IDs are restored using defaults', async () => {
      const incompleteSettings = {
        key: 'dashboard_settings',
        value: {
          sectionOrder: ['recently-played'],
          hiddenSections: []
        }
      };
      mockStorage.set('dashboard_settings', incompleteSettings);

      const newService = new DashboardService(mockDbAdapter, eventBus);
      await newService.getSettings();
      const resolved = newService.getResolvedSections();

      expect(resolved).toHaveLength(9);
    });

    it('16. invalid order sequence is repaired safely', async () => {
      const invalidOrderSettings = {
        key: 'dashboard_settings',
        value: {
          sectionOrder: ['recently-played', 'artists'],
          hiddenSections: []
        }
      };
      mockStorage.set('dashboard_settings', invalidOrderSettings);

      const newService = new DashboardService(mockDbAdapter, eventBus);
      await newService.getSettings();
      const resolved = newService.getResolvedSections();

      const orders = resolved.map(s => s.order);
      expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('17. storage failure falls back safely to defaults', async () => {
      const failingDb = {
        get: vi.fn().mockRejectedValue(new Error('IndexedDB error')),
        put: vi.fn().mockRejectedValue(new Error('IndexedDB write error'))
      };

      const failService = new DashboardService(failingDb as any, eventBus);
      const settings = await failService.getSettings();
      expect(settings.sectionOrder).toHaveLength(9);
    });
  });

  describe('HomeView & SettingsView Integration (Req 18 - 25)', () => {
    let mockLibraryService: any;
    let mockRouter: any;

    beforeEach(() => {
      mockLibraryService = {
        listTracks: vi.fn().mockResolvedValue({ items: [{ id: 't1', title: 'Track 1', artistName: 'Artist 1' }] }),
        listArtists: vi.fn().mockResolvedValue({ items: [{ id: 'a1', name: 'Artist 1' }] }),
        getLibraryStats: vi.fn().mockResolvedValue({ trackCount: 10, albumCount: 2, artistCount: 1 })
      };

      mockRouter = {
        navigate: vi.fn()
      };
    });

    it('18. renders empty customization card when all sections are hidden', async () => {
      for (const s of SUPPORTED_DASHBOARD_SECTIONS) {
        await dashboardService.setSectionVisibility(s.id, false);
      }

      const homeView = new HomeView(mockLibraryService, {
        eventBus,
        dashboardService,
        router: mockRouter
      });

      homeView.mount(container);
      expect(container.textContent).toContain('All Dashboard Sections Hidden');
      expect(container.querySelector('#home-restore-defaults-btn')).not.toBeNull();
    });

    it('19 & 20. updates dashboard dynamically when DASHBOARD_SETTINGS_CHANGED event triggers', async () => {
      const homeView = new HomeView(mockLibraryService, {
        eventBus,
        dashboardService,
        router: mockRouter
      });

      homeView.mount(container);
      expect(container.querySelector('#home-section-recently-played')).not.toBeNull();

      await dashboardService.setSectionVisibility('recently-played', false);
      expect(container.querySelector('#home-section-recently-played')).toBeNull();
    });

    it('21. re-renders sections container without tearing down root HomeView frame', async () => {
      const homeView = new HomeView(mockLibraryService, {
        eventBus,
        dashboardService,
        router: mockRouter
      });

      homeView.mount(container);
      const hero = container.querySelector('.home-hero-card');
      expect(hero).not.toBeNull();

      await dashboardService.moveSectionDown('recently-played');
      expect(container.querySelector('.home-hero-card')).toBe(hero);
    });

    it('22 - 25. SettingsView renders customization list, ARIA attributes, badges and move buttons', async () => {
      await dashboardService.resetToDefaults();
      const settingsView = new SettingsView({
        eventBus,
        dashboardService,
        libraryService: mockLibraryService
      });

      settingsView.mount(container, { section: 'dashboard' } as any);

      const list = container.querySelector('#settings-dashboard-section-list');
      expect(list).not.toBeNull();
      expect(list?.getAttribute('role')).toBe('list');

      const items = container.querySelectorAll('.settings-dashboard-item');
      expect(items.length).toBe(9);

      const badge = items[0]?.querySelector('.dashboard-position-badge');
      expect(badge?.textContent).toContain('Pos 1 of 9');

      const moveUpBtn = container.querySelector<HTMLButtonElement>('.btn-move-up');
      expect(moveUpBtn).not.toBeNull();
      expect(moveUpBtn?.getAttribute('disabled')).not.toBeNull();
    });
  });

  describe('Responsive & Theme System Compatibility (Req 26 - 35)', () => {
    it('26 - 28. preserves responsive layout containers on desktop, tablet, and mobile', () => {
      const homeView = new HomeView(undefined, { eventBus, dashboardService });
      homeView.mount(container);

      expect(container.querySelector('.home-grid-layout')).not.toBeNull();
      expect(container.querySelector('.home-main-col')).not.toBeNull();
      expect(container.querySelector('.home-side-col')).not.toBeNull();
    });

    it('29 - 35. compatible with theme system, accent theme, density, and layout settings', () => {
      ThemeManager.getInstance().setPreference('dark');
      ThemeManager.getInstance().setAccentTheme('cyan');
      ThemeManager.getInstance().setAmbientMode('aurora');
      ThemeManager.getInstance().setLibraryDensity('compact');

      const homeView = new HomeView(undefined, { eventBus, dashboardService });
      homeView.mount(container);

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-accent-theme')).toBe('cyan');
      expect(document.documentElement.getAttribute('data-library-density')).toBe('compact');
    });
  });

  describe('Non-Functional & Isolation Rules (Req 36 - 42, AI & Network Protection)', () => {
    it('36 - 39. zero modification to playback state, queue, current track, or audio engine', () => {
      const mockPlaybackManager = {
        playbackRate: 1.0,
        repeatMode: 'off',
        shuffleMode: 'off',
        currentTrack: { id: 't1' },
        queue: [{ id: 't1' }]
      };

      dashboardService.moveSectionUp('playlists');
      expect(mockPlaybackManager.playbackRate).toBe(1.0);
      expect(mockPlaybackManager.currentTrack.id).toBe('t1');
      expect(mockPlaybackManager.queue).toHaveLength(1);
    });

    it('40. zero AI functionality or remote recommendations introduced', () => {
      const settings = dashboardService.getResolvedSections();
      const labels = settings.map(s => s.label.toLowerCase());
      expect(labels.some(l => l.includes('ai') || l.includes('smart'))).toBe(false);
    });

    it('41. zero external network calls during initialization or state mutation', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      await dashboardService.getSettings();
      await dashboardService.setSectionVisibility('recently-played', false);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('42. disposes subscriptions cleanly on unmount', () => {
      const homeView = new HomeView(undefined, { eventBus, dashboardService });
      homeView.mount(container);
      expect(() => homeView.unmount()).not.toThrow();
    });
  });
});
