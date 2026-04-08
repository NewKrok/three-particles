# Claude Guidelines - Three Particles Project

## Project Overview

**Package:** `@newkrok/three-particles`
**Description:** Three.js-based high-performance particle system library for game developers and 3D applications.
**Repository:** https://github.com/NewKrok/three-particles
**License:** MIT

---

## Project Structure

```
src/js/effects/three-particles/
├── index.ts                          # Public API re-exports
├── three-particles.ts                # Core: lifecycle, emission, update loop
├── three-particles-modifiers.ts      # Per-particle property animation
├── three-particles-curves.ts         # 30 easing functions
├── three-particles-bezier.ts         # Custom Bezier curve evaluation + caching
├── three-particles-utils.ts          # Shape generators, value resolution, texture
├── three-particles-enums.ts          # SimulationSpace, Shape, EmitFrom, etc.
├── three-particles-forces.ts         # Force fields and attractors
├── three-particles-serialization.ts  # Config save/load serialization
├── types.ts                          # Complete TypeScript type definitions
└── shaders/                          # GLSL shaders (points, instanced, trail, mesh)
```

**Tests:** `src/__tests__/*.test.ts`
**Build output:** `dist/` (ESM + minified browser bundle + declarations)
**Examples:** `examples/examples-data.js`
**LLM docs:** `llms.txt`, `llms-full.txt` (root)

---

## Development Guidelines

### Code Style
- **Strict TypeScript typing** — avoid `any`
- Follow **ESLint** and **Prettier** configurations
- Add JSDoc comments for public APIs
- **Performance** — avoid unnecessary allocations in update loops (hot paths)

### Commands

```bash
npm test              # Jest — all tests must pass
npm run test:watch    # Watch mode
npm run lint          # ESLint
npm run build         # tsup — ESM + minified + DTS
npx madge --circular src  # Circular dependency check
```

### Pre-Push Checklist

Before pushing, **all** must pass:

```bash
npm run lint && npm test && npm run build
```

### Git Workflow
- Main branch: `master`
- Conventional commits enforced via commitlint + Husky
- Co-authored-by for Claude commits:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

### Automated Release Pipeline
Pushing to `master` triggers fully automated: CI checks -> version bump -> npm publish -> GitHub Release -> GitHub Pages deploy. See [CI/CD Pipeline](doc/ci-cd.md) for details.

**Version bump** (from conventional commits): `BREAKING CHANGE`/`!:` -> major, `feat:` -> minor, everything else -> patch.

---

## Adding Examples / Demos

- Examples defined in `examples/examples-data.js`
- **New examples must always be added at the beginning of the array** (newest first)
- Each example needs: `id`, `title`, `description`, `tags`, `textureId`, `config`
- Optional: `previewTime` for non-looping or delayed effects

---

## Mandatory Workflow Rules

**These rules MUST be followed for every task:**

1. **Every change needs tests** — No exceptions. Write tests before or alongside implementation.
2. **Pre-commit checks must pass** — Run `npm run lint`, `npm test`, `npm run build` before every commit. Do NOT commit if any fail.
3. **Agent orchestration** — Delegate work to sub-agents to keep the main context clean. See [Development Workflow](doc/workflow.md) for the orchestrator pattern.
4. **Code review agent** — After completing implementation, spawn a review agent to check code quality, type safety, test coverage, performance, and security.
5. **Keep docs up to date** — After every task, update relevant docs:
   - `CLAUDE.md` — if new patterns, features, or structural changes
   - `README.md` — if user-facing API changes
   - `ROADMAP.md` — if feature status changes
   - `llms.txt` / `llms-full.txt` — if public API changes
   - Remove outdated information from CLAUDE.md that is just noise in the context
6. **Conventional commits** — Always use conventional commit format with Co-Authored-By.

See [Development Workflow](doc/workflow.md) for the full step-by-step guide.

---

## Detailed Documentation

Detailed guides are in `.claude/doc/` — read these on-demand, not loaded into every conversation:

| Document | When to read |
|----------|-------------|
| [Architecture](doc/architecture.md) | Understanding internal data flow, shader pipeline, module responsibilities |
| [CI/CD Pipeline](doc/ci-cd.md) | Release process, workflow troubleshooting, version bump logic |
| [Development Workflow](doc/workflow.md) | Step-by-step workflow, agent orchestration pattern, pre-commit checks |
| [Testing Guide](doc/testing.md) | Mocking patterns, test helpers, coverage targets, writing effective tests |
| [WebGPU Compute Plan](doc/webgpu-compute-plan.md) | WebGPU implementation phases, TSL migration, compute shader architecture |

---

## Quick Reference: Key Files

| Task | File(s) |
|------|---------|
| Type definitions | `src/js/effects/three-particles/types.ts` |
| Core particle logic | `src/js/effects/three-particles/three-particles.ts` |
| Enums & constants | `src/js/effects/three-particles/three-particles-enums.ts` |
| Modifiers | `src/js/effects/three-particles/three-particles-modifiers.ts` |
| Force fields | `src/js/effects/three-particles/three-particles-forces.ts` |
| Serialization | `src/js/effects/three-particles/three-particles-serialization.ts` |
| Curves / Bezier | `three-particles-curves.ts`, `three-particles-bezier.ts` |
| Utilities | `src/js/effects/three-particles/three-particles-utils.ts` |
| Shaders | `src/js/effects/three-particles/shaders/*.glsl.ts` |
| Tests | `src/__tests__/*.test.ts` |
| Build config | `tsup.config.ts`, `tsconfig.json` |
| Examples | `examples/examples-data.js` |
| LLM docs | `llms.txt`, `llms-full.txt` |

---

## Project Status

Completed: Core system, all shape emitters, lifetime modifiers, noise, burst/distance emission, texture sheet animation, world/local space, sub-emitters, force fields, GPU instancing, trail renderer (with smoothing, adaptive sampling, maxTime, twist prevention, connected ribbons), mesh renderer, soft particles, serialization, TypeDoc, visual editor, examples page, CI/CD, benchmark suite, React Three Fiber docs, llms.txt, real-time config updates (`updateConfig`).

**Planned:** Trail Phase 2 (UV texture modes, UV scrolling, width by speed), WebGPU compute, preset system.

**Coverage target:** >=90% statement, >=80% branch.
