import { ObjectUtils } from '@newkrok/three-utils';
import * as THREE from 'three';
import { Gyroscope } from 'three/examples/jsm/misc/Gyroscope.js';
import { FBM } from 'three-noise/build/three-noise.module.js';
import ParticleSystemFragmentShader from './shaders/particle-system-fragment-shader.glsl.js';
import ParticleSystemVertexShader from './shaders/particle-system-vertex-shader.glsl.js';
import { removeBezierCurveFunction } from './three-particles-bezier.js';
import {
  EmitFrom,
  LifeTimeCurve,
  Shape,
  SimulationSpace,
  TimeMode,
} from './three-particles-enums';
import { applyModifiers } from './three-particles-modifiers.js';
import {
  calculateRandomPositionAndVelocityOnBox,
  calculateRandomPositionAndVelocityOnCircle,
  calculateRandomPositionAndVelocityOnCone,
  calculateRandomPositionAndVelocityOnRectangle,
  calculateRandomPositionAndVelocityOnSphere,
  calculateValue,
  getCurveFunctionFromConfig,
  isLifeTimeCurve,
  createDefaultParticleTexture,
} from './three-particles-utils.js';

import {
  Constant,
  CycleData,
  GeneralData,
  LifetimeCurve,
  NormalizedParticleSystemConfig,
  ParticleSystem,
  ParticleSystemConfig,
  ParticleSystemInstance,
  Point3D,
  RandomBetweenTwoConstants,
  ShapeConfig,
} from './types.js';

export * from './types.js';

let _particleSystemId = 0;
let createdParticleSystems: Array<ParticleSystemInstance> = [];

// Pre-allocated objects for updateParticleSystemInstance to avoid GC pressure
const _lastWorldPositionSnapshot = new THREE.Vector3();
const _distanceStep = { x: 0, y: 0, z: 0 };
const _tempPosition = { x: 0, y: 0, z: 0 };
const _modifierParams = {
  delta: 0,
  generalData: null as unknown as GeneralData,
  normalizedConfig: null as unknown as NormalizedParticleSystemConfig,
  attributes: null as unknown as THREE.NormalBufferAttributes,
  particleLifetimePercentage: 0,
  particleIndex: 0,
};

/**
 * Mapping of blending mode string identifiers to Three.js blending constants.
 *
 * Used for converting serialized particle system configurations (e.g., from JSON)
 * to actual Three.js blending mode constants.
 *
 * @example
 * ```typescript
 * import { blendingMap } from '@newkrok/three-particles';
 *
 * // Convert string to Three.js constant
 * const blending = blendingMap['THREE.AdditiveBlending'];
 * // blending === THREE.AdditiveBlending
 * ```
 */
export const blendingMap = {
  'THREE.NoBlending': THREE.NoBlending,
  'THREE.NormalBlending': THREE.NormalBlending,
  'THREE.AdditiveBlending': THREE.AdditiveBlending,
  'THREE.SubtractiveBlending': THREE.SubtractiveBlending,
  'THREE.MultiplyBlending': THREE.MultiplyBlending,
};

/**
 * Returns a deep copy of the default particle system configuration.
 *
 * This is useful when you want to start with default settings and modify specific properties
 * without affecting the internal default configuration object.
 *
 * @returns A new object containing all default particle system settings
 *
 * @example
 * ```typescript
 * import { getDefaultParticleSystemConfig, createParticleSystem } from '@newkrok/three-particles';
 *
 * // Get default config and modify it
 * const config = getDefaultParticleSystemConfig();
 * config.emission.rateOverTime = 100;
 * config.startColor.min = { r: 1, g: 0, b: 0 };
 *
 * const { instance } = createParticleSystem(config);
 * scene.add(instance);
 * ```
 */
export const getDefaultParticleSystemConfig = () =>
  JSON.parse(JSON.stringify(DEFAULT_PARTICLE_SYSTEM_CONFIG));

const DEFAULT_PARTICLE_SYSTEM_CONFIG: ParticleSystemConfig = {
  transform: {
    position: new THREE.Vector3(),
    rotation: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
  },
  duration: 5.0,
  looping: true,
  startDelay: 0,
  startLifetime: 5.0,
  startSpeed: 1.0,
  startSize: 1.0,
  startOpacity: 1.0,
  startRotation: 0.0,
  startColor: {
    min: { r: 1.0, g: 1.0, b: 1.0 },
    max: { r: 1.0, g: 1.0, b: 1.0 },
  },
  gravity: 0.0,
  simulationSpace: SimulationSpace.LOCAL,
  maxParticles: 100.0,
  emission: {
    rateOverTime: 10.0,
    rateOverDistance: 0.0,
    bursts: [],
  },
  shape: {
    shape: Shape.SPHERE,
    sphere: {
      radius: 1.0,
      radiusThickness: 1.0,
      arc: 360.0,
    },
    cone: {
      angle: 25.0,
      radius: 1.0,
      radiusThickness: 1.0,
      arc: 360.0,
    },
    circle: {
      radius: 1.0,
      radiusThickness: 1.0,
      arc: 360.0,
    },
    rectangle: {
      rotation: { x: 0.0, y: 0.0 }, // TODO: add z rotation
      scale: { x: 1.0, y: 1.0 },
    },
    box: {
      scale: { x: 1.0, y: 1.0, z: 1.0 },
      emitFrom: EmitFrom.VOLUME,
    },
  },
  map: undefined,
  renderer: {
    blending: THREE.NormalBlending,
    discardBackgroundColor: false,
    backgroundColorTolerance: 1.0,
    backgroundColor: { r: 1.0, g: 1.0, b: 1.0 },
    transparent: true,
    depthTest: true,
    depthWrite: false,
  },
  velocityOverLifetime: {
    isActive: false,
    linear: {
      x: 0,
      y: 0,
      z: 0,
    },
    orbital: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  sizeOverLifetime: {
    isActive: false,
    lifetimeCurve: {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
  },
  colorOverLifetime: {
    isActive: false,
    r: {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
    g: {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
    b: {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
  },
  opacityOverLifetime: {
    isActive: false,
    lifetimeCurve: {
      type: LifeTimeCurve.BEZIER,
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
  },
  rotationOverLifetime: {
    isActive: false,
    min: 0.0,
    max: 0.0,
  },
  noise: {
    isActive: false,
    useRandomOffset: false,
    strength: 1.0,
    frequency: 0.5,
    octaves: 1,
    positionAmount: 1.0,
    rotationAmount: 0.0,
    sizeAmount: 0.0,
  },
  textureSheetAnimation: {
    tiles: new THREE.Vector2(1.0, 1.0),
    timeMode: TimeMode.LIFETIME,
    fps: 30.0,
    startFrame: 0,
  },
};

const createFloat32Attributes = ({
  geometry,
  propertyName,
  maxParticles,
  factory,
}: {
  geometry: THREE.BufferGeometry;
  propertyName: string;
  maxParticles: number;
  factory: ((value: never, index: number) => number) | number;
}) => {
  const array = new Float32Array(maxParticles);
  if (typeof factory === 'function') {
    for (let i = 0; i < maxParticles; i++) {
      array[i] = factory(undefined as never, i);
    }
  } else {
    array.fill(factory);
  }
  geometry.setAttribute(propertyName, new THREE.BufferAttribute(array, 1));
};

const calculatePositionAndVelocity = (
  generalData: GeneralData,
  { shape, sphere, cone, circle, rectangle, box }: ShapeConfig,
  startSpeed: Constant | RandomBetweenTwoConstants | LifetimeCurve,
  position: THREE.Vector3,
  velocity: THREE.Vector3
) => {
  const calculatedStartSpeed = calculateValue(
    generalData.particleSystemId,
    startSpeed,
    generalData.normalizedLifetimePercentage
  );

  switch (shape) {
    case Shape.SPHERE:
      calculateRandomPositionAndVelocityOnSphere(
        position,
        generalData.wrapperQuaternion,
        velocity,
        calculatedStartSpeed,
        sphere as Required<NonNullable<ShapeConfig['sphere']>>
      );
      break;

    case Shape.CONE:
      calculateRandomPositionAndVelocityOnCone(
        position,
        generalData.wrapperQuaternion,
        velocity,
        calculatedStartSpeed,
        cone as Required<NonNullable<ShapeConfig['cone']>>
      );
      break;

    case Shape.CIRCLE:
      calculateRandomPositionAndVelocityOnCircle(
        position,
        generalData.wrapperQuaternion,
        velocity,
        calculatedStartSpeed,
        circle as Required<NonNullable<ShapeConfig['circle']>>
      );
      break;

    case Shape.RECTANGLE:
      calculateRandomPositionAndVelocityOnRectangle(
        position,
        generalData.wrapperQuaternion,
        velocity,
        calculatedStartSpeed,
        rectangle as Required<NonNullable<ShapeConfig['rectangle']>>
      );
      break;

    case Shape.BOX:
      calculateRandomPositionAndVelocityOnBox(
        position,
        generalData.wrapperQuaternion,
        velocity,
        calculatedStartSpeed,
        box as Required<NonNullable<ShapeConfig['box']>>
      );
      break;
  }
};

const destroyParticleSystem = (particleSystem: THREE.Points) => {
  createdParticleSystems = createdParticleSystems.filter(
    ({
      particleSystem: savedParticleSystem,
      wrapper,
      generalData: { particleSystemId },
    }) => {
      if (
        savedParticleSystem !== particleSystem &&
        wrapper !== particleSystem
      ) {
        return true;
      }

      removeBezierCurveFunction(particleSystemId);
      savedParticleSystem.geometry.dispose();
      if (Array.isArray(savedParticleSystem.material))
        savedParticleSystem.material.forEach((material) => material.dispose());
      else savedParticleSystem.material.dispose();

      if (savedParticleSystem.parent)
        savedParticleSystem.parent.remove(savedParticleSystem);
      return false;
    }
  );
};

/**
 * Creates a new particle system with the specified configuration.
 *
 * This is the primary function for instantiating particle effects. It handles the complete
 * setup of a particle system including geometry creation, material configuration, shader setup,
 * and initialization of all particle properties.
 *
 * @param config - Configuration object for the particle system. If not provided, uses default settings.
 *                 See {@link ParticleSystemConfig} for all available options.
 * @param externalNow - Optional custom timestamp in milliseconds. If not provided, uses `Date.now()`.
 *                      Useful for synchronized particle systems or testing.
 *
 * @returns A {@link ParticleSystem} object containing:
 *   - `instance`: The THREE.Object3D that should be added to your scene
 *   - `resumeEmitter()`: Function to resume particle emission
 *   - `pauseEmitter()`: Function to pause particle emission
 *   - `dispose()`: Function to clean up resources and remove the particle system
 *
 * @example
 * ```typescript
 * import { createParticleSystem, updateParticleSystems } from '@newkrok/three-particles';
 *
 * // Create a basic particle system with default settings
 * const { instance, dispose } = createParticleSystem();
 * scene.add(instance);
 *
 * // Create a custom fire effect
 * const fireEffect = createParticleSystem({
 *   duration: 2.0,
 *   looping: true,
 *   startLifetime: { min: 0.5, max: 1.5 },
 *   startSpeed: { min: 2, max: 4 },
 *   startSize: { min: 0.5, max: 1.5 },
 *   startColor: {
 *     min: { r: 1.0, g: 0.3, b: 0.0 },
 *     max: { r: 1.0, g: 0.8, b: 0.0 }
 *   },
 *   emission: { rateOverTime: 50 },
 *   shape: {
 *     shape: Shape.CONE,
 *     cone: { angle: 10, radius: 0.2 }
 *   }
 * });
 * scene.add(fireEffect.instance);
 *
 * // In your animation loop
 * function animate(time) {
 *   updateParticleSystems({ now: time, delta: deltaTime, elapsed: elapsedTime });
 *   renderer.render(scene, camera);
 * }
 *
 * // Clean up when done
 * fireEffect.dispose();
 * ```
 *
 * @see {@link updateParticleSystems} - Required function to call in your animation loop
 * @see {@link ParticleSystemConfig} - Complete configuration options
 */
export const createParticleSystem = (
  config: ParticleSystemConfig = DEFAULT_PARTICLE_SYSTEM_CONFIG,
  externalNow?: number
): ParticleSystem => {
  const now = externalNow || Date.now();
  const generalData: GeneralData = {
    particleSystemId: _particleSystemId++,
    normalizedLifetimePercentage: 0,
    distanceFromLastEmitByDistance: 0,
    lastWorldPosition: new THREE.Vector3(-99999),
    currentWorldPosition: new THREE.Vector3(-99999),
    worldPositionChange: new THREE.Vector3(),
    worldQuaternion: new THREE.Quaternion(),
    wrapperQuaternion: new THREE.Quaternion(),
    lastWorldQuaternion: new THREE.Quaternion(-99999),
    worldEuler: new THREE.Euler(),
    gravityVelocity: new THREE.Vector3(0, 0, 0),
    startValues: {},
    linearVelocityData: undefined,
    orbitalVelocityData: undefined,
    lifetimeValues: {},
    creationTimes: [],
    noise: {
      isActive: false,
      strength: 0,
      positionAmount: 0,
      rotationAmount: 0,
      sizeAmount: 0,
    },
    isEnabled: true,
  };
  const normalizedConfig = ObjectUtils.deepMerge(
    DEFAULT_PARTICLE_SYSTEM_CONFIG as NormalizedParticleSystemConfig,
    config,
    { applyToFirstObject: false, skippedProperties: [] }
  ) as NormalizedParticleSystemConfig;
  let particleMap: THREE.Texture | null =
    normalizedConfig.map || createDefaultParticleTexture();

  const {
    transform,
    duration,
    looping,
    startDelay,
    startLifetime,
    startSpeed,
    startSize,
    startRotation,
    startColor,
    startOpacity,
    gravity,
    simulationSpace,
    maxParticles,
    emission,
    shape,
    renderer,
    noise,
    velocityOverLifetime,
    onUpdate,
    onComplete,
    textureSheetAnimation,
  } = normalizedConfig;

  if (typeof renderer?.blending === 'string')
    renderer.blending = blendingMap[renderer.blending];

  const startPositions = Array.from(
    { length: maxParticles },
    () => new THREE.Vector3()
  );
  const velocities = Array.from(
    { length: maxParticles },
    () => new THREE.Vector3()
  );

  generalData.creationTimes = Array.from({ length: maxParticles }, () => 0);

  if (velocityOverLifetime.isActive) {
    generalData.linearVelocityData = Array.from(
      { length: maxParticles },
      () => ({
        speed: new THREE.Vector3(
          velocityOverLifetime.linear.x
            ? calculateValue(
                generalData.particleSystemId,
                velocityOverLifetime.linear.x,
                0
              )
            : 0,
          velocityOverLifetime.linear.y
            ? calculateValue(
                generalData.particleSystemId,
                velocityOverLifetime.linear.y,
                0
              )
            : 0,
          velocityOverLifetime.linear.z
            ? calculateValue(
                generalData.particleSystemId,
                velocityOverLifetime.linear.z,
                0
              )
            : 0
        ),
        valueModifiers: {
          x: isLifeTimeCurve(velocityOverLifetime.linear.x || 0)
            ? getCurveFunctionFromConfig(
                generalData.particleSystemId,
                velocityOverLifetime.linear.x as LifetimeCurve
              )
            : undefined,
          y: isLifeTimeCurve(velocityOverLifetime.linear.y || 0)
            ? getCurveFunctionFromConfig(
                generalData.particleSystemId,
                velocityOverLifetime.linear.y as LifetimeCurve
              )
            : undefined,
          z: isLifeTimeCurve(velocityOverLifetime.linear.z || 0)
            ? getCurveFunctionFromConfig(
                generalData.particleSystemId,
                velocityOverLifetime.linear.z as LifetimeCurve
              )
            : undefined,
        },
      })
    );

    generalData.orbitalVelocityData = Array.from(
      { length: maxParticles },
      () => ({
        speed: new THREE.Vector3(
          velocityOverLifetime.orbital.x
            ? calculateValue(
                generalData.particleSystemId,
                velocityOverLifetime.orbital.x,
                0
              )
            : 0,
          velocityOverLifetime.orbital.y
            ? calculateValue(
                generalData.particleSystemId,
                velocityOverLifetime.orbital.y,
                0
              )
            : 0,
          velocityOverLifetime.orbital.z
            ? calculateValue(
                generalData.particleSystemId,
                velocityOverLifetime.orbital.z,
                0
              )
            : 0
        ),
        valueModifiers: {
          x: isLifeTimeCurve(velocityOverLifetime.orbital.x || 0)
            ? getCurveFunctionFromConfig(
                generalData.particleSystemId,
                velocityOverLifetime.orbital.x as LifetimeCurve
              )
            : undefined,
          y: isLifeTimeCurve(velocityOverLifetime.orbital.y || 0)
            ? getCurveFunctionFromConfig(
                generalData.particleSystemId,
                velocityOverLifetime.orbital.y as LifetimeCurve
              )
            : undefined,
          z: isLifeTimeCurve(velocityOverLifetime.orbital.z || 0)
            ? getCurveFunctionFromConfig(
                generalData.particleSystemId,
                velocityOverLifetime.orbital.z as LifetimeCurve
              )
            : undefined,
        },
        positionOffset: new THREE.Vector3(),
      })
    );
  }

  const startValueKeys: Array<keyof NormalizedParticleSystemConfig> = [
    'startSize',
    'startOpacity',
  ];
  startValueKeys.forEach((key) => {
    generalData.startValues[key] = Array.from({ length: maxParticles }, () =>
      calculateValue(
        generalData.particleSystemId,
        normalizedConfig[key] as
          | Constant
          | RandomBetweenTwoConstants
          | LifetimeCurve,
        0
      )
    );
  });

  generalData.startValues.startColorR = Array.from(
    { length: maxParticles },
    () => 0
  );
  generalData.startValues.startColorG = Array.from(
    { length: maxParticles },
    () => 0
  );
  generalData.startValues.startColorB = Array.from(
    { length: maxParticles },
    () => 0
  );

  const lifetimeValueKeys: Array<keyof NormalizedParticleSystemConfig> = [
    'rotationOverLifetime',
  ];
  lifetimeValueKeys.forEach((key) => {
    const value = normalizedConfig[key] as {
      isActive: boolean;
    } & RandomBetweenTwoConstants;
    if (value.isActive)
      generalData.lifetimeValues[key] = Array.from(
        { length: maxParticles },
        () => THREE.MathUtils.randFloat(value.min!, value.max!)
      );
  });

  generalData.noise = {
    isActive: noise.isActive,
    strength: noise.strength,
    positionAmount: noise.positionAmount,
    rotationAmount: noise.rotationAmount,
    sizeAmount: noise.sizeAmount,
    sampler: noise.isActive
      ? new FBM({
          seed: Math.random(),
          scale: noise.frequency,
          octaves: noise.octaves,
        })
      : undefined,
    offsets: noise.useRandomOffset
      ? Array.from({ length: maxParticles }, () => Math.random() * 100)
      : undefined,
  };

  // Initialize burst states if bursts are configured
  if (emission.bursts && emission.bursts.length > 0) {
    generalData.burstStates = emission.bursts.map(() => ({
      cyclesExecuted: 0,
      lastCycleTime: 0,
      probabilityPassed: false,
    }));
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      elapsed: {
        value: 0.0,
      },
      map: {
        value: particleMap,
      },
      tiles: {
        value: textureSheetAnimation.tiles,
      },
      fps: {
        value: textureSheetAnimation.fps,
      },
      useFPSForFrameIndex: {
        value: textureSheetAnimation.timeMode === TimeMode.FPS,
      },
      backgroundColor: {
        value: renderer.backgroundColor,
      },
      discardBackgroundColor: {
        value: renderer.discardBackgroundColor,
      },
      backgroundColorTolerance: {
        value: renderer.backgroundColorTolerance,
      },
    },
    vertexShader: ParticleSystemVertexShader,
    fragmentShader: ParticleSystemFragmentShader,
    transparent: renderer.transparent,
    blending: renderer.blending,
    depthTest: renderer.depthTest,
    depthWrite: renderer.depthWrite,
  });

  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < maxParticles; i++)
    calculatePositionAndVelocity(
      generalData,
      shape,
      startSpeed,
      startPositions[i],
      velocities[i]
    );

  const positionArray = new Float32Array(maxParticles * 3);
  for (let i = 0; i < maxParticles; i++) {
    positionArray[i * 3] = startPositions[i].x;
    positionArray[i * 3 + 1] = startPositions[i].y;
    positionArray[i * 3 + 2] = startPositions[i].z;
  }
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positionArray, 3)
  );

  createFloat32Attributes({
    geometry,
    propertyName: 'isActive',
    maxParticles,
    factory: 0,
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'lifetime',
    maxParticles,
    factory: 0,
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'startLifetime',
    maxParticles,
    factory: () =>
      calculateValue(generalData.particleSystemId, startLifetime, 0) * 1000,
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'startFrame',
    maxParticles,
    factory: () =>
      textureSheetAnimation.startFrame
        ? calculateValue(
            generalData.particleSystemId,
            textureSheetAnimation.startFrame,
            0
          )
        : 0,
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'opacity',
    maxParticles,
    factory: () =>
      calculateValue(generalData.particleSystemId, startOpacity, 0),
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'rotation',
    maxParticles,
    factory: () =>
      calculateValue(generalData.particleSystemId, startRotation, 0),
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'size',
    maxParticles,
    factory: (_, index) => generalData.startValues.startSize[index],
  });

  createFloat32Attributes({
    geometry,
    propertyName: 'rotation',
    maxParticles,
    factory: 0,
  });

  const colorRandomRatio = Math.random();
  createFloat32Attributes({
    geometry,
    propertyName: 'colorR',
    maxParticles,
    factory: () =>
      startColor.min!.r! +
      colorRandomRatio * (startColor.max!.r! - startColor.min!.r!),
  });
  createFloat32Attributes({
    geometry,
    propertyName: 'colorG',
    maxParticles,
    factory: () =>
      startColor.min!.g! +
      colorRandomRatio * (startColor.max!.g! - startColor.min!.g!),
  });
  createFloat32Attributes({
    geometry,
    propertyName: 'colorB',
    maxParticles,
    factory: () =>
      startColor.min!.b! +
      colorRandomRatio * (startColor.max!.b! - startColor.min!.b!),
  });
  createFloat32Attributes({
    geometry,
    propertyName: 'colorA',
    maxParticles,
    factory: 0,
  });

  const deactivateParticle = (particleIndex: number) => {
    geometry.attributes.isActive.array[particleIndex] = 0;
    geometry.attributes.colorA.array[particleIndex] = 0;
    geometry.attributes.colorA.needsUpdate = true;
  };

  const activateParticle = ({
    particleIndex,
    activationTime,
    position,
  }: {
    particleIndex: number;
    activationTime: number;
    position: Required<Point3D>;
  }) => {
    geometry.attributes.isActive.array[particleIndex] = 1;
    generalData.creationTimes[particleIndex] = activationTime;

    if (generalData.noise.offsets)
      generalData.noise.offsets[particleIndex] = Math.random() * 100;

    const colorRandomRatio = Math.random();

    geometry.attributes.colorR.array[particleIndex] =
      startColor.min!.r! +
      colorRandomRatio * (startColor.max!.r! - startColor.min!.r!);
    geometry.attributes.colorR.needsUpdate = true;

    geometry.attributes.colorG.array[particleIndex] =
      startColor.min!.g! +
      colorRandomRatio * (startColor.max!.g! - startColor.min!.g!);
    geometry.attributes.colorG.needsUpdate = true;

    geometry.attributes.colorB.array[particleIndex] =
      startColor.min!.b! +
      colorRandomRatio * (startColor.max!.b! - startColor.min!.b!);
    geometry.attributes.colorB.needsUpdate = true;

    generalData.startValues.startColorR[particleIndex] =
      geometry.attributes.colorR.array[particleIndex];
    generalData.startValues.startColorG[particleIndex] =
      geometry.attributes.colorG.array[particleIndex];
    generalData.startValues.startColorB[particleIndex] =
      geometry.attributes.colorB.array[particleIndex];

    geometry.attributes.startFrame.array[particleIndex] =
      textureSheetAnimation.startFrame
        ? calculateValue(
            generalData.particleSystemId,
            textureSheetAnimation.startFrame,
            0
          )
        : 0;
    geometry.attributes.startFrame.needsUpdate = true;

    geometry.attributes.startLifetime.array[particleIndex] =
      calculateValue(
        generalData.particleSystemId,
        startLifetime,
        generalData.normalizedLifetimePercentage
      ) * 1000;
    geometry.attributes.startLifetime.needsUpdate = true;

    generalData.startValues.startSize[particleIndex] = calculateValue(
      generalData.particleSystemId,
      startSize,
      generalData.normalizedLifetimePercentage
    );
    geometry.attributes.size.array[particleIndex] =
      generalData.startValues.startSize[particleIndex];
    geometry.attributes.size.needsUpdate = true;

    generalData.startValues.startOpacity[particleIndex] = calculateValue(
      generalData.particleSystemId,
      startOpacity,
      generalData.normalizedLifetimePercentage
    );
    geometry.attributes.colorA.array[particleIndex] =
      generalData.startValues.startOpacity[particleIndex];
    geometry.attributes.colorA.needsUpdate = true;

    geometry.attributes.rotation.array[particleIndex] = calculateValue(
      generalData.particleSystemId,
      startRotation,
      generalData.normalizedLifetimePercentage
    );
    geometry.attributes.rotation.needsUpdate = true;

    if (normalizedConfig.rotationOverLifetime.isActive)
      generalData.lifetimeValues.rotationOverLifetime[particleIndex] =
        THREE.MathUtils.randFloat(
          normalizedConfig.rotationOverLifetime.min!,
          normalizedConfig.rotationOverLifetime.max!
        );

    calculatePositionAndVelocity(
      generalData,
      shape,
      startSpeed,
      startPositions[particleIndex],
      velocities[particleIndex]
    );
    const positionIndex = Math.floor(particleIndex * 3);
    geometry.attributes.position.array[positionIndex] =
      position.x + startPositions[particleIndex].x;
    geometry.attributes.position.array[positionIndex + 1] =
      position.y + startPositions[particleIndex].y;
    geometry.attributes.position.array[positionIndex + 2] =
      position.z + startPositions[particleIndex].z;
    geometry.attributes.position.needsUpdate = true;

    if (generalData.linearVelocityData) {
      generalData.linearVelocityData[particleIndex].speed.set(
        normalizedConfig.velocityOverLifetime.linear.x
          ? calculateValue(
              generalData.particleSystemId,
              normalizedConfig.velocityOverLifetime.linear.x,
              0
            )
          : 0,
        normalizedConfig.velocityOverLifetime.linear.y
          ? calculateValue(
              generalData.particleSystemId,
              normalizedConfig.velocityOverLifetime.linear.y,
              0
            )
          : 0,
        normalizedConfig.velocityOverLifetime.linear.z
          ? calculateValue(
              generalData.particleSystemId,
              normalizedConfig.velocityOverLifetime.linear.z,
              0
            )
          : 0
      );
    }

    if (generalData.orbitalVelocityData) {
      generalData.orbitalVelocityData[particleIndex].speed.set(
        normalizedConfig.velocityOverLifetime.orbital.x
          ? calculateValue(
              generalData.particleSystemId,
              normalizedConfig.velocityOverLifetime.orbital.x,
              0
            )
          : 0,
        normalizedConfig.velocityOverLifetime.orbital.y
          ? calculateValue(
              generalData.particleSystemId,
              normalizedConfig.velocityOverLifetime.orbital.y,
              0
            )
          : 0,
        normalizedConfig.velocityOverLifetime.orbital.z
          ? calculateValue(
              generalData.particleSystemId,
              normalizedConfig.velocityOverLifetime.orbital.z,
              0
            )
          : 0
      );
      generalData.orbitalVelocityData[particleIndex].positionOffset.set(
        startPositions[particleIndex].x,
        startPositions[particleIndex].y,
        startPositions[particleIndex].z
      );
    }

    geometry.attributes.lifetime.array[particleIndex] = 0;
    geometry.attributes.lifetime.needsUpdate = true;

    applyModifiers({
      delta: 0,
      generalData,
      normalizedConfig,
      attributes: particleSystem.geometry.attributes,
      particleLifetimePercentage: 0,
      particleIndex,
    });
  };

  let particleSystem = new THREE.Points(geometry, material);

  particleSystem.position.copy(transform!.position!);
  particleSystem.rotation.x = THREE.MathUtils.degToRad(transform.rotation!.x);
  particleSystem.rotation.y = THREE.MathUtils.degToRad(transform.rotation!.y);
  particleSystem.rotation.z = THREE.MathUtils.degToRad(transform.rotation!.z);
  particleSystem.scale.copy(transform.scale!);

  const calculatedCreationTime =
    now + calculateValue(generalData.particleSystemId, startDelay) * 1000;

  let wrapper: Gyroscope | undefined;
  if (normalizedConfig.simulationSpace === SimulationSpace.WORLD) {
    wrapper = new Gyroscope();
    wrapper.add(particleSystem);
  }

  const instanceData: ParticleSystemInstance = {
    particleSystem,
    wrapper,
    generalData,
    onUpdate,
    onComplete,
    creationTime: calculatedCreationTime,
    lastEmissionTime: calculatedCreationTime,
    duration,
    looping,
    simulationSpace,
    gravity,
    emission,
    normalizedConfig,
    iterationCount: 0,
    velocities,
    deactivateParticle,
    activateParticle,
  };

  createdParticleSystems.push(instanceData);

  const resumeEmitter = () => (generalData.isEnabled = true);
  const pauseEmitter = () => (generalData.isEnabled = false);
  const dispose = () => destroyParticleSystem(particleSystem);
  const update = (cycleData: CycleData) =>
    updateParticleSystemInstance(instanceData, cycleData);

  return {
    instance: wrapper || particleSystem,
    resumeEmitter,
    pauseEmitter,
    dispose,
    update,
  };
};

/**
 * Updates all active particle systems created with {@link createParticleSystem}.
 *
 * This function must be called once per frame in your animation loop to animate all particles.
 * It handles particle emission, movement, lifetime tracking, modifier application, and cleanup
 * of expired particle systems.
 *
 * @param cycleData - Object containing timing information for the current frame:
 *   - `now`: Current timestamp in milliseconds (typically from `performance.now()` or `Date.now()`)
 *   - `delta`: Time elapsed since the last frame in seconds
 *   - `elapsed`: Total time elapsed since the animation started in seconds
 *
 * @example
 * ```typescript
 * import { createParticleSystem, updateParticleSystems } from '@newkrok/three-particles';
 *
 * const { instance } = createParticleSystem({
 *   // your config
 * });
 * scene.add(instance);
 *
 * // Animation loop
 * let lastTime = 0;
 * let elapsedTime = 0;
 *
 * function animate(currentTime) {
 *   requestAnimationFrame(animate);
 *
 *   const delta = (currentTime - lastTime) / 1000; // Convert to seconds
 *   elapsedTime += delta;
 *   lastTime = currentTime;
 *
 *   // Update all particle systems
 *   updateParticleSystems({
 *     now: currentTime,
 *     delta: delta,
 *     elapsed: elapsedTime
 *   });
 *
 *   renderer.render(scene, camera);
 * }
 *
 * animate(0);
 * ```
 *
 * @example
 * ```typescript
 * // Using Three.js Clock for timing
 * import * as THREE from 'three';
 * import { updateParticleSystems } from '@newkrok/three-particles';
 *
 * const clock = new THREE.Clock();
 *
 * function animate() {
 *   requestAnimationFrame(animate);
 *
 *   const delta = clock.getDelta();
 *   const elapsed = clock.getElapsedTime();
 *
 *   updateParticleSystems({
 *     now: performance.now(),
 *     delta: delta,
 *     elapsed: elapsed
 *   });
 *
 *   renderer.render(scene, camera);
 * }
 * ```
 *
 * @see {@link createParticleSystem} - Creates particle systems to be updated
 * @see {@link CycleData} - Timing data structure
 */
const updateParticleSystemInstance = (
  props: ParticleSystemInstance,
  { now, delta, elapsed }: CycleData
) => {
  const {
    onUpdate,
    generalData,
    onComplete,
    particleSystem,
    wrapper,
    creationTime,
    lastEmissionTime,
    duration,
    looping,
    emission,
    normalizedConfig,
    iterationCount,
    velocities,
    deactivateParticle,
    activateParticle,
    simulationSpace,
    gravity,
  } = props;

  const lifetime = now - creationTime;
  const normalizedLifetime = lifetime % (duration * 1000);

  generalData.normalizedLifetimePercentage = Math.max(
    Math.min(normalizedLifetime / (duration * 1000), 1),
    0
  );

  const {
    lastWorldPosition,
    currentWorldPosition,
    worldPositionChange,
    lastWorldQuaternion,
    worldQuaternion,
    worldEuler,
    gravityVelocity,
    isEnabled,
  } = generalData;

  if (wrapper?.parent)
    generalData.wrapperQuaternion.copy(wrapper.parent.quaternion);

  _lastWorldPositionSnapshot.copy(lastWorldPosition);

  if (Array.isArray(particleSystem.material))
    particleSystem.material.forEach((material) => {
      if (material instanceof THREE.ShaderMaterial)
        material.uniforms.elapsed.value = elapsed;
    });
  else {
    if (particleSystem.material instanceof THREE.ShaderMaterial)
      particleSystem.material.uniforms.elapsed.value = elapsed;
  }

  particleSystem.getWorldPosition(currentWorldPosition);
  if (lastWorldPosition.x !== -99999) {
    worldPositionChange.set(
      currentWorldPosition.x - lastWorldPosition.x,
      currentWorldPosition.y - lastWorldPosition.y,
      currentWorldPosition.z - lastWorldPosition.z
    );
  }
  generalData.distanceFromLastEmitByDistance += worldPositionChange.length();
  particleSystem.getWorldPosition(lastWorldPosition);
  particleSystem.getWorldQuaternion(worldQuaternion);
  if (
    lastWorldQuaternion.x === -99999 ||
    lastWorldQuaternion.x !== worldQuaternion.x ||
    lastWorldQuaternion.y !== worldQuaternion.y ||
    lastWorldQuaternion.z !== worldQuaternion.z
  ) {
    worldEuler.setFromQuaternion(worldQuaternion);
    lastWorldQuaternion.copy(worldQuaternion);
    gravityVelocity.set(
      lastWorldPosition.x,
      lastWorldPosition.y + gravity,
      lastWorldPosition.z
    );
    particleSystem.worldToLocal(gravityVelocity);
  }

  const creationTimes = generalData.creationTimes;
  const attributes = particleSystem.geometry.attributes;
  const isActiveArr = attributes.isActive.array;
  const startLifetimeArr = attributes.startLifetime.array;
  const positionArr = attributes.position.array;
  const lifetimeArr = attributes.lifetime.array;
  const creationTimesLength = creationTimes.length;

  let positionNeedsUpdate = false;
  let lifetimeNeedsUpdate = false;

  _modifierParams.delta = delta;
  _modifierParams.generalData = generalData;
  _modifierParams.normalizedConfig = normalizedConfig;
  _modifierParams.attributes = attributes;

  for (let index = 0; index < creationTimesLength; index++) {
    if (isActiveArr[index]) {
      const particleLifetime = now - creationTimes[index];
      if (particleLifetime > startLifetimeArr[index]) {
        deactivateParticle(index);
      } else {
        const velocity = velocities[index];
        velocity.x -= gravityVelocity.x * delta;
        velocity.y -= gravityVelocity.y * delta;
        velocity.z -= gravityVelocity.z * delta;

        if (
          gravity !== 0 ||
          velocity.x !== 0 ||
          velocity.y !== 0 ||
          velocity.z !== 0 ||
          worldPositionChange.x !== 0 ||
          worldPositionChange.y !== 0 ||
          worldPositionChange.z !== 0
        ) {
          const positionIndex = index * 3;

          if (simulationSpace === SimulationSpace.WORLD) {
            positionArr[positionIndex] -= worldPositionChange.x;
            positionArr[positionIndex + 1] -= worldPositionChange.y;
            positionArr[positionIndex + 2] -= worldPositionChange.z;
          }

          positionArr[positionIndex] += velocity.x * delta;
          positionArr[positionIndex + 1] += velocity.y * delta;
          positionArr[positionIndex + 2] += velocity.z * delta;
          positionNeedsUpdate = true;
        }

        lifetimeArr[index] = particleLifetime;
        lifetimeNeedsUpdate = true;

        _modifierParams.particleLifetimePercentage =
          particleLifetime / startLifetimeArr[index];
        _modifierParams.particleIndex = index;
        applyModifiers(_modifierParams);
      }
    }
  }

  if (positionNeedsUpdate) attributes.position.needsUpdate = true;
  if (lifetimeNeedsUpdate) attributes.lifetime.needsUpdate = true;

  if (isEnabled && (looping || lifetime < duration * 1000)) {
    const emissionDelta = now - lastEmissionTime;
    const neededParticlesByTime = emission.rateOverTime
      ? Math.floor(
          calculateValue(
            generalData.particleSystemId,
            emission.rateOverTime,
            generalData.normalizedLifetimePercentage
          ) *
            (emissionDelta / 1000)
        )
      : 0;

    const rateOverDistance = emission.rateOverDistance
      ? calculateValue(
          generalData.particleSystemId,
          emission.rateOverDistance,
          generalData.normalizedLifetimePercentage
        )
      : 0;
    const neededParticlesByDistance =
      rateOverDistance > 0 && generalData.distanceFromLastEmitByDistance > 0
        ? Math.floor(
            generalData.distanceFromLastEmitByDistance / (1 / rateOverDistance!)
          )
        : 0;
    const useDistanceStep = neededParticlesByDistance > 0;
    if (useDistanceStep) {
      _distanceStep.x =
        (currentWorldPosition.x - _lastWorldPositionSnapshot.x) /
        neededParticlesByDistance;
      _distanceStep.y =
        (currentWorldPosition.y - _lastWorldPositionSnapshot.y) /
        neededParticlesByDistance;
      _distanceStep.z =
        (currentWorldPosition.z - _lastWorldPositionSnapshot.z) /
        neededParticlesByDistance;
    }
    let neededParticles = neededParticlesByTime + neededParticlesByDistance;

    if (rateOverDistance > 0 && neededParticlesByDistance >= 1) {
      generalData.distanceFromLastEmitByDistance = 0;
    }

    // Process burst emissions
    if (emission.bursts && generalData.burstStates) {
      const bursts = emission.bursts;
      const burstStates = generalData.burstStates;
      const currentIterationTime = normalizedLifetime;

      for (let i = 0; i < bursts.length; i++) {
        const burst = bursts[i];
        const state = burstStates[i];
        const burstTimeMs = burst.time * 1000;
        const cycles = burst.cycles ?? 1;
        const intervalMs = (burst.interval ?? 0) * 1000;
        const probability = burst.probability ?? 1;

        // Check if we've looped and need to reset burst states
        if (
          looping &&
          currentIterationTime < burstTimeMs &&
          state.cyclesExecuted > 0
        ) {
          state.cyclesExecuted = 0;
          state.lastCycleTime = 0;
          state.probabilityPassed = false;
        }

        // Check if all cycles for this burst have been executed
        if (state.cyclesExecuted >= cycles) continue;

        // Calculate the time for the next cycle
        const nextCycleTime = burstTimeMs + state.cyclesExecuted * intervalMs;

        // Check if it's time for the next cycle
        if (currentIterationTime >= nextCycleTime) {
          // On first cycle, determine if probability check passes
          if (state.cyclesExecuted === 0) {
            state.probabilityPassed = Math.random() < probability;
          }

          // Only emit if probability check passed
          if (state.probabilityPassed) {
            const burstCount = Math.floor(
              calculateValue(
                generalData.particleSystemId,
                burst.count,
                generalData.normalizedLifetimePercentage
              )
            );
            neededParticles += burstCount;
          }

          state.cyclesExecuted++;
          state.lastCycleTime = currentIterationTime;
        }
      }
    }

    if (neededParticles > 0) {
      let generatedParticlesByDistanceNeeds = 0;
      const isActiveArrLen = isActiveArr.length;

      for (let i = 0; i < neededParticles; i++) {
        let particleIndex = -1;
        for (let j = 0; j < isActiveArrLen; j++) {
          if (!isActiveArr[j]) {
            particleIndex = j;
            break;
          }
        }

        if (particleIndex !== -1 && particleIndex < isActiveArrLen) {
          _tempPosition.x = 0;
          _tempPosition.y = 0;
          _tempPosition.z = 0;
          if (
            useDistanceStep &&
            generatedParticlesByDistanceNeeds < neededParticlesByDistance
          ) {
            _tempPosition.x =
              _distanceStep.x * generatedParticlesByDistanceNeeds;
            _tempPosition.y =
              _distanceStep.y * generatedParticlesByDistanceNeeds;
            _tempPosition.z =
              _distanceStep.z * generatedParticlesByDistanceNeeds;
            generatedParticlesByDistanceNeeds++;
          }
          activateParticle({
            particleIndex,
            activationTime: now,
            position: _tempPosition,
          });
          props.lastEmissionTime = now;
        }
      }
    }

    if (onUpdate)
      onUpdate({
        particleSystem,
        delta,
        elapsed,
        lifetime,
        normalizedLifetime,
        iterationCount: iterationCount + 1,
      });
  } else if (onComplete)
    onComplete({
      particleSystem,
    });
};

export const updateParticleSystems = (cycleData: CycleData) => {
  createdParticleSystems.forEach((props) =>
    updateParticleSystemInstance(props, cycleData)
  );
};
