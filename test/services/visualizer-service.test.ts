import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualizerService } from '../../src/services/visualizer/visualizer-service';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import { STORES } from '../../src/data/db/schema';
import { DEFAULT_VISUALIZER_SETTINGS } from '../../src/domain/entities/visualizer-settings';

describe('VisualizerService', () => {
  let mockDb: IDatabaseAdapter;
  let visualizerService: VisualizerService;
  let dbStore: Record<string, any>;

  beforeEach(() => {
    dbStore = {};
    mockDb = {
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
      get: vi.fn().mockImplementation(async (_store, key) => dbStore[key] ? { key, value: dbStore[key] } : null),
      getAll: vi.fn(),
      getByIndex: vi.fn(),
      getAllByIndex: vi.fn(),
      put: vi.fn().mockImplementation(async (_store, item) => {
        dbStore[item.key] = item.value;
      }),
      putBatch: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      transaction: vi.fn()
    };
    visualizerService = new VisualizerService(mockDb);
  });

  it('returns default settings when none are persisted', async () => {
    const settings = await visualizerService.getSettings();
    expect(settings).toEqual(DEFAULT_VISUALIZER_SETTINGS);
    expect(settings.enabled).toBe(true);
    expect(settings.mode).toBe('bars');
    expect(settings.fpsLimit).toBe(60);
    expect(settings.colorTheme).toBe('accent');
  });

  it('saves and loads customized settings', async () => {
    const updated = await visualizerService.saveSettings({
      enabled: false,
      mode: 'waveform',
      fpsLimit: 30,
      colorTheme: 'rainbow'
    });

    expect(updated.enabled).toBe(false);
    expect(updated.mode).toBe('waveform');
    expect(updated.fpsLimit).toBe(30);
    expect(updated.colorTheme).toBe('rainbow');

    const loaded = await visualizerService.getSettings();
    expect(loaded).toEqual(updated);
  });

  it('sets mode directly via setMode()', async () => {
    const settings = await visualizerService.setMode('circular');
    expect(settings.mode).toBe('circular');

    const loaded = await visualizerService.getSettings();
    expect(loaded.mode).toBe('circular');
  });

  it('toggles enabled state via setEnabled()', async () => {
    const disabled = await visualizerService.setEnabled(false);
    expect(disabled.enabled).toBe(false);

    const reEnabled = await visualizerService.setEnabled(true);
    expect(reEnabled.enabled).toBe(true);
  });

  it('resets settings to default values', async () => {
    await visualizerService.saveSettings({
      enabled: false,
      mode: 'particles',
      fpsLimit: 120,
      colorTheme: 'monochrome'
    });

    const reset = await visualizerService.resetToDefaults();
    expect(reset).toEqual(DEFAULT_VISUALIZER_SETTINGS);

    const loaded = await visualizerService.getSettings();
    expect(loaded).toEqual(DEFAULT_VISUALIZER_SETTINGS);
  });

  it('sanitizes malformed persisted settings gracefully', async () => {
    // Write invalid/corrupt data directly to mock database settings store
    await mockDb.put(STORES.SETTINGS, {
      key: 'visualizer_settings',
      value: {
        enabled: 'not-a-bool' as unknown as boolean,
        mode: 'invalid-mode' as unknown as 'bars',
        fpsLimit: -10,
        colorTheme: 'neon-disco' as unknown as 'accent'
      }
    });

    const sanitized = await visualizerService.getSettings();
    expect(sanitized.enabled).toBe(true);
    expect(sanitized.mode).toBe('bars');
    expect(sanitized.fpsLimit).toBe(60);
    expect(sanitized.colorTheme).toBe('accent');
  });
});
