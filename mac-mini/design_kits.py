#!/usr/bin/env python3
"""
design_kits.py : templat dikurasi ikut "Kit Gaya" Mira (dipanggil oleh carousel_engine.render bila opts.kit diberi).

Kit (satu rupa, dikongsi carousel, gambar single dan cover reel):
  doodle  : foto penuh, orang bergaris putih tebal atas gambarnya sendiri, doodle putih lukisan tangan,
            tajuk besar tulisan tangan putih + subtajuk kecil dalam kurungan.
  comel   : foto penuh cerah, garis putih + garis putus-putus di luar, sticker comel (reben, daisy, hati,
            ceri, bintang), tajuk bulat merah jambu bergaris putih.
  majalah : seamless, latar beige / hitam berselang, tajuk serif besar (*perkataan* = italik),
            kotak teks bulat, polaroid, cutout bergaris putih merentas garis potong.
Format: carousel (N slide), single (1 slide), cover (reel 9:16, tajuk + muka dalam kawasan selamat grid 4:5).
Teks: opts.title, opts.subtitle, opts.texts (satu baris setiap slide). Kosong = tiada tulisan.
"""
import math
import os
import random

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import carousel_engine as ce

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
FONT_FILES = {
    "chewy": ("Chewy-Regular.ttf", None),
    "caveat": ("Caveat[wght].ttf", "Bold"),
    "fredoka": ("Fredoka[wdth,wght].ttf", "Bold"),
    "serif": ("PlayfairDisplay[wght].ttf", "Bold"),
    "serif_i": ("PlayfairDisplay-Italic[wght].ttf", "Italic"),
    "sans": ("DMSans[opsz,wght].ttf", "Medium"),
    "sans_b": ("DMSans[opsz,wght].ttf", "Bold"),
}
KITS = {   # "editor" = preset Style Board Editor (id editor sedia ada, supaya render_draft.py render sama)
    "doodle":  {"name": "Tajuk doodle", "formats": ["carousel", "single", "cover"],
                "editor": {"pal": "brand", "font": "h3", "capStyle": "script", "trans": "cut", "punch": True, "titlePos": "top",
                           "titleOutline": False, "titleFx": "drop", "capFx": "hop"}},
    "comel":   {"name": "Sticker comel", "formats": ["carousel", "single", "cover"],
                "editor": {"pal": "pink", "font": "caveat", "capStyle": "pill", "trans": "paper", "punch": False, "titlePos": "top",
                           "titleOutline": False, "titleFx": "hop", "capFx": "hop"}},
    "majalah": {"name": "Majalah seamless", "formats": ["carousel", "single", "cover"],
                "editor": {"pal": "tjean", "font": "luxe", "capStyle": "kotak", "trans": "dip", "punch": False, "titlePos": "left",
                           "titleOutline": False, "titleFx": "land", "capFx": "fade"}},
}
MAG = {"beige": (233, 226, 214), "dark": (43, 39, 37), "cream": (241, 234, 224), "ink": (31, 28, 26),
       "taupe": (140, 126, 112), "mute": (91, 82, 75)}
PINK = (242, 160, 182)
WHITE = (255, 255, 255)
_fc = {}


def font(key, size):
    from PIL import ImageFont
    k = (key, int(size))
    if k not in _fc:
        fn, var = FONT_FILES[key]
        f = ImageFont.truetype(os.path.join(FONTS, fn), int(size))
        if var:
            try:
                f.set_variation_by_name(var)
            except Exception:
                pass
        _fc[k] = f
    return _fc[k]


# ---------------------------------------------------------------- TEKS
def tokens(text):
    """'Minggu *ni*' -> [('Minggu', False), ('ni', True)]"""
    out, ital = [], False
    for part in str(text).replace("\n", " \n ").split(" "):
        if not part:
            continue
        if part == "\n":
            out.append(("\n", False))
            continue
        w, it = part, ital
        if w.startswith("*"):
            it, w = True, w[1:]
        end = w.endswith("*")
        if end:
            w = w[:-1]
        out.append((w, it))
        ital = it and not end
        if end:
            ital = False
    return out


def layout_rich(text, keys, size, maxw, upper=False):
    """Susun token dalam baris (greedy). keys = (font biasa, font italik). Pulang [(baris=[(w,font)], lebar)]."""
    toks = tokens(text.upper() if upper else text)
    lines, cur, cw = [], [], 0
    for w, it in toks:
        if w == "\n":
            lines.append((cur, cw))
            cur, cw = [], 0
            continue
        f = font(keys[1] if it and keys[1] else keys[0], size)
        ww = f.getlength(w)
        sp = f.getlength(" ") if cur else 0
        if cur and cw + sp + ww > maxw:
            lines.append((cur, cw))
            cur, cw, sp = [], 0, 0
        cur.append((w, f))
        cw += sp + ww
    if cur:
        lines.append((cur, cw))
    return lines


def fit_rich(text, keys, maxw, maxh, smax, smin, lead=1.05, upper=False, max_lines=4):
    for size in range(int(smax), int(smin) - 1, -2):
        L = layout_rich(text, keys, size, maxw, upper)
        if all(w <= maxw for _, w in L) and len(L) <= max_lines and len(L) * size * lead <= maxh:
            return L, size
    return layout_rich(text, keys, smin, maxw, upper), smin


def draw_rich(img, L, size, x, y, w, align="center", fill=WHITE, stroke=0, stroke_fill=None, lead=1.05,
              shadow=0.0):
    """Lukis baris kaya pada img (RGBA). Pulang kotak (x0,y0,x1,y1)."""
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    yy = y
    x0b, x1b = 10 ** 9, -1
    for line, lw in L:
        xx = x + (w - lw) / 2 if align == "center" else (x if align == "left" else x + w - lw)
        x0b, x1b = min(x0b, xx), max(x1b, xx + lw)
        for i, (word, f) in enumerate(line):
            if i:
                xx += f.getlength(" ")
            d.text((xx, yy), word, font=f, fill=fill + (255,), stroke_width=stroke,
                   stroke_fill=(stroke_fill or fill) + (255,))
            xx += f.getlength(word)
        yy += size * lead
    if shadow:
        sh = lay.split()[-1].filter(ImageFilter.GaussianBlur(size * 0.12)).point(lambda v: int(v * shadow))
        s = Image.new("RGBA", img.size, (0, 0, 0, 0))
        s.putalpha(sh)
        img.alpha_composite(s, (0, int(size * 0.06)))
    img.alpha_composite(lay)
    return (x0b, y, x1b, yy)


# ---------------------------------------------------------------- FOTO + GARIS
def place_photo(ph, W, H, head_y=0.42, focus_x=None, subj_frac=0.0):
    """Potong foto penuh W x H supaya kepala orang di sekitar head_y (ruang tajuk di atas).
    subj_frac > 0: zoom supaya tinggi orang ~ subj_frac x H (maks 2.2x besarkan). Pulang (gambar, kotak, skala)."""
    iw, ih = ph.W, ph.H
    s = max(W / iw, H / ih)
    if subj_frac and ph.bbox:
        bh = ph.bbox[3] - ph.bbox[1]
        s = max(s, min(subj_frac * H / max(1, bh), s * 2.2))
    cw, ch = W / s, H / s
    if ph.bbox:
        bx0, by0, bx1, by1 = ph.bbox
        cx = focus_x if focus_x is not None else (bx0 + bx1) / 2
        y0 = by0 - head_y * ch + (by1 - by0) * 0.02
    else:
        cx, y0 = ph.focus[0] * iw, ph.focus[1] * ih - ch / 2
    x0 = min(max(0, cx - cw / 2), iw - cw)
    y0 = min(max(0, y0), ih - ch)
    box = (int(x0), int(y0), int(x0 + cw), int(y0 + ch))
    return ce.fit(ph.im.crop(box), W, H), box, s


def mask_in(ph, box, W, H, loose=0.0):
    m = ph.loose(loose) if loose else ph.mask
    return m.crop(box).resize((W, H), Image.Resampling.LANCZOS)


def dashed_contour(alpha, dist, dash=26, gap=18, width=5, color=WHITE):
    """Garis putus-putus di luar bentuk (alpha), jarak dist px."""
    a = (np.asarray(alpha) > 128).astype(np.uint8)
    k = dist * 2 + 1
    a = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), dist * 0.6)
    a = (a > 0.5).astype(np.uint8)
    cs, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    lay = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for c in cs:
        if len(c) < 60:
            continue
        pts = c[:, 0, :].astype(float)
        seg, acc, on = [], 0.0, True
        for i in range(len(pts)):
            p, q = pts[i], pts[(i + 1) % len(pts)]
            step = math.hypot(*(q - p))
            if on:
                seg.append(tuple(p))
            acc += step
            if on and acc >= dash:
                if len(seg) > 1:
                    d.line(seg, fill=color + (255,), width=width, joint="curve")
                seg, acc, on = [], 0.0, False
            elif not on and acc >= gap:
                acc, on = 0.0, True
    return lay


def outline_on_photo(bg, alpha, width=14, color=WHITE, dashed=False):
    """Garis putih tebal di sekeliling orang, atas fotonya sendiri (gaya rujukan Mira)."""
    img = bg.convert("RGBA")
    a = alpha.filter(ImageFilter.GaussianBlur(0.8))
    ol = ce.outline_layer(a, width, color)
    sh = ol.split()[-1].filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.28))
    s = Image.new("RGBA", img.size, (0, 0, 0, 0))
    s.putalpha(sh)
    img.alpha_composite(s, (0, 6))
    img.alpha_composite(ol)
    if dashed:
        img.alpha_composite(dashed_contour(a, width + 22, width=max(4, width // 3)))
    subj = bg.convert("RGBA")
    subj.putalpha(a)
    img.alpha_composite(subj)
    return img


def darken(img, k=0.82, vignette=0.35):
    a = np.asarray(img.convert("RGB")).astype(np.float32) * k
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a *= (1 - vignette * np.clip(r - 0.55, 0, 1))[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def top_gradient(img, h, strength=0.45):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    g = np.clip(1 - np.arange(a.shape[0]) / max(1, h), 0, 1) ** 1.6 * strength
    a *= (1 - g)[:, None, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- DOODLE PUTIH
def _jit(rng, a=2.0):
    return rng.uniform(-a, a)


def doodle_sparkle(d, x, y, r, rng, fill=True, w=5):
    pts = []
    for i in range(8):
        rr = r if i % 2 == 0 else r * 0.28
        a = math.radians(-90 + i * 45)
        pts.append((x + rr * math.cos(a) + _jit(rng, 1), y + rr * math.sin(a) + _jit(rng, 1)))
    if fill:
        d.polygon(pts, fill=WHITE + (255,))
    else:
        d.line(pts + [pts[0]], fill=WHITE + (255,), width=w, joint="curve")


def doodle_burst(d, x, y, ang, rng, n=3, L=46, w=6):
    for k in range(n):
        a = math.radians(ang + (k - (n - 1) / 2) * 22)
        r0 = 10 + _jit(rng, 2)
        d.line([(x + r0 * math.cos(a), y + r0 * math.sin(a)), (x + (r0 + L) * math.cos(a), y + (r0 + L) * math.sin(a))],
               fill=WHITE + (255,), width=w)


def doodle_heart(d, x, y, s, rng, w=5):
    pts = []
    for i in range(48):
        t = 2 * math.pi * i / 48
        hx = 16 * math.sin(t) ** 3
        hy = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((x + hx * s / 17 + _jit(rng, 0.8), y - hy * s / 17 + _jit(rng, 0.8)))
    d.line(pts + [pts[0]], fill=WHITE + (255,), width=w, joint="curve")


def doodle_arrow(d, p0, p1, rng, w=5, bend=0.25):
    (x0, y0), (x1, y1) = p0, p1
    mx, my = (x0 + x1) / 2 - (y1 - y0) * bend, (y0 + y1) / 2 + (x1 - x0) * bend
    pts = []
    for i in range(30):
        t = i / 29
        pts.append(((1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1 + _jit(rng, 0.6),
                    (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1 + _jit(rng, 0.6)))
    d.line(pts, fill=WHITE + (255,), width=w, joint="curve")
    a = math.atan2(y1 - pts[-4][1], x1 - pts[-4][0])
    for s in (1, -1):
        d.line([(x1, y1), (x1 - 26 * math.cos(a + s * 0.5), y1 - 26 * math.sin(a + s * 0.5))],
               fill=WHITE + (255,), width=w)


def doodle_squiggle(d, x, y, L, rng, w=5):
    pts = [(x + t, y + math.sin(t / 14) * 9 + _jit(rng, 0.8)) for t in range(0, int(L), 3)]
    d.line(pts, fill=WHITE + (255,), width=w, joint="curve")


# ---------------------------------------------------------------- STICKER COMEL (lukisan code, gaya sticker)
def _sticker(draw_fn, size, border=9):
    S = 2
    lay = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(lay), size * S)
    a = lay.split()[-1]
    out = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    ol = ce.outline_layer(a, border * S, WHITE)
    sh = ol.split()[-1].filter(ImageFilter.GaussianBlur(8 * S)).point(lambda v: int(v * 0.25))
    s = Image.new("RGBA", lay.size, (0, 0, 0, 0))
    s.putalpha(sh)
    out.alpha_composite(s, (0, 5 * S))
    out.alpha_composite(ol)
    out.alpha_composite(lay)
    return out.resize((size, size), Image.Resampling.LANCZOS)


def st_bow(n):
    def f(d, s):
        c = s / 2
        pk, dk = (242, 170, 190), (222, 120, 148)
        for sg in (-1, 1):
            d.ellipse([c + sg * s * 0.05 - (s * 0.36 if sg < 0 else 0), c - s * 0.2, c + sg * s * 0.05 + (s * 0.36 if sg > 0 else 0), c + s * 0.12],
                      fill=pk + (255,))
            d.ellipse([c + sg * s * 0.14 - (s * 0.16 if sg < 0 else 0), c - s * 0.1, c + sg * s * 0.14 + (s * 0.16 if sg > 0 else 0), c + s * 0.03],
                      fill=(250, 210, 220, 255))
            d.polygon([(c, c), (c + sg * s * 0.22, c + s * 0.42), (c + sg * s * 0.06, c + s * 0.38)], fill=dk + (255,))
        d.ellipse([c - s * 0.09, c - s * 0.1, c + s * 0.09, c + s * 0.08], fill=dk + (255,))
    return _sticker(f, n)


def st_daisy(n):
    def f(d, s):
        c = s / 2
        for i in range(12):
            a = math.radians(i * 30)
            px, py = c + s * 0.24 * math.cos(a), c + s * 0.24 * math.sin(a)
            d.ellipse([px - s * 0.12, py - s * 0.12, px + s * 0.12, py + s * 0.12], fill=(253, 251, 245, 255),
                      outline=(226, 218, 204, 255), width=max(1, s // 120))
        d.ellipse([c - s * 0.12, c - s * 0.12, c + s * 0.12, c + s * 0.12], fill=(245, 196, 66, 255))
    return _sticker(f, n)


def st_heart(n, col=(240, 150, 172)):
    def f(d, s):
        pts = []
        for i in range(60):
            t = 2 * math.pi * i / 60
            hx = 16 * math.sin(t) ** 3
            hy = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            pts.append((s / 2 + hx * s * 0.42 / 17, s / 2 - hy * s * 0.42 / 17))
        d.polygon(pts, fill=col + (255,))
        d.ellipse([s * 0.3, s * 0.32, s * 0.4, s * 0.42], fill=(255, 230, 236, 255))
    return _sticker(f, n)


def st_cherry(n):
    def f(d, s):
        d.line([(s * 0.35, s * 0.62), (s * 0.55, s * 0.18), (s * 0.68, s * 0.6)], fill=(110, 140, 70, 255), width=max(3, s // 30))
        d.ellipse([s * 0.5, s * 0.1, s * 0.78, s * 0.26], fill=(140, 180, 90, 255))
        for cx in (0.33, 0.68):
            d.ellipse([s * (cx - 0.17), s * 0.55, s * (cx + 0.17), s * 0.89], fill=(214, 60, 74, 255))
            d.ellipse([s * (cx - 0.1), s * 0.6, s * (cx - 0.03), s * 0.67], fill=(255, 200, 205, 255))
    return _sticker(f, n)


def st_star(n, col=(246, 178, 196)):
    def f(d, s):
        d.polygon(ce.star_pts(s / 2, s / 2 + s * 0.03, s * 0.42, 0.5), fill=col + (255,))
    return _sticker(f, n)


STICKERS = [st_bow, st_daisy, st_heart, st_cherry, st_star]
STK_DIR = os.path.join(HERE, "stickers")
_png = {}


def png_stickers():
    """Sticker PNG Mira (stickers/*.png, upload dari Studio > Rujukan). Dipakai dulu sebelum sticker lukisan code."""
    if "list" not in _png:
        L = []
        if os.path.isdir(STK_DIR):
            for f in sorted(os.listdir(STK_DIR)):
                if f.lower().endswith(".png"):
                    try:
                        im = Image.open(os.path.join(STK_DIR, f)).convert("RGBA")
                        bb = im.split()[-1].point(lambda v: 255 if v > 20 else 0).getbbox()
                        if bb:
                            L.append(im.crop(bb))
                    except Exception:
                        pass
        _png["list"] = L
    return _png["list"]


def png_sticker(rng, size):
    L = png_stickers()
    if not L:
        return None
    im = rng.choice(L).copy()
    im.thumbnail((size, size), Image.Resampling.LANCZOS)
    pad = 14
    base = Image.new("RGBA", (im.size[0] + 2 * pad, im.size[1] + 2 * pad), (0, 0, 0, 0))
    base.paste(im, (pad, pad), im)
    a = base.split()[-1]
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ol = ce.outline_layer(a, 8, WHITE)
    sh = ol.split()[-1].filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.25))
    s = Image.new("RGBA", base.size, (0, 0, 0, 0))
    s.putalpha(sh)
    out.alpha_composite(s, (0, 5))
    out.alpha_composite(ol)
    out.alpha_composite(base)
    return out


# ---------------------------------------------------------------- KANVAS
class Strip:
    def __init__(self, n, W, H):
        self.n, self.W, self.H = n, W, H
        self.img = Image.new("RGBA", (n * W, H), (240, 236, 230, 255))
        self.prot = np.zeros((H, n * W), np.uint8)
        self.seams = [W * i for i in range(1, n)]

    def paste(self, im, x, y, prot=None):
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        layer.paste(im, (int(x), int(y)))
        self.img.alpha_composite(layer)
        if prot is not None:
            p = Image.new("L", self.img.size, 0)
            p.paste(prot, (int(x), int(y)))
            self.prot = np.maximum(self.prot, np.asarray(p))

    def busy(self, x0, y0, x1, y1):
        x0, y0, x1, y1 = [int(v) for v in (max(0, x0), max(0, y0), min(self.img.size[0], x1), min(self.H, y1))]
        if x1 <= x0 or y1 <= y0:
            return 1.0
        return float((self.prot[y0:y1, x0:x1] > 0).mean())

    def bad_seams(self):
        return [i + 1 for i, s in enumerate(self.seams) if (self.prot[:, max(0, s - 45):s + 45] > 0).any()]


def face_prot(ph, box, W, H):
    p = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(p)
    s = W / (box[2] - box[0])
    for f in ph.faces:
        d.rectangle([(f[0] - box[0]) * s - 20, (f[1] - box[1]) * s - 20, (f[2] - box[0]) * s + 20, (f[3] - box[1]) * s + 20], fill=255)
    return p


def subject_box(alpha):
    return alpha.point(lambda v: 255 if v > 128 else 0).getbbox()


# ---------------------------------------------------------------- SLIDE: DOODLE + COMEL (foto penuh)
def slide_fullbleed(st, i, ph, kit, rng, title="", sub="", text="", safe=None):
    """Satu slide foto penuh dengan outline orang + doodle / sticker + tajuk."""
    W, H = st.W, st.H
    sy0, sy1 = safe or (0, H)
    sh = sy1 - sy0
    has_title = bool(title)
    head_y = (sy0 + sh * (0.40 if has_title else 0.24)) / H
    bg, box, s = place_photo(ph, W, H, head_y=head_y, subj_frac=(sh / H) * (0.6 if has_title else 0.72))
    if kit == "doodle":
        bg = darken(bg, 0.86, 0.4)
        if has_title or text:
            bg = top_gradient(bg, int(sy0 + sh * 0.45), 0.68)
    img = bg.convert("RGBA")
    prot = face_prot(ph, box, W, H)
    if ph.people and not ph.mask_incomplete:
        a = mask_in(ph, box, W, H, loose=0.02 if ph.solid < 0.8 else 0.0)
        img = outline_on_photo(bg, a, width=14 if kit == "doodle" else 13, dashed=(kit == "comel"))
        sb = subject_box(a)
    else:
        sb = None
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    fb = None
    if ph.faces:
        f = ph.faces[0]
        fb = ((f[0] - box[0]) * s, (f[1] - box[1]) * s, (f[2] - box[0]) * s, (f[3] - box[1]) * s)
    # teks
    ty = sy0 + sh * 0.06
    if kit == "doodle":
        if has_title:
            L, size = fit_rich(title, ("chewy", None), W * 0.86, sh * 0.24, 132, 64, 0.98, upper=True, max_lines=3)
            bx = draw_rich(img, L, size, W * 0.07, ty, W * 0.86, fill=WHITE, lead=0.98, shadow=0.35)
            ty = bx[3] + 6
            if sub:
                L2, s2 = fit_rich("(" + sub.strip("() ") + ")", ("caveat", None), W * 0.8, 100, 60, 44)
                bx = draw_rich(img, L2, s2, W * 0.1, ty, W * 0.8, fill=(240, 236, 230), shadow=0.3)
                ty = bx[3]
        elif text:
            L, size = fit_rich(text, ("caveat", None), W * 0.84, sh * 0.16, 70, 40)
            draw_rich(img, L, size, W * 0.08, ty, W * 0.84, fill=WHITE, shadow=0.4)
    else:  # comel
        if has_title:
            L, size = fit_rich(title, ("fredoka", None), W * 0.84, sh * 0.2, 120, 60, 1.0, max_lines=2)
            bx = draw_rich(img, L, size, W * 0.08, ty, W * 0.84, fill=PINK, stroke=max(6, size // 11),
                           stroke_fill=WHITE, lead=1.0, shadow=0.25)
            ty = bx[3] + 4
            if sub:
                L2, s2 = fit_rich(sub, ("fredoka", None), W * 0.6, 70, 44, 30)
                draw_rich(img, L2, s2, W * 0.2, ty + 4, W * 0.6, fill=(120, 96, 104), stroke=5, stroke_fill=WHITE)
        elif text:
            L, size = fit_rich(text, ("fredoka", None), W * 0.8, sh * 0.14, 64, 36)
            draw_rich(img, L, size, W * 0.1, ty, W * 0.8, fill=PINK, stroke=6, stroke_fill=WHITE)
    # hiasan di ruang kosong sekitar orang (elak muka)
    hx = (sb[0] + sb[2]) / 2 if sb else W / 2
    htop = sb[1] if sb else H * 0.4
    if kit == "doodle":
        sx0, sx1 = (sb[0], sb[2]) if sb else (W * 0.3, W * 0.7)
        spots = [(sx0 - 70, htop + 40, "sparkle"), (sx1 + 70, htop + 20, "burst_r"), (sx0 - 60, htop + 230, "burst_l"),
                 (sx1 + 80, htop + 220, "heart"), (sx1 + 50, htop - 50, "sparkle2"), (sx0 - 90, htop - 40, "squiggle")]
        rng.shuffle(spots)
        k = 0
        for (x, y, kind) in spots:
            x = min(max(x, 80), W - 80)
            y = min(max(y, sy0 + sh * (0.34 if has_title else 0.08)), sy1 - 90)
            if fb and fb[0] - 60 < x < fb[2] + 60 and fb[1] - 60 < y < fb[3] + 60:
                continue
            if kind == "sparkle":
                doodle_sparkle(d, x, y, rng.uniform(36, 48), rng)
                doodle_sparkle(d, x + 56, y + 40, rng.uniform(16, 22), rng)
            elif kind in ("burst_r", "burst_l"):
                doodle_burst(d, x, y, -25 if kind == "burst_r" else 205, rng, L=58, w=8)
            elif kind == "sparkle2":
                doodle_sparkle(d, x, y, rng.uniform(28, 36), rng, fill=False, w=6)
            elif kind == "heart":
                doodle_heart(d, x, y, rng.uniform(34, 44), rng, w=7)
            else:
                doodle_squiggle(d, x - 50, y, 110, rng, w=7)
            k += 1
            if k >= 5:
                break
    else:
        spots = [(hx - W * 0.33, htop + 10), (hx + W * 0.33, htop + 40), (hx - W * 0.37, htop + 300),
                 (hx + W * 0.36, htop + 330), (W * 0.14, sy1 - 150), (W * 0.86, sy1 - 150)]
        rng.shuffle(spots)
        fns = STICKERS[:]
        rng.shuffle(fns)
        k = 0
        for (x, y) in spots:
            x = min(max(x, 90), W - 90)
            y = min(max(y, sy0 + sh * (0.3 if has_title else 0.08)), sy1 - 90)
            if fb and fb[0] - 80 < x < fb[2] + 80 and fb[1] - 80 < y < fb[3] + 80:
                continue
            sz = int(rng.uniform(120, 170))
            stk = (png_sticker(rng, sz + 30) or fns[k % len(fns)](sz)).rotate(rng.uniform(-18, 18), resample=Image.Resampling.BICUBIC, expand=True)
            lay.alpha_composite(stk, (int(x - stk.size[0] / 2), int(y - stk.size[1] / 2)))
            k += 1
            if k >= 4:
                break
        for _ in range(4):   # bintang & hati kecil garis hitam/putih
            x, y = rng.uniform(60, W - 60), rng.uniform(sy0 + sh * 0.3, sy1 - 60)
            if fb and fb[0] - 50 < x < fb[2] + 50 and fb[1] - 50 < y < fb[3] + 50:
                continue
            doodle_sparkle(d, x, y, rng.uniform(12, 18), rng, fill=False, w=3)
    img.alpha_composite(lay)
    st.paste(img, i * W, 0, prot)


def seam_doodle(st, k, rng, kit):
    """Penyambung kecil merentas garis potong (doodle garis putus / sticker), elak muka."""
    x = st.W * k
    for y in sorted([st.H * v for v in (0.86, 0.12, 0.7, 0.3)], key=lambda v: rng.random()):
        if st.busy(x - 120, y - 80, x + 120, y + 80) < 0.01:
            lay = Image.new("RGBA", (360, 200), (0, 0, 0, 0))
            d = ImageDraw.Draw(lay)
            if kit == "doodle":
                pts = [(20 + t * 3.2, 100 + math.sin(t / 9) * 40) for t in range(0, 100)]
                for j in range(0, len(pts) - 4, 8):
                    d.line(pts[j:j + 5], fill=WHITE + (255,), width=6)
                doodle_sparkle(d, 330, 70, 20, rng)
            else:
                stk = rng.choice(STICKERS)(150).rotate(rng.uniform(-20, 20), expand=True)
                lay.alpha_composite(stk, (int(180 - stk.size[0] / 2), int(100 - stk.size[1] / 2)))
            st.paste(lay, x - 180, y - 100)
            return


# ---------------------------------------------------------------- SLIDE: MAJALAH (seamless)
def rbox(w, h, fill, r=28):
    S = 2
    m = Image.new("L", (w * S, h * S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * S - 1, h * S - 1], radius=r * S, fill=255)
    out = Image.new("RGBA", (w, h), fill + (255,))
    out.putalpha(m.resize((w, h), Image.Resampling.LANCZOS))
    return out


def text_box(text, maxw, fill, ink, size=32):
    L, s = fit_rich(text, ("sans", None), maxw - 56, 400, size, 24, 1.3, max_lines=6)
    h = int(len(L) * s * 1.3 + 44)
    w = int(min(maxw, max(lw for _, lw in L) + 56))
    b = rbox(w, h, fill)
    draw_rich(b, L, s, 28, 20, w - 56, align="left", fill=ink, lead=1.3)
    return b


def photo_card(ph, w, h, border=12, polaroid=False, rot=0.0):
    pw, phh = w - 2 * border, h - 2 * border - (int(w * 0.18) if polaroid else 0)
    box = ce.crop_box(ph.W, ph.H, pw, phh, *ph.focus)
    card = Image.new("RGBA", (w, h), (252, 250, 246, 255))
    card.paste(ce.fit(ph.im.crop(box), pw, phh), (border, border))
    prot = Image.new("L", (w, h), 0)
    prot.paste(face_prot(ph, box, pw, phh), (border, border))
    if rot:
        card = card.rotate(rot, resample=Image.Resampling.BICUBIC, expand=True)
        prot = prot.rotate(rot, expand=True)
    sh = card.split()[-1].filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.3))
    out = Image.new("RGBA", (card.size[0] + 40, card.size[1] + 40), (0, 0, 0, 0))
    s = Image.new("RGBA", out.size, (0, 0, 0, 0))
    s.paste(Image.new("RGBA", card.size, (30, 22, 18, 255)), (24, 30), sh)
    out.alpha_composite(s)
    out.alpha_composite(card, (20, 20))
    pr = Image.new("L", out.size, 0)
    pr.paste(prot, (20, 20))
    return out, pr


def mag_cutout(ph, height):
    el = ce.cutout_el(ph, height, "loose" if ph.solid < 0.85 else "tight", WHITE)
    return el.img, el.prot


def render_majalah(st, phs, rng, title, sub, texts, safe=None):
    W, H, N = st.W, st.H, st.n
    sy0, sy1 = safe or (0, H)
    sh = sy1 - sy0
    tones = [("beige", "ink", "dark", "cream"), ("dark", "cream", "cream", "ink")]
    for i in range(N):
        bg, ink, boxf, boxi = tones[i % 2]
        st.paste(ce.paper_texture(W, H, MAG[bg], seed=i, fiber=3).convert("RGBA"), i * W, 0)
    people = [p for p in phs if p.cut_ok]
    used_cut = set()
    later = []
    if N == 1:   # cover / single: tajuk, polaroid besar, orang keluar dari tepi polaroid
        render_majalah_one(st, phs[0], rng, title, sub, sy0, sy1)
        return
    for i in range(N):
        bg, ink, boxf, boxi = tones[i % 2]
        ox = i * W
        ph = phs[i % len(phs)]
        tx = texts[i] if i < len(texts) else ""
        if i == 0:
            y = sy0 + sh * 0.07
            if title:
                L, size = fit_rich(title, ("serif", "serif_i"), W * 0.82, sh * 0.34, 150, 70, 0.95, upper=False, max_lines=3)
                bx = draw_rich(st.img, L, size, ox + W * 0.08, y, W * 0.82, align="left", fill=MAG[ink], lead=0.95)
                y = bx[3] + size * 0.3
            if sub:
                L2, s2 = fit_rich("*" + sub + "*", ("serif", "serif_i"), W * 0.7, 120, 46, 30)
                bx = draw_rich(st.img, L2, s2, ox + W * 0.09, y, W * 0.7, align="left", fill=MAG["mute"], lead=1.1)
                y = bx[3]
            cw = int(W * rng.uniform(0.5, 0.56))
            card, pr = photo_card(ph, cw, int(cw * 1.18), polaroid=True, rot=rng.uniform(-5, -2))
            cy = max(y + 40, sy0 + sh * 0.42)
            cy = min(cy, sy1 - card.size[1] - 20)
            st.paste(card, ox + W * 0.08, cy, pr)
        else:
            k = rng.randint(0, 1)
            if k == 0:   # foto besar + kotak teks
                cw = int(W * 0.62)
                card, pr = photo_card(ph, cw, int(cw * 1.25), border=10, rot=rng.uniform(-2, 2))
                st.paste(card, ox + W * (0.3 if i % 2 else 0.06), sy0 + sh * 0.16, pr)
                if tx:
                    later.append((text_box(tx, int(W * 0.6), MAG[boxf], MAG[boxi]), ox + W * (0.06 if i % 2 else 0.34), sy0 + sh * 0.68))
            else:        # dua foto bertindih
                p2 = phs[(i + N) % len(phs)]
                cw = int(W * 0.48)
                c1, p1 = photo_card(ph, cw, int(cw * 1.3), border=10, rot=rng.uniform(-4, -1))
                c2, pr2 = photo_card(p2, cw, int(cw * 1.3), border=10, rot=rng.uniform(1, 4))
                st.paste(c1, ox + W * 0.05, sy0 + sh * 0.12, p1)
                st.paste(c2, ox + W * 0.45, sy0 + sh * 0.34, pr2)
                if tx:
                    later.append((text_box(tx, int(W * 0.56), MAG[boxf], MAG[boxi], size=30), ox + W * 0.06, sy0 + sh * 0.76))
            if not tx and i == N - 1 and sub:
                pass
    # cutout merentas garis potong (orang tanpa muka atas garis)
    for k in range(1, N):
        cand = [p for p in people if p.name not in used_cut] or people
        if not cand:
            break
        ph = cand[0]
        used_cut.add(ph.name)
        img, pr = mag_cutout(ph, int(sh * rng.uniform(0.44, 0.54)))
        x = st.W * k - img.size[0] / 2
        prc = np.asarray(pr).any(0)
        cols = np.where(prc)[0]
        if len(cols):   # anjak supaya muka tak kena garis
            fc0, fc1 = cols[0], cols[-1]
            for dx in range(0, 600, 10):
                ok = None
                for s_ in (dx, -dx):
                    a0, a1 = x + s_ + fc0, x + s_ + fc1
                    if not (a0 - 45 < st.W * k < a1 + 45):
                        ok = s_
                        break
                if ok is not None:
                    x += ok
                    break
        st.paste(img, x, sy1 - img.size[1] - 10, pr)
    for b, x, y in later:   # kotak teks paling atas
        st.paste(b, x, y)


def render_majalah_one(st, ph, rng, title, sub, sy0, sy1):
    W, H = st.W, st.H
    sh = sy1 - sy0
    if H > W * 1.5:   # cover reel: jalur gelap atas & bawah luar kawasan grid, beige di tengah
        st.paste(ce.paper_texture(W, int(sy0 + 40), MAG["dark"], seed=5, fiber=3).convert("RGBA"), 0, 0)
        st.paste(ce.paper_texture(W, int(H - sy1 + 40), MAG["dark"], seed=6, fiber=3).convert("RGBA"), 0, sy1 - 40)
        st.paste(rbox(W - 60, int(sh + 20), MAG["beige"], r=36), 30, sy0 - 10)
    y = sy0 + sh * 0.06
    if title:
        L, size = fit_rich(title, ("serif", "serif_i"), W * 0.84, sh * 0.26, 150, 70, 0.95, max_lines=3)
        bx = draw_rich(st.img, L, size, W * 0.08, y, W * 0.84, align="left", fill=MAG["ink"], lead=0.95)
        y = bx[3] + size * 0.28
    if sub:
        L2, s2 = fit_rich("*" + sub + "*", ("serif", "serif_i"), W * 0.7, 110, 48, 30)
        bx = draw_rich(st.img, L2, s2, W * 0.09, y, W * 0.7, align="left", fill=MAG["mute"], lead=1.1)
        y = bx[3]
    top = max(y + 30, sy0 + sh * 0.3)
    avail = sy1 - top - 30
    cw = int(min(W * 0.74, avail / 1.32))
    card, pr = photo_card(ph, cw, int(cw * 1.2), polaroid=True, rot=rng.uniform(-4, -2))
    cx = W * 0.07
    st.paste(card, cx, top, pr)
    if ph.cut_ok:   # orang yang sama, lebih besar, keluar di kanan bawah
        img, prc = mag_cutout(ph, int(min(avail * 0.92, sh * 0.62)))
        x = min(W - img.size[0] * 0.78, cx + card.size[0] * 0.55)
        st.paste(img, x, sy1 - img.size[1] - 6, prc)


# ---------------------------------------------------------------- MASUK
def pick_order(photos, n, hero_first=True):
    hero = next((p for p in photos if p.star), None)
    rest = [p for p in photos if p is not hero]
    rest.sort(key=lambda p: (not p.people, p.lowres, -len(p.faces)))
    seq = ([hero] if hero else []) + rest
    if not hero and seq:
        best = max(seq, key=lambda p: (p.people and not p.mask_incomplete) * 5 + len(p.faces) - p.lowres * 5)
        seq.remove(best)
        seq.insert(0, best)
    while len(seq) < n:
        seq += seq[:n - len(seq)]
    return seq


def render_kit(opts, photos, seed):
    kit = opts.get("kit", "doodle")
    fmt = opts.get("format", "carousel")
    rng = random.Random(seed)
    title = (opts.get("title") or "").strip()
    sub = (opts.get("subtitle") or "").strip()
    texts = [t.strip() for t in (opts.get("texts") or []) if isinstance(t, str)]
    if fmt == "cover":
        W, H, N = 1080, 1920, 1
        safe = (285, 1635)   # kawasan yang nampak dalam grid profile (4:5)
    else:
        W, H = ce.SIZES.get(opts.get("aspect", "4:5"), ce.SIZES["4:5"])
        N = 1 if fmt == "single" else max(2, min(10, int(opts.get("slides", 5))))
        safe = None
    st = Strip(N, W, H)
    seq = pick_order(photos, N)
    if kit == "majalah":
        render_majalah(st, seq, rng, title, sub, texts, safe)
    else:
        for i in range(N):
            slide_fullbleed(st, i, seq[i], kit, random.Random(seed * 13 + i),
                            title=title if i == 0 else "", sub=sub if i == 0 else "",
                            text=texts[i] if i < len(texts) and i > 0 else "", safe=safe)
        for k in range(1, N):
            seam_doodle(st, k, rng, kit)
    return st, {"kit": kit, "format": fmt, "slides": [{"tpl": kit, "photos": [seq[i].name]} for i in range(N)]}
