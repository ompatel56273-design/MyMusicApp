import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { EqualizerComponent } from '../../src/ui/components/audio/equalizer-component';
import type { IAudioEngine, IAudioSettingsService } from '../../src/services/contracts/service-contracts';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../../src/domain/entities/audio-settings';
import { BUILT_IN_EQ_PRESETS } from '../../src/services/audio/eq-presets';

describe('EqualizerComponent', () => {
  let container: HTMLElement;
  let mockAudioEngine: IAudioEngine;
  let mockSettingsService: IAudioSettingsService;
  let currentSettings: AudioSettings;
  let component: EqualizerComponent;

  beforeEach(() => {
    container = document.createElement('div');
    currentSettings = { ...DEFAULT_AUDIO_SETTINGS };

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

    mockSettingsService = {
      getSettings: vi.fn().mockImplementation(async () => currentSettings),
      saveSettings: vi.fn().mockImplementation(async partial => {
        currentSettings = { ...currentSettings, ...partial };
        return currentSettings;
      }),
      resetToDefaults: vi.fn().mockImplementation(async () => {
        currentSettings = { ...DEFAULT_AUDIO_SETTINGS };
        return currentSettings;
      }),
      getBuiltInPresets: vi.fn().mockReturnValue(BUILT_IN_EQ_PRESETS),
      saveCustomPreset: vi.fn(),
      deleteCustomPreset: vi.fn(),
      applyToAudioEngine: vi.fn()
    };

    component = new EqualizerComponent({
      audioEngine: mockAudioEngine,
      audioSettingsService: mockSettingsService
    });
  });

  afterEach(() => {
    if (component) {
      component.unmount();
    }
  });

  it('renders 10 accessible frequency band sliders and preamp control', async () => {
    await component.mount(container);

    const sliders = container.querySelectorAll<HTMLInputElement>('.eq-band-slider');
    expect(sliders.length).toBe(10);

    const preamp = container.querySelector<HTMLInputElement>('#eq-preamp-slider');
    expect(preamp).not.toBeNull();
    expect(preamp?.getAttribute('min')).toBe('-12');
    expect(preamp?.getAttribute('max')).toBe('12');
  });

  it('toggles EQ enable/bypass and updates AudioEngine', async () => {
    await component.mount(container);

    const toggle = container.querySelector<HTMLInputElement>('#eq-enable-toggle');
    expect(toggle).not.toBeNull();

    // Toggle to bypass
    toggle!.checked = false;
    toggle!.dispatchEvent({ type: 'change', target: toggle } as any);

    expect(mockAudioEngine.setEqualizerEnabled).toHaveBeenCalledWith(false);
  });

  it('updates band gain in realtime on slider input', async () => {
    await component.mount(container);

    const sliders = container.querySelectorAll<HTMLInputElement>('.eq-band-slider');
    const firstBand = sliders[0]!;

    firstBand.value = '4.5';
    firstBand.dispatchEvent({ type: 'input', target: firstBand } as any);

    expect(mockAudioEngine.setEqualizerBandGain).toHaveBeenCalledWith(0, 4.5);
  });

  it('resets EQ to flat on reset button click', async () => {
    currentSettings = {
      ...DEFAULT_AUDIO_SETTINGS,
      equalizerBands: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      preampGainDb: 2
    };

    await component.mount(container);

    const resetBtn = container.querySelector<HTMLButtonElement>('#eq-reset-btn');
    expect(resetBtn).not.toBeNull();

    resetBtn?.click();

    expect(mockSettingsService.resetToDefaults).toHaveBeenCalled();
  });
});
