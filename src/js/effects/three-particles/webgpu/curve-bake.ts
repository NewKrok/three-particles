/**
 * Curve baking utilities for WebGPU compute shader lookup.
 *
 * Converts JavaScript lifetime curve functions (Bezier and Easing) into packed
 * Float32Arrays that can be uploaded as GPU storage buffers or data textures.
 * The GPU shader looks up a baked value with:
 *
 *   value = data[curveIndex * CURVE_RESOLUTION + floor(t * (CURVE_RESOLUTION - 1))]
 *
 * with linear interpolation between adjacent samples for smooth results.
 *
 * @module
 */

import {
  calculateValue,
  getCurveFunctionFromConfig,
  isLifeTimeCurve,
} from '../three-particles-utils.js';
import type {
  NormalizedParticleSystemConfig,
  LifetimeCurve,
} from '../types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Number of samples per baked curve.
 *
 * 256 gives sub-0.4% maximum interpolation error for smooth curves while
 * keeping each curve to exactly one kilobyte of Float32 data (256 × 4 bytes).
 * The GPU shader indexes: `data[curveIndex * CURVE_RESOLUTION + floor(t * 255)]`.
 */
export const CURVE_RESOLUTION = 256;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result of baking all active lifetime curves from a particle system config.
 *
 * All curves are packed sequentially into a single `data` Float32Array.
 * Each slot stores a curve index (≥ 0) if the corresponding modifier is active,
 * or `-1` when the modifier is inactive / uses a constant value.
 *
 * The GPU shader accesses a sample via:
 * ```glsl
 * float t01 = clamp(particleLifetime / startLifetime, 0.0, 1.0);
 * int   idx = curveIndex * CURVE_RESOLUTION + int(t01 * 255.0);
 * float val = data[idx]; // + optional linear interpolation
 * ```
 */
export type BakedCurveMap = {
  /** All baked curves packed sequentially (curveCount × CURVE_RESOLUTION floats). */
  data: Float32Array;
  /** Total number of baked curves stored in `data`. */
  curveCount: number;
  /** Curve index for `sizeOverLifetime.lifetimeCurve` (-1 if inactive). */
  sizeOverLifetime: number;
  /** Curve index for `opacityOverLifetime.lifetimeCurve` (-1 if inactive). */
  opacityOverLifetime: number;
  /** Curve index for `colorOverLifetime.r` (-1 if inactive). */
  colorR: number;
  /** Curve index for `colorOverLifetime.g` (-1 if inactive). */
  colorG: number;
  /** Curve index for `colorOverLifetime.b` (-1 if inactive). */
  colorB: number;
  /** Curve index for `velocityOverLifetime.linear.x` (-1 if not a curve). */
  linearVelX: number;
  /** Curve index for `velocityOverLifetime.linear.y` (-1 if not a curve). */
  linearVelY: number;
  /** Curve index for `velocityOverLifetime.linear.z` (-1 if not a curve). */
  linearVelZ: number;
  /** Curve index for `velocityOverLifetime.orbital.x` (-1 if not a curve). */
  orbitalVelX: number;
  /** Curve index for `velocityOverLifetime.orbital.y` (-1 if not a curve). */
  orbitalVelY: number;
  /** Curve index for `velocityOverLifetime.orbital.z` (-1 if not a curve). */
  orbitalVelZ: number;
};

// ─── Core Sampling ────────────────────────────────────────────────────────────

/**
 * Samples a curve function at `resolution` evenly-spaced points over [0, 1]
 * and returns the results as a `Float32Array`.
 *
 * The i-th element is `curveFn(i / (resolution - 1))`, so both endpoints
 * (t = 0 and t = 1) are always included.
 *
 * @param curveFn  - Any `(t: number) => number` function. t is in [0, 1].
 * @param resolution - Number of samples to take. Defaults to {@link CURVE_RESOLUTION}.
 * @returns A `Float32Array` of length `resolution` with the sampled values.
 *
 * @example
 * ```typescript
 * const linear = bakeCurve(t => t);           // [0, 1/255, 2/255, …, 1]
 * const stepped = bakeCurve(t => t, 4);       // [0, 0.333, 0.667, 1]
 * ```
 */
export function bakeCurve(
  curveFn: (t: number) => number,
  resolution: number = CURVE_RESOLUTION
): Float32Array {
  const samples = new Float32Array(resolution);
  const lastIndex = resolution - 1;

  for (let i = 0; i < resolution; i++) {
    // Evenly space samples from 0 to 1 inclusive.
    const t = lastIndex === 0 ? 0 : i / lastIndex;
    samples[i] = curveFn(t);
  }

  return samples;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Bakes a single {@link LifetimeCurve} config into the packed buffer at the
 * given write offset and returns the next free write offset.
 *
 * @param buffer           - The destination Float32Array.
 * @param writeOffset      - The first float index to write into.
 * @param particleSystemId - Used by the Bezier caching layer.
 * @param curve            - The curve configuration to bake.
 * @returns The next available write offset (writeOffset + CURVE_RESOLUTION).
 */
function bakeCurveIntoBuffer(
  buffer: Float32Array,
  writeOffset: number,
  particleSystemId: number,
  curve: LifetimeCurve
): number {
  const curveFn = getCurveFunctionFromConfig(particleSystemId, curve);
  const lastIndex = CURVE_RESOLUTION - 1;

  for (let i = 0; i < CURVE_RESOLUTION; i++) {
    const t = lastIndex === 0 ? 0 : i / lastIndex;
    buffer[writeOffset + i] = curveFn(t);
  }

  return writeOffset + CURVE_RESOLUTION;
}

/**
 * Bakes a velocity axis value (constant, random, or curve) into the buffer.
 * Constants and random ranges are baked as flat curves using their mid-point.
 */
function bakeVelocityAxisIntoBuffer(
  buffer: Float32Array,
  writeOffset: number,
  particleSystemId: number,
  value:
    | import('../types.js').Constant
    | import('../types.js').RandomBetweenTwoConstants
    | LifetimeCurve
): number {
  if (isLifeTimeCurve(value)) {
    return bakeCurveIntoBuffer(buffer, writeOffset, particleSystemId, value);
  }
  // Constant or RandomBetweenTwoConstants — bake as flat curve using mid-point
  const constantValue = calculateValue(particleSystemId, value, 0.5);
  for (let i = 0; i < CURVE_RESOLUTION; i++) {
    buffer[writeOffset + i] = constantValue;
  }
  return writeOffset + CURVE_RESOLUTION;
}

// ─── Particle System Curve Baking ─────────────────────────────────────────────

/**
 * Bakes all active lifetime curves from a normalized particle system config
 * into a single, GPU-ready {@link BakedCurveMap}.
 *
 * The function inspects each modifier in order:
 * 1. `sizeOverLifetime` — baked if `isActive` is true
 * 2. `opacityOverLifetime` — baked if `isActive` is true
 * 3. `colorOverLifetime` (r, g, b) — all three baked if `isActive` is true
 * 4. `velocityOverLifetime.linear` (x, y, z) — each axis baked if the value
 *    is a {@link LifetimeCurve} (constants and random ranges are skipped)
 * 5. `velocityOverLifetime.orbital` (x, y, z) — same rule as linear
 *
 * Curves are packed sequentially into a single `Float32Array`:
 * ```
 * [curve0_sample0, …, curve0_sample255, curve1_sample0, …, curveN_sample255]
 * ```
 *
 * @param normalizedConfig - A fully normalized particle system configuration
 *   (all properties required, produced by the particle system initialization).
 * @param particleSystemId - Numeric ID passed to the Bezier caching layer so
 *   it can reuse pre-evaluated Bezier functions for the same particle system.
 * @returns A {@link BakedCurveMap} with the packed data and per-modifier
 *   curve indices. Inactive modifiers / constant axes have index `-1`.
 *
 * @example
 * ```typescript
 * const map = bakeParticleSystemCurves(normalizedConfig, systemId);
 * // Upload map.data to a GPU buffer.
 * // Pass map.sizeOverLifetime, map.opacityOverLifetime, … as uniforms.
 * ```
 */
export function bakeParticleSystemCurves(
  normalizedConfig: NormalizedParticleSystemConfig,
  particleSystemId: number
): BakedCurveMap {
  // ── Phase 1: count how many curves will be baked ──────────────────────────
  let curveCount = 0;

  const {
    sizeOverLifetime,
    opacityOverLifetime,
    colorOverLifetime,
    velocityOverLifetime,
  } = normalizedConfig;

  const hasSizeOverLifetime = sizeOverLifetime.isActive;
  const hasOpacityOverLifetime = opacityOverLifetime.isActive;
  const hasColorOverLifetime = colorOverLifetime.isActive;

  // For velocity axes, bake BOTH curves AND constant/random values.
  // Constants/randoms are baked as flat curves using calculateValue (mid-point).
  const isVelActive = velocityOverLifetime.isActive;
  const hasLinearVelX =
    isVelActive &&
    velocityOverLifetime.linear.x !== undefined &&
    velocityOverLifetime.linear.x !== 0;
  const hasLinearVelY =
    isVelActive &&
    velocityOverLifetime.linear.y !== undefined &&
    velocityOverLifetime.linear.y !== 0;
  const hasLinearVelZ =
    isVelActive &&
    velocityOverLifetime.linear.z !== undefined &&
    velocityOverLifetime.linear.z !== 0;

  const hasOrbitalVelX =
    isVelActive &&
    velocityOverLifetime.orbital.x !== undefined &&
    velocityOverLifetime.orbital.x !== 0;
  const hasOrbitalVelY =
    isVelActive &&
    velocityOverLifetime.orbital.y !== undefined &&
    velocityOverLifetime.orbital.y !== 0;
  const hasOrbitalVelZ =
    isVelActive &&
    velocityOverLifetime.orbital.z !== undefined &&
    velocityOverLifetime.orbital.z !== 0;

  if (hasSizeOverLifetime) curveCount++;
  if (hasOpacityOverLifetime) curveCount++;
  if (hasColorOverLifetime) curveCount += 3; // r, g, b always together
  if (hasLinearVelX) curveCount++;
  if (hasLinearVelY) curveCount++;
  if (hasLinearVelZ) curveCount++;
  if (hasOrbitalVelX) curveCount++;
  if (hasOrbitalVelY) curveCount++;
  if (hasOrbitalVelZ) curveCount++;

  // ── Phase 2: allocate the packed buffer ───────────────────────────────────
  const data = new Float32Array(curveCount * CURVE_RESOLUTION);

  // ── Phase 3: bake curves in a consistent, sequential order ────────────────
  let writeOffset = 0;
  let nextIndex = 0;

  // Index slots — -1 signals "not active / not a curve".
  let sizeOverLifetimeIdx = -1;
  let opacityOverLifetimeIdx = -1;
  let colorRIdx = -1;
  let colorGIdx = -1;
  let colorBIdx = -1;
  let linearVelXIdx = -1;
  let linearVelYIdx = -1;
  let linearVelZIdx = -1;
  let orbitalVelXIdx = -1;
  let orbitalVelYIdx = -1;
  let orbitalVelZIdx = -1;

  if (hasSizeOverLifetime) {
    sizeOverLifetimeIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      sizeOverLifetime.lifetimeCurve
    );
  }

  if (hasOpacityOverLifetime) {
    opacityOverLifetimeIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      opacityOverLifetime.lifetimeCurve
    );
  }

  if (hasColorOverLifetime) {
    colorRIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      colorOverLifetime.r
    );

    colorGIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      colorOverLifetime.g
    );

    colorBIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      colorOverLifetime.b
    );
  }

  if (hasLinearVelX) {
    linearVelXIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.linear.x!
    );
  }

  if (hasLinearVelY) {
    linearVelYIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.linear.y!
    );
  }

  if (hasLinearVelZ) {
    linearVelZIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.linear.z!
    );
  }

  if (hasOrbitalVelX) {
    orbitalVelXIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.orbital.x!
    );
  }

  if (hasOrbitalVelY) {
    orbitalVelYIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.orbital.y!
    );
  }

  if (hasOrbitalVelZ) {
    orbitalVelZIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.orbital.z!
    );
  }

  return {
    data,
    curveCount,
    sizeOverLifetime: sizeOverLifetimeIdx,
    opacityOverLifetime: opacityOverLifetimeIdx,
    colorR: colorRIdx,
    colorG: colorGIdx,
    colorB: colorBIdx,
    linearVelX: linearVelXIdx,
    linearVelY: linearVelYIdx,
    linearVelZ: linearVelZIdx,
    orbitalVelX: orbitalVelXIdx,
    orbitalVelY: orbitalVelYIdx,
    orbitalVelZ: orbitalVelZIdx,
  };
}

// ─── GPU Upload Helpers ───────────────────────────────────────────────────────

/**
 * Wraps a {@link BakedCurveMap}'s packed data in a `THREE.DataTexture` that
 * can be bound as a 1D lookup texture in a WebGL or WebGPU material.
 *
 * The texture is `curveCount × CURVE_RESOLUTION` pixels wide and 1 pixel tall,
 * using a single red-channel (`RedFormat`) 32-bit float format.  A GPU shader
 * can sample it with:
 * ```glsl
 * float u = (float(curveIndex * RESOLUTION) + t255 + 0.5)
 *           / float(curveCount * RESOLUTION);
 * float val = texture2D(curveTex, vec2(u, 0.5)).r;
 * ```
 *
 * @param bakedCurves - The result of {@link bakeParticleSystemCurves}.
 * @returns A `THREE.DataTexture` ready for use as a material uniform, or
 *   `null` when `curveCount` is 0 (no curves to upload).
 *
 * @remarks
 * - `needsUpdate` is set to `true` so Three.js uploads the data on first use.
 * - The caller is responsible for calling `.dispose()` when the particle system
 *   is destroyed to release GPU memory.
 * - For WebGPU storage-buffer binding, use `bakedCurves.data` directly instead.
 */
export function createCurveDataTexture(
  bakedCurves: BakedCurveMap
): import('three').DataTexture | null {
  if (bakedCurves.curveCount === 0) {
    return null;
  }

  // Deferred import so this module remains usable in non-browser / test
  // environments where the THREE globals may not be set up.

  const THREE = require('three') as typeof import('three');

  const width = bakedCurves.curveCount * CURVE_RESOLUTION;
  const texture = new THREE.DataTexture(
    bakedCurves.data,
    width,
    1,
    THREE.RedFormat,
    THREE.FloatType
  );

  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}
