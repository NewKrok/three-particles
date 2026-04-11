import * as THREE from 'three';
import { SimulationBackend } from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  registerTSLMaterialFactory,
} from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createTestSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
): ParticleSystem =>
  createParticleSystem(
    {
      maxParticles: 10,
      duration: 5,
      looping: true,
      ...config,
    },
    startTime
  );

// ─── registerTSLMaterialFactory ──────────────────────────────────────────────

describe('registerTSLMaterialFactory', () => {
  it('is exported and callable', () => {
    expect(typeof registerTSLMaterialFactory).toBe('function');
  });

  it('does not throw when registering a factory', () => {
    const mockFactory = {
      createTSLParticleMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
    };
    expect(() => registerTSLMaterialFactory(mockFactory)).not.toThrow();
    // Clean up: unregister by setting null internally — we test via behavior below
  });
});

// ─── TSL material branching ──────────────────────────────────────────────────

describe('TSL material branching', () => {
  afterEach(() => {
    // Reset TSL factory by registering a null-like value through the public API
    // Since there's no unregister, we test that the factory is called when registered
  });

  it('uses GLSL ShaderMaterial by default (no TSL factory registered)', () => {
    // Ensure we start without a TSL factory by creating a system with CPU backend
    const ps = createTestSystem({
      simulationBackend: SimulationBackend.CPU,
    });
    const points = ps.instance as THREE.Points;
    expect(points.material).toBeInstanceOf(THREE.ShaderMaterial);
    ps.dispose();
  });

  it('uses TSL material when simulationBackend is CPU with factory (for WebGPU renderer compat)', () => {
    const mockFactory = {
      createTSLParticleMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
    };
    registerTSLMaterialFactory(mockFactory);

    const ps = createTestSystem({
      simulationBackend: SimulationBackend.CPU,
    });
    // TSL is always used when factory is registered (for WebGPURenderer compat),
    // but GPU compute is NOT used when backend is CPU.
    expect(mockFactory.createTSLParticleMaterial).toHaveBeenCalled();
    ps.dispose();

    // Clean up: re-register with null-ish to reset (use a trick)
    registerTSLMaterialFactory(
      null as unknown as Parameters<typeof registerTSLMaterialFactory>[0]
    );
  });

  it('calls TSL factory when backend is AUTO and factory is registered', () => {
    const mockMaterial = new THREE.ShaderMaterial();
    const mockFactory = {
      createTSLParticleMaterial: jest.fn(() => mockMaterial),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
    };
    registerTSLMaterialFactory(mockFactory);

    const ps = createTestSystem({
      simulationBackend: SimulationBackend.AUTO,
    });
    expect(mockFactory.createTSLParticleMaterial).toHaveBeenCalledTimes(1);
    ps.dispose();

    // Clean up
    registerTSLMaterialFactory(
      null as unknown as Parameters<typeof registerTSLMaterialFactory>[0]
    );
  });

  it('calls TSL factory when backend is GPU and factory is registered', () => {
    const mockMaterial = new THREE.ShaderMaterial();
    const mockFactory = {
      createTSLParticleMaterial: jest.fn(() => mockMaterial),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
    };
    registerTSLMaterialFactory(mockFactory);

    const ps = createTestSystem({
      simulationBackend: SimulationBackend.GPU,
    });
    expect(mockFactory.createTSLParticleMaterial).toHaveBeenCalledTimes(1);
    ps.dispose();

    // Clean up
    registerTSLMaterialFactory(
      null as unknown as Parameters<typeof registerTSLMaterialFactory>[0]
    );
  });

  it('passes renderer type and uniforms to TSL factory', () => {
    const mockFactory = {
      createTSLParticleMaterial: jest.fn(() => new THREE.ShaderMaterial()),
      createTSLTrailMaterial: jest.fn(() => new THREE.ShaderMaterial()),
    };
    registerTSLMaterialFactory(mockFactory);

    const ps = createTestSystem({
      simulationBackend: SimulationBackend.GPU,
    });

    const [rendererType, uniforms, config] =
      mockFactory.createTSLParticleMaterial.mock.calls[0];

    // Renderer type should be POINTS (default)
    expect(rendererType).toBe('POINTS');

    // Uniforms should include standard particle system uniforms
    expect(uniforms).toHaveProperty('elapsed');
    expect(uniforms).toHaveProperty('map');
    expect(uniforms).toHaveProperty('tiles');
    expect(uniforms).toHaveProperty('fps');
    expect(uniforms).toHaveProperty('softParticlesEnabled');

    // Renderer config should include material properties
    expect(config).toHaveProperty('transparent');
    expect(config).toHaveProperty('blending');
    expect(config).toHaveProperty('depthTest');
    expect(config).toHaveProperty('depthWrite');

    ps.dispose();

    // Clean up
    registerTSLMaterialFactory(
      null as unknown as Parameters<typeof registerTSLMaterialFactory>[0]
    );
  });
});

// ─── SimulationBackend config field ──────────────────────────────────────────

describe('simulationBackend config field', () => {
  it('defaults to AUTO in created systems', () => {
    const ps = createTestSystem();
    // System should create successfully with default AUTO backend
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('accepts CPU backend without error', () => {
    const ps = createTestSystem({
      simulationBackend: SimulationBackend.CPU,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('accepts GPU backend without error (falls back gracefully)', () => {
    const ps = createTestSystem({
      simulationBackend: SimulationBackend.GPU,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });
});
