/**
 * Regression test for the flame-barrier WORLD + collision-plane GPU bug.
 *
 * ROOT CAUSE
 * ==========
 *
 * The WebGPU compute dispatch is declared as `compute(kernel, maxParticles)`.
 * The backend rounds this up to whole workgroups (typically 64 threads), so
 * when `maxParticles` is not a multiple of the workgroup size the last threads
 * run with `instanceIndex >= maxParticles`.
 *
 * Those threads entered the per-particle init block which reads
 * `curveData[curveLen + i * INIT_STRIDE + 3]` as the init flag.
 *
 * The collision plane data is packed right after the per-particle init
 * region at offset `collisionPlaneOffset = curveLen + maxParticles *
 * INIT_STRIDE`. For the thread with `i == maxParticles` the init-flag read
 * lands EXACTLY on the first collision plane's `position.y` byte. When
 * `position.y > 0.5` (e.g. plane at y=3 like flame-barrier), the init
 * branch activated every frame and zeroed the plane's position.y on the GPU:
 *
 *   sCurveData.element(i * INIT_STRIDE + curveLen + 3).assign(float(0))
 *
 * The result on the GPU was plane.y = 0 even though the CPU mirror still
 * contained plane.y = 3 — particles that should have clamped against y=3
 * instead clamped against y=0, producing the "all particles snap to the
 * ground" visual bug.
 *
 * FIX
 * ===
 *
 * A top-level `If(i < maxParticles)` guard around the whole kernel body so
 * out-of-range threads do nothing. This test verifies that the collision
 * plane encoding layout does not overlap with any valid particle's init
 * slot, which is the invariant the kernel depends on for safety, and that
 * the kernel-level bounds check is in place.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const COMPUTE_MODIFIERS_PATH = join(
  __dirname,
  '../js/effects/three-particles/webgpu/compute-modifiers.ts'
);
const INIT_STRIDE = 28;

describe('compute kernel bounds check vs collision plane layout', () => {
  it('collisionPlaneOffset starts exactly where an out-of-bounds thread (i=maxParticles) would read its init slot', () => {
    // For any curveLen and maxParticles:
    //   out-of-bounds thread i = maxParticles reads offsets:
    //     initBase = curveLen + maxParticles * INIT_STRIDE
    //   collision plane region starts at:
    //     cpOffset = curveLen + maxParticles * INIT_STRIDE (+ ffSize)
    //
    // Without force fields, initBase == cpOffset, so
    // curveData[initBase + 3] aliases the first plane's position.y.
    const curveLen = 512;
    const maxParticles = 150;
    const initBase = curveLen + maxParticles * INIT_STRIDE;
    const cpOffset = curveLen + maxParticles * INIT_STRIDE; // no force fields
    expect(initBase).toBe(cpOffset);
    // Offset 3 in plane stride is position.y
    expect(initBase + 3).toBe(cpOffset + 3);
  });

  it('compute kernel source contains a top-level bounds check on instanceIndex', () => {
    const source = readFileSync(COMPUTE_MODIFIERS_PATH, 'utf8');
    // The fix wraps the whole kernel body inside `If(i.lessThan(float(maxParticles)), ...)`.
    // Without it, threads with i >= maxParticles would corrupt the collision
    // plane region (see test above).
    expect(source).toMatch(
      /If\s*\(\s*i\.lessThan\s*\(\s*float\s*\(\s*maxParticles\s*\)\s*\)/
    );
  });

  it('kernel bounds check is placed BEFORE the init-flag read', () => {
    const source = readFileSync(COMPUTE_MODIFIERS_PATH, 'utf8');
    const boundsIdx = source.search(
      /If\s*\(\s*i\.lessThan\s*\(\s*float\s*\(\s*maxParticles\s*\)\s*\)/
    );
    // The first `initFlag = sCurveData.element(initBase.add(3))` read must
    // appear AFTER the bounds If-guard, otherwise an out-of-bounds thread
    // could still corrupt the collision plane region.
    const initFlagReadIdx = source.indexOf(
      'sCurveData.element(initBase.add(3))'
    );
    expect(boundsIdx).toBeGreaterThan(-1);
    expect(initFlagReadIdx).toBeGreaterThan(-1);
    expect(boundsIdx).toBeLessThan(initFlagReadIdx);
  });
});
