import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { VisualizerComponent } from '../../src/ui/components/visualizer/visualizer-component';
import { EventBus } from '../../src/core/events/event-bus';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import { VisualizerService } from '../../src/services/visualizer/visualizer-service';
import type { IAudioEngine } from '../../src/services/contracts/service-contracts';

describe('VisualizerComponent', () => {
  let container: HTMLElement;
  let mockDb: IDatabaseAdapter;
  let visualizerService: VisualizerService;
  let eventBus: EventBus;
  let mockAudioEngine: IAudioEngine;
  let component: VisualizerComponent;
  let dbStore: Record<string, any>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

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
    eventBus = new EventBus();

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
      getAnalysisData: vi.fn(() => new Uint8Array(128)),
      getAnalysisMetrics: vi.fn(() => ({
        frequencyData: new Uint8Array(128).fill(80),
        timeDomainData: new Uint8Array(128).fill(128),
        rms: 0.3,
        peak: 0.5
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

    component = new VisualizerComponent({
      audioEngine: mockAudioEngine,
      visualizerService,
      eventBus
    });
  });

  afterEach(() => {
    component.unmount();
    container.remove();
  });

  it('mounts canvas and control buttons into DOM', async () => {
    await component.mount(container);

    const canvas = container.querySelector<HTMLCanvasElement>('#vis-canvas');
    expect(canvas).not.toBeNull();

    const modeButtons = container.querySelectorAll('.vis-mode-btn');
    expect(modeButtons.length).toBe(8);

    const toggleCheckbox = container.querySelector<HTMLInputElement>('#vis-enabled-toggle');
    expect(toggleCheckbox).not.toBeNull();
  });

  it('switches modes when mode selector buttons are clicked', async () => {
    await component.mount(container);

    const waveformBtn = container.querySelector<HTMLButtonElement>('button[data-mode="waveform"]');
    expect(waveformBtn).not.toBeNull();

    waveformBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    const settings = await visualizerService.getSettings();
    expect(settings.mode).toBe('waveform');
  });

  it('toggles visualizer enable/disable state', async () => {
    await component.mount(container);

    const toggleCheckbox = container.querySelector<HTMLInputElement>('#vis-enabled-toggle');
    expect(toggleCheckbox).not.toBeNull();

    toggleCheckbox?.click();
    await new Promise(r => setTimeout(r, 10));

    let settings = await visualizerService.getSettings();
    expect(settings.enabled).toBe(false);

    // Re-query toggle since render() rewires DOM
    const updatedCheckbox = container.querySelector<HTMLInputElement>('#vis-enabled-toggle');
    updatedCheckbox?.click();
    await new Promise(r => setTimeout(r, 10));

    settings = await visualizerService.getSettings();
    expect(settings.enabled).toBe(true);
  });

  it('responds to playback state changes via EventBus', async () => {
    await component.mount(container);

    eventBus.publish('playback:state-changed', {
      previous: 'playing',
      current: 'paused',
      track: null
    });

    eventBus.publish('playback:state-changed', {
      previous: 'paused',
      current: 'playing',
      track: null
    });

    eventBus.publish('playback:state-changed', {
      previous: 'playing',
      current: 'stopped',
      track: null
    });
  });

  it('unmounts and cleans up event listeners without error', async () => {
    await component.mount(container);
    expect(() => component.unmount()).not.toThrow();
    expect(container.innerHTML).toBe('');
  });
});
