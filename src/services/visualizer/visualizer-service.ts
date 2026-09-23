import type { IVisualizerService } from '../contracts/service-contracts';
import type { VisualizerSettings, VisualizerMode, VisualizerColorTheme } from '../../domain/entities/visualizer-settings';
import { DEFAULT_VISUALIZER_SETTINGS } from '../../domain/entities/visualizer-settings';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { Logger } from '../../core/logging/logger';

export class VisualizerService implements IVisualizerService {
  private static readonly SETTINGS_KEY = 'visualizer_settings';
  private readonly db?: IDatabaseAdapter | undefined;
  private readonly logger = new Logger('VisualizerService');
  private cachedSettings: VisualizerSettings = { ...DEFAULT_VISUALIZER_SETTINGS };
  private isLoaded = false;

  constructor(db?: IDatabaseAdapter) {
    this.db = db;
  }

  public async getSettings(): Promise<VisualizerSettings> {
    if (!this.isLoaded && this.db) {
      try {
        const record = await this.db.get<{ key: string; value: VisualizerSettings }>(
          STORES.SETTINGS,
          VisualizerService.SETTINGS_KEY
        );
        if (record && record.value) {
          this.cachedSettings = this.validateAndSanitize(record.value);
        }
      } catch (err) {
        this.logger.warn('Failed to load visualizer settings from IndexedDB, using defaults:', { error: String(err) });
        this.cachedSettings = { ...DEFAULT_VISUALIZER_SETTINGS };
      }
      this.isLoaded = true;
    }
    return { ...this.cachedSettings };
  }

  public async saveSettings(partial: Partial<VisualizerSettings>): Promise<VisualizerSettings> {
    const current = await this.getSettings();
    const merged: VisualizerSettings = {
      ...current,
      ...partial
    };

    const sanitized = this.validateAndSanitize(merged);
    this.cachedSettings = sanitized;

    if (this.db) {
      try {
        await this.db.put(STORES.SETTINGS, {
          key: VisualizerService.SETTINGS_KEY,
          value: sanitized
        });
      } catch (err) {
        this.logger.error('Failed to persist visualizer settings to IndexedDB:', { error: String(err) });
      }
    }

    return { ...this.cachedSettings };
  }

  public async setMode(mode: VisualizerMode): Promise<VisualizerSettings> {
    return this.saveSettings({ mode });
  }

  public async setEnabled(enabled: boolean): Promise<VisualizerSettings> {
    return this.saveSettings({ enabled });
  }

  public async resetToDefaults(): Promise<VisualizerSettings> {
    return this.saveSettings(DEFAULT_VISUALIZER_SETTINGS);
  }

  private validateAndSanitize(raw: any): VisualizerSettings {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_VISUALIZER_SETTINGS };
    }

    const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_VISUALIZER_SETTINGS.enabled;
    const mode = this.sanitizeMode(raw.mode);
    const fpsLimit = this.sanitizeFps(raw.fpsLimit);
    const colorTheme = this.sanitizeTheme(raw.colorTheme);

    return {
      enabled,
      mode,
      fpsLimit,
      colorTheme
    };
  }

  private sanitizeMode(mode: any): VisualizerMode {
    const validModes: VisualizerMode[] = [
      'bars',
      'waveform',
      'circular',
      'spectrum',
      'particles',
      'pulse',
      'album-reactive',
      'minimal'
    ];
    if (validModes.includes(mode)) {
      return mode;
    }
    return DEFAULT_VISUALIZER_SETTINGS.mode;
  }

  private sanitizeFps(fps: any): number {
    const num = Number(fps);
    if (num === 30 || num === 60 || num === 120) {
      return num;
    }
    return 60;
  }

  private sanitizeTheme(theme: any): VisualizerColorTheme {
    const validThemes: VisualizerColorTheme[] = ['accent', 'rainbow', 'monochrome'];
    if (validThemes.includes(theme)) {
      return theme;
    }
    return 'accent';
  }
}
