export {
  createTSLParticleMaterial,
  createTSLTrailMaterial,
  createComputePipeline,
} from './js/effects/three-particles/webgpu/tsl-materials.js';

export {
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
} from './js/effects/three-particles/webgpu/compute-modifiers.js';

export { encodeForceFieldsForGPU } from './js/effects/three-particles/webgpu/compute-force-fields.js';
