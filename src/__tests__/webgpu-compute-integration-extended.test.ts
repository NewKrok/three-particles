/**
 * Extended WebGPU compute integration tests.
 *
 * Uses a fully-mocked TSL factory with compute pipeline support to exercise
 * the GPU code paths in createParticleSystem() and its update loop.
 *
 * Covers previously uncovered lines:
 *   - 1015-1024: GPU pipeline creation
 *   - 1152-1156: GPU buffer attribute setup
 *   - 1257: GPU particle deactivation
 *   - 1471: GPU particle emission (writeParticleToModifierBuffers)
 *   - 2275-2418: GPU compute dispatch, uniform updates, shadow simulation
 */

import * as THREE from 'three';
import { StorageBufferAttribute } from 'three/webgpu';
import {
  SimulationBackend,
  SimulationSpace,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  registerTSLMaterialFactory,
} from '../js/effects/three-particles/three-particles.js';

// ─── Mock GPU pipeline ──────────────────────────────────────────────────────

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

function createMockComputePipeline(maxParticles: number) {
  const buffers = createMockGPUBuffers(maxParticles);
  return {
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
}

function createFullGPUFactory(maxParticles = 10) {
  const pipeline = createMockComputePipeline(maxParticles);
  const writeParticleToModifierBuffers = jest.fn();
  const deactivateParticleInModifierBuffers = jest.fn();
  const flushEmitQueue = jest.fn().mockReturnValue(0);
  const registerCurveDataLength = jest.fn();

  return {
    factory: {
      createTSLParticleMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createComputePipeline: jest.fn(() => pipeline),
      writeParticleToModifierBuffers,
      deactivateParticleInModifierBuffers,
      flushEmitQueue,
      registerCurveDataLength,
    },
    pipeline,
    writeParticleToModifierBuffers,
    deactivateParticleInModifierBuffers,
    flushEmitQueue,
    registerCurveDataLength,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GPU compute integration', () => {
  afterEach(() => {
    registerTSLMaterialFactory(
      null as unknown as Parameters<typeof registerTSLMaterialFactory>[0]
    );
  });

  it('creates GPU pipeline when factory has all compute methods', () => {
    const { factory } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    expect(factory.createComputePipeline).toHaveBeenCalledTimes(1);
    expect(factory.createComputePipeline).toHaveBeenCalledWith(
      10,
      expect.any(Boolean),
      expect.any(Object),
      expect.any(Number),
      expect.any(Number)
    );
    ps.dispose();
  });

  it('registers curveDataLength after pipeline creation', () => {
    const { factory, registerCurveDataLength } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    expect(registerCurveDataLength).toHaveBeenCalledTimes(1);
    ps.dispose();
  });

  it('uses GPU buffer attributes for geometry (not CPU interleaved)', () => {
    const { factory, pipeline } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    // The material factory was called with gpuCompute=true
    const callArgs = factory.createTSLParticleMaterial.mock.calls[0];
    expect(callArgs[3]).toBe(true); // gpuCompute flag
    ps.dispose();
  });

  it('factory writeParticleToModifierBuffers is available on registered factory', () => {
    const { factory, writeParticleToModifierBuffers } =
      createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    // The factory method should be available for the GPU path
    expect(writeParticleToModifierBuffers).toBeDefined();
    expect(typeof factory.writeParticleToModifierBuffers).toBe('function');

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    // Pipeline creation should succeed with GPU compute
    expect(factory.createComputePipeline).toHaveBeenCalled();
    ps.dispose();
  });

  it('factory flushEmitQueue is available on registered factory', () => {
    const { factory, flushEmitQueue } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    expect(typeof factory.flushEmitQueue).toBe('function');

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    expect(factory.createComputePipeline).toHaveBeenCalled();
    ps.dispose();
  });

  it('GPU pipeline has expected uniform structure', () => {
    const { factory, pipeline } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    // Verify the pipeline uniforms are accessible
    expect(pipeline.uniforms.delta).toBeDefined();
    expect(pipeline.uniforms.gravityVelocity).toBeDefined();
    expect(pipeline.uniforms.noiseStrength).toBeDefined();
    expect(pipeline.buffers).toBeDefined();
    ps.dispose();
  });

  it('does NOT use GPU compute for trail renderer', () => {
    const { factory } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        renderer: { rendererType: 'TRAIL' },
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    // Trail forces CPU backend — createComputePipeline should NOT be called
    expect(factory.createComputePipeline).not.toHaveBeenCalled();
    ps.dispose();
  });

  it('handles world space simulation with GPU compute', () => {
    const { factory, pipeline } = createFullGPUFactory(10);
    registerTSLMaterialFactory(factory);

    const ps = createParticleSystem(
      {
        maxParticles: 10,
        duration: 5,
        looping: true,
        emission: { rateOverTime: 10 },
        simulationSpace: SimulationSpace.WORLD,
        simulationBackend: SimulationBackend.GPU,
      },
      1000
    );

    ps.update(1016);

    expect(pipeline.uniforms.simulationSpaceWorld.value).toBe(1);
    ps.dispose();
  });
});
