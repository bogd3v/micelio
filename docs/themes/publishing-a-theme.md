# Publishing a theme

How a theme folder becomes a published version. This page covers **admission**, the gate every version passes first (ADR 0008, decision 5), then **publishing** to the registry and **yanking** a version (sections 8 to 11). Only bogd3v publishes, and every version is `official`; `theme:submit` for creators without GitHub Actions and the other tiers come with #404.

## 1. Repository layout

A theme lives in its own repository, public or private. Nothing in admission assumes the source is public or belongs to bogd3v.

```
my-theme/                  the theme folder: what the package holds (creating-a-theme.md, section 7)
  theme.json
  theme.css
  fonts/  images/  i18n/
__screenshots__/my-theme/  visual baselines, outside the theme folder (a file the package does not allow fails theme:pack)
accessibility/my-theme.json  the manual accessibility record (docs/themes/accessibility-checklist.md), outside the theme folder too
.github/workflows/admission.yml
```

Each theme folder is named after its `id` (the core refuses a folder whose name differs), so a theme cannot sit at the repository root. Several themes in one repository work the same way: one folder each, one baseline folder each under `__screenshots__/<id>/` and one record each, `accessibility/<id>.json`.

## 2. Run admission

`.github/workflows/theme-admission.yml` of the core is a reusable workflow. Call it with the core release you build against, on the `uses:` line and in `core-ref` (the default `core-ref` is the core's latest release, which only matches a `uses:` ref that follows it):

```yaml
name: Admission
on: [push, pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  admission:
    uses: bogd3v/micelio/.github/workflows/theme-admission.yml@v0.5.2
    with:
      theme-dirs: my-theme
      core-ref: v0.5.2
```

| Input | Default | Meaning |
| --- | --- | --- |
| `theme-dirs` | `.` | Theme folders, or folders of themes, one per line, relative to your repository (empty admits the core's own installed themes: what `deploy.yml` does) |
| `themes` | every theme found | JSON array of ids, to admit only some |
| `core-repository`, `core-ref` | `bogd3v/micelio`, its latest release | The core to admit against |
| `modes` | every mode the core budgets in CI | JSON array of site modes (`["dynamic", "static", "landing"]`) |
| `quality`, `visual` | `true`, `true` | Visual regression and axe; `visual: false` runs axe and the other specs without screenshots |
| `snapshot-root` | `__screenshots__` | Where the baselines are: `<snapshot-root>/<id>/<mode>/<viewport>/` (the core passes `e2e/theme/__screenshots__`) |
| `accessibility-root` | `accessibility` | Where the manual accessibility records are: `<accessibility-root>/<id>.json` |
| `display-font` | `true` | Also measure dynamic mode with the heaviest curated display font (ADR 0005, section 9) |
| `fail-on-errors` | `true` | `false` only for a caller that checks the reports itself |
| `artifact-prefix` | `admission` | Prefix of the artifacts; two calls in one run need different ones |
| `update-snapshots` | `false` | Render the baselines instead of admitting; `theme-snapshots.yml` sets it (section 6) |

The outputs are `ok` (`"true"` when no report has an error), `reports`, the name of the artifact (`admission-reports` by default) with `<id>/admission-report.json` and the package of each theme, and one result per check across every theme: `static` (`theme:check` and `theme:pack`), `performance` and `quality`, each `"passed"` or `"failed"` (`quality` is `"skipped"` with `quality: false`). The core's `deploy.yml` gates `Performance Budgets` and `Theme Quality` on them.

Your report is for iterating: publishing runs admission again on bogd3v's side, against the core release it publishes for.

## 3. What it runs

1. **Plan, `theme:check` and `theme:pack`** (`npm run theme:admit -- plan` and `static`): the contract validator, the public hooks, the contrast matrix, the static budgets and the package with its digest. The same step reads the manual accessibility record, `<accessibility-root>/<id>.json`.
2. **Performance budgets per site mode** (`npm run perf -- --check --theme <id> --mode <mode>`), the same run and limits as the core's own themes (`docs/performance.md`).
   - **Dynamic mode, data-only theme:** no `nuxt build` of its own. The core is built once per call, with a neutral data-only theme (`test/fixtures/themes/minimal`), and each theme is installed into that build's theme store (`npm run theme:admit -- install`), at the build's compile key, as a server serves it (ADR 0009). The report names that build (`builds[].coreBuild`).
   - **Dynamic mode, theme with code** (`slots/` or `templates/`): a build made with the theme, so its slots are compiled in. Layout variants load at runtime (#402), so a data-only theme uses the shared build whatever variants it picks. The report says why (`builds[].kind: "own"`, `reason`).
   - **Static and landing:** the site is generated per theme and mode, against the mock CMS, inside the perf run.
3. **Visual regression and axe** (`npm run test:theme`) in every mode and viewport, in the Playwright image of the core, against the same kind of build with the specimen page. Baselines are read from `<snapshot-root>/<id>/`.
4. **The report** (`npm run theme:admit -- report`): one `admission-report.json` per theme, in the `admission-reports` artifact (`<artifact-prefix>-reports`) and in the run summary.

## 4. Errors and warnings

| Blocks admission (error) | Does not block admission (warning) |
| --- | --- |
| Contract, public hooks and package problems (`theme:check`, `theme:pack`) | `theme:check` warnings, such as fonts over the 100 KB target |
| Contrast below AA in any mode | Budget targets (`warn` limits of `scripts/perf/budgets.json`) |
| An accessibility record that does not match its schema or cannot be read | No accessibility record, a record of another version, a line of the checklist that failed or was not verified |
| A budget `error` limit, a FOUC rule, a third-party request | |
| An axe violation, a visual diff or a missing baseline, a motion or reflow failure | |
| A check that produced no result (a job that crashed or was cancelled, a quality run where no test passed), or an install into the shared build that failed | |

Every message is the one the check prints today, unchanged, so the report reads like the log. Publishing adds its own rule on the accessibility record (section 8): admission also runs for the core's own themes on every push, which have no record yet, so it only warns.

## 5. The report

`admission-report.json` follows `themes/admission-report.schema.json`, generated from `modules/theme/admission/report.ts` (`npm run theme:schema`; `npm run lint` fails on drift). Version 1:

| Field | Holds |
| --- | --- |
| `schemaVersion`, `ok`, `generatedAt` | `1`; `true` when `errors` is empty |
| `theme` | `id`, `version`, the `contract` it declares, `code` |
| `core` | `repository`, `ref`, `sha`, `version`, the `contract` it implements |
| `run` | The workflow run URL |
| `builds` | Per performance and quality build: `kind` (`shared` or `own`), `coreBuild` (the id of the core build: a hash of the compiler's sources and the variant CSS), `baseTheme` or `reason` |
| `package` | `file`, `digest` (`sha256:`), `bytes`; `null` when the theme cannot be packed |
| `checks` | The status of each check, every page measurement per mode, and the passed, failed and skipped tests per quality spec |
| `accessibility` | Optional, when the theme has a valid record: `status` (`passed`, `partial` when a line was not verified, `failed`), `current` (the record is for this version) and the `record` as written (`docs/themes/accessibility-checklist.md`) |
| `errors`, `warnings` | `check` (`static`, `performance`, `quality`, `accessibility`, `admission`), `kind` (`contract`, `contrast`, `budget`, `third-party`, `axe`, `visual`, `motion`, `missing`…), `message`, `mode` |

A field is added without a version change when it is optional, and so is a new value of an enum such as `check` (`accessibility` was added this way: a reader that validates against an older schema must accept unknown values); a change of meaning or a removal raises `schemaVersion`.

## 6. Baselines

The first run of a theme has no baselines and fails visual regression. Render them in the Playwright image of the core with `theme-snapshots.yml`, which builds the theme as admission does and uploads `admission-snapshots-<id>` (`<artifact-prefix>-snapshots-<id>`):

```yaml
name: Snapshots
on: workflow_dispatch
permissions:
  contents: read
jobs:
  snapshots:
    uses: bogd3v/micelio/.github/workflows/theme-snapshots.yml@v0.5.2
    with:
      theme-dirs: my-theme
      core-ref: v0.5.2
```

It takes `theme-dirs`, `themes`, `core-repository`, `core-ref`, `snapshot-root` and `artifact-prefix`, as admission does. A failed admission run also uploads the baselines as they render now, under the same name. Review the images, unzip them into `__screenshots__/<id>/` and commit; never commit images rendered on your machine (`docs/theme-testing.md`).

## 7. Locally

The steps are scripts of the core, so you can run them in a core checkout with `MICELIO_THEME_DIRS` pointing at your theme:

```bash
export MICELIO_THEME_DIRS=../my-repo/my-theme
npm run theme:check -- my-theme                         # contract, contrast, static budgets
MICELIO_THEME_DIRS=test/fixtures/themes/minimal NUXT_PUBLIC_THEME=minimal npm run build   # the shared build
npm run theme:admit -- install --theme my-theme --output .output --purpose performance --out admission/my-theme/build-performance.json
npm run perf -- --check --theme my-theme --mode dynamic
```

## 8. Publish

Publishing is split between the core's reusable workflows, which decide and write, and two files of `bogd3v/micelio-themes` (#313), whose jobs sign. The split is what keeps the identities the core pins (`DEFAULT_SIGNER` in `modules/theme/registry/constants.ts`): a Sigstore certificate names the file that defines the job that signs, so the package attestation must come from a job of `micelio-themes/.github/workflows/publish.yml` and the index signature from a job of `.../sign-index.yml`, both on `refs/heads/main`. Both run only from a repository of the bogd3v organisation (`github.repository_owner`), so every version is `official`.

| File | Where | Does |
| --- | --- | --- |
| `theme-publish.yml` | core | Gate, new-version check, `oras push` of the package, the admission report as a referrer; uploads the package for the signing job. Signs nothing |
| `publish.yml`, job `attest` | `micelio-themes` | Attests the package (`actions/attest-build-provenance`), uploads the bundle |
| `theme-push-bundle.yml` | core | Verifies the bundle as a client does, against `DEFAULT_SIGNER`, then pushes it to `<id>:<version>.att`, or the index and its bundle to `index:v1` and `index:v1.att` |
| `theme-index-prepare.yml` | core | Makes the next index (add or yank), after verifying the signature of the one the registry holds. Writes and signs nothing |
| `theme-index-listed.yml` | core | Last job of `publish.yml`: reads the signed index and fails, naming the re-run, if it does not list the version the run pushed. Writes nothing |
| `sign-index.yml`, job `attest` | `micelio-themes` | Signs the index, in the environment `theme-index` and the concurrency group `theme-registry-index`; calls the two core workflows around it |

**What to create in `micelio-themes`:** copy `docs/themes/registry-workflows/publish.yml` and `sign-index.yml` of the core release you pin to `.github/workflows/` under those names (the templates are checked by the core's tests: the pinned identities, one signing job each, one release). Replace `v0.5.2` and `core-ref` together when you move to another release. A maintainer starts `Publish` with the theme id; `Sign index` with `action: yank` is the yank (section 9). Do not rename the files, move the signing jobs or run them from another branch than `main`: every client would refuse what they sign, and `theme-push-bundle.yml` refuses the bundle first (`npm run theme:publish -- verify`).

`theme-publish.yml` (decisions are `npm run theme:publish -- gate` of the core ref):

1. **The gate.** Refuses a report with errors, one for another theme, one without a version, contract or package, a package whose sha256 is not the report's, and a package that does not unpack by the rules a client applies. It also requires the manual accessibility record (standard, section 9; `docs/themes/accessibility-checklist.md`): a missing record, a record of another version (`current: false`), an invalid one and one with a **failed** line block, and the message names `<accessibility-root>/<id>.json`. A **partial** record (lines not verified) does not block; it stays in the report and the run shows a warning.
2. **A new version.** `<id>:<version>` must not exist. A published version never changes: a fix is a new version, and a yanked version cannot be published again.
3. **The artifact.** `ghcr.io/bogd3v/micelio-themes/<id>:<version>` is one layer, the `.tgz` itself (`application/vnd.micelio.theme.package.v1.tar+gzip`), so its digest is the digest a lock pins. The manifest annotations (`io.micelio.theme.*`) carry the contract, license, tier and the digests of the package and of the report.
4. **The report.** `admission-report.json` is attached to the package as a referrer (`application/vnd.micelio.theme.admission-report.v1+json`) and its digest is the `report` of the index entry.
5. **The attestation** is pushed after the package, to `<id>:<version>.att`, by `theme-push-bundle.yml`.

`theme-index-prepare.yml` writes nothing; `theme-push-bundle.yml` writes `index:v1` (`themes/registry-index.schema.json` is its schema, generated from `modules/theme/registry/registry-index.ts`; `npm run theme:schema`) and its signature `index:v1.att`. Preparing trusts nothing the caller passes but the digest: for `add` it reads the package from the registry, verifies its attestation against the publish signer as a client does, and derives license, contract and `code` from the package (never from the caller); the tier is `official`. The new index must be a valid successor of the old (only new versions and `published` to `yanked`, `successorProblems`), and the write is refused when the registry's index is not the one that was read (`theme:publish -- check-base`, tested). The signature is not a field of the index: it is the bundle at `index:v1.att`, which a client verifies against the index signer before it reads anything.

**When a run stops half way.** The package is pushed before it is attested and listed, so a failure after that (a rejected approval of `theme-index`, a cancelled run, a registry error) leaves the version pushed and not listed. A new run of the same version stops at "is already published". Re-run the failed jobs of the same run: the artifacts it needs (the package, the bundle and the index) are kept for 7 days. If the index was written and only its signature failed, the repeated `write` job finds its own index in the registry (`check-base` answers `written`) and pushes the signature alone; until then clients refuse the index. If another index change landed in between, the re-run of an earlier `prepare` is refused as stale: run `Sign index` (`sign-index.yml`) with `action: add`, the theme, the version, the package digest and the report digest, which prepares the change again from the current index and still needs the approval of `theme-index`. If the package is wrong, publish a new version; a pushed version is never overwritten.

**The limit of the queue, and the check at the end.** One group, `theme-registry-index`, serializes every change of the index, and GitHub keeps in a group one running run and one pending run: a newer pending run cancels the older pending one. The running run waits for the approval of `theme-index`, so while it waits two publishes (or a publish and a yank) can queue behind it and the third cancels the second. The cancelled run has already pushed and attested its package, and nothing lists it. Nothing is lost silently: the last job of `publish.yml`, `listed`, runs even when `index` was cancelled and fails with the exact re-run (`theme:publish -- listed`; for a version listed with another package digest it names both), for example:

```
calm@1.2.0 is pushed and attested but not in the index: its request to the index was cancelled or failed. Run "Sign index" (sign-index.yml) with action add, theme calm, version 1.2.0, digest sha256:…, report-digest sha256:…
```

Run `Sign index` with those inputs: it prepares the change from the current index and still needs the approval of `theme-index`. Approve the pending request before starting the next publish, or start publishes one at a time; a version cannot be double-listed (`addVersion` refuses it) and a yank cannot be cancelled into silence either: a cancelled `Sign index` run is shown as cancelled and is started again with the same inputs. We chose the check over a job that lists every unlisted version because a registry has no list of themes (a new theme has no repository in the index to scan), so such a job would heal only some cases and add a second path that signs; the re-run is the path that already exists and is tested. A cancelled run of `theme-publish.yml` itself (its group is per theme) pushed nothing: start it again.

Each entry says whether the version has `code` (`slots/` or `templates/`), which is how the theme picker and a server tell what an image can activate (ADR 0009, section 4).

## 9. Yank

Run `Sign index` (`sign-index.yml` of `micelio-themes`) with `action: yank`, the theme, the version and a reason. A yank marks a `published` version `yanked` with a one-line reason (500 characters at most) and the time. It goes through the index workflow because the core pins one identity for the index. A yanked version:

- is never resolved for a new range: `theme:add` and `theme:outdated` skip it;
- stays pullable for a lock that already pins it: `theme:pull --frozen` still installs it;
- cannot be published again, and cannot be un-yanked: publish a new version.

## 10. What yank cannot do

Yank is the only kill switch until a core release rotates the trust root. ADR 0008 has no status that removes an already-installed theme from a site: a yank stops new installs and new ranges, and a site that pinned the digest keeps it. `incompatible` (set by #314, not by these workflows) is refused by the same rule as `yanked`, on purpose: only a site's own pin installs it. Revoking the publish or index identity needs a core release with a new `DEFAULT_SIGNER`, so renaming `publish.yml` or `sign-index.yml`, or changing the branch they run from, is changing the trust root.

## 11. Organisation setup (once, by an owner)

The workflows cannot do these; they are not in the repository's files:

1. In `bogd3v`, make the package `micelio-themes` and its sub-packages **public**, so a client pulls with no credentials.
2. Give write access to the packages only to the repository that calls the workflows (`bogd3v/micelio-themes`, Actions access on each package), and to nobody else.
3. In `micelio-themes`, add `.github/workflows/publish.yml` and `sign-index.yml` from `docs/themes/registry-workflows/` (section 8), and create the environment `theme-index` with the maintainers as required reviewers. Protect `main` and limit who can change `.github/workflows/`: the branch is part of both identities. Limit the deployment branches of the environment `theme-index` to `main`. The signing jobs and the write carry `if: github.repository == 'bogd3v/micelio-themes'`: in a called workflow `github.repository` and the environment are the caller's, so without the guard any other repository of the organisation could call `sign-index.yml` and get a signature under the pinned identity with no approval. Keep the guard when you edit the files.
4. Pin the `uses:` lines and `core-ref` of both files to a core release that contains these workflows; update them together.
