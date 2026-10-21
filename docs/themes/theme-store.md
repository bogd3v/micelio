# The theme store and the install step

How a theme becomes something a site can serve without a build. Explanation and reference for contributors and theme creators; the decision is [ADR 0009](../adr/0009-theme-delivery-at-runtime.md) (still `Proposed`). This page covers what `installTheme()` and `installIsolated()` do today (#400). The server and CLI callers come with the next parts.

## What `installTheme()` does

`modules/theme/install/install.ts` takes a theme and turns it into one **store entry**:

1. **Pin** (package only): `themeId`, `themeVersion` and `themeDigest` are checked against their grammar before anything else.
2. **Unpack** (package only): the safe unpack of `modules/theme/registry/unpack.ts` against the pinned digest; the files are written to a private `0700` folder inside the store and the package must be the id and version the pin names.
3. **Code**: a theme with `slots/` or `templates/` is refused unless the caller sets `allowCode` (the image build does, a server never).
4. **Validate**: the contract validator and the error-level checks of `theme:check` (public hooks only, no remote `url()`, contrast matrix, static budgets). Any problem is listed in the error.
5. **Compile**: see below.
6. **Write**: the entry is built in a staging folder and renamed into place under a lock, so an interrupted install leaves nothing a reader can see.

Nothing from a theme is executed, imported or evaluated at any step. A source is a package (with its pin) or a theme folder (the dev loop, the image build); both go through the same steps.

## Reading an entry back

`loadEntry()` and, for a server plugin that Nitro does not wait for, `loadEntrySync()` verify an entry against its manifest and return its bytes. `parseRuntime()` (`install/runtime.ts`) then reads `runtime.json` with a schema that re-derives every value that can reach HTML, a header or a path: ids and modes in the grammar of the contract, font and image URLs under the entry's own `/_t/<digest>/` folders, short text with no control characters or tags, palette colors as `#rrggbb`, and message trees of the message compiler's node types with no prototype keys and a size cap. It never echoes the offending value.

`InstallOptions.buildChecksOnly` is for the image's own build: it runs the contract, hook and package checks of the Nuxt build and skips the admission checks of `theme:check` (contrast and static budgets), which a build never made for a theme the operator installed by hand. A server install never sets it.

## The built-in store and `/_t/`

The image build installs every theme of the build (`themes/`, the lock's, `MICELIO_THEME_DIRS`) into a built-in store with `modules/theme/built-in-store.ts`, at the build's own core build id, and copies it to `.output/server/micelio/store`. It runs the checks of the Nuxt build (contract, public hooks, package) and `allowCode`; contrast and budgets are admission checks, which the build does not make for a theme the operator installed by hand. In development the store is `node_modules/.cache/micelio/built-in-store/<build id>/`.

At boot `server/plugins/builtInTheme.ts` loads the build's theme from it, verifies the entry against its manifest and parses `runtime.json` (`install/runtime.ts`); a defect stops the boot. `GET /_t/<digest>/<file>` serves that entry's files from memory ([API](../api.md)). The pages read the theme's modes, images, layout variants and Mermaid overrides from it (`useThemeData()`, below); the following PRs of #401 move the messages and the stylesheet.

### What a page reads

`server/plugins/builtInTheme.ts` puts a frozen slice of `runtime.json` (`id`, `digest`, `modes`, `images`, `layout`, `mermaid`) in `event.context.theme` on every request. `useThemeData()` (`app/composables/useThemeData.ts`) reads it into the shared state `myc-theme-data` on the server and from the payload on the client, and throws, not a blank page, if the server did not provide it. The `#micelio/theme`, `#micelio/theme-mermaid` and `#micelio/theme-palette` virtual modules are gone; the server reads the palette, the fonts and the display-family data from the active theme (`activeTheme()`). A theme's default favicon and share image are now `/_t/<digest>/images/<file>`, so they change URL whenever the build does. `#micelio/build-theme` stays until `NUXT_PUBLIC_THEME` is read at runtime.

In a component test, `test/nuxt/setup.ts` gives every test Bogotá's data; `setThemeData({ … })` changes it.

## Isolation

`installIsolated(source, options, limits)` (`modules/theme/install/isolated.ts`) runs `installTheme` in a child process: an empty environment, `--max-old-space-size=256` and a `SIGKILL` at 60 s by default, and one install at a time (a second caller waits). Lightning CSS is native code, so a `worker_thread` limit could not stop it. A failure comes back as the same `InstallError`; running out of memory, exiting early and the timeout are rule `compile`. The child's peak memory is returned as `maxRssKb`.

The worker is `worker.ts` next to it, loaded through jiti in tests and dev. A built server ships its own `worker.mjs` (decided with the callers, #403). A compiled entry holds at most 4 MiB of files, not counting the gzip and brotli copies.

## What a store entry holds

`<store>/v1/entries/<digest>/`:

| File | Content |
| --- | --- |
| `theme.css` | `fonts.css`, `font-fallbacks.css` and the role tokens in `myc.settings`; the mode switch in `myc.components`; `theme.css` (and, for a code theme, `slots/*.css`) in `myc.theme`. Minified and lowered with the core's browser targets |
| `sections.css` | The theme's `sections.css` in `myc.theme`, kept apart as in the build |
| `runtime.json` | Id, version, both digests, contract, `code`, modes, fonts and preloads with their URLs, images, layout, slots, display-family data, the palette and contrast rules, and the `theme.*` messages compiled to the AST |
| `fonts/`, `images/` | The files `fonts/` (woff, woff2, license texts) and `images/` allow |
| `*.gz`, `*.br` | A gzip and a brotli copy of each `.css`, `.json`, `.svg` and `.txt` file |
| `manifest.json` | The size and sha256 of every other file, the package digest, the compile key and whether the entry came from a package or a folder |

The `url()` of the theme's CSS is rewritten on the parsed tree to `/_t/<digest>/fonts/…` and `/_t/<digest>/images/…` (also inside `image-set()` and custom properties). A URL that cannot be rewritten fails the install. A theme's source keeps using `/fonts/` and `/theme/images/`.

## Digests

- The **package digest** is the sha256 of the `.tgz` (of the file tree, for a folder). It is what a pin names.
- The **entry digest** (the `<digest>` of `/_t/<digest>/`, 64 hex digits) is a hash of the package digest and the **compile key**: the core build, the compiler version, the versions and targets of Lightning CSS and the message compiler, and the contract. A core upgrade gives new URLs, so an `immutable` file never changes under one URL.
- Compilation is deterministic: the same package and compile key give the same bytes (gzip with no timestamp, a stable order of files and rules). `test/themeInstall.test.ts` installs twice, in two stores, and compares every byte.

## Store layout and trust

```
<MICELIO_THEME_STORE>/v1/
  entries/<entry digest>/     compiled entries
  packages/<package hex>/     the verified package.tgz and its attestation bundle
  .tmp/                       staging folders and locks
```

- An entry counts as **installed** only when `installedEntry()` finds, for the pin: the kept package hashing to the pinned digest, an attestation the caller's `verify` accepts (when it passes one), an entry of this core's compile key whose manifest names that package digest, and then every file matching the manifest. A folder planted with a matching manifest and no verified package is not installed.
- `loadEntry()` refuses a changed, a missing and an extra file, and returns the verified bytes: serve those, do not read the path again.
- One install per digest runs at a time, behind a lock file with an owner and a lease of 60 s. `cleanTemporary()` removes staging folders and expired locks at boot.
- The store is writable only by the installer's uid. A shared store on a network file system needs `O_EXCL` to work there; that is not verified yet.

Errors are `InstallError` with a `rule` (`pin`, `package`, `identity`, `code`, `validation`, `messages`, `css`, `url`, `assets`, `compile`, `store`, `busy`, `integrity`); the message names the theme, the version and the digest and carries no file system path.

## Configuration, boot and cleanup

- `readInstallConfig(env)` reads `MICELIO_THEME_STORE` (an absolute path) and `MICELIO_THEME_INSTALL` (on by default). Unset store: no deployment store, nothing is installed, and the result carries the one warning to log. An invalid value throws a message that names the variable, so the boot stops.
- `recompileStored(pins, options, limits, verify)` compiles the given pins again for this core build from their kept packages, one after another, in the isolated process. It makes no network request, re-verifies the kept attestation when `verify` is given, and reports `current`, `recompiled`, `missing` or `failed` per pin without throwing.
- `pruneStore(storeDir, compileKey, keep)` removes entries compiled for other core builds and the packages no remaining entry uses, except those of the pins in `keep`.
