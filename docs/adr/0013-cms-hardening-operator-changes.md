# ADR-0013: Record the operator-facing changes of the CMS hardening

**Status:** Accepted
**Date:** 2026-10-14
**Deciders:** BogDev maintainer

## Context

The ASVS review of the stack ([mapping](../security/asvs.md)) led `micelio-cms` to merge a series of changes to `main`. Most are internal, but eight change what an operator, a site editor or an integrator sees when they upgrade: a boot that stops, an email that is no longer sent, a request that is answered 400, a response field that is gone. These are contracts of section 6 of the [engineering standard](../engineering-standard.md) (the operator interface, the content API and the visitor-facing identifiers). Two of the pull requests carry `!` in their title and a `BREAKING CHANGE:` paragraph; the others were merged as plain `fix(security)`. The effect decides the bump, not the prefix (section 7), so this record lists all eight in one place and fixes what the release notes must say.

Decisions that span repositories are recorded in `micelio` (section 12). Nothing changes in this repository's code.

## Decision

Each change below is accepted as the new default behaviour of the CMS release line. The variable names are the operator interface; the values are those in the CMS `.env.example`.

1. **Production secrets are checked at boot.**
   - In production the CMS stops, naming each variable, when `APP_KEYS` (every key of the list), `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET` or `ENCRYPTION_KEY` is empty, a placeholder (`tobemodified`, `changeme`, with or without digits) or shorter than 32 characters. The message never prints a value.
   - With `DATABASE_CLIENT=postgres` and no `DATABASE_URL`, `DATABASE_PASSWORD` must be set and must not be `strapi`. The Compose file requires it too, and `.env.example` ships the secrets empty.
   - Outside production nothing is checked.
   - Affected: instances that kept the example values or generated short keys. Fix: `npm run generate:keys` in the CMS, and a database password of their own.
   - Rotation has effects. Changing `JWT_SECRET` signs every reader out. Changing `ENCRYPTION_KEY` makes the stored copies of API tokens unreadable, so rotate it only on an instance that never used the example one. Changing `API_TOKEN_SALT` changes how API tokens are hashed, so a token created by hand stops working and is created again; the tokens the CMS creates from `FRONTEND_API_TOKEN` and `BUILD_API_TOKEN` are rewritten at boot. Changing `ADMIN_JWT_SECRET` ends the admin panel sessions.
2. **SMTP requires TLS.** `SMTP_REQUIRE_TLS` is `true` by default. On a port other than 465 (which is always encrypted) the CMS refuses to send when the server does not offer `STARTTLS`. Only the value `false` (any case) turns it off. Affected: operators with a plaintext relay such as a local mail catcher or an internal relay; they set `SMTP_REQUIRE_TLS=false`, or move to a server with `STARTTLS` or to port 465.
3. **CORS allows the frontend origin only.** Without `CORS_ORIGINS`, only the origin of `FRONTEND_URL` is allowed (before, any origin). Credentials (cookies, `Authorization`) go only to listed origins; with `*` any origin is accepted but never with credentials. Affected: sites whose frontend is also served from another origin (`www` and the bare domain, a preview host) and that never set `CORS_ORIGINS`; they list every origin, comma separated.
4. **`populate` depth is limited.** A content API request that nests `populate` deeper than `POPULATE_MAX_DEPTH` (default 3) is answered 400. The frontend never asks for more: counting the levels the way the CMS does (every key, every segment of a dotted path, a dynamic zone fragment adds none), the deepest queries are the article, the About page and the page sections, all at 3; the post card is 2, the site settings 2, the tag and category lists 1. The check covers `POST_CARD_POPULATE`, `ABOUT_POPULATE`, `ARTICLE_POPULATE` (`server/lib/constants.ts`), `PAGE_POPULATE` (`server/utils/pageSections.ts`) and `SITE_POPULATE` (`server/utils/site.ts`). A custom frontend that needs more raises the variable.
5. **Admin sign-in is limited per account.** `RATE_LIMIT_ADMIN_IDENTIFIER` (default `10/900`: ten attempts in fifteen minutes) limits `POST /admin/login` per admin email, whatever the client address, next to the per-client `RATE_LIMIT_ADMIN_AUTH`. Past the limit the answer is 429. It is a new variable with a default; it is listed because an administrator who mistypes a password repeatedly now waits.
6. **Federation ids follow `URL`.** When `URL` is set, every actor, inbox, key and WebFinger id is built from its origin, not from the request headers. Unset (local development), the ids still follow the request. Affected: instances with federation on. Changing `URL` changes the ids, and remote servers key their follows by them, so `URL` must be the real public origin and must not change afterwards.
7. **Uploads are served as inert files.**
   - The upload plugin refuses `text/html` and `application/xhtml+xml`.
   - Every response under `/uploads` carries `X-Content-Type-Options: nosniff`.
   - Anything that is not a raster image, video, audio or PDF (an SVG, a text file) also gets a `Content-Security-Policy` with `sandbox` and `Content-Disposition: attachment`. As an `<img>` or `<video>` an upload renders as before; opened on its own it is downloaded.
   - Affected: editors who upload HTML files, and sites that link to an SVG or a text file in a new tab. A bucket on its own origin (`R2_*`) avoids the question.
8. **Logs and the comments API say less.** The request log writes the method, the path, the time and the status, never the query string. The public comments API no longer returns `author.email` on any comment, nested replies included; moderators still read it in the admin panel. A reverse proxy has its own access log and is configured by the operator.

## Options considered

- **Warn at boot instead of stopping (1, 2).** Operators do not read boot logs until something breaks, and the standard asks a missing required value to stop the boot (section 5). A warning for the secrets would leave public keys in production.
- **An escape variable for the secrets check (1).** One more name in the operator interface that defeats the control. Only SMTP gets one, because a trusted plaintext relay is a legitimate setup.
- **Keep CORS open and document `CORS_ORIGINS` (3).** The unset default is what most instances run; a safe default protects them without a step.
- **Fixed depth limit (4).** A variable costs one line and lets a custom frontend raise it. The default is the depth the frontend needs and no more.
- **Per-client limit only for the admin (5).** Many clients can guess one password; the account is the thing to protect, and the admin panel has no second factor.
- **Keep ids request-derived and document the proxy headers (6).** It leaves the ids dependent on headers a client can influence; `URL` is already required for background deliveries.
- **Accept HTML uploads behind the sandbox only (7).** No site needs HTML in the media library, and a refused type is simpler to reason about than a header on every path.
- **Plain `fix` without `!` for items 3 to 8.** Accurate for the code, but the operator reads release notes, not titles; the notes carry them either way.

## Trade-offs

An upgrade that used to be a pull of a new image becomes a pull plus a check of the environment: a short key, a plaintext relay or a second frontend origin shows up as a stopped boot, a missing email or a browser error. Items 3, 4 and 7 can only be seen by a request, not at boot. The cost is accepted because the alternative is a default that is open.

## Consequences

- All eight change the operator interface or a response (section 6). Before 1.0.0 that raises MINOR `y` (section 7). The pull requests of items 1 and 2 already carry `!` and a `BREAKING CHANGE:` paragraph, which sets the bump; the others merged as `fix(security)`, so their effect is written by hand.
- The release that ships them has an **Upgrade notes** section with one entry per item above: who is affected and what to do. A future pull request to `micelio-cms` that changes one of these behaviours carries `!` when the operator must act.
- The release notes state the release line of `micelio-cms` they were tested with (section 7).
- The frontend needs no change: its queries stay within `POPULATE_MAX_DEPTH`, it already drops the comment author's `email` from its public shape (`CommentAuthor` in `app/interfaces/comment.ts`), and its server calls the CMS directly, where CORS does not apply. The one browser call to the CMS, the 3D scene models, comes from the `FRONTEND_URL` origin, which stays allowed.
- `docs/operate/configure.md` here should point to the CMS variables when it names them; the CMS repository owns their reference (`.env.example`, `docs/operate/configure.md`, `docs/RATE_LIMITING.md`).
