---
name: create-theme
description: Create, adapt or restyle a Micelio theme (themes/<id>/ - roles, modes, layout variants, theme.css hooks, slots, fonts) and prove it valid with npm run theme:check. Use when asked for a new theme, a new look, a new color mode or any change inside themes/.
---

# Create a theme

You do not need to read `app/`. A theme is `themes/<id>/`: `theme.json` (roles per mode, type, layout variants), optional `theme.css`, `fonts.css`, `slots/`, `i18n/`, `images/`, validated against contract v1 (ADR 0005). Guide: `docs/themes/creating-a-theme.md`. Reference generated from the contract: `docs/themes/reference/`.

Use it to make a theme or change how one looks. Not for core components, pages or global CSS (that is `ui-component`), nor for the contract itself (`architect`, ADR 0005).

## Loop

1. `npm run theme:new -- <id> [--name "Name"]` copies `themes/starter/` and renames it. The starter has two modes, `light` (the default, the first) and `dark`; one serif font (Fraunces); a neutral `ThemeMark`; and a non-default layout (`header: centered`, `home: index`, `postList: list`, `article: centered`, `footer: minimal`). Run `theme:check` right away: it passes.
2. Pick layout variants per region in `theme.json` (`docs/themes/reference/layout.md`). Some variants remove page features; the reference says which.
3. Edit `theme.json`: every role of every group, per mode for `color` and `shadow` (`docs/themes/reference/roles.md`; `usage` and `note` in the starter explain each). Change a few roles at a time and re-run `theme:check`, starting from the starter palette, because contrast is the usual failure: every text role (`ink`, `ink-muted`, `accent`, `link`, the states and the categories) needs 4.5:1 on the three surfaces and on its own `-soft`, `code-*` on `surface-sunken`, and controls (`line-strong`, `focus`) 3:1.
   - Modes: 1 to 6, the first is the default. To rename or add one, change `modes`, every per-mode `value` in `color` and `shadow`, and `theme.modes.<id>` in each `i18n/*.json` (the mode switch reads it, `app/composables/useTheme.ts`).
   - Primitives: any name in `color` or `shadow` that is not a role is a primitive of your theme. Names are free (not a role name), referenced as `{name}` from other values and from your own CSS.
   - Fonts: a font is declared in `theme.json` `fonts` (`family`, `file` `*.woff2`, `preload`), `fonts.css` (`@font-face`, `src: url("/fonts/<file>")`), `fonts/` with its license, and `font-fallbacks.css`; `type.families` uses `"<Family>", "<Family> Fallback"`. Budgets and missing-file checks read only `fonts`.
   - Also available: `images` (`favicon`, `ogImage`, `profile`), `mermaid` (overrides of Mermaid `themeVariables`, as roles), and the `theme.*` messages the core reads (`docs/themes/creating-a-theme.md`, section 5).
4. Edit `theme.css` for what roles cannot do: public hooks only (`docs/themes/reference/hooks.md`).
5. Only if CSS cannot express it, add slots (`docs/themes/reference/slots.md`).
6. `npm run theme:check -- <id> --json` until `"ok": true`. Run it before `nuxt dev`: the dev server and the build fail on contract errors.
7. `NUXT_PUBLIC_THEME=<id> npm run dev`, open `/_theme` and review every mode. The core styles every layout variant from your roles; your own rules for variants you do not use are optional, but `/_theme` shows all of them and CI captures them, so look.
8. `npm run lint` (if it fails with `Cannot find module '.nuxt/eslint.config.mjs'`, run `npx nuxt prepare` once).
9. Baselines come from the CI artifact, never from local screenshots (`docs/theme-testing.md`).

## Rules a theme cannot break

- Roles only: primitive colors (`--mirla`...) and `{name}` references live inside the theme, never in the core.
- Layout variants come from the closed list; a typo fails with the known ones.
- Select only public hooks (`bd-*` classes and `data-*` attributes in `hooks.md`); other `bd-*` classes are internal.
- Own attributes `data-<id>-*` (checked). Own classes `<id>-*` (review by hand).
- No `!important`; no remote `@import`; `url()` only to `/fonts/...` or `/theme/images/...` or `#fragment`.
- Slots: only the listed names, no `<style>` (CSS goes in `slots/*.css`), static unless `"island": true` in `theme.json`.
- Every animation under `@media (prefers-reduced-motion: no-preference)` (review by hand).
- User-facing text in `i18n/<locale>.json` under `theme.*`, files `en` and `es` (review by hand: another file name adds a locale).
- `id` equals the folder name; `"contract": 1`; `$schema` is `../theme.schema.json` (review by hand).
- Budgets: theme CSS at most 25 KB gzipped, at most 2 font families, fonts 100 KB target and 150.8 KB maximum.
- Font fallbacks: `scripts/perf/font-fallbacks.py` only handles `bogota` and `starter`, with fixed fonts and paths. For another font add a function for your theme there, or hand-tune `font-fallbacks.css` (one `"<Family> Fallback"` face with `size-adjust`, `ascent-override`, `descent-override`). Never run it with `--theme starter` for your theme: it overwrites the starter's file. Once tuned, the file's "generated" header no longer holds.
- Contrast is checked in every mode (matrix in ADR 0005, section 1); every `color` and `shadow` role needs a value for each mode.

## Reading `theme:check` errors

Each issue has a `kind`: `contract`, `contrast` or `budget`. Contract errors in `theme.json` (roles, shape) skip that theme's CSS, contrast and budget checks; fix them first and the rest show up. A `theme.json` that does not parse, or an `id` that differs from the folder, aborts the whole run with a top-level `"error"` and no `kind`.

- `contract`: shape or role problem in `theme.json` (`misses the role "focus" in "color"`: add that role, see `roles.md`; a mode missing in a per-mode value; an unknown layout variant), and also package, slot and CSS problems, named by file (`theme.css: ".bd-nothing" is not a public hook`: use a hook from `hooks.md`; `!important`: select the hook instead, themes sit in a cascade layer).
- `contrast`: raise or lower the role; the message carries a passing value.
- `budget`: CSS size, font families or font file size (100 KB warning, 150.8 KB error). Warnings do not fail.

Real output (trimmed). `demo-err` was a scratch theme (made with `theme:new`, kept outside `themes/` and loaded through `MICELIO_THEME_DIRS`, a list of extra theme directories separated like `PATH`) with a broken `theme.css`; `low-contrast` is a test fixture loaded the same way:

```
$ npm run theme:check -- demo-err
demo-err: 2 error(s)
  error: theme "demo-err": theme.css: ".bd-nothing" is not a public hook (internal bd-* classes can change in any release)
  error: theme "demo-err": theme.css: !important on "color" is not allowed (themes sit in a cascade layer instead)

$ MICELIO_THEME_DIRS=test/fixtures/themes npm run theme:check -- low-contrast --json
{ "ok": false, "themes": [ { "theme": "low-contrast", "errors": [
  { "kind": "contrast", "mode": "day", "role": "ink-muted", "surface": "surface",
    "ratio": 1.9, "min": 4.5, "suggestion": "#766759",
    "message": "... \"ink-muted\" on \"surface\" has 1.90:1, needs 4.5:1; nearest passing value #766759" } ] } ] }
```

Apply the `suggestion` only for that mode and re-run: fixing one surface can change another.

## Documentation

- Guide: `docs/themes/creating-a-theme.md`; reference: `docs/themes/reference/` (do not edit; `npm run theme:reference`)
- Contract and decisions: `docs/adr/0005-theme-contract.md`
- Visual regression and baselines: `docs/theme-testing.md`
- Template: `themes/starter/`; smallest valid theme: `test/fixtures/themes/minimal`
