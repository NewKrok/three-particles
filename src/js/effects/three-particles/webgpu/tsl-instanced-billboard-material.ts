/**
 * TSL (Three Shading Language) material for the INSTANCED billboard particle renderer.
 *
 * Replicates the behavior of instanced-particle-vertex-shader.glsl.ts and
 * instanced-particle-fragment-shader.glsl.ts using TSL node-based materials.
 *
 * Key differences from the POINTS TSL material ({@link createPointSpriteTSLMaterial}):
 * - Uses `instanceOffset` (vec3) attribute for particle world-space position instead
 *   of the built-in `position` node.
 * - All per-particle attributes use the `instance` prefix
 *   (`instanceSize`, `instanceColorR`, …).
 * - The base geometry is a -0.5…0.5 quad; UV is derived from the quad vertex position
 *   rather than `pointUV` / `gl_PointCoord`.
 * - Perspective-correct size scaling uses `cameraProjectionMatrix[1][1]` and a
 *   `viewportHeight` uniform so that billboard quads match POINTS renderer pixel sizes.
 * - The billboard offset is applied in view space:
 *   `mvPosition.xy += position.xy * perspectiveSize`
 * - Uses {@link MeshBasicNodeMaterial} because the instanced quads are rendered as a
 *   `THREE.Mesh`, not a `THREE.Points`.
 */
import {
  Fn,
  attribute,
  vec2,
  vec4,
  float,
  uniform,
  modelViewMatrix,
  positionLocal,
  cameraProjectionMatrix,
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
import { MeshBasicNodeMaterial } from 'three/webgpu';

import {
  type SharedUniforms,
  createParticleUniforms,
  linearizeDepth,
} from './tsl-shared.js';
import type * as THREE from 'three';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a TSL-based {@link MeshBasicNodeMaterial} that replicates the GLSL instanced
 * billboard particle shaders. Works with both WebGPURenderer (WGSL output) and
 * WebGLRenderer (GLSL output) when using the node material system.
 *
 * The material is designed for use with an `InstancedBufferGeometry` whose base mesh
 * is a unit quad (vertices at ±0.5 in X and Y). Per-particle data is supplied via
 * `THREE.InstancedBufferAttribute` arrays with the following names:
 *
 * | Attribute name       | Type    | Description                              |
 * |----------------------|---------|------------------------------------------|
 * | `instanceOffset`     | vec3    | Particle world-space position            |
 * | `instanceSize`       | float   | Uniform scale factor                     |
 * | `instanceColorR/G/B/A` | float | Per-particle RGBA colour                 |
 * | `instanceLifetime`   | float   | Remaining lifetime (ms)                  |
 * | `instanceStartLifetime` | float | Initial lifetime (ms)                   |
 * | `instanceRotation`   | float   | 2-D billboard rotation (radians)         |
 * | `instanceStartFrame` | float   | Starting frame for texture sheet anim    |
 *
 * Size scaling matches the POINTS renderer exactly:
 * ```
 * perspectiveSize = instanceSize * 100.0 / dist
 *                   * (-mvPosition.z)
 *                   / (projectionMatrix[1][1] * viewportHeight * 0.5)
 * ```
 *
 * @param sharedUniforms - Live uniform values shared with the particle system.
 * @param rendererConfig - Blending / depth / transparency settings.
 * @returns A configured {@link MeshBasicNodeMaterial}.
 */
export function createInstancedBillboardTSLMaterial(
  sharedUniforms: SharedUniforms,
  rendererConfig: {
    transparent: boolean;
    blending: THREE.Blending;
    depthTest: boolean;
    depthWrite: boolean;
  }
): MeshBasicNodeMaterial {
  const u = createParticleUniforms(sharedUniforms);

  // ── viewportHeight uniform ─────────────────────────────────────────────────
  //
  // The particle system's onBeforeRender hook updates `sharedUniforms.viewportHeight.value`
  // each frame.  To propagate those writes into the TSL shader graph without
  // modifying the caller, we create the TSL uniform node and then back-patch
  // `sharedUniforms.viewportHeight` to point at the same node.  From that
  // point on, `sharedUniforms.viewportHeight.value = x` directly mutates
  // `uViewportHeight.value`, keeping both paths (GLSL fallback and TSL) in sync.
  const uViewportHeight = uniform(
    typeof (sharedUniforms.viewportHeight as { value?: number })?.value ===
      'number'
      ? (sharedUniforms.viewportHeight as { value: number }).value
      : 1.0
  );

  // Back-patch the shared uniform so the caller's live updates are reflected
  // in the TSL uniform node automatically.
  sharedUniforms.viewportHeight = uViewportHeight as unknown as {
    value: unknown;
  };

  // ── Per-instance attributes ────────────────────────────────────────────────

  /** Particle world-space centre (vec3). */
  const aInstanceOffset = attribute('instanceOffset');
  /** Uniform size scalar. */
  const aInstanceSize = attribute('instanceSize');

  // Per-particle appearance
  const aColorR = attribute('instanceColorR');
  const aColorG = attribute('instanceColorG');
  const aColorB = attribute('instanceColorB');
  const aColorA = attribute('instanceColorA');
  const aLifetime = attribute('instanceLifetime');
  const aStartLifetime = attribute('instanceStartLifetime');
  const aRotation = attribute('instanceRotation');
  const aStartFrame = attribute('instanceStartFrame');

  // ── Varyings ───────────────────────────────────────────────────────────────

  const vColor = varyingProperty('vec4', 'vColor');
  const vLifetime = varyingProperty('float', 'vLifetime');
  const vStartLifetime = varyingProperty('float', 'vStartLifetime');
  const vRotation = varyingProperty('float', 'vRotation');
  const vStartFrame = varyingProperty('float', 'vStartFrame');
  /** View-space UV coordinates derived from the quad vertex position. */
  const vUv = varyingProperty('vec2', 'vUv');
  /** Positive view-space depth for soft-particle depth comparison. */
  const vViewZ = varyingProperty('float', 'vViewZ');

  // ── Vertex stage ───────────────────────────────────────────────────────────

  /**
   * Replicates the GLSL instanced vertex shader:
   *
   * 1. Transform `instanceOffset` (particle world position) into view space.
   * 2. Compute distance-based perspective scale so the billboard matches POINTS
   *    renderer pixel sizes exactly.
   * 3. Offset the quad vertices in view space (`mvPosition.xy += position.xy * scale`).
   * 4. Project to clip space.
   * 5. Derive UV from quad vertex position (flip Y to match `gl_PointCoord` convention).
   *
   * In TSL's `positionNode` the returned value is the local-space position, and the
   * renderer applies the full MVP transform automatically.  For instanced billboards
   * we need to manipulate the view-space position directly (to add the billboard
   * offset), so we work in view space and then multiply by the projection matrix
   * ourselves before returning.
   *
   * Because `positionNode` is expected to return the *local-space* position that TSL
   * will then transform via MVP, and we have already applied the full MVP here, we
   * must also suppress the automatic MVP multiplication.  The recommended pattern for
   * this in TSL is to assign the result to `vertexNode` (which replaces clip-space
   * output directly) rather than `positionNode`.  We therefore store the computed
   * clip-space position and expose it via the material's `vertexNode` property.
   */
  const vertexNode = Fn((): ShaderNodeObject<Node> => {
    // Populate varyings
    vColor.assign(vec4(aColorR, aColorG, aColorB, aColorA));
    vLifetime.assign(aLifetime);
    vStartLifetime.assign(aStartLifetime);
    vRotation.assign(aRotation);
    vStartFrame.assign(aStartFrame);

    // UV: quad vertex ranges from -0.5..0.5; remap to 0..1 and flip Y so the
    // top-left of the texture corresponds to the top-left of the billboard.
    // This matches gl_PointCoord which has Y running top-to-bottom.
    //   vUv.x = position.x + 0.5
    //   vUv.y = 0.5 - position.y
    vUv.assign(vec2(positionLocal.x.add(0.5), float(0.5).sub(positionLocal.y)));

    // Transform the particle world position into view space
    const mvPosition = modelViewMatrix.mul(vec4(aInstanceOffset, 1.0)).toVar();

    // Match POINTS renderer pixel size:
    //   gl_PointSize = instanceSize * 100.0 / distance
    // Equivalent view-space billboard half-extent (in view units):
    //   perspectiveSize = pointSizePx * (-mvPosition.z)
    //                     / (projectionMatrix[1][1] * viewportHeight * 0.5)
    // projectionMatrix[1][1] == cameraProjectionMatrix.element(1).element(1)
    const dist = length(mvPosition.xyz);
    const pointSizePx = aInstanceSize.mul(100.0).div(dist);
    const projY = cameraProjectionMatrix.element(1).element(1);
    const perspectiveSize = pointSizePx
      .mul(mvPosition.z.negate())
      .div(projY.mul(uViewportHeight).mul(0.5));

    // Billboard: expand the quad in view space (no rotation here; rotation is
    // applied to UVs in the fragment stage, identical to the POINTS approach)
    mvPosition.x.addAssign(positionLocal.x.mul(perspectiveSize));
    mvPosition.y.addAssign(positionLocal.y.mul(perspectiveSize));

    vViewZ.assign(mvPosition.z.negate());

    // Project to clip space
    return cameraProjectionMatrix.mul(mvPosition);
  })();

  // ── Fragment stage ─────────────────────────────────────────────────────────

  /**
   * Replicates the GLSL instanced fragment shader:
   *
   * 1. Apply 2-D rotation to the UV (identical to POINTS material).
   * 2. Discard pixels outside the inscribed circle (radius > 0.5).
   * 3. Compute texture sheet frame index.
   * 4. Sample the sprite-sheet texture at the rotated, tile-offset UV.
   * 5. Background colour discard.
   * 6. Soft-particle depth fade.
   */
  const fragmentColor = Fn((): ShaderNodeObject<Node> => {
    const outColor = vec4(vColor).toVar();

    // Rotate vUv around (0.5, 0.5) to match the POINTS renderer behaviour
    const center = vec2(0.5, 0.5);
    const centered = vUv.sub(center);
    const cosR = cos(vRotation);
    const sinR = sin(vRotation);
    const rotated = vec2(
      centered.x.mul(cosR).add(centered.y.mul(sinR)),
      centered.x.mul(sinR).negate().add(centered.y.mul(cosR))
    );
    const rotatedUV = rotated.add(center);

    // Discard pixels outside the inscribed circle (dist > 0.5 from centre)
    const dist = length(rotatedUV.sub(center));
    If(dist.greaterThan(0.5), () => {
      Discard();
    });

    // Texture sheet animation — compute frame index
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

    // Sprite-sheet tile coordinates
    const spriteX = floor(mod(frameIndex, u.uTiles.x));
    const spriteY = floor(mod(frameIndex.div(u.uTiles.x), u.uTiles.y));

    // Compute sprite-sheet UV from rotated UV + tile offset
    const uvPoint = vec2(
      rotatedUV.x.div(u.uTiles.x).add(spriteX.div(u.uTiles.x)),
      rotatedUV.y.div(u.uTiles.y).add(spriteY.div(u.uTiles.y))
    );

    // Sample texture
    const texColor = texture(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));

    // Background colour discard
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

    // Soft particles — fade out fragments close to opaque scene geometry
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

  // vertexNode replaces the default clip-space position.  For instanced
  // billboards we compute the full MVP ourselves (view-space billboard offset +
  // projection), so the result is already in clip space.
  material.vertexNode = vertexNode;
  material.colorNode = fragmentColor;

  return material;
}
