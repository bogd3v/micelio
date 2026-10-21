# Install themes from the registry

**Kind:** how-to. Goal: pin a theme from the registry, or from a file, install it with `npm run theme:pull` and build with it.

Micelio is pre-1.0 and not stable. The registry and its publish workflows (#311 and #312) are not live yet: the client below is ready, and it refuses a registry whose index, packages and attestations it cannot verify.

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

`theme:pull` does not rebuild anything. `NUXT_PUBLIC_THEME=<id>` still takes a bare id (at build the theme of the image, at runtime its default theme: [Configure](configure.md)); Nuxt compiles the slots of `.micelio/themes/<id>/` when it builds. A theme that is both in `themes/` (or in `MICELIO_THEME_DIRS`) and in the lock is read from `themes/`, with a notice, so you can work on a checkout. With `CI=true` that is an error, so a build never uses an unpinned theme by accident.

## Settings

| Variable | Default | What it does |
| --- | --- | --- |
| `MICELIO_THEME_REGISTRY` | `ghcr.io/bogd3v/micelio-themes` | `host[:port]/path` of the OCI registry. The scheme is always `https`; `http` is accepted only for a loopback host (a local registry). Public packages need no credentials. |
| `MICELIO_THEME_REGISTRY_IDENTITY` | none | Required for a registry other than the default, ignored for the default: `issuer=<URL>,package=<URL>[,index=<URL>]`. `issuer` is the OIDC issuer of the signing certificates (for GitHub Actions, `https://token.actions.githubusercontent.com`); `package` and `index` are the exact subject alternative names, the full workflow identity such as `https://github.com/<owner>/<repo>/.github/workflows/publish.yml@refs/heads/main`, of the workflows that sign packages and the index (`index` defaults to `package`). They are compared whole, never as patterns. Without it the client installs nothing from that registry. |
| `MICELIO_THEME_STORE` | none | Absolute path of the deployment theme store (runtime). Unset, only the themes built into the image activate and the server installs nothing. |
| `MICELIO_THEME_INSTALL` | `true` | `true`, `false`, `1` or `0` (runtime): whether the server may install themes into the store. No effect without a store. |
| `MICELIO_CACHE_DIR` | `$XDG_CACHE_HOME/micelio` or `~/.cache/micelio` | Where pulled packages are cached by digest, in `themes/`. A pulled version installs offline. The cache is not trusted: every read checks the digest again. |

## What is checked

- The pin: the id, the exact version and the digest are checked against their grammar before any request or path is built from them.
- The download stops at 2 MiB while streaming, whatever the registry sends, and each request has a 30 second limit. Only a blob may be redirected (at most three times); a redirect must be `https` on port 443, never carries credentials, and may not go to an IP address or to a name that is not public (no dot, `.local`, `.internal`…). The token service must be the registry's own host. Names are not resolved or checked against private address ranges, so use a registry you trust.
- **The index.** It is signed: its Sigstore bundle (tag `v1.att` next to the index) must verify against the index signer identity before any of it is used. A package fetched from the registry is installed only if the index lists `<id>@<version>` with the digest in the lock and status `published`; a `yanked` or `incompatible` version installs only when the digest is the one in your lock.
- **The attestation.** Each package has a Sigstore bundle (tag `<version>.att` next to the package): a SLSA provenance, signed with a certificate of the registry's publish workflow, whose subject is the package digest. It is verified offline against the trusted root that ships with Micelio (certificate chain, transparency log entry with its inclusion proof and signed time, signature), and the signer must be exactly the expected workflow. Bundles are kept in the cache and verified again on every install: a package already in the cache installs offline, relying on the lock and its bundle rather than on a new look at the index. The index carries no freshness yet, so a validly signed older index could be replayed to `theme:add` (it lists as `published` a version yanked since); check `theme:outdated` against a registry you trust. `theme:pull` also removes folders of `.micelio/themes/` that are not in the lock. If the shipped trusted root no longer verifies a bundle, the install fails and says to upgrade Micelio: the root is refreshed in every release.
- The bytes must hash to the digest in the lock; then the package goes through the safe unpack (size, ratio, paths, content: [docs/security.md](../security.md#themes)) and must be the id and version it was pinned as, with a contract this core implements.
- Nothing from a package is executed at pull time.

A theme added from a file (`distribution: file`) has no attestation: you are its signer. The registry's server-side install, tiers and revocation come with #400 and #403.

## In the Docker image

The `Dockerfile` runs `npm run theme:pull -- --frozen` before `npm run build`. A site that pins themes commits `themes.lock.json` and builds its image from the repository; the image needs network access to the registry during the build, or a warm cache.

## The deployment store

`MICELIO_THEME_STORE` is a directory the server keeps compiled themes in, so a theme can be added without a new image ([how it works](../themes/theme-store.md), [ADR 0009](../adr/0009-theme-delivery-at-runtime.md)). Give it a volume that survives restarts, owned by and writable only by the user the server runs as: whoever can write the store can change what the site serves, so treat it like the image.

- A shared store (several replicas) needs a file system where creating a file exclusively works. That is not verified for network file systems yet; use one store per replica until it is.
- After a core upgrade, the themes the store holds are compiled again at boot from the packages it kept, with no request to the registry.
- Entries compiled for earlier core builds stay until they are removed; `pruneStore` in `modules/theme/install/store.ts` removes them and the packages nothing uses, and there is no command for it yet.
- The Compose files live in `micelio-cms` ([install](install.md)) and do not mount a store volume yet; add one to yours, owned by the server's user.
