# Publishing a theme

How a theme folder becomes a published version. This page covers **admission**, the gate every version passes first (ADR 0008, decision 5). Publishing to the registry and yanking a version come with #312, and `theme:submit` for creators without GitHub Actions with #404; until then a version is admitted, not published.

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
    uses: bogd3v/micelio/.github/workflows/theme-admission.yml@v0.5.0
    with:
      theme-dirs: my-theme
      core-ref: v0.5.0
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

Your report is for iterating: publishing (#312) runs admission again on bogd3v's side, against the core release it publishes for.

## 3. What it runs

1. **Plan, `theme:check` and `theme:pack`** (`npm run theme:admit -- plan` and `static`): the contract validator, the public hooks, the contrast matrix, the static budgets and the package with its digest. The same step reads the manual accessibility record, `<accessibility-root>/<id>.json`.
2. **Performance budgets per site mode** (`npm run perf -- --check --theme <id> --mode <mode>`), the same run and limits as the core's own themes (`docs/performance.md`).
   - **Dynamic mode, data-only theme:** no `nuxt build` of its own. The core is built once per call, with a neutral data-only theme (`test/fixtures/themes/minimal`), and each theme is installed into that build's theme store (`npm run theme:admit -- install`), at the build's compile key, as a server serves it (ADR 0009). The report names that build (`builds[].coreBuild`).
   - **Dynamic mode, theme with code** (`slots/` or `templates/`): a build made with the theme, so its slots are compiled in. Layout variants load at runtime (#402), so a data-only theme uses the shared build whatever variants it picks. The report says why (`builds[].kind: "own"`, `reason`).
   - **Static and landing:** the site is generated per theme and mode, against the mock CMS, inside the perf run.
3. **Visual regression and axe** (`npm run test:theme`) in every mode and viewport, in the Playwright image of the core, against the same kind of build with the specimen page. Baselines are read from `<snapshot-root>/<id>/`.
4. **The report** (`npm run theme:admit -- report`): one `admission-report.json` per theme, in the `admission-reports` artifact (`<artifact-prefix>-reports`) and in the run summary.

## 4. Errors and warnings

| Blocks publishing (error) | Published with the version (warning) |
| --- | --- |
| Contract, public hooks and package problems (`theme:check`, `theme:pack`) | `theme:check` warnings, such as fonts over the 100 KB target |
| Contrast below AA in any mode | Budget targets (`warn` limits of `scripts/perf/budgets.json`) |
| An accessibility record that does not match its schema or cannot be read | No accessibility record, a record of another version, a line of the checklist that failed |
| A budget `error` limit, a FOUC rule, a third-party request | |
| An axe violation, a visual diff or a missing baseline, a motion or reflow failure | |
| A check that produced no result (a job that crashed or was cancelled, a quality run where no test passed), or an install into the shared build that failed | |

Every message is the one the check prints today, unchanged, so the report reads like the log.

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
    uses: bogd3v/micelio/.github/workflows/theme-snapshots.yml@v0.5.0
    with:
      theme-dirs: my-theme
      core-ref: v0.5.0
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
