# Sub-Emitters Implementation Plan

## Overview

Sub-emitters allow spawning new particle systems when a particle **dies** (or is **born**). This enables complex, layered effects like fireworks (rocket particle dies → explosion), fire trails (spark dies → smoke), etc.

## Design Decisions

### Trigger Types
- **`death`** — spawn sub-emitter when particle reaches end of lifetime (primary use case)
- **`birth`** — spawn sub-emitter when a new particle is activated (secondary, useful for trails)

### Configuration API

```typescript
// New type in types.ts
type SubEmitterTrigger = 'birth' | 'death';

type SubEmitterConfig = {
  /** The particle system config for the sub-emitter */
  config: ParticleSystemConfig;
  /** When to trigger the sub-emitter */
  trigger: SubEmitterTrigger;
  /** Whether the sub-emitter inherits the parent particle's velocity */
  inheritVelocity?: number; // 0-1 multiplier, default 0
  /** Maximum concurrent sub-emitter instances (performance guard) */
  maxInstances?: number; // default 32
};

// Added to ParticleSystemConfig
subEmitters?: Array<SubEmitterConfig>;
```

### Lifecycle Management
- Sub-emitter instances are **non-looping** by default (play once and auto-dispose)
- Each sub-emitter spawns at the **parent particle's position** at trigger time
- Sub-emitters are added to the **same parent** (scene) as the main system
- When the parent system is disposed, all sub-emitter instances are also disposed
- `maxInstances` cap prevents runaway memory/performance issues

---

## Implementation Steps

### Step 1: Type Definitions (`types.ts`)

Add to types.ts:
- `SubEmitterTrigger` type (`'birth' | 'death'`)
- `SubEmitterConfig` type with fields: `config`, `trigger`, `inheritVelocity`, `maxInstances`
- Add optional `subEmitters?: Array<SubEmitterConfig>` to `ParticleSystemConfig`
- Add `ParticleDeathData` type: `{ position: THREE.Vector3, velocity: THREE.Vector3 }`

### Step 2: Enum for triggers (`three-particles-enums.ts`)

Add `SubEmitterTrigger` enum:
```typescript
export enum SubEmitterTrigger {
  BIRTH = 'birth',
  DEATH = 'death',
}
```

### Step 3: Core Logic (`three-particles.ts`)

#### 3a: Track sub-emitter instances per system
- Add `subEmitterInstances: Array<ParticleSystem>` to the closure in `createParticleSystem`
- On dispose, iterate and dispose all sub-emitter instances

#### 3b: Hook into particle death (line ~1250-1251)
Before `deactivateParticle(index)` is called, check if there are death-triggered sub-emitters:
```typescript
if (particleLifetime > startLifetimeArr[index]) {
  // NEW: trigger death sub-emitters
  if (deathSubEmitters.length > 0) {
    const posIndex = index * 3;
    _deathPosition.set(
      positionArr[posIndex],
      positionArr[posIndex + 1],
      positionArr[posIndex + 2]
    );
    spawnSubEmitters(deathSubEmitters, _deathPosition, velocities[index], now);
  }
  deactivateParticle(index);
}
```

#### 3c: Hook into particle birth (inside activateParticle or emission section)
After a particle is activated, trigger birth sub-emitters similarly.

#### 3d: `spawnSubEmitters` helper function
```typescript
const spawnSubEmitters = (
  subEmitterConfigs: Array<SubEmitterConfig>,
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  now: number
) => {
  for (const subConfig of subEmitterConfigs) {
    if (subEmitterInstances.length >= (subConfig.maxInstances ?? 32)) {
      // Remove oldest completed instance or skip
      cleanupCompletedSubEmitters();
      if (subEmitterInstances.length >= (subConfig.maxInstances ?? 32)) continue;
    }

    const subSystem = createParticleSystem(
      {
        ...subConfig.config,
        looping: false, // sub-emitters play once
        _position: { x: position.x, y: position.y, z: position.z },
      },
      now
    );

    // Position the sub-emitter at the parent particle's location
    subSystem.instance.position.copy(position);

    // Inherit velocity if configured
    // (applied via startSpeed direction)

    // Add to scene
    const parent = (wrapper || particleSystem).parent;
    if (parent) parent.add(subSystem.instance);

    subEmitterInstances.push(subSystem);
  }
};
```

#### 3e: Update sub-emitters in the system's update function
Sub-emitter instances are already tracked in the global `createdParticleSystems` array, so `updateParticleSystems()` handles them automatically. No extra update logic needed.

#### 3f: Cleanup logic
- `cleanupCompletedSubEmitters()`: remove instances that have finished (non-looping + all particles dead)
- On parent `dispose()`: dispose all sub-emitter instances

### Step 4: Normalization

Update config normalization to handle the new `subEmitters` field with defaults:
- Default `inheritVelocity`: 0
- Default `maxInstances`: 32
- Default `trigger`: `SubEmitterTrigger.DEATH`

### Step 5: Tests (`src/__tests__/three-particles-sub-emitters.test.ts`)

New test file covering:
1. **Death trigger**: particles die → sub-emitter systems spawned at correct positions
2. **Birth trigger**: particles born → sub-emitter spawned
3. **maxInstances cap**: verify cap is respected
4. **Dispose cleanup**: parent dispose → all sub-emitters disposed
5. **No sub-emitters**: existing behavior unchanged when `subEmitters` not configured
6. **Inherit velocity**: velocity passed to sub-emitter
7. **Nested sub-emitters**: sub-emitter with its own sub-emitters (bounded by maxInstances)

### Step 6: Export & Documentation

- Export new types and enum from `index.ts`
- Add JSDoc comments to all new types
- Update CLAUDE.md project status table (Sub-emitters: ✅)
- Update ROADMAP.md

---

## Files Modified

| File | Changes |
|------|---------|
| `src/js/effects/three-particles/types.ts` | Add `SubEmitterTrigger`, `SubEmitterConfig`, `ParticleDeathData`; extend `ParticleSystemConfig` |
| `src/js/effects/three-particles/three-particles-enums.ts` | Add `SubEmitterTrigger` enum |
| `src/js/effects/three-particles/three-particles.ts` | Hook death/birth events, spawn sub-emitters, cleanup logic |
| `src/js/effects/three-particles/index.ts` | Export new types (if not already re-exported) |
| `src/__tests__/three-particles-sub-emitters.test.ts` | New test file |
| `CLAUDE.md` | Update status table |
| `ROADMAP.md` | Mark sub-emitters as completed |

## Performance Considerations

- Reuse `THREE.Vector3` for death position (avoid allocation in hot loop)
- `maxInstances` cap prevents unbounded growth
- Sub-emitters are regular particle systems — no special render path needed
- Cleanup completed sub-emitters lazily to avoid per-frame overhead
