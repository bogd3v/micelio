# Contract tests against a real CMS

**Kind:** explanation, with the commands to run it. Why the suite exists, what it covers and how to run it.

## Why

The frontend's own suites replace Strapi with a mock (`e2e/mock-strapi.mjs`) and the CMS repository tests itself against a real Strapi, so nothing used to start the other side. With one release line for both repositories and the rule "CMS first, frontend second" (standard, sections 6 and 7), the boundary between them can break while both suites stay green. The contract suite runs the frontend's server routes against the real CMS.

It does not replace the mock suites: those stay the fast path. It adds a few seconds of tests and the time to start the CMS.

## What runs

`npm run test:contract` (`scripts/contract/run.mjs`) does this, and removes everything afterwards:

1. Resolves the CMS image (`ghcr.io/bogd3v/micelio-cms:latest`, or `CONTRACT_CMS_IMAGE`) to its digest and prints it, so a run says which CMS it used.
2. Starts Postgres and the CMS on a private Docker network. The CMS is the demo instance (`MICELIO_DEMO=true`): it seeds a neutral bilingual site on boot and creates the frontend's API token from `FRONTEND_API_TOKEN`, with no manual step. The keys and the token are random for each run and never leave the machine.
3. Runs `playwright.contract.config.ts`, which starts the production build (`npm run build` first) against that CMS, through a recording proxy (`scripts/contract/recording-proxy.mjs`), and the mock Strapi next to it, and runs `e2e/contract/`.

The suite is at the HTTP level: it calls the frontend's `/api` routes with Playwright's `request`, and checks the keys and types the app's interfaces rely on (`expectShape` in `e2e/contract/support.ts`), plus the seeded values that are stable (names, counts).

| Spec | Covers |
| --- | --- |
| `content.spec.ts` | Site settings, the post list in both languages, one post, a page with sections in both languages, the about page, search, categories and tags, and the 404 of a post and a page that do not exist |
| `mock-shape.spec.ts` | The mock Strapi against the real CMS, see below |
| `writes.spec.ts` | A guest comment (stored, shown back, no email), the subscriber write with the frontend's token (create, find by email, confirm, delete) and drafts refused to a caller that is not an editor |

## The mock check

The mock (`e2e/mock-strapi.mjs`) is what the fast suites run against, so it has to answer like the CMS. `mock-shape.spec.ts` makes the frontend request everything the mock serves (`FRONTEND_REQUESTS` in `e2e/contract/mock-shape.ts`); the proxy records each request the frontend sends to Strapi, with its `populate` and `fields`, and the spec repeats each one on the CMS and on the mock and compares the two answers by shape, keys and types, never values (`scripts/contract/shape.mjs`).

- **What fails:** a key the mock answers that the CMS does not have, a type the CMS does not use, or a different status. A key the CMS has and the mock leaves out does not fail: the mock is a simplification. A `null` says nothing about the type, an empty array has nothing to compare, and the entries of a dynamic zone are compared by `__component` and only for the components the demo answers.
- **When it fails:** fix the mock. If the difference is accepted for now, list it in `KNOWN_DIFFERENCES` with the reason; a difference that no longer shows fails as stale, so the list only shrinks.
- **Every mock route is decided:** `MOCK_ROUTES` says, for each route the mock serves, that it is compared or why it is not; `test/contractMockRoutes.test.ts` fails when the mock gains a route that is not in it, and the spec fails when a route marked as compared is reached by no request.
- The search requests use the term `ing`, which both the mock's articles and the demo's contain, so both answers have results to compare.

Two things to know about the suite:

- The demo has the newsletter module off, so `/api/newsletter/subscribe` is not served there. The subscriber test makes the CMS calls of `server/utils/subscribers.ts` itself, with the same token.
- The demo has no draft. The suite checks that the draft routes refuse a caller that is not an editor; a test that reads a draft needs one seeded in the demo, which is a change in `micelio-cms` first.

## Run it

You need Docker, and the production build:

```bash
npm run build
npm run test:contract                      # the latest CMS image, pinned by digest for the run
CONTRACT_CMS_IMAGE=ghcr.io/bogd3v/micelio-cms:latest npm run test:contract
CONTRACT_KEEP=1 npm run test:contract      # leave the CMS running; the run prints its URL, token and how to remove it
CONTRACT_CMS_URL=http://127.0.0.1:1337 CONTRACT_STRAPI_TOKEN=... npm run test:contract   # a CMS that is already running
```

Other variables: `CONTRACT_POSTGRES_IMAGE` (default `postgres:18-alpine`), `CONTRACT_CMS_PORT` (1347) and `CONTRACT_APP_PORT` (3270).

Run it when a change touches what the server routes ask the CMS for (`server/`, `app/interfaces/`), the mock, or the suite, and before releasing. The workflow `.github/workflows/contract.yml` does it on every push to `main` and on the pull requests that touch those paths.

## In CI

- The workflow starts Postgres from a copy in GHCR (`scripts/ci/mirror-image.sh`), for the reason in [the CI pipeline](ci-pipeline.md#the-node-base-image).
- It does not gate `deploy`. The maintainer marks the `Contract Tests` check as required in the branch protection once it has proven stable.
- `micelio-cms` runs the same suite against an image built from one of its pull requests by calling the workflow: `uses: bogd3v/micelio/.github/workflows/contract.yml@<ref>` with `cms_image` set to the image it built. The caller's token needs `packages: write` for the Postgres copy; without it the run pulls Postgres from Docker Hub.
- The image tag follows `latest` until `micelio-cms` publishes `edge` (cms#114); then the default changes in one line, in `scripts/contract/run.mjs` and the workflow.
