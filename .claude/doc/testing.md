# Testing Guide

## Overview

- **Framework:** Jest 30.x with ts-jest ESM preset
- **Test location:** `src/__tests__/*.test.ts`
- **Coverage target:** ≥90% statement, ≥80% branch
- **Current coverage:** ~87% statement

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

## Existing Test Files

| File | Lines | Tests | What it covers |
|------|-------|-------|----------------|
| `three-particles-utils.test.ts` | 835 | 55+ | Shape position/velocity for all 5 shapes, value calculation, bezier config |
| `three-particles-modifiers.test.ts` | 440 | 63+ | All modifiers: linear/orbital velocity, size/opacity/color/rotation over lifetime, noise |
| `three-particles-burst.test.ts` | 239 | 21 | Burst timing, cycles, intervals, probability, max particle limits |
| `three-particles-rate-over-distance.test.ts` | 160 | 36+ | Distance emission, pause/resume, accumulation |
| `three-particles-bezier.test.ts` | 85 | 7 | Bezier interpolation, caching, cache cleanup |
| `three-particles-curves.test.ts` | 35 | 4 | Easing function lookup, custom function passthrough |
| `three-particles.test.ts` | 15 | 1 | Basic smoke test for updateParticleSystems |

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

## Coverage Gap Areas (Priority)

### High Priority — Core System (`three-particles.ts`)

Currently only 1 smoke test for 1,400+ lines of code. Needs tests for:

- **Particle lifecycle:** activation → update → expiration → deactivation
- **Multiple particle systems:** coordination, independent updates
- **Disposal:** cleanup, memory release, system removal
- **Looping:** system restart behavior
- **Start delay:** delayed emission start
- **Gravity:** velocity modification over time
- **World vs Local space:** position handling differences
- **Texture sheet animation:** frame progression
- **onUpdate / onComplete callbacks:** invocation timing
- **Rate over time emission:** particle count accuracy

### Medium Priority

- **Complex modifier combinations:** multiple modifiers active simultaneously
- **Edge cases:** zero duration, zero maxParticles, rapid dispose
- **Error conditions:** invalid configs, missing required fields

### Low Priority

- **Shader logic:** not unit testable (needs WebGL context), covered by visual testing
- **Enum values:** implicitly tested through integration

---

## Tips

1. **Always call `dispose()`** in `afterEach` or at test end to prevent cross-test contamination (systems are tracked globally)
2. **Use small `maxParticles`** (10-100) in tests — keeps iteration fast
3. **Control time precisely** — use step functions rather than real time
4. **Mock randomness** when testing specific positions — restore mocks in `afterEach`
5. **Check `needsUpdate`** — buffer attributes need `.needsUpdate = true` after writes (the library handles this, but verify in tests)
6. **Test with different shapes** — each shape has unique position/velocity logic
