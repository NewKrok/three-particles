import { StorageBufferAttribute } from 'three/webgpu';
import {
  createParticleStorageBuffers,
  createParticleComputeUpdate,
  writeParticleToStorageBuffer,
  deactivateParticleInStorageBuffer,
  updateComputeUniforms,
} from '../js/effects/three-particles/webgpu/compute-particle-update.js';

// ─── createParticleStorageBuffers ────────────────────────────────────────────

describe('createParticleStorageBuffers', () => {
  it('creates buffers with correct sizes for non-instanced mode', () => {
    const buffers = createParticleStorageBuffers(100, false);
    expect(buffers.position).toBeInstanceOf(StorageBufferAttribute);
    expect(buffers.position.array).toHaveLength(300); // 100 * 3
    expect(buffers.velocity.array).toHaveLength(300);
    expect(buffers.lifetime.array).toHaveLength(100);
    expect(buffers.startLifetime.array).toHaveLength(100);
    expect(buffers.isActive.array).toHaveLength(100);
    expect(buffers.colorA.array).toHaveLength(100);
  });

  it('creates buffers with correct sizes for instanced mode', () => {
    const buffers = createParticleStorageBuffers(50, true);
    expect(buffers.position.array).toHaveLength(150); // 50 * 3
    expect(buffers.velocity.array).toHaveLength(150);
    expect(buffers.lifetime.array).toHaveLength(50);
  });

  it('initializes all buffers to zero', () => {
    const buffers = createParticleStorageBuffers(10, false);
    const posArr = buffers.position.array as Float32Array;
    for (let i = 0; i < posArr.length; i++) {
      expect(posArr[i]).toBe(0);
    }
  });
});

// ─── writeParticleToStorageBuffer ────────────────────────────────────────────

describe('writeParticleToStorageBuffer', () => {
  it('writes particle data at the correct indices', () => {
    const buffers = createParticleStorageBuffers(10, false);
    writeParticleToStorageBuffer(buffers, 3, {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 0.1, y: 0.2, z: 0.3 },
      lifetime: 0,
      startLifetime: 5000,
      colorA: 1,
    });

    const posArr = buffers.position.array as Float32Array;
    expect(posArr[9]).toBe(1); // index 3 * 3 = 9
    expect(posArr[10]).toBe(2);
    expect(posArr[11]).toBe(3);

    const velArr = buffers.velocity.array as Float32Array;
    expect(velArr[9]).toBeCloseTo(0.1);
    expect(velArr[10]).toBeCloseTo(0.2);
    expect(velArr[11]).toBeCloseTo(0.3);

    expect((buffers.lifetime.array as Float32Array)[3]).toBe(0);
    expect((buffers.startLifetime.array as Float32Array)[3]).toBe(5000);
    expect((buffers.isActive.array as Float32Array)[3]).toBe(1);
    expect((buffers.colorA.array as Float32Array)[3]).toBe(1);
  });

  it('can write to index 0', () => {
    const buffers = createParticleStorageBuffers(5, false);
    writeParticleToStorageBuffer(buffers, 0, {
      position: { x: 10, y: 20, z: 30 },
      velocity: { x: 0, y: 0, z: 0 },
      lifetime: 100,
      startLifetime: 3000,
      colorA: 0.5,
    });

    const posArr = buffers.position.array as Float32Array;
    expect(posArr[0]).toBe(10);
    expect(posArr[1]).toBe(20);
    expect(posArr[2]).toBe(30);
    expect((buffers.colorA.array as Float32Array)[0]).toBe(0.5);
  });
});

// ─── deactivateParticleInStorageBuffer ───────────────────────────────────────

describe('deactivateParticleInStorageBuffer', () => {
  it('sets isActive to 0 and colorA to 0', () => {
    const buffers = createParticleStorageBuffers(10, false);

    // First activate
    writeParticleToStorageBuffer(buffers, 5, {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      lifetime: 0,
      startLifetime: 1000,
      colorA: 1,
    });
    expect((buffers.isActive.array as Float32Array)[5]).toBe(1);
    expect((buffers.colorA.array as Float32Array)[5]).toBe(1);

    // Then deactivate
    deactivateParticleInStorageBuffer(buffers, 5);
    expect((buffers.isActive.array as Float32Array)[5]).toBe(0);
    expect((buffers.colorA.array as Float32Array)[5]).toBe(0);
  });
});

// ─── createParticleComputeUpdate ─────────────────────────────────────────────

describe('createParticleComputeUpdate', () => {
  it('returns a compute pipeline with computeNode, uniforms, and buffers', () => {
    const buffers = createParticleStorageBuffers(100, false);
    const pipeline = createParticleComputeUpdate(buffers, 100);

    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.uniforms).toBeDefined();
    expect(pipeline.uniforms.delta).toBeDefined();
    expect(pipeline.uniforms.deltaMs).toBeDefined();
    expect(pipeline.uniforms.gravityVelocity).toBeDefined();
    expect(pipeline.uniforms.worldPositionChange).toBeDefined();
    expect(pipeline.uniforms.simulationSpaceWorld).toBeDefined();
    expect(pipeline.buffers).toBe(buffers);
  });

  it('works with instanced buffers', () => {
    const buffers = createParticleStorageBuffers(50, true);
    const pipeline = createParticleComputeUpdate(buffers, 50);
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline for small particle counts', () => {
    const buffers = createParticleStorageBuffers(1, false);
    const pipeline = createParticleComputeUpdate(buffers, 1);
    expect(pipeline.computeNode).toBeDefined();
  });
});

// ─── updateComputeUniforms ───────────────────────────────────────────────────

describe('updateComputeUniforms', () => {
  it('updates uniform values from frame data', () => {
    const buffers = createParticleStorageBuffers(10, false);
    const pipeline = createParticleComputeUpdate(buffers, 10);

    updateComputeUniforms(pipeline.uniforms, {
      delta: 0.016,
      gravityVelocity: { x: 0, y: -9.8, z: 0 },
      worldPositionChange: { x: 1, y: 0, z: 0 },
      isWorldSpace: true,
    });

    // Verify uniform values were set
    const delta = pipeline.uniforms.delta as unknown as { value: number };
    expect(delta.value).toBeCloseTo(0.016);

    const deltaMs = pipeline.uniforms.deltaMs as unknown as { value: number };
    expect(deltaMs.value).toBeCloseTo(16);

    const simSpace = pipeline.uniforms.simulationSpaceWorld as unknown as {
      value: number;
    };
    expect(simSpace.value).toBe(1);
  });

  it('sets simulationSpaceWorld to 0 for local space', () => {
    const buffers = createParticleStorageBuffers(10, false);
    const pipeline = createParticleComputeUpdate(buffers, 10);

    updateComputeUniforms(pipeline.uniforms, {
      delta: 0.016,
      gravityVelocity: { x: 0, y: 0, z: 0 },
      worldPositionChange: { x: 0, y: 0, z: 0 },
      isWorldSpace: false,
    });

    const simSpace = pipeline.uniforms.simulationSpaceWorld as unknown as {
      value: number;
    };
    expect(simSpace.value).toBe(0);
  });
});
