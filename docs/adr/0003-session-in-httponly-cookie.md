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
