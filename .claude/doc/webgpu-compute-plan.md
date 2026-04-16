# WebGPU Compute Support - Implementation Plan

> **Status: COMPLETED** — All 6 phases have been implemented and shipped. This document is preserved as a historical reference for design decisions and architecture rationale. For the current architecture, see [Architecture](architecture.md).

## Overview

Migrate three-particles from CPU-only simulation with GLSL shaders to a dual-path architecture supporting both WebGL (CPU sim + GLSL) and WebGPU (GPU compute sim + TSL rendering). Non-breaking, additive feature with automatic fallback.

---

## Architecture Decision: Dual-Path Strategy

```
User creates particle system
        │
        ▼
  Detect renderer type
        │
        ├── WebGPURenderer detected
        │   ├── Render: TSL NodeMaterial (compiles to WGSL)
        │   └── Simulate: GPU compute shaders (storage buffers)
        │
        └── WebGLRenderer detected
            ├── Render: GLSL ShaderMaterial (existing, unchanged)
            └── Simulate: CPU JavaScript (existing, unchanged)
```

**Key principle:** The existing WebGL path remains completely untouched. All WebGPU code is additive.

---

## Phase 0: Foundation & Infrastructure

**Goal:** Set up the dual-path architecture, renderer detection, and build configuration without changing any existing behavior.

### 0.1 Renderer Detection Utility

New file: `three-particles-renderer-detect.ts`

```typescript
export const enum SimulationBackend {
  CPU = 'CPU',
  GPU_COMPUTE = 'GPU_COMPUTE',
}

export function detectSimulationBackend(
  renderer: THREE.WebGLRenderer | THREE.WebGPURenderer,
  userPreference?: 'auto' | 'cpu' | 'gpu'
): SimulationBackend {
  if (userPreference === 'cpu') return SimulationBackend.CPU;
  if (userPreference === 'gpu' && isWebGPURenderer(renderer)) return SimulationBackend.GPU_COMPUTE;
  // 'auto': use GPU compute when WebGPURenderer is available
  return isWebGPURenderer(renderer)
    ? SimulationBackend.GPU_COMPUTE
    : SimulationBackend.CPU;
}

function isWebGPURenderer(renderer: unknown): boolean {
  // Duck-type check: WebGPURenderer has .compute() method
  return renderer != null
    && typeof renderer === 'object'
    && 'compute' in renderer
    && typeof (renderer as Record<string, unknown>).compute === 'function';
}
```

### 0.2 Config Extension (Non-Breaking)

Add optional field to `ParticleSystemConfig`:

```typescript
interface ParticleSystemConfig {
  // ... existing fields unchanged ...

  /** @default 'auto' */
  simulationBackend?: 'auto' | 'cpu' | 'gpu';
}
```

### 0.3 Build Configuration

- `three/webgpu` and `three/tsl` imports must be **optional/dynamic** — the library should not hard-depend on WebGPU classes
- Mark `three/webgpu` and `three/tsl` as external in tsup config (same as `three`)
- Users who want WebGPU must import from `three/webgpu` themselves (for renderer creation)

### 0.4 Directory Structure

```
src/js/effects/three-particles/
├── ...existing files unchanged...
├── three-particles-renderer-detect.ts     # NEW: Backend detection
├── webgpu/                                # NEW: All WebGPU-specific code
│   ├── compute-particle-update.ts         # Compute shader: core physics
│   ├── compute-modifiers.ts               # Compute shader: modifiers
│   ├── compute-forces.ts                  # Compute shader: force fields
│   ├── compute-noise.ts                   # WGSL noise implementation
│   ├── compute-curves.ts                  # GPU curve evaluation
│   ├── tsl-materials.ts                   # TSL NodeMaterial equivalents
│   └── webgpu-particle-system.ts          # WebGPU-specific system orchestration
```

### 0.5 Tests

- Unit tests for `detectSimulationBackend()` with mock renderers
- Config parsing tests for `simulationBackend` field
- Ensure all existing tests still pass unchanged

### 0.6 Deliverable

- Renderer detection works
- Config accepts new optional field
- Existing behavior unchanged (all tests pass)
- Directory structure created

---

## Phase 1: TSL Shader Migration (Rendering Only)

**Goal:** Create TSL equivalents of all 8 GLSL shaders so particles can render under WebGPURenderer. Simulation still CPU-based.

**Why first:** Without TSL shaders, nothing renders on WebGPURenderer at all. This unlocks WebGPU rendering even before compute shaders exist.

### 1.1 Shader Migration Map

| GLSL Source | TSL Target | Complexity |
|-------------|-----------|------------|
| `particle-system-vertex-shader.glsl.ts` | `tsl-point-sprite.ts` | Simple |
| `particle-system-fragment-shader.glsl.ts` | `tsl-point-sprite.ts` | Complex |
| `instanced-particle-vertex-shader.glsl.ts` | `tsl-instanced-billboard.ts` | Medium |
| `instanced-particle-fragment-shader.glsl.ts` | `tsl-instanced-billboard.ts` | Complex |
| `mesh-particle-vertex-shader.glsl.ts` | `tsl-mesh-particle.ts` | Medium |
| `mesh-particle-fragment-shader.glsl.ts` | `tsl-mesh-particle.ts` | Medium |
| `trail-vertex-shader.glsl.ts` | `tsl-trail-ribbon.ts` | Complex |
| `trail-fragment-shader.glsl.ts` | `tsl-trail-ribbon.ts` | Medium |

### 1.2 TSL Conversion Challenges

1. **Point sprite coordinate system** — `gl_PointCoord` → TSL equivalent (`pointUV` node)
2. **Log depth buffer** — `#include <logdepthbuf_*>` → TSL built-in log depth support
3. **Soft particles** — `linearizeDepth()` custom function → TSL depth node + custom Fn
4. **Texture sheet animation** — Frame index calculation → TSL math nodes
5. **2D rotation matrix** — `mat2(cos, sin, -sin, cos)` → TSL `rotate()` or manual
6. **Quaternion rotation** (mesh) — Custom GLSL function → TSL quaternion nodes
7. **Trail billboard** — Camera-space cross product + smoothstep fallback → TSL vector math
8. **Viewport height uniform** (instanced) — Perspective size matching → TSL `viewportResolution`

### 1.3 Material Creation Branching

In `three-particles.ts`, the material creation code branches based on detected backend:

```typescript
function createMaterial(config, backend) {
  if (backend === SimulationBackend.GPU_COMPUTE) {
    return createTSLMaterial(config); // New TSL path
  }
  return createGLSLMaterial(config);  // Existing path, unchanged
}
```

### 1.4 Conversion Order (by dependency)

1. **Point sprite** (POINTS renderer) — simplest, most used, start here
2. **Instanced billboard** (INSTANCED renderer) — shares fragment logic with point sprite
3. **Mesh particle** (MESH renderer) — adds quaternion + lighting
4. **Trail ribbon** (TRAIL renderer) — most complex vertex shader, do last

### 1.5 Testing Strategy

- Visual regression tests: render same config with WebGL and WebGPU, compare output
- Unit tests: TSL material creation, uniform binding
- Each renderer type tested independently
- Soft particles tested with mock depth texture

### 1.6 Deliverable

- All 4 renderer types work with WebGPURenderer
- CPU simulation + TSL rendering = functional WebGPU path
- All existing WebGL tests unchanged
- Performance baseline established (WebGPU rendering vs WebGL rendering, same CPU sim)

---

## Phase 2: GPU Compute - Core Physics

**Goal:** Move the core per-particle update loop to GPU compute shaders. This is the main performance win.

### 2.1 Data Layout: Storage Buffers

Convert CPU-side per-particle data to GPU storage buffers:

```
Storage Buffer: particleState (read/write)
┌──────────────────────────────────────────────────────┐
│ Per particle (stride = 24 floats):                   │
│   [0-2]   position (vec3)                            │
│   [3-5]   velocity (vec3)                            │
│   [6]     lifetime (float)                           │
│   [7]     startLifetime (float, read-only after init)│
│   [8]     size (float)                               │
│   [9]     rotation (float)                           │
│   [10-13] color (vec4: r, g, b, a)                   │
│   [14]    isActive (float, 0 or 1)                   │
│   [15]    startSize (float, read-only)               │
│   [16]    startOpacity (float, read-only)            │
│   [17-19] startColor (vec3: r, g, b, read-only)     │
│   [20]    rotationSpeed (float)                      │
│   [21]    startFrame (float, read-only)              │
│   [22-23] padding                                    │
│                                                       │
│ Total: maxParticles × 24 floats                      │
└──────────────────────────────────────────────────────┘

Uniform Buffer: frameUniforms (read-only, updated per frame from CPU)
┌──────────────────────────────────────────────────────┐
│   delta (float)                                      │
│   elapsed (float)                                    │
│   gravityVelocity (vec3)                             │
│   worldPositionChange (vec3)                         │
│   simulationSpace (uint)                             │
│   particleCount (uint)                               │
└──────────────────────────────────────────────────────┘
```

### 2.2 Compute Shader: Core Update

TSL compute shader (`compute-particle-update.ts`):

```
For each particle (workgroup_size = 64):
  if (!isActive) return;

  // Gravity
  velocity -= gravityVelocity * delta;

  // Position
  if (simulationSpace == WORLD)
    position -= worldPositionChange;
  position += velocity * delta;

  // Lifetime
  lifetime += delta;
  if (lifetime > startLifetime) {
    isActive = 0;
    color.a = 0;
  }
```

### 2.3 CPU↔GPU Sync Protocol

**Emission remains on CPU.** When CPU emits a particle:
1. CPU writes to a staging buffer with new particle data (position, velocity, startValues)
2. CPU sets `isActive = 1` for the new particle index
3. Before compute dispatch, upload staging buffer changes to GPU storage buffer
4. Compute shader reads `isActive` flag and processes only active particles

**Particle death notification** (for sub-emitters, callbacks):
- Option A: GPU writes dead particle indices to an output buffer, CPU reads back async
- Option B: CPU tracks lifetime independently (lightweight, no GPU readback)
- **Recommended: Option B** for simplicity — CPU maintains `creationTimes[]` and detects death via timestamp comparison, same as current code

### 2.4 Render Pass Integration

Storage buffer → render attribute binding:
- TSL materials read particle positions/colors directly from the storage buffer
- No CPU readback, no `needsUpdate` flags — data stays on GPU
- The compute output IS the render input

### 2.5 Workgroup Size Optimization

- Default: 64 threads per workgroup (good balance for most GPUs)
- Dispatch: `ceil(maxParticles / 64)` workgroups
- Future: auto-tune based on GPU capabilities

### 2.6 Tests

- Compute shader output validation (read back buffer, compare with CPU reference)
- Emission sync: CPU emits, GPU updates, verify positions
- Particle death: verify deactivation
- Multiple systems: independent storage buffers
- Benchmark: 500 particles CPU vs GPU

### 2.7 Deliverable

- Core physics (gravity, velocity, position, lifetime) runs on GPU
- CPU emission → GPU simulation → TSL rendering pipeline complete
- 5-20x speedup for position-only particles at 1000+
- All existing WebGL tests unchanged

---

## Phase 3: GPU Compute - Modifiers

**Goal:** Port all 7 modifiers to GPU compute shaders.

### 3.1 Curve Evaluation on GPU

**Problem:** Curves (bezier, easing) are currently JS functions. GPU needs them as data.

**Solution: Curve Baking to Data Texture**

```
Pre-bake:
  For each curve used in config:
    Sample curve at 256 points (t = 0..1)
    Store in 1D texture (256 × 1, R32F)

GPU compute:
  curveValue = textureSample(curveTexture, lifetimePercentage)
```

- 256 samples gives <0.4% error for all easing functions
- Bezier curves baked at config load time
- One texture per unique curve (shared across modifiers)
- Texture lookup is extremely fast on GPU

### 3.2 Modifier Compute Shaders

Each modifier as a TSL compute function, composed into a single dispatch:

| Modifier | GPU Implementation | Extra Data Needed |
|----------|-------------------|-------------------|
| Size over lifetime | `size = startSize * curveSample(t)` | 1 curve texture |
| Opacity over lifetime | `alpha = startOpacity * curveSample(t)` | 1 curve texture |
| Color over lifetime | `rgb = startRGB * vec3(curveR(t), curveG(t), curveB(t))` | 3 curve textures |
| Rotation over lifetime | `rotation += speed * delta * 0.02` | rotationSpeed in buffer |
| Linear velocity | `pos += vec3(curveX(t), curveY(t), curveZ(t)) * delta` | 3 curve textures |
| Orbital velocity | Euler rotation of offset vector | Extra state buffer (positionOffset per particle) |
| Noise | FBM sampling | WGSL noise implementation |

### 3.3 Noise on GPU

Port FBM noise to WGSL/TSL:

```wgsl
// Simplex noise 3D → pure math, no texture dependency
fn snoise(v: vec3f) -> f32 { ... }

fn fbm(p: vec3f, octaves: u32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  for (var i = 0u; i < octaves; i++) {
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
```

Well-known WGSL simplex noise implementations exist. This is a solved problem.

### 3.4 Orbital Velocity State

Orbital velocity requires persistent `positionOffset` per particle. Solutions:
- Add `positionOffset (vec3)` to the storage buffer (3 extra floats per particle)
- Initialize on emission (CPU writes to staging)
- Compute shader reads/writes each frame

### 3.5 Single vs Multiple Dispatches

**Recommended: Single compute dispatch with all modifiers**

```
computeUpdate = tslFn(() => {
  // Core physics
  applyGravity();
  applyVelocity();

  // Modifiers (conditionally compiled based on config)
  if (config.sizeOverLifetime) applySizeOverLifetime();
  if (config.opacityOverLifetime) applyOpacityOverLifetime();
  if (config.colorOverLifetime) applyColorOverLifetime();
  if (config.rotationOverLifetime) applyRotationOverLifetime();
  if (config.linearVelocityOverLifetime) applyLinearVelocity();
  if (config.orbitalVelocityOverLifetime) applyOrbitalVelocity();
  if (config.noise) applyNoise();
});
```

Conditionals are **compile-time** (TSL generates different shader variants per config), not runtime branching. This gives optimal GPU utilization.

### 3.6 Tests

- Each modifier tested independently: GPU output vs CPU reference implementation
- Combined modifiers: all 7 active simultaneously
- Curve baking accuracy: verify <0.5% error vs analytical
- Noise: verify statistical distribution matches CPU noise

### 3.7 Deliverable

- All 7 modifiers running on GPU
- Curve baking pipeline
- GPU noise implementation
- 10-50x speedup for fully modified particles at 1000+

---

## Phase 4: GPU Compute - Force Fields

**Goal:** Port force field calculations to GPU.

### 4.1 Force Field Data

```
Uniform/Storage Buffer: forceFields (read-only)
┌──────────────────────────────────────────────────────┐
│ Per force field:                                     │
│   type (uint: POINT=0, DIRECTIONAL=1)                │
│   position (vec3)                                    │
│   direction (vec3)                                   │
│   strength (float)                                   │
│   range (float)                                      │
│   falloff (uint: NONE=0, LINEAR=1, QUADRATIC=2)      │
│   strengthCurveIndex (uint)                          │
│                                                       │
│ Max: 8 force fields (configurable)                   │
└──────────────────────────────────────────────────────┘
```

### 4.2 Compute Implementation

```
for each forceField:
  if (type == POINT):
    dir = field.position - particle.position
    dist = length(dir)
    if (dist < 0.0001 || dist > field.range) continue
    dir = normalize(dir)
    falloff = computeFalloff(dist, range, falloffType)
    force = strength * falloff * delta
    velocity += dir * force

  if (type == DIRECTIONAL):
    force = strength * delta
    velocity += field.direction * force
```

Early exits (`continue`) work fine in GPU compute — they skip work for that thread, not the whole workgroup.

### 4.3 Tests & Deliverable

- Point force with all 3 falloff types
- Directional force
- Multiple simultaneous force fields
- Force field + modifier combination

---

## Phase 5: Benchmark & Examples

**Goal:** Measure performance gains, create showcase examples.

### 5.1 Benchmark Additions

New scenarios in `benchmarks/run.js`:

| Scenario | Particles | Modifiers | Expected GPU Speedup |
|----------|-----------|-----------|---------------------|
| GPU Basic | 10,000 | None | 20-50x |
| GPU All Modifiers | 10,000 | All 7 | 10-30x |
| GPU Force Fields | 10,000 | + 4 point forces | 10-30x |
| GPU Massive | 100,000 | Size + Color + Noise | 50-100x |
| CPU vs GPU Crossover | 100-10,000 | All | Find break-even point |

**GPU Timing:** Use `renderer.info` or `GPUCommandEncoder` timestamp queries for accurate compute dispatch timing.

### 5.2 Examples

Add to `examples/examples-data.js` (newest first):

1. **"GPU Particle Storm"** — 50,000 particles, noise + color over lifetime, shows raw GPU power
2. **"Galaxy Simulation"** — 20,000 particles, orbital velocity, point force (gravity well)
3. **"Massive Rain"** — 100,000 tiny particles, gravity + linear velocity, environmental scale
4. **"WebGPU vs WebGL Toggle"** — Same effect, toggle backend, show FPS counter difference

Each example should have a tag: `["webgpu", "compute", "gpu"]`

### 5.3 Deliverable

- Benchmark suite with GPU scenarios
- 4 showcase examples
- Performance comparison documentation
- Break-even analysis (particle count where GPU wins)

---

## Phase 6: Documentation & Polish

### 6.1 Documentation Updates

| Document | Changes |
|----------|---------|
| `README.md` | WebGPU section: setup, requirements, config option |
| `llms.txt` / `llms-full.txt` | New API: `simulationBackend`, WebGPU usage |
| `CLAUDE.md` | New file locations, WebGPU architecture notes |
| `ROADMAP.md` | Mark WebGPU Compute as completed |
| `.claude/doc/architecture.md` | Dual-path architecture, storage buffer layout |
| TypeDoc | JSDoc for all new public APIs |

### 6.2 Migration Guide

For users upgrading:
```markdown
## WebGPU Support (v3.0)

### No Breaking Changes
All existing code works unchanged. WebGPU is opt-in.

### Enable WebGPU Compute
1. Use WebGPURenderer instead of WebGLRenderer:
   ```js
   import * as THREE from 'three/webgpu';
   const renderer = new THREE.WebGPURenderer();
   await renderer.init();
   ```
2. That's it! The library auto-detects WebGPURenderer and uses GPU compute.
3. Optionally force a backend:
   ```js
   createParticleSystem({ config, simulationBackend: 'gpu' });
   ```
```

---

## Timeline & Dependencies

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
Foundation   TSL         Core        Modifiers    Forces      Bench &     Docs
             Shaders     Compute     on GPU       on GPU      Examples
```

**Each phase is independently shippable** — the library works correctly after each phase:

| After Phase | WebGL | WebGPU Render | WebGPU Compute |
|-------------|-------|---------------|----------------|
| 0 | Full | No | No |
| 1 | Full | Yes (CPU sim) | No |
| 2 | Full | Yes | Core physics |
| 3 | Full | Yes | + All modifiers |
| 4 | Full | Yes | + Force fields |
| 5 | Full | Yes | Full + benchmarks |
| 6 | Full | Yes | Full + docs |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| TSL API instability | Pin Three.js version, test against specific releases |
| Storage buffer ↔ render attribute binding | Follow Three.js official compute examples pattern |
| Noise quality mismatch (CPU vs GPU) | Accept small differences, test statistical properties |
| Browser WebGPU support gaps | Auto-fallback to CPU; clearly document requirements |
| Curve baking precision | 256 samples is more than sufficient; test edge cases |
| Performance regression for small systems | GPU has overhead — only use compute above a threshold (e.g., 100+ particles) |
| `three/webgpu` import increases bundle size | Keep WebGPU code in separate entry point / dynamic import |

---

## Breaking Changes: NONE

- Existing `ParticleSystemConfig` unchanged
- Existing API (`createParticleSystem`, `disposeParticleSystem`, etc.) unchanged
- WebGL path completely untouched
- New `simulationBackend` field is optional, defaults to `'auto'`
- Version bump: minor (feat), not major

---

## Version Strategy

- **Phase 0-1:** Can ship as minor release (new feature: WebGPURenderer rendering support)
- **Phase 2-4:** Can ship as minor release (new feature: GPU compute simulation)
- **Phase 5-6:** Can ship as patch (docs, examples, benchmarks)

Suggested version: `2.16.0` for Phase 1, `2.17.0` for Phase 2-4, `2.18.0` for Phase 5-6.

---

## Implementation Status

All phases completed as of the `claude/webgpu-compute-support` branch:

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Foundation & Infrastructure | Completed |
| Phase 1 | TSL Shader Migration | Completed |
| Phase 2 | GPU Compute - Core Physics | Completed |
| Phase 3 | GPU Compute - Modifiers | Completed |
| Phase 4 | GPU Compute - Force Fields | Completed |
| Phase 5 | Benchmark & Examples | Completed |
| Phase 6 | Documentation & Polish | Completed |

### Key Deviations from Plan

- **Storage buffer layout:** Uses 8 packed vec4 buffers instead of the single 24-float stride buffer proposed in Phase 2.2. This avoids WebGPU's per-stage binding limits.
- **Curve baking:** Uses Float32Array stored in the `curveData` buffer instead of 1D textures. Simpler and equally performant.
- **Force fields:** Supports up to 16 (not 8) force fields per system. Packed into `curveData` tail.
- **Max particles demonstrated:** 350K in the GPU Supernova demo (exceeded the 100K target).
- **Noise:** Full 3D simplex noise implemented directly in TSL (`tsl-noise.ts`), not WGSL.
- **SimulationBackend enum:** Uses `AUTO`/`CPU`/`GPU` (not `auto`/`cpu`/`gpu` strings from the original plan).
