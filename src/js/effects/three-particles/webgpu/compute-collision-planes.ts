/**
 * GPU collision plane computation for particle systems.
 *
 * Encodes collision plane configurations into a flat Float32Array that can be
 * written into the shared curveData storage buffer (avoiding an extra
 * storage buffer binding that would exceed the WebGPU per-stage limit of 8).
 *
 * Provides a TSL helper function that iterates over the encoded planes
 * and applies collision responses (kill, clamp, bounce) to particles.
 *
 * Collision plane modes:
 *   - KILL (0): deactivate the particle immediately
 *   - CLAMP (1): project position onto plane, zero velocity along normal
 *   - BOUNCE (2): reflect velocity with damping, project position
 *
 * @module
 */
import {
  Fn,
  float,
  vec3,
  vec4,
  uniform,
  If,
  Loop,
  Continue,
  dot,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';

import { CollisionPlaneMode } from '../three-particles-enums.js';
import type { NormalizedCollisionPlaneConfig } from '../types.js';

// ─── Encoding Layout ─────────────────────────────────────────────────────────

/**
 * Per-plane stride in the packed Float32Array.
 *
 * Layout per collision plane (12 floats):
 *   [0]    isActive (0 or 1)
 *   [1]    mode (0 = KILL, 1 = CLAMP, 2 = BOUNCE)
 *   [2-4]  position (x, y, z)
 *   [5-7]  normal (x, y, z) — normalized
 *   [8]    dampen (0–1)
 *   [9]    lifetimeLoss (0–1)
 *   [10-11] padding (reserved)
 */
const PLANE_STRIDE = 12;

/** Maximum collision planes supported per particle system. */
export const MAX_COLLISION_PLANES = 16;

/** Total floats reserved for collision plane data in the curveData buffer. */
export const COLLISION_PLANE_DATA_SIZE = MAX_COLLISION_PLANES * PLANE_STRIDE;

// ─── CPU-side Encoding ───────────────────────────────────────────────────────

/**
 * Packs an array of collision plane configs into a flat Float32Array for GPU upload.
 *
 * @param planes - Normalized collision plane configs from the particle system.
 * @returns A Float32Array of `MAX_COLLISION_PLANES * PLANE_STRIDE` floats.
 */
export function encodeCollisionPlanesForGPU(
  planes: ReadonlyArray<NormalizedCollisionPlaneConfig>
): Float32Array {
  const data = new Float32Array(COLLISION_PLANE_DATA_SIZE);

  const count = Math.min(planes.length, MAX_COLLISION_PLANES);
  for (let i = 0; i < count; i++) {
    const cp = planes[i];
    const base = i * PLANE_STRIDE;

    data[base] = cp.isActive ? 1 : 0;

    let modeCode = 0;
    if (cp.mode === CollisionPlaneMode.CLAMP) modeCode = 1;
    else if (cp.mode === CollisionPlaneMode.BOUNCE) modeCode = 2;
    data[base + 1] = modeCode;

    data[base + 2] = cp.position.x;
    data[base + 3] = cp.position.y;
    data[base + 4] = cp.position.z;
    data[base + 5] = cp.normal.x;
    data[base + 6] = cp.normal.y;
    data[base + 7] = cp.normal.z;
    data[base + 8] = cp.dampen;
    data[base + 9] = cp.lifetimeLoss;
    data[base + 10] = 0; // padding
    data[base + 11] = 0; // padding
  }

  return data;
}

// ─── TSL Collision Plane Application ─────────────────────────────────────────

/**
 * Creates the TSL uniform and helper function for applying collision planes
 * in a GPU compute shader.
 *
 * Collision plane data is read from the shared curveData storage buffer at a
 * fixed offset, avoiding an additional storage buffer binding.
 *
 * @param sCurveData - The shared curveData storage node.
 * @param collisionPlaneOffset - Float offset into curveData where collision plane data starts.
 * @param collisionPlaneCount - Number of active collision planes (0 to MAX_COLLISION_PLANES).
 * @returns Object with the count uniform and the TSL apply function.
 */
export function createCollisionPlaneTSL(
  sCurveData: ShaderNodeObject<Node>,
  collisionPlaneOffset: number,
  collisionPlaneCount: number
) {
  const count = Math.min(collisionPlaneCount, MAX_COLLISION_PLANES);
  const uCollisionPlaneCount = uniform(float(count));
  const cpBase = collisionPlaneOffset;

  /**
   * TSL function that applies all collision planes to a particle.
   *
   * @param pos - Current particle position (vec3, modified in place)
   * @param vel - Current particle velocity (vec3, modified in place)
   * @param oiaVec - orbitalIsActive vec4 (w = isActive, modified for KILL)
   * @param sColor - Color storage node (modified for KILL)
   * @param ps - particleState vec4 (x = lifetime, modified for lifetime loss)
   * @param startLife - Start lifetime scalar (for lifetime loss)
   * @param i - Particle index (for storage buffer element access)
   * @param sOrbitalIsActive - orbitalIsActive storage node (for KILL)
   */
  const applyCollisionPlanesTSL = Fn(
    ({
      pos,
      vel,
      oiaVec,
      sColorNode,
      ps,
      startLife,
      particleIdx,
      sOrbitalIsActiveNode,
    }: {
      pos: ShaderNodeObject<Node>;
      vel: ShaderNodeObject<Node>;
      oiaVec: ShaderNodeObject<Node>;
      sColorNode: ShaderNodeObject<Node>;
      ps: ShaderNodeObject<Node>;
      startLife: ShaderNodeObject<Node>;
      particleIdx: ShaderNodeObject<Node>;
      sOrbitalIsActiveNode: ShaderNodeObject<Node>;
    }) => {
      Loop(uCollisionPlaneCount, ({ i }: { i: ShaderNodeObject<Node> }) => {
        const base = i.mul(PLANE_STRIDE).add(cpBase);

        const isActive = sCurveData.element(base);
        If(isActive.lessThan(0.5), () => {
          Continue();
        });

        const mode = sCurveData.element(base.add(1));
        const planePos = vec3(
          sCurveData.element(base.add(2)),
          sCurveData.element(base.add(3)),
          sCurveData.element(base.add(4))
        );
        const planeNormal = vec3(
          sCurveData.element(base.add(5)),
          sCurveData.element(base.add(6)),
          sCurveData.element(base.add(7))
        );
        const dampen = sCurveData.element(base.add(8));
        const lifetimeLoss = sCurveData.element(base.add(9));

        // Signed distance from particle to plane
        const toParticle = pos.sub(planePos);
        const signedDist = dot(toParticle, planeNormal);

        // Only respond when particle is on the wrong side (signedDist < 0)
        If(signedDist.lessThan(0.0), () => {
          // KILL mode (mode < 0.5)
          // Set lifetime far past startLifetime so the death check at the end
          // of the kernel deactivates the particle and zeroes color AFTER all
          // modifiers have run (modifiers would otherwise overwrite our color).
          If(mode.lessThan(0.5), () => {
            ps.x.assign(startLife.add(float(1.0)));
          });

          // CLAMP mode (mode >= 0.5 && mode < 1.5)
          If(mode.greaterThanEqual(0.5).and(mode.lessThan(1.5)), () => {
            // Project position onto plane surface
            pos.assign(pos.sub(planeNormal.mul(signedDist)));

            // Remove velocity component along normal (only if moving into the plane)
            const velDotN = dot(vel, planeNormal);
            If(velDotN.lessThan(0.0), () => {
              vel.assign(vel.sub(planeNormal.mul(velDotN)));
            });
          });

          // BOUNCE mode (mode >= 1.5)
          If(mode.greaterThanEqual(1.5), () => {
            // Project position onto plane surface
            pos.assign(pos.sub(planeNormal.mul(signedDist)));

            // Reflect velocity: v' = (v - 2 * dot(v, n) * n) * dampen
            const vDotN = dot(vel, planeNormal);
            const reflected = vel.sub(planeNormal.mul(vDotN.mul(2.0)));
            vel.assign(reflected.mul(dampen));

            // Apply lifetime loss
            If(lifetimeLoss.greaterThan(0.0), () => {
              ps.x.assign(ps.x.add(lifetimeLoss.mul(startLife).mul(1000.0)));
            });
          });
        });
      });
    },
    'void'
  );

  return {
    /** Uniform for the active collision plane count. */
    countUniform: uCollisionPlaneCount,
    /** TSL function to call in the compute kernel: apply({ pos, vel, ... }) */
    apply: applyCollisionPlanesTSL,
  };
}
