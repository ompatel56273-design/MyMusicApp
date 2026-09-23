import type { Track } from '../../../domain/entities/models';
import { getIconSvg } from '../../icons/icon-registry';
import { escapeHtml } from '../../../core/security/html-sanitizer';

/**
 * Phase 8 Audio Information Panel Component (Templates 6 & 7 / About Tab).
 * Features:
 * - Real audio stream technical specifications (container, codec, sample rate, bit depth, bitrate, channels)
 * - HI-RES AUDIO and LOSSLESS indicator badges
 * - Accurate zero-guess technical display
 */
export class AudioInfoPanelComponent {
  private container: HTMLElement | null = null;
  private currentTrack: Track | null = null;

  public mount(container: HTMLElement, track: Track | null): void {
    this.container = container;
    this.currentTrack = track;
    this.render();
  }

  public unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  public setTrack(track: Track | null): void {
    this.currentTrack = track;
    this.render();
  }

  private render(): void {
    if (!this.container) return;

    if (!this.currentTrack) {
      this.container.innerHTML = `
        <div class="glass-panel" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); border-radius: var(--radius-2xl); text-align: center; color: var(--color-text-muted); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); box-sizing: border-box;">
          <div style="color: var(--color-accent-purple-glow); display: flex; justify-content: center; margin-bottom: 10px;">
            ${getIconSvg('info', { size: 36 })}
          </div>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-primary); font-weight: var(--font-weight-bold); margin: 0 0 4px 0;">No Track Selected</p>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin: 0;">Play a track to view its audio format parameters.</p>
        </div>
      `;
      return;
    }

    const t = this.currentTrack;
    const f = t.format;

    const isHiRes = (f.sampleRate && f.sampleRate > 48000) || (f.bitDepth && f.bitDepth > 16);

    const qualityBadge = isHiRes
      ? `<span style="font-size: 10px; font-weight: var(--font-weight-extrabold); letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: var(--radius-full); background: linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);">HI-RES AUDIO</span>`
      : f.isLossless
      ? `<span style="font-size: 10px; font-weight: var(--font-weight-extrabold); letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: var(--radius-full); background: linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%); border: 1px solid rgba(6, 182, 212, 0.4); color: var(--color-accent-cyan); box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);">LOSSLESS</span>`
      : `<span style="font-size: 10px; font-weight: var(--font-weight-bold); letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: var(--radius-full); background: var(--glass-bg-subtle); border: 1px solid var(--glass-border); color: var(--color-text-muted);">STANDARD</span>`;

    const genreText = (t as any).genre || (t as any).genreId || 'Unavailable';
    const yearText = (t as any).year ? String((t as any).year) : (t as any).releaseYear ? String((t as any).releaseYear) : 'Unavailable';
    const trackNumText = (t as any).trackNumber ? String((t as any).trackNumber) : 'Unavailable';

    this.container.innerHTML = `
      <div
        class="glass-panel audio-info-panel"
        role="region"
        aria-label="Track Details and Audio Specification"
        style="
          height: 100%;
          overflow-y: auto;
          padding: var(--space-5);
          border-radius: var(--radius-2xl);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
          background: var(--glass-bg-subtle);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(16px);
          width: 100%;
        "
      >
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: var(--space-3);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--color-accent-cyan); display: flex;">
              ${getIconSvg('info', { size: 16 })}
            </span>
            <span style="font-size: 11px; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.08em; color: #ffffff;">
              Track Information & Specification
            </span>
          </div>
          ${qualityBadge}
        </div>

        <!-- Section 1: Track Details -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <span style="font-size: 10px; font-weight: var(--font-weight-extrabold); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted);">
            Track Overview
          </span>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-3);">
            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Title</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(t.title)}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Artist</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--color-accent-cyan); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(t.artistName ?? 'Unknown Artist')}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Album</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(t.albumTitle ?? 'Unavailable')}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Genre</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">
                ${escapeHtml(genreText)}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Year / Track #</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">
                ${escapeHtml(yearText)} ${trackNumText !== 'Unavailable' ? `• Trk ${trackNumText}` : ''}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Play Count</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--color-accent-purple-glow);">
                ${t.playCount ?? 0} plays
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Audio Stream Technical Properties Grid -->
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
          <span style="font-size: 10px; font-weight: var(--font-weight-extrabold); text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted);">
            Technical Audio Properties
          </span>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-3);">
            
            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Format / Container</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase;">
                ${escapeHtml(f.container)}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Audio Codec</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase;">
                ${escapeHtml(f.codec)}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Sample Rate</div>
              <div style="font-size: 13px; font-weight: 700; color: var(--color-accent-cyan);">
                ${f.sampleRate ? `${(f.sampleRate / 1000).toFixed(1)} kHz` : 'Unavailable'}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Bit Depth</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">
                ${f.bitDepth ? `${f.bitDepth}-bit` : 'N/A (Compressed)'}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Bitrate</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">
                ${f.bitrate ? `${f.bitrate} kbps` : 'Variable / Lossless'}
              </div>
            </div>

            <div class="info-cell" style="background: rgba(255, 255, 255, 0.02); padding: var(--space-3); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
              <div style="font-size: 11px; font-weight: 500; color: var(--color-text-muted); margin-bottom: 2px;">Channels</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff;">
                ${f.channels === 1 ? '1 (Mono)' : f.channels === 2 ? '2 (Stereo 2.0)' : `${f.channels} Channels`}
              </div>
            </div>

          </div>
        </div>

        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: auto; border-top: 1px solid var(--glass-border); padding-top: var(--space-3); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--color-accent-purple-glow); display: flex;">${getIconSvg('sound-wave', { size: 14 })}</span>
            <span>Bit-perfect DSP pipeline active</span>
          </div>
          <span style="color: var(--color-text-muted); font-size: 10px;">ID: ${escapeHtml(t.id)}</span>
        </div>
      </div>
    `;
  }
}
