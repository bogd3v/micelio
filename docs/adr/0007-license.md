# ADR-0007: License Micelio under AGPL-3.0-only, with a theme exception and DCO

**Status:** Proposed
**Date:** 2026-10-06
**Deciders:** BogDev maintainer

## Context

Micelio (this frontend and `micelio-cms`) is published under MIT. The next step is offering hosted Micelio sites (#240, licensing phase). MIT allows anyone to take the engine, improve it and run it as a closed hosted service, without giving the changes back.

The relicense can be done cleanly now: the only human contributor is the maintainer (the rest of the history is Dependabot), so no other copyright holder has to agree. That stops being true with the first outside contribution, because every contributor keeps their copyright.

Two more facts shape the decision:

- Themes are a product of their own (#320). Theme authors, including commercial ones, need to know whether a theme built for Micelio must be AGPL. The theme contract (ADR 0005) already defines a narrow public interface: `theme.json`, `theme.css` on public hooks, layout variants and a closed list of slots.
- The repository and every running site contain material that is not Micelio's: npm dependencies, OFL fonts, CC BY-SA photos, other projects' logos, and the content each site publishes from its CMS. None of that is the contributors' to license.

## Decision

### 1. AGPL-3.0-only

Both repositories are licensed under the **GNU Affero General Public License, version 3 only** (`AGPL-3.0-only`). `LICENSE` holds a short notice and then the full, unmodified text from gnu.org. Copyright line: `Copyright (C) 2026 Alejandro Ramirez Garcia and the Micelio contributors`. BogDev is a site running Micelio, not a legal entity, so it is not the holder. If a company is formed later, the maintainer's copyright can be assigned to it; the line changes then.

`-only`, not `-or-later`: a future AGPL version cannot change the terms without the contributors' choice.

`package.json` declares `"license": "AGPL-3.0-only"` and stays `"private": true`. The backend (bogd3v/micelio-cms#96) does the same and links to this record.

### 2. Source offer (section 13)

Every running site links to its source in the footer, in both footer layout variants: the "Source code" link points at `runtimeConfig.public.sourceUrl`, by default the upstream repository (`https://github.com/bogd3v/micelio`), and is overridden per site with `NUXT_PUBLIC_SOURCE_URL`. An operator who runs a modified Micelio points it at the source of their version. There is no BogDev value in the code. Themes may restyle the link (public hook `bd-foot-source`) but must keep it visible (amendment of 2026-10-06 to ADR 0005, section 5).

### 3. Theme exception

An additional permission under AGPL section 7, in `LICENSE-EXCEPTION.md` (`LicenseRef-Micelio-Theme-exception`), referenced from `LICENSE` and the README. A theme that interacts with Micelio only through the theme contract is not covered by the AGPL and may be distributed under any license, including a proprietary one, also when it is built into a site together with Micelio. Changes to Micelio itself, including to the contract, stay under the AGPL, and a theme that reaches Micelio outside the contract (internal components, composables, non-public classes) is not covered by the exception.

The exception is added now, not later, because with DCO every contributor keeps their copyright: adding it after the first outside contribution would need everyone's agreement. It must be reviewed by a lawyer before this record is accepted.

The contract becomes a license boundary, so it must match what the tooling produces. Two consequences:

- The contract lists the **slot APIs** (the composables, helpers and types a slot may import; amendment to ADR 0005, section 5), because slots already use `useSite()`, `useAnimations()` and `~/helpers/categories`, and a theme that used them would otherwise fall outside the exception.
- `themes/starter/`, which `npm run theme:new` copies, is licensed under **MIT-0**, so a theme started from it is not a copy of AGPL code and can take any license. `themes/bogota/` stays AGPL: a theme that copies it is AGPL too.

The exception is a condition, not a new duty: it applies only while the site keeps the source link of section 2.

### 4. Third-party material is outside the licensing

The AGPL and the theme exception cover only the work of Micelio's contributors. Third-party material is not relicensed and does not count in Micelio's licensing: dependencies, fonts, images, logos and trademarks keep their own licenses (the Micelio and BogDev names and marks are the maintainer's, and no trademark rights are granted, AGPL section 7(e)), and the content a site publishes (articles, pages, images, comments, settings) belongs to its authors. `THIRD-PARTY.md` says so and lists the material in the repository with its source and license; whoever adds third-party material lists it there and keeps its license file next to it.

### 5. Dependencies

`npm run lint:licenses` (`scripts/check-licenses.mjs`, part of `npm run lint`, which CI runs on every PR) reads `package-lock.json` and fails when a production dependency's license is not on an allowlist of AGPL-3.0-compatible licenses (MIT, MIT-0, ISC, BSD, 0BSD, Apache-2.0, MPL-2.0, CC0, CC-BY, Unlicense, BlueOak, Python-2.0, Zlib, OFL-1.1, LGPL, GPL-3.0, AGPL-3.0). SPDX expressions are evaluated (`OR` passes if one side is allowed, `AND` needs all). Dev-only dependencies are not distributed and only warn. Per-package exceptions, each with a reason, live in `scripts/licenses-allow.json`.

Known exception: `elkjs` (EPL-2.0), pulled in by `mermaid` and loaded only on articles with diagrams, as a separate, unmodified file sent to the browser. It stays under the EPL-2.0 (section 4), and `THIRD-PARTY.md` says where its source is, as EPL section 3.2 asks; the legal review should confirm this is enough.

### 6. Contributions under DCO

Outside contributions are accepted under the AGPL with the **Developer Certificate of Origin**: every commit carries `Signed-off-by` (`git commit -s`), checked by `.github/workflows/dco.yml` on every PR. No CLA: contributors keep their copyright, which also means dual licensing (selling a non-AGPL license of Micelio) is not an option. `CONTRIBUTING.md` explains it.

### 7. No SPDX headers yet

Source files do not carry `SPDX-License-Identifier` headers. `LICENSE` at the root covers the repository, and adding a header to every file is noise without a tool that needs it. Revisit if files start being copied out of the repository on their own (for example, themes generated from `themes/starter/`).

## Options considered

### A. AGPL-3.0-only with a theme exception and DCO (chosen)

Keeps the engine and every modification of it open, also when it is only offered as a service, and gives theme authors a clear rule from day one.

### B. Stay on MIT

Simplest for adopters, but a hosted, closed fork is allowed, which is exactly what the hosting plan needs to prevent.

### C. GPL-3.0

Copyleft only on distribution. A site offered as a service is not a distribution, so the hosting case stays open as with MIT.

### D. AGPL with a CLA

Lets the holder sell non-AGPL licenses (dual licensing), but asks contributors to assign or license their copyright, which discourages contributions. Not worth it for a project that does not plan to sell licenses of the engine.

### E. Source-available license (BSL, ELv2, SSPL)

Protects hosting more directly, but is not open source, and that is part of what Micelio is.

### F. No theme exception, themes are AGPL

Clear, but it closes the door to paid or proprietary themes (#320) and leaves the "is a theme a derivative work?" question to be argued case by case. WordPress shows the cost: themes there are split between GPL code and freely licensed assets, by convention rather than by a rule written in the license.

## Trade-offs

- Some companies avoid AGPL software altogether, so adoption by them is less likely than under MIT.
- The theme exception is a custom text. It needs legal review and may need wording changes; the contract (ADR 0005) becomes a legal boundary as well as a technical one, so widening or narrowing it changes what the exception covers.
- DCO adds a step (`-s`) to every commit, also for the maintainer and for commits made by agents on their behalf.
- The license check trusts the `license` field of the lockfile; packages without one need a manual exception after reading their license file.

## Consequences

- `LICENSE`, `LICENSE-EXCEPTION.md`, `THIRD-PARTY.md`, `CONTRIBUTING.md`, `package.json` and the README's License section change in this repository; `micelio-cms` follows in bogd3v/micelio-cms#96.
- The footer renders the source link in every layout variant, and ADR 0005 says themes keep it.
- New third-party material is listed in `THIRD-PARTY.md`; new production dependencies must pass `npm run lint:licenses`.
- Branch protection on `main` should require the `DCO` and lint checks (a repository setting, done by hand).

