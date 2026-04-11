/**
 * TSL material factory for all particle renderer types.
 *
 * Selects and creates the appropriate TSL NodeMaterial based on the
 * renderer type (POINTS, INSTANCED, MESH, TRAIL).
 *
 * @module
 */
import { RendererType } from '../three-particles-enums.js';
import { isLifeTimeCurve } from '../three-particles-utils.js';
import {
  createModifierStorageBuffers,
  createModifierComputeUpdate,
  type ModifierComputePipeline,
  type ModifierFlags,
} from './compute-modifiers.js';

// Re-export emit queue helpers so callers can register them via the factory.
export {
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
} from './compute-modifiers.js';
import { bakeParticleSystemCurves } from './curve-bake.js';
import { createInstancedBillboardTSLMaterial } from './tsl-instanced-billboard-material.js';
import { createMeshParticleTSLMaterial } from './tsl-mesh-particle-material.js';
import { createPointSpriteTSLMaterial } from './tsl-point-sprite-material.js';
import {
  createTrailRibbonTSLMaterial,
  type TrailUniforms,
} from './tsl-trail-ribbon-material.js';
import type { SharedUniforms } from './tsl-shared.js';
import type { NormalizedParticleSystemConfig } from '../types.js';
import type * as THREE from 'three';

export type { TrailUniforms };

export type RendererConfig = {
  transparent: boolean;
  blending: THREE.Blending;
  depthTest: boolean;
  depthWrite: boolean;
};

/**
 * Creates a TSL NodeMaterial for the main particle system (non-trail).
 *
 * @param rendererType - The particle renderer type.
 * @param sharedUniforms - Shared uniform values managed by the particle system.
 * @param rendererConfig - Material rendering properties (transparency, blending, etc.).
 * @returns A NodeMaterial instance configured for the specified renderer type.
 */
export function createTSLParticleMaterial(
  rendererType: RendererType,
  sharedUniforms: SharedUniforms,
  rendererConfig: RendererConfig,
  gpuCompute = false
): THREE.Material {
  switch (rendererType) {
    case RendererType.INSTANCED:
      return createInstancedBillboardTSLMaterial(
        sharedUniforms,
        rendererConfig,
        gpuCompute
      );
    case RendererType.MESH:
      return createMeshParticleTSLMaterial(
        sharedUniforms,
        rendererConfig,
        gpuCompute
      );
    case RendererType.POINTS:
    default:
      return createPointSpriteTSLMaterial(sharedUniforms, rendererConfig);
  }
}

/**
 * Creates a TSL NodeMaterial for the trail ribbon renderer.
 *
 * @param trailUniforms - Trail-specific uniform values.
 * @param rendererConfig - Material rendering properties.
 * @returns A NodeMaterial instance configured for trail ribbon rendering.
 */
export function createTSLTrailMaterial(
  trailUniforms: TrailUniforms,
  rendererConfig: RendererConfig
): THREE.Material {
  return createTrailRibbonTSLMaterial(trailUniforms, rendererConfig);
}

/**
 * Creates the GPU compute pipeline for particle simulation.
 *
 * Bakes all lifetime curves, determines which modifiers are active,
 * creates GPU storage buffers, and returns the complete compute pipeline.
 * All `three/webgpu` imports are contained here — the caller does not
 * need to import any WebGPU-specific modules.
 *
 * @param maxParticles - Maximum particle count.
 * @param instanced - Whether to use InstancedBufferAttribute.
 * @param normalizedConfig - Fully normalized particle system config.
 * @param particleSystemId - Numeric ID for Bezier caching.
 * @param forceFieldCount - Number of active force fields.
 * @returns The complete modifier compute pipeline.
 */
export function createComputePipeline(
  maxParticles: number,
  instanced: boolean,
  normalizedConfig: NormalizedParticleSystemConfig,
  particleSystemId: number,
  forceFieldCount: number
): ModifierComputePipeline {
  const bakedCurves = bakeParticleSystemCurves(
    normalizedConfig,
    particleSystemId
  );

  const { velocityOverLifetime } = normalizedConfig;

  const flags: ModifierFlags = {
    sizeOverLifetime: normalizedConfig.sizeOverLifetime.isActive,
    opacityOverLifetime: normalizedConfig.opacityOverLifetime.isActive,
    colorOverLifetime: normalizedConfig.colorOverLifetime.isActive,
    rotationOverLifetime: normalizedConfig.rotationOverLifetime.isActive,
    linearVelocity:
      velocityOverLifetime.isActive &&
      (isLifeTimeCurve(velocityOverLifetime.linear.x ?? 0) ||
        isLifeTimeCurve(velocityOverLifetime.linear.y ?? 0) ||
        isLifeTimeCurve(velocityOverLifetime.linear.z ?? 0) ||
        velocityOverLifetime.linear.x !== 0 ||
        velocityOverLifetime.linear.y !== 0 ||
        velocityOverLifetime.linear.z !== 0),
    orbitalVelocity:
      velocityOverLifetime.isActive &&
      (isLifeTimeCurve(velocityOverLifetime.orbital.x ?? 0) ||
        isLifeTimeCurve(velocityOverLifetime.orbital.y ?? 0) ||
        isLifeTimeCurve(velocityOverLifetime.orbital.z ?? 0) ||
        velocityOverLifetime.orbital.x !== 0 ||
        velocityOverLifetime.orbital.y !== 0 ||
        velocityOverLifetime.orbital.z !== 0),
    noise: normalizedConfig.noise.isActive,
    forceFields: forceFieldCount > 0,
  };

  const buffers = createModifierStorageBuffers(
    maxParticles,
    instanced,
    bakedCurves.data,
    flags.forceFields
  );

  return createModifierComputeUpdate(
    buffers,
    maxParticles,
    bakedCurves,
    flags,
    forceFieldCount
  );
}
