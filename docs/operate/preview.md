# Preview drafts in the admin

The CMS admin can show a draft of an article or a page inside the editing screen, rendered by this site with its theme. This page is for the operator who turns it on. The decision and its reasons are [ADR 0019](../adr/0019-visual-editing-protocol.md); the plugin's side (the token, the grant and their routes) is in `docs/operate/preview.md` of `micelio-plugin-core`.

The preview is **off** until you set one variable.

## Turn it on

1. Set `NUXT_PREVIEW_ADMIN_ORIGIN` to the origin of the CMS admin, as the editors open it (`https://cms.example.com`). It is the only origin that may frame a draft, and it must be the origin the CMS binds in the grant: the site refuses a grant for another origin.
2. Give the frontend's API token two more permissions in the CMS (Settings → API Tokens → Plugin: Micelio): `plugin::micelio.preview.exchange` and `plugin::micelio.preview.draft`. Without them the CMS answers `403`, the preview answers `404` and the server logs `config.preview-token` with the permission it lacks. The token that `micelio-cms` creates does not have them yet: add them by hand.
3. In the CMS, give each site its `url` (this site's origin) and add the site to the admin's `frame-src` (`config/middlewares` of the distribution), as the plugin's host check says.
4. Restart the server. A value that is not an `http` or `https` origin turns the preview off, and the boot logs `config.preview-origin`.

## What it does

- `/_preview?token=…` is the route the admin's frame opens. It trades the one-use token for a grant with the CMS, keeps the grant in the `__Host-micelio_preview` cookie and redirects to the draft route without the token. A token that is used, expired or altered, a grant for another admin origin and a site with the preview off all answer the same `404`.
- The draft routes are `/drafts/<documentId>` for an article and `/drafts/pages/<documentId>` for a page (`/es/…` in Spanish). With the cookie they show the one document the grant names; with an editor session they work as before. Add `?mode=static` to show every island on its static alternative.
- A draft shown to a valid grant is the only response that allows framing: `frame-ancestors <NUXT_PREVIEW_ADMIN_ORIGIN>` and no `X-Frame-Options`. Every other response, the draft route without a grant and its errors included, keeps `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- Every preview answer is `private, no-store` and `X-Robots-Tag: noindex, nofollow`. The routes are in no sitemap, feed or search index, and public pages do not change.
- A static or landing site has no preview (the drafts module is off in those modes).

## The cookie in a cross-site frame

The admin and the site are different sites, so the grant cookie is `SameSite=None; Secure; Partitioned` (a partitioned cookie is kept for that admin only). Serve both over HTTPS. A browser that blocks third-party cookies for a partitioned cookie too shows the admin the plain "preview unavailable" state of the plugin; which browsers do is recorded in the pull request that added the preview and in ADR 0019, section 7.
