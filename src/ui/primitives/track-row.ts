import { getIconSvg } from '../icons/icon-registry';

export interface TrackRowPresentationProps {
  id: string;
  index: number;
  title: string;
  artist: string;
  album?: string;
  durationFormatted: string;
  artworkUrl?: string | null;
  isPlaying?: boolean;
  isFavorite?: boolean;
  showAlbum?: boolean;
  className?: string;
}

export function renderTrackRowPresentation(props: TrackRowPresentationProps): string {
  const {
    id,
    index,
    title,
    artist,
    album = '',
    durationFormatted,
    artworkUrl,
    isPlaying = false,
    isFavorite = false,
    showAlbum = true,
    className = ''
  } = props;

  const playingClass = isPlaying ? ' row-playing' : '';
  const artHtml = artworkUrl
    ? `<img src="${artworkUrl}" alt="${title}" class="track-thumb-img" loading="lazy" />`
    : `<div class="track-thumb-fallback">${getIconSvg('disc', { size: 16 })}</div>`;

  const indexIndicator = isPlaying
    ? `<div class="track-playing-indicator" aria-label="Now playing">${getIconSvg('sound-wave', { size: 14, color: 'var(--color-accent-purple-glow)' })}</div>`
    : `<span class="track-index-num">${index}</span>`;

  return `
    <div
      class="app-track-row${playingClass} ${className}"
      data-track-id="${id}"
      role="row"
      tabindex="0"
    >
      <div class="track-cell-index" role="gridcell">
        ${indexIndicator}
      </div>
      <div class="track-cell-title" role="gridcell">
        <div class="track-thumb-container">
          ${artHtml}
          <div class="track-hover-play">${getIconSvg('play', { size: 14 })}</div>
        </div>
        <div class="track-title-group">
          <span class="track-title-text text-body-strong text-truncate">${title}</span>
          <span class="track-artist-text text-caption text-truncate">${artist}</span>
        </div>
      </div>
      ${
        showAlbum
          ? `
        <div class="track-cell-album text-caption text-truncate hide-mobile" role="gridcell">
          ${album}
        </div>
      `
          : ''
      }
      <div class="track-cell-duration text-caption" role="gridcell">
        ${durationFormatted}
      </div>
      <div class="track-cell-favorite" role="gridcell">
        <button
          class="track-fav-btn"
          data-fav-track-id="${id}"
          aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
        >
          ${getIconSvg(isFavorite ? 'heart-filled' : 'heart', {
            size: 16,
            color: isFavorite ? 'var(--color-accent-pink)' : 'var(--color-text-muted)'
          })}
        </button>
      </div>
      <div class="track-cell-actions" role="gridcell">
        <button
          class="track-menu-btn"
          data-menu-track-id="${id}"
          aria-label="More actions for ${title}"
        >
          ${getIconSvg('more-vertical', { size: 16 })}
        </button>
      </div>
    </div>
  `;
}
