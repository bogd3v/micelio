# ADR-0004: Build the Content Security Policy from hashes of the rendered HTML

**Status:** Accepted
**Date:** 2026-10-02
**Deciders:** BogDev maintainer

## Context

The site sent no security headers. Articles render rich text from Strapi into HTML, sanitized with `sanitize-html`; a Content Security Policy is the second line of defence if sanitizing ever misses something. Every page has three executable inline scripts: the theme script that avoids a flash of the wrong theme, Nuxt's `importmap` and `window.__NUXT__.config`. The importmap changes with every build and the config with every environment. Pages are cached with ISR ([ADR-0001](0001-isr-without-cdn.md)), so per-request values cannot appear in cached HTML.

## Decision

A Nitro plugin (`server/plugins/contentSecurityPolicy.ts`) hooks `render:html`, takes the SHA-256 of every executable inline script in the final HTML and sends a policy whose `script-src` is `'self'` plus those hashes, without `'unsafe-inline'`. The header is cached together with the HTML, so it always matches it. Images are limited to the site, Strapi and the media host; frames to YouTube and Vimeo, the same players the sanitizer allows; `frame-ancestors`, `object-src`, `base-uri` and `form-action` are locked down. `style-src` keeps `'unsafe-inline'` for Vue style bindings and Mermaid. Fixed headers (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP) go on every response through a route rule. The policy applies in production only.

## Options considered

### A. Hashes computed from the rendered HTML (chosen)
| Dimension | Assessment |
| --- | --- |
| Complexity | Low: one hook and a pure helper |
| Strength | No inline script runs unless it is exactly one of the page's own |
| Caching | Compatible with ISR: header and HTML are cached together |
| Maintenance | None when scripts change between builds or environments |

### B. Nonces
**Pros:** the standard strict CSP. **Cons:** a nonce must change per response, which a cached page cannot do; it would mean giving up ISR.

### C. `script-src 'self' 'unsafe-inline'`
**Pros:** trivial. **Cons:** allows any injected inline script, which is the main thing a CSP is for.

### D. Hashes fixed at build time in `nuxt.config.ts`
**Pros:** a static header. **Cons:** `window.__NUXT__.config` depends on runtime environment variables, so the hash is unknown at build time and would break whenever the configuration changes.

## Trade-offs

Inline styles stay allowed: blocking them would break Vue bindings and Mermaid diagrams, and style injection is far less dangerous than script injection. The policy is not applied in development, where Vite injects its own scripts, so CSP problems only show in production builds.

## Consequences

- A new image, embed or script domain must be added in `contentSecurityPolicy()` and, for embeds, in the `sanitize-html` options together ([security.md](../security.md)).
- Integration tests check that the hashes in the header match the inline scripts of each page, also when the page is served from the ISR cache.
- Verify a change to the policy in a production build in a browser, listening for `securitypolicyviolation`.

**Amendment (2026-10-07, #244):** `media-src` is `'self'` plus the origins of `img-src` (Strapi and the media host), so the `<video>` of a page section can play uploaded files; videos never autoplay. Page media is limited to `/uploads/` paths and those origins on both the server schema and the frontend.

**Amendment (2026-10-07, #243): static builds.** A static site has no response to attach a header to, so the policy is built once, at prerender, by the same `contentSecurityPolicy()`. `modules/static-routes.ts` hashes the executable inline scripts of every generated page (`inlineScripts()`, so `application/ld+json` data blocks do not count, as in the dynamic plugin) and fails the build, naming the pages, if they differ; with `noScripts` it is the theme init script on all of them. The result is one `/*` rule in `_headers` (Cloudflare Pages, Netlify) with the policy and `SECURITY_HEADERS`, and the same policy in a `<meta http-equiv>` on each page for hosts without `_headers`, without `frame-ancestors` (a meta cannot carry it; `report-uri` and `sandbox` are not used). Image and media origins are empty: `_ipx/` and `_media/` are same-origin. Limits: a host that ignores `_headers` gets no `frame-ancestors`, no `X-Frame-Options` and no HSTS; an inline `onerror` is removed from the HTML (the hash CSP blocks inline handlers). `_headers` is checked against Cloudflare Pages' limits (100 rules, 2000 characters per line) and a page without `<head>` fails the build.

For the next static PRs (not implemented): PR 6 (Pagefind) needs WebAssembly, so static builds add `'wasm-unsafe-eval'` to `script-src` site-wide (`_headers` has one rule) through a new option of `contentSecurityPolicy()` that is off by default, in the single `/*` policy and in the meta; the Pagefind loader is a `'self'` file and `/pagefind/*` is not immutable (its index changes per build). PR 7 (forms) adds a `formOrigins` option for `form-action`, in the header and the meta: origins only (no paths) and including the origins the provider redirects to.
