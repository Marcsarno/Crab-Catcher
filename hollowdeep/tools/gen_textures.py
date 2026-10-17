"""Procedurally generates all tileable textures and UI images for Hollowdeep.

Run: python3 tools/gen_textures.py   (from the hollowdeep/ directory)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "textures")
UI = os.path.join(os.path.dirname(__file__), "..", "assets", "ui")
os.makedirs(OUT, exist_ok=True)
os.makedirs(UI, exist_ok=True)
rng = np.random.default_rng(1337)


def pnoise(size, cells, seed=0):
    """Tileable value noise in [0,1]."""
    r = np.random.default_rng(seed)
    g = r.random((cells, cells))
    x = np.linspace(0, cells, size, endpoint=False)
    xi = x.astype(int)
    xf = x - xi
    xf = xf * xf * (3 - 2 * xf)
    x0 = xi % cells
    x1 = (xi + 1) % cells
    a = g[np.ix_(x0, x0)]
    b = g[np.ix_(x0, x1)]
    c = g[np.ix_(x1, x0)]
    d = g[np.ix_(x1, x1)]
    fy = xf[:, None]
    fx = xf[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(size, base=4, octaves=5, seed=0):
    out = np.zeros((size, size))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        if cells > size:
            break
        out += pnoise(size, cells, seed + o * 17) * amp
        tot += amp
        amp *= 0.5
    return out / tot


def save(arr, name, folder=OUT):
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(folder, name))
    print("wrote", name)


def colorize(v, c0, c1):
    c0 = np.array(c0, float)
    c1 = np.array(c1, float)
    return c0[None, None, :] * (1 - v[..., None]) + c1[None, None, :] * v[..., None]


def bricks(size, rows, cols, mortar, base_dark, base_light, mortar_col, seed, jitter=0.12):
    n = fbm(size, 8, 5, seed)
    fine = fbm(size, 32, 3, seed + 99)
    img = np.zeros((size, size, 3))
    bh = size // rows
    bw = size // cols
    r = np.random.default_rng(seed)
    mask = np.zeros((size, size))
    shade = np.zeros((size, size))
    for ry in range(rows):
        off = (bw // 2) if ry % 2 else 0
        for cx in range(-1, cols + 1):
            x0 = cx * bw + off
            y0 = ry * bh
            s = r.uniform(-jitter, jitter)
            for yy in range(y0 + mortar, y0 + bh - mortar + 1):
                for xx in range(x0 + mortar, x0 + bw - mortar + 1):
                    X = xx % size
                    Y = yy % size
                    mask[Y, X] = 1
                    shade[Y, X] = s
                    # bevel: darker near bottom/right edges, lighter top/left
                    ey = (yy - y0) / bh
                    ex = (xx - x0) / bw
                    if ey < 0.12 or ex < 0.06:
                        shade[Y, X] += 0.08
                    elif ey > 0.85 or ex > 0.94:
                        shade[Y, X] -= 0.1
    v = np.clip(0.35 + 0.45 * n + 0.25 * fine + shade, 0, 1)
    brick = colorize(v, base_dark, base_light)
    mort = colorize(np.clip(n * 0.8 + 0.1, 0, 1), np.array(mortar_col) * 0.6, mortar_col)
    m = mask[..., None]
    img = brick * m + mort * (1 - m)
    # cracks / stains
    stain = fbm(size, 4, 4, seed + 7)
    img *= (0.75 + 0.35 * stain)[..., None]
    return img


def flagstones(size, seed, dark, light, gap_col, n_split=4):
    """Irregular flagstones via jittered grid voronoi."""
    r = np.random.default_rng(seed)
    pts = []
    g = n_split
    for i in range(g):
        for j in range(g):
            pts.append(((i + r.uniform(0.2, 0.8)) / g * size, (j + r.uniform(0.2, 0.8)) / g * size))
    pts = np.array(pts)
    yy, xx = np.mgrid[0:size, 0:size]
    d1 = np.full((size, size), 1e9)
    d2 = np.full((size, size), 1e9)
    idx = np.zeros((size, size), int)
    for k, (px, py) in enumerate(pts):
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                d = np.hypot(xx - (px + ox), yy - (py + oy))
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                idx = np.where(closer, k, idx)
                d1 = np.where(closer, d, d1)
    edge = d2 - d1
    n = fbm(size, 8, 5, seed + 3)
    tint = r.uniform(-0.12, 0.12, len(pts))[idx]
    v = np.clip(0.3 + 0.5 * n + tint, 0, 1)
    img = colorize(v, dark, light)
    gap = np.clip(1 - edge / (size * 0.025), 0, 1)
    img = img * (1 - gap[..., None]) + np.array(gap_col)[None, None, :] * gap[..., None]
    # bevel lighting
    bevel = np.clip((edge - size * 0.025) / (size * 0.03), 0, 1)
    img *= (0.82 + 0.18 * bevel)[..., None]
    return img


def wood(size, seed, dark, light, planks=4, vertical=True):
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(float)
    n = fbm(size, 4, 5, seed)
    grain_axis = xx if vertical else yy
    along = yy if vertical else xx
    pw = size / planks
    plank_id = (grain_axis // pw).astype(int)
    offs = r.uniform(0, 10, planks + 1)[plank_id]
    grain = np.sin((grain_axis * 0.9 + n * 12 + offs) * 1.7) * 0.5 + 0.5
    fine = fbm(size, 64, 2, seed + 5)
    v = np.clip(0.25 + 0.35 * grain + 0.3 * n + 0.15 * fine + r.uniform(-0.1, 0.1, planks + 1)[plank_id], 0, 1)
    img = colorize(v, dark, light)
    edge = (grain_axis % pw)
    seam = (edge < 2) | (edge > pw - 2)
    img[seam] *= 0.35
    return img


def main():
    S = 256
    # --- Dungeon level 1: grey-brown cathedral stone ---
    save(bricks(S, 8, 4, 3, (52, 46, 40), (138, 124, 106), (40, 36, 32), 11), "wall_cathedral.png")
    save(flagstones(S, 12, (48, 44, 40), (120, 110, 98), (22, 20, 18)), "floor_cathedral.png")
    save(colorize(fbm(S, 8, 5, 13), (18, 16, 15), (60, 55, 50)), "ceiling.png")
    # --- level 2: blood-stained darker stone ---
    w2 = bricks(S, 8, 4, 3, (44, 36, 34), (120, 96, 86), (30, 22, 20), 21)
    stain = fbm(S, 4, 5, 22)
    w2 = w2 * (1 - 0.35 * (stain > 0.62)[..., None]) + np.array([50, 0, 0]) * (stain > 0.62)[..., None] * 0.6
    save(w2, "wall_crypt.png")
    f2 = flagstones(S, 23, (42, 36, 34), (106, 92, 84), (18, 12, 12))
    stain = fbm(S, 4, 5, 24)
    blood = np.clip((stain - 0.6) * 5, 0, 1)[..., None]
    f2 = f2 * (1 - blood * 0.6) + np.array([70, 6, 6]) * blood * 0.6
    save(f2, "floor_crypt.png")
    # --- level 3: catacomb, greenish damp ---
    save(bricks(S, 6, 3, 4, (34, 40, 34), (96, 106, 88), (20, 24, 20), 31, 0.18), "wall_catacomb.png")
    save(flagstones(S, 33, (36, 38, 34), (92, 96, 84), (14, 16, 14), 3), "floor_catacomb.png")
    # --- wood ---
    save(wood(S, 41, (40, 24, 14), (120, 78, 44)), "wood.png")
    save(wood(S, 42, (30, 20, 12), (90, 62, 38), 6, False), "wood_dark.png")
    # --- metal ---
    m = fbm(S, 16, 4, 51)
    save(colorize(m, (40, 42, 46), (120, 124, 130)), "metal.png")
    # --- town ---
    g = fbm(S, 8, 6, 61)
    gr = colorize(g, (24, 34, 16), (78, 92, 44))
    dirt = colorize(fbm(S, 8, 5, 62), (46, 36, 24), (104, 86, 60))
    mix = np.clip((fbm(S, 4, 4, 63) - 0.45) * 4, 0, 1)[..., None]
    save(gr * (1 - mix) + dirt * mix, "grass.png")
    save(flagstones(S, 64, (60, 54, 48), (130, 120, 104), (40, 32, 24), 6), "cobble.png")
    save(dirt, "dirt.png")
    pl = colorize(fbm(S, 16, 5, 65), (130, 118, 96), (190, 176, 150))
    save(pl, "plaster.png")
    # roof shingles
    sh = bricks(S, 10, 6, 1, (36, 26, 22), (96, 70, 54), (20, 14, 12), 66, 0.2)
    save(sh, "roof.png")
    # --- grime detail for characters (greyscale around 1.0) ---
    gr = fbm(128, 8, 5, 71)
    gm = np.clip(150 + (gr - 0.5) * 180, 0, 255)
    save(np.stack([gm, gm, gm], -1), "grime.png")
    # --- particle / decal textures ---
    def radial(size, power=2.0):
        yy, xx = np.mgrid[0:size, 0:size]
        d = np.hypot(xx - size / 2 + 0.5, yy - size / 2 + 0.5) / (size / 2)
        return np.clip(1 - d, 0, 1) ** power
    a = radial(64, 2.2)
    save(np.dstack([np.full_like(a, 255), np.full_like(a, 255), np.full_like(a, 255), a * 255]), "glow.png")
    # blood splat decal
    S2 = 128
    img = Image.new("RGBA", (S2, S2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(81)
    for _ in range(26):
        cx, cy = r.normal(S2 / 2, S2 / 7, 2)
        rad = r.uniform(3, 20)
        col = (int(r.uniform(90, 140)), 0, 0, int(r.uniform(180, 240)))
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)
    for _ in range(30):
        ang = r.uniform(0, np.pi * 2)
        dist = r.uniform(25, 58)
        cx, cy = S2 / 2 + np.cos(ang) * dist, S2 / 2 + np.sin(ang) * dist
        rad = r.uniform(1, 4)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(110, 0, 0, 220))
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    img.save(os.path.join(OUT, "blood.png"))
    print("wrote blood.png")

    # --- UI ---
    # stone panel (tileable) for menus
    p = bricks(128, 4, 2, 2, (26, 22, 20), (70, 62, 54), (12, 10, 9), 91)
    save(p, "panel_stone.png", UI)
    # parchment
    pa = colorize(fbm(256, 4, 6, 92), (120, 96, 60), (196, 172, 124))
    save(pa, "parchment.png", UI)
    # orb frame: ring with gothic spikes
    S3 = 256
    img = Image.new("RGBA", (S3, S3), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = S3 / 2
    for i in range(12):
        ang = i / 12 * np.pi * 2
        tip = (c + np.cos(ang) * 126, c + np.sin(ang) * 126)
        l = (c + np.cos(ang - 0.16) * 104, c + np.sin(ang - 0.16) * 104)
        rr = (c + np.cos(ang + 0.16) * 104, c + np.sin(ang + 0.16) * 104)
        d.polygon([tip, l, rr], fill=(70, 60, 48, 255), outline=(20, 16, 12, 255))
    d.ellipse([c - 112, c - 112, c + 112, c + 112], fill=(88, 76, 60, 255), outline=(16, 12, 10, 255), width=4)
    d.ellipse([c - 100, c - 100, c + 100, c + 100], fill=(30, 26, 22, 255), outline=(150, 130, 100, 255), width=3)
    d.ellipse([c - 94, c - 94, c + 94, c + 94], fill=(0, 0, 0, 0))
    # punch the inside fully transparent
    arr = np.array(img)
    yy, xx = np.mgrid[0:S3, 0:S3]
    inside = np.hypot(xx - c + 0.5, yy - c + 0.5) < 94
    arr[inside] = 0
    # metallic noise on frame
    nz = fbm(S3, 16, 3, 93)
    arr[..., :3] = np.clip(arr[..., :3] * (0.7 + 0.6 * nz[..., None]), 0, 255)
    Image.fromarray(arr.astype(np.uint8)).save(os.path.join(UI, "orb_frame.png"))
    print("wrote orb_frame.png")
    # orb liquid noise (greyscale, tileable)
    ln = fbm(128, 4, 5, 94)
    save(np.stack([ln * 255] * 3, -1), "orb_noise.png", UI)
    # slot frame
    img = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([2, 2, 93, 93], fill=(14, 12, 11, 230), outline=(110, 92, 64, 255), width=3)
    d.rectangle([7, 7, 88, 88], outline=(40, 34, 28, 255), width=2)
    img.save(os.path.join(UI, "slot.png"))
    # round button
    for name, col in [("btn_attack", (120, 24, 18)), ("btn_spell", (30, 50, 120)), ("btn_action", (90, 80, 50)), ("btn_heal", (30, 100, 60))]:
        S4 = 192
        img = Image.new("RGBA", (S4, S4), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse([4, 4, S4 - 4, S4 - 4], fill=(60, 52, 42, 235), outline=(16, 12, 10, 255), width=4)
        d.ellipse([16, 16, S4 - 16, S4 - 16], fill=col + (235,), outline=(170, 150, 110, 255), width=3)
        arr = np.array(img).astype(float)
        yy, xx = np.mgrid[0:S4, 0:S4]
        hl = np.clip(1 - np.hypot(xx - S4 * 0.38, yy - S4 * 0.32) / (S4 * 0.5), 0, 1) ** 2
        inside = np.hypot(xx - S4 / 2, yy - S4 / 2) < (S4 / 2 - 16)
        arr[..., :3] += (hl * 70 * inside)[..., None]
        Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(UI, name + ".png"))
        print("wrote", name)
    # joystick base and knob
    S5 = 256
    img = Image.new("RGBA", (S5, S5), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 6, S5 - 6, S5 - 6], fill=(20, 16, 14, 110), outline=(150, 130, 100, 170), width=5)
    for i in range(4):
        ang = i * np.pi / 2
        cx, cy = S5 / 2 + np.cos(ang) * 100, S5 / 2 + np.sin(ang) * 100
        pts = [(cx + np.cos(ang) * 14, cy + np.sin(ang) * 14),
               (cx + np.cos(ang + 2.2) * 12, cy + np.sin(ang + 2.2) * 12),
               (cx + np.cos(ang - 2.2) * 12, cy + np.sin(ang - 2.2) * 12)]
        d.polygon(pts, fill=(170, 150, 110, 180))
    img.save(os.path.join(UI, "joy_base.png"))
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([6, 6, 122, 122], fill=(90, 78, 62, 220), outline=(190, 170, 130, 255), width=4)
    d.ellipse([30, 26, 70, 60], fill=(140, 124, 100, 120))
    img.save(os.path.join(UI, "joy_knob.png"))
    # vignette
    S6 = 256
    yy, xx = np.mgrid[0:S6, 0:S6]
    dd = np.hypot((xx - S6 / 2) / (S6 / 2), (yy - S6 / 2) / (S6 / 2))
    a = np.clip((dd - 0.55) / 0.6, 0, 1) ** 1.5
    save(np.dstack([np.zeros_like(a), np.zeros_like(a), np.zeros_like(a), a * 255]), "vignette.png", UI)


if __name__ == "__main__":
    main()
