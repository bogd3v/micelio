# Hosting a static or landing site

How to build and publish a Micelio site with `NUXT_PUBLIC_SITE_MODE=static` or `landing` ([ADR 0006](adr/0006-site-modes.md), section 7). Cloudflare Pages is the reference host.

## When to choose it

- Choose `static` for a blog or documentation site whose content changes with publishing, not per visitor: no comments, accounts, drafts or fediverse, search through a static index, newsletter through an external provider.
- Choose `landing` for a few pages that rarely change.
- Keep `dynamic` (a Node server) when you need comments, accounts, drafts, the fediverse or the newsletter stored in Strapi. BogDev stays dynamic.

## How it works

1. An editor publishes, unpublishes or deletes an article or page, or saves the site settings, in Strapi.
2. micelio-cms calls `REBUILD_HOOK_URL` (debounced 60 s) with a GitHub `repository_dispatch` of type `micelio-content`.
3. `.github/workflows/static-site.yml` runs `npm run generate` against Strapi, then `wrangler pages deploy .output/public`. A newer run cancels one in progress.

The workflow runs only when the repository variable `STATIC_SITE_ENABLED` is `true`, so forks and dynamic sites never run it. You can also start it by hand from the Actions tab (`workflow_dispatch`).

## Repository variables and secrets

Settings, Secrets and variables, Actions.

| Name | Kind | Required | Purpose |
| --- | --- | --- | --- |
| `STATIC_SITE_ENABLED` | variable | yes | `true` turns the workflow on |
| `NUXT_PUBLIC_SITE_MODE` | variable | no | `static` (default) or `landing` |
| `NUXT_PUBLIC_STRAPI_URL` | variable | yes | Strapi URL reachable from the runner |
| `NUXT_PUBLIC_SITE_URL` | variable | yes | Public URL of the site (canonical links, feed, sitemap) |
| `NUXT_MEDIA_URL` | variable | if media is on another origin | Media origin, as in `.env.example` |
| `NUXT_PUBLIC_THEME` | variable | no | Theme id (default `bogota`) |
| `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` | variable | no | Provider form endpoint (`https:`); the newsletter is off when empty or invalid. See [Newsletter](#newsletter) |
| `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` | variable | no | The provider's name for the email field (default `email`) |
| `CLOUDFLARE_PAGES_PROJECT` | variable | yes | Pages project name |
| `STRAPI_BUILD_TOKEN` | secret | yes | The CMS `build` token, mapped to `NUXT_STRAPI_API_TOKEN` in the generate step only |
| `CLOUDFLARE_API_TOKEN` | secret | yes | Token with Cloudflare Pages: Edit and nothing else |
| `CLOUDFLARE_ACCOUNT_ID` | secret | yes | Account that owns the project |

## The build token

The static build must use the `build` token (`BUILD_API_TOKEN` in micelio-cms): custom, find-only, content types needed to render and nothing else. Never give the build the frontend token, which can read and delete subscribers. See [security.md](security.md) (credentials towards Strapi, and the rebuild and deploy tokens).

## Strapi reachable from the runner

GitHub-hosted runners have no fixed IP, so Strapi must answer on the internet, with its admin panel and every write route closed (proxy rules or firewall), and the `build` token as the only credential the build holds. If Strapi must stay private, build on a machine that can reach it (see below).

The build fails on any Strapi error, so a broken CMS never publishes a half-empty site; the previous deployment stays live.

## The CMS side

Set these in micelio-cms (its environment, not GitHub):

| Variable | Value |
| --- | --- |
| `REBUILD_HOOK_URL` | `https://api.github.com/repos/<owner>/<repo>/dispatches` |
| `REBUILD_HOOK_TOKEN` | A GitHub token allowed to create a repository dispatch (below) |

`POST /repos/{owner}/{repo}/dispatches` needs write access to the repository. Use a fine-grained personal access token limited to this one repository with **Contents: Read and write** (the only permission that endpoint requires; Metadata read is added automatically). A classic token would need the broad `repo` scope, so avoid it. Fine-grained tokens expire (at most one year): note the date and rotate it. A machine user or GitHub App installation token works the same way.

Optional: `REBUILD_HOOK_DEBOUNCE_MS`, `REBUILD_HOOK_RETRIES`, `REBUILD_HOOK_RETRY_DELAY_MS`. The payload is `{ event_type: "micelio-content", client_payload: { changes, count } }`; the run's summary lists the changes (no secrets).

## Cloudflare Pages

1. Create a Pages project with **Direct Upload** (no Git integration: GitHub builds, Cloudflare only serves). The project and its domain are created in bogdev-infra (Terraform) for the reference deployment.
2. Create an API token with the permission *Account, Cloudflare Pages, Edit* only, and note the account id.
3. Set the variables and secrets above and run the workflow once by hand.

## Newsletter

A static site has no server, so the newsletter is a plain HTML form that posts to an external provider (ADR 0006, section 5). It works with JavaScript off.

1. Create the list at the provider. The reference is [Buttondown](https://buttondown.com): its embeddable form posts to `https://buttondown.com/api/emails/embed-subscribe/<your-newsletter>` with the email in a field named `email` and a hidden `embed=1`, (the snippet is in [Building your subscriber base](https://docs.buttondown.com/getting-started/building-your-subscriber-base): `https://buttondown.com/api/emails/embed-subscribe/{username}`, `email`, hidden `embed=1`). Double opt-in is on by default and only Buttondown support can turn it off ([docs](https://docs.buttondown.com/double-opt-in)). The build adds `embed=1` by itself when the action is on `buttondown.com`. The form must stay a plain form post to the provider, because Buttondown may answer with a CAPTCHA or validation page. Where the success redirect lands is unverified: check it with one real subscription on a preview deploy. If the newsletter uses a custom domain, that origin may also need to be in `form-action` (no setting for it yet).
2. Set `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` (a repository variable, read at build time) to that URL, and `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` if the provider does not call the field `email`. Any provider that accepts a form POST works (Listmonk, Mailchimp, ...); if it needs other hidden fields, they are not configurable yet (open an issue).
3. Rebuild. Every newsletter placement (home, article footer, the newsletter section of a page) becomes `<form method="post" action="...">` with a labelled `type="email"` field (`required`, `autocomplete="email"`), a submit button and a line saying where the email goes, with a link to the privacy notice. There is no client validation beyond those attributes and no `target`: without JavaScript a popup cannot open, so the provider's confirmation page replaces the page, and the visitor comes back with the browser's back button.
4. The provider's origin is added to `form-action` in `_headers` and in the meta CSP, and the privacy page names its host ("your email goes to buttondown.com").

Rules:

- The action must be an `https:` URL without credentials (`http:` only for `localhost`, `127.0.0.1` and `[::1]`, for tests). Anything else is treated as not set: the newsletter module is off and the build prints a warning.
- Chrome also checks `form-action` on the redirect that follows the post. The provider's answer must stay on its own origin or come back to this site; a provider that redirects to a third origin would be blocked until that origin is allowed (no setting for it yet).
- The variables are read at build time and resolved once in `modules/site-mode.ts` into `runtimeConfig.public.newsletterProvider`; a `NUXT_PUBLIC_*` value set at runtime cannot reach a prerendered page and the client never ships the validation code.
- Dynamic sites are unchanged: the newsletter there is Strapi + SMTP (`/api/newsletter`).

## Headers, 404 and analytics

- Security headers and CSP come from the `_headers` file the build writes into `.output/public`. Cloudflare Pages and Netlify read it. A host without `_headers` support gets the CSP from the `<meta>` fallback only (no framing, HSTS or other header-only protections); configure the same headers at the host.
- GitHub Pages is not supported: it cannot send security headers.
- The host must serve `404.html` for unknown paths, not `200.html`. Cloudflare Pages does this when `404.html` exists.
- Analytics are off on Cloudflare Pages: the Umami proxy needs a server, and Pages only rewrites within the site. Add a Worker for the two Umami paths if you need it; never load Umami from its own domain (zero third-party requests).

## Building on a private machine

When Strapi is not reachable from GitHub, build where it is:

```bash
NUXT_PUBLIC_SITE_MODE=static \
NUXT_PUBLIC_STRAPI_URL=http://strapi.internal:1337 \
NUXT_PUBLIC_SITE_URL=https://example.com \
NUXT_STRAPI_API_TOKEN=<build token> \
npm run generate

CLOUDFLARE_API_TOKEN=<pages token> CLOUDFLARE_ACCOUNT_ID=<id> \
npx wrangler pages deploy .output/public --project-name=<project> --branch=main
```

Trigger it from the CMS host with a cron job or a small receiver of the same hook.

## Builder image

`ghcr.io/bogd3v/micelio-builder` (the `static` target of the `Dockerfile`, published by CI next to `micelio`: `:<short sha>` and `:latest`, for `linux/amd64` and `linux/arm64`, so it runs natively on Apple Silicon and arm servers) holds the source and the `npm ci` dependencies (the build tooling and Pagefind's Linux binary), runs as the non-root `node` user (uid 1000) and has two commands. Use it to generate and serve a static site from a Docker Compose (the demo instance) without Node on the host. Its build tooling makes it large (about 1.3 GB), so it is not for a runtime host that only serves.

| Command | What it does |
| --- | --- |
| `generate` (default) | Runs `npm run generate` with the variables below, then replaces the content of `/out` with `.output/public`. Fails with a message when `NUXT_PUBLIC_SITE_MODE` is `dynamic`, or when the Strapi URL or token is missing |
| `serve` | Serves `/out` on port 8080 with `scripts/static-serve.mjs`: the `_headers` rules (CSP and the rest), `404.html`, and brotli or gzip for the precompressed files, as a CDN does. `PORT`, `HOST` (default `0.0.0.0`) and `COMPRESS` (default `1`) can be overridden |

Nothing is baked in: the site is generated when the container runs, so every setting is an environment variable (compatible with `docker run --env-file`).

| Variable | Required | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_STRAPI_URL` | yes | Strapi URL reachable from the container |
| `NUXT_STRAPI_API_TOKEN` | yes | The CMS `build` token, read-only (see [The build token](#the-build-token)) |
| `NUXT_PUBLIC_SITE_MODE` | no | `static` (default) or `landing` |
| `NUXT_PUBLIC_SITE_URL` | yes for real sites | Public URL (canonical links, feed, sitemap) |
| `NUXT_MEDIA_URL` | if media is on another origin | Media origin |
| `NUXT_PUBLIC_THEME` | no | Theme id (default `bogota`) |
| `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION`, `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` | no | See [Newsletter](#newsletter) |

`/out` is a volume owned by uid 1000. Images are downloaded from Strapi during generation, so the generated site needs no CMS at runtime. Nuxt writes `.nuxt`, `.output` and `node_modules/.cache` inside the container, which uid 1000 owns, so the image works with `--read-only` only if those are tmpfs mounts; there is no need for that normally.

```bash
docker run --rm --env-file builder.env -v site:/out ghcr.io/bogd3v/micelio-builder generate
docker run -d -p 8080:8080 -v site:/out:ro ghcr.io/bogd3v/micelio-builder serve
```

Regenerate by running `generate` again into the same volume (the CMS rebuild hook can start it); the `serve` container picks the new files up without a restart. With a bind mount instead of a named volume, the host directory must be writable by uid 1000 (`chown 1000:1000`, or `--userns=keep-id:uid=1000,gid=1000` in Podman; add `:Z` on SELinux hosts). To build locally: `docker build --target static -t micelio-builder .`; the default target is still the production image.

## Preview locally

```bash
NUXT_PUBLIC_SITE_MODE=static npm run generate
node scripts/static-serve.mjs
```

## Roll back

Cloudflare Pages keeps every deployment: promote an earlier one in the dashboard (Deployments, Rollback), or re-run the workflow after fixing the content. To stop automatic builds, set `STATIC_SITE_ENABLED` to anything but `true`.

## Search

Static and landing sites search with [Pagefind](https://pagefind.app) (MIT), as an island (ADR 0006, sections 3 and 4). The dynamic mode keeps `BdSearchPalette` and `/api/search`.

- **Without JS** the search control is a link to the blog list (`BdSearchTrigger`).
- **With JS**, `<micelio-search>` (`app/islands/search.ts`, rendered by `BdSearchIsland`) turns those links into buttons that open a `<dialog>` palette with the same classes and roles as the dynamic one (combobox and listbox, Up/Down/Enter/Escape, Ctrl/Cmd+K, focus back to the trigger on close). The server renders every string into `data-*` attributes, so the island has none of its own. Results show the title, a highlighted excerpt and the link; the excerpt is Pagefind's HTML reduced to `<mark>` and text (`app/helpers/excerpt.ts`), set as text nodes, never as HTML.
- **The index** is built by `modules/static-search.ts` right after the pages are prerendered, so `npm run generate` stays one command. Pagefind indexes the pages that carry `data-pagefind-body`: the article body (`<article class="bd-article-content">`, without the tags, author card and reading path) and the article's lead, and section pages (`app/pages/[slug].vue`, without post lists). When a section page is the home page it is indexed once, at `/` (`app/pages/index.vue`), and its own slug is left out, so results link to the canonical URL. The blog list, the blog home, `/about` and `/privacy` are not indexed. If no generated page has `data-pagefind-body` the build warns and writes no index (Pagefind would otherwise index whole pages), and the log lists the pages indexed per language. A theme's own article layout must keep `data-pagefind-body` on the article and `data-pagefind-meta="title"` on the `h1`. English and Spanish get separate indexes from `<html lang>`. Pagefind's own UI files are deleted from the output; only `pagefind.js`, its worker, one WebAssembly file per language and the index chunks stay.
- **What loads when.** Every page with search loads one file at start: `/_islands/search-<hash>.js` (a plain `<script type="module">`, never preloaded). Pagefind (`/pagefind/pagefind.js`, the worker, `wasm.<lang>.pagefind`, the entry and meta files) loads when the palette first opens; the index and fragment chunks load per query, only for the language of the page. `/_islands/*` is immutable (hashed names); `/pagefind/*` is revalidated, because `pagefind.js` keeps its name between builds.
- **Islands** are built by `modules/islands.ts` from `app/islands/*.ts` with Vite (one entry each, hashed names) into `node_modules/.cache/micelio/islands-<pid>` (removed on exit), which Nitro serves under `/_islands/`; the manifest is the generated `#build/micelio/islands`, read by `useIsland(id)`. Only static builds have islands today; the dynamic build is unchanged. In `nuxt dev` the island works but there is no `/pagefind/` index, so the palette says the search is unavailable; edits to `app/islands/` need a restart.
- **CSP.** Pagefind runs WebAssembly, so static builds add `'wasm-unsafe-eval'` to `script-src` on every page (one `/*` rule, and the meta); see [security.md](security.md). It does not allow `eval()` or inline scripts.
- **Budget.** The `islands` section of `modes.static` in `scripts/perf/budgets.json`, enforced by `npm run perf -- --mode static` (what loads when the palette opens) and `e2e/static/search.spec.ts` (the files) hold the sizes (the loader and the Pagefind runtime in gzip KB, the WebAssembly in raw KB); `docs/performance.md` has the numbers.

Search needs `search` on in Strapi's `site-setting.modules` and a host that serves `/pagefind/` and `/_islands/` as files (any static host does).
