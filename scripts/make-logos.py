#!/usr/bin/env python3
"""Genera las variantes del logo Transform Acción 720 a partir del archivo
original en alta resolución subido por el usuario:
  - public/logo-white.png : original (texto blanco) para fondos oscuros.
  - public/logo.png       : variante para fondos claros (blanco -> carbón #1C1C1C).
Recorta márgenes transparentes para que el logo aproveche el lienzo.
"""
from PIL import Image

SRC = '/home/z/my-project/upload/pasted_image_1793833686825.png'
WHITE = '/home/z/my-project/public/logo-white.png'
LIGHT = '/home/z/my-project/public/logo.png'
CARBON = (28, 28, 28)  # #1C1C1C Negro Carbón

im = Image.open(SRC).convert('RGBA')

# 1) Recorte del contenido visible (bbox del alfa) con un pequeño margen
alpha = im.getchannel('A')
bbox = alpha.getbbox()
print('bbox original:', bbox, 'size:', im.size)
pad = 12
l = max(0, bbox[0] - pad)
t = max(0, bbox[1] - pad)
r = min(im.width, bbox[2] + pad)
b = min(im.height, bbox[3] + pad)
im = im.crop((l, t, r, b))
print('recortado:', im.size)

# 2) Variante para fondo oscuro: se guarda el original recortado,
#    reducido a un ancho razonable para la web (2x de su uso máx. ~200px)
target_w = 900
ratio = target_w / im.width
im_web = im.resize((target_w, round(im.height * ratio)), Image.LANCZOS)
im_web.save(WHITE, optimize=True)
print('guardado', WHITE, im_web.size)

# 3) Variante para fondo claro: píxeles casi blancos -> carbón,
#    conservando el alfa original y los tonos suaves (escalado por luminancia)
px = im.load()
out = Image.new('RGBA', im.size)
po = out.load()
cr, cg, cb = CARBON
for y in range(im.height):
    for x in range(im.width):
        r0, g0, b0, a0 = px[x, y]
        if a0 == 0:
            po[x, y] = (0, 0, 0, 0)
            continue
        # luminancia relativa aproximada
        lum = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0
        if lum > 225 and r0 > 215 and g0 > 215 and b0 > 215:
            # blanco puro -> carbón (con el mismo alfa)
            po[x, y] = (cr, cg, cb, a0)
        elif lum > 170 and abs(r0 - g0) < 18 and abs(g0 - b0) < 18:
            # grises muy claros (brillos del trazo blanco) -> gris carbón suave
            f = lum / 255.0
            nr = round(cr + (255 - cr) * (1 - f) * 0.0 + (255 - cr) * 0.18)
            ng = nr
            nb = nr
            po[x, y] = (nr, ng, nb, a0)
        else:
            po[x, y] = (r0, g0, b0, a0)

out_web = out.resize((target_w, round(out.height * ratio)), Image.LANCZOS)
out_web.save(LIGHT, optimize=True)
print('guardado', LIGHT, out_web.size)
