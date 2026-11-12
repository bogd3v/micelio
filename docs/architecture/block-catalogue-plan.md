# The block catalogue plan

**Kind:** plan (proposal). For the maintainer, who approves it, and for the planner and workers who
cut implementation issues from it. It decides nothing by itself and changes no schema, component or block:
what it proposes becomes a decision when the maintainer approves the issue list in the Progress section of
bogd3v/micelio#871, and the amendments of [ADR-0018](../adr/0018-blocks-as-a-contract.md) in the list at the end
become an ADR change when the first issue that needs one ships. Reviewed with the maintainer on 2026-11-07,
2026-11-09 and 2026-11-11. The decisions it builds on are [ADR-0018](../adr/0018-blocks-as-a-contract.md) (the
contract), [ADR-0019](../adr/0019-visual-editing-protocol.md) (the editing protocol),
[ADR-0021](../adr/0021-icons-in-the-block-contract.md) (icons) and
[ADR-0022](../adr/0022-page-composition.md) (reusable blocks and groups).

## Why a plan

The catalogue of ADR-0018 section 6 is the first catalogue, read only: fourteen page sections, five article blocks
and the About blocks of one site, in three zones that do not share a block. Pages look plain for structural
reasons, not for lack of blocks:

- The only icon is an uploaded image (`section.feature-item.icon`).
- `SectionHead` has no eyebrow and no anchor.
- Repeatable items have no stable id (`:key="index"` in the renderers). Citable content needs one, and so does any
  selection of an item that survives a reorder.
- Most blocks expose few of the names of the options vocabulary (ADR-0018 section 1).

Two nodes with known needs drive the catalogue, and nothing else does: the **Micelio site** (documentation written
as pages and the product landing, milestone "Micelio como nodo"), called **M** below, and bogdev.com.co, the
reference node, called **B**. The external node that had been planned dropped out on 2026-11-11, and the waves were
reordered around these two.

## How to read it

**The four filters.** A block enters the catalogue only if it passes all four:

1. A complete static alternative: what it renders with no JavaScript, never an empty box (ADR-0018 section 1).
2. No third-party request: the browser asks the node and nobody else.
3. Content that survives a theme change: the block stores content and a closed set of options, never a look
   (ADR-0005 section 11, ADR-0018 section 5).
4. A node of the roadmap that needs it.

A block that fails one is listed under "Rejected" with the filter it fails. A block of wave 3 passes the first three
and fails the fourth *today*: no node of this plan asks for it, so the plan describes it and schedules none of it.

**Cost** is a class, and the measurement belongs to each implementation issue (`docs/performance.md`, ADR-0018
section 2): `none` (markup the page already renders), `css` (adds CSS only) and `island` (adds JavaScript that
hydrates; it names its entry in the heavy island registry and its budget, and keeps its static alternative).

**Zones.** `P` is the `page.sections` zone, `A` the `article.blocks` zone. After the cut-over the About page is a
page, so it has no zone of its own (see "The About blocks"). A new block is one component allowed in both zones
that name it; an existing page section joins `A` only when a node asks (`gallery`, for B's articles: F5).

**Versions.** Every change is classed under ADR-0018 section 2: a new optional field, block or option value is a
MINOR; a new required field is a MINOR only with the content migration in the same release; a renamed, retyped or
removed field in a block that stored content uses, and the removal of a block, is a MAJOR with its migration.
Before 1.0.0 a MAJOR raises `y` (section 7 of the standard), so every MAJOR below is an upgrade note and not a
compatibility layer.

**Defaults** are neutral. No value of B or of any other node is a default of a block (standard, principle 2): a
field that has no neutral value, such as a currency or a consent text, has no default: the editor writes it. Where stored
content has none, the migration fills it only from what the block stores today; when nothing is stored it leaves the
field empty and reports each entry, never copying a core text into a node's content. The core's own UI strings (a
placeholder, a success sentence) are not a node's value: they stay the fallback of an empty optional field.

**Naming.** `id` is reserved by Strapi (ADR-0022 uses `groupId` for the same reason), and the catalogue `id` is the
block's kind (ADR-0018 section 1). The per-instance ids below are therefore `blockId` and `itemId`.

## Foundations

One schema wave, wave 0, before the content-types cut-over (milestone "Tipos de contenido al core", ADR-0017):
after the cut-over a UID change costs a MAJOR, and a registry with third-party themes (ADR-0008) freezes the shape.
The five items share one release line and one upgrade note.

### F1. A stable id per block and per repeatable item

- **Why.** The component UID is the kind, not the instance. ADR-0019 addresses a block by `{ zone, index, block,
  version }` because Strapi may recreate component ids on save, so a selection does not survive a reorder, and a
  citation (`#stat-uptime`) has nothing durable to point at.
- **Schema.** Every block and every repeatable item (`feature-item`, `stat`, `testimonial`, `plan`, `faq-item`,
  `logo`, `slide`, and the items of the new blocks) gets `blockId` or `itemId`: an opaque string the plugin
  generates on first save, never edited, unique within its zone (blocks) or its parent block (items). The renderer
  uses it as `:key`; `data-myc-block` of ADR-0019 is unchanged.
- **Migration.** A boot migration fills every stored block and item that lacks one. It is idempotent: it never
  rewrites an id it finds, and a second run changes nothing.
- **Version.** A new required field with its migration: MINOR (ADR-0018 section 2).
- **Left alone.** ADR-0019 keeps addressing by position and catalogue id. Addressing by `blockId` is a separate
  amendment of that record, proposed in "Amendments" and not made here.

### F2. `eyebrow` and an anchor on `SectionHead`

- **Schema.** `eyebrow` (short string) and `anchor` (kebab-case slug, validated, unique in the page) on every
  section that renders a `SectionHead`. The anchor is explicit and never derived from the title: an edited title
  would break every link to it. With an anchor the heading renders `id="<anchor>"` and a self-link; without one it
  renders as today.
- **Static alternative.** Itself: an `id` attribute and an `<a>`.
- **Migration.** None. **Version.** MINOR (two optional fields).

### F3. `tone` and `align` on every page section

- **Options.** Both names already exist in the vocabulary (ADR-0018 section 1). The catalogue now lists them for
  all fourteen page sections; `scene` uses them only in its `inline` variant (its `background` variant paints its
  own poster). Inside a group the group's `tone` wins and the member's is ignored, not refused (ADR-0022 section 2).
- **Migration.** None; defaults are the vocabulary's. **Version.** MINOR (an option with its default).
- **Builder.** Offered to editors only once the theme contract renders the value (ADR-0018 section 1,
  bogd3v/micelio#731).

### F4. One Markdown block: `prose`

- **Schema.** `section.rich-text` (P) and `shared.rich-text` (A) are two components with the same `body`. They
  become one component `shared.rich-text`, allowed in both zones, with catalogue id `prose` (ADR-0018 section 6
  already notes the merge as a schema change). `body` is validated on save: heading levels are checked by position
  (a block never opens below an `h2`, and levels do not skip), and every heading gets an anchor id, which `toc`
  (wave 1) reads.
- **Static alternative.** Itself; a Mermaid diagram inside it shows its source, as today.
- **Migration.** Every `section.rich-text` entry becomes a `shared.rich-text` entry in place, keeping its position
  and its `body`. A body whose heading levels fail the new validation is migrated as it is and reported, never
  rewritten.
- **Version.** MAJOR (a removed component in stored content), with the migration in the same release.

### F5. `gallery` absorbs `slider`

- **Schema.** `gallery.images` (a bare `media` list) becomes `gallery.items`, a repeatable `slide`: `file`
  (required), `caption`, `credit` (`shared.image-credit`). `slider` becomes the `slider` **variant** of `gallery`
  (`grid`, `masonry`, `slider`); `shared.slider` is removed. The merged block is the
  component `section.gallery`, allowed in **both zones** (`P` and `A`): B's articles use `slider` today, so the
  migration needs `gallery` in `A`. The slide stays `shared.slide`. The asymmetry (a `slider` with caption and
  credit, a `gallery` without) is debt, not design: BogDev's articles already use `slider` with caption and credit.
- **Island.** A lightbox, island `lightbox` (class `island`), opened from a thumbnail. Its static alternative is the
  link to the image file, so the page is complete without it. The slider's controls stay hydrated; without them it
  shows the first slide with its caption and credit (ADR-0018 section 6).
- **Migration.** `gallery.images` become items with an empty caption and credit; each `slider` entry becomes a
  `gallery` entry of variant `slider`, in the same zone and position, with its `items` and `files` merged into
  `items` (`files` without a caption become items without one).
- **Version.** MAJOR (a removed block and a retyped field), with the migration in the same release.

## Refinement of the current blocks

Each entry: what changes in the `schema`, the options exposed, the structured data it emits, its island and static
alternative, the migration class and the node that needs it. Cost is `css` and unchanged unless it says otherwise.
The migration classes are:

- **M1, reshape (MAJOR, content migration).** A field is renamed, retyped or split. One release line, in wave 0
  with the foundations when the block is wave-0 work and otherwise with the wave of its block; each issue states
  which.
- **M2, additive (MINOR).** Optional fields and option values with defaults, and at most a migration that fills a
  new field from what the block stores today, without reshaping anything. Existing content renders as before.

The nodes: M needs them for the documentation and the landing, B for its pages and articles.

| Block | Class | Wave |
| --- | --- | --- |
| `hero`, `feature-grid`/`feature-item`, `quote` | M1 | 1, 1, 2 |
| `pricing`/`plan`, `tech-item` | M1 | 2, 2 |
| `testimonials`, `stats`, `faq`, `cta`, `newsletter`, `logo-cloud`, `media-showcase`, `post-list`, `link` | M2 | 1 (all but `stats` and `testimonials`), 2 |

### hero

- **Schema.** Adds `eyebrow` and `badge` (`{ text, icon }`: the text is required for the badge to render, the icon
  is optional and a catalogue name, see "Icons"). Splits `media`, which is the background in one variant and the image
  in another, into `background` and `media`.
- **Options.** `align` and `height` (F3 covers `tone`). The `centered` and `split` variants read `media`; `full-bleed`
  reads `background`.
- **Structured data.** None. **Island.** None; static alternative is the block.
- **Migration.** M1: a `full-bleed` hero moves its `media` to `background`; the others keep it in `media`.
- **Node.** M (the landing: "v0.7 released"), B.

### feature-grid and feature-item

- **Schema.** `feature-item.icon` stops being an upload and becomes a catalogue name; adds `link` (`section.link`)
  per item and an optional `badges` list (the generalised `tech-item`, below). The `numbered` variant joins `grid`,
  `list` and `bento` (a list that numbers its items with a CSS counter, so a theme styles it).
- **Options.** `columns` (`2`, `3`, `4`); `variant`.
- **Structured data.** None. **Static alternative.** Itself; a linked item is an `<a>` around its title.
- **Migration.** M1: ADR-0021 says existing uploads move to `customIcon` or are dropped, per site at the cut-over,
  while its section 7 forbids `customIcon` on a decorative icon. This plan proposes dropping them and keeping the
  upload out of the schema: the migration empties `icon`, writes a report of the affected items to the boot log, and
  the editor picks a name. Whether to instead keep a transitional `customIcon` here is a maintainer decision, in
  "Amendments".
- **Node.** M (the landing's features), B.

### stats and stat

- **Schema.** `stat` adds `prefix`, `suffix`, `trend` (`{ direction: up | down | flat, text }`), `source` (a URL)
  and `icon`. `value` stays a string, so no node's figure is parsed.
- **Options.** `variant` (`row`, `cards`) and `columns`; `tone` and `align` by F3.
- **Structured data and markup.** A `source` renders as a link inside a `<cite>` under the figure, the same markup as
  `citation` (wave 2): a statement that cites where it comes from. No JSON-LD.
- **Island.** An optional animated count, island `stats-count` (class `island`). Its static alternative is the fixed
  `value`, which is what the HTML always holds; with reduced motion the island does not animate.
- **Migration.** M2. **Node.** M ("Garantías medibles" on the landing, and the citable knowledge of the site).

### testimonials and testimonial

- **Schema.** `testimonial` adds `sourceUrl`, `logo` (`media`) and an optional `rating` (1 to 5).
- **Options.** `variant` (`single`, `grid`) and `columns`; `tone` and `align` by F3.
- **Structured data and markup.** `sourceUrl` renders as `<blockquote cite="<url>">`; no `Review` JSON-LD, because a
  testimonial is the site's own claim about itself, which search engines discount.
- **Static alternative.** Itself: the quote, its author and, when set, the logo and the rating as text ("4 of 5");
  `cite` is an attribute, so nothing depends on a script.
- **Migration.** M2. **Node.** M (the landing), B.

### pricing and plan

- **Schema.** `plan.features` stops being a flat `text` and becomes a repeatable `{ text, included, icon }`;
  `recommended` stays and `highlightLabel` (short string) is shown when it is set; adds `currency` (an ISO 4217
  code, on the plan) and `priceNote` ("from"). `price` and `period` become `prices`, a repeatable
  `{ period, amount }` (`month`, `year`, `once`): the second price the toggle shows.
- **Options.** `variant` (`cards`, `table`); `columns`.
- **Island.** A monthly/yearly toggle, island `pricing-toggle` (class `island`). Its static alternative shows both
  prices, labelled by period, which is what the HTML always holds.
- **Structured data.** None: an `Offer` requires a price a search engine can verify, which a plan from a Strapi
  field does not guarantee.
- **Migration.** M1: each line of the old `features` text becomes an item (`included: true`, no icon); empty lines
  are dropped; the old `price` and `period` become the first entry of `prices`. `currency` cannot be invented, so
  stored plans get none: it is optional in the schema, a plan without one renders each `prices[].amount` (a string, as `price` is today) as stored, the
  migration reports each plan that lacks one, and the plugin asks for it when the editor saves a plan with more
  than one price (ADR-0018 section 2: no required field without a migration that fills it).
- **Node.** M (the landing, with the micelio-cloud plans).

### faq

- **Schema.** `faq-item` adds `defaultOpen`.
- **Options.** `variant` (`list`, `two-columns`); `tone` and `align` by F3.
- **Structured data.** JSON-LD `FAQPage`, emitted from the items' text (the answer's Markdown rendered to text); a
  page with several `faq` blocks emits one `FAQPage` with all the questions.
- **Static alternative.** Itself: native `<details>`, `open` when `defaultOpen` is set.
- **Migration.** M2. **Node.** M (docs and landing), B.

### cta

- **Schema.** Adds an optional `media` (an illustration). Both links take `icon` and the options of `link`.
- **Options.** `variant` (`banner`, `card`); `tone` and `align` by F3.
- **Static alternative.** Itself: the text, the media with its alt and two `<a>` links.
- **Migration.** M2. **Node.** M.

### newsletter

- **Schema.** Adds `consentText` (the legal text beside a checkbox: Ley 1581 or GDPR, whichever the node needs;
  optional, no default), `successMessage` and `placeholder` (optional). Today `section.newsletter` stores only
  `title`, `text` and `buttonLabel`; the block renders no consent text and no checkbox, and its placeholder and
  success sentence are the core's `myc.newsletter.placeholder` and `myc.newsletter.success` strings. Without the new
  fields the block cannot be reused on a second node.
- **Options.** `variant` (`inline`, `card`); `tone` and `align` by F3.
- **Static alternative.** Unchanged (ADR-0018 section 6); the consent text renders in the static form too.
- **Migration.** M2: nothing stored can fill the three fields, so the migration leaves them empty and reports each
  entry without a `consentText`. An empty `placeholder` or `successMessage` renders the core's `en`/`es` UI string,
  as today, so those entries render as before (a UI string, not a node's value). An empty `consentText` renders no
  consent line and no checkbox, as today; the renderer holds no neutral consent text, and the plugin asks for it when
  the editor turns the module on for an entry. **Node.** M, B.

### logo-cloud

- **Schema.** `logo.customIcon` (`media`, a brand's own mark, ADR-0021 section 7) beside `image`, mutually exclusive
  with it.
- **Options.** A `treatment` name (`original`, `monochrome`) is proposed for the vocabulary ("Amendments").
- **Static alternative.** Unchanged; the marquee stays CSS only.
- **Migration.** M2. **Node.** M (the landing).

### media-showcase

- **Schema.** Adds `eyebrow` (F2) and `bullets`, a repeatable `{ text, icon }`.
- **Options.** `variant` (`left`, `right`, `stacked`); `tone` and `align` by F3.
- **Static alternative.** Itself; a video shows its native controls.
- **Migration.** M2. **Node.** M.

### post-list

- **Schema.** Adds `showExcerpt` and `sort` (`newest`, `oldest`,
  `alphabetical`). The empty state is defined: a `post-list` with no articles renders a sentence from the theme's
  strings (`en`, `es`), never an empty box.
- **Options.** `variant` (`cards`, `list`, `featured`: the first entry larger) and `columns`; `tone` by F3.
- **Static alternative.** Itself, rendered with the page.
- **Migration.** M2. **Node.** B (blog), M (the landing's latest articles, once M has a blog).

### link

- **Schema.** `link` (`section.link`) adds `icon`, `iconPosition` (`start`, `end`, `only`; with `only` the `label` is
  the accessible name, ADR-0021 section 1), `external` and `download`. `rel` and `target` are decided by the core
  from `external` (`noopener`, `noreferrer`; `target` never set by the editor).
- **Options.** `iconPosition` (above, a vocabulary amendment). **Static alternative.** Itself: an `<a>`; with `only`
  the `label` is its accessible name.
- **Migration.** M2. **Node.** M, B.

### quote

- **Schema.** `shared.quote` fields `title` and `body` (misnamed) become `text`, `author`, `role` and `sourceUrl`,
  the same field set as `testimonial`, with the same markup (`<blockquote cite>`).
- **Merging.** The table that this plan was reviewed on says `quote` is mergeable with `testimonial` into one block
  with two variants. The plan proposes the shared field set and one renderer but **two blocks**: they sit in
  different zones, `testimonials` is a collection with a `single`/`grid` variant, and a merge is a MAJOR for no
  new capability. The maintainer decides in "Amendments".
- **Options.** `width`. **Static alternative.** Itself: `<blockquote cite>` with the author and role as text.
- **Migration.** M1: `body` becomes `text` and `title` becomes `author`. **Node.** B (articles), M (docs).

### tech-item

- **Schema.** `shared.tech-item` (`name`) becomes `shared.badge`: `label`, `icon` or `customIcon` (exclusive,
  ADR-0021 section 7: a technology mark is a brand's own mark), `url`. A badge list is a field of `feature-item`
  (above) and of the cards that replace `about.project`.
- **Options.** None: a badge is a part, styled by its block. **Static alternative.** Itself: a text label (the icon
  is decorative), a link when `url` is set.
- **Migration.** M1: `name` becomes `label`. **Node.** B.

## Icons

ADR-0021 decided the mechanism and left the choice of blocks to this plan.

**Step 1, now.** Four fields take `icon`, with `required: false` (an icon is never required on an existing block,
ADR-0021 section 6):

| Block | Field | Why |
| --- | --- | --- |
| `feature-grid` | `feature-item.icon` | Replaces today's upload; the first block with an icon |
| `link` | `link.icon` | Every call to action, and `iconPosition` |
| `stats` | `stat.icon` | The measurable guarantees of the landing |
| `pricing` | `plan.features[].icon` | The `included` marker per feature |

**Later,** each as MINOR with the block that needs it, never in a separate pass:

- `hero.badge`, `media-showcase.bullets`, `cta` (through its links). `faq`, `testimonials` and the About blocks stay text only.
- New blocks: `callout` (an icon per `kind`, with a core default per kind), `steps`, `tabs` (an icon per tab),
  `social-links` (icon and a required `label`: an icon stands alone, ADR-0021 section 1), `people` (through its
  links), `announcement`.
- `customIcon`, only for a brand's own mark (ADR-0021 section 7): `logo` and `badge`. Never on `feature-item`.

The theme-side rules (step 2: `icons/` in a theme, its admission rules, the picker previewing the theme's glyphs)
are outside this plan and wait for the first theme that draws glyphs.

## New blocks by wave

Columns: `Schema` (the fields), `Options` (names of the vocabulary, and `variant`), `Cost`, `Static` (what renders
without JavaScript), `Data` (structured data), `Node`. A block's zones are in its heading.

### Wave 1: writing

For the Micelio site's documentation and BogDev's technical articles. Every wave-1 block is `P` and `A`.

#### `callout`

- **Schema.** `kind` (`note`, `tip`, `warning`, `danger`, a `variant`), `title` (optional), `body` (restricted
  Markdown, no headings), `icon` (a catalogue name, with a core default per `kind`).
- **Options.** `variant`, `width`. **Cost.** `css`. **Static.** Itself. **Data.** None.
  A `warning` or `danger` has `role="note"` and its kind as text, so the meaning does not rest on colour.
- **Node.** M (docs), B.

#### `code`

- **Schema.** `code` (text), `language` (an enumeration of the languages the server's highlighter ships),
  `filename`, `highlight` (a list of line numbers), `caption`.
- **Options.** `width`. **Cost.** `css`; a copy button is a progressive enhancement the issue measures (class
  `island` if it needs one), absent without JavaScript.
- **Static.** The highlighted code, rendered on the server, as the `playground` fallback already does.
  **Data.** None. **Node.** M, B.

#### `tabs`

- **Schema.** Repeatable items `{ label, body (restricted Markdown), icon }`. No nested blocks: Strapi does not
  nest dynamic zones (ADR-0022).
- **Options.** `variant` (`tabs`, `pills`). **Cost.** `island` (`tabs`).
- **Static.** Every panel in order, each under its label as a heading; the tablist only exists once the island
  hydrates, so the content is the same text without it. **Data.** None. **Node.** M (install per platform), B.

#### `steps` (`steps` and `timeline` are one block)

- **Schema.** Repeatable items `{ title, text, icon, date }`; `date` only renders in the `timeline` variant.
- **Options.** `variant` (`numbered`, `timeline`). **Cost.** `css`. **Static.** Itself: an `<ol>` with CSS
  counters. **Data.** None (`HowTo` rich results were withdrawn by search engines and are not emitted).
- **Node.** M, B.

#### `table`

- **Schema.** `caption`, `columns` (repeatable `{ label, align: start | center }`), `rows` (repeatable
  `{ cells }`, one string per column, validated on save), `headerColumn` (the first column is a header).
- **Options.** `density`, `width`. **Cost.** `css`. **Static.** A `<table>` with its `<caption>` and `scope`
  attributes, scrolling inside its own box at phone width. **Data.** None. **Node.** M, B.

#### `toc`

- **Schema.** `title` (optional), `depth` (`2`, `3`). Nothing else: the list is built from the page's headings when
  the page renders, never stored.
- **Options.** `density`. **Cost.** `css`; no scroll-spy.
- **Static.** A list of anchors to the headings of the page, rendered on the server. Needs F2 and F4 (anchors on
  every heading). **Data.** None. **Node.** M (long docs pages), B (long articles).

#### `comparison`

- **Schema.** `columns` (repeatable `{ label, highlighted }`), `rows` (repeatable `{ feature, cells }`), where a
  cell is `yes`, `no`, `partial` or a short text.
- **Options.** `variant` (`table`, `cards`), `width`. **Cost.** `css`.
- **Static.** A `<table>` where `yes`/`no`/`partial` are text, with an icon beside it (decorative); in the `cards`
  variant at phone width the same table reflows by CSS. **Data.** None. **Node.** M (docs: options compared).

#### `changelog`

- **Schema.** Repeatable entries `{ version, date, title, body (restricted Markdown), tags (added, changed, fixed,
  removed, security) }`.
- **Options.** `density`, `width`. **Cost.** `css`. **Static.** Itself, newest first, each entry an `<article>`
  with a `<time datetime>`. **Data.** None. **Node.** M (release notes of Micelio).

### Wave 2: BogDev as the reference node and the Micelio landing

In this order: `citation` and `footnotes`, `figure`, `diagram`, `social-links`, `people`, refined `pricing` (above),
`announcement`, `chart`. `P` and `A` unless it says otherwise.

#### `citation` and `footnotes`

- **Schema.** `citation`: `text` and a `reference` (`shared.reference`, today only a field of `article`, so it moves
  into the block and the article's `references` stay for the bibliography). `footnotes`: repeatable `{ key, text }`,
  referenced from `prose` by a marker the server's Markdown renders and sanitizes (the sanitizer's allowlist grows
  by the footnote anchors and nothing else).
- **Options.** `width`. **Cost.** `css`.
- **Static.** Itself: `<blockquote cite>` and `<cite>`; footnote markers are in-page links and the notes an `<ol>`
  at the block's position. **Data.** The `citation` property of the page's JSON-LD (`CreativeWork` entries from the
  references). **Node.** B (technical articles), M (stats `source`).

#### `figure`

- **Schema.** `file` (required), `alt` (required), `caption`, and `credit` (`shared.image-credit`, **required**:
  kind and license are already required in the component). `media` has an optional `credit` and stays for content
  that has none; a required credit on `media` would be a new required field no migration can fill, because a credit
  cannot be invented.
- **Options.** `ratio`, `width`. **Cost.** `css`. **Static.** Itself: `<figure>` and `<figcaption>` with the
  credit as text. **Data.** `ImageObject` with `creditText`, `license` (from `licenseUrl`) and `creator`.
- **Node.** B (the reference node's credit policy).

#### `diagram`

- **Schema.** `source` (Mermaid text), `alt` (required, a prose description), `caption`. A block of its own, not an
  island inside `prose`.
- **Options.** `width`, `ratio`. **Cost.** `island` (`mermaid`, already in the registry). **Static.** The `alt` text
  and the source in a `<pre>`; the diagram appears when the island hydrates. **Data.** None.
- **Migration.** None: a fence inside `prose` keeps working. **Node.** B (articles), M (architecture docs).

#### `social-links`

- **Schema.** Repeatable `{ label (required), url, icon (required), me }`; `me` adds `rel="me"` (the verification
  the fediverse plugin and Mastodon profiles read). `variant` `follow` adds a lead text.
- **Options.** `variant` (`icons`, `list`, `follow`), `align`. **Cost.** `css`. **Static.** Itself; the `label` is
  the accessible name (an icon stands alone, ADR-0021 section 1). **Data.** `sameAs` on the site's `Person` or
  `Organization` JSON-LD. **Node.** B, M.

#### `people`

- **Schema.** Repeatable `{ name, role, photo, bio (restricted Markdown), links (section.link, repeatable) }`.
- **Options.** `variant` (`cards`, `list`, `byline`: one person under an article), `columns`, `align`.
- **Cost.** `css`. **Static.** Itself. **Data.** `Person` (`name`, `jobTitle`, `image`, `sameAs` from the links).
- **Node.** B (the author and About), M (the maintainers on the site). `team` of wave 3 is a variant of this block.

#### `announcement`

- **Schema.** `text`, `link` (`section.link`), `until` (a date, optional), `tone` via the option.
- **Options.** `tone`, `align`. **Cost.** `css`; no dismiss button in the first version (it would need
  `localStorage` and an island).
- **Static.** Itself. `until` is evaluated when the page renders; a static build evaluates it at build time, so a
  date that passes after the build keeps showing until the next build, which the issue documents.
- **Data.** None. **Node.** M (the release banner), B. It is meant to be written once and shown on many pages
  through the `reusable` block of ADR-0022.

#### `chart`

- **Schema.** `kind` (`bar`, `line`), `labels` (a list), `series` (repeatable `{ name, values }`, lengths checked
  on save), `unit`, `caption`.
- **Options.** `ratio`, `width`. **Cost.** `css` (the SVG is drawn on the server from the theme's category roles;
  no charting library on the client). **Static.** The SVG and, always, a `<table>` of the same data in a `<details>`
  below it, so the figures are readable without the drawing. **Data.** None.
- **Node.** B (technical articles with measurements), M (performance pages).

### Wave 3: described, not scheduled

No node of this plan asks for any of these (as of 2026-11-11). They are here so a node outside bogd3v that arrives
finds the design started, and so no block of wave 1 or 2 closes a door on them. The plan schedules none of it and
the issue list has no line for it.

| Block | Schema | Options | Cost | Static | Data | Node |
| --- | --- | --- | --- | --- | --- | --- |
| `location` + `hours` | `address` (parts), `phone`, `email`, `hours` (per weekday, ranges, exceptions), a `mapUrl` link | `variant`, `columns` | `css` | Address as text and a link to the map; **no embedded map** (a third-party request) | `LocalBusiness` with `openingHoursSpecification` | none asks |
| `whatsapp` | `number`, `message`, `label` | `variant`, `align` | `none` | A `wa.me` link; the request happens only when the visitor follows it | None | none asks |
| `contact-form` | `fields` (a closed set: name, email, message), `successMessage`, `consentText` | `layout` | `css` | A plain HTML `<form>` that posts to the node's form endpoint, and a `mailto` fallback | None | none asks; gated by the form endpoint (below) |
| `before-after` | Two `figure`s with captions | `ratio` | `island` (`before-after`) | The two images stacked, each with its label | None | none asks |
| `event`, `event-list` | `title`, `start`, `end`, `place`, `url`, `status` | `variant` | `css` | Itself, with an `.ics` link | `Event` | none asks |
| `documents` | Repeatable `{ title, file, kind }` | `density` | `css` | A list of links with type and size | None | none asks |
| `audio`, `audio-list` | `file`, `title`, `transcript` (required) | `variant` | `none` | Native `<audio controls>` and the transcript | `AudioObject` | none asks |
| `team` | A variant of `people` (wave 2) | | | | | none asks |

After 1.0, only when a node asks: `glossary` (`DefinedTermSet`), `ask-the-site` (it would call a model: it fails
filter 2 unless the node runs it itself, so the design starts there) and provenance over `citation`.

### Rejected

| Block | Filter it fails |
| --- | --- |
| `embed`, `video-embed`, `social-feed`, `map` | 2: a third-party request on every page. ADR-0018 section 5 only allows an embed "as a block with a declared origin"; the plan declares none |
| `html` | 3: raw HTML outlives the theme it was styled for (ADR-0018 section 5) |
| `countdown` | 4: no node asks, and a count that changes needs JavaScript to be correct |
| `carousel` (autoplay) | 1: the first slide is not an alternative for content the editor meant to rotate; `gallery` with the `slider` variant covers the need |

## What the two nodes also need

That is not a block:

| Need | Why | Owner |
| --- | --- | --- |
| **The per-site catalogue**: which blocks a site offers (a static site without a blog offers no `newsletter` or `post-list`) | The multi-site of milestone 7 puts both nodes in one CMS, and a block that needs a module a site has off must not be offered to its editors | Milestone 7 (multi-site). Missing as an issue: the list below has one, `feat(blocks): the per-site block catalogue` |
| **The shared rate-limited form endpoint** of the static plan | A static node has no server to post a form to | micelio-cloud. Missing: no issue exists in this repository or in `micelio-plugin-core`. It gates `contact-form` of wave 3, so nothing waits for it today |
| **The About blocks** | `about.*` is BogDev's | The cut-over of ADR-0017, below |

### The About blocks

The `about.*` components belong to one site, not to the core (standard, principle 2; ADR-0018 section 6). They are
absorbed at the cut-over, per site, and the plan commits only to the mapping below. `cards` is not a new block: a
`feature-item` with `icon`, `title`, `text`, `link` and `badges` is already a card, so the table's `cards` is
`feature-grid` (an amendment, below).

| `about.*` | Becomes |
| --- | --- |
| `profile` | `people` (variant `byline`) and a `prose` |
| `statement` | `prose` |
| `topics`, `principles`, `open-source` | `feature-grid` (`list`) |
| `projects` | `feature-grid` with `badges` (the old `tech-item`) |
| `contact` | `social-links` |

## Out by definition

- **Third-party embeds.** They fail filter 2. ADR-0018 section 5 allows an embed only "as a block with a declared
  origin"; no node of this plan needs one.
- **Raw HTML.** ADR-0018 section 5: it lets content outlive the theme it was styled for and bypass the sanitizer
  and the CSP.
- **Free columns.** ADR-0018 section 5, "Free positioning": a block's layout comes from its variant and options,
  the page's from the order of its blocks. A band that shares a surface is a group (ADR-0022), and that places
  nothing.
- **`ornament` as an option.** Decided against for now in ADR-0022 section 4: themes decorate through `tone`.

## The issue list

One line per implementation issue, ready to be opened under the milestone "Micelio · Catálogo de bloques" once the
maintainer approves it. **Repository** is where the issue is opened; where a unit also changes another repository
(the CMS owns the Strapi components until the cut-over, the plugin the catalogue entry, this repository the
renderer), each change is its own PR that references the same issue, CMS first (`.claude/TEAM.md`). **Depends on**
names a line by its number or an outside issue. Every issue carries the same definition of done: the catalogue
entry and its generated schema and reference, the mock Strapi rendering the block, the specimen, `en` and `es`
strings, the migration tested twice, and the cost measured in `docs/performance.md`.

Lines 6 to 10 are the step-1 follow-ups of ADR-0021 and lines 11 to 13 those of ADR-0022, with the record's title
(ADR-0021 gives none with a prefix; one is added and the first letter lowercased). The fourth ADR-0022 follow-up,
`feat(builder): group and reuse interactions` in `micelio-plugin-core` (Builder phase 3), is the builder's
interaction work, out of scope for this plan and not listed. Neither record names a repository for lines 6 to 10: the
plan assigns them by where the thing is pinned.

**`@micelio/icons` lives in `micelio-plugin-core`**, as a second package of that repository next to
`@micelio/strapi-plugin-core` (the repository becomes a workspace, which line 6 does). The pinned
`contract/icons.ts` already lives there, the admin's picker (`micelio.icon`) reads its index, and `micelio` consumes
it as it consumes the plugin's schemas (`docs/architecture/preview-contract.md`). The alternative is a repository of
its own, which costs a repository, a release line and a REUSE setup for a package with two consumers; the maintainer
chooses when approving.

| # | Title | Repository | Wave | Depends on |
| --- | --- | --- | --- | --- |
| 1 | `feat(blocks): stable ids for blocks and repeatable items, with the boot migration` | `micelio-cms` | 0 | none |
| 2 | `feat(blocks): eyebrow and anchor on the section heading` | `micelio-cms` | 0 | none |
| 3 | `feat(blocks): tone and align on every page section` | `micelio-cms` | 0 | none (the builder shows them after bogd3v/micelio#731) |
| 4 | `feat(blocks)!: one Markdown block, prose, with heading levels validated by position` | `micelio-cms` | 0 | 1 |
| 5 | `feat(blocks)!: gallery absorbs slider, is allowed in articles, with captions, credits and a lightbox island` | `micelio-cms` | 0 | 1 |
| 6 | `feat(icons): @micelio/icons: the Tabler set, the normaliser, the index and the pinned contract/icons.ts` | `micelio-plugin-core` | 1 | none |
| 7 | `feat(icons): the sprite renderer and the resolver` | `micelio` | 1 | 6 |
| 8 | `feat(icons): the micelio.icon custom field of @micelio/strapi-plugin-core` | `micelio-plugin-core` | 1 | 6 |
| 9 | `feat(blocks): iconStyle in the options vocabulary` | `micelio-plugin-core` | 1 | 6 |
| 10 | `feat(blocks): the catalogue entries: icon on feature-item, link, stat and plan.features` | `micelio-plugin-core` | 1 | 7, 8, 9 |
| 11 | `feat(content): the reusable-block type, its republish hooks and its export` | `micelio-plugin-core` | 1 | the content-types cut-over (milestone "Tipos de contenido al core") |
| 12 | `feat(blocks): the reusable block and the group key in the catalogue` | `micelio-plugin-core` | 1 | 1, 11 |
| 13 | `feat(renderer): render reusable blocks and groups, with the myc-group hook` | `micelio` | 1 | 12 |
| 14 | `docs(adr): amend ADR-0018 for the catalogue plan` | `micelio` | 1 | the maintainer's approval of "Amendments" |
| 15 | `docs(standard): the icon catalogue in the block contract row of section 6` | `micelio-engineering` | none (no milestone) | 6 |
| 16 | `feat(blocks)!: hero: eyebrow, badge, background apart from media, align and height` | `micelio-cms` | 1 | 2, 3 |
| 17 | `feat(blocks)!: feature-grid and feature-item: icon, link, numbered, columns, badges` | `micelio-cms` | 1 | 10 |
| 18 | `feat(blocks): link: iconPosition, external, download; rel and target decided by the core` | `micelio-cms` | 1 | 10 |
| 19 | `feat(blocks): cta: media and icons on links` | `micelio-cms` | 1 | 3, 10 |
| 20 | `feat(blocks): faq: FAQPage structured data and defaultOpen` | `micelio-cms` | 1 | 1 |
| 21 | `feat(blocks): newsletter: consentText, successMessage and placeholder` | `micelio-cms` | 1 | none |
| 22 | `feat(blocks): logo-cloud: the treatment option and customIcon` | `micelio-cms` | 1 | 7 |
| 23 | `feat(blocks): media-showcase: eyebrow and bullets` | `micelio-cms` | 1 | 2, 10 |
| 24 | `feat(blocks): post-list: featured variant, showExcerpt, sort and the empty state` | `micelio-cms` | 1 | none |
| 25 | `feat(blocks): callout` | `micelio-cms` | 1 | 1, 10 |
| 26 | `feat(blocks): code` | `micelio-cms` | 1 | 1 |
| 27 | `feat(blocks): tabs, with its island` | `micelio-cms` | 1 | 1 |
| 28 | `feat(blocks): steps and timeline` | `micelio-cms` | 1 | 1, 10 |
| 29 | `feat(blocks): table` | `micelio-cms` | 1 | 1 |
| 30 | `feat(blocks): toc` | `micelio-cms` | 1 | 2, 4 |
| 31 | `feat(blocks): comparison` | `micelio-cms` | 1 | 1 |
| 32 | `feat(blocks): changelog` | `micelio-cms` | 1 | 1 |
| 33 | `feat(blocks): stats: prefix, suffix, trend, source, icon and the count island` | `micelio-cms` | 2 | 10, 34 |
| 34 | `feat(blocks): citation and footnotes over shared.reference` | `micelio-cms` | 2 | 1, 4 |
| 35 | `feat(blocks): testimonials: sourceUrl, logo and rating` | `micelio-cms` | 2 | 1 |
| 36 | `feat(blocks)!: quote: text, author, role and sourceUrl` | `micelio-cms` | 2 | 1 |
| 37 | `feat(blocks): figure with a required credit` | `micelio-cms` | 2 | 1 |
| 38 | `feat(blocks): diagram as a block` | `micelio-cms` | 2 | 1 |
| 39 | `feat(blocks): social-links` | `micelio-cms` | 2 | 10 |
| 40 | `feat(blocks): people` | `micelio-cms` | 2 | 1, 10 |
| 41 | `feat(blocks)!: pricing: feature list, prices per period, currency, priceNote and the billing toggle island` | `micelio-cms` | 2 | 10 |
| 42 | `feat(blocks)!: tech-item becomes badge` | `micelio-cms` | 2 | 10, 17 |
| 43 | `feat(blocks): announcement` | `micelio-cms` | 2 | 12, 13 |
| 44 | `feat(blocks): chart` | `micelio-cms` | 2 | 1 |
| 45 | `feat(blocks)!: absorb the about blocks into people, feature-grid, social-links and prose` | `micelio-cms` | 2 | 4, 17, 39, 40, 42 |
| 46 | `feat(blocks): the per-site block catalogue` | `micelio-plugin-core` | 2 | milestone 7 (multi-site) |

Not opened:

- The step-2 issue of ADR-0021 (`icons/` in a theme, its admission rules, the picker's preview, the manifest field)
  stays a draft until the milestone of the first theme that draws glyphs exists (maintainer's decision of
  2026-11-11).
- Line 15 has no milestone and is created once line 6 exists (same decision).
- Wave 3 and "after 1.0" have no lines: no node asks.

Each `micelio-cms` line moves to `micelio-plugin-core` when the cut-over lands first; the line's text does not
change.

## Amendments to ADR-0018 for the maintainer to approve

None of these is made by this plan. Each is made by the issue named, when it ships (ADR-0021 and ADR-0022 do the
same). The maintainer approves or strikes each one.

| # | Amendment | Section | Issue |
| --- | --- | --- | --- |
| A1 | Two names of the options vocabulary: `iconPosition` (`start`, `end`, `only`; default `start`) and `treatment` (`original`, `monochrome`; default `original`). Vocabulary values are enumerations, so a boolean `monochrome` is not proposed. `numbered` is a value of `feature-grid`'s `variant`, not a name | 1 | 18, 22 |
| A2 | `iconStyle` is already decided by ADR-0021; recorded here so the vocabulary lists nine names with A2 alone (ADR-0018's eight and `iconStyle`) and eleven with A1 | 1 | 9 |
| A3 | The instance fields `blockId` and `itemId` beside the catalogue `id`, and their migration | 1, 2 | 1 |
| A4 | The cost classes `none`, `css` and `island` as the plan's shorthand for the `cost` field (bytes plus the island flag); the bytes stay the contract | 1 | none: the plan's convention only |
| A5 | Section 6 entries: `rich-text` and `slider` leave (merged into `prose` and `gallery`); `gallery` is allowed in the `article.blocks` zone too; `callout`, `code`, `tabs`, `steps`, `table`, `toc`, `comparison`, `changelog`, `citation`, `footnotes`, `figure`, `diagram`, `social-links`, `people`, `announcement`, `chart` enter; `quote` and `testimonial` change fields; the sentence that keeps `prose` and `rich-text` apart is struck; the `about.*` paragraph says they are absorbed | 6 | each block's issue |
| A6 | Section 6, "Parts and fields": `shared.badge` replaces `shared.tech-item`; `feature-item` gains `link` and `badges`; `plan` gains the repeatable `features` | 6 | 17, 41, 42 |
| A7 | ADR-0019 addresses a block by position and catalogue id; with F1 it could address it by `blockId` and survive a reorder. Not amended here; a decision for that record | ADR-0019 | none |

Decisions the plan needs from the maintainer, each with the plan's proposal:

1. **`quote` and `testimonial`:** one block with two variants (the reviewed table's suggestion) or two blocks with
   one field set (this plan).
2. **`feature-item.icon` uploads:** dropped with a boot-log report (this plan, honouring ADR-0021 section 7), or
   moved to a transitional `customIcon` (ADR-0021's Consequences).
3. **`@micelio/icons`:** in `micelio-plugin-core` (this plan) or in a repository of its own.
4. **`cards`:** `feature-grid` refined (this plan) or a block of its own.
