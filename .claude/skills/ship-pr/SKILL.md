---
name: ship-pr
description: Branch, commit and open a pull request in the Micelio frontend the way this repo does it - conventional prefixes, English commits and PRs, conflict checks against other open PRs, labels and releases. Use when a change is ready to be committed or when the user asks to open, update, rebase or release.
---

# Ship a PR

## Branch

- Always from the latest `main`: `git fetch origin && git switch -c <type>/<short-topic> origin/main`. Never commit on `main`, and never stack on another open branch unless the change depends on it.
- One concern per PR. Security fixes, refactors, docs and dependency updates go in separate PRs.

## Commit

- English, conventional prefix with an optional scope: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `ci`, `perf`, `chore` (`chore(deps)` for dependencies, scope `security` for security fixes).
- Body: the problem, then what changed in bullets, then anything the reviewer must know. End with the attribution line the session gives.
- Stage explicit paths; never `git add -A` blindly (scratch files, `.playwright-mcp/`, local `.env`).

## Pull request

- `npm run check` passes locally before opening it (standard, section 15); `.nvmrc` is the Node version source for CI and local.
- Title in English with the same prefix: `fix(security): …`, `docs: …`. The prefix sets the release label automatically (`PR labels` workflow); a title without one ends up in "Other changes".
- Body in English, sections as needed:
  - `## Problem`: what was wrong, with evidence (error, PR number, measurement).
  - `## What changes`: bullets or a table.
  - `## For review`: risks, behaviour changes, manual steps (Dokploy variables, Strapi permissions).
  - `## Tests`: exact commands and counts, and how equivalence was proven (see **verify-change**).
- End with the attribution line the session gives.

## Tracking

If the PR advances an issue of the Micelio plan (epic #240), update the issue's **Progress** section after opening it: the PR, what changed with numbers, and what remains. Tick the epic's checkbox when the issue is done. `gh issue view <n> --json body -q .body` and `gh issue edit <n> --body-file <file>`.

## Before and after opening

- Conflicts with `main` and with the other open PRs:

  ```bash
  git fetch origin
  git merge-tree --write-tree origin/main HEAD >/dev/null && echo ok
  git merge-tree --write-tree origin/<other-branch> HEAD >/dev/null && echo ok
  ```

- If `package.json` / `package-lock.json` conflict (Dependabot merges often cause it): `git rebase origin/main`, take both files from `main` (`git show origin/main:package.json > package.json`, same for the lock), re-add your dependency with `npm install <pkg>@<range>` so npm regenerates the lock, `git rebase --continue`, rerun the suite and `git push --force-with-lease`. Never hand-edit the lockfile.
- Wait for CI on the PR: `gh run list --branch <branch> --limit 1`.

## Release

Releases are dated snapshots of what is live. On `main`, run the **Release** workflow (`gh workflow run Release --ref main`); it tags `vYYYY.MM.DD` and publishes notes grouped by PR label. Check the notes afterwards (`gh release view <tag>`); PRs in "Other changes" need a type label (`gh pr edit <n> --add-label <label>`), then regenerate the notes with the `releases/generate-notes` API and `configuration_file_path=.github/release.yml`.
