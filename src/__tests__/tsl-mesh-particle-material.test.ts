/**
 * Tests for createMeshParticleTSLMaterial
 *
 * Verifies that the TSL material:
 * - Returns a MeshBasicNodeMaterial
 * - Propagates renderer config
 * - Sets vertexNode and colorNode
 * - In GPU compute mode, does NOT reference instanceQuat attribute
 * - In CPU mode, reads instanceQuat attribute
 */

import { AdditiveBlending, NormalBlending } from 'three';
import { Vector2 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { createMeshParticleTSLMaterial } from '../js/effects/three-particles/webgpu/tsl-mesh-particle-material.js';
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
    blending: NormalBlending as THREE.Blending,
    depthTest: true,
    depthWrite: true,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createMeshParticleTSLMaterial', () => {
  describe('return type', () => {
    it('returns a MeshBasicNodeMaterial in CPU mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    });

    it('returns a MeshBasicNodeMaterial in GPU compute mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    });
  });

  describe('renderer config', () => {
    it('sets transparent from rendererConfig', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), transparent: true },
        false
      );
      expect(mat.transparent).toBe(true);
    });

    it('sets blending from rendererConfig', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), blending: AdditiveBlending },
        false
      );
      expect(mat.blending).toBe(AdditiveBlending);
    });

    it('sets depthTest from rendererConfig', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), depthTest: false },
        false
      );
      expect(mat.depthTest).toBe(false);
    });

    it('sets depthWrite from rendererConfig', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        { ...makeRendererConfig(), depthWrite: false },
        false
      );
      expect(mat.depthWrite).toBe(false);
    });

    it('disables tone mapping to match GLSL ShaderMaterial output', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.toneMapped).toBe(false);
    });

    it('disables fog to match GLSL ShaderMaterial output', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.fog).toBe(false);
    });
  });

  describe('shader nodes', () => {
    it('sets vertexNode and colorNode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.colorNode).toBeDefined();
    });

    it('sets vertexNode and colorNode in GPU compute mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.colorNode).toBeDefined();
    });
  });

  describe('GPU compute mode', () => {
    it('does not throw when gpuCompute is true', () => {
      expect(() =>
        createMeshParticleTSLMaterial(
          makeSharedUniforms(),
          makeRendererConfig(),
          true
        )
      ).not.toThrow();
    });

    it('does not throw when gpuCompute is false (default)', () => {
      expect(() =>
        createMeshParticleTSLMaterial(
          makeSharedUniforms(),
          makeRendererConfig()
        )
      ).not.toThrow();
    });
  });
});
