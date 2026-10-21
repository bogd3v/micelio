# Architecture Decision Records

Decisions that shape the frontend and are expensive to undo. Each record says what was decided, why, what else was on the table and what it costs. Records are never rewritten: a decision that changes gets a new record that supersedes the old one.

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-isr-without-cdn.md) | Cache pages with Nitro ISR, without a CDN | Accepted | 2026-09-02 |
| [0002](0002-first-party-umami-proxy.md) | Serve Umami analytics first-party through a Nitro proxy | Accepted | 2026-09-30 |
| [0003](0003-session-in-httponly-cookie.md) | Keep the Strapi JWT in an httpOnly cookie behind a server-side BFF | Accepted | 2026-09-30 |
| [0004](0004-hash-based-csp.md) | Build the Content Security Policy from hashes of the rendered HTML | Accepted | 2026-10-02 |
| [0005](0005-theme-contract.md) | Theme contract v1: plain CSS, semantic roles, layout variants, public hooks, theme-declared modes and bounded overrides | Accepted | 2026-10-03 |
| [0006](0006-site-modes.md) | Site modes (dynamic, static, landing), pages without the Vue runtime and heavy islands | Accepted | 2026-10-04 |
| [0007](0007-license.md) | License under AGPL-3.0-only, with a theme exception, third-party material outside it, and DCO | Accepted | 2026-10-06 |
| [0008](0008-theme-registry.md) | Theme registry: versioned theme packages outside the core, pinned by a lockfile, admitted by the theme checks | Accepted | 2026-10-07 |
| [0009](0009-theme-delivery-at-runtime.md) | Theme delivery at runtime: a theme store keyed by digest, served under `/_t/<digest>/`, data-only themes activated from Strapi without a rebuild, code themes only on an image built with them | Accepted | 2026-10-19 |
| [0010](0010-semantic-versioning.md) | Semantic versioning and one release line for `micelio` and `micelio-cms`, with `latest` as the newest stable release and `edge` as `main` | Accepted | 2026-10-09 |
| [0011](0011-refuse-plain-http-upstreams.md) | Refuse plain http towards the CMS and Umami outside a private network | Accepted | 2026-10-14 |
| [0012](0012-static-cms-credentials.md) | Accept static credentials towards the CMS, with a rotation policy | Accepted | 2026-10-14 |
| [0013](0013-cms-hardening-operator-changes.md) | Record the operator-facing changes of the CMS hardening | Accepted | 2026-10-14 |
| [0014](0014-cms-hardening-second-batch.md) | Record the second batch of operator-facing CMS changes | Accepted | 2026-10-14 |
| [0015](0015-problem-details.md) | Errors as RFC 9457 problem details | Accepted | 2026-10-15 |
| [0016](0016-categories-from-the-cms.md) | Categories come from the CMS: data instead of constants, a stable optional color, `featured`, and theme contract 2 | Accepted | 2026-10-18 |
| [0017](0017-distribution-plugins-multisite-editorial.md) | Micelio as Strapi plugins with `micelio-cms` as the reference distribution, several sites per CMS, and an editorial workflow of its own | Accepted | 2026-10-20 |
| [0018](0018-blocks-as-a-contract.md) | Blocks as a contract: `{ id, schema, options, cost, static }`, options from the theme contract, a generated catalogue checked for drift, and no free positioning, per-element CSS, inline styles or raw HTML | Accepted | 2026-10-21 |

## Writing a new record

Copy the structure of an existing record into `NNNN-short-title.md` with the next number: Context, Decision, Options considered, Trade-offs, Consequences. Add it to the table above. Status is `Proposed` until it is merged, then `Accepted`; when it is replaced, mark it `Superseded by NNNN`.
