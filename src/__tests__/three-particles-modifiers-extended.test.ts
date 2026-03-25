import * as THREE from 'three';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { applyModifiers } from '../js/effects/three-particles/three-particles-modifiers.js';
import {
  GeneralData,
  Noise,
  NormalizedParticleSystemConfig,
} from '../js/effects/three-particles/types.js';

const createAttributes = (maxParticles = 3) =>
  ({
    position: {
      array: new Float32Array(maxParticles * 3),
      needsUpdate: false,
    },
    rotation: { array: new Float32Array(maxParticles), needsUpdate: false },
    size: { array: new Float32Array(maxParticles), needsUpdate: false },
    colorA: { array: new Float32Array(maxParticles), needsUpdate: false },
    colorR: { array: new Float32Array(maxParticles), needsUpdate: false },
    colorG: { array: new Float32Array(maxParticles), needsUpdate: false },
    colorB: { array: new Float32Array(maxParticles), needsUpdate: false },
  }) as unknown as THREE.NormalBufferAttributes;

const createBaseConfig = (): NormalizedParticleSystemConfig =>
  ({
    opacityOverLifetime: { isActive: false },
    sizeOverLifetime: { isActive: false },
    colorOverLifetime: { isActive: false },
    rotationOverLifetime: { isActive: false },
  }) as unknown as NormalizedParticleSystemConfig;

const createBaseGeneralData = (maxParticles = 3): GeneralData =>
  ({
    particleSystemId: 0,
    startValues: {
      startSize: new Array(maxParticles).fill(1),
      startOpacity: new Array(maxParticles).fill(1),
      startColorR: new Array(maxParticles).fill(1),
      startColorG: new Array(maxParticles).fill(1),
      startColorB: new Array(maxParticles).fill(1),
    },
    lifetimeValues: {},
    linearVelocityData: undefined,
    orbitalVelocityData: undefined,
    noise: { isActive: false } as Noise,
  }) as unknown as GeneralData;

describe('applyModifiers - size over lifetime', () => {
  it('should scale size by easing curve value', () => {
    const attributes = createAttributes();
    attributes.size.array[0] = 2;

    const generalData = createBaseGeneralData();
    generalData.startValues.startSize[0] = 2;

    const config = createBaseConfig();
    config.sizeOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: () => 0.5,
        scale: 1,
      },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.size.array[0]).toBeCloseTo(1); // 2 * 0.5
    expect(attributes.size.needsUpdate).toBe(true);
  });

  it('should handle size curve at start of life (t=0)', () => {
    const attributes = createAttributes();
    const generalData = createBaseGeneralData();
    generalData.startValues.startSize[0] = 5;

    const config = createBaseConfig();
    config.sizeOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: (t: number) => t,
        scale: 1,
      },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0,
      particleIndex: 0,
    });

    expect(attributes.size.array[0]).toBeCloseTo(0); // 5 * 0
  });

  it('should handle size curve at end of life (t=1)', () => {
    const attributes = createAttributes();
    const generalData = createBaseGeneralData();
    generalData.startValues.startSize[0] = 3;

    const config = createBaseConfig();
    config.sizeOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: (t: number) => t,
        scale: 1,
      },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 1,
      particleIndex: 0,
    });

    expect(attributes.size.array[0]).toBeCloseTo(3); // 3 * 1
  });
});

describe('applyModifiers - opacity over lifetime', () => {
  it('should scale opacity by curve value', () => {
    const attributes = createAttributes();
    const generalData = createBaseGeneralData();
    generalData.startValues.startOpacity[0] = 0.8;

    const config = createBaseConfig();
    config.opacityOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: () => 0.5,
        scale: 1,
      },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.colorA.array[0]).toBeCloseTo(0.4); // 0.8 * 0.5
    expect(attributes.colorA.needsUpdate).toBe(true);
  });

  it('should fade to zero at end of life', () => {
    const attributes = createAttributes();
    const generalData = createBaseGeneralData();
    generalData.startValues.startOpacity[0] = 1;

    const config = createBaseConfig();
    config.opacityOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: (t: number) => 1 - t,
        scale: 1,
      },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 1,
      particleIndex: 0,
    });

    expect(attributes.colorA.array[0]).toBeCloseTo(0);
  });
});

describe('applyModifiers - color over lifetime', () => {
  it('should modify RGB channels independently', () => {
    const attributes = createAttributes();
    const generalData = createBaseGeneralData();
    generalData.startValues.startColorR[0] = 1;
    generalData.startValues.startColorG[0] = 0.8;
    generalData.startValues.startColorB[0] = 0.6;

    const config = createBaseConfig();
    config.colorOverLifetime = {
      isActive: true,
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
        curveFunction: () => 1.0,
        scale: 1,
      },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.colorR.array[0]).toBeCloseTo(0.5); // 1 * 0.5
    expect(attributes.colorG.array[0]).toBeCloseTo(0.6); // 0.8 * 0.75
    expect(attributes.colorB.array[0]).toBeCloseTo(0.6); // 0.6 * 1.0
    expect(attributes.colorR.needsUpdate).toBe(true);
    expect(attributes.colorG.needsUpdate).toBe(true);
    expect(attributes.colorB.needsUpdate).toBe(true);
  });
});

describe('applyModifiers - rotation over lifetime', () => {
  it('should accumulate rotation over time', () => {
    const attributes = createAttributes();
    attributes.rotation.array[0] = 0;

    const generalData = createBaseGeneralData();
    generalData.lifetimeValues.rotationOverLifetime = [5, 0, 0];

    const config = createBaseConfig();

    applyModifiers({
      delta: 0.5,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    // rotation += 5 * 0.5 * 0.02 = 0.05
    expect(attributes.rotation.array[0]).toBeCloseTo(0.05);
    expect(attributes.rotation.needsUpdate).toBe(true);
  });

  it('should not modify rotation when no rotationOverLifetime data', () => {
    const attributes = createAttributes();
    attributes.rotation.array[0] = 1.5;

    const generalData = createBaseGeneralData();
    const config = createBaseConfig();

    applyModifiers({
      delta: 0.5,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.rotation.array[0]).toBe(1.5);
  });
});

describe('applyModifiers - linear velocity', () => {
  it('should move particle in X direction with constant speed', () => {
    const attributes = createAttributes();
    attributes.position.array[0] = 0; // x

    const generalData = createBaseGeneralData();
    generalData.linearVelocityData = [
      {
        speed: new THREE.Vector3(10, 0, 0),
        valueModifiers: { x: undefined, y: undefined, z: undefined },
      },
    ] as any;

    const config = createBaseConfig();

    applyModifiers({
      delta: 0.1,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array[0]).toBeCloseTo(1); // 10 * 0.1
    expect(attributes.position.needsUpdate).toBe(true);
  });

  it('should apply value modifier curve for linear velocity', () => {
    const attributes = createAttributes();
    attributes.position.array[0] = 0;

    const generalData = createBaseGeneralData();
    generalData.linearVelocityData = [
      {
        speed: new THREE.Vector3(10, 0, 0),
        valueModifiers: {
          x: (t: number) => t * 5, // At t=0.5, returns 2.5
          y: undefined,
          z: undefined,
        },
      },
    ] as any;

    const config = createBaseConfig();

    applyModifiers({
      delta: 0.1,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    // Uses curve value (2.5) instead of speed (10)
    expect(attributes.position.array[0]).toBeCloseTo(0.25); // 2.5 * 0.1
  });

  it('should move particle in all three axes', () => {
    const attributes = createAttributes();

    const generalData = createBaseGeneralData();
    generalData.linearVelocityData = [
      {
        speed: new THREE.Vector3(3, 5, 7),
        valueModifiers: { x: undefined, y: undefined, z: undefined },
      },
    ] as any;

    const config = createBaseConfig();

    applyModifiers({
      delta: 0.1,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array[0]).toBeCloseTo(0.3); // 3 * 0.1
    expect(attributes.position.array[1]).toBeCloseTo(0.5); // 5 * 0.1
    expect(attributes.position.array[2]).toBeCloseTo(0.7); // 7 * 0.1
  });
});

describe('applyModifiers - orbital velocity', () => {
  it('should rotate particle around emission point', () => {
    const attributes = createAttributes();
    // Particle at offset position (1, 0, 0)
    attributes.position.array[0] = 1;
    attributes.position.array[1] = 0;
    attributes.position.array[2] = 0;

    const generalData = createBaseGeneralData();
    generalData.orbitalVelocityData = [
      {
        speed: new THREE.Vector3(0, 5, 0),
        positionOffset: new THREE.Vector3(1, 0, 0),
        valueModifiers: { x: undefined, y: undefined, z: undefined },
      },
    ] as any;

    const config = createBaseConfig();

    applyModifiers({
      delta: 0.1,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    // Position should have changed from orbital rotation
    expect(attributes.position.needsUpdate).toBe(true);
  });

  it('should apply orbital velocity modifier curves', () => {
    const attributes = createAttributes();
    attributes.position.array[0] = 1;
    attributes.position.array[1] = 0;
    attributes.position.array[2] = 0;

    const generalData = createBaseGeneralData();
    generalData.orbitalVelocityData = [
      {
        speed: new THREE.Vector3(0, 5, 0),
        positionOffset: new THREE.Vector3(1, 0, 0),
        valueModifiers: {
          x: undefined,
          y: (t: number) => t * 10,
          z: undefined,
        },
      },
    ] as any;

    const config = createBaseConfig();

    applyModifiers({
      delta: 0.1,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.needsUpdate).toBe(true);
  });
});

describe('applyModifiers - combined modifiers', () => {
  it('should apply size, opacity, and color modifiers together', () => {
    const attributes = createAttributes();
    attributes.size.array[0] = 2;
    attributes.colorA.array[0] = 1;

    const generalData = createBaseGeneralData();
    generalData.startValues.startSize[0] = 2;
    generalData.startValues.startOpacity[0] = 1;
    generalData.startValues.startColorR[0] = 1;
    generalData.startValues.startColorG[0] = 1;
    generalData.startValues.startColorB[0] = 1;

    const config = createBaseConfig();
    config.sizeOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: () => 0.5,
        scale: 1,
      },
    } as any;
    config.opacityOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: () => 0.8,
        scale: 1,
      },
    } as any;
    config.colorOverLifetime = {
      isActive: true,
      r: { type: LifeTimeCurve.EASING, curveFunction: () => 0.3, scale: 1 },
      g: { type: LifeTimeCurve.EASING, curveFunction: () => 0.6, scale: 1 },
      b: { type: LifeTimeCurve.EASING, curveFunction: () => 0.9, scale: 1 },
    } as any;

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.size.array[0]).toBeCloseTo(1); // 2 * 0.5
    expect(attributes.colorA.array[0]).toBeCloseTo(0.8); // 1 * 0.8
    expect(attributes.colorR.array[0]).toBeCloseTo(0.3); // 1 * 0.3
    expect(attributes.colorG.array[0]).toBeCloseTo(0.6); // 1 * 0.6
    expect(attributes.colorB.array[0]).toBeCloseTo(0.9); // 1 * 0.9
  });

  it('should apply modifiers to specific particle index', () => {
    const attributes = createAttributes();
    attributes.size.array[0] = 1;
    attributes.size.array[1] = 3;
    attributes.size.array[2] = 5;

    const generalData = createBaseGeneralData();
    generalData.startValues.startSize = [1, 3, 5];

    const config = createBaseConfig();
    config.sizeOverLifetime = {
      isActive: true,
      lifetimeCurve: {
        type: LifeTimeCurve.EASING,
        curveFunction: () => 2,
        scale: 1,
      },
    } as any;

    // Apply to particle index 1
    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 1,
    });

    expect(attributes.size.array[0]).toBe(1); // Unchanged
    expect(attributes.size.array[1]).toBeCloseTo(6); // 3 * 2
    expect(attributes.size.array[2]).toBe(5); // Unchanged
  });
});

describe('applyModifiers - no modifiers active', () => {
  it('should not modify any attributes when nothing is active', () => {
    const attributes = createAttributes();
    attributes.position.array[0] = 1;
    attributes.position.array[1] = 2;
    attributes.position.array[2] = 3;
    attributes.size.array[0] = 5;
    attributes.colorA.array[0] = 0.7;
    attributes.rotation.array[0] = 1.2;

    const generalData = createBaseGeneralData();
    const config = createBaseConfig();

    applyModifiers({
      delta: 0.016,
      generalData,
      normalizedConfig: config,
      attributes,
      particleLifetimePercentage: 0.5,
      particleIndex: 0,
    });

    expect(attributes.position.array[0]).toBe(1);
    expect(attributes.position.array[1]).toBe(2);
    expect(attributes.position.array[2]).toBe(3);
    expect(attributes.size.array[0]).toBe(5);
    expect(attributes.colorA.array[0]).toBeCloseTo(0.7);
    expect(attributes.rotation.array[0]).toBeCloseTo(1.2);
    expect(attributes.position.needsUpdate).toBe(false);
    expect(attributes.size.needsUpdate).toBe(false);
    expect(attributes.colorA.needsUpdate).toBe(false);
    expect(attributes.rotation.needsUpdate).toBe(false);
  });
});
