# Contributing to Micelio

Thanks for helping. The terms of a contribution are Micelio's, shared by every repository, and live in
[`micelio-engineering`](https://github.com/bogd3v/micelio-engineering/blob/main/docs/contributing.md): the
license of your contribution (AGPL-3.0-only, the [theme exception](LICENSE-EXCEPTION.md)), the Developer
Certificate of Origin and the pull request template. Governance and the Micelio name and logo are in its
[governance.md](https://github.com/bogd3v/micelio-engineering/blob/main/docs/governance.md) and
[trademarks.md](https://github.com/bogd3v/micelio-engineering/blob/main/docs/trademarks.md). The rules for the
work are the [engineering standard](docs/engineering-standard.md).

## What is specific to this repository

- Commands, structure and conventions are in [AGENTS.md](AGENTS.md); the roadmap is the open epics (`gh issue list --label épica`).
- Run `npm run check` (types, lint, tests with coverage, licences and the copy of the standard) before opening the pull request.
- Third-party material goes in [THIRD-PARTY.md](THIRD-PARTY.md) and [REUSE.toml](REUSE.toml); `reuse lint`
  checks it in CI.
- Decisions that are expensive to undo are ADRs in [docs/adr/](docs/adr/README.md), written from the
  [template](https://github.com/bogd3v/micelio-engineering/blob/main/docs/adr-template.md).
- Report a vulnerability privately, as the [organisation's security policy](https://github.com/bogd3v/.github/blob/main/SECURITY.md) explains; the scope is in [docs/security.md](docs/security.md#reporting-a-vulnerability-and-scope).
