#!/bin/sh
# Builds the game.
#   tidepool.html  single-file page (published as the Claude artifact)
#   dist/          installable offline PWA for GitHub Pages
cd "$(dirname "$0")"
python3 - <<'PY'
import os, shutil, hashlib
ui = open('ui.html').read(); eng = open('engine.js').read()
page = ui.replace('/*ENGINE*/', eng)
open('tidepool.html', 'w').write(page)
os.makedirs('dist/icons', exist_ok=True)
html = open('pwa/head.html').read() + page + open('pwa/tail.html').read()
open('dist/index.html', 'w').write(html)
ver = hashlib.sha1(html.encode()).hexdigest()[:10]
open('dist/sw.js', 'w').write(open('pwa/sw.js').read().replace('__VERSION__', ver))
shutil.copy('pwa/manifest.webmanifest', 'dist/manifest.webmanifest')
for f in os.listdir('pwa/icons'): shutil.copy('pwa/icons/' + f, 'dist/icons/' + f)
open('dist/.nojekyll', 'w').close()
print('built tidepool.html and dist/ (version ' + ver + ')')
PY
