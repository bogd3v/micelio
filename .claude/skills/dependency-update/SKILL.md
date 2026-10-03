---
name: dependency-update
description: Review and apply dependency updates in the Micelio frontend - Dependabot PRs, npm audit findings and major upgrades (Nuxt, unhead, Vite, Vitest, ESLint, nodemailer, GitHub Actions, Docker base image). Use when triaging Dependabot, fixing a vulnerability, or upgrading a package to a new major.
---

# Dependency update

## Triage

| Update | Action |
| --- | --- |
| Patch / minor in a Dependabot group with green CI | Merge |
| Major of an npm package or GitHub Action | Read its changelog's breaking changes first, then upgrade on a branch with the full suite |
| Node or `@types/node` major | Ignored by Dependabot on purpose: the runtime is distroless Node 22. A Node major moves both `Dockerfile` stages, `node-version` in CI, `engines` and `@types/node` together |
| `npm audit` finding | Fix only what reaches production; see below |

## Vulnerabilities

1. `npm audit --omit=dev` and `npm audit --json` show the path. npm often proposes a nonsense "fix" (a downgrade of Nuxt or Mermaid); ignore it.
2. In order: `npm audit fix` (no majors) → a minor bump of the direct dependency → an `overrides` entry when a transitive package pins a vulnerable exact version (e.g. `lodash-es` under `chevrotain`) → accept and document when no fixed release exists.
3. Check whether the package reaches production: `ls .output/server/node_modules` after `npm run build`. Dev-only findings (`node-forge` through the Nuxt dev server, `esbuild`) stay as accepted risk.
4. CI fails only on **critical** (`npm audit --audit-level=critical`); lower it to `high` once the remaining highs are fixed upstream.

## Upgrading

- Same version for paired packages: `vitest` and `@vitest/coverage-v8`; `nuxt` and `@nuxtjs/i18n` that matches its `unhead` major.
- After `npm install`, compare the lock's key versions with `main` to see what really moved (a Nuxt minor brought unhead 2 → 3 and Vite 7 → 8).
- Known breakages to look for:
  - **unhead 3**: head getters run eagerly on the client (a getter reading state declared later breaks hydration), and `useHead` types are stricter (`rel` literals, script attributes as a `type` alias).
  - **Stricter types**: run `npm run typecheck` before the tests.
  - **ESLint stylistic rules**: run `npx eslint . --fix` and review.
- A package that ships its own types replaces its `@types/*` (nodemailer 10).
- Run the whole **verify-change** suite and a production build; for upgrades that touch rendering, also `compare-html.mjs` against `main`.

## Lockfile conflicts

Dependabot merges change `package-lock.json` under open branches. Resolve as in **ship-pr**: rebase, take `main`'s `package.json` and lock, re-add your change with `npm install`, never hand-edit.
