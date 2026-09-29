import { Logger } from '../../core/logging/logger';
import type { VisualizerCapabilities } from './visualizer-types';

const logger = new Logger('WebGLUtils');

export class WebGLUtils {
  /**
   * Probes system capabilities for WebGL 2.0 support.
   */
  public static getCapabilities(): VisualizerCapabilities {
    if (typeof document === 'undefined') {
      return {
        webgl2Supported: false,
        maxTextureSize: 0,
        vendor: 'unknown',
        renderer: 'unknown'
      };
    }

    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      if (!gl) {
        return {
          webgl2Supported: false,
          maxTextureSize: 0,
          vendor: 'unavailable',
          renderer: 'unavailable'
        };
      }

      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
      const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
      const vendor = dbgExt ? gl.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      const renderer = dbgExt ? gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

      // Clean up test context
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt) {
        loseExt.loseContext();
      }

      return {
        webgl2Supported: true,
        maxTextureSize,
        vendor: String(vendor || 'Generic'),
        renderer: String(renderer || 'Generic WebGL2')
      };
    } catch (_err) {
      return {
        webgl2Supported: false,
        maxTextureSize: 0,
        vendor: 'error',
        renderer: 'error'
      };
    }
  }

  /**
   * Compiles a WebGL shader safely with error logging.
   */
  public static compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) {
      logger.error('Failed to create WebGL shader object.');
      return null;
    }

    gl.shaderSource(shader, source.trim());
    gl.compileShader(shader);

    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
      const info = gl.getShaderInfoLog(shader);
      logger.error(`Shader compilation failed: ${info}\nSource:\n${source}`);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Creates, attaches shaders, links and validates a WebGLProgram.
   */
  public static createProgram(
    gl: WebGL2RenderingContext,
    vertexShaderSrc: string,
    fragmentShaderSrc: string
  ): WebGLProgram | null {
    const vertShader = WebGLUtils.compileShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
    if (!vertShader) return null;

    const fragShader = WebGLUtils.compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
    if (!fragShader) {
      gl.deleteShader(vertShader);
      return null;
    }

    const program = gl.createProgram();
    if (!program) {
      logger.error('Failed to create WebGL program object.');
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return null;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
      const info = gl.getProgramInfoLog(program);
      logger.error(`WebGL Program linking failed: ${info}`);
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return null;
    }

    // Shaders can be marked for deletion once linked into the program
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    return program;
  }

  /**
   * Standard full-screen quad vertex shader for GLSL ES 3.00.
   */
  public static readonly QUAD_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

  /**
   * Sets up standard full-screen quad geometry and returns VAO + VBO.
   */
  public static createQuadGeometry(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; vbo: WebGLBuffer } | null {
    const vao = gl.createVertexArray();
    const vbo = gl.createBuffer();
    if (!vao || !vbo) {
      return null;
    }

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    // Full screen 2-triangle strip: [-1, -1], [1, -1], [-1, 1], [1, 1]
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
       1.0,  1.0,
    ]);

    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return { vao, vbo };
  }

  /**
   * Creates a 1D/2D audio data texture for feeding frequency or time-domain arrays to shaders.
   */
  public static createAudioTexture(gl: WebGL2RenderingContext, size: number): WebGLTexture | null {
    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Initial dummy allocation with size x 1
    const initialData = new Uint8Array(size);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      size,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      initialData
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  /**
   * Updates existing audio texture with fresh Uint8Array byte data.
   */
  public static updateAudioTexture(
    gl: WebGL2RenderingContext,
    texture: WebGLTexture,
    data: Uint8Array,
    size: number
  ): void {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      size,
      1,
      gl.RED,
      gl.UNSIGNED_BYTE,
      data
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}
