import { describe, it, expect } from 'vitest';
import {
  renderButton,
  renderBadge,
  renderCard,
  renderSectionHeader,
  renderAvatar,
  renderArtwork,
  renderSlider,
  renderToggle,
  renderSelect,
  renderTabs,
  renderSearchInput,
  renderDivider,
  renderTooltip,
  renderDropdownMenu,
  renderModal,
  renderBottomSheet,
  renderSkeleton,
  renderEmptyState,
  renderLoadingState,
  renderTrackRowPresentation
} from '../../src/ui/primitives';

describe('UI Primitives Presentation Suite', () => {
  it('should render Button with various variants and accessibility attributes', () => {
    const btnPrimary = renderButton({
      id: 'test-btn',
      label: 'Play',
      icon: 'play',
      variant: 'primary',
      size: 'lg'
    });
    expect(btnPrimary).toContain('id="test-btn"');
    expect(btnPrimary).toContain('btn-primary');
    expect(btnPrimary).toContain('btn-lg');
    expect(btnPrimary).toContain('Play');

    const btnDisabled = renderButton({
      label: 'Disabled',
      disabled: true
    });
    expect(btnDisabled).toContain('disabled');
    expect(btnDisabled).toContain('aria-disabled="true"');
  });

  it('should render Badges correctly', () => {
    const badge = renderBadge({ label: 'Chill', variant: 'purple', icon: 'sparkles' });
    expect(badge).toContain('badge-purple');
    expect(badge).toContain('Chill');

    const hiRes = renderBadge({ label: '', variant: 'hi-res' });
    expect(hiRes).toContain('badge-hi-res');
    expect(hiRes).toContain('Hi-Res');
  });

  it('should render Cards correctly', () => {
    const card = renderCard({
      id: 'my-card',
      variant: 'glass',
      content: '<p>Hello</p>'
    });
    expect(card).toContain('id="my-card"');
    expect(card).toContain('card-glass');
    expect(card).toContain('<p>Hello</p>');
  });

  it('should render Section Header with actions', () => {
    const header = renderSectionHeader({
      title: 'Recently Played',
      subtitle: 'Your latest tunes',
      seeAllActionId: 'see-all-recent'
    });
    expect(header).toContain('Recently Played');
    expect(header).toContain('Your latest tunes');
    expect(header).toContain('id="see-all-recent"');
  });

  it('should render Avatar with initials or image', () => {
    const avatarInit = renderAvatar({ name: 'Om Patel', size: 'md' });
    expect(avatarInit).toContain('avatar-md');
    expect(avatarInit).toContain('O');

    const avatarArtist = renderAvatar({ name: 'The Weeknd', isArtist: true });
    expect(avatarArtist).toContain('avatar-circle');
  });

  it('should render Artwork with fallback and vinyl variations', () => {
    const artwork = renderArtwork({ title: 'Blinding Lights', size: 'md', showPlayOverlay: true });
    expect(artwork).toContain('artwork-md');
    expect(artwork).toContain('artwork-play-overlay');

    const vinyl = renderArtwork({ title: 'After Hours', size: 'vinyl' });
    expect(vinyl).toContain('artwork-vinyl-container');
    expect(vinyl).toContain('vinyl-disc');
  });

  it('should render Sliders, Toggles, Selects, and Tabs', () => {
    const slider = renderSlider({ id: 'vol-slider', ariaLabel: 'Volume', value: 80 });
    expect(slider).toContain('id="vol-slider"');
    expect(slider).toContain('value="80"');

    const toggle = renderToggle({ id: 'eq-toggle', ariaLabel: 'Enable EQ', label: 'Equalizer', checked: true });
    expect(toggle).toContain('id="eq-toggle"');
    expect(toggle).toContain('checked');
    expect(toggle).toContain('Equalizer');

    const select = renderSelect({
      id: 'genre-select',
      ariaLabel: 'Filter by Genre',
      options: [
        { value: 'all', label: 'All Genres', selected: true },
        { value: 'pop', label: 'Pop' }
      ]
    });
    expect(select).toContain('id="genre-select"');
    expect(select).toContain('All Genres');

    const tabs = renderTabs({
      ariaLabel: 'Library views',
      tabs: [
        { id: 'songs', label: 'Songs', active: true },
        { id: 'albums', label: 'Albums' }
      ]
    });
    expect(tabs).toContain('data-tab-id="songs"');
    expect(tabs).toContain('aria-selected="true"');
  });

  it('should render SearchInput, Divider, Tooltip, Dropdown, Modal, and BottomSheet', () => {
    const search = renderSearchInput({ id: 'search-box', placeholder: 'Search music...' });
    expect(search).toContain('id="search-box"');
    expect(search).toContain('Ctrl + K');

    const divider = renderDivider();
    expect(divider).toContain('app-divider');

    const tooltip = renderTooltip({ text: 'Play next' });
    expect(tooltip).toContain('Play next');

    const dropdown = renderDropdownMenu({
      id: 'track-actions',
      ariaLabel: 'Track Options',
      items: [{ id: 'add-to-playlist', label: 'Add to Playlist', icon: 'plus' }]
    });
    expect(dropdown).toContain('id="track-actions"');
    expect(dropdown).toContain('Add to Playlist');

    const modal = renderModal({
      id: 'playlist-modal',
      title: 'Create Playlist',
      bodyContent: '<p>Form</p>'
    });
    expect(modal).toContain('id="playlist-modal"');
    expect(modal).toContain('Create Playlist');

    const sheet = renderBottomSheet({
      id: 'now-playing-sheet',
      title: 'Now Playing',
      content: '<div>Controls</div>'
    });
    expect(sheet).toContain('id="now-playing-sheet"');
    expect(sheet).toContain('bottom-sheet-drag-pill');
  });

  it('should render Skeletons, EmptyState, LoadingState, and TrackRowPresentation', () => {
    const skeleton = renderSkeleton({ variant: 'card' });
    expect(skeleton).toContain('skeleton-card');

    const empty = renderEmptyState({
      title: 'No Songs Found',
      description: 'Your library is empty.',
      actionLabel: 'Choose Audio Files',
      actionId: 'empty-add-btn'
    });
    expect(empty).toContain('No Songs Found');
    expect(empty).toContain('id="empty-add-btn"');

    const loading = renderLoadingState({ message: 'Scanning library...' });
    expect(loading).toContain('loading-wave-bars');
    expect(loading).toContain('Scanning library...');

    const trackRow = renderTrackRowPresentation({
      id: 'track-1',
      index: 1,
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      durationFormatted: '3:20',
      isPlaying: true,
      isFavorite: true
    });
    expect(trackRow).toContain('row-playing');
    expect(trackRow).toContain('Blinding Lights');
    expect(trackRow).toContain('The Weeknd');
    expect(trackRow).toContain('After Hours');
    expect(trackRow).toContain('3:20');
  });
});
