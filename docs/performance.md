# Performance

Performance is a product guarantee in Micelio: every page has a budget, and CI fails when a page goes over it. This document records the baseline, the targets and how the budgets work.

## How it is measured

`scripts/perf/measure.mjs` serves a production build against the e2e Strapi mock (`e2e/mock-strapi.mjs`) and measures each page in `scripts/perf/budgets.json`:

| Metric | What it is |
| --- | --- |
| `jsKb`, `cssKb`, `htmlKb`, `fontKb` | KB the server sends (with `Accept-Encoding: br, gzip`) for the HTML and the assets it declares: the entry `<script>`, `modulepreload` links, stylesheets, preloaded fonts and the fonts those stylesheets reference. If the server does not compress, this is the raw size |
| `jsGzipKb`, `cssGzipKb`, `htmlGzipKb` | The same files gzipped by the script: what the page would weigh with compression. Reported, not budgeted |
| `thirdPartyRequests` | Requests a browser makes to origins other than the site and `firstPartyOrigins` until the network is idle |
| `strayRequests` | Requests, in every mode, that only an island in use may make (ADR 0006, section 6): any file of `/_islands/` the HTML does not declare before the `load` event (a `visible` island may load after it; a heavy island's entry is never declared, see "Islands"), and in static and landing builds any Pagefind file or undeclared script until the network is idle. Limit 0 |
| `lcpMs`, `tbtMs`, `cls`, `performance`, `accessibility` | Lighthouse 13, default mobile config (simulated 4G, 4x CPU slowdown), median of 3 runs |

```bash
npm run build
npm run perf                      # measure and print
npm run perf -- --check           # also exit 1 when an error budget is exceeded
npm run perf -- --out report.json # save the full report
npm run perf -- --theme <id>      # label the run with the theme the build used (--mode likewise)
```

`--serve` (included in `npm run perf`) starts the mock and the built server on ports 4310 and 3211 (`PERF_MOCK_PORT`, `PERF_SERVER_PORT` and `PERF_DEBUG_PORT` change them when another run uses them). Pass `--base <url>` without `--serve` to measure a server that is already running. The CI job **Performance Budgets** runs `npm run perf -- --check` on every push and pull request for every installed theme and site mode (next section), and writes the table to the job summary.

### Measuring a real site

`--base <url>` without `--serve` measures any running site, but the budgeted pages are the mock site's. Two options adapt the run to another site:

```bash
npm run perf -- --mode landing --base http://localhost:3000 \
  --pages home,about,article=/posts/composting --search-query compost
```

`--pages` takes a comma-separated list: `name` measures that budgeted page at its path, `name=/path` points it (or a new name, without limits) at another path. `--search-query` is what the search island types; it needs a result on that site (default `vue`, the mock's).

### Landing

`modes.landing` has the pages of the demo's seeded showcase (`/` and `/es`), the static limits for JS, fonts and Lighthouse, an LCP error limit of 1550 ms (the target stays 1.5 s; the simulation lands on 1.35 or 1.50 s from run to run, as on Bogotá's text pages), and its own `htmlKb` (16.9 and 17.2) and `cssKb` (22.6), measured on that page plus 5 % (#363). The showcase is larger than the mock's home, so the static HTML limits do not fit it (the CSS limit matches static; measured 21.5 KB sent). It is not in CI: the mock site has no showcase, so run it against the demo with `--base` (see above). The `bogota` exception covers `static` and `landing`.

### Static builds

`--mode static` (`landing` has its own section, see "Landing" below) measures a `nuxt generate` output instead of the Nitro server. With `--serve` the script generates the site itself (`scripts/lib/static-generate.mjs`, the same code as `npm run test:static`) against the mock Strapi, which only lives while it generates, and serves `.output/public` with `scripts/static-serve.mjs` (`_headers` applied, `COMPRESS=1` so text is sent in brotli like a CDN does). It overwrites `.output`, so run `npm run build` again before a dynamic run.

```bash
npm run perf -- --mode static --check --theme starter   # generates, serves, measures
npm run perf -- --mode static --skip-generate           # reuse .output/public
NUXT_PUBLIC_THEME=starter npm run perf -- --mode static # the theme of the generate
```

Pages are the dynamic ones plus the Spanish home (`/es`). Two metrics only exist here:

| Metric | What it is |
| --- | --- |
| `initialJsGzKb` | Gzip KB of the declared scripts plus the inline ones (the theme init script): what runs before the first paint |
| `islands.search` | Opens the palette on the first page, types a query and measures what loads from then on: `loaderGzKb`, `pagefindGzKb` (runtime and worker, gzip), `wasmKb` (largest `wasm.<lang>.pagefind`, raw). Checked against `islands` in `budgets.json`, as errors |

`budgets.json` has one section per mode under `modes` (`pages`, `limits` and `islands`); `aliases` can map a mode to another's budgets (none today). A section with `"ci": false` stays out of the `perf-matrix` job. A theme exception names its `mode`, one or a list (every mode when it does not). A theme has at most one exception entry, so it covers one mode or all of them; limits that differ per mode need the entry without `mode` and metrics that suit both. The `e2e/static/search.spec.ts` check of the islands budget stays: it reads the files of the output and runs in `npm run test:static` without Lighthouse.

Sizes come from what the HTML declares, not from what a browser happens to download, because a browser measurement is not repeatable: depending on CPU speed, Nuxt's idle prefetch of linked pages and lazy chunks like Mermaid land before or after the cut. Lazy chunks are left out of the initial budget on purpose; they get their own heavy island budget (ADR 0006).

## Budgets

Each page has two groups of limits in `scripts/perf/budgets.json`:

- `error`: transferred sizes, third-party requests, CLS, LCP and the accessibility score. Going over them fails CI.
- `warn`: TBT and the performance score. They depend on the machine running Lighthouse, so going over them is reported but does not fail CI.

The first limits are the baseline plus 5 % for sizes, plus 0.02 for CLS, and the baseline accessibility score. When a change makes a page lighter, lower its limits in the same PR. Raising a limit needs a reason in the PR description.

### Per theme and site mode

The limits above apply to **every installed theme** in every site mode that has budgets (ADR 0005, section 9; ADR 0006). The `perf-matrix` job lists the installed themes (`npx jiti scripts/theme-check.ts --list`, which reads `themes/` and `MICELIO_THEME_DIRS`) and the modes of `budgets.json` (the ones without `"ci": false`: `dynamic` and `static`); the **Performance Budgets** job then runs once per theme × mode, building with `NUXT_PUBLIC_THEME` set to that theme, and uploads `perf-report-<theme>-<mode>`. Every failure line and the job summary carry `[theme <id>, <mode> mode]`. `dynamic`, `static` and `landing` have budgets (`landing` is not in the matrix); `measure.mjs` fails on a `--mode` that `budgets.json` does not cover, so a new mode needs its own budgets before it joins the matrix. The `Performance Budgets` check (job `performance-gate`) aggregates the matrix and fails if any entry failed, was skipped or was cancelled; it is the one to mark as required in branch protection, and `deploy` depends on it. A theme that goes over fails CI, and the other entries still finish (`fail-fast: false`).

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

`limits` has the shape of the top-level `limits`; each metric listed replaces the global one for that theme only, and the job summary prints the `reason`. Add the exception in the PR that adds the theme, with the same justification the PR description needs for raising a limit. The static checks of `npm run theme:check` (theme CSS gzip, font families and weight) have their own limits in `modules/theme/check.ts`. Bogotá's static exception is LCP only (below); its fonts (35.5 KB) fit every font limit. The global `fontKb` of 150.8 for the dynamic mode is the same ceiling `theme:check` records for fonts.

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
2. **Mermaid loaded with the article** (fixed, 2026-10-08). On top of its 757 KB of initial JS, the article with diagrams downloaded about 2.7 MB of Mermaid chunks while it loaded. Mermaid is now a heavy island (`app/islands/mermaid.ts`, ADR 0006): its chunks live in `/_islands/chunks/`, outside the Nuxt bundle, and load when a diagram nears the viewport. The `islands.mermaid` budgets below cover them.
3. **`@nuxt/ui` and full hydration** keep the base JS above 190 KB gzipped on every page.
4. **Accessibility:** on `/blog` the card titles are `<h3>` with no `<h2>` before them (`heading-order`). On the article, the only failure is an `<img src="x">` without `alt` that comes from the mock content.

### Islands

Each mode of `scripts/perf/budgets.json` can have an `islands` section (ADR 0006, section 6): the bytes an island sends once it is used, apart from the page budgets. `search` has its own metrics: `measure.mjs --mode static` enforces them on what a browser loads when the palette opens (see "Static builds"), and `e2e/static/search.spec.ts` on the files of the build (`npm run test:static`).

Every heavy island in `app/islands/heavy.ts` needs a budget, under the key its `budget` names, in at least one mode; `measure.mjs` refuses to start when an island has none or a budget has no island (`scripts/perf/islands.mjs`, tested in `test/perfIslands.test.ts`). In each mode that budgets it, the script loads the fixture page once, checks that no file of `/_islands/` loaded before the trigger and that the HTML does not declare the island's entry, fires the trigger and measures every file of `/_islands/` requested from then on (the entry, its chunks, workers and runtimes, including what a worker fetches):

```json
"islands": {
  "mermaid": {
    "page": "/blog/<an article with a diagram below the fold>",
    "ready": "micelio-mermaid svg",
    "error": { "scriptGzKb": 0, "wasmKb": 0, "totalKb": 0, "requests": 0 }
  }
}
```

| Field | What it is |
| --- | --- |
| `page` | Path of a page of the mock site that renders `<micelio-<id>>`; a `visible` island must start below the fold, or it loads before the trigger and fails |
| `control` | `interaction` only: the CSS selector clicked to start the island (default the element itself) |
| `ready` | Required: CSS selector of the island's rendered result (`micelio-mermaid svg`, a playground's filled output). The script waits for it, then for 500 ms without a request; an island that loads nothing of `/_islands/` after its trigger fails |
| `error` | Limits: `scriptGzKb` (scripts, gzip), `wasmKb` (`.wasm` as sent), `totalKb` (everything as sent, each distinct file once), `requests` (every request, so a file fetched twice counts twice). `strayRequests` is always 0 |

A heavy island's entry is not in the HTML either. A page that renders one declares it, from the registry, in a JSON script (`<script type="application/json" id="micelio-island-<id>">` with the id, trigger, Save-Data policy, features, the `control` of an interaction island, the entry's path and the island's own settings) and adds `/_islands/loader-<hash>.js` (about 1.9 KB gzip, `app/islands/loader.ts`). For a `visible` island the loader waits for `micelio-<id>` to be near the viewport after load and idle, and for hydration, then imports the entry; for an `interaction` island it shows the control once the features are there and the page has hydrated, and imports on its first press. The entry defines the element. So a page with a heavy island sends one more small script, and static pages that have one (the article with a diagram) get an LCP, JS and initial-JS limit of their own. An island's entry must not share a module with the loader: the build would put it in a chunk that the loader imports, and that chunk would load at start. `modules/islands.ts` fails the islands build when it happens (`mermaid.ts` therefore imports neither `lib/trigger.ts` nor `lib/hydrated.ts`: the loader waits for both). Islands must not import CSS.

Only same-origin files under `/_islands/` are measured, so a heavy island self-hosts its code and runtimes there (ADR 0004 limits a worker's `connect-src` to `/_islands/runtimes/`).

| Island | What loads at start | What loads when it is used | Limits (`error`) |
| --- | --- | --- | --- |
| `search` (static and landing) | `/_islands/search-<hash>.js`: 8.1 KB raw, 3.2 KB gzip (2.8 KB brotli), plus 1.5 KB of palette markup per page | On the first open of the palette: `pagefind.js` 44.5 KB raw / 12.5 KB gzip and `pagefind-worker.js` 40.3 KB / 11.6 KB (24.1 KB gzip together); one `wasm.<lang>.pagefind` of about 70 KB (already compressed); the entry and meta files (under 1 KB); then the index and fragment chunks a query needs (a few KB on the mock site, which grows with the content) | `loaderGzKb` 3.5, `pagefindGzKb` 26, `wasmKb` 80 |
| `mermaid` (every mode) | `/_islands/loader-<hash>.js` (4.5 KB raw, 1.9 KB gzip), only on pages with a diagram, plus 0.3 KB of declaration; nothing of the island itself | When the first `<micelio-mermaid>` nears the viewport (after `load` and idle): `mermaid-<hash>.js` (4.6 KB raw, 1.9 KB gzip), then 32 chunks of Mermaid and the diagram types it draws (34 requests, 665.9 KB gzip of scripts; 531.5 KB sent in brotli in dynamic, 583.6 KB in the static serve) | `scriptGzKb` 699.2, `totalKb` 558 (dynamic) and 612.8 (static), `requests` 35: the measured value plus 5 % |
| `playground` (every mode) | `/_islands/loader-<hash>.js` (shared with the other heavy islands), only on pages with runnable code, plus the declaration and about 0.9 KB of labels per block; nothing else, the Run button is shown by the loader | On the first press of Run: the entry `playground-<hash>.js` (about 5 KB raw), the Worker (`workers/playground-<hash>.js`, 1.4 KB), the SQL runtime (`runtimes/sql-<hash>.js`, 215 KB raw, 55 KB brotli) and SQLite (`runtimes/sqlite3-<hash>.wasm`, 869 KB raw, 341 KB brotli, 370 KB gzip in the static server); downloaded once per page, reused by every playground | dynamic: `scriptGzKb` 68.5, `wasmKb` 357.7, `totalKb` 417, `requests` 4. static: 68.5, 388, 451.7, 4 |

The loader counts towards the 15 KB initial JS of the static targets; the second column does not. Nothing of Pagefind is requested before the palette opens, and only the language of the page is loaded. The numbers come from the mock site (`npm run test:static`, Pagefind 1.5.2).

### Static budgets (2026-10-07)

`modes.static` of `budgets.json`, measured on the mock site (generated by this branch, Chromium with Lighthouse 13 mobile, median of 3, brotli like a CDN, no other job running):

| Theme | Page | Initial JS (gzip) | LCP | Performance | Accessibility | CSS sent | HTML sent | Fonts |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `starter` | all six | 3.6 KB | 1.20 to 1.35 s | 100 | 100 | 19.8 KB | 3.7 to 6.0 KB | 35.8 KB |
| `bogota` | `/` and `/es` | 3.6 KB | 1.73 s | 100 | 100 | 21.5 KB | 14.9 KB | 35.5 KB |
| `bogota` | `/blog` | 3.6 KB | 1.43 s | 100 | 100 | 21.5 KB | 12.3 KB | 35.5 KB |
| `bogota` | article | 3.6 KB | 1.35 s | 100 | 100 | 21.5 KB | 13.2 KB | 35.5 KB |
| `bogota` | `/about` | 3.6 KB | 1.80 s | 99 | 100 | 21.5 KB | 15.4 KB | 35.5 KB |
| `bogota` | `/privacy` | 3.6 KB | 1.35 s | 100 | 100 | 21.5 KB | 12.2 KB | 35.5 KB |

(`bogota` before #350, 2026-10-07: LCP 2.63 s home and `/es`, 2.33 about, 2.03 blog, 1.95 article and privacy, fonts 143.6 KB.)

Every page loads one script (the 3.2 KB search island) and the 0.3 KB inline theme script; TBT is 0, CLS 0 and third-party and stray requests 0. The search island sends 3.25 KB gzip at start; opening the palette loads 24.4 KB gzip of Pagefind and a 70.5 KB WASM file (8 requests), inside the `islands.search` limits. Lighthouse here is deterministic: two runs of the same build gave the same LCP within 1 ms.

- **Limits.** Global: initial JS 3.8 KB (the target is 15 KB; a second island that loads at start raises it with a reason), LCP 1.5 s, accessibility 100, fonts 100 KB, performance at least 95 (a warning below 100). `starter` meets them all.
- **The article with a diagram has limits of its own** (`limits.article` of `modes.static`, #247): it loads the heavy-island loader next to the search island, so scripts are 4.5 KB gzip (4.3 KB in brotli, the `jsKb` metric), initial JS 4.9 KB and LCP one round trip higher (Bogotá 1.65 s, starter 1.50 s). Its limits are 4.5 KB (`jsKb`), 5.0 KB (`initialJsGzKb`) and 1.55 s (Bogotá 1.7 s, in its exception). The other pages keep the global ones. The reason is the loader's extra request: a second script on the critical path puts the simulated throttling one round trip (about 150 ms) higher.
- **`bogota` meets the font target and the text pages' LCP; two pages keep an LCP exception** (`themes.bogota`, mode `static`, tracked in #350). Fonts are 35.5 KB (limit 100). Blog, article and privacy measure 1.35 or 1.43 s, and sometimes 1.503 s: the simulated throttling lands on one of two values 150 ms apart from run to run, so their limit is 1.55 s. The home and the about page lead with an image: the hero photo (19 KB at its 390 px size on phones) reaches 1.73 s, and the about mascot (a 54 KB PNG of flat art, already minimal) 1.80 s; their limits are the measured value plus 15 % (2.0 and 2.08 s). #367 found that the simulation cannot give them 1.5 s: an image-led page sits one round trip (about 150 ms) above a text page, and with the image cut to 1.6 KB the home still measures 1.58 s and the about page 1.50 s; sizes between 5 and 54 KB land on 1.65, 1.73 or 1.80 s, and a preload, `fetchpriority` and the picture of the home do not move the simulated number (they do move the real one, see History).

### Unused client JS in static output

`nuxt generate` copies the whole client build into `/_nuxt/`, but a static page loads none of it (noScripts, ADR 0006 section 3). `modules/static-routes.ts` prunes it at the end of the build (hook `nitro:build:public-assets`, because Nitro copies the public assets after the prerender), in `static` and `landing` only: every `_nuxt/*.js` that no page, stylesheet, island or Pagefind script names, directly or through another kept script (`unreachableScripts` in `app/helpers/staticBuild.ts`), is deleted with its `.br`, `.gz` and `.map`. CSS, fonts and `builds/` stay. The mock site's `.output/public` goes from 14.72 MB to 5.94 MB (`du -sb`; `_nuxt` 9.00 MB to 0.02 MB, all 163 scripts, 5.4 MB raw plus their precompressed copies).

Heavy islands (ADR 0006, section 6; Mermaid first) are built by `modules/islands.ts` into `/_islands/`, with their own chunks in `/_islands/chunks/`, so they do not depend on `/_nuxt/` and the pruning does not touch them. A script of `/_nuxt/` that an island or a page starts to load by name is kept by the same rule; the build logs how many it pruned.

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
| 2026-10-07 | Static budgets in CI (#243, PR 9): `modes.static` in `budgets.json`, `measure.mjs --mode static` generates, serves and measures the static site (initial JS from the real requests, LCP, Lighthouse, no island byte before use, the search island when the palette opens), `static` joins the Performance Budgets matrix, and unused `/_nuxt/*.js` is pruned from static output (14.72 MB to 5.94 MB) | Dynamic budgets unchanged. Static: 3.6 KB initial JS gzip on every page |
| 2026-10-07 | Bogotá fonts (#350): `archivo-latin-var.woff2` 97.9 → 25.0 KB and `jetbrains-mono-latin-var.woff2` 49.0 → 10.5 KB (143.6 → 35.5 KB in the page), regenerated by `scripts/perf/subset-theme-fonts.py` from the full fonts it replaced, pinned as git blobs (`scripts/perf/bogota-font-sources.json`): only the glyphs English and Spanish need (ASCII, accents, ñ, ü, ¡ ¿, ª º °, punctuation, arrows), Archivo `wght` 300 to 600 and `wdth` 100 to 125 (`wdth` 62 to 100 and `wght` 100 to 300 were never used), JetBrains Mono `wght` 400 to 700, only the layout features the CSS reaches (`kern`, `liga`, `tnum`, `rvrn`). JetBrains Mono is no longer preloaded (`preload: false`). `font-fallbacks.css` regenerated (metrics move by 0.01 %); the first attempt used the upstream google/fonts TTFs, whose outlines and JetBrains Mono version (2.211, not 2.304) differ from the files the site served: small text came out bolder and wider on CI, so the subset now starts from the old woff2 and keeps its `prep` and `gasp` tables (outlines at 300 to 600 differ by at most 1 font unit). The home's compact hero photo is served at 1x (390 w, 19 KB, was 780 w, 91 KB on a 1.75 DPR phone) and with `fetchpriority=high` | Static, bogota, median of 3: LCP home/es 2.63 → 1.73 s, about 2.33 → 1.80, blog 2.03 → 1.43, article 1.95 → 1.35 (1.50 in a third of the runs), privacy 1.95 → 1.35; performance 98-99 → 99-100; fonts 143.6 → 35.5 KB; starter unchanged (1.35 to 1.43 s on this machine). Dynamic, bogota: LCP 4923/3320/3621/5121/3322 → 4292/2857/3546/3510/2614 ms (home/blog/article/about/privacy), with the heaviest display font 4616/3558/4284/4260/3217. **Visual changes:** characters outside the set and JetBrains Mono's code ligatures (`calt`) are gone, Archivo stops at weight 600 (the 404 code and `<strong>` outside `.bd-prose` were 700), and the home photo is softer on 2x and 3x phones. The `themes.bogota` exception shrinks to LCP on the home, the about page (images) and 3 % over the target on the text pages |
| 2026-10-07 | Bogotá's LCP images (#367): the home hero is two `<picture>` per copy (`auto` follows `prefers-color-scheme`, `alt` is the other photo, lazy and shown only when the stored mode differs from the system scheme, through `data-scheme`), whose `<source media>` also select the breakpoint, so the visible photo is `fetchpriority=high` and eager and the three others fetch nothing; same files (webp, q 80). The about mascot is unchanged: AVIF/WebP of flat art are no smaller than its PNG (586 px: PNG 50.6 KB, lossless WebP 51.8, AVIF q 80 100.9; 330 px: 31.5, 94.7, 46.5), and a preload changed nothing | Static, bogota, median of 3: LCP unchanged (home/es 1.73 s, about 1.80), so the exception stays. Simulated floors, tried by replacing the image on a built site: home 1.58 s with a 1.6 KB photo, 1.66 with 4.6 KB, 1.73 with 9.7 and 19 KB; about 1.50 s with a 1.6 KB mascot, 1.80 with 24 and 54 KB; dropping the font preload moved the about page from 1.80 to 1.66 s. Real throttled Chromium (150 ms RTT, 1.6 Mbps, 4x CPU, 412 px at 1.75 DPR, median of 5): home LCP 1096 → 924 ms in a light system, 1044 → 868 dark; with a stored mode that differs from the system scheme 1050 → 1164 ms and one extra photo downloaded. **Visual changes:** none (same encoded files; `<picture>` is `display: contents`) |
| 2026-10-08 | Landing budget against the demo (#244, PR 9): `compose.landing.yml` with a builder image of `main` (5335e9b), measured with `measure.mjs --mode landing --base http://localhost:3000 --search-query compost`, then regenerated with `NUXT_PUBLIC_THEME=starter` and measured again (the content untouched). `modes.landing` LCP error limit 1500 → 1550 ms. Found and fixed in #372: the builder's `serve` kept the old brotli HTML and `_headers` after a regeneration | Bogota: home/es initial JS 3.6 KB gzip, CSS 21.8 KB, HTML 16.5/16.7 KB, fonts 35.5 KB, CLS 0, TBT 0, performance 100, accessibility 100, LCP 1655/1653 ms (bogota exception, #367). Starter: initial JS 3.6 KB, CSS 20 KB, HTML 6.9/7.1 KB, fonts 35.8 KB, CLS 0, TBT 0, performance 100, accessibility 100, LCP 1505/1503 ms. Search island on both: loader 3.25 KB, Pagefind 24.39 KB gzip, wasm 70.52 KB |
| 2026-10-08 | Heavy-island budgets (#247, PR 2): `strayRequests` in every mode (dynamic pages get a limit of 0) and counted only before the `load` event for `/_islands/`, so a `visible` island can load after it; `budgets.json` `islands` in any mode, validated against the heavy registry; `measure.mjs` measures each heavy island on its fixture page (`scripts/perf/islands.mjs`). The registry is empty until Mermaid (PR 3) | No budget changed. Dynamic and static bogota: `strayRequests` 0 on every page; search island unchanged (3.25 / 24.39 / 70.52) |
| 2026-10-08 | Mermaid as a heavy island (#247, PR 3): `<micelio-mermaid>` (`app/islands/mermaid.ts`) replaces the `useMermaid` composable; Mermaid and its chunks leave the Nuxt bundle and load from `/_islands/chunks/` when a diagram nears the viewport, in every mode. A small loader (`app/islands/loader.ts`) imports the entry, so no byte of the island is in the HTML or the initial requests; the islands build gives each importer its own copy of Vite's preload helper (`modules/islands.ts`), or the entry would import a shared chunk at start. `islands.mermaid` budgets in dynamic and static, on the mock article `linux-server-hardening-guide` (the first diagram is below the fold of a 412 x 823 viewport). Dynamic `jsKb` limits: home 146.7 to 146.8 and article 158.6 to 158.9, because CI measures the home page at 146.8 and a local run on top of the branch measured the article at 158.8 (about 0.1 KB more in the entry; the theme's `mermaid` overrides are in a module of their own so the theme data stays out of it). Static article limits: `jsKb` 3.3 to 4.5, `initialJsGzKb` 3.8 to 5.0, LCP 1.5 to 1.55 s (Bogotá 1.7 s) for the loader's extra request | Dynamic article: declared JS 157.4 KB (limit 158.6, unchanged), and no Mermaid byte until the diagram is near (before: about 2.7 MB of chunks with the article). Static article: 4.5 KB gzip of scripts (4.3 KB sent in brotli, `jsKb`) and 4.9 KB initial JS with the search island and the loader (3.0 on the other pages), LCP 1.65 s on Bogotá and 1.50 s on starter. Mermaid, once drawn: 34 requests, 665.9 KB gzip of scripts |
| 2026-10-08 | Playground with SQL (#247, PR 5): `<micelio-playground>` runs the code in a dedicated Worker; SQLite (`@sqlite.org/sqlite-wasm`, 3.53.4) is self-hosted under `/_islands/runtimes/` and downloads on the first press of Run. 17 strings per locale in the locale files. `scripts/static-serve.mjs` now serves `.wasm` as `application/wasm` and compresses it like a CDN (the static `wasmKb` of the search island is measured on the compressed file) | Dynamic, bogota: island 65.28 KB gzip of scripts, 340.64 KB of wasm, 397.14 KB in total, 4 requests, none before Run (limits are those plus 5 %). Static: 65.28 / 369.52 / 430.17 / 4. The dynamic article `jsKb` limit 158.6 → 159.2: the same build of the base (812c550, one machine, same ports) measures 158.4 and this branch 158.8, so the +0.4 KB is the 17 new locale strings and the labels of the block (the locale file is part of the entry); the home is 146.8 on both, which is the local `.env` |
| 2026-10-08 | async/await everywhere, no promise chains (ESLint `no-restricted-syntax`). Dynamic home `jsKb` limit 146.8 to 147.0 | The try/catch and `async` helpers of the composables (`useAuth`, `useTheme`, `useSectionPage`) add about 0.1 KB to the home page (146.8 to 146.9 KB measured); nothing else moved |

The HTML is rendered per request, so Nitro does not compress it (108.5 KB on the home page here). In production Traefik compresses it, together with Strapi's JSON (bogd3v/bogdev-infra#10): the home page HTML goes from 141.8 KB to 27.7 KB with brotli. This measurement serves the Nitro build directly, so it still reports the uncompressed HTML.

## Targets

From the Micelio spec. The budgets move towards them PR by PR (static: `starter` meets them, `bogota` meets the fonts and keeps an LCP exception on the home and the about page, plus 3 % of headroom on the text pages):

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
