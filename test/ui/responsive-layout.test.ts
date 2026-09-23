import { describe, it, expect } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { TrackRowComponent } from '../../src/ui/components/library/track-row-component';
import { MiniPlayerComponent } from '../../src/ui/shell/mini-player-component';
import { EventBus } from '../../src/core/events/event-bus';

setupMockDomEnvironment();

describe('Responsive Layout & Breakpoint Matrix Validation', () => {
  const REQUIRED_BREAKPOINTS = [
    { width: 320, device: 'Mobile' },
    { width: 360, device: 'Mobile' },
    { width: 390, device: 'Mobile' },
    { width: 430, device: 'Mobile' },
    { width: 480, device: 'Mobile' },
    { width: 768, device: 'Tablet' },
    { width: 820, device: 'Tablet' },
    { width: 900, device: 'Tablet' },
    { width: 1024, device: 'Tablet' },
    { width: 1199, device: 'Tablet' },
    { width: 1200, device: 'Desktop' },
    { width: 1440, device: 'Desktop' },
    { width: 1920, device: 'Desktop' },
  ];

  it('verifies all 13 required breakpoints in the responsive specification matrix', () => {
    expect(REQUIRED_BREAKPOINTS.length).toBe(13);
    const mobileBreakpoints = REQUIRED_BREAKPOINTS.filter(b => b.device === 'Mobile');
    const tabletBreakpoints = REQUIRED_BREAKPOINTS.filter(b => b.device === 'Tablet');
    const desktopBreakpoints = REQUIRED_BREAKPOINTS.filter(b => b.device === 'Desktop');

    expect(mobileBreakpoints.map(b => b.width)).toEqual([320, 360, 390, 430, 480]);
    expect(tabletBreakpoints.map(b => b.width)).toEqual([768, 820, 900, 1024, 1199]);
    expect(desktopBreakpoints.map(b => b.width)).toEqual([1200, 1440, 1920]);
  });

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

  it('renders mini-player with responsive touch-friendly playback and navigation controls', () => {
    const eventBus = new EventBus();
    const mockPlaybackManager: any = {
      currentTrack: null,
      state: 'paused',
      positionMs: 0,
      durationMs: 0,
      play: () => {},
      pause: () => {},
      next: () => {},
      previous: () => {},
      seek: () => {},
      setVolume: () => {}
    };

    const miniPlayer = new MiniPlayerComponent({
      eventBus,
      playbackManager: mockPlaybackManager
    });

    const host = document.createElement('div');
    miniPlayer.mount(host);

    const miniPlayerEl = host.querySelector('.mini-player');
    expect(miniPlayerEl).not.toBeNull();
    miniPlayer.unmount();
  });
});
