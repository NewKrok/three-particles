import * as THREE from 'three';
import { storage } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import { CollisionPlaneMode } from '../js/effects/three-particles/three-particles-enums.js';
import {
  encodeCollisionPlanesForGPU,
  createCollisionPlaneTSL,
  MAX_COLLISION_PLANES,
  COLLISION_PLANE_DATA_SIZE,
} from '../js/effects/three-particles/webgpu/compute-collision-planes.js';
import type { NormalizedCollisionPlaneConfig } from '../js/effects/three-particles/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLANE_STRIDE = 12;

function createPlane(
  overrides: Partial<NormalizedCollisionPlaneConfig> = {}
): NormalizedCollisionPlaneConfig {
  return {
    isActive: true,
    position: new THREE.Vector3(0, 5, 0),
    normal: new THREE.Vector3(0, 1, 0),
    mode: CollisionPlaneMode.KILL,
    dampen: 0.5,
    lifetimeLoss: 0,
    ...overrides,
  };
}

function makeMockCurveData(size: number) {
  const buf = new StorageBufferAttribute(new Float32Array(size), 1);
  return storage(buf, 'float', size);
}

// ─── encodeCollisionPlanesForGPU ────────────────────────────────────────────

describe('encodeCollisionPlanesForGPU', () => {
  it('returns Float32Array of correct size (MAX_COLLISION_PLANES * 12)', () => {
    const data = encodeCollisionPlanesForGPU([]);
    expect(data).toBeInstanceOf(Float32Array);
    expect(data.length).toBe(MAX_COLLISION_PLANES * PLANE_STRIDE);
  });

  it('empty array produces all zeros', () => {
    const data = encodeCollisionPlanesForGPU([]);
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(0);
    }
  });

  it('encodes a KILL plane correctly', () => {
    const plane = createPlane({
      isActive: true,
      mode: CollisionPlaneMode.KILL,
      position: new THREE.Vector3(1, 2, 3),
      normal: new THREE.Vector3(0, 1, 0),
      dampen: 0.7,
      lifetimeLoss: 0.1,
    });
    const data = encodeCollisionPlanesForGPU([plane]);

    expect(data[0]).toBe(1); // isActive
    expect(data[1]).toBe(0); // mode = KILL = 0
    expect(data[2]).toBe(1); // position.x
    expect(data[3]).toBe(2); // position.y
    expect(data[4]).toBe(3); // position.z
    expect(data[5]).toBe(0); // normal.x
    expect(data[6]).toBe(1); // normal.y
    expect(data[7]).toBe(0); // normal.z
    expect(data[8]).toBeCloseTo(0.7, 5); // dampen
    expect(data[9]).toBeCloseTo(0.1, 5); // lifetimeLoss
    expect(data[10]).toBe(0); // padding
    expect(data[11]).toBe(0); // padding
  });

  it('encodes a CLAMP plane with mode=1', () => {
    const plane = createPlane({
      mode: CollisionPlaneMode.CLAMP,
    });
    const data = encodeCollisionPlanesForGPU([plane]);

    expect(data[0]).toBe(1); // isActive
    expect(data[1]).toBe(1); // mode = CLAMP = 1
  });

  it('encodes a BOUNCE plane with mode=2', () => {
    const plane = createPlane({
      mode: CollisionPlaneMode.BOUNCE,
      dampen: 0.8,
      lifetimeLoss: 0.25,
    });
    const data = encodeCollisionPlanesForGPU([plane]);

    expect(data[0]).toBe(1); // isActive
    expect(data[1]).toBe(2); // mode = BOUNCE = 2
    expect(data[8]).toBeCloseTo(0.8, 5); // dampen
    expect(data[9]).toBeCloseTo(0.25, 5); // lifetimeLoss
  });

  it('encodes inactive planes with isActive=0', () => {
    const plane = createPlane({ isActive: false });
    const data = encodeCollisionPlanesForGPU([plane]);
    expect(data[0]).toBe(0); // isActive = 0
  });

  it('encodes multiple planes at correct stride offsets', () => {
    const planes = [
      createPlane({
        mode: CollisionPlaneMode.KILL,
        position: new THREE.Vector3(1, 0, 0),
        dampen: 0.3,
      }),
      createPlane({
        mode: CollisionPlaneMode.BOUNCE,
        position: new THREE.Vector3(0, 10, 0),
        normal: new THREE.Vector3(0, 0, 1),
        dampen: 0.9,
        lifetimeLoss: 0.5,
      }),
      createPlane({
        mode: CollisionPlaneMode.CLAMP,
        position: new THREE.Vector3(5, 5, 5),
        isActive: false,
      }),
    ];
    const data = encodeCollisionPlanesForGPU(planes);

    // First plane at offset 0
    expect(data[0]).toBe(1); // isActive
    expect(data[1]).toBe(0); // KILL
    expect(data[2]).toBe(1); // position.x
    expect(data[8]).toBeCloseTo(0.3, 5); // dampen

    // Second plane at offset PLANE_STRIDE (12)
    const b1 = PLANE_STRIDE;
    expect(data[b1]).toBe(1); // isActive
    expect(data[b1 + 1]).toBe(2); // BOUNCE
    expect(data[b1 + 2]).toBe(0); // position.x
    expect(data[b1 + 3]).toBe(10); // position.y
    expect(data[b1 + 4]).toBe(0); // position.z
    expect(data[b1 + 5]).toBe(0); // normal.x
    expect(data[b1 + 6]).toBe(0); // normal.y
    expect(data[b1 + 7]).toBe(1); // normal.z
    expect(data[b1 + 8]).toBeCloseTo(0.9, 5); // dampen
    expect(data[b1 + 9]).toBeCloseTo(0.5, 5); // lifetimeLoss

    // Third plane at offset 2 * PLANE_STRIDE (24)
    const b2 = 2 * PLANE_STRIDE;
    expect(data[b2]).toBe(0); // isActive = false
    expect(data[b2 + 1]).toBe(1); // CLAMP
    expect(data[b2 + 2]).toBe(5); // position.x
    expect(data[b2 + 3]).toBe(5); // position.y
    expect(data[b2 + 4]).toBe(5); // position.z
  });

  it('caps at MAX_COLLISION_PLANES when exceeding limit', () => {
    const planes = Array.from({ length: 20 }, (_, idx) =>
      createPlane({
        position: new THREE.Vector3(idx, 0, 0),
        mode: CollisionPlaneMode.BOUNCE,
      })
    );
    const data = encodeCollisionPlanesForGPU(planes);

    // Buffer size is always MAX_COLLISION_PLANES * PLANE_STRIDE
    expect(data.length).toBe(MAX_COLLISION_PLANES * PLANE_STRIDE);

    // The last valid plane (index MAX-1) should be encoded
    const lastBase = (MAX_COLLISION_PLANES - 1) * PLANE_STRIDE;
    expect(data[lastBase]).toBe(1); // isActive
    expect(data[lastBase + 2]).toBe(MAX_COLLISION_PLANES - 1); // position.x = index

    // Data beyond MAX_COLLISION_PLANES should not exist (array is fixed size)
    // Planes at index >= MAX_COLLISION_PLANES are simply not encoded
  });

  it('preserves normal vector values correctly', () => {
    const normal = new THREE.Vector3(0.6, 0.8, 0).normalize();
    const plane = createPlane({ normal });
    const data = encodeCollisionPlanesForGPU([plane]);

    expect(data[5]).toBeCloseTo(0.6, 5);
    expect(data[6]).toBeCloseTo(0.8, 5);
    expect(data[7]).toBeCloseTo(0, 5);
  });

  it('handles negative position coordinates', () => {
    const plane = createPlane({
      position: new THREE.Vector3(-10, -20, -30),
    });
    const data = encodeCollisionPlanesForGPU([plane]);

    expect(data[2]).toBe(-10);
    expect(data[3]).toBe(-20);
    expect(data[4]).toBe(-30);
  });
});

// ─── createCollisionPlaneTSL ────────────────────────────────────────────────

describe('createCollisionPlaneTSL', () => {
  it('returns object with countUniform and apply properties', () => {
    const sCurveData = makeMockCurveData(512);
    const result = createCollisionPlaneTSL(sCurveData, 0, 2);

    expect(result).toHaveProperty('countUniform');
    expect(result).toHaveProperty('apply');
  });

  it('countUniform is defined', () => {
    const sCurveData = makeMockCurveData(512);
    const result = createCollisionPlaneTSL(sCurveData, 256, 3);
    expect(result.countUniform).toBeDefined();
  });

  it('apply is a callable function', () => {
    const sCurveData = makeMockCurveData(512);
    const result = createCollisionPlaneTSL(sCurveData, 0, 1);
    expect(typeof result.apply).toBe('function');
  });

  it('works with 0 collision planes', () => {
    const sCurveData = makeMockCurveData(512);
    const result = createCollisionPlaneTSL(sCurveData, 0, 0);
    expect(result.countUniform).toBeDefined();
    expect(typeof result.apply).toBe('function');
  });

  it('caps count at MAX_COLLISION_PLANES', () => {
    const sCurveData = makeMockCurveData(1024);
    const result = createCollisionPlaneTSL(sCurveData, 0, 100);
    expect(result.countUniform).toBeDefined();
  });

  it('accepts non-zero collisionPlaneOffset', () => {
    const sCurveData = makeMockCurveData(1024);
    const result = createCollisionPlaneTSL(sCurveData, 512, 4);
    expect(result.countUniform).toBeDefined();
    expect(typeof result.apply).toBe('function');
  });
});

// ─── COLLISION_PLANE_DATA_SIZE constant ─────────────────────────────────────

describe('COLLISION_PLANE_DATA_SIZE', () => {
  it('equals MAX_COLLISION_PLANES * PLANE_STRIDE', () => {
    expect(COLLISION_PLANE_DATA_SIZE).toBe(MAX_COLLISION_PLANES * PLANE_STRIDE);
  });
});

// ─── MAX_COLLISION_PLANES constant ──────────────────────────────────────────

describe('MAX_COLLISION_PLANES', () => {
  it('is 16', () => {
    expect(MAX_COLLISION_PLANES).toBe(16);
  });
});

// ─── TSL Continue guard + void type regression ──────────────────────────────

describe('TSL collision plane loop uses Continue() and void type', () => {
  it('source uses Continue() instead of bare return inside Loop', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        '../js/effects/three-particles/webgpu/compute-collision-planes.ts'
      ),
      'utf-8'
    );

    // Verify Continue is imported from three/tsl
    expect(src).toMatch(
      /import\s*\{[^}]*\bContinue\b[^}]*\}\s*from\s*'three\/tsl'/
    );

    // Verify the inactive-plane guard uses Continue()
    expect(src).toContain('If(isActive.lessThan(0.5), () => {');

    // Extract the applyCollisionPlanesTSL Fn body
    const fnBodyStart = src.indexOf('const applyCollisionPlanesTSL = Fn(');
    const fnBodyEnd = src.indexOf('return {', fnBodyStart);
    const fnBody = src.slice(fnBodyStart, fnBodyEnd);

    // There should be Continue() calls inside the Loop
    expect(fnBody).toContain('Continue()');

    // Bare `return;` inside the Loop would be a no-op — ensure it is not present
    const loopStart = fnBody.indexOf('Loop(');
    const loopBody = fnBody.slice(loopStart);
    expect(loopBody).not.toMatch(/\breturn\s*;/);

    // The Fn must declare 'void' return type
    expect(fnBody).toMatch(
      /Fn\(\s*\([^)]*\)\s*=>\s*\{[\s\S]*\},\s*'void'\s*\)/
    );
  });

  it('does not create a separate storage buffer (stays within 8-binding limit)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        '../js/effects/three-particles/webgpu/compute-collision-planes.ts'
      ),
      'utf-8'
    );

    // Must not import StorageBufferAttribute (no separate buffer)
    expect(src).not.toContain("from 'three/webgpu'");
    // Must not call storage() (reads from shared sCurveData instead)
    expect(src).not.toMatch(/\bstorage\s*\(/);
  });
});

// ─── Mode encoding mapping ─────────────────────────────────────────────────

describe('collision plane mode encoding', () => {
  it('KILL = 0, CLAMP = 1, BOUNCE = 2', () => {
    const killPlane = createPlane({ mode: CollisionPlaneMode.KILL });
    const clampPlane = createPlane({ mode: CollisionPlaneMode.CLAMP });
    const bouncePlane = createPlane({ mode: CollisionPlaneMode.BOUNCE });

    // The encode function reuses an internal buffer, so read the mode value
    // immediately after each call before the next call overwrites it.
    expect(encodeCollisionPlanesForGPU([killPlane])[1]).toBe(0);
    expect(encodeCollisionPlanesForGPU([clampPlane])[1]).toBe(1);
    expect(encodeCollisionPlanesForGPU([bouncePlane])[1]).toBe(2);
  });
});
