/**
 * TSL Fn node invocation tests for tsl-shared.ts.
 *
 * These tests call the exported TSL Fn nodes to exercise the function
 * bodies that build the shader node graph, covering lines 112-131,
 * 145-148, 162-163, 182-195, 211-218.
 */

import { Vector2, Vector3, DataTexture } from 'three';
import { float, vec2, vec3, vec4, texture } from 'three/tsl';
import {
  computeFrameIndex,
  computeSpriteSheetUV,
  linearizeDepth,
  computeSoftParticleFade,
  applyBackgroundDiscard,
  createParticleUniforms,
  getDummyTexture,
  type SharedUniforms,
} from '../js/effects/three-particles/webgpu/tsl-shared.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function callNode(fn: unknown, args: Record<string, unknown>): unknown {
  return (fn as (args: Record<string, unknown>) => unknown)(args);
}

// ─── computeFrameIndex ──────────────────────────────────────────────────────

describe('computeFrameIndex invocation', () => {
  it('builds node graph for lifetime-based frame index', () => {
    const result = callNode(computeFrameIndex, {
      vLifetime: float(500),
      vStartLifetime: float(2000),
      vStartFrame: float(0),
      uFps: float(30),
      uUseFPSForFrameIndex: float(0),
      uTiles: vec2(4, 4),
    });
    expect(result).toBeDefined();
  });

  it('builds node graph for FPS-based frame index', () => {
    const result = callNode(computeFrameIndex, {
      vLifetime: float(1000),
      vStartLifetime: float(3000),
      vStartFrame: float(2),
      uFps: float(24),
      uUseFPSForFrameIndex: float(1),
      uTiles: vec2(8, 8),
    });
    expect(result).toBeDefined();
  });

  it('handles fps=0 edge case', () => {
    expect(() =>
      callNode(computeFrameIndex, {
        vLifetime: float(500),
        vStartLifetime: float(2000),
        vStartFrame: float(0),
        uFps: float(0),
        uUseFPSForFrameIndex: float(1),
        uTiles: vec2(1, 1),
      })
    ).not.toThrow();
  });
});

// ─── computeSpriteSheetUV ───────────────────────────────────────────────────

describe('computeSpriteSheetUV invocation', () => {
  it('builds UV node for multi-tile sprite sheet', () => {
    const result = callNode(computeSpriteSheetUV, {
      baseUV: vec2(0.5, 0.5),
      frameIndex: float(5),
      uTiles: vec2(4, 4),
    });
    expect(result).toBeDefined();
  });

  it('handles single-tile (1x1) sheet', () => {
    expect(() =>
      callNode(computeSpriteSheetUV, {
        baseUV: vec2(0, 0),
        frameIndex: float(0),
        uTiles: vec2(1, 1),
      })
    ).not.toThrow();
  });
});

// ─── linearizeDepth ─────────────────────────────────────────────────────────

describe('linearizeDepth invocation', () => {
  it('builds linearization node', () => {
    const result = callNode(linearizeDepth, {
      depthSample: float(0.5),
      near: float(0.1),
      far: float(1000),
    });
    expect(result).toBeDefined();
  });
});

// ─── computeSoftParticleFade ────────────────────────────────────────────────

describe('computeSoftParticleFade invocation', () => {
  it('builds fade node with soft particles enabled', () => {
    const dummy = getDummyTexture();
    const result = callNode(computeSoftParticleFade, {
      viewZ: float(5),
      uSoftEnabled: float(1),
      uSoftIntensity: float(2),
      uSceneDepthTex: texture(dummy),
      uCameraNearFar: vec2(0.1, 500),
    });
    expect(result).toBeDefined();
  });

  it('builds fade node with soft particles disabled', () => {
    const dummy = getDummyTexture();
    const result = callNode(computeSoftParticleFade, {
      viewZ: float(10),
      uSoftEnabled: float(0),
      uSoftIntensity: float(1),
      uSceneDepthTex: texture(dummy),
      uCameraNearFar: vec2(0.1, 1000),
    });
    expect(result).toBeDefined();
  });
});

// ─── applyBackgroundDiscard ─────────────────────────────────────────────────

describe('applyBackgroundDiscard invocation', () => {
  it('builds discard node with background check enabled', () => {
    expect(() =>
      callNode(applyBackgroundDiscard, {
        texColor: vec4(0, 0, 0, 1),
        uDiscardBg: float(1),
        uBgColor: vec3(0, 0, 0),
        uBgTolerance: float(0.05),
      })
    ).not.toThrow();
  });

  it('builds discard node with background check disabled', () => {
    expect(() =>
      callNode(applyBackgroundDiscard, {
        texColor: vec4(1, 0, 0, 1),
        uDiscardBg: float(0),
        uBgColor: vec3(0, 0, 0),
        uBgTolerance: float(0.01),
      })
    ).not.toThrow();
  });
});

// ─── createParticleUniforms extended ────────────────────────────────────────

describe('createParticleUniforms', () => {
  function makeUniforms(extras: Partial<SharedUniforms> = {}): SharedUniforms {
    return {
      map: { value: null },
      elapsed: { value: 100 },
      fps: { value: 30 },
      useFPSForFrameIndex: { value: true },
      tiles: { value: new Vector2(4, 4) },
      discardBackgroundColor: { value: true },
      backgroundColor: { value: { r: 0.1, g: 0.2, b: 0.3 } },
      backgroundColorTolerance: { value: 0.05 },
      softParticlesEnabled: { value: true },
      softParticlesIntensity: { value: 2 },
      sceneDepthTexture: { value: null },
      cameraNearFar: { value: new Vector2(0.1, 1000) },
      ...extras,
    } as SharedUniforms;
  }

  it('converts all boolean uniforms to float nodes', () => {
    const u = createParticleUniforms(makeUniforms());
    expect(u.uUseFPSForFrameIndex).toBeDefined();
    expect(u.uDiscardBg).toBeDefined();
    expect(u.uSoftEnabled).toBeDefined();
  });

  it('uses provided map texture when not null', () => {
    const tex = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    const u = createParticleUniforms(makeUniforms({ map: { value: tex } }));
    expect(u.uMap).toBe(tex);
  });

  it('falls back to dummy texture for null map', () => {
    const u = createParticleUniforms(makeUniforms({ map: { value: null } }));
    expect(u.uMap).toBe(getDummyTexture());
  });

  it('sets texture colorSpace to NoColorSpace to bypass hardware sRGB conversion', () => {
    const tex = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
    tex.colorSpace = 'srgb';
    const u = createParticleUniforms(makeUniforms({ map: { value: tex } }));
    expect(u.uMap.colorSpace).toBe('');
  });
});
