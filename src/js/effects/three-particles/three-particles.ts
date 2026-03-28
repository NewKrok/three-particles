import { ObjectUtils } from '@newkrok/three-utils';
import * as THREE from 'three';
import { Gyroscope } from 'three/examples/jsm/misc/Gyroscope.js';
import { FBM } from 'three-noise/build/three-noise.module.js';
import InstancedParticleFragmentShader from './shaders/instanced-particle-fragment-shader.glsl.js';
import InstancedParticleVertexShader from './shaders/instanced-particle-vertex-shader.glsl.js';
import MeshParticleFragmentShader from './shaders/mesh-particle-fragment-shader.glsl.js';
import MeshParticleVertexShader from './shaders/mesh-particle-vertex-shader.glsl.js';
import ParticleSystemFragmentShader from './shaders/particle-system-fragment-shader.glsl.js';
import ParticleSystemVertexShader from './shaders/particle-system-vertex-shader.glsl.js';
import TrailFragmentShader from './shaders/trail-fragment-shader.glsl.js';
import TrailVertexShader from './shaders/trail-vertex-shader.glsl.js';
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
  createDefaultMeshTexture,
  createDefaultParticleTexture,
} from './three-particles-utils.js';

import {
  Constant,
  CurveFunction,
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
  MeshConfig,
  TrailConfig,
} from './types.js';

export * from './types.js';

const normalizeTrailCurve = (
  curve: LifetimeCurve | undefined,
  defaultCurve: LifetimeCurve
): LifetimeCurve => {
  if (!curve) return defaultCurve;
  const raw = curve as Record<string, unknown>;
  if (!raw.type && Array.isArray(raw.bezierPoints)) {
    return { type: LifeTimeCurve.BEZIER, ...raw } as LifetimeCurve;
  }
  return curve;
};

let _particleSystemId = 0;
let createdParticleSystems: Array<ParticleSystemInstance> = [];

// Pre-allocated objects for updateParticleSystemInstance to avoid GC pressure
const _subEmitterPosition = new THREE.Vector3();
const _lastWorldPositionSnapshot = new THREE.Vector3();
// Trail ribbon helpers (reused across frames to avoid allocations)
const _trailDir = new THREE.Vector3();
const _trailPerp = new THREE.Vector3();
const _trailToCam = new THREE.Vector3();
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
    softParticles: {
      enabled: false,
      intensity: 1.0,
    },
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
      trailMesh,
      generalData: { particleSystemId },
    }) => {
      if (
        savedParticleSystem !== particleSystem &&
        wrapper !== particleSystem
      ) {
        return true;
      }

      removeBezierCurveFunction(particleSystemId);

      // Dispose trail mesh if present
      if (trailMesh) {
        trailMesh.geometry.dispose();
        if (Array.isArray(trailMesh.material))
          trailMesh.material.forEach((m) => m.dispose());
        else trailMesh.material.dispose();
        if (trailMesh.parent) trailMesh.parent.remove(trailMesh);
      }

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
    normalizedConfig.map ||
    (normalizedConfig.renderer.rendererType === RendererType.MESH
      ? createDefaultMeshTexture()
      : createDefaultParticleTexture());

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

  const useTrail = renderer.rendererType === RendererType.TRAIL;
  const useMesh = renderer.rendererType === RendererType.MESH;
  const useInstancing =
    !useTrail && !useMesh && renderer.rendererType === RendererType.INSTANCED;
  const useInstancedAttributes = useInstancing || useMesh;

  // Trail config defaults
  const defaultTrailCurve: LifetimeCurve = {
    type: LifeTimeCurve.BEZIER,
    scale: 1,
    bezierPoints: [
      { x: 0, y: 1, percentage: 0 },
      { x: 1, y: 0, percentage: 1 },
    ],
  };
  const trailConfig = useTrail
    ? {
        length: renderer.trail?.length ?? 20,
        width: renderer.trail?.width ?? 1.0,
        widthOverTrail: normalizeTrailCurve(
          renderer.trail?.widthOverTrail,
          defaultTrailCurve
        ),
        opacityOverTrail: normalizeTrailCurve(
          renderer.trail?.opacityOverTrail,
          defaultTrailCurve
        ),
        colorOverTrail: renderer.trail?.colorOverTrail,
        minVertexDistance: renderer.trail?.minVertexDistance ?? 0,
        maxTime: renderer.trail?.maxTime ?? 0,
        smoothing: renderer.trail?.smoothing ?? false,
        smoothingSubdivisions: renderer.trail?.smoothingSubdivisions ?? 3,
        twistPrevention: renderer.trail?.twistPrevention ?? false,
        ribbonId: renderer.trail?.ribbonId,
      }
    : undefined;

  // Initialize trail position history buffers
  if (useTrail && trailConfig) {
    const trailLength = trailConfig.length;
    generalData.trailLength = trailLength;
    generalData.positionHistory = new Float32Array(
      maxParticles * trailLength * 3
    );
    generalData.positionHistoryIndex = new Uint16Array(maxParticles);
    generalData.positionHistoryCount = new Uint16Array(maxParticles);

    // Adaptive sampling: track last sampled position per particle
    if (trailConfig.minVertexDistance > 0) {
      generalData.trailLastSampledPosition = new Float32Array(maxParticles * 3);
    }

    // Max time: track timestamp of each history sample
    if (trailConfig.maxTime > 0) {
      generalData.trailSampleTimes = new Float64Array(
        maxParticles * trailLength
      );
    }

    // Twist prevention: store previous ribbon normal per particle
    if (trailConfig.twistPrevention) {
      generalData.trailPrevNormal = new Float32Array(maxParticles * 3);
    }
  }

  // Attribute name prefix: instanced/mesh renderers use 'instance'-prefixed names
  // to avoid collision with the base geometry's own 'position' attribute.
  const attr = (name: string) =>
    useInstancedAttributes
      ? `instance${name.charAt(0).toUpperCase()}${name.slice(1)}`
      : name;

  // Position attribute is special: Points uses 'position', instanced/mesh uses 'instanceOffset'
  const posAttr = useInstancedAttributes ? 'instanceOffset' : 'position';

  const softParticlesEnabled = !!(
    renderer.softParticles?.enabled && renderer.softParticles?.depthTexture
  );

  const sharedUniforms: Record<string, { value: unknown }> = {
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
    ...(useInstancing ? { viewportHeight: { value: 1.0 } } : {}),
    softParticlesEnabled: { value: softParticlesEnabled },
    softParticlesIntensity: {
      value: Math.max(renderer.softParticles?.intensity ?? 1.0, 0.001),
    },
    sceneDepthTexture: {
      value: renderer.softParticles?.depthTexture ?? null,
    },
    cameraNearFar: { value: new THREE.Vector2(0.1, 1000.0) },
  };

  const getVertexShader = () => {
    if (useMesh) return MeshParticleVertexShader;
    if (useInstancing) return InstancedParticleVertexShader;
    return ParticleSystemVertexShader;
  };

  const getFragmentShader = () => {
    if (useMesh) return MeshParticleFragmentShader;
    if (useInstancing) return InstancedParticleFragmentShader;
    return ParticleSystemFragmentShader;
  };

  const material = new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: getVertexShader(),
    fragmentShader: getFragmentShader(),
    transparent: renderer.transparent,
    blending: renderer.blending,
    depthTest: renderer.depthTest,
    depthWrite: renderer.depthWrite,
  });

  let geometry: THREE.BufferGeometry | THREE.InstancedBufferGeometry;

  if (useMesh) {
    const meshConfig = renderer.mesh;
    if (!meshConfig?.geometry) {
      throw new Error(
        'RendererType.MESH requires a mesh configuration with a geometry. ' +
          'Set renderer.mesh.geometry to a THREE.BufferGeometry instance.'
      );
    }
    const instancedGeometry = new THREE.InstancedBufferGeometry();
    // Copy base mesh geometry attributes (position, normal, uv, index)
    const sourceGeom = meshConfig.geometry;
    const srcPos = sourceGeom.getAttribute('position');
    if (srcPos) instancedGeometry.setAttribute('position', srcPos);
    const srcNormal = sourceGeom.getAttribute('normal');
    if (srcNormal) instancedGeometry.setAttribute('normal', srcNormal);
    const srcUv = sourceGeom.getAttribute('uv');
    if (srcUv) instancedGeometry.setAttribute('uv', srcUv);
    const srcIndex = sourceGeom.getIndex();
    if (srcIndex) instancedGeometry.setIndex(srcIndex);
    instancedGeometry.instanceCount = maxParticles;
    geometry = instancedGeometry;
  } else if (useInstancing) {
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
  const positionAttribute = useInstancedAttributes
    ? new THREE.InstancedBufferAttribute(positionArray, 3)
    : new THREE.BufferAttribute(positionArray, 3);
  geometry.setAttribute(posAttr, positionAttribute);

  createFloat32Attributes({
    geometry,
    propertyName: attr('isActive'),
    maxParticles,
    factory: 0,
    instanced: useInstancedAttributes,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('lifetime'),
    maxParticles,
    factory: 0,
    instanced: useInstancedAttributes,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('startLifetime'),
    maxParticles,
    factory: () =>
      calculateValue(generalData.particleSystemId, startLifetime, 0) * 1000,
    instanced: useInstancedAttributes,
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
    instanced: useInstancedAttributes,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('size'),
    maxParticles,
    factory: (_, index) => generalData.startValues.startSize[index],
    instanced: useInstancedAttributes,
  });

  createFloat32Attributes({
    geometry,
    propertyName: attr('rotation'),
    maxParticles,
    factory: 0,
    instanced: useInstancedAttributes,
  });

  const colorRandomRatio = Math.random();
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorR'),
    maxParticles,
    factory: () =>
      startColor.min!.r! +
      colorRandomRatio * (startColor.max!.r! - startColor.min!.r!),
    instanced: useInstancedAttributes,
  });
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorG'),
    maxParticles,
    factory: () =>
      startColor.min!.g! +
      colorRandomRatio * (startColor.max!.g! - startColor.min!.g!),
    instanced: useInstancedAttributes,
  });
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorB'),
    maxParticles,
    factory: () =>
      startColor.min!.b! +
      colorRandomRatio * (startColor.max!.b! - startColor.min!.b!),
    instanced: useInstancedAttributes,
  });
  createFloat32Attributes({
    geometry,
    propertyName: attr('colorA'),
    maxParticles,
    factory: 0,
    instanced: useInstancedAttributes,
  });

  // Packed quaternion vec4 attribute for 3D mesh rotation (only for MESH renderer)
  if (useMesh) {
    const quatArray = new Float32Array(maxParticles * 4);
    // Initialize to identity quaternion (0, 0, 0, 1)
    for (let i = 0; i < maxParticles; i++) {
      quatArray[i * 4 + 3] = 1; // w = 1
    }
    geometry.setAttribute(
      attr('quat'),
      new THREE.InstancedBufferAttribute(quatArray, 4)
    );
  }

  // Resolve per-particle attribute accessors (instanced/mesh uses prefixed names)
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
  const aQuat = useMesh ? a[attr('quat')] : undefined;

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

    // Reset trail history so a recycled particle doesn't inherit old trail
    if (generalData.positionHistoryCount) {
      generalData.positionHistoryCount[particleIndex] = 0;
      generalData.positionHistoryIndex![particleIndex] = 0;

      // Reset adaptive sampling last position
      if (generalData.trailLastSampledPosition) {
        const lsIdx = particleIndex * 3;
        generalData.trailLastSampledPosition[lsIdx] = 0;
        generalData.trailLastSampledPosition[lsIdx + 1] = 0;
        generalData.trailLastSampledPosition[lsIdx + 2] = 0;
      }

      // Reset twist prevention normal
      if (generalData.trailPrevNormal) {
        const nIdx = particleIndex * 3;
        generalData.trailPrevNormal[nIdx] = 0;
        generalData.trailPrevNormal[nIdx + 1] = 0;
        generalData.trailPrevNormal[nIdx + 2] = 0;
      }
    }

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

    // Initialize mesh particle quaternion from the Z-rotation startRotation
    if (aQuat) {
      const rotZ = aRotation.array[particleIndex];
      const halfZ = rotZ * 0.5;
      const qi = particleIndex * 4;
      aQuat.array[qi] = 0;
      aQuat.array[qi + 1] = 0;
      aQuat.array[qi + 2] = Math.sin(halfZ);
      aQuat.array[qi + 3] = Math.cos(halfZ);
      aQuat.needsUpdate = true;
    }

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
          renderer: {
            ...(subConfig.config.renderer ?? {}),
            ...(subConfig.config.renderer?.rendererType
              ? {}
              : renderer.rendererType === RendererType.MESH ||
                  renderer.rendererType === RendererType.TRAIL
                ? {}
                : { rendererType: renderer.rendererType }),
          } as typeof subConfig.config.renderer,
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

  // Trail mesh setup: ribbon geometry + material (created only for TRAIL mode)
  let trailMesh: THREE.Mesh | undefined;
  let trailGeometry: THREE.BufferGeometry | undefined;
  let trailPositionAttr: THREE.BufferAttribute | undefined;
  let trailAlphaAttr: THREE.BufferAttribute | undefined;
  let trailColorAttr: THREE.BufferAttribute | undefined;
  let trailIndexAttr: THREE.BufferAttribute | undefined;
  let trailWidthCurveFn: CurveFunction | undefined;
  let trailOpacityCurveFn: CurveFunction | undefined;
  let trailColorOverTrailFns:
    | { r: CurveFunction; g: CurveFunction; b: CurveFunction }
    | undefined;

  if (useTrail && trailConfig) {
    const trailLength = trailConfig.length;
    // Each particle contributes (trailLength) vertices (2 per segment joint: left+right)
    // Segments = trailLength - 1, so 2 * trailLength vertices per particle
    const verticesPerParticle = trailLength * 2;
    const totalVertices = maxParticles * verticesPerParticle;
    // Each segment (between 2 consecutive history points) = 2 triangles = 6 indices
    const indicesPerParticle = (trailLength - 1) * 6;
    const totalIndices = maxParticles * indicesPerParticle;

    trailGeometry = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(totalVertices * 3);
    const trailNextPositions = new Float32Array(totalVertices * 3);
    const trailAlphas = new Float32Array(totalVertices);
    const trailColors = new Float32Array(totalVertices * 4);
    const trailOffsets = new Float32Array(totalVertices);
    const trailHalfWidths = new Float32Array(totalVertices);
    const trailUVs = new Float32Array(totalVertices * 2);
    const trailIndices = new Uint32Array(totalIndices);

    // Pre-build index buffer and static offset attribute (-1/+1 per side)
    for (let p = 0; p < maxParticles; p++) {
      const vertBase = p * verticesPerParticle;
      const idxBase = p * indicesPerParticle;
      for (let s = 0; s < trailLength; s++) {
        trailOffsets[vertBase + s * 2] = -1.0; // left
        trailOffsets[vertBase + s * 2 + 1] = 1.0; // right
      }
      for (let s = 0; s < trailLength - 1; s++) {
        const i = idxBase + s * 6;
        const v = vertBase + s * 2;
        trailIndices[i] = v;
        trailIndices[i + 1] = v + 1;
        trailIndices[i + 2] = v + 2;
        trailIndices[i + 3] = v + 1;
        trailIndices[i + 4] = v + 3;
        trailIndices[i + 5] = v + 2;
      }
    }

    trailPositionAttr = new THREE.BufferAttribute(trailPositions, 3);
    trailPositionAttr.setUsage(THREE.DynamicDrawUsage);
    const trailNextAttr = new THREE.BufferAttribute(trailNextPositions, 3);
    trailNextAttr.setUsage(THREE.DynamicDrawUsage);
    trailAlphaAttr = new THREE.BufferAttribute(trailAlphas, 1);
    trailAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    trailColorAttr = new THREE.BufferAttribute(trailColors, 4);
    trailColorAttr.setUsage(THREE.DynamicDrawUsage);
    const trailHalfWidthAttr = new THREE.BufferAttribute(trailHalfWidths, 1);
    trailHalfWidthAttr.setUsage(THREE.DynamicDrawUsage);
    const trailUVAttr = new THREE.BufferAttribute(trailUVs, 2);
    trailUVAttr.setUsage(THREE.DynamicDrawUsage);
    trailIndexAttr = new THREE.BufferAttribute(trailIndices, 1);

    trailGeometry.setAttribute('position', trailPositionAttr);
    trailGeometry.setAttribute('trailNext', trailNextAttr);
    trailGeometry.setAttribute('trailAlpha', trailAlphaAttr);
    trailGeometry.setAttribute('trailColor', trailColorAttr);
    trailGeometry.setAttribute(
      'trailOffset',
      new THREE.BufferAttribute(trailOffsets, 1)
    );
    trailGeometry.setAttribute('trailHalfWidth', trailHalfWidthAttr);
    trailGeometry.setAttribute('trailUV', trailUVAttr);
    trailGeometry.setIndex(trailIndexAttr);

    const trailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: particleMap },
        useMap: { value: !!particleMap },
        discardBackgroundColor: { value: renderer.discardBackgroundColor },
        backgroundColor: { value: renderer.backgroundColor },
        backgroundColorTolerance: { value: renderer.backgroundColorTolerance },
        softParticlesEnabled: { value: softParticlesEnabled },
        softParticlesIntensity: {
          value: Math.max(renderer.softParticles?.intensity ?? 1.0, 0.001),
        },
        sceneDepthTexture: {
          value: renderer.softParticles?.depthTexture ?? null,
        },
        cameraNearFar: { value: new THREE.Vector2(0.1, 1000.0) },
      },
      vertexShader: TrailVertexShader,
      fragmentShader: TrailFragmentShader,
      transparent: renderer.transparent,
      blending: renderer.blending,
      depthTest: renderer.depthTest,
      depthWrite: renderer.depthWrite,
      side: THREE.DoubleSide,
    });

    trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
    trailMesh.frustumCulled = false;

    // Capture camera world position each frame for billboard trail ribbons
    const trailCameraPos = new THREE.Vector3();
    trailMesh.onBeforeRender = (
      _renderer: THREE.WebGLRenderer,
      _scene: THREE.Scene,
      camera: THREE.Camera
    ) => {
      camera.getWorldPosition(trailCameraPos);
      if (
        softParticlesEnabled &&
        (camera as THREE.PerspectiveCamera).isPerspectiveCamera
      ) {
        const perspCam = camera as THREE.PerspectiveCamera;
        const trailUniforms = (trailMaterial as THREE.ShaderMaterial).uniforms;
        (trailUniforms.cameraNearFar.value as THREE.Vector2).set(
          perspCam.near,
          perspCam.far
        );
      }
    };
    generalData.trailCameraPosition = trailCameraPos;

    // Pre-compute curve functions for trail width/opacity
    trailWidthCurveFn = getCurveFunctionFromConfig(
      generalData.particleSystemId,
      trailConfig.widthOverTrail
    );
    trailOpacityCurveFn = getCurveFunctionFromConfig(
      generalData.particleSystemId,
      trailConfig.opacityOverTrail
    );

    if (trailConfig.colorOverTrail?.isActive) {
      trailColorOverTrailFns = {
        r: getCurveFunctionFromConfig(
          generalData.particleSystemId,
          normalizeTrailCurve(trailConfig.colorOverTrail.r, defaultTrailCurve)
        ),
        g: getCurveFunctionFromConfig(
          generalData.particleSystemId,
          normalizeTrailCurve(trailConfig.colorOverTrail.g, defaultTrailCurve)
        ),
        b: getCurveFunctionFromConfig(
          generalData.particleSystemId,
          normalizeTrailCurve(trailConfig.colorOverTrail.b, defaultTrailCurve)
        ),
      };
    }
  }

  let particleSystem: THREE.Points | THREE.Mesh =
    useInstancing || useMesh
      ? new THREE.Mesh(geometry, material)
      : new THREE.Points(geometry, material);

  if (useInstancing || softParticlesEnabled) {
    particleSystem.onBeforeRender = (
      glRenderer: THREE.WebGLRenderer,
      _scene: THREE.Scene,
      camera: THREE.Camera
    ) => {
      if (useInstancing) {
        const size = glRenderer.getSize(new THREE.Vector2());
        sharedUniforms.viewportHeight.value =
          size.y * glRenderer.getPixelRatio();
      }
      if (
        softParticlesEnabled &&
        (camera as THREE.PerspectiveCamera).isPerspectiveCamera
      ) {
        const perspCam = camera as THREE.PerspectiveCamera;
        (sharedUniforms.cameraNearFar.value as THREE.Vector2).set(
          perspCam.near,
          perspCam.far
        );
      }
    };
  }

  // In trail mode, hide the particle points (but keep the parent visible so
  // the trail mesh child can render) and attach the visible trail mesh
  if (useTrail && trailMesh) {
    material.visible = false;
    particleSystem.add(trailMesh);
  }

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
    ...(useMesh ? { quat: aQuat } : {}),
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
    ...(useTrail
      ? {
          trailMesh,
          trailPositionAttr,
          trailAlphaAttr,
          trailColorAttr,
          trailWidthCurveFn,
          trailOpacityCurveFn,
          trailColorOverTrailFns,
          trailConfig: {
            length: trailConfig!.length,
            width: trailConfig!.width,
            minVertexDistance: trailConfig!.minVertexDistance,
            maxTime: trailConfig!.maxTime,
            smoothing: trailConfig!.smoothing,
            smoothingSubdivisions: trailConfig!.smoothingSubdivisions,
            twistPrevention: trailConfig!.twistPrevention,
            ribbonId: trailConfig!.ribbonId,
          },
        }
      : {}),
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

  // Trail geometry update: record position history and rebuild ribbon
  if (props.trailMesh) {
    updateTrailGeometry(props, now);
  }
};

/**
 * Evaluates a Catmull-Rom spline at parameter `t` (0..1) between points p1 and p2,
 * using p0 and p3 as control points. Writes result into `out`.
 */
const catmullRom = (
  out: Float32Array,
  outIdx: number,
  p0x: number,
  p0y: number,
  p0z: number,
  p1x: number,
  p1y: number,
  p1z: number,
  p2x: number,
  p2y: number,
  p2z: number,
  p3x: number,
  p3y: number,
  p3z: number,
  t: number
) => {
  const t2 = t * t;
  const t3 = t2 * t;
  out[outIdx] =
    0.5 *
    (2 * p1x +
      (-p0x + p2x) * t +
      (2 * p0x - 5 * p1x + 4 * p2x - p3x) * t2 +
      (-p0x + 3 * p1x - 3 * p2x + p3x) * t3);
  out[outIdx + 1] =
    0.5 *
    (2 * p1y +
      (-p0y + p2y) * t +
      (2 * p0y - 5 * p1y + 4 * p2y - p3y) * t2 +
      (-p0y + 3 * p1y - 3 * p2y + p3y) * t3);
  out[outIdx + 2] =
    0.5 *
    (2 * p1z +
      (-p0z + p2z) * t +
      (2 * p0z - 5 * p1z + 4 * p2z - p3z) * t2 +
      (-p0z + 3 * p1z - 3 * p2z + p3z) * t3);
};

/** Zeroes out a single trail vertex (both left+right sides). */
const clearTrailVertex = (
  vIdx: number,
  cIdx: number,
  aIdx: number,
  uvIdx: number,
  trailPosArr: Float32Array,
  trailNextArr: Float32Array,
  trailHalfWidthArr: Float32Array,
  trailUVArr: Float32Array,
  trailAlphaArr: Float32Array,
  trailColorArr: Float32Array,
  fallbackX: number,
  fallbackY: number,
  fallbackZ: number
) => {
  trailPosArr[vIdx] = fallbackX;
  trailPosArr[vIdx + 1] = fallbackY;
  trailPosArr[vIdx + 2] = fallbackZ;
  trailPosArr[vIdx + 3] = fallbackX;
  trailPosArr[vIdx + 4] = fallbackY;
  trailPosArr[vIdx + 5] = fallbackZ;
  trailNextArr[vIdx] = fallbackX;
  trailNextArr[vIdx + 1] = fallbackY;
  trailNextArr[vIdx + 2] = fallbackZ;
  trailNextArr[vIdx + 3] = fallbackX;
  trailNextArr[vIdx + 4] = fallbackY;
  trailNextArr[vIdx + 5] = fallbackZ;
  trailHalfWidthArr[aIdx] = 0;
  trailHalfWidthArr[aIdx + 1] = 0;
  trailUVArr[uvIdx] = 0;
  trailUVArr[uvIdx + 1] = 0;
  trailUVArr[uvIdx + 2] = 0;
  trailUVArr[uvIdx + 3] = 0;
  trailAlphaArr[aIdx] = 0;
  trailAlphaArr[aIdx + 1] = 0;
  trailColorArr[cIdx] = 0;
  trailColorArr[cIdx + 1] = 0;
  trailColorArr[cIdx + 2] = 0;
  trailColorArr[cIdx + 3] = 0;
  trailColorArr[cIdx + 4] = 0;
  trailColorArr[cIdx + 5] = 0;
  trailColorArr[cIdx + 6] = 0;
  trailColorArr[cIdx + 7] = 0;
};

/**
 * Writes a single trail ribbon vertex pair (left+right) into the typed arrays.
 */
const writeTrailVertex = (
  vIdx: number,
  cIdx: number,
  aIdx: number,
  uvIdx: number,
  hx: number,
  hy: number,
  hz: number,
  nx: number,
  ny: number,
  nz: number,
  halfWidth: number,
  t: number,
  alpha: number,
  fr: number,
  fg: number,
  fb: number,
  ca: number,
  trailPosArr: Float32Array,
  trailNextArr: Float32Array,
  trailHalfWidthArr: Float32Array,
  trailUVArr: Float32Array,
  trailAlphaArr: Float32Array,
  trailColorArr: Float32Array
) => {
  trailPosArr[vIdx] = hx;
  trailPosArr[vIdx + 1] = hy;
  trailPosArr[vIdx + 2] = hz;
  trailPosArr[vIdx + 3] = hx;
  trailPosArr[vIdx + 4] = hy;
  trailPosArr[vIdx + 5] = hz;
  trailNextArr[vIdx] = nx;
  trailNextArr[vIdx + 1] = ny;
  trailNextArr[vIdx + 2] = nz;
  trailNextArr[vIdx + 3] = nx;
  trailNextArr[vIdx + 4] = ny;
  trailNextArr[vIdx + 5] = nz;
  trailHalfWidthArr[aIdx] = halfWidth;
  trailHalfWidthArr[aIdx + 1] = halfWidth;
  trailUVArr[uvIdx] = 0;
  trailUVArr[uvIdx + 1] = t;
  trailUVArr[uvIdx + 2] = 1;
  trailUVArr[uvIdx + 3] = t;
  trailAlphaArr[aIdx] = alpha;
  trailAlphaArr[aIdx + 1] = alpha;
  trailColorArr[cIdx] = fr;
  trailColorArr[cIdx + 1] = fg;
  trailColorArr[cIdx + 2] = fb;
  trailColorArr[cIdx + 3] = ca;
  trailColorArr[cIdx + 4] = fr;
  trailColorArr[cIdx + 5] = fg;
  trailColorArr[cIdx + 6] = fb;
  trailColorArr[cIdx + 7] = ca;
};

// Scratch buffers reused each frame to avoid per-particle allocations
let _rawPoints: Float32Array | null = null;
let _rawPointsSize = 0;
let _smoothedPoints: Float32Array | null = null;
let _smoothedPointsSize = 0;
// Scratch buffer for connected ribbon particle indices (reused each frame)
let _ribbonIndices: Uint16Array | null = null;
let _ribbonIndicesSize = 0;
let _ribbonCount = 0;

/**
 * Records current particle positions into the history ring buffer,
 * then rebuilds the triangle-strip ribbon geometry for all active particles.
 *
 * Supports:
 * - Adaptive sampling (minVertexDistance): frame-rate independent trail density
 * - Max time (maxTime): time-based trail expiry
 * - Catmull-Rom smoothing: eliminates sharp kinks between samples
 * - Twist prevention: consistent ribbon orientation during rapid direction changes
 * - Connected ribbons (ribbonId): multiple particles forming a single ribbon
 */
const updateTrailGeometry = (props: ParticleSystemInstance, now: number) => {
  const {
    generalData,
    trailPositionAttr,
    trailAlphaAttr,
    trailColorAttr,
    trailWidthCurveFn,
    trailOpacityCurveFn,
    trailColorOverTrailFns,
    trailConfig,
    mappedAttributes: ma,
  } = props;

  if (
    !trailPositionAttr ||
    !trailAlphaAttr ||
    !trailColorAttr ||
    !trailWidthCurveFn ||
    !trailOpacityCurveFn ||
    !trailConfig ||
    !generalData.positionHistory ||
    !generalData.positionHistoryIndex ||
    !generalData.positionHistoryCount
  )
    return;

  const trailLength = trailConfig.length;
  const positionHistory = generalData.positionHistory;
  const historyIndex = generalData.positionHistoryIndex;
  const historyCount = generalData.positionHistoryCount;
  const sampleTimes = generalData.trailSampleTimes;
  const lastSampledPos = generalData.trailLastSampledPosition;
  const prevNormal = generalData.trailPrevNormal;
  const minVertexDist = trailConfig.minVertexDistance;
  const minVertexDistSq = minVertexDist * minVertexDist;
  const maxTime = trailConfig.maxTime;
  const maxTimeMs = maxTime * 1000;
  const useSmoothing = trailConfig.smoothing;
  const subdivisions = trailConfig.smoothingSubdivisions;
  const useTwistPrevention = trailConfig.twistPrevention;
  const ribbonId = trailConfig.ribbonId;

  const isActiveArr = ma.isActive.array;
  const positionArr = ma.position.array;
  const colorRArr = ma.colorR.array;
  const colorGArr = ma.colorG.array;
  const colorBArr = ma.colorB.array;
  const colorAArr = ma.colorA.array;

  const trailPosArr = trailPositionAttr.array as Float32Array;
  const trailAlphaArr = trailAlphaAttr.array as Float32Array;
  const trailColorArr = trailColorAttr.array as Float32Array;
  const trailMesh = props.trailMesh!;
  const trailNextArr = (
    trailMesh.geometry.getAttribute('trailNext') as THREE.BufferAttribute
  ).array as Float32Array;
  const trailUVArr = (
    trailMesh.geometry.getAttribute('trailUV') as THREE.BufferAttribute
  ).array as Float32Array;
  const trailHalfWidthArr = (
    trailMesh.geometry.getAttribute('trailHalfWidth') as THREE.BufferAttribute
  ).array as Float32Array;
  const verticesPerParticle = trailLength * 2;
  const creationTimesLength = generalData.creationTimes.length;
  let hasUpdates = false;

  // --- Connected Ribbons: collect particles sharing the same ribbonId ---
  const useRibbon = ribbonId !== undefined;
  let ribbonLeader = -1;
  if (useRibbon) {
    // Pre-allocate scratch buffer for ribbon indices
    if (!_ribbonIndices || _ribbonIndicesSize < creationTimesLength) {
      _ribbonIndices = new Uint16Array(creationTimesLength);
      _ribbonIndicesSize = creationTimesLength;
    }
    _ribbonCount = 0;
    for (let i = 0; i < creationTimesLength; i++) {
      if (isActiveArr[i]) _ribbonIndices[_ribbonCount++] = i;
    }
    // Insertion sort by creation time (typically nearly-sorted, O(n) best case)
    for (let i = 1; i < _ribbonCount; i++) {
      const key = _ribbonIndices[i];
      const keyTime = generalData.creationTimes[key];
      let j = i - 1;
      while (j >= 0 && generalData.creationTimes[_ribbonIndices[j]] > keyTime) {
        _ribbonIndices[j + 1] = _ribbonIndices[j];
        j--;
      }
      _ribbonIndices[j + 1] = key;
    }
    if (_ribbonCount > 0) ribbonLeader = _ribbonIndices[0];
  }

  for (let index = 0; index < creationTimesLength; index++) {
    const vertBase = index * verticesPerParticle;

    if (isActiveArr[index]) {
      // Skip individual trail build for non-leader ribbon particles
      // (the leader's trail will be built by the connected ribbon section)
      if (useRibbon && _ribbonCount >= 2 && index !== ribbonLeader) {
        // Still record position history for this particle (needed for sampling)
        const posIdx = index * 3;
        const px = positionArr[posIdx];
        const py = positionArr[posIdx + 1];
        const pz = positionArr[posIdx + 2];
        const histBase = (index * trailLength + historyIndex[index]) * 3;
        positionHistory[histBase] = px;
        positionHistory[histBase + 1] = py;
        positionHistory[histBase + 2] = pz;
        if (sampleTimes) {
          sampleTimes[index * trailLength + historyIndex[index]] = now;
        }
        historyIndex[index] = (historyIndex[index] + 1) % trailLength;
        if (historyCount[index] < trailLength) historyCount[index]++;
        continue;
      }
      hasUpdates = true;
      const posIdx = index * 3;
      const px = positionArr[posIdx];
      const py = positionArr[posIdx + 1];
      const pz = positionArr[posIdx + 2];

      // --- Adaptive Sampling: only push a new sample if distance threshold met ---
      let shouldSample = true;
      if (minVertexDist > 0 && lastSampledPos && historyCount[index] > 0) {
        const lsIdx = index * 3;
        const dx = px - lastSampledPos[lsIdx];
        const dy = py - lastSampledPos[lsIdx + 1];
        const dz = pz - lastSampledPos[lsIdx + 2];
        if (dx * dx + dy * dy + dz * dz < minVertexDistSq) {
          shouldSample = false;
        }
      }

      if (shouldSample) {
        // Record the sample
        const histBase = (index * trailLength + historyIndex[index]) * 3;
        positionHistory[histBase] = px;
        positionHistory[histBase + 1] = py;
        positionHistory[histBase + 2] = pz;

        // Record timestamp for maxTime
        if (sampleTimes) {
          sampleTimes[index * trailLength + historyIndex[index]] = now;
        }

        historyIndex[index] = (historyIndex[index] + 1) % trailLength;
        if (historyCount[index] < trailLength) historyCount[index]++;

        // Update last sampled position
        if (lastSampledPos) {
          const lsIdx = index * 3;
          lastSampledPos[lsIdx] = px;
          lastSampledPos[lsIdx + 1] = py;
          lastSampledPos[lsIdx + 2] = pz;
        }
      }

      // --- MaxTime: determine effective count (expire old segments) ---
      let rawCount = historyCount[index];
      let effectiveCount = rawCount;
      if (maxTime > 0 && sampleTimes && rawCount > 0) {
        const sampleBase = index * trailLength;
        effectiveCount = 0;
        for (let s = 0; s < rawCount; s++) {
          const sampleSlot =
            (historyIndex[index] - 1 - s + trailLength * 2) % trailLength;
          const age = now - sampleTimes[sampleBase + sampleSlot];
          if (age <= maxTimeMs) {
            effectiveCount++;
          } else {
            break; // older samples are even older, stop
          }
        }
      }

      const count = effectiveCount;
      const ribbonWidth = trailConfig.width;

      // Get particle color
      const cr = colorRArr[index];
      const cg = colorGArr[index];
      const cb = colorBArr[index];
      const ca = colorAArr[index];

      const ringOff = index * trailLength * 3;

      // --- Collect raw history points for this particle ---
      // We need them for both smoothing and the ribbon build.
      // rawPts: flat array of [x, y, z, x, y, z, ...] for count entries
      // rawPts[0..2] = head (most recent), rawPts[(count-1)*3..(count-1)*3+2] = tail
      const rawPtsSize = count * 3;
      // Reuse a scratch float array for raw points
      if (!_rawPoints || _rawPointsSize < rawPtsSize) {
        _rawPoints = new Float32Array(rawPtsSize);
        _rawPointsSize = rawPtsSize;
      }
      const rawPts = _rawPoints;
      for (let s = 0; s < count; s++) {
        const histSlot =
          ((historyIndex[index] - 1 - s + trailLength * 2) % trailLength) * 3 +
          ringOff;
        rawPts[s * 3] = positionHistory[histSlot];
        rawPts[s * 3 + 1] = positionHistory[histSlot + 1];
        rawPts[s * 3 + 2] = positionHistory[histSlot + 2];
      }

      // --- Catmull-Rom Smoothing ---
      let finalPts: Float32Array;
      let finalCount: number;

      if (useSmoothing && count >= 3) {
        // Interpolate between each pair of raw points with subdivisions
        const segmentCount = count - 1;
        finalCount = segmentCount * subdivisions + 1;
        const neededSize = finalCount * 3;

        // Resize global scratch buffer if needed
        if (!_smoothedPoints || _smoothedPointsSize < neededSize) {
          _smoothedPoints = new Float32Array(neededSize);
          _smoothedPointsSize = neededSize;
        }
        finalPts = _smoothedPoints;

        for (let seg = 0; seg < segmentCount; seg++) {
          // Control points: p0, p1, p2, p3
          const i0 = Math.max(0, seg - 1);
          const i1 = seg;
          const i2 = Math.min(count - 1, seg + 1);
          const i3 = Math.min(count - 1, seg + 2);

          const p0x = rawPts[i0 * 3],
            p0y = rawPts[i0 * 3 + 1],
            p0z = rawPts[i0 * 3 + 2];
          const p1x = rawPts[i1 * 3],
            p1y = rawPts[i1 * 3 + 1],
            p1z = rawPts[i1 * 3 + 2];
          const p2x = rawPts[i2 * 3],
            p2y = rawPts[i2 * 3 + 1],
            p2z = rawPts[i2 * 3 + 2];
          const p3x = rawPts[i3 * 3],
            p3y = rawPts[i3 * 3 + 1],
            p3z = rawPts[i3 * 3 + 2];

          for (let sub = 0; sub < subdivisions; sub++) {
            const t = sub / subdivisions;
            const outIdx = (seg * subdivisions + sub) * 3;
            catmullRom(
              finalPts,
              outIdx,
              p0x,
              p0y,
              p0z,
              p1x,
              p1y,
              p1z,
              p2x,
              p2y,
              p2z,
              p3x,
              p3y,
              p3z,
              t
            );
          }
        }
        // Last point = last raw point
        const lastOutIdx = (finalCount - 1) * 3;
        finalPts[lastOutIdx] = rawPts[(count - 1) * 3];
        finalPts[lastOutIdx + 1] = rawPts[(count - 1) * 3 + 1];
        finalPts[lastOutIdx + 2] = rawPts[(count - 1) * 3 + 2];
      } else {
        finalPts = rawPts;
        finalCount = count;
      }

      // Limit final count to the number of slots we can fill
      if (finalCount > trailLength) finalCount = trailLength;

      // Collapse degenerate segments: when two consecutive smoothed points are
      // nearly identical the shader tangent becomes zero, producing distorted
      // "squished" ribbon quads. Shift such points to the next distinct neighbor.
      if (useSmoothing && finalCount >= 2) {
        const MIN_SEG_DIST_SQ = 0.0001 * 0.0001;
        for (let d = 1; d < finalCount; d++) {
          const pi = (d - 1) * 3;
          const ci = d * 3;
          const dx = finalPts[ci] - finalPts[pi];
          const dy = finalPts[ci + 1] - finalPts[pi + 1];
          const dz = finalPts[ci + 2] - finalPts[pi + 2];
          if (dx * dx + dy * dy + dz * dz < MIN_SEG_DIST_SQ) {
            // Snap to previous point — the shader will get a near-zero tangent
            // but the vertex pair collapses to the same position, hiding it
            finalPts[ci] = finalPts[pi];
            finalPts[ci + 1] = finalPts[pi + 1];
            finalPts[ci + 2] = finalPts[pi + 2];
          }
        }
      }

      // --- Build ribbon vertices ---
      for (let s = 0; s < trailLength; s++) {
        const vIdx = (vertBase + s * 2) * 3;
        const cIdx = (vertBase + s * 2) * 4;
        const aIdx = vertBase + s * 2;
        const uvIdxBase = (vertBase + s * 2) * 2;

        if (s >= finalCount) {
          clearTrailVertex(
            vIdx,
            cIdx,
            aIdx,
            uvIdxBase,
            trailPosArr,
            trailNextArr,
            trailHalfWidthArr,
            trailUVArr,
            trailAlphaArr,
            trailColorArr,
            px,
            py,
            pz
          );
          continue;
        }

        const hx = finalPts[s * 3];
        const hy = finalPts[s * 3 + 1];
        const hz = finalPts[s * 3 + 2];

        // Compute an averaged tangent direction for the shader.
        // At interior points we average the forward and backward segment
        // directions so the billboard plane transitions smoothly through
        // bends instead of snapping per-segment.
        let nx: number, ny: number, nz: number;
        if (s > 0 && s < finalCount - 1) {
          // Interior: average of (prev→current) and (current→next)
          const px2 = finalPts[(s - 1) * 3];
          const py2 = finalPts[(s - 1) * 3 + 1];
          const pz2 = finalPts[(s - 1) * 3 + 2];
          const nx2 = finalPts[(s + 1) * 3];
          const ny2 = finalPts[(s + 1) * 3 + 1];
          const nz2 = finalPts[(s + 1) * 3 + 2];
          // Averaged tangent = (current - prev) + (next - current) = next - prev
          const atx = nx2 - px2;
          const aty = ny2 - py2;
          const atz = nz2 - pz2;
          const atLen = Math.sqrt(atx * atx + aty * aty + atz * atz);
          if (atLen > 0.0001) {
            // trailNext = current + normalized averaged tangent (shader computes tangent as trailNext - position)
            nx = hx + atx / atLen;
            ny = hy + aty / atLen;
            nz = hz + atz / atLen;
          } else {
            nx = finalPts[(s + 1) * 3];
            ny = finalPts[(s + 1) * 3 + 1];
            nz = finalPts[(s + 1) * 3 + 2];
          }
        } else if (s < finalCount - 1) {
          // Head: use forward direction
          nx = finalPts[(s + 1) * 3];
          ny = finalPts[(s + 1) * 3 + 1];
          nz = finalPts[(s + 1) * 3 + 2];
        } else {
          // Tail: nudge to avoid zero tangent
          nx = hx;
          ny = hy + 0.001;
          nz = hz;
        }

        // Trail percentage (0=head, 1=tail)
        const t = finalCount > 1 ? s / (finalCount - 1) : 0;

        // --- MaxTime: apply additional age-based fade ---
        let timeFade = 1.0;
        if (maxTime > 0 && sampleTimes && effectiveCount > 0) {
          // Map the current vertex index back to the nearest raw sample
          // for time lookup. When smoothing is active, multiple smoothed
          // vertices may correspond to one raw segment.
          const rawS = useSmoothing
            ? Math.min(
                Math.floor((s / Math.max(finalCount - 1, 1)) * (rawCount - 1)),
                rawCount - 1
              )
            : Math.min(s, rawCount - 1);
          const sampleSlot =
            (historyIndex[index] - 1 - rawS + trailLength * 2) % trailLength;
          const sampleBase = index * trailLength;
          const age = now - sampleTimes[sampleBase + sampleSlot];
          timeFade = 1.0 - Math.min(age / maxTimeMs, 1.0);
        }

        const widthScale = trailWidthCurveFn(t);
        const opacityScale = trailOpacityCurveFn(t);
        const halfWidth = ribbonWidth * widthScale * 0.5;
        const alpha = ca * opacityScale * timeFade;

        const fr = trailColorOverTrailFns
          ? cr * trailColorOverTrailFns.r(t)
          : cr;
        const fg = trailColorOverTrailFns
          ? cg * trailColorOverTrailFns.g(t)
          : cg;
        const fb = trailColorOverTrailFns
          ? cb * trailColorOverTrailFns.b(t)
          : cb;

        writeTrailVertex(
          vIdx,
          cIdx,
          aIdx,
          uvIdxBase,
          hx,
          hy,
          hz,
          nx,
          ny,
          nz,
          halfWidth,
          t,
          alpha,
          fr,
          fg,
          fb,
          ca,
          trailPosArr,
          trailNextArr,
          trailHalfWidthArr,
          trailUVArr,
          trailAlphaArr,
          trailColorArr
        );
      }

      // --- Twist Prevention ---
      // After building the ribbon, ensure ribbon normals are consistent.
      // We compare the implied normal direction of consecutive segments and
      // flip if the dot product with the previous frame's normal is negative.
      if (useTwistPrevention && prevNormal && finalCount >= 2) {
        const nIdx = index * 3;
        // Compute current head tangent
        const tx = finalPts[3] - finalPts[0];
        const ty = finalPts[4] - finalPts[1];
        const tz = finalPts[5] - finalPts[2];
        const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (tLen > 0.0001) {
          const ntx = tx / tLen;
          const nty = ty / tLen;
          const ntz = tz / tLen;
          // Use a consistent up vector to compute a reference normal
          let upx = 0,
            upy = 1,
            upz = 0;
          const dot = ntx * upx + nty * upy + ntz * upz;
          if (Math.abs(dot) > 0.999) {
            upx = 1;
            upy = 0;
            upz = 0;
          }
          // cross(tangent, up) = normal
          let cnx = nty * upz - ntz * upy;
          let cny = ntz * upx - ntx * upz;
          let cnz = ntx * upy - nty * upx;
          const cnLen = Math.sqrt(cnx * cnx + cny * cny + cnz * cnz);
          if (cnLen > 0.0001) {
            cnx /= cnLen;
            cny /= cnLen;
            cnz /= cnLen;
          }

          // Check dot product with previous normal — if negative, flip
          const prevNx = prevNormal[nIdx];
          const prevNy = prevNormal[nIdx + 1];
          const prevNz = prevNormal[nIdx + 2];
          const hasPrev = prevNx !== 0 || prevNy !== 0 || prevNz !== 0;
          if (hasPrev) {
            const normalDot = cnx * prevNx + cny * prevNy + cnz * prevNz;
            if (normalDot < 0) {
              // Flip all ribbon offsets for this particle by swapping left/right half-widths
              for (let s = 0; s < Math.min(finalCount, trailLength); s++) {
                const aIdx = vertBase + s * 2;
                const hw = trailHalfWidthArr[aIdx];
                trailHalfWidthArr[aIdx] = -hw;
                trailHalfWidthArr[aIdx + 1] = -hw;
              }
              // Also flip the stored normal for next frame
              cnx = -cnx;
              cny = -cny;
              cnz = -cnz;
            }
          }

          // Store current normal for next frame
          prevNormal[nIdx] = cnx;
          prevNormal[nIdx + 1] = cny;
          prevNormal[nIdx + 2] = cnz;
        }
      }
    } else if (historyCount[index] > 0) {
      // Particle just became inactive — collapse ribbon and clear history once
      hasUpdates = true;
      historyCount[index] = 0;
      historyIndex[index] = 0;
      for (let s = 0; s < trailLength; s++) {
        const vIdx = (vertBase + s * 2) * 3;
        const cIdx = (vertBase + s * 2) * 4;
        const aIdx = vertBase + s * 2;
        const uvIdxBase = (vertBase + s * 2) * 2;
        clearTrailVertex(
          vIdx,
          cIdx,
          aIdx,
          uvIdxBase,
          trailPosArr,
          trailNextArr,
          trailHalfWidthArr,
          trailUVArr,
          trailAlphaArr,
          trailColorArr,
          0,
          0,
          0
        );
      }
    }
  }

  // --- Connected Ribbons: chain particle positions with Catmull-Rom interpolation ---
  if (useRibbon && _ribbonCount >= 2 && _ribbonIndices) {
    hasUpdates = true;
    const leader = _ribbonIndices[0];
    const leaderVertBase = leader * verticesPerParticle;

    // The ribbon uses each particle's current position as a control point,
    // then fills `trailLength` vertices by Catmull-Rom interpolation between them.
    // This produces a smooth, continuous ribbon through all particle positions.
    const controlCount = _ribbonCount;
    const filledCount = Math.min(
      trailLength,
      Math.max(controlCount * 4, controlCount)
    );
    const chainSize = filledCount * 3;
    if (!_rawPoints || _rawPointsSize < chainSize) {
      _rawPoints = new Float32Array(chainSize);
      _rawPointsSize = chainSize;
    }

    if (controlCount === 2) {
      // Only 2 particles: linearly interpolate between them
      const p0Idx = _ribbonIndices[0] * 3;
      const p1Idx = _ribbonIndices[1] * 3;
      for (let i = 0; i < filledCount; i++) {
        const t = i / (filledCount - 1);
        _rawPoints[i * 3] =
          positionArr[p0Idx] + t * (positionArr[p1Idx] - positionArr[p0Idx]);
        _rawPoints[i * 3 + 1] =
          positionArr[p0Idx + 1] +
          t * (positionArr[p1Idx + 1] - positionArr[p0Idx + 1]);
        _rawPoints[i * 3 + 2] =
          positionArr[p0Idx + 2] +
          t * (positionArr[p1Idx + 2] - positionArr[p0Idx + 2]);
      }
    } else {
      // 3+ particles: Catmull-Rom interpolation through all control points
      const segments = controlCount - 1;
      const ptsPerSeg = Math.max(1, Math.floor((filledCount - 1) / segments));
      let wi = 0;
      for (let seg = 0; seg < segments && wi < filledCount; seg++) {
        const i0 = Math.max(0, seg - 1);
        const i1 = seg;
        const i2 = Math.min(controlCount - 1, seg + 1);
        const i3 = Math.min(controlCount - 1, seg + 2);
        const p0i = _ribbonIndices[i0] * 3;
        const p1i = _ribbonIndices[i1] * 3;
        const p2i = _ribbonIndices[i2] * 3;
        const p3i = _ribbonIndices[i3] * 3;
        const subCount = seg === segments - 1 ? filledCount - wi : ptsPerSeg;
        for (let sub = 0; sub < subCount && wi < filledCount; sub++) {
          const t = sub / subCount;
          catmullRom(
            _rawPoints,
            wi * 3,
            positionArr[p0i],
            positionArr[p0i + 1],
            positionArr[p0i + 2],
            positionArr[p1i],
            positionArr[p1i + 1],
            positionArr[p1i + 2],
            positionArr[p2i],
            positionArr[p2i + 1],
            positionArr[p2i + 2],
            positionArr[p3i],
            positionArr[p3i + 1],
            positionArr[p3i + 2],
            t
          );
          wi++;
        }
      }
      // Ensure last point is the last particle's position
      if (wi > 0) {
        const lastPIdx = _ribbonIndices[controlCount - 1] * 3;
        _rawPoints[(wi - 1) * 3] = positionArr[lastPIdx];
        _rawPoints[(wi - 1) * 3 + 1] = positionArr[lastPIdx + 1];
        _rawPoints[(wi - 1) * 3 + 2] = positionArr[lastPIdx + 2];
      }
    }

    const leaderCr = colorRArr[leader];
    const leaderCg = colorGArr[leader];
    const leaderCb = colorBArr[leader];
    const leaderCa = colorAArr[leader];

    for (let s = 0; s < trailLength; s++) {
      const vIdx = (leaderVertBase + s * 2) * 3;
      const cIdx = (leaderVertBase + s * 2) * 4;
      const aIdx = leaderVertBase + s * 2;
      const uvIdxBase = (leaderVertBase + s * 2) * 2;

      if (s >= filledCount) {
        clearTrailVertex(
          vIdx,
          cIdx,
          aIdx,
          uvIdxBase,
          trailPosArr,
          trailNextArr,
          trailHalfWidthArr,
          trailUVArr,
          trailAlphaArr,
          trailColorArr,
          0,
          0,
          0
        );
        continue;
      }

      const ptIdx = s * 3;
      const ptx = _rawPoints[ptIdx];
      const pty = _rawPoints[ptIdx + 1];
      const ptz = _rawPoints[ptIdx + 2];

      // Averaged tangent for interior points
      let nx: number, ny: number, nz: number;
      if (s > 0 && s < filledCount - 1) {
        const px2 = _rawPoints[(s - 1) * 3];
        const py2 = _rawPoints[(s - 1) * 3 + 1];
        const pz2 = _rawPoints[(s - 1) * 3 + 2];
        const nx2 = _rawPoints[(s + 1) * 3];
        const ny2 = _rawPoints[(s + 1) * 3 + 1];
        const nz2 = _rawPoints[(s + 1) * 3 + 2];
        const atx = nx2 - px2;
        const aty = ny2 - py2;
        const atz = nz2 - pz2;
        const atLen = Math.sqrt(atx * atx + aty * aty + atz * atz);
        if (atLen > 0.0001) {
          nx = ptx + atx / atLen;
          ny = pty + aty / atLen;
          nz = ptz + atz / atLen;
        } else {
          nx = _rawPoints[(s + 1) * 3];
          ny = _rawPoints[(s + 1) * 3 + 1];
          nz = _rawPoints[(s + 1) * 3 + 2];
        }
      } else if (s < filledCount - 1) {
        nx = _rawPoints[(s + 1) * 3];
        ny = _rawPoints[(s + 1) * 3 + 1];
        nz = _rawPoints[(s + 1) * 3 + 2];
      } else {
        nx = ptx;
        ny = pty + 0.001;
        nz = ptz;
      }

      const t = filledCount > 1 ? s / (filledCount - 1) : 0;
      const widthScale = trailWidthCurveFn(t);
      const opacityScale = trailOpacityCurveFn(t);
      const halfWidth = trailConfig.width * widthScale * 0.5;
      const alpha = leaderCa * opacityScale;
      const fr = trailColorOverTrailFns
        ? leaderCr * trailColorOverTrailFns.r(t)
        : leaderCr;
      const fg = trailColorOverTrailFns
        ? leaderCg * trailColorOverTrailFns.g(t)
        : leaderCg;
      const fb = trailColorOverTrailFns
        ? leaderCb * trailColorOverTrailFns.b(t)
        : leaderCb;

      writeTrailVertex(
        vIdx,
        cIdx,
        aIdx,
        uvIdxBase,
        ptx,
        pty,
        ptz,
        nx,
        ny,
        nz,
        halfWidth,
        t,
        alpha,
        fr,
        fg,
        fb,
        leaderCa,
        trailPosArr,
        trailNextArr,
        trailHalfWidthArr,
        trailUVArr,
        trailAlphaArr,
        trailColorArr
      );
    }

    // Clear non-leader ribbon particles' trail vertices
    for (let ri = 1; ri < _ribbonCount; ri++) {
      const pIdx = _ribbonIndices[ri];
      const pVertBase = pIdx * verticesPerParticle;
      for (let s = 0; s < trailLength; s++) {
        const vIdx = (pVertBase + s * 2) * 3;
        const cIdx = (pVertBase + s * 2) * 4;
        const aIdx = pVertBase + s * 2;
        const uvIdxBase = (pVertBase + s * 2) * 2;
        clearTrailVertex(
          vIdx,
          cIdx,
          aIdx,
          uvIdxBase,
          trailPosArr,
          trailNextArr,
          trailHalfWidthArr,
          trailUVArr,
          trailAlphaArr,
          trailColorArr,
          0,
          0,
          0
        );
      }
    }
  }

  if (hasUpdates) {
    trailPositionAttr.needsUpdate = true;
    trailAlphaAttr.needsUpdate = true;
    trailColorAttr.needsUpdate = true;
    const nextAttr = trailMesh.geometry.getAttribute(
      'trailNext'
    ) as THREE.BufferAttribute;
    const hwAttr = trailMesh.geometry.getAttribute(
      'trailHalfWidth'
    ) as THREE.BufferAttribute;
    nextAttr.needsUpdate = true;
    hwAttr.needsUpdate = true;
    const uvAttr = trailMesh.geometry.getAttribute(
      'trailUV'
    ) as THREE.BufferAttribute;
    uvAttr.needsUpdate = true;
  }
};

export const updateParticleSystems = (cycleData: CycleData) => {
  createdParticleSystems.forEach((props) =>
    updateParticleSystemInstance(props, cycleData)
  );
};
