<p align="center">
  <img src="assets/images/logo-colorful.png" alt="THREE Particles Logo" width="150" />
</p>

# THREE Particles
[![npm](https://img.shields.io/npm/v/@newkrok/three-particles.svg)](https://www.npmjs.com/package/@newkrok/three-particles)
[![downloads](https://img.shields.io/npm/dm/@newkrok/three-particles.svg)](https://www.npmjs.com/package/@newkrok/three-particles)
[![CI](https://github.com/NewKrok/three-particles/actions/workflows/ci.yml/badge.svg)](https://github.com/NewKrok/three-particles/actions/workflows/ci.yml)
[![gzip](https://img.shields.io/bundlephobia/minzip/@newkrok/three-particles)](https://bundlephobia.com/package/@newkrok/three-particles)
[![license](https://img.shields.io/npm/l/@newkrok/three-particles.svg)](https://github.com/NewKrok/three-particles/blob/master/LICENSE)
[![docs](https://img.shields.io/badge/docs-online-blue)](https://newkrok.github.io/three-particles/api/)

Particle system for ThreeJS.

# Features

*   Easy integration with Three.js.
*   Visual editor for creating and fine-tuning effects: [THREE Particles Editor](https://github.com/NewKrok/three-particles-editor)
*   Highly customizable particle properties (position, velocity, size, color, alpha, rotation, etc.).
*   Support for various emitter shapes and parameters.
*   Force fields and attractors for dynamic particle behavior (point attraction/repulsion, directional wind).
*   Sub-emitters triggered on particle birth or death events.
*   Serialization support for saving and loading particle system configs.
*   GPU instancing renderer (`RendererType.INSTANCED`) — removes `gl_PointSize` hardware limit, ideal for large particles or high particle counts.
*   Trail / Ribbon renderer (`RendererType.TRAIL`) — continuous ribbon trails behind particles with configurable width, opacity, and color tapering.
*   Mesh particle renderer (`RendererType.MESH`) — render each particle as a 3D mesh (debris, gems, coins) using GPU instancing with full 3D rotation and simple directional lighting.
*   Soft particles — depth-based alpha fade near opaque geometry, eliminating hard intersection lines.
*   **WebGPU compute support** — GPU compute shaders for particle simulation (gravity, velocity, modifiers, force fields, noise) via Three.js TSL. Enables 50K-350K+ particles at full framerate. Automatic fallback to CPU when WebGPU is unavailable.
*   TypeDoc API documentation available.

# Live Demo & Examples

*   **Editor & Live Demo:** [https://newkrok.com/three-particles-editor/index.html](https://newkrok.com/three-particles-editor/index.html)
*   **CodePen Basic Example:** [https://codepen.io/NewKrok/pen/GgRzEmP](https://codepen.io/NewKrok/pen/GgRzEmP)
*   **CodePen Fire Animation:** [https://codepen.io/NewKrok/pen/ByabNRJ](https://codepen.io/NewKrok/pen/ByabNRJ)
*   **CodePen Projectile Simulation:** [https://codepen.io/NewKrok/pen/jEEErZy](https://codepen.io/NewKrok/pen/jEEErZy)
*   **Video - Projectiles:** [https://youtu.be/Q352JuxON04](https://youtu.be/Q352JuxON04)
*   **Video - First Preview:** [https://youtu.be/dtN_bndvoGU](https://youtu.be/dtN_bndvoGU)

# Installation

## NPM

```bash
npm install @newkrok/three-particles
```

## CDN (Browser)

Include the script directly in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@newkrok/three-particles@latest/dist/three-particles.min.js"></script>
<!-- or -->
<script src="https://unpkg.com/@newkrok/three-particles@latest/dist/three-particles.min.js"></script>
```

# Usage

Here's a basic example of how to load and use a particle system:

```javascript
// Create a particle system
const effect = {
  // Your effect configuration here
  // It can be empty to use default settings
};
const system = createParticleSystem(effect);
scene.add(system.instance);

// Update the particle system in your animation loop
// Pass the current time, delta time, and elapsed time
updateParticleSystems({now, delta, elapsed});

// Update configuration at runtime without recreating the system
system.updateConfig({
  gravity: -9.8,
  forceFields: [{ type: 'DIRECTIONAL', direction: { x: 1, y: 0, z: 0 }, strength: 5 }],
});
```

# Usage with React Three Fiber

The library works seamlessly with [React Three Fiber](https://github.com/pmndrs/react-three-fiber). No additional wrapper package is needed — use `createParticleSystem` directly with React hooks:

```tsx
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import {
  createParticleSystem,
  Shape,
  type ParticleSystem,
} from "@newkrok/three-particles";
import * as THREE from "three";

function FireEffect({ config }: { config?: Record<string, unknown> }) {
  const groupRef = useRef<THREE.Group>(null);
  const systemRef = useRef<ParticleSystem | null>(null);

  useEffect(() => {
    const system = createParticleSystem({
      duration: 5,
      looping: true,
      maxParticles: 200,
      startLifetime: { min: 0.5, max: 1.5 },
      startSpeed: { min: 1, max: 3 },
      startSize: { min: 0.3, max: 0.8 },
      startColor: {
        min: { r: 1, g: 0.2, b: 0 },
        max: { r: 1, g: 0.8, b: 0 },
      },
      gravity: -1,
      emission: { rateOverTime: 50 },
      shape: { shape: Shape.CONE, cone: { angle: 0.2, radius: 0.3 } },
      renderer: {
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      },
      ...config,
    });

    systemRef.current = system;
    groupRef.current?.add(system.instance);

    return () => {
      system.dispose();
    };
  }, [config]);

  useFrame((_, delta) => {
    systemRef.current?.update({
      now: performance.now(),
      delta,
      elapsed: 0,
    });
  });

  return <group ref={groupRef} />;
}

// In your R3F Canvas:
// <Canvas>
//   <FireEffect />
// </Canvas>
```

**Key points:**
- Use `useEffect` to create and dispose the particle system
- Use `useFrame` to drive updates each frame (call `system.update()` instead of `updateParticleSystems()` for per-system control)
- Add the `system.instance` to a `<group>` ref so R3F manages the scene graph
- Return a cleanup function from `useEffect` that calls `system.dispose()`

# WebGPU Compute Support

Optional GPU-accelerated particle simulation via Three.js WebGPU renderer and TSL (Three Shading Language). Offloads all per-particle physics and modifiers to GPU compute shaders, enabling **50K-350K+ particles** at interactive frame rates.

## Requirements

- Three.js **r182+** with the WebGPU build (`three/webgpu`)
- A browser with [WebGPU support](https://caniuse.com/webgpu) (Chrome 113+, Edge 113+, Firefox Nightly)
- No breaking changes — all existing WebGL code works unchanged

## Setup

```typescript
// 1. Import from the WebGPU sub-module
import { registerTSLMaterialFactory, SimulationBackend } from "@newkrok/three-particles";
import {
  createTSLParticleMaterial,
  createTSLTrailMaterial,
  createComputePipeline,
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
  encodeForceFieldsForGPU,
} from "@newkrok/three-particles/webgpu";

// 2. Register the TSL material factory (once, before creating any particle system)
registerTSLMaterialFactory({
  createTSLParticleMaterial,
  createTSLTrailMaterial,
  createComputePipeline,
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
  encodeForceFieldsForGPU,
});

// 3. Create a WebGPU renderer
import * as THREE from "three/webgpu";
const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();

// 4. Create a GPU-accelerated particle system
const system = createParticleSystem({
  simulationBackend: SimulationBackend.AUTO, // GPU if WebGPU available, else CPU
  maxParticles: 100000,
  // ... rest of your config (same API as CPU)
});

scene.add(system.instance);

// 5. In your render loop — dispatch compute before rendering
function animate() {
  system.update({ now: performance.now(), delta, elapsed });

  if (system.computeNode) {
    renderer.compute(system.computeNode);
  }
  renderer.render(scene, camera);
}
```

## SimulationBackend

| Value | Behavior |
|-------|----------|
| `AUTO` (default) | GPU compute if WebGPU renderer detected, else CPU |
| `CPU` | Always JavaScript update loop (works with any renderer) |
| `GPU` | Request GPU compute; falls back to CPU if renderer lacks compute support |

## What Runs on GPU

- **Core physics:** gravity, velocity integration, position update, lifetime tracking
- **All 7 modifiers:** size/opacity/color over lifetime, rotation, linear velocity, orbital velocity, noise (3D simplex FBM)
- **Force fields:** point attractors/repulsors and directional forces with falloff (up to 16 per system)
- **Curves:** baked into 256-sample lookup arrays for fast GPU evaluation (<0.4% error)

## What Stays on CPU

- **Emission** — particle activation, burst scheduling, rate-over-distance
- **Sub-emitters** — birth/death trigger spawning
- **Configuration changes** — `updateConfig()` applies on the next frame
- **Trail renderer** — TRAIL type always uses CPU simulation (other renderer types work with GPU)

## Fallback Behavior

WebGPU is fully opt-in and non-breaking:
- If no TSL factory is registered, the library uses GLSL shaders (WebGL path)
- If `simulationBackend: 'GPU'` but WebGPU is unavailable, it silently falls back to CPU
- The same particle config works identically on both backends

# Documentation

Automatically generated TypeDoc: [https://newkrok.github.io/three-particles/api/](https://newkrok.github.io/three-particles/api/)

## Important Notes

### Color Over Lifetime

The `colorOverLifetime` feature uses a **multiplier-based approach** (similar to Unity's particle system), where each RGB channel curve acts as a multiplier applied to the particle's `startColor`.

**Formula:** `finalColor = startColor * colorOverLifetime`

**⚠️ Important:** To achieve full color transitions, set `startColor` to white `{ r: 1, g: 1, b: 1 }`. If any channel in `startColor` is set to 0, that channel cannot be modified by `colorOverLifetime`.

**Example - Rainbow effect:**
```javascript
{
  startColor: {
    min: { r: 1, g: 1, b: 1 },  // White - allows full color range
    max: { r: 1, g: 1, b: 1 }
  },
  colorOverLifetime: {
    isActive: true,
    r: {  // Red: full → half → off
      type: 'BEZIER',
      scale: 1,
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 0.5, y: 0.5, percentage: 0.5 },
        { x: 1, y: 0, percentage: 1 }
      ]
    },
    g: {  // Green: off → full → off
      type: 'BEZIER',
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 0.5, y: 1, percentage: 0.5 },
        { x: 1, y: 0, percentage: 1 }
      ]
    },
    b: {  // Blue: off → half → full
      type: 'BEZIER',
      scale: 1,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 0.5, y: 0.5, percentage: 0.5 },
        { x: 1, y: 1, percentage: 1 }
      ]
    }
  }
}
```
