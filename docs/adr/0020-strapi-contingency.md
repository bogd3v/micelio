# ADR-0020: Stay on Strapi, keep the way out priced and open, and act on three named triggers

**Status:** Proposed
**Date:** 2026-11-09
**Deciders:** Micelio maintainer

## Context

The market study of 2026-10-27 names dependence on Strapi as the gravest threat to Micelio. Since [ADR-0017](0017-distribution-plugins-multisite-editorial.md) every capability of Micelio is a Strapi plugin (`@micelio/strapi-plugin-core`, the fediverse plugin, the ones that follow) installed in a Strapi project (`micelio-cms`), so the exposure grows with each milestone. Until this record, nothing said what would make Micelio respond or what the response is (bogd3v/micelio#843, epic bogd3v/micelio#842).

What Micelio depends on is measured in [`docs/architecture/strapi-surface.md`](../architecture/strapi-surface.md), read on 2026-11-09 with the command next to each list:

- `micelio-cms` depends on `@strapi/strapi`, four other `@strapi/*` packages and two third-party Strapi plugins (`strapi-plugin-comments`, `@notum-cz/strapi-plugin-seo`). It holds 7 content types and 51 components in Strapi's schema format, extends `users-permissions` (6 files), `strapi-plugin-comments` and the core plugin through Strapi's extension mechanism, and its server reads 17 members of the `strapi` object, raw database access (`strapi.db.connection`) among them.
- `micelio-plugin-core` holds 8 content types and 8 components, reads 17 members of the `strapi` object, and its admin is built on Strapi's design system and admin API, one `unstable_` hook included (`unstable_useContentManagerContext`).
- The fediverse plugin is still the local plugin of `micelio-cms` (3 content types); its own package `@micelio/strapi-plugin-fediverse` imports nothing from Strapi yet.
- The frontend (`micelio`) imports nothing from Strapi. It speaks to it over HTTP through `strapiFetch` (`server/utils/strapi.ts`) and depends on the shapes of the content API, a contract of the [engineering standard](../engineering-standard.md), "Product contracts".

Some of the way out exists already. The block contract (`contract/blocks.ts` of `micelio-plugin-core`, [ADR-0018](0018-blocks-as-a-contract.md)) and the preview contract are written in Micelio's own terms with zod and JSON Schema, and the Strapi form is derived from them. Five of the six `rules.ts` modules of the core (block options, block settings, budget, islands, page templates) import nothing from Strapi; `sites/rules.ts` does. The site export (`docs/export-format.md` of `micelio-plugin-core`) writes one site as JSON files named by Micelio's export names, with its media by hash, and the core has an exporter and an importer. The theme contract ([ADR-0005](0005-theme-contract.md)) names nothing of Strapi.

The community edition of Strapi is MIT, except the code under `ee/` and two whole packages under the Strapi Enterprise License, which Micelio never enables (`THIRD-PARTY.md` of `micelio-cms`; `npm run lint:ee`). Micelio is AGPL-3.0-only ([ADR-0007](0007-license.md)), its image bundles Strapi, and its business plans include hosting sites for others (ADR-0017): a licence that forbids either would stop Micelio from shipping a new Strapi. A version already published under MIT stays MIT; what a trigger takes away is the versions that follow it.

Micelio is at `0.y`, alpha (standard, section 7, "Before 1.0.0"). This record moves no code.

## Decision

### 1. Micelio stays on Strapi

Strapi stays the CMS of Micelio. No abstraction layer, second CMS or fork is built before a trigger of section 2 fires. Section 4 keeps the cost of leaving from growing faster than the product.

### 2. The triggers

Each trigger is a fact that can be checked, not a judgement:

1. **A licence change of the community edition.** A version of `@strapi/strapi`, or of a Strapi package in a "Dependencies" list of `strapi-surface.md`, is published under a licence other than MIT for the code outside `ee/`; or a feature a list of `strapi-surface.md` names moves from the community edition to the Enterprise edition. Checked by reading the `LICENSE` file of the published package (`npm pack @strapi/strapi@<version>`), since its `license` field says only `SEE LICENSE IN LICENSE`.
2. **Six months without a release.** No version of `@strapi/strapi` has been published on npm for six months, patch versions included. Checked with `npm view @strapi/strapi time --json` (the newest date).
3. **An acquisition that changes the terms.** Strapi Solutions SAS is acquired or merged, and the new owner changes the licence or the split between editions (then it is trigger 1), the terms on which the community edition is distributed (npm, the GitHub repository, the Docker images), or the terms on which plugins are published and named (the marketplace, the name `strapi-plugin-*`, the trademark). An acquisition that leaves the terms as they are is noted in the issue of the next reading and acts on nothing.

The maintainer checks the three at every release line of `micelio` and at every minor version of Strapi that Micelio moves to.

### 3. What is done at each trigger

At any trigger, within seven days:

- An issue opens in `micelio` with the evidence (the command and its output), and a new reading of `strapi-surface.md` is taken.
- `micelio-cms`, `micelio-plugin-core` and the fediverse plugin pin every `@strapi/*` package and Strapi plugin to the exact version before the trigger, and Dependabot ignores the newer ones. The next release notes of each say so.

Then, by trigger:

| Trigger | Within 30 days | After |
| --- | --- | --- |
| 1. Licence | Read the new licence. If the OSI approves it, and it lets Micelio distribute its image under the AGPL and anyone host sites with it, an amendment of this record says so and the pin is lifted. | Otherwise Micelio stays on the last MIT version. Security fixes come from a community fork under MIT when one publishes releases, and from patches carried by `micelio-cms` until then. A record that supersedes this one chooses the target among options C, D and E within 60 days of the trigger, and an epic carries the move, starting with option B. |
| 2. No release | Look for advisories against `@strapi/*` that have no fix (`npm audit`) and for a maintained fork. An advisory without a fix is handled within the time frames of `docs/DEPENDENCY_RISKS.md` of `micelio-cms`, with a carried patch. | If Strapi has not published a version within 90 days of the trigger, a superseding record chooses as for trigger 1. A release in between ends the trigger: the issue records it and the pin is lifted. |
| 3. Acquisition | Name the term that changed. | A licence or an edition change is trigger 1. A change to how Strapi is distributed: Micelio keeps the pinned packages it needs where it can install them again (the lockfiles name their checksums). A change to how plugins are published or named: the plugins leave the marketplace or are renamed, with no change of code. |

### 4. The rule for new code

From the acceptance of this record, a change to `micelio-cms`, `micelio-plugin-core` or a Micelio plugin follows these rules, and the reviewer checks them:

1. **Rules without Strapi.** Logic that decides something (validation, budgets, permissions of Micelio's own, transitions, serialisation of the export) lives in a module that imports nothing from `@strapi/*` and receives data, not the `strapi` object. Services, controllers, routes, `register`, `bootstrap`, document service middlewares and admin pages are the adapters that call Strapi and call those modules.
2. **Contracts in Micelio's terms.** A new contract (a block, a preview message, an export name, a hook payload) is written in zod or JSON Schema, and its Strapi form is derived from it, as `contract/strapi.ts` does for blocks.
3. **Everything a site owns leaves with the export.** A new content type of a Micelio plugin declares its export (`docs/export-format.md` of `micelio-plugin-core`, "How a type declares its export"), or the format says why it is never exported.
4. **No Enterprise code**, and no feature that exists only in Strapi's Enterprise edition (`npm run lint:ee`).
5. **A new Strapi API is named.** A pull request that uses a Strapi API absent from the latest reading of `strapi-surface.md` (a new entry point, server member, identifier or admin API) names it in "For review", and uses an `unstable_` or internal API only when no public one does the job, saying why.

### 5. Readings

`strapi-surface.md` is read again at every release line of `micelio`, at every major of Strapi and at every trigger, by running its commands at the new commits and adding a row to its "Readings".

## Options considered

### A. Stay on Strapi and keep the way out priced and open (chosen)

The cost now is the rules of section 4, which the core already follows for its contracts and for five of its six `rules.ts` modules, and a reading per release line, a few minutes with the commands. A trigger costs a week of pinning and an issue, then the price of the option the superseding record chooses. It keeps the roadmap of ADR-0017 and the work already done on Strapi, and makes the decision to leave on facts instead of on fear.

### B. A package with no Strapi imports now, Strapi as one adapter

The rules, contracts and export of the core move to a package that imports nothing from Strapi, and the plugins become adapters. Moving the modules that already import nothing is days of work. The cost is everything else: a neutral form for documents, draft and publish, permissions and the admin, which is built on Strapi's design system and admin API (the "Names imported" and "Admin API" lists), has no neutral equivalent and would be designed for a second CMS that does not exist yet. Not chosen now. Rule 1 of section 4 keeps the modules ready to move, and B is the first step of the move after a trigger.

### C. Move to another open-source headless CMS now

The content model (7 content types and 51 components in `micelio-cms`, 16 schemas in the core, 3 in the fediverse plugin), the extensions of `users-permissions` and of the comments plugin, the admin of the core (the builder, the preview, the editorial workflow) and the importer are rewritten for the other CMS; content moves through the site export. Every candidate carries the same three risks, with its own licence and its own owner to check at the time. Rejected: it pays the whole price for a risk that has not happened.

### D. Fork Strapi now

A maintained fork removes the licence and abandonment risks at once. Micelio would maintain a large framework (the server, the database layer, the admin, the plugins it installs) and its security fixes, alone. Rejected as a standing choice. After a trigger, a fork maintained by the community is preferred to Micelio's own, and carried patches on the pinned version bridge the time to the move.

### E. Write Micelio's own content backend

Removes the dependency for good. Micelio would build authentication, the admin, media, i18n and permissions, which Strapi provides today, before shipping anything a site sees. Rejected; it is chosen only if no candidate of option C fits when a trigger fires.

## Trade-offs

- The way out is priced, not paid. After a trigger of section 2, the move takes months, and the sites run on a pinned Strapi that gets no fixes from upstream in the meantime.
- Carried patches on a framework Micelio does not own are a security cost: each is a change to read and to test, and the time frames of `docs/DEPENDENCY_RISKS.md` of `micelio-cms` still apply to them.
- Rule 1 of section 4 adds a module boundary to new features, and rule 5 adds a line to some pull requests.
- The reading is a grep of the source: it names what the code calls, not what it relies on Strapi to do (the lifecycle and `bootstrap` order, the draft and publish storage, the permission model). `strapi-surface.md` says what it leaves out.
- The triggers are watched by hand until a check exists.
- Worth revisiting when a second CMS is wanted for its own sake (a customer, a channel), when the surface of a reading grows by half against the previous one, or when the export can no longer carry a site whole.

## Consequences

- `docs/architecture/strapi-surface.md` holds the first reading, and `docs/adr/README.md` lists this record.
- Documentation only: a PATCH (standard, section 7). It moves no code, and no contract of the standard's "Product contracts" changes.
- After the maintainer sets this record to `Accepted`, each change it asks for is its own issue: the check of the triggers and the reading in the release checklist (`docs/architecture/releasing.md`); a check in `micelio-plugin-core` that the modules of rule 1 of section 4 import nothing from `@strapi/*`, which `sites/rules.ts` fails today; rule 5 in the pull request template, a synced file whose source is `template/` of `micelio-engineering`; and the package of option B only when a trigger leads to a move.
- `lint:ee` in the `check` of every repository that depends on Strapi (bogd3v/micelio-engineering#140, bogd3v/micelio-plugin-core#130) is rule 4 of section 4.
