# Hosting a static or landing site

How to build and publish a Micelio site with `NUXT_PUBLIC_SITE_MODE=static` or `landing` ([ADR 0006](../adr/0006-site-modes.md), section 7). Cloudflare Pages is the reference host.

## When to choose it

- Choose `static` for a blog or documentation site whose content changes with publishing, not per visitor: no comments, accounts, drafts or fediverse, search through a static index, newsletter through an external provider.
- Choose `landing` for a few pages that rarely change.
- Keep `dynamic` (a Node server) when you need comments, accounts, drafts, the fediverse or the newsletter stored in Strapi.

## How it works

1. An editor publishes, unpublishes or deletes an article or page, or saves the site settings, in Strapi.
2. micelio-cms calls `REBUILD_HOOK_URL` (debounced 60 s) with a GitHub `repository_dispatch` of type `micelio-content`.
3. `.github/workflows/static-site.yml` runs `npm run generate` against Strapi, then `wrangler pages deploy .output/public`. A newer run cancels one in progress.

The build prerenders `/blog/category/<slug>`, `/es/blog/category/<slug>` and `/feed/<slug>.xml` (and the `/es/` one) for the categories each language lists, by the same rule as the server: the default language lists the categories that have a version in it, every other language lists those plus the ones that have a version in it (ADR 0016). A category that exists only in Spanish is therefore a page and a feed under `/es/` and a 404 in English. The build reads one page of at most 100 categories per language (`MAX_CATEGORIES`, the same limit as the dynamic site) and fails, naming the limit, when Strapi reports more. The CMS rebuild hook ignores categories, so a new or renamed category appears at the next rebuild caused by an article, a page or the site settings; until then its route is a 404.

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
| `NUXT_PUBLIC_THEME` | variable | no | The theme when the site settings name none (default `bogota`, which the workflow installs from `themes.lock.json` with `theme:pull`). The theme they name wins ([The theme of the site](#the-theme-of-the-site)) |
| `MICELIO_THEME_INSTALL`, `MICELIO_THEME_REGISTRY`, `MICELIO_THEME_REGISTRY_IDENTITY`, `MICELIO_THEME_TIERS` | variable | no | Where the generation installs a theme the site settings name and this checkout lacks, whose signature it must carry, which tiers and whether anything is installed. The workflow has no volume holding the last site, so a yanked version is never installed for it (see below). See [Configure](configure.md) |
| `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` | variable | no | Provider form endpoint (`https:`); the newsletter is off when empty or invalid. See [Newsletter](#newsletter) |
| `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` | variable | no | The provider's name for the email field (default `email`) |
| `CLOUDFLARE_PAGES_PROJECT` | variable | yes | Pages project name |
| `STRAPI_BUILD_TOKEN` | secret | yes | The CMS `build` token, mapped to `NUXT_STRAPI_API_TOKEN` in the generate step only |
| `CLOUDFLARE_API_TOKEN` | secret | yes | Token with Cloudflare Pages: Edit and nothing else |
| `CLOUDFLARE_ACCOUNT_ID` | secret | yes | Account that owns the project |

## The build token

The static build must use the `build` token (`BUILD_API_TOKEN` in micelio-cms): custom, find-only, content types needed to render and nothing else. Never give the build the frontend token, which can read and delete subscribers. See [security.md](../security.md) (credentials towards Strapi, and the rebuild and deploy tokens).

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

1. Create a Pages project with **Direct Upload** (no Git integration: GitHub builds, Cloudflare only serves). Create the project and its domain with whatever tool manages your infrastructure.
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

## Landing

`NUXT_PUBLIC_SITE_MODE=landing` is `static` with a content profile (ADR 0006, section 1): the same build, hosting and workflow, a different site.

- **Home page.** Set `homePage` in the site settings: `/` (and `/es`) render that page's sections. The page keeps answering at `/<slug>` with a canonical to `/`.
- **Navigation comes from the sections.** The header, the footer navigation and the mobile menu (`#myc-site-nav`) list an anchor to every section of the home page that has a title and renders (not the hero, rich text, an empty post list, or a newsletter while that module is off), then the links of the hero and the call to action sections, once each. A link the sections would reject (`#anchor`, `javascript:`) is left out. The ids are `section-<slugified title>`, unique on the page (`section-pricing`, `section-pricing-2`) and set by `SectionRenderer` only in a landing, so each language's page has its own. They are plain `<a href="/#section-...">` links (never marked current), so they work from any page and without JavaScript. The header has room for the first four anchors and the first two hero or call to action links, on one line (`nowrap`); below 1280 px only the first two anchors show. The footer and the menu have all of them. There is no `/about` entry: a landing has no standing about page. A CMS `navigation` field may replace this later.
- **No blog without articles.** When the build finds no published article in any locale, it has no blog: `modules/static-routes.ts` counts them before the build, sets `runtimeConfig.public.blogEnabled` to `false` (read through `useStaticSite().blogEnabled`; the sitemap and the feed routes read it too) and does not read the categories, does not generate or crawl `/blog`, its category, tag and page routes, or `feed*.xml` (they are 404 in the output). The sitemap lists `/`, `/es`, `/privacy` and `/es/privacy`; the blog tab, the footer categories and feed, the RSS `<link>` and the "browse the blog" button of the 404 page are gone. A link to the blog in the content is a dead link the crawler ignores, not a page. A post list section renders nothing when it has no posts. With at least one article the landing keeps its blog exactly like `static`, and the blog link follows the section links in the navigation. Articles in only one language turn the blog on for every language: the other language's `/blog` is an empty list. `/about` is not generated either (the crawler skips it), since its links point at the blog.
- **A home page is required without articles.** If there are no articles and a language has no `homePage` in the site settings, the build fails (`no published articles and no homePage for <locale>`); with articles it only warns, and `/` shows the blog home in that language.
- **Search.** Pagefind still indexes the home page and the other section pages, and the island is unchanged. The search control without JavaScript is a link: with a blog it goes to the blog list; without one it goes to `#myc-site-nav`, the navigation of the page, which is the way to find content in a landing. With JavaScript it opens the palette either way.
- **Themes.** Nothing in the page content depends on the theme: `NUXT_PUBLIC_THEME` only changes how it looks.

Try it with `npm run test:landing`: it generates a landing against the mock Strapi (`MOCK_HOME_PAGE=1 MOCK_NO_ARTICLES=1`), runs `e2e/landing/`, then generates it again with `NUXT_PUBLIC_THEME=starter` and checks the same page renders. `LANDING_MOCK_PORT`, `LANDING_APP_PORT`, `LANDING_SKIP_GENERATE=1` and `LANDING_SKIP_THEME=1` change its ports and steps.

## Security contact

If the CMS site settings have a security contact, the build writes `.output/public/.well-known/security.txt`; without one it writes nothing and the host answers 404. The file's `Expires` is the build date plus 180 days: rebuild before then or it is served expired (see [configure](configure.md#security-contact)). Check that your host serves dotfolders (`.well-known/`); Cloudflare Pages and Netlify do.

## Headers, 404 and analytics

- Security headers and CSP come from the `_headers` file the build writes into `.output/public`. Cloudflare Pages and Netlify read it. A host without `_headers` support gets the CSP from the `<meta>` fallback only (no framing, HSTS or other header-only protections); configure the same headers at the host.
- GitHub Pages is not supported: it cannot send security headers.
- The host must serve `404.html` for unknown paths, not `200.html`. Cloudflare Pages does this when `404.html` exists.
- Analytics are off on Cloudflare Pages: the Umami proxy needs a server, and Pages only rewrites within the site. Add a Worker for the two Umami paths if you need it; never load Umami from its own domain (zero third-party requests).

## Building on a private machine

When Strapi is not reachable from GitHub, build where it is. The default theme is pulled from the registry, so the machine needs read access to `ghcr.io` once (`npm run theme:pull -- --frozen` installs what `themes.lock.json` pins), or set `NUXT_PUBLIC_THEME=starter` to build offline:

```bash
npm ci
npm run theme:pull -- --frozen
NUXT_PUBLIC_SITE_MODE=static \
NUXT_PUBLIC_STRAPI_URL=http://strapi.internal:1337 \
NUXT_PUBLIC_SITE_URL=https://example.com \
NUXT_STRAPI_API_TOKEN=<build token> \
npm run generate

CLOUDFLARE_API_TOKEN=<pages token> CLOUDFLARE_ACCOUNT_ID=<id> \
npx wrangler pages deploy .output/public --project-name=<project> --branch=main
```

Trigger it from the CMS host with a cron job or a small receiver of the same hook.

## The theme of the site

A static or landing build uses the theme the site settings of the CMS name,
not the one the image was built with.
Changing the theme in the admin and rebuilding is enough: no new image and no change to the runtime.
`npm run generate` reads `site-setting.theme`
(`themeId`, `themeVersion` and `themeDigest`, in the default language)
with the same `build` token as the rest of the build, before it renders a page.
What it does with them is what a running server does when it switches
([Switch the theme from the CMS](themes.md#switch-the-theme-from-the-cms)),
with the code of the server's theme switch, so the checks are the same:

1. The fields name no theme: the build uses `NUXT_PUBLIC_THEME`
   (the default `bogota`, installed from `themes.lock.json`).
   Nothing is downloaded.
2. Only `themeId`: a theme built into the image, or the build fails.
3. `themeId`, the exact `themeVersion` and the `themeDigest` of its package:
   a theme built into the image at that digest is used as it is.
   Otherwise the build downloads it from `MICELIO_THEME_REGISTRY`
   and checks the signed index, the tier (`MICELIO_THEME_TIERS`, default `official,verified`),
   the digest and the attestation of the package.
   It then unpacks the package with the safe unpack, validates it,
   and compiles it in a child process (`installTheme()`).
   `MICELIO_THEME_INSTALL=false` turns the download off.
4. A theme that ships code (`slots/` or `templates/`) is used
   only when the image was built with that exact package.
   The builder image holds the themes of `themes.lock.json` and `themes/`;
   another code theme needs another image.

The theme's files are published at `/_t/<digest>/` in the output (immutable in `_headers`),
and the build writes `/_micelio.json` next to the pages so that what is live can be audited:

```json
{"theme":{"id":"bogota","version":"1.0.1","digest":"9cf6…","packageDigest":"sha256:9a94…","source":"built-in"}}
```

`digest` is the one in `/_t/<digest>/`, and `packageDigest` is the `themeDigest` the settings pin.
`source` says where the theme came from: `default`, `built-in` or `installed`.
Hosts revalidate the file (`Cache-Control: public, max-age=0, must-revalidate`).

**When the theme cannot be used, the generation fails and the last good site stays published.**
The build stops before it renders a page, with a line that starts with `Static theme:`.
The line names the rule that refused the theme
(`pin`, `unknown`, `registry`, `tier`, `code`, `off`, `install` or `integrity`) and the reason.
The `generate` command of the builder image then adds a line
that says the volume keeps the site it held, and exits with 1.
The same happens when Strapi cannot be read,
so a Strapi outage never publishes the default theme over the chosen one.
The output is in the log of whatever ran the generation
(the builder container, or the workflow run).
The CMS rebuild hook only starts the generation and never sees its result,
so the admin sees no message in the CMS until micelio-cms reports the failure
(ADR 0009, amendment of #315).
A site with no site settings yet (Strapi answers 404) names no theme.

A version the registry has marked **incompatible** with this core (#314) is refused,
and the message says so.
The builder tells the registry client its own version, as `npm run theme:pull` does:
a version marked incompatible only from a later core is still installed,
and one marked from this core on is refused.

A version the registry has **yanked** stops new installs,
as it does for a running server (ADR 0009, section 3(a)).
A pin in the site settings is not a lock, so a site that names a yanked version is refused too,
**unless it is the theme the site is live on**:
the builder image reads `/_micelio.json` of the volume (`OUT_DIR`)
and, when its `packageDigest` is the one the settings pin,
installs that version again and logs a warning that names it.
Content rebuilds then keep working while the editor picks another version.
The file is trusted as much as the volume: whoever can write there can already replace the site,
but a `/_micelio.json` edited to name a yanked version's digest does let that version install.
A yanked version is never installed for a site that is not live on it, and the GitHub workflow,
which has no volume holding the last site, never installs one.

## Builder image

`ghcr.io/bogd3v/micelio-builder` (the `static` target of the `Dockerfile`, published by CI next to `micelio`: `:<short sha>`, `:edge` for `main` and `:X.Y.Z`, `:X.Y` and `:latest` for each release, for `linux/amd64` and `linux/arm64`, so it runs natively on Apple Silicon and arm servers) holds the source and the `npm ci` dependencies (the build tooling and Pagefind's Linux binary), runs as the non-root `node` user (uid 1000) and has two commands. Use it to generate and serve a static site from a Docker Compose (the demo instance) without Node on the host. Its build tooling makes it large (about 1.3 GB), so it is not for a runtime host that only serves.

| Command | What it does |
| --- | --- |
| `generate` (default) | Runs `npm run generate` with the variables below, then replaces the content of `/out` with `.output/public`. Fails with a message when `NUXT_PUBLIC_SITE_MODE` is `dynamic`, or when the Strapi URL or token is missing. When the generation fails, including when the theme the site settings name cannot be used ([The theme of the site](#the-theme-of-the-site)), it exits with 1 and leaves `/out` as it was |
| `serve` | Serves `/out` on port 8080 with `scripts/static-serve.mjs`: the `_headers` rules (CSP and the rest), `404.html`, and brotli or gzip for the precompressed files, as a CDN does. `PORT`, `HOST` (default `0.0.0.0`) and `COMPRESS` (default `1`) can be overridden |

Nothing is baked in: the site is generated when the container runs, so every setting is an environment variable (compatible with `docker run --env-file`).

| Variable | Required | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_STRAPI_URL` | yes | Strapi URL reachable from the container |
| `NUXT_STRAPI_API_TOKEN` | yes | The CMS `build` token, read-only (see [The build token](#the-build-token)) |
| `NUXT_PUBLIC_SITE_MODE` | no | `static` (default) or `landing` |
| `NUXT_PUBLIC_SITE_URL` | yes for real sites | Public URL (canonical links, feed, sitemap) |
| `NUXT_MEDIA_URL` | if media is on another origin | Media origin |
| `NUXT_PUBLIC_THEME` | no | The theme when the site settings name none (default `bogota`, which the builder image installs from `themes.lock.json`). The theme they name wins, so changing it in the CMS needs a rebuild and no new image |
| `MICELIO_THEME_REGISTRY`, `MICELIO_THEME_REGISTRY_IDENTITY`, `MICELIO_THEME_TIERS`, `MICELIO_THEME_INSTALL` | no | Where a theme the image lacks is installed from, whose signature it must carry, which tiers are installed and whether anything is installed at all. See [The theme of the site](#the-theme-of-the-site) and [Configure](configure.md) |
| `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION`, `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` | no | See [Newsletter](#newsletter) |

`/out` is a volume owned by uid 1000. Images are downloaded from Strapi during generation, so the generated site needs no CMS at runtime. Nuxt writes `.nuxt`, `.output` and `node_modules/.cache` inside the container, which uid 1000 owns, so the image works with `--read-only` only if those are tmpfs mounts; there is no need for that normally.

```bash
docker run --rm --env-file builder.env -v site:/out ghcr.io/bogd3v/micelio-builder:0.1 generate
docker run -d -p 8080:8080 -v site:/out:ro ghcr.io/bogd3v/micelio-builder:0.1 serve
```

Regenerate by running `generate` again into the same volume (the CMS rebuild hook can start it); the `serve` container picks the new files up without a restart. With a bind mount instead of a named volume, the host directory must be writable by uid 1000 (`chown 1000:1000`, or `--userns=keep-id:uid=1000,gid=1000` in Podman; add `:Z` on SELinux hosts). To build locally: `docker build --target static -t micelio-builder .`; the default target is still the production image.

## Preview locally

```bash
npm run theme:pull -- --frozen   # once after npm ci; or NUXT_PUBLIC_THEME=starter
NUXT_PUBLIC_SITE_MODE=static npm run generate
node scripts/static-serve.mjs
```

## Roll back

Cloudflare Pages keeps every deployment: promote an earlier one in the dashboard (Deployments, Rollback), or re-run the workflow after fixing the content. To stop automatic builds, set `STATIC_SITE_ENABLED` to anything but `true`.

## Search

Static and landing sites search with [Pagefind](https://pagefind.app) (MIT), as an island (ADR 0006, sections 3 and 4). The dynamic mode keeps `MycSearchPalette` and `/api/search`.

- **Without JS** the search control is a link to the blog list (`MycSearchTrigger`).
- **With JS**, `<micelio-search>` (`app/islands/search.ts`, rendered by `MycSearchIsland`) turns those links into buttons that open a `<dialog>` palette with the same classes and roles as the dynamic one (combobox and listbox, Up/Down/Enter/Escape, Ctrl/Cmd+K, focus back to the trigger on close). The server renders every string into `data-*` attributes, so the island has none of its own. Results show the title, a highlighted excerpt and the link; the excerpt is Pagefind's HTML reduced to `<mark>` and text (`app/helpers/excerpt.ts`), set as text nodes, never as HTML.
- **The index** is built by `modules/static-search.ts` right after the pages are prerendered, so `npm run generate` stays one command. Pagefind indexes the pages that carry `data-pagefind-body`: the article body (`<article class="myc-article-content">`, without the tags, author card and reading path) and the article's lead, and section pages (`app/pages/[slug].vue`, without post lists). When a section page is the home page it is indexed once, at `/` (`app/pages/index.vue`), and its own slug is left out, so results link to the canonical URL. The blog list, the blog home, `/about` and `/privacy` are not indexed. If no generated page has `data-pagefind-body` the build warns and writes no index (Pagefind would otherwise index whole pages), and the log lists the pages indexed per language. A theme's own article layout must keep `data-pagefind-body` on the article and `data-pagefind-meta="title"` on the `h1`. English and Spanish get separate indexes from `<html lang>`. Pagefind's own UI files are deleted from the output; only `pagefind.js`, its worker, one WebAssembly file per language and the index chunks stay.
- **What loads when.** Every page with search loads one file at start: `/_islands/search-<hash>.js` (a plain `<script type="module">`, never preloaded). Pagefind (`/pagefind/pagefind.js`, the worker, `wasm.<lang>.pagefind`, the entry and meta files) loads when the palette first opens; the index and fragment chunks load per query, only for the language of the page. `/_islands/*` is immutable (hashed names); `/pagefind/*` is revalidated, because `pagefind.js` keeps its name between builds.
- **Islands** are built by `modules/islands.ts` from `app/islands/*.ts` with Vite (one entry each, hashed names) into `node_modules/.cache/micelio/islands-<hash>` (kept between runs, keyed by a hash of the island sources, `app/helpers`, `app/interfaces` and `package-lock.json`), which Nitro serves under `/_islands/`; the manifest is the generated `#build/micelio/islands`, read by `useIsland(id)`. Islands are built in every mode (ADR 0006 amendment); only static pages render them today. In `nuxt dev` the island works but there is no `/pagefind/` index, so the palette says the search is unavailable; edits to `app/islands/` need a restart.
- **CSP.** Pagefind runs WebAssembly, so static builds add `'wasm-unsafe-eval'` to `script-src` on every page (one `/*` rule, and the meta); see [security.md](../security.md). It does not allow `eval()` or inline scripts.
- **Budget.** The `islands` section of `modes.static` in `scripts/perf/budgets.json`, enforced by `npm run perf -- --mode static` (what loads when the palette opens) and `e2e/static/search.spec.ts` (the files) hold the sizes (the loader and the Pagefind runtime in gzip KB, the WebAssembly in raw KB); `docs/performance.md` has the numbers.

Search needs `search` on in Strapi's `site-setting.modules` and a host that serves `/pagefind/` and `/_islands/` as files (any static host does).
