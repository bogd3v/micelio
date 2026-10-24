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

If the PR advances an issue of the Micelio plan (epics #316 and #408 here, bogd3v/micelio-plugin-core#62 for the builder), update the issue's **Progress** section after opening it: the PR, what changed with numbers, and what remains. Tick the epic's checkbox when the issue is done. `gh issue view <n> --json body -q .body` and `gh issue edit <n> --body-file <file>`.

## Delivery with the maintainer

The maintainer tests on Docker and certifies the DCO; the agent never pushes on its own (standard, section 13). The order, for every issue that carries a "Verified by the maintainer on Docker" criterion:

1. **Ready to test.** When `npm run check` and the relevant suites pass, tell the maintainer the change is ready and give the Docker steps to try it: the frontend image built from the branch (`docker build -t micelio:<branch> .`) run against the plugin's Compose (`micelio-plugin-core`, `compose.dev.yml`, `docs/operate/manual-testing.md`), and what to look at. Then wait.
2. **Commit, when the maintainer says the test is done.** Give the exact commands and the message, and run them only when asked: `git add <paths>` (explicit paths), `git commit -s -m "<title>" -m "<body>" -m "Co-Authored-By: …"`. The `-s` is the maintainer's certification, so the maintainer runs the commit or confirms it after reading the message; an agent-run commit without `-s` is amended by the maintainer with `git commit --amend --reset-author -s --no-edit`.
3. **Push and PR, when the maintainer confirms the commit.** `git push -u origin <branch>`, then open the PR through the REST API (`gh api repos/bogd3v/micelio/pulls -f title= -f head= -f base=main -F body=@pr.md`; `gh pr create` fails on this account), with the Docker steps of step 1 under `## Tests` and `Refs #N` or `Closes #N`. Update the issue's Progress section in the same step.
4. **Never** push, merge, tag, release or deploy without that confirmation, and never amend or force-push a commit the maintainer signed.

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

Only the maintainer releases (standard, section 13): prepare it, never run it unasked. Versions are SemVer and come from the PR titles (ADR 0010; docs/architecture/releasing.md).

1. Dry run: `gh workflow run Release --ref main` (the default input is `dry_run=true`). Read the computed version and the notes in the run summary.
1b. Refresh the Sigstore trusted root: `node scripts/refresh-trusted-root.mjs <newest @sigstore/tuf version>`, review the diff and commit it as `chore(theme): refresh the Sigstore trusted root` (ADR 0009, section 3: a core with an old root cannot verify new theme attestations).
2. If `package.json` differs from that version, open `chore(release): X.Y.Z` setting it and run `npm run openapi` in the same PR (`docs/openapi.json` declares the version in `info.version`; `npm run lint` and the Release workflow fail otherwise), and merge it before releasing.
3. Release: `gh workflow run Release --ref main -f dry_run=false -f cms_line=<X.Y> -f upgrade_notes="<text>"` (add `-f release_candidate=true` for an `-rc.N`). It re-tags the commit's images; it never rebuilds or moves a tag.
4. Check the body (`gh release view <tag>`): PRs in "Other changes" need a type label (`gh pr edit <n> --add-label <label>`); a `!` in a title adds `breaking` by itself. Regenerate with the `releases/generate-notes` API and `configuration_file_path=.github/release.yml` if needed.
