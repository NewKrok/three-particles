# CI/CD Pipeline

## Overview

The project uses a **fully automated** CI/CD pipeline via GitHub Actions. Merging to `master` triggers everything — no manual release steps needed.

---

## Workflows

### 1. CI (`ci.yml`)

**Triggers:** Every push to `master` + every PR targeting `master`

Runs 4 parallel jobs:

| Job | Command | Purpose |
|-----|---------|---------|
| Build | `npm run build` | TypeScript compile + Webpack bundle |
| Tests | `npm test` | Jest test suite |
| Lint | `npm run lint` | ESLint checks |
| Circular | `npx madge --circular src` | Circular dependency detection |

All 4 must pass before a PR can be merged.

---

### 2. Release & Publish (`release.yml`)

**Triggers:** Push to `master` (skips `chore(release):` commits to prevent loops)

**Steps:**
1. Checkout with full git history (`fetch-depth: 0`)
2. `npm ci` → `npm test` → `npm run build`
3. **Version bump detection** — scans commit messages since last git tag:
   - `BREAKING CHANGE` or `!:` → **major** bump
   - `feat:` → **minor** bump
   - `fix:`, `perf:`, `refactor:`, `build:`, `docs:`, `style:`, `chore:` → **patch** bump
   - Fallback: any unrecognized commits → **patch**
4. `npm version <bump>` — updates `package.json`, creates git tag
5. Pushes version commit + tag to `origin/master`
6. `npm publish --access public` — publishes to npm registry
7. Creates GitHub Release with auto-generated release notes

**Required secrets:**
- `NPM_TOKEN` — npm authentication token
- `GITHUB_TOKEN` — provided automatically by GitHub Actions

**Safety:**
- Concurrency group `release` with `cancel-in-progress: false` — prevents parallel releases
- Loop prevention via commit message prefix check

---

### 3. Deploy Pages (`deploy-pages.yml`)

**Triggers:** Push to `master`

**Steps:**
1. `npm ci` → `npm run build:examples`
2. `node scripts/stamp-docs.mjs` — cache-busting version stamp
3. `npx typedoc` — generate API documentation
4. Copy examples + `llms.txt` / `llms-full.txt` to `docs/`
5. Upload & deploy to GitHub Pages

**Result:**
- Examples at: https://newkrok.github.io/three-particles/
- TypeDoc API at: https://newkrok.github.io/three-particles/api/

---

### 4. Bundle Size Check (`bundle-size-check.yml`)

**Triggers:** PRs targeting `master`

- Builds the library
- Measures minified bundle size
- **Limit: 150 KB** — fails if exceeded
- Posts a comment on the PR with size report

---

### 5. CodeQL Analysis (`codeql-analysis.yml`)

**Triggers:** PRs targeting `master`

- GitHub CodeQL security scanning for JavaScript/TypeScript
- Catches common security vulnerabilities

---

## Commit Message Format

Conventional commits are enforced by `commitlint` + Husky hooks:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

**Types and their version impact:**

| Type | Version Bump | Example |
|------|-------------|---------|
| `feat` | minor | `feat: add cone shape emitter` |
| `fix` | patch | `fix: correct particle rotation in world space` |
| `perf` | patch | `perf: optimize particle update loop` |
| `refactor` | patch | `refactor: extract modifier logic` |
| `docs` | patch | `docs: update API documentation` |
| `test` | patch | `test: add bezier curve tests` |
| `chore` | patch | `chore: update dependencies` |
| `feat!` or `BREAKING CHANGE` | **major** | `feat!: new config format` |

---

## Local Pre-Push Checklist

Before pushing, ensure these all pass (enforced by Husky pre-commit hook for tests):

```bash
npm run lint          # ESLint
npm test              # Jest
npm run build         # TypeScript + Webpack
```

---

## Troubleshooting

### Release didn't trigger
- Check if the commit message starts with `chore(release):` — these are skipped intentionally
- Verify the push was to `master` branch
- Check GitHub Actions tab for workflow run status

### Version bump was wrong
- Review commit messages — the bump is determined by the **most impactful** commit type
- `BREAKING CHANGE` in body or `!:` in type → always major
- Multiple `feat:` + `fix:` → minor wins over patch

### npm publish failed
- Verify `NPM_TOKEN` secret is valid and not expired
- Check npm registry status
