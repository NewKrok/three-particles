# Roadmap

## Current Status

| Feature | Status |
|---------|--------|
| Core particle system | ✅ Complete |
| Shape emitters (Sphere, Cone, Circle, Rectangle, Box) | ✅ Complete |
| Lifetime modifiers (size, opacity, color, rotation, velocity) | ✅ Complete |
| Noise module (FBM) | ✅ Complete |
| Texture sheet animation | ✅ Complete |
| World/Local simulation space | ✅ Complete |
| Burst emission | ✅ Complete |
| Rate over distance emission | ✅ Complete |
| TypeDoc API documentation | ✅ Complete |
| Visual editor (three-particles-editor) | ✅ Complete |
| Test coverage (~87% statement) | 🔶 Target ≥90% |

---

## Short Term

### Improved Documentation & DX
- [x] `llms.txt` / `llms-full.txt` for LLM context
- [x] `ROADMAP.md`
- [x] `CHANGELOG.md`
- [x] `CONTRIBUTING.md`
- [ ] Interactive examples page (GitHub Pages)
- [ ] README improvements (Getting Started, Performance tips, Troubleshooting)

### CI/CD Improvements
- [ ] Automated release workflow (version bump + npm publish on tag)
- [ ] PR checks: lint + test + build on all PRs
- [ ] Bundle size monitoring with limits

### Code Quality
- [ ] Test coverage ≥90% statement, ≥80% branch
- [ ] Benchmark suite for performance regression detection

---

## Medium Term

### Preset System
- Built-in particle configurations: `Presets.FIRE`, `Presets.SMOKE`, `Presets.SPARKS`, `Presets.RAIN`, etc.
- Easy starting point for new users
- Fully customizable — presets are just `ParticleSystemConfig` objects

### Serialization
- `particleSystemToJSON()` / `particleSystemFromJSON()`
- Compatibility with three-particles-editor output
- Versioned config format for forward compatibility

### Build Modernization
- Evaluate tsup for faster, simpler builds (ESM + CJS + DTS)
- Tree-shaking improvements
- Source maps for minified bundles

---

## Long Term

### Web Worker Support
- Off-main-thread particle updates via `ParticleWorkerManager`
- SharedArrayBuffer for zero-copy position/size data
- Automatic fallback to postMessage
- Recommended for >1000 particles or multiple systems

### Sub-Emitters
- Emit new particle systems on particle death or collision
- `onParticleDeath` callback with particle position

### Force Fields / Attractors
- Define attraction/repulsion points in space
- Wind effects, gravity wells
- Configurable falloff curves

### GPU Instancing
- `THREE.InstancedMesh`-based renderer for extreme particle counts
- Significant performance improvement for 10,000+ particles

---

## Contributing

We welcome community contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Feature requests and ideas can be submitted as [GitHub Issues](https://github.com/NewKrok/three-particles/issues).
