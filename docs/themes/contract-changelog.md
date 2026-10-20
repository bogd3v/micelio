# Theme contract changelog

What each version of the theme contract added or broke. This is a reference for theme creators; the rules are in [ADR 0005](../adr/0005-theme-contract.md) (section 6) and [ADR 0008](../adr/0008-theme-registry.md) (decision 2), and the generated reference of the current version is in [reference/](reference/README.md).

## How versions work

- `contract` in `theme.json` is `N` (meaning `N.0`) or `"N.M"`: `N` is the **major**, `M` the **minor**. Both `2` and `"2.0"` mean the same.
- A **minor** only adds something optional with a core default (a role, a slot, a layout variant, a hook). A theme declares the lowest minor that covers what it uses.
- A **major** breaks themes (a removed or renamed role, slot, variant or hook, a changed slot API) and comes with a migration note in [Upgrade notes](creating-a-theme.md#upgrade-notes).
- The build fails when a theme declares another major, when it needs a minor the core does not implement (`needs contract 2.5; this core implements 2.4`), and when it declares less than it uses (`declares contract 2.0 but uses 2.1`). `npm run theme:check -- --json` reports `contract.declared`, `contract.used` and `contract.core` for each theme.
- **Adding to the contract bumps the minor.** In the same change: raise `CONTRACT_VERSION.minor` and add the new rows to `CONTRACT_ADDITIONS` in `modules/theme/constants.ts` (kind and name of each addition, so the validator knows what needs the minor), add a section to this file, and run `npm run theme:schema` and `npm run theme:reference`.

## Manifest changes inside 2.0

These did not move the version, because they add no role, slot, variant or hook (#309):

- Added: the optional `version` (semver without build metadata) and `license` (an SPDX id or `LicenseRef-<name>`) of `theme.json`; both are required to pack a theme.
- Tightened: `id` is 1 to 64 characters of lowercase letters and digits in groups separated by single hyphens (ADR 0009, section 2). `--x`, `x-`, `-x` and ids over 64 characters no longer validate; `bogota`, `starter` and every id with single hyphens do.

## 2.0

Breaking, from [ADR 0016](../adr/0016-categories-from-the-cms.md): the core knows no category, so the slot APIs are data. A theme migrates with the [upgrade notes](creating-a-theme.md#contract-1-to-2-the-core-knows-no-category-adr-0016).

- Removed: the `Category` enum, `CATEGORIES`, `CATEGORY_INFO` and `CategoryInfo`.
- Changed signature: `isCategory` (use `useCategories().has(slug)`), `categoryColor(categories, slug)`, and `ThemeIllustration`, which takes `category: string` and a required `color`.
- Added: `useCategories()` among the slot APIs.
- `CONTRACT_VERSION` is `{ major: 2, minor: 0 }`; `"contract": 2` and `"contract": "2.0"` are the same.

## 1.0

The first public contract, backfilled from the amendments of [ADR 0005](../adr/0005-theme-contract.md). Contract 1 closed with 2.0; a theme that declares 1 does not build.

- **Roles.** The required roles of `reference/roles.md`, per mode, plus the optional `link-soft` (tinted background for links; the default mixes `link` into `surface`) and `glow-link` (glow on focused and hovered interactive surfaces; the default is `none`). The typography roles `text-*` and `tracking-*` (#237) and the code roles `code-ink`, `code-muted`, `code-keyword`, `code-string`, `code-number` and `code-function` (#238).
- **Modes.** One to six modes declared by the theme, with `scheme` `dark` or `light`; core CSS selects on `data-scheme`.
- **Slots.** `ThemeMark`, `ThemeHero`, `ThemeDivider`, `ThemeEmptyState`, then `ThemeIllustration` (#237), `ThemeProgressMarker` and `ThemeSupportArt`, each with a core default.
- **Layout variants.** Two per region, the second ones from #263: `header: centered`, `footer: minimal`, `home: index`, `postList: list` and `article: centered`.
- **Package.** `images` (favicon, share image and profile picture defaults), `sections.css` (#244) and the `fonts` declaration.
- **Hooks.** The closed list of public classes and `data-*` attributes of `app/theme/hooks.json`, including the view-transition hooks (#245). The validator rejects any other `myc-*` class or core `data-*` attribute.
- **Prefix.** The classes and hooks were `bd-*` and became `myc-*` ([ADR 0005](../adr/0005-theme-contract.md), amendment of 2026-10-08). That rename shipped before any theme was published, so no published theme ever saw `bd-*`; this changelog uses `myc-*` throughout. The break that closed contract 1 is 2.0.

## Limits of the check

The validator finds what a theme uses from `theme.json` (slots, `layout`, role names) and from the `slots/` folder. Two limits: a hook is detected from the selectors of the theme's CSS only, not from the markup of its slot templates, and a role of the type scale cannot be a minor addition yet (only the color, shadow, spacing, radius, size and motion groups are read).
