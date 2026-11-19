import hashlib, shutil, sys, pathlib
root = pathlib.Path(sys.argv[1]); R = lambda n: (root/'src'/n).read_text(encoding='utf-8')
game = R('game.js'); assert game.count('/*FX*/') == 1 and game.count('/*MUS*/') == 1
game = game.replace('/*FX*/', R('fx.js')).replace('/*MUS*/', R('mus.js'))
out = R('index.html').replace('/*CSS*/', R('ui.css')).replace('/*CARDS*/', R('cards.js')).replace('/*CONTENT*/', R('content.js')).replace('/*GAME*/', game)
assert '</script>' not in R('content.js') and '</script>' not in game
# Installable and playable offline (add to home screen; works on a plane after one visit). Only active over http(s).
head = ('<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="蟒行记">\n')
reg = "<script>if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});</script>\n"
assert out.count('</head>') == 1 and out.count('</body>') == 1
out = out.replace('</head>', head + '</head>').replace('</body>', reg + '</body>')
dist = root/'dist'; dist.mkdir(exist_ok=True)
(dist/'index.html').write_text(out, encoding='utf-8')
build = hashlib.sha256(out.encode('utf-8')).hexdigest()[:12]
(dist/'sw.js').write_text(R('pwa/sw.js').replace('__BUILD__', build), encoding='utf-8')
for f in ('manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'): shutil.copy(root/'src'/'pwa'/f, dist/f)
print('built', len(out.encode('utf-8')), 'bytes, cache', build)
