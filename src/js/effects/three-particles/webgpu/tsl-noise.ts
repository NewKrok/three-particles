/**
 * 3D Simplex Noise implemented in TSL (Three Shading Language).
 *
 * Adapted from the classic Ashima Arts / Stefan Gustavson simplex noise
 * implementation (MIT licence) for use in Three.js GPU compute shaders.
 *
 * References:
 *   - Stefan Gustavson, "Simplex noise demystified", 2005
 *   - https://github.com/ashima/webgl-noise
 *
 * @module
 */
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  floor,
  fract,
  dot,
  step,
  abs,
  min,
  max,
  mod,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Hash / permutation helper.
 *
 * Equivalent to the classic `mod289` + multiply-and-fold scheme:
 *   permute(x) = mod(((x * 34.0) + 10.0) * x, 289.0)
 *
 * The extra `10.0` (vs the original `1.0`) avoids degenerate runs near zero
 * and is widely used in TSL/WGSL ports of the Ashima implementation.
 */
const permute = Fn(({ x }: Record<string, ShaderNodeObject<Node>>) => {
  // ((x * 34.0 + 10.0) * x) mod 289.0
  return mod(x.mul(34.0).add(10.0).mul(x), float(289.0));
});

/**
 * Fast inverse square-root approximation.
 *
 * taylorInvSqrt(r) = 1.79284291400159 - 0.85373472095314 * r
 *
 * Used to normalise gradient vectors without a true sqrt.
 */
const taylorInvSqrt = Fn(({ r }: Record<string, ShaderNodeObject<Node>>) => {
  return float(1.79284291400159).sub(float(0.85373472095314).mul(r));
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 3D simplex noise implemented in TSL.
 *
 * Algorithm overview:
 *   1. Skew the input point into the simplex (tetrahedral) grid.
 *   2. Determine which of the six tetrahedra the skewed point occupies.
 *   3. Un-skew the four integer lattice corners back to real space.
 *   4. Compute pseudo-random gradient vectors at each corner via two rounds of
 *      `permute` (one for the iy/iz hash, one for ix), yielding per-corner
 *      gradient (gx, gy, gz) extracted using the "ns" mapping.
 *   5. Weight each corner's contribution by a radially-symmetric falloff
 *      `max(0, 0.5 - |x|²)⁴` and accumulate.
 *   6. Scale the result so the output lies in approximately [-1, 1].
 *
 * @param v - Input position (vec3).
 * @returns Noise value in approximately [-1, 1] (float).
 */
export const snoise3D: ReturnType<typeof Fn> = Fn(
  ({ v }: Record<string, ShaderNodeObject<Node>>) => {
    // ── Step 1: Skew input space ──────────────────────────────────────────────
    // F3 = 1/3. Skew the input space to determine which simplex cell we're in.
    const ONE_THIRD = float(1.0 / 3.0);
    const ONE_SIXTH = float(1.0 / 6.0);

    // i = floor(v + dot(v, vec3(1/3)))
    const i = floor(
      v.add(dot(v, vec3(ONE_THIRD, ONE_THIRD, ONE_THIRD)))
    ).toVar();

    // ── Step 2: Un-skew back to (x0,y0,z0) ──────────────────────────────────
    // x0 = v - i + dot(i, vec3(1/6))
    const x0 = v
      .sub(i)
      .add(dot(i, vec3(ONE_SIXTH, ONE_SIXTH, ONE_SIXTH)))
      .toVar();

    // ── Step 3: Determine simplex (tetrahedron) ───────────────────────────────
    // Which of the six tetrahedra is point x0 in?
    // Compare x0 components pairwise to rank them and identify the two
    // intermediate simplex corners (i1, i2).
    //
    // g = step(x0.yzx, x0.xyz): 1 where x0[i] >= x0[i-1 mod 3]
    // l = 1 - g.zxy             (complement for the other direction)
    const g = step(x0.yzx, x0.xyz).toVar();
    const l = float(1.0).sub(g).toVar();

    // i1: first offset (one unit step toward the dominant axis)
    // i2: second offset (two unit steps)
    const i1 = min(g.xyz, l.zxy).toVar();
    const i2 = max(g.xyz, l.zxy).toVar();

    // Un-skew the three corner displacements from x0:
    //   x1 = x0 - i1 + G3
    //   x2 = x0 - i2 + 2*G3
    //   x3 = x0 - 1  + 3*G3
    const x1 = x0.sub(i1).add(ONE_SIXTH).toVar();
    const x2 = x0.sub(i2).add(ONE_SIXTH.mul(2.0)).toVar();
    const x3 = x0.sub(float(1.0)).add(ONE_SIXTH.mul(3.0)).toVar();

    // ── Step 4: Permutation hashes → gradient directions ─────────────────────
    // Wrap i into [0, 289) so the hash stays well-behaved.
    const iw = mod(i, float(289.0)).toVar();

    // Hash yz layers first, then mix in x.
    // For each of the 4 corners, hash iz then iy:
    //   p_yz_c = permute(permute(iz_c) + iy_c)
    // Then hash ix:
    //   p_c    = permute(p_yz_c + ix_c)
    // Each final p_c is a scalar hash that encodes the full gradient direction.

    // Corner z-components: iz, iz+i1.z, iz+i2.z, iz+1
    const p0_yz = permute({
      x: permute({
        x: vec4(
          vec2(iw.z, iw.z.add(i1.z)),
          vec2(iw.z.add(i2.z), iw.z.add(1.0))
        ),
      }).add(
        vec4(vec2(iw.y, iw.y.add(i1.y)), vec2(iw.y.add(i2.y), iw.y.add(1.0)))
      ),
    });

    // Final hash: mix in x-components
    const p = permute({
      x: p0_yz.add(
        vec4(vec2(iw.x, iw.x.add(i1.x)), vec2(iw.x.add(i2.x), iw.x.add(1.0)))
      ),
    });

    // ── Step 5: Convert hash to gradient directions ───────────────────────────
    // Extract gradient (gx, gy) from each hash using the "ns" mapping:
    //   n_ = 1/7
    //   gx_c = fract(p_c * n_) * 2 - 1        ∈ [-1, 1)
    //   gy_c = fract(floor(p_c * n_) * n_) * 2 - 1
    //   gz_c = 1 - |gx_c| - |gy_c|             (octahedral)
    //   if gz_c < 0: gx_c -= sign(gx_c)*0.5, gy_c -= sign(gy_c)*0.5
    //   (clamp negative gz back to the surface of the octahedron)
    //
    // For TSL we use the simpler Gustavson normalisation:
    //   n_ = 1/7
    //   gx = n_ * floor(p * n_)    → coarse x component from upper bits
    //   ns_x = gx - 1/7            → shift to [-1, ~0.7]
    //   ns_z = 1/7 - |ns_x|        → z budget

    const n_ = float(0.142857142857142); // 1/7

    // Per-corner gx values (vec4 — one per corner)
    const ns_x = n_.mul(floor(p.mul(n_))).sub(n_);

    // Per-corner gz budget (vec4)
    const ns_z = n_.sub(abs(ns_x));

    // Per-corner gy values: derived from the fractional remainder of p * n_.
    // We reuse the same p vec4 but take the lower bits (fract(p * n_)):
    //   gy = fract(p * n_) - 0.5   → shifts to [-0.5, 0.5)
    const ns_y = fract(p.mul(n_)).sub(float(0.5));

    // Build the four un-normalised gradient vectors
    const g0 = vec3(ns_x.x, ns_y.x, ns_z.x).toVar();
    const g1 = vec3(ns_x.y, ns_y.y, ns_z.y).toVar();
    const g2 = vec3(ns_x.z, ns_y.z, ns_z.z).toVar();
    const g3 = vec3(ns_x.w, ns_y.w, ns_z.w).toVar();

    // Normalise gradients using the Taylor inverse-sqrt approximation
    const norm = taylorInvSqrt({
      r: vec4(vec2(dot(g0, g0), dot(g1, g1)), vec2(dot(g2, g2), dot(g3, g3))),
    });
    g0.assign(g0.mul(norm.x));
    g1.assign(g1.mul(norm.y));
    g2.assign(g2.mul(norm.z));
    g3.assign(g3.mul(norm.w));

    // ── Step 6: Compute corner contributions ─────────────────────────────────
    // Falloff: m = max(0, 0.5 - |x|²)⁴  (C² continuity)
    const m = max(
      vec4(
        vec2(float(0.5).sub(dot(x0, x0)), float(0.5).sub(dot(x1, x1))),
        vec2(float(0.5).sub(dot(x2, x2)), float(0.5).sub(dot(x3, x3)))
      ),
      float(0.0)
    ).toVar();

    const m2 = m.mul(m).toVar();
    const m4 = m2.mul(m2).toVar();

    // Dot the gradients with the un-skewed displacement vectors
    const gdot = vec4(
      vec2(dot(g0, x0), dot(g1, x1)),
      vec2(dot(g2, x2), dot(g3, x3))
    );

    // Accumulate: sum(m4 * gdot), then scale to [-1, 1]
    // The scale factor 42.0 is the classical Gustavson normalisation constant
    // for 3D simplex noise with this gradient set.
    return float(42.0).mul(dot(m4, gdot));
  }
);

/**
 * Evaluates noise at three different input configurations matching
 * the CPU noise modifier pattern from `three-particles-modifiers.ts`:
 *
 * ```
 *   noiseX = snoise3D(pos, 0, 0)       // pos = (t, 0, 0)
 *   noiseY = snoise3D(pos, pos, 0)     // pos = (t, t, 0)
 *   noiseZ = snoise3D(pos, pos, pos)   // pos = (t, t, t)
 * ```
 *
 * where `t` is the scalar noise position (e.g. `lifePercent * strength * 10`).
 *
 * This matches the three calls in the CPU path:
 * ```typescript
 * noiseInput.set(noisePosition, 0,             0            );  // → posX
 * noiseInput.set(noisePosition, noisePosition, 0            );  // → posY
 * noiseInput.set(noisePosition, noisePosition, noisePosition);  // → posZ
 * ```
 *
 * @param t - Scalar noise position (float). Typically `lifePercent * strength * 10`.
 * @returns vec3(noiseX, noiseY, noiseZ) — each component in approximately [-1, 1].
 */
export const particleNoise3: ReturnType<typeof Fn> = Fn(
  ({ t }: Record<string, ShaderNodeObject<Node>>) => {
    const noiseX = snoise3D({ v: vec3(t, float(0.0), float(0.0)) });
    const noiseY = snoise3D({ v: vec3(t, t, float(0.0)) });
    const noiseZ = snoise3D({ v: vec3(t, t, t) });
    return vec3(noiseX, noiseY, noiseZ);
  }
);

// Re-export TSL types for callers that need them
export type { ShaderNodeObject, Node };
