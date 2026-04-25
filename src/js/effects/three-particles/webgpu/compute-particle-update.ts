/**
 * GPU compute shader for core particle physics simulation.
 *
 * Replaces the per-particle CPU update loop with a single GPU compute dispatch:
 *   1. Gravity: velocity -= gravityVelocity * delta
 *   2. Velocity integration: position += velocity * delta
 *   3. Lifetime: lifetime += delta * 1000 (ms); deactivate when > startLifetime
 *
 * Emission and death callbacks remain CPU-side.
 *
 * @module
 */
import { Vector3 } from 'three';
import {
  Fn,
  float,
  vec3,
  vec4,
  storage,
  instanceIndex,
  uniform,
  If,
  compute,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';

import {
  StorageBufferAttribute,
  StorageInstancedBufferAttribute,
} from 'three/webgpu';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-frame uniform values set by the CPU before each compute dispatch. */
export type ComputeUniforms = {
  delta: ShaderNodeObject<Node>;
  deltaMs: ShaderNodeObject<Node>;
  gravityVelocity: ShaderNodeObject<Node>;
};

/** GPU storage buffer references returned by createParticleStorageBuffers. */
export type ParticleStorageBuffers = {
  /** Float32 position (vec3 per particle) — also used as render attribute */
  position: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Float32 velocity (vec3 per particle) — compute-only */
  velocity: StorageBufferAttribute;
  /** Float32 lifetime in ms (1 float per particle) — also render attribute */
  lifetime: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Float32 startLifetime in ms (1 float per particle, read-only after emit) */
  startLifetime: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Float32 isActive (1 float per particle, 0 or 1) */
  isActive: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Float32 colorA (1 float per particle) — alpha set to 0 on death */
  colorA: StorageBufferAttribute | StorageInstancedBufferAttribute;
};

/** The compute pipeline handle returned by createParticleComputeUpdate. */
export type ParticleComputePipeline = {
  /** The TSL compute node to dispatch via renderer.compute(). */
  computeNode: ReturnType<typeof compute>;
  /** Uniform accessors for CPU to update each frame before dispatch. */
  uniforms: ComputeUniforms;
  /** Storage buffer references for CPU emission writes. */
  buffers: ParticleStorageBuffers;
};

// ─── Storage Buffer Creation ─────────────────────────────────────────────────

/**
 * Creates GPU storage buffers for the particle system.
 *
 * These buffers serve a dual role:
 * - **Compute shader:** reads/writes particle state each frame
 * - **Render shader:** reads particle attributes (position, lifetime, etc.)
 *
 * @param maxParticles - Maximum number of particles in the system.
 * @param instanced - Whether to use InstancedBufferAttribute (for INSTANCED/MESH renderers).
 * @returns Storage buffer references.
 */
export function createParticleStorageBuffers(
  maxParticles: number,
  instanced: boolean
): ParticleStorageBuffers {
  const BufferClass = instanced
    ? StorageInstancedBufferAttribute
    : StorageBufferAttribute;

  return {
    position: new BufferClass(new Float32Array(maxParticles * 3), 3),
    velocity: new StorageBufferAttribute(new Float32Array(maxParticles * 3), 3),
    lifetime: new BufferClass(new Float32Array(maxParticles), 1),
    startLifetime: new BufferClass(new Float32Array(maxParticles), 1),
    isActive: new BufferClass(new Float32Array(maxParticles), 1),
    colorA: new BufferClass(new Float32Array(maxParticles), 1),
  };
}

// ─── Compute Shader ──────────────────────────────────────────────────────────

/**
 * Creates the GPU compute pipeline for core particle physics.
 *
 * @param buffers - Storage buffers created by `createParticleStorageBuffers`.
 * @param maxParticles - Maximum particle count (determines dispatch size).
 * @returns The compute pipeline with dispatch node and uniform accessors.
 */
export function createParticleComputeUpdate(
  buffers: ParticleStorageBuffers,
  maxParticles: number
): ParticleComputePipeline {
  // ── Per-frame uniforms (CPU writes before each dispatch) ──

  const uDelta = uniform(float(0));
  const uDeltaMs = uniform(float(0));
  const uGravityVelocity = uniform(new Vector3(0, 0, 0));

  // ── Storage buffer nodes ──

  const sPosition = storage(buffers.position, 'vec3', maxParticles);
  const sVelocity = storage(buffers.velocity, 'vec3', maxParticles);
  const sLifetime = storage(buffers.lifetime, 'float', maxParticles);
  const sStartLifetime = storage(buffers.startLifetime, 'float', maxParticles);
  const sIsActive = storage(buffers.isActive, 'float', maxParticles);
  const sColorA = storage(buffers.colorA, 'float', maxParticles);

  // ── Compute kernel ──

  const computeKernel = Fn(() => {
    const i = instanceIndex;

    // Read activation flag — skip inactive particles
    const active = sIsActive.element(i);
    If(active.lessThan(0.5), () => {
      return;
    });

    // Read current state
    const pos = sPosition.element(i).toVar();
    const vel = sVelocity.element(i).toVar();
    const life = sLifetime.element(i).toVar();
    const startLife = sStartLifetime.element(i);

    // 1. Gravity: velocity -= gravityVelocity * delta
    //    In WORLD mode gravityVelocity is the world-space gravity vector;
    //    in LOCAL mode it is the same vector transformed into the emitter's
    //    local frame. The CPU sets it appropriately each frame.
    vel.assign(vel.sub(vec3(uGravityVelocity).mul(uDelta)));

    // 2. Velocity integration: position += velocity * delta
    pos.assign(pos.add(vel.mul(uDelta)));

    // 3. Lifetime: lifetime += deltaMs; deactivate when > startLifetime
    life.assign(life.add(uDeltaMs));

    // Write back
    sPosition.element(i).assign(pos);
    sVelocity.element(i).assign(vel);
    sLifetime.element(i).assign(life);

    // 4. Death check: deactivate expired particles
    If(life.greaterThan(startLife), () => {
      sIsActive.element(i).assign(float(0));
      sColorA.element(i).assign(float(0));
    });
  });

  // Create the compute dispatch node
  const computeNode = compute(computeKernel, maxParticles);

  return {
    computeNode,
    uniforms: {
      delta: uDelta,
      deltaMs: uDeltaMs,
      gravityVelocity: uGravityVelocity,
    },
    buffers,
  };
}

// ─── CPU → GPU Sync Helpers ──────────────────────────────────────────────────

/**
 * Writes a newly emitted particle's data into the GPU storage buffers.
 *
 * Called from CPU emission code when a particle is activated.
 * The storage buffer arrays are directly accessible as Float32Array.
 *
 * @param buffers - Storage buffer references.
 * @param index - Particle index to write.
 * @param data - Initial particle data.
 */
export function writeParticleToStorageBuffer(
  buffers: ParticleStorageBuffers,
  index: number,
  data: {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    lifetime: number;
    startLifetime: number;
    colorA: number;
  }
): void {
  const posArr = buffers.position.array as Float32Array;
  posArr[index * 3] = data.position.x;
  posArr[index * 3 + 1] = data.position.y;
  posArr[index * 3 + 2] = data.position.z;

  const velArr = buffers.velocity.array as Float32Array;
  velArr[index * 3] = data.velocity.x;
  velArr[index * 3 + 1] = data.velocity.y;
  velArr[index * 3 + 2] = data.velocity.z;

  (buffers.lifetime.array as Float32Array)[index] = data.lifetime;
  (buffers.startLifetime.array as Float32Array)[index] = data.startLifetime;
  (buffers.isActive.array as Float32Array)[index] = 1;
  (buffers.colorA.array as Float32Array)[index] = data.colorA;
}

/**
 * Deactivates a particle in the GPU storage buffers.
 *
 * Called from CPU death detection when a particle's lifetime expires.
 *
 * @param buffers - Storage buffer references.
 * @param index - Particle index to deactivate.
 */
export function deactivateParticleInStorageBuffer(
  buffers: ParticleStorageBuffers,
  index: number
): void {
  (buffers.isActive.array as Float32Array)[index] = 0;
  (buffers.colorA.array as Float32Array)[index] = 0;
}

/**
 * Updates the per-frame compute uniforms before dispatching the compute shader.
 *
 * @param uniforms - The compute uniform accessors.
 * @param frameData - Current frame data.
 */
export function updateComputeUniforms(
  uniforms: ComputeUniforms,
  frameData: {
    delta: number;
    gravityVelocity: { x: number; y: number; z: number };
  }
): void {
  (uniforms.delta as unknown as { value: number }).value = frameData.delta;
  (uniforms.deltaMs as unknown as { value: number }).value =
    frameData.delta * 1000;
  const gv = uniforms.gravityVelocity as unknown as { value: Vector3 };
  gv.value.set(
    frameData.gravityVelocity.x,
    frameData.gravityVelocity.y,
    frameData.gravityVelocity.z
  );
}
