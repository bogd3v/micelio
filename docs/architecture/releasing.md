# Releasing

**Kind:** how-to. For the maintainer who cuts a release. What a version promises is in [ADR 0010](../adr/0010-semantic-versioning.md) and section 7 of the [engineering standard](../engineering-standard.md).

Releases follow [Semantic Versioning](../adr/0010-semantic-versioning.md): `micelio` and `micelio-cms` share MAJOR and MINOR (one release line) and each has its own PATCH. A release is a `vX.Y.Z` tag on `main`, a GitHub release and images tagged `X.Y.Z` and `X.Y`; `latest` is the newest stable release and builds of `main` are `edge`. While the version is `0.y.z`, a breaking change raises `y`.

Only the maintainer releases. Run the **Release** workflow from the Actions tab on `main`:

1. It defaults to a **dry run**: it computes the next version from the titles of the PRs merged since the last `vX.Y.Z` tag (the highest wins: `!` is breaking, `feat` adds, the rest fixes) and prints the notes, without tagging. Tick *release_candidate* for `vX.Y.Z-rc.N`, which moves neither `X.Y` nor `latest`.
2. `package.json` must already hold that version, because the tag and `version` match: merge a `chore(release): X.Y.Z` PR first. The first release is the version `package.json` declares.
3. Untick *dry_run* and give *cms_line* (the `micelio-cms` line it was tested with, e.g. `0.1`) and, if a PR is breaking, *upgrade_notes*. The workflow checks that the pipeline passed on the commit, re-tags that commit's images as `X.Y.Z`, `X.Y` and `latest` (no rebuild), tags `main` and publishes the release.

The release body starts with **Upgrade notes**, then the theme contract, the `micelio-cms` line and the minimum Node; the generated notes follow with **Breaking changes** first. Edit the body afterwards to expand the upgrade notes; a published tag or image tag is never moved. Every merge to `main` publishes the images `:edge` and `:<short sha>` and does not touch `latest`.

The labels come from the PR title: the `PR labels` workflow reads its conventional prefix (`feat` → enhancement, `fix` → bug, `docs` → documentation, `refactor`/`style` → refactor, `test` → testing, `ci` → ci, `chore` → code-quality, `chore(deps)` → dependencies; a `!` after the type or scope adds `breaking`; a `security`/`seguridad` scope adds security). Dependabot labels its own PRs. Add `ignore-for-release` to leave a PR out of the notes.
