import * as THREE from 'three';
import {
  ForceFieldFalloff,
  ForceFieldType,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  encodeForceFieldsForGPU,
  createForceFieldComputeNodes,
  MAX_FORCE_FIELDS,
} from '../js/effects/three-particles/webgpu/compute-force-fields.js';
import type { NormalizedForceFieldConfig } from '../js/effects/three-particles/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createPointField(
  overrides: Partial<NormalizedForceFieldConfig> = {}
): NormalizedForceFieldConfig {
  return {
    isActive: true,
    type: ForceFieldType.POINT,
    position: new THREE.Vector3(0, 5, 0),
    direction: new THREE.Vector3(0, 1, 0),
    strength: 3.0,
    range: 10,
    falloff: ForceFieldFalloff.LINEAR,
    ...overrides,
  };
}

function createDirectionalField(
  overrides: Partial<NormalizedForceFieldConfig> = {}
): NormalizedForceFieldConfig {
  return {
    isActive: true,
    type: ForceFieldType.DIRECTIONAL,
    position: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(1, 0, 0).normalize(),
    strength: 5.0,
    range: Infinity,
    falloff: ForceFieldFalloff.NONE,
    ...overrides,
  };
}

const FIELD_STRIDE = 12;

// ─── encodeForceFieldsForGPU ─────────────────────────────────────────────────

describe('encodeForceFieldsForGPU', () => {
  it('returns a Float32Array of MAX_FORCE_FIELDS * FIELD_STRIDE', () => {
    const data = encodeForceFieldsForGPU([], 0, 0);
    expect(data).toBeInstanceOf(Float32Array);
    expect(data.length).toBe(MAX_FORCE_FIELDS * FIELD_STRIDE);
  });

  it('encodes a POINT force field correctly', () => {
    const field = createPointField({
      position: new THREE.Vector3(1, 2, 3),
      strength: 7.5,
      range: 20,
      falloff: ForceFieldFalloff.QUADRATIC,
    });
    const data = encodeForceFieldsForGPU([field], 0, 0);

    expect(data[0]).toBe(1); // isActive
    expect(data[1]).toBe(0); // type = POINT
    expect(data[2]).toBe(1); // position.x
    expect(data[3]).toBe(2); // position.y
    expect(data[4]).toBe(3); // position.z
    expect(data[8]).toBe(7.5); // strength
    expect(data[9]).toBe(20); // range
    expect(data[10]).toBe(2); // falloff = QUADRATIC
  });

  it('encodes a DIRECTIONAL force field correctly', () => {
    const field = createDirectionalField({
      direction: new THREE.Vector3(0, -1, 0),
      strength: 2.0,
    });
    const data = encodeForceFieldsForGPU([field], 0, 0);

    expect(data[0]).toBe(1); // isActive
    expect(data[1]).toBe(1); // type = DIRECTIONAL
    expect(data[5]).toBe(0); // direction.x
    expect(data[6]).toBe(-1); // direction.y
    expect(data[7]).toBe(0); // direction.z
    expect(data[8]).toBe(2.0); // strength
  });

  it('encodes infinite range as 1e10', () => {
    const field = createPointField({ range: Infinity });
    const data = encodeForceFieldsForGPU([field], 0, 0);
    expect(data[9]).toBe(1e10);
  });

  it('encodes inactive fields with isActive = 0', () => {
    const field = createPointField({ isActive: false });
    const data = encodeForceFieldsForGPU([field], 0, 0);
    expect(data[0]).toBe(0);
  });

  it('encodes falloff types correctly', () => {
    const none = createPointField({ falloff: ForceFieldFalloff.NONE });
    const linear = createPointField({ falloff: ForceFieldFalloff.LINEAR });
    const quad = createPointField({ falloff: ForceFieldFalloff.QUADRATIC });

    expect(encodeForceFieldsForGPU([none], 0, 0)[10]).toBe(0);
    expect(encodeForceFieldsForGPU([linear], 0, 0)[10]).toBe(1);
    expect(encodeForceFieldsForGPU([quad], 0, 0)[10]).toBe(2);
  });

  it('encodes multiple force fields at correct offsets', () => {
    const fields = [
      createPointField({ strength: 1.0 }),
      createDirectionalField({ strength: 2.0 }),
    ];
    const data = encodeForceFieldsForGPU(fields, 0, 0);

    // First field
    expect(data[0]).toBe(1);
    expect(data[1]).toBe(0); // POINT
    expect(data[8]).toBe(1.0);

    // Second field at offset FIELD_STRIDE
    expect(data[FIELD_STRIDE]).toBe(1);
    expect(data[FIELD_STRIDE + 1]).toBe(1); // DIRECTIONAL
    expect(data[FIELD_STRIDE + 8]).toBe(2.0);
  });

  it('caps at MAX_FORCE_FIELDS', () => {
    const fields = Array.from({ length: 20 }, () => createPointField());
    const data = encodeForceFieldsForGPU(fields, 0, 0);
    // Buffer length is always MAX_FORCE_FIELDS * FIELD_STRIDE regardless of input count
    expect(data.length).toBe(MAX_FORCE_FIELDS * FIELD_STRIDE);
    // Last valid field (index MAX-1) should be encoded
    const lastBase = (MAX_FORCE_FIELDS - 1) * FIELD_STRIDE;
    expect(data[lastBase]).toBe(1); // isActive
  });

  it('evaluates constant strength', () => {
    const field = createPointField({ strength: 42 });
    const data = encodeForceFieldsForGPU([field], 0, 0);
    expect(data[8]).toBe(42);
  });

  it('evaluates random range strength', () => {
    const field = createPointField({ strength: { min: 5, max: 5 } });
    const data = encodeForceFieldsForGPU([field], 0, 0);
    expect(data[8]).toBe(5);
  });
});

// ─── createForceFieldComputeNodes ────────────────────────────────────────────

describe('createForceFieldComputeNodes', () => {
  it('returns buffer, countUniform, and apply function', () => {
    const nodes = createForceFieldComputeNodes(2);
    expect(nodes.buffer).toBeDefined();
    expect(nodes.buffer.array).toHaveLength(MAX_FORCE_FIELDS * FIELD_STRIDE);
    expect(nodes.countUniform).toBeDefined();
    expect(typeof nodes.apply).toBe('function');
  });

  it('works with 0 force fields', () => {
    const nodes = createForceFieldComputeNodes(0);
    expect(nodes.buffer).toBeDefined();
  });

  it('caps count at MAX_FORCE_FIELDS', () => {
    const nodes = createForceFieldComputeNodes(100);
    expect(nodes.buffer).toBeDefined();
  });
});

// ─── MAX_FORCE_FIELDS constant ───────────────────────────────────────────────

describe('MAX_FORCE_FIELDS', () => {
  it('is 16', () => {
    expect(MAX_FORCE_FIELDS).toBe(16);
  });
});
