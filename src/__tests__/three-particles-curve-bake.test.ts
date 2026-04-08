import {
  LifeTimeCurve,
  SimulationSpace,
} from '../js/effects/three-particles/three-particles-enums.js';
import { getDefaultParticleSystemConfig } from '../js/effects/three-particles/three-particles.js';
import {
  bakeCurve,
  bakeParticleSystemCurves,
  CURVE_RESOLUTION,
} from '../js/effects/three-particles/webgpu/curve-bake.js';
import type { NormalizedParticleSystemConfig } from '../js/effects/three-particles/types.js';

// ─── bakeCurve ───────────────────────────────────────────────────────────────

describe('bakeCurve', () => {
  it('returns a Float32Array of the correct resolution', () => {
    const result = bakeCurve((t) => t);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(CURVE_RESOLUTION);
  });

  it('samples a linear curve correctly', () => {
    const result = bakeCurve((t) => t);
    expect(result[0]).toBeCloseTo(0, 3);
    expect(result[CURVE_RESOLUTION - 1]).toBeCloseTo(1, 3);
    // Midpoint should be ~0.5
    const mid = Math.floor(CURVE_RESOLUTION / 2);
    expect(result[mid]).toBeCloseTo(mid / (CURVE_RESOLUTION - 1), 3);
  });

  it('samples a constant curve', () => {
    const result = bakeCurve(() => 0.75);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeCloseTo(0.75, 5);
    }
  });

  it('samples a quadratic curve', () => {
    const result = bakeCurve((t) => t * t);
    expect(result[0]).toBeCloseTo(0, 3);
    expect(result[CURVE_RESOLUTION - 1]).toBeCloseTo(1, 3);
    // Quarter point: (0.25)^2 = 0.0625
    const quarter = Math.floor(CURVE_RESOLUTION / 4);
    const expected = (quarter / (CURVE_RESOLUTION - 1)) ** 2;
    expect(result[quarter]).toBeCloseTo(expected, 3);
  });

  it('accepts custom resolution', () => {
    const result = bakeCurve((t) => t, 64);
    expect(result.length).toBe(64);
  });
});

// ─── CURVE_RESOLUTION constant ───────────────────────────────────────────────

describe('CURVE_RESOLUTION', () => {
  it('is 256', () => {
    expect(CURVE_RESOLUTION).toBe(256);
  });
});

// ─── bakeParticleSystemCurves ────────────────────────────────────────────────

describe('bakeParticleSystemCurves', () => {
  const createConfig = (
    overrides: Record<string, unknown> = {}
  ): NormalizedParticleSystemConfig => {
    const base = getDefaultParticleSystemConfig();
    return { ...base, ...overrides } as NormalizedParticleSystemConfig;
  };

  it('returns all curve indices as -1 when no modifiers are active', () => {
    const config = createConfig();
    const result = bakeParticleSystemCurves(config, 0);

    expect(result.curveCount).toBe(0);
    expect(result.sizeOverLifetime).toBe(-1);
    expect(result.opacityOverLifetime).toBe(-1);
    expect(result.colorR).toBe(-1);
    expect(result.colorG).toBe(-1);
    expect(result.colorB).toBe(-1);
    expect(result.linearVelX).toBe(-1);
    expect(result.linearVelY).toBe(-1);
    expect(result.linearVelZ).toBe(-1);
    expect(result.orbitalVelX).toBe(-1);
    expect(result.orbitalVelY).toBe(-1);
    expect(result.orbitalVelZ).toBe(-1);
  });

  it('bakes sizeOverLifetime curve when active', () => {
    const config = createConfig({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(1);
    expect(result.sizeOverLifetime).toBe(0);
    expect(result.data.length).toBe(CURVE_RESOLUTION);
    // First sample should be ~0, last should be ~1 (linear bezier)
    expect(result.data[0]).toBeCloseTo(0, 1);
    expect(result.data[CURVE_RESOLUTION - 1]).toBeCloseTo(1, 1);
  });

  it('bakes multiple curves with sequential indices', () => {
    const linearBezier = {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    };

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

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(2);
    expect(result.sizeOverLifetime).toBe(0);
    expect(result.opacityOverLifetime).toBe(1);
    expect(result.data.length).toBe(CURVE_RESOLUTION * 2);
  });

  it('handles colorOverLifetime with 3 separate curves', () => {
    const linearBezier = {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    };

    const config = createConfig({
      colorOverLifetime: {
        isActive: true,
        r: linearBezier,
        g: linearBezier,
        b: linearBezier,
      },
    });

    const result = bakeParticleSystemCurves(config, 0);
    expect(result.curveCount).toBe(3);
    expect(result.colorR).toBe(0);
    expect(result.colorG).toBe(1);
    expect(result.colorB).toBe(2);
  });
});
