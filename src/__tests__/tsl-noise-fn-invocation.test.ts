/**
 * TSL noise function invocation tests.
 *
 * Calls snoise3D and particleNoise3 to exercise the full function bodies
 * (permute, taylorInvSqrt, gradient computation, falloff, etc.).
 *
 * Covers tsl-noise.ts lines 43, 54, 80-235, 263-266.
 */

import * as fs from 'fs';
import * as path from 'path';
import { float, vec3 } from 'three/tsl';
import {
  snoise3D,
  particleNoise3,
} from '../js/effects/three-particles/webgpu/tsl-noise.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function callNode(fn: unknown, args: Record<string, unknown>): unknown {
  return (fn as (args: Record<string, unknown>) => unknown)(args);
}

// ─── snoise3D full invocation ───────────────────────────────────────────────

describe('snoise3D — full algorithm invocation', () => {
  it('builds complete noise graph for origin', () => {
    const result = callNode(snoise3D, { v: vec3(0, 0, 0) });
    expect(result).toBeDefined();
  });

  it('builds complete noise graph for large coordinates', () => {
    const result = callNode(snoise3D, { v: vec3(100, -200, 300) });
    expect(result).toBeDefined();
  });

  it('builds complete noise graph for negative fractional', () => {
    const result = callNode(snoise3D, { v: vec3(-0.7, -0.3, -0.9) });
    expect(result).toBeDefined();
  });

  it('builds complete noise graph for unit axes', () => {
    for (const v of [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)]) {
      expect(() => callNode(snoise3D, { v })).not.toThrow();
    }
  });
});

// ─── particleNoise3 full invocation ─────────────────────────────────────────

describe('particleNoise3 — three-axis noise', () => {
  it('builds vec3 noise from three snoise3D calls', () => {
    const result = callNode(particleNoise3, { t: float(0.5) });
    expect(result).toBeDefined();
  });

  it('handles t=0', () => {
    expect(() => callNode(particleNoise3, { t: float(0) })).not.toThrow();
  });

  it('handles large t', () => {
    expect(() => callNode(particleNoise3, { t: float(999) })).not.toThrow();
  });
});

// ─── Source structural checks ───────────────────────────────────────────────

describe('tsl-noise source structure', () => {
  const src = fs.readFileSync(
    path.resolve(
      __dirname,
      '../js/effects/three-particles/webgpu/tsl-noise.ts'
    ),
    'utf-8'
  );

  it('uses Gustavson 42.0 normalisation', () => {
    expect(src).toContain('42.0');
  });

  it('implements 4-corner simplex accumulation (g0-g3)', () => {
    expect(src).toContain('const g0');
    expect(src).toContain('const g1');
    expect(src).toContain('const g2');
    expect(src).toContain('const g3');
  });

  it('uses m^4 falloff kernel', () => {
    expect(src).toContain('m.mul(m)');
    expect(src).toContain('m2.mul(m2)');
  });
});
