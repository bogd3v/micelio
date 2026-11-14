# ADR-0024: Site navigation as content of the site

**Status:** Proposed
**Date:** 2026-11-13
**Deciders:** Micelio maintainer

Approved by the maintainer on 2026-11-13, with the designs 16 and 16b of the page "Site structure and AI (design only)" of the private artifact "Micelio plugin admin". The designs are context, not part of the decision. The record moves no code (bogd3v/micelio#917, part of bogd3v/micelio-plugin-core#62).

## Context

The links of the header and the footer are code:

- `useNavLinks()` (`app/composables/useNavLinks.ts`) returns home, blog and about.
- `app/theme/layout/footer/Columns.vue` builds three groups (`navigate`, `topics`, `subscribe`) in a fixed order.
- The tagline under the footer mark is the message `myc.footer.tagline` of the core's locale files: a value of the site kept in the code.
- `Site` (`app/interfaces/site.ts`) has no menu.

Two sites on one theme show the same navigation, and a site cannot link its own pages. The Micelio site needs to link its documentation, and with several sites per CMS ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 4) the menu has to belong to the site.

The menu is stored data and a field of the content API, so it is a contract of section 6 of the [engineering standard](../engineering-standard.md), and a model that is expensive to undo once third-party themes ([ADR-0008](0008-theme-registry.md)) render it. The theme contract gains hooks ([ADR-0005](0005-theme-contract.md)); the pages a link points at are composed as in [ADR-0022](0022-page-composition.md) and addressed by the stable block `id` of [ADR-0018](0018-blocks-as-a-contract.md).

## Decision

### 1. Where

`site` ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 4) gains a `navigation` field owned by `@micelio/strapi-plugin-core`: one JSON document per site, not localised. Its shape is defined by the contract package (`contract/navigation.ts`, zod), with a JSON Schema generated from it and checked for drift, as the block catalogue is.

### 2. Shape

```
{ version: 1, header: NavLink[], footer: NavGroup[] }
```

- A `NavLink` has a stable `id`, `labels` per locale, a `target`, an optional `action: true` (one at most in `header`) and optional `children` (header only, one level).
- A `NavGroup` is `links` (titles per locale and a list of links) or one of the computed kinds `topics` and `subscribe`, which the core fills as it does today.
- Labels are per locale and the target is shared, so a link cannot point at different places in two languages. A link with no label in a locale is left out in that locale.

### 3. Four targets

- `page`: a document id. The address is resolved at request time, so renaming a slug breaks no link.
- `route`: a closed list: home, blog, a blog category, about, search, feed. A route of a module that is off is left out.
- `section`: a page and the stable id of one of its blocks. It is not offered until bogd3v/micelio-cms#440 ships.
- `external`: an absolute `https` URL ([ADR-0011](0011-refuse-plain-http-upstreams.md)). The core sets `rel="noopener noreferrer"`, opens it in a new tab as the footer does today and renders the marker. None of that is stored, so no site can weaken it.

### 4. Resolved by the server

The content API answers `navigation` resolved for the site and the locale: each target becomes an address and a label, and the links whose target is unpublished, missing in the locale, deleted or of a module that is off are left out by the server. The theme and the frontend never see the document or an unresolved target.

### 5. Default

`navigation: null` renders as today: home, blog when it is on, about, and the three footer groups. The landing mode ([ADR-0006](0006-site-modes.md)) keeps deriving its links from the home page's sections while the field is `null`; a saved menu wins.

### 6. Tagline

The footer reads `site.tagline`. The CMS `site` type already has it, but the frontend does not read it yet: the frontend follow-up adds it to `server/schemas/site.ts` and to `Site` (`app/interfaces/site.ts`). The message `myc.footer.tagline` leaves the core's locale files, so no site value stays in the code.

### 7. Always rendered, not part of the document

The legal line with the link to the source code ([ADR-0007](0007-license.md)) is rendered whatever the document says. A menu cannot remove it.

### 8. Theme contract 2.3 (minor)

The hooks go in the minor that carries the region options of the amendment of [ADR-0005](0005-theme-contract.md) of 2026-11-13 if they land with the region options or before them, and in the next minor otherwise. It adds:

- The hooks `myc-nav-sub` and `myc-nav-sublink` for a nested list, rendered as a native `<details>` without JavaScript.
- `data-kind="external"` on a navigation item.

Both are optional hooks with a core default, so installed themes keep validating, and the core styles both from the roles. Adding them raises `CONTRACT_VERSION.minor`, adds rows to `CONTRACT_ADDITIONS` and a section to `docs/themes/contract-changelog.md`.

### 9. Checks

At save, on the server: the schema; the existence of every page, category and block in the same site; `https`; one action at most; one level. A failure is a problem detail ([ADR-0015](0015-problem-details.md)) that names the link.

Warnings only, never a refusal: a label over 24 characters, more than 6 top-level links, a target used twice. They are warnings because they are matters of design that depend on the theme and the site (a long label fits one header and not another, a repeated target can be deliberate), not errors in the data; refusing them would block a menu that renders correctly.

Deleting a linked page or block asks first. A dangling link is not rendered and is reported by the status checks.

### 10. Limits

12 header links, 6 footer groups, 60 characters a label. These are the hard limits, and they bound what the check at save refuses: the size of the stored and cached document and the work of resolving it on each request, and a label that cannot break a layout whatever the theme. They sit above the warnings of section 9, so the usual menu is never refused. The numbers are a starting point, not a measurement; the follow-up issues may tune them with what the first sites show.

### 11. Versioning

`navigation.version` is the document's own. Adding an optional field, a route or a group kind is a minor; removing or renaming one, or changing a meaning, is a major with a migration of stored documents. The site export carries the document and rewrites ids on import.

### 12. Left out

A second level, icons per link, a custom `rel`, target or class, links for signed-in visitors only, and menus other than header and footer. Social links stay in `site.socialLinks`.

## Options considered

- **A. One JSON document shaped by the contract (chosen).** One value to save, validate, cache, export and version; nesting, the single action and the closed targets are rules of the schema; the contract package is the one definition the plugin, the frontend and the admin share.
- **B. Strapi components on `site`.** Native editing with no code in the admin. Rejected: targets per locale can drift apart, and the nesting and the single action cannot be expressed by a component schema, so the checks would be code anyway.
- **C. A collection of items with a parent relation.** Real relations and database integrity. Rejected: a menu becomes dozens of rows to order, publish, export and import with remapped ids, and one-level nesting is again a rule outside the schema.
- **D. Environment variables.** Rejected: an editor cannot change them, they are per deployment and not per site, and nesting and labels per locale do not fit.
- **E. The theme declares the menu.** Rejected: it ties the content of the site to the design, so changing the theme changes the menu, and a site cannot link its own pages; the theme stays the owner of how the menu looks.

## Trade-offs

- Integrity is enforced by the plugin, not by the database. A page deleted through a path that skips the plugin (a database edit, a script) leaves a dangling target; the server leaves such a link out and the status checks report it.
- The resolved navigation is cached with the site settings, so a change reaches pages after that cache and the ISR window of [ADR-0001](0001-isr-without-cdn.md), as the theme overrides do.
- A `<details>` menu does not open on hover. It works without JavaScript, on touch and by keyboard, and costs no bytes; a hover menu would need script and would break the budgets of the static and landing modes.
- One document is saved whole: two editors saving at once overwrite each other, as with any single field of `site`.
- Limiting the menu to one level, two menus and four targets leaves out what some sites want, on purpose, until a site asks.

## Consequences

- The follow-up issues, by proposed title, open once this record is `Accepted`:
  - `feat(contract): navigation.ts, the zod schema of the menu and its generated JSON Schema`.
  - `feat(plugin-core): the navigation field of site and its validation at save`.
  - `feat(plugin-core): resolve navigation in the content API by site and locale`.
  - `feat(frontend): useNavLinks() and the footer variants read the resolved navigation and site.tagline`.
  - `feat(theme): contract 2.3, the hooks myc-nav-sub and myc-nav-sublink and data-kind="external"`.
  - `feat(plugin-core): the navigation page of the admin`.
  - `feat(plugin-core): the status check for dangling navigation links`.
  - `feat(plugin-core): the navigation section of the site export`.
- `docs/api.md`, `docs/openapi.json`, the theme reference (`docs/themes/reference/`) and the contract changelog change with those issues, not with this record.
- `myc.footer.tagline` leaves the locale files with the frontend issue; until then the footer is as today.
- A menu is content of the site: it is exported and imported with it, and its permission is the one of editing the site.
