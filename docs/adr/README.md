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
| [0007](0007-license.md) | License under AGPL-3.0-only, with a theme exception, third-party material outside it, and DCO | Proposed | 2026-10-06 |

## Writing a new record

Copy the structure of an existing record into `NNNN-short-title.md` with the next number: Context, Decision, Options considered, Trade-offs, Consequences. Add it to the table above. Status is `Proposed` until it is merged, then `Accepted`; when it is replaced, mark it `Superseded by NNNN`.
