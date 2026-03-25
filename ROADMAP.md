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

---

## High Priority — Performance & Ecosystem

### React Three Fiber Integration
- First-class R3F components (`<ParticleSystem />`, `<useParticleSystem />`)
- Declarative API that fits the R3F ecosystem
- Hooks for lifecycle management (`useFrame` integration)

### Trail / Ribbon Renderer
- Continuous trail behind moving particles (projectiles, lightning, light streaks)
- Configurable width, fade, and color over trail length
- Billboard or camera-facing trail geometry

### WebGPU Compute Support
- Leverage Three.js WebGPU renderer (production-ready since r171)
- Compute shaders for particle simulation on GPU — 10-100x performance for large systems
- Automatic fallback to WebGL when WebGPU is unavailable

---

## Medium Priority — Features & DX

### Preset System
- Built-in particle configurations: `Presets.FIRE`, `Presets.SMOKE`, `Presets.SPARKS`, `Presets.RAIN`, etc.
- Easy starting point for new users
- Fully customizable — presets are just `ParticleSystemConfig` objects

### Mesh Particle Renderer
- Use 3D meshes as individual particles (shards, leaves, debris)
- Support for custom geometry with per-particle transforms
- Combine with GPU instancing for performance

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
