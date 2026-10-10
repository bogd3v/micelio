# Architecture

This folder explains how a subsystem of Micelio works, for the contributors who change it: the flow of a request, the caching, the theme resolution and the other parts that the code does not make obvious. Most documents are explanations that tell why the code is shaped the way it is; a maintainer procedure may live here too. Each document states its kind under the title.

Documents:

- [The CI and deploy pipeline](ci-pipeline.md): what runs on every push to `main` and how the images are produced.
- [Releasing](releasing.md): how the maintainer cuts a release.
- [Contract tests against a real CMS](contract-tests.md): what the suite covers and how to run it.

Decisions that are expensive to undo are recorded in [`docs/adr/`](../adr/README.md), not here. A document here points to the ADR that decided its behaviour.

Rules for procedures (how to add a route, a block or a theme) are in [`AGENTS.md`](../../AGENTS.md) and the skills in `.claude/skills/`.
