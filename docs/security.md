# Security model

What the frontend trusts, which credentials it uses to reach Strapi, and how each endpoint is protected. The input and output of each endpoint are in [api.md](api.md). Keep it in sync when a route or a Strapi call changes.

## Credentials towards Strapi

The browser never talks to Strapi: every call goes through the Nitro server, built with `strapiUrl()` and, when it needs the API token, `strapiFetch()` (`server/utils/strapi.ts`).

| Credential | Where it comes from | Used for |
| --- | --- | --- |
| API token | `NUXT_STRAPI_API_TOKEN`, a **Custom** token created for this frontend | Content, comments, search, feeds and newsletter subscribers |
| None (public role) | — | Fediverse stats and ranking, the sitemap |
| User JWT | `bd_session` cookie (`httpOnly`, `secure`, `sameSite=lax`, 7 days), set at sign-in | `/api/users/me` (profile and account deletion) |
| Editor JWT | Same cookie, for a user with the Editor role | Draft list and draft preview |
| None | — | Sign-in, registration, password reset and email confirmation (`/api/auth/*` in Strapi) |

### Permissions of the API token

Create a **Custom** token, never Full Access or Read Only, with exactly these permissions:

| Content type / plugin | Actions | Why |
| --- | --- | --- |
| Article | `find` | Blog list, article page (looked up by slug), reading path, RSS feeds. The search route (`/api/articles/search`) is public in the backend and needs no permission |
| Category, Tag | `find` | Filters and counts |
| About | `find` | About page |
| Site-setting | `find` | Site identity and modules (`/api/site`, RSS feeds, newsletter emails). Without it Strapi answers 403 and everything falls back to `app.config.ts` |
| Comments (plugin) | read (hierarchy and flat), create | Comment threads and guest comments |
| Subscriber | `find`, `create`, `update`, `delete` | Newsletter: subscribe, confirm, unsubscribe |

`update` on Subscriber is easy to miss: without it a subscription is created but confirming it fails with a 500.

The token is a server-side secret. It must only be set as `NUXT_STRAPI_API_TOKEN`: plain `STRAPI_API_TOKEN` is ignored at runtime, and the server logs `Missing runtime settings` at startup when it is empty. Rotate it in Strapi (Settings → API Tokens) if it is ever printed or shared, and delete tokens nobody uses.

### What the public role must allow

The anonymous calls need, and should only get: `find` on Article (sitemap); the fediverse stats and ranking routes are public by design in the backend. Subscribers and users must stay closed to the public role (403); check it with:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.bogdev.com.co/api/subscribers   # 403
curl -s -o /dev/null -w '%{http_code}\n' https://api.bogdev.com.co/api/users         # 403
```

## Frontend endpoints

Every request body and query is validated with a zod schema (`server/schemas/`) or an equivalent check before any call to Strapi; unknown fields are dropped.

The routes of a module switched off in `site-setting.modules`, or off for lack of configuration, answer 404 before any of these checks (`server/middleware/modules.ts`, docs/api.md "Modules"). Turning a module off is therefore also a way to close its endpoints.

| Endpoint | Access | Protections |
| --- | --- | --- |
| `GET /api/posts`, `/api/posts/:slug`, `/api/search`, `/api/categories`, `/api/tags`, `/api/about`, `/api/reading-path`, `/api/site` | Public | Query schema: known locales only, `pageSize` ≤ 50, slugs, search ≤ 200 chars |
| `GET /api/comments`, `/api/comments/flat` | Public | Relation must be `api::article.article:<id>`; pagination and sort validated; email and hidden comments never returned |
| `POST /api/comments` | Public | Same-origin check, 10 per IP every 10 min, allow-listed fields and lengths, author id set by the server |
| `GET /api/fediverse/stats`, `/api/fediverse/stats/:documentId` | Public | Document id pattern, at most 50 ids |
| `POST /api/newsletter/subscribe` | Public | Same-origin check, 10 per IP and 3 per email every hour, same answer for new and confirmed addresses |
| `GET /api/newsletter/confirm`, `POST /api/newsletter/unsubscribe` | Holder of the emailed token | Token format check; unsubscribe also accepts RFC 8058 one-click POSTs from mail providers, so it has no origin check |
| `POST /api/auth/login`, `register`, `forgot-password`, `reset-password`, `resend-confirmation`, `logout` | Public | Same-origin check, body schema, `no-store`; Strapi rate-limits the auth routes |
| `GET /api/auth/me` | Session | `no-store` |
| `DELETE /api/auth/me` | Session + password | Same-origin check, username and password re-checked by Strapi |
| `GET /api/drafts`, `/api/drafts/:documentId` | Editor | Answers 404, not 403, to anyone else; `no-store` |
| `/feed.xml`, `/feed/*.xml`, `/sitemap.xml`, `/robots.txt` | Public | Read only |

Rate limits are in memory (`server/utils/rateLimit.ts`): they reset when the container restarts and are per instance. The client IP comes from `X-Forwarded-For`, which is safe only because Traefik replaces it; if a CDN or another proxy is put in front, revisit `clientIp()`.

## Browser-side protections

- **Security headers** on every response (`SECURITY_HEADERS` in `app/helpers/securityHeaders.ts`): HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP.
- **Content Security Policy** on every page, built in `server/plugins/contentSecurityPolicy.ts` from the rendered HTML: each inline script is allowed by its SHA-256, so `script-src` has no `'unsafe-inline'`. Images: the site, Strapi and `NUXT_MEDIA_URL`; frames: YouTube and Vimeo only. To allow a new image or embed domain, add it to `contentSecurityPolicy()` and to the `sanitize-html` options in `app/helpers/markdown.ts` together.
- **Theme init script** (`modules/theme/init-script.mjs`): one inline script in `<head>` that sets `data-theme` and `data-scheme` before first paint. It is generated once per build from the active theme's modes (at most 6, so it stays under 2 KB), so its CSP hash is the same on every page and changes only between builds; no request data (locale, stored value, Strapi value) enters it. It only reads `localStorage` and never writes. Mode ids are limited to `[\w-]` because they go into the inline script, the CSS selectors and the `<html>` attributes. For #239: a Strapi `defaultMode` must be checked against the mode list on the server, and dropped if it does not match, before it is written to `data-mode-default`. The server writes the first mode's `data-theme` and `data-scheme` into `<html>` in `server/plugins/themeMode.ts`; the script ignores that value, so the system preference still wins on a first visit.
- **Rich text** from Strapi is rendered on the server with `marked` and always passed through `sanitize-html` before it leaves the API (`app/helpers/markdown.ts`, used by the post, about and draft routes). If rendering fails, the text is escaped, never passed through. The three `v-html` lint warnings point at that sanitized `html`.
- **Cookies**: only `bd_session`, and only after signing in.

## Themes

- **Build-time, operator-trusted.** `NUXT_PUBLIC_THEME` and `MICELIO_THEME_DIRS` are read by `modules/theme` at build. Whoever controls them controls the CSS and fonts that ship; they are not user input. Even so, the theme's `images/` is filtered when it is copied (below).
- **`/theme/images/`** is the active theme's `images/` copied into the build (`<buildDir>/micelio/public/theme/images/`) and served same-origin as static files; `/_ipx` (`<NuxtImg>`) reads the same copy. Only `png`, `jpg`, `jpeg`, `webp`, `avif`, `gif` and `svg` files are copied (others are skipped with a warning) and a symlink fails the build, so nothing outside the theme directory can be published. The static files carry `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, so an SVG opened directly runs no script and loads nothing; as an `<img>` or through `/_ipx` it renders as usual.
- **Theme messages** (`themes/<id>/i18n/*.json`) are trusted text from the repository. They are compiled at build like the core locales and rendered escaped by `t()` and `<i18n-t>`, never through `v-html`.
- **Startup check.** `runtimeConfigCheck` throws if the runtime `NUXT_PUBLIC_THEME` differs from the build, in production and in dev.
- **`/fonts/`** is the active theme's `fonts/` served as static, same-origin files; the security headers are unchanged and no CSP source is added.
- **Trust model.** A theme is installed by the operator, and its slots are Vue code that runs at build time and during server rendering, with the privileges of the app. The validator below is a **contract lint**: it catches mistakes and keeps themes inside the contract (hooks, layers, assets), but it does not sandbox code. The **CSP** (ADR 0004: `img-src`, `font-src`, `style-src`, `script-src` hashes) is the boundary for what a page can load in a visitor's browser. Install only themes you trust, as you would an npm dependency.
- **The contract validator** (`modules/theme/contract.ts`, `validate.ts`, `css-rules.ts`, `island.ts`, `files.ts`) runs at build on every installed theme, not only the active one, and fails the build naming the theme and the problem. It rejects theme ids that are not `[a-z0-9-]+` or differ from the folder, duplicate ids, unknown keys, font files that are not plain `.woff2` names or are missing, image roles that are not files of `images/`, token names and mode ids outside `[\w-]`, role values containing `; { } < > @ !`, a backslash, a backtick, `/*`, `url(`, `image-set(`, `src(` (and quotes, outside font stacks), and symlinks or files that resolve outside the theme folder for its stylesheets and slot components. The role CSS generated from `theme.json` goes through the same CSS checks as the theme's own stylesheets.
- **Theme CSS** (`theme.css`, `slots/*.css`, `fonts.css`, `font-fallbacks.css` and the local files they `@import`) is parsed with Lightning CSS and rejected for: a `bd-*` class or core `data-*` attribute that is not a public hook (`app/theme/hooks.json`; selectors are walked in every nested list, including `:is()`, `:not()`, `:has()`, `:host()`, `::slotted()` and `nth-child(… of …)`, and a `[class…="bd-…"]` selector is flagged), `!important`, a remote `@import` or one that leaves the theme folder, and any `url()`, or string inside `image-set()` or `src()`, that is not a `/fonts/…` or `/theme/images/…` path (or a `#fragment`) without `..` segments or encoded dots, slashes or backslashes, in declarations, custom properties and `@property` initial values. This keeps what a theme's stylesheet asks the browser to load inside its own package, which is also what the CSP allows. Slot components (`slots/*.vue`) may not contain a `<style>` block (it would be bundled outside the `bd.theme` layer, and their CSS belongs in `slots/*.css`), and a slot that does not declare `island` is rejected for event handlers, `v-model`, object or dynamic `v-bind`, `onX` props, lifecycle hooks (composition and Options API), `useState`, `watch*`, timers and `addEventListener`. That last check is a lint over the slot's own file, not over what it imports; the slot's code is otherwise reviewed with the theme like any dependency.

## Dependencies

- CI fails on any **critical** `npm audit` finding. High stays allowed while the remaining ones (`node-forge` through the Nuxt dev server, `esbuild`) have no fixed release and do not reach the production image.
- Dependabot alerts and security updates are on; weekly update PRs come grouped. Major updates of Node and `@types/node` are ignored on purpose: the runtime is distroless Node 22, and moving to a new major is done by hand in both Docker stages and the CI.
- GitHub Actions are pinned by commit SHA.
