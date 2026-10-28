"""
Bygger web-appen (iPhone/Android/PC) ud fra Android-appens filer.

    python build.py

Kopierer app/src/main/assets → docs/, tilføjer web-filerne fra web/ (installation, offline,
iPhone-tilpasning, proxy-indstilling) og laver manifest + service worker.
docs/ er det, GitHub Pages viser. Kør scriptet igen, når Android-appen er ændret.
"""
import hashlib
import json
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / 'app' / 'src' / 'main' / 'assets'
WEB = HERE / 'web'
OUT = HERE / 'docs'

# Store filer der først hentes, når de bruges (ordlisterne til ordbøgerne og hadith-kapitlerne)
LAZY = re.compile(r'^(words-.*\.js|babs/.*)$')  # matcher stien relativt til docs/

HEAD = '''    <!-- Web-app (tilføjet af web-app/build.py) -->
    <link rel="manifest" href="manifest.webmanifest">
    <meta name="theme-color" content="#0b2545">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Koran">
    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
    <link rel="stylesheet" href="web.css">
'''

MANIFEST = {
    'name': 'Koran-memorering',
    'short_name': 'Koran',
    'description': 'Koran-memorering med tafsir, hadith, adhkar, ordbøger og noter',
    'lang': 'da',
    'dir': 'ltr',
    'start_url': './',
    'scope': './',
    'display': 'standalone',
    'orientation': 'portrait',
    'background_color': '#0b2545',
    'theme_color': '#0b2545',
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any maskable'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'},
    ],
}


def main():
    if not SRC.is_dir():
        raise SystemExit(f'Finder ikke Android-appens filer: {SRC}')
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT)
    for name in ('web.js', 'web.css', 'config.js'):
        shutil.copy2(WEB / name, OUT / name)
    shutil.copytree(WEB / 'icons', OUT / 'icons')
    (OUT / 'manifest.webmanifest').write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / '.nojekyll').write_text('', encoding='utf-8')  # GitHub Pages: vis filerne som de er

    # index.html: web-felter i <head>, config.js før appens scripts og web.js til sidst
    index = OUT / 'index.html'
    html = index.read_text(encoding='utf-8')
    html, n1 = re.subn(r'(<meta name="viewport"[^>]*>\n)', lambda m: m.group(1) + HEAD, html, count=1)
    first_script = re.search(r'^(\s*)<script src="', html, re.M)
    html = html[:first_script.start()] + f'{first_script.group(1)}<script src="config.js"></script>' + html[first_script.start():]
    html, n2 = re.subn(r'(\s*)(<script src="pages\.js"></script>)', r'\1\2\1<script src="web.js"></script>', html, count=1)
    if not (n1 and n2):
        raise SystemExit('Kunne ikke indsætte web-delene i index.html')
    index.write_text(html, encoding='utf-8')

    # Service worker: versionsnummer ud fra indholdet, så telefonen opdager nye versioner
    files = sorted(p for p in OUT.rglob('*') if p.is_file() and p.name not in ('.nojekyll',))
    h = hashlib.sha256()
    for p in files:
        h.update(p.relative_to(OUT).as_posix().encode())
        h.update(p.read_bytes())
    h.update((WEB / 'sw-template.js').read_bytes())  # ændringer i service workeren giver også en ny version
    version = h.hexdigest()[:12]
    precache = [p.relative_to(OUT).as_posix() for p in files if not LAZY.match(p.relative_to(OUT).as_posix())]
    sw = (WEB / 'sw-template.js').read_text(encoding='utf-8')
    sw = sw.replace('__VERSION__', version).replace('__PRECACHE__', json.dumps(precache, ensure_ascii=False))
    (OUT / 'sw.js').write_text(sw, encoding='utf-8')

    size = sum(p.stat().st_size for p in files)
    pre = sum((OUT / f).stat().st_size for f in precache)
    print(f'Web-app bygget i {OUT}')
    print(f'  {len(files)} filer, {size / 1e6:.1f} MB i alt; {pre / 1e6:.1f} MB gemmes til offline ved første besøg')
    proxy_set = "proxy: ''" not in (WEB / 'config.js').read_text(encoding='utf-8')
    print(f'  version {version}; proxy: {"sat" if proxy_set else "IKKE sat (se VEJLEDNING.md)"}')


if __name__ == '__main__':
    main()
