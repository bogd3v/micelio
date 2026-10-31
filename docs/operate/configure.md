# Configure the frontend

**Kind:** reference. The environment variables the Micelio frontend reads, what it does and when it is read. The site's own content (name, links, modules, theme choice in the CMS) is configured in the CMS, not here: see the [micelio-cms README](https://github.com/bogd3v/micelio-cms#run-your-own-site).

Start from `.env.example` in the repository. Nuxt reads only the `NUXT_*` names at runtime: a plain name such as `STRAPI_API_TOKEN` is ignored by the built server. The image is built without any of these values, so the same image runs in every environment.

**Build time** means the value is read when `npm run build` or `npm run generate` runs, and the built output keeps it. **Runtime** means the server reads it when it starts.

## Strapi connection

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_PUBLIC_STRAPI_URL` | Yes | empty | Runtime | URL of the Strapi instance, for example `https://cms.example.com`. |
| `NUXT_STRAPI_API_TOKEN` | Yes | empty | Runtime | The frontend's API token (reads content, manages newsletter subscribers; never reuse it for a static build), added to Strapi calls by `strapiFetch()`. The CMS creates it from `FRONTEND_API_TOKEN` ([CMS API tokens](https://github.com/bogd3v/micelio-cms/blob/main/docs/API_TOKENS.md)). Keep it secret. |
| `NUXT_STRAPI_FORWARDER_SECRET` | No | empty (off) | Runtime | Shared secret with the CMS's `RATE_LIMIT_FORWARDER_SECRET`, 32 or more characters. With it, the CMS rate-limits each visitor, not the frontend's single address. The boot stops if the secret is set and `NUXT_PUBLIC_STRAPI_URL` is neither `https` nor a private address. See [Client IP and rate limits](../security.md#client-ip-and-rate-limits). |

## Site identity and modes

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_SITE_CACHE_SECONDS` | No | `60` | Runtime | Seconds the site settings are cached in memory; `0` turns the cache off ([docs/api.md](../api.md)). |
| `NUXT_PUBLIC_SITE_URL` | Yes | empty | Runtime | Public URL of the deployed site, for example `https://example.com`. Feeds, the sitemap and emails need it. Without it, pages fall back to the `url` of the CMS's site settings. |
| `NUXT_PUBLIC_SITE_MODE` | No | `dynamic` | Build time | `dynamic`, `static` or `landing` ([ADR 0006](../adr/0006-site-modes.md)). The static and landing modes are prerendered and turn off comments, accounts, drafts and the fediverse. A runtime value that differs from the build value stops the server. |
| `NUXT_PUBLIC_THEME` | No | `bogota` | Build time (the build's theme) and runtime (the default theme) | The instance's default theme, a bare id among the installed themes. At build it picks the theme the slots and layout variants are compiled for; at runtime it picks the theme the server loads at boot. Any installed theme can be the default at runtime: the build compiles in the layout variants and the slots of every installed theme (#402). The default, `bogota`, is not in the repository: `npm run theme:pull` installs it from `themes.lock.json` and the image build does it ([Install themes](themes.md)). An id that is not installed stops the build or the boot, naming the variable. See [How to create a theme](../themes/creating-a-theme.md). |
| `MICELIO_THEME_DIRS` | No | empty | Build time | Extra directories where themes are looked up. Not an `NUXT_` name: the build reads it directly. |
| `MICELIO_ADMISSION` | No | empty | Build time | `true` makes a theme of `MICELIO_THEME_DIRS` replace a core theme with the same id instead of failing with `installed twice`. Set only by the theme admission workflows (`theme-admission.yml`); leave it unset on a site build, in `deploy.yml`, in the image and in production. |
| `MICELIO_THEME_REGISTRY` | No | `ghcr.io/bogd3v/micelio-themes` | Build time | `host[:port]/path` of the registry `npm run theme:add` and `theme:pull` read. Not an `NUXT_` name: the commands read it directly. See [Install themes from the registry](themes.md). |
| `MICELIO_THEME_REGISTRY_IDENTITY` | With a non-default registry | empty | Build time | `issuer=<URL>,package=<URL>[,index=<URL>]`: the OIDC issuer and the exact workflow identities (certificate subject alternative names) that must have signed the packages and the index of `MICELIO_THEME_REGISTRY`. Without it nothing is installed from a non-default registry. The default registry has its identity built into the core. |
| `MICELIO_THEME_STORE` | No | empty | Runtime | Absolute path of the deployment theme store: the directory where themes installed after the build are kept, writable only by the server's user. Unset, only the themes built into the image activate and the server installs nothing; one warning says so at boot. A relative path stops the boot. The site settings of the CMS then switch the theme with no rebuild ([Switch the theme from the CMS](themes.md#switch-the-theme-from-the-cms)). |
| `MICELIO_THEME_INSTALL` | No | `true` | Runtime | `true`, `false`, `1` or `0`: whether the server may download and install the themes the site settings name. A hosted platform that installs centrally sets `false`: only themes already in a store activate, and a missing one is reported on `/api/theme/status`, never downloaded. No effect without `MICELIO_THEME_STORE`. Any other value stops the boot. |
| `MICELIO_THEME_TIERS` | No | `official,verified` | Runtime | Comma-separated tiers of the registry (`official`, `verified`, `community`) that the server installs. A package of any other tier is refused, with a reason that names its tier. An unknown tier name stops the boot. |
| `MICELIO_CACHE_DIR` | No | `~/.cache/micelio` | Build time | Directory of the cache of pulled theme packages. |
| `NUXT_PUBLIC_SOURCE_URL` | No | the upstream repository | Runtime | Link to the source code in the footer, required by the AGPL when you run a modified copy ([ADR 0007](../adr/0007-license.md)). A value that is not an `http(s)` URL falls back to the upstream repository. |
| `NUXT_MEDIA_URL` | No | empty | Runtime | Host of the Strapi uploads when they are served from another host, added to the images Content Security Policy. Empty: only the site and Strapi load. |
| `NUXT_PREVIEW_ADMIN_ORIGIN` | No | empty | Runtime | The origin of the CMS admin that may frame a draft of this site, such as `https://cms.example.com` (`http` or `https`, no path). Empty: the preview is off and `/_preview` answers 404. It becomes the `frame-ancestors` of the draft routes that carry a valid preview grant and no other response. An invalid value turns the preview off and logs a warning at boot. See [Preview drafts in the admin](preview.md). |

## Security contact

The site serves `/.well-known/security.txt` ([RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)) only when the owner fills in **Security contact** in the CMS site settings: a `mailto:` or `https://` URI. It is public, so use a mailbox or page meant for reports, never a private address. With no contact the route answers 404; the engine never invents one.

`Expires` is the render date plus 180 days. A dynamic site renders it on each request (cached for an hour), so it never expires. A static or landing site writes it at build time: if the site is not rebuilt for 180 days, the file it serves is expired, and RFC 9116 tells readers to ignore an expired file. Rebuild at least twice a year, or schedule a periodic rebuild. A build reads the contact once: after you change it in the CMS, rebuild.

## Client address and proxy

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_TRUST_PROXY` | No | `private` | Runtime | How far `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto` are trusted: `private` (only from loopback or private addresses), a number of proxy hops, a comma-separated list of CIDR ranges, or `false` (use the socket address and the request's own host and protocol). An invalid value stops the boot. |
| `NUXT_PROXY_IP_HEADER` | No | `X-Forwarded-For` | Runtime | Header that carries the proxy chain. Set it only when your proxy overwrites it. |

## Newsletter (SMTP)

The newsletter sends double opt-in and unsubscribe emails over SMTP. Without SMTP the newsletter module is turned off at boot, and the server logs it.

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_SMTP_HOST` | Newsletter only | empty | Runtime | SMTP server hostname. |
| `NUXT_SMTP_PORT` | No | `587` | Runtime | SMTP server port. |
| `NUXT_SMTP_USER` | Newsletter only | empty | Runtime | SMTP username. |
| `NUXT_SMTP_PASS` | Newsletter only | empty | Runtime | SMTP password. Keep it secret. |
| `NUXT_NEWSLETTER_FROM` | Newsletter only | empty | Runtime | Sender address for the newsletter emails. |

## Newsletter form in static modes

In `static` and `landing` modes there is no server to send the email, so the form posts straight to an external provider.

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` | Static modes, newsletter only | empty | Build time | `https:` URL of the provider's form endpoint. When set and valid, the newsletter is on and its origin is added to the `form-action` directive. See [Newsletter in static sites](static-site.md#newsletter). |
| `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` | No | `email` | Build time | The provider's name for the email field. |

## Fediverse

Set all three to turn the fediverse features on. The CMS side is in [micelio-cms docs/FEDIVERSE.md](https://github.com/bogd3v/micelio-cms/blob/main/docs/FEDIVERSE.md).

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_PUBLIC_FEDIVERSE_LOCALE` | No | `es-CO` | Runtime | The locale whose articles are federated. |
| `NUXT_PUBLIC_FEDIVERSE_HANDLE` | Fediverse only | empty | Runtime | The site's account handle, for example `@blog@cms.example.org`. Its host must be the CMS's handle host (`FEDIVERSE_HANDLE_HOST`, or the CMS host). Also read by a static build, for the `fediverse:creator` tag of each article. |
| `NUXT_PUBLIC_FEDIVERSE_ACTOR_URL` | Fediverse only | empty | Runtime | The ActivityPub actor, for example `https://cms.example.org/fediverse/user/blog`. |
| `NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL` | Fediverse only | empty | Runtime | Base URL of the federated articles, for example `https://cms.example.org/fediverse/articles`. |

**Author on Mastodon link cards.** With the fediverse switched on in the site settings and `NUXT_PUBLIC_FEDIVERSE_HANDLE` set, every article carries `<meta name="fediverse:creator">` with the site actor's handle (the `@user` comes from the site settings' fediverse username when set; [API](../api.md), "Fediverse creator"). Mastodon credits the author only when the actor lists the site's domain in `attributionDomains`, which the CMS actor must publish.

### Handle on the site domain

When the CMS gives the account a handle on the site's own host (`FEDIVERSE_HANDLE_HOST`, for example `@blog@example.com` while the CMS is `cms.example.com`), remote servers look the handle up at `https://example.com/.well-known/webfinger`. In `dynamic` mode the frontend answers that route itself, by asking the CMS, whenever the fediverse module is on: no variable and no proxy rule is needed. With the module off it answers 404. Check it with `npx @fedify/cli lookup @blog@example.com`.

A `static` or `landing` site has no server to answer it, so the host or the proxy in front of it must forward `/.well-known/webfinger` (with its query) to the CMS, as before.

## Analytics (Umami)

The tracker is served from the site itself and forwarded to Umami, so blockers that filter third-party analytics domains do not drop visits. The tracker reports only visits whose host matches `NUXT_PUBLIC_SITE_URL`. See [Analytics](https://github.com/bogd3v/micelio-cms/blob/main/docs/ANALYTICS.md) for the CMS side.

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_PUBLIC_UMAMI_WEBSITE_ID` | Analytics only | empty | Runtime (static modes also at build) | Umami website ID. Empty: no tracker is loaded. |
| `NUXT_UMAMI_URL` | Analytics only | empty | Runtime | Internal URL of Umami that the proxy forwards to, for example `http://umami:3000`. Empty: no proxy. |
| `NUXT_PUBLIC_UMAMI_SCRIPT_PATH` | No | `/bd.js` | Runtime | Path of the tracker script. It must match Umami's `TRACKER_SCRIPT_NAME` and stay at the root. |
| `NUXT_UMAMI_COLLECT_PATH` | No | `/api/bd` | Runtime | Path of the collect endpoint. It must match Umami's `COLLECT_API_ENDPOINT`. |

## Set by the image

The published images set these; you do not need to change them.

| Variable | Value | Where |
| --- | --- | --- |
| `NODE_ENV` | `production` | The `micelio` image. |
| `PORT`, `NITRO_PORT` | `8080` | The `micelio` image. The container listens on 8080. |
| `NUXT_TELEMETRY_DISABLED` | `1` | The `micelio-builder` image. |
| `OUT_DIR`, `PORT` | `/out`, `8080` | The `micelio-builder` image, which generates a static site ([builder image](static-site.md#builder-image)). |

## Startup checks

At startup the server checks the values above. These only log a warning:

- An optional value left empty (the media host, the fediverse settings) produces a warning.
- A module turned off by missing configuration (the newsletter without SMTP, the fediverse without its settings) produces another.

These stop the boot instead:

- A required value that is missing, outside development: `NUXT_PUBLIC_STRAPI_URL`, `NUXT_STRAPI_API_TOKEN` or `NUXT_PUBLIC_SITE_URL`, in every site mode. The error names each one. The SMTP settings are not required: without them the newsletter is off (a warning).
- A mismatch between `NUXT_PUBLIC_SITE_MODE` at build and at runtime.
- A `NUXT_PUBLIC_THEME` that is not in the image's theme store (above).
- An invalid `MICELIO_THEME_STORE` (not an absolute path), `MICELIO_THEME_INSTALL`, `MICELIO_THEME_REGISTRY`, `MICELIO_THEME_REGISTRY_IDENTITY` or `MICELIO_THEME_TIERS`.
- An invalid `NUXT_TRUST_PROXY`.
- `NUXT_STRAPI_FORWARDER_SECRET` set with a `NUXT_PUBLIC_STRAPI_URL` that is neither `https` nor a private address.
- In production, a `NUXT_PUBLIC_STRAPI_URL` or `NUXT_UMAMI_URL` that is plain `http://` to a host outside a private network ([ADR 0011](../adr/0011-refuse-plain-http-upstreams.md)). `https`, a loopback or private address, `localhost`, a service name without dots (`http://strapi:1337`), `.internal` and `.local` are accepted. The message names the variable.

Check the logs after each change. The warning names the variable to set.
