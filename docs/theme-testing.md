# Theme visual regression and axe

`npm run test:theme` (`playwright.theme.config.ts`, specs in `e2e/theme/`) checks the **active theme** (`NUXT_PUBLIC_THEME`, default `bogota`) against a production build with the specimen page (`MICELIO_SPECIMEN=1`) and the mock Strapi. There is one Playwright project per mode of the theme's `theme.json` and per viewport (1280 and 390 px), named `<mode>-<viewport>`; each project stores the mode in `localStorage` (`bd-theme`) before the first load.

- `visual.spec.ts`: home, blog, an article, about (full page) and each `data-section` group of `/_theme` (one image per group). Dates (`time`) and the footer year are masked; images from outside the server are replaced by a fixed pixel; animations and motion are off; the run waits for fonts and the Mermaid diagrams. `maxDiffPixelRatio` is 0.001: text renders identically in the same Docker image, the margin only absorbs sub-pixel noise between CPUs. No retries: a screenshot that needs one is a bug.
- `a11y.spec.ts`: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on the same pages, modes and viewports. Violations fail; nothing is excluded.

Baselines are committed in `e2e/theme/__screenshots__/<theme>/<mode>/<viewport>/`. They are rendered in the Playwright image of the CI (`mcr.microsoft.com/playwright:v<version>-noble`, the version of `@playwright/test` in `package-lock.json`); images made on another OS differ in text rendering, so **do not commit locally rendered PNGs**. A missing baseline fails the run (also in CI).

## Create or update the baselines

1. Push the branch. If the `Theme Quality` job fails (new theme, missing or changed baselines), download the artifact `theme-snapshots-<theme>` of that run. It holds the images as rendered by the run; the failing diffs are in `theme-report-<theme>`.
2. Or start **Theme Snapshots** by hand (Actions, `workflow_dispatch`, input `ref`) to render the baselines of any branch.
3. Review the images, unzip them into `e2e/theme/__screenshots__/<theme>/` and commit. CI never commits baselines.

The `Theme Quality` check gates `deploy`, like `Performance Budgets`.

## Locally

```bash
MICELIO_SPECIMEN=1 NUXT_PUBLIC_THEME=bogota npm run build
E2E_BUILD=1 npx playwright test -c playwright.theme.config.ts e2e/theme/a11y.spec.ts   # OS independent
```

Run `visual.spec.ts` locally only to check that it works (`npm run test:theme:update` writes into the repo: discard the images). The same specs run with another theme through `NUXT_PUBLIC_THEME` and the build of that theme.
