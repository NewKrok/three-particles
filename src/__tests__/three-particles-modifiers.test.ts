import * as THREE from 'three';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { applyModifiers } from '../js/effects/three-particles/three-particles-modifiers.js';
import {
  GeneralData,
  Noise,
  NormalizedParticleSystemConfig,
} from '../js/effects/three-particles/types.js';

describe('applyModifiers', () => {
  let attributes: THREE.NormalBufferAttributes;
  let normalizedConfig: NormalizedParticleSystemConfig;

  beforeEach(() => {
    attributes = {
      position: { array: new Float32Array(3), needsUpdate: false },
      rotation: { array: new Float32Array(1), needsUpdate: false },
      size: { array: new Float32Array(1), needsUpdate: false },
      colorA: { array: new Float32Array(1), needsUpdate: false },
    } as unknown as THREE.NormalBufferAttributes;

    normalizedConfig = {
      opacityOverLifetime: {
        isActive: false,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: () => 1.5,
          scale: 1,
        },
      },
      sizeOverLifetime: {
        isActive: false,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: () => 2,
          scale: 1,
        },
      },
    } as unknown as NormalizedParticleSystemConfig;
  });

  test('updates position based on linear velocity', () => {
    const linearVelocityData = [
      {
        speed: new THREE.Vector3(1, 1, 1),
        valueModifiers: { x: undefined, y: undefined, z: undefined },
      },
    ];

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {},
        lifetimeValues: {},
        linearVelocityData,
      } as GeneralData,
      normalizedConfig,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array).toEqual(new Float32Array([1, 1, 1]));
    expect(attributes.position.needsUpdate).toBe(true);
  });

  test('should apply linear velocity with value modifiers', () => {
    const attributes = {
      position: { array: new Float32Array([0, 0, 0]), needsUpdate: false },
    };

    const linearVelocityData = [
      {
        speed: new THREE.Vector3(1, 1, 1),
        valueModifiers: {
          x: (t: number) => t * 2,
          y: (t: number) => t * 3,
          z: (t: number) => t * 4,
        },
      },
    ];

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {},
        lifetimeValues: {},
        linearVelocityData,
        orbitalVelocityData: undefined,
      } as GeneralData,
      normalizedConfig,
      attributes: attributes as any,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(Array.from(attributes.position.array)).toEqual([1, 1.5, 2]);
    expect(attributes.position.needsUpdate).toBe(true);
  });

  test('should update position with orbital velocity data', () => {
    const orbitalVelocityData = [
      {
        speed: new THREE.Vector3(0.5, 0.5, 0.5),
        positionOffset: new THREE.Vector3(0, 0, 0),
        valueModifiers: {},
      },
    ];

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {},
        lifetimeValues: {},
        linearVelocityData: undefined,
        orbitalVelocityData,
      } as GeneralData,
      normalizedConfig,
      attributes: attributes as any,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    const offset = new THREE.Vector3(0, 0, 0);
    const euler = new THREE.Euler(0.5, 0.5, 0.5);
    offset.applyEuler(euler);

    expect(Array.from(attributes.position.array)).toEqual([
      offset.x,
      offset.y,
      offset.z,
    ]);
    expect(attributes.position.needsUpdate).toBe(true);
  });

  test('should apply orbital velocity with position offset', () => {
    const _attributes = {
      ...attributes,
      position: { array: new Float32Array([1, 1, 1]), needsUpdate: false },
    };

    const orbitalVelocityData = [
      {
        speed: new THREE.Vector3(1, 1, 1),
        positionOffset: new THREE.Vector3(1, 1, 1),
        valueModifiers: {},
      },
    ];

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {},
        lifetimeValues: {},
        linearVelocityData: undefined,
        orbitalVelocityData,
      } as GeneralData,
      normalizedConfig,
      attributes: _attributes as any,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    const expectedPosition = new THREE.Vector3();
    const offset = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler(1, 1, 1);
    offset.applyEuler(euler);
    expectedPosition.add(offset);

    expect(_attributes.position.array[0]).toBeCloseTo(expectedPosition.x, 5);
    expect(_attributes.position.array[1]).toBeCloseTo(expectedPosition.y, 5);
    expect(_attributes.position.array[2]).toBeCloseTo(expectedPosition.z, 5);

    expect(_attributes.position.needsUpdate).toBe(true);
  });

  test('should apply orbital velocity using valueModifiers', () => {
    const attributes = {
      position: { array: new Float32Array([1, 1, 1]), needsUpdate: false },
    };

    const orbitalVelocityData = [
      {
        speed: new THREE.Vector3(1, 1, 1),
        positionOffset: new THREE.Vector3(1, 1, 1),
        valueModifiers: {
          x: (t: number) => t * 2,
          y: (t: number) => t * 3,
          z: (t: number) => t * 4,
        },
      },
    ];

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {},
        lifetimeValues: {},
        linearVelocityData: undefined,
        orbitalVelocityData,
      } as GeneralData,
      normalizedConfig,
      attributes: attributes as any,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    const offset = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler(1, 2, 1.5);
    offset.applyEuler(euler);

    expect(attributes.position.array[0]).toBeCloseTo(offset.x, 5);
    expect(attributes.position.array[1]).toBeCloseTo(offset.y, 5);
    expect(attributes.position.array[2]).toBeCloseTo(offset.z, 5);
    expect(attributes.position.needsUpdate).toBe(true);
  });

  test('applies curve modifiers when active', () => {
    normalizedConfig.opacityOverLifetime.isActive = true;
    normalizedConfig.sizeOverLifetime.isActive = true;

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: { startOpacity: [1], startSize: [1] },
        lifetimeValues: {},
        linearVelocityData: undefined,
      } as unknown as GeneralData,
      normalizedConfig,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.colorA.array[0]).toBe(1.5);
    expect(attributes.colorA.needsUpdate).toBe(true);

    expect(attributes.size.array[0]).toBe(2);
    expect(attributes.size.needsUpdate).toBe(true);
  });

  test('applies noise to attributes', () => {
    const noise = {
      isActive: true,
      strength: 1,
      positionAmount: 1,
      rotationAmount: 0.5,
      sizeAmount: 2,
      sampler: { get2: () => 0, get3: () => 0.5 },
    } as Noise;

    applyModifiers({
      delta: 1,
      generalData: {
        noise,
        startValues: {},
        lifetimeValues: {},
      } as GeneralData,
      normalizedConfig,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array).toEqual(
      new Float32Array([0.075, 0.075, 0.075])
    );
    expect(attributes.position.needsUpdate).toBe(true);

    expect(attributes.rotation.array).toEqual(new Float32Array([0.0375]));
    expect(attributes.rotation.needsUpdate).toBe(true);

    expect(attributes.size.array).toEqual(new Float32Array([0.15]));
    expect(attributes.size.needsUpdate).toBe(true);
  });

  test('applies noise to position with offset', () => {
    const noise = {
      isActive: true,
      strength: 1,
      positionAmount: 1,
      rotationAmount: 0,
      sizeAmount: 0,
      sampler: { get2: () => 0, get3: () => 0.5 },
      offsets: [1],
    } as Noise;

    applyModifiers({
      delta: 1,
      generalData: {
        noise,
        startValues: {},
        lifetimeValues: {},
      } as GeneralData,
      normalizedConfig,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array).toEqual(
      new Float32Array([0.075, 0.075, 0.075])
    );
    expect(attributes.position.needsUpdate).toBe(true);
  });

  test('should update rotation with rotationOverLifetime', () => {
    const _attributes = {
      ...attributes,
      rotation: { array: new Float32Array([0]), needsUpdate: false },
    };

    const lifetimeValues = {
      rotationOverLifetime: [5],
    };

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {},
        lifetimeValues,
        linearVelocityData: undefined,
        orbitalVelocityData: undefined,
      } as unknown as GeneralData,
      normalizedConfig,
      attributes: _attributes as any,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(_attributes.rotation.array[0]).toBeCloseTo(5 * 1 * 0.02, 5);
    expect(_attributes.rotation.needsUpdate).toBe(true);
  });
});
