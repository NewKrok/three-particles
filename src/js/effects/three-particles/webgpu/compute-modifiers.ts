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

import {
  createCollisionPlaneTSL,
  COLLISION_PLANE_DATA_SIZE,
} from './compute-collision-planes.js';
import {
  createForceFieldTSL,
  FORCE_FIELD_DATA_SIZE,
} from './compute-force-fields.js';
import { CURVE_RESOLUTION } from './curve-bake.js';
import { snoise3D } from './tsl-noise.js';
import type { BakedCurveMap } from './curve-bake.js';

// ─── Per-Particle Init Data Constants ────────────────────────────────────────

/**
 * Number of floats per particle in the init-data region of the curveData buffer.
 *
 * Layout (28 floats = 7 vec4s):
 *   0:   position.x
 *   1:   position.y
 *   2:   position.z
 *   3:   initFlag (0.0 = no init, 1.0 = needs init)
 *   4:   velocity.x
 *   5:   velocity.y
 *   6:   velocity.z
 *   7:   (padding)
 *   8:   color.R
 *   9:   color.G
 *   10:  color.B
 *   11:  color.A
 *   12:  particleState.x (lifetime = 0)
 *   13:  particleState.y (size)
 *   14:  particleState.z (rotation)
 *   15:  particleState.w (startFrame)
 *   16:  orbitalOffset.x
 *   17:  orbitalOffset.y
 *   18:  orbitalOffset.z
 *   19:  isActive (= 1.0)
 *   20:  startValues.x (startLifetime)
 *   21:  startValues.y (startSize)
 *   22:  startValues.z (startOpacity)
 *   23:  startValues.w (startColorR)
 *   24:  startColorsExt.x (startColorG)
 *   25:  startColorsExt.y (startColorB)
 *   26:  startColorsExt.z (rotationSpeed)
 *   27:  startColorsExt.w (noiseOffset)
 *
 * Each particle has its own fixed slot at `curveLen + particleIndex * INIT_STRIDE`.
 * The compute shader reads `initFlag` (offset 3) for particle `i`; if 1.0 it
 * copies the init data into the main buffers.  This is O(1) per particle —
 * no queue scanning needed.
 *
 * startValues and startColorsExt are included in the init block (rather than
 * using full-buffer CPU uploads) to prevent overwriting active particle data
 * when a particle slot is recycled on the CPU before the GPU has processed
 * its death check.
 */
export const INIT_STRIDE = 28;

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
  collisionPlanes: boolean;
};

/** Per-frame modifier uniform values. */
export type ModifierUniforms = {
  delta: ShaderNodeObject<Node>;
  deltaMs: ShaderNodeObject<Node>;
  gravityVelocity: ShaderNodeObject<Node>;
  // Noise uniforms
  noiseStrength: ShaderNodeObject<Node>;
  noisePower: ShaderNodeObject<Node>;
  noiseFrequency: ShaderNodeObject<Node>;
  noisePositionAmount: ShaderNodeObject<Node>;
  noiseRotationAmount: ShaderNodeObject<Node>;
  noiseSizeAmount: ShaderNodeObject<Node>;
};

/**
 * GPU storage buffers for the modifier compute pipeline.
 *
 * 8 bindings (within the WebGPU per-stage limit):
 *   1. position (vec4) — render + compute
 *   2. velocity (vec4) — compute-only
 *   3. color (vec4: R,G,B,A) — render + compute
 *   4. particleState (vec4: lifetime, size, rotation, startFrame) — render + compute
 *   5. startValues (vec4: startLifetime, startSize, startOpacity, startColorR) — compute + render(.x)
 *   6. startColorsExt (vec4: startColorG, startColorB, rotationSpeed, noiseOffset) — compute-only
 *   7. orbitalIsActive (vec4: offsetX, offsetY, offsetZ, isActive) — compute-only
 *   8. curveData (float[]) — compute-only; carries per-particle init data at the end
 *
 * Per-particle init data is appended to the curveData buffer to avoid
 * exceeding the 8-storage-buffer per-stage limit.  Layout:
 *   [0 .. curveLen-1]                            baked curve samples
 *   [curveLen + i*INIT_STRIDE .. +INIT_STRIDE-1] init data for particle i
 *
 * The compute shader checks initFlag (offset 3 within each particle's slot)
 * and copies init data to the main buffers in O(1) per particle.
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
  /** Offset into curveData where per-particle init data begins (= baked curve data length). */
  curveDataLength: number;
  /** Force field metadata for runtime updates (null if no force fields). */
  forceFieldInfo: {
    /** Float offset into curveData where force field data starts. */
    offset: number;
    /** Uniform for the active force field count. */
    countUniform: ShaderNodeObject<Node>;
  } | null;
  /** Collision plane metadata for runtime updates (null if no collision planes). */
  collisionPlaneInfo: {
    /** Float offset into curveData where collision plane data starts. */
    offset: number;
    /** Uniform for the active collision plane count. */
    countUniform: ShaderNodeObject<Node>;
  } | null;
};

// ─── Storage Buffer Creation ─────────────────────────────────────────────────

/**
 * Creates GPU storage buffers for the full modifier compute pipeline.
 * Extends the Phase 2 buffers with modifier-specific data.
 *
 * @param hasForceFields - If true, reserves space for force field data at the
 *   end of the curveData buffer (after baked curves + per-particle init data).
 * @param hasCollisionPlanes - If true, reserves space for collision plane data
 *   at the end of the curveData buffer (after force field data).
 */
export function createModifierStorageBuffers(
  maxParticles: number,
  instanced: boolean,
  curveData: Float32Array,
  hasForceFields = false,
  hasCollisionPlanes = false
): ModifierStorageBuffers {
  const Cls = instanced
    ? StorageInstancedBufferAttribute
    : StorageBufferAttribute;

  // curveData buffer layout:
  //   [0 .. curveLen-1]                             baked curve samples
  //   [curveLen + i*INIT_STRIDE .. +INIT_STRIDE-1]  init data for particle i
  //   [curveLen + maxP*INIT_STRIDE .. +FF_SIZE-1]   force field data (if enabled)
  //   [... + FF_SIZE .. +CP_SIZE-1]                 collision plane data (if enabled)
  //
  // Each particle has a fixed slot — O(1) lookup in the compute shader.
  // Force field and collision plane data are appended at the end to stay
  // within the 8 storage buffer per-stage limit.
  const curveLen = Math.max(curveData.length, 1);
  const ffSize = hasForceFields ? FORCE_FIELD_DATA_SIZE : 0;
  const cpSize = hasCollisionPlanes ? COLLISION_PLANE_DATA_SIZE : 0;
  const totalLen = curveLen + maxParticles * INIT_STRIDE + ffSize + cpSize;
  const combined = new Float32Array(totalLen);
  combined.set(curveData.length > 0 ? curveData : new Float32Array([0]));
  // All init flags start at 0 (no init needed)

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

// ─── CPU → GPU Sync Helpers (per-particle init data in curveData tail) ──────

/** Per-pipeline frame-local emit count, keyed by curveData buffer identity. */
const _emitCounts = new WeakMap<StorageBufferAttribute, number>();
/** Per-pipeline stored curveDataLength for init data offset. */
const _curveDataLengths = new WeakMap<StorageBufferAttribute, number>();
/** Particle indices emitted this frame. */
const _currentEmitIndices = new WeakMap<StorageBufferAttribute, number[]>();
/** Particle indices emitted in the previous frame (need their initFlags cleared). */
const _previousEmitIndices = new WeakMap<StorageBufferAttribute, number[]>();

/**
 * Writes init data for a newly emitted particle into its per-particle slot
 * in the curveData buffer tail.
 *
 * The compute shader checks `initFlag` (offset 3 within each particle's slot)
 * and copies init data into the main storage buffers in O(1) per particle.
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
  // ── Write to per-particle init slot in curveData tail ──
  const curveLen = _curveDataLengths.get(buffers.curveData) ?? 0;
  const arr = buffers.curveData.array as Float32Array;
  const base = curveLen + index * INIT_STRIDE;

  // vec4: position.xyz + initFlag
  arr[base] = data.position.x;
  arr[base + 1] = data.position.y;
  arr[base + 2] = data.position.z;
  arr[base + 3] = 1.0; // initFlag = 1 (needs init)
  // vec4: velocity.xyz + padding
  arr[base + 4] = data.velocity.x;
  arr[base + 5] = data.velocity.y;
  arr[base + 6] = data.velocity.z;
  arr[base + 7] = 0;
  // vec4: color RGBA
  arr[base + 8] = data.colorR;
  arr[base + 9] = data.colorG;
  arr[base + 10] = data.colorB;
  arr[base + 11] = data.colorA;
  // vec4: particleState (lifetime=0, size, rotation, startFrame)
  arr[base + 12] = 0;
  arr[base + 13] = data.size;
  arr[base + 14] = data.rotation;
  arr[base + 15] = data.startFrame;
  // vec4: orbitalIsActive (offsetX, offsetY, offsetZ, isActive=1)
  arr[base + 16] = data.orbitalOffset.x;
  arr[base + 17] = data.orbitalOffset.y;
  arr[base + 18] = data.orbitalOffset.z;
  arr[base + 19] = 1.0;
  // vec4: startValues (startLifetime, startSize, startOpacity, startColorR)
  arr[base + 20] = data.startLifetime;
  arr[base + 21] = data.startSize;
  arr[base + 22] = data.startOpacity;
  arr[base + 23] = data.startColorR;
  // vec4: startColorsExt (startColorG, startColorB, rotationSpeed, noiseOffset)
  arr[base + 24] = data.startColorG;
  arr[base + 25] = data.startColorB;
  arr[base + 26] = data.rotationSpeed;
  arr[base + 27] = data.noiseOffset;

  _emitCounts.set(
    buffers.curveData,
    (_emitCounts.get(buffers.curveData) ?? 0) + 1
  );

  // Track this particle's index so its initFlag can be cleared in the CPU
  // array before the next upload (preventing re-initialization from stale data).
  let indices = _currentEmitIndices.get(buffers.curveData);
  if (!indices) {
    indices = [];
    _currentEmitIndices.set(buffers.curveData, indices);
  }
  indices.push(index);

  // ── Write to CPU-side arrays (kept in sync for diagnostics / fallback) ──
  // These arrays are NOT uploaded to the GPU (no needsUpdate); the compute
  // shader's init block scatters the values from the curveData init slot.
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
 * Registers the curveDataLength for a buffer so the init data helpers know
 * where the per-particle init region starts.  Called once during pipeline creation.
 */
export function registerCurveDataLength(
  buffers: ModifierStorageBuffers,
  curveDataLength: number
): void {
  _curveDataLengths.set(buffers.curveData, curveDataLength);
}

/**
 * Flushes pending init data to the GPU and resets the frame-local counter.
 *
 * Must be called once per frame **before** compute dispatch.
 *
 * @returns The number of emits flushed (for diagnostics).
 */
export function flushEmitQueue(buffers: ModifierStorageBuffers): number {
  const count = _emitCounts.get(buffers.curveData) ?? 0;
  const curveLen = _curveDataLengths.get(buffers.curveData) ?? 0;
  const arr = buffers.curveData.array as Float32Array;

  // Clear initFlags for particles emitted in the PREVIOUS frame that are
  // NOT being re-emitted this frame.  This is O(emittedLastFrame) instead
  // of the old O(maxParticles) full-scan approach, while preserving the
  // same correctness guarantee:
  //
  // A particle that dies and is re-emitted within a single frame keeps its
  // fresh initFlag=1 because it appears in the current set and is excluded
  // from clearing.  This avoids the race condition where a delayed clear
  // from the first emission would overwrite the fresh initFlag=1 from the
  // re-emission — causing the GPU to never initialise the particle, which
  // then rendered with stale data (wrong color/position).
  //
  // We use `addUpdateRange()` so the WebGPU backend only uploads the
  // per-particle init slots that actually changed this frame. A blanket
  // `needsUpdate = true` without ranges would re-upload the entire
  // `curveData` buffer, stomping on init flags the compute shader has
  // already cleared on the GPU side — which previously caused already-
  // initialised particles to be re-initialised with stale data, producing
  // visible jumps and resets on systems with live emission.
  const current = _currentEmitIndices.get(buffers.curveData);
  const previous = _previousEmitIndices.get(buffers.curveData);

  let clearedAny = false;

  if (previous && previous.length > 0) {
    const currentSet = current && current.length > 0 ? new Set(current) : null;
    for (let i = 0; i < previous.length; i++) {
      const p = previous[i];
      if (!currentSet || !currentSet.has(p)) {
        const flagOffset = curveLen + p * INIT_STRIDE + 3;
        if (arr[flagOffset] > 0.5) {
          arr[flagOffset] = 0;
          buffers.curveData.addUpdateRange(flagOffset, 1);
          clearedAny = true;
        }
      }
    }
  }

  // Mark the freshly emitted slots as needing upload (their entire
  // INIT_STRIDE worth of data was just filled in by
  // writeParticleToModifierBuffers).
  if (current && current.length > 0) {
    for (let i = 0; i < current.length; i++) {
      const p = current[i];
      const slotStart = curveLen + p * INIT_STRIDE;
      buffers.curveData.addUpdateRange(slotStart, INIT_STRIDE);
    }
  }

  if (count > 0 || clearedAny) {
    buffers.curveData.needsUpdate = true;
  }

  // NOTE: startValues and startColorsExt are NO LONGER uploaded via
  // needsUpdate here.  Their init data is now carried inside each
  // particle's curveData init slot and scattered to the GPU storage
  // buffers by the compute shader's init block.  This prevents a
  // full-buffer upload from overwriting startValues of particles that
  // are still alive on the GPU but have already been recycled on the
  // CPU (due to CPU/GPU death-timing desync).

  // Rotate: current becomes previous for next frame
  if (current && current.length > 0) {
    // Copy current into previous (reuse array if possible)
    let prevArr = _previousEmitIndices.get(buffers.curveData);
    if (!prevArr) {
      prevArr = [];
      _previousEmitIndices.set(buffers.curveData, prevArr);
    }
    prevArr.length = current.length;
    for (let i = 0; i < current.length; i++) {
      prevArr[i] = current[i];
    }
    current.length = 0;
  } else {
    // No emissions this frame — clear previous
    const prevArr = _previousEmitIndices.get(buffers.curveData);
    if (prevArr) prevArr.length = 0;
    if (current) current.length = 0;
  }

  _emitCounts.set(buffers.curveData, 0);
  return count;
}

/**
 * Deactivates a particle on both the CPU mirror and the GPU buffers.
 *
 * The CPU runs its own lifetime tracking (wall-clock based) which may
 * deactivate a particle one or more frames before the GPU-side death
 * check (accumulated `delta` based) would. Between the CPU decision and
 * the next compute dispatch, the particle is already on the free list and
 * can be re-emitted into its old slot via `writeParticleToModifierBuffers`
 * — if the GPU hadn't yet cleared `orbitalIsActive.w` and `color.w`, the
 * compute shader would re-initialise an already-active slot and produce a
 * visible teleport. To avoid that we zero the `isActive` and `colorA`
 * entries for this slot directly on the CPU mirrors and submit narrow
 * `addUpdateRange` upload regions, so the GPU state matches by the next
 * dispatch.
 */
export function deactivateParticleInModifierBuffers(
  buffers: ModifierStorageBuffers,
  index: number
): void {
  // orbitalIsActive layout: (offsetX, offsetY, offsetZ, isActive). Zero the
  // w component (last float of the vec4 slot).
  const oiaArr = buffers.orbitalIsActive.array as Float32Array;
  const oiaWOffset = index * 4 + 3;
  if (oiaArr[oiaWOffset] !== 0) {
    oiaArr[oiaWOffset] = 0;
    buffers.orbitalIsActive.addUpdateRange(oiaWOffset, 1);
    buffers.orbitalIsActive.needsUpdate = true;
  }

  // color layout: (r, g, b, a). Zero the alpha so the render-side
  // `aColor.w > 0` dead-particle cull kicks in immediately.
  const colorArr = buffers.color.array as Float32Array;
  const colorAOffset = index * 4 + 3;
  if (colorArr[colorAOffset] !== 0) {
    colorArr[colorAOffset] = 0;
    buffers.color.addUpdateRange(colorAOffset, 1);
    buffers.color.needsUpdate = true;
  }
}

// ─── Curve Lookup Helper ─────────────────────────────────────────────────────

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
  forceFieldCount = 0,
  collisionPlaneCount = 0
): ModifierComputePipeline {
  // ── Per-frame uniforms ──

  const uDelta = uniform(float(0));
  const uDeltaMs = uniform(float(0));
  const uGravityVelocity = uniform(new Vector3(0, 0, 0));
  const uNoiseStrength = uniform(float(0));
  const uNoisePower = uniform(float(0));
  const uNoiseFrequency = uniform(float(1));
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
  // curveData + per-particle init data tail + force field data (single buffer)
  const sCurveData = storage(
    buffers.curveData,
    'float',
    buffers.curveData.array.length
  );

  // Per-particle init data layout constants (compile-time offsets into sCurveData)
  const curveLen = Math.max(curveMap.data.length, 1);

  const lookupCurve = createCurveLookup(sCurveData);

  // ── Force field nodes (reads from curveData tail, no extra binding) ──
  const forceFieldOffset = curveLen + maxParticles * INIT_STRIDE;
  const forceFieldNodes = flags.forceFields
    ? createForceFieldTSL(sCurveData, forceFieldOffset, forceFieldCount)
    : null;

  // ── Collision plane nodes (reads from curveData tail, after force fields) ──
  const ffSize = flags.forceFields ? FORCE_FIELD_DATA_SIZE : 0;
  const collisionPlaneOffset = forceFieldOffset + ffSize;
  const collisionPlaneNodes = flags.collisionPlanes
    ? createCollisionPlaneTSL(
        sCurveData,
        collisionPlaneOffset,
        collisionPlaneCount
      )
    : null;

  // ── Compute kernel ──
  //
  // Packed field mapping:
  //   particleState: x=lifetime, y=size, z=rotation, w=startFrame
  //   startValues: x=startLifetime, y=startSize, z=startOpacity, w=startColorR
  //   startColorsExt: x=startColorG, y=startColorB, z=rotationSpeed, w=noiseOffset
  //   orbitalIsActive: xyz=orbitalOffset, w=isActive

  const computeKernel = Fn(() => {
    const i = instanceIndex;

    // Bounds check — the WebGPU compute dispatch rounds up to full workgroups
    // (typically 64 threads), so when `maxParticles` is not a multiple of the
    // workgroup size the last few threads run with indices i >= maxParticles.
    // Without this guard those threads would:
    //   1. Write out-of-bounds on the per-particle storage buffers (size =
    //      maxParticles) — technically silently-clamped but wastes work.
    //   2. Read/write at `curveLen + i * INIT_STRIDE + 3` which for
    //      i == maxParticles lands exactly on the first collision plane's
    //      position.y (since `collisionPlaneOffset = curveLen + maxParticles *
    //      INIT_STRIDE`), corrupting the plane data on every frame.
    //
    // Using `If(i < maxParticles)` as a top-level guard is equivalent to an
    // early-return in TSL (return inside Fn callbacks does not emit a WGSL
    // return statement).
    If(i.lessThan(float(maxParticles)), () => {
    // ── Per-particle init: O(1) lookup ──
    // Each particle has a fixed slot in curveData at:
    //   base = curveLen + i * INIT_STRIDE
    // If initFlag (offset 3) is 1.0, copy init data into main buffers.
    const initBase = i.mul(INIT_STRIDE).add(curveLen);

    const initFlag = sCurveData.element(initBase.add(3));
    If(initFlag.greaterThan(0.5), () => {
      // Position (vec4: xyz + padding)
      sPosition
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase),
            sCurveData.element(initBase.add(1)),
            sCurveData.element(initBase.add(2)),
            0
          )
        );
      // Velocity (vec4: xyz + padding)
      sVelocity
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase.add(4)),
            sCurveData.element(initBase.add(5)),
            sCurveData.element(initBase.add(6)),
            0
          )
        );
      // Color (vec4: RGBA)
      sColor
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase.add(8)),
            sCurveData.element(initBase.add(9)),
            sCurveData.element(initBase.add(10)),
            sCurveData.element(initBase.add(11))
          )
        );
      // particleState (vec4: lifetime=0, size, rotation, startFrame)
      sParticleState
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase.add(12)),
            sCurveData.element(initBase.add(13)),
            sCurveData.element(initBase.add(14)),
            sCurveData.element(initBase.add(15))
          )
        );
      // orbitalIsActive (vec4: offsetXYZ, isActive=1)
      sOrbitalIsActive
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase.add(16)),
            sCurveData.element(initBase.add(17)),
            sCurveData.element(initBase.add(18)),
            sCurveData.element(initBase.add(19))
          )
        );
      // startValues (vec4: startLifetime, startSize, startOpacity, startColorR)
      sStartValues
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase.add(20)),
            sCurveData.element(initBase.add(21)),
            sCurveData.element(initBase.add(22)),
            sCurveData.element(initBase.add(23))
          )
        );
      // startColorsExt (vec4: startColorG, startColorB, rotationSpeed, noiseOffset)
      sStartColorsExt
        .element(i)
        .assign(
          vec4(
            sCurveData.element(initBase.add(24)),
            sCurveData.element(initBase.add(25)),
            sCurveData.element(initBase.add(26)),
            sCurveData.element(initBase.add(27))
          )
        );

      // Clear the init flag so this particle isn't re-initialized next frame.
      // The CPU array was already uploaded this frame; mutating the GPU copy
      // here is fine because the CPU will only touch this slot again when
      // the particle is re-emitted (at which point it writes initFlag=1 again).
      sCurveData.element(initBase.add(3)).assign(float(0));
    });

    // Read orbitalIsActive to check isActive (w component).
    // NOTE: TSL `return` inside an If callback only exits the JS callback,
    // it does NOT generate a WGSL `return`.  We must wrap all active-particle
    // logic inside a positive If guard instead.
    const oiaVec = sOrbitalIsActive.element(i).toVar();
    If(oiaVec.w.greaterThanEqual(float(0.5)), () => {
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

      // Velocity integration
      //
      // WORLD simulation space: the particle buffer stores world-space
      //   coordinates. Gravity is a world-space vector, force fields are
      //   world-space, and emissions are pre-translated on the CPU.
      // LOCAL simulation space: the buffer is in the emitter's local frame;
      //   gravityVelocity is CPU-transformed into local space, and force
      //   field positions / directions are likewise pre-transformed.
      //
      // Either way, the kernel integrates pos += vel * dt without any
      // per-frame emitter-motion compensation.
      pos.assign(pos.add(vel.mul(uDelta)));

      // Collision planes — after position update, before modifiers
      if (collisionPlaneNodes) {
        collisionPlaneNodes.apply({
          pos,
          vel,
          oiaVec,
          sColorNode: sColor,
          ps,
          startLife,
          particleIdx: i,
          sOrbitalIsActiveNode: sOrbitalIsActive,
        });
      }

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

        // CPU uses Euler(speedX, speedZ, speedY, 'XYZ').  Intrinsic XYZ is
        // equivalent to extrinsic Z→Y→X, so we apply:
        //   1. Z rotation with angle = speedY (Euler.z)
        //   2. Y rotation with angle = speedZ (Euler.y)
        //   3. X rotation with angle = speedX (Euler.x)
        // We compute the full rotation into fresh variables to avoid
        // read-after-write hazards in TSL assign chains.
        const ax = ovx.mul(uDelta); // speedX
        const ay = ovz.mul(uDelta); // speedZ → Euler.y
        const az = ovy.mul(uDelta); // speedY → Euler.z

        // Step 1: Rotate around Z
        const cosAz = cos(az);
        const sinAz = sin(az);
        const zx = offset.x.mul(cosAz).sub(offset.y.mul(sinAz));
        const zy = offset.x.mul(sinAz).add(offset.y.mul(cosAz));
        const zz = offset.z;

        // Step 2: Rotate around Y (using Z-rotated values)
        const cosAy = cos(ay);
        const sinAy = sin(ay);
        const yx = zx.mul(cosAy).add(zz.mul(sinAy));
        const yy = zy;
        const yz = zx.negate().mul(sinAy).add(zz.mul(cosAy));

        // Step 3: Rotate around X (using Y-rotated values)
        const cosAx = cos(ax);
        const sinAx = sin(ax);
        const fx = yx;
        const fy = yy.mul(cosAx).sub(yz.mul(sinAx));
        const fz = yy.mul(sinAx).add(yz.mul(cosAx));

        offset.assign(vec3(fx, fy, fz));

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
        // Match CPU FBM input scaling: FBM internally multiplies by `this._scale = frequency`
        const noisePos = lifePct
          .add(sce.w)
          .mul(10.0)
          .mul(uNoiseStrength)
          .mul(uNoiseFrequency);

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
    }); // end If(i < maxParticles) bounds check
  });

  const computeNode = compute(computeKernel(), maxParticles);

  return {
    computeNode,
    uniforms: {
      delta: uDelta,
      deltaMs: uDeltaMs,
      gravityVelocity: uGravityVelocity,
      noiseStrength: uNoiseStrength,
      noisePower: uNoisePower,
      noiseFrequency: uNoiseFrequency,
      noisePositionAmount: uNoisePosAmount,
      noiseRotationAmount: uNoiseRotAmount,
      noiseSizeAmount: uNoiseSizeAmount,
    },
    buffers,
    curveDataLength: curveLen,
    /** Force field offset and count uniform (null if no force fields). */
    forceFieldInfo: forceFieldNodes
      ? {
          offset: forceFieldOffset,
          countUniform: forceFieldNodes.countUniform,
        }
      : null,
    /** Collision plane offset and count uniform (null if no collision planes). */
    collisionPlaneInfo: collisionPlaneNodes
      ? {
          offset: collisionPlaneOffset,
          countUniform: collisionPlaneNodes.countUniform,
        }
      : null,
  };
}

// ─── Pure-JS orbital rotation (mirrors GPU TSL logic) ───────────────────────

/**
 * Applies the same orbital velocity rotation used by the GPU compute shader.
 *
 * The CPU path uses `Euler(speedX, speedZ, speedY, 'XYZ')` which is intrinsic
 * XYZ = extrinsic Z→Y→X.  This function replicates that exact transformation
 * so it can be unit-tested against `Vector3.applyEuler`.
 *
 * @param offset - Mutable orbital offset {x, y, z}.  Modified in-place.
 * @param speedX - Orbital velocity around user-facing X axis.
 * @param speedY - Orbital velocity around user-facing Y axis.
 * @param speedZ - Orbital velocity around user-facing Z axis.
 * @param delta  - Frame delta in seconds.
 */
export function applyOrbitalRotation(
  offset: { x: number; y: number; z: number },
  speedX: number,
  speedY: number,
  speedZ: number,
  delta: number
): void {
  // Axis-angle mapping matches CPU: Euler(speedX, speedZ, speedY, 'XYZ')
  const ax = speedX * delta; // Euler.x
  const ay = speedZ * delta; // Euler.y
  const az = speedY * delta; // Euler.z

  // Extrinsic Z → Y → X  (equivalent to intrinsic XYZ)

  // Step 1: Rotate around Z
  const cosAz = Math.cos(az);
  const sinAz = Math.sin(az);
  const zx = offset.x * cosAz - offset.y * sinAz;
  const zy = offset.x * sinAz + offset.y * cosAz;
  const zz = offset.z;

  // Step 2: Rotate around Y
  const cosAy = Math.cos(ay);
  const sinAy = Math.sin(ay);
  const yx = zx * cosAy + zz * sinAy;
  const yy = zy;
  const yz = -zx * sinAy + zz * cosAy;

  // Step 3: Rotate around X
  const cosAx = Math.cos(ax);
  const sinAx = Math.sin(ax);
  offset.x = yx;
  offset.y = yy * cosAx - yz * sinAx;
  offset.z = yy * sinAx + yz * cosAx;
}
