# Claude Guidelines - Three Particles Project

## Project Overview

**Package:** `@newkrok/three-particles` (v2.2.0)
**Description:** Three.js-based high-performance particle system library designed for creating visually stunning particle effects with ease. Perfect for game developers and 3D applications.
**Author:** Istvan Krisztian Somoracz
**License:** MIT
**Repository:** https://github.com/NewKrok/three-particles

### Key Features
- Easy integration with Three.js
- Visual editor for creating and fine-tuning effects: [THREE Particles Editor](https://github.com/NewKrok/three-particles-editor)
- Highly customizable particle properties (position, velocity, size, color, alpha, rotation, etc.)
- Support for various emitter shapes and parameters
- TypeDoc API documentation: https://newkrok.github.io/three-particles/

### Live Demos
- Editor & Live Demo: https://newkrok.com/three-particles-editor/index.html
- CodePen Examples: Basic, Fire Animation, Projectile Simulation

---

## Project Structure

```
src/
├── js/effects/three-particles/
│   ├── index.ts                          # Main entry point
│   ├── three-particles.ts                # Core particle system
│   ├── three-particles-bezier.ts         # Bezier curve utilities
│   ├── three-particles-curves.ts         # Curve handling
│   ├── three-particles-enums.ts          # Enums (Shape, EmitFrom, etc.)
│   ├── three-particles-modifiers.ts      # Modifiers for particle behavior
│   ├── three-particles-utils.ts          # Utility functions
│   ├── types.ts                          # TypeScript type definitions
│   └── shaders/                          # GLSL shaders
│       ├── particle-system-vertex-shader.glsl.ts
│       └── particle-system-fragment-shader.glsl.ts
├── types/                                # Custom type declarations
└── __tests__/                            # Jest test files
```

---

## Core Concepts & Architecture

### Main API Functions
- `createParticleSystem(config: ParticleSystemConfig): ParticleSystem` - Creates a new particle system
- `updateParticleSystems(cycleData: CycleData)` - Updates all active particle systems

### Key Types (from types.ts)
- **ParticleSystemConfig**: Main configuration object for particle systems
  - Transform (position, rotation, scale)
  - Duration, looping, startDelay
  - Start properties (lifetime, speed, size, opacity, rotation, color)
  - Emission settings (rateOverTime, rateOverDistance)
  - Shape configuration (sphere, cone, circle, rectangle, box)
  - Modifiers (velocityOverLifetime, sizeOverLifetime, opacityOverLifetime, rotationOverLifetime, noise)
  - Renderer settings (blending, transparency, depth testing)
  - Texture & texture sheet animation
  - Callbacks (onUpdate, onComplete)

- **LifetimeCurve**: Supports Bezier curves and easing functions for animating values over time
- **Shape Types**: Sphere, Cone, Circle, Rectangle, Box
- **Simulation Spaces**: Local vs World

### Important Enums (three-particles-enums.ts)
- `Shape`: SPHERE, CONE, CIRCLE, RECTANGLE, BOX
- `EmitFrom`: VOLUME, SHELL, EDGE
- `SimulationSpace`: LOCAL, WORLD
- `TimeMode`: LIFETIME, SPEED
- `LifeTimeCurve`: BEZIER, EASING

---

## Development Guidelines

### Code Style
- **Strict TypeScript typing** - Always use explicit types, avoid `any`
- Follow **ESLint** and **Prettier** configurations
- Maintain consistency with existing code structure and patterns
- Use descriptive variable and function names
- Add JSDoc comments for public APIs (see types.ts for examples)

### TypeScript Configuration
- Target: ES2020
- Module: ESNext
- Strict mode enabled
- Declaration files generated
- Path alias: `@newkrok/three-particles` maps to `./src/index.ts`

### Testing
- **Framework**: Jest with TypeScript support (ts-jest, babel-jest)
- **Test files**: Located in `src/__tests__/`
- **Coverage**: Coverage reports generated in `coverage/` directory
- Always write tests for new features
- Test files follow pattern: `*.test.ts`

**Commands:**
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

### Build Process
- TypeScript compilation to `dist/`
- Webpack bundling for browser distribution
- Generates both ES modules and minified bundles
- Declaration files (.d.ts) included

**Build command:**
```bash
npm run build         # Clean dist/ + TypeScript compile + Webpack bundle
```

**Output:**
- `dist/index.js` - Main ES module
- `dist/index.d.ts` - TypeScript declarations
- `dist/three-particles.min.js` - Minified browser bundle

### Git Workflow
- Main branch: `master`
- Conventional commits enforced via commitlint
- Husky pre-commit hooks configured
- Commit messages should follow conventional format
- Add Co-authored-by for Claude commits:
  ```
  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
  ```

---

## Dependencies

### Core Dependencies
- **three** (^0.180.0) - Peer dependency, must be installed by consumer
- **@newkrok/three-utils** (^2.0.1) - Utility functions for Three.js
- **easing-functions** (1.3.0) - Easing functions for animations
- **three-noise** (1.1.2) - Noise generation for particle effects

### Dev Tools
- TypeScript 5.7.3
- Jest 30.2.0 (testing)
- ESLint 9.18.0 (linting)
- Prettier 3.4.2 (formatting)
- Webpack 5.97.1 (bundling)
- Husky 9.1.7 (git hooks)
- Commitlint (commit message validation)
- Madge (circular dependency detection)
- TypeDoc (documentation generation)

---

## Common Tasks

### Adding a New Feature
1. Understand the existing code structure
2. Add types to `types.ts` if needed
3. Implement the feature in appropriate file(s)
4. Add/update enums in `three-particles-enums.ts` if needed
5. Write unit tests in `src/__tests__/`
6. Update TypeDoc comments
7. Run tests: `npm test`
8. Build: `npm run build`
9. Lint: `npm run lint`

### Modifying Particle Behavior
- Core logic in: `three-particles.ts`
- Modifiers in: `three-particles-modifiers.ts`
- Curves in: `three-particles-curves.ts`, `three-particles-bezier.ts`
- Shaders in: `shaders/` directory

### Adding New Shape Type
1. Add enum to `Shape` in `three-particles-enums.ts`
2. Add type definition to `types.ts`
3. Implement shape logic in `three-particles.ts`
4. Add tests

---

## Useful Commands

```bash
# Installation
npm install              # Install dependencies

# Development
npm run build            # Build project (clean + compile + bundle)
npm run prepublishOnly   # Runs automatically before publishing
npm test                 # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run lint             # Run ESLint
npm run prepare          # Setup Husky git hooks

# Tools
npx madge --circular src  # Check for circular dependencies
npx typedoc               # Generate documentation
```

---

## Important Notes

### When Making Changes
- **Always check types.ts first** - This file contains comprehensive type definitions and examples
- **Shader changes** - If modifying GLSL shaders, test thoroughly across different browsers/devices
- **Performance** - This is a high-performance library, avoid unnecessary allocations in update loops
- **Three.js compatibility** - Currently targets Three.js ^0.180.0
- **ES Modules** - Project uses ES modules (type: "module" in package.json)

### Known Patterns
- **Curve system**: Uses Bezier curves and easing functions for value interpolation over time
- **Constant or Random**: Many properties support either constant values or `{ min, max }` ranges
- **Lifecycle callbacks**: `onUpdate` and `onComplete` for hooking into particle system lifecycle
- **Gyroscope usage**: For world-space simulation (see `SimulationSpace.WORLD`)

### Testing Considerations
- Tests may need mocking for Three.js objects
- Node.js version compatibility (>=18.0.0)
- Jest configured with Babel for TypeScript support

---

## Additional Resources

- **Documentation**: `.claude/doc/` folder for additional project documentation
- **TypeDoc**: Auto-generated at https://newkrok.github.io/three-particles/
- **Editor**: Visual particle editor for testing configurations
- **Examples**: CodePen examples show real-world usage patterns

---

## Quick Reference: Key Files to Check

When working on specific features, refer to these files:

| Task | File(s) to Check |
|------|------------------|
| Type definitions | `src/js/effects/three-particles/types.ts` |
| Core particle logic | `src/js/effects/three-particles/three-particles.ts` |
| Enums & constants | `src/js/effects/three-particles/three-particles-enums.ts` |
| Curve handling | `src/js/effects/three-particles/three-particles-curves.ts` |
| Bezier utilities | `src/js/effects/three-particles/three-particles-bezier.ts` |
| Modifiers | `src/js/effects/three-particles/three-particles-modifiers.ts` |
| Utilities | `src/js/effects/three-particles/three-particles-utils.ts` |
| Shaders | `src/js/effects/three-particles/shaders/*.glsl.ts` |
| Tests | `src/__tests__/*.test.ts` |
| Build config | `webpack.config.js`, `tsconfig.json` |
| Package info | `package.json` |
