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
| `NUXT_PUBLIC_THEME` | No | `bogota` | Build time | The id of the installed theme in `themes/<id>/` to use. An id that is not installed stops the build. See [How to create a theme](../themes/creating-a-theme.md). |
| `MICELIO_THEME_DIRS` | No | empty | Build time | Extra directories where themes are looked up. Not an `NUXT_` name: the build reads it directly. |
| `NUXT_PUBLIC_SOURCE_URL` | No | the upstream repository | Runtime | Link to the source code in the footer, required by the AGPL when you run a modified copy ([ADR 0007](../adr/0007-license.md)). A value that is not an `http(s)` URL falls back to the upstream repository. |
| `NUXT_MEDIA_URL` | No | empty | Runtime | Host of the Strapi uploads when they are served from another host, added to the images Content Security Policy. Empty: only the site and Strapi load. |

## Client address and proxy

| Variable | Required | Default | Read | What it does |
| --- | --- | --- | --- | --- |
| `NUXT_TRUST_PROXY` | No | `private` | Runtime | How far `X-Forwarded-For` is trusted: `private` (only from loopback or private addresses), a number of proxy hops, a comma-separated list of CIDR ranges, or `false` (use the socket address). An invalid value stops the boot. |
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
| `NUXT_PUBLIC_FEDIVERSE_HANDLE` | Fediverse only | empty | Runtime | The site's account handle, for example `@blog@cms.example.org`. |
| `NUXT_PUBLIC_FEDIVERSE_ACTOR_URL` | Fediverse only | empty | Runtime | The ActivityPub actor, for example `https://cms.example.org/fediverse/user/blog`. |
| `NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL` | Fediverse only | empty | Runtime | Base URL of the federated articles, for example `https://cms.example.org/fediverse/articles`. |

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

At startup the server checks the values above and logs what is missing; it does not stop for these:

- A required value that is missing produces a warning that names it, outside development. Static and landing sites check `NUXT_PUBLIC_STRAPI_URL`, `NUXT_STRAPI_API_TOKEN` and `NUXT_PUBLIC_SITE_URL`; a dynamic site also checks `NUXT_SMTP_HOST`, `NUXT_SMTP_USER`, `NUXT_SMTP_PASS` and `NUXT_NEWSLETTER_FROM`.
- An optional value left empty (the media host, the fediverse settings) produces a second warning.
- A module turned off by missing configuration (the newsletter without SMTP, the fediverse without its settings) produces a third.

These stop the boot instead:

- A mismatch between `NUXT_PUBLIC_SITE_MODE` at build and at runtime, or between `NUXT_PUBLIC_THEME` at build and at runtime.
- An invalid `NUXT_TRUST_PROXY`.
- `NUXT_STRAPI_FORWARDER_SECRET` set with a `NUXT_PUBLIC_STRAPI_URL` that is neither `https` nor a private address.

Check the logs after each change. The warning names the variable to set.
