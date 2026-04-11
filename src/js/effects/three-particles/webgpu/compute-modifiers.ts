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
  Loop,
  Break,
  floor,
  fract,
  mix,
  sin,
  cos,
  min as tslMin,
  int,
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

// ─── Emit Queue Constants ────────────────────────────────────────────────────

/**
 * Maximum number of particle emits that can be queued in a single frame.
 * Covers large bursts while keeping the buffer small (~12 KB).
 */
export const MAX_EMITS_PER_FRAME = 128;

/**
 * Number of floats per emit entry in the queue buffer.
 *
 * Layout (24 floats):
 *   0:     particleIndex
 *   1-3:   position (x, y, z)
 *   4-6:   velocity (x, y, z)
 *   7:     startLifetime
 *   8:     startSize
 *   9:     startOpacity
 *   10:    startColorR
 *   11:    startColorG
 *   12:    startColorB
 *   13:    colorA (initial alpha)
 *   14:    size (initial size)
 *   15:    rotation (initial rotation)
 *   16:    startFrame
 *   17:    rotationSpeed
 *   18:    noiseOffset
 *   19-21: orbitalOffset (x, y, z)
 *   22-23: padding
 */
const EMIT_STRIDE = 24;

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
/**
 * GPU storage buffers for the modifier compute pipeline.
 *
 * 8 bindings (within the WebGPU per-stage limit):
 *   1. position (vec3) — render + compute
 *   2. velocity (vec3) — compute-only
 *   3. color (vec4: R,G,B,A) — render + compute
 *   4. particleState (vec4: lifetime, size, rotation, startFrame) — render + compute
 *   5. startValues (vec4: startLifetime, startSize, startOpacity, startColorR) — compute + render(.x)
 *   6. startColorsExt (vec4: startColorG, startColorB, rotationSpeed, noiseOffset) — compute-only
 *   7. orbitalIsActive (vec4: offsetX, offsetY, offsetZ, isActive) — compute-only
 *   8. curveData (float[]) — compute-only; also carries the emit queue at the end
 *
 * The emit queue is appended to the curveData buffer to avoid exceeding the
 * 8-storage-buffer per-stage limit.  Layout:
 *   [0 .. curveLen-1]           baked curve samples
 *   [curveLen]                  emit count (float, cast to int on GPU)
 *   [curveLen+1 .. ]            emit queue entries (EMIT_STRIDE floats each)
 */
export type ModifierStorageBuffers = {
  /** Particle position (vec3). Render attribute + compute. */
  position: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Particle velocity (vec3). Compute-only. */
  velocity: StorageBufferAttribute;
  /** Packed RGBA color (vec4). Render attribute + compute. */
  color: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Packed (lifetime, size, rotation, startFrame). Render attribute + compute. */
  particleState: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Packed (startLifetime, startSize, startOpacity, startColorR). Compute + render(.x for startLifetime). */
  startValues: StorageBufferAttribute | StorageInstancedBufferAttribute;
  /** Packed (startColorG, startColorB, rotationSpeed, noiseOffset). Compute-only. */
  startColorsExt: StorageBufferAttribute;
  /** Packed (orbitalOffset.x, .y, .z, isActive). Compute-only. */
  orbitalIsActive: StorageBufferAttribute;
  /** Baked curve data + emit queue tail (float[]). Compute-only. */
  curveData: StorageBufferAttribute;
};

/** The complete compute pipeline handle. */
export type ModifierComputePipeline = {
  computeNode: ReturnType<typeof compute>;
  uniforms: ModifierUniforms;
  buffers: ModifierStorageBuffers;
  /** Offset into curveData where the emit queue begins (= original curve data length). */
  curveDataLength: number;
  forceFieldNodes: {
    buffer: StorageBufferAttribute;
    countUniform: ShaderNodeObject<Node>;
  } | null;
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

  // The emit queue is appended to the curveData buffer:
  //   [0 .. curveLen-1]  baked curve samples
  //   [curveLen]         emit count (float)
  //   [curveLen+1 .. ]   emit queue entries
  const curveLen = Math.max(curveData.length, 1);
  const totalLen = curveLen + 1 + MAX_EMITS_PER_FRAME * EMIT_STRIDE;
  const combined = new Float32Array(totalLen);
  combined.set(curveData.length > 0 ? curveData : new Float32Array([0]));
  // emit count starts at 0
  combined[curveLen] = 0;

  return {
    // Position and velocity use vec4 (w=padding) to avoid WebGPU vec3→vec4
    // storage buffer alignment conversion that breaks itemSize-based type resolution.
    position: new Cls(new Float32Array(maxParticles * 4), 4),
    velocity: new StorageBufferAttribute(new Float32Array(maxParticles * 4), 4),
    color: new Cls(new Float32Array(maxParticles * 4), 4),
    // (lifetime, size, rotation, startFrame)
    particleState: new Cls(new Float32Array(maxParticles * 4), 4),
    // (startLifetime, startSize, startOpacity, startColorR)
    startValues: new Cls(new Float32Array(maxParticles * 4), 4),
    // (startColorG, startColorB, rotationSpeed, noiseOffset)
    startColorsExt: new StorageBufferAttribute(
      new Float32Array(maxParticles * 4),
      4
    ),
    // (orbitalOffset.x, .y, .z, isActive)
    orbitalIsActive: new StorageBufferAttribute(
      new Float32Array(maxParticles * 4),
      4
    ),
    // Curve data + emit queue tail (single buffer, 8th binding)
    curveData: new StorageBufferAttribute(combined, 1),
  };
}

// ─── CPU → GPU Sync Helpers (Emit Queue in curveData tail) ──────────────────

/** Per-pipeline frame-local emit count, keyed by curveData buffer identity. */
const _emitCounts = new WeakMap<StorageBufferAttribute, number>();
/** Per-pipeline stored curveDataLength for emit queue offset. */
const _curveDataLengths = new WeakMap<StorageBufferAttribute, number>();

/**
 * Queues a newly emitted particle for GPU initialisation.
 *
 * Instead of writing directly to GPU-computed storage buffers (which would
 * require a full-buffer upload that overwrites GPU results for all particles),
 * this appends the emit data to the tail of the `curveData` buffer.  The
 * compute shader scatter-copies queue entries into the main buffers before
 * simulation.
 *
 * Also writes to the CPU-only `startValues` and `startColorsExt` arrays (safe
 * to upload because the GPU only reads them).
 */
export function writeParticleToModifierBuffers(
  buffers: ModifierStorageBuffers,
  index: number,
  data: {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    startLifetime: number;
    colorA: number;
    size: number;
    rotation: number;
    colorR: number;
    colorG: number;
    colorB: number;
    startSize: number;
    startOpacity: number;
    startColorR: number;
    startColorG: number;
    startColorB: number;
    startFrame: number;
    rotationSpeed: number;
    noiseOffset: number;
    orbitalOffset: { x: number; y: number; z: number };
  }
): void {
  // ── Append to emit queue (in curveData tail) ──
  const count = _emitCounts.get(buffers.curveData) ?? 0;
  if (count >= MAX_EMITS_PER_FRAME) return; // overflow guard

  const curveLen = _curveDataLengths.get(buffers.curveData) ?? 0;
  const arr = buffers.curveData.array as Float32Array;
  // +1 to skip the emit count slot
  const base = curveLen + 1 + count * EMIT_STRIDE;
  arr[base] = index;
  arr[base + 1] = data.position.x;
  arr[base + 2] = data.position.y;
  arr[base + 3] = data.position.z;
  arr[base + 4] = data.velocity.x;
  arr[base + 5] = data.velocity.y;
  arr[base + 6] = data.velocity.z;
  arr[base + 7] = data.startLifetime;
  arr[base + 8] = data.startSize;
  arr[base + 9] = data.startOpacity;
  arr[base + 10] = data.startColorR;
  arr[base + 11] = data.startColorG;
  arr[base + 12] = data.startColorB;
  arr[base + 13] = data.colorA;
  arr[base + 14] = data.size;
  arr[base + 15] = data.rotation;
  arr[base + 16] = data.startFrame;
  arr[base + 17] = data.rotationSpeed;
  arr[base + 18] = data.noiseOffset;
  arr[base + 19] = data.orbitalOffset.x;
  arr[base + 20] = data.orbitalOffset.y;
  arr[base + 21] = data.orbitalOffset.z;
  // 22-23 padding (unused)

  _emitCounts.set(buffers.curveData, count + 1);

  // ── Write to CPU-only buffers (safe — GPU only reads these) ──
  const i4 = index * 4;

  const svArr = buffers.startValues.array as Float32Array;
  svArr[i4] = data.startLifetime;
  svArr[i4 + 1] = data.startSize;
  svArr[i4 + 2] = data.startOpacity;
  svArr[i4 + 3] = data.startColorR;

  const sceArr = buffers.startColorsExt.array as Float32Array;
  sceArr[i4] = data.startColorG;
  sceArr[i4 + 1] = data.startColorB;
  sceArr[i4 + 2] = data.rotationSpeed;
  sceArr[i4 + 3] = data.noiseOffset;
}

/**
 * Registers the curveDataLength for a buffer so the emit queue helpers know
 * where the queue region starts.  Called once during pipeline creation.
 */
export function registerCurveDataLength(
  buffers: ModifierStorageBuffers,
  curveDataLength: number
): void {
  _curveDataLengths.set(buffers.curveData, curveDataLength);
}

/**
 * Flushes the emit queue to the GPU and resets the frame-local counter.
 *
 * Must be called once per frame **before** compute dispatch.
 *
 * @returns The number of emits flushed (for diagnostics).
 */
export function flushEmitQueue(buffers: ModifierStorageBuffers): number {
  const count = _emitCounts.get(buffers.curveData) ?? 0;
  const curveLen = _curveDataLengths.get(buffers.curveData) ?? 0;

  // Write the emit count into the curveData array at the designated slot
  const arr = buffers.curveData.array as Float32Array;
  arr[curveLen] = count;

  if (count > 0) {
    buffers.curveData.needsUpdate = true;
    buffers.startValues.needsUpdate = true;
    buffers.startColorsExt.needsUpdate = true;
  }

  _emitCounts.set(buffers.curveData, 0);
  return count;
}

/**
 * Deactivates a particle on the CPU side for freeList management.
 *
 * The GPU compute shader handles the actual deactivation (zeroing isActive
 * and color) via its death check. This function only updates CPU bookkeeping
 * arrays without triggering a buffer upload that would overwrite GPU state.
 */
export function deactivateParticleInModifierBuffers(
  _buffers: ModifierStorageBuffers,
  _index: number
): void {
  // No-op: GPU handles deactivation in the compute shader death check.
  // Previously this wrote to orbitalIsActive and color buffers with
  // needsUpdate = true, which caused full-buffer uploads that overwrote
  // GPU-computed values for all particles.
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

  // ── Storage buffer nodes (8 bindings, within WebGPU per-stage limit) ──

  const sPosition = storage(buffers.position, 'vec4', maxParticles);
  const sVelocity = storage(buffers.velocity, 'vec4', maxParticles);
  const sColor = storage(buffers.color, 'vec4', maxParticles);
  // particleState: (lifetime, size, rotation, startFrame)
  const sParticleState = storage(buffers.particleState, 'vec4', maxParticles);
  // startValues: (startLifetime, startSize, startOpacity, startColorR)
  const sStartValues = storage(buffers.startValues, 'vec4', maxParticles);
  // startColorsExt: (startColorG, startColorB, rotationSpeed, noiseOffset)
  const sStartColorsExt = storage(buffers.startColorsExt, 'vec4', maxParticles);
  // orbitalIsActive: (offsetX, offsetY, offsetZ, isActive)
  const sOrbitalIsActive = storage(
    buffers.orbitalIsActive,
    'vec4',
    maxParticles
  );
  // curveData + emit queue tail (single buffer)
  const sCurveData = storage(
    buffers.curveData,
    'float',
    buffers.curveData.array.length
  );

  // Emit queue layout constants (compile-time offsets into sCurveData)
  const curveLen = Math.max(curveMap.data.length, 1);
  const emitCountIdx = curveLen; // index of emit count in sCurveData
  const emitQueueStart = curveLen + 1; // first emit entry in sCurveData

  const lookupCurve = createCurveLookup(sCurveData);

  // ── Compute kernel ──
  //
  // Packed field mapping:
  //   particleState: x=lifetime, y=size, z=rotation, w=startFrame
  //   startValues: x=startLifetime, y=startSize, z=startOpacity, w=startColorR
  //   startColorsExt: x=startColorG, y=startColorB, z=rotationSpeed, w=noiseOffset
  //   orbitalIsActive: xyz=orbitalOffset, w=isActive

  const computeKernel = Fn(() => {
    const i = instanceIndex;

    // ── Emit scatter: initialise newly emitted particles from the queue ──
    // The emit queue lives at the tail of sCurveData:
    //   sCurveData[emitCountIdx]       = emit count (float → int)
    //   sCurveData[emitQueueStart + j*EMIT_STRIDE + field] = emit data
    // Scans the (typically tiny) queue to find entries targeting this
    // particle index. O(N × M) where M = emits/frame (usually 1-10).
    const iInt = i.toInt();
    const emitCount = int(sCurveData.element(emitCountIdx));
    Loop(
      { end: emitCount, name: 'j', type: 'int', condition: '<' },
      ({ j }: { j: ShaderNodeObject<Node> }) => {
        const qBase = int(j).mul(EMIT_STRIDE).add(emitQueueStart);
        const qIdx = int(sCurveData.element(qBase));
        If(qIdx.equal(iInt), () => {
          // Position
          sPosition
            .element(i)
            .assign(
              vec4(
                sCurveData.element(qBase.add(1)),
                sCurveData.element(qBase.add(2)),
                sCurveData.element(qBase.add(3)),
                0
              )
            );
          // Velocity
          sVelocity
            .element(i)
            .assign(
              vec4(
                sCurveData.element(qBase.add(4)),
                sCurveData.element(qBase.add(5)),
                sCurveData.element(qBase.add(6)),
                0
              )
            );
          // startValues and startColorsExt are CPU-only buffers uploaded via
          // needsUpdate in flushEmitQueue — no GPU scatter needed for them.

          // Color: (R, G, B, A)
          sColor.element(i).assign(
            vec4(
              sCurveData.element(qBase.add(10)), // startColorR
              sCurveData.element(qBase.add(11)), // startColorG
              sCurveData.element(qBase.add(12)), // startColorB
              sCurveData.element(qBase.add(13)) // colorA
            )
          );
          // particleState: (lifetime=0, size, rotation, startFrame)
          sParticleState.element(i).assign(
            vec4(
              0,
              sCurveData.element(qBase.add(14)), // size
              sCurveData.element(qBase.add(15)), // rotation
              sCurveData.element(qBase.add(16)) // startFrame
            )
          );
          // orbitalIsActive: (offsetX, offsetY, offsetZ, isActive=1)
          sOrbitalIsActive
            .element(i)
            .assign(
              vec4(
                sCurveData.element(qBase.add(19)),
                sCurveData.element(qBase.add(20)),
                sCurveData.element(qBase.add(21)),
                1.0
              )
            );
          Break();
        });
      }
    );

    // Read orbitalIsActive to check isActive (w component)
    const oiaVec = sOrbitalIsActive.element(i).toVar();
    If(oiaVec.w.lessThan(0.5), () => {
      return;
    });

    // Read packed state
    // Position/velocity stored as vec4 (w=padding) for WebGPU alignment;
    // operate on .xyz only.
    const pos = sPosition.element(i).xyz.toVar();
    const vel = sVelocity.element(i).xyz.toVar();
    const ps = sParticleState.element(i).toVar();
    const sv = sStartValues.element(i);

    // Aliases for readability
    const life = ps.x; // lifetime
    const startLife = sv.x; // startLifetime

    // === CORE PHYSICS ===

    // Gravity
    vel.assign(vel.sub(vec3(uGravityVelocity).mul(uDelta)));

    // Force fields
    if (forceFieldNodes) {
      forceFieldNodes.apply({ pos, vel, delta: uDelta });
    }

    // World-space compensation
    If(uSimSpaceWorld.greaterThan(0.5), () => {
      pos.assign(pos.sub(vec3(uWorldPositionChange)));
    });

    // Velocity integration
    pos.assign(pos.add(vel.mul(uDelta)));

    // Lifetime percentage for modifiers (computed before lifetime update
    // to match the CPU path, which reads lifetime before incrementing it)
    const lifePct = tslMin(ps.x.div(startLife), float(1.0));

    // Lifetime update
    ps.x.assign(ps.x.add(uDeltaMs));

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
      const offset = vec3(oiaVec.x, oiaVec.y, oiaVec.z).toVar();
      pos.assign(pos.sub(offset));

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

      const ax = ovx.mul(uDelta);
      const ay = ovy.mul(uDelta);
      const az = ovz.mul(uDelta);

      // Rotate around X
      const cosAx = cos(ax);
      const sinAx = sin(ax);
      const ry1 = offset.y.mul(cosAx).sub(offset.z.mul(sinAx));
      const rz1 = offset.y.mul(sinAx).add(offset.z.mul(cosAx));
      offset.assign(vec3(offset.x, ry1, rz1));

      // Rotate around Z
      const cosAz = cos(az);
      const sinAz = sin(az);
      const rx2 = offset.x.mul(cosAz).sub(offset.y.mul(sinAz));
      const ry2 = offset.x.mul(sinAz).add(offset.y.mul(cosAz));
      offset.assign(vec3(rx2, ry2, offset.z));

      // Rotate around Y
      const cosAy = cos(ay);
      const sinAy = sin(ay);
      const rx3 = offset.x.mul(cosAy).add(offset.z.mul(sinAy));
      const rz3 = offset.x.negate().mul(sinAy).add(offset.z.mul(cosAy));
      offset.assign(vec3(rx3, offset.y, rz3));

      // Write back orbital offset (xyz), keep isActive (w)
      oiaVec.x.assign(offset.x);
      oiaVec.y.assign(offset.y);
      oiaVec.z.assign(offset.z);
      pos.assign(pos.add(offset));
    }

    // 3. Size Over Lifetime (ps.y = size, sv.y = startSize)
    if (flags.sizeOverLifetime && curveMap.sizeOverLifetime >= 0) {
      const multiplier = lookupCurve({
        curveIndex: float(curveMap.sizeOverLifetime),
        t: lifePct,
      });
      ps.y.assign(sv.y.mul(multiplier));
    }

    // 4. Opacity Over Lifetime (sv.z = startOpacity)
    if (flags.opacityOverLifetime && curveMap.opacityOverLifetime >= 0) {
      const multiplier = lookupCurve({
        curveIndex: float(curveMap.opacityOverLifetime),
        t: lifePct,
      });
      const col = sColor.element(i).toVar();
      col.w.assign(sv.z.mul(multiplier));
      sColor.element(i).assign(col);
    }

    // 5. Color Over Lifetime
    //    sv.w = startColorR, startColorsExt.x = startColorG, .y = startColorB
    if (flags.colorOverLifetime) {
      const col = sColor.element(i).toVar();
      const sce = sStartColorsExt.element(i);
      if (curveMap.colorR >= 0) {
        const rMul = lookupCurve({
          curveIndex: float(curveMap.colorR),
          t: lifePct,
        });
        col.x.assign(sv.w.mul(rMul));
      }
      if (curveMap.colorG >= 0) {
        const gMul = lookupCurve({
          curveIndex: float(curveMap.colorG),
          t: lifePct,
        });
        col.y.assign(sce.x.mul(gMul));
      }
      if (curveMap.colorB >= 0) {
        const bMul = lookupCurve({
          curveIndex: float(curveMap.colorB),
          t: lifePct,
        });
        col.z.assign(sce.y.mul(bMul));
      }
      sColor.element(i).assign(col);
    }

    // 6. Rotation Over Lifetime (startColorsExt.z = rotationSpeed, ps.z = rotation)
    if (flags.rotationOverLifetime) {
      const sce = sStartColorsExt.element(i);
      ps.z.assign(ps.z.add(sce.z.mul(uDelta).mul(float(0.02))));
    }

    // 7. Noise (startColorsExt.w = noiseOffset)
    if (flags.noise) {
      const sce = sStartColorsExt.element(i);
      const noisePos = lifePct.add(sce.w).mul(10.0).mul(uNoiseStrength);

      const noiseX = snoise3D({ v: vec3(noisePos, float(0), float(0)) });
      const noiseY = snoise3D({
        v: vec3(noisePos, noisePos, float(0)),
      });
      const noiseZ = snoise3D({
        v: vec3(noisePos, noisePos, noisePos),
      });

      // Apply to position
      pos.assign(
        pos.add(
          vec3(noiseX, noiseY, noiseZ).mul(uNoisePower).mul(uNoisePosAmount)
        )
      );

      // Apply to rotation (ps.z)
      If(uNoiseRotAmount.greaterThan(0.001), () => {
        ps.z.assign(ps.z.add(noiseX.mul(uNoisePower).mul(uNoiseRotAmount)));
      });

      // Apply to size (ps.y)
      If(uNoiseSizeAmount.greaterThan(0.001), () => {
        ps.y.assign(ps.y.add(noiseX.mul(uNoisePower).mul(uNoiseSizeAmount)));
      });
    }

    // === WRITE BACK ===

    sPosition.element(i).assign(vec4(pos, 0));
    sVelocity.element(i).assign(vec4(vel, 0));
    sParticleState.element(i).assign(ps);
    sOrbitalIsActive.element(i).assign(oiaVec);

    // Death check
    If(ps.x.greaterThan(startLife), () => {
      // Set isActive = 0 and zero color
      const deadOia = sOrbitalIsActive.element(i).toVar();
      deadOia.w.assign(float(0));
      sOrbitalIsActive.element(i).assign(deadOia);
      sColor.element(i).assign(vec4(0));
    });
  });

  const computeNode = compute(computeKernel(), maxParticles);

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
    curveDataLength: curveLen,
    /** Force field buffer and count uniform (null if no force fields). */
    forceFieldNodes: forceFieldNodes
      ? {
          buffer: forceFieldNodes.buffer,
          countUniform: forceFieldNodes.countUniform,
        }
      : null,
  };
}
