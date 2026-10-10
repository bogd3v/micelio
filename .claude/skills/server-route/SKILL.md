---
name: server-route
description: Add or change a Nitro route in server/api or server/routes of the Micelio frontend - input schema, Strapi call, error contract, protections, tests and docs. Use for any new endpoint, any change to what a route accepts or returns, and any new call to Strapi.
---

# Server route

Every route follows the same contract. Skipping a step has already caused production bugs here (an API token read at build time, a missing Strapi permission, a validation bypass).

## 1. Input

- Body: zod schema in `server/schemas/<area>.ts` + `validBody(event, schema, invalid)` (`server/utils/validation.ts`). `invalid` builds the error, so the route keeps its own status and code.
- Query: schema in `server/schemas/query.ts` + `validQuery(event, schema)` (400 with the first issue's message).
- Reuse the validators in `app/helpers/` (`isValidEmail`, `isCategory`, `isNewsletterToken`…) inside the schema so client forms and server agree.
- Locales are `en`/`es`; unknown → 400, empty → absent. Treat `''` as missing with `preprocess`. A key that only has a `transform` needs `.optional()` first (zod 4 makes it required otherwise).
- Never read `getQuery(event).x as string`: repeated parameters arrive as arrays.

## 2. Strapi

- Only `strapiFetch<T>(path, { event, method, query, body, timeout })` (adds the API token), with `auth: 'none'` for anonymous calls (fediverse, auth) and `auth: { jwt }` for user calls. Pass `event` on every call made for a visitor: it forwards the visitor's IP so the CMS rate-limits per visitor (`docs/security.md`). That covers browser requests to `/api/*` and SSR calls made through `useRequestFetch()` / `useFetch` (never the global `$fetch`, which carries no address); a `useFetch` with `server: false` runs in the browser and is forwarded directly; leave `event` out only for the cached `loadSite`/`loadPage`, feeds, sitemap and the build. Auth calls that send mail pass `timeout: AUTH_TIMEOUT_MS` (import it from `server/lib/constants.ts`). Never build the URL or `Authorization` by hand.
- User or editor calls send their own JWT (`fetchStrapiMe(event, jwt)`, `fetchAsEditor(event, jwt, …)`), never the API token.
- A write to the CMS catches errors and calls `rethrowUpstreamRateLimit(event, error)` first, so a CMS 429 reaches the browser with `Retry-After`; a route that degrades instead of failing (empty search, ranking fallback) calls `noStoreOnUpstreamRateLimit(event, error)` so the degraded answer is not cached.
- A new content type or action needs a permission on the **custom** API token in Strapi: add it to the table in `docs/security.md` and tell the user to grant it. A missing `update` on Subscriber once broke every newsletter confirmation.
- Upstream errors: catch, `console.error`, then `createError({ statusCode: 502, message: upstreamErrorMessage(error, '…') })` (or Strapi's status where the client needs it).

## 3. Protections

| Route kind | Must have |
| --- | --- |
| Public read | `setHeader(event, 'Cache-Control', 'public, s-maxage=…, stale-while-revalidate=…')` |
| State change from the site | `assertSameOrigin(event)` |
| Public write (comments, newsletter) | `assertSameOrigin` + `assertRateLimit(event, bucket, key)` with a rule in `RATE_LIMITS` |
| Session / account / drafts | `preventCaching(event)` and a `private, no-store` route rule |
| Editor only | `editorSession(event)`; answer 404, not 403 |

Auth routes fail with `authFailure('<code>')`; a new code goes in `AuthErrorCode`, `AUTH_ERROR_STATUS` and both i18n files.

## 4. Tests

- Schema: cases in `test/schemas.test.ts` (defaults, limits, arrays, unknown values, messages).
- Integration (`test/integration/api.test.ts`, real build + `test/integration/mock-strapi.ts`): happy path, every 400/403/429 **without calling Strapi** (`expect(mock.requests).toEqual([])`), and which credential reached Strapi (`request.authorization`). To simulate a Strapi failure use a switch in `mock.failures`, never a fake input value.
- Add the route to `e2e/mock-strapi.mjs` too if a page calls it.

## 5. Docs

Update in the same PR: `docs/api.md` (input, output type, cache, errors) and `docs/security.md` (access, protections, token permission). A new external domain for images or embeds also goes in the CSP (`app/helpers/securityHeaders.ts`) and the `sanitize-html` options.

Then run the **verify-change** skill.
