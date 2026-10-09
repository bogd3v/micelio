# Security Policy

This repository is the Nuxt frontend of Micelio. Anyone can run it, so this policy covers the code and configuration published here, not any particular site.

## Supported versions

Only the latest release line, and `main`, receive security fixes. Older releases, other branches and older commits don't. If you run an older version, upgrade before reporting.

## Reporting a vulnerability

Report it privately through **GitHub → Security → [Report a vulnerability](https://github.com/bogd3v/micelio/security/advisories/new)**. Don't open a public issue, pull request or discussion.

Please include the affected route or file, steps to reproduce, the impact you expect, and whether you need a session (visitor, account, editor).

| Step                             | Target               |
| -------------------------------- | -------------------- |
| Acknowledge the report           | 3 days               |
| Triage and severity              | 7 days               |
| Fix for critical / high severity | 14 days after triage |
| Fix for medium / low severity    | next planned release |

You will be credited in the advisory unless you prefer otherwise.

## Scope

In scope: code and configuration in this repository, including:

- The server routes in `server/api` and `server/routes`, and the validation of their input
- The session cookie and the backend-for-frontend that holds it ([ADR 0003](docs/adr/0003-session-in-httponly-cookie.md))
- The Content Security Policy ([ADR 0004](docs/adr/0004-hash-based-csp.md))
- Markdown rendering and sanitising of CMS content (`app/helpers/markdown.ts`)
- The theme validator and checks (`modules/theme`), and the theme installer once it lands ([ADR 0008](docs/adr/0008-theme-registry.md))
- The `Dockerfile` and the GitHub workflows (`.github/workflows`)

The model behind these, and how every endpoint is protected, is described in [`docs/security.md`](docs/security.md).

Report these upstream instead:

- Nuxt, Vue, Nitro and other dependencies: their own repositories
- The CMS: [`micelio-cms`](https://github.com/bogd3v/micelio-cms/security/policy) for Micelio's own code, the [Strapi security policy](https://github.com/strapi/strapi/security/policy) for Strapi itself

If you are unsure whether the issue lives in our code or upstream, report it here and we'll forward it.

Out of scope: volumetric denial of service, social engineering, reports from automated scanners without a demonstrated impact, missing headers with no exploit, self-XSS, and anything that requires an admin or editor account in the CMS unless it escalates privileges.

## Testing rules

- Test against your own instance (`npm run dev`, see `README.md`), never against a site you do not run.
- Don't run automated scanners or load tests against anyone else's instance.
- Don't access, change or delete data that isn't yours. If you reach real user data, stop and report.

Good-faith research that follows these rules won't be pursued.

## How dependencies are handled

Dependabot opens grouped minor and patch updates weekly; major versions are upgraded by hand after testing, and alerts that can't be fixed yet are written down with the reason the risk is accepted. The rules are in section 10 of the [engineering standard](docs/engineering-standard.md).
