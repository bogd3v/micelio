"""Subsets the curated display fonts (ADR 0005, section 8) into app/assets/fonts/display/. Dev-only: nothing here runs in the build.

Sources are pinned in app/assets/fonts/display-sources.json: the google/fonts commit, and the sha256 of each OFL variable
TTF and license text. The script downloads them from that commit into a temporary directory, stops if a hash differs,
and writes <id>-latin-wght.woff2 (upright, latin subset, `wght` axis only, every other axis pinned at its default, no hinting)
and OFL-<Family>.txt. The woff2 hashes of the JSON are what test/displayFonts.test.ts pins; `--update` records new ones.

    pip install fonttools brotli
    python3 scripts/perf/subset-display-fonts.py [--update]

Output depends on the fontTools and brotli versions (the JSON records the fontTools one it was made with); a different hash
with other versions is not proof of tampering, a different input hash is.
"""

import hashlib
import io
import json
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import quote

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'app/assets/fonts/display'
SOURCES = ROOT / 'app/assets/fonts/display-sources.json'
FAMILIES = {
    'archivo': 'Archivo',
    'fraunces': 'Fraunces',
    'bricolage-grotesque': 'BricolageGrotesque',
    'newsreader': 'Newsreader',
    'space-grotesk': 'SpaceGrotesk',
}
# The latin range of themes/bogota/fonts.css (the main Archivo face)
UNICODES = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0304,U+0308,U+0329,'
            'U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD')


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download(commit: str, path: str) -> bytes:
    url = f'https://raw.githubusercontent.com/google/fonts/{commit}/{quote(path)}'
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310 (fixed https host)
        return response.read()


def main() -> None:
    update = '--update' in sys.argv
    sources = json.loads(SOURCES.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    changed = []
    with tempfile.TemporaryDirectory() as tmp:
        for font_id, name in FAMILIES.items():
            entry = sources['fonts'][font_id]
            ttf = download(sources['commit'], entry['path'])
            ofl = download(sources['commit'], entry['path'].rsplit('/', 1)[0] + '/OFL.txt')
            if sha256(ttf) != entry['ttfSha256']:
                sys.exit(f'{font_id}: the TTF at commit {sources["commit"]} does not match the recorded sha256')
            if sha256(ofl) != entry['oflSha256']:
                sys.exit(f'{font_id}: the OFL.txt at commit {sources["commit"]} does not match the recorded sha256')
            (Path(tmp) / f'{font_id}.ttf').write_bytes(ttf)
            font = TTFont(Path(tmp) / f'{font_id}.ttf', recalcTimestamp=False)
            pinned = {axis.axisTag: axis.defaultValue for axis in font['fvar'].axes if axis.axisTag != 'wght'}
            font = instantiateVariableFont(font, pinned)
            buffer = io.BytesIO()
            font.save(buffer)  # reload: the subsetter chokes on the instancer's lazy gvar
            font = TTFont(io.BytesIO(buffer.getvalue()), recalcTimestamp=False)
            options = subset.Options()
            options.flavor = 'woff2'
            options.hinting = False
            options.layout_features = ['*']
            options.name_IDs = [1, 2, 3, 4, 6]
            options.notdef_outline = True
            subsetter = subset.Subsetter(options)
            subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
            subsetter.subset(font)
            target = OUT / f'{font_id}-latin-wght.woff2'
            subset.save_font(font, str(target), options)
            (OUT / f'OFL-{name}.txt').write_bytes(ofl)
            digest = sha256(target.read_bytes())
            if digest != entry['woff2Sha256']:
                changed.append(font_id)
                entry['woff2Sha256'] = digest
            print(f'{target.name}: {target.stat().st_size} bytes, sha256 {digest}, pinned {pinned}')
    sources['fontTools'] = fontTools.version
    if update:
        SOURCES.write_text(json.dumps(sources, indent=2) + '\n')
    elif changed:
        sys.exit(f'woff2 differs from the recorded sha256 for {", ".join(changed)} (fontTools {fontTools.version}; run with --update to record)')
    print('ok' if not changed else 'recorded')


if __name__ == '__main__':
    main()
