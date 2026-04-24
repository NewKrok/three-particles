import { registerTSLMaterialFactory } from '@newkrok/three-particles';
import { encodeCollisionPlanesForGPU } from './js/effects/three-particles/webgpu/compute-collision-planes.js';
import { encodeForceFieldsForGPU } from './js/effects/three-particles/webgpu/compute-force-fields.js';
import {
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
} from './js/effects/three-particles/webgpu/compute-modifiers.js';
import {
  createTSLParticleMaterial,
  createTSLTrailMaterial,
  createComputePipeline,
} from './js/effects/three-particles/webgpu/tsl-materials.js';

// Re-export all individual functions for power users
export {
  createTSLParticleMaterial,
  createTSLTrailMaterial,
  createComputePipeline,
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
  encodeCollisionPlanesForGPU,
  encodeForceFieldsForGPU,
};

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
export function enableWebGPU(): void {
  // The TSLMaterialFactory interface deliberately uses wider parameter types
  // (Record<string,…>) to avoid pulling WebGPU-specific imports into the
  // main DTS output. The concrete functions are fully type-safe at their
  // own definition sites; the cast here bridges the two type worlds.

  const factory: Parameters<typeof registerTSLMaterialFactory>[0] = {
    createTSLParticleMaterial: createTSLParticleMaterial as any,
    createTSLTrailMaterial: createTSLTrailMaterial as any,
    createComputePipeline,
    writeParticleToModifierBuffers,
    deactivateParticleInModifierBuffers,
    flushEmitQueue,
    registerCurveDataLength,
    encodeForceFieldsForGPU,
    encodeCollisionPlanesForGPU,
  };
  registerTSLMaterialFactory(factory);
}
