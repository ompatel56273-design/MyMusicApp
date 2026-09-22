import type { IAudioEngine } from '../../../services/contracts/service-contracts';
import type { VisualizerMode, VisualizerColorTheme } from '../../../domain/entities/visualizer-settings';

export interface VisualizerRenderConfig {
  mode: VisualizerMode;
  colorTheme: VisualizerColorTheme;
  fpsLimit: number;
  reducedMotion: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

/**
 * High-Performance Pure HTML5 Canvas 2D Audio Visualizer Renderer.
 * Zero WebGL overhead, zero allocations per render tick, bounded memory,
 * supports 6 modes: Bars, Waveform, Circular, Spectrum, Particles, Minimal.
 */
export class VisualizerCanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly audioEngine: IAudioEngine;

  private config: VisualizerRenderConfig = {
    mode: 'bars',
    colorTheme: 'accent',
    fpsLimit: 60,
    reducedMotion: false
  };

  // Reusable static buffers (Zero per-frame allocation)
  private readonly frequencyData = new Uint8Array(128);
  private readonly timeDomainData = new Uint8Array(128);

  // Peak caps drop animation buffer for Bars mode
  private readonly peakCaps = new Float32Array(64);
  private readonly peakDecay = 0.96;

  // Bounded particle pool (60 particles)
  private readonly particles: Particle[] = [];
  private static readonly MAX_PARTICLES = 60;

  // Animation loop state
  private animationHandle: number | null = null;
  private lastFrameTime = 0;
  private isRunning = false;

  constructor(audioEngine: IAudioEngine) {
    this.audioEngine = audioEngine;
    this.initParticlePool();
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.resize();
  }

  public detachCanvas(): void {
    this.stop();
    this.canvas = null;
    this.ctx = null;
  }

  public setConfig(partial: Partial<VisualizerRenderConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.renderLoop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationHandle !== null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  public resize(): void {
    if (!this.canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 100);
    const height = Math.max(rect.height, 100);

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    if (this.ctx) {
      this.ctx.resetTransform?.();
      this.ctx.scale(dpr, dpr);
    }
  }

  private renderLoop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameIntervalMs = 1000 / (this.config.fpsLimit || 60);
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= frameIntervalMs) {
      this.lastFrameTime = now - (elapsed % frameIntervalMs);
      this.drawFrame();
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationHandle = requestAnimationFrame(this.renderLoop);
    }
  };

  public drawFrame(): void {
    if (!this.canvas || !this.ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return;

    // Fetch analysis data into reusable typed arrays
    const metrics = this.audioEngine.getAnalysisMetrics();
    this.frequencyData.set(metrics.frequencyData);
    this.timeDomainData.set(metrics.timeDomainData);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // If reduced motion is requested, render a static minimal level indicator
    if (this.config.reducedMotion) {
      this.renderReducedMotion(ctx, width, height, metrics.rms, metrics.peak);
      return;
    }

    switch (this.config.mode) {
      case 'bars':
        this.renderBars(ctx, width, height);
        break;
      case 'waveform':
        this.renderWaveform(ctx, width, height);
        break;
      case 'circular':
        this.renderCircular(ctx, width, height);
        break;
      case 'spectrum':
        this.renderSpectrum(ctx, width, height);
        break;
      case 'particles':
        this.renderParticles(ctx, width, height, metrics.rms);
        break;
      case 'minimal':
        this.renderMinimal(ctx, width, height, metrics.rms, metrics.peak);
        break;
      default:
        this.renderBars(ctx, width, height);
        break;
    }
  }

  // 1. Frequency Bars (32 logarithmic grouped bars with peak caps)
  private renderBars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const numBars = 32;
    const barWidth = width / numBars;
    const padding = 2;
    const actualWidth = Math.max(barWidth - padding, 2);

    for (let i = 0; i < numBars; i++) {
      // Map 32 visual bars to 128 FFT bins logarithmically
      const binIndex = Math.min(127, Math.floor(Math.pow(i / numBars, 1.4) * 128));
      const value = this.frequencyData[binIndex] || 0;
      const barHeight = (value / 255.0) * (height - 10);

      // Peak cap drop animation
      if (barHeight >= this.peakCaps[i]!) {
        this.peakCaps[i] = barHeight;
      } else {
        this.peakCaps[i] = Math.max(0, this.peakCaps[i]! * this.peakDecay);
      }

      const x = i * barWidth + padding / 2;
      const y = height - barHeight;

      // Color gradient
      ctx.fillStyle = this.getBarColor(i, numBars);
      ctx.fillRect(x, y, actualWidth, barHeight);

      // Peak cap line
      const capY = height - this.peakCaps[i]!;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(x, capY - 2, actualWidth, 2);
    }
  }

  // 2. Waveform (Smooth Oscilloscope line)
  private renderWaveform(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.getPrimaryColor();
    ctx.beginPath();

    const sliceWidth = width / 128;
    let x = 0;

    for (let i = 0; i < 128; i++) {
      const v = (this.timeDomainData[i] || 128) / 128.0; // [0, 2]
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
  }

  // 3. Circular (Radial spikes around centered circle)
  private renderCircular(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.22;
    const maxBarLength = Math.min(width, height) * 0.24;
    const numPoints = 64;

    ctx.lineWidth = 2.5;

    for (let i = 0; i < numPoints; i++) {
      const binIndex = Math.floor((i / numPoints) * 100);
      const val = (this.frequencyData[binIndex] || 0) / 255.0;
      const angle = (i / numPoints) * Math.PI * 2;

      const r1 = baseRadius;
      const r2 = baseRadius + val * maxBarLength;

      const x1 = centerX + Math.cos(angle) * r1;
      const y1 = centerY + Math.sin(angle) * r1;
      const x2 = centerX + Math.cos(angle) * r2;
      const y2 = centerY + Math.sin(angle) * r2;

      ctx.strokeStyle = this.getBarColor(i, numPoints);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Center glowing circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 4. Spectrum (Continuous filled gradient area)
  private renderSpectrum(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 107, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 150, 50, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 107, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = this.getPrimaryColor();
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, height);

    const step = width / 64;
    for (let i = 0; i < 64; i++) {
      const val = (this.frequencyData[i * 2] || 0) / 255.0;
      const y = height - val * (height - 20);
      ctx.lineTo(i * step, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 5. Particles (Bass reactive floating energy particles)
  private renderParticles(ctx: CanvasRenderingContext2D, width: number, height: number, rms: number): void {
    const bassEnergy = ((this.frequencyData[0] || 0) + (this.frequencyData[1] || 0) + (this.frequencyData[2] || 0)) / (3 * 255);
    const speedBoost = 1.0 + bassEnergy * 3.0;

    for (const p of this.particles) {
      p.x += p.vx * speedBoost;
      p.y += p.vy * speedBoost;

      // Wrap around bounds
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      const dynamicSize = p.size * (1.0 + bassEnergy * 2.0);
      const alpha = Math.min(1.0, p.alpha + rms);

      ctx.fillStyle = p.color.replace('ALPHA', alpha.toFixed(2));
      ctx.beginPath();
      ctx.arc(p.x % width, p.y % height, dynamicSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. Minimal (Subtle pulsing orb / level indicator)
  private renderMinimal(ctx: CanvasRenderingContext2D, width: number, height: number, rms: number, peak: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.15;
    const pulseRadius = baseRadius + rms * baseRadius * 1.5;

    // Glowing circle
    const grad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, pulseRadius * 1.5);
    grad.addColorStop(0, 'rgba(255, 107, 0, 0.6)');
    grad.addColorStop(0.6, 'rgba(255, 107, 0, 0.2)');
    grad.addColorStop(1, 'rgba(255, 107, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pulseRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Solid inner core
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * (0.4 + peak * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  // Reduced motion static fallback
  private renderReducedMotion(ctx: CanvasRenderingContext2D, width: number, height: number, rms: number, _peak: number): void {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(width * 0.1, height / 2 - 4, width * 0.8, 8);

    const levelWidth = width * 0.8 * Math.min(1.0, rms * 3);
    ctx.fillStyle = 'var(--color-accent-primary, #ff6b00)';
    ctx.fillRect(width * 0.1, height / 2 - 4, levelWidth, 8);
  }

  private initParticlePool(): void {
    for (let i = 0; i < VisualizerCanvasRenderer.MAX_PARTICLES; i++) {
      this.particles.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        size: 1.5 + Math.random() * 3.5,
        alpha: 0.3 + Math.random() * 0.4,
        color: 'rgba(255, 107, 0, ALPHA)'
      });
    }
  }

  private getBarColor(index: number, total: number): string {
    if (this.config.colorTheme === 'rainbow') {
      const hue = (index / total) * 360;
      return `hsl(${hue}, 85%, 60%)`;
    }
    if (this.config.colorTheme === 'monochrome') {
      const lum = 40 + (index / total) * 50;
      return `hsl(0, 0%, ${lum}%)`;
    }
    // Default: Accent theme (Orange-red gradient)
    return 'var(--color-accent-primary, #ff6b00)';
  }

  private getPrimaryColor(): string {
    if (this.config.colorTheme === 'monochrome') return '#ffffff';
    if (this.config.colorTheme === 'rainbow') return '#00f0ff';
    return 'var(--color-accent-primary, #ff6b00)';
  }
}
