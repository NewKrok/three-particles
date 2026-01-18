<p align="center">
  <img src="assets/images/logo-colorful.png" alt="THREE Particles Logo" width="150" />
</p>

# THREE Particles
[![Run Tests](https://github.com/NewKrok/three-particles/actions/workflows/test.yml/badge.svg)](https://github.com/NewKrok/three-particles/actions/workflows/test.yml)
[![NPM Version](https://img.shields.io/npm/v/@newkrok/three-particles.svg)](https://www.npmjs.com/package/@newkrok/three-particles)
[![NPM Downloads](https://img.shields.io/npm/dw/@newkrok/three-particles.svg)](https://www.npmjs.com/package/@newkrok/three-particles)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@newkrok/three-particles)](https://bundlephobia.com/package/@newkrok/three-particles)

Particle system for ThreeJS.

# Features

*   Easy integration with Three.js.
*   Visual editor for creating and fine-tuning effects: [THREE Particles Editor](https://github.com/NewKrok/three-particles-editor)
*   Highly customizable particle properties (position, velocity, size, color, alpha, rotation, etc.).
*   Support for various emitter shapes and parameters.
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
const { instance } = createParticleSystem(effect);
scene.add(instance);

// Update the particle system in your animation loop
// Pass the current time, delta time, and elapsed time
updateParticleSystems({now, delta, elapsed});
```

# Documentation

Automatically generated TypeDoc: [https://newkrok.github.io/three-particles/](https://newkrok.github.io/three-particles/)

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
