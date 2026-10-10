# Upgrade Micelio

**Kind:** how-to. Goal: move a running site from one release to a newer one without losing content, in the order that keeps it working.

The rules come from [ADR 0010](../adr/0010-semantic-versioning.md) and section 7 of the [engineering standard](../engineering-standard.md). Read the release notes of the version you move to before you start.

## The rules

- **One release line.** `micelio` (the frontend) and `micelio-cms` (the CMS) share MAJOR and MINOR. "Micelio 1.4" is any `micelio 1.4.z` with any `micelio-cms 1.4.z`. PATCH numbers differ per repository.
- **CMS first.** Upgrade the CMS, then the frontend. The CMS of a release line also serves the frontend of the previous MINOR, so the site keeps working between the two steps.
- **Within a MAJOR, no manual step.** The new version runs its database migrations when it boots. Across a MAJOR the release notes say the order and any step you must do by hand.
- **Going back is not supported across a MINOR.** Restore the backup you took before the upgrade instead. See [Backup](backup.md).
- **Only the latest release line gets fixes**, security fixes included. Move to it.

## 1. Read the release notes

Each release on GitHub starts with its **Upgrade notes**, written by hand. Then it states:

- **Breaking changes**, if any: what changed, who is affected and what to do.
- **The theme contract** the release implements (for example `1.4`). A theme package declares the contract it needs as `major.minor`; if your theme needs a different major, do not upgrade past it until the theme is updated.
- **The `micelio-cms` line** the release was tested with. Use the CMS of that line.
- **The minimum Node version** for the frontend and the minimum PostgreSQL version for the CMS.

The generated list of changes follows the notes.

## 2. Back up

Take a backup of the CMS database and its uploads before you change anything. The steps are in [Backup](backup.md).

## 3. Upgrade the CMS

Pull and start the new CMS image of the release line, with the same environment and volumes. Wait for its health check (`/_health`) to pass; the migrations run on this boot.

## 4. Upgrade the frontend

Pull and start the new frontend image, with the same environment. The frontend holds no data, so the step only changes the code it runs. Check that the site, the admin links and a sign-in work.

## Image tags

The images are published as `ghcr.io/bogd3v/micelio` (frontend), `ghcr.io/bogd3v/micelio-builder` (static site builder) and `ghcr.io/bogd3v/micelio-cms` (CMS). Each release `vX.Y.Z` publishes these tags:

| Tag | Moves | Use it for |
| --- | --- | --- |
| `X.Y.Z`, for example `0.1.0` | Never | An exact version. Pin production to this. |
| `X.Y`, for example `0.1` | With each PATCH of the line | Following the patches of a line without a MINOR change. |
| `latest` | With each stable release | The newest stable release. It may be a new MINOR or MAJOR. |
| `edge` | With each merge to `main` | Testing only. Not a release. |
| A commit SHA | Never | A specific build of `main`. |

A release candidate, `vX.Y.Z-rc.N`, moves neither `X.Y` nor `latest`.

[ADR 0010](../adr/0010-semantic-versioning.md) sets the first release as `v0.1.0`. Until it is published, the repositories have no `vX.Y.Z` tag, so pin a build by its commit SHA.

The compose file for the demo pulls `latest` by default. Pin it before you keep a demo running for a long time (see [Run a demo site](install.md)).

## Pin the versions

Set the images with their tags. In a Compose file:

```bash
MICELIO_CMS_IMAGE=ghcr.io/bogd3v/micelio-cms:0.1
MICELIO_IMAGE=ghcr.io/bogd3v/micelio:0.1
```

Use the same release line for both images. Upgrade by changing the tag, then restarting the service, CMS first.

Do not run `edge` or a commit SHA in production. Do not rely on `latest` for an unattended upgrade: it can move to a new MINOR or MAJOR, and that upgrade needs the steps above.

## Going back

Going back across a MINOR is not supported: once the new CMS has run its migrations, the database may not work with the previous release. To return to an earlier version:

1. Stop the frontend and the CMS.
2. Restore the database and the uploads from the backup you took before the upgrade.
3. Start the earlier release, CMS first, with the same tags as before.

## Versions and deprecations

A deprecated option keeps working for at least one more MINOR and prints a warning at boot or build that names its replacement. The release notes list each deprecation. Removals happen only in a MAJOR (before 1.0.0, in a later `0.y` release).
