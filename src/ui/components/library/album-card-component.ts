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
    card.style.padding = 'var(--library-card-padding, 14px)';
    card.style.borderRadius = 'var(--radius-lg)';
    card.style.cursor = 'pointer';
    card.style.position = 'relative';
    card.style.boxSizing = 'border-box';
    card.style.background = 'rgba(255, 255, 255, 0.03)';
    card.style.border = '1px solid var(--glass-border)';
    card.style.transition = 'all var(--duration-fast) var(--ease-smooth)';

    card.innerHTML = `
      <div
        class="album-art-box"
        style="
          width: 100%;
          aspect-ratio: 1;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          margin-bottom: var(--space-3);
          border: 1px solid rgba(255, 255, 255, 0.06);
        "
      >
        <span style="font-size: 38px; color: var(--color-purple-neon);">💿</span>
        <button
          class="album-play-overlay-btn"
          aria-label="Play ${escapeHtml(album.title)}"
          style="
            position: absolute;
            right: 10px;
            bottom: 10px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--color-purple-neon) 0%, var(--color-pink-neon) 100%);
            border: none;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            cursor: pointer;
            box-shadow: var(--shadow-glow-purple);
            opacity: 0.9;
            transform: scale(0.95);
            transition: all 0.15s ease;
          "
        >
          ▶
        </button>
      </div>

      <div style="display: flex; flex-direction: column; overflow: hidden;">
        <span style="font-size: 13px; font-weight: 700; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(album.title)}
        </span>
        <span style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px;">
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
          const playBtnHtml = card.querySelector('.album-play-overlay-btn')?.outerHTML || '';
          artBox.innerHTML = `<img src="${url}" alt="" style="width: 100%; height: 100%; object-fit: cover;" />${playBtnHtml}`;
          // rebind play button
          const playBtn = artBox.querySelector('.album-play-overlay-btn');
          playBtn?.addEventListener('click', e => {
            e.stopPropagation();
            callbacks.onPlay(album);
          });
        }
      });
    }

    const playBtn = card.querySelector('.album-play-overlay-btn');
    playBtn?.addEventListener('click', e => {
      e.stopPropagation();
      callbacks.onPlay(album);
    });

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)';
      card.style.borderColor = 'rgba(168, 85, 247, 0.4)';
      card.style.boxShadow = 'var(--shadow-glow-purple)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'none';
      card.style.borderColor = 'var(--glass-border)';
      card.style.boxShadow = 'none';
    });

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

