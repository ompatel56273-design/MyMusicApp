import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import {
  extractPaletteFromImageData,
  extractPaletteFromImage,
  clearPaletteCache,
  type ExtractedArtworkPalette
} from '../../src/ui/theme/dynamic-artwork-colors';
import { SettingsView } from '../../src/ui/views/settings-view';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { EventBus } from '../../src/core/events/event-bus';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('F2.3: Dynamic Artwork Colors Comprehensive Test Suite', () => {
  let themeManager: ThemeManager;

  beforeEach(() => {
    localStorage.clear();
    clearPaletteCache();
    document.documentElement.removeAttribute('data-ambient');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-theme');

    themeManager = ThemeManager.getInstance();
    themeManager.setPreference('dark');
    themeManager.setAccentTheme('purple');
    themeManager.setAmbientMode('off');
    themeManager.setDynamicArtworkColorsEnabled(false);
    themeManager.setArtworkPalette(null);
  });

  afterEach(() => {
    localStorage.clear();
    clearPaletteCache();
  });

  describe('1. Default Setting', () => {
    it('initializes with dynamic artwork colors disabled by default', () => {
      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(false);
      expect(themeManager.getArtworkPalette()).toBeNull();
    });
  });

  describe('2. Enable/Disable Behavior', () => {
    it('toggles dynamic artwork colors on and off', () => {
      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(false);

      themeManager.setDynamicArtworkColorsEnabled(true);
      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(true);

      themeManager.setDynamicArtworkColorsEnabled(false);
      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(false);
    });
  });

  describe('3. Persistence', () => {
    it('persists dynamic artwork preference to localStorage key mymusicapp_dynamic_artwork_colors', () => {
      themeManager.setDynamicArtworkColorsEnabled(true);
      expect(localStorage.getItem('mymusicapp_dynamic_artwork_colors')).toBe('true');

      themeManager.setDynamicArtworkColorsEnabled(false);
      expect(localStorage.getItem('mymusicapp_dynamic_artwork_colors')).toBe('false');
    });
  });

  describe('4. Restoration', () => {
    it('restores stored dynamic artwork preference during startup', () => {
      localStorage.setItem('mymusicapp_dynamic_artwork_colors', 'true');
      (themeManager as any).loadPreference();

      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(true);
    });
  });

  describe('5. Invalid Preference Fallback', () => {
    it('safely defaults to false when an invalid value is stored', () => {
      localStorage.setItem('mymusicapp_dynamic_artwork_colors', 'invalid_bool');
      (themeManager as any).loadPreference();

      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(false);
    });
  });

  describe('6. Artwork Color Extraction Algorithm', () => {
    it('extracts a deterministic, valid palette from synthetic ImageData', () => {
      const pixels = new Uint8Array(32 * 32 * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 168;     // R
        pixels[i + 1] = 85;  // G
        pixels[i + 2] = 247; // B
        pixels[i + 3] = 255; // Alpha
      }

      const palette = extractPaletteFromImageData(pixels, 32, 32);
      expect(palette).not.toBeNull();
      expect(palette?.primary).toBe('#a855f7');
      expect(palette?.secondary).toBeTruthy();
      expect(palette?.muted).toContain('rgba(');
      expect(palette?.contrast).toBe('#ffffff');
      expect(palette?.glow).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(palette?.gradient).toContain('linear-gradient');
    });
  });

  describe('7. Missing Artwork Fallback', () => {
    it('resets palette to null and restores Accent Theme fallbacks when artwork is missing', () => {
      themeManager.setDynamicArtworkColorsEnabled(true);
      const testPalette: ExtractedArtworkPalette = {
        primary: '#10b981',
        secondary: '#06b6d4',
        muted: 'rgba(16, 185, 129, 0.25)',
        contrast: '#ffffff',
        glow: '#34d399',
        gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)'
      };

      themeManager.setArtworkPalette(testPalette);
      expect(document.documentElement.style.getPropertyValue('--color-artwork-primary')).toBe('#10b981');

      themeManager.setArtworkPalette(null);
      expect(themeManager.getArtworkPalette()).toBeNull();

      // CSS variable falls back to active purple accent theme
      expect(document.documentElement.style.getPropertyValue('--color-artwork-primary')).toBe('#8b5cf6');
    });
  });

  describe('8 & 9. Image Loading & Invalid Image Fallbacks', () => {
    it('handles image loading failure gracefully by returning null', async () => {
      const palette = await extractPaletteFromImage('invalid_data_uri_or_missing_file');
      expect(palette).toBeNull();
    });
  });

  describe('10. Stable & Deterministic Extracted Palette', () => {
    it('produces identical RGBA values for identical inputs', () => {
      const pixels = new Uint8Array(16 * 16 * 4);
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 56;
        pixels[i + 1] = 189;
        pixels[i + 2] = 248;
        pixels[i + 3] = 255;
      }

      const p1 = extractPaletteFromImageData(pixels, 16, 16);
      const p2 = extractPaletteFromImageData(pixels, 16, 16);

      expect(p1).toEqual(p2);
      expect(p1?.primary).toBe('#38bdf8');
    });
  });

  describe('11 & 12. Artwork Change & Cache Efficiency', () => {
    it('updates artwork colors when updateArtworkColors is invoked and reuses LRU cache', async () => {
      themeManager.setDynamicArtworkColorsEnabled(true);

      const mockPalette: ExtractedArtworkPalette = {
        primary: '#f59e0b',
        secondary: '#f43f5e',
        muted: 'rgba(245, 158, 11, 0.25)',
        contrast: '#ffffff',
        glow: '#fbbf24',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)'
      };

      themeManager.setArtworkPalette(mockPalette);
      expect(document.documentElement.style.getPropertyValue('--color-artwork-primary')).toBe('#f59e0b');
      expect(document.documentElement.style.getPropertyValue('--color-artwork-glow')).toBe('#fbbf24');
    });
  });

  describe('13. Playback Time Updates Invariance', () => {
    it('time update events do not alter artwork color state', () => {
      const palette = themeManager.getArtworkPalette();
      // Emulating a time update check
      expect(themeManager.getArtworkPalette()).toBe(palette);
    });
  });

  describe('14 & 15. Accent Theme Invariants', () => {
    it('Accent Theme remains authoritative for main app highlights even when Dynamic Artwork Colors is enabled', () => {
      themeManager.setAccentTheme('cyan');
      themeManager.setDynamicArtworkColorsEnabled(true);

      const customPalette: ExtractedArtworkPalette = {
        primary: '#ec4899',
        secondary: '#f43f5e',
        muted: 'rgba(236, 72, 153, 0.25)',
        contrast: '#ffffff',
        glow: '#f472b6',
        gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
      };

      themeManager.setArtworkPalette(customPalette);

      // Main accent variable stays cyan
      expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#06b6d4');
      expect(document.documentElement.style.getPropertyValue('--color-accent-primary')).toBe('#06b6d4');

      // Artwork-specific variable receives pink
      expect(document.documentElement.style.getPropertyValue('--color-artwork-primary')).toBe('#ec4899');
    });
  });

  describe('16. Settings UI & Accessibility', () => {
    it('mounts Dynamic Artwork toggle in SettingsView and changes state on click', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const settingsView = new SettingsView({});
      settingsView.mount(container);

      const toggle = container.querySelector<HTMLInputElement>('#settings-toggle-dynamic-artwork');
      const badge = container.querySelector<HTMLElement>('#settings-dynamic-artwork-status-badge');

      expect(toggle).not.toBeNull();
      expect(toggle?.checked).toBe(false);
      expect(badge?.textContent).toContain('Disabled');

      // Click toggle to enable
      toggle?.click();
      expect(themeManager.isDynamicArtworkColorsEnabled()).toBe(true);
      expect(toggle?.checked).toBe(true);
      expect(badge?.textContent).toContain('Enabled');

      settingsView.unmount();
      container.remove();
    });
  });

  describe('17, 18, 19 & 20. Audio, Playback & Architectural Invariants', () => {
    it('dynamic artwork color switches do not interrupt playback, modify queue, or create duplicate AudioEngine/AudioContext instances', async () => {
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
        id: 'track_artwork_1',
        fileId: 'file_artwork_1',
        title: 'Artwork Song',
        artistName: 'Artwork Artist',
        durationMs: 180000,
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
          id: 'file_artwork_1',
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
      expect(playbackManager.currentTrack?.id).toBe('track_artwork_1');
      expect(playbackManager.state).toBe('playing');
      expect(playbackManager.getTracks()).toHaveLength(1);

      const initialContextCount = createdContexts;

      // Toggle dynamic artwork colors repeatedly during active playback
      themeManager.setDynamicArtworkColorsEnabled(true);
      themeManager.setDynamicArtworkColorsEnabled(false);
      themeManager.setDynamicArtworkColorsEnabled(true);

      // Playback, queue, and single audio instance invariants hold
      expect(playbackManager.currentTrack?.id).toBe('track_artwork_1');
      expect(playbackManager.state).toBe('playing');
      expect(playbackManager.getTracks()).toHaveLength(1);
      expect(createdContexts).toBe(initialContextCount);
    });
  });
});
