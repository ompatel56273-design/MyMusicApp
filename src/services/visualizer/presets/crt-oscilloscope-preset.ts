import type { VisualizerPreset, VisualizerRenderContext } from '../visualizer-types';
import { WebGLUtils } from '../webgl-utils';

export class CrtOscilloscopePreset implements VisualizerPreset {
  public readonly id = 'crt-oscilloscope';
  public readonly name = 'Oscilloscope Phosphor CRT';
  public readonly description = 'Vintage laboratory vector CRT oscilloscope tracing real time-domain audio waveforms.';

  private program: WebGLProgram | null = null;
  private quadGeo: { vao: WebGLVertexArrayObject; vbo: WebGLBuffer } | null = null;
  private waveTexture: WebGLTexture | null = null;

  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uWaveTexLoc: WebGLUniformLocation | null = null;
  private uEnergyLoc: WebGLUniformLocation | null = null;
  private uBeatLoc: WebGLUniformLocation | null = null;
  private uReducedMotionLoc: WebGLUniformLocation | null = null;

  private static readonly FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_wave_texture;
uniform float u_energy;
uniform float u_beat;
uniform int u_reduced_motion;

// CRT Screen Distortion
vec2 crtDistort(vec2 uv) {
  uv = (uv - 0.5) * 2.0;
  uv *= 1.1;
  uv.x *= 1.0 + pow(abs(uv.y) / 5.0, 2.0);
  uv.y *= 1.0 + pow(abs(uv.x) / 4.0, 2.0);
  uv = (uv / 2.0) + 0.5;
  return uv;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 crtUv = crtDistort(uv);

  // Black screen outside bezel
  if (crtUv.x < 0.0 || crtUv.x > 1.0 || crtUv.y < 0.0 || crtUv.y > 1.0) {
    fragColor = vec4(0.01, 0.01, 0.02, 1.0);
    return;
  }

  // 1. Grid Reticle
  vec2 gridCoord = fract(crtUv * vec2(10.0, 8.0));
  float gridLine = step(0.96, gridCoord.x) + step(0.96, gridCoord.y);
  vec3 gridColor = vec3(0.0, 0.25, 0.15) * gridLine * 0.35;

  // Center axes lines
  vec2 axisDist = abs(crtUv - 0.5);
  float axis = step(axisDist.x, 0.002) + step(axisDist.y, 0.0025);
  gridColor += vec3(0.0, 0.5, 0.3) * axis * 0.5;

  // 2. Real Time-Domain Audio Waveform Sampling
  float sampleX = clamp(crtUv.x, 0.0, 1.0);
  float waveVal = texture(u_wave_texture, vec2(sampleX, 0.5)).r;

  // Normalize sample [0.0..1.0] centered at 0.5
  float waveY = (waveVal - 0.5) * (1.2 + u_beat * 0.4) + 0.5;

  // Trace line distance & glow
  float distToTrace = abs(crtUv.y - waveY);
  float traceCore = smoothstep(0.008, 0.0, distToTrace);
  float traceGlow = smoothstep(0.08, 0.0, distToTrace) * 0.6;
  float wideGlow = smoothstep(0.25, 0.0, distToTrace) * 0.2;

  // Phosphor Green/Cyan Palette
  vec3 phosphorCore = vec3(0.85, 1.0, 0.95);
  vec3 phosphorGreen = vec3(0.1, 0.95, 0.45);
  vec3 phosphorCyan = vec3(0.024, 0.714, 0.831);

  vec3 traceColor = phosphorCore * traceCore + phosphorGreen * traceGlow + phosphorCyan * wideGlow;
  traceColor *= (0.8 + u_energy * 0.6 + u_beat * 0.8);

  // 3. CRT Scanlines & Shadow Mask
  float scanline = sin(crtUv.y * u_resolution.y * 1.5) * 0.5 + 0.5;
  scanline = mix(0.75, 1.0, scanline);

  // 4. Subtle Vignette & Screen Bloom
  float vig = 16.0 * crtUv.x * crtUv.y * (1.0 - crtUv.x) * (1.0 - crtUv.y);
  vig = clamp(pow(vig, 0.25), 0.0, 1.0);

  // Ambient tube glow
  vec3 ambientTube = vec3(0.01, 0.04, 0.03);

  vec3 finalColor = (ambientTube + gridColor + traceColor) * scanline * vig;

  fragColor = vec4(finalColor, 1.0);
}
`;

  public initialize(gl: WebGL2RenderingContext): boolean {
    this.dispose(gl);

    this.program = WebGLUtils.createProgram(
      gl,
      WebGLUtils.QUAD_VERTEX_SHADER,
      CrtOscilloscopePreset.FRAGMENT_SHADER
    );
    if (!this.program) return false;

    this.quadGeo = WebGLUtils.createQuadGeometry(gl);
    if (!this.quadGeo) return false;

    this.waveTexture = WebGLUtils.createAudioTexture(gl, 128);
    if (!this.waveTexture) return false;

    this.uResolutionLoc = gl.getUniformLocation(this.program, 'u_resolution');
    this.uTimeLoc = gl.getUniformLocation(this.program, 'u_time');
    this.uWaveTexLoc = gl.getUniformLocation(this.program, 'u_wave_texture');
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
    if (!this.program || !this.quadGeo || !this.waveTexture) return;

    // Upload time domain audio data to texture
    WebGLUtils.updateAudioTexture(gl, this.waveTexture, ctx.audio.timeDomainData, 128);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.quadGeo.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.waveTexture);
    gl.uniform1i(this.uWaveTexLoc, 0);

    gl.uniform2f(this.uResolutionLoc, ctx.width, ctx.height);
    gl.uniform1f(this.uTimeLoc, ctx.time);
    gl.uniform1f(this.uEnergyLoc, ctx.audio.energy);
    gl.uniform1f(this.uBeatLoc, ctx.audio.beatPulse);
    gl.uniform1i(this.uReducedMotionLoc, ctx.reducedMotion ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  public dispose(gl: WebGL2RenderingContext): void {
    if (this.waveTexture) {
      gl.deleteTexture(this.waveTexture);
      this.waveTexture = null;
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
