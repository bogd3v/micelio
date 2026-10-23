# ADR-0019: The visual editing protocol between the admin and the frontend

**Status:** Accepted
**Date:** 2026-10-23
**Deciders:** Micelio maintainer

## Context

The builder planned in [ADR-0017](0017-distribution-plugins-multisite-editorial.md) shows the editor the page while they compose it. A page is a sequence of blocks with a stable id, a closed set of options and a static alternative ([ADR-0018](0018-blocks-as-a-contract.md)). The admin is Strapi's (React, on the CMS origin). The pages are the frontend's: Vue, rendered on the server, styled by the active theme ([ADR-0005](0005-theme-contract.md)), with Markdown sanitized on the server ([engineering standard](../engineering-standard.md), section 9) and a Content Security Policy built from hashes ([ADR-0004](0004-hash-based-csp.md)). Showing the page while editing makes the two talk to each other. The format of that conversation, how the preview is authenticated and the CSP that lets one origin frame the other are expensive to change once the builder ships.

What exists today:

- **Drafts.** `/drafts/[documentId]` renders an article draft for a reader with the Editor role. `server/api/drafts/` fetches it from the CMS with the editor's own JWT from the session cookie, never with the site's API token. A missing session or a refusal answers the same 404, and every answer is `private, no-store` ([ADR-0003](0003-session-in-httponly-cookie.md)). Pages have no draft route.
- **Who edits.** The session of [ADR-0003](0003-session-in-httponly-cookie.md) belongs to a users-permissions user. People in the Strapi admin are admin users, a separate table with its own authentication, so an editor working in the admin has no frontend session.
- **Framing.** Every response sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` ([ADR-0004](0004-hash-based-csp.md), amendment of 2026-10-13). The session cookie is `__Host-`, `Secure` and `SameSite=Lax`. A browser does not send it in a cross-site frame, and browsers block or partition third-party cookies.
- **Host configuration.** The admin's own CSP is set by the `strapi::security` middleware in `config/middlewares`. That file belongs to the distribution, and a plugin cannot set it ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 3 and the amendment of 2026-10-23).

Micelio is `0.y` and not stable (standard, section 7, "Before 1.0.0"). This record decides the protocol and its security before any of it is built. It is part of epic bogd3v/micelio-plugin-core#1, and the builder that implements it is in the next epic (release line `0.7`).

## Decision

### 1. The frontend is the only renderer

The admin never renders a block. What the editor sees is the frontend's own output: the same components, the active theme, the server-side sanitizer and the CSP that visitors get. The admin holds the form state (the fields, the order of the blocks, the options) and the frontend shows what has been saved. No block's markup, CSS or Markdown rendering is written a second time in the admin, and no HTML from the frontend is injected into the admin's document.

### 2. The preview is the draft route in an iframe

A Micelio admin page shows the frontend's draft route for the document being edited in an `<iframe>`. That page is either a page of the core plugin or a panel of Strapi 5's Preview feature, and the spike of section 7 decides which. The route is `/drafts/[documentId]` for articles, and pages gain an equivalent in builder phase 1 (section 6). The iframe has a fixed `src` on the site's origin (`site.url`, [ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 4). The editor's view is a real page load, with its own document, the theme's stylesheet and the islands' static alternatives.

The preview shows the **saved** draft. Saving in the admin writes the draft through the content API and then tells the iframe to load it again (`load-draft`, section 4). The frontend never renders content it receives by message. Rendering it would move Markdown rendering and sanitizing into the browser and outside the server, against section 9 of the standard.

### 3. A short-lived preview grant authenticates the iframe

The rules of [ADR-0003](0003-session-in-httponly-cookie.md) for drafts hold: a draft is fetched with a credential of the person who asked for it, never with the site's API token alone, every answer is `private, no-store` and a refusal is the same 404 as a missing draft. In the admin the credential cannot be the frontend session, which belongs to a different kind of user and does not reach a cross-site frame. The credential is a preview grant:

1. The admin page asks the plugin, through an admin-authenticated route, for a **preview token**. The token is random and opaque (not a JWT), used once and valid for 60 seconds. It is bound to the admin user, the site, the content type, the `documentId`, the locale and the admin's origin. The CMS stores only its hash.
2. The iframe loads `/_preview?token=…` on the frontend. That server route sends the token to the plugin, together with the frontend's own API token (the site authenticates itself, and the token authenticates the editor). The plugin checks it, marks it used and answers with a **grant**: an opaque value valid for 15 minutes, bound like the token and stored hashed in the CMS. Before answering, the plugin checks again that the admin user may read that document.
3. The frontend stores the grant in a `__Host-micelio_preview` cookie (`HttpOnly`, `Secure`, `SameSite=None`, `Partitioned`, `Path=/`, lasting as long as the grant). It then answers `303` to the draft route without the token, so the token never stays in the frame's history or in a `Referer`.
4. The draft route accepts the editor session of [ADR-0003](0003-session-in-httponly-cookie.md), as today, or the grant. With the grant it fetches the draft from a preview route of the plugin that serves only the document the grant names. When the grant expires, the admin page asks for a new token and reloads the iframe. Logging out of the admin, or losing the right to read the document, revokes every grant of that user and document.

Tokens and grants never appear in a log, a problem detail or a message (standard, section 4). Both routes are rate limited (standard, section 9).

### 4. Messages

The admin page and the frame talk only through `window.postMessage`. Every message is an envelope `{ v: 1, type, payload }`. A sender always names the receiver's exact origin, never `'*'`. A receiver drops a message whose `origin` is not the one it expects (the frontend expects the admin origin bound in the grant, and the admin expects the origin of `site.url`), whose `source` is not the window it expects, or whose envelope or payload fails its schema. An unknown `type` is ignored, so a newer peer can add messages. A message never carries a token, a grant or content.

A block is addressed by `{ zone, index, block, version }`: the dynamic zone (`sections`, `blocks`), its position in that zone, its catalogue id ([ADR-0018](0018-blocks-as-a-contract.md), section 1) and the `updatedAt` of the draft the frame shows. Strapi's component ids are not used, because a save may recreate them (section 7 checks this). A message whose `version` is not the current one is dropped, so a reorder that crosses a reload cannot move the wrong block.

| `type` | From → to | `payload` | Phase |
| --- | --- | --- | --- |
| `ready` | frame → admin | The `v` values the frame speaks, `documentId`, `locale`, `version` | 1 |
| `load-draft` | admin → frame | `documentId`, `locale`: reload the draft after a save | 1 |
| `block-hover` | frame → admin | The address of the block under the pointer, or `null` | 2 |
| `block-select` | frame → admin | The address of the block the editor clicked | 2 |
| `select-block` | admin → frame | An address: outline that block, or `null` to clear | 2 |
| `scroll-to-block` | admin → frame | An address: bring that block into view | 2 |
| `drag` | admin → frame | `start` with the address being moved, or `end` | 2 |
| `drop-target` | frame → admin | During a drag, the address the block would land before, or `null` for the end of the zone | 2 |

The frame never edits content. A click or a drop becomes a message, the admin changes its form state and saves, and `load-draft` shows the result. The outlines and the drop marker are drawn by a preview script and stylesheet of the frontend, loaded only on a preview response as `'self'` files (no inline script, no new hash). They are internal and themes do not style them.

The message schemas are zod, in `contract/preview.ts` of `micelio-plugin-core`, next to the block catalogue. A JSON Schema is generated from them and checked for drift, as for blocks ([ADR-0018](0018-blocks-as-a-contract.md), section 3). The frontend validates against that schema. A breaking change to a message raises `v`. The admin speaks the `v` of its own release and of the previous MINOR, because the CMS of a release line serves the frontend of the previous one (standard, section 7). When `ready` lists no `v` the admin speaks, the admin shows that the frontend must be upgraded and keeps a plain preview. Adding a message type or an optional field is a MINOR of the plugin core.

### 5. Block markers and CSP

**Markers.** On a preview response only, the frontend renders each block's root element with `data-myc-block="<id>"`, the catalogue id, and `data-myc-index="<position>"`, and marks the zone with `data-myc-zone="<zone>"`. These attributes are internal. They are not public hooks of [ADR-0005](0005-theme-contract.md), they never appear in public or cached HTML, and `theme:check` refuses a theme selector that names them. Public markup does not change.

**The draft route.** A response that carries a valid grant sends `frame-ancestors <admin origin>` instead of `'none'` and no `X-Frame-Options`. Every other response keeps `'none'` and `DENY`, including the draft route opened without a grant and its errors. The admin origin comes from configuration, a new optional variable of the frontend that `cspOrigin()` checks ([ADR-0004](0004-hash-based-csp.md)), and must match the origin bound in the grant. Without it the preview is off and `/_preview` answers 404. `contentSecurityPolicy()` gains a `frameAncestors` option whose default keeps today's policy byte for byte. The rest of the page's policy is unchanged.

**The admin page.** The admin's CSP needs `frame-src` with the origin of each site it previews. The distribution sets it in `config/middlewares` ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 3). The plugin declares the need, the host check of [ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 7 reports a site origin that `frame-src` is missing, and the preview panel says why it is empty instead of showing a broken frame. The iframe gets `sandbox="allow-scripts allow-same-origin allow-forms"`. The frame keeps its own origin, which it needs for its cookie and its scripts, and cannot navigate the admin, open pop-ups or download files.

### 6. Phases

| Builder phase | Needs from the protocol |
| --- | --- |
| 1, preview | Sections 1 to 3; the draft route for pages; `ready` and `load-draft`; the `frame-ancestors` and `frame-src` of section 5; the version check and the "upgrade the frontend" state |
| 2, click and reorder | The markers of section 5; `block-hover`, `block-select`, `select-block`, `scroll-to-block`, `drag` and `drop-target`; the preview script and stylesheet; the block address with its `version` |

Phase 1 ships alone and is useful alone. Phase 2 adds messages without changing those of phase 1, so it is a MINOR.

### 7. What the first spike must verify

The record assumes each of these. The spike, a task of the next epic, confirms or amends it before builder phase 1 starts:

- **Preview feature or plugin page.** Can Strapi 5's Preview feature, without an Enterprise licence, host this iframe? That means its URL handler, whether the admin page can post messages into its frame, and whether a custom panel can live next to the form. Otherwise the core plugin registers its own admin page.
- **The admin's CSP.** `frame-src` set through `strapi::security` in a distribution, and how a site origin added at runtime (a new `site` row) reaches a policy that is static configuration.
- **The cookie in a cross-site frame.** A `Partitioned` `SameSite=None` cookie set and sent inside a cross-site iframe on Chromium, Firefox and WebKit, with each engine's default third-party cookie settings. Also what happens when the admin and the site share a registrable domain, and the fallback when an engine refuses the cookie.
- **Who is asking.** Whether a plugin admin route can tell which admin user is calling, and whether an admin user's read permission on a document can be checked from the plugin.
- **Component ids.** Whether Strapi 5 recreates dynamic-zone component ids on save (the reason section 4 addresses by position).
- **Pointer and drag across the frame.** Whether a drag that starts in the admin's block list can be tracked over the frame with pointer events and messages alone, in the three engines.

Assumed and not checked by that spike: that one route can leave out `X-Frame-Options` while every other response keeps it. Today `SECURITY_HEADERS` sets it on every response; `server/plugins/contentSecurityPolicy.ts` already replaces the policy per route for Workers and theme assets, but not that header.

## Options considered

- **A second renderer in the admin.** React components that mirror the Vue ones would give instant updates with no frame and no cross-origin protocol. They would also be a renderer per block in two frameworks that drift apart, without the theme, the islands, the sanitizer or the CSP visitors get. Rejected (section 1).
- **Fetch the frontend's HTML and inject it into the admin** (`srcdoc` or `innerHTML`). This brings the site's CSS and scripts into the admin's origin, breaks the hash CSP and the isolation between the two, and lets content run as the admin. Rejected.
- **Send the draft by message and render it in the browser.** Previews keystrokes, not saves. It needs Markdown rendering and sanitizing in the browser, which section 9 of the standard keeps on the server, and a client renderer that static and landing builds do not have. Rejected. Keystroke preview can come later as a server render of unsaved fields, under its own record.
- **The frontend session of [ADR-0003](0003-session-in-httponly-cookie.md) inside the iframe.** Admin users are not users-permissions users, and a `SameSite=Lax` cookie is not sent in a cross-site frame. Rejected.
- **A preview secret in the URL** (a shared `?secret=`, as many headless previews do). It is long-lived, bound to no user or document, and leaks through history, logs and `Referer`. Rejected for a single-use token exchanged for a bound grant.
- **Serve the admin under the site's origin** (a reverse proxy). This removes the cross-origin problem and mixes the CMS admin into the public site's origin, cookies and CSP. Rejected.
- **A channel through the server** (WebSocket, server-sent events). This adds a stateful service between two windows that are already open side by side. `postMessage` is the platform's mechanism for frames (standard, principle 5). Rejected.

## Trade-offs

- The editor sees the page after each save, not after each keystroke. A save is a round trip through the CMS and a server render, which is the price of one renderer.
- One route relaxes `frame-ancestors`, behind a grant and a configured origin. Every other response keeps `'none'`, and a test must pin both cases.
- The preview depends on partitioned cookies in a cross-site frame. Where an engine refuses them, the preview works only when the admin and the site share a site or with the spike's fallback.
- Addressing by position needs the version check. A message that crosses a save is dropped, and the editor repeats the gesture.
- `frame-src` is static host configuration while sites are rows, so adding a site can need an operator step until the spike finds a better path.
- The protocol is one more contract, with a generated schema and a drift check, and the admin keeps speaking the previous `v` for one MINOR.

## Consequences

- `micelio-plugin-core` gains `contract/preview.ts`, its JSON Schema and drift lint, the admin routes that issue and exchange tokens, the preview route that serves the document a grant names, and the host check entry for `frame-src`.
- The frontend gains `/_preview`, the grant cookie, the draft route for pages, the preview script and stylesheet, the markers on preview responses, the `frameAncestors` option, and a `theme:check` rule that refuses selectors on the markers. It changes nothing in `app/` before builder phase 1. [ADR-0003](0003-session-in-httponly-cookie.md) and [ADR-0004](0004-hash-based-csp.md) are amended when that ships. `docs/security.md`, its ASVS mapping, `docs/api.md`, `docs/openapi.json` and `.env.example` change with it.
- `micelio-cms` adds the sites' origins to the admin's `frame-src` in `config/middlewares`.
- The spike of section 7 is a task of the next epic, before builder phase 1. Its result amends this record.
- Multi-site previews use the site's `url` and the hosts of [ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 4. API tokens stay per instance, as that record says.
