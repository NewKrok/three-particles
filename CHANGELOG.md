# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/) and uses [Conventional Commits](https://www.conventionalcommits.org/).

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
