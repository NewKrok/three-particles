# Architecture

## High-Level Overview

```
                    User Code
                       │
                       ▼
              createParticleSystem(config)
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    Normalize     BufferGeometry  ShaderMaterial
     Config       + Attributes    + Uniforms
         │             │             │
         └──────┬──────┴─────────────┘
                ▼
          THREE.Points
                │
                ▼  (every frame)
       updateParticleSystems(cycleData)
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
  Emit      Update       Apply
 Particles  Positions   Modifiers
    │           │           │
    └───────────┴───────────┘
                │
                ▼
          GPU Rendering
       (Vertex + Fragment Shaders)
```

---

## Module Map

```
src/js/effects/three-particles/
├── index.ts                    ← Public API re-exports
├── three-particles.ts          ← Core: lifecycle, emission, update loop
├── three-particles-modifiers.ts ← Per-particle property animation
├── three-particles-curves.ts   ← 30 easing functions
├── three-particles-bezier.ts   ← Custom Bezier curve evaluation + caching
├── three-particles-utils.ts    ← Shape generators, value resolution, texture
├── three-particles-enums.ts    ← SimulationSpace, Shape, EmitFrom, etc.
├── types.ts                    ← Complete TypeScript type definitions
└── shaders/
    ├── particle-system-vertex-shader.glsl.ts    ← Position, size, color → GPU
    └── particle-system-fragment-shader.glsl.ts  ← Texture, rotation, animation
```

### Module Dependencies

```
index.ts
  └─► three-particles.ts (core)
        ├─► three-particles-modifiers.ts
        │     ├─► three-particles-curves.ts
        │     └─► three-particles-bezier.ts
        ├─► three-particles-utils.ts
        │     ├─► three-particles-curves.ts
        │     └─► three-particles-bezier.ts
        ├─► three-particles-enums.ts
        ├─► types.ts
        └─► shaders/*.glsl.ts
```

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
  │     └─ isActive (Float32, size 1)
  │
  ├─ 4. Create ShaderMaterial
  │     ├─ Vertex shader + Fragment shader
  │     ├─ Uniforms: elapsed, map, tiles, fps, backgroundColor...
  │     ├─ Blending mode, depth settings, transparency
  │     └─ Texture (user-provided or default white circle)
  │
  ├─ 5. Create THREE.Points (or Gyroscope wrapper for WORLD space)
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

---

## World vs Local Simulation Space

### Local Space (default)
- Particles are children of the emitter
- Moving the emitter moves all particles with it
- No position compensation needed
- Uses `THREE.Points` directly

### World Space
- Particles stay fixed in world coordinates after emission
- Emitter movement tracked via `Gyroscope` (from `@newkrok/three-utils`)
- Each frame: `position -= worldPositionChange` to counteract emitter movement
- Useful for: trails, smoke, fire that should persist in place

---

## Performance Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Free list pool** | O(1) particle activate/deactivate, no searching |
| **Pre-allocated objects** | Reuse Vector3/Quaternion/Euler to avoid GC pressure in update loop |
| **Lazy modifier evaluation** | Skip inactive modifiers entirely (no computation) |
| **Bezier cache** | Avoid recalculating identical curves across systems |
| **Buffer attributes** | Single GPU upload per frame, GPU handles per-particle rendering |
| **THREE.Points** | Single draw call for all particles (not individual meshes) |
| **Perspective point size** | `100.0 / distance` — computed in vertex shader on GPU |

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
  instance: THREE.Points | Gyroscope  // Add to scene
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
