/**
 * Tests for createTrailRibbonTSLMaterial.
 *
 * Verifies that the TSL trail ribbon material:
 * - Returns a MeshBasicNodeMaterial with DoubleSide
 * - Propagates renderer config
 * - Sets positionNode and colorNode as TSL nodes
 * - Handles soft particles and texture modulation without error
 */

import { AdditiveBlending, DoubleSide, Vector2 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  createTrailRibbonTSLMaterial,
  type TrailUniforms,
} from '../js/effects/three-particles/webgpu/tsl-trail-ribbon-material.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTSLNode(x: unknown): boolean {
  return (
    x !== null &&
    (typeof x === 'object' || typeof x === 'function') &&
    (x as Record<string, unknown>)['isNode'] === true
  );
}

function makeTrailUniforms(): TrailUniforms {
  return {
    map: { value: null },
    useMap: { value: false },
    discardBackgroundColor: { value: false },
    backgroundColor: { value: { r: 0, g: 0, b: 0 } },
    backgroundColorTolerance: { value: 0.01 },
    softParticlesEnabled: { value: false },
    softParticlesIntensity: { value: 1.0 },
    sceneDepthTexture: { value: null },
    cameraNearFar: { value: new Vector2(0.1, 1000) },
  };
}

const rendererConfig = {
  transparent: true,
  blending: AdditiveBlending,
  depthTest: true,
  depthWrite: false,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createTrailRibbonTSLMaterial', () => {
  it('returns a MeshBasicNodeMaterial with DoubleSide', () => {
    const mat = createTrailRibbonTSLMaterial(
      makeTrailUniforms(),
      rendererConfig
    );
    expect(mat).toBeInstanceOf(MeshBasicNodeMaterial);
    expect(mat.side).toBe(DoubleSide);
  });

  it('propagates renderer config', () => {
    const mat = createTrailRibbonTSLMaterial(makeTrailUniforms(), {
      transparent: false,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: true,
    });
    expect(mat.transparent).toBe(false);
    expect(mat.depthTest).toBe(false);
    expect(mat.depthWrite).toBe(true);
  });

  it('sets positionNode and colorNode as valid TSL nodes', () => {
    const mat = createTrailRibbonTSLMaterial(
      makeTrailUniforms(),
      rendererConfig
    );
    expect(isTSLNode(mat.positionNode)).toBe(true);
    expect(isTSLNode(mat.colorNode)).toBe(true);
    expect(mat.positionNode).not.toBe(mat.colorNode);
  });

  it('does not throw with soft particles enabled', () => {
    const uniforms = makeTrailUniforms();
    uniforms.softParticlesEnabled = { value: true };
    expect(() =>
      createTrailRibbonTSLMaterial(uniforms, rendererConfig)
    ).not.toThrow();
  });

  it('does not throw with texture modulation enabled', () => {
    const uniforms = makeTrailUniforms();
    uniforms.useMap = { value: true };
    expect(() =>
      createTrailRibbonTSLMaterial(uniforms, rendererConfig)
    ).not.toThrow();
  });

  it('returns independent material instances', () => {
    const mat1 = createTrailRibbonTSLMaterial(
      makeTrailUniforms(),
      rendererConfig
    );
    const mat2 = createTrailRibbonTSLMaterial(
      makeTrailUniforms(),
      rendererConfig
    );
    expect(mat1).not.toBe(mat2);
  });
});
