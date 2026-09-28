import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import {
  DEFAULT_AMBIENT_MODE,
  AMBIENT_MODES,
  getAmbientMode,
  getAllAmbientModes
} from '../../src/ui/theme/ambient-background';
import { SettingsView } from '../../src/ui/views/settings-view';
import { PlaybackManager } from '../../src/services/playback/playback-manager';
import { AudioEngine } from '../../src/services/audio/audio-engine';
import { EventBus } from '../../src/core/events/event-bus';
import { VirtualFilesystemAdapter } from '../../src/services/scanner/filesystem-adapter';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('F2.2: Ambient Backgrounds Comprehensive Test Suite', () => {
  let themeManager: ThemeManager;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-ambient');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-theme');
    const bgContainer = document.getElementById('app-ambient-bg');
    if (bgContainer) bgContainer.remove();

    themeManager = ThemeManager.getInstance();
    themeManager.setPreference('dark');
    themeManager.setAccentTheme('purple');
    themeManager.setAmbientMode(DEFAULT_AMBIENT_MODE);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('1. Default Ambient State', () => {
    it('initializes with off mode by default', () => {
      expect(themeManager.getAmbientMode()).toBe('off');
      const def = themeManager.getAmbientModeDefinition();
      expect(def.id).toBe('off');
      expect(def.name).toContain('Off');
      expect(def.animated).toBe(false);
      expect(document.documentElement.getAttribute('data-ambient')).toBe('off');
    });
  });

  describe('2. Available Ambient Modes', () => {
    it('provides all 5 core background modes', () => {
      const modes = getAllAmbientModes();
      expect(modes).toHaveLength(5);

      const modeIds = modes.map(m => m.id);
      expect(modeIds).toEqual(['off', 'aurora', 'gradient-flow', 'soft-glow', 'static-gradient']);

      for (const m of modes) {
        expect(m.name).toBeTruthy();
        expect(m.description).toBeTruthy();
        expect(m.icon).toBeTruthy();
        expect(typeof m.animated).toBe('boolean');
      }
    });
  });

  describe('3. Enable/Disable Behavior', () => {
    it('enables an ambient mode from off and disables back to off', () => {
      expect(themeManager.getAmbientMode()).toBe('off');

      themeManager.setAmbientMode('aurora');
      expect(themeManager.getAmbientMode()).toBe('aurora');
      expect(document.documentElement.getAttribute('data-ambient')).toBe('aurora');

      themeManager.setAmbientMode('off');
      expect(themeManager.getAmbientMode()).toBe('off');
      expect(document.documentElement.getAttribute('data-ambient')).toBe('off');
    });
  });

  describe('4. Mode Selection', () => {
    it('switches between all available ambient background modes', () => {
      const modes: Array<'off' | 'aurora' | 'gradient-flow' | 'soft-glow' | 'static-gradient'> = [
        'aurora',
        'gradient-flow',
        'soft-glow',
        'static-gradient',
        'off'
      ];

      for (const mode of modes) {
        themeManager.setAmbientMode(mode);
        expect(themeManager.getAmbientMode()).toBe(mode);
        expect(themeManager.getAmbientModeDefinition().id).toBe(mode);
        expect(document.documentElement.getAttribute('data-ambient')).toBe(mode);
      }
    });
  });

  describe('5. Persistence', () => {
    it('persists selected ambient mode to localStorage key mymusicapp_ambient_mode', () => {
      themeManager.setAmbientMode('aurora');
      expect(localStorage.getItem('mymusicapp_ambient_mode')).toBe('aurora');

      themeManager.setAmbientMode('soft-glow');
      expect(localStorage.getItem('mymusicapp_ambient_mode')).toBe('soft-glow');
    });
  });

  describe('6. Restoration After Initialization', () => {
    it('restores stored ambient mode preference on startup', () => {
      localStorage.setItem('mymusicapp_ambient_mode', 'gradient-flow');
      (themeManager as any).loadPreference();
      themeManager.applyAmbientMode();

      expect(themeManager.getAmbientMode()).toBe('gradient-flow');
      expect(themeManager.getAmbientModeDefinition().name).toBe('Gradient Flow');
      expect(document.documentElement.getAttribute('data-ambient')).toBe('gradient-flow');
    });
  });

  describe('7. Invalid Stored Value Fallback', () => {
    it('safely falls back to off mode when an invalid ambient key is supplied', () => {
      themeManager.setAmbientMode('invalid_ambient_key' as any);
      expect(themeManager.getAmbientMode()).toBe('off');
      expect(themeManager.getAmbientModeDefinition().id).toBe('off');
      expect(document.documentElement.getAttribute('data-ambient')).toBe('off');
    });

    it('getAmbientMode helper safely handles unknown keys or null', () => {
      expect(getAmbientMode(null).id).toBe('off');
      expect(getAmbientMode('unknown_mode').id).toBe('off');
      expect(getAmbientMode('aurora').id).toBe('aurora');
    });
  });

  describe('8. Runtime Switching Without Reload', () => {
    it('notifies ambient listeners dynamically without page reloads', () => {
      const listener = vi.fn();
      const unsub = themeManager.subscribeAmbient(listener);

      expect(listener).toHaveBeenCalledWith('off', AMBIENT_MODES.off);

      themeManager.setAmbientMode('aurora');
      expect(listener).toHaveBeenCalledWith('aurora', AMBIENT_MODES.aurora);

      themeManager.setAmbientMode('static-gradient');
      expect(listener).toHaveBeenCalledWith('static-gradient', AMBIENT_MODES['static-gradient']);

      unsub();
    });
  });

  describe('9. Settings UI & Keyboard Accessibility', () => {
    it('mounts ambient options in SettingsView and changes ambient mode on click', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const settingsView = new SettingsView({});
      settingsView.mount(container);

      const ambientGrid = container.querySelector<HTMLElement>('.settings-ambient-grid');
      expect(ambientGrid).not.toBeNull();
      expect(ambientGrid?.getAttribute('role')).toBe('radiogroup');

      const options = container.querySelectorAll<HTMLElement>('.settings-ambient-option');
      expect(options.length).toBe(5);

      const offOpt = Array.from(options).find(o => o.getAttribute('data-ambient-val') === 'off');
      const auroraOpt = Array.from(options).find(o => o.getAttribute('data-ambient-val') === 'aurora');
      const badge = container.querySelector<HTMLElement>('#settings-ambient-status-badge');

      expect(offOpt?.classList.contains('active')).toBe(true);
      expect(offOpt?.getAttribute('aria-checked')).toBe('true');
      expect(badge?.textContent).toContain('Off (Default) Active');

      // Click Aurora
      auroraOpt?.click();
      expect(themeManager.getAmbientMode()).toBe('aurora');
      expect(auroraOpt?.classList.contains('active')).toBe(true);
      expect(auroraOpt?.getAttribute('aria-checked')).toBe('true');
      expect(offOpt?.classList.contains('active')).toBe(false);
      expect(badge?.textContent).toContain('Aurora Borealis Active');

      settingsView.unmount();
      container.remove();
    });

    it('supports keyboard navigation via Enter and Space keys', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const settingsView = new SettingsView({});
      settingsView.mount(container);

      const options = container.querySelectorAll<HTMLElement>('.settings-ambient-option');
      const softGlowOpt = Array.from(options).find(o => o.getAttribute('data-ambient-val') === 'soft-glow');
      const staticGradOpt = Array.from(options).find(o => o.getAttribute('data-ambient-val') === 'static-gradient');

      expect(softGlowOpt?.getAttribute('tabindex')).toBe('0');

      // Press Enter on soft-glow
      softGlowOpt?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(themeManager.getAmbientMode()).toBe('soft-glow');
      expect(softGlowOpt?.classList.contains('active')).toBe(true);

      // Press Space on static-gradient
      staticGradOpt?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(themeManager.getAmbientMode()).toBe('static-gradient');
      expect(staticGradOpt?.classList.contains('active')).toBe(true);

      settingsView.unmount();
      container.remove();
    });
  });

  describe('10. Accent Theme Integration', () => {
    it('seamlessly integrates accent theme colors into ambient background attributes', () => {
      themeManager.setAccentTheme('emerald');
      themeManager.setAmbientMode('aurora');

      expect(document.documentElement.getAttribute('data-accent')).toBe('emerald');
      expect(document.documentElement.getAttribute('data-ambient')).toBe('aurora');

      themeManager.setAccentTheme('cyan');
      expect(document.documentElement.getAttribute('data-accent')).toBe('cyan');
      expect(document.documentElement.getAttribute('data-ambient')).toBe('aurora');
    });
  });

  describe('11, 12, 13 & 14. Audio, Playback & Architectural Invariants', () => {
    it('ambient background switches do not interrupt playback, modify queue, or create duplicate instances', async () => {
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
        id: 'track_ambient_1',
        fileId: 'file_ambient_1',
        title: 'Ambient Song',
        artistName: 'Ambient Artist',
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
          id: 'file_ambient_1',
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
      expect(playbackManager.currentTrack?.id).toBe('track_ambient_1');
      expect(playbackManager.state).toBe('playing');
      expect(playbackManager.getTracks()).toHaveLength(1);

      const initialContextCount = createdContexts;

      // Switch ambient background modes repeatedly during active audio playback
      themeManager.setAmbientMode('aurora');
      themeManager.setAmbientMode('gradient-flow');
      themeManager.setAmbientMode('soft-glow');
      themeManager.setAmbientMode('static-gradient');
      themeManager.setAmbientMode('off');

      // Playback, queue, and single audio instance invariants hold
      expect(playbackManager.currentTrack?.id).toBe('track_ambient_1');
      expect(playbackManager.state).toBe('playing');
      expect(playbackManager.getTracks()).toHaveLength(1);
      expect(createdContexts).toBe(initialContextCount);
    });
  });
});
