# ADR-0001: Cache pages with Nitro ISR, without a CDN

**Status:** Accepted
**Date:** 2026-09-02 (recorded 2026-10-02)
**Deciders:** BogDev maintainer

## Context

The site runs as a single Nitro `node-server` container on a Hetzner VPS behind Traefik (Dokploy). Cloudflare is used for DNS only (grey cloud) so Traefik can issue certificates and the backend can serve ActivityPub. Every public page needs content from Strapi, which runs on the same server; rendering each request against Strapi would tie page latency and Strapi load to traffic.

Earlier the project carried Vercel-specific cache headers (`CDN-Cache-Control`, `Vercel-CDN-Cache-Control`) that did nothing on this deployment and caused confusion between two caching layers (#20).

## Decision

Public pages use Nitro route rules with `isr` (300 s for the home, blog and articles, 3600 s for About and Privacy). Nitro renders a page once, stores it in its storage cache and revalidates it after the TTL; the HTML embeds the `useAsyncData` payload, so a cached page triggers no Strapi call. API routes send `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` only defensively, for a shared cache that may be added later. Private pages (account, drafts, newsletter) are `private, no-store`.

## Options considered

### A. Nitro ISR in the container (chosen)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low: route rules only |
| Cost | None |
| Scalability | Enough for a personal blog on one instance; the cache lives in the container |
| Fit | Works with Traefik and DNS-only Cloudflare |

### B. Cloudflare proxy (orange cloud) as CDN
**Pros:** edge caching, absorbs traffic spikes. **Cons:** conflicts with Traefik's certificates and ActivityPub on the backend; cache purging becomes another moving part.

### C. Render every request (SSR without cache)
**Pros:** always fresh. **Cons:** every visit hits Strapi; slower pages and more load for no benefit on content that changes a few times a week.

### D. Static generation (`nuxt generate`)
**Pros:** cheapest to serve. **Cons:** comments, search, accounts, drafts and the newsletter need a server anyway; every publish would need a rebuild.

## Trade-offs

Content appears up to five minutes after publishing in Strapi, in exchange for pages that do not depend on Strapi's latency. The cache is per container and is lost on redeploy, which only costs one render per page.

## Consequences

- A page must never embed per-user data during SSR: the session plugin only loads the user when the session cookie is present, so cached pages never contain one (see [ADR-0003](0003-session-in-httponly-cookie.md)).
- Response headers set while rendering (the CSP of [ADR-0004](0004-hash-based-csp.md)) are cached with the HTML and must stay valid for it.
- Running more than one instance would mean separate caches; revisit with a shared storage driver or a CDN at that point.

## Amendments

- 2026-10-07: section pages (`app/pages/[slug].vue`, #244) have no `routeRules` entry. A `/**` rule would also match `/api` and the private pages, and the slugs are chosen in the CMS, so they cannot be listed. They are server-rendered per request; `/api/pages/:slug` is cached in Nitro (5 min), so the cost is a render, not a Strapi call.
