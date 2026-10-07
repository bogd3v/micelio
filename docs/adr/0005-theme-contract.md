# ADR-0005: Theme contract v1

**Status:** Accepted
**Date:** 2026-10-03
**Amended:** 2026-10-04 (#262, #237), 2026-10-05 (#237, twice), 2026-10-06 (#238, #263, #306, #239)
**Deciders:** BogDev maintainer

## Context

Micelio is meant to let anyone run their own site by changing configuration, content and theme, without touching code. Today there is one design, BogDev's Bogotá palette, wired straight into the app: about 50 files in `app/` read primitives such as `var(--mirla)` or `var(--chillon)`, `settings/aliases.css` is a partial semantic layer, the modes `noche` and `dia` are hardcoded in `app/helpers/theme.ts` and its inline init script, the font preloads are hardcoded in `nuxt.config.ts`, and illustrations like `BdBird` and `BdPanorama` are core components.

Before extracting Bogotá into a package (#236, #237), testing themes (#238) and letting Strapi pick a theme and adjust it (bogd3v/micelio-cms#73, #239), the boundary between core and theme has to be fixed. A theme that can touch anything cannot be tested, budgeted or swapped. One that can touch too little is not worth making. Several contracts are already public and must not break: the `bd-theme` storage key, `data-theme="noche" | "dia"` on `<html>`, Strapi slugs and the design token names (spec, "Lo que NO cambia").

Micelio also promises what a WordPress theme cannot: a performance budget, verified accessibility and a UI built with the web platform instead of JavaScript libraries. Those promises only hold if they are part of the contract and CI enforces them. And because the goal is for other people, and their agents, to write themes, the contract has to be easy to learn and to check without reading the core's source.

## Decision

A theme is **tokens + CSS + a closed set of slots**, declared in `theme.json` and validated against a versioned contract. The core and themes are written in plain CSS, without a utility framework. A theme customizes the site at four levels: semantic roles, layout variants implemented by the core, a published list of styling hooks, and slots, so two themes can give the same content a different identity and a different structure. A theme declares its own modes. Strapi chooses an installed theme and may adjust two things: the accent per mode and the display font from a curated list. Writing a theme is supported by a schema, a starter theme, a checker and generated reference docs.

### 1. Semantic roles (v1)

Roles are CSS custom properties, named without a prefix like the current tokens. Components, layout, pages, utilities and `useMermaid` read roles only; primitives (`--mirla`, `--chillon`…) are allowed only inside a theme package and `assets/css/settings/`, and a lint rule fails otherwise (#236). Every color role has a value in every mode the theme declares.

| Group | Roles |
| --- | --- |
| Surfaces | `surface`, `surface-raised`, `surface-sunken` |
| Lines | `line` (decorative), `line-strong` (control borders, ≥ 3:1 on every surface) |
| Ink | `ink`, `ink-muted`, `on-ink` |
| Accent | `accent`, `accent-soft`, `accent-hover`, `on-accent`, `link`, `focus`; optional: `link-soft` (tinted background for links, highlights and active items; core default: `link` mixed into `surface`) |
| States | `success`, `warning`, `danger`, `info`, each with `-soft` |
| Categories | `category-1` … `category-5`, each with `-soft` |
| Code | `code-ink`, `code-muted`, `code-keyword`, `code-string`, `code-number`, `code-function` (on `surface-sunken`) |
| Typography | `font-display`, `font-sans`, `font-mono`; the scale `display-xl`, `display-l`, `heading-1`…`heading-3`, `body-l`, `body`, `body-s`, `eyebrow`, `meta`, `code`, each as `text-<step>` (a `font` shorthand: weight, size, line height, family) and `tracking-<step>` (letter spacing) |
| Space and layout | the scale `space-1`, `space-2`, `space-3`, `space-4`, `space-6`, `space-8`, `space-12`; `space-section` (between page sections), `space-gutter` (grid gap), `space-inline` (side margin, per breakpoint); `container` (max content width), `measure` (max prose width), `nav-height` |
| Shape | `radius-control`, `radius-card`, `radius-full`; `shadow-raised`, `shadow-overlay`, `glow-accent` (may be `none`); optional: `glow-link` (glow on focused and hovered interactive surfaces; core default: `none`) |
| Motion | `duration-fast`, `duration-base`, `duration-slow`, `ease-standard`, `ease-emphasized` |

The two optional roles were added with #236, when Bogotá's components moved onto roles: chillón is both its link color and the background or glow of active items, and contract v1 had no role for those. Adding an optional role with a core default stays in v1 (section 6). Illustrations in the core draw from the category roles as the theme's palette.

**Amendment (2026-10-04, #237):** Typography roles are `text-*` and `tracking-*`, one of each per step of the scale. The typography classes (`.bd-heading-1`, `.bd-eyebrow`…) stay in the core, in `bd.settings`, and read those roles, so a theme changes type by setting roles, not by restyling the classes.

`link` and `focus` are separate roles because a theme may draw them from a color other than the accent. Bogotá does: `accent` is mirla, `link` and `focus` are chillón. Mermaid's `themeVariables` are derived by the core from roles (today's `mermaidThemeVariables` mapping, rewritten on roles); a theme may override individual variables under `mermaid` in `theme.json`, with values that are roles, not colors.

Contrast rules, checked per mode by #238 (WCAG 2 AA): `ink`, `ink-muted`, `link`, `accent`, states and categories as text ≥ 4.5:1 on the three surfaces and on their own `-soft`; `on-ink` on `ink` and `on-accent` on `accent` ≥ 4.5:1; `line-strong`, `focus` and `accent` as non-text ≥ 3:1. The `usage` notes in `theme.json` (formerly `tokens.json`) become these assertions.

**Amendment (2026-10-06, #238):** The rule table also holds `code-ink`, `code-muted`, `code-keyword`, `code-string`, `code-number` and `code-function` on `surface-sunken` ≥ 4.5:1, `on-accent` on `accent-hover` ≥ 4.5:1, and `link` on `link-soft` ≥ 4.5:1. Text is 4.5:1; a role gets 3:1 only where the table says so (`line-strong`, `focus`). Optional roles are checked too: one the theme omits is checked with the core default it renders. A token may declare more in `theme.json`: `contrast: [{ "on": "<role or token>", "min": <ratio> }]`, asserted in every mode; this is where the ratios that `usage` notes used to claim live, and `usage` stays descriptive. Contrast runs in `npm run theme:check`, in Vitest (`test/themeContrast.test.ts`, every installed theme × mode) and in the lint job of CI, **not** in the Nuxt build, so a theme in progress does not stop `nuxt dev`. Color math is in-repo (`modules/theme/color.ts`, no color library): Lightning CSS, already a dependency, lowers any CSS color (`color-mix`, `oklch`, `lab`…) to sRGB, translucent colors are composited over the mode's surface, and the nearest passing value of an error, and the accent adjustment of section 8, come from the same OKLCH lightness search. `theme:check` also reports the static budgets of section 9 (theme CSS gzip, font families); the font total is a warning above 100 KB and an error above 150.8 KB, Bogotá's recorded exception (143.6 KB today; KB are KiB, as in the perf budgets).

### 2. Modes

A theme declares one or more modes in `theme.json`: `modes: [{ "id": "noche", "scheme": "dark", "name": "Noche" }, …]`. Ids match `^[a-z][a-z0-9-]*$` and are unique within the theme; the first mode is the theme's default. Bogotá declares `noche` (dark) and `dia` (light), so nothing public changes:

- `data-theme` on `<html>` carries the **mode id**, as today. The init script also sets `data-scheme="light" | "dark"`, and `color-scheme` follows it. Theme CSS selects on `data-theme`; core CSS that depends on lightness (today `:not([data-theme="dia"])`) selects on `data-scheme`, so it works with any theme.
- `bd-theme` keeps storing the visitor's choice, now any mode id. A stored value that is not a mode of the active theme is ignored, not deleted, so switching back to a theme restores it.
- Resolution, in the init script and on the server: the stored choice if valid → Strapi's `defaultMode` if it is a mode of the active theme → the first mode whose `scheme` matches `prefers-color-scheme`, when the theme has modes for both schemes → the theme's first mode. With no `defaultMode`, BogDev behaves exactly as today.
- The mode switch shows only when the theme has more than one mode; a single-mode theme renders without it.

**Amendment (2026-10-04, #237):** `data-scheme` is the only attribute core CSS selects on for lightness (`[data-scheme="dark" | "light"]`); rules for a specific mode belong in the theme's `theme.css`. The server writes the first mode's `data-theme` and `data-scheme` into the `<html>` attributes in the `render:html` hook, not with `useHead`, so visitors without JavaScript get the theme's default mode and hydration does not overwrite what the init script set. The init script is generated once per build from the active theme's modes and is byte-identical across requests, so its CSP hash ([ADR-0004](0004-hash-based-csp.md)) changes only between builds; it reads `data-mode-default`, which the server sets only when Strapi's `defaultMode` applies (#239), and never the server-written `data-theme`, so `defaultMode` needs no per-request script. A theme declares at most 6 modes, which keeps the script under 2 KB. Legacy storage keys keep migrating through `scheme`: `devbog-color-mode` (`dark` | `light`) maps to the first mode with that scheme.

### 3. Styling: plain CSS, no utility framework

The core and every theme are written in standard CSS: cascade layers, nesting, custom properties, `color-mix()`, `oklch()`, `@scope` and container queries. Lightning CSS, which Vite already ships, lowers nesting and other syntax for the browser targets and minifies; stylelint enforces the roles-only rule and the theme rules. There is no utility framework and no CSS-in-JS. `tailwindcss`, `@tailwindcss/typography` and `@nuxt/ui` leave the project in a dedicated issue of this phase (#262), before or together with #236.

The reasons, measured on 2026-10-03 against a production build:

- **Little use.** 290 Tailwind utility classes in 15 of 93 components, against about 1,300 `bd-*` classes; 136 of those utilities are in `SliderBlock.vue`. `@nuxt/ui`, which is what brings Tailwind in, is used only for 6 `<UIcon>`.
- **Unpredictable output.** Tailwind's layers are about 30 KB of the 160 KB raw `entry.css` (about 5 KB gzipped), and 12.6 KB of that are 77 `.prose` rules nobody uses: the article uses `.bd-prose`, but the scanner finds the word `prose` in the source and emits the typography plugin's stylesheet. A per-theme CSS budget needs output that follows from the source.
- **Utilities cannot be themed.** Classes in a template win over the theme's layer by design, so anything styled with utilities is fixed for every theme. Several use Tailwind's palette (`bg-white/90`, `text-neutral-900`, `ring-white/50`), which bypasses the roles and would break contrast in other themes.
- **Reach.** Every front-end developer and designer writes CSS; not all of them know Tailwind, and those who do would expect to put utilities in templates, which a theme never touches. Agents also write plain CSS well, and a single naming system (roles and hooks) is easier for them to follow and for a linter to check.

The replacements: an own reset in `bd.base` instead of Tailwind's preflight; the documented core utilities in `bd.utilities` (`.bd-sr`, `.bd-wide`… already exist, plus the few the layout needs); icons as inline SVG components, like those in `app/components/icons/`; `[data-scheme="dark"]` instead of the `dark` variant. The layer order becomes `bd.settings, bd.base, bd.components, bd.layout, bd.pages, bd.theme, bd.animations, bd.utilities`.

How an author produces `theme.css` is up to them (by hand, Sass, PostCSS, or even a utility framework on their machine): the file in the package is what is validated and shipped.

**Amendment (2026-10-04):** The layer order was implemented as `bd.reset, bd.settings, bd.base, bd.components, bd.layout, bd.pages, bd.animations, bd.utilities` in #262. The `bd.reset` layer separates the CSS reset and element defaults (`reset.css`, `base.css`) from the view-transition and focus rules (`view-transition.css`, `focus.css`), ensuring that role-valued classes in `bd.settings` (e.g., `.bd-eyebrow`, `.bd-heading-*` generated by `npm run tokens`) sit above all element defaults. The `bd.theme` layer (#237) is inserted between `bd.pages` and `bd.animations` when themes are introduced. Lightning CSS with explicit browser targets (chrome 111, edge 111, firefox 114, safari 16.4, ios 16.4) replaced Tailwind's autoprefixer and cssnano. Lightning CSS drops the `@layer` order statement when it bundles every layer into one file, so a theme stylesheet must be imported through `main.css` (not loaded as a separate file) to keep `bd.theme` before `bd.animations`.

**Amendment (2026-10-04, #237):** With themes the full order is `bd.reset, bd.settings, bd.base, bd.components, bd.layout, bd.pages, bd.theme, bd.animations, bd.utilities`. Theme CSS reaches the bundle only through files the theme module (section 4) writes to `#build/micelio/*.css`, which `main.css` imports at fixed positions: the generated role values into `bd.settings`, the active layout variants into `bd.layout` and `bd.pages`, and `theme.css` plus slot CSS into `bd.theme`. Themes are never added to `nuxt.options.css`, so the order comes from the import position in `main.css` and does not depend on the `@layer` statement surviving the bundle.

### 4. Theme package

A theme lives in `themes/<id>/` in the repository (publishing themes or Micelio on npm is decided later, with its own ADR):

```
themes/bogota/
  theme.json        $schema, contract, id, name, modes, roles per mode, type, layout, fonts, slots, mermaid
  theme.css         hand-written: the theme's styling of public hooks and of its own slots
  sections.css      hand-written: the theme's styling of the page sections (optional)
  fonts/            woff2 files and their licenses
  images/           images used by theme.css and slots (optional)
  i18n/             <locale>.json, messages under the theme.* namespace (optional)
  slots/            ThemeMark.vue, ThemeHero.vue, ThemeDivider.vue, ThemeEmptyState.vue, ThemeIllustration.vue, ThemeProgressMarker.vue, ThemeSupportArt.vue (all optional)
  templates/        og.vue (OG image), email.ts (newsletter email shell) (optional)
```

- **`theme.json`** uses the format of the former `docs/design/tokens.json` (now Bogotá's `theme.json`; its `layout` token group is renamed `size`, because `layout` names the variants; top-level `modes` replaces `color.themes`), plus `$schema`, `contract`, `id` (the folder name), `modes` and `fonts`. Role values are colors or references to the theme's primitives (`{chillon}`), resolved by the theme module at build time.
- **Role CSS** is generated at build from `theme.json`, one block per mode, into `bd.settings`; no generated file is checked in.
- **`theme.css`** is written by hand and imported into the layer `bd.theme`, after the core's components, layout and pages and before animations and utilities (section 3). It styles public hooks and its own slots (section 5); it may not `@import` remote URLs, use `url()` outside its own `fonts/` and `images/`, or use `!important`.
- **Fonts** are self-hosted woff2, subset to the scripts the site uses, `font-display: swap`, with fallback faces whose metrics are adjusted (`size-adjust`, ascent and descent overrides) as in `font-fallbacks.css` at the theme's root. `theme.json` lists them and marks which are preloaded; the core builds the preload links from that list instead of `nuxt.config.ts`. The active theme's `fonts/` is served at `/fonts/`.
- **Images** in `images/` are served at `/theme/images/`; `theme.css` and slots reference them there.
- **Messages** in `i18n/<locale>.json` live under the `theme.*` namespace and are merged into the site's i18n at build; a theme's user-facing text never lives in the core's locale files.
- **Slots** are a closed list (amended 2026-10-04, #237, which added `ThemeIllustration`, and 2026-10-05, which added `ThemeProgressMarker` and `ThemeSupportArt`). The core renders them by name and ships neutral default implementations in `app/theme/defaults/`, so a theme that ships none still works. Adding a slot with a core default stays in contract v1 (section 6); removing a slot or changing its props is a contract change.

  | Slot | Props | Bogotá | Core default |
  | --- | --- | --- | --- |
  | `ThemeMark` | `size`, `context: 'header' \| 'footer'` | its logo and the `Bog<span>Dev</span>` wordmark | `site.name` as text |
  | `ThemeHero` | `compact` | the hero photo and flight art | neutral |
  | `ThemeDivider` | `placement: 'footer'` | the footer panorama of the eastern hills, declared an island | neutral |
  | `ThemeEmptyState` | none (wraps the content) | the perched bird | neutral |
  | `ThemeIllustration` | `category`, `size` | the category birds | neutral |
  | `ThemeProgressMarker` | `progress` (0 to 100) | a bird that flies along the reading-progress bar of articles | none (the bar alone) |
  | `ThemeSupportArt` | none | a bird perched on the coffee cup of the support section | none |

  A slot that needs JavaScript (today only Bogotá's `ThemeDivider`) declares itself an island in `theme.json` (section 12). `site.logo` from Strapi is used for structured data only and never replaces a theme's `ThemeMark`. Only the active theme's slots are registered, so unused ones are not bundled.

  Slots are registered as plain components, so every slot still hydrates. The island rule (section 12) is enforced by the validator, not at runtime: see section 12.
- **Templates** for the OG image and the newsletter email shell are optional; the core has neutral defaults. They read roles and the site identity, never hardcoded site values.
- The active theme is chosen at build time with `NUXT_PUBLIC_THEME` (default `bogota`); only installed themes can be selected, and only the active theme's CSS and fonts reach the page.
- **Module** (amended 2026-10-04, #237): a local Nuxt module in `modules/theme/` (not a Nuxt layer; see option C) discovers themes in `themes/` at the repository root, plus the directories in `MICELIO_THEME_DIRS` (used by test fixtures), validates them, fails the build if `NUXT_PUBLIC_THEME` is not installed, generates the CSS above and exposes `#micelio/theme` (id, modes, fonts, layout, slots) with types. As with `NUXT_PUBLIC_SITE_MODE` ([ADR-0006](0006-site-modes.md)), startup fails if the runtime value disagrees with the build.

  **Amendment (2026-10-05, #237):** the module is split by concern, and `index.ts` only calls the pieces: `context.ts` (the active theme and the lists the other files fill), `assets.ts` (fonts, images, messages), `css.ts` (every `#build/micelio/*.css` template), `data.ts` (`#micelio/theme` and its types) and `modes.ts`, `slots.ts`, `layout.ts`. The theme's `images/` is copied to `<buildDir>/micelio/public/theme/images/` and that root is added to `image.dirs`: `@nuxt/image` serves its dirs as public assets and IPX reads them in dev and in production, whereas a `publicAssets` entry alone is invisible to IPX in dev and a symlink is rejected by IPX. For that, `modules/theme` is listed before `@nuxt/image` in `nuxt.config.ts`, which reads `image.dirs` when it is set up. The theme's `i18n/<locale>.json` files are registered with `i18n:registerModule` and go through the same precompiler as the core locales (`modules/precompile-messages.ts`), so they reach the client compiled.

  **Amendment (2026-10-05, #237, PR 7):** the validator, the hooks list and the schema are implemented. `modules/theme/contract.ts` (with `roles.mjs`, which also holds the optional-role defaults the generated CSS falls back to) is the contract; `themes/theme.schema.json` is generated from it (`npm run theme:schema`) and `npm run lint` fails when it drifts. `validate.ts` checks every installed theme, and `css-rules.ts` checks theme CSS against `app/theme/hooks.json` (a theme's own `data-*` attributes start with `data-<id>-`; `url()` may only point at `/fonts/` and `/theme/images/`). Additions that keep contract v1 (optional, with a core default): `images` in `theme.json` (`favicon`, `ogImage`, `profile`: files of `images/` the core uses when the site settings or the content have none; Strapi's `site-setting.defaultOgImage` and `favicon` take precedence over the theme's), the slots `ThemeProgressMarker` (inside `.bd-progress`; the slot renders its own `.bd-progress-track` lane, the core default renders nothing, and the header's bar remains) and `ThemeSupportArt` (an SVG `<g>` inside the cup of the support section; default nothing), and messages the core reads when a theme provides them: `theme.hud.{city,coords,altitude,madeIn}` (the place line of the header, hero, footer and article byline; absent, nothing renders), `theme.guide.*`, `theme.latest.emptyNote`, `theme.palette.names` and `theme.profile.alt` (each with a neutral core text or none). `ThemeEmptyState` wraps its content (the core default is a `div`; Bogotá adds the perched bird) and receives the accent of its picture as the `--empty-accent` custom property.

### 5. Customization levels: roles, layout variants, hooks and slots

The goal is that two themes on the same content look like two different sites, not one site in two palettes. A theme changes the site through four levels, in this order of preference:

1. **Roles** (section 1): colors, type, space, layout widths, shape and motion. They already change density, rhythm and proportions, not only color.
2. **Layout variants**: structure that needs different markup, chosen by the theme from a closed set the core implements.
3. **Public hooks**: CSS on the elements the core publishes for restyling.
4. **Slots** (section 4), for what neither markup variants nor CSS can express.

**Layout variants.** The core implements each region of the site in a few variants, all with semantic markup, a logical reading order and no JS; the theme picks one per region under `layout` in `theme.json`, and an omitted region uses the core's default (the first variant). Contract v1 starts with two variants per region, Bogotá's current layout and the starter's (section 7):

| Region | Variants (v1) |
| --- | --- |
| `header` | `bar` (logo, navigation and actions in one sticky row), `centered` (logo centered above the navigation) |
| `home` | `showcase` (hero, featured article and grid), `index` (introduction and the post list, no hero) |
| `postList` | `grid` (cards), `list` (rows with date, title and excerpt) |
| `article` | `aside` (table of contents and metadata in a side column), `centered` (one column, table of contents collapsed at the top) |
| `footer` | `columns`, `minimal` |

Bogotá's current layout maps to the first variant of each region in #237. The theme is chosen at build time, so only the variants the active theme uses are bundled: each variant's component and CSS live in their own files, and an unused variant costs nothing. A new variant enters the core by PR, like a new section, and must be styled by every installed theme, shown in `/_theme` and pass the quality matrix (#238). Strapi does not choose variants: structure belongs to the theme, so the same `themeId` always looks the same.

**Amendment (2026-10-06, #263):** `header: centered` and `footer: minimal` are implemented, so a region can have more than one variant in the core. Every selector of a variant's CSS is scoped by its region's `data-layout` (`.bd-header:where([data-layout="centered"])`, `:where(.bd-header[data-layout="bar"]) .bd-nav`), with `:where()` so specificity does not change; only `:root` and `html` rules (`--bd-header-h`, `scroll-padding-top`) stay unscoped, and the active variant's file is imported last so its values win. Bogotá's `bar.css` and `columns.css` follow the same rule (about 160 B gzip more). When `MICELIO_SPECIMEN=1` (e2e and theme-quality builds, never the perf build) or in dev, `/_theme` also registers the variants the theme does not use under their own names (`RegionHeaderCentered`, listed in `#micelio/specimen-variants`, never in `#micelio/theme`) and imports their CSS before the active one, so each region is shown in every variant. A production build without the flag contains neither the components nor the CSS (`test/themeModule.test.ts`, `test/themeHooks.test.ts`). `centered` sets `--bd-header-h` to 152px on desktop; `minimal` omits the support link, the `ThemeDivider` slot and the "made in" line.

**Amendment (2026-10-06, #306):** every footer variant renders the link to the site's source code that the AGPL requires (section 13, [ADR-0007](0007-license.md)), inside `.bd-foot-legal`, with the public hook `bd-foot-source`. A theme may restyle it but must keep it visible; a footer variant added to the core renders it too. The same record makes the contract a license boundary (theme exception, `LICENSE-EXCEPTION.md`), so the contract now lists the **slot APIs**, the only parts of the core a slot may call or import: `useSite()`, `useAnimations()`, the helpers of `~/helpers/categories`, the types of `~/interfaces`, plus Vue, Nuxt and `@nuxtjs/i18n` APIs. Adding a slot API stays in v1; removing one is a contract change.

**Amendment (2026-10-06, #263, second batch):** `home: index`, `postList: list` and `article: centered` complete the second variant of every region, with the same scoping (`:where(.bd-home[data-layout="index"]) …`, `:where([data-layout="list"]) …`); `showcase.css`, `grid.css` and `aside.css` were re-scoped, and the aside-only rules for `.bd-article-share` moved from `pages/article/after.css` into `aside.css`. `index` shows the site name and description (`useSite()`, the text of `/api/site`) and a link to the about page, then the latest articles (`HomeLatest`, so no extra request); it leaves out the hero, the featured article and the topic guide, and keeps the fediverse and newsletter sections under their modules. `list` always renders rows (date, title, excerpt, meta) and ignores the blog's `grid | log` switch: the blog page does not render the switch when `layout.postList` is `list` (build-time value from `#micelio/theme`) and forces the grid page size; the `view` prop stays for interface parity. `centered` keeps everything `aside` shows in one column: head and byline, cover, the table of contents in a native `<details>` (closed, no JS), the content, references, tags, reading path, author, support, the share buttons, comments and related articles. It has no sticky element, so `--bd-header-h` only matters for anchor scrolling.

**Public hooks.** A closed, versioned list of `bd-*` classes and `data-*` attributes that themes may select. It covers every structural region from v1, not only what Bogotá restyles today: site header, navigation, mode switch, footer, hero, card, post list, pagination, article header and metadata, table of contents, sidebar, prose, callout, code block, figure, button, form field, tag and chip, comments, newsletter form, each `page` section with its `data-variant`, and each layout region with `data-layout="<variant>"`. Element selectors are allowed inside a hook (`.bd-prose h2`). The list lives in the core (`app/theme/hooks.json`), and each entry says what the element is, which states it has (`:hover`, `[aria-current]`, `[data-variant]`) and in which layout variants it appears.

A theme's own classes, inside its slots, use its id as prefix (`bogota-`). The validator parses every selector in `theme.css` and rejects a `bd-*` class or core `data-*` attribute that is not a public hook. Every other `bd-*` class is internal: the core can rename it in any release without breaking a theme. Adding a hook or a layout variant stays in contract v1; removing or renaming one, or changing a hook's markup in a way that breaks existing selectors, is a contract change.

### 6. Versioning and validation

`theme.json` declares `"contract": 1`. The contract is defined once, with zod, in the theme module (section 4). A build module validates every installed theme before Nuxt builds, and the build fails, naming the theme and the problem, when a theme declares an unknown contract version, misses a role in any mode, declares an invalid or duplicate mode, references a missing font or primitive, ships a slot outside the list, names an unknown layout region or variant, selects something that is not a public hook, or breaks a rule of `theme.css` above. A breaking change to roles, modes, layout variants, hooks, slots or package layout is `contract: 2` with a migration note; adding an optional role, layout variant, hook or slot with a core default stays in v1.

**Amendment (2026-10-06, #324):** removing a requirement that no installed theme can depend on stays in v1. `space-16`, `space-24`, `category-6` and `category-6-soft` are no longer required roles: the core never read them (it has five categories, `Category` in `app/interfaces/design.ts`), and a theme that still declares them keeps validating, because an extra name in a group is a theme primitive. `ThemeDivider`'s `placement` narrows to `'footer'`: the core is the only caller and only ever passed `footer`, so a slot that still accepts `'section'` keeps working. Reintroducing a sixth category or a larger space step is an optional role with a core default, also in v1.

### 7. Theme authoring

Writing a theme must not require reading the core. The contract ships with:

- **A JSON Schema** of `theme.json` (`themes/theme.schema.json`), generated from the same definitions the validator uses and referenced from each theme's `$schema`, so editors autocomplete and validate it and agents can read the contract directly. It is generated from the zod definitions (`z.toJSONSchema`), checked in and checked for drift in CI, and reserves `sections` (section 11) for the section catalog (section 11).
- **A starter theme** (`themes/starter/`): every role in two modes (one light, one dark), commented, passing every check. It is deliberately the opposite of Bogotá (light first, serif display, rounded shapes, generous spacing, the second variant of every layout region), so it proves the contract allows a different site and not only a different palette, and gives authors the second example of every variant. It is the template to copy, and stays in CI so it never rots. A single-mode test theme lives in the fixtures (#237).
- **`npm run theme:check [id]`**: the same validation as the build plus the contrast matrix and the hooks check (#238), runnable on its own. Errors name the theme, mode, role, surface, measured ratio and the nearest value that passes; `--json` prints the same as data for agents and editors.
- **`/_theme`** (#238) with hot reload: the whole catalog, every component state and every section variant in every mode, to design against.
- **Reference docs generated from the contract** in `docs/themes/`: roles, hooks and slots from the schema and `hooks.json`, so they cannot drift, plus the [How to create a theme](../themes/creating-a-theme.md) guide (#238).
- **For agents**: a `create-theme` skill in `.claude/skills/` and a themes section in `AGENTS.md` with the loop: copy the starter → edit `theme.json` and `theme.css` → `theme:check` → review `/_theme` in every mode.

### 8. Overrides from Strapi

`site-settings.theme` (bogd3v/micelio-cms#73) holds:

| Field | Value | Validated by Strapi | Resolved by the Nuxt server (#239) |
| --- | --- | --- | --- |
| `themeId` | slug | format | An installed theme, else the default theme |
| `defaultMode` | slug | format | A mode of that theme, else ignored (section 2) |
| `accentOverrides` | `[{ mode, color }]` | `color` is `#RRGGBB`; `mode` is a slug, unique in the list | Overrides for modes the theme does not have are ignored |
| `displayFont` | `archivo`, `fraunces`, `bricolage-grotesque`, `newsreader`, `space-grotesk` | enumeration | Replaces `font-display` only |

Empty fields mean "use the theme", so with nothing set BogDev looks exactly as today. Nothing else can be overridden: free-form tokens and custom CSS from the CMS are rejected (see Options).

**Accent.** The override replaces `accent` in its mode; the server derives `accent-soft`, `accent-hover` and `on-accent` from it (`on-accent` is the theme's dark or light ink, whichever contrasts more). `link` and `focus` follow the override only when the theme defines them as `{accent}`; categories never do, so an override does not recolor categories. The server checks the contrast rules of section 1 against the mode's three surfaces; if the accent fails, it moves its lightness in OKLCH (keeping hue, reducing chroma only to stay in gamut) towards more contrast until it passes, and logs the adjustment. If no lightness passes, the theme's accent is kept. Contrast is computed on the server because it needs the theme's surfaces, which Strapi does not know.

**Display font.** The curated faces ship with the core, not with themes, in `assets/fonts/display/`: latin subset, `wght` axis only, at most **60 KB** per file (measured on 2026-10-03 with Google's latin subsets: Fraunces 35.8 KB, Bricolage Grotesque 40.4 KB, Newsreader 56.7 KB, Space Grotesk 21.8 KB; Archivo is subset to `wght` only for this use). Each has a generated fallback face. Choosing a font emits its `@font-face` and its preload; choosing the font the theme already uses for display emits nothing. The mono family cannot be overridden. A new font enters the list by meeting these limits in a PR to the core and adding the value to the Strapi enum.

**Injection.** The server renders the overrides into one `<style id="theme-overrides">` in the SSR `<head>`: per-mode role values under `[data-theme="<mode>"]` and, when a display font is chosen, its `@font-face` and `--font-display`. It is unlayered, so it beats the theme's layered values. Values are re-serialized from the parsed color and the enum lookup, never interpolated from the raw CMS string. It is cached with the page under ISR ([ADR-0001](0001-isr-without-cdn.md)) and changes when the site settings do. The CSP already allows inline styles ([ADR-0004](0004-hash-based-csp.md)); if `style-src` is tightened later, this block gets a hash computed in the same `render:html` hook as the scripts.

**Amendment (2026-10-06, #239):** "Installed" means the theme the build was made with (`NUXT_PUBLIC_THEME`): the build bundles one theme, as section 4 requires (only the active theme's CSS, fonts and slots reach the page) and as the budgets of section 9 assume. A `themeId` that names another theme is ignored and logged, and the other fields still apply to the built theme by mode id; choosing among several themes at runtime needs bundling them all and would get its own ADR. The derivations are fixed in the core, the same for every theme: `accent-soft` mixes 14 % of the accent into `surface` in OKLab, `accent-hover` mixes 80 % of the accent with `ink`, and `on-accent` is `ink` or `on-ink`, whichever contrasts more. The candidate accent must meet the section 1 rules for `accent`, `on-accent` and, when they follow the accent, `link` and `focus` (an alias chain that ends in `{accent}` counts). The lightness search takes the nearest OKLCH lightness that passes, in either direction; on a tie, the one with more contrast on `surface`. The glow roles (`glow-accent`) keep the theme's value; an override does not recolor them. The server resolves the overrides with the site settings (the same 60-second cache as the modules), so a change in Strapi reaches pages after that cache and the ISR window of [ADR-0001](0001-isr-without-cdn.md).

**Amendment (2026-10-06, #239, display fonts):** the files live in `app/assets/fonts/display/` (`<id>-latin-wght.woff2` and `OFL-<Family>.txt`; Nuxt 4's source directory is `app/`) and are copied under the build and served at `/fonts/display/` next to the theme's `/fonts/`, with `?v=<8 hex digits of the file's sha256>` in the URL. They are subset by `scripts/perf/subset-display-fonts.py`, a dev-only script that downloads the sources from a pinned google/fonts commit and verifies their sha256 (`app/assets/fonts/display-sources.json`, `THIRD-PARTY.md`) (the latin range of Bogotá, `wght` only, every other axis pinned at its default, no hinting, upright only). Measured on 2026-10-06: Archivo 36.5 KB, Fraunces 35.6 KB, Bricolage Grotesque 46.1 KB, Newsreader 57.8 KB, Space Grotesk 26.6 KB (the 2026-10-03 numbers above came from Google's latin subsets, which keep `opsz` and the other axes). Fallback faces are generated into `app/assets/fonts/display-fallbacks.css` by `scripts/perf/font-fallbacks.py --display` (serif families against Times New Roman and Liberation Serif, sans against Arial and Liberation Sans). Choosing a font appends to `<style id="theme-overrides">` its `@font-face`, the fallback faces and `:root{--font-display:"<Family>","<Family> Fallback",<the rest of the theme's own display stack>}`, and adds a preload link; the theme's own family is read from its manifest (`type.families.display`), so Bogotá emits nothing for Archivo and the starter nothing for Fraunces. `--font-sans` and `--font-mono` never change. Everything is built from a table keyed by the enum and checked against a whitelist (`server/utils/displayFonts.ts`). CI runs each theme a second time with the heaviest font (section 9).

### 9. Performance budgets

The budgets in `scripts/perf/budgets.json` (#241, `docs/performance.md`) are part of the contract: CI measures every installed theme × site mode (#238), and a theme that exceeds an `error` limit fails the build and is not published. The theme-specific limits are: at most **2 variable font families** of its own, subset, at most **100 KB** of fonts per page, at most **25 KB** of gzipped theme CSS (`theme.css` and slots), and no third-party requests. A display override may add one file of at most 60 KB: CI also measures each theme with the heaviest curated font, and that run's font limit is the theme's plus 60 KB. Bogotá's fonts (143.6 KB today) are over the target; the gap is tracked in `docs/performance.md` like the other targets, and the budget moves towards it PR by PR.

### 10. Motion and native UI

The core provides, as progressive enhancement implemented in #245: cross-document View Transitions (`@view-transition { navigation: auto }` and the card → article transition names), Speculation Rules, scroll-driven animations (`animation-timeline: view()` inside `@supports`) and native popovers and `<dialog>` with `@starting-style`. A theme may tune them through the motion roles and may add its own scroll-driven or transition CSS in `theme.css`, with three conditions: every animation sits under `@media (prefers-reduced-motion: no-preference)`, every API sits under `@supports`, and the page is complete and usable without them. CI runs the theme matrix in a browser with these APIs disabled and with `reducedMotion: 'reduce'` (#238, #245).

### 11. Section catalog

Every theme styles every section of the `page` collection and every variant (bogd3v/micelio-cms#75, #244), so content survives a theme change. A theme may add CSS-only variants of an existing section (the same markup with its own `data-variant` value, declared in `theme.json`), never new sections; variants that need different markup, and new sections, enter the core catalog with a version. Each section and its `data-variant` are public hooks. The specimen page `/_theme` (#238) shows the whole catalog and is part of the visual regression matrix.

**Amendment (2026-10-07, #244):** a theme may ship `sections.css` next to `theme.css`. The core's section CSS is a separate chunk that only pages rendering sections load (`SectionRenderer`), so a theme's section rules in `theme.css` would add bytes to every page, the blog and the articles included. The module emits `sections.css` as the template `#build/micelio/sections.css` (empty when the file is missing), `SectionRenderer` imports it with `layer(bd.theme)` after the core section files, and the chunk repeats the layer order statement, so the cascade is the same as for `theme.css`. It is optional, passes the same hook and `url()` rules as `theme.css` (`css-rules.ts`), counts in the 25 KB gzip budget of section 9 together with `theme.css` and the slots, and a theme without it works (the core styles the sections from the roles). Adding an optional file with a core default stays in contract v1 (section 6). Rejected: `@layer`-scoped rules in `theme.css` (still shipped everywhere) and one file per section (more requests, no gain).

**Amendment (2026-10-07, #276):** the sentence "A theme may add CSS-only variants of an existing section (the same markup with its own `data-variant` value, declared in `theme.json`)" is superseded. The `variant` of a section is a core enum: in Strapi it only offers the variants of the core catalog (bogd3v/micelio-cms#75), so an editor cannot pick a variant a theme declares. Themes restyle the core's variants, through `sections.css` and the public hooks; a new selectable variant enters the core by PR, like a new section (the Strapi enum, the section component, `/_theme` and every installed theme). The reserved `sections` key of `theme.json` (`contract.ts`) does not declare variants.

### 12. Zero JavaScript in themes

A theme ships no JavaScript outside its slots. Slots render on the server without hydration; a slot that needs interactivity declares itself an island in `theme.json` and counts against the page's JS budget.

**Amendment (2026-10-05, #237):** the rule is enforced by static analysis in the contract validator (`modules/theme/island.ts`): the SFC of a slot that does not declare `"island": true` is parsed with `@vue/compiler-sfc`, and the build fails, naming the theme and the file, on an event handler (`@x`, `v-on`), `v-model`, a lifecycle hook (`onMounted`, `onBeforeMount`, `onUpdated`, `onBeforeUpdate`, `onUnmounted`, `onBeforeUnmount`, `onActivated`, `onDeactivated`, `onErrorCaptured`) or `useState`, an `onX` prop or an object or dynamic `v-bind`, an Options API hook (`mounted()`…), `watch*`, timers and `addEventListener`, and on any `<style>` block in a slot. The script is parsed with Babel, so comments and strings do not fool it. It is a contract lint over the slot's own file (not what it imports), not a sandbox: a theme is installed by the operator, its slots run at build time and during SSR, and the CSP is the boundary in the browser, and the slot is still hydrated like any component; skipping hydration for non-island slots (lazy hydration) is a later step that changes no theme. Themes cannot register plugins, middleware, routes or modules.

## Options considered

### A. Tokens + CSS + closed slots, validated at build (chosen)
| Dimension | Assessment |
| --- | --- |
| Expressiveness | Colors, type, space, shape, motion, layout variants per region, illustrations and CSS restyling of the public hooks |
| Guarantees | Contrast, budgets, motion and catalog coverage are checkable per theme in CI |
| Swappability | Content and components never depend on a theme; a theme change needs no content edits |
| Authoring | Plain CSS and JSON with a schema, a starter, a checker and generated docs |
| Cost | Roles must be introduced across the app first (#236), Tailwind removed (#262), and the contract versioned |

### B. Free-form tokens editable in Strapi
**Pros:** a visual theme editor without deploys. **Cons:** any combination of values can reach production without the contrast matrix, visual regression or budgets running on it; the CMS would own design decisions with no review. Only the two bounded overrides above survive from this option, both validated on the server.

### C. Themes as arbitrary CSS (or a Nuxt layer)
**Pros:** maximum freedom; a Nuxt layer could also override components and pages. **Cons:** nothing to validate against, so no guarantees: a theme could ship JS, break accessibility or blow the budget, and could overwrite any core file. Every internal class becomes API by accident, so any refactor of the core breaks someone's theme. It is the WordPress model this project wants to beat.

### D. Fixed light/dark modes in the core
**Pros:** simpler init script and switch. **Cons:** breaks `data-theme="noche" | "dia"` and `bd-theme` values, and prevents single-mode themes or themes with more than two modes.

### E. Contrast validated in Strapi
**Pros:** the editor sees the error on save. **Cons:** Strapi does not know the theme's surfaces, and a theme update can change them after the value was saved. Strapi validates format only; the server, which knows the active theme, guarantees contrast at render time.

### F. Keep Tailwind v4, with the roles in `@theme inline`
**Pros:** least work; utilities like `bg-surface` would read roles, and `@theme { --color-*: initial; }` removes the default palette. **Cons:** utilities in templates still cannot be themed, the scanner still decides what CSS ships, the theme contract would depend on Tailwind's syntax and its majors (v3 → v4 rewrote the configuration), and `@nuxt/ui`, used for 6 icons, stays in the client.

### G. Another styling toolchain (UnoCSS, Panda CSS, vanilla-extract, StyleX)
**Pros:** typed tokens, atomic output. **Cons:** UnoCSS is the same utility model as Tailwind; the others move tokens and themes into TypeScript, which contradicts "a theme is tokens + CSS, zero JS" and adds a build step every theme author would need to learn.

### H. Themes ship their own templates or components for structure
**Pros:** unlimited structural freedom. **Cons:** themes would ship Vue components with logic and markup the core cannot check for accessibility, budgets or catalog coverage, and every core change to data or routes would break them; it is option C again. Layout variants give structural range while the markup stays in the core, tested once for every theme.

## Trade-offs

Restricting overrides to accent and display font means a site that wants a different look needs a theme in the repository, not a CMS edit; that is the point, since every theme goes through CI. Adjusting an accent instead of rejecting it means the color shown can differ slightly from the one saved; the adjustment is logged and #239 can surface it in the admin. Shipping the curated fonts with the core adds files to the image that most sites will not use, but keeps them reviewed and within budget. Selecting the theme at build time means changing `themeId` in Strapi only takes effect among themes included in the build.

Dropping Tailwind costs the speed of laying out with utilities and closes the door to Nuxt UI components, which require it; the core keeps a handful of its own utilities instead. The public hooks list limits what a theme can restyle until a hook is added, and adding one is a core PR; in exchange, the core can refactor every other class freely and themes keep working across releases. Layout variants are markup and CSS the core maintains and every theme must style, so the set stays small and grows by PR; a theme that wants a structure no variant offers waits for one to be added.

## Consequences

- #262 removes Tailwind, `@tailwindcss/typography` and `@nuxt/ui`, with no visual changes and no CSS growth; #236 introduces the roles and the lint rule; #237 creates `themes/bogota/`, the build module that validates contract v1, the JSON Schema, the public hooks of every region, the layout variant mechanism with Bogotá's layout as the first variant of each region, theme-declared modes and `data-scheme`; #238 adds `theme:check`, the contrast matrix, `/_theme`, visual regression and axe per theme × mode, the per-theme budgets and the guide; #263 adds the second variant of every layout region, the starter theme that uses them, the generated reference in `docs/themes/` and the `create-theme` skill; #239 resolves the theme from Strapi and injects the overrides; #245 builds the motion layer.
- bogd3v/micelio-cms#73 implements section 8 in Strapi: `themeId` and `defaultMode` as slugs, `accentOverrides` with `#RRGGBB` colors and unique modes, and `displayFont` as an enumeration of the five ids above, all empty by default.
- `AGENTS.md` (CSS section) documents plain CSS, roles-only in components and the public hooks; `docs/security.md` documents the overrides `<style>` block.
- A breaking change to sections 1, 2, 4, 5, 6 or 12 (`contract: 2`) needs a new ADR that supersedes this one.
