/**
 * WebGPU entry point type declarations for @newkrok/three-particles/webgpu.
 *
 * Hand-written because automatic DTS generation fails on TSL node types
 * (Three.js TSL Fn return types resolve to `unknown` in the type system).
 */
import type { Material, Blending } from 'three';
import type { RendererType } from '@newkrok/three-particles';

/** Renderer configuration for material creation. */
export interface RendererConfig {
  transparent: boolean;
  blending: Blending;
  depthTest: boolean;
  depthWrite: boolean;
}

/** Creates a TSL NodeMaterial for the main particle system (non-trail). */
export declare function createTSLParticleMaterial(
  rendererType: RendererType,
  sharedUniforms: Record<string, { value: unknown }>,
  rendererConfig: RendererConfig,
  gpuCompute?: boolean
): Material;

/** Creates a TSL NodeMaterial for the trail ribbon renderer. */
export declare function createTSLTrailMaterial(
  trailUniforms: Record<string, { value: unknown }>,
  rendererConfig: RendererConfig
): Material;

/** Creates the GPU compute pipeline for particle simulation. */
export declare function createComputePipeline(
  maxParticles: number,
  instanced: boolean,
  normalizedConfig: unknown,
  particleSystemId: number,
  forceFieldCount: number,
  collisionPlaneCount?: number
): unknown;

/** Writes init data for a newly emitted particle into modifier storage buffers. */
export declare function writeParticleToModifierBuffers(
  buffers: unknown,
  index: number,
  data: Record<string, unknown>
): void;

/** Deactivates a particle in the modifier storage buffers. */
export declare function deactivateParticleInModifierBuffers(
  buffers: unknown,
  index: number
): void;

/** Flushes pending init data to the GPU. Call once per frame before compute dispatch. */
export declare function flushEmitQueue(buffers: unknown): number;

/** Registers the curve data length for a buffer. Called once during pipeline creation. */
export declare function registerCurveDataLength(
  buffers: unknown,
  curveDataLength: number
): void;

/** Packs force field configs into a flat Float32Array for GPU upload. */
export declare function encodeForceFieldsForGPU(
  forceFields: ReadonlyArray<unknown>,
  particleSystemId: number,
  systemLifetimePercentage: number
): Float32Array;

/** Packs collision plane configs into a flat Float32Array for GPU upload. */
export declare function encodeCollisionPlanesForGPU(
  planes: ReadonlyArray<unknown>
): Float32Array;

/**
 * Convenience function that registers all WebGPU TSL material factories
 * and GPU compute helpers in a single call.
 *
 * Call this **once** before creating any particle systems that use WebGPU rendering.
 *
 * @example
 * ```typescript
 * import { enableWebGPU } from '@newkrok/three-particles/webgpu';
 * enableWebGPU();
 * ```
 */
export declare function enableWebGPU(): void;
