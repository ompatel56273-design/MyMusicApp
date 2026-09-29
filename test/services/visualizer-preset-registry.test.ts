import { describe, it, expect } from 'vitest';
import { VisualizerPresetRegistry } from '../../src/services/visualizer/visualizer-preset-registry';
import type { VisualizerPreset } from '../../src/services/visualizer/visualizer-types';

describe('VisualizerPresetRegistry', () => {
  it('registers all 5 required default WebGL presets', () => {
    const registry = VisualizerPresetRegistry.getInstance();
    const presets = registry.listPresets();

    expect(presets.length).toBeGreaterThanOrEqual(5);

    const ids = presets.map(p => p.id);
    expect(ids).toContain('neon-nebula');
    expect(ids).toContain('hyperspace');
    expect(ids).toContain('liquid-wave');
    expect(ids).toContain('crt-oscilloscope');
    expect(ids).toContain('cybernetic-ring');
  });

  it('creates presets by ID', () => {
    const registry = VisualizerPresetRegistry.getInstance();

    const nebula = registry.createPreset('neon-nebula');
    expect(nebula).not.toBeNull();
    expect(nebula?.id).toBe('neon-nebula');
    expect(nebula?.name).toBe('Neon Nebula');

    const hyperspace = registry.createPreset('hyperspace');
    expect(hyperspace).not.toBeNull();
    expect(hyperspace?.id).toBe('hyperspace');

    const liquid = registry.createPreset('liquid-wave');
    expect(liquid).not.toBeNull();
    expect(liquid?.id).toBe('liquid-wave');

    const crt = registry.createPreset('crt-oscilloscope');
    expect(crt).not.toBeNull();
    expect(crt?.id).toBe('crt-oscilloscope');

    const ring = registry.createPreset('cybernetic-ring');
    expect(ring).not.toBeNull();
    expect(ring?.id).toBe('cybernetic-ring');
  });

  it('returns null for unknown preset ID', () => {
    const registry = VisualizerPresetRegistry.getInstance();
    expect(registry.createPreset('non-existent-preset')).toBeNull();
  });

  it('allows registering and unregistering custom presets', () => {
    const registry = new VisualizerPresetRegistry();
    const customPreset: VisualizerPreset = {
      id: 'custom-synthwave',
      name: 'Custom Synthwave',
      description: 'Test custom preset',
      initialize: () => true,
      resize: () => {},
      render: () => {},
      dispose: () => {}
    };

    registry.register('custom-synthwave', () => customPreset);
    expect(registry.has('custom-synthwave')).toBe(true);

    const created = registry.createPreset('custom-synthwave');
    expect(created?.name).toBe('Custom Synthwave');

    registry.unregister('custom-synthwave');
    expect(registry.has('custom-synthwave')).toBe(false);
  });
});
