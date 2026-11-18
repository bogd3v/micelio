# Icons

**Kind:** explanation. For the contributor who renders an icon, changes how a name resolves, or
adds a theme's own glyphs. The decision is [ADR 0021](../adr/0021-icons-in-the-block-contract.md);
the package that holds the glyphs is `@micelio/icons`, built in `micelio-plugin-core`.

## What a page gets

A page that uses icons has one `<svg id="myc-icons">` at the start of its `<body>`, holding a
`<symbol id="myc-i-<name>">` for each name it uses and nothing else. An icon in the page is
`<svg class="myc-icon" width="1em" height="1em" stroke-width="1.5" aria-hidden="true"><use href="#myc-i-<name>"/></svg>`. The browser
asks for no icon file, in any site mode, and the Content Security Policy is not touched: the sprite is
markup, and its one `style` attribute falls under the `style-src 'unsafe-inline'` the page already has
(ADR 0004). A page that uses no icon has no sprite and is byte for byte as it was.

The filled drawing of a name is the symbol `myc-i-<name>-filled`. A name with no filled alternate
holds its outline drawing under that id, so the `<use>` of a `filled` icon never points at nothing.
A name asked in both styles on one page is two symbols.

## From a component to the sprite

1. `MycIcon` (`app/components/myc/MycIcon.vue`) takes `name`, `iconStyle` (`outline` by default, or
   `filled`) and an optional `label`. Without a label it is decorative (`aria-hidden="true"`); with
   one it is `role="img"` with that `aria-label`, the accessible name of an icon that stands alone.
2. It calls `useIconSprite` (`app/composables/useIconSprite.ts`), which returns the `href` and, on the
   server, records the symbol it needs in `event.context.iconSprite`.
3. When the render ends, `server/plugins/iconSprite.ts` (`render:html`) reads that record, builds the
   sprite with `spriteFor` (`server/utils/iconSprite.ts`) and puts it first in the body. A static or
   landing build renders its pages through the same server, so the sprite is written into each
   generated page at build time (ADR 0006).

The build and the browser keep no list of icons: a name is looked up when a page that uses it is rendered.

## How a name resolves

`resolveIcon` (`app/helpers/icons.ts`) is pure: it takes the lookups and files are read by the caller
(`iconSources` in `server/utils/iconSprite.ts`).

1. A value that is not a name of the catalogue (`ICON_NAME`: lower-case words and digits joined by hyphens)
   is never looked up, so content cannot reach a file path.
2. The active theme's `icons/<name>.svg`, if the theme ships that file. A theme draws a name once, in
   whatever style the page asks for.
3. The core's glyph from `@micelio/icons`: the style asked for, and `outline` when a `filled` drawing does not exist.
4. Nothing: the page has no symbol for that name, and `spriteFor` logs `icons.unknown` once per name and
   process. The `<use>` draws nothing.

No theme ships `icons/` yet, and the theme installer keeps only fonts and images, so step 1 of ADR 0021
resolves from the core alone. The lookup is written now so that step 2 (a theme's own glyphs, with their
admission rules) only adds files. `iconSymbol` already refuses a glyph that is not one `<svg>` of shapes with
`currentColor` paint, so a file that reaches the page before those rules exist cannot add a script, a style,
a link or a colour.

## A glyph that cannot be read

A glyph that cannot be read leaves the icon out and logs `icons.read` once per process; the page is still served.

## Cost

A sprite entry is about 300 bytes before compression and about 85 sent; the measurement is in
[`docs/performance.md`](../performance.md), "Icons: the cost of a sprite entry".

## A client-side navigation

The sprite written by the server holds the names of the page the server rendered. A dynamic site also renders pages in the browser,
from page data it fetches: the response then carries what the page needs. `/api/posts/:slug`, `/api/about` and `/api/pages/:slug` call
`withIconSymbols` (`server/utils/iconSprite.ts`), which finds the icons in the response (`iconRequestsIn`: an object with a string `icon`
that is a catalogue name, and `iconStyle`), resolves them like the sprite's and adds `iconSymbols`, the `<symbol>` of each by id. The fetchers
(`useStrapi`, `useSectionPage`) pass it to `addIconSymbols` (`app/composables/addIconSymbols.ts`, which loads `app/composables/insertIconSymbols.ts` as a chunk of its own the first time a response carries symbols, so the shared bundle of a site without icons is not heavier), which appends the symbols the document's
sprite does not hold, creating the sprite when the page had none. No request for an icon file is made and the CSP is unchanged: the symbols are
a few hundred bytes each inside a response the browser already fetches (`docs/performance.md`). The browser accepts only text shaped like what
`iconSymbol` writes (`iconSymbolIdOf`).

**How a block issue gets its names collected.** Keep `icon` (a name) and `iconStyle` in the block's public shape (`server/lib/publicShapes.ts`
or `server/schemas/page.ts`), and nothing else: the routes above scan their response. A new route that sends blocks calls
`withIconSymbols(body, event)` on what it returns, and its client fetcher calls `addIconSymbols`. The draft routes (`/api/drafts/...`) do not
yet; their pages render in the preview frame, where blocks also arrive by message (ADR 0019).

## Seeing it

`/_theme` (the specimen) shows a sample of names in both styles and one icon with a label. A static build
generates `/_theme/icons` only when `MICELIO_SPECIMEN=1`, for `e2e/static/icons.spec.ts`.
