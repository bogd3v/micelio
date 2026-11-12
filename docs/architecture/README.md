# Architecture

This folder explains how a subsystem of Micelio works, for the contributors who change it: the flow of a request, the caching, the theme resolution and the other parts that the code does not make obvious. Most documents are explanations that tell why the code is shaped the way it is; a maintainer procedure may live here too. Each document states its kind under the title.

Documents:

- [The block catalogue plan](block-catalogue-plan.md): the foundations, refinements, icons and new blocks by wave, and the issue list the implementation is cut from (a proposal until the maintainer approves it).
- [The CI and deploy pipeline](ci-pipeline.md): what runs on every push to `main` and how the images are produced.
- [Heavy islands](islands.md): the registry, the triggers, the load rule and the alternatives.
- [Releasing](releasing.md): how the maintainer cuts a release.
- [Contract tests against a real CMS](contract-tests.md): what the suite covers and how to run it.
- [The preview contract and its pin](preview-contract.md): how the frame's reader is held to the
  plugin's schemas and how to move the pin.
- [Testing a branch in Docker](testing-a-branch.md): `npm run check`, the browser suites and the plugin's and the distribution's stacks.
- [The Strapi surface](strapi-surface.md): the Strapi APIs `micelio-cms`, `micelio-plugin-core` and the fediverse plugin use, with the command that reads each list (ADR-0020).
- [Sustainability](sustainability.md): the Web Sustainability Guidelines that apply to the engine, and how each is met or checked.

Decisions that are expensive to undo are recorded in [`docs/adr/`](../adr/README.md), not here. A document here points to the ADR that decided its behaviour.

Rules for procedures (how to add a route, a block or a theme) are in [`AGENTS.md`](../../AGENTS.md) and the skills in `.claude/skills/`.
