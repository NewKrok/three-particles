/**
 * TSL (Three Shading Language) material for the trail ribbon renderer.
 *
 * Replicates the behavior of trail-vertex-shader.glsl.ts and
 * trail-fragment-shader.glsl.ts using TSL node-based materials.
 *
 * Key characteristics:
 * - Custom geometry with trail-specific per-vertex attributes
 * - Billboard ribbon: perp axis = cross(tangent, viewDir), with edge-on fallback
 * - Soft edge fade along the ribbon width (vUv.x axis)
 * - Optional texture modulation using luminance (dot-product brightness)
 * - DoubleSide rendering — no backface culling for ribbons
 * - NO texture sheet animation
 * - Trail uniforms are completely separate from the main particle uniforms
 */
import { DoubleSide } from 'three';
import {
  Fn,
  attribute,
  vec2,
  vec3,
  vec4,
  float,
  modelViewMatrix,
  positionLocal,
  texture,
  normalize,
  cross,
  dot,
  abs,
  mix,
  smoothstep,
  screenUV,
  Discard,
  If,
  length,
  varyingProperty,
  uniform,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { linearizeDepth } from './tsl-shared.js';
import type * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Uniforms consumed exclusively by the trail ribbon material.
 * These are managed separately from the main particle system's SharedUniforms.
 */
export type TrailUniforms = {
  /** Optional texture to modulate the ribbon color via luminance. */
  map: { value: THREE.Texture | null };
  /** Whether to apply texture modulation. */
  useMap: { value: boolean };
  /** Discard fragments whose color matches the background color. */
  discardBackgroundColor: { value: boolean };
  /** The background color to match for discard. */
  backgroundColor: { value: { r: number; g: number; b: number } };
  /** Tolerance radius in colour space for background discard. */
  backgroundColorTolerance: { value: number };
  /** Enable depth-difference soft-particle fading. */
  softParticlesEnabled: { value: boolean };
  /** Controls the fade distance for soft particles (view-space units). */
  softParticlesIntensity: { value: number };
  /** The pre-rendered scene depth texture, required for soft particles. */
  sceneDepthTexture: { value: THREE.Texture | null };
  /** Camera near/far planes packed as (near, far). */
  cameraNearFar: { value: THREE.Vector2 };
};

// ─── Internal uniform creators ───────────────────────────────────────────────

function createTrailUniforms(trailUniforms: TrailUniforms) {
  return {
    uMap: uniform(trailUniforms.map.value),
    uUseMap: uniform(float(trailUniforms.useMap.value ? 1 : 0)),
    uDiscardBg: uniform(
      float(trailUniforms.discardBackgroundColor.value ? 1 : 0)
    ),
    uBgColor: uniform(
      new (trailUniforms.cameraNearFar.value.constructor as new (
        x: number,
        y: number,
        z: number
      ) => THREE.Vector3)(
        trailUniforms.backgroundColor.value.r,
        trailUniforms.backgroundColor.value.g,
        trailUniforms.backgroundColor.value.b
      )
    ),
    uBgTolerance: uniform(float(trailUniforms.backgroundColorTolerance.value)),
    uSoftEnabled: uniform(
      float(trailUniforms.softParticlesEnabled.value ? 1 : 0)
    ),
    uSoftIntensity: uniform(float(trailUniforms.softParticlesIntensity.value)),
    uSceneDepthTex: uniform(trailUniforms.sceneDepthTexture.value),
    uCameraNearFar: uniform(trailUniforms.cameraNearFar.value),
  };
}

// ─── Material factory ─────────────────────────────────────────────────────────

/**
 * Creates a TSL-based MeshBasicNodeMaterial that replicates the GLSL trail
 * ribbon shaders. Works with both WebGPURenderer (WGSL output) and
 * WebGLRenderer (GLSL output) when using the node material system.
 *
 * The returned material expects geometry with these custom attributes:
 * - `trailAlpha`     — per-vertex opacity along the trail
 * - `trailColor`     — per-vertex RGBA colour
 * - `trailOffset`    — ribbon edge side: −0.5 (left) or +0.5 (right)
 * - `trailHalfWidth` — half-width of the ribbon at this vertex
 * - `trailNext`      — world-space position of the next trail sample
 * - `trailUV`        — UV coordinates (x: along-trail, y: across-ribbon)
 *
 * @param trailUniforms  - Per-trail uniform values (map, soft particles, bg discard, …).
 * @param rendererConfig - Blending / depth state forwarded to the material.
 * @returns Configured MeshBasicNodeMaterial ready for use with a trail mesh.
 */
export function createTrailRibbonTSLMaterial(
  trailUniforms: TrailUniforms,
  rendererConfig: {
    transparent: boolean;
    blending: THREE.Blending;
    depthTest: boolean;
    depthWrite: boolean;
  }
): MeshBasicNodeMaterial {
  const u = createTrailUniforms(trailUniforms);

  // ── Per-vertex attributes ────────────────────────────────────────────────

  const aTrailAlpha = attribute('trailAlpha');
  const aTrailColor = attribute('trailColor', 'vec4');
  const aTrailOffset = attribute('trailOffset');
  const aTrailHalfWidth = attribute('trailHalfWidth');
  const aTrailNext = attribute('trailNext', 'vec3');
  const aTrailUV = attribute('trailUV', 'vec2');

  // ── Varyings ─────────────────────────────────────────────────────────────

  const vAlpha = varyingProperty('float', 'vAlpha');
  const vColor = varyingProperty('vec4', 'vColor');
  const vUv = varyingProperty('vec2', 'vUv');
  const vViewZ = varyingProperty('float', 'vViewZ');

  // ── Vertex stage ──────────────────────────────────────────────────────────
  //
  // Replicates trail-vertex-shader.glsl — billboard ribbon expansion:
  //
  //   1. Compute tangent from current → next position (with degenerate guard).
  //   2. Derive the camera-right fallback from viewMatrix column 0.
  //   3. Compute perp = cross(tangent, viewDir); blend toward fallback when
  //      the cross product is near-zero (edge-on view).
  //   4. Offset position along perp by trailOffset * trailHalfWidth.
  //   5. Project and emit vViewZ for soft-particle depth test.

  const positionNode = Fn((): ShaderNodeObject<Node> => {
    // Pass varyings to fragment stage
    vAlpha.assign(aTrailAlpha);
    vColor.assign(aTrailColor);
    vUv.assign(aTrailUV);

    const current = vec3(positionLocal);
    const next = vec3(aTrailNext);

    // Tangent: direction from current to next sample
    const rawTangent = next.sub(current);
    const tangentLen = length(rawTangent);
    // Degenerate guard: fall back to +Y when consecutive samples coincide
    const tangent = normalize(
      tangentLen.lessThan(0.0001).select(vec3(0.0, 1.0, 0.0), rawTangent)
    );

    // View-space position of the current vertex (used for viewDir + vViewZ)
    const mvCurrent = modelViewMatrix.mul(vec4(current, 1.0));

    // View direction: from vertex toward camera in world space
    // In view space the camera is at the origin, so viewDir = normalize(-mvPos.xyz)
    const viewDir = normalize(mvCurrent.xyz.negate());

    // Primary billboard perpendicular
    const rawPerp = cross(tangent, viewDir);
    const perpLen = length(rawPerp);

    // Camera right vector extracted from the view matrix (column 0)
    // viewMatrix[col][row] — in TSL column-major: element(col, row)
    const camRight = vec3(
      modelViewMatrix.element(0).element(0),
      modelViewMatrix.element(1).element(0),
      modelViewMatrix.element(2).element(0)
    );

    // Fallback perpendicular: project camRight onto the plane perpendicular to tangent
    const camRightDotTangent = dot(camRight, tangent);
    const fallbackPerp = normalize(
      camRight.sub(tangent.mul(camRightDotTangent))
    );

    // When perpLen is near zero the ribbon is edge-on; use fallback.
    // Otherwise blend smoothly toward fallback over a wide range (0 → 0.7)
    // to prevent abrupt flipping, matching the GLSL shader exactly.
    const perp = normalize(
      perpLen
        .lessThan(0.0001)
        .select(
          fallbackPerp,
          normalize(
            mix(
              fallbackPerp,
              normalize(rawPerp),
              smoothstep(float(0.0), float(0.7), perpLen)
            )
          )
        )
    );

    // Expand ribbon vertex by offset side and half-width
    const offsetPos = current.add(perp.mul(aTrailOffset).mul(aTrailHalfWidth));

    // Emit view-space depth for soft particles
    const mvOffset = modelViewMatrix.mul(vec4(offsetPos, 1.0));
    vViewZ.assign(mvOffset.z.negate());

    // Return the offset position in local space; TSL's positionNode feeds this
    // through the standard MVP transform automatically, so returning offsetPos
    // is sufficient — the engine reconstructs the clip-space position.
    return offsetPos;
  })();

  // ── Fragment stage ────────────────────────────────────────────────────────
  //
  // Replicates trail-fragment-shader.glsl:
  //   1. Soft edge fade along the ribbon width using vUv.x.
  //   2. Optional luminance-weighted texture modulation.
  //   3. Alpha = vColor.a * vAlpha * edgeFade (plus optional soft-particle fade).
  //   4. Background color discard.

  const colorNode = Fn((): ShaderNodeObject<Node> => {
    const outColor = vec4(vColor).toVar();

    // Soft edge fade: vUv.x runs [0, 1] across the ribbon width.
    // edgeDist = 1 − |2·x − 1| peaks at 0.5 (centre) and is 0 at edges.
    const edgeDist = float(1.0).sub(abs(aTrailUV.x.mul(2.0).sub(1.0)));
    const edgeFade = smoothstep(float(0.0), float(0.4), edgeDist);

    // Optional texture: modulate colour by luminance (perceptual weighting)
    // and multiply alpha by texture alpha — matching the GLSL shader.
    If(u.uUseMap.greaterThan(0.5), () => {
      const texColor = texture(u.uMap, aTrailUV);
      const texBrightness = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
      outColor.rgb.assign(
        outColor.rgb.mul(float(0.5).add(texBrightness.mul(0.5)))
      );
      outColor.a.assign(outColor.a.mul(texColor.a));
    });

    // Combine alpha: particle alpha × ribbon edge fade
    outColor.a.assign(outColor.a.mul(vAlpha).mul(edgeFade));

    // Early discard for fully transparent fragments
    If(outColor.a.lessThan(0.001), () => {
      Discard();
    });

    // Soft particles — depth-difference fade
    If(u.uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = texture(u.uSceneDepthTex, screenUV).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: u.uCameraNearFar.x,
        far: u.uCameraNearFar.y,
      });
      const depthDiff = sceneDepthLinear.sub(vViewZ);
      const softFade = smoothstep(float(0.0), u.uSoftIntensity, depthDiff);
      outColor.a.assign(outColor.a.mul(softFade));
      If(outColor.a.lessThan(0.001), () => {
        Discard();
      });
    });

    // Background color discard
    If(u.uDiscardBg.greaterThan(0.5), () => {
      const diff = vec3(
        outColor.r.sub(u.uBgColor.x),
        outColor.g.sub(u.uBgColor.y),
        outColor.b.sub(u.uBgColor.z)
      );
      If(abs(length(diff)).lessThan(u.uBgTolerance), () => {
        Discard();
      });
    });

    return outColor;
  })();

  // ── Material assembly ─────────────────────────────────────────────────────

  const material = new MeshBasicNodeMaterial();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.side = DoubleSide;

  // positionNode replaces the default local-space position fed into MVP
  material.positionNode = positionNode;
  material.colorNode = colorNode;

  return material;
}
