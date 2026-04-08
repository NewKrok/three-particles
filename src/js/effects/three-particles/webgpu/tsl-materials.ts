/**
 * TSL material factory for all particle renderer types.
 *
 * Selects and creates the appropriate TSL NodeMaterial based on the
 * renderer type (POINTS, INSTANCED, MESH, TRAIL).
 *
 * @module
 */
import { RendererType } from '../three-particles-enums.js';
import { createInstancedBillboardTSLMaterial } from './tsl-instanced-billboard-material.js';
import { createMeshParticleTSLMaterial } from './tsl-mesh-particle-material.js';
import { createPointSpriteTSLMaterial } from './tsl-point-sprite-material.js';
import {
  createTrailRibbonTSLMaterial,
  type TrailUniforms,
} from './tsl-trail-ribbon-material.js';
import type { SharedUniforms } from './tsl-shared.js';
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
  rendererConfig: RendererConfig
): THREE.Material {
  switch (rendererType) {
    case RendererType.INSTANCED:
      return createInstancedBillboardTSLMaterial(
        sharedUniforms,
        rendererConfig
      );
    case RendererType.MESH:
      return createMeshParticleTSLMaterial(sharedUniforms, rendererConfig);
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
