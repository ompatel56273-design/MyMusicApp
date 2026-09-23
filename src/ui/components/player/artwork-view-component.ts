import type { Track } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

/**
 * Phase 8 Artwork View Component (Templates 6 & 7).
 * Features:
 * - Vinyl/cover presentation with ambient atmospheric back-glow
 * - Smooth fallback handling and high-resolution artwork rendering
 */
export class ArtworkViewComponent {
  private container: HTMLElement | null = null;
  private artworkBoxEl: HTMLElement | null = null;
  private readonly artworkService?: IArtworkService | undefined;
  private currentTrack: Track | null = null;

  constructor(artworkService?: IArtworkService) {
    this.artworkService = artworkService;
  }

  public mount(container: HTMLElement, initialTrack: Track | null): void {
    this.container = container;
    this.currentTrack = initialTrack;

    this.container.innerHTML = `
      <div
        class="artwork-hero-wrapper"
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 420px;
          aspect-ratio: 1;
          margin: 0 auto;
          position: relative;
          box-sizing: border-box;
        "
      >
        <div
          class="artwork-backdrop-glow"
          aria-hidden="true"
          style="
            position: absolute;
            inset: -12px;
            background: radial-gradient(circle, rgba(124, 58, 237, 0.4) 0%, rgba(6, 182, 212, 0.2) 50%, transparent 70%);
            border-radius: var(--radius-2xl);
            filter: blur(28px);
            opacity: 0.85;
            z-index: 0;
            pointer-events: none;
          "
        ></div>
        <div
          id="np-artwork-box"
          style="
            width: 100%;
            height: 100%;
            border-radius: var(--radius-2xl);
            background: linear-gradient(135deg, rgba(30, 20, 70, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
            border: 1px solid var(--glass-border-interactive);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(124, 58, 237, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
            z-index: 1;
            transition: all var(--duration-normal) var(--ease-smooth);
            box-sizing: border-box;
          "
        >
          <span style="color: var(--color-accent-purple-glow); display: flex; opacity: 0.6;">
            ${getIconSvg('music', { size: 64, color: 'var(--color-accent-purple-glow)' })}
          </span>
        </div>
      </div>
    `;

    this.artworkBoxEl = this.container.querySelector('#np-artwork-box');
    void this.loadArtwork();
  }

  public updateTrack(track: Track | null): void {
    this.currentTrack = track;
    void this.loadArtwork();
  }

  public unmount(): void {
    if (this.artworkBoxEl) {
      this.artworkBoxEl.innerHTML = '';
      this.artworkBoxEl = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.currentTrack = null;
  }

  private async loadArtwork(): Promise<void> {
    if (!this.artworkBoxEl) return;

    const artId = (this.currentTrack as any)?.artworkId || this.currentTrack?.albumId;
    if (this.artworkService && artId) {
      const url = await this.artworkService.getArtworkUrl(artId, 'large');
      if (url && this.artworkBoxEl) {
        this.artworkBoxEl.innerHTML = `
          <img
            src="${url}"
            alt="${escapeHtml(this.currentTrack?.title || 'Album Artwork')}"
            style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block;"
          />
        `;
        return;
      }
    }

    // Fallback if no artwork is available
    if (this.artworkBoxEl) {
      this.artworkBoxEl.innerHTML = `
        <span style="color: var(--color-accent-purple-glow); display: flex; opacity: 0.6;">
          ${getIconSvg('music', { size: 64, color: 'var(--color-accent-purple-glow)' })}
        </span>
      `;
    }
  }
}
