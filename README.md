# Micelio

A site engine built with **Nuxt 4** and **Strapi CMS**, following a **JAMStack architecture**: bilingual (English/Spanish), SEO-friendly and accessible. This repository is the frontend; the CMS lives in [micelio-cms](https://github.com/bogd3v/micelio-cms).

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

## Run it

Try Micelio on your machine with Docker only: Postgres, the CMS and this frontend, with a small bilingual demo blog.

```bash
git clone https://github.com/bogd3v/micelio-cms.git
cd micelio-cms
docker compose -f compose.demo.yml up
```

The blog is at <http://localhost:3000> and the admin at <http://localhost:1337/admin>. [docs/operate/install.md](docs/operate/install.md) explains each step and what the demo is not.

## Work on the frontend

You need Node.js 22.12 or later and a running [micelio-cms](https://github.com/bogd3v/micelio-cms).

```bash
git clone https://github.com/bogd3v/micelio.git
cd micelio
npm install
cp .env.example .env   # set NUXT_PUBLIC_STRAPI_URL, NUXT_STRAPI_API_TOKEN and NUXT_PUBLIC_SITE_URL
npm run dev            # http://localhost:3000
```

Commands, conventions and the project structure are in [AGENTS.md](AGENTS.md); `npm run check` runs the fast checks before a pull request. Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

[docs/README.md](docs/README.md) has one entry point per reader:

| You are | Start with |
| --- | --- |
| Running a site | [docs/operate/](docs/operate/): install, configure, upgrade, back up, static sites |
| Editing content | [docs/guide/](docs/guide/) |
| Making a theme | [docs/themes/creating-a-theme.md](docs/themes/creating-a-theme.md) |
| Integrating | [docs/api.md](docs/api.md) |
| Contributing | [AGENTS.md](AGENTS.md), [docs/engineering-standard.md](docs/engineering-standard.md), [docs/architecture/](docs/architecture/) |
| Asking why | [docs/adr/](docs/adr/) |

Releases follow [Semantic Versioning](docs/adr/0010-semantic-versioning.md); how a node upgrades is in [docs/operate/upgrade.md](docs/operate/upgrade.md).

## Security

Report a vulnerability privately, as [SECURITY.md](SECURITY.md) explains; the security model is in [docs/security.md](docs/security.md).

## License

Micelio is free software under the [GNU AGPL-3.0-only](LICENSE). If you run a modified Micelio as a service, you must offer its source to your users: set `NUXT_PUBLIC_SOURCE_URL` to your version's repository, and the footer links to it.

- **Themes** that use only the public theme contract may have any license, including a proprietary one: see the [theme exception](LICENSE-EXCEPTION.md).
- **Third-party material** (dependencies, fonts, images, logos) and the content your site publishes are not covered by Micelio's license and keep their own: see [THIRD-PARTY.md](THIRD-PARTY.md).
- **Contributing**: under the same license, with a DCO sign-off on every commit; see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Future versions**: Micelio is AGPL version 3 only. A proxy named in [LICENSE](LICENSE) (section 14) can accept a later version of the AGPL for it; a change to any other license is not possible this way.
- **Integrations over the network**: Micelio's maintainer does not consider an app that only talks to Micelio over its HTTP API, without including Micelio's code (a hosting control panel, a bot, an assistant), to be combined with Micelio or covered by its license.
- **Per file**: every file's license and copyright are recorded in [REUSE.toml](REUSE.toml), following the [REUSE specification](https://reuse.software/); the license texts are in [LICENSES/](LICENSES/).

The reasons are in [ADR 0007](docs/adr/0007-license.md).
