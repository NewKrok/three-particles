# Architecture

## High-Level Overview

The library uses a **dual-path architecture** — WebGL (CPU simulation + GLSL shaders) and WebGPU (GPU compute simulation + TSL materials). The backend is selected automatically based on renderer capabilities, or forced via `simulationBackend`.

```
                    User Code
                       │
                       ▼
              createParticleSystem(config)
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    Normalize     BufferGeometry  Material
     Config       + Attributes    (GLSL or TSL)
         │             │             │
         └──────┬──────┴─────────────┘
                ▼
     THREE.Points / THREE.Mesh
      (POINTS, INSTANCED, TRAIL, MESH)
                │
                ▼  (every frame)
       updateParticleSystems(cycleData)
                │
    ┌───────────┼───────────────┐
    ▼           ▼               ▼
  Emit      Simulation       Apply
 Particles  (CPU or GPU)    Modifiers
    │           │               │
    └───────────┴───────────────┘
                │
                ├── CPU path: buffer attribute updates → GPU rendering (GLSL)
                └── GPU path: compute dispatch → GPU rendering (TSL/WGSL)
```

---

## Module Map

```
src/js/effects/three-particles/
├── index.ts                         ← Public API re-exports
├── three-particles.ts               ← Core: lifecycle, emission, update loop
├── three-particles-modifiers.ts     ← Per-particle property animation (CPU path)
├── three-particles-curves.ts        ← 30 easing functions
├── three-particles-bezier.ts        ← Custom Bezier curve evaluation + caching
├── three-particles-utils.ts         ← Shape generators, value resolution, texture
├── three-particles-enums.ts         ← SimulationSpace, Shape, SimulationBackend, etc.
├── three-particles-forces.ts        ← Force fields and attractors (CPU path)
├── three-particles-renderer-detect.ts ← WebGPU renderer detection + backend resolution
├── three-particles-serialization.ts ← Config save/load serialization
├── types.ts                         ← Complete TypeScript type definitions
├── shaders/                         ← GLSL shaders (WebGL path)
│   ├── particle-system-vertex-shader.glsl.ts       ← POINTS
│   ├── particle-system-fragment-shader.glsl.ts     ← POINTS
│   ├── instanced-particle-vertex-shader.glsl.ts    ← INSTANCED
│   ├── instanced-particle-fragment-shader.glsl.ts  ← INSTANCED
│   ├── trail-vertex-shader.glsl.ts                 ← TRAIL
│   ├── trail-fragment-shader.glsl.ts               ← TRAIL
│   ├── mesh-particle-vertex-shader.glsl.ts         ← MESH
│   └── mesh-particle-fragment-shader.glsl.ts       ← MESH
└── webgpu/                          ← WebGPU compute + TSL materials
    ├── tsl-materials.ts             ← TSL material factory dispatch
    ├── tsl-shared.ts                ← Shared TSL nodes (texture animation, soft particles)
    ├── tsl-point-sprite-material.ts ← POINTS renderer TSL material
    ├── tsl-instanced-billboard-material.ts ← INSTANCED renderer TSL material
    ├── tsl-mesh-particle-material.ts     ← MESH renderer TSL material
    ├── tsl-trail-ribbon-material.ts      ← TRAIL renderer TSL material
    ├── compute-particle-update.ts   ← Core physics compute shader
    ├── compute-modifiers.ts         ← All 7 modifiers in single compute dispatch
    ├── compute-force-fields.ts      ← Force field GPU compute + encoding
    ├── curve-bake.ts                ← Curve baking (bezier/easing → Float32Array)
    └── tsl-noise.ts                 ← 3D simplex noise in TSL
```

### Module Dependencies

```
index.ts
  └─► three-particles.ts (core)
        ├─► three-particles-modifiers.ts     (CPU path)
        │     ├─► three-particles-curves.ts
        │     └─► three-particles-bezier.ts
        ├─► three-particles-utils.ts
        │     ├─► three-particles-curves.ts
        │     └─► three-particles-bezier.ts
        ├─► three-particles-forces.ts        (CPU path)
        ├─► three-particles-renderer-detect.ts
        ├─► three-particles-serialization.ts
        ├─► three-particles-enums.ts
        ├─► types.ts
        └─► shaders/*.glsl.ts               (WebGL path)

webgpu.ts (separate entry point)
  └─► webgpu/tsl-materials.ts
  └─► webgpu/compute-modifiers.ts
  └─► webgpu/compute-force-fields.ts
```

The `webgpu/` module is loaded **only when the user registers the TSL factory**. It is never imported by the main entry point, keeping the WebGL-only bundle small.

No circular dependencies (enforced by CI via `madge --circular`).

---

## Core Module: `three-particles.ts`

This is the heart of the library (~1,400 lines). It manages everything from creation to disposal.

### Global State

```typescript
const createdParticleSystems: ParticleSystemInstance[] = [];
```

All active particle systems are tracked in this array. `updateParticleSystems()` iterates over it each frame.

### System Creation Flow

```
createParticleSystem(config, externalNow)
  │
  ├─ 1. Merge config with defaults → NormalizedParticleSystemConfig
  │
  ├─ 2. Create GeneralData (runtime state)
  │     ├─ velocities: Vector3[] (per particle)
  │     ├─ creationTimes: number[] (per particle)
  │     ├─ startValues: { size, opacity, colorR/G/B }[] (per particle)
  │     ├─ linearVelocityData / orbitalVelocityData (curve instances)
  │     ├─ noise: { fbm, offsets[] } (FBM sampler)
  │     ├─ burstStates: BurstState[] (per burst config)
  │     └─ freeList: number[] (available particle indices)
  │
  ├─ 3. Create BufferGeometry with attributes:
  │     ├─ position (Float32, size 3)
  │     ├─ size (Float32, size 1)
  │     ├─ colorR, colorG, colorB, colorA (Float32, size 1 each)
  │     ├─ lifetime (Float32, size 1)
  │     ├─ startLifetime (Float32, size 1)
  │     ├─ rotation (Float32, size 1)
  │     ├─ startFrame (Float32, size 1)
  │     ├─ isActive (Float32, size 1)
  │     └─ quat (Float32, size 4) — MESH only, packed quaternion vec4
  │
  ├─ 4. Create ShaderMaterial
  │     ├─ Vertex shader + Fragment shader
  │     ├─ Uniforms: elapsed, map, tiles, fps, backgroundColor...
  │     ├─ Blending mode, depth settings, transparency
  │     └─ Texture (user-provided, default white circle for POINTS/INSTANCED, or solid white 1×1 for MESH)
  │
  ├─ 5. Create THREE.Points / THREE.Mesh (INSTANCED/MESH)
  │      For WORLD mode: matrixWorldAutoUpdate = false, matrixWorld held at identity
  │
  └─ 6. Push to createdParticleSystems[], return ParticleSystem handle
```

### Per-Frame Update Flow

```
updateParticleSystems({ now, delta, elapsed })
  │
  └─ For each ParticleSystemInstance:
      │
      ├─ 1. Calculate timing
      │     ├─ systemElapsed = now - startTime - startDelay
      │     ├─ lifetimePercent = systemElapsed / duration
      │     └─ Skip if in startDelay period
      │
      ├─ 2. Update active particles
      │     For each particle where isActive[i] === 1:
      │     │
      │     ├─ Check expiration: lifetime > startLifetime → deactivate
      │     │
      │     ├─ Apply gravity:
      │     │   velocity -= gravityModifier * worldGravity * delta
      │     │
      │     ├─ Update position:
      │     │   position += velocity * delta
      │     │   (+ worldPositionChange compensation for WORLD space)
      │     │
      │     ├─ Apply modifiers (if active):
      │     │   ├─ Linear velocity
      │     │   ├─ Orbital velocity
      │     │   ├─ Size over lifetime
      │     │   ├─ Opacity over lifetime
      │     │   ├─ Color over lifetime
      │     │   ├─ Rotation over lifetime
      │     │   └─ Noise (position, rotation, size)
      │     │
      │     └─ Increment lifetime: lifetime += delta
      │
      ├─ 3. Emit new particles
      │     ├─ By time: count = rateOverTime * delta
      │     ├─ By distance: count = distanceMoved * rateOverDistance
      │     └─ By bursts: check each burst config timing
      │
      │     For each particle to emit:
      │     ├─ Pop index from freeList
      │     ├─ calculatePositionAndVelocity(shape) → position, velocity
      │     ├─ Set start values (size, speed, opacity, color, rotation)
      │     ├─ Set isActive = 1, lifetime = 0
      │     └─ Store creation time and start values
      │
      ├─ 4. Handle looping / completion
      │     ├─ If looping && lifetimePercent >= 1: reset timer
      │     └─ If !looping && all particles dead: call onComplete
      │
      └─ 5. Mark buffer attributes as needsUpdate = true
```

### Particle Pool (Free List)

Particle activation/deactivation is O(1) using a stack-based free list:

```
Initial state (maxParticles = 5):
  freeList = [4, 3, 2, 1, 0]   ← all indices available

Emit 2 particles:
  pop → index 0 (activate)
  pop → index 1 (activate)
  freeList = [4, 3, 2]

Particle 0 expires:
  push → index 0
  freeList = [4, 3, 2, 0]

Emit 1 particle:
  pop → index 0 (reuse!)
  freeList = [4, 3, 2]
```

No searching, no fragmentation, constant time.

---

## Modifiers Module: `three-particles-modifiers.ts`

Modifiers animate particle properties over their lifetime. Each modifier is applied per-particle per-frame, but only if `isActive: true` in its config.

### Modifier List

| Modifier | Affects | Formula |
|----------|---------|---------|
| Linear Velocity | position | `pos += linearVel * delta` (per axis, supports curves) |
| Orbital Velocity | position | Rotates around emission origin using Euler angles |
| Size Over Lifetime | size attribute | `size = startSize * curve(lifetimePercent)` |
| Opacity Over Lifetime | colorA attribute | `alpha = startOpacity * curve(lifetimePercent)` |
| Color Over Lifetime | colorR/G/B | `color = startColor * curve(lifetimePercent)` (per channel) |
| Rotation Over Lifetime | rotation attribute | `rotation += speed * delta * 0.02` |
| Noise | position, rotation, size | FBM sampling at particle position + offsets |

### Modifier Data Flow

```
applyModifiers({
  delta,                    ← frame time
  generalData,              ← runtime state (velocities, noise, etc.)
  normalizedConfig,         ← system config
  attributes,               ← buffer geometry attributes
  particleLifetimePercentage, ← 0.0 → 1.0
  particleIndex             ← which particle
})
  │
  ├─ velocityOverLifetime.linear → modify position via velocity curves
  ├─ velocityOverLifetime.orbital → rotate position around origin
  ├─ sizeOverLifetime → scale size attribute by curve value
  ├─ opacityOverLifetime → scale alpha attribute by curve value
  ├─ colorOverLifetime → scale R/G/B attributes by separate curves
  ├─ rotationOverLifetime → accumulate rotation angle
  └─ noise → FBM-based turbulence on position/rotation/size
```

---

## Curves & Bezier: Value Interpolation

### Easing Functions (`three-particles-curves.ts`)

30 built-in easing functions organized as:

```
Linear
Quadratic    (In, Out, InOut)
Cubic        (In, Out, InOut)
Quartic      (In, Out, InOut)
Quintic      (In, Out, InOut)
Sinusoidal   (In, Out, InOut)
Exponential  (In, Out, InOut)
Circular     (In, Out, InOut)
Elastic      (In, Out, InOut)
Back         (In, Out, InOut)
Bounce       (In, Out, InOut)
```

Resolved via `getCurveFunction(CurveFunctionId) → (t: number) => number`.

### Bezier Curves (`three-particles-bezier.ts`)

Custom curves defined by control points, evaluated using Bernstein polynomials:

```
value = Σ C(n,i) * (1-t)^(n-i) * t^i * y_i
```

**Caching system:**
- Bezier functions are cached by control point identity
- Multiple particle systems can share the same curve function
- Reference counting: `{ bezierPoints, curveFunction, referencedBy: [systemIds] }`
- Auto-cleanup when last reference is removed

---

## Utils Module: `three-particles-utils.ts`

### Shape Position/Velocity Generators

Each shape has a `calculateRandomPositionAndVelocityOn<Shape>` function:

| Shape | Parameters | Velocity Direction |
|-------|-----------|-------------------|
| **Sphere** | radius, radiusThickness, arc | Radial outward |
| **Cone** | angle, radius, radiusThickness, arc | Along cone surface |
| **Circle** | radius, radiusThickness, arc | +Z (perpendicular) |
| **Rectangle** | rotation, scale | +Z (perpendicular) |
| **Box** | scale, emitFrom (Volume/Shell/Edge) | +Z |

All functions output to pre-allocated `position: Vector3` and `velocity: Vector3` objects, then apply the emitter's `quaternion` rotation.

### Value Resolution

`calculateValue(systemId, value, time)` handles the polymorphic value system:

```
number              → return as-is
{ min, max }        → random between min and max
LifetimeCurve       → evaluate curve at time, multiply by scale
```

---

## Shader Pipeline

### Vertex Shader

**Input:** Per-particle buffer attributes + Three.js matrices

**Processing:**
1. Pass color, lifetime, rotation, startFrame to fragment shader as varyings
2. Calculate model-view position
3. Calculate perspective-correct point size: `size * (100.0 / distance)`
4. Output `gl_Position` and `gl_PointSize`

### Fragment Shader

**Input:** Varyings from vertex + uniforms (texture, tiles, fps, etc.)

**Processing:**
1. **Frame calculation:**
   - Lifetime mode: `frame = startFrame + (lifetime/startLifetime) * totalTiles`
   - FPS mode: `frame = startFrame + elapsed * fps`

2. **UV mapping:** Convert frame index to 2D tile grid coordinates → UV offset

3. **Rotation:** Apply 2D rotation matrix around particle center

4. **Circle clipping:** Discard fragments outside radius 0.5 from center

5. **Texture sampling:** Sample rotated UV from texture atlas

6. **Background removal:** Optionally discard if color matches background within tolerance

7. **Color multiply:** `finalColor = textureColor * vertexColor`

### Buffer Attributes Summary

| Attribute | Type | Size | Updated Per Frame |
|-----------|------|------|-------------------|
| position | Float32 | 3 | Yes (velocity + modifiers) |
| size | Float32 | 1 | Yes (size over lifetime + noise) |
| colorR | Float32 | 1 | Yes (color over lifetime) |
| colorG | Float32 | 1 | Yes (color over lifetime) |
| colorB | Float32 | 1 | Yes (color over lifetime) |
| colorA | Float32 | 1 | Yes (opacity over lifetime) |
| lifetime | Float32 | 1 | Yes (incremented by delta) |
| startLifetime | Float32 | 1 | No (set at emission) |
| rotation | Float32 | 1 | Yes (rotation over lifetime + noise) |
| startFrame | Float32 | 1 | No (set at emission) |
| isActive | Float32 | 1 | Yes (activate/deactivate) |
| quat | Float32 | 4 | Yes — MESH only (synced from rotation) |

---

## World vs Local Simulation Space

### Local Space (default)
- Particles are children of the emitter in the Three.js scene graph
- Moving or rotating the emitter moves/rotates all particles with it
- Buffer stores positions in the emitter's local frame
- Gravity and force field positions/directions are CPU-transformed into the emitter's local frame each frame so they stay world-aligned

### World Space
- Buffer stores positions in **world coordinates** directly
- `particleSystem.matrixWorld` is held at identity (via `matrixWorldAutoUpdate = false`) so the buffer renders as-is
- `generalData.sourceWorldMatrix` captures the emitter pose each frame
  (`parent.matrixWorld × particleSystem.matrix`) — used only to place new
  particles and orient the emission shape; existing particles are not moved
- No per-frame position compensation is required
- Gravity is applied as a constant world vector; force field positions and directions flow through unchanged
- `instance.position` / `instance.rotation` (Option 2 semantics, matching Unity)
  offset the spawn origin under the parent but do not drag already-emitted particles

---

## Performance Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Free list pool** | O(1) particle activate/deactivate, no searching |
| **Pre-allocated objects** | Reuse Vector3/Quaternion/Euler to avoid GC pressure in update loop |
| **Lazy modifier evaluation** | Skip inactive modifiers entirely (no computation) |
| **Bezier cache** | Avoid recalculating identical curves across systems |
| **Buffer attributes** | Single GPU upload per frame, GPU handles per-particle rendering |
| **THREE.Points / InstancedMesh** | Single draw call for all particles per renderer type |
| **4 renderer types** | POINTS (default), INSTANCED (no gl_PointSize limit), TRAIL (ribbon geometry), MESH (3D geometry with lighting) |
| **Perspective point size** | `100.0 / distance` — computed in vertex shader on GPU (POINTS renderer) |

### Hot Paths (Performance Critical)

These run every frame for every active particle — avoid allocations here:

1. `updateParticleSystemInstance()` — main update loop
2. `applyModifiers()` — modifier chain
3. Position/velocity arithmetic in the update loop
4. Noise sampling (FBM with octaves)

---

## Key Types

### ParticleSystemConfig (User Input)

All fields optional — merged with defaults at creation:

```typescript
{
  // Transform
  transform: { position, rotation, scale }

  // Timing
  duration, looping, startDelay

  // Start properties (Constant | Random | Curve)
  startLifetime, startSpeed, startSize, startOpacity, startRotation, startColor

  // Emission
  emission: { rateOverTime, rateOverDistance, bursts[] }

  // Shape
  shape: { shape: Shape, ...shapeParams }

  // Modifiers
  velocityOverLifetime, sizeOverLifetime, opacityOverLifetime
  colorOverLifetime, rotationOverLifetime, noise

  // Renderer
  renderer: { blending, transparent, depthTest, depthWrite }

  // Texture
  map, textureSheetAnimation: { tiles, timeMode, fps }

  // System
  maxParticles, simulationSpace, gravityModifier

  // Callbacks
  onUpdate, onComplete
}
```

### ParticleSystem (Returned Handle)

```typescript
{
  instance: THREE.Points | THREE.Mesh  // Add to scene (type depends on renderer)
  update(cycleData)                   // Call every frame
  dispose()                           // Cleanup
  pauseEmitter()                      // Stop emitting
  resumeEmitter()                     // Resume emitting
}
```

### CycleData (Per-Frame Input)

```typescript
{
  now: number      // Current time in milliseconds
  delta: number    // Seconds since last frame
  elapsed: number  // Total elapsed seconds
}
```

---

## WebGPU Dual-Path Architecture

### Overview

When a WebGPU-capable renderer is detected and the TSL material factory is registered, the library switches to a fully GPU-accelerated pipeline. The existing WebGL path (CPU simulation + GLSL shaders) remains completely untouched — all WebGPU code is additive.

```
createParticleSystem(config)
        │
        ▼
  resolveSimulationBackend(renderer, config.simulationBackend)
        │
        ├── GPU path (WebGPURenderer + TSL factory registered)
        │   ├── Material: TSL NodeMaterial (compiles to WGSL)
        │   ├── Simulation: GPU compute shaders (storage buffers)
        │   └── Emission: CPU → flush to GPU via staging writes
        │
        └── CPU path (WebGLRenderer or no factory)
            ├── Material: GLSL ShaderMaterial
            ├── Simulation: JavaScript update loop
            └── Emission: CPU (direct buffer attribute writes)
```

### Renderer Detection

`three-particles-renderer-detect.ts` uses duck-typing (no class checks):

- `isComputeCapableRenderer(renderer)` — checks for `.compute()` and `.hasFeature()` methods
- `resolveSimulationBackend(renderer, preference)` — maps user preference + renderer capability to `CPU` or `GPU`

### TSL Material System

TSL (Three Shading Language) materials are node-based and compile to WGSL for WebGPU. Each renderer type has a dedicated TSL material:

| Renderer Type | TSL Material File | Key Feature |
|---------------|-------------------|-------------|
| POINTS | `tsl-point-sprite-material.ts` | Point size based on distance |
| INSTANCED | `tsl-instanced-billboard-material.ts` | Camera-facing quads, no gl_PointSize limit |
| MESH | `tsl-mesh-particle-material.ts` | 3D geometry with quaternion rotation |
| TRAIL | `tsl-trail-ribbon-material.ts` | Pre-baked ribbon geometry |

Materials detect GPU compute mode via a `gpuCompute` flag:
- **GPU compute active:** materials read particle data from packed vec4 storage buffers
- **CPU simulation:** materials read individual float attributes (same as GLSL path)

Shared TSL nodes (`tsl-shared.ts`) provide texture sheet animation, soft particles, and background discard — reused across all material types.

### GPU Compute Pipeline

All per-particle physics and modifiers run in a **single GPU compute dispatch** per frame:

```
CPU: system.update(cycleData)
  │
  ├── 1. Emit particles (CPU-side)
  │     └── Queue new particle data
  │
  ├── 2. flushEmitQueue() → write queued particles to GPU storage buffers
  │
  └── 3. renderer.compute(system.computeNode) → GPU dispatch
        │
        ├── Core physics (compute-particle-update.ts):
        │   ├── Gravity application
        │   ├── Velocity integration → position update
        │   ├── Lifetime tracking
        │   ├── Death detection (lifetime > startLifetime → deactivate)
        │   └── World-space compensation
        │
        ├── Modifiers (compute-modifiers.ts, single dispatch):
        │   ├── Size over lifetime (curve lookup)
        │   ├── Opacity over lifetime (curve lookup)
        │   ├── Color over lifetime (3 RGB curves)
        │   ├── Rotation over lifetime
        │   ├── Linear velocity (per-axis X/Y/Z curves)
        │   ├── Orbital velocity (Euler rotation around offset)
        │   └── Noise (3D simplex FBM via tsl-noise.ts)
        │
        └── Force fields (compute-force-fields.ts):
            ├── POINT: radial attract/repel with falloff
            └── DIRECTIONAL: constant direction force
```

### Storage Buffer Layout

GPU particle data is stored in 8 storage buffer bindings (packed as vec4):

| Buffer | Content (vec4) | Description |
|--------|---------------|-------------|
| `position` | xyz + padding | Particle world position |
| `velocity` | xyz + padding | Particle velocity |
| `color` | rgba | Particle color (modifiable) |
| `particleState` | lifetime, size, rotation, startFrame | Per-frame mutable state |
| `startValues` | startLifetime, startSize, startOpacity, startColorR | Immutable spawn values |
| `startColorsExt` | startColorG, startColorB, rotationSpeed, noiseOffset | Extended spawn values |
| `orbitalIsActive` | offsetX, offsetY, offsetZ, isActive | Orbital velocity state + active flag |
| `curveData` | float[] | Baked curves + force field data + per-particle init data |

### Curve Baking

Lifetime curves (bezier, easing) are baked to `Float32Array` at system creation time:

- **Resolution:** 256 samples per curve (1 KB each)
- **GPU lookup:** `data[curveIndex * 256 + floor(t * 255)]` with linear interpolation
- **Error:** <0.4% vs analytical curve evaluation
- Stored in the `curveData` buffer, shared across all modifiers

### Force Field Encoding

Force fields are packed into the tail of `curveData`:

- 12 floats per field x max 16 fields = 192 floats
- Layout: isActive, type (0=POINT/1=DIRECTIONAL), position, direction, strength, range, falloff, padding
- Updated per frame from CPU via `encodeForceFieldsForGPU()`
- Infinity encoded as 1e10 (avoids Float32 issues)

### CPU↔GPU Sync

**Emission flow:**
1. CPU emits particle → writes to staging queue
2. `flushEmitQueue()` copies queued data to GPU storage buffers (28 floats per particle)
3. Compute shader reads init flags and initializes new particles
4. Prevents overwriting active particle data when slots are recycled

**Death detection:**
- GPU detects death (`lifetime > startLifetime`) and sets `isActive = 0`
- CPU also tracks death independently for sub-emitter callbacks (no GPU readback needed)
- When sub-emitters with death triggers exist, a lightweight CPU-side "shadow simulation" tracks approximate positions

### Limitations

- **Trail renderer** (`RendererType.TRAIL`) always uses CPU simulation — GPU compute does not apply
- **Sub-emitters** are forced to `SimulationBackend.CPU`
- **Max 16 force fields** per system on GPU
- **No async GPU readback** — CPU cannot read particle positions from GPU without a frame stall
- **Curve resolution** capped at 256 samples per curve
