/**
 * Shared TSL helper nodes used by multiple particle renderer materials.
 *
 * These functions create reusable shader node fragments for:
 * - Texture sheet animation (frame index + sprite-sheet UV calculation)
 * - Soft particle depth fade
 * - Background color discard
 */
import {
  Fn,
  vec2,
  vec4,
  float,
  uniform,
  texture,
  abs,
  floor,
  mod,
  max,
  min,
  round,
  smoothstep,
  screenUV,
  Discard,
  If,
  length,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';

import type * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SharedUniforms = {
  map: { value: THREE.Texture | null };
  elapsed: { value: number };
  fps: { value: number };
  useFPSForFrameIndex: { value: boolean };
  tiles: { value: THREE.Vector2 };
  discardBackgroundColor: { value: boolean };
  backgroundColor: { value: { r: number; g: number; b: number } };
  backgroundColorTolerance: { value: number };
  softParticlesEnabled: { value: boolean };
  softParticlesIntensity: { value: number };
  sceneDepthTexture: { value: THREE.Texture | null };
  cameraNearFar: { value: THREE.Vector2 };
  [key: string]: { value: unknown };
};

// ─── Uniform creators ────────────────────────────────────────────────────────

export function createParticleUniforms(sharedUniforms: SharedUniforms) {
  return {
    uMap: uniform(sharedUniforms.map.value),
    uElapsed: uniform(float(sharedUniforms.elapsed.value)),
    uFps: uniform(float(sharedUniforms.fps.value)),
    uUseFPSForFrameIndex: uniform(
      float(sharedUniforms.useFPSForFrameIndex.value ? 1 : 0)
    ),
    uTiles: uniform(sharedUniforms.tiles.value),
    uDiscardBg: uniform(
      float(sharedUniforms.discardBackgroundColor.value ? 1 : 0)
    ),
    uBgColor: uniform(
      new /* avoid importing THREE just for this */ (sharedUniforms
        .cameraNearFar.value.constructor as new (
        x: number,
        y: number,
        z: number
      ) => THREE.Vector3)(
        sharedUniforms.backgroundColor.value.r,
        sharedUniforms.backgroundColor.value.g,
        sharedUniforms.backgroundColor.value.b
      )
    ),
    uBgTolerance: uniform(float(sharedUniforms.backgroundColorTolerance.value)),
    uSoftEnabled: uniform(
      float(sharedUniforms.softParticlesEnabled.value ? 1 : 0)
    ),
    uSoftIntensity: uniform(float(sharedUniforms.softParticlesIntensity.value)),
    uSceneDepthTex: uniform(sharedUniforms.sceneDepthTexture.value),
    uCameraNearFar: uniform(sharedUniforms.cameraNearFar.value),
  };
}

// ─── Texture sheet animation ─────────────────────────────────────────────────

/**
 * Computes the frame index for texture sheet animation.
 *
 * Replicates the GLSL logic:
 *   frameIndex = startFrame + (useFPS ? lifetime/1000 * fps : floor(lifePercent * totalFrames))
 */
export const computeFrameIndex = Fn(
  ({
    vLifetime,
    vStartLifetime,
    vStartFrame,
    uFps,
    uUseFPSForFrameIndex,
    uTiles,
  }: Record<string, ShaderNodeObject<Node>>) => {
    const totalFrames = uTiles.x.mul(uTiles.y);
    const lifePercent = min(vLifetime.div(vStartLifetime), float(1.0));

    // FPS-based: (lifetime / 1000) * fps
    const fpsBased = max(vLifetime.div(1000.0).mul(uFps), float(0.0));

    // Lifetime-based: floor(lifePercent * totalFrames), clamped
    const lifetimeBased = max(
      min(floor(lifePercent.mul(totalFrames)), totalFrames.sub(1.0)),
      float(0.0)
    );

    // Select based on mode (uUseFPSForFrameIndex: 1.0 = FPS, 0.0 = lifetime)
    // When fps == 0 in FPS mode, use 0
    const fpsResult = uFps.equal(0.0).select(float(0.0), fpsBased);
    const frameOffset = uUseFPSForFrameIndex
      .greaterThan(0.5)
      .select(fpsResult, lifetimeBased);

    return round(vStartFrame).add(frameOffset);
  }
);

/**
 * Computes sprite-sheet UV coordinates from a base UV and the frame index.
 *
 * Replicates:
 *   spriteX = floor(mod(frameIndex, tiles.x))
 *   spriteY = floor(mod(frameIndex / tiles.x, tiles.y))
 *   uv = baseUV / tiles + sprite / tiles
 */
export const computeSpriteSheetUV = Fn(
  ({ baseUV, frameIndex, uTiles }: Record<string, ShaderNodeObject<Node>>) => {
    const spriteX = floor(mod(frameIndex, uTiles.x));
    const spriteY = floor(mod(frameIndex.div(uTiles.x), uTiles.y));

    return vec2(
      baseUV.x.div(uTiles.x).add(spriteX.div(uTiles.x)),
      baseUV.y.div(uTiles.y).add(spriteY.div(uTiles.y))
    );
  }
);

// ─── Soft particles ──────────────────────────────────────────────────────────

/**
 * Linearizes a depth buffer sample from [0,1] NDC to view-space distance.
 */
export const linearizeDepth = Fn(
  ({ depthSample, near, far }: Record<string, ShaderNodeObject<Node>>) => {
    const zNdc = depthSample.mul(2.0).sub(1.0);
    return near
      .mul(2.0)
      .mul(far)
      .div(far.add(near).sub(zNdc.mul(far.sub(near))));
  }
);

/**
 * Computes the soft-particle alpha multiplier based on depth difference.
 * Returns 1.0 when soft particles are disabled.
 */
export const computeSoftParticleFade = Fn(
  ({
    viewZ,
    uSoftEnabled,
    uSoftIntensity,
    uSceneDepthTex,
    uCameraNearFar,
  }: Record<string, ShaderNodeObject<Node>>) => {
    const softFade = float(1.0).toVar();

    If(uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = texture(uSceneDepthTex, screenUV).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: uCameraNearFar.x,
        far: uCameraNearFar.y,
      });
      const depthDiff = sceneDepthLinear.sub(viewZ);
      softFade.assign(smoothstep(float(0.0), uSoftIntensity, depthDiff));
    });

    return softFade;
  }
);

// ─── Background color discard ────────────────────────────────────────────────

/**
 * Discards fragments whose texture color is close to the background color.
 */
export const applyBackgroundDiscard = Fn(
  ({
    texColor,
    uDiscardBg,
    uBgColor,
    uBgTolerance,
  }: Record<string, ShaderNodeObject<Node>>) => {
    If(uDiscardBg.greaterThan(0.5), () => {
      const diff = vec4(
        texColor.x.sub(uBgColor.x),
        texColor.y.sub(uBgColor.y),
        texColor.z.sub(uBgColor.z),
        float(0.0)
      );
      If(abs(length(diff.xyz)).lessThan(uBgTolerance), () => {
        Discard();
      });
    });
  }
);
