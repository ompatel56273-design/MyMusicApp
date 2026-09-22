import { describe, it, expect } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { TrackRowComponent } from '../../src/ui/components/library/track-row-component';

setupMockDomEnvironment();

describe('Responsive Layout & Touch Target Hardening', () => {
  it('enforces minimum 44px touch targets on interactive track row actions', () => {
    const mockTrack: any = {
      id: 't_res_1',
      title: 'Long Responsive Song Title',
      artistName: 'Responsive Artist',
      albumTitle: 'Responsive Album',
      durationMs: 180000,
      isFavorite: false,
      availability: 'available'
    };

    const row = TrackRowComponent.create(mockTrack, 0, {
      onPlay: () => {},
      onToggleFavorite: () => {},
      onAddToPlaylist: () => {}
    });

    const favBtn = row.querySelector<HTMLButtonElement>('.track-fav-btn');
    const addBtn = row.querySelector<HTMLButtonElement>('.track-add-playlist-btn');

    expect(favBtn).not.toBeNull();
    expect(addBtn).not.toBeNull();

    expect(favBtn?.style.minWidth).toBe('44px');
    expect(favBtn?.style.minHeight).toBe('44px');
    expect(addBtn?.style.minWidth).toBe('44px');
    expect(addBtn?.style.minHeight).toBe('44px');
  });

  it('attaches full metadata title attributes for truncated metadata inspection', () => {
    const mockTrack: any = {
      id: 't_res_2',
      title: 'Very Long Truncated Track Title That Might Exceed Container Bounds',
      artistName: 'Very Long Artist Name That Might Exceed Bounds',
      albumTitle: 'Very Long Album Title That Might Exceed Bounds',
      durationMs: 240000,
      isFavorite: true,
      availability: 'available'
    };

    const row = TrackRowComponent.create(mockTrack, 1, {
      onPlay: () => {},
      onToggleFavorite: () => {}
    });

    const titleSpan = row.querySelector('.track-title-text');
    expect(titleSpan?.getAttribute('title')).toBe('Very Long Truncated Track Title That Might Exceed Container Bounds');
  });
});
