#!/usr/bin/env python3
"""Variante clara del logo: SOLO el texto "Transform" y la estela en espiral
pasan de blanco a carbón (#1C1C1C). La abeja (ojos, alas, brillos) no se toca.
Se usa análisis de componentes conexas sobre la máscara de píxeles casi
blancos: un componente se convierte si es el texto (centro x > 30% del ancho)
o la estela (centro y > 55% del alto, centro x < 50%).
"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = '/home/z/my-project/upload/pasted_image_1793833686825.png'
WHITE = '/home/z/my-project/public/logo-white.png'
LIGHT = '/home/z/my-project/public/logo.png'
CARBON = np.array([28, 28, 28], dtype=np.float64)

im = Image.open(SRC).convert('RGBA')

# Recorte con margen (igual que la variante blanca)
a = np.array(im)  # H,W,4
alpha = a[..., 3]
ys, xs = np.where(alpha > 8)
pad = 12
l, t = max(0, xs.min() - pad), max(0, ys.min() - pad)
r, b = min(im.width, xs.max() + pad), min(im.height, ys.max() + pad)
a = a[t:b, l:r]
H, W = a.shape[:2]
print('recortado:', (W, H))

rgb = a[..., :3].astype(np.float64)
al = a[..., 3]

# Máscara de casi-blanco opaco
near_white = (rgb.min(axis=-1) > 222) & (al > 60)
# Componentes conexas (8-vecinos)
lab, n = ndimage.label(near_white, structure=np.ones((3, 3)))
print('componentes:', n)

converted = np.zeros((H, W), dtype=bool)
for i in range(1, n + 1):
    comp = lab == i
    size = comp.sum()
    if size < 30:  # ruido
        continue
    cy, cx = ndimage.center_of_mass(comp)
    fx, fy = cx / W, cy / H
    is_text = fx > 0.30 and fy < 0.60
    is_trail = fy > 0.55 and fx < 0.50 and size > 300
    if is_text or is_trail:
        converted |= comp

# Aplicar conversión blanco->carbón con antialias suave:
# factor = qué tan "blanco" es el píxel dentro de los componentes elegidos
grow = ndimage.binary_dilation(converted, iterations=2) & near_white
mask = converted | grow
whiteness = np.clip((rgb.min(axis=-1) - 170) / (255 - 170), 0, 1)
blend = mask[..., None] * whiteness[..., None]
rgb_out = rgb * (1 - blend) + CARBON[None, None, :] * blend

out = np.concatenate([np.clip(rgb_out, 0, 255).astype(np.uint8), al[..., None]], axis=-1)
img_out = Image.fromarray(out, 'RGBA')

# Guardar ambas variantes a ancho web 900
target_w = 900
ratio = target_w / W
img_out.resize((target_w, round(H * ratio)), Image.LANCZOS).save(LIGHT, optimize=True)
print('guardado', LIGHT)

# Reafirmar también la blanca (mismo recorte)
Image.fromarray(a, 'RGBA').resize((target_w, round(H * ratio)), Image.LANCZOS).save(WHITE, optimize=True)
print('guardado', WHITE)

# Vista previa sobre fondo claro
prev = Image.new('RGBA', (target_w, round(H * ratio)), (255, 255, 255, 255))
prev.alpha_composite(Image.open(LIGHT).convert('RGBA'))
prev.convert('RGB').save('/tmp/check_light2.png')
print('preview /tmp/check_light2.png')
