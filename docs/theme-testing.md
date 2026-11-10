# Theme visual regression and axe

`npm run test:theme` (`playwright.theme.config.ts`, specs in `e2e/theme/`) checks the **active theme** (`NUXT_PUBLIC_THEME`, default `bogota`, which `npm run theme:pull` installs from the lock; `starter` is in the repository) against a production build with the specimen page (`MICELIO_SPECIMEN=1`) and the mock Strapi. There is one Playwright project per mode of the theme's `theme.json` and per viewport (1280 and 390 px), named `<mode>-<viewport>`; each project stores the mode in `localStorage` (`micelio-theme`) before the first load.

- `visual.spec.ts`: home, blog, an article, about (full page) and each `.myc-specimen-group[data-section]` group of `/_theme` (the page sections of #244 are one group per section, `page-<kind>`, with every variant) (one image per group; the `regions` group also holds the variants of every region the theme does not use, which only the specimen build registers). Dates (`time`) and the footer year are masked; images from outside the server are replaced by a fixed pixel; animations and motion are off; the run waits for fonts and the Mermaid diagrams. `maxDiffPixelRatio` is 0.001: text renders identically in the same Docker image, the margin only absorbs sub-pixel noise between CPUs. No retries: a screenshot that needs one is a bug.
- `a11y.spec.ts`: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`, which adds `target-size`) on the same pages, modes and viewports. Violations fail; nothing is excluded. Axe finds only part of the problems, so admission also needs the manual check of [`docs/themes/accessibility-checklist.md`](themes/accessibility-checklist.md), which says when it is repeated and where its result is recorded.
- `notice-room.spec.ts`: with the privacy notice shown (first visit), scrolled to the end at 800 and 1280 px, no text, link or control of any `footer` sits under the notice, because `body` and `html` reserve `--myc-notice-h` (set only while the notice shows) at every width; dismissed, `body` `padding-bottom` and `html` `scroll-padding-bottom` are `0px` on desktop. Home, blog, an article and about, every mode, desktop projects only (the phone layout is in `e2e/mobile-nav.spec.ts`).
- `focus-order.spec.ts`: Tab through home and the specimen with the page scrolled (so the Back to top button shows) and the privacy notice shown, and read the order as a page is read: rows from the top and, inside a row, from the left. A stop below the previous one starts a new row band; a stop above it passes only if it starts to the right and overlaps the band, or sits in a block beside the previous stop's (`arePeers` in `e2e/fixtures/focus.ts`: blocks under the same ancestor that share rows of the page, such as the footer's link columns, the cards of a row, the fediverse guide beside its form or the subscribe form beside its code sample, or the items of a CSS multi-column container such as the FAQ). **The limit:** side by side blocks are read as independent columns, one after the other, so the spec cannot say which of two such columns should come first; it does catch a stop that jumps up out of its row to a block that is not beside it. The skip links and the sticky header come first and the fixed layers (the Back to top button, the privacy notice, the tab bar) last. Desktop and mobile projects (WCAG 2.4.3).
- `focus-not-obscured.spec.ts`: no stop of the page is hidden under the fixed layers (the tab bar on mobile, the privacy notice) and none under the Back to top button, notice shown and dismissed. Besides where the scroll leaves each stop, it scrolls each stop in the button's columns under the button and checks again, because a stop already in view takes focus without the browser moving it (WCAG 2.4.11). The button folds away (`scale: 0`) while the keyboard focus is on anything else (`layout/back-to-top.css`), so it never covers the focused element; it stays in the tab order.
- `card.spec.ts`: the social card the server draws for a draft (`/api/preview/<type>/<id>/card`,
  [`api.md`](api.md), "Social card of a draft"), compared with one baseline per theme, `card.png` in
  the first mode's `desktop` folder, since the card has no viewport and shows only the theme's
  default mode.
  The site runs with the preview on (`previewCards` in `e2e/servers.ts`, an admin origin nothing
  serves) and the spec sets the grant cookie itself.
  It needs no browser, only the build and the mock Strapi; the PNG is drawn by libvips from the
  theme's own font file, and `toMatchSnapshot` allows 0.1% of the pixels, as the screenshots do.
  A theme that declares no font file cannot draw a card: the spec then expects the `500`
  (`internalError`) and takes no baseline.
  The render step of admission and `theme-snapshots.yml` run it next to `visual.spec.ts`, so the
  baselines of a theme come from the same artifact.

`a11y.spec.ts` also asserts that every id of `/_theme` is unique. The variants the theme does not use repeat the ids of the active ones (`latest-title`, `references`, heading ids), so `SpecimenRegions.vue` renames them in the browser (`-copy<N>`, plus `for`, `form`, `headers`, `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, `aria-activedescendant`, `aria-details`, `aria-errormessage` and `href="#…"` inside the same frame). It runs after hydration, so the server HTML still has the duplicates, and a subtree that remounts later gets its original ids back; production pages are unaffected.

The specimen shows a whole region inside each `.myc-specimen-frame`, so its copies bring their own `h1` and their search and menu buttons. `modules/theme/specimen/page.vue` adjusts them when it mounts (client side, like the id renames; the server HTML keeps them): an `h1` inside a frame gets `aria-level="4"`, so the specimen has one level-1 heading, and the buttons with `aria-haspopup="dialog"` get `inert`, since a copy has nothing to open. `core-a11y.spec.ts` asserts both, besides the axe run of the Spanish article (its citation and back links are named by their visible text) and the focus indicator of the `log` and `row` post-list variants: pixels that change by 3:1 or more around the row when the keyboard focuses its link, in normal and forced colors.

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

Baselines are committed in `e2e/theme/__screenshots__/<theme>/<mode>/<viewport>/`. They are rendered in the Playwright image of the CI (`mcr.microsoft.com/playwright:v<version>-noble`, the version of `@playwright/test` in `package-lock.json`, pinned by digest once per run by `scripts/ci/playwright-image.sh`); images made on another OS differ in text rendering, so **do not commit locally rendered PNGs**. A missing baseline fails the run (also in CI).

## Create or update the baselines

The core runs these specs in no pipeline of its own: the theme repository admits each theme it publishes with `theme-admission.yml` (`micelio-themes` for the official ones, [publishing-a-theme.md](themes/publishing-a-theme.md)), and the baselines of a theme live there, in `<theme-dir>/__screenshots__` or the folder its workflow names. The core keeps only the starter's, in `e2e/theme/__screenshots__/starter/`, for a local run of the starter.

1. In a theme repository, push the branch. If the admission's quality check fails (new theme, missing or changed baselines), download the artifact `theme-snapshots-<theme>` of that run. It holds the images as rendered by the run; the failing diffs are in `theme-report-<theme>`.
2. Or start **Theme Snapshots** by hand (the `theme-snapshots.yml` workflow, `workflow_dispatch`, input `ref`) on a branch of the core to render the baselines of the themes installed there; a theme repository calls the same workflow ([publishing-a-theme.md](themes/publishing-a-theme.md), section 6).
3. Review the images, unzip them into the theme's baseline folder and commit. CI never commits baselines.

The `<mode>-reduced` motion projects keep a Playwright trace (`trace.zip`, without screenshots) of a failing test in `theme-report-<theme>`, under `test-results-theme/`. The suite has no retries on purpose, so a test that hangs leaves nothing else to diagnose it from; open the trace with `npx playwright show-trace <trace.zip>`. Passing tests keep none.

## Why the captures wait as they do

`specimen groups` captures sections of an 18,000 px page, and on a slow CPU (a shared CI runner) two consecutive captures of the same section used to differ in the home hero's photo, which was painted in one and not in the other (`Failed to take two consecutive stable screenshots`). Three things keep them stable (#463):

- `openPage` waits for `image.decode()` of every image, not only `image.complete`, which is true before an image with `decoding="async"` is decoded.
- `openPage` waits for the page to finish hydrating (`window.__micelioHydrated`, `app/plugins/hydrated.client.ts`): network idle comes earlier on a slow CPU, and a capture between hydration and the node replacement finds its element detached.
- The Chromium projects start with `--disable-checker-imaging`: while it rasterizes a capture that tall, Chromium defers the decode of large images ("checker imaging") and the capture can catch the frame before the photo is back. It does not change what is painted: the committed baselines still match.

To reproduce a flake like this, run the Playwright image of the CI with `--cpus=4` and slow the page down with `Emulation.setCPUThrottlingRate` (CDP) at 8 to 16 times: the unfixed capture failed in 12 of 12 repetitions at 12 times.

## In theme admission

The reusable workflow `.github/workflows/theme-admission.yml` runs the same specs for a theme from its own repository ([`docs/themes/publishing-a-theme.md`](themes/publishing-a-theme.md)). Three variables of `playwright.theme.config.ts` serve it, and work locally too:

- `THEME_SNAPSHOT_DIR`: the folder of the theme's baselines (`<mode>/<viewport>/<name>.png` inside it); default `e2e/theme/__screenshots__/<theme>`.
- `THEME_SKIP_VISUAL=1`: every spec except `visual.spec.ts` and `card.spec.ts`,
  which compare with baselines, for a run without them.
- `THEME_CARD_BASELINE=optional`: `card.spec.ts` compares with `card.png` only when the baseline
  exists, and still checks the status, the type and the size.
  Only the compat run of a core release sets it (`card-baseline-required: false`),
  because a published theme version was built before the card existed.
  A theme that has the baseline is compared, and admission of a new version still requires it.
- `THEME_REPORT_JSON`: also write Playwright's JSON report to this file; the admission report reads it. A `--reporter` on the command line replaces the configured reporters, this one included.

A data-only theme runs on a build it was not made with: the core is built with `MICELIO_SPECIMEN=1` and `test/fixtures/themes/minimal`, the theme is installed into its store (`npm run theme:admit -- install`), and the server picks it with `NUXT_PUBLIC_THEME` at runtime.

## Locally

```bash
MICELIO_SPECIMEN=1 NUXT_PUBLIC_THEME=starter npm run build
E2E_BUILD=1 npx playwright test -c playwright.theme.config.ts e2e/theme/a11y.spec.ts   # OS independent
```

Run `visual.spec.ts` locally only to check that it works (`npm run test:theme:update` writes into the repo: discard the images). The same specs run with another theme through `NUXT_PUBLIC_THEME` and the build of that theme.
