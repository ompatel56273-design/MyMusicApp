import type { Track } from '../../../domain/entities/models';

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
        <div class="glass-panel" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-8); border-radius: var(--radius-xl); text-align: center; color: var(--color-text-muted); box-sizing: border-box;">
          <div style="font-size: 36px; margin-bottom: var(--space-2); opacity: 0.4;">ℹ️</div>
          <p style="font-size: 14px; margin: 0;">No track selected.</p>
        </div>
      `;
      return;
    }

    const t = this.currentTrack;
    const f = t.format;
    const durationMinSec = this.formatDuration(t.durationMs);

    const isHiRes = (f.sampleRate && f.sampleRate > 48000) || (f.bitDepth && f.bitDepth > 16);
    const qualityLabel = isHiRes ? 'Hi-Res Lossless' : f.isLossless ? 'Lossless CD Quality' : 'Lossy Audio';
    const qualityColor = isHiRes ? '#ffaa00' : f.isLossless ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)';

    this.container.innerHTML = `
      <div class="glass-panel audio-info-panel" style="height: 100%; overflow-y: auto; padding: var(--space-6); border-radius: var(--radius-xl); box-sizing: border-box; display: flex; flex-direction: column; gap: var(--space-5);">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: var(--space-3);">
          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted);">
              Technical Audio Properties
            </span>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin: var(--space-1) 0 0 0;">
              ${t.title}
            </h3>
          </div>
          <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-full); background: rgba(255, 255, 255, 0.08); border: 1px solid ${qualityColor}; color: ${qualityColor};">
            ${qualityLabel}
          </span>
        </div>

        <!-- Technical Properties Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
          
          <div class="info-cell" style="background: rgba(255, 255, 255, 0.03); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Container & Codec</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); text-transform: uppercase;">
              ${f.container} / ${f.codec}
            </div>
          </div>

          <div class="info-cell" style="background: rgba(255, 255, 255, 0.03); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Sample Rate</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary);">
              ${f.sampleRate ? `${(f.sampleRate / 1000).toFixed(1)} kHz (${f.sampleRate.toLocaleString()} Hz)` : 'Unknown'}
            </div>
          </div>

          <div class="info-cell" style="background: rgba(255, 255, 255, 0.03); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Bit Depth</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary);">
              ${f.bitDepth ? `${f.bitDepth}-bit` : 'N/A (Compressed)'}
            </div>
          </div>

          <div class="info-cell" style="background: rgba(255, 255, 255, 0.03); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Bitrate</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary);">
              ${f.bitrate ? `${f.bitrate} kbps` : 'Variable / Lossless'}
            </div>
          </div>

          <div class="info-cell" style="background: rgba(255, 255, 255, 0.03); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Channels</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary);">
              ${f.channels === 1 ? '1 (Mono)' : f.channels === 2 ? '2 (Stereo)' : `${f.channels} Channels`}
            </div>
          </div>

          <div class="info-cell" style="background: rgba(255, 255, 255, 0.03); padding: var(--space-3); border-radius: var(--radius-md); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px;">Duration</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-text-primary);">
              ${durationMinSec} (${(t.durationMs / 1000).toFixed(1)}s)
            </div>
          </div>
        </div>

        <!-- Library & Track Metadata -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); font-size: 13px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--color-text-muted);">Album:</span>
            <span style="color: var(--color-text-primary); font-weight: 500;">${t.albumTitle || 'Unknown Album'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--color-text-muted);">Artist:</span>
            <span style="color: var(--color-text-primary); font-weight: 500;">${t.artistName || 'Unknown Artist'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--color-text-muted);">Track Number:</span>
            <span style="color: var(--color-text-primary); font-weight: 500;">${t.trackNumber ? `${t.trackNumber}${t.discNumber ? ` (Disc ${t.discNumber})` : ''}` : 'None'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--color-text-muted);">Play Count:</span>
            <span style="color: var(--color-text-primary); font-weight: 500;">${t.playCount}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--color-text-muted);">Availability:</span>
            <span style="color: ${t.availability === 'available' ? '#44bb44' : '#ff4444'}; font-weight: 600; text-transform: capitalize;">${t.availability}</span>
          </div>
        </div>

      </div>
    `;
  }

  private formatDuration(ms?: number): string {
    if (!ms || ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}
