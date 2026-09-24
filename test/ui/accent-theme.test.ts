import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import {
  DEFAULT_ACCENT_THEME,
  ACCENT_THEMES,
  getAccentTheme,
  getAllAccentThemes
} from '../../src/ui/theme/accent-theme';
import { SettingsView } from '../../src/ui/views/settings-view';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { EventBus } from '../../src/core/events/event-bus';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('F2.1: Accent Themes Comprehensive Test Suite', () => {
  let themeManager: ThemeManager;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-theme');
    themeManager = ThemeManager.getInstance();
    themeManager.setPreference('dark');
    themeManager.setAccentTheme(DEFAULT_ACCENT_THEME);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('1. Default Accent Theme', () => {
    it('initializes with purple (Neon Purple) by default', () => {
      expect(themeManager.getAccentTheme()).toBe('purple');
      const def = themeManager.getAccentThemeDefinition();
      expect(def.id).toBe('purple');
      expect(def.name).toBe('Neon Purple');
      expect(def.primaryColor).toBe('#8b5cf6');
      expect(document.documentElement.getAttribute('data-accent')).toBe('purple');
    });
  });

  describe('2. Available Theme Definitions', () => {
    it('provides all 7 curated accent themes with complete styling tokens', () => {
      const themes = getAllAccentThemes();
      expect(themes).toHaveLength(7);

      const themeIds = themes.map(t => t.id);
      expect(themeIds).toEqual(['purple', 'cyan', 'blue', 'emerald', 'amber', 'pink', 'rose']);

      for (const t of themes) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(t.glowColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(t.deepColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(t.softColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(t.hoverColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(t.activeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(t.contrastText).toBe('#ffffff');
        expect(t.gradient).toContain('linear-gradient');
        expect(t.glowShadow).toBeTruthy();
        expect(t.pillShadow).toBeTruthy();
        expect(t.borderHighlight).toBeTruthy();
        expect(t.borderInteractive).toBeTruthy();
      }
    });
  });

  describe('3. Selecting an Accent', () => {
    it('switches accent theme and updates active definition', () => {
      themeManager.setAccentTheme('cyan');
      expect(themeManager.getAccentTheme()).toBe('cyan');
      expect(themeManager.getAccentThemeDefinition().name).toBe('Electric Cyan');
      expect(themeManager.getAccentThemeDefinition().primaryColor).toBe('#06b6d4');

      themeManager.setAccentTheme('emerald');
      expect(themeManager.getAccentTheme()).toBe('emerald');
      expect(themeManager.getAccentThemeDefinition().name).toBe('Emerald Green');
    });
  });

  describe('4. Accent State & CSS Variable Updates', () => {
    it('sets data-accent attribute and custom CSS properties on documentElement', () => {
      themeManager.setAccentTheme('blue');
      expect(document.documentElement.getAttribute('data-accent')).toBe('blue');

      const style = document.documentElement.style;
      const blueDef = ACCENT_THEMES.blue;
      expect(style.getPropertyValue('--color-accent')).toBe(blueDef.primaryColor);
      expect(style.getPropertyValue('--color-accent-primary')).toBe(blueDef.primaryColor);
      expect(style.getPropertyValue('--color-accent-hover')).toBe(blueDef.hoverColor);
      expect(style.getPropertyValue('--color-accent-active')).toBe(blueDef.activeColor);
      expect(style.getPropertyValue('--color-accent-gradient')).toBe(blueDef.gradient);
      expect(style.getPropertyValue('--color-accent-contrast')).toBe(blueDef.contrastText);
    });
  });

  describe('5. Persistence', () => {
    it('persists selected accent theme to localStorage', () => {
      themeManager.setAccentTheme('pink');
      expect(localStorage.getItem('mymusicapp_accent_theme')).toBe('pink');

      themeManager.setAccentTheme('amber');
      expect(localStorage.getItem('mymusicapp_accent_theme')).toBe('amber');
    });
  });

  describe('6. Restoring Persisted Accent', () => {
    it('restores stored accent theme from localStorage', () => {
      localStorage.setItem('mymusicapp_accent_theme', 'rose');
      (themeManager as any).loadPreference();
      themeManager.applyAccentTheme();

      expect(themeManager.getAccentTheme()).toBe('rose');
      expect(themeManager.getAccentThemeDefinition().name).toBe('Crimson Red');
      expect(document.documentElement.getAttribute('data-accent')).toBe('rose');
    });
  });

  describe('7. Invalid Accent Handling', () => {
    it('safely falls back to purple when an invalid accent theme is provided', () => {
      themeManager.setAccentTheme('invalid_theme_name' as any);
      expect(themeManager.getAccentTheme()).toBe('purple');
      expect(themeManager.getAccentThemeDefinition().id).toBe('purple');
      expect(document.documentElement.getAttribute('data-accent')).toBe('purple');
    });

    it('getAccentTheme helper safely falls back for null or unknown keys', () => {
      expect(getAccentTheme(null).id).toBe('purple');
      expect(getAccentTheme('nonexistent').id).toBe('purple');
      expect(getAccentTheme('emerald').id).toBe('emerald');
    });
  });

  describe('8. Missing Preference Handling', () => {
    it('defaults gracefully when localStorage is empty', () => {
      localStorage.clear();
      (themeManager as any).loadPreference();
      expect(themeManager.getAccentTheme()).toBe('purple');
    });
  });

  describe('9. Theme Switching Without Page Reload', () => {
    it('notifies accent subscribers dynamically on runtime changes', () => {
      const listener = vi.fn();
      const unsub = themeManager.subscribeAccent(listener);

      // Initial notification
      expect(listener).toHaveBeenCalledWith('purple', ACCENT_THEMES.purple);

      themeManager.setAccentTheme('emerald');
      expect(listener).toHaveBeenCalledWith('emerald', ACCENT_THEMES.emerald);

      themeManager.setAccentTheme('pink');
      expect(listener).toHaveBeenCalledWith('pink', ACCENT_THEMES.pink);

      unsub();
    });
  });

  describe('10. Settings UI & Keyboard Accessibility', () => {
    it('mounts accent options in SettingsView and changes accent on click', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const settingsView = new SettingsView({});
      settingsView.mount(container);

      const accentGrid = container.querySelector<HTMLElement>('.settings-accent-grid');
      expect(accentGrid).not.toBeNull();
      expect(accentGrid?.getAttribute('role')).toBe('radiogroup');

      const options = container.querySelectorAll<HTMLElement>('.settings-accent-option');
      expect(options.length).toBe(7);

      const purpleOpt = Array.from(options).find(o => o.getAttribute('data-accent-val') === 'purple');
      const cyanOpt = Array.from(options).find(o => o.getAttribute('data-accent-val') === 'cyan');
      const badge = container.querySelector<HTMLElement>('#settings-accent-status-badge');

      expect(purpleOpt?.classList.contains('active')).toBe(true);
      expect(purpleOpt?.getAttribute('aria-checked')).toBe('true');
      expect(badge?.textContent).toContain('Neon Purple Active');

      // Click Cyan
      cyanOpt?.click();
      expect(themeManager.getAccentTheme()).toBe('cyan');
      expect(cyanOpt?.classList.contains('active')).toBe(true);
      expect(cyanOpt?.getAttribute('aria-checked')).toBe('true');
      expect(purpleOpt?.classList.contains('active')).toBe(false);
      expect(badge?.textContent).toContain('Electric Cyan Active');

      settingsView.unmount();
      container.remove();
    });

    it('supports keyboard navigation via Enter and Space keys', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const settingsView = new SettingsView({});
      settingsView.mount(container);

      const options = container.querySelectorAll<HTMLElement>('.settings-accent-option');
      const amberOpt = Array.from(options).find(o => o.getAttribute('data-accent-val') === 'amber');
      const roseOpt = Array.from(options).find(o => o.getAttribute('data-accent-val') === 'rose');

      expect(amberOpt?.getAttribute('tabindex')).toBe('0');

      // Press Enter on Amber
      amberOpt?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(themeManager.getAccentTheme()).toBe('amber');
      expect(amberOpt?.classList.contains('active')).toBe(true);

      // Press Space on Rose
      roseOpt?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(themeManager.getAccentTheme()).toBe('rose');
      expect(roseOpt?.classList.contains('active')).toBe(true);

      settingsView.unmount();
      container.remove();
    });
  });

  describe('11. Existing UI State Invariants', () => {
    it('switching accent themes preserves light/dark theme preference', () => {
      themeManager.setPreference('light');
      expect(themeManager.getPreference()).toBe('light');

      themeManager.setAccentTheme('emerald');
      expect(themeManager.getPreference()).toBe('light');
      expect(themeManager.getAccentTheme()).toBe('emerald');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.getAttribute('data-accent')).toBe('emerald');
    });
  });

  describe('12, 13, 14 & 15. Audio & Playback Invariants', () => {
    it('accent theme changes do not interrupt playback, modify queue, or create second AudioEngine/AudioContext', async () => {
      let createdContexts = 0;
      const mockContext: any = {
        state: 'running',
        currentTime: 0,
        destination: {},
        createGain: vi.fn(() => ({ gain: { value: 1, setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
        createAnalyser: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), fftSize: 2048, frequencyBinCount: 1024 })),
        createBiquadFilter: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), frequency: { value: 1000 }, gain: { value: 0 }, Q: { value: 1 } })),
        createStereoPanner: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), pan: { value: 0, setValueAtTime: vi.fn() } })),
        createDynamicsCompressor: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), threshold: { value: -0.5 }, knee: { value: 0 }, ratio: { value: 20 }, attack: { value: 0.003 }, release: { value: 0.05 } })),
        createMediaElementSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      };

      (globalThis as any).AudioContext = vi.fn().mockImplementation(() => {
        createdContexts++;
        return mockContext;
      });

      const eventBus = new EventBus();
      const fs = new VirtualFilesystemAdapter();
      fs.addVirtualFile('C:/Music/test.flac', 1024, Date.now(), new Uint8Array([1, 2]));

      const track: Track = {
        id: 'track_1',
        fileId: 'file_1',
        title: 'Song 1',
        artistName: 'Artist 1',
        durationMs: 120000,
        format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
        dateAdded: Date.now(),
        dateModified: Date.now(),
        playCount: 0,
        isFavorite: false,
        hasLyrics: false,
        availability: 'available'
      };

      const trackRepo = {
        getById: vi.fn().mockResolvedValue(track),
        incrementPlayCount: vi.fn().mockResolvedValue(undefined)
      };
      const audioFileRepo = {
        getById: vi.fn().mockResolvedValue({
          id: 'file_1',
          path: 'C:/Music/test.flac',
          filename: 'test.flac',
          extension: 'flac',
          sizeBytes: 1024,
          modifiedTimeMs: Date.now(),
          availability: 'available'
        })
      };
      const queueRepo = {
        getQueue: vi.fn().mockResolvedValue([]),
        saveQueue: vi.fn().mockResolvedValue(undefined),
        clearQueue: vi.fn().mockResolvedValue(undefined)
      };
      const historyRepo = {
        addRecord: vi.fn().mockResolvedValue(undefined),
        getRecent: vi.fn().mockResolvedValue([]),
        saveResumePosition: vi.fn().mockResolvedValue(undefined)
      };

      const audioEngine = new AudioEngine();
      const playbackManager = new PlaybackManager({
        audioEngine,
        filesystem: fs,
        trackRepo: trackRepo as any,
        audioFileRepo: audioFileRepo as any,
        queueRepo: queueRepo as any,
        historyRepo: historyRepo as any,
        eventBus
      });

      await playbackManager.playTrack(track);
      expect(playbackManager.currentTrack?.id).toBe('track_1');
      expect(playbackManager.state).toBe('playing');
      expect(playbackManager.getTracks()).toHaveLength(1);

      const initialContextCount = createdContexts;

      // Switch accent themes multiple times during active playback
      themeManager.setAccentTheme('cyan');
      themeManager.setAccentTheme('amber');
      themeManager.setAccentTheme('emerald');
      themeManager.setAccentTheme('pink');

      // Playback, queue, and single audio instance invariants hold
      expect(playbackManager.currentTrack?.id).toBe('track_1');
      expect(playbackManager.state).toBe('playing');
      expect(playbackManager.getTracks()).toHaveLength(1);
      expect(createdContexts).toBe(initialContextCount);
    });
  });
});
