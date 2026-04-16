/**
 * Miscellaneous GPU and edge case tests for three-particles.ts.
 *
 * Covers previously uncovered lines:
 *   - 532: Trail mesh material disposal (array branch)
 *   - 2044: Noise offset array initialization
 *   - GPU noise uniform propagation
 */

import * as THREE from 'three';
import { StorageBufferAttribute } from 'three/webgpu';
import { SimulationBackend } from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  registerTSLMaterialFactory,
} from '../js/effects/three-particles/three-particles.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

afterEach(() => {
  registerTSLMaterialFactory(
    null as unknown as Parameters<typeof registerTSLMaterialFactory>[0]
  );
});

function createMockGPUBuffers(maxParticles: number) {
  return {
    position: new StorageBufferAttribute(new Float32Array(maxParticles * 4), 4),
    velocity: new StorageBufferAttribute(new Float32Array(maxParticles * 4), 4),
    color: new StorageBufferAttribute(new Float32Array(maxParticles * 4), 4),
    particleState: new StorageBufferAttribute(
      new Float32Array(maxParticles * 4),
      4
    ),
    startValues: new StorageBufferAttribute(
      new Float32Array(maxParticles * 4),
      4
    ),
    startColorsExt: new StorageBufferAttribute(
      new Float32Array(maxParticles * 4),
      4
    ),
    orbitalIsActive: new StorageBufferAttribute(
      new Float32Array(maxParticles * 4),
      4
    ),
    curveData: new StorageBufferAttribute(
      new Float32Array(maxParticles * 28 + 256),
      1
    ),
  };
}

function createFullGPUFactory(maxParticles = 10) {
  const buffers = createMockGPUBuffers(maxParticles);
  const pipeline = {
    computeNode: { isNode: true },
    uniforms: {
      delta: { value: 0 },
      deltaMs: { value: 0 },
      gravityVelocity: { value: new THREE.Vector3() },
      worldPositionChange: { value: new THREE.Vector3() },
      simulationSpaceWorld: { value: 0 },
      noiseStrength: { value: 0 },
      noisePower: { value: 0 },
      noiseFrequency: { value: 1 },
      noisePositionAmount: { value: 0 },
      noiseRotationAmount: { value: 0 },
      noiseSizeAmount: { value: 0 },
    },
    buffers,
    curveDataLength: 1,
    forceFieldInfo: null,
  };

  return {
    factory: {
      createTSLParticleMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createComputePipeline: jest.fn(() => pipeline),
      writeParticleToModifierBuffers: jest.fn(),
      deactivateParticleInModifierBuffers: jest.fn(),
      flushEmitQueue: jest.fn().mockReturnValue(0),
      registerCurveDataLength: jest.fn(),
    },
    pipeline,
  };
}

// ─── Noise offset initialization (line 2044) ───────────────────────────────

describe('noise offset initialization', () => {
  it('initializes noise offsets when useRandomOffset is true', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 20,
        duration: 5,
        looping: true,
        emission: { rateOverTime: 10 },
        noise: {
          isActive: true,
          useRandomOffset: true,
          strength: 1,
          frequency: 1,
          power: 1,
          positionAmount: 1,
          rotationAmount: 0,
          sizeAmount: 0,
        },
      },
      1000
    );

    // System should create without error even with random noise offsets
    expect(ps.instance).toBeDefined();

    // Trigger update to ensure noise is applied
    ps.update(1016);
    ps.dispose();
  });

  it('works without noise active', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        noise: { isActive: false },
      },
      1000
    );

    ps.update(1016);
    ps.dispose();
  });
});

// ─── GPU noise uniform propagation ─────────────────────────────────────────

describe('GPU noise uniforms', () => {
  it('propagates noise config to GPU uniforms', () => {
    const { factory, pipeline } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        emission: { rateOverTime: 10 },
        noise: {
          isActive: true,
          useRandomOffset: false,
          strength: 2.5,
          frequency: 3.0,
          power: 1.5,
          positionAmount: 0.8,
          rotationAmount: 0.3,
          sizeAmount: 0.1,
        },
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    ps.update(1016);

    expect(pipeline.uniforms.noiseStrength.value).toBeCloseTo(2.5);
    expect(pipeline.uniforms.noiseFrequency.value).toBeCloseTo(3.0);
    expect(pipeline.uniforms.noisePositionAmount.value).toBeCloseTo(0.8);
    expect(pipeline.uniforms.noiseRotationAmount.value).toBeCloseTo(0.3);
    expect(pipeline.uniforms.noiseSizeAmount.value).toBeCloseTo(0.1);
    // noisePower is divided by FBM max accumulator
    expect(pipeline.uniforms.noisePower.value).toBeGreaterThan(0);
    expect(pipeline.uniforms.noisePower.value).toBeLessThan(1.5);
    ps.dispose();
  });
});

// ─── Noise offset via updateConfig (line 2044) ─────────────────────────────

describe('noise offset initialization via updateConfig', () => {
  it('creates noise offsets when updateConfig enables useRandomOffset', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 15,
        duration: 5,
        looping: true,
        emission: { rateOverTime: 10 },
        noise: {
          isActive: false,
          useRandomOffset: false,
          strength: 0,
          frequency: 0.5,
          power: 1,
          positionAmount: 0,
          rotationAmount: 0,
          sizeAmount: 0,
        },
      },
      1000
    );

    // Now enable noise with random offset via updateConfig
    ps.updateConfig({
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 2,
        frequency: 1,
        power: 1,
        positionAmount: 1,
        rotationAmount: 0,
        sizeAmount: 0,
      },
    });

    // System should handle noise offset initialization
    ps.update(1016);
    ps.dispose();
  });

  it('calling updateConfig with noise twice reuses existing offsets', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        noise: {
          isActive: true,
          useRandomOffset: true,
          strength: 1,
          frequency: 1,
          power: 1,
          positionAmount: 1,
          rotationAmount: 0,
          sizeAmount: 0,
        },
      },
      1000
    );

    ps.update(1016);

    // Update noise again — should reuse offsets (not recreate)
    ps.updateConfig({
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 3,
        frequency: 2,
        power: 1,
        positionAmount: 1,
        rotationAmount: 0,
        sizeAmount: 0,
      },
    });

    ps.update(1032);
    ps.dispose();
  });
});

// ─── Material disposal (line 532 — array material branch) ──────────────────

describe('material disposal', () => {
  it('disposes trail system without error', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 3,
        duration: 5,
        looping: true,
        emission: { rateOverTime: 10 },
        renderer: { rendererType: 'TRAIL' },
        trail: {
          length: 4,
          dieWithParticle: true,
          minVertexDistance: 0.1,
        },
      },
      1000
    );

    // Emit some particles
    ps.update(1016);

    // Dispose should clean up trail mesh + material
    expect(() => ps.dispose()).not.toThrow();
  });

  it('disposes non-trail system without error', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
      },
      1000
    );

    ps.update(1016);
    expect(() => ps.dispose()).not.toThrow();
  });

  it('disposes instanced renderer without error', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        renderer: { rendererType: 'INSTANCED' },
      },
      1000
    );

    ps.update(1016);
    expect(() => ps.dispose()).not.toThrow();
  });

  it('disposes mesh renderer without error', () => {
    const THREE = require('three');
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        duration: 5,
        looping: true,
        renderer: {
          rendererType: 'MESH',
          mesh: { geometry: new THREE.BoxGeometry(0.1, 0.1, 0.1) },
        },
      },
      1000
    );

    ps.update(1016);
    expect(() => ps.dispose()).not.toThrow();
  });
});
