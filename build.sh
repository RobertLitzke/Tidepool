#!/bin/sh
# Builds the game.
#   tidepool.html  single-file page (published as the Claude artifact)
#   dist/          installable offline PWA for GitHub Pages
cd "$(dirname "$0")"
python3 - <<'PY'
import os, shutil, hashlib
import datetime
import subprocess
ui = open('ui.html').read().replace('<!--ART-->', subprocess.check_output(['node', 'art.js']).decode()); eng = open('eco-reef.js').read() + '\n' + open('eco-forest.js').read() + '\n' + open('eco-serengeti.js').read() + '\n' + open('engine.js').read()
src_hash = hashlib.sha1((ui + eng + open('pwa/sw.js').read() + open('pwa/tail.html').read()).encode()).hexdigest()[:7]
build = datetime.datetime.now(datetime.timezone.utc).strftime('%b %d %H:%M UTC') + ' · ' + src_hash
page = ui.replace('/*ENGINE*/', eng).replace('__BUILD__', build)
open('tidepool.html', 'w').write(page)
os.makedirs('dist/icons', exist_ok=True)
html = open('pwa/head.html').read() + page + open('pwa/tail.html').read()
open('dist/index.html', 'w').write(html)
ver = hashlib.sha1(html.encode()).hexdigest()[:10]
open('dist/sw.js', 'w').write(open('pwa/sw.js').read().replace('__VERSION__', ver))
shutil.copy('pwa/manifest.webmanifest', 'dist/manifest.webmanifest')
for f in os.listdir('pwa/icons'): shutil.copy('pwa/icons/' + f, 'dist/icons/' + f)
open('dist/.nojekyll', 'w').close()
print('built tidepool.html and dist/ (build ' + build + ')')
PY
