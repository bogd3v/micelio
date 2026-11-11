# ADR-0018: Blocks as a contract

**Status:** Accepted
**Date:** 2026-10-21
**Deciders:** Micelio maintainer
**Amended:** 2026-11-03: the presentation options vocabulary
and the ordering rule of sections 1 and 2
(bogd3v/micelio-plugin-core#48, bogd3v/micelio#803)

## Context

A page is a sequence of blocks. The `page` collection of `micelio-cms` holds them in the `sections` dynamic zone, articles in `blocks`, the About page in its own `blocks`; the frontend renders them (`SectionRenderer`, `BlocksRenderer`) and themes style them ([ADR-0005](0005-theme-contract.md), section 11). The builder planned in [ADR-0017](0017-distribution-plugins-multisite-editorial.md) composes pages from the same blocks, and `@micelio/strapi-plugin-core` owns them (epic bogd3v/micelio-plugin-core#1).

Today a block is only a Strapi component (`src/components/section/*`, `src/components/shared/*`). Nothing states:

- **A stable id.** The component UID (`section.hero`) is the only name, and [ADR-0017](0017-distribution-plugins-multisite-editorial.md) moves the content types into the plugin at the cut-over.
- **What a theme may count on.** Each section has a `variant` enum that [ADR-0005](0005-theme-contract.md) section 11 (amendment #276) makes a core enum, but the set lives in at least six places: the Strapi JSON, `app/interfaces/page.ts`, `app/schemas/pages.ts`, `server/schemas/page.ts`, the `data-variant` values of `app/theme/hooks.json` and the specimen fixtures. Only the last two are tested against each other; the rest are kept equal by hand.
- **What a block costs.** The `scene` and `playground` blocks are heavy islands with a budget and a fallback (`app/islands/lib/constants.ts`, [ADR-0006](0006-site-modes.md) section 6); the rest have no declared cost, and an editor choosing between them cannot see the difference.
- **What it becomes without JavaScript.** Static and landing builds ([ADR-0006](0006-site-modes.md)) need every block to render without the Vue runtime. The slider shows its first slide, the newsletter form swaps to a static form; each block decided on its own.

A builder on top of that makes every block change a surprise for themes, for stored content and for the budgets. The [engineering standard](../engineering-standard.md) 1.4, section 6, already lists the block contract (source of truth: `contract/blocks.ts` in `micelio-plugin-core`); this record is what that row points to. Micelio is `0.y` and not stable (section 7, "Before 1.0.0"): a break needs the `!`, a `BREAKING CHANGE:` paragraph and upgrade notes, but a decision this expensive to undo gets a record (section 12).

## Decision

### 1. A block is `{ id, schema, options, cost, static }`

| Field | Meaning |
| --- | --- |
| `id` | Stable, kebab-case, unique in the catalogue (`hero`, `feature-grid`). It never changes: not at the cut-over of [ADR-0017](0017-distribution-plugins-multisite-editorial.md), not when the Strapi UID does. Stored content and themes refer to a block by this id |
| `schema` | The Strapi component that stores its content (today `section.hero`), with its nested components. Content fields only: text, media, links, relations, counts |
| `options` | A closed set of presentation values: `variant` (the section variants, the `data-variant` values of a public hook, [ADR-0005](0005-theme-contract.md) section 11), and the eight names of the vocabulary below, each a hook of the theme contract once it renders it (the ordering rule below). Each option lists its allowed values and its default; the editor picks among them, the core styles every value and a theme may restyle it |
| `cost` | The bytes the block adds to a page (gzip of its CSS and JS, and the JS of its island once used), and whether it is an island. An island names its entry in the heavy island registry and its budget in `scripts/perf/budgets.json` |
| `static` | What the block renders with no JavaScript (before hydration in dynamic mode, always in static and landing builds): a required, complete alternative, never an empty box. For a block that needs no JS it is the block itself |

A block's content and its presentation are separate. `schema` never holds a presentation field; `options` never holds content. Today `variant` sits inside the component; the catalogue declares it as an option and the plugin keeps storing it where it is until a migration moves it (section 2).

The presentation options are a closed vocabulary of eight names.
Their values are stored as Strapi enumerations, and a block offers only some of the names:

| Name | Values | Default | Meaning |
| --- | --- | --- | --- |
| `layout` | `centered`, `split`, `stacked` | `centered` | How the block arranges its parts; maps to the theme's layout variants ([ADR-0005](0005-theme-contract.md)) |
| `width` | `prose`, `wide`, `full` | `prose` | How wide the block is; `full` is refused on article pages |
| `columns` | `2`, `3`, `4`, `6` | `3` | Columns of its grid, collapsing to one at phone width; `6` is only for `logo-cloud` |
| `density` | `comfortable`, `compact` | `comfortable` | Theme spacing steps, never pixels |
| `align` | `start`, `center` | `start` | Where its text sits; there is no `end`, which would mean right or left by language |
| `tone` | `default`, `raised`, `accent` | `default` | The theme surface it sits on: `surface`, `surface-raised` or `accent-soft` |
| `ratio` | `16:9`, `4:3`, `1:1`, `auto` | `16:9` | The aspect ratio of its media; `auto` reserves no space |
| `height` | `s`, `m`, `l`, `full` | `m` | How tall it is; `full` is one viewport, and an island keeps its static alternative at that height |

The vocabulary is `contract/options.ts` of `micelio-plugin-core`
(bogd3v/micelio-plugin-core#48), and `contract/blocks.ts` says which block offers which name.
The per-block lists live there and in the generated reference, not in this record.
`variant` stays a section's own option, as above.
Adding a name or a value is a MINOR of the block contract, removing or renaming one a MAJOR.

The names are the block contract's, and a value is a hook the theme contract renders:

- **The block contract may declare an option before the theme contract has it.**
  The theme contract adds each one as an optional addition with a core default
  (a minor of the theme contract, [ADR-0008](0008-theme-registry.md) decision 2).
- **The builder offers an option to editors only once the theme contract renders it**
  (bogd3v/micelio#731).
  Until then a theme has no hook for it and the builder does not show it to an editor.
- **A theme that does not style a value gets the core's look,** because the core styles every value.
  No fallback to the first value of the list is built: that reading of the Options vocabulary
  artboard is superseded (the maintainer's decision on bogd3v/micelio#731).

A block never invents an option outside the vocabulary: a new name is an amendment of this record.

### 2. Versioning

The catalogue is part of the plugin core's public interface (standard, sections 6 and 7):

| Change | Version |
| --- | --- |
| A new block, a new option (with its default) or a new value of an option | MINOR |
| A new optional field in a block's `schema` | MINOR |
| A new required field in a block's `schema` | MINOR, only with a content migration in the same release that fills it in stored content |
| A renamed, retyped or removed field, or a moved `variant`, in a block that stored content uses | MAJOR, with a content migration in the same release |
| Removing a block, an option or an option value | MAJOR |
| A higher declared `cost` | PATCH, with the reason and the numbers in `docs/performance.md` |

Content migrations are boot migrations: idempotent, self-contained and tested
([engineering standard](../engineering-standard.md), section 6).
Before 1.0.0 a MAJOR raises `y` (section 7).
An option value becomes a hook value of the theme contract when the theme contract renders it.
That is a minor of the theme contract, which may come after the block contract's (section 1);
the core styles it, so existing themes keep validating.
Removing one is a major.

### 3. Generated, checked for drift

The catalogue is TypeScript, `contract/blocks.ts` in `micelio-plugin-core`, written with zod as `modules/theme/contract.ts` is. From it the plugin generates a JSON Schema of the catalogue and a reference (one page per block: fields, options, cost, static alternative), and lint fails when either drifts, as `lint:schema` and `lint:reference` do for the theme contract here. The Strapi component JSON is checked against `schema`, the frontend's response schemas (`app/schemas/`) and the specimen fixtures against the generated JSON Schema, and the island registry and `budgets.json` against `cost`. The mock Strapi of the end-to-end suites renders every block of the catalogue (standard, section 8).

### 4. Themes may contribute blocks (theme contract 3, to be scheduled)

A theme may ship a block under the same contract: an id in its own namespace (`<theme-id>/<block>`), a schema, options from the theme contract, a declared cost and a static alternative, validated by `theme:check` and counted in the theme's budgets. It breaks the guarantee of [ADR-0005](0005-theme-contract.md) section 11 that every theme styles every section, so that content survives a theme change: a block stored by one theme has no rendering in another. That makes it a major of the theme contract (3). It is not built now: it waits for the plugin catalogue to exist, for a way to register a component in Strapi from a theme package, and for an answer to what content stored in a theme's block becomes when the site changes theme (the `static` alternative is the candidate). Its own issue schedules it; [ADR-0005](0005-theme-contract.md) section 11 is amended when that ships.

### 5. What a block may not be

- **Free positioning.** No coordinates, grid placement or overlap set by the editor.
  A block's layout comes from its variant and its options; the page's from the order of its blocks.
- **Per-element CSS.** No class names, selectors or custom properties entered in content. Presentation is the closed set of options.
- **Inline styles.** No `style` value in content, color pickers or spacing fields. Colors and space are roles of the theme ([ADR-0005](0005-theme-contract.md) section 1).
- **Raw HTML.** No block whose content is HTML. Markdown is rendered and sanitized on the server (standard, section 9), and embeds enter as a block with a declared origin.

Each would let content outlive the theme it was styled for, break the contrast matrix and the budgets that `theme:check` and CI measure, or bypass the hash-based CSP ([ADR-0004](0004-hash-based-csp.md)) and the sanitizer.

### 6. The first catalogue

The components of `micelio-cms` at `v0.4.0` under `src/components/section` and `src/components/shared` are the first catalogue. It is read only: this record changes no block, and bogd3v/micelio-plugin-core#4 writes it as `contract/blocks.ts`, with measured costs. "Part of" marks a nested component, which is part of its block's `schema` and not a block of its own; "Field" marks a component that is a field of a content type, not a block.

**Page sections** (`page.sections`):

| id | `schema` | Nested | `variant` (default first) | Island | `static` |
| --- | --- | --- | --- | --- | --- |
| `hero` | `section.hero` | `section.link` | `centered`, `split`, `full-bleed` | No | Itself |
| `feature-grid` | `section.feature-grid` | `section.feature-item` | `grid`, `list`, `bento` | No | Itself |
| `media-showcase` | `section.media-showcase` | `section.link` | `left`, `right`, `stacked` | No | Itself; a video shows its native controls |
| `stats` | `section.stats` | `section.stat` | `row`, `cards` | No | Itself |
| `logo-cloud` | `section.logo-cloud` | `section.logo` | `row`, `marquee` | No | Itself; the marquee is CSS only, stops under reduced motion and when a logo is a link |
| `testimonials` | `section.testimonials` | `section.testimonial` | `single`, `grid` | No | Itself |
| `pricing` | `section.pricing` | `section.plan`, `section.link` | `cards`, `table` | No | Itself |
| `faq` | `section.faq` | `section.faq-item` | `list`, `two-columns` | No | Itself; native `<details>` |
| `cta` | `section.cta` | `section.link` | `banner`, `card` | No | Itself |
| `post-list` | `section.post-list` | | `cards`, `list` | No | Itself, rendered with the page |
| `newsletter` | `section.newsletter` | | `inline`, `card` | No (a hydrated form) | In static builds, the static form (`MycNewsletterStatic`); in dynamic mode the form submits only once hydrated, a gap bogd3v/micelio-plugin-core#4 records; nothing when the `newsletter` module is off |
| `rich-text` | `section.rich-text` | | | No | Itself |
| `gallery` | `section.gallery` | | `grid`, `masonry` | No | Itself |
| `scene` | `section.scene` | | `background`, `inline` | Yes, `scene` | The required poster with its alt text |

**Article and About blocks** (`article.blocks`, and the shared part of `about.blocks`; `playground` is in articles; a page draft also keeps a `shared.playground` that the CMS holds in its `sections`, only so the preview can run it with `micelio:run`: the page route drops it and no page renders it, bogd3v/micelio#880):

| id | `schema` | Nested | `variant` | Island | `static` |
| --- | --- | --- | --- | --- | --- |
| `prose` | `shared.rich-text` | | | No (Mermaid diagrams inside it are the `mermaid` island) | Itself; a diagram shows its source |
| `quote` | `shared.quote` | | | No | Itself |
| `media` | `shared.media` | `shared.image-credit` | | No | Itself |
| `slider` | `shared.slider` | `shared.slide`, `shared.image-credit` | | No (hydrated controls) | The first slide, with its caption and credit |
| `playground` | `shared.playground` | | | Yes, `playground` | The highlighted code and its expected output |

The ids `prose` and `rich-text` keep the two Markdown blocks apart: they are different components today, and merging them is a schema change under section 2.

**Parts and fields** (not blocks):

| Component | Kind | Where |
| --- | --- | --- |
| `section.link` | Part of | `hero`, `media-showcase`, `cta`, `pricing` (through `section.plan`) |
| `section.feature-item` | Part of | `feature-grid` |
| `section.faq-item` | Part of | `faq` |
| `section.logo` | Part of | `logo-cloud` |
| `section.plan` | Part of | `pricing` |
| `section.stat` | Part of | `stats` |
| `section.testimonial` | Part of | `testimonials` |
| `shared.slide` | Part of | `slider` |
| `shared.image-credit` | Part of, and Field | `media`, `slide`; `article.coverCredit` |
| `shared.reference` | Field | `article.references` |
| `shared.seo` | Field | `article`, `page`, `about`, `global` |
| `shared.meta-social` | Part of | `shared.seo` |
| `shared.tech-item` | Field | `about.project` |

The `about.*` components (`profile`, `statement`, `topics`, `projects`, `principles`, `open-source`, `contact`) and their parts are blocks of one site's About page, not of the core (standard, principle 2); they stay out of the catalogue and are decided with the cut-over.

## Options considered

- **Keep blocks as plain Strapi components.** No new surface, and every change stays a surprise for themes, stored content and budgets; the builder could not tell an editor what a block costs. Rejected.
- **The catalogue in Strapi's component JSON, with custom keys.** One file per block, but no types for the frontend and themes, no zod validation, and the JSON is Strapi's format, which the plugin SDK may rewrite. Rejected: the JSON is checked against the catalogue instead.
- **Presentation as free fields (classes, colors, spacing) in each block.** The flexibility of a page builder, and content that only one theme renders well, a contrast matrix that cannot be checked and CSS outside the CSP's reach. Rejected (section 5).
- **Options per block, outside the theme contract.**
  Each block could grow its own `tone` or `size`;
  every theme would have to discover and style each one.
  Rejected: options come from one vocabulary,
  and each value becomes a hook the core styles and `theme:check` validates.
- **Themes contribute blocks now.** Wanted, and blocked on the catalogue, the registration path and the theme-change question. Deferred to theme contract 3 (section 4).
- **Declare cost only for islands.** Simpler, but the non-island blocks carry CSS and, for a few, hydrated JS that editors and budgets should see. Rejected: every block declares it; for most it is small and measured once.

## Trade-offs

- One more contract to version, and a generator and two drift checks to keep, in a repository that does not exist yet (bogd3v/micelio-plugin-core#2).
- The closed set of options limits what an editor can do on purpose. A design the options cannot express becomes a new variant or a new block by pull request, as [ADR-0005](0005-theme-contract.md) amendment #276 already requires for variants.
- The vocabulary is declared before the theme contract renders it.
  Rendering it costs a minor of the theme contract and core CSS for every value
  before the builder offers it (bogd3v/micelio#731);
  a theme restyles a value only if it chooses to.
- Declared costs drift from real ones unless measured; the per-block measurement is new work in `scripts/perf/`.
- Until the cut-over the catalogue describes components that `micelio-cms` owns, so a change to a block touches two repositories (standard, section 6: CMS first).

## Consequences

- bogd3v/micelio-plugin-core#4 writes `contract/blocks.ts` from section 6, generates the JSON Schema and the reference, and adds the drift lint. Its entries are the blocks of section 6; parts and fields enter as the `schema` of their block, not as entries of their own, and `cost` is measured as section 1 defines it. It copies no content type from `micelio-cms` (epic bogd3v/micelio-plugin-core#1).
- The frontend's block interfaces, response schemas and specimen fixtures are checked against the generated JSON Schema once it is published; nothing in `app/` changes before then.
- Rendering the vocabulary is a theme contract minor with its own issue (bogd3v/micelio#731)
  and a section in `docs/themes/contract-changelog.md`.
- Theme-contributed blocks (theme contract 3) get their own issue and amend [ADR-0005](0005-theme-contract.md) section 11 when they ship.
- The visual editing protocol (ADR-0019, bogd3v/micelio#651) addresses blocks by the `id` of section 1.
