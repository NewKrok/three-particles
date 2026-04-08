/**
 * GPU compute shader for particle lifetime modifiers.
 *
 * Extends the core physics compute (Phase 2) with all 7 modifiers:
 *   1. Size over lifetime (curve lookup)
 *   2. Opacity over lifetime (curve lookup)
 *   3. Color over lifetime (3 curve lookups for R/G/B)
 *   4. Rotation over lifetime (constant speed)
 *   5. Linear velocity (optional curve lookup per axis)
 *   6. Orbital velocity (Euler rotation around emission offset)
 *   7. Noise (simplex noise affecting position, rotation, size)
 *
 * Curves are pre-baked into a Float32Array (256 samples each) and accessed
 * via a storage buffer with linear interpolation on the GPU.
 *
 * @module
 */
import { Vector3 } from 'three';
import {
  Fn,
  float,
  vec3,
  vec4,
  storage,
  instanceIndex,
  uniform,
  If,
  floor,
  fract,
  mix,
  sin,
  cos,
  min as tslMin,
  compute,
  type ShaderNodeObject,
  type Node,
} from 'three/tsl';

import {
  StorageBufferAttribute,
  StorageInstancedBufferAttribute,
} from 'three/webgpu';

import { createForceFieldComputeNodes } from './compute-force-fields.js';
import { snoise3D } from './tsl-noise.js';
import type { BakedCurveMap } from './curve-bake.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Modifier flags set from CPU config — determines which modifiers run on GPU. */
export type ModifierFlags = {
  sizeOverLifetime: boolean;
  opacityOverLifetime: boolean;
  colorOverLifetime: boolean;
  rotationOverLifetime: boolean;
  linearVelocity: boolean;
  orbitalVelocity: boolean;
  noise: boolean;
  forceFields: boolean;
};

/** Per-frame modifier uniform values. */
export type ModifierUniforms = {
  delta: ShaderNodeObject<Node>;
  deltaMs: ShaderNodeObject<Node>;
  gravityVelocity: ShaderNodeObject<Node>;
  worldPositionChange: ShaderNodeObject<Node>;
  simulationSpaceWorld: ShaderNodeObject<Node>;
  // Noise uniforms
  noiseStrength: ShaderNodeObject<Node>;
  noisePower: ShaderNodeObject<Node>;
  noisePositionAmount: ShaderNodeObject<Node>;
  noiseRotationAmount: ShaderNodeObject<Node>;
  noiseSizeAmount: ShaderNodeObject<Node>;
};

/** Storage buffers for the modifier compute pipeline. */
export type ModifierStorageBuffers = {
  // Core physics (from Phase 2)
  position: StorageBufferAttribute | StorageInstancedBufferAttribute;
  velocity: StorageBufferAttribute;
  lifetime: StorageBufferAttribute | StorageInstancedBufferAttribute;
  startLifetime: StorageBufferAttribute | StorageInstancedBufferAttribute;
  isActive: StorageBufferAttribute | StorageInstancedBufferAttribute;
  colorA: StorageBufferAttribute | StorageInstancedBufferAttribute;
  // Modifier-specific
  size: StorageBufferAttribute | StorageInstancedBufferAttribute;
  rotation: StorageBufferAttribute | StorageInstancedBufferAttribute;
  colorR: StorageBufferAttribute | StorageInstancedBufferAttribute;
  colorG: StorageBufferAttribute | StorageInstancedBufferAttribute;
  colorB: StorageBufferAttribute | StorageInstancedBufferAttribute;
  startSize: StorageBufferAttribute | StorageInstancedBufferAttribute;
  startOpacity: StorageBufferAttribute | StorageInstancedBufferAttribute;
  startColorR: StorageBufferAttribute | StorageInstancedBufferAttribute;
  startColorG: StorageBufferAttribute | StorageInstancedBufferAttribute;
  startColorB: StorageBufferAttribute | StorageInstancedBufferAttribute;
  rotationSpeed: StorageBufferAttribute | StorageInstancedBufferAttribute;
  noiseOffset: StorageBufferAttribute;
  // Orbital velocity persistent offsets (vec3 per particle)
  orbitalOffset: StorageBufferAttribute;
  // Curve data (all curves packed sequentially, 256 floats each)
  curveData: StorageBufferAttribute;
};

/** The complete compute pipeline handle. */
export type ModifierComputePipeline = {
  computeNode: ReturnType<typeof compute>;
  uniforms: ModifierUniforms;
  buffers: ModifierStorageBuffers;
};

// ─── Storage Buffer Creation ─────────────────────────────────────────────────

/**
 * Creates GPU storage buffers for the full modifier compute pipeline.
 * Extends the Phase 2 buffers with modifier-specific data.
 */
export function createModifierStorageBuffers(
  maxParticles: number,
  instanced: boolean,
  curveData: Float32Array
): ModifierStorageBuffers {
  const Cls = instanced
    ? StorageInstancedBufferAttribute
    : StorageBufferAttribute;

  return {
    // Core physics
    position: new Cls(new Float32Array(maxParticles * 3), 3),
    velocity: new StorageBufferAttribute(new Float32Array(maxParticles * 3), 3),
    lifetime: new Cls(new Float32Array(maxParticles), 1),
    startLifetime: new Cls(new Float32Array(maxParticles), 1),
    isActive: new Cls(new Float32Array(maxParticles), 1),
    colorA: new Cls(new Float32Array(maxParticles), 1),
    // Modifier attributes
    size: new Cls(new Float32Array(maxParticles), 1),
    rotation: new Cls(new Float32Array(maxParticles), 1),
    colorR: new Cls(new Float32Array(maxParticles), 1),
    colorG: new Cls(new Float32Array(maxParticles), 1),
    colorB: new Cls(new Float32Array(maxParticles), 1),
    startSize: new Cls(new Float32Array(maxParticles), 1),
    startOpacity: new Cls(new Float32Array(maxParticles), 1),
    startColorR: new Cls(new Float32Array(maxParticles), 1),
    startColorG: new Cls(new Float32Array(maxParticles), 1),
    startColorB: new Cls(new Float32Array(maxParticles), 1),
    rotationSpeed: new Cls(new Float32Array(maxParticles), 1),
    noiseOffset: new StorageBufferAttribute(new Float32Array(maxParticles), 1),
    orbitalOffset: new StorageBufferAttribute(
      new Float32Array(maxParticles * 3),
      3
    ),
    // Curve data — read-only on GPU
    curveData: new StorageBufferAttribute(
      curveData.length > 0 ? curveData : new Float32Array(1),
      1
    ),
  };
}

// ─── Curve Lookup Helper ─────────────────────────────────────────────────────

const CURVE_RESOLUTION = 256;

/**
 * Creates a TSL function that performs a linear-interpolated lookup into the
 * baked curve storage buffer.
 *
 * @param sCurveData - Storage buffer node for all baked curves.
 * @returns A TSL function: (curveIndex: int, t: float) => float
 */
function createCurveLookup(sCurveData: ShaderNodeObject<Node>) {
  return Fn(
    ({
      curveIndex,
      t,
    }: {
      curveIndex: ShaderNodeObject<Node>;
      t: ShaderNodeObject<Node>;
    }) => {
      const clamped = tslMin(t, float(1.0));
      const pos = clamped.mul(CURVE_RESOLUTION - 1);
      const idx0 = floor(pos);
      const f = fract(pos);

      const base = curveIndex.mul(CURVE_RESOLUTION);
      const v0 = sCurveData.element(base.add(idx0));
      const v1 = sCurveData.element(
        base.add(tslMin(idx0.add(1.0), float(CURVE_RESOLUTION - 1)))
      );

      return mix(v0, v1, f);
    }
  );
}

// ─── Compute Shader ──────────────────────────────────────────────────────────

/**
 * Creates the unified GPU compute pipeline that handles both core physics
 * AND modifiers in a single dispatch.
 */
export function createModifierComputeUpdate(
  buffers: ModifierStorageBuffers,
  maxParticles: number,
  curveMap: BakedCurveMap,
  flags: ModifierFlags,
  forceFieldCount = 0
): ModifierComputePipeline {
  // ── Force field nodes (if any) ──
  const forceFieldNodes = flags.forceFields
    ? createForceFieldComputeNodes(forceFieldCount)
    : null;

  // ── Per-frame uniforms ──

  const uDelta = uniform(float(0));
  const uDeltaMs = uniform(float(0));
  const uGravityVelocity = uniform(new Vector3(0, 0, 0));
  const uWorldPositionChange = uniform(new Vector3(0, 0, 0));
  const uSimSpaceWorld = uniform(float(0));
  const uNoiseStrength = uniform(float(0));
  const uNoisePower = uniform(float(0));
  const uNoisePosAmount = uniform(float(0));
  const uNoiseRotAmount = uniform(float(0));
  const uNoiseSizeAmount = uniform(float(0));

  // ── Storage buffer nodes ──

  const sPosition = storage(buffers.position, 'vec3', maxParticles);
  const sVelocity = storage(buffers.velocity, 'vec3', maxParticles);
  const sLifetime = storage(buffers.lifetime, 'float', maxParticles);
  const sStartLifetime = storage(buffers.startLifetime, 'float', maxParticles);
  const sIsActive = storage(buffers.isActive, 'float', maxParticles);
  const sColorA = storage(buffers.colorA, 'float', maxParticles);
  const sSize = storage(buffers.size, 'float', maxParticles);
  const sRotation = storage(buffers.rotation, 'float', maxParticles);
  const sColorR = storage(buffers.colorR, 'float', maxParticles);
  const sColorG = storage(buffers.colorG, 'float', maxParticles);
  const sColorB = storage(buffers.colorB, 'float', maxParticles);
  const sStartSize = storage(buffers.startSize, 'float', maxParticles);
  const sStartOpacity = storage(buffers.startOpacity, 'float', maxParticles);
  const sStartColorR = storage(buffers.startColorR, 'float', maxParticles);
  const sStartColorG = storage(buffers.startColorG, 'float', maxParticles);
  const sStartColorB = storage(buffers.startColorB, 'float', maxParticles);
  const sRotationSpeed = storage(buffers.rotationSpeed, 'float', maxParticles);
  const sNoiseOffset = storage(buffers.noiseOffset, 'float', maxParticles);
  const sOrbitalOffset = storage(buffers.orbitalOffset, 'vec3', maxParticles);
  const sCurveData = storage(
    buffers.curveData,
    'float',
    buffers.curveData.array.length
  );

  const lookupCurve = createCurveLookup(sCurveData);

  // ── Compute kernel ──

  const computeKernel = Fn(() => {
    const i = instanceIndex;

    const active = sIsActive.element(i);
    If(active.lessThan(0.5), () => {
      return;
    });

    // Read current state
    const pos = sPosition.element(i).toVar();
    const vel = sVelocity.element(i).toVar();
    const life = sLifetime.element(i).toVar();
    const startLife = sStartLifetime.element(i);

    // === CORE PHYSICS (same as Phase 2) ===

    // Gravity
    vel.assign(vel.sub(vec3(uGravityVelocity).mul(uDelta)));

    // Force fields (applied after gravity, before position integration)
    if (forceFieldNodes) {
      forceFieldNodes.apply({ pos, vel, delta: uDelta });
    }

    // World-space compensation
    If(uSimSpaceWorld.greaterThan(0.5), () => {
      pos.assign(pos.sub(vec3(uWorldPositionChange)));
    });

    // Velocity integration
    pos.assign(pos.add(vel.mul(uDelta)));

    // Lifetime update
    life.assign(life.add(uDeltaMs));

    // Lifetime percentage for modifiers
    const lifePct = tslMin(life.div(startLife), float(1.0));

    // === MODIFIERS ===

    // 1. Linear Velocity (curve-modulated)
    if (flags.linearVelocity) {
      const lvx =
        curveMap.linearVelX >= 0
          ? lookupCurve({
              curveIndex: float(curveMap.linearVelX),
              t: lifePct,
            })
          : float(0.0);
      const lvy =
        curveMap.linearVelY >= 0
          ? lookupCurve({
              curveIndex: float(curveMap.linearVelY),
              t: lifePct,
            })
          : float(0.0);
      const lvz =
        curveMap.linearVelZ >= 0
          ? lookupCurve({
              curveIndex: float(curveMap.linearVelZ),
              t: lifePct,
            })
          : float(0.0);
      pos.assign(pos.add(vec3(lvx, lvy, lvz).mul(uDelta)));
    }

    // 2. Orbital Velocity
    if (flags.orbitalVelocity) {
      const offset = sOrbitalOffset.element(i).toVar();
      // Translate to emission origin
      pos.assign(pos.sub(offset));

      // Get angular speeds (from curves or constant)
      const ovx =
        curveMap.orbitalVelX >= 0
          ? lookupCurve({
              curveIndex: float(curveMap.orbitalVelX),
              t: lifePct,
            })
          : float(0.0);
      const ovy =
        curveMap.orbitalVelY >= 0
          ? lookupCurve({
              curveIndex: float(curveMap.orbitalVelY),
              t: lifePct,
            })
          : float(0.0);
      const ovz =
        curveMap.orbitalVelZ >= 0
          ? lookupCurve({
              curveIndex: float(curveMap.orbitalVelZ),
              t: lifePct,
            })
          : float(0.0);

      // Apply Euler rotation (simplified: sequential axis rotations)
      const ax = ovx.mul(uDelta);
      const ay = ovy.mul(uDelta);
      const az = ovz.mul(uDelta);

      // Rotate around X axis
      const cosAx = cos(ax);
      const sinAx = sin(ax);
      const ry1 = offset.y.mul(cosAx).sub(offset.z.mul(sinAx));
      const rz1 = offset.y.mul(sinAx).add(offset.z.mul(cosAx));
      offset.assign(vec3(offset.x, ry1, rz1));

      // Rotate around Z axis (mapped from Y in the CPU code)
      const cosAz = cos(az);
      const sinAz = sin(az);
      const rx2 = offset.x.mul(cosAz).sub(offset.y.mul(sinAz));
      const ry2 = offset.x.mul(sinAz).add(offset.y.mul(cosAz));
      offset.assign(vec3(rx2, ry2, offset.z));

      // Rotate around Y axis (mapped from Z in the CPU code)
      const cosAy = cos(ay);
      const sinAy = sin(ay);
      const rx3 = offset.x.mul(cosAy).add(offset.z.mul(sinAy));
      const rz3 = offset.x.negate().mul(sinAy).add(offset.z.mul(cosAy));
      offset.assign(vec3(rx3, offset.y, rz3));

      // Write back offset and translate back
      sOrbitalOffset.element(i).assign(offset);
      pos.assign(pos.add(offset));
    }

    // 3. Size Over Lifetime
    if (flags.sizeOverLifetime && curveMap.sizeOverLifetime >= 0) {
      const multiplier = lookupCurve({
        curveIndex: float(curveMap.sizeOverLifetime),
        t: lifePct,
      });
      sSize.element(i).assign(sStartSize.element(i).mul(multiplier));
    }

    // 4. Opacity Over Lifetime
    if (flags.opacityOverLifetime && curveMap.opacityOverLifetime >= 0) {
      const multiplier = lookupCurve({
        curveIndex: float(curveMap.opacityOverLifetime),
        t: lifePct,
      });
      sColorA.element(i).assign(sStartOpacity.element(i).mul(multiplier));
    }

    // 5. Color Over Lifetime
    if (flags.colorOverLifetime) {
      if (curveMap.colorR >= 0) {
        const rMul = lookupCurve({
          curveIndex: float(curveMap.colorR),
          t: lifePct,
        });
        sColorR.element(i).assign(sStartColorR.element(i).mul(rMul));
      }
      if (curveMap.colorG >= 0) {
        const gMul = lookupCurve({
          curveIndex: float(curveMap.colorG),
          t: lifePct,
        });
        sColorG.element(i).assign(sStartColorG.element(i).mul(gMul));
      }
      if (curveMap.colorB >= 0) {
        const bMul = lookupCurve({
          curveIndex: float(curveMap.colorB),
          t: lifePct,
        });
        sColorB.element(i).assign(sStartColorB.element(i).mul(bMul));
      }
    }

    // 6. Rotation Over Lifetime
    if (flags.rotationOverLifetime) {
      const rotSpeed = sRotationSpeed.element(i);
      sRotation
        .element(i)
        .assign(
          sRotation.element(i).add(rotSpeed.mul(uDelta).mul(float(0.02)))
        );
    }

    // 7. Noise
    if (flags.noise) {
      const noisePos = lifePct
        .add(sNoiseOffset.element(i))
        .mul(10.0)
        .mul(uNoiseStrength);

      // Sample noise at 3 different configurations (matching CPU)
      const noiseX = snoise3D({ position: vec3(noisePos, float(0), float(0)) });
      const noiseY = snoise3D({
        position: vec3(noisePos, noisePos, float(0)),
      });
      const noiseZ = snoise3D({
        position: vec3(noisePos, noisePos, noisePos),
      });

      // Apply to position
      pos.assign(
        pos.add(
          vec3(noiseX, noiseY, noiseZ).mul(uNoisePower).mul(uNoisePosAmount)
        )
      );

      // Apply to rotation (uses noiseX)
      If(uNoiseRotAmount.greaterThan(0.001), () => {
        sRotation
          .element(i)
          .assign(
            sRotation
              .element(i)
              .add(noiseX.mul(uNoisePower).mul(uNoiseRotAmount))
          );
      });

      // Apply to size (uses noiseX)
      If(uNoiseSizeAmount.greaterThan(0.001), () => {
        sSize
          .element(i)
          .assign(
            sSize.element(i).add(noiseX.mul(uNoisePower).mul(uNoiseSizeAmount))
          );
      });
    }

    // === WRITE BACK ===

    sPosition.element(i).assign(pos);
    sVelocity.element(i).assign(vel);
    sLifetime.element(i).assign(life);

    // Death check
    If(life.greaterThan(startLife), () => {
      sIsActive.element(i).assign(float(0));
      sColorA.element(i).assign(float(0));
    });
  });

  const computeNode = compute(computeKernel, maxParticles);

  return {
    computeNode,
    uniforms: {
      delta: uDelta,
      deltaMs: uDeltaMs,
      gravityVelocity: uGravityVelocity,
      worldPositionChange: uWorldPositionChange,
      simulationSpaceWorld: uSimSpaceWorld,
      noiseStrength: uNoiseStrength,
      noisePower: uNoisePower,
      noisePositionAmount: uNoisePosAmount,
      noiseRotationAmount: uNoiseRotAmount,
      noiseSizeAmount: uNoiseSizeAmount,
    },
    buffers,
    /** Force field buffer and count uniform (null if no force fields). */
    forceFieldNodes: forceFieldNodes
      ? {
          buffer: forceFieldNodes.buffer,
          countUniform: forceFieldNodes.countUniform,
        }
      : null,
  };
}
