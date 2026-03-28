# Roadmap

## Completed

| Feature | Status |
|---------|--------|
| Core particle system | ✅ |
| Shape emitters (Sphere, Cone, Circle, Rectangle, Box) | ✅ |
| Lifetime modifiers (size, opacity, color, rotation, velocity) | ✅ |
| Noise module (FBM) | ✅ |
| Texture sheet animation | ✅ |
| World/Local simulation space | ✅ |
| Burst emission | ✅ |
| Rate over distance emission | ✅ |
| Sub-emitters (birth/death triggers) | ✅ |
| Force fields / Attractors (point, directional) | ✅ |
| Serialization / Deserialization | ✅ |
| Visual editor (three-particles-editor) | ✅ |
| TypeDoc API documentation | ✅ |
| Interactive examples page (GitHub Pages) | ✅ |
| CI/CD auto release (npm publish on master push) | ✅ |
| PR checks (lint + test + build + bundle size + CodeQL) | ✅ |
| Bundle size monitoring (150 KB limit) | ✅ |
| Performance benchmark suite | ✅ |
| Test coverage ≥90% stmt, ≥80% branch | ✅ |
| `llms.txt` / `llms-full.txt` | ✅ |
| `CHANGELOG.md`, `CONTRIBUTING.md` | ✅ |
| tsup build (ESM + minified + DTS) | ✅ |
| GPU Instancing (`InstancedBufferGeometry` renderer) | ✅ |
| React Three Fiber integration (docs + usage guide) | ✅ |
| Trail / Ribbon Renderer (`RendererType.TRAIL`) | ✅ |
| Trail improvements (smoothing, adaptive sampling, maxTime, twist prevention, connected ribbons) | ✅ |
| Mesh Particle Renderer (`RendererType.MESH`) | ✅ |

---

## High Priority — Performance & Ecosystem

### WebGPU Compute Support
- Leverage Three.js WebGPU renderer (production-ready since r171)
- Compute shaders for particle simulation on GPU — 10-100x performance for large systems
- Automatic fallback to WebGL when WebGPU is unavailable

---

## High Priority — Trail Renderer Improvements (Phase 2)

### UV Texture Modes
- Support Stretch (current), Tile, Per-Segment, and Distribute modes
- Tile mode enables repeating chain/lightning textures along the ribbon
- Per-Segment mode maps one texture copy per ribbon segment

### UV Scrolling / Animated UV
- Scrolling UV offset along the trail over time (energy, lava, electricity effects)
- Configurable scroll speed and direction (U, V, or both axes)
- Integrates with texture sheet animation for flipbook-style trail textures

### Trail Width by Speed
- Dynamic trail width modulated by particle velocity
- Fast particles produce thinner, stretched trails; slow particles produce wider ribbons
- Curve-based speed-to-width mapping

---

## Medium Priority — Features & DX

### React Three Fiber Wrapper Package
- Dedicated npm package (`@newkrok/three-particles-react`) with first-class R3F components
- Declarative `<ParticleSystem />` component and `useParticleSystem()` hook
- `useFrame` integration for automatic lifecycle management
- Zero boilerplate — drop-in usage inside R3F `<Canvas>`
- Note: basic usage guide already available in README and llms docs

### Preset System
- Built-in particle configurations: `Presets.FIRE`, `Presets.SMOKE`, `Presets.SPARKS`, `Presets.RAIN`, etc.
- Easy starting point for new users
- Fully customizable — presets are just `ParticleSystemConfig` objects

### Additional Emitter Shapes
- Point emitter (single origin)
- Hemisphere
- Mesh surface emitter (spawn particles on arbitrary mesh surfaces)

### Event System
- `onParticleBirth`, `onParticleDeath` callbacks per particle
- Enable gameplay integration (damage on hit, sound on spawn, etc.)

---

## Lower Priority — Nice to Have

### Stretched Billboard Mode
- Velocity-aligned billboard particles (sparks, rain, speed lines)
- Configurable stretch factor based on particle speed

### LOD (Level of Detail)
- Reduce particle count for distant particle systems
- Configurable distance thresholds and reduction factors
- Seamless transitions between LOD levels

### README Improvements
- Getting Started guide with step-by-step tutorial
- Performance tips and best practices
- Troubleshooting section for common issues

---

## Contributing

We welcome community contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Feature requests and ideas can be submitted as [GitHub Issues](https://github.com/NewKrok/three-particles/issues).
