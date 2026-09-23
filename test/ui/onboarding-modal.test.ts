import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { LocalMusicOnboardingModal } from '../../src/ui/components/onboarding/local-music-onboarding-modal';
import { EventBus } from '../../src/core/events/event-bus';
import { DomainEvents } from '../../src/domain/events/domain-events';
import type { IScannerService, ILibraryService } from '../../src/services/contracts/service-contracts';
import { STORES } from '../../src/data/db/schema';

describe('LocalMusicOnboardingModal (Phase 13 Multi-Step Onboarding)', () => {
  let eventBus: EventBus;
  let mockScannerService: Partial<IScannerService>;
  let mockFsAdapter: any;
  let mockDbAdapter: any;
  let mockLibraryService: Partial<ILibraryService>;
  let mockRouter: any;

  beforeEach(() => {
    eventBus = new EventBus();

    mockScannerService = {
      isScanning: false,
      scanDirectory: vi.fn().mockResolvedValue(undefined),
      importFiles: vi.fn().mockResolvedValue({
        filesDiscovered: 15,
        filesAdded: 15,
        filesUpdated: 0,
        filesMissing: 0,
        errors: []
      })
    };

    mockFsAdapter = {
      registerDirectoryHandle: vi.fn(),
      getDirectoryHandle: vi.fn()
    };

    mockDbAdapter = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null)
    };

    mockLibraryService = {
      getLibraryStats: vi.fn().mockResolvedValue({
        trackCount: 42,
        albumCount: 5,
        artistCount: 3
      })
    };

    mockRouter = {
      navigate: vi.fn()
    };

    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
  });

  afterEach(() => {
    const modal = document.querySelector('#onboarding-modal-overlay');
    if (modal) modal.remove();
  });

  it('renders Step 1 (Welcome) and advances to Step 2 (Local Music Access)', () => {
    const modal = new LocalMusicOnboardingModal({
      scannerService: mockScannerService as IScannerService,
      fsAdapter: mockFsAdapter,
      dbAdapter: mockDbAdapter,
      libraryService: mockLibraryService as ILibraryService,
      router: mockRouter,
      eventBus
    });

    modal.show();

    const overlay = document.querySelector('#onboarding-modal-overlay');
    expect(overlay).not.toBeNull();
    expect(modal.getStep()).toBe(1);
    expect(overlay?.textContent).toContain('Welcome to MyMusicApp');

    const nextBtn = overlay?.querySelector<HTMLButtonElement>('#btn-onboarding-next');
    expect(nextBtn).not.toBeNull();
    nextBtn?.click();

    expect(modal.getStep()).toBe(2);
    expect(overlay?.textContent).toContain('Local-First Architecture');

    modal.close();
  });

  it('advances from Step 2 to Step 3 (Select Music Folder)', () => {
    const modal = new LocalMusicOnboardingModal({
      scannerService: mockScannerService as IScannerService,
      fsAdapter: mockFsAdapter,
      dbAdapter: mockDbAdapter,
      libraryService: mockLibraryService as ILibraryService,
      router: mockRouter,
      eventBus
    });

    modal.show(2);
    expect(modal.getStep()).toBe(2);

    const overlay = document.querySelector('#onboarding-modal-overlay');
    const nextBtn = overlay?.querySelector<HTMLButtonElement>('#btn-onboarding-next');
    nextBtn?.click();

    expect(modal.getStep()).toBe(3);
    expect(overlay?.textContent).toContain('Select Your Music Folder');

    modal.close();
  });

  it('reacts to real scanner progress and advances to Step 5 (Library Ready) upon scan completion', async () => {
    const modal = new LocalMusicOnboardingModal({
      scannerService: mockScannerService as IScannerService,
      fsAdapter: mockFsAdapter,
      dbAdapter: mockDbAdapter,
      libraryService: mockLibraryService as ILibraryService,
      router: mockRouter,
      eventBus
    });

    modal.show(4);
    expect(modal.getStep()).toBe(4);

    // Emit SCAN_PROGRESS
    eventBus.publish(DomainEvents.SCAN_PROGRESS, {
      sessionId: 'sess_1',
      rootPath: 'folder://Music',
      state: 'scanning',
      currentFile: 'Artist/Album/01_Song.flac',
      filesDiscovered: 50,
      filesProcessed: 25,
      filesAdded: 25,
      filesUpdated: 0,
      filesMissing: 0,
      isComplete: false
    });

    const overlay = document.querySelector('#onboarding-modal-overlay');
    expect(overlay?.textContent).toContain('25 / 50 files');

    // Emit LIBRARY_UPDATED -> transitions to Step 5
    eventBus.publish(DomainEvents.LIBRARY_UPDATED, {
      tracksAdded: 50,
      tracksUpdated: 0,
      tracksRemoved: 0,
      timestamp: Date.now()
    });

    // Await async library stats fetch
    await new Promise(r => setTimeout(r, 10));

    expect(modal.getStep()).toBe(5);
    expect(overlay?.textContent).toContain('Library is Ready!');
    expect(mockLibraryService.getLibraryStats).toHaveBeenCalled();

    modal.close();
  });

  it('sets completion persistence flags in localStorage and IndexedDB when closed', () => {
    const modal = new LocalMusicOnboardingModal({
      scannerService: mockScannerService as IScannerService,
      fsAdapter: mockFsAdapter,
      dbAdapter: mockDbAdapter,
      libraryService: mockLibraryService as ILibraryService,
      router: mockRouter,
      eventBus
    });

    modal.show(1);
    modal.close();

    expect(localStorage.getItem('mymusic_onboarding_dismissed')).toBe('true');
    expect(localStorage.getItem('mymusic_onboarding_completed')).toBe('true');
    expect(mockDbAdapter.put).toHaveBeenCalledWith(
      STORES.SETTINGS,
      expect.objectContaining({ key: 'onboarding_state', completed: true })
    );
  });
});
