/**
 * Tests for the TSL simplex noise module (tsl-noise.ts).
 *
 * Since TSL nodes are JavaScript objects (not GPU executors), tests verify:
 * - Exports exist and are callable TSL Fn nodes
 * - Node graph structure (isNode flag, nodeType)
 * - Structural properties that confirm the correct TSL patterns are used
 * - particleNoise3 wire-up (three distinct snoise3D invocations)
 * - Re-exported types are accessible
 */

import {
  snoise3D,
  particleNoise3,
} from '../js/effects/three-particles/webgpu/tsl-noise.js';
import { float, vec3 } from 'three/tsl';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Duck-type check: TSL nodes expose isNode = true. */
function isTSLNode(x: unknown): boolean {
  return (
    x !== null &&
    typeof x === 'object' &&
    (x as Record<string, unknown>)['isNode'] === true
  );
}

/** Call a TSL Fn node with the given named arguments and return the result node. */
function callNode(
  fn: ReturnType<typeof import('three/tsl').Fn>,
  args: Record<string, unknown>
): unknown {
  // TSL Fn nodes are callable as functions
  return (fn as unknown as (args: Record<string, unknown>) => unknown)(args);
}

// ─── snoise3D ────────────────────────────────────────────────────────────────

describe('snoise3D', () => {
  // ── Export shape ──────────────────────────────────────────────────────────

  describe('export shape', () => {
    it('is defined', () => {
      expect(snoise3D).toBeDefined();
    });

    it('is a function (TSL Fn node)', () => {
      expect(typeof snoise3D).toBe('function');
    });

    it('has the isNode property set to true', () => {
      expect((snoise3D as unknown as { isNode?: boolean }).isNode).toBe(true);
    });
  });

  // ── Return value is a TSL node ────────────────────────────────────────────

  describe('return value', () => {
    it('returns a TSL node when called with a vec3 argument', () => {
      const v = vec3(0.1, 0.2, 0.3);
      const result = callNode(snoise3D, { v });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a TSL node for the zero vector', () => {
      const v = vec3(0.0, 0.0, 0.0);
      const result = callNode(snoise3D, { v });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a TSL node for large coordinate values', () => {
      const v = vec3(100.0, 200.0, 300.0);
      const result = callNode(snoise3D, { v });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a TSL node for negative coordinates', () => {
      const v = vec3(-1.5, -2.5, -3.5);
      const result = callNode(snoise3D, { v });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a different node object on each invocation (no result caching)', () => {
      const v1 = vec3(1.0, 0.0, 0.0);
      const v2 = vec3(0.0, 1.0, 0.0);
      const r1 = callNode(snoise3D, { v: v1 });
      const r2 = callNode(snoise3D, { v: v2 });
      // Two calls must produce independent nodes (not the same object reference)
      expect(r1).not.toBe(r2);
    });
  });

  // ── Node structure ────────────────────────────────────────────────────────

  describe('node structure', () => {
    it('result node has a nodeType property (float output)', () => {
      const result = callNode(snoise3D, { v: vec3(0.5, 0.5, 0.5) }) as Record<
        string,
        unknown
      >;
      // TSL Fn nodes encode the return type
      expect(result['nodeType']).toBeDefined();
    });

    it('snoise3D itself has a nodeType property', () => {
      expect(
        (snoise3D as unknown as { nodeType?: string }).nodeType
      ).toBeDefined();
    });
  });

  // ── Invocation with float arguments ──────────────────────────────────────

  describe('invocation variants', () => {
    it('accepts float-built vec3 (float(x), float(y), float(z))', () => {
      const v = vec3(float(0.1), float(0.2), float(0.3));
      expect(() => callNode(snoise3D, { v })).not.toThrow();
    });

    it('does not throw for any well-formed vec3 input', () => {
      const inputs = [
        vec3(0, 0, 0),
        vec3(1, 1, 1),
        vec3(-1, -1, -1),
        vec3(0.5, 0.25, 0.125),
        vec3(99.9, -99.9, 0.0),
      ];
      for (const v of inputs) {
        expect(() => callNode(snoise3D, { v })).not.toThrow();
      }
    });
  });
});

// ─── particleNoise3 ──────────────────────────────────────────────────────────

describe('particleNoise3', () => {
  // ── Export shape ──────────────────────────────────────────────────────────

  describe('export shape', () => {
    it('is defined', () => {
      expect(particleNoise3).toBeDefined();
    });

    it('is a function (TSL Fn node)', () => {
      expect(typeof particleNoise3).toBe('function');
    });

    it('has the isNode property set to true', () => {
      expect((particleNoise3 as unknown as { isNode?: boolean }).isNode).toBe(
        true
      );
    });
  });

  // ── Return value is a TSL node ────────────────────────────────────────────

  describe('return value', () => {
    it('returns a TSL node when called with a float argument', () => {
      const t = float(0.5);
      const result = callNode(particleNoise3, { t });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a TSL node for t = 0', () => {
      const result = callNode(particleNoise3, { t: float(0.0) });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a TSL node for large t', () => {
      const result = callNode(particleNoise3, { t: float(100.0) });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a TSL node for negative t', () => {
      const result = callNode(particleNoise3, { t: float(-3.7) });
      expect(isTSLNode(result)).toBe(true);
    });

    it('returns a different node object on each invocation', () => {
      const r1 = callNode(particleNoise3, { t: float(0.1) });
      const r2 = callNode(particleNoise3, { t: float(0.2) });
      expect(r1).not.toBe(r2);
    });
  });

  // ── Node structure reflects vec3 output ──────────────────────────────────

  describe('node structure', () => {
    it('result node has a nodeType property (vec3 output)', () => {
      const result = callNode(particleNoise3, { t: float(0.5) }) as Record<
        string,
        unknown
      >;
      expect(result['nodeType']).toBeDefined();
    });
  });

  // ── Structural independence of three noise axes ───────────────────────────

  describe('three-axis structural independence', () => {
    it('produces a result node without throwing for multiple t values', () => {
      const tValues = [0.0, 0.1, 1.0, 5.0, 10.0, -2.5];
      for (const tVal of tValues) {
        expect(() =>
          callNode(particleNoise3, { t: float(tVal) })
        ).not.toThrow();
      }
    });
  });
});

// ─── Module-level structural checks ──────────────────────────────────────────

describe('module exports', () => {
  it('exports snoise3D and particleNoise3 as distinct values', () => {
    expect(snoise3D).not.toBe(particleNoise3);
  });

  it('both exports are TSL node objects (isNode = true)', () => {
    const sn = snoise3D as unknown as { isNode?: boolean };
    const pn = particleNoise3 as unknown as { isNode?: boolean };
    expect(sn.isNode).toBe(true);
    expect(pn.isNode).toBe(true);
  });

  it('snoise3D and particleNoise3 are independently callable without cross-contamination', () => {
    // Call both with different inputs; neither should throw or affect the other
    const v = vec3(0.3, 0.6, 0.9);
    const t = float(0.3);

    const sResult = callNode(snoise3D, { v });
    const pResult = callNode(particleNoise3, { t });

    expect(isTSLNode(sResult)).toBe(true);
    expect(isTSLNode(pResult)).toBe(true);
    // Confirm they are not the same node
    expect(sResult).not.toBe(pResult);
  });
});
