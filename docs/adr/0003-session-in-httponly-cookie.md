# ADR-0003: Keep the Strapi JWT in an httpOnly cookie behind a server-side BFF

**Status:** Accepted
**Date:** 2026-09-30 (recorded 2026-10-02)
**Deciders:** BogDev maintainer

## Context

Readers can create accounts and editors preview drafts. Strapi's users-permissions plugin authenticates with a JWT. Handing that token to the browser (for example in `localStorage`) lets any injected script read it, and makes every page that knows about the user harder to cache. Pages are cached with ISR ([ADR-0001](0001-isr-without-cdn.md)), so nothing user-specific may end up in shared HTML.

## Decision

The browser never talks to Strapi. Nuxt server routes under `/api/auth/*` act as a backend-for-frontend: they call users-permissions, keep the JWT only in the `bd_session` cookie (`httpOnly`, `Secure`, `SameSite=Lax`, 7 days) and return a public view of the user. State-changing routes check the `Origin` header, every auth response is `private, no-store`, and Strapi errors become codes the client translates. The session is loaded during SSR only when the cookie is present. Drafts are fetched with the editor's own JWT, never with the site's API token.

## Options considered

### A. httpOnly cookie behind a Nuxt BFF (chosen)
| Dimension | Assessment |
| --- | --- |
| Complexity | Medium: a server route per auth action |
| Security | Token unreachable from JavaScript; one origin for the browser |
| Caching | Public pages stay cacheable; private ones are `no-store` |
| Fit | Reuses the server routes that already proxy Strapi content |

### B. JWT in `localStorage`, browser calls Strapi
**Pros:** least server code. **Cons:** any XSS can steal the token; CORS on Strapi; the token would also be needed during SSR.

### C. Separate session store (opaque session id, JWT kept server-side)
**Pros:** revocable sessions, token never leaves the server. **Cons:** needs a shared store (Redis or a database) for a single small site.

### D. An external identity provider
**Pros:** MFA, social login. **Cons:** another service and its privacy terms, for a blog whose accounts only comment and preview drafts.

## Trade-offs

The cookie protects the token from scripts but not from cross-site requests, so every state change needs the `Origin` check and `SameSite=Lax`. A session cannot be revoked server-side before the JWT expires, which is acceptable for seven-day sessions with no payment or personal data beyond the account.

## Consequences

- Every new state-changing route must call `assertSameOrigin()` and `preventCaching()`.
- The e2e suite checks that the JWT never reaches page JavaScript.
- Strapi only needs to be reachable from the frontend server, not from browsers.

**Amendment (2026-10-08, #416):** the session cookie is `micelio_session`, with the same attributes (`httpOnly`, `Secure`, `SameSite=Lax`, 7 days). For one release line the server reads `micelio_session` and falls back to `bd_session`; a request that carries only the old cookie gets the session re-issued under the new name and the old cookie cleared, so nobody is signed out. The old name is never written again, and the fallback is removed in the next release line, after every `bd_session` has expired. The reason is in ADR-0005 (amendment of the same date): the core carries no site's prefix.

**Amendment (2026-10-14, #492): the `__Host-` prefix.** The session cookie is `__Host-micelio_session` (ASVS V3.3.1 and V3.3.3). The prefix makes the browser refuse the cookie unless it is `Secure`, has `Path=/` and no `Domain`, so a sibling subdomain, or a plain-HTTP response, cannot set or overwrite it; the attributes the cookie already had meet that, so nothing else changes. The cookie name is a visitor-facing identifier (standard, section 6), so the rename is not abrupt: for one release line the server also reads `micelio_session` (the name of the release before) and `bd_session`, and a request that carries only an old cookie gets the session re-issued as `__Host-micelio_session` with the old cookie cleared (`server/middleware/session-rename.ts`), so nobody is signed out. The old names are never written again, and logout and account deletion clear all three. The fallback is removed in the next release line (TODO(#422)); until then, a cookie set under an old name by a sibling subdomain would be adopted once, which is the weakness the prefix closes for every session issued from now on. A deployment behind a plain-HTTP front end cannot keep the cookie: the browser drops a `Secure` cookie there, as it already did.

**Amendment (2026-10-14, #491): no second factor, and the controls that stand in for it.** ASVS V6.3.3 asks for multi-factor authentication or a documented rationale with a set of mitigating controls for relaxing it. The site stays on a password alone. Reasons: the accounts only comment, subscribe and (editors) preview drafts; Strapi's users-permissions has no second factor, so building one is a project in the CMS; and the external identity provider that would bring it is option D, rejected above. Controls that make a password alone acceptable here: a confirmed email before the first sign-in; a password of at least 10 characters in the frontend; rate limits on every authentication route (per client, per login identifier across all addresses, and per email address for the emails the routes send); the same answer from forgot-password whether or not the address has an account; a session cookie that scripts cannot read, is `__Host-` prefixed and is checked against the `Origin` on every state change; a seven-day lifetime; and the Editor role given by hand by an administrator. Revisit it when the accounts hold more than an email and a username, when editors can change content, or when the CMS offers a second factor. Sessions and authentication pathways are documented in `docs/security.md`, "Authentication and sessions".

**Amendment (2026-10-19, #422):** the fallbacks to `micelio_session` and `bd_session` and the middleware that re-issued them (`server/middleware/session-rename.ts`) were removed in the next release. The server reads and clears only `__Host-micelio_session`; anyone still holding an old cookie signs in again.
