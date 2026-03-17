# Contributing to Three Particles

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/NewKrok/three-particles.git
cd three-particles

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## Development Workflow

1. Fork the repository
2. Create a feature branch from `master`: `git checkout -b feat/my-feature`
3. Make your changes
4. Run the quality checks:
   ```bash
   npm run lint          # ESLint
   npm test              # Jest tests
   npm run build         # TypeScript compile + webpack bundle
   ```
5. Commit using [conventional commits](#commit-messages)
6. Push and open a Pull Request against `master`

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated by commitlint.

**Format:** `<type>(<scope>): <description>`

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, missing semicolons, etc. |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |

**Examples:**
```
feat: add sub-emitter support
fix: correct cone shape radius calculation
docs: update API examples in llms.txt
perf: reduce GC pressure in update loop
test: add coverage for world space simulation
```

## Code Style

- **TypeScript strict mode** — no `any`, explicit types everywhere
- **ESLint + Prettier** — run `npm run lint` before committing
- Follow existing patterns in the codebase
- Add JSDoc comments for public APIs

## Testing

- Tests are in `src/__tests__/` using Jest
- Test files follow the pattern `*.test.ts`
- Always add tests for new features
- Three.js objects may need mocking (see existing tests for examples)

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Project Structure

```
src/js/effects/three-particles/
├── index.ts                 # Entry point (re-exports)
├── three-particles.ts       # Core particle system logic
├── three-particles-enums.ts # Enums (Shape, EmitFrom, etc.)
├── three-particles-modifiers.ts  # Lifetime modifiers
├── three-particles-curves.ts     # Curve interpolation
├── three-particles-bezier.ts     # Bezier math
├── three-particles-utils.ts      # Utilities
├── types.ts                      # All type definitions
└── shaders/                      # GLSL shaders
```

## Adding a New Feature

1. Check `types.ts` first — understand existing type patterns
2. Add new types to `types.ts` if needed
3. Add enums to `three-particles-enums.ts` if needed
4. Implement in the appropriate file
5. Write tests in `src/__tests__/`
6. Update TypeDoc comments

## Performance Guidelines

This is a high-performance library used in real-time 3D applications. Keep these in mind:

- Avoid allocations in the update loop (reuse objects, use pools)
- Minimize garbage collection pressure
- Profile before and after changes
- Test with high particle counts (1000+)

## Reporting Issues

Use [GitHub Issues](https://github.com/NewKrok/three-particles/issues) for:
- Bug reports (include Three.js version, browser, minimal reproduction)
- Feature requests
- Questions

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
