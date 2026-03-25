import { ObjectUtils } from '@newkrok/three-utils';
import * as THREE from 'three';
import { Gyroscope } from 'three/examples/jsm/misc/Gyroscope.js';
import { FBM } from 'three-noise/build/three-noise.module.js';
import InstancedParticleFragmentShader from './shaders/instanced-particle-fragment-shader.glsl.js';
import InstancedParticleVertexShader from './shaders/instanced-particle-vertex-shader.glsl.js';
import ParticleSystemFragmentShader from './shaders/particle-system-fragment-shader.glsl.js';
import ParticleSystemVertexShader from './shaders/particle-system-vertex-shader.glsl.js';
import { removeBezierCurveFunction } from './three-particles-bezier.js';
import {
  EmitFrom,
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
  RendererType,
  Shape,
  SimulationSpace,
  SubEmitterTrigger,
  TimeMode,
} from './three-particles-enums';
import { applyForceFields } from './three-particles-forces.js';
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
  ForceFieldConfig,
  GeneralData,
  LifetimeCurve,
  MappedAttributes,
  NormalizedForceFieldConfig,
  NormalizedParticleSystemConfig,
  ParticleSystem,
  ParticleSystemConfig,
  ParticleSystemInstance,
  Point3D,
  RandomBetweenTwoConstants,
  ShapeConfig,
  SubEmitterConfig,
} from './types.js';

export * from './types.js';

let _particleSystemId = 0;
let createdParticleSystems: Array<ParticleSystemInstance> = [];

// Pre-allocated objects for updateParticleSystemInstance to avoid GC pressure
const _subEmitterPosition = new THREE.Vector3();
const _lastWorldPositionSnapshot = new THREE.Vector3();
const _distanceStep = { x: 0, y: 0, z: 0 };
const _tempPosition = { x: 0, y: 0, z: 0 };
const _modifierParams = {
  delta: 0,
  generalData: null as unknown as GeneralData,
  normalizedConfig: null as unknown as NormalizedParticleSystemConfig,
  attributes: null as unknown as MappedAttributes,
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
  forceFields: [],
};

const createFloat32Attributes = ({
  geometry,
  propertyName,
  maxParticles,
  factory,
  instanced,
}: {
  geometry: THREE.BufferGeometry;
  propertyName: string;
  maxParticles: number;
  factory: ((value: never, index: number) => number) | number;
  instanced?: boolean;
}) => {
  const array = new Float32Array(maxParticles);
  if (typeof factory === 'function') {
    for (let i = 0; i < maxParticles; i++) {
      array[i] = factory(undefined as never, i);
    }
  } else {
    array.fill(factory);
  }
  const attr = instanced
    ? new THREE.InstancedBufferAttribute(array, 1)
    : new THREE.BufferAttribute(array, 1);
  geometry.setAttribute(propertyName, attr);
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

const destroyParticleSystem = (particleSystem: THREE.Points | THREE.Mesh) => {
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
      if (wrapper?.parent) wrapper.parent.remove(wrapper);
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
      noisePower: 0,
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
    subEmitters,
    forceFields: rawForceFields,
  } = normalizedConfig;

  const toVector3 = (
    v: { x?: number; y?: number; z?: number } | undefined,
    fallback: THREE.Vector3
  ) => (v ? new THREE.Vector3(v.x ?? 0, v.y ?? 0, v.z ?? 0) : fallback.clone());

  const normalizedForceFields: Array<NormalizedForceFieldConfig> = (
    rawForceFields ?? []
  ).map((ff: ForceFieldConfig) => ({
    isActive: ff.isActive ?? true,
    type: ff.type ?? ForceFieldType.POINT,
    position: toVector3(ff.position, new THREE.Vector3(0, 0, 0)),
    direction: toVector3(ff.direction, new THREE.Vector3(0, 1, 0)).normalize(),
    strength: ff.strength ?? 1,
    range: Math.max(0, ff.range ?? Infinity),
    falloff: ff.falloff ?? ForceFieldFalloff.LINEAR,
  }));

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

  // Free list for O(1) inactive particle lookup (stack, top = end of array)
  const freeList: Array<number> = Array.from(
    { length: maxParticles },
    (_, i) => maxParticles - 1 - i
  );

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
    noisePower: 0.15 * noise.strength,
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

  const useInstancing = renderer.rendererType === RendererType.INSTANCED;

  // Attribute name prefix: instanced renderer uses 'instance'-prefixed names
  // to avoid collision with the base quad geometry's own 'position' attribute.
  const attr = (name: string) =>
    useInstancing
      ? `instance${name.charAt(0).toUpperCase()}${name.slice(1)}`
      : name;

  // Position attribute is special: Points uses 'position', instanced uses 'instanceOffset'
  const posAttr = useInstancing ? 'instanceOffset' : 'position';

  const sharedUniforms = {
    elapsed: { value: 0.0 },
    map: { value: particleMap },
    tiles: { value: textureSheetAnimation.tiles },
    fps: { value: textureSheetAnimation.fps },
    useFPSForFrameIndex: {
      value: textureSheetAnimation.timeMode === TimeMode.FPS,
    },
    backgroundColor: { value: renderer.backgroundColor },
    discardBackgroundColor: { value: renderer.discardBackgroundColor },
    backgroundColorTolerance: { value: renderer.backgroundColorTolerance },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: useInstancing
      ? InstancedParticleVertexShader
      : ParticleSystemVertexShader,
    fragmentShader: useInstancing
      ? InstancedParticleFragmentShader
      : ParticleSystemFragmentShader,
    transparent: renderer.transparent,
    blending: renderer.blending,
    depthTest: renderer.depthTest,
    depthWrite: renderer.depthWrite,
  });

  let geometry: THREE.BufferGeometry | THREE.InstancedBufferGeometry;

  if (useInstancing) {
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    // Base quad: 1x1 plane centred at origin (vertices from -0.5 to 0.5)
    const quadPositions = new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ]);
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    instancedGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(quadPositions, 3)
    );
    instancedGeometry.setIndex(new THREE.BufferAttribute(quadIndices, 1));
    instancedGeometry.instanceCount = maxParticles;
    geometry = instancedGeometry;
  } else {
    geometry = new THREE.BufferGeometry();
  }

  for (let i = 0; i < maxParticles; i++)
    calculatePositionAndVelocity(
      generalData,
      shape,
      startSpeed,
      startPositions[i],
      velocities[i]
    );

  // Per-particle (or per-instance) position offsets
  const positionArray = new Float32Array(maxParticles * 3);
  for (let i = 0; i < maxParticles; i++) {
    positionArray[i * 3] = startPositions[i].x;
    positionArray[i * 3 + 1] = startPositions[i].y;
    positionArray[i * 3 + 2] = startPositions[i].z;
  }
  const positionAttribute = useInstancing
    ? new THREE.InstancedBufferAttribute(positionArray, 3)
    : new THREE.BufferAttribute(positionArray, 3);
  geometry.setAttribute(posAttr, positionAttribute);

  createFloat32Attributes({
    geometry,
    propertyName: attr('isActive'),
    maxParticles,
    factory: 0,
    instanced: useInstancing,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('lifetime'),
    maxParticles,
    factory: 0,
    instanced: useInstancing,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('startLifetime'),
    maxParticles,
    factory: () =>
      calculateValue(generalData.particleSystemId, startLifetime, 0) * 1000,
    instanced: useInstancing,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('startFrame'),
    maxParticles,
    factory: () =>
      textureSheetAnimation.startFrame
        ? calculateValue(
            generalData.particleSystemId,
            textureSheetAnimation.startFrame,
            0
          )
        : 0,
    instanced: useInstancing,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('size'),
    maxParticles,
    factory: (_, index) => generalData.startValues.startSize[index],
    instanced: useInstancing,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('rotation'),
    maxParticles,
    factory: 0,
    instanced: useInstancing,
  });

  const colorRandomRatio = Math.random();
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorR'),
    maxParticles,
    factory: () =>
      startColor.min!.r! +
      colorRandomRatio * (startColor.max!.r! - startColor.min!.r!),
    instanced: useInstancing,
  });
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorG'),
    maxParticles,
    factory: () =>
      startColor.min!.g! +
      colorRandomRatio * (startColor.max!.g! - startColor.min!.g!),
    instanced: useInstancing,
  });
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorB'),
    maxParticles,
    factory: () =>
      startColor.min!.b! +
      colorRandomRatio * (startColor.max!.b! - startColor.min!.b!),
    instanced: useInstancing,
  });
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorA'),
    maxParticles,
    factory: 0,
    instanced: useInstancing,
  });

  // Resolve per-particle attribute accessors (instanced uses prefixed names)
  const a = geometry.attributes;
  const aIsActive = a[attr('isActive')];
  const aColorR = a[attr('colorR')];
  const aColorG = a[attr('colorG')];
  const aColorB = a[attr('colorB')];
  const aColorA = a[attr('colorA')];
  const aStartFrame = a[attr('startFrame')];
  const aStartLifetime = a[attr('startLifetime')];
  const aSize = a[attr('size')];
  const aRotation = a[attr('rotation')];
  const aLifetime = a[attr('lifetime')];
  const aPosition = a[posAttr];

  const deactivateParticle = (particleIndex: number) => {
    aIsActive.array[particleIndex] = 0;
    aColorA.array[particleIndex] = 0;
    aColorA.needsUpdate = true;
    freeList.push(particleIndex);
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
    aIsActive.array[particleIndex] = 1;
    generalData.creationTimes[particleIndex] = activationTime;

    if (generalData.noise.offsets)
      generalData.noise.offsets[particleIndex] = Math.random() * 100;

    const colorRandomRatio = Math.random();

    aColorR.array[particleIndex] =
      startColor.min!.r! +
      colorRandomRatio * (startColor.max!.r! - startColor.min!.r!);
    aColorR.needsUpdate = true;

    aColorG.array[particleIndex] =
      startColor.min!.g! +
      colorRandomRatio * (startColor.max!.g! - startColor.min!.g!);
    aColorG.needsUpdate = true;

    aColorB.array[particleIndex] =
      startColor.min!.b! +
      colorRandomRatio * (startColor.max!.b! - startColor.min!.b!);
    aColorB.needsUpdate = true;

    generalData.startValues.startColorR[particleIndex] =
      aColorR.array[particleIndex];
    generalData.startValues.startColorG[particleIndex] =
      aColorG.array[particleIndex];
    generalData.startValues.startColorB[particleIndex] =
      aColorB.array[particleIndex];

    aStartFrame.array[particleIndex] = textureSheetAnimation.startFrame
      ? calculateValue(
          generalData.particleSystemId,
          textureSheetAnimation.startFrame,
          0
        )
      : 0;
    aStartFrame.needsUpdate = true;

    aStartLifetime.array[particleIndex] =
      calculateValue(
        generalData.particleSystemId,
        startLifetime,
        generalData.normalizedLifetimePercentage
      ) * 1000;
    aStartLifetime.needsUpdate = true;

    generalData.startValues.startSize[particleIndex] = calculateValue(
      generalData.particleSystemId,
      startSize,
      generalData.normalizedLifetimePercentage
    );
    aSize.array[particleIndex] =
      generalData.startValues.startSize[particleIndex];
    aSize.needsUpdate = true;

    generalData.startValues.startOpacity[particleIndex] = calculateValue(
      generalData.particleSystemId,
      startOpacity,
      generalData.normalizedLifetimePercentage
    );
    aColorA.array[particleIndex] =
      generalData.startValues.startOpacity[particleIndex];
    aColorA.needsUpdate = true;

    aRotation.array[particleIndex] = calculateValue(
      generalData.particleSystemId,
      startRotation,
      generalData.normalizedLifetimePercentage
    );
    aRotation.needsUpdate = true;

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
    aPosition.array[positionIndex] =
      position.x + startPositions[particleIndex].x;
    aPosition.array[positionIndex + 1] =
      position.y + startPositions[particleIndex].y;
    aPosition.array[positionIndex + 2] =
      position.z + startPositions[particleIndex].z;
    aPosition.needsUpdate = true;

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

    aLifetime.array[particleIndex] = 0;
    aLifetime.needsUpdate = true;

    applyModifiers({
      delta: 0,
      generalData,
      normalizedConfig,
      attributes: mappedAttributes,
      particleLifetimePercentage: 0,
      particleIndex,
    });
  };

  // Sub-emitter setup
  const subEmitterArr: Array<SubEmitterConfig> = subEmitters ?? [];
  const deathSubEmitters = subEmitterArr.filter(
    (s) => (s.trigger ?? SubEmitterTrigger.DEATH) === SubEmitterTrigger.DEATH
  );
  const birthSubEmitters = subEmitterArr.filter(
    (s) => s.trigger === SubEmitterTrigger.BIRTH
  );
  // Track sub-emitter instances per config for per-config maxInstances enforcement
  const subEmitterInstancesMap = new Map<
    SubEmitterConfig,
    Array<ParticleSystem>
  >();
  for (const cfg of subEmitterArr) {
    subEmitterInstancesMap.set(cfg, []);
  }

  const cleanupCompletedInstances = (instances: Array<ParticleSystem>) => {
    for (let i = instances.length - 1; i >= 0; i--) {
      const sub = instances[i];
      const obj3d =
        sub.instance instanceof THREE.Points ||
        sub.instance instanceof THREE.Mesh
          ? sub.instance
          : (sub.instance.children[0] as THREE.Points | THREE.Mesh | undefined);
      const geomAttrs = (obj3d as THREE.Points | THREE.Mesh | undefined)
        ?.geometry?.attributes;
      const isActiveArr = geomAttrs
        ? (geomAttrs.isActive?.array ?? geomAttrs.instanceIsActive?.array)
        : undefined;
      if (!isActiveArr) {
        sub.dispose();
        instances.splice(i, 1);
        continue;
      }
      let hasActive = false;
      for (let j = 0; j < isActiveArr.length; j++) {
        if (isActiveArr[j]) {
          hasActive = true;
          break;
        }
      }
      if (!hasActive) {
        sub.dispose();
        instances.splice(i, 1);
      }
    }
  };

  const spawnSubEmitters = (
    configs: Array<SubEmitterConfig>,
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    spawnNow: number
  ) => {
    for (const subConfig of configs) {
      const instances = subEmitterInstancesMap.get(subConfig)!;
      const maxInst = subConfig.maxInstances ?? 32;
      if (instances.length >= maxInst) {
        cleanupCompletedInstances(instances);
        if (instances.length >= maxInst) continue;
      }

      const inheritVelocity = subConfig.inheritVelocity ?? 0;
      const subSystem = createParticleSystem(
        {
          ...subConfig.config,
          looping: false,
          transform: {
            ...subConfig.config.transform,
            position: new THREE.Vector3(position.x, position.y, position.z),
          },
          ...(inheritVelocity > 0
            ? {
                startSpeed:
                  (typeof subConfig.config.startSpeed === 'number'
                    ? subConfig.config.startSpeed
                    : typeof subConfig.config.startSpeed === 'object' &&
                        subConfig.config.startSpeed !== null &&
                        'min' in subConfig.config.startSpeed
                      ? ((
                          subConfig.config
                            .startSpeed as RandomBetweenTwoConstants
                        ).min ?? 0)
                      : 0) +
                  velocity.length() * inheritVelocity,
              }
            : {}),
        },
        spawnNow
      );

      const parentObj = (wrapper || particleSystem).parent;
      if (parentObj) parentObj.add(subSystem.instance);

      instances.push(subSystem);
    }
  };

  let particleSystem: THREE.Points | THREE.Mesh = useInstancing
    ? new THREE.Mesh(geometry, material)
    : new THREE.Points(geometry, material);

  particleSystem.position.copy(transform!.position!);
  particleSystem.rotation.x = THREE.MathUtils.degToRad(transform.rotation!.x);
  particleSystem.rotation.y = THREE.MathUtils.degToRad(transform.rotation!.y);
  particleSystem.rotation.z = THREE.MathUtils.degToRad(transform.rotation!.z);
  particleSystem.scale.copy(transform.scale!);

  // Create a mapped view of attributes so the update loop and modifiers can
  // use standard names regardless of the renderer type.
  const mappedAttributes = {
    position: aPosition,
    isActive: aIsActive,
    lifetime: aLifetime,
    startLifetime: aStartLifetime,
    startFrame: aStartFrame,
    size: aSize,
    rotation: aRotation,
    colorR: aColorR,
    colorG: aColorG,
    colorB: aColorB,
    colorA: aColorA,
  };

  const calculatedCreationTime =
    now + calculateValue(generalData.particleSystemId, startDelay) * 1000;

  let wrapper: Gyroscope | undefined;
  if (normalizedConfig.simulationSpace === SimulationSpace.WORLD) {
    wrapper = new Gyroscope();
    wrapper.add(particleSystem);
  }

  const hasDeathSubEmitters = deathSubEmitters.length > 0;
  const hasBirthSubEmitters = birthSubEmitters.length > 0;

  const onParticleDeath = hasDeathSubEmitters
    ? (
        particleIndex: number,
        positionArr: THREE.TypedArray,
        velocity: THREE.Vector3,
        deathNow: number
      ) => {
        const posIdx = particleIndex * 3;
        _subEmitterPosition.set(
          positionArr[posIdx],
          positionArr[posIdx + 1],
          positionArr[posIdx + 2]
        );
        spawnSubEmitters(
          deathSubEmitters,
          _subEmitterPosition,
          velocity,
          deathNow
        );
      }
    : undefined;

  const onParticleBirth = hasBirthSubEmitters
    ? (
        particleIndex: number,
        positionArr: THREE.TypedArray,
        velocity: THREE.Vector3,
        birthNow: number
      ) => {
        const posIdx = particleIndex * 3;
        _subEmitterPosition.set(
          positionArr[posIdx],
          positionArr[posIdx + 1],
          positionArr[posIdx + 2]
        );
        spawnSubEmitters(
          birthSubEmitters,
          _subEmitterPosition,
          velocity,
          birthNow
        );
      }
    : undefined;

  const instanceData: ParticleSystemInstance = {
    particleSystem,
    wrapper,
    mappedAttributes,
    elapsedUniform: material.uniforms.elapsed,
    generalData,
    onUpdate,
    onComplete,
    creationTime: calculatedCreationTime,
    lastEmissionTime: calculatedCreationTime,
    duration,
    looping,
    simulationSpace,
    gravity,
    normalizedForceFields,
    emission,
    normalizedConfig,
    iterationCount: 0,
    velocities,
    freeList,
    deactivateParticle,
    activateParticle,
    onParticleDeath,
    onParticleBirth,
  };

  createdParticleSystems.push(instanceData);

  const resumeEmitter = () => (generalData.isEnabled = true);
  const pauseEmitter = () => (generalData.isEnabled = false);
  const dispose = () => {
    for (const instances of subEmitterInstancesMap.values()) {
      for (const sub of instances) sub.dispose();
      instances.length = 0;
    }
    destroyParticleSystem(particleSystem);
  };
  const update = (cycleData: CycleData) => {
    updateParticleSystemInstance(instanceData, cycleData);
    for (const instances of subEmitterInstancesMap.values()) {
      for (const sub of instances) sub.update(cycleData);
    }
  };

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
    elapsedUniform,
    creationTime,
    lastEmissionTime,
    duration,
    looping,
    emission,
    normalizedConfig,
    iterationCount,
    velocities,
    freeList,
    deactivateParticle,
    activateParticle,
    simulationSpace,
    gravity,
    normalizedForceFields,
    onParticleDeath,
    onParticleBirth,
    mappedAttributes: ma,
  } = props;

  const hasForceFields = normalizedForceFields.length > 0;

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

  elapsedUniform.value = elapsed;

  particleSystem.getWorldPosition(currentWorldPosition);
  if (lastWorldPosition.x !== -99999) {
    worldPositionChange.set(
      currentWorldPosition.x - lastWorldPosition.x,
      currentWorldPosition.y - lastWorldPosition.y,
      currentWorldPosition.z - lastWorldPosition.z
    );
  }
  if (isEnabled) {
    generalData.distanceFromLastEmitByDistance += worldPositionChange.length();
  }
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
  const isActiveArr = ma.isActive.array;
  const startLifetimeArr = ma.startLifetime.array;
  const positionArr = ma.position.array;
  const lifetimeArr = ma.lifetime.array;
  const creationTimesLength = creationTimes.length;

  let positionNeedsUpdate = false;
  let lifetimeNeedsUpdate = false;

  _modifierParams.delta = delta;
  _modifierParams.generalData = generalData;
  _modifierParams.normalizedConfig = normalizedConfig;
  _modifierParams.attributes = ma;

  for (let index = 0; index < creationTimesLength; index++) {
    if (isActiveArr[index]) {
      const particleLifetime = now - creationTimes[index];
      if (particleLifetime > startLifetimeArr[index]) {
        if (onParticleDeath)
          onParticleDeath(index, positionArr, velocities[index], now);
        deactivateParticle(index);
      } else {
        const velocity = velocities[index];
        velocity.x -= gravityVelocity.x * delta;
        velocity.y -= gravityVelocity.y * delta;
        velocity.z -= gravityVelocity.z * delta;

        if (hasForceFields) {
          applyForceFields({
            particleSystemId: generalData.particleSystemId,
            forceFields: normalizedForceFields,
            velocity,
            positionArr,
            positionIndex: index * 3,
            delta,
            systemLifetimePercentage: generalData.normalizedLifetimePercentage,
          });
        }

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

  if (positionNeedsUpdate) ma.position.needsUpdate = true;
  if (lifetimeNeedsUpdate) ma.lifetime.needsUpdate = true;

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

      for (let i = 0; i < neededParticles; i++) {
        if (freeList.length === 0) break;
        const particleIndex = freeList.pop()!;

        _tempPosition.x = 0;
        _tempPosition.y = 0;
        _tempPosition.z = 0;
        if (
          useDistanceStep &&
          generatedParticlesByDistanceNeeds < neededParticlesByDistance
        ) {
          _tempPosition.x = _distanceStep.x * generatedParticlesByDistanceNeeds;
          _tempPosition.y = _distanceStep.y * generatedParticlesByDistanceNeeds;
          _tempPosition.z = _distanceStep.z * generatedParticlesByDistanceNeeds;
          generatedParticlesByDistanceNeeds++;
        }
        activateParticle({
          particleIndex,
          activationTime: now,
          position: _tempPosition,
        });
        if (onParticleBirth)
          onParticleBirth(
            particleIndex,
            ma.position.array,
            velocities[particleIndex],
            now
          );
        props.lastEmissionTime = now;
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
