# ADR-0010: Semantic versioning and one release line for both repositories

**Status:** Accepted
**Date:** 2026-10-09
**Deciders:** BogDev maintainer

## Context

Nobody outside BogDev can pin a version of Micelio:

- The images are tagged with the commit SHA and `latest`, and `latest` is re-pointed on every commit of `main` (`deploy.yml`).
- The only Git tag, `v2026.10.02`, is a dated snapshot of what BogDev had in production. `micelio-cms` has no tag.
- Nothing states which frontend works with which CMS.
- #314 re-checks published themes "on every core release" and [ADR-0008](0008-theme-registry.md) has instances build from "a core release tag", but a core release was never defined.

Section 7 of the [engineering standard](../engineering-standard.md) proposes the policy. Adopting it changes deployment and public tags, which is expensive to undo, so it gets a record. Number 0009 is reserved for the theme store (#399).

## Decision

### 1. Semantic Versioning 2.0.0

Both repositories follow SemVer. The public interface is the set of contracts of section 6 of the standard that each repository owns (theme contract, content API, token permissions, operator interface, visitor-facing identifiers, stored data). Everything else is internal. What bumps MAJOR, MINOR and PATCH is the table in section 7 of the standard; this record does not repeat it.

The bump is computed from the titles of the pull requests merged since the last release, the highest wins: `!` is breaking, `feat` adds, the rest fixes. The effect decides, not the prefix.

### 2. One release line

`micelio` and `micelio-cms` share MAJOR and MINOR and raise them together; each has its own PATCH. "Micelio 1.4" is any `micelio 1.4.z` with any `micelio-cms 1.4.z`. Upgrades go CMS first, and the CMS of a line also serves the frontend of the previous MINOR, so a site upgrades one side at a time without downtime. Across a MAJOR the upgrade notes give the order. The builder image carries the version of `micelio`.

### 3. Image tags: `latest` is stable, `edge` is `main`

- A release `X.Y.Z` publishes the images `ghcr.io/bogd3v/micelio` and `micelio-builder` as `X.Y.Z` and `X.Y`, and moves `latest`.
- Every merge to `main` publishes `edge` and the commit SHA, and no longer moves `latest`.
- A release candidate `vX.Y.Z-rc.N` moves neither `X.Y` nor `latest`.
- **BogDev** keeps deploying on every merge, so its Dokploy application changes from `:latest` to `:edge` when #415 lands. This is a manual change by the maintainer, done in the same window as that merge. Its site does not change.
- Compose files for trying Micelio default to the `X.Y` of the release they ship with, never to a moving build of `main`.

### 4. Before 1.0.0

While the version is `0.y.z`, a breaking change raises `y` and everything else raises `z`. Breaking changes still need their ADR and upgrade notes. `1.0.0` is cut by an ADR, when the theme registry accepts third-party themes or the first site outside bogd3v runs in production, whichever comes first.

### 5. First release and the old tag

The first release is `v0.1.0` in both repositories (`micelio-cms` already declares 0.1.0). The tag `v2026.10.02` is renamed `snapshot-2026-10-02`, because every tool that sorts versions puts 2026.10.2 above any real one. A published SemVer version is never moved; the rename happens once, before `v0.1.0`, and is done by #415 with the maintainer's approval.

### 6. Theme contract and core versions

A theme package declares the contract it needs as `major.minor` (ADR-0008, section 2). A minor of the contract ships in a MINOR of the core, a major of the contract in a MAJOR. Every release states the contract it implements.

### 7. Deprecation, support and upgrades

- Something is deprecated in a MINOR: in the release notes, in the documentation and with a warning at boot or build that names the replacement. It keeps working for at least one more MINOR and is removed in a MAJOR (before 1.0.0, in a later `0.y`).
- Only the latest release line receives fixes, security fixes included.
- Within a MAJOR an upgrade runs its migrations on boot with no manual step. Going back across a MINOR is not supported: back up before upgrading.

### 8. Reporting versions: deferred

Whether each side exposes its version (in `/_health` and a response header) so the frontend can warn about a CMS of another line is not decided here. It adds a field to a contract and needs its own issue.

## Options considered

### A. One release line, SemVer from conventional titles (chosen)
One number to say and to support. The cost is that a CMS-only fix needs no frontend release but the pair still reads as one line.

### B. Independent versions with a compatibility table
Each repository moves at its own pace. Operators must read a table to know what works together, and the table is one more thing to keep true.

### C. Keep dated tags
Cheap, and it is what exists. A date says when, not whether the upgrade breaks anything, and nobody can express a range such as "`^1.4`".

### D. A release tool driven by conventional commits
Removes the hand-run step. The workflow of #415 already computes the bump from titles and shows it before tagging; a full release tool can replace it later without changing this decision. Only the maintainer runs releases.

## Trade-offs

- `latest` stops meaning "what is live". Anyone who relied on it gets the last release, not `main`, and BogDev must switch to `edge`.
- Before 1.0.0 a `y` bump carries breaking changes, as SemVer allows, so `0.y` operators read the upgrade notes every time.
- Supporting only the latest line keeps the work small and forces sites to upgrade.

## Consequences

- #415 (`S7`) implements this: `version` in `package.json`, the Release workflow, image tags, the `breaking` label, release notes sections and the tag rename. `SC8` does the same in `micelio-cms`.
- `README.md` ("Releases") describes the policy and says the dated workflow stays until #415 lands.
- #314 and ADR-0008 can say "a core release" and mean a `vX.Y.Z` tag.
- Section 7 of the engineering standard already states this policy; no change to the standard is needed.
- Not decided and left to its own issue: version reporting between the two sides (decision 8).
