# Third-party material

Micelio's license ([LICENSE](LICENSE), AGPL-3.0-only) and its theme exception ([LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md)) cover only the work of Micelio's contributors. **Third-party material is not part of that licensing**: Micelio's contributors do not relicense it, it is not offered under the AGPL or under the theme exception, and it keeps the license its authors gave it. Whoever reuses it follows that license, not Micelio's.

This applies to everything below and to any third-party material added later, listed here or not. When you add some, list it here with its source and license, keep its license file next to it, and annotate its path in [REUSE.toml](REUSE.toml), the machine-readable version of this list (`reuse lint` checks it in CI; the license texts are in `LICENSES/`).

## Dependencies

npm packages (`package.json`, `package-lock.json`) are distributed under their own licenses, which each package carries. `npm run lint:licenses` (`scripts/check-licenses.mjs`) fails when a production dependency has a license that cannot be combined with AGPL-3.0; the exceptions and their reasons are in `scripts/licenses-allow.json`.

- `elkjs` (EPL-2.0), a dependency of `mermaid`, used unmodified and only on articles with diagrams, where it is sent to the browser as a separate file. EPL-2.0 is not on the compatible list; that file stays under the EPL-2.0, and its source is available at https://github.com/kieler/elkjs (version in `package-lock.json`).
- `quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync` (MIT), the JavaScript engine of the playground (QuickJS compiled to WebAssembly), used unmodified. The glue code and the `.wasm` file are sent to the browser as separate files under `/_islands/runtimes/`, only when a reader runs a JavaScript block. MIT is on the compatible list; the license text ships with each package, and QuickJS itself is MIT too (https://github.com/justjake/quickjs-emscripten, versions in `package-lock.json`).
- `pyodide` (MPL-2.0), CPython compiled to WebAssembly with its standard library, used unmodified and only when a reader presses Run on a Python block, where its files (`pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, and a lock file that lists no packages) are sent to the browser from `/_islands/runtimes/`. They stay under the MPL-2.0 (and the licenses of Python and of the libraries Pyodide bundles); the source is https://github.com/pyodide/pyodide, tag 314.0.7 (the npm package `pyodide@314.0.7`).

## Fonts

Under the SIL Open Font License 1.1; the license text ships next to each file. The Bogotá files are subsets of the previous full files (fewer glyphs and a narrower axis range, `scripts/perf/subset-theme-fonts.py`, sources pinned in `scripts/perf/bogota-font-sources.json`); the licenses declare no Reserved Font Name.

| Font | Files | License |
| --- | --- | --- |
| Archivo, The Archivo Project Authors | `themes/bogota/fonts/archivo-latin-var.woff2` | OFL-1.1 (`OFL-Archivo.txt`) |
| JetBrains Mono, The JetBrains Mono Project Authors | `themes/bogota/fonts/jetbrains-mono-latin-var.woff2` | OFL-1.1 (`OFL-JetBrainsMono.txt`) |
| Fraunces, The Fraunces Project Authors | `themes/starter/fonts/fraunces-latin-var.woff2` | OFL-1.1 (`OFL-Fraunces.txt`) |
| Archivo, The Archivo Project Authors | `app/assets/fonts/display/archivo-latin-wght.woff2` (curated display font, served at `/fonts/display/`) | OFL-1.1 (`OFL-Archivo.txt`) |
| Fraunces, The Fraunces Project Authors | `app/assets/fonts/display/fraunces-latin-wght.woff2` (curated display font, served at `/fonts/display/`) | OFL-1.1 (`OFL-Fraunces.txt`) |
| Bricolage Grotesque, The Bricolage Grotesque Project Authors | `app/assets/fonts/display/bricolage-grotesque-latin-wght.woff2` (curated display font, served at `/fonts/display/`) | OFL-1.1 (`OFL-BricolageGrotesque.txt`) |
| Newsreader, The Newsreader Project Authors | `app/assets/fonts/display/newsreader-latin-wght.woff2` (curated display font, served at `/fonts/display/`) | OFL-1.1 (`OFL-Newsreader.txt`) |
| Space Grotesk, The Space Grotesk Project Authors | `app/assets/fonts/display/space-grotesk-latin-wght.woff2` (curated display font, served at `/fonts/display/`) | OFL-1.1 (`OFL-SpaceGrotesk.txt`) |

The curated display fonts in `app/assets/fonts/display/` are subset from the variable TTFs of https://github.com/google/fonts at commit `7085eb89a950e85db5b166b7a58d414544b4140c` (fontTools 4.66.0). `scripts/perf/subset-display-fonts.py` (dev-only) downloads them from that commit, checks the source hashes below and reproduces the committed files byte for byte; `app/assets/fonts/display-sources.json` records the same hashes (and those of the license texts) and `test/displayFonts.test.ts` pins the woff2 ones.

| Font | Source in google/fonts | sha256 of the source TTF | sha256 of the woff2 |
| --- | --- | --- | --- |
| `archivo` | `ofl/archivo/Archivo[wdth,wght].ttf` | `0e094a7d3c7c4c25cf1310c4b30014f1dae9332220b1c2c88f4fa996f0b05053` | `c9bcd30d0f00a07d74c7a0dbf4336f468d74fc4652dd49a4b24449879276610d` |
| `fraunces` | `ofl/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf` | `177ff6c0f14e5550a3c624247cd1189611d4eb65d000b14944c63d967958abbb` | `6bd23f4e64df2430ce8560b3d2229716deace3e41ccf041d95b6a901e71c0b6e` |
| `bricolage-grotesque` | `ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf` | `413e7357809ddd12fd80a96a8a396de0e401638d4acd3cb3e37532f0472ac682` | `f26bb2aefe86f916302b4f8111f87f54943b39b4b9f1c3a0ae0a95b840f8d3ee` |
| `newsreader` | `ofl/newsreader/Newsreader[opsz,wght].ttf` | `8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1` | `a5e07912d00cafd30239b7470b3d0c0466b2de110a7c29e941d48a6f57029524` |
| `space-grotesk` | `ofl/spacegrotesk/SpaceGrotesk[wght].ttf` | `acad6de1fc93436f5c0f1f4137751ef04f1aea3063e7036535970ffcfbd79f72` | `0d283ee847c39bb2afc4012de0882633ee0cf79a4fb1ff5665c29af2991b7fa5` |

## Images

| Material | Files | Source and license |
| --- | --- | --- |
| Photo of the Sumapaz páramo by Danielfjio, cropped and color graded | `themes/bogota/images/hero/sumapaz-day.jpg`, `sumapaz-night.jpg`, `docs/design/assets/sumapaz-foto-*.jpg`, `docs/design/assets/articulo-foto-sumapaz.jpg` | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The modified versions are also CC BY-SA 4.0; credit is shown on the site. Details in `docs/design/assets/CREDITOS.md` |
| Heroicons | `app/components/icons/*.vue` | [Heroicons](https://heroicons.com), MIT, Tailwind Labs (`app/components/icons/LICENSE-heroicons`) |

## Logos and trademarks

Logos of other projects are used only to link to them, unmodified, and remain trademarks of their owners. No license to them is granted.

| Logo | Files | Owner |
| --- | --- | --- |
| Mastodon | `app/components/bd/BdMastodonLogo.vue`, `docs/design/assets/mastodon-logo-purple.svg` | Mastodon gGmbH, [trademark policy](https://joinmastodon.org/trademark) |

## Names and marks of Micelio and BogDev

The names Micelio and BogDev, the BogDev logos and the Bogotá theme's mark (`themes/bogota/images/bogdev*.svg`, `copeton.png`, `og-image.png`) are the maintainer's own work. Their files are distributed with the code under the AGPL, but no trademark rights are granted (AGPL section 7(e)): a fork or another site may not present itself as BogDev or as the official Micelio.

## Themes in this repository

`themes/starter/` is licensed under MIT-0 (`themes/starter/LICENSE`), so a theme started from it with `npm run theme:new` may take any license. `themes/bogota/` is BogDev's theme and is under the AGPL with the rest of the repository. Their fonts and images keep the licenses listed above.

## Site content

What a site publishes with Micelio (articles, pages, images, comments and settings stored in the CMS) belongs to its authors and is licensed by them. It is not part of Micelio, and running Micelio places no license on it.

## Themes by others

A theme written by someone else follows the license its author chose; under [LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md) that can be any license, as long as the theme uses only the public theme contract.
