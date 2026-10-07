# Server API

Every route under `server/api/` and `server/routes/`: what it takes, what it returns and how it fails. Inputs are validated by the zod schemas in `server/schemas/` (or the checks named below); response types live in `app/interfaces/`. Who may call each route and how it is protected is in [security.md](security.md).

Conventions:

- **Errors** are Nitro errors: `{ statusCode, statusMessage, message, data? }`. Auth routes put a machine-readable code in `statusMessage` and `data.code` (see [Auth error codes](#auth-error-codes)); the client translates it.
- **Locales** are `en` and `es`. An unknown locale is a `400`; an empty one counts as absent.
- **502** means Strapi failed or rejected the call; the message carries Strapi's when it has one.
- **429** comes with `Retry-After` (seconds).

## Content

| Route | Query | Returns | Cache | Errors |
| --- | --- | --- | --- | --- |
| `GET /api/posts` | `page` (≥ 1, default 1), `pageSize` (1–50, default 10), `locale`, `category`, `tag` (slugs), `search` (≤ 200 chars; used from 3), `sort` (`recent` · `oldest` · `fediverse`, unknown → `recent`), `content` (`1`/`true`: search the body and return a `snippet`) | `StrapiPaginatedResponse<RawStrapiArticle[]>` | 5 min | 400 bad query |
| `GET /api/posts/:slug` | `locale` | `RawStrapiArticle` | 5 min | 400, 404 not found, 502 |
| `GET /api/search` | `q` (≤ 200; under 3 chars returns `[]`), `locale`, `content` | `SearchPostResult[]` (at most 10) | 1 min | 400; Strapi errors return `[]` |
| `GET /api/categories` | `locale` (default `en`) | `CategoryCount[]` | 10 min | 400 |
| `GET /api/tags` | `locale` (default `en`) | `TagCount[]` | 10 min | 400 |
| `GET /api/reading-path` | `category` (required, a known category), `locale` | `ReadingPath` (`editorial` is false when Strapi has no `pathOrder` yet) | 5 min | 400 unknown category, 502 |
| `GET /api/about` | `locale` | `StrapiAbout` | 5 min | 400, 404, 502 |
| `GET /api/pages/:slug` | `locale` (optional; Strapi's default when absent); `slug` is a Strapi uid (`^[a-z0-9][a-z0-9_.~-]{0,63}$`) | `Page` | 5 min in Nitro's storage per locale and slug (`loadPage`, stale while revalidating); a 404 or 502 is never stored | 400 bad slug or locale, 404 no page, 502 |
| `GET /api/site` | `locale` (default `en`) | `Site`: the site identity and its modules, including optional `theme` when overrides apply | 5 min; 30 s when Strapi fails | 400 unknown locale. Never fails because of Strapi |

Types: `app/interfaces/strapi-post.ts` (`RawStrapiArticle`, `SearchPostResult`, `TagCount`), `strapi-response.ts`, `design.ts` (`CategoryCount`), `blog.ts` (`ReadingPath`), `strapi-about.ts`, `page.ts` (`Page`, `PageSection` and one interface per section).

**Site identity.** `/api/site` reads Strapi's `site-setting` single type (3 s timeout) with nested `populate: { author: true, logo: true, favicon: true, defaultOgImage: true, socialLinks: true, modules: true, theme: { populate: '*' }, homePage: { fields: ['slug'] } }` and merges it over the `site` block of `app/app.config.ts` field by field (`app/helpers/site.ts`). The query is built with `qs.stringify` because ofetch's `query` option does not serialize nested objects. Each Strapi field is validated on its own (`server/schemas/site.ts`): an invalid or empty value, or one that is missing, keeps the `app.config.ts` value, and so does every field when Strapi fails or times out. A module left unset in Strapi stays on. Pages read it through `useSite()`, which returns the `app.config.ts` values until the route answers. Server code reads it with `loadSite(locale)` (`server/utils/site.ts`): the RSS feeds take the site name for their titles and `<generator>`, and the newsletter emails for their subject and body. Type: `app/interfaces/site.ts`.

**Home page.** `site-setting.homePage` (a relation to `page`, localized: each language names its own page, `showcase` and `muestra`) is exposed as `Site.homePage?: { slug }`; it is absent when none is set, and a slug that is not a Strapi uid is dropped alone. `app/pages/index.vue` reads it (`useLoadedSite()`) and, when set, renders that page at `/` and `/es` with `/api/pages/<slug>` and the same body and SEO as `app/pages/[slug].vue` (`SectionRenderer` with `page-title`, `usePageSeo`; canonical is `/` or `/es`). Without `homePage`, or when the page does not load (404 or any error), `/` renders the blog home exactly as before (`useBlogHome()`, `RegionHome`) and the server logs a warning (`warnOnce`, `app/helpers/pages.ts`: once per locale, slug and status every ten minutes, at most 100 keys); it never answers 404. The page also keeps answering at its own `/<slug>` with a canonical to `/`, no redirect. hreflang always points at canonical URLs (`useAlternates`, `homePaths`/`pagePaths`): each translation is listed at its language's root when it is that language's `homePage` (read from `/api/site?locale=` of that language, on the server only, hydrated from the payload), otherwise at its own slug, so `/` and `/es` point at each other only when both are home pages. Freshness: `/` and `/es` keep their ISR rule (300 s), so a change to the home page or to `homePage` shows after up to the site cache (60 s, `siteCacheSeconds`) or the page cache (300 s, `loadPage`) plus the ISR window (300 s). Type: `app/interfaces/site.ts`.

**Theme overrides.** When Strapi's `site-setting.theme` has `themeId`, `defaultMode`, `accentOverrides` or `displayFont` (ADR 0005, section 8), the server resolves them against the active build theme (`NUXT_PUBLIC_THEME`); a foreign `themeId` is ignored and logged once. Resolution rules: `defaultMode` is kept only if it is a mode of the theme; `displayFont` (one of five curated fonts, ADR 0005 section 8) is looked up in a table keyed by the enum and rendered into the page head: its `@font-face`, its `<family> Fallback` faces and `--font-display`, plus a `<link rel="preload" as="font">`; the font the theme already uses for display (Bogotá: Archivo, starter: Fraunces) emits nothing, and the mono family is never overridden; `accentOverrides` are checked per mode, an override for an unknown mode is dropped, and an accent equal to the theme's is dropped. For each accent, the server checks contrast against ADR 0005 §1 rules and WCAG 2 AA levels on the theme's three surfaces in that mode (and `link`, `focus` and `link-soft` when the theme defines them from the accent); if it fails, the nearest OKLCH lightness that passes is used, keeping hue, and the adjustment is logged; when none passes, the theme's accent is kept. The server derives `accent-soft` (14 % OKLab into `surface`), `accent-hover` (80 % with `ink`) and `on-accent` (the theme's `ink` or `on-ink`, whichever contrasts more). The result appears in the `theme` field of the response when anything changes; this field is absent otherwise. When `defaultMode` applies, the server writes that mode into `data-theme`, `data-scheme` and `data-mode-default` on `<html>` (the init script still prefers the visitor's stored choice). The accents are rendered into one `<style id="theme-overrides">` in the SSR head (see security.md), cached with the page under ISR (ADR 0001) and refreshed with `loadSiteCached()` (cache: `siteCacheSeconds`, 60 s default, or at most 10 s when Strapi failed). `theme.id` is the active build theme, `theme.defaultMode` the resolved mode or absent, `theme.displayFont` the chosen font or absent, `theme.accents` a map of mode id to `{ accent, accentSoft, accentHover, onAccent }`, all as `#rrggbb`. Type: `SiteTheme` in `app/interfaces/site.ts`.

**Pages.** `/api/pages/:slug` asks Strapi for one `page` (`/api/pages` with `filters[slug][$eq]`, `locale` and `pagination[limit]=1`, built with `qs.stringify` into the path) and populates `seo` (with its image), `localizations` (`slug`, `locale`) and the `sections` dynamic zone with one `on` entry per component naming each nested link, media and relation (`PAGE_POPULATE`, `server/utils/pageSections.ts`). The answer is a `Page`: `documentId`, `title`, `slug`, `locale`, `seo` (`PageSeo`), `sections` and `translations` (`{ locale, slug }[]`, for hreflang). Validation is lenient (`server/schemas/page.ts`): a section with an unknown `__component` or that fails its schema (a missing required field, an unknown `variant`, a scene model that is not `.glb`/`.gltf`) is dropped alone and the page stays; an optional field that is invalid (a bad link or media URL) is dropped alone; list items are dropped one by one, and a section left with none is dropped; a missing `variant` takes the CMS default. Links are `http(s)`, `mailto:` or a path starting with a single `/` and no backslash (`//host` and `/\host` leave the site, so they are dropped); logo links are `http(s)` only; media is `{ url, alternativeText?, width?, height?, mime? }` and its URL is a path on the site or on an origin the CSP already allows for images (`NUXT_PUBLIC_STRAPI_URL`, `NUXT_MEDIA_URL`), anything else is dropped. In `seo`, `canonicalURL` is kept only on the origin of `NUXT_PUBLIC_SITE_URL` and `metaRobots` only when every comma-separated token is a documented robots directive (`noindex`, `nofollow`, `max-image-preview:large`…); `metaSocial` and `structuredData` are not returned. A page with no valid title or slug answers 404. Markdown is rendered and sanitized on the server (as above): `media-showcase.text` becomes `html`, each FAQ `answer` becomes `html`, `rich-text.body` becomes `html`, and the sources are not returned. Plan `features` come as a `string[]`, one per line. Each `post-list` section (the first four of a page; later ones come with `posts: []`, so a page costs at most four extra Strapi calls) carries its `posts` (`PostListItem[]`, newest first, at most `count`, 1 to 12), looked up by the category or tag slug (the category wins if both come) with the same populate as `/api/posts`; no match or a Strapi failure gives `[]` and the page still answers. Cache: the fetch, validation, Markdown rendering and post lists run inside a Nitro `defineCachedFunction` (`loadPage`, name `page`, key `<locale or default>:<slug>`, 300 s, stale while revalidating), so repeated hits cost no Strapi call. A page that is not found (`undefined`) and every error are not stored, so a page published a moment later appears at once. `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` is only defensive on success, as in the other routes (ADR 0001); Nitro answers errors with `no-cache`. Type: `app/interfaces/page.ts`.

**Page route and reserved slugs.** `app/pages/[slug].vue` renders a page at `/<slug>` and `/es/<slug>` (the slug differs per locale: `/showcase` and `/es/muestra`), calling `/api/pages/:slug?locale=`. A 404 or a 400 (a slug that is not a valid uid, like `/Showcase`; `/About` is the about page, the router ignores case) answers the normal 404 page; a slug that is not a uid is rejected by the route before any call; any other error keeps its status, and a failure without one (network) is a 500. Static routes win over the catch-all, so these slugs never reach a page and a CMS page with one of them is unreachable: `about`, `blog`, `privacy`, `confirm`, `account`, `drafts`, `newsletter` and `_theme` (plus `api` and the files served by `server/routes`: `feed.xml`, `sitemap.xml`, `robots.txt`). SEO comes from `seo` (title falls back to the page title, `metaRobots` becomes the robots meta, `canonicalURL` replaces the page URL as canonical); hreflang comes from `translations`, so the locale switcher goes to the translated slug. `metaSocial` and `structuredData` are not rendered. The page is server-rendered on each request (no ISR rule, ADR 0001); the API behind it is cached. The h1 is the title of the first section when it is a hero; otherwise it is the page title.

**Rendered Markdown.** `/api/posts/:slug`, `/api/about` and `/api/drafts/:documentId` render Markdown on the server (`app/helpers/markdown.ts`, labels from `i18n/locales/` in the request's `locale`): every `shared.rich-text` and `shared.quote` block gets an `html` field, and every `about.open-source` guide item an `html` field, already sanitized. Article citations are numbered on the server from the article's `references`. `body` and `text` are still returned for the table of contents and the reference list. Components render `html` and never parse Markdown in the browser.

## Modules

Each site turns features on and off in Strapi's `site-setting.modules` (all on by default). The server switches a module off by itself when it lacks what it needs, and logs it at startup: `newsletter` without the four SMTP settings, `fediverse` without the three `NUXT_PUBLIC_FEDIVERSE_*` values, and `drafts` whenever `accounts` is off. `/api/site` returns the result (`modules`), and pages read it with `useModule(module)`. The site mode (`NUXT_PUBLIC_SITE_MODE`: `dynamic` by default, `static` or `landing`; ADR 0006) also limits them. It is read at build time, exposed as `runtimeConfig.public.siteMode`, and the server fails at startup if a runtime value differs from the build's. In `static` and `landing`, `comments`, `accounts`, `drafts` and `fediverse` are always off, `newsletter` is on only when `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` is set (SMTP is not used; in a static build the action is baked into the prerendered pages, so it must be set at build time; `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD`, default `email`, names the provider's email field), and `search` and `support` follow Strapi. SMTP and fediverse settings are not required in those modes. All of it lives in `app/helpers/modules.ts` and `app/helpers/siteMode.ts`.

| Module | Routes and pages that answer 404 when it is off |
| --- | --- |
| `newsletter` | `/api/newsletter/*`, `/confirm`, `/newsletter/*` |
| `comments` | `/api/comments*` |
| `accounts` | `/api/auth/*`, `/account*` |
| `drafts` | `/api/drafts*`, `/drafts*` |
| `fediverse` | `/api/fediverse/*` |
| `search` | `/api/search` |
| `support` | none (only the support button) |

Pages match with or without the `/es` prefix. `server/middleware/modules.ts` answers before the route runs, so a switched-off module never reaches Strapi. It reads the modules through `loadSiteCached()`, which keeps the site for `NUXT_SITE_CACHE_SECONDS` (60 by default, at most 10 s after a Strapi failure; `0` turns the cache off). Client-side navigation is checked by `app/middleware/modules.global.ts`.

## Comments

`relation` is required on every comment route and must be `api::article.article:<documentId or slug>`, or the answer is `400`.

| Route | Input | Returns | Errors |
| --- | --- | --- | --- |
| `GET /api/comments` | Query: `relation`, `locale`, `page`, `pageSize` (≤ 50), `sort` (`field:asc` / `field:desc`) | `Comment[]` as a tree (`children`) | 400, Strapi's status |
| `GET /api/comments/flat` | Same query | `CommentsResponse` (`data` flat, with `threadOf`) | 400, Strapi's status |
| `POST /api/comments` | Query: `relation`. Body: `author.name` (≤ 100), `author.email` (≤ 254), `author.avatar` (http(s), optional, dropped if invalid), `content` (≤ 5000), `threadOf` (positive integer, optional), `locale` | `Comment` | 400 invalid body or locale, 403 other origin, 429 (10 per IP / 10 min), Strapi's status |

Every comment response hides `PENDING` and `REJECTED` comments and never includes the author's email. The author id of a posted comment is set by the server (`guest-<uuid>`). Types: `app/interfaces/comment.ts`.

## Fediverse

| Route | Input | Returns | Cache | Errors |
| --- | --- | --- | --- | --- |
| `GET /api/fediverse/stats` | Query: `documentIds`, comma-separated or repeated, 1–50 ids (`[\w-]+`) | `Record<documentId, FediverseStats>` (likes, boosts) | 1 min | 400, 502 |
| `GET /api/fediverse/stats/:documentId` | — | `FediverseStats` | 1 min | 400, 404 not federated, 502 |

These call Strapi anonymously. Type: `app/interfaces/fediverse.ts`.

## Newsletter

| Route | Input | Returns | Errors |
| --- | --- | --- | --- |
| `POST /api/newsletter/subscribe` | Body: `email` (≤ 254), `locale` (`es` or English for anything else) | `SubscribeResponse` — the same for new and already confirmed addresses | 400 `Email is required` / `Invalid email format`, 403 other origin, 429 (10 per IP and 3 per email / hour), 500 |
| `GET /api/newsletter/confirm` | Query: `token` | `ConfirmResponse`; `alreadyConfirmed: true` when the link is opened again | 400 missing token, 404 unknown or malformed token, 500 |
| `POST /api/newsletter/unsubscribe` | `token` in the body (unsubscribe page) or the query (RFC 8058 one-click) | `{ success: true }`, also for unknown or used tokens | 400 malformed token, 502 |

Every newsletter response is `private, no-store`. Types: `app/interfaces/newsletter.ts`.

## Account

All account routes answer `private, no-store`. The session is the `bd_session` cookie set by sign-in.

| Route | Body | Returns | Errors |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `identifier` (username or email), `password` | `AuthUserResponse`; sets the session cookie | `invalidInput`, `invalidCredentials`, `emailNotConfirmed`, `tooManyRequests`, `forbiddenOrigin` |
| `POST /api/auth/register` | `username`, `email`, `password` (rules in `app/helpers/auth.ts`), `acceptPrivacy: true` | `201` + `AuthUserResponse` (no session until the email is confirmed) | `invalidInput`, `emailTaken`, `tooManyRequests`, `forbiddenOrigin` |
| `POST /api/auth/resend-confirmation` | `email` | `{ ok: true }`, whether or not the account exists | `invalidInput`, `tooManyRequests`, `forbiddenOrigin` |
| `POST /api/auth/forgot-password` | `email` | `{ ok: true }`, whether or not the account exists | `invalidInput`, `tooManyRequests`, `forbiddenOrigin` |
| `POST /api/auth/reset-password` | `code` (from the email), `password`, `passwordConfirmation` | `{ ok: true }` | `invalidInput`, `invalidCode`, `forbiddenOrigin` |
| `POST /api/auth/logout` | — | `{ ok: true }`; clears the cookie | `forbiddenOrigin` |
| `GET /api/auth/me` | — | `AuthUserResponse`; `user: null` without a valid session (and clears an expired cookie) | Other Strapi failures, usually `unknown` |
| `DELETE /api/auth/me` | `username` (must be the signed-in user), `password` | `{ ok: true }`; deletes the Strapi user and clears the cookie | `unauthorized`, `invalidInput` (also for another username), `wrongPassword`, `forbiddenOrigin` |

Types: `app/interfaces/auth.ts`.

### Auth error codes

| Code | Status | Meaning |
| --- | --- | --- |
| `invalidInput` | 400 | The body does not match the schema |
| `invalidCredentials` | 400 | Wrong identifier or password |
| `emailNotConfirmed` | 400 | The account exists but its email is not confirmed |
| `invalidCode` | 400 | Expired or unknown reset code |
| `wrongPassword` | 400 | Password check failed when deleting the account |
| `unauthorized` | 401 | No valid session |
| `forbiddenOrigin` | 403 | Missing `Origin` header or from another site |
| `emailTaken` | 409 | Username or email already registered |
| `tooManyRequests` | 429 | Strapi's rate limit |
| `unknown` | 502 | Any other Strapi failure |

## Drafts (editors)

| Route | Query | Returns | Errors |
| --- | --- | --- | --- |
| `GET /api/drafts` | `locale` (optional) | `DraftListResponse`, newest edit first | 404 for anyone who is not an editor |
| `GET /api/drafts/:documentId` | `locale` | `DraftArticleResponse`: the draft plus its published version, if any | 404 when missing or not an editor |

They use the editor's own JWT, never the API token, and answer `private, no-store`. Types: `app/interfaces/draft.ts`.

## Routes outside `/api`

| Route | Returns |
| --- | --- |
| `GET /feed.xml`, `/es/feed.xml` | RSS 2.0 of the latest articles in each language |
| `GET /feed/:category.xml`, `/es/feed/:category.xml` | RSS of one category; `404` for an unknown one |
| `GET /blog/category/:slug`, `/blog/tag/:slug`, `/blog/page/:n`, `/blog/category/:slug/page/:n`, `/blog/tag/:slug/page/:n` (and under `/es`) | The blog list with one filter (a category or a tag) and a page; `sort`, `view` and `search` stay in the query. Unknown category or page 0: `404`. Canonical is the path form; hreflang points at the first page of the filter in each language |
| `GET /blog?category=&tag=&page=` (and `/es/blog`), `/blog/**/page/1` | `301` to the path form (`server/middleware/blog-redirects.ts`, before the ISR handler); the category wins over the tag; other parameters are kept |
| `GET /sitemap.xml` | Every page and article with `hreflang` alternates |
| `GET /robots.txt` | Crawl rules and the sitemap URL |
| `/bd.js`, `/api/bd` | Umami tracker and collect endpoint, proxied by `server/middleware/umami.ts` when `NUXT_UMAMI_URL` is set |
