/**
 * Tests for createInstancedBillboardTSLMaterial
 *
 * Verifies that the TSL material:
 * - Returns a MeshBasicNodeMaterial
 * - Propagates renderer config (transparent, blending, depthTest, depthWrite)
 * - Sets vertexNode and colorNode
 * - Back-patches sharedUniforms.viewportHeight with the TSL uniform node
 *   so live updates to .value are reflected in the shader graph
 * - Does not throw for missing viewportHeight in sharedUniforms
 * - Accepts all standard SharedUniforms fields
 */

import { AdditiveBlending } from 'three';
import { Vector2 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createInstancedBillboardTSLMaterial } from '../js/effects/three-particles/webgpu/tsl-instanced-billboard-material.js';
import type { SharedUniforms } from '../js/effects/three-particles/webgpu/tsl-shared.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal SharedUniforms object with sensible defaults.
 * Optionally includes `viewportHeight` to simulate the instanced code path.
 */
function makeSharedUniforms(includeViewportHeight = true): SharedUniforms {
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
    ...(includeViewportHeight ? { viewportHeight: { value: 1.0 } } : {}),
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

// ─── createInstancedBillboardTSLMaterial ────────────────────────────────────

describe('createInstancedBillboardTSLMaterial', () => {
  // ── Return type ────────────────────────────────────────────────────────────

  describe('return type', () => {
    it('returns a MeshBasicNodeMaterial instance', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    });
  });

  // ── Renderer config propagation ────────────────────────────────────────────

  describe('renderer config', () => {
    it('sets transparent from rendererConfig', () => {
      const mat = createInstancedBillboardTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        transparent: true,
      });
      expect(mat.transparent).toBe(true);
    });

    it('sets transparent=false from rendererConfig', () => {
      const mat = createInstancedBillboardTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        transparent: false,
      });
      expect(mat.transparent).toBe(false);
    });

    it('sets blending from rendererConfig', () => {
      const mat = createInstancedBillboardTSLMaterial(makeSharedUniforms(), {
        ...makeRendererConfig(),
        blending: AdditiveBlending,
      });
      expect(mat.blending).toBe(AdditiveBlending);
    });

    it('sets depthTest from rendererConfig', () => {
      const matTrue = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), depthTest: true }
      );
      expect(matTrue.depthTest).toBe(true);

      const matFalse = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), depthTest: false }
      );
      expect(matFalse.depthTest).toBe(false);
    });

    it('sets depthWrite from rendererConfig', () => {
      const matTrue = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), depthWrite: true }
      );
      expect(matTrue.depthWrite).toBe(true);

      const matFalse = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), depthWrite: false }
      );
      expect(matFalse.depthWrite).toBe(false);
    });

    it('disables tone mapping to match GLSL ShaderMaterial output', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.toneMapped).toBe(false);
    });

    it('disables fog to match GLSL ShaderMaterial output', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.fog).toBe(false);
    });
  });

  // ── Shader nodes ──────────────────────────────────────────────────────────

  describe('shader nodes', () => {
    it('sets vertexNode (billboard clip-space transform)', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.vertexNode).not.toBeNull();
    });

    it('sets colorNode (fragment color with rotation, texture, discards)', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });

    it('vertexNode and colorNode are distinct nodes', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat.vertexNode).not.toBe(mat.colorNode);
    });
  });

  // ── viewportHeight back-patch ─────────────────────────────────────────────

  describe('viewportHeight uniform back-patch', () => {
    it('replaces sharedUniforms.viewportHeight with a TSL uniform node', () => {
      const uniforms = makeSharedUniforms(true);
      createInstancedBillboardTSLMaterial(uniforms, makeRendererConfig());

      // The original plain object { value: 1.0 } should now be a TSL node
      // that has a numeric .value property
      expect(uniforms.viewportHeight).toBeDefined();
      expect(typeof (uniforms.viewportHeight as { value: number }).value).toBe(
        'number'
      );
    });

    it('initialises viewportHeight.value from the incoming sharedUniforms value', () => {
      const uniforms = makeSharedUniforms(true);
      (uniforms.viewportHeight as { value: number }).value = 768;

      createInstancedBillboardTSLMaterial(uniforms, makeRendererConfig());

      expect((uniforms.viewportHeight as { value: number }).value).toBe(768);
    });

    it('allows live updates to viewportHeight.value after creation', () => {
      const uniforms = makeSharedUniforms(true);
      createInstancedBillboardTSLMaterial(uniforms, makeRendererConfig());

      // Simulate what onBeforeRender does
      (uniforms.viewportHeight as { value: number }).value = 1080;
      expect((uniforms.viewportHeight as { value: number }).value).toBe(1080);

      (uniforms.viewportHeight as { value: number }).value = 2160;
      expect((uniforms.viewportHeight as { value: number }).value).toBe(2160);
    });

    it('does not throw when viewportHeight is absent from sharedUniforms', () => {
      const uniforms = makeSharedUniforms(false);
      expect(() =>
        createInstancedBillboardTSLMaterial(uniforms, makeRendererConfig())
      ).not.toThrow();
    });

    it('defaults viewportHeight to 1.0 when absent from sharedUniforms', () => {
      const uniforms = makeSharedUniforms(false);
      createInstancedBillboardTSLMaterial(uniforms, makeRendererConfig());

      // After creation the back-patch installs a node even when viewportHeight
      // was missing; the installed node should start at 1.0
      expect((uniforms.viewportHeight as { value: number }).value).toBeCloseTo(
        1.0
      );
    });
  });

  // ── Multiple instances ────────────────────────────────────────────────────

  describe('multiple instances', () => {
    it('returns independent material instances', () => {
      const mat1 = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      const mat2 = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat1).not.toBe(mat2);
    });

    it('each instance has its own vertexNode', () => {
      const mat1 = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      const mat2 = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect(mat1.vertexNode).not.toBe(mat2.vertexNode);
    });
  });

  // ── Soft particles ────────────────────────────────────────────────────────

  describe('soft particles', () => {
    it('does not throw when softParticlesEnabled is true', () => {
      const uniforms = makeSharedUniforms();
      uniforms.softParticlesEnabled = { value: true };
      expect(() =>
        createInstancedBillboardTSLMaterial(uniforms, makeRendererConfig())
      ).not.toThrow();
    });
  });

  // ── isNode duck-typing ────────────────────────────────────────────────────

  describe('node graph duck-typing', () => {
    it('vertexNode has the isNode property (is a valid TSL node)', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      // TSL nodes expose isNode = true
      expect((mat.vertexNode as unknown as { isNode?: boolean })?.isNode).toBe(
        true
      );
    });

    it('colorNode has the isNode property (is a valid TSL node)', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig()
      );
      expect((mat.colorNode as unknown as { isNode?: boolean })?.isNode).toBe(
        true
      );
    });
  });
});
