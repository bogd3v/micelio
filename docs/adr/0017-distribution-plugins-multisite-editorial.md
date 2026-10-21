# ADR-0017: Micelio as Strapi plugins, with a reference distribution, several sites per CMS and an editorial workflow

**Status:** Accepted
**Date:** 2026-10-20
**Deciders:** Micelio maintainer

## Context

`micelio-cms` is a complete Strapi project: content types, components, a local fediverse plugin, boot migrations, API tokens, security middlewares, the image and the Compose files. Adopting Micelio means adopting all of it; a developer who already runs Strapi cannot add Micelio to it. The business plans (hosted sites, sites for internet providers, a theme registry) need a product whose whole stack is controlled; reaching existing Strapi users needs a plugin. These two audiences were weighed on 2026-10-20 and both are wanted.

Two more decisions were taken with them, because they shape the same data model:

- One CMS serves several sites. `site-setting` is a single type today; a provider offering sites to its clients would otherwise need one Strapi per client.
- Entries get an editorial workflow. Strapi offers draft and published; sites with several editors need in review, scheduled and a policy on who publishes. Strapi's own Review Workflows are an Enterprise feature.

Micelio is at `0.4.0`, alpha: a breaking change raises `y` and ships with the `!`, a `BREAKING CHANGE:` paragraph and upgrade notes ([engineering standard](../engineering-standard.md), section 7); it needs no record of its own, but a decision this expensive to undo does (section 12), and that record is this one. The content API between the CMS and the frontend, the operator interface and the stored data are contracts of section 6. The theme and fediverse milestones (#7, #8, bogd3v/micelio-cms#4) are open and touch `site-setting` (bogd3v/micelio-cms#97, bogd3v/micelio-cms#303). The plan this record comes from is epic bogd3v/micelio-engineering#1 and epic bogd3v/micelio-plugin-core#1.

## Decision

### 1. Plugins, and a reference distribution

Micelio's capabilities ship as Strapi plugins under the npm scope `@micelio`: `@micelio/strapi-plugin-core` (content model, sites, blocks, editorial workflow, hooks, host check, status, export), `@micelio/strapi-plugin-fediverse` (today's local plugin), and later one package per optional capability (newsletter, search, documentation publishing, preservation). A site installs what it uses.

`micelio-cms` stays as the **reference distribution**: a thin Strapi project that installs the plugins with the opinionated configuration the plugins cannot set themselves (security middlewares, CSP, uploads provider, rate limiting), the image, the Compose files and `.env.example`. It is what hosting runs, what the contract suite tests, and what "Micelio 1.4" means. A developer with an existing Strapi installs the plugins and follows `docs/operate/existing-strapi.md`; the plugin's host check (section 7 below) verifies what it can and refuses to start in production when a required condition is missing.

### 2. The content API changes once, at the cut-over

Content types owned by the plugin have UIDs `plugin::micelio.<type>` instead of `api::<type>.<type>`, and the plugin registers its content-api routes under the paths the frontend uses today (the prefix is set explicitly; the spike bogd3v/micelio-cms#316 confirms the mechanism). The response shapes do not change. This is a breaking change of the content API and of the stored data: it ships in one release line (`0.7`), CMS first behind an alias that keeps the `0.6` frontend working, frontend second, with the migration and the upgrade notes. It happens after the theme and fediverse milestones close, so that no open issue has to be rebased on it, and before the registry accepts third-party themes (#404), after which a UID change costs a MAJOR.

### 3. What stays in the distribution

Everything a plugin cannot own or should not decide for a host: `config/middlewares`, the CSP, the uploads provider, the database, `.env.example`, the image, Compose, backup paths, the Node major. These remain the operator interface of section 6 of the standard and are versioned with `micelio-cms`.

### 4. Several sites per CMS

`site-setting` becomes the collection `site`: one row per site with what the single type holds today (name, description, tagline, url, default locale, author, logo, the modules the frontend turns on, and the fields that bogd3v/micelio-cms#97 and bogd3v/micelio-cms#303 add: theme version and digest, actor profile), plus `slug`, `hosts` (the host names that resolve to it) and `isDefault`. A boot step creates the default site from the existing single type at the cut-over and on a fresh instance.

Every content type owned by a Micelio plugin carries a required relation to `site`, and every plugin API, hook payload and policy is keyed by site. The content API filters by site: a request names the site by host or by `site` parameter; without one, the default site answers, which keeps the current frontend working unchanged. API tokens are not scoped per site in this record; a later record may add it.

Until the cut-over, bogd3v/micelio-cms#97 and bogd3v/micelio-cms#303 keep writing to the single type with field names that are carried over one to one, so the migration is a copy, not a mapping.

### 5. An editorial workflow of Micelio's own

Publishable types carry an `editorial` component: `state` (`draft`, `in_review`, `scheduled`, `published`), `publishAt`, `reviewedBy`, `publishedBy`. The transitions are `draft → in_review`, `in_review → draft`, `in_review → published`, `draft → scheduled`, `scheduled → draft`, `scheduled → published` (by a cron at `publishAt`), and `published → draft` (unpublish). Each transition is allowed by a policy per site and per Strapi role; `published` is the only transition that sets Strapi's `publishedAt`, and a document service middleware blocks any other route to it, Content Manager included.

Strapi's draft and publish remains the storage of the published snapshot; the editorial state drives it and never contradicts it. Plugins react to content through the hooks of the core (`afterTransition`, `afterPublish`), not through `publishedAt`, Strapi lifecycles or the `entry.publish` event; the fediverse plugin moves to them at the cut-over. Adding a state is a MINOR of the core; renaming or removing one is a MAJOR.

### 6. Versions

A plugin package has its own semantic version and declares the core release line it supports (`micelio: "0.7"`). The core publishes the hooks API, the block contract and the editorial states as contracts of section 6 of the standard; a plugin that uses them pins the line. `micelio-cms` keeps the release line of [ADR-0010](0010-semantic-versioning.md) and bumps a MINOR when it raises the plugins it installs.

### 7. What the host must provide

The plugin checks at boot and refuses to start in production without: the Node major of `engines`; PostgreSQL in production; the security middlewares and a CSP; a server-side sanitiser for HTML built from content; a configured uploads provider; the required environment variables of section 5 of the standard. The exact list is produced by the spike bogd3v/micelio-cms#316 and recorded in `docs/operate/existing-strapi.md`; this section is amended with it when the record is accepted.

## Options considered

- **Plugin only, no distribution.** Lowest surface, but the operator interface would belong to each host, the security guarantees of section 9 of the standard could only be recommended, the compatibility matrix would be every Strapi version times every host configuration, and "install the plugin and you have Micelio" would be false because the frontend and the theme still need deploying. Rejected.
- **Project only, as today.** Keeps every guarantee and the simplest release line, and reaches no existing Strapi user; the Strapi marketplace stays closed as a channel. Rejected as the sole model.
- **Hybrid (chosen).** Plugins carry the capabilities; the distribution carries the guarantees. The cost is the extraction and one more surface to version.
- **Multi-site later, after 1.0.** Cheaper now, but `site-setting` would be a single type in a published content API and the fediverse actor, the theme pin and the editorial policy would all be built per instance and rebuilt per site. The migration is a copy today and a redesign later. Rejected.
- **No editorial workflow, or Strapi Enterprise's.** No workflow leaves "in review" to conventions and makes scheduled publishing impossible; the Enterprise feature is not available to an AGPL distribution's users. Rejected.
- **Editorial state outside Strapi's draft and publish.** Would duplicate the published snapshot. Rejected: the state drives Strapi's mechanism instead of replacing it.

## Trade-offs

- Two surfaces to version (plugins and distribution) and a contract suite that must run the frontend against the distribution and against a clean Strapi with the plugins.
- Plugin content types are hidden from the Content Manager unless declared visible, and their routes are prefixed unless configured; both are set explicitly and tested.
- Every query gains a site filter; the default-site fallback keeps the single-site case as simple as today.
- The editorial policy multiplies by site, and Strapi roles are global; the policy is stored per site and evaluated against the role, which is enough until sites have their own user pools.
- The cut-over is one large pull request per repository by necessity, far over the size guideline; its description gives the scripts and the proofs, as the prefix rename did ([ADR-0005](0005-theme-contract.md), amendment #416).

## Consequences

- The standard 1.4 (#659) already names the plugin, block, hooks, editorial and export contracts; `micelio-engineering` ships the tooling before the plugin repository is populated.
- `micelio-plugin-core` starts from the template with no content type; phase 0 (bogd3v/micelio-plugin-core#1) builds sites, blocks, the editorial component, hooks, the host check, the status page and the export specification.
- Release line `0.7` carries the cut-over, the thin `micelio-cms`, the published fediverse plugin and the first builder phase; its upgrade notes give the order (CMS first).
- `docs/operate/existing-strapi.md` and `docs/api.md` are rewritten at the cut-over; [ADR-0005](0005-theme-contract.md) and [ADR-0008](0008-theme-registry.md) are unaffected.
- Multi-site in the frontend (site by host, theme and static mode per site) is a later record.

## Amendments

**Amendment (2026-10-21, spike bogd3v/micelio-cms#316): what the plugin mechanism does, and the status.** The spike moved `category` and `tag` into a local plugin `micelio` (`plugin::micelio.category` and `plugin::micelio.tag`), removed `api::category` and `api::tag` from the host and ran the CMS suites on it (Strapi 5.58, Node 24, SQLite, on a throwaway branch that no longer exists). The existing suites give the same numbers as `main` (119 suites and 1669 tests passed, 3 and 11 skipped) once the test helper that spells permissions as `api::<type>.<type>.<action>` maps the two types; the first run failed 5 suites and 10 tests from that one cause. A probe of seven queries on `main` and on the spike (categories by locale, sort, `populate=articles`, filters, fields, by `documentId`, `status=draft`; tags; articles filtered by category and tags) gave the same JSON, ids and timestamps aside. The record is accepted, with these corrections.

- **Section 2, confirmed and made precise.** `createCoreController`, `createCoreService` and `createCoreRouter` work unchanged with `plugin::` UIDs. The default route is `/api/micelio/categories`; `createCoreRouter(uid, { prefix: '' })` gives `/api/categories`, `/api/categories/:id` and `/api/tags` as today. The prefix is per router, so only content-api routers may use `''`. A plugin's `routes` is an object of routers, not an array (an array is read as admin routes). Permission actions are named `plugin::micelio.<type>.<action>`, and the prefix does not hide them. The cut-over also edits the UID strings in `src/` and `tests/`, the `target` of `article.category`, `article.tags` and `section.post-list`, and regenerates `types/generated/contentTypes.d.ts`.
- **Section 2 gains a rename step.** Without one, an upgrade on an existing database fails silently, not loudly: the public role loses its category grant (`GET /api/categories` goes from 200 to 403), a hand-made Custom API token loses its category and tag permissions, the admin permissions of roles other than super-admin are dropped (11 rows became 5), and the old `up_permissions` rows are deleted one per action per boot, so orphans last two boots. Tokens that `ensureEnvToken` rewrites survive. A rename registered in the plugin's `register()` on `strapi::content-types.beforeSync` (as Strapi's content-releases does) for `up_permissions.action`, `strapi_api_token_permissions.action` and `admin_permissions.subject` kept all four in the upgrade test. It did not rename the keys of `strapi_core_store_settings`, so the Content Manager layout of the two types is reset; history versions and release actions were not touched.
- **Trade-offs, corrected.** Plugin content types are visible in the Content Manager by default (`pluginOptions['content-manager'].visible` defaults to `true`); hiding one needs `visible: false`. Content history exists only for `api::` types, so categories and tags lose their version history when they move. i18n behaves as before for both types.
- **Section 7, confirmed with limits.** A plugin cannot choose its place in the middleware stack (`strapi.server.use` in `register()` runs before `strapi::security`, `errors`, `cors` and `body`) and cannot set the CSP, the upload provider or the database; section 3 stands. It can read them in `bootstrap` (`strapi.config.get('middlewares')`, `plugin::upload.provider`, `strapi.db.dialect.client`, `api.rest.prefix`), so the host check of section 7 is implementable there. A plugin's `bootstrap` runs after the schema sync and after the permission cleanup of users-permissions and the admin, and there is no ordering between plugins. Project Knex migrations (`database/migrations`) load only from the host, so a plugin cannot ship one, and creating API tokens stays in the distribution: it needs the actions of every installed plugin and fails if one is unknown, so the permission lists are assembled from what is registered. Name-based, idempotent boot migrations (the editor role, public tags, env tokens) work as they are from `bootstrap`.
- **Not verified.** PostgreSQL (SQLite only), the full lint and format checks, the Docker contract suite, the admin UI in a browser (Content Manager visibility is read from source), a route collision between a host route and a plugin route (host routes register first, so the host should win), the layout and history rows when renaming UIDs, and the sanitiser and environment-variable parts of section 7, which are not host configuration.
