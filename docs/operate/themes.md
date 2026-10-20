# Install themes from the registry

**Kind:** how-to. Goal: pin a theme from the registry, or from a file, install it with `npm run theme:pull` and build with it.

Micelio is pre-1.0 and not stable. The registry client described here is the first part of the registry work of [ADR 0008](../adr/0008-theme-registry.md) and [ADR 0009](../adr/0009-theme-delivery-at-runtime.md): it checks the digest of every package and the status of a version in the index. It does **not** check signatures or provenance attestations yet, so a package is only as trustworthy as the registry and the digest you pinned. Do not point `MICELIO_THEME_REGISTRY` at a registry you do not control or trust until that check lands.

## The lock

`themes.lock.json` at the repository root pins every theme a site installs from the registry or from a file, by exact version and digest. It is committed. An empty lock (`{}`) means the site uses only the themes in `themes/`.

```json
{
  "example": {
    "version": "1.2.0",
    "digest": "sha256:…",
    "contract": "2.0",
    "tier": "official",
    "distribution": "public",
    "registry": "ghcr.io/bogd3v/micelio-themes",
    "code": false
  }
}
```

`registry` is where the entry was resolved, so the lock keeps its meaning when `MICELIO_THEME_REGISTRY` changes. `code` says whether the package has `slots/` or `templates/`: only an image built with the theme can run those. `distribution` is `public` (the registry) or `file` (a local package). Never edit the file by hand: use the commands.

## Commands

| Command | What it does |
| --- | --- |
| `npm run theme:add -- <id>[@range]` | Resolves the highest published version that satisfies the range (`1.2.3`, `^1.2.3`, `~1.2.3`, `1.2`, `1` or `*`; no range means the latest stable) and works with this core's contract, downloads it, checks it and writes the lock entry. Yanked versions and those marked incompatible are skipped. |
| `npm run theme:add -- ./<id>-<version>.tgz` | The same for a package you made with `npm run theme:pack`: the entry is `tier: local`, `distribution: file`. |
| `npm run theme:pull` | Installs every locked theme into `.micelio/themes/<id>/` (gitignored). |
| `npm run theme:pull -- --frozen` | Fails if the lock is missing, is not in the form `theme:add` writes, names a package that cannot be pulled, or disagrees with a package. CI and the Dockerfile use it. |
| `npm run theme:outdated` | Lists newer versions of the locked registry themes that this core can install. |

`theme:pull` does not rebuild anything. `NUXT_PUBLIC_THEME=<id>` still takes a bare id; Nuxt compiles the slots of `.micelio/themes/<id>/` when it builds. A theme that is both in `themes/` (or in `MICELIO_THEME_DIRS`) and in the lock is read from `themes/`, with a notice, so you can work on a checkout. With `CI=true` that is an error, so a build never uses an unpinned theme by accident.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `MICELIO_THEME_REGISTRY` | `ghcr.io/bogd3v/micelio-themes` | `host[:port]/path` of the OCI registry. The scheme is always `https`; `http` is accepted only for a loopback host (a local registry). Public packages need no credentials. |
| `MICELIO_CACHE_DIR` | `$XDG_CACHE_HOME/micelio` or `~/.cache/micelio` | Where pulled packages are cached by digest, in `themes/`. A pulled version installs offline. The cache is not trusted: every read checks the digest again. |

## What is checked

- The pin: the id, the exact version and the digest are checked against their grammar before any request or path is built from them.
- The download stops at 2 MiB while streaming, whatever the registry sends, and each request has a 30 second limit. A redirect must be `https`, never carries credentials and may not go to an IP address.
- The bytes must hash to the digest in the lock; then the package goes through the safe unpack (size, ratio, paths, content: [docs/security.md](../security.md#themes)) and must be the id and version it was pinned as, with a contract this core implements.
- Nothing from a package is executed at pull time.

## In the Docker image

The `Dockerfile` runs `npm run theme:pull -- --frozen` before `npm run build`. A site that pins themes commits `themes.lock.json` and builds its image from the repository; the image needs network access to the registry during the build, or a warm cache.
