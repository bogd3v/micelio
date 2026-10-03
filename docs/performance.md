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

- `error`: transferred sizes, third-party requests, CLS and the accessibility score. These are deterministic, so going over them fails CI.
- `warn`: LCP, TBT and the performance score. They depend on the machine running Lighthouse, so going over them is reported but does not fail CI.

The first limits are the baseline plus 5 % for sizes, plus 0.02 for CLS, and the baseline accessibility score. When a change makes a page lighter, lower its limits in the same PR. Raising a limit needs a reason in the PR description.

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

1. **Nothing is compressed.** The Nitro server sends JS, CSS and HTML raw, and so does production: `https://bogdev.com.co/_nuxt/*.js` answers without `content-encoding` even with `Accept-Encoding: br, gzip`. Compression alone would cut the transferred JS by about 63 % and is the main reason LCP sits between 6 and 9 s.
2. **Mermaid loads with the article.** On top of its 757 KB of initial JS, the article with diagrams downloads about 2.7 MB of Mermaid chunks while it loads. They are not in the initial budget; Mermaid is the first heavy island to budget (ADR 0006).
3. **`@nuxt/ui` and full hydration** keep the base JS above 190 KB gzipped on every page.
4. **Accessibility:** on `/blog` the card titles are `<h3>` with no `<h2>` before them (`heading-order`). On the article, the only failure is an `<img src="x">` without `alt` that comes from the mock content.

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
