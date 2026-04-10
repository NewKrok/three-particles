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
  floor,
  max,
  min,
  smoothstep,
  round,
  mod,
  screenUV,
  Discard,
  If,
  abs,
  length,
  varyingProperty,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';
import { PointsNodeMaterial } from 'three/webgpu';

import {
  type SharedUniforms,
  createParticleUniforms,
  linearizeDepth,
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
  }
): PointsNodeMaterial {
  const u = createParticleUniforms(sharedUniforms);

  // Read per-particle attributes
  const aSize = attribute('size');
  const aColorR = attribute('colorR');
  const aColorG = attribute('colorG');
  const aColorB = attribute('colorB');
  const aColorA = attribute('colorA');
  const aLifetime = attribute('lifetime');
  const aStartLifetime = attribute('startLifetime');
  const aRotation = attribute('rotation');
  const aStartFrame = attribute('startFrame');

  // ── Vertex stage ────────────────────────────────────────────────────────

  // Compute model-view position and distance-based point size
  const mvPos = modelViewMatrix.mul(vec4(positionLocal, 1.0));
  const sizeNode = aSize.mul(100.0).div(length(mvPos.xyz));

  // Pass varyings to fragment
  const vColor = varyingProperty('vec4', 'vColor');
  const vLifetime = varyingProperty('float', 'vLifetime');
  const vStartLifetime = varyingProperty('float', 'vStartLifetime');
  const vRotation = varyingProperty('float', 'vRotation');
  const vStartFrame = varyingProperty('float', 'vStartFrame');
  const vViewZ = varyingProperty('float', 'vViewZ');

  // Assign varyings in vertex
  const vertexSetup = Fn(() => {
    vColor.assign(vec4(aColorR, aColorG, aColorB, aColorA));
    vLifetime.assign(aLifetime);
    vStartLifetime.assign(aStartLifetime);
    vRotation.assign(aRotation);
    vStartFrame.assign(aStartFrame);
    vViewZ.assign(mvPos.z.negate());
    return positionLocal;
  })();

  // ── Fragment stage ──────────────────────────────────────────────────────

  const fragmentColor = Fn(() => {
    // Start with per-particle color
    const outColor = vec4(vColor).toVar();

    // Compute frame index (texture sheet animation)
    const totalFrames = u.uTiles.x.mul(u.uTiles.y);
    const lifePercent = min(vLifetime.div(vStartLifetime), float(1.0));

    const fpsBased = max(vLifetime.div(1000.0).mul(u.uFps), float(0.0));
    const lifetimeBased = max(
      min(floor(lifePercent.mul(totalFrames)), totalFrames.sub(1.0)),
      float(0.0)
    );
    const fpsResult = u.uFps.equal(0.0).select(float(0.0), fpsBased);
    const frameOffset = u.uUseFPSForFrameIndex
      .greaterThan(0.5)
      .select(fpsResult, lifetimeBased);
    const frameIndex = round(vStartFrame).add(frameOffset);

    // Sprite sheet coordinates
    const spriteX = floor(mod(frameIndex, u.uTiles.x));
    const spriteY = floor(mod(frameIndex.div(u.uTiles.x), u.uTiles.y));

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
    const uvPoint = vec2(
      rotatedUV.x.div(u.uTiles.x).add(spriteX.div(u.uTiles.x)),
      rotatedUV.y.div(u.uTiles.y).add(spriteY.div(u.uTiles.y))
    );

    // Sample texture
    const texColor = texture(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));

    // Background color discard
    const bgDiff = vec4(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z),
      float(0.0)
    );
    Discard(
      u.uDiscardBg
        .greaterThan(0.5)
        .and(abs(length(bgDiff.xyz)).lessThan(u.uBgTolerance))
    );

    // Soft particles
    If(u.uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = texture(u.uSceneDepthTex, screenUV).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: u.uCameraNearFar.x,
        far: u.uCameraNearFar.y,
      });
      const depthDiff = sceneDepthLinear.sub(vViewZ);
      const softFade = smoothstep(float(0.0), u.uSoftIntensity, depthDiff);
      outColor.assign(vec4(outColor.xyz, outColor.w.mul(softFade)));
    });
    Discard(outColor.w.lessThan(0.001));

    return outColor;
  })();

  // ── Material assembly ───────────────────────────────────────────────────

  const material = new PointsNodeMaterial();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.sizeNode = sizeNode;
  material.positionNode = vertexSetup;
  material.colorNode = fragmentColor;

  return material;
}
