import * as THREE from 'three';
import {
  SCALAR_STRIDE,
  S_SIZE,
  S_ROTATION,
  S_COLOR_R,
  S_COLOR_G,
  S_COLOR_B,
  S_COLOR_A,
} from '../js/effects/three-particles/three-particles-constants.js';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { applyModifiers } from '../js/effects/three-particles/three-particles-modifiers.js';
import {
  GeneralData,
  Noise,
  NormalizedParticleSystemConfig,
} from '../js/effects/three-particles/types.js';

describe('applyModifiers', () => {
  let attributes: THREE.NormalBufferAttributes;
  let scalarArray: Float32Array;
  let normalizedConfig: NormalizedParticleSystemConfig;

  beforeEach(() => {
    attributes = {
      position: { array: new Float32Array(3), needsUpdate: false },
    } as unknown as THREE.NormalBufferAttributes;

    scalarArray = new Float32Array(SCALAR_STRIDE);

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
      colorOverLifetime: {
        isActive: false,
        r: {
          type: LifeTimeCurve.EASING,
          curveFunction: () => 0.5,
          scale: 1,
        },
        g: {
          type: LifeTimeCurve.EASING,
          curveFunction: () => 0.75,
          scale: 1,
        },
        b: {
          type: LifeTimeCurve.EASING,
          curveFunction: () => 0.25,
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
      scalarArray,
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
      scalarArray,
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
      scalarArray,
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
      scalarArray,
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
      scalarArray,
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
      scalarArray,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(scalarArray[S_COLOR_A]).toBe(1.5);
    expect(scalarArray[S_SIZE]).toBe(2);
  });

  test('applies noise to attributes', () => {
    const noise = {
      isActive: true,
      strength: 1,
      noisePower: 0.15,
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
      scalarArray,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array).toEqual(
      new Float32Array([0.075, 0.075, 0.075])
    );
    expect(attributes.position.needsUpdate).toBe(true);

    expect(scalarArray[S_ROTATION]).toBeCloseTo(0.0375);
    expect(scalarArray[S_SIZE]).toBeCloseTo(0.15);
  });

  test('applies noise to position with offset', () => {
    const noise = {
      isActive: true,
      strength: 1,
      noisePower: 0.15,
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
      scalarArray,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array).toEqual(
      new Float32Array([0.075, 0.075, 0.075])
    );
    expect(attributes.position.needsUpdate).toBe(true);
  });

  test('should update rotation with rotationOverLifetime', () => {
    scalarArray[S_ROTATION] = 0;

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
      attributes: attributes as any,
      scalarArray,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(scalarArray[S_ROTATION]).toBeCloseTo(5 * 1 * 0.02, 5);
  });

  test('applies colorOverLifetime curve modifiers when active', () => {
    normalizedConfig.colorOverLifetime.isActive = true;

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {
          startColorR: [1.0],
          startColorG: [0.8],
          startColorB: [0.6],
        },
        lifetimeValues: {},
        linearVelocityData: undefined,
      } as unknown as GeneralData,
      normalizedConfig,
      attributes: attributes as any,
      scalarArray,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(scalarArray[S_COLOR_R]).toBeCloseTo(1.0 * 0.5, 5);
    expect(scalarArray[S_COLOR_G]).toBeCloseTo(0.8 * 0.75, 5);
    expect(scalarArray[S_COLOR_B]).toBeCloseTo(0.6 * 0.25, 5);
  });

  test('does not apply colorOverLifetime when inactive', () => {
    normalizedConfig.colorOverLifetime.isActive = false;
    scalarArray[S_COLOR_R] = 1;
    scalarArray[S_COLOR_G] = 0.5;
    scalarArray[S_COLOR_B] = 0.25;

    applyModifiers({
      delta: 1,
      generalData: {
        noise: { isActive: false } as Noise,
        startValues: {
          startColorR: [1.0],
          startColorG: [0.8],
          startColorB: [0.6],
        },
        lifetimeValues: {},
        linearVelocityData: undefined,
      } as unknown as GeneralData,
      normalizedConfig,
      attributes: attributes as any,
      scalarArray,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(scalarArray[S_COLOR_R]).toBe(1);
    expect(scalarArray[S_COLOR_G]).toBe(0.5);
    expect(scalarArray[S_COLOR_B]).toBe(0.25);
  });
});
