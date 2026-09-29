import { describe, it, expect } from 'vitest';
import { WebGLUtils } from '../../src/services/visualizer/webgl-utils';

describe('WebGLUtils', () => {
  it('detects system WebGL capabilities safely without throwing', () => {
    const caps = WebGLUtils.getCapabilities();
    expect(typeof caps.webgl2Supported).toBe('boolean');
    expect(typeof caps.maxTextureSize).toBe('number');
    expect(typeof caps.vendor).toBe('string');
    expect(typeof caps.renderer).toBe('string');
  });

  it('provides a valid standard full-screen quad vertex shader string', () => {
    expect(WebGLUtils.QUAD_VERTEX_SHADER).toContain('#version 300 es');
    expect(WebGLUtils.QUAD_VERTEX_SHADER).toContain('a_position');
    expect(WebGLUtils.QUAD_VERTEX_SHADER).toContain('v_uv');
  });
});
