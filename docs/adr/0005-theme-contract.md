# ADR-0005: Theme contract v1

**Status:** Accepted
**Date:** 2026-10-03
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
| Categories | `category-1` … `category-6`, each with `-soft` |
| Code | `code-ink`, `code-muted`, `code-keyword`, `code-string`, `code-number`, `code-function` (on `surface-sunken`) |
| Typography | `font-display`, `font-sans`, `font-mono`; the scale `display-xl`, `display-l`, `heading-1`…`heading-3`, `body-l`, `body`, `body-s`, `eyebrow`, `meta`, `code` (size, line height, weight, tracking) |
| Space and layout | the scale `space-1`, `space-2`, `space-3`, `space-4`, `space-6`, `space-8`, `space-12`, `space-16`, `space-24`; `space-section` (between page sections), `space-gutter` (grid gap), `space-inline` (side margin, per breakpoint); `container` (max content width), `measure` (max prose width), `nav-height` |
| Shape | `radius-control`, `radius-card`, `radius-full`; `shadow-raised`, `shadow-overlay`, `glow-accent` (may be `none`); optional: `glow-link` (glow on focused and hovered interactive surfaces; core default: `none`) |
| Motion | `duration-fast`, `duration-base`, `duration-slow`, `ease-standard`, `ease-emphasized` |

The two optional roles were added with #236, when Bogotá's components moved onto roles: chillón is both its link color and the background or glow of active items, and contract v1 had no role for those. Adding an optional role with a core default stays in v1 (section 6). Illustrations in the core draw from the category roles as the theme's palette.

`link` and `focus` are separate roles because a theme may draw them from a color other than the accent. Bogotá does: `accent` is mirla, `link` and `focus` are chillón. Mermaid's `themeVariables` are derived by the core from roles (today's `mermaidThemeVariables` mapping, rewritten on roles); a theme may override individual variables under `mermaid` in `theme.json`, with values that are roles, not colors.

Contrast rules, checked per mode by #238 (WCAG 2 AA): `ink`, `ink-muted`, `link`, `accent`, states and categories as text ≥ 4.5:1 on the three surfaces and on their own `-soft`; `on-ink` on `ink` and `on-accent` on `accent` ≥ 4.5:1; `line-strong`, `focus` and `accent` as non-text ≥ 3:1. The `usage` notes in `tokens.json` become these assertions.

### 2. Modes

A theme declares one or more modes in `theme.json`: `modes: [{ "id": "noche", "scheme": "dark", "name": "Noche" }, …]`. Ids match `^[a-z][a-z0-9-]*$` and are unique within the theme; the first mode is the theme's default. Bogotá declares `noche` (dark) and `dia` (light), so nothing public changes:

- `data-theme` on `<html>` carries the **mode id**, as today. The init script also sets `data-scheme="light" | "dark"`, and `color-scheme` follows it. Theme CSS selects on `data-theme`; core CSS that depends on lightness (today `:not([data-theme="dia"])`) selects on `data-scheme`, so it works with any theme.
- `bd-theme` keeps storing the visitor's choice, now any mode id. A stored value that is not a mode of the active theme is ignored, not deleted, so switching back to a theme restores it.
- Resolution, in the init script and on the server: the stored choice if valid → Strapi's `defaultMode` if it is a mode of the active theme → the first mode whose `scheme` matches `prefers-color-scheme`, when the theme has modes for both schemes → the theme's first mode. With no `defaultMode`, BogDev behaves exactly as today.
- The mode switch shows only when the theme has more than one mode; a single-mode theme renders without it.

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

### 4. Theme package

A theme lives in `themes/<id>/` in the repository (publishing themes or Micelio on npm is decided later, with its own ADR):

```
themes/bogota/
  theme.json        $schema, contract, id, name, modes, roles per mode, type, layout, fonts, slots, mermaid
  theme.css         role values generated from theme.json + the theme's styling of public hooks
  fonts/            woff2 files and their licenses
  slots/            ThemeMark.vue, ThemeHero.vue, ThemeDivider.vue, ThemeEmptyState.vue (all optional)
  templates/        og.vue (OG image), email.ts (newsletter email shell) (optional)
```

- **`theme.json`** uses the `docs/design/tokens.json` format (which becomes Bogotá's `theme.json`), plus `$schema`, `contract`, `id` (the folder name), `modes` and `fonts`. Role values are colors or references to the theme's primitives (`{chillon}`), resolved by `build-tokens.mjs`.
- **`theme.css`** is imported into the layer `bd.theme`, after the core's components, layout and pages and before animations and utilities. It sets role values and styles public hooks and its own slots (section 5); it may not `@import` remote URLs, use `url()` outside its own `fonts/`, or use `!important`.
- **Fonts** are self-hosted woff2, subset to the scripts the site uses, `font-display: swap`, with fallback faces whose metrics are adjusted (`size-adjust`, ascent and descent overrides) as in `settings/font-fallbacks.css`. `theme.json` lists them and marks which are preloaded; the core builds the preload links from that list instead of `nuxt.config.ts`.
- **Slots** are a closed list: `ThemeMark` (logo and mark, today `BdLogo` + `BdBird`), `ThemeHero` (home illustration, today `BdPanorama`), `ThemeDivider`, `ThemeEmptyState`. The core renders them by name and ships neutral default implementations, so a theme that ships none still works. Adding a slot is a contract change.
- **Templates** for the OG image and the newsletter email shell are optional; the core has neutral defaults. They read roles and the site identity, never hardcoded site values.
- The active theme is chosen at build time with `NUXT_PUBLIC_THEME` (default `bogota`); only installed themes can be selected, and only the active theme's CSS and fonts reach the page.

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

**Public hooks.** A closed, versioned list of `bd-*` classes and `data-*` attributes that themes may select. It covers every structural region from v1, not only what Bogotá restyles today: site header, navigation, mode switch, footer, hero, card, post list, pagination, article header and metadata, table of contents, sidebar, prose, callout, code block, figure, button, form field, tag and chip, comments, newsletter form, each `page` section with its `data-variant`, and each layout region with `data-layout="<variant>"`. Element selectors are allowed inside a hook (`.bd-prose h2`). The list lives in the core (`app/theme/hooks.json`), and each entry says what the element is, which states it has (`:hover`, `[aria-current]`, `[data-variant]`) and in which layout variants it appears.

A theme's own classes, inside its slots, use its id as prefix (`bogota-`). The validator parses every selector in `theme.css` and rejects a `bd-*` class or core `data-*` attribute that is not a public hook. Every other `bd-*` class is internal: the core can rename it in any release without breaking a theme. Adding a hook or a layout variant stays in contract v1; removing or renaming one, or changing a hook's markup in a way that breaks existing selectors, is a contract change.

### 6. Versioning and validation

`theme.json` declares `"contract": 1`. A build module validates every installed theme before Nuxt builds, and the build fails, naming the theme and the problem, when a theme declares an unknown contract version, misses a role in any mode, declares an invalid or duplicate mode, references a missing font or primitive, ships a slot outside the list, names an unknown layout region or variant, selects something that is not a public hook, or breaks a rule of `theme.css` above. A breaking change to roles, modes, layout variants, hooks, slots or package layout is `contract: 2` with a migration note; adding an optional role, layout variant, hook or slot with a core default stays in v1.

### 7. Theme authoring

Writing a theme must not require reading the core. The contract ships with:

- **A JSON Schema** of `theme.json` (`themes/theme.schema.json`), generated from the same definitions the validator uses and referenced from each theme's `$schema`, so editors autocomplete and validate it and agents can read the contract directly.
- **A starter theme** (`themes/starter/`): every role in two modes (one light, one dark), commented, passing every check. It is deliberately the opposite of Bogotá (light first, serif display, rounded shapes, generous spacing, the second variant of every layout region), so it proves the contract allows a different site and not only a different palette, and gives authors the second example of every variant. It is the template to copy, and stays in CI so it never rots. A single-mode test theme lives in the fixtures (#237).
- **`npm run theme:check [id]`**: the same validation as the build plus the contrast matrix and the hooks check (#238), runnable on its own. Errors name the theme, mode, role, surface, measured ratio and the nearest value that passes; `--json` prints the same as data for agents and editors.
- **`/_theme`** (#238) with hot reload: the whole catalog, every component state and every section variant in every mode, to design against.
- **Reference docs generated from the contract** in `docs/themes/`: roles, hooks and slots from the schema and `hooks.json`, so they cannot drift, plus the "How to create a theme" guide (#238).
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

### 9. Performance budgets

The budgets in `scripts/perf/budgets.json` (#241, `docs/performance.md`) are part of the contract: CI measures every installed theme × site mode (#238), and a theme that exceeds an `error` limit fails the build and is not published. The theme-specific limits are: at most **2 variable font families** of its own, subset, at most **100 KB** of fonts per page, at most **25 KB** of gzipped theme CSS (`theme.css` and slots), and no third-party requests. A display override may add one file of at most 60 KB: CI also measures each theme with the heaviest curated font, and that run's font limit is the theme's plus 60 KB. Bogotá's fonts (143.6 KB today) are over the target; the gap is tracked in `docs/performance.md` like the other targets, and the budget moves towards it PR by PR.

### 10. Motion and native UI

The core provides, as progressive enhancement implemented in #245: cross-document View Transitions (`@view-transition { navigation: auto }` and the card → article transition names), Speculation Rules, scroll-driven animations (`animation-timeline: view()` inside `@supports`) and native popovers and `<dialog>` with `@starting-style`. A theme may tune them through the motion roles and may add its own scroll-driven or transition CSS in `theme.css`, with three conditions: every animation sits under `@media (prefers-reduced-motion: no-preference)`, every API sits under `@supports`, and the page is complete and usable without them. CI runs the theme matrix in a browser with these APIs disabled and with `reducedMotion: 'reduce'` (#238, #245).

### 11. Section catalog

Every theme styles every section of the `page` collection and every variant (bogd3v/micelio-cms#75, #244), so content survives a theme change. A theme may add CSS-only variants of an existing section (the same markup with its own `data-variant` value, declared in `theme.json`), never new sections; variants that need different markup, and new sections, enter the core catalog with a version. Each section and its `data-variant` are public hooks. The specimen page `/_theme` (#238) shows the whole catalog and is part of the visual regression matrix.

### 12. Zero JavaScript in themes

A theme ships no JavaScript outside its slots. Slots render on the server without hydration; a slot that needs interactivity declares itself an island in `theme.json` and counts against the page's JS budget. Themes cannot register plugins, middleware, routes or modules.

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
