import type { VisualizerPreset, VisualizerRenderContext } from '../visualizer-types';
import { WebGLUtils } from '../webgl-utils';

export class HyperspacePreset implements VisualizerPreset {
  public readonly id = 'hyperspace';
  public readonly name = '3D Hyperspace Tunnel';
  public readonly description = 'Forward-moving relativistic hyperspace warp tunnel with audio-controlled speed and bass expansion.';

  private program: WebGLProgram | null = null;
  private quadGeo: { vao: WebGLVertexArrayObject; vbo: WebGLBuffer } | null = null;

  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uBassLoc: WebGLUniformLocation | null = null;
  private uMidsLoc: WebGLUniformLocation | null = null;
  private uTrebleLoc: WebGLUniformLocation | null = null;
  private uEnergyLoc: WebGLUniformLocation | null = null;
  private uBeatLoc: WebGLUniformLocation | null = null;
  private uReducedMotionLoc: WebGLUniformLocation | null = null;

  private warpProgress = 0;

  private static readonly FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform float u_energy;
uniform float u_beat;
uniform int u_reduced_motion;

#define PI 3.14159265359

// Tunnel coordinates
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float r = length(uv);
  if (r < 0.001) r = 0.001;
  float theta = atan(uv.y, uv.x);

  // Depth coordinate (inverse radius creates infinite forward tunnel)
  float depth = 1.0 / r;

  // Warp tunnel expansion driven by bass & beat
  float tunnelWidth = 1.0 + u_bass * 0.6 + u_beat * 0.8;
  depth /= tunnelWidth;

  // Time-based forward motion
  float speed = (0.8 + u_energy * 2.2 + u_beat * 3.0) * (u_reduced_motion == 1 ? 0.2 : 1.0);
  float z = depth + u_time * speed;

  // Tunnel radial segments (16 futuristic light sectors)
  float sectors = 16.0;
  float angleNorm = (theta + PI) / (2.0 * PI);
  float sectorId = floor(angleNorm * sectors);
  float sectorFrac = fract(angleNorm * sectors) - 0.5;

  // Longitudinal streak lines
  float streak = smoothstep(0.35, 0.05, abs(sectorFrac));

  // Concentric speed rings along Z axis
  float ringZ = fract(z * 0.4);
  float ring = smoothstep(0.12, 0.0, abs(ringZ - 0.5));

  // Neon color palette
  vec3 cyan = vec3(0.024, 0.714, 0.831);
  vec3 purple = vec3(0.658, 0.333, 0.968);
  vec3 pink = vec3(0.925, 0.282, 0.600);
  vec3 blueDeep = vec3(0.05, 0.1, 0.35);

  // Blend color by angle and depth
  vec3 tunnelColor = mix(purple, cyan, sin(angleNorm * PI * 4.0 + z * 0.5) * 0.5 + 0.5);
  tunnelColor = mix(tunnelColor, pink, ring * (0.5 + u_treble));

  // Tunnel intensity with depth falloff and center singularity glow
  float intensity = (streak * 0.8 + ring * 1.5) * (0.4 + u_energy * 0.9 + u_beat * 1.2);
  float fog = smoothstep(0.0, 1.8, r); // Center core glow

  vec3 col = blueDeep * (1.0 - r) + tunnelColor * intensity * fog;

  // Central hyperspace singularity bloom
  float centerGlow = smoothstep(0.25, 0.0, r) * (0.8 + u_beat * 2.0);
  col += vec3(0.85, 0.95, 1.0) * centerGlow;

  // Chromatic aberration at high energy
  float ca = (u_bass * 0.015 + u_beat * 0.02);
  vec3 caCol = col;
  caCol.r += smoothstep(0.3, 0.0, length(uv * (1.0 + ca))) * 0.3;
  caCol.b += smoothstep(0.3, 0.0, length(uv * (1.0 - ca))) * 0.3;

  fragColor = vec4(caCol, 1.0);
}
`;

  public initialize(gl: WebGL2RenderingContext): boolean {
    this.dispose(gl);

    this.program = WebGLUtils.createProgram(
      gl,
      WebGLUtils.QUAD_VERTEX_SHADER,
      HyperspacePreset.FRAGMENT_SHADER
    );
    if (!this.program) return false;

    this.quadGeo = WebGLUtils.createQuadGeometry(gl);
    if (!this.quadGeo) return false;

    this.uResolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.uTimeLoc = gl.getUniformLocation(this.program, 'u_time');
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
    if (!this.program || !this.quadGeo) return;

    // Accumulate warp progress based on audio energy for seamless speed control
    const speed = (0.8 + ctx.audio.energy * 2.2 + ctx.audio.beatPulse * 3.0) * (ctx.reducedMotion ? 0.2 : 1.0);
    this.warpProgress += ctx.deltaTime * speed;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadGeo.vao);

    gl.uniform2f(this.uResolutionLoc, ctx.width, ctx.height);
    gl.uniform1f(this.uTimeLoc, this.warpProgress);
    gl.uniform1f(this.uBassLoc, ctx.audio.bass);
    gl.uniform1f(this.uMidsLoc, ctx.audio.mids);
    gl.uniform1f(this.uTrebleLoc, ctx.audio.treble);
    gl.uniform1f(this.uEnergyLoc, ctx.audio.energy);
    gl.uniform1f(this.uBeatLoc, ctx.audio.beatPulse);
    gl.uniform1i(this.uReducedMotionLoc, ctx.reducedMotion ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  public dispose(gl: WebGL2RenderingContext): void {
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
