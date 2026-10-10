# Back up a site

**Kind:** how-to. Goal: know what holds the state of a site, and keep a copy of it that you can restore.

## What holds the state

| Part | State | Back it up? |
| --- | --- | --- |
| Frontend (`micelio`) | None. It renders pages from the CMS and keeps a regenerable cache of the rendered pages. Its configuration comes from its environment variables. | No. Keep the environment values in your secrets store. |
| CMS database (PostgreSQL in production) | Content, users, comments, newsletter subscribers and, with the fediverse on, followers and interactions. | **Yes.** This is the main copy of the site's content. |
| CMS uploads | The media files. In the demo and in a local setup they are a volume at `/app/public/uploads`. With an S3-compatible bucket (`R2_*`) the bucket holds them instead. | **Yes**, the volume or the bucket. |
| CMS secrets | Strapi's keys (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`) and the API tokens for the frontend (`FRONTEND_API_TOKEN`, `BUILD_API_TOKEN`). | **Yes**, outside the repository. |
| Umami (analytics) | Its own database, if you run it. | Back it up with Umami, not with these repositories. |

The frontend holds no data, so a restore of a site is a restore of the CMS database and uploads, plus the same secrets, and then the frontend's environment.

## Keep the secrets outside the repository

The secrets above never go in the repository, a log or an issue. Keep one copy in a password manager or a secret store, with the backups, and not on the machine that runs the site only. The demo keeps its generated secrets in the `demo-secrets` volume; `down -v` deletes them, so a demo you want to keep needs the same care.

Without the same keys a restored database may not open. Keep them with the database backup, not after it.

## The CMS procedure

The steps for the CMS are in the [micelio-cms repository](https://github.com/bogd3v/micelio-cms). Read them there; they change with the CMS release.

- [`docs/CI_CD.md`](https://github.com/bogd3v/micelio-cms/blob/main/docs/CI_CD.md) describes how a deployment runs and what its volumes are.
- [`scripts/backup-volumes.sh`](https://github.com/bogd3v/micelio-cms/blob/main/scripts/backup-volumes.sh) writes a `pg_dump` of the database and a copy of the uploads under `BACKUP_DIR`.
- [`scripts/restore-volumes.sh`](https://github.com/bogd3v/micelio-cms/blob/main/scripts/restore-volumes.sh) restores one backup by its date, or the latest one.

Set `BACKUP_DIR` and `COMPOSE_PROJECT` for your install before you run the scripts. Both are listed in the CMS `.env.example`.

## Before an upgrade

Take a backup before every upgrade, and keep it until the new version has run for a while. Going back across a MINOR is not supported: the backup is the way back. See [Upgrade](upgrade.md).

## Check the backup

A backup you have not restored is not yet a backup. Restore it to a separate machine or a separate stack at least once, and check that the site starts, that the content is there and that the uploads open.
