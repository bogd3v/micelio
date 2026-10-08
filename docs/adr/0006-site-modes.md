# ADR-0006: Site modes, JS-free pages and heavy islands

**Status:** Accepted
**Date:** 2026-10-04
**Deciders:** BogDev maintainer

## Context

Micelio promises that the same Strapi content and the same theme can produce three kinds of site: a dynamic blog with community features (BogDev), a static blog or documentation site, and a landing page (spec, "Modos de sitio y páginas por secciones"). Today there is only one: a Nitro `node-server` with ISR ([ADR-0001](0001-isr-without-cdn.md)), full Vue hydration on every page, and features that need a server (comments, accounts, drafts, newsletter, fediverse stats, search, the Umami proxy of [ADR-0002](0002-first-party-umami-proxy.md) and the per-response CSP of [ADR-0004](0004-hash-based-csp.md)).

The targets in `docs/performance.md` make the difference concrete. The dynamic blog may send ≤ 60 KB of gzipped initial JS; a landing or static site ≤ 15 KB, LCP ≤ 1.5 s and Lighthouse 100/100. After #241 the home page still sends 155.5 KB, about 60 KB of it Vue and Nuxt alone, so the static target cannot be met by trimming: read-only pages there must ship without the Vue runtime. Lazy hydration was measured and dropped in #241 (Nuxt 4.5 still `modulepreload`s the lazy components, +4–10 KB per page), so it is not the way to get there either.

Several features do not fit any initial budget: Mermaid (≈ 2.7 MB of chunks on articles with diagrams, loaded with the article today), a 3D scene (#246, ~150 KB gzipped) and runnable code with WASM (#247, several MB). They need a contract that keeps them out of the initial load, with a fallback and a budget of their own.

Constraints already in place: the `modules` of `site-settings` (bogd3v/micelio-cms#81, #234) turn features off per site; the theme is chosen at build time (ADR-0005, section 4); `/blog` filters through query parameters (`category`, `tag`, `page`, `view`, `sort`, `search`, `app/helpers/blog.ts`), which static hosting cannot serve as different pages; and the fediverse actor is served by Strapi, not by the frontend.

Nuxt 4.5 supports the `noScripts` route rule (`experimentalNoScripts` is now a deprecated alias). It removes Nuxt's entry scripts, payload and module preloads; `<script>` tags added through `useHead`, such as the theme init script, stay.

## Decision

A site is built in one of three **modes**, chosen at build time. The dynamic mode is today's site. The static and landing modes are a `nuxt generate` output with **no Vue runtime on any page**: interaction is native HTML first, and where JavaScript is needed it is a small custom element loaded on demand. Features that do not fit the initial budget are **heavy islands** with a fixed contract. Interactive UI shared by every mode is written once, in that same native + custom-element style, so the dynamic mode loses JS too.

### 1. Modes

`NUXT_PUBLIC_SITE_MODE = dynamic | static | landing`, default `dynamic`. It is read in `nuxt.config.ts` **at build time**, because it changes the Nitro preset, the route rules and the generated routes; the value is exposed in the public runtime config so code can read it, and `runtimeConfigCheck` fails at startup if a runtime override disagrees with the build.

| | `dynamic` | `static` | `landing` |
| --- | --- | --- | --- |
| Build | `nuxt build`, preset `node-server` | `nuxt generate` | `nuxt generate` |
| Rendering | SSR + ISR (ADR-0001) | Prerendered HTML | Prerendered HTML |
| Vue runtime on read-only pages | Yes (hydrated) | No (`noScripts`) | No (`noScripts`) |
| Strapi | Reachable by the server at runtime | Reachable only by the build | Reachable only by the build |
| Hosting | Container (Dokploy) | Any static host; reference in section 7 | Same as static |
| Budget (`docs/performance.md`) | Dynamic blog | Landing / static | Landing / static |

`landing` is `static` with a content profile, not a different build: the home page comes from `site-settings.homePage` (#244), navigation comes from the page sections, and the blog routes, feed and blog search are not generated when there are no articles. `scripts/perf/budgets.json` already carries `"mode"`; the budgets get one section per mode.

### 2. Modules per mode

A module is effectively on when Strapi turns it on **and** the mode allows it. `isModuleEnabled(module)` (#234) applies both, so no component, route or link checks the mode by itself.

| Module | `dynamic` | `static` / `landing` | Why |
| --- | --- | --- | --- |
| `comments`, `accounts`, `drafts` | Yes | No | They need sessions and writes to Strapi |
| `fediverse` | Yes | No | The actor lives in Strapi, which a static site does not expose |
| `newsletter` | Strapi + SMTP, as today | External provider (section 5) | Subscribing needs a server |
| `search` | `/api/search` | Build-time index (section 4) | |
| `support` | Yes | Yes | It is a link |
| Analytics (Umami) | First-party proxy (ADR-0002) | Off unless the host can proxy same-origin (section 7) | Keeps "zero third-party requests" |

Drafts are previewed by running the frontend in `dynamic` mode against the same CMS, locally or on a private instance; a static site never has a preview route.

### 3. Pages without JavaScript

In `static` and `landing`, every route gets `noScripts: true`. In `dynamic`, routes stay hydrated: comments, the account menu and forms remain Vue, under the dynamic budget. What a page may still run:

1. **Inline scripts we own**, hashed by the CSP (the theme init script, the speculation rules of #245). Limit: 2 KB raw in total per page.
2. **Islands**: custom elements (`<micelio-*>`), written in TypeScript without Vue, each its own Vite entry with a hashed file name. The Vue component renders the element's complete server markup, which works without JS; the element's script is added with `useHead` only on pages that render it and upgrades that markup.

Before writing an island, native HTML is the first choice: `popover` and anchor positioning for menus, `<dialog>` for the search palette and the mobile sheet, `<details>` for the FAQ and the collapsed table of contents, `<form method="post">` for the newsletter. The mode switch, the mobile navigation, the search palette, the newsletter form and the code copy button are written this way for **every** mode, which also removes their Vue code from the dynamic bundle; this overlaps with #245 (native popovers) and is done there.

`<NuxtIsland>` and `.server.vue` components are **not** the island mechanism: they render HTML on the server and do not add interactivity, and in a static build they become prerendered requests to `/__nuxt_island/`. They remain available inside the dynamic mode for server-only fragments.

**Plan B** if `noScripts` changes or breaks in a Nuxt release: a `render:html` hook (the same one the CSP plugin uses) that removes Nuxt's entry script, payload and `modulepreload` links on static builds. The e2e for static mode fails if any page loads `/_nuxt/entry*` or a payload, so either path is checked.

### 4. Search in static mode

[Pagefind](https://pagefind.app) indexes the generated HTML after `nuxt generate` (`npx pagefind --site .output/public`). It splits the index by `<html lang>`, so English and Spanish get separate indexes, and loads only the index chunks a query needs. The search palette uses Pagefind's JS API with its own markup (the existing palette's accessible structure and theme hooks), not Pagefind's default UI. It is an island loaded **when the palette opens**, so the initial budget does not change; its bytes are budgeted like a heavy island (section 6). The dynamic mode keeps `/api/search`, because its content changes without a rebuild.

Without JS, the search control is a link to `/blog`, where categories and tags are plain links.

### 5. Forms without a server

The newsletter and the contact form of the `landing` catalog post a plain HTML form to a provider configured per site: `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` (URL) and the provider's field name for the email. Any provider that accepts a form `POST` works (Buttondown, a self-hosted Listmonk, Mailchimp); the reference is **Buttondown**: it accepts a plain form post with double opt-in, needs no script on the page, and its privacy terms fit the privacy page. The provider's origin is added to `form-action` in the CSP and named on the privacy page. Without the variable, the newsletter module is off in static modes, with a build warning.

### 6. Heavy islands

A heavy island is an island whose code exceeds what the page's initial budget allows. It is declared in `app/islands/heavy.ts` (id, entry, trigger, fallback, required features) and follows five rules:

1. **Opt-in.** It belongs to a module, a section (`scene`) or a block (`playground`, Mermaid code blocks); a page without one loads nothing and declares nothing.
2. **Off the initial load.** Its script is loaded by a `<micelio-*>` element through a dynamic import, triggered by `visible` (IntersectionObserver, after the LCP) or `interaction` (a click or keypress). It is never `modulepreload`ed and is never the LCP element.
3. **Static fallback.** The server markup is complete without it: a poster image with alt text, the source code and its expected output, or the diagram's source. The element stays on the fallback with `prefers-reduced-motion: reduce` when it animates, with `Save-Data`, and without the features it declares (`webgl2`, `wasm`, `worker`).
4. **Its own budget.** `budgets.json` gets an `islands` section with gzipped KB per island. `scripts/perf/measure.mjs` loads a fixture page, checks that no island byte is in the initial requests, triggers the island and measures what it loads.
5. **Contained.** It releases its resources when it leaves the page or the viewport (#246), and code that runs untrusted input runs in a Worker or a sandboxed iframe (#247), with CSP additions only on the pages that contain it.

The same element works in every mode, so a heavy island is written once.

**Mermaid** becomes the first heavy island (trigger `visible`, fallback the source code block that `RichTextBlock` already renders, features none), replacing the `useMermaid` composable. Rendering to SVG at build time is not adopted: Mermaid needs a browser DOM to lay out, which means a headless Chromium in the build image and, for the dynamic mode, in the production container, and the SVG would have to be rendered once per theme mode. It is revisited if a renderer without a browser covers the diagram types the articles use.

### 7. Content, build and hosting for static modes

**Routes.** A build module fetches from Strapi, through the pure `strapiRequest()` (`strapiFetch()` needs Nitro, which a build module does not have), every published article and page per locale and adds their routes with the `prerender:routes` hook; `crawlLinks` stays on to catch the rest. `feed.xml`, `sitemap.xml` and `robots.txt` are prerendered. `@nuxt/image` writes the optimized images into the output during generation. Blog filters move from the query string to paths, `/blog/category/<slug>`, `/blog/tag/<slug>` and `/blog/page/<n>`, in **every** mode, so a URL means the same everywhere; the dynamic mode redirects the old query URLs with a 301. `sort`, `view` and the `search` parameter exist only in `dynamic`.

**Where the build runs.** In a GitHub Actions workflow of the site's repository, with a read-only Strapi token that can fetch published content only (`docs/security.md`). Strapi must therefore be reachable from the runner, with its admin and every write route closed to the internet. A site that keeps Strapi fully private builds on a machine that can reach it and deploys with the host's CLI; the guide documents both.

**Rebuild on publish.** Strapi webhooks cannot shape the body GitHub's `repository_dispatch` requires (`event_type`), so micelio-cms (#75) gets a lifecycle hook on publish, unpublish and delete of `article`, `page` and `site-setting` that calls a configured `REBUILD_HOOK_URL` with an optional bearer token, debounced 60 s. The workflow uses a `concurrency` group that cancels a running build when a newer one starts.

**Reference host: Cloudflare Pages.** The domains already use Cloudflare DNS, it serves the `_headers` file the security headers need, and it applies brotli. Netlify reads the same `_headers` format. GitHub Pages is not a reference: it cannot send security headers.

**CSP and headers.** ADR-0004 still applies: the policy is built from the hashes of the inline scripts in the rendered HTML, now during prerender. With `noScripts`, every page has the same inline scripts, so the build collects the hashes of all pages, fails if they differ, and writes one rule for `/*` in `_headers` with the CSP and the fixed `SECURITY_HEADERS`. Island scripts are files on the site, covered by `'self'`. A host without `_headers` gets the policy in a `<meta http-equiv>`, which cannot carry `frame-ancestors`; the guide says so.

**Analytics.** The Umami proxy of ADR-0002 needs a server. On a host that can rewrite a same-origin path to another origin (Netlify), it is configured there; Cloudflare Pages only rewrites within the site, so on the reference host analytics is off unless the site adds a Worker for those two paths. Loading Umami from its own domain is not allowed: it breaks "zero third-party requests".

## Options considered

### A. Build-time modes, `noScripts` and custom-element islands (chosen)
| Dimension | Assessment |
| --- | --- |
| Budget | Static pages ship only what they use: the theme script and, per page, their islands |
| One codebase | Same components, theme and content for every mode; shared interactive UI written once |
| Risk | `noScripts` is a Nuxt route rule with a plan B in a `render:html` hook, both checked by e2e |
| Cost | Rewrite the shared interactive components as native HTML + custom elements; a build module for routes; blog filters as paths |

### B. Astro (or another framework) for the static modes
**Pros:** islands and zero JS are its default. **Cons:** a second implementation of every component, page, the theme contract and i18n, kept in sync by hand; themes would need two renderers. The JS-free output is reachable from Nuxt.

### C. `nuxt generate` with full or lazy hydration
**Pros:** no new patterns. **Cons:** Vue and Nuxt alone are ~60 KB gzipped, four times the 15 KB target; lazy hydration added 4–10 KB per page in #241.

### D. Nuxt server components (`<NuxtIsland>`, `.server.vue`) as islands
**Pros:** built into Nuxt. **Cons:** they render HTML on the server and add no interactivity; the client side still needs the Vue runtime.

### E. Pagefind's default UI, or `/api/search` through a serverless function
**Pros:** less code. **Cons:** the default UI brings its own markup and styles outside the theme contract; a function brings back a server and a runtime Strapi dependency.

### F. Mermaid rendered to SVG at build or save time
**Pros:** no JS for the reader. **Cons:** needs a headless browser in the build, in the production container (dynamic mode renders Markdown per request) or in Strapi on save, and one SVG per theme mode.

### G. Content from Markdown files instead of Strapi
**Pros:** no CMS at all for the simplest sites. **Cons:** a second content model to keep equivalent to Strapi's blocks and sections. Left as a possible future.

## Trade-offs

Static sites lose comments, accounts, drafts and the fediverse, and depend on a third-party provider for the newsletter; that is the price of having no server. Content appears a few minutes after publishing, after a build. Pages without Vue mean the shared interactive UI is written twice in effect while the migration runs (once in Vue, once as native HTML and custom elements), until #245 replaces the Vue versions in every mode. Custom elements are a second component model in the codebase; it is kept small by preferring native HTML and by reserving Vue for dynamic-only modules. Moving blog filters to paths changes public URLs, mitigated by redirects. Building in GitHub Actions requires Strapi to be reachable from the internet, with a read-only token.

## Consequences

- #243 implements sections 1–5 and 7 for `static`: the build module, `noScripts`, Pagefind, the `_headers` file, the workflow and the e2e that fails if a page loads Nuxt's entry; #244 adds the `landing` profile; #234 makes `isModuleEnabled` read the mode.
- #245 rewrites the mode switch, mobile navigation, search palette and newsletter form as native HTML and custom elements for every mode.
- #241's script and `budgets.json` get budgets per mode and an `islands` section; Mermaid moves under it first, then #246 and #247 follow section 6.
- The workflow and the hosting guide are `.github/workflows/static-site.yml` and [`docs/static-mode.md`](../static-mode.md).
- bogd3v/micelio-cms#75 adds the rebuild lifecycle hook and `REBUILD_HOOK_URL`; its `SECURITY.md` and this repo's `docs/security.md` document the read-only build token.
- **Implementation note (#243, PR 6): islands and search.** Islands are built by `modules/islands.ts`, which calls Vite's `build()` on `app/islands/*.ts` (one entry each, `[name]-[hash].js`, no `modulepreload`) into `node_modules/.cache/micelio/islands-<pid>` (Nuxt empties its build directory), serves them under `/_islands/` through Nitro's `publicAssets` and writes the manifest the app reads (`#build/micelio/islands`, `useIsland(id)`). They are separate from Nuxt's own Vite build and exist only in static builds for now. Pagefind runs from `modules/static-search.ts` with its Node API after prerender, not as `pagefind --site`, so `npm run generate` stays one command; Pagefind's UI bundles are deleted from the output. The three search triggers stay `<a href="/blog">` in the markup and `<micelio-search>` swaps each for a `<button>` when it starts; the dialog's markup and strings are server-rendered in the same element. `'wasm-unsafe-eval'` is allowed on every static page (ADR 0004 amendment).
- ADR-0001 stays for `dynamic`; its option D (static generation) is now a supported mode for sites without server modules. ADR-0002 and ADR-0004 apply as described in section 7.

**Amendment (2026-10-07, #247 and #246): islands in every mode.** `modules/islands.ts` builds `app/islands/*.ts` in `dynamic`, `static`, `landing` and `nuxt dev`, not only in static builds, and Nitro serves them from `/_islands/` with the same immutable cache (hashed names). The islands are a separate Vite build, so the dynamic bundle only gains the generated manifest (the dynamic home stays at 146.1 KB of JS); which pages render an island is unchanged (the search island still belongs to static pages). The build goes to `node_modules/.cache/micelio/islands-<hash>`, where the hash covers the island sources, `app/helpers`, `app/interfaces`, the lockfile and the module, so an unchanged tree reuses it (`nuxt dev` does not rebuild on every start); it is built in a temporary folder and renamed, so concurrent builds are safe. `heavy.ts` and `app/islands/lib/` are not entries.

**Hydration rule.** In `dynamic`, an island that writes into the light DOM of a Vue-rendered page would make hydration mismatch. An island therefore either writes only into its own shadow root, or waits for `whenHydrated()` (`app/islands/lib/hydrated.ts`): it resolves at once on a page without a Nuxt app (`#__NUXT_DATA__` absent, as in static and landing) and otherwise on the `micelio:hydrated` event that a client plugin dispatches on `app:suspense:resolve` (it also sets a flag, for an island that loads later; a 15 s timeout stops a failed hydration from leaving the island dead).

**`visible`.** The element is within 200px of the viewport (IntersectionObserver), the page has fired `load`, and the browser has been idle (`requestIdleCallback` with a 2 s timeout, 200 ms timer without it). All three, so a heavy island never competes with the LCP. Triggers return a promise and take an `AbortSignal`, so an island removed from the page releases its observer and listeners.

**Save-Data and `interaction`.** `Save-Data` keeps `visible` islands on their fallback, but not `interaction` ones: the reader asked for it. A playground's Run button stays available and shows the download size before it loads the runtime.

**Registry `csp`.** A heavy island may declare `csp: { connectSrc, workerSrc }` (origins or same-origin paths, validated by `validateHeavyIslands()`). In `dynamic` those sources are added to the policy of the responses that render the island only, through the same per-response step that hashes the inline scripts (ADR 0004); static builds have no per-page policy and use same-origin paths already covered by `'self'`.

