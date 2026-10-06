---
name: verify-change
description: Verify a change to the Micelio frontend before opening or merging a PR - the full check suite, how to tell a flaky e2e from a regression, and how to prove that a refactor, CSS move, dependency update or CSP change did not alter what users get. Use after any code change and before reporting it as done.
---

# Verify a change

## 1. The suite (same as CI)

```bash
npm run lint              # 0 errors; the 3 v-html warnings are known and sanitized
npm run typecheck
npm run test:coverage     # unit + component, fails under the thresholds in vitest.config.ts
npm run test:integration  # real build + mock Strapi
npm run test:e2e          # Playwright against the dev server + mock Strapi
npm run test:theme        # theme visual regression + axe (CI, Playwright image; see docs/theme-testing.md)
```

Run all of them; report the counts (e.g. 383 / 121 / 117), not "tests pass". For lockfile or Docker changes also run `npm run build`.

## 2. A failing e2e

The dev server is sometimes slow on the first spec or under load, so a navigation timeout is not proof of a regression, and not proof of a flake either:

1. Rerun the spec alone: `npx playwright test e2e/<spec>.ts --repeat-each=3`.
2. If it passes, run the whole suite again; a flake fails a *different* spec each time.
3. If the same test fails again, or it covers code you touched, compare with `main`: `git stash -u && git switch --detach origin/main`, run it, switch back and `git stash pop`.

Write the outcome in the PR (which spec, how often, what it covers) instead of hiding it.

## 3. Proving "no visible change"

Scripts in this skill's `scripts/` folder; run them from the repo root with `node .claude/skills/verify-change/scripts/<script>`.

| Change | Proof | Script |
| --- | --- | --- |
| CSS split or move, token rename | Computed styles of every element, before and after, at 375 / 800 / 1280 px | `compare-styles.mjs capture <url> before.json [paths]` → change → `capture … after.json` → `compare before.json after.json`. Options: `--theme noche\|dia`, `--scope all` (`html`, `body`, `body *` and rendered `::before`/`::after`/`::placeholder`; default `main *`), `--widths 375,768,1280`, `--states` (also after a Tab press and after scrolling to the bottom) |
| Refactor, formatting, dependency update | Same HTML from `main` and the branch, both built and served against the mock Strapi | `compare-html.mjs <urlMain> <urlBranch> [paths]` |
| Headers, CSP, new media or embed domain, new inline script | No `securitypolicyviolation` or page error on a production build | `csp-probe.mjs <url> [paths]` |

To serve a production build against the mock Strapi:

```bash
npm run build
node e2e/mock-strapi.mjs &
NUXT_PUBLIC_STRAPI_URL=http://127.0.0.1:4310 PORT=3211 node .output/server/index.mjs &
```

For `main`, build it in a worktree (`git worktree add <dir> origin/main`, symlink `node_modules`) and serve it on another port. `compare-html.mjs` ignores asset hashes, CSP hashes, timestamps and the Nuxt payload (its keys follow async resolution order); a remaining diff in a Nuxt auto key (`$f…`) only means source lines moved. The CSP is not applied by the dev server, so always probe a production build. The probe can also run against https://bogdev.com.co after a deploy.

## 4. After merge

- Check that the deploy ran: `gh run list --branch main --limit 1`. A merge without a run means GitHub dropped the push event; start **CI/CD Pipeline** by hand (`gh workflow run "CI/CD Pipeline" --ref main`).
- Smoke the live site: `curl -s -o /dev/null -w '%{http_code}' https://bogdev.com.co/<path>` and `csp-probe.mjs https://bogdev.com.co`.
