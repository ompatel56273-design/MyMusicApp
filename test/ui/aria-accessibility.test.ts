import { describe, it, expect, beforeEach } from 'vitest';
import { setupMockDomEnvironment } from '../helpers/mock-dom';
import { MiniPlayerComponent } from '../../src/ui/shell/mini-player-component';
import { AppShell } from '../../src/ui/shell/app-shell';
import { EventBus } from '../../src/core/events/event-bus';

setupMockDomEnvironment();

describe('ARIA & Screen Reader Accessibility Hardening', () => {
  let eventBus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    eventBus = new EventBus();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('sets dynamic aria-label and aria-pressed states on MiniPlayer controls', () => {
    const mockPlaybackManager: any = {
      state: 'playing',
      currentTrack: { id: 'track_1', title: 'Bohemian Rhapsody', artistName: 'Queen' },
      positionMs: 5000,
      durationMs: 350000,
      volume: 0.9,
      isMuted: false,
      shuffleMode: 'off',
      repeatMode: 'off'
    };

    const miniPlayer = new MiniPlayerComponent({
      playbackManager: mockPlaybackManager,
      eventBus
    });

    miniPlayer.mount(container);

    const playBtn = container.querySelector<HTMLButtonElement>('#mini-play-btn');
    expect(playBtn).not.toBeNull();
    expect(playBtn?.getAttribute('aria-label')).toBe('Pause track');
    expect(playBtn?.getAttribute('aria-pressed')).toBe('true');

    const muteBtn = container.querySelector<HTMLButtonElement>('#mini-mute-btn');
    expect(muteBtn?.getAttribute('aria-label')).toBe('Mute');
    expect(muteBtn?.getAttribute('aria-pressed')).toBe('false');

    miniPlayer.unmount();
  });

  it('updates AppShell aria-live polite announcer when playback state changes', async () => {
    const mockPlaybackManager: any = {
      state: 'stopped',
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      isMuted: false,
      shuffleMode: 'off',
      repeatMode: 'off'
    };

    const appShell = new AppShell({
      playbackManager: mockPlaybackManager,
      libraryService: { getSongs: async () => [] } as any,
      searchService: { search: async () => ({ tracks: [], albums: [], artists: [] }) } as any,
      eventBus
    });

    appShell.mount(container);

    const announcer = container.querySelector<HTMLElement>('#shell-live-announcer');
    expect(announcer).not.toBeNull();
    expect(announcer?.getAttribute('aria-live')).toBe('polite');

    eventBus.publish('playback:state-changed', {
      state: 'playing',
      track: { id: 't1', title: 'Stairway to Heaven', artistName: 'Led Zeppelin' }
    });

    expect(announcer?.textContent).toBe('Now playing Stairway to Heaven by Led Zeppelin');

    appShell.unmount();
  });
});
