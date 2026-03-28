# Development Workflow

## Overview

This document defines the standard workflow for every development task. The key principle: **Claude acts as an orchestrator**, delegating work to sub-agents to keep the main conversation context clean and focused.

---

## Agent Orchestration Pattern

For non-trivial tasks, the main Claude session should act as a coordinator — not do everything inline. This prevents context saturation and keeps the conversation manageable.

### When to delegate to sub-agents

| Task type | Delegate? | Agent type |
|-----------|-----------|------------|
| Exploring codebase / finding files | Yes | `Explore` agent |
| Implementing a feature or fix | Yes | `general-purpose` agent (with clear spec) |
| Writing / updating tests | Yes | `general-purpose` agent |
| Code review | Yes | `general-purpose` agent (review prompt) |
| Simple file edits (< 3 files) | No | Do inline |
| Running commands (lint/test/build) | No | Do inline |
| Doc updates | No | Do inline |

### How to orchestrate

1. **Plan** — Understand the task, identify affected files, break into steps
2. **Delegate** — Spawn sub-agents for implementation, testing, and review (parallelize where possible)
3. **Verify** — Run lint/test/build in the main session
4. **Finalize** — Update docs, commit

### Sub-agent prompts should include:
- Clear task description with acceptance criteria
- Relevant file paths to focus on
- Constraints (e.g., "don't modify the public API", "follow existing patterns")
- What NOT to do (e.g., "don't update docs, I'll handle that")

---

## Step-by-Step Workflow

### 1. Understand the Task

- Read the issue/request carefully
- Identify which files are affected (see [Quick Reference in CLAUDE.md](../CLAUDE.md#quick-reference-key-files))
- Read the relevant source code before making changes

### 2. Implement with Tests

**Every new feature or bug fix MUST have tests.**

- Write tests in `src/__tests__/` following the `*.test.ts` pattern
- Test both happy paths and edge cases
- For particle behavior changes, test with various configurations
- Mock Three.js objects where needed (see [Testing Guide](testing.md))

**Test guidelines:**
- One test file per logical unit
- Use descriptive test names: `it("should interpolate bezier curve at midpoint")`
- Target: >=90% statement coverage, >=80% branch coverage
- Run tests continuously: `npm run test:watch`

### 3. Verify Locally (Pre-Commit Checks)

Before committing, run **all CI checks** locally:

```bash
npm run lint          # ESLint — fix any issues
npm test              # Jest — all tests must pass
npm run build         # tsup — must succeed
```

**Do NOT commit if any of these fail.** Fix the issues first.

Optional but recommended:
```bash
npx madge --circular src    # Check for circular dependencies
npm run benchmark           # Check for performance regressions
```

### 4. Code Review via Agent

After completing the implementation, **launch a review agent**:

```
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
feat: add sphere shell emission mode
fix: correct particle opacity in world space
perf: reduce allocations in modifier loop
feat!: redesign ParticleSystemConfig shape options
```

Always add:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

### 6. Update Documentation

After every task, update these files if relevant:

| File | When to Update |
|------|---------------|
| `.claude/CLAUDE.md` | New features, structural changes, new patterns. **Also remove outdated info that is just noise.** |
| `README.md` | User-facing API changes, new examples, new features |
| `ROADMAP.md` | Feature completions, new planned items |
| `llms.txt` / `llms-full.txt` | Public API changes, new features, version bumps — these are the LLM-facing docs |
| JSDoc in source | New/modified public APIs |

**llms.txt maintenance:**
- `llms.txt` — short overview + quick start, keep concise
- `llms-full.txt` — complete API reference, all config options, all types
- Update whenever the public API surface changes (new config options, new enums, new functions)
- Keep version references up to date (or remove hardcoded versions)

**CLAUDE.md maintenance:**
- After completing a task, review if CLAUDE.md contains outdated info
- Remove version numbers that will go stale (use `package.json` as source of truth)
- Remove detailed info that's better served by doc/ files
- Keep CLAUDE.md focused on: project structure, rules, commands, quick reference

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
[ ] Delegate implementation to sub-agent(s)
[ ] Delegate test writing to sub-agent (or same agent)
[ ] Run: npm run lint ✓
[ ] Run: npm test ✓
[ ] Run: npm run build ✓
[ ] Launch review agent → address feedback
[ ] Commit with conventional message
[ ] Update docs (CLAUDE.md, README, ROADMAP, llms.txt/llms-full.txt)
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
- Use `feat!:` or add `BREAKING CHANGE` footer — triggers a major version bump
- Update migration notes in CHANGELOG
- Update `llms-full.txt` with migration info

### Adding New Enums/Types
1. Add to `three-particles-enums.ts`
2. Add type definitions to `types.ts` with JSDoc
3. Implement in the appropriate source file
4. Add tests
5. Update `llms-full.txt` if it's a public API addition
