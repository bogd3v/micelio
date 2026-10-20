# ADR-0009: Theme delivery at runtime, the theme store

**Status:** Proposed
**Date:** 2026-10-19
**Deciders:** Micelio maintainer
**Amends:** [ADR-0008](0008-theme-registry.md) (decisions 1, 3, 6, 7 and 10, option G, Trade-offs, Out of scope), [ADR-0005](0005-theme-contract.md) (sections 2, 3, 4 and 8) and [ADR-0004](0004-hash-based-csp.md) (theme assets)

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

Decisions marked **(epic)** were taken on 2026-10-08 in #316 and are recorded here, not reopened. Decisions marked **(2026-10-19)** were taken by the maintainer in the review of this record: the two digests and the unset deployment store (section 1), the checks and the path charset at install (section 2), and who may change the theme (section 3). The rest is proposed by this record; what it leaves open is under "Open questions".

### 1. Three places

1. **Source**: the theme's repository (`bogd3v/micelio-themes` for official themes).
2. **Registry**: `ghcr.io/bogd3v/micelio-themes/<id>:<version>` and its `index` (ADR-0008). It distributes; the browser never reaches it.
3. **Theme store** of the deployment **(epic)**: a directory that holds each installed theme keyed by digest, validated and compiled. The site serves it on its own origin under `/_t/<digest>/` (not `/_theme`, which is the specimen page), so a page makes no third-party request and the CSP needs no new origin.

**Two digests.** The package digest (`sha256:` of the `.tgz`) identifies what was published and pinned. The `<digest>` of `/_t/<digest>/` is the digest of the **compiled output**: a hash of the package digest and the **compile key**, which covers the core build id, the Lightning CSS version and targets, and the version of the theme compiler (and its message compiler). A core upgrade therefore gives new URLs, and an `immutable` file never changes under one URL. Each compiled entry records both digests. The compiled digest is a hash of inputs, so compilation is deterministic (gzip with mtime 0, a stable order of files and rules), and a test compiles twice and compares the manifests.

**Integrity, and who may write a store.** Each compiled entry carries a manifest with the sha256 and size of every file it holds. The manifest guards against corruption, not against whoever can write the store: write access to a deployment store is trusted like the image, so the store is writable only by the installer's uid, and a hosted shared store is read-only to every site. Next to each compiled entry the store keeps the verified package and its attestation bundle, keyed by package digest. An entry counts as installed only when its package digest equals the pin and the bundle verifies offline (section 3), and then its manifest verifies; an entry that fails is never used in part (section 6). The `/_t/` handler serves the bytes verified when the entry was loaded, held in memory (at most 4 MiB per entry), never a fresh read by path. The built-in store is anchored by the image's own signature (`docs/operate/verify-image.md`).

An image carries a read-only **built-in store** with the themes of its `themes.lock.json`, filled by `theme:pull -- --frozen` before `nuxt build`. A deployment may add a writable **deployment store** (`MICELIO_THEME_STORE`). Unset, there is no deployment store: only built-in themes activate, the server installs nothing and logs one warning at boot, which says that `MICELIO_THEME_INSTALL` has no effect without a store. The Compose files gain an optional volume for it. A theme is looked up by compiled digest in the built-in store, then in the deployment store; equal digests mean equal bytes, so the order cannot change a page.

### 2. Install

One function, `installTheme(source)` (#400, proposed in `modules/theme/install/`): **check the pin** → **pull** (the client of #310) → **verify** (section 3) → **safe unpack** (`modules/theme/registry/unpack.ts`, #309) → **validate** (the contract validator, split from `nuxt/kit` so it runs in Nitro and in plain Node, and the error-level checks of `theme:check`, the contrast matrix and the static budgets **(2026-10-19)**, because the registry of a fork may not run admission) → **compile** → **atomic write**. Nothing from a package is executed, imported, required or evaluated, at install or later. Its callers are `theme:pull`, the static builder (#315) and the Nitro server (#403).

**The pin is checked first.** Before any request or file system call, `themeId` matches `^[a-z0-9]+(-[a-z0-9]+)*$` with 1 to 64 characters (stricter than `THEME_ID` in `modules/theme/contract.ts`, which #309 tightens to match), `themeVersion` is strict semver without build metadata and at most 128 characters, and `themeDigest` matches `^sha256:[0-9a-f]{64}$`. The OCI reference is built only from these validated parts. A store path comes only from a validated digest and is checked, after resolution, to sit inside the store root. An invalid pin is logged and ignored, and the current theme stays.

**Safe unpack** (#309) accepts only:

- a compressed size under a cap checked before decompression, and a decompression ratio limit; trailing data or extra gzip members fail;
- regular files and directories (no symlinks, hard links, devices, FIFOs or sparse files), with names checked after pax and GNU long-name headers;
- no duplicate names, also after case folding and Unicode normalisation; path segments in `[A-Za-z0-9._-]`, none starting with a dot **(2026-10-19)**, none ending with a dot, none a Windows device name (`con`, `nul`, `aux`, `prn`, `com1` to `com9`, `lpt1` to `lpt9`, in any case, with or without an extension), each at most 255 bytes, with caps on depth and on the length of the whole path; directories count toward the 200 entries of ADR-0008;
- byte and JSON-depth caps on `theme.json` and the manifest, and a magic-byte check for woff2, png, jpg, webp, avif and gif.

**Verified bytes are the bytes used.** The digest is computed over the exact bytes unpacked: the same buffer, or a file created exclusively in a private `0700` temporary directory on the store's file system. Nothing is re-read by path after verification. One install per digest runs at a time, behind a lock file that the replicas of a shared store share; the lock records its owner and has a lease equal to the install timeout, and temporary directories are removed at boot. `O_EXCL` locks are unreliable on some network file systems, so #400 documents which file systems a shared store supports. The final directory is written by renaming the temporary one, and an existing one counts as installed only by the rule of section 1.

**Isolation.** A server install runs in a child process (`fork`) with `--max-old-space-size` and a `SIGKILL` at a wall-clock timeout, and at most one runs at a time. A `worker_thread` is not enough: `resourceLimits` cap only the V8 heap, and `terminate()` cannot interrupt a synchronous native call such as Lightning CSS (option H). A test compiles the largest stylesheet the caps allow and records its time and memory.

**`code` is decided from the unpacked files**, never from the manifest, and case-insensitively: any file outside the data-only allowlist of ADR-0008 decision 1 (as amended in section 10) makes the package a code theme, and so does a `.vue`, `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`, `.jsx`, `.tsx` or `.wasm` file anywhere. The allowlist's directory names match exactly, in lowercase.

**Compiling at install (epic)** produces, per package and compile key:

- `theme.css`: `fonts.css`, `font-fallbacks.css`, the role tokens (`tokens.mjs`), the mode-switch rules (`buildSegmentedCss`), the theme's `theme.css` and, for a code theme built into an image, its slot CSS, each in its named layer and lowered by Lightning CSS with the core's targets;
- `sections.css`, separate as today (only pages that render sections load it);
- `runtime.json`: id, version, both digests, contract, `code`, modes, fonts and preloads, images, layout, the display-family data, the palette and contrast rules (`palette.ts`), and the `theme.*` messages;
- `fonts/` and `images/` with the current allowlists, gzip and brotli next to each text file, and the integrity manifest.

**URLs.** A theme's source may use `url()` only towards `/fonts/…` and `/theme/images/…` (`css-rules.ts`, unchanged). The compiler rewrites them to `/_t/<digest>/…` on the parsed CSS tree, not on text, and a URL left unrewritten fails the install. The page CSP keeps allowing only `'self'` and the Strapi and media hosts.

**Messages.** Install rejects message keys outside `theme.`. The compiler emits an AST only, never JavaScript; the AST is validated on load (known node types, no `__proto__`, `constructor` or `prototype` keys, size caps). Theme messages never render through `v-html`.

**After a core upgrade.** Compiled output is tied to the compile key, and a new image builds its built-in store. In a deployment store, the active and last good themes are compiled again for the new key from their kept, verified packages, at boot, in the install process above, before the readiness check reports ready; these compiles do not count toward the install rate or the store cap. Entries of several compile keys may coexist, and the cleanup command removes the keys no image uses (open question 3). A hosted platform compiles a new key centrally before it rolls out the image that uses it.

### 3. Who may install, and the trust model

**(epic)** The Nitro server may install themes itself, behind a switch (proposed `MICELIO_THEME_INSTALL`) that is **on by default**. A hosted platform turns it off and installs centrally into a shared, read-only store. With the switch off, only themes already in a store activate; a missing one is reported, never downloaded.

What a server install enforces (#403, reviewed by the `security` agent). A failed check is a refused install, never a warning:

- **One registry**: only `MICELIO_THEME_REGISTRY` (ADR-0008 decision 3), which falls under `insecureUpstream` ([ADR-0011](0011-refuse-plain-http-upstreams.md)). More than one registry per instance is out of scope.
- **Verification of every package**, not only official ones: (a) the registry index lists `<id>@<version>` with the same digest and status `published`, or `yanked` only when that digest is this site's active, last good or locked theme; an `incompatible` version is refused by the same rule, on purpose. (b) The provenance attestation of the publish workflow verifies offline against the expected signer identity, with the bundle's transparency-log inclusion proof and signed timestamp. (c) The index's own signature verifies. With a `MICELIO_THEME_REGISTRY` other than the default, the operator also sets the expected signer identity (section 9), or the server refuses to install.
- **Trust root and identity**: the default signer identity is a constant of the core: the issuer, repository, workflow path and ref of the publish workflow, matched exactly. The trust root (Sigstore `trusted_root.json`) ships in the image and is refreshed in every core release; when it no longer verifies a bundle, install fails closed with a message that names the upgrade. Revoking the publish identity takes a core release with a new root, and until then yanking in the index is the only kill switch. Signing the index with an identity separate from the publish workflow is open question 5.
- **Pulling a theme off a site**: ADR-0008 has no index status that removes an already-installed theme from a site (`yanked` only stops new installs). This is a note for #312 and #400, not a decision of this record.
- **The pinned digest** (section 5) must equal the digest pulled; a blob is accepted only after its digest verifies.
- **Transport**: redirects only for blob `GET`s, only to `https`, with a hop limit, and `Authorization` is never forwarded across hosts. The token realm must be `https` and on the registry host or on an allowlisted host; the allowlist is a constant per known registry, not a variable. A redirect to a loopback, link-local or private address is refused after DNS resolution (the configured registry itself may be private). Every download has a total timeout.
- **Size caps** of ADR-0008 decision 1 (4 MiB unpacked, 1 MiB per file, 200 entries) and the unpack rules of section 2.
- **No code**: a server install refuses any entry under `slots/` or `templates/` and any other file that section 2 counts as code, whatever the manifest says (section 4).
- **Contract validation and the error-level checks of `theme:check`** (section 2); a theme that fails never reaches the store.
- **Limits**: the store has a cap on entries and on total bytes; at the cap an install is refused and logged, and a request never evicts anything. A failed pin is not retried before an exponential backoff, and installs are rate limited per hour. The backoff state lives in memory, keyed by a hash of the pin, in a bounded LRU: a restart resets it, and with N replicas the effective rate is N times the limit.
- **Off the request path**: install runs in the background, pages keep the current theme until the new one is in the store, and a registry outage changes nothing already installed.
- **Licensed versions**: a server install of licensed versions (ADR-0008 decision 9) is out of scope for this record.
- **What is logged and shown**: logs never contain registry tokens, licence keys or URL queries, and the rejection reason shown in the CMS carries no file system path.

**Who may change the theme (2026-10-19).** Only the CMS admin role (Super Admin), from the site settings in Strapi. Editor and Author cannot, and no API token can: the tokens of `api-tokens.ts` stay `find` only. Changing the theme is therefore a privileged permission, since it decides what the server downloads and installs, and it is documented as such in `docs/security.md` and in `micelio-cms`. bogd3v/micelio-cms#97 removes update of `site-setting.theme` from Editor and Author (a field permission if Strapi can restrict that field, otherwise update of `site-setting`) through an idempotent migration or bootstrap step, with tests of who can and who cannot change it (standard, section 9).

**Tiers (proposed, not yet confirmed by the user).** Which tiers of ADR-0008 decision 7 a server installs is open question 4.

### 4. Data-only and code themes

**(epic)** A package is a code theme when it ships `slots/` or `templates/` (ADR-0008 decision 1); the installer decides it from the unpacked files (section 2).

- A **data-only** theme activates at runtime on any image whose core implements its contract (#308).
- A **code** theme activates only on an image built with it: pinned in that image's `themes.lock.json`, its slots compiled in by the Nuxt build (#402). "Built with it" means the same id and package digest as the lock; another version of the theme is another theme.
- Activating a code theme the image was not built with is **rejected with a reason**. It never falls back to the core's default slots, so a theme looks the same on every image. A dynamic site keeps its current theme (#403); a static generation fails and the last good site stays published (#315).

Slots stay at build time until declarative slots exist (out of scope in #316).

### 5. The pin

**(epic)** The pin of a runtime theme is an **exact version plus its digest**, stored in Strapi: `themeId`, `themeVersion` and `themeDigest` of `site.theme` (bogd3v/micelio-cms#97). No ranges and no "latest": publishing an article must never change how a site looks. An empty `themeId` means the instance's default theme. The frontend checks the grammar of the three fields before using them (section 2), whatever Strapi validated. `themes.lock.json` stays the pin of what an image is built with (ADR-0008 decision 6).

### 6. How the core reads the active theme

- **`NUXT_PUBLIC_THEME`** becomes the instance's **default theme**: a bare id among the themes of the built-in store, used when the site settings name none. It is read at runtime; `themeMismatch` and its boot check go away (#401). A value that names no installed theme stops the boot with a message that names it (standard, section 5).
- **Active theme**: the server resolves `site.theme` into one server state that every reader uses (`/api/site` and the render hook), and keeps the last good theme on failure (#403). The site-settings cache (`siteCacheSeconds`) plus the install time bound how fast a switch is seen.
- **Data**: `runtime.json` replaces the `#micelio/theme*` virtual modules and the theme part of `#micelio/display-fonts`. It is parsed with a zod schema that uses the validator's grammars (ids in `[a-z0-9-]`, font file names, image paths, the message AST of section 2), after the integrity manifest verifies (section 1). Every value that reaches HTML is re-derived from that schema and escaped; today `server/plugins/themeMode.ts:31` and `server/utils/displayFonts.ts:111` interpolate build-time constants as they are, which is no longer safe once the values come from a store. An entry that fails either check is never used in part: it is logged, the last good theme or the default stays, and nothing of it is served under `/_t/`. The client gets the parsed data in the payload. Theme messages are merged per request, never sharing message objects between requests (#401).
- **CSS**: the compiled theme CSS leaves the entry bundle and is linked from `render:html`. Lightning CSS drops the `@layer` order statement when it bundles every layer (ADR-0005 section 3), so the statement goes **inline, first in `<head>`**, as a `<style>` before any stylesheet.
- **Layout variants**: all ten variants (`app/theme/layout/<region>/`) are in the build, and the component and the CSS of each load only when the active theme uses it (#402). The `:root` and `html` rules of the header variants (`--myc-header-h`, `scroll-padding-top`) move under an attribute on `<html>`.
- **Slots**: the slots of every code theme in the lock are compiled in and chosen by the id and package digest pinned in the image's `themes.lock.json`, never by the `/_t/` digest or by anything in a store. Any other theme renders `app/theme/defaults/` (#402).
- **Init script (epic)**: theme-independent. It reads the modes from an attribute on `<html>` that `themeMode.ts` writes, and stays in the build-time head, because the render hook runs after the CSP has hashed the scripts.

### 7. Static and landing modes

The builder reads `site.theme` with the read-only `build` token before `nuxt generate`, checks the pin (section 2), installs the pinned theme with `installTheme()` and copies `/_t/<digest>/` into the output (#315). An empty `themeId` uses the builder's default. An unknown id or version, a digest mismatch, a failed verification, or a code theme the builder image lacks fails the generation with a message that the rebuild webhook surfaces, and the last good site stays. The resolved id, version and digests are written into the output for audit. `/_t/*` joins the immutable paths of `_headers` (`app/helpers/staticBuild.ts`) and gets a sandbox rule like `/_media/*`. A landing is a static build with a content profile ([ADR-0006](0006-site-modes.md)) and resolves the theme the same way.

### 8. Cache and CSP

- **`/_t/<digest>/**`** is served by a Nitro handler from the stores (#401). It validates the digest grammar and serves only the digests the site has active, last good or locked (see open question 6). It serves only files listed in that entry's integrity manifest, through a map lookup, never by joining the request path. The content type comes from a fixed table of extensions (CSS with `charset=utf-8`). Every response has `nosniff` (`SECURITY_HEADERS`) and the `STATIC_CSP` that `/fonts/**` and `/theme/images/**` have today, and `Cache-Control: public, max-age=31536000, immutable`. A precompressed file is sent only when negotiated, with `Vary: Accept-Encoding`. An unknown digest and an unknown file get the same 404.
- **Pages** ([ADR-0001](0001-isr-without-cdn.md)): ISR stores HTML that names the theme's stylesheet, preloads and attributes, so a switch purges the page cache and the cache key includes the theme digest, and a render in flight cannot store the old theme again (#403).
- **CSP** ([ADR-0004](0004-hash-based-csp.md)): no new origin, since `/_t/` is `'self'`. `script-src` keeps its shape: the theme-independent init script has one hash per core build instead of one per theme build. The inline `@layer` statement and `#theme-overrides` are styles, allowed by `style-src 'unsafe-inline'`; if `style-src` is tightened they get hashes in the same `render:html` hook. Static builds keep one policy for every page.
- **#313 (epic)**: the byte-identical init script and CSP hash of ADR-0008 decision 10 are no longer required. Zero visual diff and the same budgets prove BogDev unchanged; the init script and its hash change once, in #401.

### 9. Operator interface (standard, section 6)

| Variable | Meaning | Change |
| --- | --- | --- |
| `MICELIO_THEME_STORE` (proposed) | Directory of the deployment store; unset, only built-in themes activate (section 1) | New, optional |
| `MICELIO_THEME_INSTALL` (proposed) | Whether the server may install themes; on by default | New, optional |
| `MICELIO_THEME_REGISTRY` | The one registry the server and the clients pull from (ADR-0008) | Also read at runtime |
| `MICELIO_THEME_REGISTRY_IDENTITY` (proposed) | The signer identity expected for the attestations and the index of a non-default registry; without it the server installs nothing from that registry | New, required with a non-default registry |
| `NUXT_PUBLIC_THEME` | The instance's default theme, read at runtime | Changed meaning: `!` and upgrade notes |

The Compose files gain an optional volume for the deployment store. Each goes in `.env.example` and `docs/operate/configure.md` in the pull request that introduces it.

### 10. What this record amends

The amended records are not rewritten; each gets a pointer amendment.

- **ADR-0008 decision 1**: the allowlist gains what Bogotá ships and the list omits: `slots/*.css`, `slots/*.ts`, `fonts/*.txt` and subfolders of `images/` (`images/**`, the types of `IMAGE_FILE` in `modules/theme/assets.ts`).
- **ADR-0008 decision 3**: "the same storage is what serving themes at runtime would use later" no longer holds: the browser reaches only the site's own store (section 1).
- **ADR-0008 decision 6**: "a different theme always means a different build" and "the pin is not stored in Strapi for dynamic images (the theme must be known before Nuxt builds)" hold only for code themes. A data-only theme's pin is in Strapi, exact (section 5), and the builder takes it as stored instead of resolving it.
- **ADR-0008 decision 10**: the byte-identical init script and CSP hash are dropped; `NUXT_PUBLIC_THEME` changes meaning (section 9); "only the active theme reaching the bundle" becomes "no theme CSS or data in the bundle, only the slots of the locked code themes".
- **ADR-0008 decision 7**: a server install adds the checks of sections 2 and 3 (pin grammar, index, attestation and index signature for every tier, unpack rules, no code).
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

### H. Install in a `worker_thread` with `lightningcss-wasm`

**Pros:** no child process, and the memory of the WebAssembly instance is bounded. **Cons:** slower, and a second build of Lightning CSS to pin, whose output must stay identical to the native one the core build uses (the compile key). Recorded as the alternative to the child process of section 2.

## Trade-offs

- The runtime image grows. New production dependencies, each justified in #400 or #403 as the standard, section 10, asks: `lightningcss` (its Linux x64 binary is 9.6 MB in `node_modules`, MPL-2.0) and `@intlify/message-compiler` (540 KB, MIT), devDependencies today; an OCI client, unless the `fetch` client of #310 suffices; and a sigstore verifier for the offline attestation check. A WASM or native verifier is pinned exactly.
- A writable store is state: a volume to keep or rebuild, shared or per replica, and a cache to clean.
- The theme CSS becomes a second stylesheet request. With 0.1 KB of CSS margin on Bogotá's dynamic pages, any byte the split adds has to fit, or the baseline moves with numbers in `docs/performance.md`.
- The server downloads what a CMS field names. The checks of sections 2 and 3 are what keep that safe, and each needs its own tests.

## Consequences

- **#308** (`modules/theme/constants.ts`, `contract.ts`, `validate.ts`, `docs/themes/contract-changelog.md`): contract minors decide whether a store theme activates on a core.
- **#309** (a `theme:pack` script in `scripts/`, `modules/theme/registry/unpack.ts`, `modules/theme/contract.ts`, `dist/themes/`): the amended allowlist and `code` in the manifest.
- **#310** (`modules/theme/registry/`, `themes.lock.json`, `Dockerfile`): `theme:pull` also fills the built-in store.
- **#400** (`modules/theme/install/` with its `types.ts` and `constants.ts`; the split of `validate.ts`, `contract.ts`, `data.ts`, `hooks.ts`, `tokens.mjs`, `palette.ts` and `modes.ts`; `package.json`; `.env.example`, `docs/operate/configure.md`, `docs/security.md`, `docs/themes/`): `installTheme()` and the store.
- **#401** (`server/plugins/themeMode.ts`, `server/plugins/runtimeConfigCheck.ts`, `app/helpers/runtimeConfig.ts`, `modules/theme/init-script.mjs`, `css.ts`, `data.ts`, `assets.ts`, `display-fonts.ts`, `app/assets/css/main.css`, `app/components/section/SectionRenderer.vue`, `server/utils/theme.ts`, `displayFonts.ts`, `site.ts`, every consumer of `#micelio/theme`, a route for `/_t/` under `server/routes/` with its entry in `server/openapi/`, `scripts/perf/`): the core reads the theme from the store.
- **#402** (`modules/theme/layout/variants.ts`, `modules/theme/slots.ts`, `app/theme/layout/`, `app/theme/defaults/`, `app/pages/blog/index.vue`, the header variants' CSS): variants and slots chosen at runtime.
- **#403**, **#315**, **#313** and bogd3v/micelio-cms#97 follow sections 4 to 8.
- **#403** (`docs/security.md`) and **bogd3v/micelio-cms#97** (its `SECURITY.md` and the token and role documentation) record that only the Super Admin role may change the theme (section 3). #97 removes update of `site-setting.theme` (or of `site-setting`, if Strapi cannot restrict the field) from Editor and Author through an idempotent migration or bootstrap step, grants it to no API token, and adds the tests of who can and who cannot change it.
- **`docs/security.md`**, updated by #400, #401 and #403 as each lands: the theme entries at lines 184 (init script), 190 (build-time, operator-trusted inputs), 191 (Strapi theme overrides), 192 (`/theme/images/`), 193 (theme messages), 195 (startup check), 196 (`/fonts/`) and 198 (trust model), and the ASVS rows whose judgement changes: V1.3.5, V1.3.6, V1.3.7, V5.1.1, V5.2.1 to V5.2.3, V5.3.1, V5.3.2, V8.4.1, V12.3.1, V13.1.1, V13.2.4, V15.1.2, V15.2.2, V15.3.2 and V16.5.3.

## Open questions

Each has a recommendation; the pull request that implements it records the answer as an amendment here.

1. **Where variant CSS lands.** *Recommendation:* the core's CSS for the variants the theme chose is compiled into the theme's stylesheet at install, in `myc.layout` and `myc.pages` after the core rules of each layer as today, so a page still makes one theme request and loads only its variants (#402).
2. **Theme images through IPX.** `image.dirs` is fixed at build. *Recommendation:* the built-in store joins `image.dirs` for code themes (Bogotá's `ThemeHero`); the images of a data-only theme are served as files from `/_t/`.
3. **Store cleanup and the values of the limits.** Section 3 fixes that the store has caps, a backoff and an hourly rate, and that a request never evicts. *Recommendation:* the active, last good and locked themes are never removed, and anything else (compile keys no image uses included) only by a command; the numbers (entries, total bytes, installs per hour, the backoff ceiling, the download timeout) are set in #403 from Bogotá's measured size, with headroom, like the caps of ADR-0008.
4. **Which tiers a server installs** (proposed, not yet confirmed by the user). A server install puts a third party's data-only theme on a site. *Recommendation:* a `MICELIO_THEME_TIERS` variable, default `official,verified` (the tiers of ADR-0008 decision 7, matching what hosted builds accept), and a package of any other tier is refused at install.
5. **A separate identity for the index.** As written, the publish workflow would sign both the packages and the index. *Recommendation:* sign the index with an identity of its own (a separate workflow in a protected environment), so a compromised publish workflow cannot also vouch for the index.
6. **Digests from before a switch.** HTML cached before a switch (ISR, an open tab) asks for a digest that is no longer active, and section 8 answers 404. *Recommendation:* also serve the site's previous two digests for the longest ISR window plus the site-settings cache (3600 s + 60 s), then drop them from the served set.
