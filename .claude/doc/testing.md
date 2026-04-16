# Testing Guide

## Overview

- **Framework:** Jest 30.x with ts-jest ESM preset
- **Test location:** `src/__tests__/*.test.ts`
- **Coverage target:** ≥90% statement, ≥80% branch
- **Current coverage:** ~93% statement, ~85% branch (947 tests, 43 test suites)

---

## Running Tests

```bash
npm test              # Run all tests with coverage
npm run test:watch    # Watch mode (no coverage)
```

Coverage reports are generated in `coverage/` (text + lcov format).

---

## Test Configuration

### Jest (`jest.config.js`)
- Preset: `ts-jest/presets/default-esm` (ESM support)
- Environment: `node`
- Transform: `babel-jest` for `.ts`, `.js`, `.mts`, `.jsx`
- Module mapper: strips `.js` extensions from ESM imports
- Three.js ecosystem packages (`three`, `three-noise`, `@newkrok/three-utils`) are transformed (not ignored)
- Workers: 50% of CPU cores

### Babel (`babel.config.json`)
- Presets: `@babel/preset-env` + `@babel/preset-typescript`

### TypeScript
- Tests are excluded from the main `tsconfig.json` build (`exclude: ["src/__tests__"]`)
- Tests still benefit from type checking via ts-jest

---

## Existing Test Files (43 suites, 947 tests)

| File | What it covers |
|------|----------------|
| `three-particles-utils.test.ts` | Shape position/velocity for all 5 shapes, value calculation, bezier config |
| `three-particles-utils-extended.test.ts` | Extended utility edge cases |
| `three-particles-modifiers.test.ts` | All modifiers: linear/orbital velocity, size/opacity/color/rotation over lifetime, noise |
| `three-particles-modifiers-extended.test.ts` | Modifier edge cases and combinations |
| `three-particles-burst.test.ts` | Burst timing, cycles, intervals, probability, max particle limits |
| `three-particles-rate-over-distance.test.ts` | Distance emission, pause/resume, accumulation |
| `three-particles-bezier.test.ts` | Bezier interpolation, caching, cache cleanup |
| `three-particles-curves.test.ts` | Easing function lookup, custom function passthrough |
| `three-particles.test.ts` | Basic smoke test for updateParticleSystems |
| `three-particles-core.test.ts` | Core lifecycle, looping, disposal, timing |
| `three-particles-lifecycle.test.ts` | Particle activation, expiration, deactivation |
| `three-particles-edge-cases.test.ts` | Zero duration, zero maxParticles, rapid dispose |
| `three-particles-noise-rotation-callbacks.test.ts` | Noise, rotation, onUpdate/onComplete callbacks |
| `three-particles-texture.test.ts` | Texture sheet animation |
| `three-particles-velocity.test.ts` | Velocity and gravity interactions |
| `three-particles-world-space.test.ts` | World vs Local simulation space |
| `three-particles-sub-emitters.test.ts` | Sub-emitter birth/death triggers (including GPU backend forced CPU) |
| `three-particles-forces.test.ts` | Force fields: point and directional |
| `three-particles-forces-extended.test.ts` | Force field falloff and edge cases |
| `three-particles-serialization.test.ts` | Config serialization/deserialization |
| `three-particles-serialization-extended.test.ts` | Serialization edge cases |
| `three-particles-instanced.test.ts` | RendererType.INSTANCED |
| `three-particles-trail.test.ts` | RendererType.TRAIL, ribbon rendering |
| `three-particles-trail-improvements.test.ts` | Trail smoothing, adaptive sampling, twist prevention |
| `three-particles-mesh.test.ts` | RendererType.MESH, 3D mesh particles |
| `three-particles-soft-particles.test.ts` | Soft particles depth-based fade |
| `three-particles-integration.test.ts` | Integration tests across modules |
| `three-particles-update-config.test.ts` | Runtime config updates (`updateConfig`) |
| `three-particles-update-config-integration.test.ts` | `updateConfig` integration scenarios |
| `three-particles-advanced.test.ts` | Advanced scenarios and combinations |
| `three-particles-coverage-gaps.test.ts` | Targeted coverage gap tests |
| `three-particles-renderer-detect.test.ts` | WebGPU renderer detection, `resolveSimulationBackend` |
| `three-particles-webgpu-integration.test.ts` | TSL factory registration, backend branching |
| `three-particles-compute.test.ts` | GPU compute pipeline creation and dispatch |
| `three-particles-compute-modifiers.test.ts` | GPU modifier compute (storage buffers, curve baking) |
| `three-particles-compute-force-fields.test.ts` | GPU force field encoding and compute |
| `three-particles-curve-bake.test.ts` | Curve baking (bezier/easing → Float32Array) |
| `compute-modifiers-flush.test.ts` | Emit queue flush to GPU buffers |
| `orbital-rotation.test.ts` | Orbital velocity rotation compute |
| `tsl-point-sprite-material.test.ts` | TSL POINTS material creation |
| `tsl-instanced-billboard-material.test.ts` | TSL INSTANCED material creation |
| `tsl-mesh-particle-material.test.ts` | TSL MESH material creation |
| `tsl-noise.test.ts` | TSL 3D simplex noise implementation |

---

## Mocking Patterns

### Three.js: Direct Usage (No Global Mocks)

Tests use real Three.js objects — no need to mock the library itself:

```typescript
import * as THREE from "three";

const position = new THREE.Vector3(1, 2, 3);
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler(0, Math.PI / 2, 0);
```

### Mocking Random Numbers

For deterministic testing, mock `THREE.MathUtils.randFloat`:

```typescript
// Mock to return a specific value
jest.spyOn(THREE.MathUtils, "randFloat").mockReturnValue(2.5);

// Restore after test
afterEach(() => {
  jest.restoreAllMocks();
});
```

This is critical for shape emission tests where positions are randomized.

### Mocking with Sequential Values

```typescript
const mockRandFloat = jest.spyOn(THREE.MathUtils, "randFloat");
mockRandFloat
  .mockReturnValueOnce(0.5)  // First call
  .mockReturnValueOnce(1.0)  // Second call
  .mockReturnValue(0.0);     // All subsequent calls
```

---

## Creating Particle Systems in Tests

### Basic Pattern

```typescript
import { createParticleSystem, updateParticleSystems } from "../js/effects/three-particles/three-particles.js";

const startTime = 1000; // milliseconds since epoch

const ps = createParticleSystem(
  {
    maxParticles: 100,
    duration: 5,
    looping: true,
    startLifetime: 2,
    startSpeed: 1,
    emission: {
      rateOverTime: 10,
    },
  },
  startTime
);

// Update the system
ps.update({
  now: startTime + 100,  // current time (ms)
  delta: 0.1,            // seconds since last frame
  elapsed: 0.1,          // total elapsed seconds
});

// Access particle data
const points = ps.instance as THREE.Points;
const positions = points.geometry.attributes.position.array;
const isActive = points.geometry.attributes.isActive.array;

// Cleanup
ps.dispose();
```

### Helper: Count Active Particles

```typescript
const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveArr = points.geometry.attributes.isActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};
```

### Helper: Step Function for Time Control

```typescript
const createTestSystem = (config: Partial<ParticleSystemConfig>) => {
  const startTime = 1000;
  let currentTime = startTime;

  const ps = createParticleSystem(config, startTime);

  const step = (deltaMs: number) => {
    currentTime += deltaMs;
    const deltaSec = deltaMs / 1000;
    const elapsedSec = (currentTime - startTime) / 1000;
    ps.update({ now: currentTime, delta: deltaSec, elapsed: elapsedSec });
  };

  return { ps, step };
};
```

---

## Assertion Patterns

### Floating Point Comparisons

Always use `toBeCloseTo` for floating point values:

```typescript
// For approximate values (integer-like)
expect(position.x).toBeCloseTo(1.0, 0);

// For precise calculations (5 decimal places)
expect(bezierValue).toBeCloseTo(0.75, 5);
```

### Range Validation

For randomized values, test range bounds:

```typescript
for (let i = 0; i < 100; i++) {
  const value = calculateRandomValue();
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}
```

### Buffer Attribute Checks

```typescript
const points = ps.instance as THREE.Points;
const attr = points.geometry.attributes;

// Check particle is active
expect(attr.isActive.array[particleIndex]).toBe(1);

// Check position
expect(attr.position.array[particleIndex * 3 + 0]).toBeCloseTo(expectedX, 2); // X
expect(attr.position.array[particleIndex * 3 + 1]).toBeCloseTo(expectedY, 2); // Y
expect(attr.position.array[particleIndex * 3 + 2]).toBeCloseTo(expectedZ, 2); // Z

// Check color
expect(attr.colorR.array[particleIndex]).toBeCloseTo(1.0, 2);
expect(attr.colorG.array[particleIndex]).toBeCloseTo(0.5, 2);
```

---

## Test Organization

### Describe Block Structure

```typescript
describe("Module name", () => {
  // Shared setup
  let position: THREE.Vector3;
  let quaternion: THREE.Quaternion;

  beforeEach(() => {
    position = new THREE.Vector3();
    quaternion = new THREE.Quaternion();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Feature group", () => {
    it("should do specific behavior", () => {
      // Arrange → Act → Assert
    });

    it("should handle edge case", () => {
      // ...
    });
  });
});
```

### Test Naming Conventions

Use descriptive names that explain the expected behavior:

```typescript
// Good
it("should emit particles at burst time")
it("should not exceed maxParticles limit")
it("should interpolate bezier curve at midpoint to 0.75")
it("should return shell position when radiusThickness is 0")

// Bad
it("works")
it("test emission")
it("handles edge case")
```

---

## Coverage Status

Coverage is comprehensive (99.5% statement, 97.8% branch). All major areas are well covered:

- Core system lifecycle, looping, disposal
- All shape emitters and modifiers
- Sub-emitters, force fields, serialization
- All renderer types (Points, Instanced, Trail, Mesh)
- Edge cases and integration scenarios

**Remaining low-priority gaps:**
- Shader logic — not unit testable (needs WebGL context), covered by visual testing
- A few edge branches in `three-particles.ts` (lines 72, 406, 1444, 1459, 2061)

---

## Tips

1. **Always call `dispose()`** in `afterEach` or at test end to prevent cross-test contamination (systems are tracked globally)
2. **Use small `maxParticles`** (10-100) in tests — keeps iteration fast
3. **Control time precisely** — use step functions rather than real time
4. **Mock randomness** when testing specific positions — restore mocks in `afterEach`
5. **Check `needsUpdate`** — buffer attributes need `.needsUpdate = true` after writes (the library handles this, but verify in tests)
6. **Test with different shapes** — each shape has unique position/velocity logic
