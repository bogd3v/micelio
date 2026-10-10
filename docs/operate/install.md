# Run a demo site with Docker

**Kind:** how-to. Goal: a running Micelio site on your own machine, with the demo Compose file, in a few minutes.

The demo is for trying Micelio. It is not a deployment: read [What the demo is not](#what-the-demo-is-not) before you go further.

## Before you start

- Docker with the Compose plugin (`docker compose version` must print a version).
- Git.
- Ports 3000 and 1337 free on `127.0.0.1`.

## 1. Get the CMS repository

The demo file lives in [micelio-cms](https://github.com/bogd3v/micelio-cms), because the CMS is the first service of the stack:

```bash
git clone https://github.com/bogd3v/micelio-cms.git
cd micelio-cms
```

## 2. Start the stack

```bash
docker compose -f compose.demo.yml up
```

The first run takes a few minutes. It starts these services, in order:

1. `init` generates Strapi's keys, the database password and the frontend's API token into the `demo-secrets` volume. Later runs keep them.
2. `db` starts PostgreSQL 18.
3. `cms` starts Strapi and seeds a small bilingual blog once, on an empty database.
4. `frontend` starts after the CMS health check passes.

Wait until the log shows the frontend listening (`Listening on http://[::]:8080`). Leave that terminal open, or start the stack in the background with `up -d` and check it with `docker compose -f compose.demo.yml ps`: the services are ready when `cms` and `frontend` report `healthy`. The CMS health check does not count failures during its first two minutes, so a slow first boot is normal.

## 3. Open the site

- Blog: <http://localhost:3000>, in English, and in Spanish under `/es`. The articles are at `/blog` and `/es/blog`.
- Admin: <http://localhost:1337/admin>. On the first visit Strapi asks you to create the first administrator. Use any email and password you keep for the demo only.

Sign in to the admin panel to see the demo content (articles, categories, tags and the About page) and the Site settings.

## 4. Stop the stack

```bash
docker compose -f compose.demo.yml down
```

This keeps the data: the database, the uploads and the generated secrets stay in their volumes, and the next `up` starts with them.

To delete everything, including the database and the secrets:

```bash
docker compose -f compose.demo.yml down -v
```

The next `up` after `down -v` generates new secrets and seeds the demo content again.

## What the demo is not

- **Not a deployment.** Ports are published on `127.0.0.1` only, so no other machine reaches it. There is no TLS, no reverse proxy and no backup.
- **No email.** The file sets no SMTP variables, so account confirmation, password reset and newsletter emails are not sent. The frontend log says that the newsletter and fediverse modules are turned off and lists the missing SMTP settings: that is expected here.
- **Local URLs.** The site URL is `http://localhost:3000` and the CMS URL is `http://localhost:1337`. Feeds, the sitemap and links in emails use these URLs.
- **Demo content.** Delete the demo articles and pages in the admin panel when you are done with them.
- **Latest images.** Unless you set `MICELIO_CMS_IMAGE` and `MICELIO_IMAGE`, the file pulls `ghcr.io/bogd3v/micelio-cms:latest` and `ghcr.io/bogd3v/micelio:latest`. `latest` moves with each stable release, so pin the images before you rely on a demo. See [Upgrade](upgrade.md#image-tags).

The other profiles of the CMS repository (`compose.static.yml` and `compose.landing.yml`) build plain files instead of serving the blog live. See [Static sites](static-site.md).

## From the demo to a real node

The demo sets every value a local run needs. A real site sets its own values: the database, the Strapi keys, the public URLs, the API tokens and the modules that need outside services. The full list of the frontend's variables is in [Configure](configure.md). The CMS side is in the [micelio-cms README](https://github.com/bogd3v/micelio-cms#run-your-own-site).

Then read [Upgrade](upgrade.md) before the first update, and [Backup](backup.md) before you put real content in it.
