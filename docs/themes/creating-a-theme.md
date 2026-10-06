# How to create a theme

A theme is a package of **roles, CSS and optional slots**, validated against contract v1 and installed in the repository. It changes colors, type, space, shape, motion and the look of every public hook without touching the core. The contract is ADR 0005 (`docs/adr/0005-theme-contract.md`); this guide is the path through it. The testing side (visual regression and axe) is `docs/theme-testing.md`.

What a theme can change, in order of preference (ADR 0005, section 5):

1. **Roles** in `theme.json`: colors per mode, shadows, space, radius, sizes, motion and the type scale.
2. **Layout variants**: structure chosen per region from a closed list. The core implements two for every region (see "Layout").
3. **Public hooks**: `bd-*` classes and `data-*` attributes listed in `app/theme/hooks.json`, styled from `theme.css`.
4. **Slots**: Vue components for what CSS cannot express (logo, hero, divider and so on). They are optional; the core has defaults.

The reference of roles, layout variants, hooks and slots is generated from the contract: [reference/](reference/README.md).

Components read roles only. Primitive colors (`--mirla`, `--chillon`) belong to a theme package and to `app/assets/css/settings/`; `npm run lint` fails on them anywhere else.

## 1. Start a theme

The quickest start is `npm run theme:new -- my-theme [--name "My theme"]`: it copies the starter theme (below) to `themes/my-theme/` and renames its id, name and `starter-*` classes. The `create-theme` skill (`.claude/skills/create-theme/`) is the short version of this guide for agents.

The starter theme, `themes/starter/`, is a complete, commented example (two modes, the five second layout variants, one serif web font with its fallback, a neutral `ThemeMark`, messages, and a `theme.css` that styles a few hooks). The `usage` of each token and the `note` of each group explain the choices.

By hand, `cp -r themes/starter themes/my-theme`, then set `id` to the folder name and rename the `starter-*` classes of `slots/` to your id (own attributes are `data-<id>-*`; the starter has none). If you change the font, regenerate or hand-tune `font-fallbacks.css`. The smallest valid theme is the minimal fixture (one mode, system fonts, no files to serve), if you would rather build up than trim down:

```bash
cp -r test/fixtures/themes/minimal themes/my-theme
```

Then edit `themes/my-theme/theme.json`:

- `id` must equal the folder name and match `^[a-z0-9-]+$` (the build fails otherwise).
- `$schema` points to `../../../../themes/theme.schema.json` in the fixture; inside `themes/` change it to `../theme.schema.json`. The schema gives autocomplete and is generated from `modules/theme/contract.ts` (`npm run theme:schema`).
- `"contract": 1` is required; any other value fails.
- `name` is optional.

To start from Bogotá instead (`cp -r themes/bogota themes/my-theme`), which is the opposite of the starter (square, neon, bar and grid layouts, two web fonts: Archivo for display and sans, JetBrains Mono), rename its own classes and attributes: slots and CSS use the `bogota-*` classes and `data-bogota-*` attributes, and a theme may only use `data-<its id>-*` for attributes of its own (see "theme.css").

Select the theme at build time; only installed themes can be selected:

```bash
NUXT_PUBLIC_THEME=my-theme npm run dev
NUXT_PUBLIC_THEME=my-theme npm run build
```

`themes/` is scanned, plus every directory in `MICELIO_THEME_DIRS` (separated like `PATH`). A directory in that list may be a theme itself or hold theme folders. Two themes with the same `id` fail the build.

## 2. The package

```
themes/my-theme/
  theme.json          contract, id, modes, roles, type, layout, fonts, images, slots
  theme.css           hand-written CSS for the public hooks (optional)
  fonts.css           the @font-face rules (optional)
  font-fallbacks.css  size-adjusted fallback faces (optional)
  fonts/              woff2 files and license texts
  images/             images the CSS and slots use
  i18n/               <locale>.json, messages under the theme.* namespace
  slots/              <SlotName>.vue and any number of *.css
```

## 3. `theme.json`

### Modes

```json
"modes": [
  { "id": "day", "scheme": "light", "name": "Day" },
  { "id": "night", "scheme": "dark", "name": "Night" }
]
```

Between 1 and 6 modes (the inline init script must stay under 2 KB). The first is the default. `id` matches `^[\w-]+$`, goes into `data-theme` on `<html>` and into the `bd-theme` storage key; `scheme` (`light` or `dark`) is what core CSS selects on (`data-scheme`).

### Role groups

`color`, `shadow`, `spacing`, `radius`, `size`, `motion` and `type` are all required, each with every role of `REQUIRED_ROLES` (`modules/theme/roles.mjs`). Only `link-soft` (color) and `glow-link` (shadow) are optional, with core defaults. A missing role fails with `misses the role "<name>" in "<group>"`.

Every role, its purpose, its core default (when optional) and its contrast rules are in [reference/roles.md](reference/roles.md), generated from the contract.

Each group has the shape `{ "tokens": [ { "name": "...", "value": ... } ] }`; `note` is also accepted on the group, and `usage` on a token.

**Per-mode values.** In `color` and `shadow` a `value` is either one string or an object with one value per mode id, and no mode may be missing or extra:

```json
{ "name": "surface", "value": { "day": "#f3e9df", "night": "#0a0c10" } }
```

The other groups take a single string.

**Responsive values.** `at` works on `spacing`, `radius`, `size` and `motion` tokens and gives values from a min-width up:

```json
{ "name": "space-inline", "value": "20px", "at": { "768px": "max(clamp(24px, 8vw, 120px), calc((100% - {container}) / 2))" } }
```

**Value rules.** A value may not contain `;`, `{`, `}` (except `{name}` references), `<`, `>`, `@`, `!`, a backslash, a backtick, a comment, or `url(`, `image-set(`, `src(` and similar. Quotes are only for font stacks. `color-mix()` and `oklch()` are fine.

**Extra color tokens (primitives).** Any other name in `color` or `shadow` is a primitive of the theme. Reference it from a value as `{name}`, which becomes `var(--name)`:

```json
{ "name": "chillon", "value": "#c9302c" },
{ "name": "accent", "value": "{chillon}" }
```

Primitives may be used in the theme's own CSS and slots, never in the core.

**Extra contrast checks.** A color token may add rules on top of the built-in table:

```json
{ "name": "ink-faint", "value": "#8a7b6d", "contrast": [{ "on": "surface", "min": 4.5 }] }
```

`contrast` is allowed on color tokens only; `min` goes from 1 to 21 and is checked in every mode.

### Type

```json
"type": {
  "families": { "display": "Archivo, sans-serif", "sans": "system-ui, sans-serif", "mono": "JetBrains Mono, monospace" },
  "groups": [
    { "family": "display", "styles": [
      { "name": "display-xl", "fontSize": "72px", "lineHeight": "76px", "fontWeight": 300, "letterSpacing": "-0.02em" }
    ] }
  ]
}
```

`families` needs `display`, `sans` and `mono`. The scale needs every step, and each generates `--text-<step>` (a `font` shorthand) and `--tracking-<step>`; the steps are in [reference/roles.md](reference/roles.md). A group's `family` must be one of `families`.

### Layout

```json
"layout": { "header": "bar", "home": "showcase", "postList": "grid", "article": "aside", "footer": "columns" }
```

The regions and the variants the core implements for each, with what each one renders and the hooks that exist only in it, are in [reference/layout.md](reference/layout.md). Naming any other variant (a typo) fails validation with the list of known ones. An omitted region uses the first variant (the default).

The core styles every variant from your roles, and your own rules for variants you do not use are optional. But `/_theme` shows every variant and CI captures them, so review them. With `MICELIO_SPECIMEN=1` the page renders the variants your theme does not use next to the active one. The core scopes each variant's CSS by `data-layout`. In `theme.css` select the hook together with the variant (`.bd-header[data-layout="centered"] .bd-nav-link`) when a rule is meant for one of them. Some variants remove features of the page, not only restyle it; the descriptions in [reference/layout.md](reference/layout.md) say which.

### Fonts

```json
"fonts": [
  { "family": "Archivo", "file": "archivo-latin-var.woff2", "preload": true }
]
```

`theme.json` only lists the files and marks the ones to preload (`<link rel="preload">` is generated from `preload: true`). It does not declare the faces. For that:

- **`fonts.css`** holds the `@font-face` rules. `src` must be `url("/fonts/<file>")`: the theme's `fonts/` is served at `/fonts/` (woff, woff2 and txt files only). Use `font-display: swap`.
- **`font-fallbacks.css`** holds a `"<Family> Fallback"` face per family, with `size-adjust`, built from a local system font. Both themes' are generated by `scripts/perf/font-fallbacks.py` (`--theme bogota|starter`).
- The production check `scripts/perf/fouc.mjs` fails a page when a preloaded font has no `@font-face`, or no `"<family> Fallback"` face with `size-adjust`, or when the init script is not inline in `<head>` before the first stylesheet.
- Files must match `.woff2` in `theme.json`; subset to the scripts the site uses. A change in `fonts/` needs a dev server restart.

`theme:check` budgets apply to every theme: more than 2 font families is an error; font files over 100 KB in total warn; over 150.8 KB is an error. Bogotá is 143.6 KB.

### Images

```json
"images": { "favicon": "favicon.svg", "ogImage": "og.png", "profile": "me.png" }
```

All three are optional files of `images/` (png, jpg, webp, avif, gif or svg). The core uses them only when Strapi has nothing: the favicon and the default share image of the site settings win over `favicon` and `ogImage`, and `profile` is the picture of the about profile block when the content has no photo. Images are served at `/theme/images/`; a listed file that does not exist fails validation.

### Slots

```json
"slots": { "ThemeDivider": { "island": true } }
```

The slots are a closed list; each one's purpose, props and core default are in [reference/slots.md](reference/slots.md). Ship one as `slots/<Name>.vue`; without the file the core default in `app/theme/defaults/` renders. A `.vue` file in `slots/` with another name fails validation.

Rules (`modules/theme/island.ts`, `slots.ts`):

- **No `<style>` block in any slot.** Slot CSS goes in `slots/*.css`; every `.css` there is imported in file name order into the `bd.theme` layer and checked like `theme.css`.
- **A slot is static by default**: no `@event`, `on*` attributes or `v-model`, no `v-bind` with an object or a dynamic argument, and none of the lifecycle hooks, `watch*`, `useState`, timers, `requestAnimationFrame` or `addEventListener`. The error says which one it found.
- **Any slot may declare `"island": true`** when it needs JavaScript (Bogotá's `ThemeDivider` does). An island may be interactive but still may not ship `<style>`. Slots are plain components today, so every slot hydrates either way.

## 4. `theme.css`

Plain CSS, imported into the layer `bd.theme`: after the core's components, layout and pages and before animations and utilities (`app/assets/css/main.css`). A theme rule restyles a hook without raising specificity. The same rules apply to `theme.css`, `fonts.css`, `font-fallbacks.css` and `slots/*.css`, following local `@import`s (`modules/theme/css-rules.ts`):

- Select only public hooks, listed with their states and layout variants in [reference/hooks.md](reference/hooks.md): a `bd-*` class or a `data-*` attribute that is not in `app/theme/hooks.json` fails, and so does an attribute selector on `class` that matches `bd-`. Every other `bd-*` class is internal and may change in any release.
- A theme's own attributes start with `data-<id>-`; its own classes should carry the id as prefix (`my-theme-mark`).
- No `!important`.
- No remote `@import`, and no `@import` that leaves the theme folder or points to a missing file.
- `url()` (and strings in `image-set()`, `src()` and similar) may only point at `/fonts/...` or `/theme/images/...`, or at a `#fragment`; no `..`, encoded dots or backslashes.
- The generated role CSS goes through the same checks.

Hooks are validated by the build and by `theme:check`. `npm run lint` does not check them.

## 5. Messages

`i18n/<locale>.json` files (the file name is the locale code, and must be one of the site's locales, `en` or `es`: another name adds a new locale to the site, with no core messages) are merged into the site's messages under the `theme.*` namespace. User-facing text of a theme lives here, never in the core's locale files. The core reads these keys when present (ADR 0005, section 4): `theme.hud.{city,coords,altitude,madeIn}`, `theme.guide.*`, `theme.latest.emptyNote`, `theme.palette.names` and `theme.profile.alt`. Without them the place line renders nothing and the others fall back to a neutral text or nothing. Your slots may add their own keys under `theme.*`.

## 6. Accessibility handled by the core

A theme gets these without doing anything, and cannot override most of them:

- **Contrast**: `theme:check` evaluates the matrix of ADR 0005, section 1, in every mode (text roles at 4.5:1 on the three surfaces and on their own `-soft`, `line-strong` and `focus` at 3:1, and so on) plus your own `contrast` rules.
- **Forced colors**: core components have `@media (forced-colors: active)` rules.
- **`prefers-contrast: more`**: the generated role CSS remaps `ink-muted` to `ink` and `line` to `line-strong` for every mode. A theme cannot override it in v1.
- **Print**: `app/assets/css/utilities/print.css` remaps the roles to system colors so the article prints dark on white in any theme and mode.
- **Reduced motion**: this one is yours. Put every animation of the theme under `@media (prefers-reduced-motion: no-preference)` (ADR 0005, section 10).

## 7. Check it

```bash
npm run theme:check -- my-theme          # one theme
npm run theme:check                      # every installed theme
npm run theme:check -- my-theme --json   # same result as data
npm run theme:check -- --list            # installed ids as JSON (CI uses it for the matrix)
MICELIO_THEME_DIRS=test/fixtures/themes npm run theme:check -- low-contrast
```

The flags need the `--`: without it npm swallows them. The exit code is 1 when a theme has errors; warnings do not fail. The check runs what the build validates (contract, package files, CSS rules) plus the contrast matrix and the static budgets: theme CSS (`theme.css` and `slots/*.css`, minified) at most 25 KB gzipped, at most 2 font families, fonts as above. The build does not check contrast, so a theme in progress does not stop `nuxt dev`.

Real output from this repository:

```
$ npm run theme:check -- bogota
bogota: ok, 1 warning(s)
  warning: theme "bogota": fonts total 143.6 KB, over the 100.0 KB target (allowed up to 150.8 KB)

$ npm run theme:check -- --list
["bogota","starter"]

$ npm run theme:check -- bogota --json
{
  "ok": true,
  "themes": [
    {
      "theme": "bogota",
      "errors": [],
      "warnings": [
        {
          "kind": "budget",
          "message": "fonts total 143.6 KB, over the 100.0 KB target (allowed up to 150.8 KB)"
        }
      ]
    }
  ]
}

$ MICELIO_THEME_DIRS=test/fixtures/themes npm run theme:check -- low-contrast
low-contrast: 4 error(s)
  error: theme "low-contrast", mode "day": "ink-muted" on "surface" has 1.90:1, needs 4.5:1; nearest passing value #766759
  error: theme "low-contrast", mode "day": "ink-muted" on "surface-raised" has 2.12:1, needs 4.5:1; nearest passing value #7e6f61
  error: theme "low-contrast", mode "day": "ink-muted" on "surface-sunken" has 1.63:1, needs 4.5:1; nearest passing value #6b5d4f
  error: theme "low-contrast", mode "day": "line-strong" on "surface-sunken" has 3.28:1, needs 4:1; nearest passing value #806150
```

Each contrast error names the mode, role, surface, measured ratio, required ratio and the nearest value of the role that passes.

## 8. Design against the specimen

```bash
NUXT_PUBLIC_THEME=my-theme npm run dev
```

Open `http://localhost:3000/_theme`: the catalog of components, states and sections in every mode. The page exists in dev and in a build made with `MICELIO_SPECIMEN=1`; a plain production build does not have it. `npm run lint` checks template classes, primitive colors and that `themes/theme.schema.json` and `docs/themes/reference/` have not drifted from the contract (`npm run theme:schema` and `npm run theme:reference` regenerate them); it does not check your theme. On a fresh clone, if `npm run lint` fails with `Cannot find module '.nuxt/eslint.config.mjs'`, run `npx nuxt prepare` once.

## 9. What CI runs

The workflow `.github/workflows/deploy.yml` runs on pushes to `main`, on pull requests to `main` and by hand:

| Check | What it does for a theme |
| --- | --- |
| **Lint & Type Check** | Runs `npm run theme:check` for every installed theme. A contrast or budget error fails this job; a warning does not. |
| **Any build** (`npm run build`, the e2e and performance jobs) | Validates the contract, package files and CSS rules for every installed theme; a failure names the theme and the problem. |
| **Performance Budgets** | One run per installed theme and site mode, built with that theme. The limits of `scripts/perf/budgets.json` are page budgets (JS, CSS, HTML and font weight, LCP, CLS, accessibility and so on) and apply to every theme. A theme that cannot meet one gets a recorded exception in the same file, `themes.<id> = { "reason": "...", "limits": { ... } }`, added in the PR that adds the theme; never a looser global limit. Bogotá has none. Also asserts the FOUC rules above. See `docs/performance.md`. |
| **Theme Quality** | Visual regression and axe (WCAG 2.0 and 2.1 A and AA) per theme, mode and viewport (1280 and 390 px) of home, blog, an article, about and `/_theme`. See `docs/theme-testing.md`. |

`Performance Budgets` and `Theme Quality` both gate `deploy`.

The 25 KB gzip CSS limit and the two font families are `theme:check` static budgets, not performance metrics. The 150.8 KB font ceiling appears in both places: as the `fontKb` page limit and as the `theme:check` error threshold.

**Baselines.** A theme has no screenshots on its first run, and **a missing baseline fails the run**. Do not commit PNGs rendered locally: text rendering differs from the CI image. Push the branch, download the `theme-snapshots-<theme>` artifact of the failed run (or start the **Theme Snapshots** workflow by hand with the branch as `ref`), review the images, unzip them into `e2e/theme/__screenshots__/<theme>/` and commit. CI never commits baselines.

## 10. Checklist

- [ ] `id` equals the folder name, `"contract": 1`, `$schema` is `../theme.schema.json`
- [ ] Classes and attributes of the theme carry its id; nothing left from `bogota-*` if you copied Bogotá
- [ ] `NUXT_PUBLIC_THEME=<id> npm run dev` starts, and `/_theme` looks right in every mode
- [ ] `npm run theme:check -- <id>` shows `ok` (a font warning is acceptable when the PR explains it)
- [ ] `npm run lint` passes
- [ ] Preloaded fonts have an `@font-face` in `fonts.css` and a size-adjusted `"<Family> Fallback"`
- [ ] Slots have no `<style>`; those that need JavaScript are declared `island`
- [ ] Animations are under `prefers-reduced-motion: no-preference`
- [ ] A budget exception, if any, is in `scripts/perf/budgets.json` with its reason
- [ ] Baselines come from the CI artifact (`docs/theme-testing.md`)
