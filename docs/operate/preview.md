# Preview drafts in the admin

The CMS admin can show a draft of an article or a page inside the editing screen, rendered by this site with its theme. This page is for the operator who turns it on. The decision and its reasons are [ADR 0019](../adr/0019-visual-editing-protocol.md); the plugin's side (the token, the grant and their routes) is in `docs/operate/preview.md` of `micelio-plugin-core`.

The preview is **off** until you set one variable.

## Turn it on

1. Set `NUXT_PREVIEW_ADMIN_ORIGIN` to the origin of the CMS admin, as the editors open it (`https://cms.example.com`). It is the only origin that may frame a draft, and it must be the origin the CMS binds in the grant: the site refuses a grant for another origin.
2. Give the frontend's API token the preview's permissions. On the CMS, set `MICELIO_PREVIEW=true` together with `FRONTEND_API_TOKEN` ([Preview](https://github.com/bogd3v/micelio-cms/blob/main/docs/operate/configure.md#preview) in the CMS's configuration): the token the CMS creates already carries `plugin::micelio.preview.draft`, and the switch adds `plugin::micelio.preview.exchange` on every boot. Do not add the exchange by hand to that token: the CMS resets it to its list on each boot. Only a token you created by hand needs both permissions added under Settings → API Tokens → Plugin: Micelio. Without them the CMS answers `403`, the preview answers `404` and the server logs `config.preview-token` with the permission it lacks. `plugin::micelio.preview.draft` is needed even when the preview is off (step 1 skipped), because the CMS measures a draft through it at publish. The plugin must send `meta.actor` with the draft (`micelio-plugin-core` with the system grant, bogd3v/micelio-plugin-core#73): the draft routes and the weight route refuse an answer without it and log `config.preview-actor`.
3. In the CMS, give each site its `url` (this site's origin) and add the site to the admin's `frame-src` (`config/middlewares` of the distribution), as the plugin's host check says.
4. Restart the server. A value that is not an `http` or `https` origin turns the preview off, and the boot logs `config.preview-origin`.

## What it does

- `/_preview?token=…` is the route the admin's frame opens. It trades the one-use token for a grant with the CMS, keeps the grant in the `__Host-micelio_preview` cookie and redirects to the draft route without the token. A token that is used, expired or altered, a grant for another admin origin and a site with the preview off all answer the same `404`.
- The draft routes are `/drafts/<documentId>` for an article and `/drafts/pages/<documentId>` for a page (`/es/…` in Spanish). With the cookie they show the one document the grant names; with an editor session they work as before. Add `?mode=static` to show every island on its static alternative.
- A draft shown to a valid grant is the only response that allows framing: `frame-ancestors <NUXT_PREVIEW_ADMIN_ORIGIN>` and no `X-Frame-Options`. Every other response, the draft route without a grant and its errors included, keeps `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- Every preview answer is `private, no-store` and `X-Robots-Tag: noindex, nofollow`. The routes are in no sitemap, feed or search index, and public pages do not change.
- `GET /api/preview/<content type>/<documentId>/weight` answers what the draft weighs (HTML, scripts, styles, fonts, images, and the script of its islands apart), per block, for the cost meter of the plugin. It takes the same grant cookie as the draft routes, and the system grant the CMS mints for itself to measure a draft at publish, in the `X-Micelio-Preview-Grant` header (bogd3v/micelio-plugin-core#46): that grant is used once, lives at most 60 seconds, names one version of one draft, frames nothing and works with the preview off. No other credential opens it (`docs/api.md`, `docs/performance.md`).
- The admin page reads that report from the browser with the editor's grant: a `fetch` with `credentials: 'include'` to the weight route. The route answers `Access-Control-Allow-Origin: <NUXT_PREVIEW_ADMIN_ORIGIN>`, `Access-Control-Allow-Credentials: true` and `Vary: Origin` when the request's `Origin` is exactly that origin, and no `Access-Control-*` header to any other origin or with the preview off. It is the only route that does. A `GET` with the cookie is a simple request, so there is no preflight, and the admin must not add a header to it. In WebKit the cookie does not reach a cross-site `fetch` either (see below), so the answer is the `404` the page can read.
- A static or landing site has no preview (the drafts module is off in those modes).

## The cookie in a cross-site frame

The admin and the site are different sites, so the grant cookie is `SameSite=None; Secure; Partitioned` (a partitioned cookie is kept for that admin only). Serve both over HTTPS. Chromium and Firefox send it in the admin's frame. WebKit (Safari) refuses it in a frame of another site, so there the frame shows the site's 404 page and never says `ready`. Two ways around it, measured in [ADR 0019](../adr/0019-visual-editing-protocol.md) (amendment of 2026-10-26):

- **Put the admin and the site on one registrable domain** (`cms.example.org` and `example.org`, under a suffix of the public suffix list). WebKit then sends the cookie in the frame and the preview works in place. `NUXT_PREVIEW_ADMIN_ORIGIN` stays the admin's full origin.
- **Open the preview in a new tab.** The plugin's pane is to offer this for a browser that refuses the cookie (decided in the amendment, not shipped yet): the draft opens as a page of the site, where the cookie is first-party. The tab does not follow the admin's saves; reload it to see one.
