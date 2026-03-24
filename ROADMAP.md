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
| Test coverage (~96% statement) | ✅ Target ≥90% |
| CI/CD auto release (npm publish on master push) | ✅ Complete |
| PR checks (lint + test + build + bundle size) | ✅ Complete |
| Bundle size monitoring (150 KB limit) | ✅ Complete |
| CodeQL security analysis | ✅ Complete |
| GitHub Pages (examples + TypeDoc) | ✅ Complete |
| Performance benchmark suite | ✅ Complete |

---

## Short Term

### Improved Documentation & DX
- [x] `llms.txt` / `llms-full.txt` for LLM context
- [x] `ROADMAP.md`
- [x] `CHANGELOG.md`
- [x] `CONTRIBUTING.md`
- [x] Interactive examples page (GitHub Pages)
- [ ] README improvements (Getting Started, Performance tips, Troubleshooting)

### CI/CD Improvements
- [x] Automated release workflow (version bump + npm publish on master push)
- [x] PR checks: lint + test + build on all PRs
- [x] Bundle size monitoring with limits (150 KB)
- [x] CodeQL security analysis on PRs

### Code Quality
- [x] Test coverage ≥90% statement, ≥80% branch
- [x] Benchmark suite for performance regression detection

---

## Medium Term

### Preset System
- Built-in particle configurations: `Presets.FIRE`, `Presets.SMOKE`, `Presets.SPARKS`, `Presets.RAIN`, etc.
- Easy starting point for new users
- Fully customizable — presets are just `ParticleSystemConfig` objects

### Serialization ✅
- `serializeParticleSystem()` / `deserializeParticleSystem()`
- Compatibility with three-particles-editor output
- Versioned config format for forward compatibility

### Build Modernization
- [x] Migrated from tsc + webpack to tsup (esbuild-based)
- [x] Tree-shaking via esbuild
- [x] Source maps for minified bundles

---

## Long Term

### Web Worker Support
- Off-main-thread particle updates via `ParticleWorkerManager`
- SharedArrayBuffer for zero-copy position/size data
- Automatic fallback to postMessage
- Recommended for >1000 particles or multiple systems

### Sub-Emitters ✅
- Spawn child particle systems on particle birth or death events
- `SubEmitterTrigger.BIRTH` and `SubEmitterTrigger.DEATH` triggers
- `SubEmitterConfig` with `config`, `trigger`, `inheritVelocity`, `maxInstances`
- Per-config `maxInstances` cap with automatic cleanup of completed instances
- Sub-emitters forced non-looping; disposed with parent

### Force Fields / Attractors ✅
- POINT type: attract/repel particles from a position with configurable range and falloff (LINEAR, QUADRATIC, NONE)
- DIRECTIONAL type: apply constant force in a direction (wind, drift)
- Multiple force fields per system, applied cumulatively
- Strength supports constant, random range, or lifetime curves
- Full serialization/deserialization support

### GPU Instancing
- `THREE.InstancedMesh`-based renderer for extreme particle counts
- Significant performance improvement for 10,000+ particles

---

## Contributing

We welcome community contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Feature requests and ideas can be submitted as [GitHub Issues](https://github.com/NewKrok/three-particles/issues).
