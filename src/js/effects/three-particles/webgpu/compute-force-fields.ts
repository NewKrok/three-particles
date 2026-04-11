/**
 * GPU force field computation for particle systems.
 *
 * Encodes force field configurations into a flat Float32Array that can be
 * written into the shared curveData storage buffer (avoiding an extra
 * storage buffer binding that would exceed the WebGPU per-stage limit of 8).
 *
 * Provides a TSL helper function that iterates over the encoded fields
 * and applies forces to particle velocity.
 *
 * Force field types:
 *   - POINT: radial attract/repel toward a position with distance falloff
 *   - DIRECTIONAL: constant force along a direction vector
 *
 * Falloff modes (POINT only):
 *   - NONE: full strength regardless of distance
 *   - LINEAR: 1 - (d / range)
 *   - QUADRATIC: 1 - (d / range)²
 *
 * @module
 */
import {
  Fn,
  float,
  vec3,
  uniform,
  If,
  Loop,
  Continue,
  normalize,
  length,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';

import { ForceFieldFalloff, ForceFieldType } from '../three-particles-enums.js';
import { calculateValue } from '../three-particles-utils.js';
import type { NormalizedForceFieldConfig } from '../types.js';

// ─── Encoding Layout ─────────────────────────────────────────────────────────

/**
 * Per-field stride in the packed Float32Array.
 *
 * Layout per force field (12 floats):
 *   [0]    isActive (0 or 1)
 *   [1]    type (0 = POINT, 1 = DIRECTIONAL)
 *   [2-4]  position (x, y, z)
 *   [5-7]  direction (x, y, z) — normalized
 *   [8]    strength (constant, evaluated at bake time)
 *   [9]    range (Infinity encoded as a very large number: 1e10)
 *   [10]   falloff (0 = NONE, 1 = LINEAR, 2 = QUADRATIC)
 *   [11]   padding (reserved)
 */
const FIELD_STRIDE = 12;

/** Maximum force fields supported per particle system. */
export const MAX_FORCE_FIELDS = 16;

/** Total floats reserved for force field data in the curveData buffer. */
export const FORCE_FIELD_DATA_SIZE = MAX_FORCE_FIELDS * FIELD_STRIDE;

/** Sentinel value for "infinite" range on GPU (avoids Infinity in Float32). */
const GPU_INFINITY = 1e10;

// ─── CPU-side Encoding ───────────────────────────────────────────────────────

/**
 * Packs an array of force field configs into a flat Float32Array for GPU upload.
 *
 * @param forceFields - Normalized force field configs from the particle system.
 * @param particleSystemId - System ID for curve evaluation.
 * @param systemLifetimePercentage - Current system lifetime progress for strength curves.
 * @returns A Float32Array of `MAX_FORCE_FIELDS * FIELD_STRIDE` floats.
 */
export function encodeForceFieldsForGPU(
  forceFields: ReadonlyArray<NormalizedForceFieldConfig>,
  particleSystemId: number,
  systemLifetimePercentage: number
): Float32Array {
  const data = new Float32Array(FORCE_FIELD_DATA_SIZE);

  const count = Math.min(forceFields.length, MAX_FORCE_FIELDS);
  for (let i = 0; i < count; i++) {
    const ff = forceFields[i];
    const base = i * FIELD_STRIDE;

    data[base] = ff.isActive ? 1 : 0;
    data[base + 1] = ff.type === ForceFieldType.POINT ? 0 : 1;
    data[base + 2] = ff.position.x;
    data[base + 3] = ff.position.y;
    data[base + 4] = ff.position.z;
    data[base + 5] = ff.direction.x;
    data[base + 6] = ff.direction.y;
    data[base + 7] = ff.direction.z;
    data[base + 8] = calculateValue(
      particleSystemId,
      ff.strength,
      systemLifetimePercentage
    );
    data[base + 9] = ff.range === Infinity ? GPU_INFINITY : ff.range;

    let falloffCode = 0;
    if (ff.falloff === ForceFieldFalloff.LINEAR) falloffCode = 1;
    else if (ff.falloff === ForceFieldFalloff.QUADRATIC) falloffCode = 2;
    data[base + 10] = falloffCode;
    data[base + 11] = 0; // padding
  }

  return data;
}

// ─── TSL Force Field Application ─────────────────────────────────────────────

/**
 * Creates the TSL uniform and helper function for applying force fields
 * in a GPU compute shader.
 *
 * Force field data is read from the shared curveData storage buffer at a
 * fixed offset, avoiding an additional storage buffer binding.
 *
 * @param sCurveData - The shared curveData storage node.
 * @param forceFieldOffset - Float offset into curveData where force field data starts.
 * @param forceFieldCount - Number of active force fields (0 to MAX_FORCE_FIELDS).
 * @returns Object with the count uniform and the TSL apply function.
 */
export function createForceFieldTSL(
  sCurveData: ShaderNodeObject<Node>,
  forceFieldOffset: number,
  forceFieldCount: number
) {
  const count = Math.min(forceFieldCount, MAX_FORCE_FIELDS);
  const uForceFieldCount = uniform(float(count));
  const ffBase = forceFieldOffset;

  /**
   * TSL function that applies all force fields to a particle's velocity.
   *
   * @param pos - Current particle position (vec3, read-only)
   * @param vel - Current particle velocity (vec3, modified in place)
   * @param delta - Frame time in seconds (float)
   */
  const applyForceFieldsTSL = Fn(
    ({
      pos,
      vel,
      delta,
    }: {
      pos: ShaderNodeObject<Node>;
      vel: ShaderNodeObject<Node>;
      delta: ShaderNodeObject<Node>;
    }) => {
      Loop(uForceFieldCount, ({ i }: { i: ShaderNodeObject<Node> }) => {
        const base = i.mul(FIELD_STRIDE).add(ffBase);

        const isActive = sCurveData.element(base);
        If(isActive.lessThan(0.5), () => {
          Continue();
        });

        const fieldType = sCurveData.element(base.add(1));
        const fieldPos = vec3(
          sCurveData.element(base.add(2)),
          sCurveData.element(base.add(3)),
          sCurveData.element(base.add(4))
        );
        const fieldDir = vec3(
          sCurveData.element(base.add(5)),
          sCurveData.element(base.add(6)),
          sCurveData.element(base.add(7))
        );
        const strength = sCurveData.element(base.add(8));
        const range = sCurveData.element(base.add(9));
        const falloffType = sCurveData.element(base.add(10));

        If(strength.equal(0.0), () => {
          Continue();
        });

        // DIRECTIONAL force (type == 1)
        If(fieldType.greaterThan(0.5), () => {
          const force = strength.mul(delta);
          vel.assign(vel.add(fieldDir.mul(force)));
        });

        // POINT force (type == 0)
        If(fieldType.lessThan(0.5), () => {
          const toField = fieldPos.sub(pos);
          const dist = length(toField);

          // Skip if too close (avoid division by zero)
          If(dist.greaterThan(0.0001), () => {
            // Skip if outside range (range > GPU_INFINITY means infinite)
            const inRange = dist.lessThan(range);
            If(inRange, () => {
              const dir = normalize(toField);

              // Compute falloff multiplier
              const normDist = dist.div(range);

              // NONE falloff (type == 0): multiplier = 1.0
              // LINEAR falloff (type == 1): multiplier = 1 - normDist
              // QUADRATIC falloff (type == 2): multiplier = 1 - normDist²
              const falloffNone = float(1.0);
              const falloffLinear = float(1.0).sub(normDist);
              const falloffQuadratic = float(1.0).sub(normDist.mul(normDist));

              // Select based on falloff type
              const useLinear = falloffType.greaterThan(0.5);
              const useQuadratic = falloffType.greaterThan(1.5);
              const falloff = useQuadratic.select(
                falloffQuadratic,
                useLinear.select(falloffLinear, falloffNone)
              );

              // Apply force
              const force = strength.mul(falloff).mul(delta);
              vel.assign(vel.add(dir.mul(force)));
            });
          });
        });
      });
    },
    'void'
  );

  return {
    /** Uniform for the active force field count. */
    countUniform: uForceFieldCount,
    /** TSL function to call in the compute kernel: apply({ pos, vel, delta }) */
    apply: applyForceFieldsTSL,
  };
}
