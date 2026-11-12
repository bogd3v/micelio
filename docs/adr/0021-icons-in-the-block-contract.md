# ADR-0021: Icons as part of the block contract

**Status:** Accepted
**Date:** 2026-11-11
**Deciders:** Micelio maintainer
**Amended:** 2026-11-12: the Spanish labels of the index, section 2
(bogd3v/micelio-plugin-core#194)

Decided with the maintainer on 2026-11-07 and 2026-11-09 (bogd3v/micelio#869, epic bogd3v/micelio#872). The record follows the structure of [ADR-0018](0018-blocks-as-a-contract.md).

## Context

Blocks that show an icon today take it as an uploaded image: `section.feature-item.icon` is a Strapi `media`, rendered by `SectionMedia` at 64 px. Nothing else in the catalogue ([ADR-0018](0018-blocks-as-a-contract.md), section 6) has an icon at all: links, stats, plans, FAQ items, testimonials and the About blocks are text only. The core ships seven Heroicons for its own interface (`app/components/icons/`), none reachable from content.

That has four costs:

- **Every icon is a request and a file.** An uploaded SVG or PNG is served from the CMS uploads, counted against the page's weight budget as an image, and not inlined in the HTML of a static build.
- **Icons do not follow the theme.** An image uploaded for one theme keeps its colors and stroke on another; `currentColor`, the theme's roles ([ADR-0005](0005-theme-contract.md), section 1) and the contrast matrix do not reach it.
- **Editors have nothing to pick from.** Choosing an icon means finding, downloading, cleaning and uploading a file; in practice pages have no icons and look plain.
- **Themes cannot express a visual language in icons.** A theme creator who wants organic, hand-drawn glyphs has no path that keeps content portable.

The catalogue of blocks is about to grow (documentation blocks for the Micelio site, community and small-business blocks for the first node outside bogd3v) and most of the new blocks carry icons. Deciding where icons live before those blocks exist avoids a content migration per block later (ADR-0018, section 2).

## Decision

### 1. An icon is a name of the core's catalogue

An icon field in a block's `schema` stores a **name**, never a file: `icon: 'map-pin'`. The names are those of **Tabler Icons** at the version the block contract pins (`contract/icons.ts` in `micelio-plugin-core`: `{ set: 'tabler', version, names }`), without a semantic layer of Micelio's own. Tabler is chosen for coverage (the largest set of distinct concepts among the permissive sets, with outline and a filled alternate for about a thousand of them), for its one style (24 × 24, stroke, `currentColor`) and for its MIT licence (section 2, "The licence of the set").

A block that offers an icon declares it in the catalogue as `icon: { required: boolean }`. Where the icon stands alone, with no text beside it (a social link, an icon-only button), the schema also requires a `label`, which the core renders as the accessible name; where it accompanies text, the icon is decorative (`aria-hidden="true"`).

An `iconStyle` option (`outline`, `filled`) enters the options vocabulary of ADR-0018 section 1 as a MINOR, with `outline` as default; `filled` falls back to `outline` for a name that has no filled alternate.

### 2. The glyphs: the core draws every name, a theme may redraw any

The core ships every glyph of the pinned Tabler version as normalised SVG in `@micelio/icons`: `viewBox="0 0 24 24"`, no `width`, `height`, `class`, `id`, `style` or colour literal, stroke by `currentColor`, no stroke width (the theme sets it in CSS). The package carries an index (name, English and Spanish labels, category, aliases) for search.

A theme may ship its own drawing of any name under `icons/<name>.svg` in the theme package. The resolver that builds a page's sprite looks up each used name **in the active theme first, then in the core**. A theme never has to cover every name and can never leave a name without a glyph; a theme that ships no `icons/` renders the core's set. The names a theme may draw are exactly the core's: a file under `icons/` whose name is not in the catalogue fails `theme:check`, with the closest name suggested. So a page keeps its meaning across a theme change (the content stores `leaf`), and only the drawing changes.

A theme does **not** add names of its own. That would make an icon depend on the theme and would break the guarantee of ADR-0005 section 11 that content survives a theme change; it is the icon equivalent of the raw-HTML block ADR-0018 section 5 refuses.

**Amendment (2026-11-12, bogd3v/micelio-plugin-core#194): the Spanish labels of the index.** Tabler ships English names, tags and categories only, so several thousand Spanish labels have no source. By the maintainer's decision of 2026-11-12, the index carries Spanish labels for every category and for the names the core uses (its defaults and the names the four step-1 fields suggest first: `feature-item`, `link`, `stat`, `plan.features`); every other name has its English label as the fallback, answered in Spanish, and the search matches a query against both labels. This note changes no sentence of the record.

### The licence of the set

Tabler Icons is MIT. `MIT` is on the allowlist of `@micelio/eslint-config` (`licenses.json`) that `npm run lint:licenses` reads, so `scripts/licenses-allow.json`, which holds only exceptions, needs no entry. `@micelio/icons` carries the licence the way the standard asks of third-party material (section 10 of the TypeScript profile, REUSE): Tabler's `LICENSE` file, with its copyright notice, ships inside the package next to the glyphs (`LICENSES/MIT.txt` and the notice, which the MIT licence requires in every copy); `THIRD-PARTY.md` lists Tabler Icons with its pinned version; `REUSE.toml` annotates the glyph files as MIT with Tabler's copyright, and `reuse lint` runs in CI. The normaliser's output is a modification of Tabler's files and stays MIT with the same notice; the package's own code (the normaliser and the index) takes the repository's licence. A theme's glyphs under `icons/` are the theme's own and carry the theme's licence.

### 3. Delivery: one sprite per page, no request

The core renders icons as `<svg aria-hidden="true"><use href="#myc-i-<name>"/></svg>` against a sprite inlined once in the page, holding only the names the page uses. The server builds it when it renders in dynamic mode; the static and landing builds ([ADR-0006](0006-site-modes.md)) build it at build time. No icon file is ever requested by the browser, so the static and offline modes need nothing new and the hash-based CSP ([ADR-0004](0004-hash-based-csp.md)) is not touched (an inline `<svg>` is markup, not a script or a style).

Cost: a glyph is 200–600 bytes before compression; it enters the block's declared `cost` (ADR-0018, section 1) as the measured bytes of the sprite entries the block's icons add, with the measurement recorded in `docs/performance.md`.

### 4. Admission of a theme's glyphs

`icons/` joins the data-only allowlist of [ADR-0008](0008-theme-registry.md) decision 1 (amended by [ADR-0009](0009-theme-delivery-at-runtime.md) section 10), so a theme with its own icons is still a data-only theme and installs on a server. `theme:check`, the install path of ADR-0009 section 2 and the admission workflow of `micelio-themes` validate each file:

- parses as SVG; `viewBox="0 0 24 24"`; no `width` or `height`;
- colour only by `currentColor`: no colour literal, no `fill` other than `none` or `currentColor`;
- no `<script>`, `<style>`, `<image>`, `<foreignObject>`, `<a>`, external `<use>`, event attributes, `xlink:href` or `data:` URLs; no `id` attribute (it would collide in the sprite);
- at most 2 KiB per file after the normaliser (the limit is declared in `modules/theme/constants.ts` and tuned on the first theme that uses it);
- the file name is a name of the pinned catalogue.

The sum of a theme's glyphs is part of the theme's own byte budget, not of the blocks'. The theme's manifest records `icons: { count, bytes }`, generated at `theme:pack`, so the registry and the marketplace can show it. `theme:check` warns, without failing, when the core's catalogue has names the theme does not cover: the core draws them, and the creator sees the seam coming.

### 5. The admin

`@micelio/strapi-plugin-core` ships a custom field `micelio.icon`: a picker with search by name, label (en, es), category and alias, a preview of each glyph, and "none" as an explicit state. It previews the glyphs the site's active theme resolves (`GET /micelio/icons?site=…` returns the resolved sprite entries), with the core's drawing as fallback. A content field of type `micelio.icon` validates against the pinned names on save.

### 6. Versioning

| Change | Version |
| --- | --- |
| Raising the pinned Tabler version when it only adds names | MINOR of the block contract |
| A Tabler release that renames or removes a name | The core keeps the old name as an alias of the new glyph; never a breaking change for stored content. Dropping an alias is a MAJOR |
| Adding `icon` to an existing block | MINOR (an optional field, ADR-0018 section 2) |
| Making `icon` required on an existing block | MINOR with a content migration that fills it |
| The `icons/` directory, its rules and the resolution order | Part of the theme contract from the version that ships them; an optional addition with a core default, so a minor of the theme contract ([ADR-0008](0008-theme-registry.md) decision 2), not contract 3 |
| Tightening an admission rule (a smaller byte limit, a new forbidden element) | A major of the theme contract if a published theme stops validating; otherwise a minor |

### 7. `customIcon`, the one exception

A block may offer `customIcon: media` (an SVG or raster upload) **only** where the icon is a brand's own mark (a logo in `logo-cloud`, a technology mark in a `badges` block). `icon` and `customIcon` are mutually exclusive in the schema; the uploaded SVG goes through the same element rules as section 4, served as an image, counted as an image. It is never offered on a block whose icon is decorative.

### 8. What is left out

- Icon fonts and any icon delivered as a web font.
- Icons as uploaded content outside section 7.
- Names of a theme's own (section 2).
- Mixing several sets in the core's catalogue; the core pins one set. A theme may draw its glyphs from any source, under the core's names and the rules of section 4.
- Animated icons; a theme may animate by CSS what the sprite renders.
## Options considered

- **A. Icons of the core only; a theme styles them by CSS.** Enough for 1.0 and the simplest to build, but the marketplace and the showcase theme would ask for their own drawings, and adding that after third-party themes exist means renegotiating the theme contract. Rejected as the end state; it is the first implementation step (Consequences).
- **B. The core owns the names; a theme may redraw any name (chosen).** Content stays portable, the core guarantees every glyph, and a theme gets a visual language of its own at the cost of SVG admission rules.
- **C. Themes add names of their own.** Content stored with `espora:spore` has no glyph on another theme. Rejected: it is what makes changing theme painful elsewhere.
- **A semantic layer of Micelio's own (`danger`, `community`) mapped to Tabler.** Portable across sets, but a vocabulary to invent, translate and maintain for thousands of concepts, and it hides the very variety that motivates the choice of set. Rejected; aliases cover renames (section 6).
- **Lucide or Phosphor as the set.** Lucide (ISC) is consistent and well supported, about a quarter of Tabler's distinct concepts; Phosphor (MIT) brings six weights, fewer distinct concepts than Tabler, and the weights would become a sixth file per name in the sprite or a stroke the theme cannot tune. Tabler's single stroke style is tunable with `stroke-width` in CSS and has the widest domain coverage (maps, transport, money, music, government) for the audiences Micelio targets.
- **Icons as uploaded media, with a library in the admin.** Keeps today's model and adds a picker over uploads, but every icon stays a request, outside the theme's colours and the sprite. Rejected.
- **Loading the set from a CDN or an icon API.** A third-party request on every page. Refused by the theme contract.
## Trade-offs

- One more contract surface (`contract/icons.ts`, the pinned version, the alias table) and an SVG validator in `theme:check`, the installer and the admission workflow.
- `@micelio/icons` is a large package (thousands of files); the core bundles only the index and reads glyphs on demand, and the sprite holds only what a page uses, but the image grows by the package.
- A theme that redraws many names carries a maintenance debt: each core upgrade may add names it does not cover, and the seam shows. The warning of section 4 makes it visible; it does not remove it.
- `stroke-width` tuning changes the look of the core's glyphs only within what a stroke icon tolerates; a theme that wants another geometry has to draw it.
- Until the cut-over of [ADR-0017](0017-distribution-plugins-multisite-editorial.md), the `icon` fields are Strapi enumerations with thousands of values or strings validated by the plugin; the custom field makes the second workable and is why it ships with the first icon-bearing block.
## Consequences

Two steps, so that nothing is built without a user. Each issue of step 1 is opened under the milestone "Micelio · Catálogo de bloques" once this record is `Accepted`; the titles below are proposed, and the epic (bogd3v/micelio#872) holds the list:

1. **Now, with the catalogue work of Builder phase 2 or the block refinement wave.** The follow-up issues of step 1:
   - "The catalogue entries: `icon` on the blocks that get it first" (which blocks is decided by the block catalogue plan, bogd3v/micelio#871, not by this record).
   - "`@micelio/icons`: the Tabler set, the normaliser, the index and the pinned `contract/icons.ts`", with the alias table and the licence handling of section 2.
   - "The sprite renderer and the resolver", written with the theme-then-core lookup even though no theme ships `icons/` yet, with the measured cost in `docs/performance.md`.
   - "The `micelio.icon` custom field" of `@micelio/strapi-plugin-core`.
   - "`iconStyle` in the options vocabulary".


   `espora` and `starter` ship no `icons/`.
2. **With the first theme that draws its own glyphs** (the showcase theme or the first marketplace candidate): `icons/` in the data-only allowlist (amending ADR-0008 decision 1 and ADR-0009 section 2), the admission rules of section 4 in `theme:check`, the installer and `micelio-themes`, the manifest field, the uncovered-names warning, and the picker previewing the theme's glyphs.

Amendments the record leaves, made when each step ships and not by this record:

- [ADR-0018](0018-blocks-as-a-contract.md) section 1 gains the `iconStyle` option, and section 6 changes `feature-item.icon` from an upload to a name; its content migration moves existing uploads to `customIcon` or drops them, decided per site at the cut-over.
- [ADR-0005](0005-theme-contract.md) section 11 gains the `icons/` directory when step 2 ships.
- `docs/themes/creating-a-theme.md` documents drawing a glyph.
- The engineering standard, section 6, adds the icon catalogue to the block contract row. The standard is fixed in `micelio-engineering` (a `docs(standard)` issue), not here.
