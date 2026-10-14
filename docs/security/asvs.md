# ASVS verification

How the Micelio frontend measures up against the [OWASP Application Security Verification Standard](https://github.com/OWASP/ASVS/tree/v5.0.0), **version 5.0.0**. This is the reference of every security review, as section 9 of the [engineering standard](../engineering-standard.md) says: level 2 for authentication, sessions, access control and input handling (chapters V1, V2, V6, V7 and V8), level 1 for the rest. The security reviewer ([`.claude/agents/security.md`](../../.claude/agents/security.md)) reports findings against the ids below.

The mapping covers every level 1 and level 2 requirement of the 17 chapters, so that a reader can tell what was verified and what was never looked at. Level 3 is out of scope. Requirements are named by id and paraphrased, never quoted: the ASVS text is licensed under CC BY-SA 4.0 and stays at its source.

- **Snapshot:** `bogd3v/micelio` at commit `24cb86f` and `micelio-cms` at `b719851` (Strapi 5.56.0), read on 2026-10-13. Findings come from reading the code and the tests, plus the runs listed next; nothing was run against a deployment.
- **Scope:** this repository. What the CMS enforces is mapped in `bogd3v/micelio-cms#128`; a row points there when the control lives on that side. TLS, egress rules, secret storage and the reverse proxy belong to the operator.
- **Runs:** rows that say "local probe" were checked against an existing production build (`.output`, Nuxt 4.5.2, built on 2026-10-10 from a commit before `24cb86f` that differs only in lint and doc comments) started on localhost with a stand-in CMS; the redirect loop of V1.1.1 was reproduced by calling its helpers; V15.2.1 comes from `npm audit` on 2026-10-13. Everything else was read.
- **Test column:** a row cites the test that covers it, or says "no test". Test references were located by reading, not by running the suites.

## How to read it

| Status | Meaning |
| --- | --- |
| Met | Enforced here, with the file, ADR and test that show it. A row may say it is an accepted risk and name the ADR |
| N/A | Does not apply to a frontend like this one, with the reason |
| Open | Not met or not verifiable at the level this chapter aims at (see Target below). The row names the issue (label `security`) that tracks it, or says "Private advisory". An open gap that an attacker could exploit is always Open, at any level |
| Open (above target) | Not met, and the requirement is of a higher level than the chapter's target: it is an improvement, tracked in an issue, and it does not fail the level the standard asks for |

An open requirement that an attacker could exploit is **not** described here or in a public issue: it is reported through a private security advisory, as [`SECURITY.md`](../../SECURITY.md) says, and its row says only "Private advisory". Open items that are not exploitable are grouped in five issues:

- #491: Password rules and session lifetime
- #492: Browser headers, session cookie and HTTP details
- #493: Input, output encoding and response shape
- #494: Security logging and log content
- #495: Keys, transport, data classification and supply chain

## Totals

| Chapter | Target | Met | N/A | Open | Open (above target) |
| --- | --- | --- | --- | --- | --- |
| V1 Encoding and Sanitization | L2 | 17 | 9 | 1 | 0 |
| V2 Validation and Business Logic | L2 | 10 | 1 | 0 | 0 |
| V3 Web Frontend Security | L1 | 17 | 2 | 0 | 0 |
| V4 API and Web Service | L1 | 2 | 8 | 0 | 0 |
| V5 File Handling | L1 | 2 | 7 | 0 | 0 |
| V6 Authentication | L2 | 15 | 14 | 6 | 0 |
| V7 Session Management | L2 | 10 | 5 | 3 | 0 |
| V8 Authorization | L2 | 6 | 1 | 0 | 0 |
| V9 Self-contained Tokens | L1 | 0 | 5 | 0 | 2 |
| V10 OAuth and OIDC | L1 | 1 | 28 | 0 | 0 |
| V11 Cryptography | L1 | 5 | 6 | 0 | 3 |
| V12 Secure Communication | L1 | 1 | 6 | 0 | 2 |
| V13 Configuration | L1 | 10 | 2 | 0 | 1 |
| V14 Data Protection | L1 | 5 | 0 | 1 | 3 |
| V15 Secure Coding and Architecture | L1 | 12 | 0 | 0 | 1 |
| V16 Security Logging and Error Handling | L1 | 11 | 3 | 0 | 2 |
| V17 WebRTC | L1 | 0 | 7 | 0 | 0 |
| **Total (253 requirements)** | | **124** | **104** | **11** | **14** |

**Target level.** Section 9 of the standard asks for level 2 in V1, V2, V6, V7 and V8 and level 1 in the other chapters, so a level 2 requirement of a level 1 chapter is above the target. Of the 27 requirements that are not met, **12 are at the target level** (1 of them tracked in private security advisories) and 15 are above it. A requirement that holds a level 1 part and a level 2 clause (V3.4.1) is judged at the chapter's target, and the row says what the higher clause asks.

## Keeping it true

- A pull request that changes what a row cites (a route, a header, a schema, a test) updates the row in the same change.
- A security review cites ids from this document and, after it, updates the rows it changed and the totals. A newer ASVS version is adopted in its own pull request that remaps every row.
- A fix for an open row changes its status to Met with the evidence, closes the issue and updates the totals.

## V1 Encoding and Sanitization

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V1.1.1 | Decode input to canonical form exactly once, then validate | Met | The tag or category segment of a blog list path is decoded once before `blogPath` encodes it, and a path is left alone whether the server hands it over encoded or decoded (`app/helpers/blog.ts`, `legacyBlogRedirect`). Test: `test/blog.test.ts` (`legacyBlogRedirect`), `e2e/blog.spec.ts` ("does not redirect a tag whose name has an encoded character") |
| V1.1.2 | Encode output last, for the interpreter that consumes it | Met | Vue text interpolation escapes at render; Markdown HTML is sanitized after rendering, as the last step before it leaves the API (`app/helpers/markdown.ts:169`, `:179`); feed text escaped at output (`server/utils/feed.ts:84-85`). Test: `test/markdown.test.ts:52` |
| V1.2.1 | Context-correct output encoding for HTTP, HTML and XML | Met | Every CMS value written into the feed and the sitemap (slugs, cover URL, locale, channel links) goes through `escapeXml` (`app/helpers/xml.ts`, `server/utils/feed.ts`, `server/routes/sitemap.xml.ts`); text uses CDATA with the end marker split. Test: `test/xml.test.ts`, `test/integration/api.test.ts` ("XML output of CMS values") |
| V1.2.2 | Encode untrusted data by context when building URLs | Met | `resolveLink` and `resolveSectionLink` pass only `http(s)`, `mailto:`, site paths and in-page anchors, and refuse other schemes, `//host`, and control characters or spaces (`app/helpers/links.ts`); `LinkButton` and the contact block's links and socials render nothing for a refused URL. Paths are encoded elsewhere (`server/api/drafts/[documentId].get.ts:25`) and queries built with `qs.stringify`. Test: `test/links.test.ts`, `test/nuxt/LinkRendering.test.ts` |
| V1.2.3 | Escape data when building JavaScript or JSON content | Met | JSON-LD and island declarations are `JSON.stringify` output; unhead rewrites `</script` in script content, and island JSON also escapes `<` (`app/helpers/islands.ts:46`). Test: `test/islands.test.ts:52` |
| V1.2.4 | Parameterized or protected database queries | Met | No database in the frontend; CMS filters are built as structured `$eq` objects with `qs.stringify`, never concatenated (`server/api/posts/[slug].get.ts:15-19`, `server/utils/subscribers.ts:20-23`). Query handling itself is in micelio-cms, see micelio-cms#128. No test |
| V1.2.5 | Protect against OS command injection | N/A | No such feature: no process is spawned at runtime (no `child_process` in `server/`, `app/`) |
| V1.2.6–V1.2.8 | Protect against LDAP, XPath and LaTeX injection | N/A | No such feature: no LDAP, XPath or LaTeX processing |
| V1.2.9 | Escape special characters placed into regular expressions | Met | Every dynamic `RegExp` is built from constants or known locale codes, never from request data (`app/helpers/blog.ts:103-104`, `app/composables/useLocaleUtils.ts:47`). No test |
| V1.3.1 | Sanitize untrusted rich HTML with a proven library | Met | `sanitize-html` with an allowlist of tags, attributes, schemes and iframe hosts, on the server (`app/helpers/markdown.ts:26-60`, `:169`, `:179`); `v-html` only renders that output. Test: `test/markdown.test.ts:52`, `:65` |
| V1.3.2 | Avoid eval and dynamic code execution | Met | No `eval` or `new Function` in `app/` or `server/`; `script-src` has no `'unsafe-eval'` (`app/helpers/securityHeaders.ts:101`); reader code runs in a Worker under its own policy (`docs/security.md:110-112`). Test: `test/securityHeaders.test.ts:64`, `e2e/playground/playground.spec.ts:197` |
| V1.3.3 | Sanitize data before dangerous contexts | Open | Private advisory |
| V1.3.4 | Sanitize user-supplied scriptable SVG | Met | Mermaid renders with `securityLevel: 'strict'` (`app/islands/mermaid.ts:55`); copied media and theme images are served with a sandbox CSP, so an SVG opened directly runs nothing (`docs/security.md:109`, `:133`). Test: `e2e/static/headers.spec.ts:83`, `test/integration/api.test.ts:924` |
| V1.3.5 | Sanitize or disable scriptable Markdown, CSS and template content | Met | Markdown sanitized as V1.3.1; CMS theme CSS rebuilt from validated values and checked against a fixed grammar (`server/utils/displayFonts.ts:66`, `docs/security.md:132`). Test: `test/markdown.test.ts:52`, `test/displayFonts.test.ts:109`, `test/themeOverrides.test.ts:84` |
| V1.3.6 | Protect against SSRF with destination allowlists | Met | Server calls go only to the configured CMS base (`server/lib/strapiRequest.ts:16-18`); path parameters are pattern-checked or encoded (`server/api/fediverse/stats/[documentId].get.ts:3`, `server/api/drafts/[documentId].get.ts:25`); the Umami proxy forwards two exact paths only (`app/helpers/analytics.ts:39-42`, `server/middleware/umami.ts:25`). Test: `test/strapiRequest.test.ts:56`, `test/analytics.test.ts:26` |
| V1.3.7 | Never build templates from untrusted input | Met | Vue templates are compiled at build and locale messages precompiled (`modules/`); CMS text only fills bindings, never templates. Test: `test/precompileMessages.test.ts` |
| V1.3.8 | Sanitize JNDI input and disable unsafe JNDI | N/A | No such feature: not a Java application |
| V1.3.9 | Sanitize content before sending to memcache | N/A | No such feature: no memcache; Nitro cache keys are built from validated locale and slug |
| V1.3.10 | Sanitize format strings before processing | Met | Log calls use a constant first argument, with data as further arguments (`server/api/comments/index.post.ts:32`, `server/api/newsletter/subscribe.post.ts:47`); no printf-style formatting of input. No test |
| V1.3.11 | Sanitize input passed to mail systems | Met | The frontend sends mail only to the address of a newsletter subscription, validated and normalised (`server/schemas/`), with fixed text; the CMS no longer emails comment authors on replies, so no guest text or address reaches a mail system (micelio-cms `src/extensions/comments/strapi-server.ts`, GHSA-64hp-rrrq-q2hh; mapped in micelio-cms#128). Test: micelio-cms `tests/comments-api.test.ts` |
| V1.4.1 | Use memory-safe strings and buffer handling | N/A | Memory-safe runtime (TypeScript on Node.js); no native code of our own |
| V1.4.2 | Prevent integer overflow with range validation | Met | Pagination integers are digit-only and capped at `Number.MAX_SAFE_INTEGER`, page size clamped to 50 (`server/schemas/query.ts:30-35`, `:53`). Test: `test/schemas.test.ts:112` (digits only); no test for the cap |
| V1.4.3 | Release memory and clear dangling references | N/A | Memory-safe, garbage-collected runtime; no manual allocation |
| V1.5.1 | Restrict XML parsers, disable external entities | N/A | No such feature: XML is generated, never parsed |
| V1.5.2 | Deserialize untrusted data safely with type allowlists | Met | Only `JSON.parse`, followed by a shape check or a zod schema (`app/helpers/islands.ts:50-57`, `app/helpers/readArticles.ts:29`, `server/utils/validation.ts:10-20`); no object revivers or class instantiation. Test: `test/islands.test.ts:55`, `test/readArticles.test.ts` |

## V2 Validation and Business Logic

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V2.1.1 | Document validation rules for each data item | Met | The rules are documented per endpoint (`docs/security.md:47-64`, `docs/api.md`) and the post route enforces its slug with `postParamsSchema` before any CMS call (`server/schemas/query.ts`, `server/api/posts/[slug].get.ts`); the value then reaches the CMS only as an `$eq` filter. Test: `test/schemas.test.ts` (`postParamsSchema`), `test/integration/api.test.ts` ("refuses a slug that is not a Strapi uid") |
| V2.1.2 | Document consistency rules for combined data items | Met | `docs/api.md:34` (post lists: the category wins over the tag; at most four lists per page), `docs/api.md:137` (blog filters: the category wins, other parameters kept). No test |
| V2.1.3 | Document business limits, per user and global | Met | `docs/security.md:53-66` (page sizes, search text, per-visitor and per-address limits, in-memory scope), `docs/api.md:66`; CMS limits in micelio-cms `docs/RATE_LIMITING.md`, see micelio-cms#128. No test |
| V2.2.1 | Validate input against business expectations | Met | Sizes and shapes are bounded: a body is read within 64 KB and answers 413 before any route logic (`server/utils/validation.ts:5`, `:21`, `:45`; test `test/integration/api.test.ts:531`), a new password is at most 72 bytes, an email, identifier or username at most 254 characters and a reset code letters, digits, `_` and `-` (`server/schemas/auth.ts:6-20`, `:56`; GHSA-xjjv-c6cr-w4p6). A comment is built for the public from a list of fields, so a reply carries its parent as `{ id }` and no email or reports (`app/helpers/comments.ts:46`; GHSA-vjh3-x6fv-9mfr). Tests: `test/comments.test.ts:31`, `test/integration/api.test.ts:1178` |
| V2.2.2 | Enforce validation at a trusted server layer | Met | Every body and query goes through a zod schema on the server before any CMS call (`server/schemas/`, `server/utils/validation.ts:10-37`); the client forms share the validators of `app/helpers/`. Test: `test/schemas.test.ts`, `test/integration/api.test.ts` |
| V2.2.3 | Check that related data items are mutually consistent | Met | A valid category drops the tag (`app/helpers/blog.ts:131-133`); a comment must name an article relation of the expected form (`server/utils/commentRelation.ts:10-16`); the thread a reply belongs to is checked by the CMS comments plugin, see micelio-cms#128. Test: `test/blog.test.ts:106`, `test/comments.test.ts:88` |
| V2.3.1 | Run business flows in order without skipping steps | Met | A subscription becomes confirmed only through the emailed token (`server/api/newsletter/confirm.post.ts`); a confirmed address is never reset by a new subscribe (`server/api/newsletter/subscribe.post.ts:29`); account steps are enforced by the CMS, see micelio-cms#128. Test: `test/integration/api.test.ts:1229`, `:1288-1306` |
| V2.3.2 | Implement the documented business limits | Met | The frontend limits of `docs/security.md:66` are the buckets of `server/utils/rateLimit.ts:12-14`, enforced by `assertRateLimit` (`:64`); page size clamped (`server/schemas/query.ts:53`). Test: `test/rateLimit.test.ts`, `test/integration/api.test.ts:1270` |
| V2.3.3 | Make business operations all-or-nothing, rolling back on failure | Met | A subscribe whose confirmation email cannot be sent deletes the pending record it just created, by the id the CMS returned, before answering the error (`server/api/newsletter/subscribe.post.ts`, `server/utils/subscribers.ts`); a rollback that fails is logged and the next request replaces the pending record. Test: `test/integration/api.test.ts` ("deletes the subscriber it created when the confirmation email cannot be sent") |
| V2.3.4 | Lock limited-quantity resources against double booking | N/A | No such feature: no limited-quantity resources |
| V2.4.1 | Anti-automation against excessive calls to functions | Met | Comments and newsletter limits count an IPv6 network by its /64 (`ipBucket`, `server/lib/clientIp.ts:104`), the in-memory limiter tracks at most 10,000 keys and evicts the oldest first (`app/helpers/rateLimit.ts:25-72`), and a site-wide cap of 100 confirmation emails an hour stops a rotating client (`server/utils/rateLimit.ts:16`); the CMS no longer sends reply emails (GHSA-p9c9-2w7f-67wv, GHSA-64hp-rrrq-q2hh). Tests: `test/rateLimit.test.ts:29-53`, `test/clientIp.test.ts:194`, `test/integration/api.test.ts:1303`, `:2486` |

## V3 Web Frontend Security

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V3.2.1 | Prevent browsers rendering responses in the wrong context | Met | `nosniff` and explicit content types on every response (`app/helpers/securityHeaders.ts:42-49`, applied to `/**` in `nuxt.config.ts:132`); copied media, theme images and fonts carry a sandbox CSP (`docs/security.md:109`, `:133`, `:136`). Test: `test/integration/api.test.ts:924`, `:1750`, `e2e/static/headers.spec.ts:83` |
| V3.2.2 | Render text with safe functions, not as HTML | Met | Vue text interpolation; search results built from text nodes only (`app/islands/search.ts:30`); playground output written with `textContent` (`docs/security.md:111`); `v-html` limited to server-sanitized HTML (V1.3.1). Test: `test/search.test.ts:65` |
| V3.3.1 | Set Secure on cookies, with a `__Secure-` or `__Host-` prefix | Met | The session cookie is `__Host-micelio_session`, `Secure` and `HttpOnly` (`app/constants/auth.ts`, `server/utils/auth.ts`); the older names are read and cleared for one release line and never written (ADR 0003, amendment of 2026-10-14). Test: `test/integration/api.test.ts` ("session cookie rename", sign-in), `e2e/account.spec.ts` |
| V3.3.2 | Set SameSite on each cookie according to its purpose | Met | `SameSite=Lax` on the only cookie, plus an Origin check on state-changing routes (`server/utils/auth.ts:50-57`, `:64`; ADR 0003). Test: `test/integration/api.test.ts:1444`, `:1505` |
| V3.3.3 | Use the `__Host-` prefix unless sharing across hosts | Met | The only cookie the site sets is `__Host-micelio_session`: `Secure`, `Path=/`, no `Domain` (`server/utils/auth.ts`). Test: `test/integration/api.test.ts` (sign-in attributes) |
| V3.3.4 | Set HttpOnly on cookies scripts must not read | Met | `httpOnly: true` on the session cookie (`server/utils/auth.ts:64`, ADR 0003). Test: `test/integration/api.test.ts:1442`, `:1503` |
| V3.4.1 | HSTS on all responses, one year, subdomains included | Met | HSTS is sent on every response with a `max-age` of one year (`app/helpers/securityHeaders.ts:43`), which is the level 1 requirement and the target of this chapter. The level 2 clause, `includeSubDomains`, is not set: it is the operator's decision, because it makes every subdomain HTTPS-only. Test: `test/integration/api.test.ts:1749` |
| V3.4.2 | Fixed or allowlisted CORS `Access-Control-Allow-Origin` | N/A | No such feature: the frontend emits no CORS headers (none in `server/` or `nuxt.config.ts`) |
| V3.4.3 | CSP restricting scripts, with `object-src` and `base-uri` none | Met | Hash-based policy with `object-src 'none'` and `base-uri 'none'` (`app/helpers/securityHeaders.ts`, ADR 0004); the site sends no `<base>` element. Test: `test/securityHeaders.test.ts`, `test/integration/api.test.ts` ("sends no <base> element"), and a probe of a production build with `csp-probe.mjs` (0 problems) |
| V3.4.4 | `X-Content-Type-Options: nosniff` on every response | Met | `app/helpers/securityHeaders.ts:44`, on `/**` (`nuxt.config.ts:132`) and in the static `_headers` (`docs/security.md:109`). Test: `test/integration/api.test.ts:1750` |
| V3.4.5 | Referrer policy preventing leakage to third parties | Met | `strict-origin-when-cross-origin` (`app/helpers/securityHeaders.ts:46`); the scene island fetches with no referrer (`docs/security.md:124`). Test: `test/integration/api.test.ts:1752` |
| V3.4.6 | CSP `frame-ancestors` on every response | Met | Pages carry `frame-ancestors 'none'` in their policy; every other response gets it from a `request` hook (`server/plugins/contentSecurityPolicy.ts`), and the Worker scripts, the theme assets and the sandboxed static files carry it in their own policies (`workerPolicy`, `STATIC_CSP`); `X-Frame-Options: DENY` stays as a fallback. Static hosts get the site policy from `_headers`. Test: `test/integration/api.test.ts` ("tells every response it cannot be framed", the Worker policy), `test/securityHeaders.test.ts`, `e2e/playground/playground.spec.ts` |
| V3.5.1 | Anti-CSRF checks where CORS preflight is not relied on | Met | Same-origin `Origin` check on the comment, subscribe and auth routes (`server/utils/auth.ts:50-57`), `SameSite=Lax`; unsubscribe is reached by the emailed token only (`docs/security.md:59`). Test: `test/integration/api.test.ts:1456` |
| V3.5.2 | Preflight-reliant routes not callable without preflight | N/A | The frontend does not rely on CORS preflight; see V3.5.1 |
| V3.5.3 | Sensitive functions use POST/PUT/PATCH/DELETE, not GET | Met | The newsletter confirmation is `POST /api/newsletter/confirm` with the token in the body and a same-origin check (`server/api/newsletter/confirm.post.ts`); the `/confirm` page shows a button and sends it on the click, so a link scanner or prefetcher that only fetches the link confirms nothing (`app/pages/confirm.vue`). A GET to the route changes nothing. Test: `test/integration/api.test.ts` (`/api/newsletter/confirm`), `test/nuxt/ConfirmPage.test.ts`, `e2e/newsletter-confirm.spec.ts` |
| V3.5.4 | Host separate applications on separate hostnames | Met | The CMS runs on its own host (`NUXT_PUBLIC_STRAPI_URL`, `docs/security.md:7`); Umami is proxied on the site origin on purpose, for two exact paths, without cookies or credentials (ADR 0002, `server/middleware/umami.ts:4-18`). Test: `test/analytics.test.ts:26` |
| V3.5.5 | Discard postMessage messages from untrusted origins or with bad syntax | Met | No window `message` listeners; Worker replies are accepted only for the run in progress, and a second `started` is ignored (`app/islands/lib/workerRunner.ts:130`, `:152-154`). Test: `test/islandsWorkerRunner.test.ts:106`, `:183` |
| V3.7.1 | Use only supported, secure client-side technologies | Met | Plain HTML, CSS and JavaScript for current browsers (Lightning CSS targets in `AGENTS.md`); no plugins, Flash or applets. No test |
| V3.7.2 | Redirect to other hosts only with an allowlist or warning | Met | Post-login redirects accept only one-slash site paths without backslash or control characters (`app/helpers/auth.ts:45-51`); legacy blog redirects stay on the blog path (`app/helpers/blog.ts:118-142`). Test: `test/auth.test.ts:16`, `test/blog.test.ts:92` |

## V4 API and Web Service

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V4.1.1 | Content-Type matching the body, with a charset | Met | `robots.txt` and `sitemap.xml` send `; charset=utf-8` (`server/routes/robots.txt.ts`, `server/routes/sitemap.xml.ts`); the feeds and the JSON routes already had one (`server/utils/feed.ts:140`). Test: `test/integration/api.test.ts` (`/robots.txt`, `/sitemap.xml`) |
| V4.1.2 | Redirect HTTP to HTTPS only on browser-facing endpoints | N/A | Operator/reverse proxy: TLS and the HTTP redirect are terminated in front of Nitro |
| V4.1.3 | Intermediary-set headers cannot be overridden by the client | Met | `assertSameOrigin` reads `X-Forwarded-Host` and `X-Forwarded-Proto` only when `NUXT_TRUST_PROXY` allows it for the socket peer (`trustsForwardedHost()` in `server/lib/clientIp.ts`, `server/utils/auth.ts`), the same rule as the forwarded address (`docs/security.md:70-82`). Test: `test/clientIp.test.ts` (`trustsForwardedHost`), `test/integration/api.test.ts` (same-origin checks behind a private proxy) |
| V4.2.1 | Consistent HTTP message boundary handling across components | N/A | Operator/reverse proxy; Nitro uses the Node.js HTTP parser |
| V4.3.1–V4.3.2 | Limit GraphQL query cost and disable introspection | N/A | No such feature: the frontend has no GraphQL endpoint and calls the CMS REST API only |
| V4.4.1–V4.4.4 | Secure WebSocket transport, origin checks and session tokens | N/A | No such feature: no WebSocket endpoints |

## V5 File Handling

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V5.1.1 | Document allowed upload types, extensions and sizes | N/A | No such feature in the frontend: uploads are handled in micelio-cms, see micelio-cms#128 |
| V5.2.1–V5.2.3 | Limit file size, check extension and content, cap archives | N/A | No such feature in the frontend: uploads are handled in micelio-cms, see micelio-cms#128 |
| V5.3.1 | Never execute stored untrusted files as server code | Met | Media copied by a static build is limited to image, video, audio and checked `.glb` files and served from `/_media/` with a sandbox CSP; theme images and fonts likewise (`modules/static-routes.ts:199-206`, `docs/security.md:109`, `:133`, `:136`). Nothing uploaded is stored by the frontend. Test: `e2e/static/headers.spec.ts:83`, `test/integration/api.test.ts:924` |
| V5.3.2 | Build file paths from trusted data, not user filenames | Met | `/_media/` names are a content hash plus the source name reduced to `[\w.-]` (`app/helpers/staticBuild.ts:136-139`), written under the output folder (`modules/static-routes.ts:203-205`). Test: `test/staticBuild.test.ts:152` |
| V5.4.1 | Validate or ignore user-submitted filenames | N/A | No such feature: no request carries a filename |
| V5.4.2 | Encode file names served in headers or attachments | N/A | No such feature: no `Content-Disposition` or mail attachments |
| V5.4.3 | Scan untrusted files with antivirus before serving | N/A | No such feature in the frontend: uploads are handled in micelio-cms, see micelio-cms#128 |

## V6 Authentication

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V6.1.1 | Document rate limits and anti-automation, including lockout abuse | Met | `docs/security.md:60`, `:66`, `:83` (CMS limits per visitor through the forwarder); micelio-cms `docs/RATE_LIMITING.md:32-54` (groups, per-account limits, lockout abuse accepted at :54). Test: `test/integration/api.test.ts:1462` (CMS 429 translated); micelio-cms `tests/rate-limit.test.ts` |
| V6.1.2 | Document context-specific words banned in passwords | Met | The words (the username, the address before the `@`, the name of the site, and their parts of four characters or more) are documented in `docs/security.md`, "Password rules", and enforced at sign up (`app/helpers/passwordContext.ts`, `server/api/auth/register.post.ts`). Test: `test/passwordContext.test.ts`, `test/integration/api.test.ts` ("holds the username, the email address or the site name") |
| V6.1.3 | Document every authentication pathway and its consistent controls | Met | The pathways and what each enforces are in `docs/security.md`, "Authentication and sessions", with the strength they must hold. The CMS routes that can be called directly are listed there; the one control that is not consistent across them is V6.3.4. Test: no test (documentation) |
| V6.2.1 | Passwords at least 8 characters | Open | The gap is in micelio-cms (see micelio-cms#128). BFF enforces 10 (`server/schemas/auth.ts:5`, `app/helpers/auth.ts:3`, `:21-23`; test `test/auth.test.ts:54`, `test/schemas.test.ts:15`). Direct `POST /api/auth/local/register` on the CMS has no minimum: no `validatePassword` in micelio-cms `config/plugins.ts:78-84`. Tracked in #491 |
| V6.2.2 | Users can change their password | Met | `/account/password` and `POST /api/auth/change-password` (`app/pages/account/password.vue`, `server/api/auth/change-password.post.ts`): a signed-in person changes it with the current password and a new one; the cookie is renewed with the JWT the CMS answers. Test: `test/integration/api.test.ts` ("change password"), `test/nuxt/AccountPasswordPage.test.ts`, `e2e/account.spec.ts` |
| V6.2.3 | Password change asks for current and new password | Met | The route needs `currentPassword`, `password` and `passwordConfirmation`, refuses a new password equal to the current one before calling the CMS, and the CMS checks the current password (`server/schemas/auth.ts`, `server/api/auth/change-password.post.ts`). Test: `test/integration/api.test.ts` ("change password": wrong current password, bad input, no session or origin) |
| V6.2.4 | Check new passwords against top 3000 common passwords | Met | The 3000 most common passwords of at least 10 characters (SecLists, `server/lib/commonPasswords.data.ts`) are refused when registering, resetting and changing the password (`server/lib/commonPasswords.ts`, `server/utils/passwordRules.ts`, the routes `register.post.ts`, `reset-password.post.ts` and `change-password.post.ts`). Test: `test/commonPasswords.test.ts`, `test/integration/api.test.ts` ("refuses a common password") |
| V6.2.5 | No character composition rules | Met | `app/helpers/auth.ts:21-23` (length only); the CMS adds none (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `controllers/validation/auth.js:22-29`). Test: `test/auth.test.ts:54` |
| V6.2.6 | Password fields masked, optional reveal | Met | `app/components/account/PasswordField.vue:61` (`type=password`, show/hide toggle). Test: `e2e/account.spec.ts:179-181` |
| V6.2.7 | Paste and password managers allowed | Met | No paste handlers in `app/`; `autocomplete` set: `app/pages/account/sign-in.vue:62`, `:68`, `sign-up.vue:142`, `reset-password.vue:74`, `:84`. No test |
| V6.2.8 | Password verified exactly as entered, no truncation | Open | BFF keeps it as typed (`server/schemas/auth.ts:14-17`; test `test/schemas.test.ts:9`), but the CMS hashes with bcryptjs 2.4.3, which compares only the first 72 bytes at sign-in (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/user.js:4`, `:161-163`); `loginSchema` sets no byte cap. Tracked in #491 |
| V6.2.9 | Passwords of 64 characters or more allowed | Open | CMS refuses passwords over 72 bytes (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `controllers/validation/auth.js:22-29`), so 64 non-ASCII characters can fail; the BFF shows only `invalidInput` (`app/helpers/auth.ts:110`). Tracked in #491 |
| V6.2.10 | No forced periodic password rotation | Met | No password expiry in either repository (`server/api/auth/`, micelio-cms `config/plugins.ts:78-84`). No test |
| V6.2.11 | Context-specific word list enforced at password set | Open | Enforced at sign up and when changing the password (V6.1.2). Not at reset: the route knows the code and the password, not the account, so only the CMS can check it (micelio-cms#177). Tracked in #491 |
| V6.2.12 | Check new passwords against breached password sets | Met | Accepted risk, documented in `docs/security.md`, "Password rules": a breached-password service is a third-party request and a local set of that size is out of proportion; the list of 3000 common passwords (V6.2.4) and the 10-character minimum stand in. Test: no test (documented decision) |
| V6.3.1 | Brute-force and stuffing controls implemented as documented | Met | Per client and per identifier in the CMS (micelio-cms `config/rate-limit.ts:19-23`, `src/constants/rate-limit.ts:64-84`); the BFF forwards the visitor address (`server/utils/strapi.ts:48-57`, `docs/security.md:83`). Tests: micelio-cms `tests/rate-limit.test.ts`, `tests/rate-limit-forwarder.test.ts`; `test/strapiRequest.test.ts:57`, `:64` |
| V6.3.2 | No default accounts present | N/A | The frontend has no accounts of its own; enforced in micelio-cms, see micelio-cms#128: `src/migrations/` seeds roles and permissions only, no users |
| V6.3.3 | Multi-factor or combined authentication required | Met | Single factor by decision, with the rationale and the mitigating controls documented: ADR 0003, amendment of 2026-10-14 (accepted risk). Test: no test (documented decision) |
| V6.3.4 | No undocumented auth pathways; controls consistent | Open | No undocumented pathway is left (`docs/security.md`, "Authentication and sessions"). The controls are not consistent: the 10-character minimum is enforced only by the frontend, and a direct sign-up or `change-password` call on the CMS has none (micelio-cms `config/plugins.ts:78-84`). Tracked in #491 and micelio-cms#177 |
| V6.4.1 | Activation codes random, short-lived, single use | Open | The reset code expires after an hour and works once (micelio-cms `src/extensions/users-permissions/reset-security.ts`, see V6.4.3). The email confirmation token is 20 random bytes and single use but never expires (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/user.js:179`, `controllers/auth.js:605-618`). Tracked in #491 |
| V6.4.2 | No password hints or secret questions | Met | None in `app/pages/account/` or the CMS user model. No test |
| V6.4.3 | Secure forgotten-password reset process | Met | The CMS emails a link with a 64-byte random code, valid for one hour and one use; an expired code answers like a wrong one and is discarded, and a reset ends every earlier JWT (micelio-cms `src/extensions/users-permissions/reset-security.ts`, published advisory GHSA-xfrm-8c63-m3cj). The frontend answers `forgot-password` the same whether or not the account exists, and the code leaves the address bar and the analytics data once the page has read it (`app/composables/useForgetQueryParam.ts`, GHSA-p496-cm7x-29c3). No password hints. Tests: micelio-cms `tests/accounts.test.ts` ("password reset"), `test/nuxt/TokenPages.test.ts:17` |
| V6.4.4 | Lost MFA factor needs identity proofing | N/A | No MFA factor exists |
| V6.5.1–V6.5.5 | MFA lookup secrets, OOB codes and TOTP rules | N/A | No MFA: no lookup secrets, out-of-band codes or TOTP |
| V6.6.1–V6.6.3 | Out-of-band authenticator rules (PSTN, binding, brute force) | N/A | No out-of-band authenticator is offered |
| V6.8.1–V6.8.4 | External identity provider assertions and strength | N/A | No external identity provider: the frontend has none, and users-permissions enables only the `email` provider by default (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/providers-registry.js:24-30`); not verifiable on a running CMS |

## V7 Session Management

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V7.1.1 | Document inactivity timeout and absolute lifetime, justify deviations | Met | Documented in `docs/security.md`, "Authentication and sessions": 7 days absolute, no inactivity timeout, with the reasoning against NIST SP 800-63B. The missing inactivity timeout itself is V7.3.1. Test: no test (documentation) |
| V7.1.2 | Document allowed concurrent sessions per account | Met | Documented in `docs/security.md`, "Authentication and sessions": not limited, each sign-in issues an independent JWT. Test: no test (documentation) |
| V7.1.3 | Document federated session coordination | N/A | No federated identity or SSO |
| V7.2.1 | Session tokens verified by a trusted backend | Met | The BFF never decodes the JWT; every use goes to the CMS, which verifies it: `server/utils/auth.ts:113-115`, `server/utils/drafts.ts:21-25`, `:41-50`. Tests: `test/integration/api.test.ts:1472`, `e2e/drafts.spec.ts:14`, `:21` |
| V7.2.2 | Dynamic session tokens, not static keys | Met | A JWT issued per sign-in is the session (`server/api/auth/login.post.ts:13-26`); the static API token is never a user session (`server/lib/strapiRequest.ts:28`). Test: `test/integration/api.test.ts:1434`, `test/strapiRequest.test.ts:30` |
| V7.2.3 | Reference tokens random with 128-bit entropy | N/A | Self-contained JWTs only; no reference tokens |
| V7.2.4 | New token on authentication; old one terminated | Met | Accepted risk, ADR 0003. New JWT and cookie at each sign-in (`server/api/auth/login.post.ts:13-26`, `server/utils/auth.ts:78-80`); a previous JWT stays valid until expiry (`docs/adr/0003-session-in-httponly-cookie.md`, Trade-offs). Test: `test/integration/api.test.ts:1434` |
| V7.3.1 | Inactivity timeout forces re-authentication | Open | None: the cookie and JWT last 7 days regardless of use (`app/constants/auth.ts:9`, micelio-cms `config/plugins.ts:80`). Tracked in #491 |
| V7.3.2 | Absolute maximum session lifetime enforced | Met | 7 days: cookie `Max-Age` (`app/constants/auth.ts:9`, `server/utils/auth.ts:78-80`) and JWT `exp` (micelio-cms `config/plugins.ts:80`), ADR 0003. Tests: `test/integration/api.test.ts:1440`; micelio-cms `tests/accounts.test.ts:111` |
| V7.4.1 | Terminated sessions cannot be reused | Met | Accepted risk, ADR 0003. Logout clears the cookie (`server/api/auth/logout.post.ts:4`, `server/utils/auth.ts:83-87`); the JWT itself is not revoked before expiry (`docs/adr/0003-session-in-httponly-cookie.md`, Trade-offs). Test: `test/integration/api.test.ts:1483` |
| V7.4.2 | Disabled or deleted accounts lose all sessions | N/A | Enforced in micelio-cms, see micelio-cms#128: the strategy reloads the user on every request and rejects a missing or blocked one (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `strategies/users-permissions.js:30-58`); the BFF then clears the cookie (`server/api/auth/me.get.ts:13-15`) |
| V7.4.3 | Offer ending other sessions after credential change | Met | A password reset or change ends every JWT issued before it, which is more than offering: the CMS rejects a token older than the last password change (micelio-cms `src/extensions/users-permissions/reset-security.ts`, GHSA-xfrm-8c63-m3cj). The token the reset returns keeps working. Test: micelio-cms `tests/accounts.test.ts` |
| V7.4.4 | Visible logout on authenticated pages | Met | Header account menu on every page (`app/components/myc/MycAccountMenu.vue:90`) and profile (`app/pages/account/index.vue:56`). Test: `e2e/account.spec.ts:31` |
| V7.4.5 | Admins can end sessions per user or all | Open | No per-user revocation; only blocking the user or rotating `JWT_SECRET`, neither documented. Tracked in #491 |
| V7.5.1 | Re-authenticate before changing auth-related attributes | N/A | No route changes email or recovery data in a session (`server/api/auth/`); the Authenticated role has no `user.update` (micelio-cms `docs/ACCOUNTS.md:69`). Account deletion does re-check the password (`server/api/auth/me.delete.ts:11-31`) |
| V7.5.2 | Users view and terminate their active sessions | Open | No session list or revoke in the frontend; CMS sessions API exists only in `refresh` mode, not enabled (micelio-cms `config/plugins.ts:78-84`). Tracked in #491 |
| V7.6.1 | RP and IdP session lifetimes behave as documented | N/A | No federated identity or SSO |
| V7.6.2 | Sessions created only by explicit user action | Met | Only sign-in sets the cookie (`server/api/auth/login.post.ts:26`); reset and register do not (`reset-password.post.ts:10-19`, `register.post.ts:11-19`). Test: `test/integration/api.test.ts:1563` |

## V8 Authorization

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V8.1.1 | Document function- and data-level access rules | Met | `docs/security.md:51-64` (access per endpoint), `docs/api.md:125-128`; micelio-cms `docs/ACCOUNTS.md:65-81`. No test (documentation) |
| V8.1.2 | Document field-level read and write rules | Met | `docs/security.md:47`, `:55-56`; `docs/api.md:66-68` (allowed comment fields, email never returned); micelio-cms `docs/ACCOUNTS.md:21` (no extra sign-up fields). No test (documentation) |
| V8.2.1 | Function-level access needs explicit permission | Met | Drafts need an editor JWT, checked by the CMS policy (`server/utils/drafts.ts:21-25`, `:41-50`; micelio-cms `src/api/article/routes/03-drafts.ts`, `src/utils/drafts-access.ts`); account routes need the session (`server/api/auth/me.delete.ts:8-9`). Tests: `e2e/drafts.spec.ts:14`, `:21`; micelio-cms `tests/drafts-access.test.ts` |
| V8.2.2 | Data-specific access prevents IDOR/BOLA | Met | Account actions use only the JWT's user (`server/api/auth/me.delete.ts:15-29`; micelio-cms `src/extensions/users-permissions/strapi-server.ts:47-61`); subscribers only by secret token (`server/utils/subscribers.ts:19-26`). Tests: `test/integration/api.test.ts:1574`, `:1331`; micelio-cms `tests/accounts.test.ts:226` |
| V8.2.3 | Field-level access prevents BOPLA | Met | Reads: `toPublicUser` (`app/helpers/auth.ts:87-94`), comment email never returned; writes: allow-listed comment fields and server-set author id (`server/api/comments/index.post.ts:14-18`), sign-up fields fixed (`server/schemas/auth.ts:20-25`). Tests: `test/auth.test.ts:75`, `test/integration/api.test.ts:1061`, `:1088`; micelio-cms `tests/accounts.test.ts:147` |
| V8.3.1 | Authorization enforced server-side, not in client code | Met | Route middleware (`app/middleware/editor.ts`, `auth.ts`) is UX only; the server routes and the CMS decide (`server/utils/drafts.ts:41-50`). Test: `e2e/drafts.spec.ts:21` |
| V8.4.1 | Cross-tenant isolation in multi-tenant apps | N/A | Single-tenant: one site per deployment |

## V9 Self-contained Tokens

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V9.1.1 | Validate token signature or MAC before use | N/A | Enforced in micelio-cms, see micelio-cms#128: `jsonwebtoken.verify` with `JWT_SECRET` (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/jwt.js:81-91`); the BFF never reads the JWT's content |
| V9.1.2 | Allowlist of token algorithms, never none | N/A | Enforced in micelio-cms, see micelio-cms#128: `algorithms: [jwt.algorithm \\|\\| 'HS256']` (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/jwt.js:82-86`); `config/plugins.ts:80` sets no other |
| V9.1.3 | Verification keys only from trusted preconfigured sources | N/A | Enforced in micelio-cms, see micelio-cms#128: a single preconfigured `JWT_SECRET`; `jku`, `x5u` and `jwk` headers are not used (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/jwt.js:85`) |
| V9.2.1 | Enforce token validity window (exp, nbf) | N/A | Enforced in micelio-cms, see micelio-cms#128: issued with `expiresIn: '7d'` (`config/plugins.ts:80`) and checked by `jsonwebtoken.verify` (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/jwt.js:85`). Test: micelio-cms `tests/accounts.test.ts:111` |
| V9.2.2 | Check token type and purpose before accepting | Open (above target) | The JWT carries only `{ id }`, no type; separation rests on `JWT_SECRET` differing from `ADMIN_JWT_SECRET` (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/jwt.js:56`; micelio-cms `config/admin.ts:6`). Tracked in #491 |
| V9.2.3 | Accept only tokens meant for this audience | Open (above target) | No `aud` claim issued or checked (`node_modules/@strapi/plugin-users-permissions/dist/server` 5.56.0 `services/jwt.js:56`, `:85`). Tracked in #491 |
| V9.2.4 | Shared issuer key needs per-audience restriction | N/A | `JWT_SECRET` signs tokens for one audience only, the CMS content API |

## V10 OAuth and OIDC

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V10.1.1 | Tokens sent only to components that need them | Met | Backend-for-frontend: the JWT lives in an httpOnly cookie and goes only to the CMS (`docs/adr/0003-session-in-httponly-cookie.md`, `server/utils/auth.ts:64`, `:78-80`, `server/middleware/umami.ts:16-17`). Tests: `e2e/account.spec.ts:31`, `test/integration/api.test.ts:1434` |
| V10.1.2–V10.2.2 | OAuth client flow binding, CSRF and mix-up defenses | N/A | No OAuth or OIDC client: sign-in is username and password through the CMS |
| V10.3.1–V10.3.4 | OAuth resource server audience, claims and strength | N/A | No OAuth access tokens; the users-permissions JWT is covered in V9 |
| V10.4.1–V10.4.11 | OAuth authorization server rules | N/A | No OAuth authorization server in Micelio |
| V10.5.1–V10.5.5 | OIDC relying-party ID token checks | N/A | No OIDC client |
| V10.6.1–V10.6.2 | OpenID Provider response modes and logout | N/A | No OpenID Provider |
| V10.7.1–V10.7.3 | Authorization server consent management | N/A | No OAuth authorization server, so no consent |

## V11 Cryptography

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V11.1.1 | Documented key management policy and key lifecycle | Open (above target) | `docs/security.md:34` gives rotation advice for the API token, but there is no key management policy (ownership, lifetimes, who may hold each secret). Tracked in #495 |
| V11.1.2 | Maintained cryptographic inventory of keys, algorithms, certificates | Open (above target) | No inventory of the frontend's secrets (`NUXT_STRAPI_API_TOKEN`, `NUXT_STRAPI_FORWARDER_SECRET`, SMTP credentials, workflow tokens in `docs/security.md:148-155`) and algorithms (SHA-256 CSP hashes, CSPRNG tokens, TLS). Tracked in #495 |
| V11.2.1 | Industry-validated crypto implementations are used | Met | Only `node:crypto` (OpenSSL): `server/utils/subscribers.ts:10`, `server/utils/rateLimit.ts:26`, `server/plugins/contentSecurityPolicy.ts:6`, `server/lib/clientIp.ts:234`. No test |
| V11.2.2 | Crypto agility: algorithms and keys can be swapped | Met | No application-level encryption; TLS comes from Node, CSP hashes are fixed by the CSP spec; secrets are environment values rotated without code changes (`docs/security.md:34`). No test |
| V11.2.3 | Primitives give at least 128 bits of security | Met | SHA-256 only (`server/plugins/contentSecurityPolicy.ts:6`, `modules/static-routes.ts:34`); 256-bit nonce and unsubscribe token. No test |
| V11.3.1–V11.3.3 | Block modes, approved ciphers, authenticated encryption | N/A | The frontend encrypts nothing itself; transport encryption is TLS from Node or the operator's proxy |
| V11.4.1 | Only approved hash functions for cryptographic use | Met | Every `createHash` call is `sha256` (`server/plugins/contentSecurityPolicy.ts:6`, `modules/static-routes.ts:34`, `:203`, `modules/islands.ts:49`, `modules/theme/display-fonts.ts:44`, `modules/lib/pyodide-assets.ts:49`); no MD5/SHA-1. No test |
| V11.4.2 | Passwords stored with an approved password hashing function | N/A | Passwords are stored by the CMS (users-permissions); enforced in micelio-cms, see micelio-cms#128 |
| V11.4.3 | Integrity hashes collision resistant, adequate length | Met | CSP script hashes use SHA-256 (`server/plugins/contentSecurityPolicy.ts:6`); display font integrity pinned by sha256 (`docs/security.md:132`). Test: `test/integration/api.test.ts` (CSP hashes match inline scripts), `test/displayFonts.test.ts` |
| V11.4.4 | Approved KDF with stretching for password-derived keys | N/A | The frontend derives no keys from passwords |
| V11.5.1 | Non-guessable values from a CSPRNG with ≥128 bits | Open (above target) | Newsletter confirmation token is `randomUUID()` (122 random bits), `server/api/newsletter/subscribe.post.ts:32`; the unsubscribe token (`server/utils/subscribers.ts:10`, 256 bits) and the SSR nonce (`server/utils/rateLimit.ts:26`) are fine. Tracked in #495 |
| V11.6.1 | Approved algorithms for key generation and signatures | N/A | The frontend generates no keys and signs nothing; JWTs are issued and verified by the CMS (enforced in micelio-cms, see micelio-cms#128) |

## V12 Secure Communication

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V12.1.1–V12.1.2 | Only current TLS versions and strong cipher suites | N/A | Operator/deployment: TLS is terminated by the reverse proxy in front of the container (Node listens on plain HTTP, `Dockerfile:63-66`) |
| V12.1.3 | mTLS client certificates validated before use | N/A | No mTLS anywhere in the frontend |
| V12.2.1 | TLS for all client connections, no insecure fallback | N/A | Operator/deployment: HTTPS redirect and TLS live in the reverse proxy; the app adds HSTS on every response (`app/helpers/securityHeaders.ts:43`, test `test/securityHeaders.test.ts`) |
| V12.2.2 | Publicly trusted certificates on external services | N/A | Operator/deployment: certificates belong to the reverse proxy |
| V12.3.1 | Encrypted protocol for all inbound and outbound connections | Open (above target) | `NUXT_PUBLIC_STRAPI_URL` may be plain `http://` to any host unless the forwarder secret is set (`server/plugins/runtimeConfigCheck.ts:16`), so the API token, user JWTs and passwords can travel unencrypted (`server/lib/strapiRequest.ts:28-33`); the Umami proxy has no such check (`server/middleware/umami.ts:44`). Tracked in #495 |
| V12.3.2 | TLS clients validate server certificates | Met | Node `fetch` defaults (no `NODE_TLS_REJECT_UNAUTHORIZED` or `rejectUnauthorized: false` in the repo); SMTP requires TLS with certificate checks (`app/helpers/email.ts:34-36`). Test: `test/email.test.ts` |
| V12.3.3 | TLS between internal HTTP services, no fallback | Open (above target) | CMS and Umami are reached over plain HTTP by default and in the documented examples (`docs/operate/configure.md:75`); nothing refuses `http://` for a non-private host (see V12.3.1). Tracked in #495 |
| V12.3.4 | Internal TLS uses trusted or pinned internal CAs | N/A | Operator/deployment: which internal CA Node trusts is set by the operator (`NODE_EXTRA_CA_CERTS`) |

## V13 Configuration

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V13.1.1 | All communication needs documented, incl. user-supplied destinations | Met | `docs/operate/configure.md` (Strapi, SMTP, Umami, fediverse sections), `docs/security.md:5-15`, `:83`, ADR 0002; user-supplied URLs (comment avatar, page links, media) are never fetched by the server (`server/schemas/comments.ts:20-23`, `docs/security.md:54`). No test |
| V13.2.1 | Backend calls authenticated without long-lived static credentials | Open (above target) | The frontend authenticates to the CMS with a static API token created with `lifespan: null` (micelio-cms `src/migrations/api-tokens.ts:125`) and a shared static forwarder secret (`server/utils/strapi.ts:27-30`). Tracked in #495 |
| V13.2.2 | Backend communication uses least-privilege accounts | Met | Custom token with the permissions of `docs/security.md:17-34`, identical to micelio-cms `src/migrations/api-tokens.ts:22-35` and `:47-53` (build token find-only); container runs as uid 65532 (`Dockerfile:72`). Test: none in this repo (the CMS migration has its own) |
| V13.2.3 | No default credentials for service authentication | Met | All credentials default to empty (`nuxt.config.ts:93-104`) and missing ones are reported at boot (`server/plugins/runtimeConfigCheck.ts`). Test: `test/runtimeConfig.test.ts` |
| V13.2.4 | Allowlist of external resources the app may contact | Met | Application layer: every CMS URL is the configured base plus a fixed path (`server/lib/strapiRequest.ts:16-17`, `test/strapiRequest.test.ts`); the Umami proxy matches two exact paths (`app/helpers/analytics.ts:39-42`); static media copy only from Strapi `/uploads/` and the media host (`modules/static-routes.ts:190-193`) |
| V13.2.5 | Server configured with an outbound allowlist | N/A | Operator/deployment: egress filtering of the container is outside the repository |
| V13.3.1 | Secrets managed outside code and build artifacts | Met | Secrets come only from runtime environment (`nuxt.config.ts:93-104`, empty defaults), `.dockerignore` excludes `.env*`, keys and certificates, the builder gets the token only at run time (`docs/security.md:155`). Storage in a vault is the operator's hosting platform's. No test |
| V13.3.2 | Access to secrets follows least privilege | N/A | Operator/deployment: who can read the deployment's environment is decided in the hosting platform |
| V13.4.1 | No source control metadata deployed or reachable | Met | The image copies only `.output` (`Dockerfile:61`); local probe: `/.git/config` and `/.git/HEAD` answer 404. No test |
| V13.4.2 | Debug modes disabled in production | Met | `devtools: { enabled: false }` (`nuxt.config.ts:78`), `NODE_ENV=production` (`Dockerfile:63`), dev-only plugins return early (`server/plugins/contentSecurityPolicy.ts`, `server/plugins/workerPolicy.ts`). No test |
| V13.4.3 | No directory listings unless intended | Met | Local probe: `/_nuxt/`, `/_islands/`, `/theme/images/` answer 404. No test |
| V13.4.4 | HTTP TRACE not supported in production | Met | `server/middleware/methods.ts` answers any method outside GET, HEAD, POST, PUT, PATCH, DELETE and OPTIONS with 405 and an `Allow` list, before any route runs. Test: `test/integration/api.test.ts` ("HTTP methods") |
| V13.4.5 | Documentation and monitoring endpoints not exposed unintentionally | Met | No OpenAPI or devtools route (local probe: `/_openapi.json`, `/_scalar`, `/__nuxt_devtools__/client` 404); `/_theme` exists only in dev or with `MICELIO_SPECIMEN=1` (`modules/theme/specimen/setup.ts:10-11`). Test: `test/themeModule.test.ts` |

## V14 Data Protection

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V14.1.1 | Sensitive data identified and classified into protection levels | Open (above target) | No classification of the data the frontend handles (emails, JWT, reset codes, newsletter tokens, visitor IPs); `app/pages/privacy.vue` is visitor-facing, not a classification. Tracked in #495 |
| V14.1.2 | Each protection level has documented protection requirements | Open (above target) | Depends on V14.1.1; no requirements per level (logging, retention, encryption). Tracked in #495 |
| V14.2.1 | Sensitive data never in URLs or query strings | Open | The reset code and the newsletter tokens arrive in an emailed link and leave the address bar once the page has read them (`app/composables/useForgetQueryParam.ts`; GHSA-p496-cm7x-29c3), but the server still looks subscribers up by email and token in the query string of its CMS request (`server/utils/subscribers.ts:20-24`), so they reach the CMS and proxy access logs. Tracked in #495 |
| V14.2.2 | Sensitive data not cached in server components | Met | ISR only on public routes (`nuxt.config.ts:45-56`); private routes `private, no-store` (`nuxt.config.ts:134-149`); Nitro's cached render sees no cookie and stores no `Set-Cookie` (`docs/security.md:92`). Test: `test/integration/api.test.ts` (no `set-cookie` on cached pages, `private, no-store` on auth and drafts) |
| V14.2.3 | Sensitive data not sent to untrusted parties or trackers | Met | The tracker leaves the query string out (`data-exclude-search`, `app/helpers/analytics.ts:36`), the analytics proxy drops `Referer` (`server/middleware/umami.ts:19`) and the reset, confirmation and unsubscribe pages, in both locales, send `Referrer-Policy: no-referrer` (`nuxt.config.ts:13`, `:147-152`). Published advisory GHSA-p496-cm7x-29c3. Tests: `test/analytics.test.ts:22`, `test/integration/api.test.ts:1505`, `:2012`, `:2019` |
| V14.2.4 | Data protection controls implemented as documented per level | Open (above target) | Cannot be met before V14.1.1–V14.1.2 define the levels; current gaps include V16.2.5. Tracked in #495 |
| V14.3.1 | Authenticated data cleared from client after logout | Met | `logout()` clears the user before it calls the server (`app/composables/useAuth.ts`), so the page shows nothing of the session even when the request fails (the error still reaches the caller); the draft count follows the editor flag (`app/plugins/drafts.client.ts`); the JWT is `httpOnly` (`server/utils/auth.ts:64`) and the server clears the cookie. `Clear-Site-Data` is not sent: its `storage` and `cache` types would also drop the reading history kept in the browser. Test: `test/nuxt/useAuthLogout.test.ts`, `e2e/account.spec.ts` |
| V14.3.2 | Anti-caching headers so browsers don't keep sensitive data | Met | `preventCaching()` on every auth and draft route (`server/utils/auth.ts:40-42`), route rules for account, drafts, newsletter and their APIs (`nuxt.config.ts:134-149`). Test: `test/integration/api.test.ts` (`private, no-store` assertions) |
| V14.3.3 | Browser storage holds no sensitive data except session tokens | Met | `localStorage` holds only the theme mode (`app/helpers/theme.ts:40-78`, `modules/theme/init-script.mjs`); the only cookie is the session (`docs/security.md:127`). Test: `test/themeInitScript.test.ts`; e2e checks the JWT never reaches page JavaScript (ADR 0003) |

## V15 Secure Coding and Architecture

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V15.1.1 | Documented remediation time frames for vulnerable components | Met | `docs/security.md`, "Remediation time frames": 14 days for critical and high findings in what runs in production or in the browser, the next planned release for the rest and for build tooling; a finding with no fix is listed with its reason. `SECURITY.md` points to it. Test: no test (documentation) |
| V15.1.2 | SBOM of third-party components, trusted sources verified | Open (above target) | The lockfile is committed, but the image builds (`.github/workflows/deploy.yml:421`, `:484`) publish no SBOM and no signed provenance, which the standard (section 10) requires. Tracked in #495 |
| V15.1.3 | Resource-heavy functionality and its availability defences documented | Met | `docs/security.md:53-54` (page size, search length, post lists, caching), `:66` (rate limits), `server/lib/strapiRequest.ts:5` (CMS timeout), `:111-119` (playground limits). No test |
| V15.2.1 | Components within the documented remediation time frames | Met | `npm audit` on 2026-10-14: 13 high, no low, no critical. The high ones (`node-forge`, the `braces` chain) are build and development tooling, not in `.output/server/node_modules`, with no fixed release (`node-forge`) or no fix that is not a breaking change (`braces`), and are listed in `docs/security.md`, "Accepted risks". The low `katex` finding was fixed by Mermaid 12.2.0. Run: `npm audit`. Test: CI fails on a critical finding |
| V15.2.2 | Defences against availability loss from heavy functionality | Met | A request body is read within 64 KB and answers 413 before any route logic (`server/utils/validation.ts:5-45`), inputs have upper bounds (`server/schemas/auth.ts`), and the rate limiter holds at most 10,000 keys (`app/helpers/rateLimit.ts:25`). Heavy islands load only where used (ADR 0006). Tests: `test/integration/api.test.ts:531`, `test/rateLimit.test.ts:32` (GHSA-xjjv-c6cr-w4p6, GHSA-p9c9-2w7f-67wv) |
| V15.2.3 | Production has no test, sample or dev functionality | Met | Image contains only `.output` (`Dockerfile:61`); specimen page only with `MICELIO_SPECIMEN=1` (`modules/theme/specimen/setup.ts:10-11`); dev-only plugins skip in production. Test: `test/themeModule.test.ts` |
| V15.3.1 | Responses return only the required fields | Met | The post, post list, draft and about routes rebuild their answer from an allow-list of fields (`server/lib/publicShapes.ts`, `allow` in `app/helpers/allowList.ts`), so a field the pages do not read (file hashes and providers, `metaSocial`, an unknown block, a field a later CMS adds) never leaves the server; the article populate names the fields of images, categories and authors instead of `populate: '*'` (`server/lib/constants.ts`). The about query (`ABOUT_POPULATE`) names the nested components of each block and the image fields too. Tests: `test/aboutPopulate.test.ts`, `test/allowList.test.ts`, `test/publicShapes.test.ts`, `test/integration/api.test.ts` ("fields of an article that leave the server") |
| V15.3.2 | Backend calls to external URLs don't follow redirects unintentionally | Met | No backend call follows a redirect. CMS calls reject on one (`redirect: 'error'` by default in `strapiRequest`, `server/lib/strapiRequest.ts`), so the token and the visitor headers stay on the configured origin. The Umami proxy turns a 3xx into a 502 instead of passing its `Location` to the visitor (`server/middleware/umami.ts`). The static media copy refuses a host that redirects and names the URL (`modules/lib/static-media.ts`). Tests: `test/strapiRequest.test.ts` ("never follows a redirect"), `test/integration/api.test.ts` ("does not hand the visitor a redirect from Umami"), `test/staticMedia.test.ts` |
| V15.3.3 | Mass assignment prevented by per-action field allowlists | Met | zod objects drop unknown keys (`server/schemas/auth.ts`, `server/schemas/comments.ts`), the comment author id is set by the server (`server/api/comments/index.post.ts:14-18`). Test: `test/integration/api.test.ts` (register with `role: 'editor'` is ignored), `test/schemas.test.ts` |
| V15.3.4 | Original client IP taken only from trusted proxy data | Met | `NUXT_TRUST_PROXY` model (`server/lib/clientIp.ts`, `server/utils/rateLimit.ts:33-56`, `docs/security.md:68-98`). Test: `test/clientIp.test.ts` |
| V15.3.5 | Strict typing and strict comparisons | Met | Inputs typed by zod (`server/schemas/`), token and relation checks are type guards (`app/helpers/newsletter.ts:14-15`); no loose `==`/`!=` in `server/` or `app/helpers/`. Test: `test/schemas.test.ts` |
| V15.3.6 | Code written to prevent prototype pollution | Met | Query and body parsing by h3 (`ufo`, `destr`), which drop `__proto__`; server code only serialises with `qs.stringify` and builds objects from zod output; lookups use `Map`/`Set` (`server/api/posts/index.get.ts:71`, `server/utils/articleSearch.ts:5`). No test |
| V15.3.7 | Defences against HTTP parameter pollution | Met | Each value is read from one source and repeated query parameters fail the string schemas (`server/schemas/query.ts`); the unsubscribe token takes the query first, then the body, by design (`server/api/newsletter/unsubscribe.post.ts:5-13`). Test: `test/schemas.test.ts` (array values rejected) |

## V16 Security Logging and Error Handling

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V16.1.1 | Log inventory: events, format, storage, access, retention | Open (above target) | No log inventory; the server writes structured lines to standard error (`docs/security.md`, "Logs") but the inventory of events, access and retention is not written. Tracked in #494 |
| V16.2.1 | Each log entry has when, where, who, what | Met | `logError` and `logWarn` (`server/utils/log.ts`) write a line with the UTC time, the event name, the route, a request id and a keyed hash of the visitor's address (random key per process; no address, no email). Lines written outside a request (boot) or by helpers that receive no request (`cms.site-setting`, `cms.page`, `cms.page-post-list`, `theme.*`) carry time and event only. The request id is per request: each internal `/api` call of a page render has its own. Test: `test/serverLog.test.ts`, and `test/noRawErrorLogs.test.ts` fails when a server file writes to `console` directly |
| V16.2.2 | Synchronised time sources and UTC timestamps | N/A | Operator/deployment: each line carries a UTC ISO 8601 `time` from the process clock; keeping the host clock synchronised is the platform's |
| V16.2.3 | Logs only go to documented destinations | Met | `docs/security.md`, "Logs": standard error only, no file and no other sink. Test: no test (documentation) |
| V16.2.4 | Logs readable by the log processor, common format | Open (above target) | Every line the app writes is one JSON object (`formatLogLine`, `server/lib/log.ts`; test: `test/serverLog.test.ts`), but Nitro still writes its own `[request error]` report of an unhandled error as free text over several lines, with the URL and its query (`defaultHandler`, called by Nuxt's error handler as well). It cannot be silenced from the app without replacing both handlers; `server.unhandled` is the structured record of the same error. Tracked in #494 |
| V16.2.5 | Sensitive data logged according to its protection level | Met | Every failed CMS call is logged through `upstreamLogMessage` (status and the CMS's message, never the URL or its query); an error with a `code` keeps only its name and code (`server/utils/upstreamError.ts`). Test: `test/upstreamLog.test.ts`, and `test/noRawErrorLogs.test.ts` fails when a server file logs a caught error as it is |
| V16.3.1 | All authentication attempts logged, success and failure | Met | Sign-in, registration, password reset and change, logout and account deletion log `auth.*.success`; every refusal (CMS error, password rules, no session) logs `auth.failure` with its error code (`strapiAuthFailure` in `server/utils/auth.ts`, `server/utils/passwordRules.ts`). No password, identifier or email in a line. Event table: `docs/security.md`, "Security events". Test: `test/integration/api.test.ts` ("security event logs") |
| V16.3.2 | Failed authorisation attempts logged | Met | `authz.origin-refused` (`assertSameOrigin`, `server/utils/auth.ts`) and `authz.draft-refused` (`editorSession` and `fetchAsEditor`, `server/utils/drafts.ts`: no session, CMS 401 or 403). A draft the CMS answers 404 is not a refusal and is not logged. Test: `test/integration/api.test.ts` ("security event logs") |
| V16.3.3 | Documented security events and control bypass attempts logged | Met | `limit.rate` (`assertRateLimit`, `server/utils/rateLimit.ts`) and `input.refused` (`validBody` and `validQuery`, `server/utils/validation.ts`, field names only; and the newsletter token checks) join the list above. A malformed path parameter, `relation` or `documentIds` is not logged: it reaches no control and scanners send it in volume; the list is in `docs/security.md`, "Security events". Test: `test/integration/api.test.ts` ("security event logs") |
| V16.3.4 | Unexpected errors and backend TLS failures logged | Met | A failed CMS call is logged where it happens (`cms.*`); a failed Umami proxy call is `analytics.proxy` (`server/middleware/umami.ts`); an unhandled error is `server.unhandled` with the error's name and code only (`server/plugins/errorLog.ts`). `fetchPublishedVersion` returns null on failure, but `fetchAsEditor` has logged it before it threw (401 and 403 as `authz.draft-refused`, anything else as `cms.drafts`; a 404 only means no published version). A TLS failure toward the CMS or Umami is a failed `fetch`, so it takes the same paths. Test: `test/integration/api.test.ts` ("security event logs"), `test/errorLogPlugin.test.ts` |
| V16.4.1 | Log data encoded to prevent log injection | Met | `logText` turns control characters into spaces and cuts the text; `upstreamLogMessage` and the theme log use it (`server/utils/upstreamError.ts`, `server/utils/theme.ts`). `formatLogLine` (`server/lib/log.ts`) escapes the whole line as JSON. Test: `test/upstreamLog.test.ts`, `test/serverLog.test.ts` |
| V16.4.2–V16.4.3 | Logs protected from tampering and shipped to a separate system | N/A | Operator/deployment: the app writes to stdout/stderr; collection, access control and shipping are the hosting platform's |
| V16.5.1 | Generic message for unexpected or security-sensitive errors | Met | A failed CMS call answers with a fixed message the route chooses and a 502 (a 404, and a 400 when posting a comment, are kept); the CMS text, URL and query go to the log only (`upstreamFailure`, `server/utils/upstreamError.ts:19`; GHSA-rcx4-hg9p-9gj9). Tests: `test/integration/api.test.ts:704`, `:728` |
| V16.5.2 | Secure operation when external resources fail | Met | Site settings fall back to `app.config.ts` (`server/utils/site.ts:49`), search answers `[]` (`server/api/search.get.ts:18-21`), fediverse ranking falls back to newest (`server/api/posts/index.get.ts:58-62`), post lists render empty (`server/utils/pageSections.ts:46-48`), short timeouts. Test: `test/integration/api.test.ts` (502 never cached, fallbacks) |
| V16.5.3 | Fails securely, no fail-open on errors | Met | Validation and origin checks run before any CMS call (`server/utils/validation.ts:17-18`, `server/utils/auth.ts:50-57`); drafts answer 404 on any refusal (`server/utils/drafts.ts:46`); a failed confirmation update is a 500, not a success (`server/api/newsletter/confirm.post.ts`). Test: `test/integration/api.test.ts` |

## V17 WebRTC

| Id | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| V17.1.1–V17.3.2 | TURN, media server and signalling server requirements | N/A | Micelio has no WebRTC: no TURN, media or signalling server |
