import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { AlbumMergeModal } from '../../src/ui/components/library/album-merge-modal';
import type { AlbumMergeCandidateGroup, AlbumMergePreview, AlbumMergeResult } from '../../src/domain/entities/album-merge-types';

setupMockDomEnvironment();

describe('AlbumMergeModal UI Component', () => {
  let mockMergeService: any;
  let modal: AlbumMergeModal;

  const sampleCandidateGroup: AlbumMergeCandidateGroup = {
    key: 'meteora:::linkin park',
    canonicalAlbumId: 'alb_1',
    albums: [
      { id: 'alb_1', title: 'Meteora', artistName: 'Linkin Park', trackCount: 10, durationMs: 2000000, isCompilation: false, dateAdded: 100 },
      { id: 'alb_2', title: ' meteora ', artistName: 'Linkin Park', trackCount: 3, durationMs: 600000, isCompilation: false, dateAdded: 200 }
    ],
    totalTracks: 13,
    totalDurationMs: 2600000,
    confidence: 'high',
    matchReason: 'Case, punctuation, or whitespace variations in album title.'
  };

  const samplePreview: AlbumMergePreview = {
    canonicalAlbum: sampleCandidateGroup.albums[0]!,
    mergedAlbums: [sampleCandidateGroup.albums[1]!],
    affectedTracks: [
      { id: 't1', title: 'Numb', albumId: 'alb_1', albumTitle: 'Meteora', durationMs: 180000 } as any,
      { id: 't2', title: 'Faint', albumId: 'alb_2', albumTitle: ' meteora ', durationMs: 200000 } as any
    ],
    totalResultingTracks: 2,
    totalResultingDurationMs: 380000,
    warnings: []
  };

  const sampleMergeResult: AlbumMergeResult = {
    success: true,
    canonicalAlbum: sampleCandidateGroup.albums[0]!,
    mergedAlbumIds: ['alb_2'],
    affectedTrackCount: 1,
    updatedTrackIds: ['t2'],
    timestamp: Date.now()
  };

  beforeEach(() => {
    mockMergeService = {
      findMergeCandidates: vi.fn().mockResolvedValue([sampleCandidateGroup]),
      getMergePreview: vi.fn().mockResolvedValue(samplePreview),
      executeMerge: vi.fn().mockResolvedValue(sampleMergeResult)
    };
  });

  afterEach(() => {
    if (modal) {
      modal.unmount();
    }
  });

  it('should render header and detected merge candidate groups', async () => {
    modal = AlbumMergeModal.show({
      albumMergeService: mockMergeService
    });

    await modal.loadCandidates();

    const overlay = document.querySelector('#album-merge-modal-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('Album Merging & Consolidation');
    expect(overlay?.textContent).toContain('Meteora');
    expect(overlay?.textContent).toContain('Linkin Park');
    expect(overlay?.textContent).toContain('Review & Merge');
  });

  it('should switch to review preview step when Review button is clicked', async () => {
    modal = AlbumMergeModal.show({
      albumMergeService: mockMergeService
    });

    await modal.loadCandidates();

    const reviewBtn = document.querySelector<HTMLButtonElement>('.album-merge-btn-review');
    expect(reviewBtn).not.toBeNull();
    reviewBtn?.click();

    // Allow promise tick
    await new Promise(r => setTimeout(r, 10));

    expect(mockMergeService.getMergePreview).toHaveBeenCalledWith(['alb_1', 'alb_2'], 'alb_1');
    const overlay = document.querySelector('#album-merge-modal-overlay');
    expect(overlay?.textContent).toContain('1. Select Canonical Album');
    expect(overlay?.textContent).toContain('Confirm & Merge Albums');
    expect(overlay?.textContent).toContain('Numb');
    expect(overlay?.textContent).toContain('Faint');
  });

  it('should execute merge when Confirm button is clicked', async () => {
    modal = AlbumMergeModal.show({
      albumMergeService: mockMergeService
    });

    await modal.loadCandidates();

    const reviewBtn = document.querySelector<HTMLButtonElement>('.album-merge-btn-review');
    reviewBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    const confirmBtn = document.querySelector<HTMLButtonElement>('#album-merge-btn-confirm');
    expect(confirmBtn).not.toBeNull();
    confirmBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(mockMergeService.executeMerge).toHaveBeenCalledWith(['alb_1', 'alb_2'], 'alb_1');
  });

  it('should unmount cleanly and remove overlay element from DOM', () => {
    modal = AlbumMergeModal.show({
      albumMergeService: mockMergeService
    });

    expect(document.querySelector('#album-merge-modal-overlay')).not.toBeNull();
    modal.unmount();
    expect(document.querySelector('#album-merge-modal-overlay')).toBeNull();
  });
});
