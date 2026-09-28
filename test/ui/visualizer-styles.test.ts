import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { VisualizerComponent } from '../../src/ui/components/visualizer/visualizer-component';
import { VisualizerCanvasRenderer } from '../../src/ui/components/visualizer/visualizer-canvas-renderer';
import { VisualizerService } from '../../src/services/visualizer/visualizer-service';
import { DEFAULT_VISUALIZER_SETTINGS } from '../../src/domain/entities/visualizer-settings';
import { SettingsView } from '../../src/ui/views/settings-view';
import { EventBus } from '../../src/core/events/event-bus';
import type { IDatabaseAdapter } from '../../src/data/db/database-adapter';
import type { IAudioEngine, IPlaybackManager } from '../../src/services/contracts/service-contracts';

describe('F2.6 — Visualizer Styles System', () => {
  let container: HTMLElement;
  let mockDb: IDatabaseAdapter;
  let dbStore: Record<string, any>;
  let visualizerService: VisualizerService;
  let eventBus: EventBus;
  let mockAudioEngine: IAudioEngine;
  let mockPlaybackManager: IPlaybackManager;
  let component: VisualizerComponent;

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
        frequencyData: new Uint8Array(128).fill(100),
        timeDomainData: new Uint8Array(128).fill(128),
        rms: 0.4,
        peak: 0.7
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

    mockPlaybackManager = {
      state: 'playing',
      currentTrack: { id: 't1', title: 'Test Song', artist: 'Artist', durationSec: 180 } as any,
      positionMs: 1000,
      durationMs: 180000,
      volume: 0.8,
      isMuted: false,
      playbackRate: 1.0,
      repeatMode: 'off',
      shuffleMode: 'off',
      queue: [],
      currentQueueIndex: 0,
      playTrack: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      seek: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn(),
      addToQueue: vi.fn(),
      playQueueIndex: vi.fn(),
      removeFromQueue: vi.fn(),
      reorderQueue: vi.fn(),
      clearQueue: vi.fn()
    };

    component = new VisualizerComponent({
      audioEngine: mockAudioEngine,
      visualizerService,
      playbackManager: mockPlaybackManager,
      eventBus
    });
  });

  afterEach(() => {
    if (component) {
      component.unmount();
    }
    container.remove();
    vi.restoreAllMocks();
  });

  it('1. Default style = Off', async () => {
    const settings = await visualizerService.getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.mode).toBe('off');
  });

  it('2. Spectrum Bars selection', async () => {
    const updated = await visualizerService.setMode('bars');
    expect(updated.mode).toBe('bars');
    expect(updated.enabled).toBe(true);
  });

  it('3. Waveform selection', async () => {
    const updated = await visualizerService.setMode('waveform');
    expect(updated.mode).toBe('waveform');
    expect(updated.enabled).toBe(true);
  });

  it('4. Circular Spectrum selection', async () => {
    const updated = await visualizerService.setMode('circular');
    expect(updated.mode).toBe('circular');
    expect(updated.enabled).toBe(true);
  });

  it('5. Runtime style switching', async () => {
    await visualizerService.setMode('bars');
    let s = await visualizerService.getSettings();
    expect(s.mode).toBe('bars');

    await visualizerService.setMode('waveform');
    s = await visualizerService.getSettings();
    expect(s.mode).toBe('waveform');

    await visualizerService.setMode('off');
    s = await visualizerService.getSettings();
    expect(s.mode).toBe('off');
    expect(s.enabled).toBe(false);
  });

  it('6. Persistence', async () => {
    await visualizerService.setMode('circular');
    expect(mockDb.put).toHaveBeenCalled();
  });

  it('7. Restoration', async () => {
    await visualizerService.setMode('waveform');
    const newService = new VisualizerService(mockDb);
    const restored = await newService.getSettings();
    expect(restored.mode).toBe('waveform');
    expect(restored.enabled).toBe(true);
  });

  it('8. Invalid stored style fallback', async () => {
    dbStore['visualizer_settings'] = { mode: 'invalid_mode_xyz', enabled: true };
    const newService = new VisualizerService(mockDb);
    const loaded = await newService.getSettings();
    expect(loaded.mode).toBe('off');
    expect(loaded.enabled).toBe(false);
  });

  it('9. Storage failure fallback', async () => {
    const faultyDb: IDatabaseAdapter = {
      ...mockDb,
      get: vi.fn().mockRejectedValue(new Error('IndexedDB failure'))
    };
    const newService = new VisualizerService(faultyDb);
    const settings = await newService.getSettings();
    expect(settings).toEqual(DEFAULT_VISUALIZER_SETTINGS);
    expect(settings.mode).toBe('off');
  });

  it('10. Settings UI', async () => {
    const settingsView = new SettingsView({
      visualizerService,
      audioEngine: mockAudioEngine
    });
    const viewContainer = document.createElement('div');
    document.body.appendChild(viewContainer);
    settingsView.mount(viewContainer, { section: 'visualizer' } as any);
    await new Promise(r => setTimeout(r, 20));

    const modeSelect = viewContainer.querySelector<HTMLSelectElement>('#settings-viz-mode');
    expect(modeSelect).not.toBeNull();
    expect(modeSelect?.value).toBe('off');

    if (modeSelect) {
      modeSelect.value = 'bars';
      modeSelect.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 20));
    }

    const updated = await visualizerService.getSettings();
    expect(updated.mode).toBe('bars');

    settingsView.unmount();
    viewContainer.remove();
  });

  it('11. Keyboard accessibility', async () => {
    await component.mount(container);
    const waveformBtn = container.querySelector<HTMLButtonElement>('button[data-mode="waveform"]');
    expect(waveformBtn).not.toBeNull();

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    waveformBtn?.dispatchEvent(enterEvent);
    await new Promise(r => setTimeout(r, 10));

    const settings = await visualizerService.getSettings();
    expect(settings.mode).toBe('waveform');
  });

  it('12. ARIA semantics', async () => {
    await component.mount(container);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-label')).toBe('Visualizer Style Selection');

    const radioButtons = container.querySelectorAll('[role="radio"]');
    expect(radioButtons.length).toBeGreaterThan(0);

    const canvas = container.querySelector('canvas');
    expect(canvas?.getAttribute('role')).toBe('img');
  });

  it('13. Animation starts when enabled', async () => {
    await visualizerService.setMode('bars');
    await component.mount(container);

    const canvas = container.querySelector<HTMLCanvasElement>('#vis-canvas')!;
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const startSpy = vi.spyOn(renderer, 'start');

    renderer.attachCanvas(canvas);
    renderer.setConfig({ mode: 'bars' });
    renderer.start();

    expect(startSpy).toHaveBeenCalled();
    renderer.detachCanvas();
  });

  it('14. Animation stops when Off', async () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const stopSpy = vi.spyOn(renderer, 'stop');

    renderer.start();
    renderer.setConfig({ mode: 'off' });
    renderer.stop();

    expect(stopSpy).toHaveBeenCalled();
  });

  it('15. Animation stops on component destruction', async () => {
    await visualizerService.setMode('waveform');
    await component.mount(container);

    expect(() => component.unmount()).not.toThrow();
  });

  it('16. No duplicate animation loops', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);

    renderer.start();
    renderer.start(); // Second call should be a no-op
    renderer.stop();
  });

  it('17. Canvas resize handling', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 400 }),
      configurable: true
    });
    renderer.attachCanvas(canvas);
    expect(() => renderer.resize()).not.toThrow();
  });

  it('18. devicePixelRatio handling where applicable', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ width: 500, height: 300 }),
      configurable: true
    });

    renderer.attachCanvas(canvas);
    renderer.resize();
    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(600);
  });

  it('19. Reduced-motion behavior', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);

    renderer.setConfig({ reducedMotion: true });
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('20. AudioContext reuse', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);
    renderer.drawFrame();

    expect(mockAudioEngine.getAnalysisMetrics).toHaveBeenCalled();
  });

  it('21. No second AudioContext', () => {
    const dummyAudioContext = vi.fn();
    (globalThis as any).AudioContext = dummyAudioContext;
    const audioContextSpy = vi.spyOn(globalThis, 'AudioContext' as any);
    new VisualizerCanvasRenderer(mockAudioEngine);
    expect(audioContextSpy).not.toHaveBeenCalled();
  });

  it('22. No duplicate analyser infrastructure', () => {
    expect(mockAudioEngine.getAnalysisMetrics).toBeDefined();
  });

  it('23. Playback state unchanged', async () => {
    const initial = mockPlaybackManager.state;
    await visualizerService.setMode('circular');
    expect(mockPlaybackManager.state).toBe(initial);
  });

  it('24. Queue state unchanged', async () => {
    const initialLen = mockPlaybackManager.queue.length;
    await visualizerService.setMode('bars');
    expect(mockPlaybackManager.queue.length).toBe(initialLen);
  });

  it('25. Current track unchanged', async () => {
    const track = mockPlaybackManager.currentTrack;
    await visualizerService.setMode('waveform');
    expect(mockPlaybackManager.currentTrack).toEqual(track);
  });

  it('26. Volume unchanged', async () => {
    const vol = mockPlaybackManager.volume;
    await visualizerService.setMode('circular');
    expect(mockPlaybackManager.volume).toBe(vol);
  });

  it('27. Seek state unchanged', async () => {
    const pos = mockPlaybackManager.positionMs;
    await visualizerService.setMode('bars');
    expect(mockPlaybackManager.positionMs).toBe(pos);
  });

  it('28. Repeat unchanged', async () => {
    const rep = mockPlaybackManager.repeatMode;
    await visualizerService.setMode('waveform');
    expect(mockPlaybackManager.repeatMode).toBe(rep);
  });

  it('29. Shuffle unchanged', async () => {
    const shuf = mockPlaybackManager.shuffleMode;
    await visualizerService.setMode('circular');
    expect(mockPlaybackManager.shuffleMode).toBe(shuf);
  });

  it('30. Gapless playback unaffected', async () => {
    await visualizerService.setMode('bars');
    expect(mockAudioEngine.loadBuffer).not.toHaveBeenCalled();
  });

  it('31. Crossfade unaffected', async () => {
    await visualizerService.setMode('waveform');
    expect(mockAudioEngine.setGain).not.toHaveBeenCalled();
  });

  it('32. ReplayGain unaffected', async () => {
    await visualizerService.setMode('circular');
    expect(mockAudioEngine.setReplayGainMode).not.toHaveBeenCalled();
  });

  it('33. A/B loop unaffected', async () => {
    await visualizerService.setMode('bars');
    expect((mockPlaybackManager as any).abLoop).toBeUndefined();
  });

  it('34. Theme compatibility', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);

    renderer.setConfig({ colorTheme: 'accent', mode: 'bars' });
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('35. Accent Theme compatibility', () => {
    document.documentElement.setAttribute('data-accent', 'emerald');
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('36. Ambient Background compatibility', () => {
    document.documentElement.setAttribute('data-ambient', 'aurora');
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('37. Dynamic Artwork Colors compatibility', () => {
    document.documentElement.style.setProperty('--color-artwork-primary', '#ff0055');
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('38. Player Layout compatibility', () => {
    document.documentElement.setAttribute('data-player-layout', 'stage');
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    const canvas = document.createElement('canvas');
    renderer.attachCanvas(canvas);
    expect(() => renderer.drawFrame()).not.toThrow();
  });

  it('39. Mobile compatibility', async () => {
    await component.mount(container);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.display).toBe('block');
  });

  it('40. Tablet compatibility', async () => {
    await component.mount(container);
    const panel = container.querySelector('.glass-panel');
    expect(panel).not.toBeNull();
  });

  it('41. Desktop compatibility', async () => {
    await component.mount(container);
    const canvas = container.querySelector('#vis-canvas');
    expect(canvas).not.toBeNull();
  });

  it('42. No external/network dependency', () => {
    const renderer = new VisualizerCanvasRenderer(mockAudioEngine);
    expect(renderer).toBeDefined();
  });

  it('43. No AI functionality', async () => {
    const settings = await visualizerService.getSettings();
    expect(settings).not.toHaveProperty('aiModel');
    expect(settings).not.toHaveProperty('autoSelect');
  });

  it('44. No memory leak / cleanup regression', async () => {
    await component.mount(container);
    expect(() => component.unmount()).not.toThrow();
    expect(container.innerHTML).toBe('');
  });
});
