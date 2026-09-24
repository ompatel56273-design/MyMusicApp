import type { IAudioSettingsService, IAudioEngine } from '../contracts/service-contracts';
import type { AudioSettings, EqualizerPreset } from '../../domain/entities/audio-settings';
import { DEFAULT_AUDIO_SETTINGS } from '../../domain/entities/audio-settings';
import { BUILT_IN_EQ_PRESETS, getBuiltInPresetById } from './eq-presets';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { Logger } from '../../core/logging/logger';
import type { ReplayGainMode } from './audio-types';

export class AudioSettingsService implements IAudioSettingsService {
  private static readonly SETTINGS_KEY = 'audio_dsp_settings';
  private readonly db?: IDatabaseAdapter | undefined;
  private readonly logger = new Logger('AudioSettingsService');
  private cachedSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private isLoaded = false;

  constructor(db?: IDatabaseAdapter) {
    this.db = db;
  }

  public async getSettings(): Promise<AudioSettings> {
    if (!this.isLoaded && this.db) {
      try {
        const record = await this.db.get<{ key: string; value: AudioSettings }>(
          STORES.SETTINGS,
          AudioSettingsService.SETTINGS_KEY
        );
        if (record && record.value) {
          this.cachedSettings = this.validateAndSanitize(record.value);
        }
      } catch (err) {
        this.logger.warn('Failed to load audio settings from IndexedDB, using defaults:', { error: String(err) });
        this.cachedSettings = { ...DEFAULT_AUDIO_SETTINGS };
      }
      this.isLoaded = true;
    }
    return { ...this.cachedSettings };
  }

  public async saveSettings(partial: Partial<AudioSettings>): Promise<AudioSettings> {
    const current = await this.getSettings();
    const merged: AudioSettings = {
      ...current,
      ...partial
    };

    const sanitized = this.validateAndSanitize(merged);
    this.cachedSettings = sanitized;

    if (this.db) {
      try {
        await this.db.put(STORES.SETTINGS, {
          key: AudioSettingsService.SETTINGS_KEY,
          value: sanitized
        });
      } catch (err) {
        this.logger.error('Failed to persist audio settings to IndexedDB:', { error: String(err) });
      }
    }

    return { ...this.cachedSettings };
  }

  public async resetToDefaults(): Promise<AudioSettings> {
    return this.saveSettings(DEFAULT_AUDIO_SETTINGS);
  }

  public getBuiltInPresets(): readonly EqualizerPreset[] {
    return BUILT_IN_EQ_PRESETS;
  }

  public async saveCustomPreset(name: string, bands: readonly number[], preampGainDb = 0): Promise<EqualizerPreset> {
    if (!name || !name.trim()) {
      throw new Error('Preset name cannot be empty.');
    }

    const current = await this.getSettings();
    const sanitizedBands = this.sanitizeBands(bands);
    const sanitizedPreamp = this.clampDb(preampGainDb);

    const newPreset: EqualizerPreset = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      isBuiltIn: false,
      bands: sanitizedBands,
      preampGainDb: sanitizedPreamp
    };

    const updatedCustoms = [...current.customPresets, newPreset];
    await this.saveSettings({
      customPresets: updatedCustoms,
      selectedPreset: newPreset.id,
      equalizerBands: sanitizedBands,
      preampGainDb: sanitizedPreamp
    });

    return newPreset;
  }

  public async deleteCustomPreset(presetId: string): Promise<void> {
    const current = await this.getSettings();
    const filtered = current.customPresets.filter(p => p.id !== presetId);

    const isCurrentDeleted = current.selectedPreset === presetId;
    const flat = getBuiltInPresetById('flat')!;

    await this.saveSettings({
      customPresets: filtered,
      selectedPreset: isCurrentDeleted ? 'flat' : current.selectedPreset,
      equalizerBands: isCurrentDeleted ? [...flat.bands] : current.equalizerBands,
      preampGainDb: isCurrentDeleted ? flat.preampGainDb : current.preampGainDb
    });
  }

  public async applyToAudioEngine(engine: IAudioEngine): Promise<void> {
    const settings = await this.getSettings();
    try {
      engine.setEqualizerEnabled(settings.equalizerEnabled);
      engine.setEqualizerBands(settings.equalizerBands);
      engine.setPreampGain(settings.preampGainDb);
      engine.setReplayGainMode(settings.replayGainMode);
      engine.setBalance(settings.balance);
      engine.setLimiterEnabled(settings.limiterEnabled);
      if (engine.setCrossfade) {
        engine.setCrossfade(settings.crossfadeEnabled, settings.crossfadeDurationSec);
      }
    } catch (err) {
      this.logger.error('Failed to apply DSP settings to audio engine:', { error: String(err) });
    }
  }

  private validateAndSanitize(raw: any): AudioSettings {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }

    const equalizerEnabled = typeof raw.equalizerEnabled === 'boolean' ? raw.equalizerEnabled : true;
    const equalizerBands = this.sanitizeBands(raw.equalizerBands);
    const preampGainDb = this.clampDb(raw.preampGainDb);
    const replayGainMode = this.sanitizeReplayGainMode(raw.replayGainMode);
    const selectedPreset = typeof raw.selectedPreset === 'string' && raw.selectedPreset.trim() ? raw.selectedPreset.trim() : 'flat';
    const balance = this.clampBalance(raw.balance);
    const limiterEnabled = typeof raw.limiterEnabled === 'boolean' ? raw.limiterEnabled : true;
    const crossfadeEnabled = typeof raw.crossfadeEnabled === 'boolean' ? raw.crossfadeEnabled : false;
    const crossfadeDurationSec = this.clampCrossfadeDuration(raw.crossfadeDurationSec);

    const customPresets: EqualizerPreset[] = [];
    if (Array.isArray(raw.customPresets)) {
      for (const p of raw.customPresets) {
        if (p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.bands)) {
          customPresets.push({
            id: p.id,
            name: p.name,
            isBuiltIn: false,
            bands: this.sanitizeBands(p.bands),
            preampGainDb: this.clampDb(p.preampGainDb)
          });
        }
      }
    }

    return {
      equalizerEnabled,
      equalizerBands,
      preampGainDb,
      replayGainMode,
      selectedPreset,
      customPresets,
      balance,
      limiterEnabled,
      crossfadeEnabled,
      crossfadeDurationSec
    };
  }

  private sanitizeBands(bands: any): readonly number[] {
    const defaultBands = DEFAULT_AUDIO_SETTINGS.equalizerBands;
    if (!Array.isArray(bands) || bands.length !== 10) {
      return [...defaultBands];
    }
    return bands.map(b => this.clampDb(b));
  }

  private clampDb(val: any): number {
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.max(-12.0, Math.min(12.0, num));
  }

  private clampBalance(val: any): number {
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.max(-1.0, Math.min(1.0, num));
  }

  private clampCrossfadeDuration(val: any): number {
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return DEFAULT_AUDIO_SETTINGS.crossfadeDurationSec;
    return Math.max(1.0, Math.min(12.0, Math.round(num * 10) / 10));
  }

  private sanitizeReplayGainMode(mode: any): ReplayGainMode {
    if (mode === 'off' || mode === 'track' || mode === 'album') {
      return mode;
    }
    return 'track';
  }
}
