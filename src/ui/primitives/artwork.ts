import { getIconSvg } from '../icons/icon-registry';

export interface ArtworkProps {
  title: string;
  artworkUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'vinyl';
  aspectRatio?: '1:1' | '16:9';
  showPlayOverlay?: boolean;
  className?: string;
  id?: string;
}

export function renderArtwork(props: ArtworkProps): string {
  const {
    title,
    artworkUrl,
    size = 'md',
    aspectRatio = '1:1',
    showPlayOverlay = false,
    className = '',
    id = ''
  } = props;

  const idAttr = id ? ` id="${id}"` : '';

  const sizeClasses = {
    xs: 'artwork-xs',
    sm: 'artwork-sm',
    md: 'artwork-md',
    lg: 'artwork-lg',
    xl: 'artwork-xl',
    vinyl: 'artwork-vinyl'
  };

  const imageHtml = artworkUrl
    ? `<img src="${artworkUrl}" alt="${title}" class="artwork-img" loading="lazy" />`
    : `
      <div class="artwork-fallback">
        ${getIconSvg('disc', { size: size === 'xs' || size === 'sm' ? 18 : 32 })}
      </div>
    `;

  const playOverlayHtml = showPlayOverlay
    ? `
      <div class="artwork-play-overlay">
        <div class="artwork-play-btn">
          ${getIconSvg('play', { size: 18 })}
        </div>
      </div>
    `
    : '';

  if (size === 'vinyl') {
    return `
      <div${idAttr} class="app-artwork artwork-vinyl-container ${className}">
        <div class="vinyl-disc"></div>
        <div class="vinyl-cover-card glass-card">
          ${imageHtml}
        </div>
      </div>
    `;
  }

  return `
    <div${idAttr} class="app-artwork ${sizeClasses[size]} aspect-${aspectRatio.replace(':', '-')} ${className}">
      ${imageHtml}
      ${playOverlayHtml}
    </div>
  `;
}
