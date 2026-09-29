import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { RemoveTrackConfirmModal } from '../../src/ui/components/library/remove-track-confirm-modal';
import type { Track } from '../../src/domain/entities/models';

describe('RemoveTrackConfirmModal', () => {
  const sampleTrack: Track = {
    id: 'track_123',
    fileId: 'file_123',
    title: 'Midnight Resonance',
    artistName: 'SynthWave Artist',
    albumTitle: 'Neon Cosmos',
    durationMs: 240000,
    format: { container: 'flac', codec: 'flac', sampleRate: 96000, bitDepth: 24, channels: 2, isLossless: true },
    dateAdded: Date.now(),
    dateModified: Date.now(),
    playCount: 12,
    isFavorite: true,
    hasLyrics: false,
    availability: 'available'
  };

  let mockLibraryService: any;
  let mockPlaybackManager: any;

  beforeEach(() => {
    mockLibraryService = {
      removeTrackFromLibrary: vi.fn().mockResolvedValue(true)
    };

    mockPlaybackManager = {
      currentTrack: null,
      next: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('renders confirmation dialog with safety message explaining audio file is preserved', async () => {
    const onRemoved = vi.fn();
    const onCancel = vi.fn();

    const overlay = await RemoveTrackConfirmModal.show({
      track: sampleTrack,
      libraryService: mockLibraryService,
      playbackManager: mockPlaybackManager,
      onRemoved,
      onCancel
    });

    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('Remove from Library');
    expect(overlay.textContent).toContain('Midnight Resonance');
    expect(overlay.textContent).toContain('The audio file will NOT be deleted from your computer');

    const cancelBtn = overlay.querySelector<HTMLButtonElement>('#remove-modal-cancel-btn');
    expect(cancelBtn).not.toBeNull();
    cancelBtn?.click();

    expect(onCancel).toHaveBeenCalled();
    expect(mockLibraryService.removeTrackFromLibrary).not.toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('calls removeTrackFromLibrary and handles active playing track when confirmed', async () => {
    mockPlaybackManager.currentTrack = sampleTrack;
    const onRemoved = vi.fn();

    const overlay = await RemoveTrackConfirmModal.show({
      track: sampleTrack,
      libraryService: mockLibraryService,
      playbackManager: mockPlaybackManager,
      onRemoved
    });

    const confirmBtn = overlay.querySelector<HTMLButtonElement>('#remove-modal-confirm-btn');
    expect(confirmBtn).not.toBeNull();
    confirmBtn?.click();

    // Allow async handlers to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify safe playback transition
    expect(mockPlaybackManager.next).toHaveBeenCalled();

    // Verify DB deletion was called
    expect(mockLibraryService.removeTrackFromLibrary).toHaveBeenCalledWith('track_123');
    expect(onRemoved).toHaveBeenCalled();
  });
});
