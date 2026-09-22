import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioSettingsService } from '../../src/services/audio/audio-settings-service';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import type { IAudioEngine } from '../../src/services/contracts/service-contracts';
import { DEFAULT_AUDIO_SETTINGS } from '../../src/domain/entities/audio-settings';

describe('AudioSettingsService', () => {
  let mockDb: IDatabaseAdapter;
  let service: AudioSettingsService;
  let mockAudioEngine: IAudioEngine;

  beforeEach(() => {
    mockDb = {
      open: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn(),
      getByIndex: vi.fn(),
      getAllByIndex: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
      putBatch: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn(),
      transaction: vi.fn()
    };

    mockAudioEngine = {
      sampleRate: 48000,
      currentTime: 0,
      loadBuffer: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      setGain: vi.fn(),
      setPlaybackRate: vi.fn(),
      getAnalysisData: vi.fn(),
      getAnalysisMetrics: vi.fn(() => ({
        rms: 0,
        peak: 0,
        frequencyData: new Uint8Array(128),
        timeDomainData: new Uint8Array(128)
      })),
      setEqualizerEnabled: vi.fn(),
      setEqualizerBands: vi.fn(),
      setEqualizerBandGain: vi.fn(),
      setPreampGain: vi.fn(),
      setReplayGainMode: vi.fn(),
      setBalance: vi.fn(),
      setLimiterEnabled: vi.fn(),
      getDspOptions: vi.fn()
    };

    service = new AudioSettingsService(mockDb);
  });

  it('returns default settings when database has no stored record', async () => {
    const settings = await service.getSettings();
    expect(settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(settings.equalizerBands).toHaveLength(10);
    expect(settings.equalizerBands.every(b => b === 0)).toBe(true);
  });

  it('loads and validates persisted settings from IndexedDB', async () => {
    const stored = {
      equalizerEnabled: false,
      equalizerBands: [1, 2, 3, 4, 5, -1, -2, -3, -4, -5],
      preampGainDb: -3.5,
      replayGainMode: 'album',
      selectedPreset: 'rock',
      customPresets: [],
      balance: -0.5,
      limiterEnabled: true
    };
    (mockDb.get as any).mockResolvedValue({ key: 'audio_dsp_settings', value: stored });

    const settings = await service.getSettings();
    expect(settings.equalizerEnabled).toBe(false);
    expect(settings.equalizerBands).toEqual([1, 2, 3, 4, 5, -1, -2, -3, -4, -5]);
    expect(settings.preampGainDb).toBe(-3.5);
    expect(settings.replayGainMode).toBe('album');
    expect(settings.balance).toBe(-0.5);
  });

  it('clamps out-of-range gains, preamps, and balance values', async () => {
    const saved = await service.saveSettings({
      preampGainDb: 50, // Should clamp to +12
      equalizerBands: [99, -99, NaN, 0, 0, 0, 0, 0, 0, 0], // Clamp to [12, -12, 0, ...]
      balance: -10 // Clamp to -1.0
    });

    expect(saved.preampGainDb).toBe(12.0);
    expect(saved.equalizerBands[0]).toBe(12.0);
    expect(saved.equalizerBands[1]).toBe(-12.0);
    expect(saved.equalizerBands[2]).toBe(0);
    expect(saved.balance).toBe(-1.0);
  });

  it('resets settings to factory defaults', async () => {
    await service.saveSettings({ preampGainDb: 5, equalizerEnabled: false });
    const reset = await service.resetToDefaults();

    expect(reset).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(reset.equalizerEnabled).toBe(true);
    expect(reset.preampGainDb).toBe(0);
  });

  it('provides authoritative built-in presets', () => {
    const presets = service.getBuiltInPresets();
    expect(presets).toHaveLength(7);
    expect(presets.map(p => p.id)).toEqual(['flat', 'rock', 'pop', 'classical', 'jazz', 'vocal', 'bass_boost']);
    expect(presets[0].bands.every(b => b === 0)).toBe(true);
  });

  it('creates, saves, and deletes custom presets', async () => {
    const custom = await service.saveCustomPreset(
      'My Custom EQ',
      [2, 3, 2, 1, 0, 0, 1, 2, 3, 4],
      -1.5
    );

    expect(custom.id).toContain('custom_');
    expect(custom.name).toBe('My Custom EQ');
    expect(custom.bands).toHaveLength(10);
    expect(custom.preampGainDb).toBe(-1.5);

    let current = await service.getSettings();
    expect(current.customPresets).toHaveLength(1);
    expect(current.selectedPreset).toBe(custom.id);

    // Delete custom preset
    await service.deleteCustomPreset(custom.id);
    current = await service.getSettings();
    expect(current.customPresets).toHaveLength(0);
    expect(current.selectedPreset).toBe('flat');
  });

  it('applies stored settings cleanly to IAudioEngine', async () => {
    await service.saveSettings({
      equalizerEnabled: true,
      equalizerBands: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      preampGainDb: 2.5,
      replayGainMode: 'track',
      balance: 0.2,
      limiterEnabled: true
    });

    await service.applyToAudioEngine(mockAudioEngine);

    expect(mockAudioEngine.setEqualizerEnabled).toHaveBeenCalledWith(true);
    expect(mockAudioEngine.setEqualizerBands).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mockAudioEngine.setPreampGain).toHaveBeenCalledWith(2.5);
    expect(mockAudioEngine.setReplayGainMode).toHaveBeenCalledWith('track');
    expect(mockAudioEngine.setBalance).toHaveBeenCalledWith(0.2);
    expect(mockAudioEngine.setLimiterEnabled).toHaveBeenCalledWith(true);
  });
});
