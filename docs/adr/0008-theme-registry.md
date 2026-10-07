# ADR-0008: Theme registry, versioned theme packages outside the core

**Status:** Accepted
**Date:** 2026-10-07
**Deciders:** BogDev maintainer

## Context

A theme lives in `themes/<id>/` in this repository and is chosen at build time with `NUXT_PUBLIC_THEME` ([ADR-0005](0005-theme-contract.md), section 4). That is right for one site, but not for many:

- Every new theme is a PR to the core, so there can be no third-party or catalog themes.
- A theme's visual baselines, budgets and fixes live in the core's CI, which grows with every theme (`docs/performance.md`: the perf matrix runs once per installed theme and site mode).
- A theme has no version of its own: a site cannot pin `bogota@1.2.0` and upgrade on its own schedule.

ADR-0005 deferred this ("publishing themes or Micelio on npm is decided later, with its own ADR"). Three facts shape the answer:

- [ADR-0007](0007-license.md) made the contract a license boundary: a theme that uses only the contract may take any license, proprietary included. Paid themes (#320) are therefore possible and need private distribution.
- ADR-0005 section 12 is explicit that the island rule is a lint, not a sandbox: slots run at build time and during SSR with the operator's trust. Today the operator is also the author. A registry separates the two.
- The core image is already published to GHCR (`ghcr.io/bogd3v/micelio`) by GitHub Actions, with the org's permissions.

The registry is tracked in epic #316; this record is its first issue (#307).

## Decision

Themes become **versioned, immutable packages** in a registry. A build pins exact versions in a lockfile and installs only from it. The checks that already guard every installed theme become the gate to publish. Only the active theme reaches the bundle, as today.

### 1. Theme package

A package is the theme folder of ADR-0005 section 4, packed by `npm run theme:pack <id>` (#309):

- **Contents**: an allowlist of the files of that layout (`theme.json`, `theme.css`, `sections.css`, `fonts.css`, `font-fallbacks.css`, `fonts/*.woff2`, `images/*`, `i18n/*.json`, `slots/*.vue`, `templates/*`) plus `README.md` and `LICENSE`. Anything else fails the pack, naming the file. Visual baselines stay with the theme's source, not in the package.
- **Manifest**: id, name, version, contract (declared and used, decision 2), license, whether it ships code (`slots/` or `templates/`), and every file with its size and sha256.
- **Deterministic**: sorted entries, fixed mtime, owner and mode, gzip without a timestamp, so packing twice gives the same digest.
- **Size cap**: at most **4 MiB** unpacked, **1 MiB** per file and **200** files. Measured on 2026-10-07, Bogotá is 1,022,396 bytes in 33 files, the largest `images/hero/sumapaz-day.jpg` at 363,250 bytes (925 KB as a plain `tar.gz`), so the cap leaves about four times its size. The static budgets of ADR-0005 section 9 still apply to what reaches a page; the cap stops a package carrying assets those budgets never see.
- **Immutable**: a published `<id>@<version>` never changes; a fix is a new version.
- **Version and license**: `theme.json` gets `version` (semver, per theme) and `license` (any SPDX id or `LicenseRef-*`, proprietary included, as the theme exception of ADR-0007 allows). Both are optional for a local theme and required to pack. Official themes are `AGPL-3.0-only`, like the core.

### 2. Compatibility

The contract gets minor versions (#308). `contract` in `theme.json` takes `1` (meaning `1.0`) or `"1.N"`; `modules/theme/contract.ts` exports the version the core implements. The validator computes the minimum minor a theme uses (slots, layout variants, optional roles, hooks) and fails when the theme declares less, so the declaration cannot lie. The build fails when a theme needs a newer minor or another major than the core implements. What each minor added is listed in `docs/themes/contract-changelog.md`; adding to v1 now means bumping the minor. ADR-0005 section 6 still decides what is a major.

### 3. Where packages live

Two backends, behind one client interface in `modules/theme/registry/` (`resolve(id, range)`, `fetch(id, version) → dir`), so the build never knows which one served a package:

- **Public themes: OCI artifacts in GHCR**, `ghcr.io/bogd3v/micelio-themes/<id>:<version>`, pushed with ORAS. Same registry and permissions as the core image, content-addressed digests, provenance attestations (`actions/attest-build-provenance`) and referrers for the admission report. Public packages need no credentials to pull. `MICELIO_THEME_REGISTRY` selects the registry (default `ghcr.io/bogd3v/micelio-themes`), so a fork or a mirror can use its own.
- **Licensed themes: S3-compatible object storage** (Hetzner Object Storage), private, downloaded through short-lived presigned URLs issued by a licensing service (decision 9). GHCR's private packages only accept tokens of GitHub users, so they cannot give one credential per customer. The same storage is what serving themes at runtime would use later (Out of scope).

npm was considered and rejected (option C).

### 4. The index

One `index` artifact (`ghcr.io/bogd3v/micelio-themes/index`) lists every theme and version with its digest, contract, license, tier, distribution (`public` or `licensed`), status (`published`, `yanked`, `incompatible`) and the link to its admission report. Licensed versions are listed without a download location. Its JSON Schema (`themes/registry-index.schema.json`) is generated from zod, like `themes/theme.schema.json`, and checked for drift by `npm run lint`. Only the publish workflow writes it, in a concurrency group so two publishes cannot race (#312).

`yanked` versions stay pullable for locks that already pin them but are never resolved for a new range; `incompatible` marks versions that fail a later core release (#314).

### 5. Admission

The checks that today run for "every installed theme" become the gate to publish (#311, #312): the contract validator, `theme:check` (contrast matrix, hooks, static budgets), the performance budgets per site mode (ADR-0005 section 9, ADR-0006), visual regression and axe on `/_theme`. A version that fails is never published. The admission report (check results and budget numbers) is stored with the version as an OCI referrer and linked from the index. Admission runs as a reusable workflow (`theme-admission.yml`), so official themes and creators run the same thing.

### 6. Lockfile and where the pin lives

`themes.lock.json` pins each theme a build may use: `{ "<id>": { "version", "digest", "contract", "tier", "distribution" } }`. The build installs only from the lock (`npm run theme:pull -- --frozen`, #310) into `.micelio/themes/<id>/` (gitignored), verifying the digest and provenance before the safe extraction of decision 7; it fails if the lock is missing, unsatisfiable or would change. `NUXT_PUBLIC_THEME` keeps taking a bare id and selects one of the locked (or local) themes; the version always comes from the lock. Discovery order is `themes/`, then `.micelio/themes/`, then `MICELIO_THEME_DIRS`; a local theme with the same id as a locked one wins with a notice in dev and is an error with `CI=true`.

**Where the pin lives** (decided here): **the lock lives in the repository that runs the build**.

- **The core repository** holds the default `themes.lock.json`. It pins the themes the published image `ghcr.io/bogd3v/micelio` is built with (after #313, `bogota@1.0.0`), names themes and never a site, and changes by PR like any dependency. BogDev runs that image, so its pin is the core's default lock and nothing about its deployment changes.
- **An instance that needs another theme or version** builds its own image from an **instance repository**: a core release tag, its own `themes.lock.json` replacing the core's, and its own `NUXT_PUBLIC_THEME`. The core's Dockerfile reads the lock from the root of its build context, so replacing the file is the whole integration; no new variable points at a lock. The theme is bundled at build time (ADR-0005, amendment of 2026-10-06 to section 8), so a different theme always means a different build.
- **Static sites built by the builder** (#315) take the pin from the site settings (`themeId`, `themeVersion`, bogd3v/micelio-cms#97), resolved to an exact version and digest at generate time with the same client; the resolved id, version and digest are written into the output. With no `themeId`, the builder's default lock applies.

The pin is not stored in Strapi for dynamic images (the theme must be known before Nuxt builds) and not in `NUXT_PUBLIC_THEME` as `id@version` (decision 10).

### 7. Trust

A registry changes who installs code: a slot (and a template) runs at build time and during SSR, and the island rule is a lint, not a sandbox (ADR-0005 section 12). Packages that ship code (`slots/` or `templates/`) are therefore gated by tier, recorded in the index and the lock:

| Tier | Who | Code (`slots/`, `templates/`) | Data-only versions |
| --- | --- | --- | --- |
| `official` | Published from a bogd3v repository | Allowed | Publish after admission |
| `verified` | A creator whose identity bogd3v verified (a list kept in bogd3v) | Reviewed on the first publish and whenever code files change | Publish after admission, no review |
| `community` | Anyone else | Reviewed in the same queue, not rejected | Publish after admission, no review |

- **Signatures**: verified creators sign packages with sigstore, keyless, with the identity of their CI; every published package also carries the provenance attestation of bogd3v's publish workflow. `theme:pull` verifies them against the identity in the index and fails otherwise.
- **Review** is limited to the diff of the code files since the creator's last published version, so data-only releases (roles, CSS, fonts, images, messages) never wait. It stays the price of running a third party's code in SSR until slots can be declarative.
- **Hosted builds** (Micelio Cloud, the builder of #315) accept code only from `official` and `verified` packages.
- **Supply chain**: digests are pinned in the lock; no scripts of any kind run from a package (there is no install step and no `package.json`); extraction (`modules/theme/registry/unpack.ts`, #309) re-checks the allowlist, rejects symlinks, hard links, executable bits and paths outside the folder (parent segments or absolute paths), and verifies every sha256 against the manifest.

### 8. Third-party publishing

A creator's source never has to be public or live in a bogd3v repository. They run the admission workflow in their own (private) CI to iterate (#311), then `npm run theme:submit` sends the package. bogd3v re-runs admission itself, because a creator's own report is never trusted, and publishes the version if it passes (#312). Budget **errors** block, as for official themes; **warnings** do not block and are shown with the version. Themes that meet the targets of `docs/performance.md`, not only the limits, may be highlighted in the catalog.

### 9. Licensed themes

A version is `public` or `licensed`. A licensed version is installed with a license key (`MICELIO_THEME_LICENSE`, never stored in the lock or a repository) exchanged by the licensing service for a short-lived presigned download (#320); the digest in the lock is verified the same way. On Micelio Cloud the platform holds the license for the customer. Being paid exempts no theme from admission or from the trust rules of decision 7.

### 10. What does not change

`NUXT_PUBLIC_THEME` (a bare id), `MICELIO_THEME_DIRS`, the image `ghcr.io/bogd3v/micelio`, only the active theme reaching the bundle, the theme contract of ADR-0005, and BogDev looking and measuring exactly the same: zero visual diff, the same budgets and a byte-identical init script and CSP hash (#313). `themes/starter/` stays in the core as its in-repo theme for tests, offline `nuxt dev` and the CI fixture.

### Out of scope (later options)

- **Loading themes at runtime**, so one server serves many themes. It needs declarative slots and amendments to the CSS layer order, the CSP hash of the init script ([ADR-0004](0004-hash-based-csp.md)) and the font preloads; it gets its own ADR once there are dynamic multi-site customers.
- Payments, revenue share and a public catalog page, which come with the hosting epic.

## Options considered

### A. GHCR for public themes, S3 for licensed, behind one client (chosen)

| Dimension | Assessment |
| --- | --- |
| Integrity | Content-addressed digests, attestations and signatures verified on pull |
| Operations | GHCR reuses the org, permissions and Actions setup of the core image; S3 only for what must be private |
| Access | Anonymous pulls for public themes; per-customer, short-lived downloads for licensed ones |
| Cost | Two backends and a licensing service; ORAS in CI; an index to maintain |

### B. S3-compatible storage for every theme

**Pros:** one backend, private and public alike. **Cons:** no content addressing, attestations or referrers out of the box; the index, digests and provenance would be rebuilt by hand, and public pulls would go through presigned URLs or a public bucket with no permission model tied to the org.

### C. npm (`@micelio-themes/*`)

**Pros:** familiar to theme authors; semver ranges and lockfiles for free. **Cons:** it implies publishing the core as a package too, which it is not (`"private": true`); every package can carry install scripts, bringing them into the supply chain this record keeps out; licensed themes would need a private npm registry with per-customer tokens.

### D. GHCR private packages for licensed themes

**Pros:** one backend. **Cons:** pulls need a token of a GitHub user, so every customer would need a GitHub account with access or a shared token; neither works for a license per customer.

### E. Source repositories or GitHub Releases as packages

**Pros:** no new infrastructure. **Cons:** tags are mutable, there is no index, no immutable digest and no place for the admission report; private themes would need repository access per customer.

### F. Keep themes in the core

**Pros:** nothing to build. **Cons:** the three problems of the Context stay: no third-party themes, the core's CI grows per theme, and no theme versions.

### G. Put the version in `NUXT_PUBLIC_THEME` (`bogota@1.2.0`) or in Strapi

**Pros:** no lockfile. **Cons:** an environment variable or a CMS field cannot carry a digest that the build verifies, it changes the meaning of a public variable, and for dynamic images the theme must be known before Nuxt builds. The builder's use of `themeVersion` (decision 6) is resolved to a pinned digest before generating.

## Trade-offs

- More moving parts: a registry, an index, a licensing service, two backends and a review queue, where today there is a folder.
- A theme change for a dynamic site is still a rebuild and a new image; only static sites change theme without one (#315).
- Review of code puts a human in the publish path for third-party slots. Keeping it to the diff of code files makes it rare, but it is a queue someone must serve.
- The core's CI no longer proves every published theme on every PR; #314 re-checks published themes on each core release and marks the failures `incompatible`.
- Builds depend on the registry being reachable, mitigated by the local cache (`~/.cache/micelio/themes/<digest>`) and by `themes/starter/` staying in the core.

## Consequences

- #308 adds contract minors; #309 adds `version`, `license`, `theme:pack` and safe extraction; #310 the registry client, `themes.lock.json` and `theme:pull`; #311 and #312 the admission and publish workflows, the index and yanking.
- #313 creates `bogd3v/micelio-themes`, moves `themes/bogota/` and its baselines there, publishes `bogota@1.0.0` and pins it in the core's lock, with zero visual diff for BogDev.
- #314 re-checks published themes on each core release; #315 and bogd3v/micelio-cms#97 let the static builder take the pin from the site settings; #320 adds licensed themes.
- The Dockerfile runs `npm run theme:pull -- --frozen` before `npm run build`.
- `docs/security.md` gains the registry's trust model (tiers, signatures, extraction) and `MICELIO_THEME_REGISTRY` and `MICELIO_THEME_LICENSE`; `docs/themes/` gains a publishing guide.
- ADR-0005 section 4 is amended to point here: `themes/<id>/` stays the package layout, and a theme can now also come from the registry.
