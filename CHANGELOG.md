# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/) and uses [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Changed (BREAKING)

- **`SimulationSpace.WORLD` rewritten** to follow Unity's world-simulation-space model. The previous implementation wrapped the particle system in a `three/examples` `Gyroscope`, cancelled the parent rotation, and compensated buffer positions each frame by subtracting the emitter's world movement. The new path stores world coordinates directly in the particle buffer and holds `particleSystem.matrixWorld` at identity so rendering is decoupled from the emitter's scene-graph transform.
- **Fixed** a gravity direction bug in WORLD mode: gravity is now applied as a constant world vector. Previously it was derived from the emitter's world position treated as a direction vector, causing particles to drift sideways or upward when the emitter moved or rotated.
- **Fixed** a directional force field bug in WORLD mode: field directions now stay world-aligned regardless of emitter rotation. Previously the direction was pre-rotated by `particleSystem.getWorldQuaternion()`, which did not invoke the Gyroscope's rotation cancellation and therefore picked up the parent rotation.
- **Fixed** frame-lag jitter on fast-moving emitters (no more `worldPositionChange` subtraction in the integrator, on either the CPU or the GPU compute path).
- **Fixed** death/birth sub-emitter spawn position on moving emitters: the sub-emitter now spawns at the parent particle's world location, not at the parent emitter's current world position.
- **Fixed** LOCAL-mode gravity magnitude under scaled parents: gravity is now divided by the emitter's world scale so the rendered fall matches world m/s² regardless of parent scale (Unity parity).
- **Fixed** WORLD-mode shape-emission spawn offsets not honouring parent scale. Spawn offsets are now multiplied by the emitter's world scale (Unity Shape-module parity with `Scaling Mode = Local/Hierarchy`); live particles remain unaffected by post-spawn scale changes.
- **Fixed** a stale-matrix bug in LOCAL-mode sub-emitter death/birth callbacks: `particleSystem.updateMatrixWorld()` is now called before `localToWorld(...)` so the sub-emitter spawns at the parent's current world position.
- **Fixed** a silent CPU→GPU upload regression: the `positionNeedsUpdate` guard no longer flags re-uploads for stationary particles when the emitter moves (`worldPositionChange` conditions removed from the guard, matching the fact that the compensation subtraction was already gone).
- **Color pipeline standardised to the three.js linear workflow.** User color inputs (`startColor`, `backgroundColor`) and color map textures are now treated as sRGB — the same convention every other three.js material uses. The library decodes to linear on input, shaders operate in linear, and the renderer's output pass converts back to sRGB on the way to the framebuffer. Previously the library wrote raw values to the framebuffer and required consumers to set `renderer.outputColorSpace = LinearSRGBColorSpace`, which broke every non-particle material in the same scene.
  - GLSL fragment shaders (`particle-system`, `instanced-particle`, `mesh-particle`, `trail`) now include `<colorspace_fragment>` so they participate in the renderer's standard color-space conversion.
  - TSL materials no longer force `map.colorSpace = NoColorSpace`; user-tagged sRGB textures get the hardware decode the rest of three.js expects.
  - Per-particle color buffer writes now apply `sRGBToLinear` on user `startColor` values. `colorOverLifetime` multipliers are scalars and keep their existing semantics (applied in linear space).
  - `backgroundColor` uniforms are converted to linear on upload so `discardBackgroundColor` compares against the (now linear) texture sample on equal footing.
- **Fixed** `discardBackgroundColor` not firing in WebGPU TSL materials. `Discard()` was wrapped inside a TSL `Fn` helper, which prevented the fragment `discard` statement from propagating to the main shader — so black-background cutouts silently stopped working on the POINTS, INSTANCED, and MESH renderers (Shield, Fireworks, Magnetic Field, Implosion, Explosion with Smoke, etc.).
- **Fixed** `updateConfig({ simulationSpace })` leaving the system in an inconsistent state. Live-switching simulation space now deactivates existing particles (their buffer positions are in the old frame and would render at random locations) and flips `matrixWorldAutoUpdate` to match what `createParticleSystem` would have set for the new frame. Previously the simulationSpace scalar was updated but the buffer and `matrixWorld` flags were not, causing particles to snap between origins and jump around after a LOCAL↔WORLD toggle.

### Migration

- `ParticleSystem.instance` is now always `THREE.Points | THREE.Mesh` — the union with `Gyroscope` is gone. Any code that checked `instance instanceof Gyroscope` or reached into `instance.children[0]` to find the inner `Points` must use `instance` directly.
- `ParticleSystemInstance.wrapper` is removed.
- In WORLD mode, `instance.matrixWorld` is identity. The emitter's pose is still read from the parent chain for emission; `instance.position` / `instance.rotation` act as a spawn-origin offset under the parent and do **not** drag already-emitted particles (matches Unity).
- The dependency on `three/examples/jsm/misc/Gyroscope.js` is removed.
- WebGPU-internal uniforms `worldPositionChange` and `simulationSpaceWorld` on the compute pipeline are removed; this only affects code that reached into the compute uniform object directly.
- **Remove any `renderer.outputColorSpace = LinearSRGBColorSpace` override** that was added for this library. The three.js default (`SRGBColorSpace`) is now correct for both WebGL and WebGPU paths. Leaving the old override in place will double-darken the particles.
- **`startColor`, `backgroundColor` values are now interpreted as sRGB.** `{ r: 1, g: 0, b: 0 }` renders as "CSS/Photoshop pure red," not as a raw linear 1.0. Configs authored under earlier versions will render slightly differently — to keep the old look exactly, run each color through `linearToSRGB` (exported from the package) once when loading a legacy config. Re-authoring in an updated editor against the new rendering is usually easier.
- **User color map textures should be tagged `SRGBColorSpace`** (the three.js default when loading via `TextureLoader`). The library no longer overrides this. Non-color / data textures intended as masks should keep `NoColorSpace` as usual.

## [2.4.0] - 2025-05-20

### Added
- Burst emission support for instantaneous particle effects (explosions, impacts)
- Shape and burst emission tests
- Individual `update()` method on particle systems

### Changed
- Optimized `createParticleSystem` array allocations
- Optimized `updateParticleSystemInstance` to reduce GC pressure
- Updated dependencies to latest versions

## [2.3.0] - 2025-03-15

### Added
- `colorOverLifetime` functionality for per-channel RGB color curves
- Comprehensive JSDoc documentation for core API, types, and easing functions

### Changed
- Updated npm packages to latest versions

## [2.2.0] - 2025-01-20

### Fixed
- Node.js 18 compatibility (Jest `os.availableParallelism()` error)

### Changed
- Updated npm packages to latest versions

## [2.1.0] - 2024-12-10

### Added
- Logarithmic Depth Buffer support in particle system shaders

### Changed
- Updated Three.js to v0.177.0
- Fixed code formatting

## [2.0.3] - 2024-10-05

### Fixed
- Minor bug fixes and stability improvements

## [2.0.0] - 2024-08-01

### Added
- Complete TypeScript rewrite
- ES Module support
- TypeDoc API documentation
- Jest test suite
- CI/CD workflows (tests, lint, CodeQL, bundle size, circular dependencies)
- Visual editor integration (three-particles-editor)

### Changed
- Migrated to strict TypeScript
- Modern build pipeline (tsc + webpack)
- Three.js peer dependency

---

[2.4.0]: https://github.com/NewKrok/three-particles/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/NewKrok/three-particles/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/NewKrok/three-particles/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/NewKrok/three-particles/compare/v2.0.3...v2.1.0
[2.0.3]: https://github.com/NewKrok/three-particles/compare/v2.0.0...v2.0.3
[2.0.0]: https://github.com/NewKrok/three-particles/releases/tag/v2.0.0
