# Theme contract changelog

What each version of the theme contract added or broke. This is a reference for theme creators; the rules are in [ADR 0005](../adr/0005-theme-contract.md) (section 6) and [ADR 0008](../adr/0008-theme-registry.md) (decision 2), and the generated reference of the current version is in [reference/](reference/README.md).

## How versions work

- `contract` in `theme.json` is `N` (meaning `N.0`) or `"N.M"`: `N` is the **major**, `M` the **minor**. Both `2` and `"2.0"` mean the same.
- A **minor** only adds something optional with a core default (a role, a slot, a layout variant, a hook), or a performance budget that every published theme meets (ADR 0005, section 9). A theme declares the lowest minor that covers what it uses; a budget binds every theme and is never something a theme uses, so it raises no theme's declared minor.
- A **major** breaks themes (a removed or renamed role, slot, variant or hook, a changed slot API) and comes with a migration note in [Upgrade notes](creating-a-theme.md#upgrade-notes).
- The build fails when a theme declares another major, when it needs a minor the core does not implement (`needs contract 2.5; this core implements 2.4`), and when it declares less than it uses (`declares contract 2.0 but uses 2.1`). `npm run theme:check -- --json` reports `contract.declared`, `contract.used` and `contract.core` for each theme.
- **Adding to the contract bumps the minor.** In the same change: raise `CONTRACT_VERSION.minor` and add the new rows to `CONTRACT_ADDITIONS` in `modules/theme/constants.ts` (kind and name of each addition, so the validator knows what needs the minor), add a section to this file, and run `npm run theme:schema` and `npm run theme:reference`.

## Making a contract change

What counts as a break, and what to write, so that a change does not strand a published theme (#314;
the contract promise is section 6 of the engineering standard).

- **Breaking** (a new major, `contract: 3`): removing or renaming a role, slot,
  layout variant or hook; changing a slot API (a prop, a return value,
  a default that a theme can depend on);
  changing a hook's markup so that selectors of a published theme stop matching;
  tightening what `theme.json` accepts.
- **Not breaking** (a new minor): adding something optional with a core default.
  Add it as the changelog above says.
- **A major needs**, in the same pull request:
  the migration note in [Upgrade notes](creating-a-theme.md#upgrade-notes), a section in this file,
  `CONTRACT_VERSION.major` raised, and (before 1.0,
  `!` in the title and a `BREAKING CHANGE:` paragraph) the upgrade notes of the release.
  After 1.0 it also needs an ADR and a deprecation window:
  the old name or signature keeps working for at least one more minor,
  with a build warning that names the replacement (standard, section 7).
- **Label the pull request `contract`** when it touches roles, hooks, slots or layout variants:
  `theme-compat-runs.yml` then runs admission of the latest published version of every theme against
  the branch, and the release repeats it ([publishing-a-theme.md](publishing-a-theme.md),
  section 12).
- **A change that breaks a published theme** and is not a new major is a bug of the core:
  the compatibility check blocks the release when the theme is `official`;
  for the other tiers the theme's version is marked `incompatible` from that core.

## Manifest changes inside 2.0

These did not move the version, because they add no role, slot, variant or hook (#309):

- Added: the optional `version` (semver without build metadata) and `license` (an SPDX id or `LicenseRef-<name>`) of `theme.json`; both are required to pack a theme.
- Tightened: `id` is 1 to 64 characters of lowercase letters and digits in groups separated by single hyphens (ADR 0009, section 2). `--x`, `x-`, `-x` and ids over 64 characters no longer validate; `bogota`, `starter` and every id with single hyphens do.

## 2.2

Adds a performance budget: the carbon estimate of a page view, `co2Mg` (#847; [performance.md](../performance.md#carbon-budget)).
`npm run perf -- --check`, and so theme admission and the compatibility run, fail a page whose estimate is over its limit.

- Added budget: `co2Mg`, an `error` limit on every page of the `dynamic` and `static` modes of `scripts/perf/budgets.json`,
  the highest value CI measured on `main` for `bogota` plus 5 %. `landing` has none: CI does not measure it.
- The limit grows, like `fontKb` and `jsKb`, with the run of the heaviest display font (6.87 mg for its 60 KB) and with
  a theme's own layout variants on another theme's image (the estimate of their `jsKb` allowance).
- A theme does not declare `2.2` for it: a theme that declares `2.0` or `2.1` keeps validating, installing and rendering.
  What changes is that the core refuses a theme whose pages weigh more than the limit; every published theme is under it
  (`bogota@1.0.1`: 38.07 mg on the dynamic home, limit 40).
- A theme that cannot meet a limit gets a recorded exception in `budgets.json`, as for any other limit.
- **Why a minor.** A new limit adds a refusal, which the engineering standard (section 7) counts as breaking by its effect.
  The maintainer decided on 2026-11-09 (#847) that this one ships as a minor of the contract, with no `!`:
  no published theme is refused (`bogota@1.0.1` passes every limit in dynamic, with the heaviest display font, and in static),
  and a theme that declares an earlier minor keeps validating. A later limit that refused a published theme would be a major.

## 2.1

Adds the presentation options of the blocks (ADR-0018, section 1; #731) as public hooks.
A block that exposes an option writes it as a `data-*` attribute on its root,
and the core gives most values that change a block's look one in the `myc.components` layer
(the default value has none: it is the block's own look).
`layout: stacked` and `height` on a hero or a scene write the attribute and keep the block's own look for now
(a follow-up of #731); `width: wide` on a section and `ratio: auto` on a slider change nothing either.
Nothing is removed or renamed, so a theme that declares `2.0` keeps validating and rendering.

- Added hooks: `data-width`, `data-columns`, `data-density`, `data-align`, `data-tone`,
  `data-ratio` and `data-height`.
  A theme that selects one declares `"contract": "2.1"`.
- Extended: `data-layout` also carries the `layout` option of a block, with the values
  `centered` (shared with the header and the home), `split` and `stacked`.
  The name existed in 2.0, so the validator cannot ask for 2.1 when a theme selects it:
  select it together with `data-section` (`[data-section="hero"][data-layout="split"]`),
  and never alone, because `[data-layout="centered"]` also matches the header.
- Added to the slot APIs: `BLOCK_OPTIONS`, `BLOCK_EXPOSES` and their types, and the optional
  option fields of the section and block interfaces (`reference/slot-apis.md`).
- Contrast (opt-in): the matrix also holds `ink`, `ink-muted` and `link` on `accent-soft`,
  the surface of `tone: accent`, but only for a theme that declares `2.1`.
  A theme that declares `2.0` is not checked on it, so it keeps validating and installing;
  `starter` and `bogota` would pass anyway (the lowest, `link` on `accent-soft`, is 5.26:1 on
  `bogota` `dia`).
- Which block exposes which option, and the values it offers, are in
  [reference/hooks.md](reference/hooks.md#block-options).
- An absent attribute is the block's own look; the core writes an attribute only for a value
  the content sets and the block offers.
  The default value of each option has no rule, so a stored default looks like an absent attribute.
  A theme that does not style a value renders the core's look, not the first value of the list.
- The rules sit in the `myc.components` layer and a theme's sit in `myc.theme`, so a theme
  overrides a value with the same specificity.
  A theme that already sets the property an option sets (a `background` on the hero for `tone`,
  `grid-template-columns` on the items for `columns`) keeps winning over the option.

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
