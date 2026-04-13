/**
 * Tests for tsl-materials.ts factory functions.
 *
 * Covers:
 *   - createTSLParticleMaterial (dispatches to correct material per RendererType)
 *   - createTSLTrailMaterial (delegates to trail ribbon)
 *   - createComputePipeline (end-to-end pipeline creation from config)
 */

import { Vector2 } from 'three';
import { AdditiveBlending } from 'three';
import { PointsNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { RendererType } from '../js/effects/three-particles/three-particles-enums.js';
import { getDefaultParticleSystemConfig } from '../js/effects/three-particles/three-particles.js';
import {
  createTSLParticleMaterial,
  createTSLTrailMaterial,
  createComputePipeline,
  type RendererConfig,
} from '../js/effects/three-particles/webgpu/tsl-materials.js';
import type { NormalizedParticleSystemConfig } from '../js/effects/three-particles/types.js';
import type { SharedUniforms } from '../js/effects/three-particles/webgpu/tsl-shared.js';
import type { TrailUniforms } from '../js/effects/three-particles/webgpu/tsl-trail-ribbon-material.js';

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

function makeTrailUniforms(): TrailUniforms {
  return {
    map: { value: null },
    useMap: { value: false },
    discardBackgroundColor: { value: false },
    backgroundColor: { value: { r: 0, g: 0, b: 0 } },
    backgroundColorTolerance: { value: 0.01 },
    softParticlesEnabled: { value: false },
    softParticlesIntensity: { value: 1.0 },
    sceneDepthTexture: { value: null },
    cameraNearFar: { value: new Vector2(0.1, 1000) },
  };
}

const rendererConfig: RendererConfig = {
  transparent: true,
  blending: AdditiveBlending,
  depthTest: true,
  depthWrite: false,
};

function createConfig(
  overrides: Record<string, unknown> = {}
): NormalizedParticleSystemConfig {
  const base = getDefaultParticleSystemConfig();
  return { ...base, ...overrides } as NormalizedParticleSystemConfig;
}

// ─── createTSLParticleMaterial ──────────────────────────────────────────────

describe('createTSLParticleMaterial', () => {
  it('returns PointsNodeMaterial for POINTS renderer type', () => {
    const mat = createTSLParticleMaterial(
      RendererType.POINTS,
      makeSharedUniforms(),
      rendererConfig
    );
    expect(mat).toBeInstanceOf(PointsNodeMaterial);
  });

  it('returns MeshBasicNodeMaterial for INSTANCED renderer type', () => {
    const mat = createTSLParticleMaterial(
      RendererType.INSTANCED,
      makeSharedUniforms(),
      rendererConfig
    );
    expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
  });

  it('returns MeshBasicNodeMaterial for MESH renderer type', () => {
    const mat = createTSLParticleMaterial(
      RendererType.MESH,
      makeSharedUniforms(),
      rendererConfig
    );
    expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
  });

  it('passes gpuCompute flag to POINTS material', () => {
    expect(() =>
      createTSLParticleMaterial(
        RendererType.POINTS,
        makeSharedUniforms(),
        rendererConfig,
        true
      )
    ).not.toThrow();
  });

  it('passes gpuCompute flag to INSTANCED material', () => {
    expect(() =>
      createTSLParticleMaterial(
        RendererType.INSTANCED,
        makeSharedUniforms(),
        rendererConfig,
        true
      )
    ).not.toThrow();
  });
});

// ─── createTSLTrailMaterial ─────────────────────────────────────────────────

describe('createTSLTrailMaterial', () => {
  it('returns a MeshBasicNodeMaterial', () => {
    const mat = createTSLTrailMaterial(makeTrailUniforms(), rendererConfig);
    expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
  });

  it('sets transparent from rendererConfig', () => {
    const mat = createTSLTrailMaterial(makeTrailUniforms(), {
      ...rendererConfig,
      transparent: false,
    });
    expect(mat.transparent).toBe(false);
  });
});

// ─── createComputePipeline ──────────────────────────────────────────────────

describe('createComputePipeline', () => {
  it('creates pipeline with default config (no active modifiers)', () => {
    const config = createConfig();
    const pipeline = createComputePipeline(100, false, config, 0, 0);

    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.uniforms).toBeDefined();
    expect(pipeline.buffers).toBeDefined();
  });

  it('creates pipeline with sizeOverLifetime active', () => {
    const config = createConfig({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: 'BEZIER',
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
      },
    });
    const pipeline = createComputePipeline(50, false, config, 0, 0);
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with force fields', () => {
    const config = createConfig();
    const pipeline = createComputePipeline(50, false, config, 0, 3);
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.forceFieldInfo).not.toBeNull();
    expect(pipeline.forceFieldInfo!.countUniform).toBeDefined();
  });

  it('creates pipeline in instanced mode', () => {
    const config = createConfig();
    const pipeline = createComputePipeline(50, true, config, 0, 0);
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with noise active', () => {
    const config = createConfig({
      noise: {
        isActive: true,
        strength: 1,
        frequency: 1,
        power: 1,
        positionAmount: 1,
        rotationAmount: 0,
        sizeAmount: 0,
      },
    });
    const pipeline = createComputePipeline(50, false, config, 0, 0);
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.uniforms.noiseStrength).toBeDefined();
  });

  it('creates pipeline with velocity over lifetime (constant)', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 1, y: 0, z: 0 },
        orbital: { x: 0, y: 0, z: 0 },
      },
    });
    const pipeline = createComputePipeline(50, false, config, 0, 0);
    expect(pipeline.computeNode).toBeDefined();
  });
});
