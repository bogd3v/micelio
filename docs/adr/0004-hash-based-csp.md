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

**Amendment (2026-10-07, #243, PR 6): search.** Pagefind runs WebAssembly, so static builds add `'wasm-unsafe-eval'` to `script-src` on every page (`_headers` has one rule, and the meta) through the `wasmEval` option of `contentSecurityPolicy()`, off by default: the dynamic policy is byte-identical. It allows compiling WebAssembly, not `eval()` or `new Function()`. The island that loads Pagefind is a `'self'` file (`/_islands/search-<hash>.js`, then `/pagefind/pagefind.js` and its worker), never an inline script, so the script hashes do not change. `/_islands/*` is immutable (hashed names); `/pagefind/*` is revalidated, because its entry files keep their names across builds.

**Amendment (2026-10-07, #243, PR 7): `formOrigins`.** `contentSecurityPolicy()` takes `formOrigins` (default none, so the dynamic policy is byte-identical) and adds those origins to `form-action` after `'self'`, in the static `_headers` and in the meta. Values go through `cspOrigin()`: `URL.canParse`, then protocol, host and port only; a host with anything outside letters, digits, hyphens and dots (`*`, `;`, `%`, spaces) is dropped and a trailing dot is removed, so a value cannot add a wildcard or a directive. `imageOrigins` goes through it too. The static newsletter uses the origin of `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` (`formActionOrigin()` in `app/helpers/newsletterForm.ts`; the action must be `https:`, or `http:` on localhost for tests). Chrome checks `form-action` on the redirects after the post too, so the provider's redirect must stay on that origin or land on this site (`'self'`); Buttondown's error pages are on `buttondown.com`, but where a success redirect lands (a custom newsletter domain, for one) is unverified and must be checked with a real subscription on a preview deploy. This PR adds no variable for redirect origins: a provider that redirects elsewhere needs one (not done until a real case exists).

**Amendment (2026-10-07, #247, design only; implemented in the worker runner PR): worker containment.** A runner that executes the reader's code (SQL, Python, JavaScript) lives in a dedicated Worker script under `/_islands/workers/`, and the response that serves it carries its own policy, `WORKER_POLICY`: `default-src 'none'`, `connect-src` limited to `/_islands/runtimes/` (where the self-hosted runtimes are fetched from), `script-src 'self' 'wasm-unsafe-eval'` and no `frame-ancestors` relaxation. A worker script's CSP comes from its own response, not from the page, so the page's policy stays as it is. In `dynamic` the header is set by a `routeRules` entry for `/_islands/workers/**`; in `static` by a rule in the generated `_headers` file (`headersFile`), which has the same shape as the `/*` rule and counts against the same Cloudflare Pages limits. The worker deletes the network globals (`fetch`, `XMLHttpRequest`, `WebSocket`, `importScripts` after loading) once its runtime is loaded, so the policy is the second layer, not the first. Pages that contain a playground get `worker-src 'self'` and `'wasm-unsafe-eval'` from the island registry's `csp` (ADR 0006 amendment); pages without one keep today's policy.

**Why not a sandboxed iframe.** `<iframe sandbox="allow-scripts">` gets an opaque origin, and a Worker cannot be started from an opaque origin against a same-origin script, so the code would run on the iframe's main thread; an infinite loop then freezes the iframe's event loop and, in browsers that share a process, the page (a Worker can be `terminate()`d, an iframe cannot be interrupted). It would also need `frame-src`/`child-src` and a `postMessage` bridge with origin checks, and another document per playground. The Worker plus `WORKER_POLICY` gives the same isolation from the DOM and cookies (a Worker has neither) with a hard stop.

