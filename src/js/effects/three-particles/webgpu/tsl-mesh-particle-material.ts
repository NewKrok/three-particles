/**
 * TSL (Three Shading Language) material for the MESH particle renderer.
 *
 * Replicates the behavior of mesh-particle-vertex-shader.glsl.ts and
 * mesh-particle-fragment-shader.glsl.ts using TSL node-based materials.
 *
 * Key differences from the POINTS / INSTANCED TSL materials:
 *  - Uses `instanceQuat` (vec4) for full 3D quaternion rotation of mesh vertices.
 *  - Transforms normals by the same quaternion for per-fragment directional lighting.
 *  - Uses real mesh UVs (`uv`) rather than a derived point-coord or billboard UV.
 *  - No circle discard — mesh geometry defines the particle shape.
 *  - Texture sheet animation is only applied when tiles > 1×1.
 *  - Simple directional lighting: `0.5 + 0.5 * max(dot(vNormal, vec3(0,0,1)), 0.0)`.
 */
import {
  Fn,
  attribute,
  vec2,
  vec3,
  vec4,
  float,
  cameraProjectionMatrix,
  modelViewMatrix,
  positionLocal,
  normalLocal,
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
  cross,
  dot,
  varyingProperty,
  uv,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import {
  type SharedUniforms,
  createParticleUniforms,
  linearizeDepth,
} from './tsl-shared.js';

import type * as THREE from 'three';

// ─── Quaternion helper ────────────────────────────────────────────────────────

/**
 * Applies a unit quaternion `q` to vector `v`.
 *
 * Replicates the GLSL helper:
 * ```glsl
 * vec3 applyQuaternion(vec3 v, vec4 q) {
 *   vec3 t = 2.0 * cross(q.xyz, v);
 *   return v + q.w * t + cross(q.xyz, t);
 * }
 * ```
 */
const applyQuaternion = Fn(
  ({ v, q }: Record<string, ShaderNodeObject<Node>>) => {
    const t = cross(q.xyz, v).mul(2.0);
    return v.add(t.mul(q.w)).add(cross(q.xyz, t));
  }
);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a TSL-based {@link MeshBasicNodeMaterial} that replicates the GLSL
 * mesh particle shaders. Works with both WebGPURenderer (WGSL output) and
 * WebGLRenderer (GLSL output) when using the node material system.
 *
 * @param sharedUniforms - Live uniform values shared with the particle system.
 * @param rendererConfig - Blending / depth / transparency settings.
 * @returns A configured {@link MeshBasicNodeMaterial}.
 */
export function createMeshParticleTSLMaterial(
  sharedUniforms: SharedUniforms,
  rendererConfig: {
    transparent: boolean;
    blending: THREE.Blending;
    depthTest: boolean;
    depthWrite: boolean;
  },
  gpuCompute = false
): MeshBasicNodeMaterial {
  const u = createParticleUniforms(sharedUniforms);

  // ── Per-instance attributes ────────────────────────────────────────────────

  /** Particle world-space position (vec3). */
  const aInstanceOffset = attribute('instanceOffset');
  /** Packed RGBA color (vec4). */
  const aColor = attribute('instanceColor');

  // GPU compute uses packed vec4 buffers; CPU uses individual attributes
  const aParticleState = gpuCompute ? attribute('instanceParticleState') : null;
  const aStartValues = gpuCompute ? attribute('instanceStartValues') : null;
  /** Particle orientation as a unit quaternion (vec4: x, y, z, w). CPU path only. */
  const aInstanceQuat = gpuCompute ? null : attribute('instanceQuat');
  const aSize = gpuCompute ? null : attribute('instanceSize');
  const aLifetime = gpuCompute ? null : attribute('instanceLifetime');
  const aStartLifetime = gpuCompute ? null : attribute('instanceStartLifetime');
  const aRotation = gpuCompute ? null : attribute('instanceRotation');
  const aStartFrame = gpuCompute ? null : attribute('instanceStartFrame');

  // ── Varyings ───────────────────────────────────────────────────────────────

  const vColor = varyingProperty('vec4', 'vColor');
  const vLifetime = varyingProperty('float', 'vLifetime');
  const vStartLifetime = varyingProperty('float', 'vStartLifetime');
  const vStartFrame = varyingProperty('float', 'vStartFrame');
  const vRotation = varyingProperty('float', 'vRotation');
  /** View-space normal, transformed by the instance quaternion. */
  const vNormal = varyingProperty('vec3', 'vNormal');
  /** View-space depth (positive distance from camera). */
  const vViewZ = varyingProperty('float', 'vViewZ');

  // ── Vertex stage ───────────────────────────────────────────────────────────

  /**
   * Computes the world-space vertex position for each mesh vertex:
   *   1. Rotate the mesh vertex by the instance quaternion.
   *   2. Scale by instanceSize.
   *   3. Translate by instanceOffset.
   * Also populates all varyings for the fragment stage.
   */
  const vertexSetup = Fn(() => {
    // Populate varyings
    vColor.assign(aColor.toVar());
    if (gpuCompute) {
      vLifetime.assign(aParticleState!.x);
      vStartLifetime.assign(aStartValues!.x);
      vStartFrame.assign(aParticleState!.w);
      vRotation.assign(aParticleState!.z);
    } else {
      vLifetime.assign(aLifetime!);
      vStartLifetime.assign(aStartLifetime!);
      vStartFrame.assign(aStartFrame!);
      vRotation.assign(aRotation!);
    }

    // Build quaternion: GPU compute derives it from particleState.z (rotation
    // angle around Z); CPU path reads the pre-computed instanceQuat attribute.
    let quat: ShaderNodeObject<Node>;
    if (gpuCompute) {
      const halfZ = aParticleState!.z.mul(0.5);
      quat = vec4(0.0, 0.0, sin(halfZ), cos(halfZ));
    } else {
      quat = aInstanceQuat!;
    }

    // 1. Rotate mesh vertex position by instance quaternion
    const rotatedPos = applyQuaternion({
      v: positionLocal,
      q: quat,
    });

    // 2. Scale by particle size
    const scaledPos = rotatedPos.mul(gpuCompute ? aParticleState!.y : aSize!);

    // 3. Translate to particle world position
    // Use .xyz to handle vec3→vec4 padding by WebGPU storage buffer alignment
    const worldPos = scaledPos.add(aInstanceOffset.xyz);

    // Compute model-view position for depth and normal
    const mvPos = modelViewMatrix.mul(vec4(worldPos, 1.0));
    vViewZ.assign(mvPos.z.negate());

    // Transform normal: rotate by quaternion then into view space
    const rotatedNormal = applyQuaternion({
      v: normalLocal,
      q: quat,
    });
    const mvNormal = modelViewMatrix.mul(vec4(rotatedNormal, 0.0)).xyz;
    vNormal.assign(mvNormal.normalize());

    // Return clip-space position (manual MVP to avoid double-transform)
    return cameraProjectionMatrix.mul(mvPos);
  })();

  // ── Fragment stage ─────────────────────────────────────────────────────────

  const fragmentColor = Fn(() => {
    const outColor = vColor.toVar();

    // Use mesh UVs as the base for texture sampling
    const uvPoint = vec2(uv()).toVar();

    // Texture sheet animation — only applied when tiles > 1×1
    If(u.uTiles.x.greaterThan(1.0).or(u.uTiles.y.greaterThan(1.0)), () => {
      const totalFrames = u.uTiles.x.mul(u.uTiles.y);
      const lifePercent = min(vLifetime.div(vStartLifetime), float(1.0));

      // FPS-based frame index
      const fpsBased = max(vLifetime.div(1000.0).mul(u.uFps), float(0.0));

      // Lifetime-based frame index (clamped to valid range)
      const lifetimeBased = max(
        min(floor(lifePercent.mul(totalFrames)), totalFrames.sub(1.0)),
        float(0.0)
      );

      const fpsResult = u.uFps.equal(0.0).select(float(0.0), fpsBased);
      const frameOffset = u.uUseFPSForFrameIndex
        .greaterThan(0.5)
        .select(fpsResult, lifetimeBased);
      const frameIndex = round(vStartFrame).add(frameOffset);

      // Sprite-sheet tile coordinates
      const spriteX = floor(mod(frameIndex, u.uTiles.x));
      const spriteY = floor(mod(frameIndex.div(u.uTiles.x), u.uTiles.y));

      // Remap mesh UV into the selected tile
      uvPoint.assign(
        vec2(
          uv().x.div(u.uTiles.x).add(spriteX.div(u.uTiles.x)),
          uv().y.div(u.uTiles.y).add(spriteY.div(u.uTiles.y))
        )
      );
    });

    // Sample texture using the (possibly remapped) UV
    const texColor = texture(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));

    // Background color discard
    const bgDiff = vec3(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z)
    );
    Discard(
      u.uDiscardBg
        .greaterThan(0.5)
        .and(abs(length(bgDiff)).lessThan(u.uBgTolerance))
    );

    // Simple directional lighting from camera direction (+Z in view space).
    // lightIntensity = 0.5 + 0.5 * max(dot(vNormal, vec3(0,0,1)), 0.0)
    const lightIntensity = float(0.5).add(
      float(0.5).mul(max(dot(vNormal, vec3(0.0, 0.0, 1.0)), float(0.0)))
    );
    outColor.assign(vec4(outColor.xyz.mul(lightIntensity), outColor.w));

    // Soft particles — fade out fragments that are close to opaque scene geometry
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

  // ── Material assembly ──────────────────────────────────────────────────────

  const material = new MeshBasicNodeMaterial();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;

  // vertexNode receives a clip-space vec4 (manual MVP to avoid double-transform)
  material.vertexNode = vertexSetup;
  material.colorNode = fragmentColor;

  return material;
}
