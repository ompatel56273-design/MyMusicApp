import type { Track } from '../../../domain/entities/models';
import type { IArtworkService } from '../../../services/contracts/service-contracts';

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
          max-width: 380px;
          aspect-ratio: 1;
          margin: 0 auto var(--space-6) auto;
          position: relative;
        "
      >
        <div
          id="np-artwork-box"
          style="
            width: 100%;
            height: 100%;
            border-radius: var(--radius-xl);
            background: var(--color-bg-surface-elevated);
            border: 1px solid var(--glass-border);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition: all var(--duration-normal) var(--ease-smooth);
          "
        >
          <span style="font-size: 64px; color: var(--color-text-muted);">♫</span>
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
            alt="Album Artwork"
            style="width: 100%; height: 100%; object-fit: cover;"
          />
        `;
        return;
      }
    }

    if (this.artworkBoxEl) {
      this.artworkBoxEl.innerHTML = `<span style="font-size: 64px; color: var(--color-text-muted);">♫</span>`;
    }
  }
}
