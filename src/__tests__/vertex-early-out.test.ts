/**
 * Tests for the vertex shader early-out optimization for dead particles.
 *
 * The optimization adds early-out logic to vertex shaders so dead particles
 * (alpha=0) skip expensive transforms and emit degenerate clip-space positions
 * that produce zero-area triangles.
 *
 * Covered shaders / materials:
 *  - GLSL mesh vertex shader
 *  - GLSL instanced vertex shader
 *  - TSL mesh particle material
 *  - TSL instanced billboard material
 */

import { NormalBlending, Vector2 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import InstancedParticleVertexShader from '../js/effects/three-particles/shaders/instanced-particle-vertex-shader.glsl.js';
import MeshParticleVertexShader from '../js/effects/three-particles/shaders/mesh-particle-vertex-shader.glsl.js';
import { createInstancedBillboardTSLMaterial } from '../js/effects/three-particles/webgpu/tsl-instanced-billboard-material.js';
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

function makeInstancedSharedUniforms(): SharedUniforms {
  return {
    ...makeSharedUniforms(),
    viewportHeight: { value: 1.0 },
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

describe('Vertex early-out optimization for dead particles', () => {
  // ── GLSL mesh vertex shader ───────────────────────────────────────────────

  describe('GLSL mesh vertex shader', () => {
    it('contains the instanceColor.a early-out condition', () => {
      expect(MeshParticleVertexShader).toContain('instanceColor.a <= 0.0');
    });

    it('contains the degenerate clip-space position vec4(0.0, 0.0, 0.0, 0.0)', () => {
      expect(MeshParticleVertexShader).toContain('vec4(0.0, 0.0, 0.0, 0.0)');
    });

    it('places the early-out before the main transform logic (modelViewMatrix)', () => {
      const earlyOutIndex = MeshParticleVertexShader.indexOf(
        'instanceColor.a <= 0.0'
      );
      const transformIndex =
        MeshParticleVertexShader.indexOf('modelViewMatrix');

      expect(earlyOutIndex).toBeGreaterThan(-1);
      expect(transformIndex).toBeGreaterThan(-1);
      expect(earlyOutIndex).toBeLessThan(transformIndex);
    });

    it('uses return after the degenerate position assignment', () => {
      // The pattern should be: gl_Position = vec4(0,0,0,0); return;
      expect(MeshParticleVertexShader).toMatch(
        /gl_Position\s*=\s*vec4\(0\.0,\s*0\.0,\s*0\.0,\s*0\.0\);\s*return;/
      );
    });
  });

  // ── GLSL instanced vertex shader ──────────────────────────────────────────

  describe('GLSL instanced vertex shader', () => {
    it('contains the instanceColor.a early-out condition', () => {
      expect(InstancedParticleVertexShader).toContain('instanceColor.a <= 0.0');
    });

    it('contains the degenerate clip-space position vec4(0.0, 0.0, 0.0, 0.0)', () => {
      expect(InstancedParticleVertexShader).toContain(
        'vec4(0.0, 0.0, 0.0, 0.0)'
      );
    });

    it('places the early-out before the main transform logic (modelViewMatrix)', () => {
      const earlyOutIndex = InstancedParticleVertexShader.indexOf(
        'instanceColor.a <= 0.0'
      );
      const transformIndex =
        InstancedParticleVertexShader.indexOf('modelViewMatrix');

      expect(earlyOutIndex).toBeGreaterThan(-1);
      expect(transformIndex).toBeGreaterThan(-1);
      expect(earlyOutIndex).toBeLessThan(transformIndex);
    });

    it('uses return after the degenerate position assignment', () => {
      expect(InstancedParticleVertexShader).toMatch(
        /gl_Position\s*=\s*vec4\(0\.0,\s*0\.0,\s*0\.0,\s*0\.0\);\s*return;/
      );
    });
  });

  // ── TSL mesh material (no regression) ─────────────────────────────────────

  describe('TSL mesh material (no regression)', () => {
    it('creates successfully in CPU mode', () => {
      expect(() =>
        createMeshParticleTSLMaterial(
          makeSharedUniforms(),
          makeRendererConfig(),
          false
        )
      ).not.toThrow();
    });

    it('creates successfully in GPU compute mode', () => {
      expect(() =>
        createMeshParticleTSLMaterial(
          makeSharedUniforms(),
          makeRendererConfig(),
          true
        )
      ).not.toThrow();
    });

    it('sets vertexNode in CPU mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.vertexNode).not.toBeNull();
    });

    it('sets colorNode in CPU mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });

    it('sets vertexNode in GPU compute mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.vertexNode).not.toBeNull();
    });

    it('sets colorNode in GPU compute mode', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });

    it('returns a MeshBasicNodeMaterial', () => {
      const mat = createMeshParticleTSLMaterial(
        makeSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    });
  });

  // ── TSL instanced billboard material (no regression) ──────────────────────

  describe('TSL instanced billboard material (no regression)', () => {
    it('creates successfully in CPU mode', () => {
      expect(() =>
        createInstancedBillboardTSLMaterial(
          makeInstancedSharedUniforms(),
          makeRendererConfig(),
          false
        )
      ).not.toThrow();
    });

    it('creates successfully in GPU compute mode', () => {
      expect(() =>
        createInstancedBillboardTSLMaterial(
          makeInstancedSharedUniforms(),
          makeRendererConfig(),
          true
        )
      ).not.toThrow();
    });

    it('sets vertexNode in CPU mode', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeInstancedSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.vertexNode).not.toBeNull();
    });

    it('sets colorNode in CPU mode', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeInstancedSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });

    it('sets vertexNode in GPU compute mode', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeInstancedSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.vertexNode).toBeDefined();
      expect(mat.vertexNode).not.toBeNull();
    });

    it('sets colorNode in GPU compute mode', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeInstancedSharedUniforms(),
        makeRendererConfig(),
        true
      );
      expect(mat.colorNode).toBeDefined();
      expect(mat.colorNode).not.toBeNull();
    });

    it('returns a MeshBasicNodeMaterial', () => {
      const mat = createInstancedBillboardTSLMaterial(
        makeInstancedSharedUniforms(),
        makeRendererConfig(),
        false
      );
      expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    });
  });
});
