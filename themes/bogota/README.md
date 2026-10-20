# Bogotá

The theme of BogDev, shipped with Micelio. Its code, styles and messages are under the AGPL (`license` in `theme.json`:
`AGPL-3.0-only`, the text in `LICENSE`). In the Micelio repository the same files also carry the theme exception of
`LICENSE-EXCEPTION.md` (`AGPL-3.0-only WITH LicenseRef-Micelio-Theme-exception` in `REUSE.toml`), which lets a theme that keeps to
the contract choose its own license for the theme package; `theme.json` names the plain AGPL because this is the license BogDev
publishes it under. Some files keep another license, which this package carries with them:

| Files | License | Where the text and the credit are |
| --- | --- | --- |
| `fonts/archivo-latin-var.woff2` (Archivo, The Archivo Project Authors) | OFL-1.1 | `fonts/OFL-Archivo.txt` |
| `fonts/jetbrains-mono-latin-var.woff2` (JetBrains Mono, The JetBrains Mono Project Authors) | OFL-1.1 | `fonts/OFL-JetBrainsMono.txt` |
| `images/hero/sumapaz-day.jpg`, `images/hero/sumapaz-night.jpg` (photo of the Sumapaz páramo by Danielfjio, Wikimedia Commons, cropped and color graded) | CC-BY-SA-4.0 | The hero shows the credit and links to the original; the full attribution is in `THIRD-PARTY.md` of the Micelio repository, and the license is annotated in `REUSE.toml` (`themes/bogota/images/hero/sumapaz-*.jpg`) |
| `images/bogdev*.svg`, `images/copeton.png`, `images/og-image.png` | AGPL-3.0-only | The maintainer's own work; no trademark rights are granted (`TRADEMARKS.md` of the Micelio repository) |

The fonts are subsets of the original files, which the OFL allows because the licenses declare no Reserved Font Name.
The modified photos stay CC BY-SA 4.0, so anything built from them must too.
