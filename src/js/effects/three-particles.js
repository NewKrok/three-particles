import * as THREE from "three/build/three.module.js";

import {
  calculateRandomPositionAndVelocityOnCircle,
  calculateRandomPositionAndVelocityOnCone,
  calculateRandomPositionAndVelocityOnRectangle,
  calculateRandomPositionAndVelocityOnSphere,
  deepMerge,
} from "./three-particles-utils.js";

import ParticleSystemFragmentShader from "./shaders/particle-system-fragment-shader.glsl.js";
import ParticleSystemVertexShader from "./shaders/particle-system-vertex-shader.glsl.js";

// Float32Array is not enough accurate when we are storing timestamp in it so we just remove unnecessary time
const float32Helper = 1638200000000;

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

export const getDefaultParticleSystemConfig = () =>
  JSON.parse(JSON.stringify(DEFAULT_PARTICLE_SYSTEM_CONFIG));

const DEFAULT_PARTICLE_SYSTEM_CONFIG = {
  duration: 5.0,
  looping: true,
  startDelay: { min: 0.0, max: 0.0 },
  startLifeTime: { min: 2.0, max: 2.0 },
  startSpeed: { min: 1.0, max: 1.0 },
  startSize: { min: 1.0, max: 1.0 },
  startRotation: { min: 0.0, max: 0.0 },
  startColor: {
    min: { r: 1.0, g: 1.0, b: 1.0 },
    max: { r: 1.0, g: 1.0, b: 1.0 },
  },
  startOpacity: { min: 1.0, max: 1.0 },
  gravity: 0,
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
  },
  map: null,
  textureSheetAnimation: { tiles: new THREE.Vector2(1.0, 1.0), fps: 30.0 },
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
  { shape, sphere, cone, circle, rectangle },
  startSpeed,
  position,
  velocity
) => {
  switch (shape) {
    case Shape.SPHERE:
      calculateRandomPositionAndVelocityOnSphere(
        position,
        velocity,
        startSpeed,
        sphere
      );
      break;

    case Shape.CONE:
      calculateRandomPositionAndVelocityOnCone(
        position,
        velocity,
        startSpeed,
        cone
      );
      break;

    case Shape.CIRCLE:
      calculateRandomPositionAndVelocityOnCircle(
        position,
        velocity,
        startSpeed,
        circle
      );
      break;

    case Shape.RECTANGLE:
      calculateRandomPositionAndVelocityOnRectangle(
        position,
        velocity,
        startSpeed,
        rectangle
      );
      break;
  }
};

export const createParticleSystem = (
  config = DEFAULT_PARTICLE_SYSTEM_CONFIG
) => {
  const now = Date.now();
  const lastWorldPosition = new THREE.Vector3(-99999, -99999, -99999);
  const worldPositionChange = new THREE.Vector3();
  const generalData = { distanceFromLastEmitByDistance: 0 };

  const {
    duration,
    looping,
    startDelay,
    startLifeTime,
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
    onUpdate,
    onComplete,
    textureSheetAnimation,
  } = deepMerge(DEFAULT_PARTICLE_SYSTEM_CONFIG, config);

  const startPositions = Array.from(
    { length: maxParticles },
    () => new THREE.Vector3()
  );
  const velocities = Array.from(
    { length: maxParticles },
    () => new THREE.Vector3()
  );

  const uniforms = Object.keys(textureSheetAnimation).reduce(
    (prev, key) => ({
      ...prev,
      [key]: { value: textureSheetAnimation[key] },
    }),
    {}
  );

  const material = new THREE.ShaderMaterial({
    uniforms: {
      elapsed: {
        value: 0.0,
      },
      map: {
        value: map,
      },
      ...uniforms,
    },
    vertexShader: ParticleSystemVertexShader,
    fragmentShader: ParticleSystemFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < maxParticles; i++)
    calculatePositionAndVelocity(
      shape,
      startSpeed,
      startPositions[i],
      velocities[i]
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
  createFloat32AttributesRequest("creationTime", 0);
  createFloat32AttributesRequest("lifeTime", 0);
  createFloat32AttributesRequest("startLifeTime", () =>
    THREE.MathUtils.randFloat(startLifeTime.min, startLifeTime.max)
  );

  createFloat32AttributesRequest("opacity", 0);

  createFloat32Attributes({
    geometry,
    propertyName: "rotation",
    maxParticles,
    factory: () =>
      THREE.Math.degToRad(
        THREE.MathUtils.randFloat(startRotation.min, startRotation.max)
      ),
  });

  createFloat32Attributes({
    geometry,
    propertyName: "startSize",
    maxParticles,
    factory: () => THREE.MathUtils.randFloat(startSize.min, startSize.max),
  });

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
    geometry.attributes.lifeTime.array[particleIndex] = 0;
    geometry.attributes.lifeTime.needsUpdate = true;
    geometry.attributes.colorA.array[particleIndex] = 0;
    geometry.attributes.colorA.needsUpdate = true;
  };

  const activateParticle = ({ particleIndex, activationTime }) => {
    geometry.attributes.isActive.array[particleIndex] = true;
    geometry.attributes.creationTime.array[particleIndex] =
      activationTime - float32Helper;

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

    geometry.attributes.colorA.array[particleIndex] = THREE.MathUtils.randFloat(
      startOpacity.min,
      startOpacity.max
    );
    geometry.attributes.colorA.needsUpdate = true;

    geometry.attributes.startLifeTime.array[particleIndex] =
      THREE.MathUtils.randFloat(startLifeTime.min, startLifeTime.max) * 1000;
    geometry.attributes.startLifeTime.needsUpdate = true;

    geometry.attributes.startSize.array[particleIndex] =
      THREE.MathUtils.randFloat(startSize.min, startSize.max);
    geometry.attributes.startSize.needsUpdate = true;

    geometry.attributes.rotation.array[particleIndex] = THREE.Math.degToRad(
      THREE.MathUtils.randFloat(startRotation.min, startRotation.max)
    );
    geometry.attributes.rotation.needsUpdate = true;

    calculatePositionAndVelocity(
      shape,
      startSpeed,
      startPositions[particleIndex],
      velocities[particleIndex]
    );
    const positionIndex = Math.floor(particleIndex * 3);
    geometry.attributes.position.array[positionIndex] =
      startPositions[particleIndex].x;
    geometry.attributes.position.array[positionIndex + 1] =
      startPositions[particleIndex].y;
    geometry.attributes.position.array[positionIndex + 2] =
      startPositions[particleIndex].z;
    particleSystem.geometry.attributes.position.needsUpdate = true;

    geometry.attributes.lifeTime.array[particleIndex] = 0;
    geometry.attributes.lifeTime.needsUpdate = true;
  };

  const particleSystem = new THREE.Points(geometry, material);
  particleSystem.sortParticles = true;

  const calculatedCreationTime =
    now + THREE.MathUtils.randFloat(startDelay.min, startDelay.max) * 1000;

  createdParticleSystems.push({
    particleSystem,
    generalData,
    lastWorldPosition,
    worldPositionChange,
    onUpdate,
    onComplete,
    creationTime: calculatedCreationTime,
    lastEmissionTime: calculatedCreationTime,
    duration,
    looping,
    simulationSpace,
    gravity,
    emission,
    iterationCount: 0,
    velocities,
    deactivateParticle,
    activateParticle,
  });
  return particleSystem;
};

export const destroyParticleSystem = (particleSystem) => {
  createdParticleSystems = createdParticleSystems.filter(
    ({ particleSystem: savedParticleSystem }) =>
      savedParticleSystem !== particleSystem
  );

  particleSystem.geometry.dispose();
  particleSystem.material.dispose();
  particleSystem.parent.remove(particleSystem);
};

export const updateParticleSystems = ({ delta, elapsed }) => {
  const now = Date.now();
  createdParticleSystems.forEach((props) => {
    const {
      onUpdate,
      generalData,
      lastWorldPosition,
      worldPositionChange,
      onComplete,
      particleSystem,
      creationTime,
      lastEmissionTime,
      duration,
      looping,
      emission,
      iterationCount,
      velocities,
      deactivateParticle,
      activateParticle,
      simulationSpace,
      gravity,
    } = props;
    const lifeTime = now - creationTime;
    particleSystem.material.uniforms.elapsed.value = elapsed;

    if (
      lastWorldPosition.x !== -99999 &&
      lastWorldPosition.y !== -99999 &&
      lastWorldPosition.z !== -99999
    )
      worldPositionChange.set(
        particleSystem.position.x - lastWorldPosition.x,
        particleSystem.position.y - lastWorldPosition.y,
        particleSystem.position.z - lastWorldPosition.z
      );
    generalData.distanceFromLastEmitByDistance += worldPositionChange.length();
    lastWorldPosition.copy(particleSystem.position);

    particleSystem.geometry.attributes.creationTime.array.forEach(
      (entry, index) => {
        if (particleSystem.geometry.attributes.isActive.array[index]) {
          const particleLifeTime = now - float32Helper - entry;
          if (
            particleLifeTime >
            particleSystem.geometry.attributes.startLifeTime.array[index]
          )
            deactivateParticle(index);
          else {
            const velocity = velocities[index];
            velocity.y -= gravity;

            if (
              gravity !== 0 ||
              velocity.x !== 0 ||
              velocity.y !== 0 ||
              velocity.z !== 0
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

            particleSystem.geometry.attributes.lifeTime.array[index] =
              particleLifeTime;
            particleSystem.geometry.attributes.lifeTime.needsUpdate = true;

            // TEMP
            particleSystem.geometry.attributes.colorA.array[index] =
              1 -
              particleLifeTime /
                particleSystem.geometry.attributes.startLifeTime.array[index];
            particleSystem.geometry.attributes.colorA.needsUpdate = true;
          }
        }
      }
    );

    if (looping || lifeTime < duration * 1000) {
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
      const neededParticles = neededParticlesByTime + neededParticlesByDistance;

      if (emission.rateOverDistance > 0 && neededParticlesByDistance >= 1)
        generalData.distanceFromLastEmitByDistance = 0;

      if (neededParticles > 0) {
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
            activateParticle({ particleIndex, activationTime: now });
            props.lastEmissionTime = now;
          }
        }
      }

      if (onUpdate)
        onUpdate({
          particleSystem,
          delta,
          elapsed,
          lifeTime,
          iterationCount: iterationCount + 1,
        });
    } else if (onComplete)
      onComplete({
        particleSystem,
      });
  });
};
