"""Подгоняем части кота друг к другу: поля, вертикаль и тон на стыках."""
from PIL import Image

SRC = 'orig/'
OUT = '/Users/stasamba/Desktop/VBI HR платформа/frontend/public/decor/halloween/'
BAND = range(74, 128)  # строки, где лежит тело


def load(n):
    return Image.open(SRC + n).convert('RGBA')


def trim_sides(im):
    a = im.getchannel('A').point(lambda v: 255 if v > 8 else 0)
    bb = a.getbbox()
    return im.crop((bb[0], 0, bb[2], im.height))


def edge_profile(im, x):
    px = im.load()
    ys = [y for y in range(im.height) if px[x, y][3] > 20]
    return (min(ys), max(ys))


def shift_v(im, dy):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.alpha_composite(im, (0, dy))
    return out


def edge_mean(im, x):
    px = im.load()
    vals = [px[x, y][:3] for y in BAND if px[x, y][3] > 200]
    n = len(vals)
    return tuple(sum(v[i] for v in vals) / n for i in range(3))


def taper(im, gain, at_left):
    """Тон подтягиваем у стыка и плавно сводим на нет к другому краю."""
    px = im.load()
    w = im.width
    for x in range(w):
        t = 1 - x / (w * 0.7) if at_left else 1 - (w - 1 - x) / (w * 0.7)
        t = max(0.0, min(1.0, t))
        for y in range(im.height):
            r, g, b, a = px[x, y]
            if not a:
                continue
            k = [1 + (gain[i] - 1) * t for i in range(3)]
            px[x, y] = (
                min(255, round(r * k[0])),
                min(255, round(g * k[1])),
                min(255, round(b * k[2])),
                a,
            )
    return im


body = load('vac-cat-body.png')
head = trim_sides(load('vac-cat-head.png'))
tail = trim_sides(load('vac-cat-tail.png'))

# вертикаль: кромка тела на стыке должна совпасть с телом
for name, part, x in (('head', head, head.width - 1), ('tail', tail, 0)):
    top, bottom = edge_profile(part, x)
    want_top, want_bottom = edge_profile(body, 0)
    dy = round(((want_top - top) + (want_bottom - bottom)) / 2)
    if dy:
        if name == 'head':
            head = shift_v(part, dy)
        else:
            tail = shift_v(part, dy)
    print(name, 'сдвиг по вертикали', dy)

# тон: средний цвет на стыке подтягиваем к телу
body_left = edge_mean(body, 0)
body_right = edge_mean(body, body.width - 1)
head_gain = tuple(body_left[i] / edge_mean(head, head.width - 1)[i] for i in range(3))
tail_gain = tuple(body_right[i] / edge_mean(tail, 0)[i] for i in range(3))
print('коэффициенты тона: голова', [round(g, 3) for g in head_gain],
      'хвост', [round(g, 3) for g in tail_gain])
head = taper(head, head_gain, at_left=False)
tail = taper(tail, tail_gain, at_left=True)

# Сохраняем без палитры: у каждой части палитра получалась своя, и на стыке
# появлялась тональная ступенька. Картинки маленькие, вес терпимый.
for name, part in (('vac-cat-head.png', head), ('vac-cat-body.png', body), ('vac-cat-tail.png', tail)):
    part.save(OUT + name, optimize=True)
    print(name, part.size)
