# ADR-0016: Categories come from the CMS

**Status:** Accepted
**Date:** 2026-10-18
**Deciders:** Micelio maintainer

## Context

The core hard-codes the five categories of one site (`privacidad`, `diy`, `ia`, `software`, `linux`): the `Category` enum in `app/interfaces/design.ts`, `CATEGORIES` and `CATEGORY_INFO` in `app/constants/categories.ts`, the `myc.categories.*` labels in both locales, the validation of `/api/reading-path`, the feeds, the sitemap, the static build and about 30 components. This breaks principle 2 of the [engineering standard](../engineering-standard.md) ("the core carries no site"). Against the demo CMS, `/blog` links the five BogDev categories instead of the seeded ones, `/blog/category/garden` answers 404 and `GET /api/reading-path?category=garden` answers 400 (#462, items 3 and 13).

Four more assumptions hide in that coupling:

- **Color by identity.** Each category has one of five roles, `--category-1` to `--category-5`, by its place in the constant. With a list that comes from data, a position moves when an editor reorders.
- **A fixed count.** The contrast matrix, the specimen and the field guide assume five.
- **A site that has categories.** A landing or a portfolio has none, and still renders the sidebar, filters, menu and feeds of categories.
- **BogDev's extras in the core.** Bird illustrations and `guide.note.<slug>` texts are keyed by BogDev's slugs.

The CMS category type already has `name`, `slug`, `description`, a non-localized `order`, and `pillar`, `key` and `bird` fields that only BogDev uses. [ADR-0005](0005-theme-contract.md) makes the helpers of `~/helpers/categories` slot APIs, and amendment #324 says the core "has five categories", so removing them is a contract change (`contract: 2`, ADR-0005 section 6).

Micelio is pre-1.0 and not stable ([ADR-0010](0010-semantic-versioning.md)): a breaking change needs the `!`, a `BREAKING CHANGE:` paragraph and upgrade notes, and no deprecation period.

## Decision

### 1. A category is data

The core knows no category. It receives a list of

```ts
{ slug, name, description?, order?, featured?, color? }
```

from the CMS and treats it as opaque. `name` and `description` are localized. Themes get the list through `useCategories()` and through props of their slots, never through a constant they import. Nothing in the core, the themes shipped here or the tests names a slug of one site.

### 2. One source, cached

`loadCategories(locale)` in `server/utils/categories.ts` reads the categories and their published article counts from Strapi, inside `defineCachedFunction` (600 s, the same as `/api/categories` today, errors not stored). Every consumer reads it: `/api/categories`, the feeds, the sitemap, `/api/reading-path`, the blog redirects and, on the client, `useCategories()`, which wraps the existing request so a page makes one. The static build fetches the list next to the articles.

The list is sorted by `order` ascending, empty values last, then by `name`.

### 3. A stable color

`color` is an optional integer from 1 to 5 chosen by the editor; it names one of the five existing roles. Without it, the category takes `((position) % 5) + 1`, `position` being its index in the sorted list. `categoryColor` returns `var(--category-N)`. An unknown slug gets `var(--ink-muted)`.

- The five roles stay required, so the contrast matrix does not change.
- With more than five categories colors repeat; with fewer, some roles are unused.
- An editor who cares about a color sets it, and a reorder then moves nothing.

### 4. Names and labels

The localized `name` of the CMS is the label, falling back to the slug. `myc.categories.*` is deleted from both locales. Feed titles and the field guide take the name and description from the list, not from `home.guide.topics.<slug>`.

### 5. `featured`, not `pillar`

`featured` marks a category that the home page highlights. It replaces `pillar`, a name that means something only to BogDev. The number 1 or 2 that `CATEGORY_INFO` stores is derived from the display order of the featured categories. `CATEGORY_INFO` and `CategoryInfo` are removed.

### 6. No categories, no category UI

When the list is empty the sidebar, filters, menu entries, search topics, field guide and category feeds are not rendered, and `/blog/category/*` answers 404. A site decides whether it has categories by creating them, with no setting.

### 7. Validation moves to the list

zod checks the shape of the slug only. Whether the category exists is checked against `loadCategories`: a blog route with an unknown category answers 404, and `/api/reading-path` keeps its 400 `unknownCategory` with the problem detail of [ADR-0015](0015-problem-details.md). `isBlogRouteValid`, `parseBlogUrl`, `feedCategory`, the query schema and `/api/categories` stop filtering by a constant.

### 8. Extras belong to the theme

Illustrations and guide notes keyed by slug are theme messages. The core ships a generic fallback for a slug the theme does not know. The theme `bogota` keeps BogDev's birds for as long as it lives in this repository; a theme package outside the core (ADR-0008) carries its own.

### 9. Contract 2

These are the breaking changes to the slot APIs: the `Category` enum, `CATEGORIES`, `CATEGORY_INFO` and `CategoryInfo` are removed; `isCategory` and `categoryColor` change their signature; `ThemeIllustration` takes `category: string`. `CONTRACT_VERSION`, the `theme.json` of every installed theme, the schema and the reference move to `contract: 2`, with a migration note in `docs/themes/creating-a-theme.md`. It ships as `feat(theme)!` and raises `y`. Amendment #324 of ADR-0005 no longer holds, and ADR-0005 points here.

### 10. CMS side, frontend first

The frontend reads `order` and `featured ?? pillar` from today's CMS, so it ships first and works with the current one. `micelio-cms` then adds the optional `color` and `featured` fields and removes `key`, `bird` and `pillar` (item 7 of #462), in its own PR with `!`, and gives the demo seed an `order`. The release notes name the CMS line the frontend was tested with.

## Options considered

- **A. List from the CMS, color by position only.** The simplest, and the first plan. Rejected: a reorder changes the color of every post.
- **B. A plus an optional color, `featured`, no UI without categories and extras in the theme.** Chosen.
- **C. Several taxonomies with hierarchy** (`parent`, series, topics). The most general, and the most costly in URLs, breadcrumbs, the sitemap and the CMS. Deferred; B leaves it open, because `slug` and `order` do not prevent a `parent`, and `useCategories()` can become `useTaxonomy(kind)` later. Tags already exist.
- **Color from a hash of the slug.** Rejected: stable, but two slugs can collide and the editor cannot choose.
- **More color roles (`category-6…`).** Rejected for now: more roles every theme must style and pass the contrast matrix. An optional role with a core default is still possible in contract 2.

## Trade-offs

- A new or renamed category takes up to the cache (10 minutes) plus the ISR window to appear, and its route answers 404 until then.
- A static site does not rebuild when a category is saved, because the CMS rebuild hook ignores categories (item 6 of #462).
- A category with no localization in one language falls back to its slug.
- One more cached call per server-rendered page that shows a category; the JavaScript budget is checked in the UI and theme PRs.

## Consequences

- Any site (blog, documentation, portfolio, shop) brings its own categories, and a landing shows none.
- The contract of themes is small and made of data: a theme that follows contract 2 does not depend on a count or a name.
- Work is split into PRs of about 400 lines each: this record; server side (`loadCategories`, reading-path, feeds, sitemap, redirects); routing and static build; components onto the list; and contract 2. Each is `Refs #462`.
- Open questions that do not change the decision and are settled in the PRs: whether empty categories appear in lists, which categories the home field guide shows, and whether `reading-path` answers 404 instead of 400 for an unknown category.
