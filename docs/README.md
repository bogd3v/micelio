# Documentation

The documentation is organised by who reads it. Find your reader in the table; each folder holds one kind of document: a tutorial, a how-to, a reference or an explanation.

| Reader | Needs | Go to |
| --- | --- | --- |
| Someone deciding whether to use Micelio | What it is and the shortest path to a running site | [`../README.md`](../README.md) |
| Site operator | Run a demo, configure, upgrade, back up, every variable | [`operate/`](operate/install.md): [install](operate/install.md), [configure](operate/configure.md), [upgrade](operate/upgrade.md), [backup](operate/backup.md), [static sites](operate/static-site.md) |
| Site editor | Build pages and publish content in the CMS | [`guide/`](guide/README.md) |
| Theme creator | The guide, the contract reference and the theme tests | [`themes/`](themes/creating-a-theme.md): [creating a theme](themes/creating-a-theme.md), [reference](themes/reference/README.md), [theme testing](theme-testing.md) |
| Integrator | Routes, inputs, outputs and errors | [`api.md`](api.md) |
| Integrator and operator | The security model: token permissions and endpoint protections | [`security.md`](security.md) |
| Contributor, human or agent | Rules, structure and how a subsystem works | [`engineering-standard.md`](engineering-standard.md), [`../AGENTS.md`](../AGENTS.md), [`architecture/`](architecture/README.md): [CI pipeline](architecture/ci-pipeline.md), [releasing](architecture/releasing.md) |
| Contributor | Budgets and their history | [`performance.md`](performance.md) |
| Whoever asks "why is it like this?" | The decision, the options and the cost | [`adr/`](adr/README.md) |

Documents that do not belong to one reader:

- [`engineering-standard.md`](engineering-standard.md): the rules every Micelio repository shares.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) and [`../SECURITY.md`](../SECURITY.md): the terms of a contribution and how to report a vulnerability.
