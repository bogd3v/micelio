# Theme visual regression and axe

`npm run test:theme` (`playwright.theme.config.ts`, specs in `e2e/theme/`) checks the **active theme** (`NUXT_PUBLIC_THEME`, default `bogota`) against a production build with the specimen page (`MICELIO_SPECIMEN=1`) and the mock Strapi. There is one Playwright project per mode of the theme's `theme.json` and per viewport (1280 and 390 px), named `<mode>-<viewport>`; each project stores the mode in `localStorage` (`micelio-theme`) before the first load.

- `visual.spec.ts`: home, blog, an article, about (full page) and each `.myc-specimen-group[data-section]` group of `/_theme` (the page sections of #244 are one group per section, `page-<kind>`, with every variant) (one image per group; the `regions` group also holds the variants of every region the theme does not use, which only the specimen build registers). Dates (`time`) and the footer year are masked; images from outside the server are replaced by a fixed pixel; animations and motion are off; the run waits for fonts and the Mermaid diagrams. `maxDiffPixelRatio` is 0.001: text renders identically in the same Docker image, the margin only absorbs sub-pixel noise between CPUs. No retries: a screenshot that needs one is a bug.
- `a11y.spec.ts`: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on the same pages, modes and viewports. Violations fail; nothing is excluded.

`a11y.spec.ts` also asserts that every id of `/_theme` is unique. The variants the theme does not use repeat the ids of the active ones (`latest-title`, `references`, heading ids), so `SpecimenRegions.vue` renames them in the browser (`-copy<N>`, plus `for`, `form`, `headers`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant`, `aria-details`, `aria-errormessage` and `href="#…"` inside the same frame). It runs after hydration, so the server HTML still has the duplicates, and a subtree that remounts later gets its original ids back; production pages are unaffected.

## Motion projects (`e2e/theme/motion/`)

Besides the screenshot projects, `playwright.theme.config.ts` has three projects per mode of the theme (desktop, no screenshots, so no baselines), made for ADR 0005, section 10:

- `<mode>-reduced`: `reducedMotion: 'reduce'` with every native API on. Each page (home, blog, article, about, the `/showcase` and `/es/muestra` section pages, the specimen) must have an empty `document.getAnimations()` after load and after scrolling top to bottom, and it stays empty while the theme switch, the search palette, the menu sheet (390 px) and the account menu open and close.
- `<mode>-apis-off-chromium` and `<mode>-apis-off-firefox`: motion allowed, with scroll and view timelines, view transitions, anchor positioning and `@starting-style` gone. Every page must show its content complete (no element at `opacity: 0`, no `.myc-reveal` or `.myc-guide-card` with a transform or animation left, no horizontal overflow, one `h1` except on the specimen), with no console or page errors. The theme switch, the palette, the sheet and the account menu work with the keyboard; the account menu panel is `position: fixed` below its toggle, inside the viewport.

**What is really disabled.** Chromium has no flag for a stable feature (`--disable-blink-features` and `--disable-features` with `ScrollTimeline`, `ViewTransition`, `CSSAnchorPositioning` or `HTMLPopoverAttribute` change nothing in Chromium 153), so `e2e/theme/motion/support.ts` makes the page see a browser without them: the CSS property and at-rule names are renamed in stylesheets, `<style>` blocks and `style` attributes (`@supports` becomes false and the declarations are dropped), `document.startViewTransition`, `ScrollTimeline` and `ViewTimeline` are deleted and `CSS.supports` answers false for them. Firefox adds the real absence: it has no scroll-driven animations (`layout.css.scroll-driven-animations.enabled`, off) and `dom.viewTransitions.enabled` is set to false. Anchor positioning and the Popover API cannot be switched off in any engine, so the popover's behaviour without them is not covered (the panel's fixed-position fallback is, through the renamed CSS).

When cross-document view transitions (`@view-transition`, #398) land, the renaming already drops that at-rule; add an assertion there if a transition name becomes a requirement.

```bash
THEME_APP_PORT=5851 THEME_MOCK_PORT=4851 E2E_BUILD=1 npx playwright test -c playwright.theme.config.ts e2e/theme/motion   # needs a MICELIO_SPECIMEN=1 build; Firefox installed
```

`THEME_APP_PORT` and `THEME_MOCK_PORT` (defaults 3211 and 4311) are for running beside other servers. The screenshot projects skip `motion/`, and the motion projects skip the other specs.

The console check ignores failed image loads and the CSP report of the `onerror="this.setAttribute('data-error', 1)"` handler of images (the CSP forbids inline handlers, so the fallback attribute is never set when an image fails). That is not a motion matter; it is a finding for the images component.

Baselines are committed in `e2e/theme/__screenshots__/<theme>/<mode>/<viewport>/`. They are rendered in the Playwright image of the CI (`mcr.microsoft.com/playwright:v<version>-noble`, the version of `@playwright/test` in `package-lock.json`); images made on another OS differ in text rendering, so **do not commit locally rendered PNGs**. A missing baseline fails the run (also in CI).

## Create or update the baselines

1. Push the branch. If the `Theme Quality` job fails (new theme, missing or changed baselines), download the artifact `theme-snapshots-<theme>` of that run. It holds the images as rendered by the run; the failing diffs are in `theme-report-<theme>`.
2. Or start **Theme Snapshots** by hand (Actions, `workflow_dispatch`, input `ref`) to render the baselines of any branch.
3. Review the images, unzip them into `e2e/theme/__screenshots__/<theme>/` and commit. CI never commits baselines.

The `Theme Quality` check gates `deploy`, like `Performance Budgets`.

The `<mode>-reduced` motion projects keep a Playwright trace (`trace.zip`, without screenshots) of a failing test in `theme-report-<theme>`, under `test-results-theme/`. The suite has no retries on purpose, so a test that hangs leaves nothing else to diagnose it from; open the trace with `npx playwright show-trace <trace.zip>`. Passing tests keep none.

## Why the captures wait as they do

`specimen groups` captures sections of an 18,000 px page, and on a slow CPU (a shared CI runner) two consecutive captures of the same section used to differ in the home hero's photo, which was painted in one and not in the other (`Failed to take two consecutive stable screenshots`). Three things keep them stable (#463):

- `openPage` waits for `image.decode()` of every image, not only `image.complete`, which is true before an image with `decoding="async"` is decoded.
- `openPage` waits for the page to finish hydrating (`window.__micelioHydrated`, `app/plugins/hydrated.client.ts`): network idle comes earlier on a slow CPU, and a capture between hydration and the node replacement finds its element detached.
- The Chromium projects start with `--disable-checker-imaging`: while it rasterizes a capture that tall, Chromium defers the decode of large images ("checker imaging") and the capture can catch the frame before the photo is back. It does not change what is painted: the committed baselines still match.

To reproduce a flake like this, run the Playwright image of the CI with `--cpus=4` and slow the page down with `Emulation.setCPUThrottlingRate` (CDP) at 8 to 16 times: the unfixed capture failed in 12 of 12 repetitions at 12 times.

## Locally

```bash
MICELIO_SPECIMEN=1 NUXT_PUBLIC_THEME=bogota npm run build
E2E_BUILD=1 npx playwright test -c playwright.theme.config.ts e2e/theme/a11y.spec.ts   # OS independent
```

Run `visual.spec.ts` locally only to check that it works (`npm run test:theme:update` writes into the repo: discard the images). The same specs run with another theme through `NUXT_PUBLIC_THEME` and the build of that theme.
