import type { IDashboardService } from '../contracts/service-contracts';
import type {
  DashboardSettings,
  DashboardSectionConfig,
  DashboardSectionId
} from '../../domain/entities/dashboard-settings';
import {
  DEFAULT_DASHBOARD_SETTINGS,
  SUPPORTED_DASHBOARD_SECTIONS
} from '../../domain/entities/dashboard-settings';
import type { IDatabaseAdapter } from '../../data/db/database-adapter';
import { STORES } from '../../data/db/schema';
import { Logger } from '../../core/logging/logger';
import type { EventBus } from '../../core/events/event-bus';
import { DomainEvents } from '../../domain/events/domain-events';

export class DashboardService implements IDashboardService {
  private static readonly SETTINGS_KEY = 'dashboard_settings';
  private readonly db?: IDatabaseAdapter | undefined;
  private readonly eventBus?: EventBus | undefined;
  private readonly logger = new Logger('DashboardService');
  private cachedSettings: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS };
  private isLoaded = false;

  constructor(db?: IDatabaseAdapter, eventBus?: EventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  public async getSettings(): Promise<DashboardSettings> {
    if (!this.isLoaded && this.db) {
      try {
        const record = await this.db.get<{ key: string; value: DashboardSettings }>(
          STORES.SETTINGS,
          DashboardService.SETTINGS_KEY
        );
        if (record && record.value) {
          this.cachedSettings = this.normalizeAndRepairSettings(record.value);
        } else {
          this.cachedSettings = { ...DEFAULT_DASHBOARD_SETTINGS };
        }
      } catch (err) {
        this.logger.warn('Failed to load dashboard settings from IndexedDB, using defaults:', { error: String(err) });
        this.cachedSettings = { ...DEFAULT_DASHBOARD_SETTINGS };
      }
      this.isLoaded = true;
    }
    return {
      sectionOrder: [...this.cachedSettings.sectionOrder],
      hiddenSections: [...this.cachedSettings.hiddenSections]
    };
  }

  public async saveSettings(partial: Partial<DashboardSettings>): Promise<DashboardSettings> {
    const current = await this.getSettings();
    const merged: DashboardSettings = {
      sectionOrder: partial.sectionOrder ? [...partial.sectionOrder] : current.sectionOrder,
      hiddenSections: partial.hiddenSections ? [...partial.hiddenSections] : current.hiddenSections
    };

    const sanitized = this.normalizeAndRepairSettings(merged);
    this.cachedSettings = sanitized;

    if (this.db) {
      try {
        await this.db.put(STORES.SETTINGS, {
          key: DashboardService.SETTINGS_KEY,
          value: sanitized
        });
      } catch (err) {
        this.logger.error('Failed to persist dashboard settings to IndexedDB:', { error: String(err) });
      }
    }

    if (this.eventBus) {
      this.eventBus.publish(DomainEvents.DASHBOARD_SETTINGS_CHANGED, { settings: sanitized });
    }

    return {
      sectionOrder: [...this.cachedSettings.sectionOrder],
      hiddenSections: [...this.cachedSettings.hiddenSections]
    };
  }

  public async toggleSectionVisibility(sectionId: string, visible?: boolean): Promise<DashboardSettings> {
    const current = await this.getSettings();
    const isCurrentlyHidden = current.hiddenSections.includes(sectionId as DashboardSectionId);
    const targetVisible = visible !== undefined ? visible : isCurrentlyHidden;

    let newHidden: DashboardSectionId[];
    if (targetVisible) {
      newHidden = current.hiddenSections.filter(id => id !== sectionId);
    } else {
      newHidden = current.hiddenSections.includes(sectionId as DashboardSectionId)
        ? [...current.hiddenSections]
        : [...current.hiddenSections, sectionId as DashboardSectionId];
    }

    return this.saveSettings({ hiddenSections: newHidden });
  }

  public async setSectionVisibility(sectionId: string, visible: boolean): Promise<DashboardSettings> {
    return this.toggleSectionVisibility(sectionId, visible);
  }

  public async reorderSections(sectionId: string, direction: 'up' | 'down'): Promise<DashboardSettings> {
    const current = await this.getSettings();
    const order = [...current.sectionOrder];
    const index = order.indexOf(sectionId as DashboardSectionId);

    if (index === -1) return current;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return current;

    const [moved] = order.splice(index, 1);
    order.splice(targetIndex, 0, moved!);

    return this.saveSettings({ sectionOrder: order });
  }

  public async moveSectionUp(sectionId: string): Promise<DashboardSettings> {
    return this.reorderSections(sectionId, 'up');
  }

  public async moveSectionDown(sectionId: string): Promise<DashboardSettings> {
    return this.reorderSections(sectionId, 'down');
  }

  public async moveSection(fromIndex: number, toIndex: number): Promise<DashboardSettings> {
    const current = await this.getSettings();
    const order = [...current.sectionOrder];

    if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length) {
      return current;
    }

    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved!);

    return this.saveSettings({ sectionOrder: order });
  }

  public async setSectionOrder(order: readonly string[]): Promise<DashboardSettings> {
    return this.saveSettings({ sectionOrder: order as DashboardSectionId[] });
  }

  public async resetToDefaults(): Promise<DashboardSettings> {
    return this.saveSettings(DEFAULT_DASHBOARD_SETTINGS);
  }

  public getResolvedSections(): readonly DashboardSectionConfig[] {
    const result: DashboardSectionConfig[] = [];

    const supportedMap = new Map<string, string>();
    for (const sec of SUPPORTED_DASHBOARD_SECTIONS) {
      supportedMap.set(sec.id, sec.label);
    }

    let orderIdx = 0;
    for (const id of this.cachedSettings.sectionOrder) {
      const label = supportedMap.get(id);
      if (label) {
        const isHidden = this.cachedSettings.hiddenSections.includes(id);
        result.push({
          id,
          label,
          visible: !isHidden,
          enabled: !isHidden,
          order: orderIdx++
        });
      }
    }

    return result;
  }

  private normalizeAndRepairSettings(raw: any): DashboardSettings {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_DASHBOARD_SETTINGS };
    }

    const supportedIds = SUPPORTED_DASHBOARD_SECTIONS.map(s => s.id);

    // 1. Repair sectionOrder
    let rawOrder: any[] = Array.isArray(raw.sectionOrder) ? raw.sectionOrder : [];
    const validOrder: DashboardSectionId[] = [];

    for (const item of rawOrder) {
      const id = String(item) as DashboardSectionId;
      if (supportedIds.includes(id) && !validOrder.includes(id)) {
        validOrder.push(id);
      }
    }

    // Restore missing supported IDs in default order
    for (const defaultId of DEFAULT_DASHBOARD_SETTINGS.sectionOrder) {
      if (!validOrder.includes(defaultId)) {
        validOrder.push(defaultId);
      }
    }

    // 2. Repair hiddenSections
    let rawHidden: any[] = Array.isArray(raw.hiddenSections) ? raw.hiddenSections : [];
    const validHidden: DashboardSectionId[] = [];

    for (const item of rawHidden) {
      const id = String(item) as DashboardSectionId;
      if (supportedIds.includes(id) && !validHidden.includes(id)) {
        validHidden.push(id);
      }
    }

    return {
      sectionOrder: validOrder,
      hiddenSections: validHidden
    };
  }
}
