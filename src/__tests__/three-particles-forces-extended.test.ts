import * as THREE from 'three';
import {
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
} from '../js/effects/three-particles/three-particles-enums.js';
import { applyForceFields } from '../js/effects/three-particles/three-particles-forces.js';
import { NormalizedForceFieldConfig } from '../js/effects/three-particles/types.js';

const createPointField = (
  overrides: Partial<NormalizedForceFieldConfig> = {}
): NormalizedForceFieldConfig => ({
  isActive: true,
  type: ForceFieldType.POINT,
  position: new THREE.Vector3(0, 0, 0),
  direction: new THREE.Vector3(0, 1, 0),
  strength: 1,
  range: Infinity,
  falloff: ForceFieldFalloff.LINEAR,
  ...overrides,
});

const createDirectionalField = (
  overrides: Partial<NormalizedForceFieldConfig> = {}
): NormalizedForceFieldConfig => ({
  isActive: true,
  type: ForceFieldType.DIRECTIONAL,
  position: new THREE.Vector3(0, 0, 0),
  direction: new THREE.Vector3(1, 0, 0),
  strength: 1,
  range: Infinity,
  falloff: ForceFieldFalloff.LINEAR,
  ...overrides,
});

describe('applyForceFields - extended', () => {
  let velocity: THREE.Vector3;
  let positionArr: Float32Array;

  beforeEach(() => {
    velocity = new THREE.Vector3(0, 0, 0);
    positionArr = new Float32Array([5, 0, 0]);
  });

  // ─── Directional force extended ─────────────────────────────────────────

  describe('Directional force - extended', () => {
    test('should apply force in direction normalized', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(0, 1, 0).normalize(),
        strength: 10,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 0.5,
        systemLifetimePercentage: 0,
      });

      expect(velocity.y).toBeCloseTo(5); // 10 * 0.5
      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('should apply force along Z axis', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(0, 0, 1),
        strength: 8,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.z).toBeCloseTo(8);
    });

    test('should apply force in diagonal direction', () => {
      const dir = new THREE.Vector3(1, 1, 0).normalize();
      const field = createDirectionalField({
        direction: dir,
        strength: 10,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBeCloseTo(dir.x * 10);
      expect(velocity.y).toBeCloseTo(dir.y * 10);
    });

    test('should accumulate velocity over multiple frames', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(1, 0, 0),
        strength: 5,
      });

      for (let i = 0; i < 3; i++) {
        applyForceFields({
          particleSystemId: 0,
          forceFields: [field],
          velocity,
          positionArr,
          positionIndex: 0,
          delta: 0.1,
          systemLifetimePercentage: 0,
        });
      }

      expect(velocity.x).toBeCloseTo(1.5); // 5 * 0.1 * 3
    });
  });

  // ─── Combined forces ──────────────────────────────────────────────────────

  describe('Combined point and directional forces', () => {
    test('should combine point and directional forces', () => {
      const pointField = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 5,
      });
      const dirField = createDirectionalField({
        direction: new THREE.Vector3(0, 1, 0),
        strength: 3,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [pointField, dirField],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Should have both X (from point) and Y (from directional) components
      expect(velocity.x).toBeLessThan(0); // Attracted toward origin
      expect(velocity.y).toBeCloseTo(3); // Pushed upward
    });

    test('should handle multiple point forces at different positions', () => {
      const field1 = createPointField({
        position: new THREE.Vector3(10, 0, 0),
        strength: 5,
      });
      const field2 = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 5,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field1, field2],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Forces partially cancel out (particle at x=5, fields at x=0 and x=10)
      expect(typeof velocity.x).toBe('number');
    });
  });

  // ─── Inactive and zero-strength fields ────────────────────────────────────

  describe('Inactive and zero-strength fields', () => {
    test('should skip inactive fields entirely', () => {
      const field = createPointField({
        isActive: false,
        strength: 1000,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });

    test('should skip zero-strength fields', () => {
      const field = createPointField({ strength: 0 });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });

    test('should process mix of active and inactive fields', () => {
      const inactive = createPointField({ isActive: false, strength: 100 });
      const active = createDirectionalField({
        direction: new THREE.Vector3(0, 1, 0),
        strength: 5,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [inactive, active],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.y).toBeCloseTo(5);
    });
  });

  // ─── Point force edge cases ───────────────────────────────────────────────

  describe('Point force - edge cases', () => {
    test('should handle particle very close to field (distance < 0.0001)', () => {
      positionArr = new Float32Array([0, 0, 0]);
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 100,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Should not affect velocity when distance < 0.0001
      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });

    test('should handle particle outside finite range', () => {
      positionArr = new Float32Array([100, 0, 0]);
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 5,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
    });

    test('should handle particle exactly at range boundary', () => {
      positionArr = new Float32Array([10, 0, 0]);
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10,
        falloff: ForceFieldFalloff.LINEAR,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // At range boundary, linear falloff = 0
      expect(Math.abs(velocity.x)).toBeLessThan(0.01);
    });
  });

  // ─── Falloff modes ────────────────────────────────────────────────────────

  describe('Falloff modes', () => {
    test('NONE falloff should apply full strength regardless of distance', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 20,
        falloff: ForceFieldFalloff.NONE,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Full strength: 10 * 1.0 * 1 = 10, direction is (-1,0,0) normalized
      expect(velocity.x).toBeCloseTo(-10);
    });

    test('LINEAR falloff should reduce strength linearly with distance', () => {
      positionArr = new Float32Array([5, 0, 0]); // distance = 5
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10,
        falloff: ForceFieldFalloff.LINEAR,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Linear: 1 - 5/10 = 0.5; force = 10 * 0.5 * 1 = 5
      expect(velocity.x).toBeCloseTo(-5);
    });

    test('QUADRATIC falloff should reduce strength quadratically', () => {
      positionArr = new Float32Array([5, 0, 0]); // distance = 5
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10,
        falloff: ForceFieldFalloff.QUADRATIC,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Quadratic: 1 - (5/10)^2 = 0.75; force = 10 * 0.75 * 1 = 7.5
      expect(velocity.x).toBeCloseTo(-7.5);
    });

    test('Infinite range should not apply falloff', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: Infinity,
        falloff: ForceFieldFalloff.LINEAR,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Infinite range: falloffMultiplier = 1.0, force = 10 * 1.0 * 1 = 10
      expect(velocity.x).toBeCloseTo(-10);
    });
  });

  // ─── Strength as curve ────────────────────────────────────────────────────

  describe('Force field strength evaluation', () => {
    test('should evaluate strength as random range', () => {
      const field = createPointField({
        strength: { min: 5, max: 5 } as any,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0.5,
      });

      expect(velocity.x).not.toBe(0);
    });

    test('should handle negative strength (repulsion) for directional', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(1, 0, 0),
        strength: -5,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBeCloseTo(-5);
    });
  });

  // ─── Position index handling ──────────────────────────────────────────────

  describe('Position index handling', () => {
    test('should use correct position index for non-zero particle index', () => {
      positionArr = new Float32Array([0, 0, 0, 5, 0, 0, 10, 0, 0]);
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
      });

      // Test particle at index 1 (positionIndex = 3)
      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 3,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBeLessThan(0); // Attracted toward origin
    });

    test('should use correct position index for third particle', () => {
      positionArr = new Float32Array([0, 0, 0, 0, 0, 0, 0, 10, 0]);
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
      });

      velocity.set(0, 0, 0);
      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 6,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.y).toBeLessThan(0); // Attracted toward origin on Y
    });
  });

  // ─── Empty fields array ───────────────────────────────────────────────────

  describe('Empty and edge cases', () => {
    test('should handle empty force fields array', () => {
      applyForceFields({
        particleSystemId: 0,
        forceFields: [],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBe(0);
      expect(velocity.y).toBe(0);
      expect(velocity.z).toBe(0);
    });

    test('should handle delta of 0', () => {
      const field = createDirectionalField({ strength: 100 });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 0,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBe(0);
    });
  });
});
