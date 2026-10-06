# Third-party material

Micelio's license ([LICENSE](LICENSE), AGPL-3.0-only) and its theme exception ([LICENSE-EXCEPTION.md](LICENSE-EXCEPTION.md)) cover only the work of Micelio's contributors. **Third-party material is not part of that licensing**: Micelio's contributors do not relicense it, it is not offered under the AGPL or under the theme exception, and it keeps the license its authors gave it. Whoever reuses it follows that license, not Micelio's.

This applies to everything below and to any third-party material added later, listed here or not. When you add some, list it here with its source and license, and keep its license file next to it.

## Dependencies

npm packages (`package.json`, `package-lock.json`) are distributed under their own licenses, which each package carries. `npm run lint:licenses` (`scripts/check-licenses.mjs`) fails when a production dependency has a license that cannot be combined with AGPL-3.0; the exceptions and their reasons are in `scripts/licenses-allow.json`.

- `elkjs` (EPL-2.0), a dependency of `mermaid`, used unmodified and only on articles with diagrams, where it is sent to the browser as a separate file. EPL-2.0 is not on the compatible list; that file stays under the EPL-2.0, and its source is available at https://github.com/kieler/elkjs (version in `package-lock.json`).

## Fonts

Under the SIL Open Font License 1.1; the license text ships next to each file.

| Font | Files | License |
| --- | --- | --- |
| Archivo, The Archivo Project Authors | `themes/bogota/fonts/archivo-latin-var.woff2` | OFL-1.1 (`OFL-Archivo.txt`) |
| JetBrains Mono, The JetBrains Mono Project Authors | `themes/bogota/fonts/jetbrains-mono-latin-var.woff2` | OFL-1.1 (`OFL-JetBrainsMono.txt`) |
| Fraunces, The Fraunces Project Authors | `themes/starter/fonts/fraunces-latin-var.woff2` | OFL-1.1 (`OFL-Fraunces.txt`) |

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
