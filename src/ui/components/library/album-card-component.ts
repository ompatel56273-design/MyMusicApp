import type { Album } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { escapeHtml } from '../../../core/security/html-sanitizer';

export interface AlbumCardCallbacks {
  onSelect: (album: Album) => void;
  onPlay: (album: Album) => void;
}

export class AlbumCardComponent {
  public static create(
    album: Album,
    callbacks: AlbumCardCallbacks,
    artworkService?: IArtworkService
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = 'album-card glass-panel';
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');
    card.setAttribute('data-album-id', album.id);
    card.setAttribute('aria-label', `${album.title} by ${album.artistName ?? 'Unknown Artist'}`);

    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.padding = 'var(--space-3)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.cursor = 'pointer';
    card.style.position = 'relative';
    card.style.boxSizing = 'border-box';
    card.style.height = '240px';
    card.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

    card.innerHTML = `
      <div
        class="album-art-box"
        style="
          width: 100%;
          aspect-ratio: 1;
          height: 150px;
          border-radius: var(--radius-sm);
          background: var(--color-bg-surface-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          margin-bottom: var(--space-3);
        "
      >
        <span style="font-size: 32px; color: var(--color-text-muted);">💿</span>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden;">
        <span style="font-size: 13px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(album.title)}
        </span>
        <span style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
          ${escapeHtml(album.artistName ?? 'Unknown Artist')}
        </span>
        <span style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">
          ${album.year ? album.year + ' • ' : ''}${album.trackCount ? album.trackCount + ' tracks' : ''}
        </span>
      </div>
    `;

    // Load Artwork
    const artBox = card.querySelector('.album-art-box');
    const artId = (album as any).artworkId || album.id;
    if (artBox && artworkService && artId) {
      void artworkService.getArtworkUrl(artId, 'medium').then(url => {
        if (url && artBox) {
          artBox.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />`;
        }
      });
    }

    card.addEventListener('click', () => callbacks.onSelect(album));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        callbacks.onSelect(album);
      }
    });

    return card;
  }
}
