import type { VisualizerPreset } from './visualizer-types';
import { NeonNebulaPreset } from './presets/neon-nebula-preset';
import { HyperspacePreset } from './presets/hyperspace-preset';
import { LiquidWavePreset } from './presets/liquid-wave-preset';
import { CrtOscilloscopePreset } from './presets/crt-oscilloscope-preset';
import { CyberneticRingPreset } from './presets/cybernetic-ring-preset';

export interface PresetInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export class VisualizerPresetRegistry {
  private static instance?: VisualizerPresetRegistry;
  private readonly presets = new Map<string, () => VisualizerPreset>();

  constructor() {
    this.registerDefaults();
  }

  public static getInstance(): VisualizerPresetRegistry {
    if (!this.instance) {
      this.instance = new VisualizerPresetRegistry();
    }
    return this.instance;
  }

  private registerDefaults(): void {
    this.register('neon-nebula', () => new NeonNebulaPreset());
    this.register('hyperspace', () => new HyperspacePreset());
    this.register('liquid-wave', () => new LiquidWavePreset());
    this.register('crt-oscilloscope', () => new CrtOscilloscopePreset());
    this.register('cybernetic-ring', () => new CyberneticRingPreset());
  }

  public register(id: string, factory: () => VisualizerPreset): void {
    this.presets.set(id, factory);
  }

  public unregister(id: string): boolean {
    return this.presets.delete(id);
  }

  public has(id: string): boolean {
    return this.presets.has(id);
  }

  public createPreset(id: string): VisualizerPreset | null {
    const factory = this.presets.get(id);
    if (!factory) return null;
    return factory();
  }

  public listPresets(): readonly PresetInfo[] {
    const list: PresetInfo[] = [];
    for (const [, factory] of this.presets) {
      const p = factory();
      list.push({
        id: p.id,
        name: p.name,
        description: p.description
      });
    }
    return list;
  }

  public getDefaultPresetId(): string {
    return 'neon-nebula';
  }
}
