# OpenSSF Scorecard

The [OpenSSF Scorecard](https://securityscorecards.dev/) runs weekly and on every push to `main` (`.github/workflows/scorecard.yml`) and uploads its findings to code scanning. Section 10 of the [engineering standard](../engineering-standard.md) asks that each finding is fixed or written down with the reason. This page is that record.

Last reviewed: 2026-10-18, score 7.4 of 10 on `dc7a9b1` (6.1 on `ef5fb21`, the first run, 2026-10-15). Review it when the score moves or a check changes.

## Fixed

| Check | Finding | Fix |
| --- | --- | --- |
| Token-Permissions | `release.yml` asked for `contents: write` and `packages: write` for the whole workflow | The workflow is read-only; the single `release` job asks for its writes |
| Pinned-Dependencies | The three `FROM` lines of the `Dockerfile` used tags that move (9 of 10) | Each is pinned by digest (#548); CI keeps the Docker Hub rate-limit protection through a GHCR copy named by tag and digest ([the CI pipeline](../architecture/ci-pipeline.md#the-node-base-image)). 10 of 10 on `dc7a9b1` |

## Accepted

| Check | Score | Why it stays |
| --- | --- | --- |
| Code-Review | 0 | One maintainer, so no change has a second approver. The standard asks a reader other than the author; for a change written by an agent, the human who opens it reads it all. It closes when a second maintainer joins |
| Token-Permissions | 0 | `contract.yml` pushes a copy of the Postgres image to GHCR, so its job needs `packages: write`. The build jobs of `deploy.yml` need it to push the images, and `id-token` and `attestations` to sign them (ADR 0008). Each is job-level and the minimum for its job |
| Security-Policy | 4 | `SECURITY.md` exists and has a private channel, disclosure and response times. Scorecard v5.5.0 reads `.claude/agents/security.md` instead of the root file ([ossf/scorecard#5198](https://github.com/ossf/scorecard/issues/5198)), the same bug recorded in `micelio-cms` |
| SAST | 7 | CodeQL runs on every pull request and push to `main` (`.github/workflows/codeql.yml`, #549); it was 0. Scorecard scores the share of recent commits that were analysed, so it should rise toward 10 as older commits leave its window. The first scan's alerts are triaged in [`../security.md`](../security.md#code-scanning-codeql) |
| Fuzzing | 0 | The project is not fuzzed. Input is validated by schemas at the boundary (section 9 of the standard); a fuzzing setup is not planned |
| CII-Best-Practices | 0 | A best-practices badge is a registration by the maintainer, not a code change; none is registered |
| Contributors | 0 | Counts organisations contributing; the project has one |
| License | 9 | `LICENSE` is the AGPL-3.0 text under a project header, with the theme exception in `LICENSE-EXCEPTION.md` ([ADR 0007](../adr/0007-license.md)); Scorecard reports that the file is not a plain FSF or OSI license |

## Open, tracked as work

These need a change of their own and are not part of this record's pull request:

| Check | Score | What closes it |
| --- | --- | --- |
| Vulnerabilities | 8 | Two Dependabot alerts on the default branch; see [`../security.md`](../security.md#dependencies) |

## Not measured

- **Branch-Protection**: the workflow token cannot read classic branch protection rules; it needs a token with that scope, set by the maintainer. `main` is protected.
- **Signed-Releases**: no release exists yet. It is measured from `v0.1.0`.
