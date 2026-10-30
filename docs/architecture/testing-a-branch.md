# Testing a branch in Docker

**Kind:** how-to. Goal: run what a branch changes in Docker, as the worker, the verifier and the maintainer do (gates 2 to 4 of [`docs/factory.md`](https://github.com/bogd3v/micelio-engineering/blob/main/docs/factory.md)).

## Which stack tests what

The maintainer decided on 2026-10-25 which stack tests what:

| Stack | Use it for |
| --- | --- |
| `compose.dev.yml` of [`micelio-plugin-core`](https://github.com/bogd3v/micelio-plugin-core) (`npm run dev:docker`) | The plugin, and every feature of this repository that talks to it: the preview, the weight report, the cost meter |
| `compose.demo.yml` of [`micelio-cms`](https://github.com/bogd3v/micelio-cms) | Only what the distribution adds: its bootstrap and migrations, its content schemas, multisite and the upgrade from the last release |
| `compose.demo.yml` with the released plugin | One end-to-end pass before a release |

A branch that changes none of these runs `npm run check` only.

## Run `npm run check`

On a clean copy of the worktree, `$COPY`, in `node:22.23-slim`. The `Dockerfile` image cannot run it: `.dockerignore` drops `AGENTS.md` and `docs/`.

```bash
docker run --rm -v "$COPY":/app -w /app node:22.23-slim sh -c 'npm ci && npm run check'
```

The container runs as root, so the run leaves root-owned `coverage/`, `.micelio/` and report folders in `$COPY` that make the next `rsync --delete` fail. Add `--user "$(id -u):$(id -g)" -e HOME=/tmp/h` (and `mkdir -p $HOME` in the `sh -c`) to run as yourself, or remove those folders with a root container before you sync again.

## Run the suites that drive a browser

The suites that drive a browser (`test:e2e:*`, `test:theme`) need Playwright's browsers, which `node:22.23-slim` lacks. CI runs them in the image `scripts/ci/playwright-image.sh` resolves, which has Node 24 (the job installs Node 22 over it). For the same Node as `check`, build an image `FROM node:22.23-slim` that runs `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npx -y playwright@<the version of @playwright/test> install --with-deps chromium firefox webkit`, and in it run `npm ci && npm run build && E2E_BUILD=1 npm run test:e2e:<group>` over the same bind mount (`:z`); say in the pull request which image ran. `npm run perf` runs in that same image after `npm run build` (`npm ci && npm run build && npm run perf -- --check`; `--mode static --theme <id>` for one static budget). The default theme, `bogota`, is pulled, not in the repository: after `npm ci`, anything that builds or serves the site (`build`, `generate`, `test:*` other than the unit tests, `perf`) needs `npm run theme:pull -- --frozen` (an anonymous registry read, as CI does) or `NUXT_PUBLIC_THEME=starter`; `npm run check` needs neither. Do not delete `.nuxt` after `npm ci`: `postinstall` runs `nuxt prepare` once, and without it the next build fails (rerun `npx nuxt prepare` if you did). `test:e2e:preview` serves the site and the admin page over https with a certificate that `e2e/preview/tls.ts` makes per run with `openssl` (Playwright's Linux WebKit stores no `Secure` cookie from an `http` page); the image needs the `openssl` command (the CI image has it; `node:22.23-slim` does not, so `apt-get install openssl` in the image built from it).

## Run this branch's image against the plugin's compose

You need Docker with Compose v2, Node 22, Git and free ports 1337 and 3000 on `127.0.0.1` (the compose publishes them with fixed numbers).

1. Build the image from the branch. The default target of the `Dockerfile` is the site; it takes a few minutes:

   ```bash
   docker build -t micelio:branch ../micelio   # the checkout or worktree of the branch
   ```

2. Get the plugin on its `main`: `git clone https://github.com/bogd3v/micelio-plugin-core.git`, or `git pull` in your clone.
3. In it, start the stack with the image named in `FRONTEND_IMAGE`:

   ```bash
   FRONTEND_IMAGE=micelio:branch npm run dev:docker
   ```

   The first run writes `.env.docker` (throwaway secrets: never print or commit it), builds the CMS image and waits until every service is healthy. Another stack on the machine needs another project name and ports: `COMPOSE_PROJECT_NAME=<name>` renames the project, but the ports are fixed in the file, so run one stack at a time.
4. Open <http://localhost:1337/admin> and create the first administrator (any values). The seed has made the pages "Open source, in plain words" and "A heavy page" and the article "A draft article" as drafts, and a least-privilege token for the frontend, which the compose passes to it.
5. In Content Manager → Page, open "Open source, in plain words" and press **Preview** (the eye), or open `http://localhost:1337/admin/plugins/micelio/preview/api::page.page/<documentId>`, with the `documentId` from the address. The frame shows the draft in this branch's frontend. For a feature other than the preview (the weight report, the cost meter), the plugin's [manual testing guide](https://github.com/bogd3v/micelio-plugin-core/blob/main/docs/operate/manual-testing.md) has the steps.
6. Without a browser, ask the CMS for a preview token and let the frontend exchange it. Do not run the exchange step of the plugin's "Try the preview with curl": it asks for a token of `api::note.note`, which the frontend does not render (only `api::page.page` and `api::article.article`), and a token that was already exchanged is used up. Log in as the administrator of step 4, then:

   ```bash
   JWT=$(curl -s http://localhost:1337/admin/login -H 'Content-Type: application/json' \
     -d '{"email":"<email>","password":"<password>"}' | jq -r .data.token)
   URL=$(curl -s http://localhost:1337/micelio/preview/token -H "Authorization: Bearer $JWT" \
     -H 'Origin: http://localhost:1337' -H 'Content-Type: application/json' \
     -d '{"uid":"api::page.page","documentId":"<documentId>"}' | jq -r .data.url)
   curl -si "$URL"
   ```

   The frontend answers `303` to `/drafts/pages/<documentId>` and sets the `__Host-micelio_preview` cookie. The draft route answers `200` with that cookie and `404` without it.
7. Stop the stack and delete its volumes, and the image if you no longer need it:

   ```bash
   npm run dev:docker -- down
   docker image rm micelio:branch
   ```

Known gap: the compose does not seed the `site-setting` of `micelio-cms`, so the frontend logs `cms.site-setting` (`upstream 404`) and the public pages show an empty site; the draft routes work. The plugin's guide says the same.

## Run the demo stack of `micelio-cms`

For a change that is the distribution's, follow [Run a demo site with Docker](../operate/install.md) with `MICELIO_IMAGE` set to the image of step 1.
