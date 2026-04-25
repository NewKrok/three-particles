/**
 * TSL (Three Shading Language) material for the POINTS particle renderer.
 *
 * Replicates the behavior of particle-system-vertex-shader.glsl.ts and
 * particle-system-fragment-shader.glsl.ts using TSL node-based materials.
 */
import {
  Fn,
  attribute,
  vec2,
  vec4,
  float,
  modelViewMatrix,
  positionLocal,
  pointUV,
  texture,
  cos,
  sin,
  Discard,
  If,
  length,
  varyingProperty,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';
import { PointsNodeMaterial } from 'three/webgpu';

import {
  POINT_SIZE_SCALE,
  ALPHA_DISCARD_THRESHOLD,
} from '../three-particles-constants.js';
import {
  type SharedUniforms,
  createParticleUniforms,
  computeFrameIndex,
  computeSpriteSheetUV,
  computeSoftParticleFade,
  applyBackgroundDiscard,
} from './tsl-shared.js';
import type * as THREE from 'three';

/**
 * Creates a TSL-based PointsNodeMaterial that replicates the GLSL point sprite
 * particle shaders. Works with both WebGPURenderer (WGSL output) and
 * WebGLRenderer (GLSL output) when using the node material system.
 */
export function createPointSpriteTSLMaterial(
  sharedUniforms: SharedUniforms,
  rendererConfig: {
    transparent: boolean;
    blending: THREE.Blending;
    depthTest: boolean;
    depthWrite: boolean;
  },
  gpuCompute = false
): PointsNodeMaterial {
  const u = createParticleUniforms(sharedUniforms);

  // Read per-particle attributes
  const aColor = attribute('color');

  // GPU compute uses packed vec4 buffers; CPU uses individual attributes
  const aParticleState = gpuCompute ? attribute('particleState') : null;
  const aStartValues = gpuCompute ? attribute('startValues') : null;
  // CPU fallback: individual attributes
  const aSize = gpuCompute ? null : attribute('size');
  const aLifetime = gpuCompute ? null : attribute('lifetime');
  const aStartLifetime = gpuCompute ? null : attribute('startLifetime');
  const aRotation = gpuCompute ? null : attribute('rotation');
  const aStartFrame = gpuCompute ? null : attribute('startFrame');

  // ── Vertex stage ────────────────────────────────────────────────────────

  // Compute model-view position and distance-based point size
  const mvPos = modelViewMatrix.mul(vec4(positionLocal, 1.0));
  const sizeVal = gpuCompute ? aParticleState!.y : aSize!;
  const sizeNode = aColor.w
    .greaterThan(0.0)
    .select(sizeVal.mul(POINT_SIZE_SCALE).div(length(mvPos.xyz)), float(0.0));

  // Pass varyings to fragment
  const vColor = varyingProperty('vec4', 'vColor');
  const vLifetime = varyingProperty('float', 'vLifetime');
  const vStartLifetime = varyingProperty('float', 'vStartLifetime');
  const vRotation = varyingProperty('float', 'vRotation');
  const vStartFrame = varyingProperty('float', 'vStartFrame');
  const vViewZ = varyingProperty('float', 'vViewZ');

  // Assign varyings in vertex
  const vertexSetup = Fn(() => {
    // Early-out for dead particles: set size to 0 (produces zero-area points)
    // and skip all varying assignments to save vertex shader work.
    If(aColor.w.greaterThan(0.0), () => {
      vColor.assign(aColor.toVar());
      if (gpuCompute) {
        vLifetime.assign(aParticleState!.x);
        vStartLifetime.assign(aStartValues!.x);
        vRotation.assign(aParticleState!.z);
        vStartFrame.assign(aParticleState!.w);
      } else {
        vLifetime.assign(aLifetime!);
        vStartLifetime.assign(aStartLifetime!);
        vRotation.assign(aRotation!);
        vStartFrame.assign(aStartFrame!);
      }
      vViewZ.assign(mvPos.z.negate());
    });
    return positionLocal;
  })();

  // ── Fragment stage ──────────────────────────────────────────────────────

  const fragmentColor = Fn(() => {
    // Start with per-particle color
    const outColor = vColor.toVar();

    // Compute frame index (texture sheet animation)
    const frameIndex = computeFrameIndex({
      vLifetime,
      vStartLifetime,
      vStartFrame,
      uFps: u.uFps,
      uUseFPSForFrameIndex: u.uUseFPSForFrameIndex,
      uTiles: u.uTiles,
    });

    // Apply 2D rotation to pointUV
    const center = vec2(0.5, 0.5);
    const centered = pointUV.sub(center);
    const cosR = cos(vRotation);
    const sinR = sin(vRotation);
    const rotated = vec2(
      centered.x.mul(cosR).add(centered.y.mul(sinR)),
      centered.x.mul(sinR).negate().add(centered.y.mul(cosR))
    );
    const rotatedUV = rotated.add(center);

    // Circle discard (inscribed circle in point quad)
    const dist = length(rotatedUV.sub(center));
    Discard(dist.greaterThan(0.5));

    // Compute sprite-sheet UV
    const uvPoint = computeSpriteSheetUV({
      baseUV: rotatedUV,
      frameIndex,
      uTiles: u.uTiles,
    });

    // Sample texture
    const texColor = texture(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));

    // Background color discard
    applyBackgroundDiscard({
      texColor,
      uDiscardBg: u.uDiscardBg,
      uBgColor: u.uBgColor,
      uBgTolerance: u.uBgTolerance,
    });

    // Soft particles
    const softFade = computeSoftParticleFade({
      viewZ: vViewZ,
      uSoftEnabled: u.uSoftEnabled,
      uSoftIntensity: u.uSoftIntensity,
      uSceneDepthTex: u.uSceneDepthTex,
      uCameraNearFar: u.uCameraNearFar,
    });
    outColor.assign(vec4(outColor.xyz, outColor.w.mul(softFade)));
    Discard(outColor.w.lessThan(ALPHA_DISCARD_THRESHOLD));

    return outColor;
  })();

  // ── Material assembly ───────────────────────────────────────────────────

  const material = new PointsNodeMaterial();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.toneMapped = false;
  material.fog = false;
  material.sizeNode = sizeNode;
  material.positionNode = vertexSetup;
  material.colorNode = fragmentColor;

  return material;
}
