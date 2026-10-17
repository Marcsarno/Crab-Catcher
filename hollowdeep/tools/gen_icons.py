"""Draws inventory/spell icons (original pixel-style art) with PIL.

Run: python3 tools/gen_icons.py  (from hollowdeep/)
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icons")
os.makedirs(OUT, exist_ok=True)
S = 128  # drawn at 128 and kept at that size (UI scales it)

STEEL = (190, 196, 206)
STEEL_D = (110, 116, 128)
IRON = (120, 122, 128)
IRON_D = (60, 62, 68)
WOOD = (130, 86, 48)
WOOD_D = (80, 50, 28)
LEATHER = (96, 60, 36)
GOLD = (226, 178, 70)
GOLD_D = (150, 104, 30)
OUTL = (14, 10, 8)


def new():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def finish(img, name):
    # drop shadow + outline pass
    a = img.split()[3]
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 160))
    shadow.paste(sh, (4, 5), a)
    shadow = shadow.filter(ImageFilter.GaussianBlur(3))
    out = Image.alpha_composite(shadow, img)
    out.save(os.path.join(OUT, name + ".png"))
    print("icon", name)


def rot(points, ang, c=(S / 2, S / 2)):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(c[0] + (x - c[0]) * ca - (y - c[1]) * sa, c[1] + (x - c[0]) * sa + (y - c[1]) * ca) for x, y in points]


def poly(d, pts, fill, ang=-math.pi / 4, outline=OUTL, width=3):
    p = rot(pts, ang)
    d.polygon(p, fill=fill)
    d.line(p + [p[0]], fill=outline, width=width, joint="curve")


def sword(name, blade_len=88, blade_w=10, guard=GOLD, grip=LEATHER, steel=STEEL):
    img = new()
    d = ImageDraw.Draw(img)
    cx = S / 2
    top = 10
    gy = top + blade_len
    poly(d, [(cx, top), (cx + blade_w / 2, top + 12), (cx + blade_w / 2, gy), (cx - blade_w / 2, gy), (cx - blade_w / 2, top + 12)], steel)
    poly(d, [(cx, top + 8), (cx + 1.5, top + 14), (cx + 1.5, gy - 4), (cx - 1.5, gy - 4), (cx - 1.5, top + 14)], (240, 244, 250), outline=(240, 244, 250), width=1)
    poly(d, [(cx - 22, gy), (cx + 22, gy), (cx + 22, gy + 7), (cx - 22, gy + 7)], guard)
    poly(d, [(cx - 4, gy + 7), (cx + 4, gy + 7), (cx + 4, gy + 24), (cx - 4, gy + 24)], grip)
    poly(d, [(cx - 7, gy + 24), (cx + 7, gy + 24), (cx + 7, gy + 31), (cx - 7, gy + 31)], guard)
    finish(img, name)


def dagger():
    sword("dagger", 50, 12, IRON, LEATHER, STEEL)


def axe():
    img = new()
    d = ImageDraw.Draw(img)
    cx = S / 2
    poly(d, [(cx - 4, 14), (cx + 4, 14), (cx + 4, 118), (cx - 4, 118)], WOOD)
    poly(d, [(cx + 2, 22), (cx + 40, 8), (cx + 48, 36), (cx + 40, 62), (cx + 2, 46)], STEEL)
    poly(d, [(cx + 36, 12), (cx + 44, 36), (cx + 36, 58), (cx + 40, 36)], (236, 240, 248), outline=(236, 240, 248), width=1)
    poly(d, [(cx - 3, 26), (cx - 18, 30), (cx - 18, 40), (cx - 3, 42)], IRON)
    finish(img, "axe")


def mace():
    img = new()
    d = ImageDraw.Draw(img)
    cx = S / 2
    poly(d, [(cx - 4, 40), (cx + 4, 40), (cx + 4, 118), (cx - 4, 118)], WOOD_D)
    poly(d, [(cx - 6, 100), (cx + 6, 100), (cx + 6, 112), (cx - 6, 112)], LEATHER)
    c = rot([(cx, 30)], -math.pi / 4)[0]
    for k in range(8):
        a = k * math.pi / 4
        tip = (c[0] + math.cos(a) * 30, c[1] + math.sin(a) * 30)
        l = (c[0] + math.cos(a + 0.4) * 16, c[1] + math.sin(a + 0.4) * 16)
        r = (c[0] + math.cos(a - 0.4) * 16, c[1] + math.sin(a - 0.4) * 16)
        d.polygon([tip, l, r], fill=IRON_D, outline=OUTL)
    d.ellipse([c[0] - 19, c[1] - 19, c[0] + 19, c[1] + 19], fill=IRON, outline=OUTL, width=3)
    d.ellipse([c[0] - 12, c[1] - 14, c[0] - 2, c[1] - 6], fill=(190, 192, 200))
    finish(img, "mace")


def club():
    img = new()
    d = ImageDraw.Draw(img)
    cx = S / 2
    poly(d, [(cx - 5, 118), (cx + 5, 118), (cx + 13, 16), (cx, 8), (cx - 13, 16)], WOOD)
    for y in (30, 50, 70):
        px, py = rot([(cx + 3, y)], -math.pi / 4)[0]
        d.ellipse([px - 3, py - 3, px + 3, py + 3], fill=OUTL)
    poly(d, [(cx - 6, 100), (cx + 6, 100), (cx + 6, 112), (cx - 6, 112)], LEATHER)
    finish(img, "club")


def shield_round():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([10, 10, S - 10, S - 10], fill=WOOD, outline=OUTL, width=4)
    for k in range(-2, 3):
        d.line([(c + k * 18, 14), (c + k * 18, S - 14)], fill=WOOD_D, width=2)
    d.ellipse([10, 10, S - 10, S - 10], outline=IRON, width=8)
    d.ellipse([10, 10, S - 10, S - 10], outline=OUTL, width=3)
    d.ellipse([c - 18, c - 18, c + 18, c + 18], fill=IRON, outline=OUTL, width=3)
    d.ellipse([c - 10, c - 12, c - 2, c - 4], fill=(200, 200, 210))
    finish(img, "shield_round")


def shield_kite():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    pts = [(c - 42, 14), (c + 42, 14), (c + 40, 62), (c, 118), (c - 40, 62)]
    d.polygon(pts, fill=(44, 60, 120), outline=OUTL)
    d.line(pts + [pts[0]], fill=GOLD, width=6)
    d.line(pts + [pts[0]], fill=OUTL, width=2)
    d.rectangle([c - 5, 22, c + 5, 100], fill=GOLD, outline=OUTL)
    d.rectangle([c - 30, 44, c + 30, 54], fill=GOLD, outline=OUTL)
    finish(img, "shield_kite")


def armor(color=IRON, trim=STEEL, name="armor"):
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    pts = [(c - 26, 14), (c - 10, 22), (c + 10, 22), (c + 26, 14), (c + 50, 30), (c + 42, 56), (c + 32, 50),
           (c + 34, 116), (c - 34, 116), (c - 32, 50), (c - 42, 56), (c - 50, 30)]
    d.polygon(pts, fill=color, outline=OUTL)
    d.line(pts + [pts[0]], fill=OUTL, width=3)
    d.line([(c, 24), (c, 114)], fill=trim, width=3)
    for y in range(40, 112, 14):
        d.line([(c - 30, y), (c + 30, y)], fill=tuple(int(v * 0.7) for v in color), width=2)
    d.rectangle([c - 34, 96, c + 34, 104], fill=LEATHER, outline=OUTL)
    d.rectangle([c - 6, 95, c + 6, 105], fill=GOLD, outline=OUTL)
    finish(img, name)


def helm():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.chord([20, 16, S - 20, 116], 180, 360, fill=IRON, outline=OUTL, width=3)
    d.rectangle([20, 64, S - 20, 108], fill=IRON, outline=OUTL, width=3)
    d.rectangle([c - 30, 66, c - 6, 76], fill=OUTL)
    d.rectangle([c + 6, 66, c + 30, 76], fill=OUTL)
    d.rectangle([c - 5, 60, c + 5, 104], fill=STEEL, outline=OUTL)
    d.line([(c, 18), (c, 60)], fill=STEEL, width=4)
    d.ellipse([36, 28, 50, 44], fill=(200, 204, 214))
    finish(img, "helm")


def ring():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([c - 34, c - 20, c + 34, c + 44], outline=OUTL, width=16)
    d.ellipse([c - 32, c - 18, c + 32, c + 42], outline=GOLD, width=11)
    d.polygon([(c, c - 46), (c + 18, c - 26), (c, c - 8), (c - 18, c - 26)], fill=(200, 30, 40), outline=OUTL)
    d.polygon([(c - 4, c - 38), (c + 4, c - 30), (c - 4, c - 26), (c - 10, c - 28)], fill=(255, 140, 150))
    finish(img, "ring")


def amulet():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.arc([18, 4, S - 18, 90], 200, 340, fill=GOLD_D, width=4)
    d.line([(26, 46), (c, 78)], fill=GOLD_D, width=4)
    d.line([(S - 26, 46), (c, 78)], fill=GOLD_D, width=4)
    d.ellipse([c - 22, 70, c + 22, 114], fill=GOLD, outline=OUTL, width=3)
    d.ellipse([c - 12, 80, c + 12, 104], fill=(40, 90, 200), outline=OUTL, width=2)
    d.ellipse([c - 7, 84, c - 1, 90], fill=(170, 210, 255))
    finish(img, "amulet")


def potion(name, col):
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([c - 36, 44, c + 36, 116], fill=(200, 214, 224, 200), outline=OUTL, width=3)
    d.chord([c - 32, 48, c + 32, 112], 0, 180, fill=col)
    d.rectangle([c - 31, 72, c + 31, 82], fill=col)
    d.rectangle([c - 12, 18, c + 12, 50], fill=(200, 214, 224, 220), outline=OUTL, width=3)
    d.rectangle([c - 14, 8, c + 14, 22], fill=WOOD, outline=OUTL, width=3)
    d.ellipse([c - 24, 58, c - 10, 74], fill=(255, 255, 255, 180))
    finish(img, name)


def scroll():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.rectangle([24, 28, S - 24, 100], fill=(220, 204, 160), outline=OUTL, width=3)
    for y in range(42, 92, 10):
        d.line([(34, y), (S - 34, y)], fill=(120, 96, 60), width=2)
    for x in (24, S - 24):
        d.ellipse([x - 10, 20, x + 10, 108], fill=(200, 184, 140), outline=OUTL, width=3)
    d.ellipse([c - 10, 56, c + 10, 76], fill=(160, 20, 20), outline=OUTL, width=2)
    finish(img, "scroll")


def gold():
    img = new()
    d = ImageDraw.Draw(img)
    import random
    random.seed(4)
    for k in range(16):
        x = random.uniform(24, S - 44)
        y = 50 + random.uniform(0, 50) - k * 1.2
        d.ellipse([x, y, x + 26, y + 16], fill=GOLD, outline=OUTL, width=2)
        d.ellipse([x + 5, y + 3, x + 12, y + 7], fill=(255, 230, 150))
    finish(img, "gold")


def firebolt():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    for r, col in [(46, (120, 20, 0)), (36, (220, 80, 10)), (24, (255, 170, 40)), (12, (255, 240, 180))]:
        pts = []
        for k in range(16):
            a = k / 16 * math.pi * 2
            rr = r * (1.0 if k % 2 else 0.7) * (1.4 if 3 <= k <= 5 else 1.0)
            pts.append((c + math.cos(a) * rr + 6, c + math.sin(a) * rr - 6))
        d.polygon(pts, fill=col)
    finish(img, "spell_firebolt")


def heal():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([10, 10, S - 10, S - 10], fill=(30, 120, 70, 120))
    d.rectangle([c - 12, 24, c + 12, S - 24], fill=(220, 255, 220), outline=OUTL, width=3)
    d.rectangle([24, c - 12, S - 24, c + 12], fill=(220, 255, 220), outline=OUTL, width=3)
    d.rectangle([c - 9, 27, c + 9, S - 27], fill=(220, 255, 220))
    finish(img, "spell_heal")


def attack():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    for ang in (-math.pi / 4, math.pi / 4):
        pts = [(c, 12), (c + 6, 22), (c + 6, 86), (c - 6, 86), (c - 6, 22)]
        p = rot(pts, ang)
        d.polygon(p, fill=STEEL, outline=OUTL)
        g = rot([(c - 18, 86), (c + 18, 86), (c + 18, 93), (c - 18, 93)], ang)
        d.polygon(g, fill=GOLD, outline=OUTL)
        h = rot([(c - 4, 93), (c + 4, 93), (c + 4, 114), (c - 4, 114)], ang)
        d.polygon(h, fill=LEATHER, outline=OUTL)
    finish(img, "attack")


def hand():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.rounded_rectangle([c - 30, 54, c + 30, 112], 14, fill=(214, 170, 130), outline=OUTL, width=3)
    for k in range(4):
        x = c - 28 + k * 15
        d.rounded_rectangle([x, 20 + abs(k - 1.5) * 6, x + 13, 70], 6, fill=(214, 170, 130), outline=OUTL, width=3)
    d.rounded_rectangle([c + 22, 62, c + 52, 78], 7, fill=(214, 170, 130), outline=OUTL, width=3)
    finish(img, "hand")


def bag():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([18, 40, S - 18, 120], fill=LEATHER, outline=OUTL, width=3)
    d.polygon([(c - 22, 46), (c + 22, 46), (c + 14, 22), (c - 14, 22)], fill=LEATHER, outline=OUTL)
    d.rectangle([c - 26, 40, c + 26, 50], fill=WOOD_D, outline=OUTL)
    d.ellipse([c - 6, 38, c + 6, 52], fill=GOLD, outline=OUTL)
    finish(img, "bag")


def map_icon():
    img = new()
    d = ImageDraw.Draw(img)
    d.polygon([(14, 26), (48, 14), (80, 26), (114, 14), (114, 102), (80, 114), (48, 102), (14, 114)], fill=(214, 196, 150), outline=OUTL)
    d.line([(48, 14), (48, 102)], fill=(150, 130, 90), width=2)
    d.line([(80, 26), (80, 114)], fill=(150, 130, 90), width=2)
    d.line([(26, 90), (44, 60), (66, 70), (96, 40)], fill=(160, 20, 20), width=4)
    d.line([(88, 32), (104, 48)], fill=(160, 20, 20), width=4)
    d.line([(104, 32), (88, 48)], fill=(160, 20, 20), width=4)
    finish(img, "map")


def char_icon():
    img = new()
    d = ImageDraw.Draw(img)
    c = S / 2
    d.ellipse([c - 20, 14, c + 20, 54], fill=(200, 190, 170), outline=OUTL, width=3)
    d.pieslice([c - 44, 56, c + 44, 150], 180, 360, fill=(140, 30, 26), outline=OUTL, width=3)
    finish(img, "char")


def menu_icon():
    img = new()
    d = ImageDraw.Draw(img)
    for y in (32, 60, 88):
        d.rounded_rectangle([22, y, S - 22, y + 12], 5, fill=(214, 196, 150), outline=OUTL, width=2)
    finish(img, "menu")


if __name__ == "__main__":
    sword("sword", 82, 11)
    sword("blade", 92, 14, GOLD, (130, 20, 20), (210, 214, 224))
    dagger()
    axe()
    mace()
    club()
    shield_round()
    shield_kite()
    armor()
    armor((110, 76, 46), (150, 110, 70), "armor_leather")
    armor((140, 140, 150), (220, 190, 90), "armor_plate")
    helm()
    ring()
    amulet()
    potion("potion_red", (200, 20, 26))
    potion("potion_blue", (30, 60, 220))
    potion("potion_purple", (140, 40, 190))
    scroll()
    gold()
    firebolt()
    heal()
    attack()
    hand()
    bag()
    map_icon()
    char_icon()
    menu_icon()
