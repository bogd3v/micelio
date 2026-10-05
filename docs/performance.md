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
```

`--serve` (included in `npm run perf`) starts the mock and the built server on ports 4310 and 3211. Pass `--base <url>` without `--serve` to measure a server that is already running. The CI job **Performance Budgets** runs `npm run perf -- --check` on every push and pull request, and writes the table to the job summary.

Sizes come from what the HTML declares, not from what a browser happens to download, because a browser measurement is not repeatable: depending on CPU speed, Nuxt's idle prefetch of linked pages and lazy chunks like Mermaid land before or after the cut. Lazy chunks are left out of the initial budget on purpose; they get their own heavy island budget (ADR 0006).

## Budgets

Each page has two groups of limits in `scripts/perf/budgets.json`:

- `error`: transferred sizes, third-party requests, CLS, LCP and the accessibility score. Going over them fails CI.
- `warn`: TBT and the performance score. They depend on the machine running Lighthouse, so going over them is reported but does not fail CI.

The first limits are the baseline plus 5 % for sizes, plus 0.02 for CLS, and the baseline accessibility score. When a change makes a page lighter, lower its limits in the same PR. Raising a limit needs a reason in the PR description.

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
| 2026-10-03 | Font fallbacks sized to the web fonts: `settings/font-fallbacks.css` declares `"Archivo Fallback"` (Arial) and `"JetBrains Mono Fallback"` (Courier New) with `size-adjust` and ascent/descent overrides, generated by `scripts/perf/font-fallbacks.py`. Archivo gets one face per weight range (sized at wght 300, 400, 500, 600 and 700) and per width (100 %, 112 % and 125 %): its default instance is wght 600, and the `.bd-wide` titles (`font-stretch: 125%`) are far wider than Arial, so a single `size-adjust` left them on one line until the swap | Lighthouse already reported CLS 0 (the preloaded fonts land before the first paint). With the fonts delayed by 2.5 s, the swap shift drops to ≤ 0.002 on every page (before: `/privacy` 0.052, `/about` 0.037 on mobile; the article 0.017 on desktop). CSS +0.5 KB |
| 2026-10-03 | LCP budgets block CI (see "LCP and TBT on GitHub runners"). Lazy hydration (`hydrate-on-visible`) was tried and dropped: Nuxt 4.5 still `modulepreload`s the components, and the async chunks added 4–10 KB of JS per page | No change in what pages send. LCP limits now 5950 ms (home), 4700 (blog), 5200 (article), 6600 (about), 4350 (privacy) |
| 2026-10-04 | Utility classes out of the templates (#262, first step): slider, quote, skip links, back to top, error and confirm pages move to `bd-*` classes in their layers, and the six `<UIcon>` become inline SVG components, so `@nuxt/icon`'s client component leaves every page (the back-to-top button in the layout was the only `<UIcon>` there). `npm run lint` fails on a class that is not `bd-*` or a core helper. Tailwind itself is still installed | JS sent −5.2 KB on the home page (156.6 → 151.4) and −5.3 to −5.9 KB elsewhere; CSS 22.9–23.2 → 21.9 KB. Budgets lowered to the new values + 5 % |
| 2026-10-04 | Tailwind, `@tailwindcss/typography` and `@nuxt/ui` removed (#262, step 2); the reset lives in its own first layer, `bd.reset` | Home JS sent 151.4 → 139.7 KB, CSS 21.9 → 19.0 KB (gzip 25.9 → 22.5 KB). Budgets lowered to the new values + 5 % (JS and CSS only) |

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
