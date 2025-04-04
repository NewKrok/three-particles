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
<!-- Please verify this path points to the correct UMD/IIFE bundle -->
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
