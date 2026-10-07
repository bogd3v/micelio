# Performance

Performance is a product guarantee in Micelio: every page has a budget, and CI fails when a page goes over it. This document records the baseline, the targets and how the budgets work.

## How it is measured

`scripts/perf/measure.mjs` serves a production build against the e2e Strapi mock (`e2e/mock-strapi.mjs`) and measures each page in `scripts/perf/budgets.json`:

| Metric | What it is |
| --- | --- |
| `jsKb`, `cssKb`, `htmlKb`, `fontKb` | KB the server sends (with `Accept-Encoding: br, gzip`) for the HTML and the assets it declares: the entry `<script>`, `modulepreload` links, stylesheets, preloaded fonts and the fonts those stylesheets reference. If the server does not compress, this is the raw size |
| `jsGzipKb`, `cssGzipKb`, `htmlGzipKb` | The same files gzipped by the script: what the page would weigh with compression. Reported, not budgeted |
| `thirdPartyRequests` | Requests a browser makes to origins other than the site and `firstPartyOrigins` until the network is idle |
| `lcpMs`, `tbtMs`, `cls`, `performance`, `accessibility` | Lighthouse 13, default mobile config (simulated 4G, 4x CPU slowdown), median of 3 runs |

```bash
npm run build
npm run perf                      # measure and print
npm run perf -- --check           # also exit 1 when an error budget is exceeded
npm run perf -- --out report.json # save the full report
npm run perf -- --theme <id>      # label the run with the theme the build used (--mode likewise)
```

`--serve` (included in `npm run perf`) starts the mock and the built server on ports 4310 and 3211. Pass `--base <url>` without `--serve` to measure a server that is already running. The CI job **Performance Budgets** runs `npm run perf -- --check` on every push and pull request for every installed theme and site mode (next section), and writes the table to the job summary.

Sizes come from what the HTML declares, not from what a browser happens to download, because a browser measurement is not repeatable: depending on CPU speed, Nuxt's idle prefetch of linked pages and lazy chunks like Mermaid land before or after the cut. Lazy chunks are left out of the initial budget on purpose; they get their own heavy island budget (ADR 0006).

## Budgets

Each page has two groups of limits in `scripts/perf/budgets.json`:

- `error`: transferred sizes, third-party requests, CLS, LCP and the accessibility score. Going over them fails CI.
- `warn`: TBT and the performance score. They depend on the machine running Lighthouse, so going over them is reported but does not fail CI.

The first limits are the baseline plus 5 % for sizes, plus 0.02 for CLS, and the baseline accessibility score. When a change makes a page lighter, lower its limits in the same PR. Raising a limit needs a reason in the PR description.

### Per theme and site mode

The limits above apply to **every installed theme** in every site mode that has budgets (ADR 0005, section 9; ADR 0006). The `perf-matrix` job lists the installed themes (`npx jiti scripts/theme-check.ts --list`, which reads `themes/` and `MICELIO_THEME_DIRS`) and the mode of `budgets.json`; the **Performance Budgets** job then runs once per theme × mode, building with `NUXT_PUBLIC_THEME` set to that theme, and uploads `perf-report-<theme>-<mode>`. Every failure line and the job summary carry `[theme <id>, <mode> mode]`. Only `dynamic` has budgets today; `measure.mjs` fails on a `--mode` that `budgets.json` does not cover, so a new mode needs its own budgets before it joins the matrix. The `Performance Budgets` check (job `performance-gate`) aggregates the matrix and fails if any entry failed, was skipped or was cancelled; it is the one to mark as required in branch protection, and `deploy` depends on it. A theme that goes over fails CI, and the other entries still finish (`fail-fast: false`).

The same run asserts that the page does not flash (`scripts/perf/fouc.mjs`, tested in `test/foucCheck.test.ts`), as an error on every page: the theme init script is an inline script in `<head>` before the first stylesheet, and every preloaded font has a `"<family> Fallback"` `@font-face` with `size-adjust`. It lives here and not in Playwright because it needs the production build (the dev server orders `<head>` differently and ships no built CSS) and has to run for every theme, which this matrix already does. The CLS side is the existing `cls` budget.

A theme that cannot meet a limit gets a recorded exception in `budgets.json`, never a looser global limit:

```json
"themes": {
  "<id>": {
    "reason": "Variable serif with italics: 190 KB of fonts",
    "limits": { "home": { "error": { "fontKb": 200 } } }
  }
}
```

`limits` has the shape of the top-level `limits`; each metric listed replaces the global one for that theme only, and the job summary prints the `reason`. Add the exception in the PR that adds the theme, with the same justification the PR description needs for raising a limit. The static checks of `npm run theme:check` (theme CSS gzip, font families and weight) have their own limits in `modules/theme/check.ts`. Bogotá has no exception here: its 143.6 KB of fonts fit the global `fontKb` of 150.8, which is the same limit `theme:check` records as its font exception.

### With the heaviest display font

A site can pick one of five curated display fonts in Strapi (ADR 0005, sections 8 and 9; `app/assets/fonts/display/`, served at `/fonts/display/`). The **Performance Budgets** job therefore runs `measure.mjs` twice per theme on the same build: once as above and once with `--display-font heaviest`, which starts the mock Strapi with `MOCK_DISPLAY_FONT=<largest file of the folder>` so that `site-setting.theme.displayFont` names it. In that run the `fontKb` limit is the theme's plus `displayFont.extraFontKb` (60) from `budgets.json`, and the run fails if the font is not in the page (a theme whose own display font is the heaviest one emits nothing, and is exempt). The report is `perf-report-display-font.json`; failure lines and the summary carry `display font <id>`. `npm run perf -- --check --theme bogota --display-font heaviest` reproduces it locally (`--display-font <id>` picks another).

The scroll reveal (`.bd-reveal`) animates `transform` only: with opacity, content at the fold on load was rendered mid-fade and axe read its text at contrast 1.29 (home accessibility 97 with any display font). It runs only under `prefers-reduced-motion: no-preference` and `@supports (animation-timeline: view())`.

Each font is at most 60 KB, subset to latin and `wght` only (`scripts/perf/subset-display-fonts.py`), and has size-adjusted fallback faces generated by `scripts/perf/font-fallbacks.py --display` (`app/assets/fonts/display-fallbacks.css`); `test/displayFonts.test.ts` enforces the size and the license text.

### LCP and TBT on GitHub runners

LCP became blocking on 2026-10-03, once its variance on the runners was known. These are 17 runs of the **Performance Budgets** job, grouped by identical code (a PR's head and its merge commit share a tree, and so do docs-only commits). The table gives the largest spread between runs of the same code:

| Page | LCP spread | TBT range in one group | Performance spread |
| --- | ---: | ---: | ---: |
| `/` | 172 ms (3 %) | 104–218 ms | 4 |
| `/blog` | 339 ms (8 %) | 35–139 ms | 4 |
| article | 527 ms (13 %) | 258–839 ms | 17 |
| `/about` | 312 ms (6 %) | 19–85 ms | 4 |
| `/privacy` | 448 ms (12 %) | 46–170 ms | 5 |

- **LCP** is simulated (Lantern), so it follows what the page downloads more than the machine's speed. Its limit is the highest LCP seen with the current code plus 15 %, rounded up to 50 ms.
- **TBT** doubles or halves from one run to the next on the same code, and the performance score moves with it. They stay as warnings. A median of more runs (`--runs`) would narrow them, at about a minute of CI time per extra run.

## Baseline (2026-10-03)

Dynamic mode, production build of `main` at `9aa9c3f`, against the e2e mock:

| Page | JS sent | JS gzip | CSS sent | HTML sent | Fonts | LCP | TBT | CLS | Perf | A11y |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 518.4 KB | 190.3 KB | 153.2 KB | 108.5 KB | 143.6 KB | 8.0 s | 182 ms | 0 | 58 | 100 |
| `/blog` | 503.3 KB | 184.4 KB | 153.2 KB | 76.6 KB | 143.6 KB | 5.8 s | 100 ms | 0 | 66 | 99 |
| `/blog/linux-server-hardening-guide` | 757.1 KB | 272.3 KB | 153.4 KB | 77.1 KB | 143.6 KB | 6.7 s | 757 ms | 0 | 43 | 95 |
| `/about` | 716.6 KB | 257.8 KB | 153.4 KB | 90.4 KB | 143.6 KB | 9.3 s | 97 ms | 0 | 58 | 100 |
| `/privacy` | 475.2 KB | 172.7 KB | 153.2 KB | 67.8 KB | 143.6 KB | 6.1 s | 99 ms | 0 | 64 | 100 |

### Findings

1. **Nothing is compressed.** The Nitro server sends JS, CSS and HTML raw, and so does production: `https://bogdev.com.co/_nuxt/*.js` answers without `content-encoding` even with `Accept-Encoding: br, gzip`. Compression alone would cut the transferred JS by about 63 % and is the main reason LCP sits between 6 and 9 s. Assets are fixed (see History); HTML still needs compression at the proxy.
2. **Mermaid loads with the article.** On top of its 757 KB of initial JS, the article with diagrams downloads about 2.7 MB of Mermaid chunks while it loads. They are not in the initial budget; Mermaid is the first heavy island to budget (ADR 0006).
3. **`@nuxt/ui` and full hydration** keep the base JS above 190 KB gzipped on every page.
4. **Accessibility:** on `/blog` the card titles are `<h3>` with no `<h2>` before them (`heading-order`). On the article, the only failure is an `<img src="x">` without `alt` that comes from the mock content.

## History

| Date | Change | Effect on the home page |
| --- | --- | --- |
| 2026-10-03 | Baseline (#251) | 518.4 KB JS and 153.2 KB CSS sent, LCP 8.0 s, performance 58 |
| 2026-10-03 | Precompressed public assets: Nitro `compressPublicAssets` writes `.br` and `.gz` next to every asset at build time and serves the one the browser accepts, with `Vary: Accept-Encoding` | 171.4 KB JS (−67 %) and 22.5 KB CSS (−85 %) sent, LCP 5.1 s, performance 73. On `/privacy`, LCP 6.1 → 3.3 s and performance 64 → 88 |
| 2026-10-03 | `qs` out of the client bundle: `useStrapi` builds its flat query strings with `URLSearchParams` (`app/helpers/query.ts`) | 160.2 KB JS sent (−11.2 KB on every page; −12.2 KB gzipped) |
| 2026-10-03 | Markdown rendered on the server: `/api/posts/:slug`, `/api/about` and `/api/drafts/:documentId` return each text block's sanitized `html` (`app/helpers/markdown.ts`), so `marked`, `sanitize-html`, `postcss`, `htmlparser2` and `entities` leave the client. Rolldown's `chunkOptimization.mergeCommonChunks` is off: with those CommonJS packages gone, merging moved its runtime helpers into the chunk with Mermaid's d3 and `dayjs`, which the icon chunk on every page imports (+14 KB on the home page) | Home 159.5 KB JS sent (no change); article 233.3 → 171.2 KB (−27 %) and about 220.3 → 157.3 KB (−29 %). The article HTML grows 1.6 KB raw because the payload carries `html` |
| 2026-10-03 | i18n messages precompiled: `modules/precompile-messages.ts` hands @nuxtjs/i18n the locale files compiled to vue-i18n's message AST in the Nitro build, and `bundle.dropMessageCompiler` drops `@intlify/message-compiler` from the client. Nitro imports the locale JSON raw and serves it to the client (`/_i18n/<hash>/<locale>/messages.json`), which is why the client needed the compiler; `experimental.optimizeMessageBundling` is off so the plugin sees those imports. Server code that imports a locale file directly (`server/utils/feed.ts`, `server/utils/markdown.ts`) still gets the raw JSON. `messages.json` grows from 33.2 to 52.7 KB raw for English, but only from 10.0 to 10.5 KB gzipped | 159.5 → 155.5 KB JS sent (−4.0 KB on every page; −4.4 KB gzipped) |
| 2026-10-03 | `/blog` heading order: a visually hidden `<h2>` ("Articles") before the card grid, whose titles are `<h3>`. The log view already had an `<h2>` per month | `/blog` accessibility 99 → 100, and its budget goes up to 100. No size changes |
| 2026-10-03 | Font fallbacks sized to the web fonts: `themes/bogota/font-fallbacks.css` declares `"Archivo Fallback"` (Arial) and `"JetBrains Mono Fallback"` (Courier New) with `size-adjust` and ascent/descent overrides, generated by `scripts/perf/font-fallbacks.py`. Archivo gets one face per weight range (sized at wght 300, 400, 500, 600 and 700) and per width (100 %, 112 % and 125 %): its default instance is wght 600, and the `.bd-wide` titles (`font-stretch: 125%`) are far wider than Arial, so a single `size-adjust` left them on one line until the swap | Lighthouse already reported CLS 0 (the preloaded fonts land before the first paint). With the fonts delayed by 2.5 s, the swap shift drops to ≤ 0.002 on every page (before: `/privacy` 0.052, `/about` 0.037 on mobile; the article 0.017 on desktop). CSS +0.5 KB |
| 2026-10-03 | LCP budgets block CI (see "LCP and TBT on GitHub runners"). Lazy hydration (`hydrate-on-visible`) was tried and dropped: Nuxt 4.5 still `modulepreload`s the components, and the async chunks added 4–10 KB of JS per page | No change in what pages send. LCP limits now 5950 ms (home), 4700 (blog), 5200 (article), 6600 (about), 4350 (privacy) |
| 2026-10-04 | Utility classes out of the templates (#262, first step): slider, quote, skip links, back to top, error and confirm pages move to `bd-*` classes in their layers, and the six `<UIcon>` become inline SVG components, so `@nuxt/icon`'s client component leaves every page (the back-to-top button in the layout was the only `<UIcon>` there). `npm run lint` fails on a class that is not `bd-*` or a core helper. Tailwind itself is still installed | JS sent −5.2 KB on the home page (156.6 → 151.4) and −5.3 to −5.9 KB elsewhere; CSS 22.9–23.2 → 21.9 KB. Budgets lowered to the new values + 5 % |
| 2026-10-04 | Tailwind, `@tailwindcss/typography` and `@nuxt/ui` removed (#262, step 2); reset and element defaults in `bd.reset` below role-valued classes in `bd.settings`; Lightning CSS transformer with explicit browser targets (chrome 111, edge 111, firefox 114, safari 16.4, ios 16.4). Entry CSS: 154,527 raw → 132,438 raw (−13 %), 26,198 gzip → 22,748 gzip (−13 %). Home JS sent 151.4 → 139.7 KB, CSS 21.9 → 19.0 KB (gzip 25.9 → 22.5 KB). Budgets: CSS 23.0 → 19.9 KB; JS (home / blog / article / about / privacy): 159.0 / 154.2 / 170.6 / 155.9 / 142.5 → 146.7 / 142.1 / 158.6 / 143.8 / 130.4 KB |
| 2026-10-06 | Budgets per installed theme × site mode (#238): `perf-matrix` job lists themes, the performance job is a matrix, `measure.mjs` takes `--theme` and `--mode` and labels failures, `budgets.json` accepts `themes.<id>` exceptions (none recorded), and every page is checked for FOUC (init script before stylesheets, size-adjusted fallbacks for preloaded fonts) | No change in what pages send; the existing limits apply to Bogotá unchanged |
| 2026-10-06 | Second variants of the header (`centered`) and the footer (`minimal`) with the specimen alternates (#263, PR 1): variant CSS scoped by `data-layout` with `:where()` (specificity unchanged), `bar.css` and `columns.css` included. A build without `MICELIO_SPECIMEN` has neither `RegionHeaderCentered`, `RegionFooterMinimal` nor their CSS. Bogotá, all `_nuxt` CSS: 140,432 → 144,553 raw (+4,121), 24,216 → 24,379 gzip (+163); entry CSS 140,260 → 144,381 raw, 24,106 → 24,269 gzip, all of it from scoping the existing two files. All `_nuxt` JS: 5,674,775 → 5,674,807 raw, 1,677,490 → 1,677,504 gzip (+14). Computed styles of home, blog, an article and about at 375 / 800 / 1280 in noche and dia: only running animations differ | CSS sent 19.9 → 20.1 KB on every Bogotá page (CI); the new variants add 0 bytes to a theme that does not use them. Budget: CSS 19.9 → 21.1 KB (the new measurement plus 5 %), since the scoping cost was accepted in #263 |
| 2026-10-06 | Second variants of the home (`index`), the post list (`list`) and the article (`centered`) (#263, PR 2): `showcase.css`, `grid.css` and `aside.css` re-scoped by `data-layout` with `:where()`; the aside-only `.bd-article-share` rules moved from `pages/article/after.css` into `aside.css`. A build without `MICELIO_SPECIMEN` has neither `RegionHomeIndex`, `RegionPostListList`, `RegionArticleCentered` nor their selectors. Bogotá, all `_nuxt` CSS: 144,586 → 145,906 raw (+1,320), 24,508 → 24,596 gzip (+88); all `_nuxt` JS: 5,675,064 → 5,675,457 raw, 1,683,111 → 1,683,300 gzip (+189, `useArticleState` and `usePostStats`). `npm run perf` per page: CSS 20.1 KB (budget 21.1 KB). Computed styles of home, blog, an article and about at 375 / 800 / 1280 in noche and dia: only running animations differ | CSS +0.09 KB gzip on every Bogotá page; the new variants add 0 bytes to a theme that does not use them |
| 2026-10-06 | Curated display fonts (#239, PR 3): five latin `wght`-only files of at most 60 KB in `app/assets/fonts/display/` (Archivo 36.5 KB, Fraunces 35.6, Bricolage Grotesque 46.1, Newsreader 57.8, Space Grotesk 26.6, from a pinned google/fonts commit with recorded hashes, `app/assets/fonts/display-sources.json`), emitted only when Strapi picks one that the theme does not already use (`@font-face`, size-adjusted fallback faces, `--font-display`, preload in `<style id="theme-overrides">`). The job runs each theme a second time with the heaviest font (Newsreader) at theme limit + 60 KB. The theme's font preloads are rendered per request (`server/plugins/themeMode.ts`, same place in the head) so that an emitted display font leaves out the theme's own display file, which the client head used to add back on hydration; a starter page with Newsreader downloads 59.2 KB of fonts, not 95.8 KB. `fontKb` still counts every font a stylesheet references, so the unused Fraunces face stays in it. Local runs on a production build (median of 3): Bogotá without the font 143.6 KB, with it 201.4 KB (limit 210.8), LCP home/blog/article/about/privacy 4923/3320/3621/5121/3322 ms → 5362/4518/4594/5870/4148 ms (limits 5950/4700/5200/6600/4350), CLS 0 in both, accessibility 100 in both; starter 35.8 → 93.6 KB, LCP 2860/2622/2893/2775/2467 → 3098/3126/3022/3346/3031 ms, CLS 0. `/fonts/display/` is cached for a year (immutable, the URL carries `?v=<hash>`) | No change without a font (HTML identical on 5 pages, CSP identical but for script hashes). The home's accessibility was 97 in the font run until the reveal stopped animating opacity (below) |

The HTML is rendered per request, so Nitro does not compress it (108.5 KB on the home page here). In production Traefik compresses it, together with Strapi's JSON (bogd3v/bogdev-infra#10): the home page HTML goes from 141.8 KB to 27.7 KB with brotli. This measurement serves the Nitro build directly, so it still reports the uncompressed HTML.

## Targets

From the Micelio spec. The budgets move towards them PR by PR:

| Metric | Landing / static | Dynamic blog |
| --- | --- | --- |
| Initial JS (gzip) | ≤ 15 KB | ≤ 60 KB |
| CSS (gzip) | ≤ 20 KB | ≤ 25 KB |
| HTML (gzip) | ≤ 30 KB | ≤ 30 KB |
| Fonts | ≤ 2 variable families, subset, ≤ 100 KB | same |
| LCP | ≤ 1.5 s | ≤ 2.0 s |
| CLS | 0 | ≤ 0.02 |
| INP (TBT in the lab) | ≤ 100 ms | ≤ 150 ms |
| Lighthouse performance / accessibility | 100 / 100 | ≥ 95 / 100 |
| Third-party requests | 0 | 0 |
