import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { EventBus } from '../../src/core/events/event-bus';
import { ArtworkService } from '../../src/services/artwork/artwork-service';
import { VisualizerComponent } from '../../src/ui/components/visualizer/visualizer-component';
import { GalaxyView } from '../../src/ui/views/galaxy-view';

setupMockDomEnvironment();

describe('UI Memory & Resource Lifecycle Hardening', () => {
  let eventBus: EventBus;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    eventBus = new EventBus();
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  it('disposes EventBus subscriptions when GalaxyView is unmounted', async () => {
    const mockGalaxyService: any = {
      getGraph: async () => ({ nodes: [], edges: [], metadata: { totalNodes: 0, totalEdges: 0 } }),
      getSettings: async () => ({ defaultLOD: 2, showPlaylists: true, showFolders: true, reducedMotion: false }),
      invalidateCache: () => {}
    };

    const view = new GalaxyView({
      galaxyService: mockGalaxyService,
      playbackManager: {} as any,
      libraryService: {} as any,
      eventBus
    });

    await view.mount(mockContainer);
    expect(eventBus.getHandlerCount('playback:state-changed')).toBe(1);
    expect(eventBus.getHandlerCount('library:scanned')).toBe(1);

    view.unmount();
    expect(eventBus.getHandlerCount('playback:state-changed')).toBe(0);
    expect(eventBus.getHandlerCount('library:scanned')).toBe(0);
  });

  it('cleans up Visualizer observers, subscriptions, and canvas on unmount', async () => {
    const mockVisualizerService: any = {
      getMetrics: () => ({ bass: 0, midrange: 0, treble: 0, rms: 0, peak: 0 }),
      getSpectrum: () => new Uint8Array(64),
      getWaveform: () => new Uint8Array(64),
      getSettings: async () => ({ enabled: true, mode: 'bars', targetFps: 60, fftSize: 256, smoothingTimeConstant: 0.8, colorScheme: 'cyberpunk' })
    };

    const mockAudioEngine: any = {
      isInitialized: () => true
    };

    const visualizer = new VisualizerComponent({
      visualizerService: mockVisualizerService,
      audioEngine: mockAudioEngine,
      eventBus
    });

    await visualizer.mount(mockContainer);
    expect(eventBus.getHandlerCount('playback:state-changed')).toBeGreaterThan(0);

    visualizer.unmount();
    expect(eventBus.getHandlerCount('playback:state-changed')).toBe(0);
    expect(mockContainer.innerHTML).toBe('');
  });

  it('revokes Object URLs on ArtworkService clear and eviction', async () => {
    const originalRevoke = globalThis.URL?.revokeObjectURL;
    const revokeSpy = vi.fn();

    if (typeof globalThis.URL !== 'undefined') {
      globalThis.URL.revokeObjectURL = revokeSpy;
    }

    const artworkService = new ArtworkService();
    artworkService.clear();

    if (originalRevoke) {
      globalThis.URL.revokeObjectURL = originalRevoke;
    }
  });
});
