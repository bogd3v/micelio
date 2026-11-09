# Read the accessibility conformance report

**Kind:** how-to. Goal: find the report of a release, read it, and know what it does not say.

The standard targets WCAG 2.2, level AA (section 9 of `docs/engineering-standard.md`). Each release gets one file, `accessibility-conformance-<tag>.md`, which the last job of `.github/workflows/release.yml` attaches to the release page once it is published: a result per WCAG success criterion for the core with the `starter` theme. Cite that file when you must show how the site engine stands.

## Where it is

- On the release: `https://github.com/bogd3v/micelio/releases/tag/<tag>`, under Assets.
- On your machine: `npm run a11y:report` writes `.micelio/a11y/conformance.md`.

```bash
export NUXT_PUBLIC_THEME=starter MICELIO_SPECIMEN=1 MICELIO_THEME_DIRS=test/fixtures/themes/alternates
npm run build
E2E_BUILD=1 THEME_REPORT_JSON=.micelio/a11y/quality.json npm run test:theme -- e2e/theme/a11y.spec.ts e2e/theme/core-a11y.spec.ts
npm run a11y:report
```

The release runs these two axe specs against the build (`E2E_BUILD=1`); without the file names the whole suite runs, visual regression included, which expects the Playwright image of the baselines (`docs/architecture/testing-a-branch.md`).

Options: `--theme <id>` (default `starter`), `--axe <file>` (default `.micelio/a11y/quality.json`), `--record <file>` (default `accessibility/<theme>.json`) and `--out <file>`.

## What it is made from

- The axe results of `npm run test:theme` (`docs/theme-testing.md`), which run `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` on every page, mode and viewport of the theme.
- The manual record of the theme, `accessibility/starter.json` in this repository (`docs/themes/accessibility-checklist.md`, "Where the result is recorded"): one result per line of the checklist.

Each criterion takes the worst result of the lines that check it (the mapping is in `scripts/a11y/conformance.mjs`).

## How to read it

| Result | Meaning |
| --- | --- |
| Supports | Every line that checks the criterion passes. |
| Does not support | At least one line fails. The row names the issue that tracks it; `(core)` marks a failure the core causes. |
| Not verified | No line failed, but at least one was not checked, and the row says why (for example, no real screen reader was used). |

The summary says **Conforms** only when every line of the record passes and axe found no violation. A single `fail` or `not-verified` line, a missing record or a missing axe result makes it say **Does not claim conformance**, with the counts. The report never claims more than the record: a person who repeats the checklist updates the record, and the next release shows it.

The report covers the criteria its table lists, on the pages of the theme tests. It is not a certification, and criteria outside the table (media alternatives, forms, authentication) are not assessed. A site's own content and the theme it runs are its owner's to check.

## NTC 5854

NTC 5854 is the Colombian standard for accessible web pages. The report adds a note that maps it to the WCAG criteria of the table, and nothing more: it is not a second claim of conformance.
