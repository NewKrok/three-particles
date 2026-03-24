import * as THREE from 'three';
import {
  ForceFieldFalloff,
  ForceFieldType,
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

describe('applyForceFields', () => {
  let velocity: THREE.Vector3;
  let positionArr: Float32Array;

  beforeEach(() => {
    velocity = new THREE.Vector3(0, 0, 0);
    positionArr = new Float32Array([5, 0, 0]); // particle at (5, 0, 0)
  });

  describe('POINT force field', () => {
    test('attracts particle toward field position with positive strength', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
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

      // Particle at (5,0,0), field at origin → direction is (-1,0,0)
      expect(velocity.x).toBeLessThan(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('repels particle away from field position with negative strength', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: -10,
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

      // Negative strength → push away from origin → positive X
      expect(velocity.x).toBeGreaterThan(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('does not affect particle beyond range', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 3, // particle is at distance 5, beyond range
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

      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('affects particle within range', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10, // particle at distance 5, within range
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

      expect(velocity.x).toBeLessThan(0);
    });

    test('applies LINEAR falloff correctly', () => {
      // Particle at distance 5, range 10 → normalizedDistance = 0.5 → falloff = 0.5
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

      // force = strength * (1 - 5/10) * delta = 10 * 0.5 * 1 = 5
      // direction = (-1, 0, 0) → velocity.x = -5
      expect(velocity.x).toBeCloseTo(-5);
    });

    test('applies QUADRATIC falloff correctly', () => {
      // Particle at distance 5, range 10 → normalizedDistance = 0.5 → falloff = 1 - 0.25 = 0.75
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

      // force = strength * (1 - (5/10)^2) * delta = 10 * 0.75 * 1 = 7.5
      expect(velocity.x).toBeCloseTo(-7.5);
    });

    test('applies NONE falloff — constant force within range', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10,
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

      // force = strength * 1.0 * delta = 10
      expect(velocity.x).toBeCloseTo(-10);
    });

    test('no falloff when range is Infinity', () => {
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

      // No falloff applied when range is Infinity → full strength
      expect(velocity.x).toBeCloseTo(-10);
    });

    test('handles very close distance without division by zero', () => {
      // Particle extremely close to field position
      positionArr[0] = 0.00001;
      positionArr[1] = 0;
      positionArr[2] = 0;

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

      // Should not produce NaN or Infinity
      expect(isFinite(velocity.x)).toBe(true);
      expect(isFinite(velocity.y)).toBe(true);
      expect(isFinite(velocity.z)).toBe(true);
    });

    test('skips particle at exact field position (distance < 0.0001)', () => {
      positionArr[0] = 0;
      positionArr[1] = 0;
      positionArr[2] = 0;

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

      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('scales force with delta time', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10,
        falloff: ForceFieldFalloff.NONE,
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

      // force = 10 * 1.0 * 0.5 = 5
      expect(velocity.x).toBeCloseTo(-5);
    });

    test('works with 3D positions', () => {
      positionArr[0] = 3;
      positionArr[1] = 4;
      positionArr[2] = 0;

      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 5,
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

      // Distance = 5, direction = (-3/5, -4/5, 0) = (-0.6, -0.8, 0)
      // velocity = direction * strength * delta = (-3, -4, 0)
      expect(velocity.x).toBeCloseTo(-3);
      expect(velocity.y).toBeCloseTo(-4);
      expect(velocity.z).toBeCloseTo(0);
    });
  });

  describe('DIRECTIONAL force field', () => {
    test('applies force in specified direction', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(0, 1, 0),
        strength: 5,
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

      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.y).toBeCloseTo(5);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('applies force with negative strength (reverse direction)', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(1, 0, 0),
        strength: -3,
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

      expect(velocity.x).toBeCloseTo(-3);
    });

    test('scales with delta time', () => {
      const field = createDirectionalField({
        direction: new THREE.Vector3(1, 0, 0),
        strength: 10,
      });

      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 0.016,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBeCloseTo(0.16);
    });
  });

  describe('general behavior', () => {
    test('skips inactive force fields', () => {
      const field = createPointField({
        isActive: false,
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

      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('skips force fields with zero strength', () => {
      const field = createPointField({
        strength: 0,
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

      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('applies multiple force fields cumulatively', () => {
      const field1 = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 10,
        range: 10,
        falloff: ForceFieldFalloff.NONE,
      });
      const field2 = createDirectionalField({
        direction: new THREE.Vector3(0, 1, 0),
        strength: 3,
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

      // field1: point at origin, particle at (5,0,0) → velocity.x = -10
      // field2: directional (0,1,0) * 3 → velocity.y = 3
      expect(velocity.x).toBeCloseTo(-10);
      expect(velocity.y).toBeCloseTo(3);
    });

    test('handles empty force fields array', () => {
      applyForceFields({
        particleSystemId: 0,
        forceFields: [],
        velocity,
        positionArr,
        positionIndex: 0,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      expect(velocity.x).toBeCloseTo(0);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });

    test('supports RandomBetweenTwoConstants for strength', () => {
      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: { min: 5, max: 5 }, // min === max → deterministic
        range: 10,
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

      expect(velocity.x).toBeCloseTo(-5);
    });

    test('handles positionIndex offset correctly', () => {
      // Three particles: positions at indices 0-2, 3-5, 6-8
      const multiPositionArr = new Float32Array([
        0,
        0,
        0, // particle 0
        10,
        0,
        0, // particle 1
        0,
        5,
        0, // particle 2
      ]);

      const field = createPointField({
        position: new THREE.Vector3(0, 0, 0),
        strength: 1,
      });

      // Apply to particle 1 (positionIndex = 3)
      applyForceFields({
        particleSystemId: 0,
        forceFields: [field],
        velocity,
        positionArr: multiPositionArr,
        positionIndex: 3,
        delta: 1,
        systemLifetimePercentage: 0,
      });

      // Particle 1 at (10,0,0), field at origin → direction (-1,0,0)
      expect(velocity.x).toBeCloseTo(-1);
      expect(velocity.y).toBeCloseTo(0);
      expect(velocity.z).toBeCloseTo(0);
    });
  });
});
