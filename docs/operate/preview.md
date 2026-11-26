# Preview drafts in the admin

The CMS admin can show a draft of an article or a page inside the editing screen, rendered by this site with its theme. This page is for the operator who turns it on. The decision and its reasons are [ADR 0019](../adr/0019-visual-editing-protocol.md); the plugin's side (the token, the grant and their routes) is in `docs/operate/preview.md` of `micelio-plugin-core`.

The preview is **off** until you set one variable.

## Turn it on

1. Set `NUXT_PREVIEW_ADMIN_ORIGIN` to the origin of the CMS admin, as the editors open it (`https://cms.example.com`). It is the only origin that may frame a draft, and it must be the origin the CMS binds in the grant: the site refuses a grant for another origin.
2. Give the frontend's API token the preview's permissions. On the CMS, set `MICELIO_PREVIEW=true` together with `FRONTEND_API_TOKEN` ([Preview](https://github.com/bogd3v/micelio-cms/blob/main/docs/operate/configure.md#preview) in the CMS's configuration): the token the CMS creates already carries `plugin::micelio.preview.draft`, and the switch adds `plugin::micelio.preview.exchange` on every boot. Do not add the exchange by hand to that token: the CMS resets it to its list on each boot. Only a token you created by hand needs both permissions added under Settings → API Tokens → Plugin: Micelio. Without them the CMS answers `403`, the preview answers `404` and the server logs `config.preview-token` with the permission it lacks. A `400` from the draft logs `config.preview-request` (the status only, no CMS text): the frontend and the CMS disagree on the draft request, so update the older one of the pair. `plugin::micelio.preview.draft` is needed even when the preview is off (step 1 skipped), because the CMS measures a draft through it at publish. The plugin must send `meta.actor` with the draft (`micelio-plugin-core` with the system grant, bogd3v/micelio-plugin-core#73): the draft routes and the weight route refuse an answer without it and log `config.preview-actor`.
3. In the CMS, give each site its `url` (this site's origin) and add the site to the admin's `frame-src` (`config/middlewares` of the distribution), as the plugin's host check says.
4. Restart the server. A value that is not an `http` or `https` origin turns the preview off, and the boot logs `config.preview-origin`.

## What it does

- `/_preview?token=…` is the route the admin's frame opens. It trades the one-use token for a grant with the CMS, keeps the grant in the `__Host-micelio_preview` cookie and redirects to the draft route without the token. A token that is used, expired or altered, a grant for another admin origin and a site with the preview off all answer the same `404`.
- The draft routes are `/drafts/<documentId>` for an article and `/drafts/pages/<documentId>` for a page (`/es/…` in Spanish). With the cookie they show the one document the grant names; with an editor session they work as before. Add `?mode=static` to show every island on its static alternative.
- A draft shown to a valid grant is the only response that allows framing: `frame-ancestors <NUXT_PREVIEW_ADMIN_ORIGIN>` and no `X-Frame-Options`. Every other response, the draft route without a grant and its errors included, keeps `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- A page draft shown in the admin's frame also reports where its blocks are
  and obeys the builder (ADR 0019,
  amendment of 2026-11-02):
  the page posts the box of every block and of the items inside it (`micelio:blocks`),
  the block under the pointer or clicked (`micelio:hovered`, `micelio:selected`),
  and the admin sends a selection, a hover,
  a gap between two blocks and unsaved text (`micelio:select`, `micelio:hover`, `micelio:insertGap`,
  `micelio:patch`).
  The admin draws the outlines; the page changes nothing of the site's styles
  and scrolls to a selected block without animation.
  A click inside a block selects it and does not follow its link.
  A patch changes the free text fields of a block (titles, texts, names, labels) and nothing else:
  links, images, addresses and the Markdown of a section are not patched,
  so they show after a save.
  An article draft reports no blocks yet.
- A token may carry a **theme override**, `<id>@<version>`, which the CMS binds to it like its other fields (ADR 0019, amendment of 2026-11-25; the Themes page of the admin asks for one, bogd3v/micelio-plugin-core#59). The frontend reads it from the exchange and, on every load of the draft route, from the CMS's draft read, never from the frame's address, a cookie or a message, and only for the editor's grant: the system grant of the weight report carries none. The draft response is rendered with that installed theme, for that response alone: its stylesheet under `/_t/<digest>/` (served while a preview names it, at most 15 minutes), its modes and messages. The active theme, `GET /api/theme/status`, public pages and their caches do not change, and nothing is installed, activated or evicted.
  - The theme is looked up in the built-in store at that version, then in the deployment store (`docs/themes/theme-store.md`). A theme in neither answers `409` `themeNotInstalled`, from `/_preview` (which then sets no cookie) and from the draft route.
  - A theme of the built-in store renders with its own slots. Any other renders the core's default slots (`app/theme/defaults/`): a code theme the image was not built with is previewed from its data only, and the response carries `X-Micelio-Theme-Preview: rebuild-required`, because activating it needs an image built with it (ADR 0009, section 4).
  - Each load of the draft route with the grant cookie asks the CMS for the draft's `meta` once before rendering, so a preview costs one more draft read per page load, override or not.
- A token may also carry **accent overrides**, one candidate accent per mode (`[{ mode, color }]`, the shape of the site's own field), which the full-screen customizer asks for (bogd3v/micelio-plugin-core#61; ADR 0019, amendment of 2026-11-25). They are read like the theme override, from the CMS's answers for the editor's grant only, and the draft response renders them in place of the site's saved accents, adjusted for contrast as the saved ones are (ADR 0005, section 8). A mode the theme does not have and any other value are ignored; nothing is saved, and public pages do not change. A CMS that does not send them previews the saved accents, as before.
- Every preview answer is `private, no-store` and `X-Robots-Tag: noindex, nofollow`. The routes are in no sitemap, feed or search index, and public pages do not change.
- `GET /api/preview/<content type>/<documentId>/weight` answers what the draft weighs (HTML, scripts, styles, fonts, images, and the script of its islands apart), per block, for the cost meter of the plugin. It takes the same grant cookie as the draft routes, and the system grant the CMS mints for itself to measure a draft at publish, in the `X-Micelio-Preview-Grant` header (bogd3v/micelio-plugin-core#46): that grant is used once, lives at most 60 seconds, names one version of one draft, frames nothing and works with the preview off. No other credential opens it (`docs/api.md`, `docs/performance.md`).
- The admin page reads that report from the browser with the editor's grant:
  a `fetch` with `credentials: 'include'` to the weight route.
  The route answers `Access-Control-Allow-Origin: <NUXT_PREVIEW_ADMIN_ORIGIN>`,
  `Access-Control-Allow-Credentials: true` and `Vary: Origin`
  when the request's `Origin` is exactly that origin,
  and no `Access-Control-*` header to any other origin or with the preview off.
  The card route and the contrast route do the same (below); no other route does.
  A `GET` with the cookie is a simple request, so there is no preflight,
  and the admin must not add a header to it.
  In WebKit the cookie does not reach a cross-site `fetch` either (see below),
  so the answer is the `404` the page can read.
- `GET /api/preview/<content type>/<documentId>/card` answers the social card of a draft: a PNG of
  1200 by 630 pixels with its title and the site name, in the theme's display font and colours,
  for a page that has no hero image.
  It is drawn on the server from the theme's own files, with no request to another host.
  It takes the grant cookie only, not the system grant.
  The admin page reads it with the same credentialed `fetch` as the report and stores it as
  media: the route sends the same CORS headers, to the admin origin only.
  Preview only: it is not the `og:image` of a published page (`docs/api.md`, "Social card of a
  draft").
- `GET /_micelio/contrast?documentId=<documentId>&accent=<mode>:<#RRGGBB>` answers the contrast
  matrix of the active theme, every pair with its ratio, minimum and result in each mode, with the
  candidate accents applied, for the Customize page of the plugin (bogd3v/micelio-plugin-core#60):
  the same AA result as `npm run theme:check`.
  It takes the grant cookie only, for the document it names, and the same CORS headers as the
  card route; anything else is a `404` (`docs/api.md`, "Contrast of the active theme").
- A static or landing site has no preview (the drafts module is off in those modes).

## The cookie in a cross-site frame

The admin and the site are different sites, so the grant cookie is `SameSite=None; Secure; Partitioned` (a partitioned cookie is kept for that admin only). Serve both over HTTPS. Chromium and Firefox send it in the admin's frame. WebKit (Safari) refuses it in a frame of another site, so there the frame shows the site's 404 page and never says `ready`. Two ways around it, measured in [ADR 0019](../adr/0019-visual-editing-protocol.md) (amendment of 2026-10-26):

- **Put the admin and the site on one registrable domain** (`cms.example.org` and `example.org`, under a suffix of the public suffix list). WebKit then sends the cookie in the frame and the preview works in place. `NUXT_PREVIEW_ADMIN_ORIGIN` stays the admin's full origin.
- **Open the preview in a new tab.** The plugin's pane is to offer this for a browser that refuses the cookie (decided in the amendment, not shipped yet): the draft opens as a page of the site, where the cookie is first-party. The tab does not follow the admin's saves; reload it to see one.
