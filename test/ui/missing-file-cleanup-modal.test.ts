import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { MissingFileCleanupModalComponent } from '../../src/ui/components/library/missing-file-cleanup-modal';
import type { IMissingFileScannerService } from '../../src/services/contracts/service-contracts';
import type { MissingFileScanSummary, CleanupResult } from '../../src/domain/entities/cleanup-types';

setupMockDomEnvironment();

describe('MissingFileCleanupModalComponent', () => {
  let mockCleanupService: IMissingFileScannerService;
  let container: HTMLElement;
  let onClose: () => void;
  let onCompleted: () => void;
  let modal: MissingFileCleanupModalComponent;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    onClose = vi.fn();
    onCompleted = vi.fn();

    mockCleanupService = {
      scanMissingFiles: vi.fn().mockResolvedValue({
        totalChecked: 10,
        availableCount: 8,
        missingCount: 2,
        unverifiableCount: 0,
        unsupportedCount: 0,
        missingTracks: [
          {
            trackId: 't1',
            audioFileId: 'f1',
            trackTitle: 'Lost Track 1',
            artistName: 'Artist A',
            albumTitle: 'Album 1',
            path: 'C:/Music/lost1.mp3',
            status: 'missing'
          },
          {
            trackId: 't2',
            audioFileId: 'f2',
            trackTitle: 'Lost Track 2',
            artistName: 'Artist B',
            albumTitle: 'Album 2',
            path: 'C:/Music/lost2.mp3',
            status: 'missing'
          }
        ],
        unverifiableTracks: [],
        durationMs: 45
      } as MissingFileScanSummary),
      cleanupMissingTracks: vi.fn().mockResolvedValue({
        removedTrackCount: 2,
        removedFileCount: 2,
        trackIds: ['t1', 't2']
      } as CleanupResult)
    };

    modal = new MissingFileCleanupModalComponent({
      cleanupService: mockCleanupService,
      onClose,
      onCompleted
    });
  });

  afterEach(() => {
    modal.unmount();
    document.body.innerHTML = '';
  });

  it('mounts into DOM and renders idle state with Scan button', () => {
    modal.mount(container);
    const backdrop = document.getElementById('missing-file-cleanup-modal-backdrop');
    expect(backdrop).not.toBeNull();

    const scanBtn = backdrop?.querySelector('#cleanup-start-scan-btn');
    expect(scanBtn).not.toBeNull();
    expect(scanBtn?.textContent).toContain('Scan Library for Missing Files');
  });

  it('triggers scan and displays scan results with missing tracks', async () => {
    modal.mount(container);
    const backdrop = document.getElementById('missing-file-cleanup-modal-backdrop')!;
    const scanBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-start-scan-btn')!;

    scanBtn.click();
    await new Promise(r => setTimeout(r, 20));

    expect(mockCleanupService.scanMissingFiles).toHaveBeenCalled();
    expect(backdrop.textContent).toContain('Lost Track 1');
    expect(backdrop.textContent).toContain('Lost Track 2');
    expect(backdrop.textContent).toContain('Remove Selected (2)');
  });

  it('allows selecting and deselecting missing tracks', async () => {
    modal.mount(container);
    const backdrop = document.getElementById('missing-file-cleanup-modal-backdrop')!;
    backdrop.querySelector<HTMLButtonElement>('#cleanup-start-scan-btn')!.click();
    await new Promise(r => setTimeout(r, 20));

    const deselectBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-deselect-all-btn')!;
    deselectBtn.click();

    const proceedBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-proceed-btn');
    expect(proceedBtn?.getAttribute('disabled')).not.toBeNull();

    const selectAllBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-select-all-btn')!;
    selectAllBtn.click();

    const proceedBtnActive = backdrop.querySelector<HTMLButtonElement>('#cleanup-proceed-btn');
    expect(proceedBtnActive?.getAttribute('disabled')).toBeNull();
  });

  it('shows confirmation dialog before cleaning up records', async () => {
    modal.mount(container);
    const backdrop = document.getElementById('missing-file-cleanup-modal-backdrop')!;
    backdrop.querySelector<HTMLButtonElement>('#cleanup-start-scan-btn')!.click();
    await new Promise(r => setTimeout(r, 20));

    const proceedBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-proceed-btn')!;
    proceedBtn.click();

    expect(backdrop.textContent).toContain('Confirm Library Cleanup');
    expect(backdrop.textContent).toContain('Your actual physical files on disk will NEVER be deleted');

    const executeBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-execute-btn')!;
    executeBtn.click();
    await new Promise(r => setTimeout(r, 100));

    expect(mockCleanupService.cleanupMissingTracks).toHaveBeenCalledWith(['t1', 't2']);
    expect(backdrop.textContent).toContain('Library Cleaned Successfully!');
    expect(onCompleted).toHaveBeenCalled();
  });

  it('closes and unmounts cleanly when close button is clicked', () => {
    modal.mount(container);
    const backdrop = document.getElementById('missing-file-cleanup-modal-backdrop')!;
    const closeBtn = backdrop.querySelector<HTMLButtonElement>('#cleanup-close-btn')!;

    closeBtn.click();
    expect(onClose).toHaveBeenCalled();
    expect(document.getElementById('missing-file-cleanup-modal-backdrop')).toBeNull();
  });
});
