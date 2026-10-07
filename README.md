# Micelio

A blog engine built with **Nuxt 4** and **Strapi CMS**, following a **JAMStack architecture**: bilingual (English/Spanish), SEO-friendly and accessible. This repository is the frontend; the CMS lives in [micelio-cms](https://github.com/bogd3v/micelio-cms).

[BogDev](https://bogdev.com.co) is the reference site running Micelio, and its design is the default theme.

## Features

- **Nuxt 4 SSR** — Server-side rendered, with ISR caching for public pages
- **Strapi 5 CMS** — Articles, authors, categories, tags, the About page and newsletter subscribers
- **Bilingual** — English and Spanish with the `prefix_except_default` URL strategy
- **Night and day themes** — System-aware, with a manual toggle and no flash on load
- **Comments** — Guest comments through the Strapi Comments plugin, plus replies from the fediverse
- **Fediverse** — Articles are federated by the backend; likes, boosts and replies are shown on each article
- **Accounts** — Sign up, sign in, password reset and account deletion; editors can preview drafts
- **Newsletter** — Double opt-in over SMTP (nodemailer) with one-click unsubscribe (RFC 8058)
- **Feeds and sitemap** — RSS per language and category, XML sitemap with hreflang alternates
- **Search** — Title and full-text search, with a keyboard palette (Cmd/Ctrl+K)
- **Rich articles** — Code blocks with copy, callouts, citations, figures and Mermaid diagrams
- **SEO** — Open Graph, Twitter Cards, JSON-LD and canonical URLs
- **Accessibility** — Skip links, semantic HTML, ARIA labels and keyboard navigation
- **Privacy and security** — First-party Umami analytics, no cookies without a session, security headers and a hash-based Content Security Policy

## Prerequisites

- **Node.js** >= 22.12
- **Strapi 5** backend: [micelio-cms](https://github.com/bogd3v/micelio-cms)
- **SMTP server** (for newsletter emails) — optional

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/bogd3v/micelio.git
cd micelio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

All variables are read when the server starts, so the same Docker image works in every environment. Only `NUXT_*` names reach the built server: Nuxt ignores plain names like `STRAPI_API_TOKEN` at runtime.

| Variable | Description | Required |
|----------|-------------|----------|
| `NUXT_PUBLIC_STRAPI_URL` | URL of your Strapi instance | Yes |
| `NUXT_STRAPI_API_TOKEN` | API token from Strapi settings | Yes |
| `NUXT_SMTP_HOST` | SMTP server hostname | Newsletter only |
| `NUXT_SMTP_PORT` | SMTP server port (default: 587) | Newsletter only |
| `NUXT_SMTP_USER` | SMTP username | Newsletter only |
| `NUXT_SMTP_PASS` | SMTP password | Newsletter only |
| `NUXT_NEWSLETTER_FROM` | Sender address for newsletter emails | Newsletter only |
| `NUXT_PUBLIC_SITE_URL` | Public URL of your deployed site. Without it, pages fall back to the `url` of Strapi's site settings, but feeds, the sitemap and emails need it | Yes |
| `NUXT_MEDIA_URL` | Host of the Strapi uploads, allowed in the images Content Security Policy. Empty: only images from the site and Strapi load | When uploads live on another host |
| `NUXT_PUBLIC_FEDIVERSE_HANDLE` | The site's fediverse account, e.g. `@blog@cms.example.org` | Fediverse only |
| `NUXT_PUBLIC_FEDIVERSE_ACTOR_URL` | Its ActivityPub actor, e.g. `https://cms.example.org/fediverse/user/blog` | Fediverse only |
| `NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL` | Base URL of the federated articles, e.g. `https://cms.example.org/fediverse/articles` | Fediverse only |
| `NUXT_PUBLIC_SITE_MODE` | `dynamic` (default), `static` or `landing`, read at build time ([ADR 0006](docs/adr/0006-site-modes.md)). Static and landing turn off comments, accounts, drafts and the fediverse; a different value at runtime stops the server | No |
| `NUXT_PUBLIC_NEWSLETTER_FORM_ACTION` | URL of the newsletter provider's form endpoint. In `static` and `landing` the newsletter is on only when it is set | Static modes, newsletter only |
| `NUXT_PUBLIC_NEWSLETTER_FORM_FIELD` | The provider's name for the email field (default: `email`) | Static modes, newsletter only |
| `NUXT_PUBLIC_UMAMI_WEBSITE_ID` | Umami website ID. Empty: no tracker is loaded | Analytics only |
| `NUXT_UMAMI_URL` | Internal Umami URL the proxy forwards to (e.g. `http://<umami-service>:3000`). Empty: no proxy | Analytics only |
| `NUXT_PUBLIC_UMAMI_SCRIPT_PATH` | Tracker path, must match Umami's `TRACKER_SCRIPT_NAME` and stay at the root (default: `/bd.js`) | No |
| `NUXT_UMAMI_COLLECT_PATH` | Collect path, must match Umami's `COLLECT_API_ENDPOINT` (default: `/api/bd`) | No |

The tracker only reports visits whose host matches `NUXT_PUBLIC_SITE_URL`, so local and preview builds never send data. The tracker and its collect endpoint are served from the site itself (`server/middleware/umami.ts`) and forwarded to Umami with the visitor IP in `x-real-ip`, so blockers that filter third-party analytics domains don't drop visits.

### 4. Set up Strapi CMS

Run the [micelio-cms](https://github.com/bogd3v/micelio-cms) Strapi project: it defines every content type this frontend reads (articles, authors, categories, tags, About, subscribers), the Comments plugin and the fediverse endpoints. Point `NUXT_PUBLIC_STRAPI_URL` at it and create an API token for `NUXT_STRAPI_API_TOKEN` with read access to the content and create, update and delete on subscribers.

### 5. Start the development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server on http://localhost:3000 |
| `npm run build` | Build for production into `.output/` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Type-check the app and server with vue-tsc |
| `npm run lint` | Lint with ESLint (flat config from `@nuxt/eslint`) |
| `npm run test` | Unit and component tests with Vitest (`test/*.test.ts`, `test/nuxt/`) |
| `npm run test:coverage` | The same tests with v8 coverage of `app/`; fails under the thresholds in `vitest.config.ts` (report in `coverage/`) |
| `npm run test:integration` | API and page tests against a production build and a mock Strapi (`test/integration/`) |
| `npm run test:e2e` | Playwright end-to-end tests; starts a mock Strapi and the dev server (`e2e/`) |
| `npm run test:static` | Generate a `static` site against the mock Strapi and run `e2e/static/` on `.output/public` (`NUXT_PUBLIC_SITE_MODE=static npm run generate` builds your own; see `docs/api.md`) |
| `npm run test:theme` | Visual regression and axe for the active theme × mode (`e2e/theme/`, needs a build with `MICELIO_SPECIMEN=1`; baselines come from CI, see `docs/theme-testing.md`) |
| `npm run tokens` | Print the role CSS the build generates from `themes/bogota/theme.json` (or pass another `theme.json`) |

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`:

1. Lint, type check, `npm audit` (critical), design tokens check and unit tests with coverage thresholds
2. Integration tests and Playwright e2e tests
3. Build the Docker image (`Dockerfile`: Node 22 builder, distroless Node 22 runtime, non-root) and push it to GHCR as `:latest` and `:<short sha>`
4. Ask Dokploy to redeploy the application, which pulls `:latest`

The pipeline can also be started by hand from the Actions tab (`workflow_dispatch`); on `main` it builds and deploys like a push. Dependabot opens weekly update PRs for npm, the GitHub Actions and the Docker base image.

The server, DNS and reverse proxy (Traefik on Dokploy) are managed with Terraform in the private `bogdev-infra` repository.

### Static sites

A `static` or `landing` site is built by `.github/workflows/static-site.yml` on every publish in Strapi and deployed to Cloudflare Pages; it only runs where `STATIC_SITE_ENABLED` is `true`. Setup, variables, tokens and rollback: [docs/static-mode.md](docs/static-mode.md).

### Releases

Every merge to `main` is deployed; a release is a dated snapshot of what is live. Run the **Release** workflow from the Actions tab on `main`: it tags the current commit `vYYYY.MM.DD` (`.2`, `.3`… for more than one a day) and publishes a GitHub release whose notes list the PRs merged since the previous one, grouped by label (security, features, fixes, quality, docs, dependencies).

The labels come from the PR title: the `PR labels` workflow reads its conventional prefix (`feat` → enhancement, `fix` → bug, `docs` → documentation, `refactor`/`style` → refactor, `test` → testing, `ci` → ci, `chore` → code-quality, `chore(deps)` → dependencies; a `security`/`seguridad` scope adds security). Dependabot labels its own PRs. Add `ignore-for-release` to leave a PR out of the notes.

### Environment variables in production

Set the variables from `.env.example` in the production environment (Dokploy) with their `NUXT_*` names. The image is built in GitHub Actions without any of them, so a plain name like `STRAPI_API_TOKEN` leaves the token empty and every Strapi call goes out without it. The server logs a warning at startup for each required value that is missing, and another one listing the optional values left empty (media host, fediverse).

## Project Structure

```
├── app/
│   ├── app.config.ts          # Site name, author, social links, privacy contact
│   ├── assets/css/            # Global styles by layer (see AGENTS.md, CSS Architecture)
│   ├── components/            # Auto-imported, grouped by feature
│   │   ├── bd/                # BogDev design system: BdButton, BdSearchPalette…
│   │   ├── blog/              # Article view, comments, filters, pagination
│   │   ├── account/           # Account pages: shell, fields, notices
│   │   ├── drafts/            # Draft list and preview
│   │   ├── home/              # Home sections
│   │   ├── strapi/            # Renderers for the Strapi dynamic zone blocks
│   │   ├── layout/ icons/     # Shell pieces and SVG icons
│   ├── composables/           # Auto-imported composables (useStrapi, useAuth, useComments…)
│   ├── helpers/               # Pure functions, imported explicitly and unit tested
│   ├── interfaces/            # TypeScript interfaces and enums
│   └── pages/                 # index, about, privacy, blog/, account/, drafts/, confirm, newsletter/unsubscribe
├── i18n/locales/              # en.json, es.json
├── server/
│   ├── api/                   # posts, search, categories, tags, comments, newsletter, auth, drafts, fediverse…
│   ├── routes/                # feed.xml (per language and category), sitemap.xml, robots.txt
│   ├── middleware/umami.ts    # First-party proxy for the Umami tracker
│   ├── plugins/               # Content Security Policy, runtime config check
│   └── utils/strapi.ts        # strapiUrl() and strapiFetch(): the only way to call Strapi
├── docs/design/               # BogDev design system: DESIGN.md, tokens, reference canvases
├── docs/adr/                  # Architecture decisions: ISR, Umami proxy, session cookie, CSP
├── docs/api.md, security.md   # Server routes and security model
├── test/ e2e/                 # Vitest (unit, component, integration) and Playwright
└── nuxt.config.ts             # Route rules (ISR, private pages, security headers), runtime config
```

## Configuration

### Site settings

Edit `app/app.config.ts` to customize:
- Site name, URL, and description
- Social media links (GitHub, LinkedIn, Codeberg, Mastodon)
- Comment provider
- Buy Me a Coffee username
- Privacy contact email and last update date

### Strapi API

The Strapi connection is configured via environment variables. See `.env.example` for all options, [docs/security.md](docs/security.md) for the exact permissions of the API token and how every endpoint is protected, and [docs/api.md](docs/api.md) for the input, output and errors of every server route. Server code calls Strapi through `server/utils/strapi.ts`: `strapiFetch()` adds the API token, `strapiUrl()` builds URLs for the anonymous fediverse and sitemap calls.

### i18n

Translations are in `i18n/locales/`. The project uses `prefix_except_default` strategy — English (default) has no URL prefix, Spanish has `/es`.

### Theming

The active theme is a package in `themes/<id>/` (default `bogota`, chosen at build time with `NUXT_PUBLIC_THEME`; extra theme directories with `MICELIO_THEME_DIRS`). Its colors, type, space and motion are CSS custom properties the build generates from `theme.json` (nothing generated is checked in). The `data-theme="noche" | "dia"` attribute on `<html>` switches between the night and day values. Contract: [ADR 0005](docs/adr/0005-theme-contract.md). Getting started: [How to create a theme](docs/themes/creating-a-theme.md).

## License

Micelio is free software under the [GNU AGPL-3.0-only](LICENSE). If you run a modified Micelio as a service, you must offer its source to your users: set `NUXT_PUBLIC_SOURCE_URL` to your version's repository, and the footer links to it.

- **Themes** that use only the public theme contract may have any license, including a proprietary one: see the [theme exception](LICENSE-EXCEPTION.md).
- **Third-party material** (dependencies, fonts, images, logos) and the content your site publishes are not covered by Micelio's license and keep their own: see [THIRD-PARTY.md](THIRD-PARTY.md).
- **Contributing**: under the same license, with a DCO sign-off on every commit; see [CONTRIBUTING.md](CONTRIBUTING.md).

The reasons are in [ADR 0007](docs/adr/0007-license.md).
