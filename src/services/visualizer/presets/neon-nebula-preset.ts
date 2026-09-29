import type { VisualizerPreset, VisualizerRenderContext } from '../visualizer-types';
import { WebGLUtils } from '../webgl-utils';

export class NeonNebulaPreset implements VisualizerPreset {
  public readonly id = 'neon-nebula';
  public readonly name = 'Neon Nebula';
  public readonly description = 'Cosmic procedural deep-space nebula with audio-reactive luminosity and starlight.';

  private program: WebGLProgram | null = null;
  private quadGeo: { vao: WebGLVertexArrayObject; vbo: WebGLBuffer } | null = null;

  // Uniform locations
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
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
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform float u_energy;
uniform float u_beat;
uniform int u_reduced_motion;

// 2D Simplex/Noise functions
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float snoise(vec3 uv) {
  vec3 s = floor(uv);
  vec3 f = fract(uv);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = dot(hash33(s + vec3(0,0,0)) - 0.5, f - vec3(0,0,0));
  float n100 = dot(hash33(s + vec3(1,0,0)) - 0.5, f - vec3(1,0,0));
  float n010 = dot(hash33(s + vec3(0,1,0)) - 0.5, f - vec3(0,1,0));
  float n110 = dot(hash33(s + vec3(1,1,0)) - 0.5, f - vec3(1,1,0));
  float n001 = dot(hash33(s + vec3(0,0,1)) - 0.5, f - vec3(0,0,1));
  float n101 = dot(hash33(s + vec3(1,0,1)) - 0.5, f - vec3(1,0,1));
  float n011 = dot(hash33(s + vec3(0,1,1)) - 0.5, f - vec3(0,1,1));
  float n111 = dot(hash33(s + vec3(1,1,1)) - 0.5, f - vec3(1,1,1));

  float fx00 = mix(n000, n100, f.x);
  float fx10 = mix(n010, n110, f.x);
  float fx01 = mix(n001, n101, f.x);
  float fx11 = mix(n011, n111, f.x);

  float fy0 = mix(fx00, fx10, f.y);
  float fy1 = mix(fx01, fx11, f.y);

  return mix(fy0, fy1, f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 4; ++i) {
    v += a * snoise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float speedFactor = u_reduced_motion == 1 ? 0.05 : 0.25;
  float t = u_time * speedFactor;

  // Space coordinate warping driven by bass
  float bassMod = u_bass * 0.4;
  vec3 p = vec3(uv * (1.8 - bassMod * 0.3), t * 0.6);

  // Fractal nebula density
  float q1 = fbm(p + vec3(0.0, 0.0, t * 0.2));
  float q2 = fbm(p + vec3(q1 * 1.5, q1 * 1.2, t * 0.3) + vec3(4.2, 1.3, 0.8));
  float nebula = fbm(p + 2.0 * vec3(q2, q1, t * 0.1));
  nebula = smoothstep(-0.2, 0.6, nebula);

  // Core colors: Deep space #060814, Neon Cyan #06b6d4, Purple #a855f7, Pink #ec4899
  vec3 spaceDark = vec3(0.024, 0.031, 0.078);
  vec3 cyanNeon = vec3(0.024, 0.714, 0.831);
  vec3 purpleNeon = vec3(0.658, 0.333, 0.968);
  vec3 pinkNeon = vec3(0.925, 0.282, 0.600);

  // Blend colors based on coordinates and mids/treble
  vec3 nebulaColor = mix(purpleNeon, cyanNeon, clamp(q1 * 1.5 + 0.5, 0.0, 1.0));
  nebulaColor = mix(nebulaColor, pinkNeon, clamp(q2 * 1.2, 0.0, 1.0) * (0.6 + u_mids * 0.8));

  // Audio reactivity
  float brightness = (0.3 + u_energy * 0.7) + (u_beat * 0.6);
  vec3 finalColor = spaceDark + nebulaColor * nebula * brightness * 1.4;

  // Fine particle stars reacting to treble
  vec2 starGrid = fract(uv * 18.0) - 0.5;
  float starDist = length(starGrid);
  float starNoise = snoise(vec3(floor(uv * 18.0), 12.3));
  if (starNoise > 0.35) {
    float starIntensity = smoothstep(0.06 + u_treble * 0.04, 0.0, starDist);
    finalColor += vec3(0.9, 0.95, 1.0) * starIntensity * (0.4 + u_treble * 1.5);
  }

  // Radial vignetting
  float vig = 1.0 - smoothstep(0.5, 1.4, length(uv));
  finalColor *= vig;

  fragColor = vec4(finalColor, 1.0);
}
`;

  public initialize(gl: WebGL2RenderingContext): boolean {
    this.dispose(gl);

    this.program = WebGLUtils.createProgram(
      gl,
      WebGLUtils.QUAD_VERTEX_SHADER,
      NeonNebulaPreset.FRAGMENT_SHADER
    );
    if (!this.program) return false;

    this.quadGeo = WebGLUtils.createQuadGeometry(gl);
    if (!this.quadGeo) return false;

    // Cache uniform locations
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

    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadGeo.vao);

    gl.uniform2f(this.uResolutionLoc, ctx.width, ctx.height);
    gl.uniform1f(this.uTimeLoc, ctx.time);
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
