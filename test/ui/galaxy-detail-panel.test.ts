import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';

setupMockDomEnvironment();

import { GalaxyDetailPanel } from '../../src/ui/components/galaxy/galaxy-detail-panel';
import { EventBus } from '../../src/core/events/event-bus';
import type { GalaxyNode } from '../../src/domain/entities/galaxy-types';

describe('GalaxyDetailPanel', () => {
  let container: HTMLElement;
  let panel: GalaxyDetailPanel;
  let mockPlaybackManager: any;
  let mockLibraryService: any;
  let mockArtworkService: any;
  let eventBus: EventBus;
  let favoriteCallback: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = new EventBus();
    favoriteCallback = vi.fn();

    mockPlaybackManager = {
      playTrack: vi.fn().mockResolvedValue(undefined),
      addToQueue: vi.fn().mockResolvedValue(undefined)
    };

    mockLibraryService = {
      getTrack: vi.fn().mockResolvedValue({
        id: 't1',
        title: 'Song A',
        artistName: 'Artist A',
        albumTitle: 'Album A',
        durationMs: 180000,
        isFavorite: false
      }),
      listTracks: vi.fn().mockResolvedValue({
        items: [
          { id: 't1', title: 'Song A', artistName: 'Artist A', albumTitle: 'Album A', durationMs: 180000 }
        ],
        total: 1,
        offset: 0,
        limit: 50
      }),
      toggleFavorite: vi.fn().mockResolvedValue(true)
    };

    mockArtworkService = {
      getArtworkUrl: vi.fn().mockResolvedValue('blob:mock-artwork-url')
    };

    panel = new GalaxyDetailPanel({
      playbackManager: mockPlaybackManager,
      libraryService: mockLibraryService,
      artworkService: mockArtworkService,
      eventBus,
      onFavoriteToggled: favoriteCallback
    });

    panel.mount(container);
  });

  it('renders track node details with play, queue, and favorite buttons', async () => {
    const trackNode: GalaxyNode = {
      id: 'track:t1',
      type: 'track',
      entityId: 't1',
      label: 'Song A',
      x: 0,
      y: 0,
      radius: 12,
      color: '#10b981',
      lodMin: 3,
      lodMax: 4,
      metadata: {
        artistName: 'Artist A',
        albumTitle: 'Album A',
        durationMs: 180000,
        playCount: 10,
        isFavorite: false
      }
    };

    await panel.setNode(trackNode);

    const titleEl = container.querySelector('#galaxy-detail-title');
    expect(titleEl?.textContent?.trim()).toBe('Song A');

    const playBtn = container.querySelector<HTMLButtonElement>('#galaxy-detail-play');
    expect(playBtn).not.toBeNull();
    playBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    expect(mockPlaybackManager.playTrack).toHaveBeenCalled();

    const queueBtn = container.querySelector<HTMLButtonElement>('#galaxy-detail-queue');
    expect(queueBtn).not.toBeNull();
    queueBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    expect(mockPlaybackManager.addToQueue).toHaveBeenCalled();

    const favBtn = container.querySelector<HTMLButtonElement>('#galaxy-detail-favorite');
    expect(favBtn).not.toBeNull();
    favBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    expect(mockLibraryService.toggleFavorite).toHaveBeenCalledWith('t1');
  });

  it('renders artist node with albumList and trackList', async () => {
    const artistNode: GalaxyNode = {
      id: 'artist:a1',
      type: 'artist',
      entityId: 'a1',
      label: 'Radiohead',
      x: 0,
      y: 0,
      radius: 28,
      color: '#3b82f6',
      lodMin: 1,
      lodMax: 4,
      metadata: {
        albumCount: 2,
        trackCount: 15,
        albumList: [
          { id: 'al1', title: 'OK Computer', trackCount: 12 }
        ],
        trackList: [
          { id: 't1', title: 'Paranoid Android', durationMs: 380000 }
        ]
      }
    };

    await panel.setNode(artistNode);

    const titleEl = container.querySelector('#galaxy-detail-title');
    expect(titleEl?.textContent?.trim()).toBe('Radiohead');

    const trackRow = container.querySelector<HTMLElement>('.galaxy-detail-track-row');
    expect(trackRow).not.toBeNull();
  });
});
