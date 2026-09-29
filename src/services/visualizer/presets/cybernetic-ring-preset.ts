import type { VisualizerPreset, VisualizerRenderContext } from '../visualizer-types';
import { WebGLUtils } from '../webgl-utils';

export class CyberneticRingPreset implements VisualizerPreset {
  public readonly id = 'cybernetic-ring';
  public readonly name = 'Cybernetic Equalizer Ring';
  public readonly description = 'Holographic circular equalizer with segmented multi-band energy arcs and pulse rings.';

  private program: WebGLProgram | null = null;
  private quadGeo: { vao: WebGLVertexArrayObject; vbo: WebGLBuffer } | null = null;
  private freqTexture: WebGLTexture | null = null;

  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uFreqTexLoc: WebGLUniformLocation | null = null;
  private uBassLoc: WebGLUniformLocation | null = null;
  private uMidsLoc: WebGLUniformLocation | null = null;
  private uTrebleLoc: WebGLUniformLocation | null = null;
  private uEnergyLoc: WebGLUniformLocation | null = null;
  private uBeatLoc: WebGLUniformLocation | null = null;
  private uReducedMotionLoc: WebGLUniformLocation | null = null;

  private static readonly FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_freq_texture;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform float u_energy;
uniform float u_beat;
uniform int u_reduced_motion;

#define PI 3.14159265359

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float r = length(uv);
  float theta = atan(uv.y, uv.x);
  float normAngle = (theta + PI) / (2.0 * PI); // 0.0 .. 1.0

  // Mirror angle for symmetrical circular EQ
  float symAngle = abs(normAngle - 0.5) * 2.0;

  // Sample audio frequency for this radial angle
  float freqSample = texture(u_freq_texture, vec2(symAngle * 0.85, 0.5)).r;

  // 1. Center Core Hologram (Mids)
  float coreRadius = 0.12 + u_mids * 0.06;
  float coreDist = abs(r - coreRadius);
  float coreGlow = smoothstep(0.012, 0.0, coreDist) + smoothstep(0.06, 0.0, coreDist) * 0.4;
  vec3 coreColor = vec3(0.024, 0.714, 0.831) * coreGlow * (1.0 + u_mids * 2.0);

  // 2. Radial Frequency Equalizer Bars
  float numBars = 64.0;
  float barIndex = floor(symAngle * numBars);
  float barFrac = fract(symAngle * numBars);
  float barGap = smoothstep(0.15, 0.3, barFrac) * smoothstep(0.85, 0.7, barFrac);

  float baseRingRadius = 0.22 + u_bass * 0.08;
  float barHeight = freqSample * 0.28 * (1.0 + u_energy * 0.8);
  float inBar = step(baseRingRadius, r) * step(r, baseRingRadius + barHeight) * barGap;

  // Bar Color: Gradient from Cyan -> Purple -> Pink
  vec3 cyan = vec3(0.024, 0.714, 0.831);
  vec3 purple = vec3(0.658, 0.333, 0.968);
  vec3 pink = vec3(0.925, 0.282, 0.600);

  float barProgress = clamp((r - baseRingRadius) / (barHeight + 0.001), 0.0, 1.0);
  vec3 barColor = mix(cyan, purple, barProgress);
  barColor = mix(barColor, pink, smoothstep(0.7, 1.0, barProgress));
  vec3 eqBars = barColor * inBar * (1.2 + u_beat * 0.8);

  // 3. Outer Bass Ring & Ticks (Treble)
  float outerRingR = baseRingRadius + 0.32 + u_beat * 0.06;
  float outerDist = abs(r - outerRingR);
  float outerRing = smoothstep(0.006, 0.0, outerDist) + smoothstep(0.04, 0.0, outerDist) * 0.3;
  vec3 outerColor = purple * outerRing * (0.8 + u_bass * 1.5);

  // Rotating cybernetic tick reticles
  float rotSpeed = u_reduced_motion == 1 ? 0.05 : 0.2;
  float rotAngle = theta + u_time * rotSpeed;
  float ticks = step(0.92, fract(rotAngle * (12.0 / PI)));
  float tickRing = step(outerRingR, r) * step(r, outerRingR + 0.025) * ticks;
  vec3 tickColor = vec3(0.95, 0.95, 1.0) * tickRing * (0.6 + u_treble * 1.4);

  // 4. Beat Shockwave Expansion Ring
  float shockwaveR = fract(u_time * 0.6) * 0.8;
  float shockDist = abs(r - shockwaveR);
  float shockwave = smoothstep(0.015, 0.0, shockDist) * (1.0 - shockwaveR) * u_beat * 1.5;
  vec3 shockColor = pink * shockwave;

  // Background ambient space
  vec3 bg = vec3(0.02, 0.025, 0.05);

  vec3 finalColor = bg + coreColor + eqBars + outerColor + tickColor + shockColor;

  // Vignette
  float vig = 1.0 - smoothstep(0.6, 1.4, r);
  finalColor *= vig;

  fragColor = vec4(finalColor, 1.0);
}
`;

  public initialize(gl: WebGL2RenderingContext): boolean {
    this.dispose(gl);

    this.program = WebGLUtils.createProgram(
      gl,
      WebGLUtils.QUAD_VERTEX_SHADER,
      CyberneticRingPreset.FRAGMENT_SHADER
    );
    if (!this.program) return false;

    this.quadGeo = WebGLUtils.createQuadGeometry(gl);
    if (!this.quadGeo) return false;

    this.freqTexture = WebGLUtils.createAudioTexture(gl, 128);
    if (!this.freqTexture) return false;

    this.uResolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.uTimeLoc = gl.getUniformLocation(this.program, 'u_time');
    this.uFreqTexLoc = gl.getUniformLocation(this.program, 'u_freq_texture');
    this.uBassLoc = gl.getUniformLocation(this.program, 'u_bass');
    this.uMidsLoc = gl.getUniformLocation(this.program, 'u_mids');
    this.uTrebleLoc = gl.getUniformLocation(this.program, 'u_treble');
    this.uEnergyLoc = gl.getUniformLocation(this.program, 'u_energy');
    this.uBeatLoc = gl.getUniformLocation(this.program, 'u_beat');
    this.uReducedMotionLoc = gl.getUniformLocation(this.program, 'u_reduced_motion');

    return true;
  }

  public resize(gl: WebGL2RenderingContext, width: number, height: number): void {
    gl.viewport(0, 0, width, height);
  }

  public render(ctx: VisualizerRenderContext): void {
    const { gl } = ctx;
    if (!this.program || !this.quadGeo || !this.freqTexture) return;

    // Upload frequency audio data to texture
    WebGLUtils.updateAudioTexture(gl, this.freqTexture, ctx.audio.frequencyData, 128);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadGeo.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.freqTexture);
    gl.uniform1i(this.uFreqTexLoc, 0);

    gl.uniform2f(this.uResolutionLoc, ctx.width, ctx.height);
    gl.uniform1f(this.uTimeLoc, ctx.time);
    gl.uniform1f(this.uBassLoc, ctx.audio.bass);
    gl.uniform1f(this.uMidsLoc, ctx.audio.mids);
    gl.uniform1f(this.uTrebleLoc, ctx.audio.treble);
    gl.uniform1f(this.uEnergyLoc, ctx.audio.energy);
    gl.uniform1f(this.uBeatLoc, ctx.audio.beatPulse);
    gl.uniform1i(this.uReducedMotionLoc, ctx.reducedMotion ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  public dispose(gl: WebGL2RenderingContext): void {
    if (this.freqTexture) {
      gl.deleteTexture(this.freqTexture);
      this.freqTexture = null;
    }
    if (this.quadGeo) {
      gl.deleteVertexArray(this.quadGeo.vao);
      gl.deleteBuffer(this.quadGeo.vbo);
      this.quadGeo = null;
    }
    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
  }
}
