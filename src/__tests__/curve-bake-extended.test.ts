/**
 * Extended tests for curve-bake.ts — velocity axis baking and createCurveDataTexture.
 *
 * Covers previously uncovered lines:
 *   - bakeVelocityAxisIntoBuffer (lines 158-166)
 *   - Velocity axis conditional branches (lines 326-377)
 *   - createCurveDataTexture (lines 430-454)
 */

import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { getDefaultParticleSystemConfig } from '../js/effects/three-particles/three-particles.js';
import {
  bakeParticleSystemCurves,
  createCurveDataTexture,
  CURVE_RESOLUTION,
} from '../js/effects/three-particles/webgpu/curve-bake.js';
import type { NormalizedParticleSystemConfig } from '../js/effects/three-particles/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const linearBezier = {
  type: LifeTimeCurve.BEZIER,
  scale: 1,
  bezierPoints: [
    { x: 0, y: 0, percentage: 0 },
    { x: 1, y: 1, percentage: 1 },
  ],
};

function createConfig(
  overrides: Record<string, unknown> = {}
): NormalizedParticleSystemConfig {
  const base = getDefaultParticleSystemConfig();
  return { ...base, ...overrides } as NormalizedParticleSystemConfig;
}

// ─── Velocity axis baking (bakeVelocityAxisIntoBuffer) ───────────────────────

describe('bakeParticleSystemCurves — velocity axes', () => {
  it('bakes linear velocity X as a curve when it is a LifetimeCurve', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: linearBezier, y: 0, z: 0 },
        orbital: { x: 0, y: 0, z: 0 },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.linearVelX).toBe(0);
    expect(result.linearVelY).toBe(-1);
    expect(result.linearVelZ).toBe(-1);
    expect(result.curveCount).toBe(1);
    expect(result.data.length).toBe(CURVE_RESOLUTION);
    // Linear bezier: first sample ~0, last sample ~1
    expect(result.data[0]).toBeCloseTo(0, 1);
    expect(result.data[CURVE_RESOLUTION - 1]).toBeCloseTo(1, 1);
  });

  it('bakes constant velocity as a flat curve', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 3.5, y: 0, z: 0 },
        orbital: { x: 0, y: 0, z: 0 },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.linearVelX).toBe(0);
    expect(result.curveCount).toBe(1);
    // All samples should be the constant value (mid-point of calculateValue)
    for (let i = 0; i < CURVE_RESOLUTION; i++) {
      expect(result.data[i]).toBeCloseTo(3.5, 3);
    }
  });

  it('bakes random range velocity as a flat curve using mid-point', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: { min: 2, max: 2 }, y: 0, z: 0 },
        orbital: { x: 0, y: 0, z: 0 },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.linearVelX).toBe(0);
    expect(result.curveCount).toBe(1);
    // min==max==2, so mid-point is 2
    for (let i = 0; i < CURVE_RESOLUTION; i++) {
      expect(result.data[i]).toBeCloseTo(2, 3);
    }
  });

  it('bakes all 6 velocity axes when all are non-zero', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 1, y: 2, z: 3 },
        orbital: { x: 4, y: 5, z: 6 },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(6);
    expect(result.linearVelX).toBe(0);
    expect(result.linearVelY).toBe(1);
    expect(result.linearVelZ).toBe(2);
    expect(result.orbitalVelX).toBe(3);
    expect(result.orbitalVelY).toBe(4);
    expect(result.orbitalVelZ).toBe(5);
    expect(result.data.length).toBe(CURVE_RESOLUTION * 6);
  });

  it('skips velocity axes that are 0', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 0, y: 5, z: 0 },
        orbital: { x: 0, y: 0, z: 0 },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(1);
    expect(result.linearVelX).toBe(-1); // 0 is skipped
    expect(result.linearVelY).toBe(0);
    expect(result.linearVelZ).toBe(-1);
  });

  it('skips velocity axes that are undefined', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: undefined, y: undefined, z: 2 },
        orbital: { x: undefined, y: undefined, z: undefined },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(1);
    expect(result.linearVelX).toBe(-1);
    expect(result.linearVelY).toBe(-1);
    expect(result.linearVelZ).toBe(0);
  });

  it('does not bake velocity when velocityOverLifetime is inactive', () => {
    const config = createConfig({
      velocityOverLifetime: {
        isActive: false,
        linear: { x: 5, y: 5, z: 5 },
        orbital: { x: 5, y: 5, z: 5 },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(0);
    expect(result.linearVelX).toBe(-1);
    expect(result.orbitalVelX).toBe(-1);
  });

  it('combines velocity curves with other modifier curves', () => {
    const config = createConfig({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: linearBezier,
      },
      velocityOverLifetime: {
        isActive: true,
        linear: { x: linearBezier, y: 0, z: 0 },
        orbital: { x: 0, y: 0, z: linearBezier },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(3); // size + linearVelX + orbitalVelZ
    expect(result.sizeOverLifetime).toBe(0);
    expect(result.linearVelX).toBe(1);
    expect(result.orbitalVelZ).toBe(2);
    expect(result.data.length).toBe(CURVE_RESOLUTION * 3);
  });
});

// ─── createCurveDataTexture ─────────────────────────────────────────────────

describe('createCurveDataTexture', () => {
  it('returns null when curveCount is 0', () => {
    const map = bakeParticleSystemCurves(createConfig(), 0);
    expect(map.curveCount).toBe(0);
    const tex = createCurveDataTexture(map);
    expect(tex).toBeNull();
  });

  it('returns a DataTexture when curves are present', () => {
    const config = createConfig({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: linearBezier,
      },
    });
    const map = bakeParticleSystemCurves(config, 0);
    const tex = createCurveDataTexture(map);

    expect(tex).not.toBeNull();
    expect(tex!.image.width).toBe(CURVE_RESOLUTION);
    expect(tex!.image.height).toBe(1);
    // needsUpdate may be consumed by three.js internals; check version instead
    expect(tex!.version).toBeGreaterThan(0);
  });

  it('creates texture with correct width for multiple curves', () => {
    const config = createConfig({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: linearBezier,
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: linearBezier,
      },
    });
    const map = bakeParticleSystemCurves(config, 0);
    const tex = createCurveDataTexture(map);

    expect(tex).not.toBeNull();
    expect(tex!.image.width).toBe(CURVE_RESOLUTION * 2);
  });

  it('texture data matches the baked curve data', () => {
    const config = createConfig({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: linearBezier,
      },
    });
    const map = bakeParticleSystemCurves(config, 0);
    const tex = createCurveDataTexture(map);

    // The texture data should be the same Float32Array
    expect(tex!.image.data).toBe(map.data);
  });
});
