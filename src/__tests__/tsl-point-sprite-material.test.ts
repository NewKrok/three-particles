/**
 * Tests for createPointSpriteTSLMaterial
 *
 * Verifies that the TSL material:
 * - Returns a PointsNodeMaterial
 * - Propagates renderer config (transparent, blending, depthTest, depthWrite)
 * - Sets sizeNode, positionNode, and colorNode
 * - Supports both CPU (individual attributes) and GPU compute (packed vec4 buffers) modes
 */

import { AdditiveBlending, NormalBlending } from 'three';
import { Vector2 } from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { createPointSpriteTSLMaterial } from '../js/effects/three-particles/webgpu/tsl-point-sprite-material.js';
import type { SharedUniforms } from '../js/effects/three-particles/webgpu/tsl-shared.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSharedUniforms(): SharedUniforms {
  return {
    map: { value: null },
    elapsed: { value: 0 },
    fps: { value: 0 },
    useFPSForFrameIndex: { value: false },
    tiles: { value: new Vector2(1, 1) },
    discardBackgroundColor: { value: false },
    backgroundColor: { value: { r: 0, g: 0, b: 0 } },
    backgroundColorTolerance: { value: 0.01 },
    softParticlesEnabled: { value: false },
    softParticlesIntensity: { value: 1.0 },
    sceneDepthTexture: { value: null },
    cameraNearFar: { value: new Vector2(0.1, 1000) },
  } as SharedUniforms;
}

function makeRendererConfig() {
  return {
    transparent: true,
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  };
}

// ─── createPointSpriteTSLMaterial ─────────────────────────────────────────────

describe('createPointSpriteTSLMaterial', () => {
  // ── Return type ──────────────────────────────────────────────────────────

  describe('return type', () => {
    it('returns a PointsNodeMaterial instance', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat).toBeInstanceOf(PointsNodeMaterial);
    });

    it('returns a PointsNodeMaterial in GPU compute mode', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat).toBeInstanceOf(PointsNodeMaterial);
    });
  });

  // ── Renderer config propagation ──────────────────────────────────────────

  describe('renderer config', () => {
    it('sets transparent from rendererConfig', () => {
      const mat = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        transparent: true,
      });
      expect(mat.transparent).toBe(true);
    });

    it('sets transparent=false from rendererConfig', () => {
      const mat = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        transparent: false,
      });
      expect(mat.transparent).toBe(false);
    });

    it('sets blending from rendererConfig', () => {
      const mat = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        blending: NormalBlending,
      });
      expect(mat.blending).toBe(NormalBlending);
    });

    it('sets depthTest from rendererConfig', () => {
      const matTrue = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        depthTest: true,
      });
      expect(matTrue.depthTest).toBe(true);

      const matFalse = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        depthTest: false,
      });
      expect(matFalse.depthTest).toBe(false);
    });

    it('sets depthWrite from rendererConfig', () => {
      const matTrue = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        depthWrite: true,
      });
      expect(matTrue.depthWrite).toBe(true);

      const matFalse = createPointSpriteTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        depthWrite: false,
      });
      expect(matFalse.depthWrite).toBe(false);
    });
  });

  // ── Shader nodes ────────────────────────────────────────────────────────

  describe('shader nodes', () => {
    it('sets sizeNode (distance-based point size)', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.sizeNode).toBeDefined();
      expect(mat.sizeNode).not.toBeNull();
    });

    it('sets positionNode (vertex setup with varyings)', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.positionNode).toBeDefined();
      expect(mat.positionNode).not.toBeNull();
    });

    it('sets colorNode (fragment color with rotation, texture, discards)', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });

    it('sizeNode and colorNode are distinct nodes', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.sizeNode).not.toBe(mat.colorNode);
    });
  });

  // ── GPU compute mode ──────────────────────────────────────────────────────

  describe('GPU compute mode', () => {
    it('creates material without error in GPU compute mode', () => {
      expect(() =>
        createPointSpriteTSLMaterial(
          makeSharedUniforms(),
          makeRendererConfig(),
          true
        )
      ).not.toThrow();
    });

    it('sets sizeNode in GPU compute mode', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.sizeNode).toBeDefined();
      expect(mat.sizeNode).not.toBeNull();
    });

    it('sets positionNode in GPU compute mode', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.positionNode).toBeDefined();
      expect(mat.positionNode).not.toBeNull();
    });

    it('sets colorNode in GPU compute mode', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });
  });

  // ── Multiple instances ──────────────────────────────────────────────────

  describe('multiple instances', () => {
    it('returns independent material instances', () => {
      const mat1 = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      const mat2 = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat1).not.toBe(mat2);
    });
  });

  // ── Soft particles ──────────────────────────────────────────────────────

  describe('soft particles', () => {
    it('does not throw when softParticlesEnabled is true', () => {
      const uniforms = makeSharedUniforms();
      uniforms.softParticlesEnabled = { value: true };
      expect(() =>
        createPointSpriteTSLMaterial(uniforms, makeRendererConfig())
      ).not.toThrow();
    });
  });

  // ── isNode duck-typing ──────────────────────────────────────────────────

  describe('node graph duck-typing', () => {
    it('sizeNode has the isNode property (is a valid TSL node)', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect((mat.sizeNode as unknown as { isNode?: boolean })?.isNode).toBe(
        true
      );
    });

    it('colorNode has the isNode property (is a valid TSL node)', () => {
      const mat = createPointSpriteTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect((mat.colorNode as unknown as { isNode?: boolean })?.isNode).toBe(
        true
      );
    });
  });

  // ── gpuCompute defaults to false ──────────────────────────────────────────

  describe('gpuCompute parameter', () => {
    it('defaults to CPU mode when gpuCompute is not provided', () => {
      // Should not throw — uses individual attributes (size, lifetime, etc.)
      expect(() =>
        createPointSpriteTSLMaterial(makeSharedUniforms(), makeRendererConfig())
      ).not.toThrow();
    });

    it('defaults to CPU mode when gpuCompute is false', () => {
      expect(() =>
        createPointSpriteTSLMaterial(
          makeSharedUniforms(),
          makeRendererConfig(),
          false
        )
      ).not.toThrow();
    });
  });
});
