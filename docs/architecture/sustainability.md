# Sustainability

**Kind:** explanation. It goes through the Web Sustainability Guidelines that apply to a site engine and says how Micelio meets each one, what checks it, and what is not met. The numbers of the carbon estimate and its model are in [`performance.md`](../performance.md#carbon-estimate); the rule is section 9 of the [engineering standard](../engineering-standard.md#9-security-privacy-accessibility-performance-and-sustainability).

## The source

The guidelines are the W3C Web Sustainability Guidelines (WSG), <https://www.w3.org/TR/web-sustainability-guidelines/>. The page read for this document, on 2026-10-19, is a **W3C Group Note Draft of 16 October 2026**, with no published version yet. The identifiers (`2.4`) and titles below are the ones of that draft. They may change before the Note is published; recheck them against the page when it is.

The guidelines are grouped in five sections: 2 User Experience Design, 3 Web Development, 4 Hosting, Infrastructure, and Systems, 5 Business Strategy and Product Management, and an appendix on accessibility, privacy and security. Section 1 is the introduction. Each guideline has success criteria; this document does not repeat them.

## How to read the status

| Status | Meaning |
| --- | --- |
| **Met** | The engine does it by design, and a check or a documented decision keeps it that way |
| **Partly** | The engine does part of it. The rest is named |
| **Not met** | The engine does not do it. Named, with the reason |
| **Owner** | A decision of the site's owner or operator. The engine supports it and does not make it |
| **Not applicable** | No part of the engine it touches (for example, the CMS owns the data) |

"Checked by" names the command, budget or test that fails when the guideline breaks. A guideline with no check says so.

## User Experience Design (section 2)

| Guideline | Status | How Micelio meets it, or what checks it |
| --- | --- | --- |
| 2.1 Identify, assess, disclose, review, and mitigate sustainability impacts | Partly | The carbon estimate per page (`co2Mg`) is reported on every run, and the weight budgets are checked. An impact analysis of a particular site is the owner's |
| 2.2 Understand user requirements or constraints | Owner | The users of a site are the owner's |
| 2.3 Integrate sustainability into every stage of the ideation process | Owner | Process of the project; the engine documents it in `AGENTS.md` and the standard |
| 2.4 Design efficient and streamlined user journeys | Owner | The journey is the theme's and the site's. The engine's pages are plain reading pages with a few links |
| 2.5 Design to assist and not to distract | Partly | Motion stops under reduced motion (2.10). The layout of a page is the theme's and the site's |
| 2.6 Avoid being manipulative or deceptive | Met | The engine carries no advertising. Analytics is first-party, proxied by the server (ADR 0002). Checked by the zero third-party budget |
| 2.7 Make deliverables understandable and reusable | Partly | Documentation in `docs/`, generated reference (`docs/openapi.json`, `docs/themes/reference/`) and a contract for themes (ADR 0005) |
| 2.8 Use a design system for interface consistency | Met | Semantic roles and `myc-*` components, enforced by `npm run lint` (`check-classes`, `check-primitives`) |
| 2.9 Optimize media to reduce resource use | Partly | Images go through `@nuxt/image`; the home photos of Bogotá are WebP at quality 80, 390 px on phones (#367). Lazy loading below the fold. `imageKb` reports what a page loads without scrolling, but no image limit exists yet |
| 2.10 Ensure animation is proportionate and easy to control | Met | The scroll reveal runs only under `prefers-reduced-motion: no-preference`; heavy islands with motion keep their fallback under reduced motion (ADR 0006) |
| 2.11 Use optimized web typography | Met | Fonts are self-hosted and subset (latin, only the axes used). Bogotá's fonts are 35.5 KB. Checked by the `fontKb` limit and the FOUC check |
| 2.12 Avoid unwanted notifications | Partly | The newsletter sends only after a sign-up, with a confirmation page (`confirm.vue`). The unsubscribe page is in `newsletter/` |
| 2.13 Reduce the impact of downloadable and physical documents | Not applicable | The engine serves no downloadable documents; the feeds are XML |
| 2.14 Involve users early in the project | Owner | Process of the project |
| 2.15 Audit and test for bugs or issues requiring resolution | Met | Unit, integration, end-to-end, contract, theme and performance suites in CI (standard, section 15). `npm run check` before a pull request |
| 2.16 Validate usability through testing and real-world usage | Partly | Automated accessibility (axe, WCAG 2.2 in the theme run) and a manual checklist for a theme's admission (`docs/theme-testing.md`). No user research and no real-usage metrics by the engine |
| 2.17 Provide cross-platform compatibility support | Partly | The CSS targets are chrome 111, edge 111, firefox 114, safari 16.4 and ios 16.4 (`AGENTS.md`). The supported devices and browsers are not written as a document yet |

## Web Development (section 3)

| Guideline | Status | How Micelio meets it, or what checks it |
| --- | --- | --- |
| 3.1 Set goals based on performance and energy impact | Met | Budgets per page, theme and site mode (`npm run perf -- --check`, `scripts/perf/budgets.json`), and the carbon estimate beside the weight |
| 3.2 Minify and remove unused code | Met | Production builds are minified. Static output drops the client scripts no page names (`modules/static-routes.ts`, 14.72 MB to 5.94 MB on the mock) |
| 3.3 Modularize bandwidth-heavy components | Met | Heavy islands (Mermaid, the playground, the scene) load their code only when used, from `/_islands/` (ADR 0006). Checked by the `islands` budgets |
| 3.4 Avoid redundancy and duplication in code | Not checked | No duplication check runs in CI |
| 3.5 Treat third parties the same as first parties | Met | No third-party request on the measured pages: fonts and scripts are self-hosted, and analytics is proxied first-party (ADR 0002). Checked by `thirdPartyRequests` (limit 0) |
| 3.6 Ensure code follows good semantic practices | Met | Semantic HTML, the axe run (`npm run test:theme`) and the Lighthouse accessibility budget |
| 3.7 Defer the loading of non-critical resources | Met | Heavy islands load after `load` and idle; Nuxt prefetches links on interaction in dynamic mode (`prefetchOn`); speculation rules in static |
| 3.8 Structure metadata for machine readability | Partly | `useSeoMeta()` on the pages, with Open Graph and Twitter Card tags (`AGENTS.md`, SEO). No budget or test covers the structured data |
| 3.9 Use media queries that support sustainability goals | Met | `prefers-reduced-motion` is honoured by the scroll reveal and the islands. The scene island does not load under `Save-Data` or reduced motion (`app/islands/lib/features.ts`, `docs/performance.md`, Islands) |
| 3.10 Ensure layouts work for different devices and requirements | Partly | Mobile layout measured at 412 x 823. The standard requires a manual check of 320 px reflow for a theme (section 9). No carbon-aware design: the engine does not adapt to the grid |
| 3.11 Use sustainable JavaScript and APIs | Partly | Islands only when used; static pages have no Vue runtime (ADR 0006). Dynamic pages still hydrate the whole app |
| 3.12 Use dependencies sparingly and maintain them | Met | Tailwind, `@nuxt/ui` and `qs` were removed for weight (`docs/performance.md`, History). Licences are checked (`npm run lint:licenses`) and Dependabot is configured (`.github/dependabot.yml`) |
| 3.13 Include expected and beneficial files | Met | `robots.txt`, `sitemap.xml` and `feed.xml` are served (`server/routes`). `/.well-known/security.txt` is served when the owner sets a security contact in the site settings, and is a 404 otherwise (`server/routes/.well-known/security.txt.ts`) |
| 3.14 Use the most efficient solution for your service | Met | Static output whenever the content allows it, the site mode is the choice (ADR 0006); dynamic pages are cached by ISR (ADR 0001) |
| 3.15 Use the latest stable language version | Partly | Node major from `.nvmrc`; Nuxt 4 and Vue 3. No check that the versions are the latest |
| 3.16 Reduce the number and complexity of database queries | Not applicable | The engine has no database of its own; the content comes from Strapi, whose queries are the CMS's (`micelio-cms`) |

## Hosting, Infrastructure, and Systems (section 4)

| Guideline | Status | How Micelio meets it, or what checks it |
| --- | --- | --- |
| 4.1 Use sustainable hosting | Owner | The hosting is the operator's. The estimate takes no green hosting credit (the green hosting factor is 0) |
| 4.2 Optimize caching and support offline access | Partly | Client caching: precompressed assets with `Vary`, `/fonts/display/` cached a year as immutable. Server caching: ISR (ADR 0001), without a CDN. Offline access: not met, the engine has no service worker |
| 4.3 Reduce data transfer with compression | Partly | Assets are precompressed by Nitro (brotli and gzip, History 2026-10-03). Nitro does not compress the rendered HTML: a production proxy does, which the budgets in dynamic mode do not measure |
| 4.4 Setup necessary error pages and redirection links | Partly | An error page (`app/error.vue`). Broken links and redirects are not checked |
| 4.5 Avoid maintaining unnecessary virtualized environments or containers | Owner | The operator decides what runs |
| 4.6 Use automation wisely | Partly | CI runs on push, the performance matrix runs per theme and mode, and the release is a workflow of its own. No scheduled job of the engine is checked for necessity |
| 4.7 Define the frequency of data refreshes | Met | The refresh of pages is set by ISR (ADR 0001); the caching of each route is in `docs/api.md` |
| 4.8 Back up critical data at routine intervals | Owner | The operator's backups, `docs/operate/backup.md` |
| 4.9 Assess the impact and requirements of data processing | Partly | The content is held by the CMS, not by the engine. Logs keep no secrets, emails or raw IP addresses (standard, section 4). Carbon-aware scheduling is not used |
| 4.10 Use Content Delivery Networks (CDNs) when beneficial | Owner | The engine runs without a CDN by decision (ADR 0001). A static site can sit behind any CDN, since its output is plain files |
| 4.11 Ensure infrastructure fits project requirements | Owner | Capacity is the operator's. ISR bounds the work per visit |
| 4.12 Store data according to the needs of your users | Partly | Content lives in the CMS, which owns retention. The session is an httpOnly cookie (ADR 0003). Retention of the CMS data is not reviewed by the engine |

## Business Strategy and Product Management (section 5)

| Guideline | Status | How Micelio meets it, or what checks it |
| --- | --- | --- |
| 5.1 Have an ethical and sustainable product strategy | Partly | The engineering standard and `AGENTS.md`; the licence is AGPL-3.0 (ADR 0007). A site's own policies are the owner's |
| 5.2 Assign a sustainability advocate | Owner | A role of the project or the site |
| 5.5 Calculate the environmental impact | Partly | An estimate of CO2e per page view, reported and not budgeted. It is not the footprint of an organisation |
| 5.10 Follow a product management and maintenance strategy | Met | Semantic versions and a release line; only the latest line receives fixes (standard, section 7) |
| 5.11 Implement continuous improvement procedures | Met | Budgets with their history in `docs/performance.md`; a change that moves a budget records the number and the reason |
| 5.12 Document updates and evolutions | Met | Release notes from the pull request titles (standard, section 7); `docs/` changed with the code |
| 5.13 Evaluate if a digital product or service is necessary | Owner | The site's decision |
| 5.16 Share decision-making power with affected parties | Partly | The decisions that are expensive to undo are written as ADRs in `docs/adr/` |
| 5.18 Promote responsible data practices | Partly | Minimal personal data, first-party analytics, personal data kept out of logs (standard, sections 4 and 9) |
| 5.19 Establish responsible practices around AI and emerging or disruptive technologies | Not applicable | The engine has no AI feature |
| 5.22 Plan for a digital product or service's care and end-of-life | Partly | The release policy and the upgrade notes. The engine is pre-1.0 and says so (standard, section 7) |
| 5.24 Define performance, environmental, and human budgets | Partly | Performance budgets are enforced in CI. The environmental budget is the carbon estimate, reported and not yet budgeted. No human budget is defined; the accessibility score limit is the nearest thing |
| 5.25 Use and contribute to open source | Met | AGPL-3.0 with a theme exception (ADR 0007); third-party material is listed in `THIRD-PARTY.md` |
| 5.26 Create a business continuity and disaster recovery plan | Owner | The operator's plan. `docs/operate/backup.md` gives the backup paths |

The other guidelines of section 5 (5.3, 5.4, 5.6 to 5.9, 5.14, 5.15, 5.17, 5.20, 5.21, 5.23) describe an organisation's training, reporting, procurement, finance or e-waste. They belong to the site's owner, not to the engine, and nothing in the repository checks them.

## What is not met or not checked

- **Not met:** offline access (4.2); a written list of the supported devices and browsers (2.17).
- **Left to the operator:** compression of the rendered HTML in production (4.3). The budgets of dynamic mode measure it uncompressed.
- **Not checked by any command:** duplication in code (3.4), the structured data (3.8), the necessity of automated jobs (4.6), broken links (4.4), the latest versions (3.15).
- **An estimate, not a measurement:** `co2Mg` (2.1, 5.5, 5.24). It is reported per page, with the model and its assumptions in [`performance.md`](../performance.md#carbon-estimate). It becomes a budget after a CI baseline, as the standard asks.
- **Outside the engine:** hosting, the CDN, the grid and the visitor's device. The estimate does not cover them.

## Related

- [`performance.md`](../performance.md): the budgets, the carbon estimate and its history.
- [Engineering standard, section 9](../engineering-standard.md#9-security-privacy-accessibility-performance-and-sustainability): the rule.
- [ADR 0001](../adr/0001-isr-without-cdn.md): caching without a CDN.
- [ADR 0002](../adr/0002-first-party-umami-proxy.md): first-party analytics.
- [ADR 0006](../adr/0006-site-modes.md): static, dynamic and landing, and the heavy islands.
