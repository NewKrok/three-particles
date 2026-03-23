# Development Workflow

## Overview

This document defines the standard workflow for every development task in the three-particles project. Follow these steps to ensure consistent quality and up-to-date documentation.

---

## Step-by-Step Workflow

### 1. Understand the Task

- Read the issue/request carefully
- Identify which files are affected (see [Quick Reference in CLAUDE.md](../CLAUDE.md#quick-reference-key-files-to-check))
- Read the relevant source code before making changes

### 2. Implement with Tests

**Every new feature or bug fix MUST have tests.**

- Write tests in `src/__tests__/` following the `*.test.ts` pattern
- Test both happy paths and edge cases
- For particle behavior changes, test with various configurations
- Mock Three.js objects where needed (see existing tests for patterns)

**Test guidelines:**
- One test file per logical unit (e.g., `three-particles-bezier.test.ts`)
- Use descriptive test names: `it("should interpolate bezier curve at midpoint")`
- Target: ≥90% statement coverage, ≥80% branch coverage
- Run tests continuously during development: `npm run test:watch`

### 3. Verify Locally (Pre-Commit Checks)

Before committing, run **all CI checks** locally:

```bash
npm run lint          # ESLint — fix any issues
npm test              # Jest — all tests must pass
npm run build         # TypeScript + Webpack — must succeed
```

**Do NOT commit if any of these fail.** Fix the issues first.

Optional but recommended:
```bash
npx madge --circular src    # Check for circular dependencies
npm run benchmark           # Check for performance regressions
```

### 4. Code Review via Agent

After completing the implementation, **launch a review agent** to check the work:

```
Spawn an Explore/general-purpose agent with this prompt:

"Review the changes I just made. Check for:
1. Code quality — naming, structure, consistency with existing patterns
2. Type safety — proper TypeScript types, no `any`
3. Test coverage — are there missing test cases or edge cases?
4. Performance — unnecessary allocations in hot paths, especially update loops
5. Security — no OWASP top 10 vulnerabilities
6. Documentation — are JSDoc comments needed for public APIs?

Provide specific, actionable suggestions."
```

Address any valid suggestions before committing.

### 5. Commit with Conventional Messages

Use conventional commit format (enforced by commitlint):

```bash
# Features
git commit -m "feat: add sphere shell emission mode"

# Bug fixes
git commit -m "fix: correct particle opacity in world space"

# Performance
git commit -m "perf: reduce allocations in modifier loop"

# Breaking changes
git commit -m "feat!: redesign ParticleSystemConfig shape options

BREAKING CHANGE: shape config is now nested under `emission.shape`"
```

Always add:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

### 6. Update Documentation

After every task, update these files if relevant:

| File | When to Update |
|------|---------------|
| `.claude/CLAUDE.md` | New features, status changes, version bumps, new patterns |
| `README.md` | User-facing API changes, new examples, new features |
| `ROADMAP.md` | Feature completions, new planned items |
| `CHANGELOG.md` | Notable changes (auto-generated for releases, but keep manual notes) |
| JSDoc in source | New/modified public APIs |

**Keep these in sync with the actual state of the project.** Outdated docs are worse than no docs.

### 7. Push and Verify

```bash
git push -u origin <branch-name>
```

After pushing, verify that CI checks pass on the PR.

---

## Workflow Summary (Checklist)

```
[ ] Read and understand the task
[ ] Read relevant source code
[ ] Implement the changes
[ ] Write/update tests
[ ] Run: npm run lint ✓
[ ] Run: npm test ✓
[ ] Run: npm run build ✓
[ ] Launch review agent → address feedback
[ ] Commit with conventional message
[ ] Update docs (CLAUDE.md, README, ROADMAP, CHANGELOG)
[ ] Push and verify CI
```

---

## Special Cases

### Shader Changes
- Test across different scenarios (alpha, blending modes)
- Shaders are in `src/js/effects/three-particles/shaders/`
- Changes here can have broad visual impact — test thoroughly

### Performance-Sensitive Changes
- Core update loop (`three-particles.ts`) and modifiers (`three-particles-modifiers.ts`) are hot paths
- Avoid `new` allocations inside per-particle loops
- Run `npm run benchmark` before and after to detect regressions
- Reuse objects via pools or pre-allocated arrays where possible

### Breaking Changes
- Use `feat!:` or add `BREAKING CHANGE` footer — this triggers a major version bump
- Update migration notes in CHANGELOG
- Consider backward compatibility period if possible

### Adding New Enums/Types
1. Add to `three-particles-enums.ts`
2. Add type definitions to `types.ts` with JSDoc
3. Implement in the appropriate source file
4. Add tests
5. Update CLAUDE.md if it adds a new category of functionality
