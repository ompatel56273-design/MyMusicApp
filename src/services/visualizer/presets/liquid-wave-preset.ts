import type { VisualizerPreset, VisualizerRenderContext } from '../visualizer-types';
import { WebGLUtils } from '../webgl-utils';

export class LiquidWavePreset implements VisualizerPreset {
  public readonly id = 'liquid-wave';
  public readonly name = 'Liquid Audio Wave';
  public readonly description = 'Fluidic 3D luminous wave field reacting organically to multi-band audio harmonics.';

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

// 3D Liquid raymarcher / wave surface
float waveHeight(vec2 p, float t) {
  float speed = u_reduced_motion == 1 ? 0.3 : 1.2;

  // Primary rolling swells from bass
  float w1 = sin(p.x * 2.0 + t * speed) * cos(p.y * 1.5 + t * 0.8 * speed) * (0.4 + u_bass * 0.8);

  // Mid frequency diagonal ripples
  float w2 = sin(p.x * 4.5 - p.y * 3.5 + t * 1.6 * speed) * (0.2 + u_mids * 0.5);

  // Treble high frequency micro-harmonics
  float w3 = cos(length(p) * 8.0 - t * 2.4 * speed) * (0.1 + u_treble * 0.3 + u_beat * 0.4);

  return w1 + w2 + w3;
}

vec3 getNormal(vec2 p, float t) {
  float eps = 0.02;
  float h = waveHeight(p, t);
  float hx = waveHeight(p + vec2(eps, 0.0), t) - h;
  float hy = waveHeight(p + vec2(0.0, eps), t) - h;
  return normalize(vec3(-hx / eps, 1.0, -hy / eps));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float t = u_time;

  // Camera perspective plane setup
  vec3 ro = vec3(0.0, 3.5, -4.5);
  vec3 rd = normalize(vec3(uv.x, uv.y - 0.35, 1.2));

  // Ray plane intersection on liquid average surface y = 0
  float d = -ro.y / rd.y;
  vec3 col = vec3(0.02, 0.03, 0.06);

  if (d > 0.0 && d < 25.0) {
    vec3 hitPos = ro + rd * d;
    vec2 p = hitPos.xz;

    float h = waveHeight(p, t);
    vec3 normal = getNormal(p, t);

    // Light source from above-right
    vec3 lightDir = normalize(vec3(0.6, 0.8, -0.4));
    float diff = max(0.0, dot(normal, lightDir));

    // Specular highlight reflection
    vec3 viewDir = -rd;
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(0.0, dot(viewDir, reflectDir)), 32.0);

    // Color gradient based on wave height & audio bands
    vec3 oceanBlue = vec3(0.03, 0.12, 0.35);
    vec3 cyanGlow = vec3(0.024, 0.714, 0.831);
    vec3 purpleCrest = vec3(0.658, 0.333, 0.968);
    vec3 pinkFlash = vec3(0.925, 0.282, 0.600);

    float normH = clamp((h + 0.6) * 0.8, 0.0, 1.0);
    vec3 waterColor = mix(oceanBlue, cyanGlow, normH);
    waterColor = mix(waterColor, purpleCrest, smoothstep(0.5, 1.0, normH));
    waterColor += pinkFlash * (spec * (1.2 + u_beat * 2.0));

    // Distance fog falloff
    float fog = exp(-d * 0.12);
    col = mix(col, waterColor * (0.6 + diff * 0.7), fog);
  }

  // Atmospheric ambient glow
  col += vec3(0.06, 0.03, 0.15) * (0.5 + u_energy * 0.5);

  fragColor = vec4(col, 1.0);
}
`;

  public initialize(gl: WebGL2RenderingContext): boolean {
    this.dispose(gl);

    this.program = WebGLUtils.createProgram(
      gl,
      WebGLUtils.QUAD_VERTEX_SHADER,
      LiquidWavePreset.FRAGMENT_SHADER
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
