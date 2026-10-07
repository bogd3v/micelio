"""Subsets Bogotá's fonts (themes/bogota/fonts/, #350). Dev-only: nothing here runs in the build.

Sources are pinned in scripts/perf/bogota-font-sources.json: the google/fonts commit and the sha256 of each OFL variable TTF.
The script downloads them from that commit, stops if a hash differs, and writes <name>-latin-var.woff2: only the glyphs
English and Spanish text needs, the variable axes cut to the range the CSS uses (Archivo `wght` 300-600 and `wdth` 100-125,
JetBrains Mono `wght` 400-700; the other axes are untouched), the layout features the CSS can reach, no hinting. Glyph
outlines inside those ranges are unchanged; a character outside the set (or a weight above 600 for Archivo) renders in the
fallback font (or at 600). Why and how much: docs/performance.md (#350). The unicode ranges must match themes/bogota/fonts.css.
The woff2 hashes are recorded for reproducibility; `--update` records new ones.
After changing the files, regenerate the fallback metrics with scripts/perf/font-fallbacks.py.

    pip install fonttools brotli
    python3 scripts/perf/subset-theme-fonts.py [--update]

Output depends on the fontTools and brotli versions (the JSON records the fontTools one); a different woff2 hash with
other versions is not proof of tampering, a different input hash is.
"""

import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path
from urllib.parse import quote

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'themes/bogota/fonts'
SOURCES = ROOT / 'scripts/perf/bogota-font-sources.json'
# Marks and locl need characters outside the set; JetBrains Mono's calt (code ligatures) alone costs 14 KB, so it is left out
FEATURES = ['rvrn', 'liga', 'tnum', 'kern']
# ASCII, the Spanish letters (accents, ñ, ü, ¡ ¿), « » · © ×, nbsp, dashes, quotes, bullet, ellipsis, euro, trademark, arrows, minus
LATIN = ('U+0020-007E,U+00A0-00A1,U+00A9,U+00AA,U+00B0,U+00BA,U+00AB,U+00B7,U+00BB,U+00BF,U+00C1,U+00C9,U+00CD,U+00D1,U+00D3,U+00DA,U+00DC,'
         'U+00D7,U+00E1,U+00E9,U+00ED,U+00F1,U+00F3,U+00FA,U+00FC,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,'
         'U+20AC,U+2122,U+2190-2193,U+2212')
# JetBrains Mono also carries the diagonal arrows, command key, triangle, diamond and check marks
SYMBOLS = ',U+2196-2199,U+2318,U+25B2,U+25C6,U+2713,U+2715'
FONTS = {
    'archivo': {'out': 'archivo-latin-var.woff2', 'unicodes': LATIN, 'axes': {'wght': (300, 600), 'wdth': (100, 125)}},
    'jetbrains-mono': {'out': 'jetbrains-mono-latin-var.woff2', 'unicodes': LATIN + SYMBOLS, 'axes': {'wght': (400, 700)}},
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    update = '--update' in sys.argv
    sources = json.loads(SOURCES.read_text())
    changed = []
    for font_id, spec in FONTS.items():
        entry = sources['fonts'][font_id]
        url = f'https://raw.githubusercontent.com/google/fonts/{sources["commit"]}/{quote(entry["path"])}'
        with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 (fixed https host)
            ttf = response.read()
        if sha256(ttf) != entry['ttfSha256']:
            sys.exit(f'{font_id}: the TTF at commit {sources["commit"]} does not match the recorded sha256')
        font = instantiateVariableFont(TTFont(io.BytesIO(ttf), recalcTimestamp=False), spec['axes'])
        buffer = io.BytesIO()
        font.save(buffer)  # reload: the subsetter chokes on the instancer's lazy gvar
        font = TTFont(io.BytesIO(buffer.getvalue()), recalcTimestamp=False)
        options = subset.Options()
        options.flavor = 'woff2'
        options.hinting = False
        options.layout_features = FEATURES
        options.name_IDs = [1, 2, 3, 4, 6]
        options.notdef_outline = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=subset.parse_unicodes(spec['unicodes']))
        subsetter.subset(font)
        target = OUT / spec['out']
        subset.save_font(font, str(target), options)
        digest = sha256(target.read_bytes())
        if digest != entry.get('woff2Sha256'):
            changed.append(font_id)
            entry['woff2Sha256'] = digest
        print(f'{target.name}: {target.stat().st_size} bytes, sha256 {digest}')
    sources['fontTools'] = fontTools.version
    if update:
        SOURCES.write_text(json.dumps(sources, indent=2) + '\n')
    elif changed:
        sys.exit(f'woff2 differs from the recorded sha256 for {", ".join(changed)} (fontTools {fontTools.version}; run with --update to record)')
    print('ok' if not changed else 'recorded')


if __name__ == '__main__':
    main()
