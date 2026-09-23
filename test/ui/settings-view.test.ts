import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { SettingsView } from '../../src/ui/views/settings-view';
import { ThemeManager } from '../../src/ui/theme/theme-manager';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { ILibraryService, IScannerService, IPlaybackManager, IAudioSettingsService, IVisualizerService, IGalaxyService } from '../../src/services/contracts/service-contracts';
import { STORES } from '../../src/data/db/schema';

describe('SettingsView (Template 9 Visual & Functional Rebuild)', () => {
  let container: HTMLElement;
  let eventBus: EventBus;
  let mockLibraryService: Partial<ILibraryService>;
  let mockScannerService: Partial<IScannerService>;
  let mockPlaybackManager: Partial<IPlaybackManager>;
  let mockAudioSettingsService: Partial<IAudioSettingsService>;
  let mockVisualizerService: Partial<IVisualizerService>;
  let mockGalaxyService: Partial<IGalaxyService>;
  let mockDbAdapter: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();

    mockLibraryService = {
      getLibraryStats: vi.fn().mockResolvedValue({
        trackCount: 42,
        albumCount: 5,
        artistCount: 3
      })
    };

    mockScannerService = {
      isScanning: false,
      scanDirectory: vi.fn().mockResolvedValue(undefined),
      importFiles: vi.fn().mockResolvedValue({ filesDiscovered: 10, filesAdded: 10, filesUpdated: 0, filesMissing: 0, errors: [] })
    };

    mockPlaybackManager = {
      playbackRate: 1.0,
      repeatMode: 'off',
      shuffleMode: 'off',
      setPlaybackRate: vi.fn(),
      setRepeatMode: vi.fn(),
      setShuffleMode: vi.fn()
    };

    mockAudioSettingsService = {
      getSettings: vi.fn().mockResolvedValue({
        equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        preampGainDb: 0,
        replayGainMode: 'track',
        replayGainPreampDb: 0,
        customPresets: []
      }),
      saveSettings: vi.fn().mockResolvedValue({} as any),
      getBuiltInPresets: vi.fn().mockReturnValue([])
    };

    mockVisualizerService = {
      getSettings: vi.fn().mockResolvedValue({
        enabled: true,
        mode: 'bars',
        fpsLimit: 60
      }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      setMode: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue({} as any)
    };

    mockGalaxyService = {
      getSettings: vi.fn().mockResolvedValue({
        defaultLOD: 1,
        showPlaylists: true,
        showFolders: false
      }),
      saveSettings: vi.fn().mockResolvedValue({} as any)
    };

    mockDbAdapter = {
      get: vi.fn().mockImplementation((store, key) => {
        if (store === STORES.SETTINGS && key === 'music_directory_handle') {
          return Promise.resolve({ key, name: 'MyMusicFolder' });
        }
        return Promise.resolve(null);
      }),
      put: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(12)
    };
  });

  afterEach(() => {
    container.remove();
    const modal = document.querySelector('#settings-confirm-modal-overlay');
    if (modal) modal.remove();
  });

  it('mounts properly and renders all Template 9 sections', () => {
    const view = new SettingsView({
      libraryService: mockLibraryService as ILibraryService,
      scannerService: mockScannerService as IScannerService,
      playbackManager: mockPlaybackManager as IPlaybackManager,
      audioSettingsService: mockAudioSettingsService as IAudioSettingsService,
      visualizerService: mockVisualizerService as IVisualizerService,
      galaxyService: mockGalaxyService as IGalaxyService,
      dbAdapter: mockDbAdapter,
      eventBus
    });

    view.mount(container);

    expect(container.querySelector('.settings-hero-card')).not.toBeNull();
    expect(container.querySelector('#section-music-access')).not.toBeNull();
    expect(container.querySelector('#section-playback')).not.toBeNull();
    expect(container.querySelector('#section-appearance')).not.toBeNull();
    expect(container.querySelector('#section-visualizer')).not.toBeNull();
    expect(container.querySelector('#section-galaxy')).not.toBeNull();
    expect(container.querySelector('#section-storage')).not.toBeNull();
    expect(container.querySelector('#section-devices')).not.toBeNull();
    expect(container.querySelector('#section-privacy')).not.toBeNull();
    expect(container.querySelector('#section-about')).not.toBeNull();

    view.unmount();
  });

  it('updates theme preference via ThemeManager options', () => {
    const view = new SettingsView({ eventBus });
    view.mount(container);

    const themeManager = ThemeManager.getInstance();
    const lightOption = container.querySelector<HTMLElement>('[data-theme-val="light"]');
    expect(lightOption).not.toBeNull();

    lightOption?.click();
    expect(themeManager.getPreference()).toBe('light');

    const darkOption = container.querySelector<HTMLElement>('[data-theme-val="dark"]');
    darkOption?.click();
    expect(themeManager.getPreference()).toBe('dark');

    view.unmount();
  });

  it('updates playback controls correctly', () => {
    const view = new SettingsView({
      playbackManager: mockPlaybackManager as IPlaybackManager,
      eventBus
    });
    view.mount(container);

    const rateSelect = container.querySelector<HTMLSelectElement>('#settings-playback-rate');
    const repeatSelect = container.querySelector<HTMLSelectElement>('#settings-repeat-mode');
    const shuffleSelect = container.querySelector<HTMLSelectElement>('#settings-shuffle-mode');

    if (rateSelect) {
      rateSelect.value = '1.5';
      rateSelect.dispatchEvent(new Event('change'));
      expect(mockPlaybackManager.setPlaybackRate).toHaveBeenCalledWith(1.5);
    }

    if (repeatSelect) {
      repeatSelect.value = 'all';
      repeatSelect.dispatchEvent(new Event('change'));
      expect(mockPlaybackManager.setRepeatMode).toHaveBeenCalledWith('all');
    }

    if (shuffleSelect) {
      shuffleSelect.value = 'all';
      shuffleSelect.dispatchEvent(new Event('change'));
      expect(mockPlaybackManager.setShuffleMode).toHaveBeenCalledWith('all');
    }

    view.unmount();
  });

  it('reacts to real scanner progress and completed events from EventBus', async () => {
    const view = new SettingsView({
      scannerService: mockScannerService as IScannerService,
      libraryService: mockLibraryService as ILibraryService,
      eventBus
    });
    view.mount(container);

    const progressBox = container.querySelector<HTMLElement>('#settings-scan-progress-box');
    expect(progressBox?.style.display).toBe('none');

    // Emit SCAN_PROGRESS
    eventBus.publish(DomainEvents.SCAN_PROGRESS, {
      sessionId: 'test_123',
      rootPath: 'folder://Music',
      state: 'scanning',
      currentFile: 'Track01.flac',
      filesDiscovered: 100,
      filesProcessed: 40,
      filesAdded: 40,
      filesUpdated: 0,
      filesMissing: 0,
      isComplete: false
    });

    expect(progressBox?.style.display).toBe('flex');
    const countEl = container.querySelector<HTMLElement>('#settings-scan-progress-count');
    expect(countEl?.textContent).toContain('40 / 100 files');

    // Emit LIBRARY_UPDATED
    eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
      tracksAdded: 40,
      tracksUpdated: 0,
      tracksRemoved: 0,
      timestamp: Date.now()
    });

    expect(mockLibraryService.getLibraryStats).toHaveBeenCalled();

    view.unmount();
  });

  it('displays accessible confirmation modal for destructive reset actions', () => {
    const view = new SettingsView({
      dbAdapter: mockDbAdapter,
      eventBus
    });
    view.mount(container);

    const resetBtn = container.querySelector<HTMLButtonElement>('#settings-btn-reset-db');
    expect(resetBtn).not.toBeNull();
    resetBtn?.click();

    const modal = document.querySelector('#settings-confirm-modal-overlay');
    expect(modal).not.toBeNull();
    expect(modal?.getAttribute('role')).toBe('dialog');
    expect(modal?.getAttribute('aria-modal')).toBe('true');

    const cancelBtn = modal?.querySelector<HTMLButtonElement>('#settings-modal-cancel-btn');
    cancelBtn?.click();
    expect(document.querySelector('#settings-confirm-modal-overlay')).toBeNull();

    view.unmount();
  });

  it('switches sub-navigation tabs cleanly and updates active states', () => {
    const view = new SettingsView({ eventBus });
    view.mount(container);

    const appearanceTab = container.querySelector<HTMLButtonElement>('#tab-appearance');
    expect(appearanceTab).not.toBeNull();
    appearanceTab?.click();

    expect(appearanceTab?.classList.contains('active')).toBe(true);
    expect(appearanceTab?.getAttribute('aria-selected')).toBe('true');

    view.unmount();
  });
});
