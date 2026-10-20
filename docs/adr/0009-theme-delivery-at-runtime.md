# ADR-0009: Theme delivery at runtime, the theme store

**Status:** Proposed
**Date:** 2026-10-19
**Deciders:** Micelio maintainer
**Amends:** [ADR-0008](0008-theme-registry.md) (decisions 1, 3, 6 and 10, option G, Trade-offs, Out of scope), [ADR-0005](0005-theme-contract.md) (sections 2, 3, 4 and 8) and [ADR-0004](0004-hash-based-csp.md) (theme assets)

## Context

[ADR-0008](0008-theme-registry.md) moves themes out of the repository but keeps them inside the build: "a different theme always means a different build" (decision 6), and loading themes at runtime is out of scope. Hosting many sites, and letting an admin change the theme from Strapi, need the opposite: one image, already built, that serves any published theme that ships no code. This record is #399 of epic #316 (milestone "Micelio · Temas en runtime", done when one image starts with two different themes and no rebuild).

What reaches a page today, all at build time, from `modules/theme/`:

- `css.ts` writes `#build/micelio/settings.css`, `components.css`, `theme.css`, `sections.css` and the `layout-*.css` and `pages-*.css` of the active variants, which `app/assets/css/main.css` imports at fixed positions, so Lightning CSS bundles them into the entry stylesheet in the layer order of ADR-0005 section 3 (`myc.reset, … myc.theme, myc.animations, myc.utilities`).
- `data.ts` writes `#micelio/theme`, `#micelio/theme-mermaid`, `#micelio/build-theme` and `#micelio/theme-palette`; `display-fonts.ts` writes `#micelio/display-fonts`. About a dozen files of `app/` and `server/` import them.
- `assets.ts` copies `fonts/` to `/fonts/` and `images/` to `/theme/images/` (served with `STATIC_CSP`); `slots.ts` registers one component per slot; `layout/variants.ts` registers only the active variant of each region; `modes.ts` puts the init script (`init-script.mjs`) in `app.head`, built from the active theme's modes.
- `server/plugins/runtimeConfigCheck.ts` stops the boot when `NUXT_PUBLIC_THEME` differs from the build (`themeMismatch`).

Much already runs per request: `server/plugins/themeMode.ts` writes the `<html>` attributes, the font preloads and `<style id="theme-overrides">` in `render:html`, and `server/plugins/contentSecurityPolicy.ts` hashes the inline scripts of every response ([ADR-0004](0004-hash-based-csp.md)). The `theme:*` scripts (`theme:check`, `theme:new`, `theme:schema`, `theme:reference`) read `themes/` and the contract (`modules/theme/contract.ts`, `app/theme/hooks.json`); #309 and #310 add `theme:pack`, `theme:add` and `theme:pull`.

Bogotá (7 slots) and the starter (1 slot) ship code. Micelio is pre-1.0 ([ADR-0010](0010-semantic-versioning.md)): the breaking changes below need the `!`, a `BREAKING CHANGE:` paragraph and upgrade notes, and no deprecation period.

## Decision

Decisions marked **(epic)** were taken on 2026-10-08 in #316 and are recorded here, not reopened. The rest is proposed by this record; what it leaves open is under "Open questions".

### 1. Three places

1. **Source**: the theme's repository (`bogd3v/micelio-themes` for official themes).
2. **Registry**: `ghcr.io/bogd3v/micelio-themes/<id>:<version>` and its `index` (ADR-0008). It distributes; the browser never reaches it.
3. **Theme store** of the deployment **(epic)**: a directory that holds each installed theme keyed by its digest, validated and compiled. The site serves it on its own origin under `/_t/<digest>/` (not `/_theme`, which is the specimen page), so a page makes no third-party request and the CSP needs no new origin.

An image carries a read-only **built-in store** with the themes of its `themes.lock.json`, filled by `theme:pull -- --frozen` before `nuxt build`. A deployment may add a writable **deployment store** (proposed `MICELIO_THEME_STORE`). A theme is looked up by digest in the built-in store, then in the deployment store; the same package compiled by the same core gives the same bytes, so the order cannot change a page.

### 2. Install

One function, `installTheme(source)` (#400, proposed in `modules/theme/install/`): **pull** (the client of #310) → **verify** (the digest; the provenance attestation for official themes) → **safe unpack** (`modules/theme/registry/unpack.ts`, #309) → **validate** (the contract validator, split from `nuxt/kit` so it runs in Nitro and in plain Node) → **compile** → **atomic write** (a temporary folder renamed into place). Nothing from a package executes. Its callers are `theme:pull`, the static builder (#315) and the Nitro server (#403).

**Compiling at install (epic)** produces, per package and core build:

- `theme.css`: `fonts.css`, `font-fallbacks.css`, the role tokens (`tokens.mjs`), the mode-switch rules (`buildSegmentedCss`), the theme's `theme.css` and, for a code theme, its slot CSS, each in its named layer and lowered by Lightning CSS with the core's targets;
- `sections.css`, separate as today (only pages that render sections load it);
- `runtime.json`: id, version, digest, contract, `code`, modes, fonts and preloads, images, layout, the display-family data, the palette and contrast rules (`palette.ts`), and the `theme.*` messages compiled to the AST the client formats without a compiler;
- `fonts/` and `images/` with the current allowlists, and gzip and brotli next to each text file.

A theme's source keeps writing `/fonts/…` and `/theme/images/…` (`css-rules.ts` does not change); the compiler rewrites them to `/_t/<digest>/…`. Compiled output is tied to the core build, so a core upgrade recompiles what the stores hold.

### 3. Who may install, and the trust model

**(epic)** The Nitro server may install themes itself, behind a switch (proposed `MICELIO_THEME_INSTALL`) that is **on by default**. A hosted platform turns it off and installs centrally into a shared, read-only store. With the switch off, only themes already in a store activate; a missing one is reported, never downloaded.

What a server install enforces (#403, reviewed by the `security` agent):

- **One registry**: only `MICELIO_THEME_REGISTRY` (ADR-0008 decision 3). More than one registry per instance is out of scope.
- **The pinned digest** (section 5) must equal the digest pulled, and the attestation is verified where the caller can (official themes, #310).
- **Size caps** of ADR-0008 decision 1 (4 MiB unpacked, 1 MiB per file, 200 files), enforced while unpacking.
- **No code**: the server never installs a package with `code: true` (section 4).
- **Contract validation**, as at build; a theme that fails never reaches the store.
- **Off the request path**: install runs in the background, pages keep the current theme until the new one is in the store, and a registry outage changes nothing already installed.

### 4. Data-only and code themes

**(epic)** A package has `code: true` when it ships `slots/` or `templates/` (ADR-0008 decision 1).

- A **data-only** theme activates at runtime on any image whose core implements its contract (#308).
- A **code** theme activates only on an image built with it: pinned in that image's `themes.lock.json`, its slots compiled in by the Nuxt build (#402). "Built with it" means the same id and digest; another version of the theme is another theme.
- Activating a code theme the image was not built with is **rejected with a reason**. It never falls back to the core's default slots, so a theme looks the same on every image. A dynamic site keeps its current theme (#403); a static generation fails and the last good site stays published (#315).

Slots stay at build time until declarative slots exist (out of scope in #316).

### 5. The pin

**(epic)** The pin of a runtime theme is an **exact version plus its digest**, stored in Strapi: `themeId`, `themeVersion` and `themeDigest` of `site.theme` (bogd3v/micelio-cms#97). No ranges and no "latest": publishing an article must never change how a site looks. An empty `themeId` means the instance's default theme. `themes.lock.json` stays the pin of what an image is built with (ADR-0008 decision 6).

### 6. How the core reads the active theme

- **`NUXT_PUBLIC_THEME`** becomes the instance's **default theme**: a bare id among the themes of the built-in store, used when the site settings name none. It is read at runtime; `themeMismatch` and its boot check go away (#401). A value that names no installed theme stops the boot with a message that names it (standard, section 5).
- **Active theme**: the server resolves `site.theme` into one server state that every reader uses (`/api/site` and the render hook), and keeps the last good theme on failure (#403). The site-settings cache (`siteCacheSeconds`) plus the install time bound how fast a switch is seen.
- **Data**: `runtime.json` replaces the `#micelio/theme*` virtual modules and the theme part of `#micelio/display-fonts`. The server reads it and the client gets it in the payload. Theme messages are merged per request, never sharing message objects between requests (#401).
- **CSS**: the compiled theme CSS leaves the entry bundle and is linked from `render:html`. Lightning CSS drops the `@layer` order statement when it bundles every layer (ADR-0005 section 3), so the statement goes **inline, first in `<head>`**, as a `<style>` before any stylesheet.
- **Layout variants**: all ten variants (`app/theme/layout/<region>/`) are in the build, and the component and the CSS of each load only when the active theme uses it (#402). The `:root` and `html` rules of the header variants (`--myc-header-h`, `scroll-padding-top`) move under an attribute on `<html>`.
- **Slots**: the slots of every code theme in the lock are compiled in and chosen by the active theme's id and digest; any other theme renders `app/theme/defaults/` (#402).
- **Init script (epic)**: theme-independent. It reads the modes from an attribute on `<html>` that `themeMode.ts` writes, and stays in the build-time head, because the render hook runs after the CSP has hashed the scripts.

### 7. Static and landing modes

The builder reads `site.theme` with the read-only `build` token before `nuxt generate`, installs the pinned theme with `installTheme()` and copies `/_t/<digest>/` into the output (#315). An empty `themeId` uses the builder's default. An unknown id or version, a digest mismatch, or a code theme the builder image lacks fails the generation with a message that the rebuild webhook surfaces, and the last good site stays. The resolved id, version and digest are written into the output for audit, and `/_t/*` joins the immutable paths of `_headers` (`app/helpers/staticBuild.ts`). A landing is a static build with a content profile ([ADR-0006](0006-site-modes.md)) and resolves the theme the same way.

### 8. Cache and CSP

- **`/_t/<digest>/**`** is served by a Nitro handler from the stores (#401): `Cache-Control: public, max-age=31536000, immutable`, the precompressed files, and the `STATIC_CSP` that `/fonts/**` and `/theme/images/**` have today.
- **Pages** ([ADR-0001](0001-isr-without-cdn.md)): ISR stores HTML that names the theme's stylesheet, preloads and attributes, so a switch purges the page cache and the cache key includes the theme digest, and a render in flight cannot store the old theme again (#403).
- **CSP** ([ADR-0004](0004-hash-based-csp.md)): no new origin, since `/_t/` is `'self'`. `script-src` keeps its shape: the theme-independent init script has one hash per core build instead of one per theme build. The inline `@layer` statement and `#theme-overrides` are styles, allowed by `style-src 'unsafe-inline'`; if `style-src` is tightened they get hashes in the same `render:html` hook. Static builds keep one policy for every page.
- **#313 (epic)**: the byte-identical init script and CSP hash of ADR-0008 decision 10 are no longer required. Zero visual diff and the same budgets prove BogDev unchanged; the init script and its hash change once, in #401.

### 9. Operator interface (standard, section 6)

| Variable | Meaning | Change |
| --- | --- | --- |
| `MICELIO_THEME_STORE` (proposed) | Directory of the deployment store | New, optional |
| `MICELIO_THEME_INSTALL` (proposed) | Whether the server may install themes; on by default | New, optional |
| `MICELIO_THEME_REGISTRY` | The one registry the server and the clients pull from (ADR-0008) | Also read at runtime |
| `NUXT_PUBLIC_THEME` | The instance's default theme, read at runtime | Changed meaning: `!` and upgrade notes |

Each goes in `.env.example` and `docs/operate/configure.md` in the pull request that introduces it.

### 10. What this record amends

The amended records are not rewritten; each gets a pointer amendment.

- **ADR-0008 decision 1**: the allowlist gains what Bogotá ships and the list omits: `slots/*.css`, `slots/*.ts`, `fonts/*.txt` and subfolders of `images/` (`images/**`, the types of `IMAGE_FILE` in `modules/theme/assets.ts`).
- **ADR-0008 decision 3**: "the same storage is what serving themes at runtime would use later" no longer holds: the browser reaches only the site's own store (section 1).
- **ADR-0008 decision 6**: "a different theme always means a different build" and "the pin is not stored in Strapi for dynamic images (the theme must be known before Nuxt builds)" hold only for code themes. A data-only theme's pin is in Strapi, exact (section 5), and the builder takes it as stored instead of resolving it.
- **ADR-0008 decision 10**: the byte-identical init script and CSP hash are dropped; `NUXT_PUBLIC_THEME` changes meaning (section 9); "only the active theme reaching the bundle" becomes "no theme CSS or data in the bundle, only the slots of the locked code themes".
- **ADR-0008 option G**: its cons no longer hold for data-only themes: the CMS stores the digest and no build needs the theme.
- **ADR-0008 Trade-offs and Out of scope**: a dynamic site changes a data-only theme without a rebuild; loading themes at runtime is in scope for data-only themes, and declarative slots stay out.
- **ADR-0005 section 2** (#237 amendment): the init script is no longer generated from the active theme's modes.
- **ADR-0005 section 3** (#237 amendments): theme CSS is a separate stylesheet, and the order statement is inline in `<head>`.
- **ADR-0005 section 4**: the active theme is chosen at runtime, role CSS is generated at install, fonts and images are served under `/_t/<digest>/`, and the boot check against the build goes away.
- **ADR-0005 section 8** (#239 amendment, "the build bundles one theme"): a `themeId` that names a data-only theme in a store, or one the server may install, activates it.
- **ADR-0004**: `/_t/**` joins the asset policy; no new script hash or origin.

## Options considered

### A. Compile at install into a store keyed by digest (chosen, epic)

| Dimension | Assessment |
| --- | --- |
| Hosting | One image for every site; the theme is data next to it |
| Privacy and CSP | Same origin, content-addressed, immutable; no new CSP source |
| Cost | Lightning CSS and the message compiler in the runtime image; one compile per package and core build |
| Trust | No code runs from a package; code themes keep the build-time path and the review of ADR-0008 decision 7 |

### B. A prebuilt image per theme (ADR-0008 as written)

**Pros:** nothing new at runtime. **Cons:** one image per theme and core version; an admin's change in Strapi is a build and a deploy; a hosted platform would run one build per site.

### C. Bundles compiled at publish time, one per core version

**Pros:** no compiler in the runtime image. **Cons:** compiled output is tied to the core build, not to its version, so every core release, patches included, would republish every theme, and a fork or a self-built image would find no bundle for its build.

### D. Bundle every installed theme into the build

**Pros:** no store. **Cons:** every theme's CSS on every page breaks the CSS budget (21.1 KB per dynamic page, of which Bogotá sends 21.0 KB today), and adding a theme is still a rebuild. Already rejected in ADR-0005 (#239 amendment).

### E. Compile slots at runtime

**Pros:** code themes would activate on any image. **Cons:** compiling and running a third party's Vue in SSR on demand, with `@vue/compiler-sfc` and Vite in the runtime image, outside the review of ADR-0008 decision 7 and outside the `'self'` chunks the CSP trusts. Slots stay at build time until declarative slots exist.

### F. Fall back to the default slots for a code theme the image lacks

**Pros:** every theme "works" everywhere. **Cons:** the same theme looks different on different images. Rejected (epic).

### G. Serve themes from the registry or a CDN

**Pros:** no store. **Cons:** a third-party request on every page (standard, section 9), a new CSP origin, and the registry in the path of every visitor.

## Trade-offs

- The runtime image grows: `lightningcss` (its Linux x64 binary is 9.6 MB in `node_modules`, MPL-2.0) and `@intlify/message-compiler` (540 KB, MIT), devDependencies today, become production dependencies, with the justification of the standard, section 10, in #400.
- A writable store is state: a volume to keep or rebuild, shared or per replica, and a cache to clean.
- The theme CSS becomes a second stylesheet request. With 0.1 KB of CSS margin on Bogotá's dynamic pages, any byte the split adds has to fit, or the baseline moves with numbers in `docs/performance.md`.
- The server downloads what a CMS field names. The trust model of section 3 is what keeps that safe, and it needs its own tests.

## Consequences

- **#308** (`modules/theme/constants.ts`, `contract.ts`, `validate.ts`, `docs/themes/contract-changelog.md`): contract minors decide whether a store theme activates on a core.
- **#309** (a `theme:pack` script in `scripts/`, `modules/theme/registry/unpack.ts`, `modules/theme/contract.ts`, `dist/themes/`): the amended allowlist and `code` in the manifest.
- **#310** (`modules/theme/registry/`, `themes.lock.json`, `Dockerfile`): `theme:pull` also fills the built-in store.
- **#400** (`modules/theme/install/` with its `types.ts` and `constants.ts`; the split of `validate.ts`, `contract.ts`, `data.ts`, `hooks.ts`, `tokens.mjs`, `palette.ts` and `modes.ts`; `package.json`; `.env.example`, `docs/operate/configure.md`, `docs/security.md`, `docs/themes/`): `installTheme()` and the store.
- **#401** (`server/plugins/themeMode.ts`, `server/plugins/runtimeConfigCheck.ts`, `app/helpers/runtimeConfig.ts`, `modules/theme/init-script.mjs`, `css.ts`, `data.ts`, `assets.ts`, `display-fonts.ts`, `app/assets/css/main.css`, `app/components/section/SectionRenderer.vue`, `server/utils/theme.ts`, `displayFonts.ts`, `site.ts`, every consumer of `#micelio/theme`, a route for `/_t/` under `server/routes/` with its entry in `server/openapi/`, `scripts/perf/`): the core reads the theme from the store.
- **#402** (`modules/theme/layout/variants.ts`, `modules/theme/slots.ts`, `app/theme/layout/`, `app/theme/defaults/`, `app/pages/blog/index.vue`, the header variants' CSS): variants and slots chosen at runtime.
- **#403**, **#315**, **#313** and bogd3v/micelio-cms#97 follow sections 4 to 8.

## Open questions

Each has a recommendation; the pull request that implements it records the answer as an amendment here.

1. **The digest in the URL.** The store is keyed by the package digest, but compiled output changes with the core build, and an `immutable` asset must never change under one URL. *Recommendation:* the `<digest>` of `/_t/<digest>/` is the digest of the compiled output (package digest plus the core's compile key), and `runtime.json` records both (#400).
2. **The default of `MICELIO_THEME_STORE`.** The runtime image is distroless, runs as uid 65532 and holds only `/app/.output`. *Recommendation:* unset means no deployment store, so the server has nowhere to install and only built-in themes activate, with one warning at boot; the Compose files gain an optional volume (a new volume name is part of the operator interface).
3. **Checks at install.** Admission already ran `theme:check` on a published theme, but the registry of a fork may not. *Recommendation:* install also runs the error-level checks of `theme:check` (contrast matrix, static budgets), which are pure and fast.
4. **Where variant CSS lands.** *Recommendation:* the core's CSS for the variants the theme chose is compiled into the theme's stylesheet at install, in `myc.layout` and `myc.pages` after the core rules of each layer as today, so a page still makes one theme request and loads only its variants (#402).
5. **Theme images through IPX.** `image.dirs` is fixed at build. *Recommendation:* the built-in store joins `image.dirs` for code themes (Bogotá's `ThemeHero`); the images of a data-only theme are served as files from `/_t/`.
6. **Store cleanup.** *Recommendation:* the active, last good and locked themes are never removed; anything else is removed by a command, never by a request.
