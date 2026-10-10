# The CI and deploy pipeline

**Kind:** explanation and how-to. Explanation of what runs on every push to `main` and how the images are produced. It describes the reference deployment of this repository; once the instance repository of [ADR 0008](../adr/0008-theme-registry.md) exists, the deployment steps move there and this page keeps the build and publish steps.

Every push to `main` runs `.github/workflows/deploy.yml`:

1. Lint, type check, `npm audit` (critical), design tokens check and unit tests with coverage thresholds
2. Integration tests and Playwright e2e tests
3. Build the Docker image (`Dockerfile`: Node 22 builder, distroless Node 22 runtime, non-root) and push it to GHCR as `:edge` and `:<short sha>`
4. Ask Dokploy to redeploy the application, which pulls `:edge`

The same job also pushes `ghcr.io/bogd3v/micelio-builder` (target `static`): generates and serves a static site from a container ([docs/operate/static-site.md](../operate/static-site.md#builder-image)).

The pipeline can also be started by hand from the Actions tab (`workflow_dispatch`); on `main` it builds and deploys like a push. Dependabot opens weekly update PRs for npm, the GitHub Actions and the Docker base image.

The server, DNS and reverse proxy (Traefik on Dokploy) are managed with Terraform in the private `bogdev-infra` repository.

## The Node base image

The `Dockerfile` pulls `node:22.23-slim` from Docker Hub, which rate-limits anonymous pulls (`429 Too Many Requests` failed two builds of `main` before the deploy). The two image jobs (`build-and-push` and `build-builder`) therefore run the `node-base` action (`.github/actions/node-base`, `scripts/ci/resolve-node-base.sh`, which uses the generic `scripts/ci/mirror-image.sh`, also used for the Postgres of [the contract tests](contract-tests.md)) after logging in to GHCR:

1. It reads the tag of the first `FROM node:` line of the `Dockerfile`, so a Dependabot bump of the base image needs no change here.
2. If `ghcr.io/<owner>/node:<tag>` does not exist, it copies the multi-architecture image there with `docker buildx imagetools create`, using the workflow's own `GITHUB_TOKEN` (no secret to add). This is the only pull from Docker Hub, once per tag.
3. It gives `build-push-action` a `build-contexts` entry that replaces `node:<tag>` with the copy. The `Dockerfile` stays unchanged, so local builds and forks keep using Docker Hub.

If the copy or the lookup fails, the entry is empty and the build uses Docker Hub as before, with a warning in the log. The copy is a package of the owner: make it public in the package settings if forks or other repositories must pull it.

## Static sites

A `static` or `landing` site is built by `.github/workflows/static-site.yml` on every publish in Strapi and deployed to Cloudflare Pages; it only runs where `STATIC_SITE_ENABLED` is `true`. Setup, variables, tokens and rollback: [docs/operate/static-site.md](../operate/static-site.md).

## Environment variables in production

Set the variables from `.env.example` in the production environment (Dokploy) with their `NUXT_*` names. The image is built in GitHub Actions without any of them, so a plain name like `STRAPI_API_TOKEN` leaves the token empty and every Strapi call goes out without it. The server logs a warning at startup for each required value that is missing, and another one listing the optional values left empty (media host, fediverse).
