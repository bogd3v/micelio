# ADR-0014: Record the second batch of operator-facing CMS changes

**Status:** Accepted
**Date:** 2026-10-14
**Deciders:** BogDev maintainer

## Context

[ADR 0013](0013-cms-hardening-operator-changes.md) recorded eight operator-facing changes of the CMS hardening. A second batch has been merged to `micelio-cms` `main` since. Like the first, most of it is internal, but seven changes alter what an operator or an integrator sees on upgrade: a boot that stops, a command that no longer works, a header that is no longer followed, a request answered 400, a cache header on a route. They are contracts of section 6 of the [engineering standard](../engineering-standard.md) (the operator interface and the content API). The effect decides the bump, not the prefix (section 7), so this record lists them in one place and fixes what the release notes must say.

This record complements 0013 and does not rewrite it. Item 4 below extends its item 4. [ADR 0011](0011-refuse-plain-http-upstreams.md) applies the same rule to the frontend's own calls to the CMS and Umami; item 1 applies it to the calls the CMS makes. Decisions that span repositories are recorded in `micelio` (section 12). Nothing changes in this repository's code.

## Decision

Each change below is accepted as the new default behaviour of the CMS release line. The variable names are the operator interface; the values are those in the CMS `.env.example` and `docs/operate/configure.md`.

1. **Plain http towards Umami and the rebuild hook stops the boot.**
   - In production the CMS stops, naming the variable, when `UMAMI_URL` or `REBUILD_HOOK_URL` is `http://` and its host is public. The API key and the hook's bearer token would otherwise cross the network in the clear.
   - `https://` is always accepted. `http://` is accepted on a private network: a loopback or private address, `localhost`, a name without a dot (a Compose service such as `http://umami:3000`) or a name ending in `.internal`, `.local` or `.localhost`.
   - There is no variable that turns the check off.
   - Affected: instances that reach a public Umami or hook over `http://`. Fix: use `https://`, or an address on the private network.
   - Breaking: it carries `!`.
2. **Strapi's remote data transfer is off.**
   - `STRAPI_REMOTE_TRANSFER_ENABLED` is `false` by default. Strapi enables the transfer unless told otherwise; with it off, `/admin/transfer` answers 404 and `strapi transfer` from another instance cannot pull or push. Local `strapi export` and `strapi import` need no setting.
   - The image ships only `scripts/demo-secrets.js` and `scripts/generate-keys.js`; the seed, repair, backup and CI scripts are not in it.
   - Affected: operators who migrate between instances with `strapi transfer`, and anyone who ran the other scripts inside the container. Fix: set `STRAPI_REMOTE_TRANSFER_ENABLED=true` for the time of the migration and back to `false` after; back up with `pg_dump` and the uploads volume.
   - Breaking: it carries `!`.
3. **Forwarded scheme and host come from trusted peers only.**
   - `X-Forwarded-Proto` and `X-Forwarded-Host` are followed only when the connection comes from a peer `TRUST_PROXY` trusts (a private address by default). From any other peer the CMS uses the real scheme and the `Host` header.
   - Affected: a proxy on a non-private network that is not listed in `TRUST_PROXY`; generated URLs would use `http` and the internal host. Fix: list it in `TRUST_PROXY` (a hop count or CIDR ranges).
   - Also affected: `TRUST_PROXY=false` with `TRUST_PROXY_PROTOCOL=true` used to follow the headers from anyone and now ignores them. `TRUST_PROXY_PROTOCOL=false` still turns the headers off altogether.
4. **The depth limit covers `filters` and `sort`.** `POPULATE_MAX_DEPTH` (default 3) limited only `populate`; it now limits `filters` and `sort` too, and a deeper request is answered 400. In `filters` each relation key is a level and operators such as `$and`, `$or`, `$eq` and `$in` are not; in `sort` each dotted segment is. The frontend stays within it: the deepest filter it sends is `category.slug.$eq` (and `tags.slug.$eq`), which is 2, and its sorts (`publishedAt`, `pathOrder`) are 1. The check covers the queries of `server/api/` and `server/utils/` (`posts`, `reading-path`, `feed`, `pageSections`, `subscribers`, `tags`, `categories`). A custom frontend that needs more raises the variable.
5. **Telemetry and the admin survey are off by default.**
   - Strapi's telemetry is off through `strapi.telemetryDisabled` in the CMS `package.json`, and the in-admin satisfaction survey through `FLAG_NPS=false`. The CMS makes no request to Strapi's analytics host unless the operator opts in.
   - Opting in is the operator's decision: `FLAG_NPS=true` turns the survey on; telemetry is turned on by removing `telemetryDisabled` before building the image (`STRAPI_TELEMETRY_DISABLED` can only switch it off).
   - Affected: nobody has to act; a site that relied on the old defaults loses only those two reports.
6. **Sensitive routes are not cached; federation answers carry security headers.**
   - The CMS answers `Cache-Control: private, no-store` on `/api/auth*`, `/api/users/me*`, `/api/site-settings*`, `/api/subscribers*` and on any content API read with `status=draft`. Public content stays cacheable.
   - Federation responses carry `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` and a frame restriction (`X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'`).
   - The frontend does not depend on caching those routes. It reaches them through `strapiFetch()`, which keeps no HTTP cache of CMS answers; what it caches is its own output (Nitro ISR, [ADR 0001](0001-isr-without-cdn.md), and `Cache-Control` on its own routes). It reads its site identity from `/api/site-setting` (the single type, singular), which is not under the `/api/site-settings` prefix and is not affected; the cache of `loadSiteCached` is in-process. The draft preview calls `status=draft` per request and must not be cached anyway.
   - Affected: an operator who put a CDN or proxy cache in front of the CMS for those routes. Fix: nothing; they were never meant to be shared.
7. **The local uploads provider warns in production.** With `NODE_ENV=production` and the local provider, the CMS logs one `[uploads]` warning at boot and keeps starting. The recommendation is object storage (the `R2_*` variables) or another hostname, so that an upload is not served from the admin origin. Setting `R2_BUCKET` removes the warning; there is no setting to silence it otherwise. Warning only: nothing stops.

## Options considered

- **An escape variable for the plain http check (1).** It defeats the control, as 0013 argued for the secrets check. A private address is already allowed for the legitimate case, so the variable would only serve a public host over plain http.
- **Warn instead of stopping (1).** Operators do not read boot logs until something breaks, and the standard asks an unsafe configuration to stop the boot (section 5).
- **Leave the transfer on and document the token (2).** Nothing in the install guides uses it, and it exposes the whole database to a token created in the admin panel. A one-line switch costs less than a default that is open.
- **Trust the forwarded headers from anywhere when the proxy is unknown (3).** It lets a client choose the scheme and host the CMS builds URLs from. `TRUST_PROXY` already names the proxies.
- **A separate depth variable for `filters` and `sort` (4).** One number is easier to reason about, and the frontend needs no more than 2 in them.
- **Telemetry on, documented off switch (5).** Section 9 of the standard asks for the minimum of data and no request nobody asked for.
- **`no-store` on every API route (6).** The frontend and a CDN rely on public content being cacheable; only per-user and token-only routes are marked.
- **Refuse to boot with the local provider in production (7).** Small and self-hosted setups use it legitimately; a warning names the risk without breaking them.

## Trade-offs

Items 1 and 2 stop an upgrade or a workflow, and item 3 changes generated URLs only for a proxy outside the private ranges, which shows up as wrong links, not as an error. Item 4 can only be seen by a request, not at boot. The cost is accepted because the alternative is a default that is open or a header a client controls. Items 5 and 7 cost the operator nothing; they are listed so that the absence of a report or the presence of a warning is not a surprise.

## Consequences

- All seven change the operator interface or a response (section 6). Before 1.0.0 that raises MINOR `y` (section 7). Items 1 and 2 are breaking and their pull requests carry `!` and a `BREAKING CHANGE:` paragraph; the others are written by hand in the notes.
- The release that ships them adds one entry per item to its **Upgrade notes** section, next to the eight of [ADR 0013](0013-cms-hardening-operator-changes.md): who is affected and what to do.
- A future pull request that changes one of these behaviours carries `!` when the operator must act (a new refusal at boot, a removed or renamed variable, a default that turns something off that sites used), and a plain `fix` or `feat` when nobody has to do anything.
- The frontend needs no change. Its queries stay within `POPULATE_MAX_DEPTH`, it does not cache the routes of item 6, and it sends no `status=draft` read that a shared cache would hold.
- The CMS repository owns the reference of these variables (`.env.example`, `docs/operate/configure.md`, `docs/RATE_LIMITING.md`). `docs/security.md` in this repository describes the token permissions only and does not change.
