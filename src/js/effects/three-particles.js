import * as THREE from "three";

import {
  calculateRandomPositionAndVelocityOnBox,
  calculateRandomPositionAndVelocityOnCircle,
  calculateRandomPositionAndVelocityOnCone,
  calculateRandomPositionAndVelocityOnRectangle,
  calculateRandomPositionAndVelocityOnSphere,
} from "./three-particles/three-particles-utils.js";

import { CurveFunction } from "./three-particles/three-particles-curves.js";
import { FBM } from "three-noise/build/three-noise.module.js";
import { Gyroscope } from "three/examples/jsm/misc/Gyroscope";
import ParticleSystemFragmentShader from "./three-particles/shaders/particle-system-fragment-shader.glsl.js";
import ParticleSystemVertexShader from "./three-particles/shaders/particle-system-vertex-shader.glsl.js";
import { applyModifiers } from "./three-particles/three-particles-modifiers.js";
import { createBezierCurveFunction } from "./three-particles/three-particles-bezier";
import { patchObject } from "@newkrok/three-utils/src/js/newkrok/three-utils/object-utils.js";

let createdParticleSystems = [];

export const SimulationSpace = {
  LOCAL: "LOCAL",
  WORLD: "WORLD",
};

export const Shape = {
  SPHERE: "SPHERE",
  CONE: "CONE",
  BOX: "BOX",
  CIRCLE: "CIRCLE",
  RECTANGLE: "RECTANGLE",
};

export const EmitFrom = {
  VOLUME: "VOLUME",
  SHELL: "SHELL",
  EDGE: "EDGE",
};

export const TimeMode = {
  LIFETIME: "LIFETIME",
  FPS: "FPS",
};

export const blendingMap = {
  "THREE.NoBlending": THREE.NoBlending,
  "THREE.NormalBlending": THREE.NormalBlending,
  "THREE.AdditiveBlending": THREE.AdditiveBlending,
  "THREE.SubtractiveBlending": THREE.SubtractiveBlending,
  "THREE.MultiplyBlending": THREE.MultiplyBlending,
};

export const getDefaultParticleSystemConfig = () =>
  JSON.parse(JSON.stringify(DEFAULT_PARTICLE_SYSTEM_CONFIG));

const DEFAULT_PARTICLE_SYSTEM_CONFIG = {
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  duration: 5.0,
  looping: true,
  startDelay: { min: 0.0, max: 0.0 },
  startLifetime: { min: 2.0, max: 2.0 },
  startSpeed: { min: 1.0, max: 1.0 },
  startSize: { min: 1.0, max: 1.0 },
  startRotation: { min: 0.0, max: 0.0 },
  startColor: {
    min: { r: 1.0, g: 1.0, b: 1.0 },
    max: { r: 1.0, g: 1.0, b: 1.0 },
  },
  startOpacity: { min: 1.0, max: 1.0 },
  gravity: 0.0,
  simulationSpace: SimulationSpace.LOCAL,
  maxParticles: 100.0,
  emission: {
    rateOverTime: 10.0,
    rateOverDistance: 0.0,
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
  map: null,
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
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
      z: { min: 0, max: 0 },
    },
    orbital: {
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
      z: { min: 0, max: 0 },
    },
  },
  sizeOverLifetime: {
    isActive: false,
    curveFunction: CurveFunction.BEZIER,
    bezierPoints: [
      { x: 0, y: 0, percentage: 0 },
      { x: 1, y: 1, percentage: 1 },
    ],
  },
  /* colorOverLifetime: {
    isActive: false,
    curveFunction: CurveFunction.LINEAR,
  }, */
  opacityOverLifetime: {
    isActive: false,
    curveFunction: CurveFunction.BEZIER,
    bezierPoints: [
      { x: 0, y: 0, percentage: 0 },
      { x: 1, y: 1, percentage: 1 },
    ],
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
    fps: 10.0,
    startFrame: { min: 0.0, max: 0.0 },
  },
};

const createFloat32Attributes = ({
  geometry,
  propertyName,
  maxParticles,
  factory,
}) => {
  geometry.setAttribute(
    propertyName,
    new THREE.BufferAttribute(
      new Float32Array(
        Array.from(
          { length: maxParticles },
          typeof factory === "function" ? factory : () => factory
        )
      ),
      1
    )
  );
};

const calculatePositionAndVelocity = (
  { shape, sphere, cone, circle, rectangle, box },
  startSpeed,
  position,
  quaternion,
  velocity,
  velocityOverLifetime
) => {
  switch (shape) {
    case Shape.SPHERE:
      calculateRandomPositionAndVelocityOnSphere(
        position,
        quaternion,
        velocity,
        startSpeed,
        sphere
      );
      break;

    case Shape.CONE:
      calculateRandomPositionAndVelocityOnCone(
        position,
        quaternion,
        velocity,
        startSpeed,
        cone
      );
      break;

    case Shape.CIRCLE:
      calculateRandomPositionAndVelocityOnCircle(
        position,
        quaternion,
        velocity,
        startSpeed,
        circle
      );
      break;

    case Shape.RECTANGLE:
      calculateRandomPositionAndVelocityOnRectangle(
        position,
        quaternion,
        velocity,
        startSpeed,
        rectangle
      );
      break;

    case Shape.BOX:
      calculateRandomPositionAndVelocityOnBox(
        position,
        quaternion,
        velocity,
        startSpeed,
        box
      );
      break;
  }

  if (velocityOverLifetime.isActive) {
    if (
      velocityOverLifetime.linear.x.min !== 0 ||
      velocityOverLifetime.linear.x.max !== 0
    ) {
      velocity.x += THREE.MathUtils.randFloat(
        velocityOverLifetime.linear.x.min,
        velocityOverLifetime.linear.x.max
      );
    }
    if (
      velocityOverLifetime.linear.y.min !== 0 ||
      velocityOverLifetime.linear.y.max !== 0
    ) {
      velocity.y += THREE.MathUtils.randFloat(
        velocityOverLifetime.linear.y.min,
        velocityOverLifetime.linear.y.max
      );
    }
    if (
      velocityOverLifetime.linear.z.min !== 0 ||
      velocityOverLifetime.linear.z.max !== 0
    ) {
      velocity.z += THREE.MathUtils.randFloat(
        velocityOverLifetime.linear.z.min,
        velocityOverLifetime.linear.z.max
      );
    }
  }
};

export const createParticleSystem = (
  config = DEFAULT_PARTICLE_SYSTEM_CONFIG
) => {
  const now = Date.now();
  const generalData = {
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
    hasOrbitalVelocity: false,
    orbitalVelocityData: [],
    lifetimeValues: {},
    creationTimes: [],
    noise: null,
  };

  const normalizedConfig = patchObject(DEFAULT_PARTICLE_SYSTEM_CONFIG, config);

  const bezierCompatibleProperties = [
    "sizeOverLifetime",
    "opacityOverLifetime",
  ];
  bezierCompatibleProperties.forEach((key) => {
    if (
      normalizedConfig[key].isActive &&
      normalizedConfig[key].curveFunction === CurveFunction.BEZIER &&
      normalizedConfig[key].bezierPoints
    )
      normalizedConfig[key].curveFunction = createBezierCurveFunction(
        normalizedConfig[key].bezierPoints
      );
  });

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
    map,
    renderer,
    noise,
    velocityOverLifetime,
    onUpdate,
    onComplete,
    textureSheetAnimation,
  } = normalizedConfig;

  if (typeof renderer.blending === "string")
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
  generalData.hasOrbitalVelocity =
    normalizedConfig.velocityOverLifetime.isActive &&
    (normalizedConfig.velocityOverLifetime.orbital.x.min !== 0 ||
      normalizedConfig.velocityOverLifetime.orbital.x.max !== 0 ||
      normalizedConfig.velocityOverLifetime.orbital.y.min !== 0 ||
      normalizedConfig.velocityOverLifetime.orbital.y.max !== 0 ||
      normalizedConfig.velocityOverLifetime.orbital.z.min !== 0 ||
      normalizedConfig.velocityOverLifetime.orbital.z.max !== 0);

  if (generalData.hasOrbitalVelocity) {
    generalData.orbitalVelocityData = Array.from(
      { length: maxParticles },
      () => ({
        speed: new THREE.Vector3(),
        positionOffset: new THREE.Vector3(),
      })
    );
  }

  const startValueKeys = ["startSize", "startOpacity"];
  startValueKeys.forEach((key) => {
    generalData.startValues[key] = Array.from({ length: maxParticles }, () =>
      THREE.MathUtils.randFloat(
        normalizedConfig[key].min,
        normalizedConfig[key].max
      )
    );
  });

  const lifetimeValueKeys = ["rotationOverLifetime"];
  lifetimeValueKeys.forEach((key) => {
    if (normalizedConfig[key].isActive)
      generalData.lifetimeValues[key] = Array.from(
        { length: maxParticles },
        () =>
          THREE.MathUtils.randFloat(
            normalizedConfig[key].min,
            normalizedConfig[key].max
          )
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
      : null,
    offsets: noise.useRandomOffset
      ? Array.from({ length: maxParticles }, () => Math.random() * 100)
      : null,
  };

  const material = new THREE.ShaderMaterial({
    uniforms: {
      elapsed: {
        value: 0.0,
      },
      map: {
        value: map,
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
      shape,
      startSpeed,
      startPositions[i],
      generalData.wrapperQuaternion,
      velocities[i],
      velocityOverLifetime
    );

  geometry.setFromPoints(
    Array.from({ length: maxParticles }, (_, index) => ({
      ...startPositions[index],
    }))
  );

  const createFloat32AttributesRequest = (propertyName, factory) => {
    createFloat32Attributes({
      geometry,
      propertyName,
      maxParticles,
      factory,
    });
  };

  createFloat32AttributesRequest("isActive", false);
  createFloat32AttributesRequest("lifetime", 0);
  createFloat32AttributesRequest("startLifetime", () =>
    THREE.MathUtils.randFloat(startLifetime.min, startLifetime.max)
  );
  createFloat32AttributesRequest("startFrame", () =>
    THREE.MathUtils.randInt(
      textureSheetAnimation.startFrame.min,
      textureSheetAnimation.startFrame.max
    )
  );

  createFloat32AttributesRequest("opacity", 0);

  createFloat32AttributesRequest("rotation", () =>
    THREE.Math.degToRad(
      THREE.MathUtils.randFloat(startRotation.min, startRotation.max)
    )
  );

  createFloat32AttributesRequest(
    "size",
    (_, index) => generalData.startValues.startSize[index]
  );

  createFloat32AttributesRequest("rotation", 0);

  const colorRandomRatio = Math.random();
  createFloat32AttributesRequest(
    "colorR",
    () =>
      startColor.min.r +
      colorRandomRatio * (startColor.max.r - startColor.min.r)
  );
  createFloat32AttributesRequest(
    "colorG",
    () =>
      startColor.min.g +
      colorRandomRatio * (startColor.max.g - startColor.min.g)
  );
  createFloat32AttributesRequest(
    "colorB",
    () =>
      startColor.min.b +
      colorRandomRatio * (startColor.max.b - startColor.min.b)
  );
  createFloat32AttributesRequest("colorA", 0);

  const deactivateParticle = (particleIndex) => {
    geometry.attributes.isActive.array[particleIndex] = false;
    geometry.attributes.colorA.array[particleIndex] = 0;
    geometry.attributes.colorA.needsUpdate = true;
  };

  const activateParticle = ({ particleIndex, activationTime, position }) => {
    geometry.attributes.isActive.array[particleIndex] = true;
    generalData.creationTimes[particleIndex] = activationTime;

    if (generalData.noise.offsets)
      generalData.noise.offsets[particleIndex] = Math.random() * 100;

    const colorRandomRatio = Math.random();

    geometry.attributes.colorR.array[particleIndex] =
      startColor.min.r +
      colorRandomRatio * (startColor.max.r - startColor.min.r);
    geometry.attributes.colorR.needsUpdate = true;

    geometry.attributes.colorG.array[particleIndex] =
      startColor.min.g +
      colorRandomRatio * (startColor.max.g - startColor.min.g);
    geometry.attributes.colorG.needsUpdate = true;

    geometry.attributes.colorB.array[particleIndex] =
      startColor.min.b +
      colorRandomRatio * (startColor.max.b - startColor.min.b);
    geometry.attributes.colorB.needsUpdate = true;

    geometry.attributes.startFrame.array[particleIndex] =
      THREE.MathUtils.randInt(
        textureSheetAnimation.startFrame.min,
        textureSheetAnimation.startFrame.max
      );
    geometry.attributes.startFrame.needsUpdate = true;

    geometry.attributes.startLifetime.array[particleIndex] =
      THREE.MathUtils.randFloat(startLifetime.min, startLifetime.max) * 1000;
    geometry.attributes.startLifetime.needsUpdate = true;

    generalData.startValues.startSize[particleIndex] =
      THREE.MathUtils.randFloat(startSize.min, startSize.max);
    generalData.startValues.startOpacity[particleIndex] =
      THREE.MathUtils.randFloat(startOpacity.min, startOpacity.max);

    geometry.attributes.rotation.array[particleIndex] = THREE.Math.degToRad(
      THREE.MathUtils.randFloat(startRotation.min, startRotation.max)
    );

    if (normalizedConfig.rotationOverLifetime.isActive)
      generalData.lifetimeValues.rotationOverLifetime[particleIndex] =
        THREE.MathUtils.randFloat(
          normalizedConfig.rotationOverLifetime.min,
          normalizedConfig.rotationOverLifetime.max
        );

    geometry.attributes.rotation.needsUpdate = true;
    geometry.attributes.colorB.needsUpdate = true;

    calculatePositionAndVelocity(
      shape,
      startSpeed,
      startPositions[particleIndex],
      generalData.wrapperQuaternion,
      velocities[particleIndex],
      velocityOverLifetime
    );
    const positionIndex = Math.floor(particleIndex * 3);
    geometry.attributes.position.array[positionIndex] =
      (position ? position.x : 0) + startPositions[particleIndex].x;
    geometry.attributes.position.array[positionIndex + 1] =
      (position ? position.y : 0) + startPositions[particleIndex].y;
    geometry.attributes.position.array[positionIndex + 2] =
      (position ? position.z : 0) + startPositions[particleIndex].z;
    geometry.attributes.position.needsUpdate = true;

    if (generalData.hasOrbitalVelocity) {
      generalData.orbitalVelocityData[particleIndex].speed.set(
        THREE.MathUtils.randFloat(
          normalizedConfig.velocityOverLifetime.orbital.x.min,
          normalizedConfig.velocityOverLifetime.orbital.x.max
        ) *
          (Math.PI / 180),
        THREE.MathUtils.randFloat(
          normalizedConfig.velocityOverLifetime.orbital.y.min,
          normalizedConfig.velocityOverLifetime.orbital.y.max
        ) *
          (Math.PI / 180),
        THREE.MathUtils.randFloat(
          normalizedConfig.velocityOverLifetime.orbital.z.min,
          normalizedConfig.velocityOverLifetime.orbital.z.max
        ) *
          (Math.PI / 180)
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
      elapsed: 0,
      noise: generalData.noise,
      startValues: generalData.startValues,
      lifetimeValues: generalData.lifetimeValues,
      hasOrbitalVelocity: generalData.hasOrbitalVelocity,
      orbitalVelocityData: generalData.orbitalVelocityData,
      normalizedConfig,
      attributes: particleSystem.geometry.attributes,
      particleLifetime: 0,
      particleLifetimePercentage: 0,
      particleIndex,
      forceUpdate: true,
    });
  };

  let particleSystem = new THREE.Points(geometry, material);
  particleSystem.sortParticles = true;

  particleSystem.position.copy(transform.position);
  particleSystem.rotation.x = THREE.Math.degToRad(transform.rotation.x);
  particleSystem.rotation.y = THREE.Math.degToRad(transform.rotation.y);
  particleSystem.rotation.z = THREE.Math.degToRad(transform.rotation.z);
  particleSystem.scale.copy(transform.scale);

  const calculatedCreationTime =
    now + THREE.MathUtils.randFloat(startDelay.min, startDelay.max) * 1000;

  let wrapper;
  if (normalizedConfig.simulationSpace === SimulationSpace.WORLD) {
    wrapper = new Gyroscope();
    wrapper.add(particleSystem);
  }

  createdParticleSystems.push({
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
  });

  return wrapper || particleSystem;
};

export const destroyParticleSystem = (particleSystem) => {
  createdParticleSystems = createdParticleSystems.filter(
    ({ particleSystem: savedParticleSystem, wrapper }) => {
      if (
        savedParticleSystem !== particleSystem &&
        wrapper !== particleSystem
      ) {
        return true;
      }

      savedParticleSystem.geometry.dispose();
      savedParticleSystem.material.dispose();
      savedParticleSystem.parent.remove(savedParticleSystem);
      return false;
    }
  );
};

export const updateParticleSystems = ({ now, delta, elapsed }) => {
  createdParticleSystems.forEach((props) => {
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

    const {
      lastWorldPosition,
      currentWorldPosition,
      worldPositionChange,
      lastWorldQuaternion,
      worldQuaternion,
      worldEuler,
      gravityVelocity,
      hasOrbitalVelocity,
    } = generalData;

    if (wrapper) generalData.wrapperQuaternion.copy(wrapper.parent.quaternion);

    const lastWorldPositionSnapshot = { ...lastWorldPosition };

    const lifetime = now - creationTime;
    particleSystem.material.uniforms.elapsed.value = elapsed;

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
      lastWorldQuaternion.x != worldQuaternion.x ||
      lastWorldQuaternion.y != worldQuaternion.y ||
      lastWorldQuaternion.z != worldQuaternion.z
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

    generalData.creationTimes.forEach((entry, index) => {
      if (particleSystem.geometry.attributes.isActive.array[index]) {
        const particleLifetime = now - entry;
        if (
          particleLifetime >
          particleSystem.geometry.attributes.startLifetime.array[index]
        )
          deactivateParticle(index);
        else {
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
            const positionArr =
              particleSystem.geometry.attributes.position.array;

            if (simulationSpace === SimulationSpace.WORLD) {
              positionArr[positionIndex] -= worldPositionChange.x;
              positionArr[positionIndex + 1] -= worldPositionChange.y;
              positionArr[positionIndex + 2] -= worldPositionChange.z;
            }

            positionArr[positionIndex] += velocity.x * delta;
            positionArr[positionIndex + 1] += velocity.y * delta;
            positionArr[positionIndex + 2] += velocity.z * delta;
            particleSystem.geometry.attributes.position.needsUpdate = true;
          }

          particleSystem.geometry.attributes.lifetime.array[index] =
            particleLifetime;
          particleSystem.geometry.attributes.lifetime.needsUpdate = true;

          const particleLifetimePercentage =
            particleLifetime /
            particleSystem.geometry.attributes.startLifetime.array[index];
          applyModifiers({
            delta,
            elapsed,
            noise: generalData.noise,
            startValues: generalData.startValues,
            lifetimeValues: generalData.lifetimeValues,
            hasOrbitalVelocity: generalData.hasOrbitalVelocity,
            orbitalVelocityData: generalData.orbitalVelocityData,
            normalizedConfig,
            attributes: particleSystem.geometry.attributes,
            particleLifetime,
            particleLifetimePercentage,
            particleIndex: index,
          });
        }
      }
    });

    if (looping || lifetime < duration * 1000) {
      const emissionDelta = now - lastEmissionTime;
      const neededParticlesByTime = Math.floor(
        emission.rateOverTime * (emissionDelta / 1000)
      );
      const neededParticlesByDistance =
        emission.rateOverDistance > 0 &&
        generalData.distanceFromLastEmitByDistance > 0
          ? Math.floor(
              generalData.distanceFromLastEmitByDistance /
                (1 / emission.rateOverDistance)
            )
          : 0;
      const distanceStep =
        neededParticlesByDistance > 0
          ? {
              x:
                (currentWorldPosition.x - lastWorldPositionSnapshot.x) /
                neededParticlesByDistance,
              y:
                (currentWorldPosition.y - lastWorldPositionSnapshot.y) /
                neededParticlesByDistance,
              z:
                (currentWorldPosition.z - lastWorldPositionSnapshot.z) /
                neededParticlesByDistance,
            }
          : null;
      const neededParticles = neededParticlesByTime + neededParticlesByDistance;

      if (emission.rateOverDistance > 0 && neededParticlesByDistance >= 1) {
        generalData.distanceFromLastEmitByDistance = 0;
      }

      if (neededParticles > 0) {
        let generatedParticlesByDistanceNeeds = 0;
        for (let i = 0; i < neededParticles; i++) {
          let particleIndex = -1;
          particleSystem.geometry.attributes.isActive.array.find(
            (isActive, index) => {
              if (!isActive) {
                particleIndex = index;
                return true;
              }

              return false;
            }
          );

          if (
            particleIndex !== -1 &&
            particleIndex <
              particleSystem.geometry.attributes.isActive.array.length
          ) {
            let position;
            if (generatedParticlesByDistanceNeeds < neededParticlesByDistance) {
              position =
                generatedParticlesByDistanceNeeds < neededParticlesByDistance
                  ? {
                      x: distanceStep.x * generatedParticlesByDistanceNeeds,
                      y: distanceStep.y * generatedParticlesByDistanceNeeds,
                      z: distanceStep.z * generatedParticlesByDistanceNeeds,
                    }
                  : null;
              generatedParticlesByDistanceNeeds++;
            }
            activateParticle({ particleIndex, activationTime: now, position });
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
          iterationCount: iterationCount + 1,
        });
    } else if (onComplete)
      onComplete({
        particleSystem,
      });
  });
};
