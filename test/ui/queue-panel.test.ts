import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { QueuePanelComponent } from '../../src/ui/components/player/queue-panel-component';
import type { Track } from '../../src/domain/entities/models';

setupMockDomEnvironment();

describe('QueuePanelComponent', () => {
  let container: HTMLElement;
  let mockPlaybackManager: any;
  let mockArtworkService: any;
  let queuePanel: QueuePanelComponent;

  const mockTracks: Track[] = [
    {
      id: 'q_t1',
      fileId: 'f1',
      title: 'Time',
      artistName: 'Pink Floyd',
      albumTitle: 'The Dark Side of the Moon',
      durationMs: 425000,
      format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
      dateAdded: 1000,
      dateModified: 1000,
      playCount: 50,
      isFavorite: true,
      hasLyrics: false,
      availability: 'available'
    },
    {
      id: 'q_t2',
      fileId: 'f2',
      title: 'Money',
      artistName: 'Pink Floyd',
      albumTitle: 'The Dark Side of the Moon',
      durationMs: 382000,
      format: { container: 'flac', codec: 'flac', sampleRate: 44100, channels: 2, isLossless: true },
      dateAdded: 2000,
      dateModified: 2000,
      playCount: 60,
      isFavorite: false,
      hasLyrics: false,
      availability: 'available'
    }
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockPlaybackManager = {
      queue: [
        { id: 'item_1', trackId: 'q_t1', position: 0, addedReason: 'user' },
        { id: 'item_2', trackId: 'q_t2', position: 1, addedReason: 'user' }
      ],
      currentQueueIndex: 0,
      getTracks: () => mockTracks,
      playQueueIndex: vi.fn().mockResolvedValue(undefined),
      removeFromQueue: vi.fn().mockResolvedValue(undefined),
      reorderQueue: vi.fn().mockResolvedValue(undefined),
      clearQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockArtworkService = {
      getArtworkUrl: vi.fn().mockResolvedValue(null)
    };

    queuePanel = new QueuePanelComponent(mockPlaybackManager, mockArtworkService);
    queuePanel.mount(container);
  });

  afterEach(() => {
    queuePanel.unmount();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should render play queue items with active highlight and duration', () => {
    const items = container.querySelectorAll('.queue-item-row');
    expect(items.length).toBe(2);

    const firstItem = items[0];
    expect(firstItem?.className).toContain('queue-item-active');
  });

  it('should invoke playQueueIndex when clicking an item row', () => {
    const items = container.querySelectorAll<HTMLElement>('.queue-item-row');
    items[1]?.click();
    expect(mockPlaybackManager.playQueueIndex).toHaveBeenCalledWith(1);
  });

  it('should invoke removeFromQueue when clicking remove button', () => {
    const removeBtn = container.querySelector<HTMLElement>('.queue-remove-btn');
    removeBtn?.click();
    expect(mockPlaybackManager.removeFromQueue).toHaveBeenCalledWith(0);
  });

  it('should invoke reorderQueue when clicking move buttons', () => {
    const downBtn = container.querySelector<HTMLElement>('.queue-move-down-btn');
    downBtn?.click();
    expect(mockPlaybackManager.reorderQueue).toHaveBeenCalledWith(0, 1);
  });

  it('should invoke clearQueue when clicking clear button', () => {
    const clearBtn = container.querySelector<HTMLElement>('#queue-clear-btn');
    clearBtn?.click();
    expect(mockPlaybackManager.clearQueue).toHaveBeenCalled();
  });
});
