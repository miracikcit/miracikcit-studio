#!/usr/bin/env python3
"""
make_carousel.py : carousel Instagram "seamless" gaya scrapbook.

Satu kanvas panjang (SLIDES x 1080) x 1350 dipotong jadi slide 4:5.
Gambar, cutout (rembg), frame mockup (post IG, skrin kamera, polaroid)
dan hiasan scrapbook (semua dilukis dengan code) diletak merentas garis
potongan supaya bersambung bila swipe.

Guna:
    _carousel_tools/venv/bin/python make_carousel.py [folder_gambar] [--slides N]

Gambar asal tak diubah. Hasil: output/slide_01.jpg ... + output/preview_strip.jpg
Kalau PICKS di bawah kosong / fail tak wujud, script pilih sendiri
(latar = paling sikit orang, cutout = orang yang jelas, frame = yang lain).
"""
import argparse
import hashlib
import math
import os
import random
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

# ---------------------------------------------------------------- SETTINGS
SLIDES = 5
SLIDE_W, SLIDE_H = 1080, 1350
JPEG_QUALITY = 95
SEED = 7                      # tukar untuk susunan hiasan lain
SEAM_MARGIN = 45              # px: muka / teks mesti jauh sekurang-kurangnya ini dari garis potong

HERE = Path(__file__).resolve().parent
PHOTO_DIR = HERE / "photos"
OUT_DIR = HERE / "output"
CACHE_DIR = HERE / "_carousel_tools" / "cache"

TEXT = {
    "headline": "cuti-cuti",
    "beads": "GENTING",
    "label": "EP 1: 3,100FT ABOVE",
    "ig_user": "miracikcit",
    "ig_place": "Genting Highlands",
    "ig_caption": "pagi berkabus, air sejuk, hati panas",
    "polaroid": ["love at 3,100ft", "kolam bola!", "check mate"],
    "phone_note": "eufloria",
    "outro": "jumpa lagi, genting",
}

# Pilihan gambar (nama fail dalam PHOTO_DIR). Kosongkan {} untuk auto.
PICKS = {
    "bg":       ["awana1_p7.jpg", "awana2_p3.jpg", "eufloria_p6.jpg"],
    "cutout":   ["awana2_p2.jpg", "eufloria_p0.jpg"],
    "object":   ["eufloria_p2.jpg"],          # cutout objek (model u2net umum)
    "ig":       ["awana2_p0.jpg"],
    "phone":    ["eufloria_p3.jpg"],
    "polaroid": ["awana1_p3.jpg", "eufloria_p7.jpg", "awana2_p1.jpg"],
}

# Warna asas (akan dilaraskan ikut tona gambar)
CREAM = (246, 241, 231)
INK = (58, 52, 46)
PINK = (241, 196, 200)
BUTTER = (247, 226, 140)
SAGE = (170, 190, 160)

RS = Image.Resampling


# ---------------------------------------------------------------- FONTS
def find_font(cands, size):
    roots = ["/usr/share/fonts", "/Library/Fonts", "/System/Library/Fonts",
             os.path.expanduser("~/Library/Fonts"), "C:/Windows/Fonts"]
    for c in cands:
        if os.path.isabs(c) and os.path.exists(c):
            return ImageFont.truetype(c, size)
        for r in roots:
            for p in Path(r).rglob(c) if os.path.isdir(r) else []:
                try:
                    return ImageFont.truetype(str(p), size)
                except OSError:
                    pass
    return ImageFont.load_default(size)


_font_cache = {}


def font(kind, size):
    key = (kind, size)
    if key not in _font_cache:
        cands = {
            "black": ["Inter-Black.otf", "Arial Rounded Bold.ttf", "Arial Black.ttf",
                      "DejaVuSans-Bold.ttf"],
            "bold": ["Inter-Bold.otf", "Helvetica.ttc", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"],
            "reg": ["Inter-Medium.otf", "Helvetica.ttc", "Arial.ttf", "DejaVuSans.ttf"],
            "serif": ["DejaVuSerif-Italic.ttf", "Georgia Italic.ttf", "Times New Roman Italic.ttf",
                      "FreeSerifItalic.ttf"],
            "mono": ["JetBrainsMono-Bold.ttf", "Courier New Bold.ttf", "DejaVuSansMono-Bold.ttf"],
        }[kind]
        _font_cache[key] = find_font(cands, size)
    return _font_cache[key]


# ---------------------------------------------------------------- ELEMENT
class El:
    """Gambar RGBA + topeng 'protect' (muka/teks yang tak boleh kena garis potong)."""

    def __init__(self, img, prot=None):
        self.img = img.convert("RGBA")
        self.prot = prot if prot is not None else Image.new("L", self.img.size, 0)

    def rotate(self, deg):
        if not deg:
            return self
        img = self.img.rotate(deg, resample=RS.BICUBIC, expand=True)
        prot = self.prot.rotate(deg, resample=RS.NEAREST, expand=True)
        return El(img, prot)

    def scale(self, f):
        w, h = self.img.size
        sz = (max(1, int(w * f)), max(1, int(h * f)))
        return El(self.img.resize(sz, RS.LANCZOS), self.prot.resize(sz, RS.NEAREST))

    @property
    def size(self):
        return self.img.size


def protect_all(img, inset=0):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rectangle([inset, inset, img.size[0] - inset, img.size[1] - inset], fill=255)
    return m


# ---------------------------------------------------------------- PHOTO PREP
def load_photo(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return im


def grade(im, warm=1.0):
    """Tona lembut & hangat yang seragam: kurang kontras sikit, angkat bayang, kabus."""
    a = np.asarray(im).astype(np.float32) / 255.0
    a = 0.06 + a * 0.92                                  # angkat hitam, turun putih
    lum = a.mean(axis=2, keepdims=True)
    a = lum + (a - lum) * 0.88                           # kurangkan saturasi sikit
    a[..., 0] *= 1.0 + 0.035 * warm
    a[..., 2] *= 1.0 - 0.035 * warm
    a = a * 0.95 + np.array([0.97, 0.96, 0.94]) * 0.05   # kabus
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def upscale(im, target_w=None, target_h=None):
    """Besarkan dengan halus (LANCZOS + sedikit unsharp) bila gambar asal kecil."""
    w, h = im.size
    f = max((target_w or 0) / w, (target_h or 0) / h, 1e-9)
    if f <= 1:
        return im.resize((max(1, int(w * f)), max(1, int(h * f))), RS.LANCZOS)
    out = im
    while f > 1.0:  # besarkan berperingkat
        step = min(f, 2.0)
        out = out.resize((int(out.size[0] * step), int(out.size[1] * step)), RS.LANCZOS)
        f /= step
    out = out.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    return out


def cover_crop(im, w, h, fx=0.5, fy=0.5):
    """Potong + besarkan gambar supaya penuh w x h. fx/fy = titik fokus (0..1)."""
    iw, ih = im.size
    s = max(w / iw, h / ih)
    cw, ch = w / s, h / s
    x0 = min(max(0, iw * fx - cw / 2), iw - cw)
    y0 = min(max(0, ih * fy - ch / 2), ih - ch)
    crop = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch)))
    return upscale(crop, w, h).resize((w, h), RS.LANCZOS)


# ---------------------------------------------------------------- ANALYSIS (rembg + muka)
_sessions = {}


def rembg_mask(path, model):
    from rembg import new_session, remove
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    st = os.stat(path)
    key = hashlib.md5(f"{path}|{st.st_size}|{st.st_mtime}|{model}".encode()).hexdigest()[:16]
    cp = CACHE_DIR / f"{key}.png"
    if cp.exists():
        return Image.open(cp).convert("L")
    if model not in _sessions:
        _sessions[model] = new_session(model)
    im = load_photo(path)
    big = upscale(im, target_w=max(im.size[0], 1000))
    out = remove(big, session=_sessions[model], post_process_mask=True)
    m = out.split()[-1]
    m.save(cp)
    return m


_face_cascades = None


def detect_faces(im):
    """Kotak muka (x0,y0,x1,y1) dalam koordinat im. Haar frontal + profile."""
    global _face_cascades
    if _face_cascades is None:
        d = cv2.data.haarcascades
        _face_cascades = [cv2.CascadeClassifier(d + n) for n in
                          ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml")]
    f = 1000 / max(im.size)
    g = cv2.cvtColor(np.asarray(im.resize((int(im.size[0] * f), int(im.size[1] * f)))),
                     cv2.COLOR_RGB2GRAY)
    g = cv2.equalizeHist(g)
    boxes = []
    for c in _face_cascades:
        for flip in (False, True):
            gg = cv2.flip(g, 1) if flip else g
            for (x, y, w, h) in c.detectMultiScale(gg, 1.1, 5, minSize=(24, 24)):
                if flip:
                    x = gg.shape[1] - x - w
                boxes.append((x / f, y / f, (x + w) / f, (y + h) / f))
    return boxes


def analyse(paths):
    info = {}
    for p in paths:
        im = load_photo(p)
        m = np.asarray(rembg_mask(p, "u2net_human_seg").resize(im.size)) > 128
        ratio = m.mean()
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
        big = stats[1:, cv2.CC_STAT_AREA].max() / max(1, m.sum()) if n > 1 else 0
        cols = np.where(m.any(0))[0]
        touches = len(cols) and (cols[0] <= 1 or cols[-1] >= m.shape[1] - 2)
        sharp = cv2.Laplacian(cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2GRAY), cv2.CV_64F).var()
        info[p.name] = dict(ratio=ratio, solid=big, touches=bool(touches), sharp=sharp,
                            faces=len(detect_faces(im)))
    return info


def auto_picks(paths):
    print("Auto pilih gambar (analisis rembg + muka)...")
    info = analyse(paths)
    med = np.median([v["sharp"] for v in info.values()])
    ok = [k for k, v in info.items() if v["sharp"] > 0.35 * med]
    left = set(ok)

    def take(cands, n):
        got = [c for c in cands if c in left][:n]
        left.difference_update(got)
        return got

    cut = take(sorted([k for k in ok if 0.04 < info[k]["ratio"] < 0.45 and info[k]["solid"] > 0.85
                       and not info[k]["touches"]],
                      key=lambda k: (info[k]["faces"] > 0, -info[k]["ratio"])), 2)
    bg = take(sorted(ok, key=lambda k: info[k]["ratio"]), 3)
    rest = sorted(left, key=lambda k: -info[k]["faces"])
    picks = {"bg": bg, "cutout": cut, "object": [],
             "ig": rest[:1], "phone": rest[1:2], "polaroid": rest[2:5]}
    for k, v in info.items():
        print(f"  {k:24s} orang={v['ratio']:.2f} muka={v['faces']} tajam={v['sharp']:.0f}")
    return picks


def resolve_picks(photo_dir):
    paths = sorted([p for p in photo_dir.iterdir()
                    if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".heic")])
    if not paths:
        sys.exit(f"Tiada gambar dalam {photo_dir}")
    names = {p.name for p in paths}
    want = [n for v in PICKS.values() for n in v]
    if PICKS and all(n in names for n in want):
        picks = {k: list(v) for k, v in PICKS.items()}
    else:
        picks = auto_picks(paths)
    # isi kekosongan dengan apa yang ada supaya layout sentiasa lengkap
    pool = [p.name for p in paths]
    need = {"bg": 3, "cutout": 2, "ig": 1, "phone": 1, "polaroid": 3}
    i = 0
    for k, n in need.items():
        while len(picks.get(k, [])) < n:
            picks.setdefault(k, []).append(pool[i % len(pool)])
            i += 1
    return {k: [photo_dir / n for n in v] for k, v in picks.items()}


# ---------------------------------------------------------------- PALETTE
def derive_palette(paths):
    global CREAM, SAGE, PINK
    px = []
    for p in paths:
        im = load_photo(p).resize((48, 80))
        px.append(np.asarray(im).reshape(-1, 3))
    px = np.concatenate(px).astype(np.float32)
    hsv = cv2.cvtColor(px.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV).reshape(-1, 3)
    green = px[(hsv[:, 0] > 30) & (hsv[:, 0] < 90) & (hsv[:, 1] > 40)]
    if len(green) > 50:
        g = green.mean(0)
        # versi pastel/berkabus dari hijau gambar
        SAGE = tuple(int(c * 0.45 + 235 * 0.55) for c in g)
    light = px[px.mean(1) > 200]
    if len(light) > 50:  # cream hangat, hanya sedikit dipengaruhi tona cerah gambar
        l = light.mean(0)
        CREAM = tuple(int(min(250, c * 0.15 + w * 0.85)) for c, w in zip(l, (249, 243, 232)))
    print(f"Palet: cream={CREAM} sage={SAGE} pink={PINK}")


# ---------------------------------------------------------------- DRAW HELPERS
SS = 2  # supersampling untuk hiasan


def ss_canvas(w, h):
    return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))


def ss_done(img):
    return img.resize((img.size[0] // SS, img.size[1] // SS), RS.LANCZOS)


def heart_pts(cx, cy, s, n=60):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 17, cy - y * s / 17))
    return pts


def star_pts(cx, cy, r, ri=0.5, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        rr = r if i % 2 == 0 else r * ri
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def puffy(mask, rad):
    """Bucu jadi bulat (rupa sticker gebu)."""
    m = mask.filter(ImageFilter.GaussianBlur(rad))
    return m.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(1))


def outline_alpha(a, px):
    """Kembangkan alpha (untuk garisan putih sticker)."""
    k = px * 2 + 1
    arr = cv2.dilate(np.asarray(a), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return Image.fromarray(arr).filter(ImageFilter.GaussianBlur(1.2))


def shade_gradient(size, top=1.0, bottom=0.82):
    w, h = size
    g = np.linspace(top, bottom, h, dtype=np.float32)[:, None].repeat(w, 1)
    return g


def paper_texture(w, h, base, seed=0, fiber=6):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (h // 4 + 1, w // 4 + 1)).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    n2 = rng.normal(0, 1, (h, w)).astype(np.float32)
    a = np.array(base, np.float32)[None, None, :] + (n * fiber * 0.6 + n2 * fiber * 0.4)[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def deckle_mask(w, h, edges="lrtb", amp=7, seed=0):
    """Topeng kertas koyak di tepi yang dipilih."""
    rng = random.Random(seed)
    m = Image.new("L", (w, h), 0)
    pts = []

    def jit(i, n):
        return amp * (0.6 * math.sin(i * 0.9 + seed) + 0.4 * (rng.random() * 2 - 1))

    step = 14
    for x in range(0, w + 1, step):                                # atas
        pts.append((x, (amp + jit(x, w)) if "t" in edges else 0))
    for y in range(0, h + 1, step):                                # kanan
        pts.append((w - ((amp + jit(y, h)) if "r" in edges else 0), y))
    for x in range(w, -1, -step):                                  # bawah
        pts.append((x, h - ((amp + jit(x, w)) if "b" in edges else 0)))
    for y in range(h, -1, -step):                                  # kiri
        pts.append((((amp + jit(y, h)) if "l" in edges else 0), y))
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.filter(ImageFilter.GaussianBlur(0.8))


# ---------------------------------------------------------------- PAPERS
def paper_hearts(w, h, seed=1):
    base = (250, 236, 236)
    img = paper_texture(w, h, base, seed).convert("RGBA")
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    sp = 95
    for j, y in enumerate(range(-sp, h + sp, sp)):
        for x in range(-sp, w + sp, sp):
            xx = x + (sp // 2 if j % 2 else 0)
            d.polygon([(px * SS, py * SS) for px, py in heart_pts(xx, y, 20)],
                      fill=PINK + (230,))
    img.alpha_composite(ss_done(lay))
    return img


def paper_dots(w, h, color=None, seed=2, bg=None):
    color = color or SAGE
    img = paper_texture(w, h, bg or (247, 246, 238), seed).convert("RGBA")
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    sp = 64
    for j, y in enumerate(range(0, h + sp, sp)):
        for x in range(0, w + sp, sp):
            xx = x + (sp // 2 if j % 2 else 0)
            r = 9
            d.ellipse([(xx - r) * SS, (y - r) * SS, (xx + r) * SS, (y + r) * SS], fill=color + (210,))
    img.alpha_composite(ss_done(lay))
    return img


def paper_grid(w, h, seed=3):
    img = paper_texture(w, h, (249, 248, 243), seed).convert("RGBA")
    d = ImageDraw.Draw(img)
    c = tuple(int(v * 0.8) for v in SAGE) + (90,)
    for x in range(0, w, 40):
        d.line([(x, 0), (x, h)], fill=c, width=2)
    for y in range(0, h, 40):
        d.line([(0, y), (w, y)], fill=c, width=2)
    return img


def paper_panel(kind, w, h, seed, edges="lrtb"):
    p = {"hearts": paper_hearts, "dots": paper_dots, "grid": paper_grid}[kind](w, h, seed=seed)
    p.putalpha(ImageChops.multiply(p.split()[-1], deckle_mask(w, h, edges, seed=seed)))
    return El(p)


# ---------------------------------------------------------------- DECOR
def lace(length, height=70, color=(255, 255, 255)):
    w, h = length, height
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    band = int(h * 0.42)
    d.rectangle([0, 0, w * SS, band * SS], fill=color + (235,))
    r = h * 0.3
    x = 0
    while x < w + r:
        d.ellipse([(x - r) * SS, (band - r) * SS, (x + r) * SS, (band + r) * SS], fill=color + (235,))
        x += r * 1.7
    # lubang-lubang renda
    x = r * 0.85
    while x < w:
        rr = r * 0.35
        d.ellipse([(x - rr) * SS, (band - rr * 0.2) * SS, (x + rr) * SS, (band + rr * 1.8) * SS],
                  fill=(0, 0, 0, 0))
        x += r * 1.7
    for x in range(10, w, 26):
        d.ellipse([(x - 4) * SS, (band * 0.45 - 4) * SS, (x + 4) * SS, (band * 0.45 + 4) * SS],
                  fill=(0, 0, 0, 0))
    d.line([(0, band * 0.15 * SS), (w * SS, band * 0.15 * SS)], fill=(230, 222, 212, 255), width=SS * 2)
    return El(ss_done(lay))


def washi(length, height=58, color=None, seed=0):
    color = color or PINK
    img = Image.new("RGBA", (length, height), color + (175,))
    d = ImageDraw.Draw(img)
    for x in range(-height, length, 26):  # jalur
        d.line([(x, height), (x + height, 0)], fill=(255, 255, 255, 70), width=8)
    m = Image.new("L", img.size, 255)
    md = ImageDraw.Draw(m)
    z = 7
    for y in range(0, height, z * 2):  # hujung zigzag
        md.polygon([(0, y), (z, y + z), (0, y + 2 * z)], fill=0)
        md.polygon([(length, y), (length - z, y + z), (length, y + 2 * z)], fill=0)
    img.putalpha(ImageChops.multiply(img.split()[-1], m))
    return El(img)


def paper_clip(length=210, color=(196, 160, 170)):
    w = int(length * 0.32)
    lay = ss_canvas(w + 20, length + 20)
    d = ImageDraw.Draw(lay)
    u = w / 44.0
    pts = []

    def line(p0, p1, n=12):
        for i in range(n + 1):
            t = i / n
            pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))

    def arc(cx, cy, r, a0, a1, n=24):
        for i in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    L = length / u
    line((4, L * 0.35), (4, L - 22))
    arc(22, L - 22, 18, 180, 0)
    line((40, L - 22), (40, 18))
    arc(26, 18, 14, 0, -180)
    line((12, 18), (12, L - 40))
    arc(22, L - 40, 10, 180, 0)
    line((32, L - 40), (32, L * 0.3))
    pts = [((x * u + 10) * SS, (L - y) * u * SS + 10 * SS) for x, y in pts]
    d.line(pts, fill=tuple(int(c * 0.75) for c in color) + (255,), width=int(5.5 * SS), joint="curve")
    d.line([(x - SS, y - SS) for x, y in pts], fill=color + (255,), width=int(3.6 * SS), joint="curve")
    d.line([(x - 2 * SS, y - 2 * SS) for x, y in pts], fill=(255, 255, 255, 150), width=int(1.2 * SS),
           joint="curve")
    return El(ss_done(lay))


def sticker_star(r=60, color=None):
    color = color or BUTTER
    s = int(r * 2.6)
    m = Image.new("L", (s * SS, s * SS), 0)
    ImageDraw.Draw(m).polygon([(x * SS, y * SS) for x, y in star_pts(s / 2, s / 2 + r * 0.05, r, 0.55)],
                              fill=255)
    m = puffy(m, r * 0.12 * SS)
    out = outline_alpha(m, int(7 * SS))
    img = Image.new("RGBA", m.size, (255, 255, 255, 0))
    img.putalpha(out)
    body = Image.new("RGBA", m.size, color + (255,))
    g = shade_gradient(m.size, 1.06, 0.86)
    arr = np.asarray(body).astype(np.float32)
    arr[..., :3] = np.clip(arr[..., :3] * g[..., None], 0, 255)
    body = Image.fromarray(arr.astype(np.uint8))
    body.putalpha(m)
    img.alpha_composite(body)
    d = ImageDraw.Draw(img)  # kilauan
    c = s * SS / 2
    d.ellipse([c - r * 0.45 * SS, c - r * 0.55 * SS, c - r * 0.15 * SS, c - r * 0.3 * SS],
              fill=(255, 255, 255, 150))
    # mata comel (macam rujukan)
    for dx in (-0.16, 0.16):
        d.ellipse([c + (dx - 0.05) * r * SS, c - 0.05 * r * SS, c + (dx + 0.05) * r * SS, c + 0.08 * r * SS],
                  fill=INK + (255,))
    return El(ss_done(img))


def sticker_heart_button(r=55, color=None):
    color = color or PINK
    s = int(r * 2.6)
    m = Image.new("L", (s * SS, s * SS), 0)
    ImageDraw.Draw(m).polygon([(x * SS, y * SS) for x, y in heart_pts(s / 2, s / 2, r)], fill=255)
    m = puffy(m, 3 * SS)
    img = Image.new("RGBA", m.size, (0, 0, 0, 0))
    edge = Image.new("RGBA", m.size, tuple(int(c * 0.85) for c in color) + (255,))
    edge.putalpha(m)
    img.alpha_composite(edge)
    inner = m.filter(ImageFilter.MinFilter(int(r * 0.18) * 2 + 1))
    body = Image.new("RGBA", m.size, tuple(min(255, int(c * 1.04)) for c in color) + (255,))
    body.putalpha(inner)
    img.alpha_composite(body)
    d = ImageDraw.Draw(img)
    c = s * SS / 2
    hr = r * 0.11 * SS
    for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):  # 4 lubang butang
        x, y = c + dx * r * 0.2 * SS, c + dy * r * 0.2 * SS
        d.ellipse([x - hr, y - hr, x + hr, y + hr], fill=tuple(int(v * 0.7) for v in color) + (255,))
    return El(ss_done(img))


def small_heart(r=22, color=None):
    color = color or (226, 120, 135)
    s = int(r * 2.6)
    m = Image.new("L", (s * SS, s * SS), 0)
    ImageDraw.Draw(m).polygon([(x * SS, y * SS) for x, y in heart_pts(s / 2, s / 2, r)], fill=255)
    out = outline_alpha(m, 4 * SS)
    img = Image.new("RGBA", m.size, (255, 255, 255, 0))
    img.putalpha(out)
    body = Image.new("RGBA", m.size, color + (255,))
    body.putalpha(m)
    img.alpha_composite(body)
    return El(ss_done(img))


def sparkle(r=26, color=(255, 255, 255)):
    s = int(r * 2.4)
    lay = ss_canvas(s, s)
    d = ImageDraw.Draw(lay)
    c = s / 2
    pts = []
    for i in range(8):
        rr = r if i % 2 == 0 else r * 0.22
        a = math.radians(-90 + i * 45)
        pts.append(((c + rr * math.cos(a)) * SS, (c + rr * math.sin(a)) * SS))
    d.polygon(pts, fill=color + (240,))
    return El(ss_done(lay))


# ---------------------------------------------------------------- TEXT
def text_el(txt, f, fill, stroke=0, stroke_fill=None, shadow=False, protect=True):
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    bb = d.textbbox((0, 0), txt, font=f, stroke_width=stroke)
    w, h = bb[2] - bb[0] + 20, bb[3] - bb[1] + 20
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((10 - bb[0], 10 - bb[1]), txt, font=f, fill=fill,
                             stroke_width=stroke, stroke_fill=stroke_fill)
    return El(img, protect_all(img) if protect else None)


def beads(word, r=62, gap=10):
    n = len(word)
    w = n * (2 * r + gap) + 30
    h = 2 * r + 40
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    f = font("black", int(r * 1.05 * SS))
    for i, ch in enumerate(word):
        cx = (15 + r + i * (2 * r + gap)) * SS
        cy = (h / 2 + (6 if i % 2 else -6)) * SS
        rr = r * SS
        d.ellipse([cx - rr, cy - rr + 6 * SS, cx + rr, cy + rr + 6 * SS], fill=(150, 140, 130, 120))
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(236, 234, 230, 255))
        d.ellipse([cx - rr * 0.92, cy - rr * 0.95, cx + rr * 0.92, cy + rr * 0.8], fill=(252, 252, 250, 255))
        d.ellipse([cx - rr * 0.55, cy - rr * 0.8, cx - rr * 0.1, cy - rr * 0.55], fill=(255, 255, 255, 255))
        d.text((cx, cy + 2 * SS), ch, font=f, fill=INK + (255,), anchor="mm")
    img = ss_done(lay)
    return El(img, protect_all(img))


def label_chip(txt, color=None):
    """Label kecil macam pita pelabel (teks mono atas kertas kuning mentega)."""
    color = color or BUTTER
    f = font("mono", 42)
    tw = int(ImageDraw.Draw(Image.new("L", (1, 1))).textlength(txt, font=f))
    w, h = tw + 60, 74
    img = paper_texture(w, h, color, seed=len(txt), fiber=4).convert("RGBA")
    ImageDraw.Draw(img).text((w / 2, h / 2), txt, font=f, fill=INK + (255,), anchor="mm")
    img.putalpha(deckle_mask(w, h, "lr", amp=5, seed=3))
    return El(img, protect_all(img))


# ---------------------------------------------------------------- FRAMES
def photo_el(im, w, h, fx=0.5, fy=0.5, protect=False, edges=None, seed=0):
    p = cover_crop(grade(im), w, h, fx, fy).convert("RGBA")
    if edges:
        p.putalpha(deckle_mask(w, h, edges, amp=9, seed=seed))
    return El(p, protect_all(p) if protect else None)


def polaroid(im, w, caption="", fx=0.5, fy=0.45, seed=0):
    pad, bottom = int(w * 0.06), int(w * 0.24)
    ph = int((w - 2 * pad) * 1.05)
    card = paper_texture(w, ph + pad + bottom, (252, 250, 246), seed, fiber=3).convert("RGBA")
    photo = cover_crop(grade(im), w - 2 * pad, ph, fx, fy)
    card.paste(photo, (pad, pad))
    d = ImageDraw.Draw(card)
    d.rectangle([pad, pad, w - pad - 1, pad + ph - 1], outline=(0, 0, 0, 25), width=2)
    if caption:
        d.text((w / 2, pad + ph + bottom / 2), caption, font=font("serif", int(w * 0.075)),
               fill=INK + (255,), anchor="mm")
    prot = Image.new("L", card.size, 0)
    ImageDraw.Draw(prot).rectangle([pad, pad, w - pad, pad + ph + bottom], fill=255)
    return El(card, prot)


def ig_post(im, w, user, place, caption, fx=0.5, fy=0.45):
    hdr, ftr = int(w * 0.15), int(w * 0.30)
    ph = int(w * 1.25)  # 4:5
    card = Image.new("RGBA", (w, hdr + ph + ftr), (255, 255, 255, 255))
    d = ImageDraw.Draw(card)
    # header
    r = int(hdr * 0.3)
    cx, cy = int(w * 0.07), hdr // 2
    d.ellipse([cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4], outline=(232, 140, 160), width=4)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=SAGE)
    d.text((cx + r + 18, cy - 4), user, font=font("bold", int(w * 0.042)), fill=(20, 20, 20), anchor="ls")
    d.text((cx + r + 18, cy + 6), place, font=font("reg", int(w * 0.033)), fill=(90, 90, 90), anchor="lt")
    for i in range(3):
        d.ellipse([w - 60 + i * 14 - 3, cy - 3, w - 60 + i * 14 + 3, cy + 3], fill=(30, 30, 30))
    # photo
    card.paste(cover_crop(grade(im), w, ph, fx, fy), (0, hdr))
    # footer icons
    y = hdr + ph + int(ftr * 0.22)
    s = int(w * 0.05)
    lw = max(3, s // 9)
    x = int(w * 0.05)
    hp = heart_pts(x + s / 2, y + s * 0.05, s * 0.55)
    d.polygon(hp, fill=(237, 73, 86))
    x += int(s * 1.7)                                            # bubble komen
    d.ellipse([x, y - s / 2, x + s, y + s / 2], outline=(20, 20, 20), width=lw)
    d.polygon([(x + s * 0.1, y + s * 0.25), (x - s * 0.05, y + s * 0.6), (x + s * 0.35, y + s * 0.45)],
              fill=(20, 20, 20))
    x += int(s * 1.7)                                            # kapal terbang kertas
    d.polygon([(x, y - s * 0.35), (x + s, y - s * 0.5), (x + s * 0.55, y + s * 0.5)],
              outline=(20, 20, 20), width=lw)
    d.line([(x, y - s * 0.35), (x + s * 0.45, y - s * 0.05), (x + s, y - s * 0.5)], fill=(20, 20, 20),
           width=lw)
    bx = w - int(w * 0.05) - s                                   # bookmark
    d.line([(bx, y - s / 2), (bx + s * 0.8, y - s / 2), (bx + s * 0.8, y + s / 2), (bx + s * 0.4, y + s * 0.2),
            (bx, y + s / 2), (bx, y - s / 2)], fill=(20, 20, 20), width=lw, joint="curve")
    fb = font("bold", int(w * 0.036))
    d.text((int(w * 0.05), y + int(s * 0.9)), "3,100 likes", font=fb, fill=(20, 20, 20))
    d.text((int(w * 0.05), y + int(s * 1.9)), f"{user}", font=fb, fill=(20, 20, 20))
    ul = d.textlength(user + " ", font=fb)
    d.text((int(w * 0.05) + ul, y + int(s * 1.9)), caption, font=font("reg", int(w * 0.036)),
           fill=(40, 40, 40))
    prot = Image.new("L", card.size, 0)
    ImageDraw.Draw(prot).rectangle([0, 0, w, card.size[1]], fill=255)
    m = Image.new("L", card.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, card.size[1] - 1], radius=18, fill=255)
    card.putalpha(m)
    return El(card, prot)


def phone_camera(im, w, fx=0.5, fy=0.5):
    h = int(w * 2.05)
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=int(w * 0.14 * SS), fill=(24, 24, 26, 255))
    d.rounded_rectangle([5 * SS, 5 * SS, (w - 5) * SS, (h - 5) * SS], radius=int(w * 0.13 * SS),
                        outline=(70, 70, 74, 255), width=2 * SS)
    body = ss_done(lay)
    b = int(w * 0.045)
    top, bot = int(h * 0.13), int(h * 0.25)
    sw, sh = w - 2 * b, h - top - bot
    body.paste(cover_crop(grade(im), sw, sh, fx, fy), (b, top))
    d = ImageDraw.Draw(body)
    # grid kamera
    for i in (1, 2):
        d.line([(b + sw * i / 3, top), (b + sw * i / 3, top + sh)], fill=(255, 255, 255, 90), width=2)
        d.line([(b, top + sh * i / 3), (b + sw, top + sh * i / 3)], fill=(255, 255, 255, 90), width=2)
    # ikon atas
    d.rounded_rectangle([w / 2 - w * 0.14, h * 0.03, w / 2 + w * 0.14, h * 0.06], radius=20, fill=(0, 0, 0))
    for i, x in enumerate((w * 0.18, w * 0.5, w * 0.82)):
        r = w * 0.03
        d.ellipse([x - r, h * 0.09 - r, x + r, h * 0.09 + r], outline=(220, 220, 220), width=3)
    # zoom pills
    zy = top + sh - int(h * 0.05)
    for i, t in enumerate((".5", "1x", "2", "3")):
        x = w / 2 + (i - 1.5) * w * 0.13
        r = w * 0.045
        d.ellipse([x - r, zy - r, x + r, zy + r], fill=(0, 0, 0, 120))
        d.text((x, zy), t, font=font("bold", int(w * 0.035)), fill=(255, 214, 10) if t == "1x" else (240, 240, 240),
               anchor="mm")
    # mod & shutter
    my = top + sh + int(bot * 0.17)
    fm = font("bold", int(w * 0.04))
    for i, t in enumerate(("VIDEO", "PHOTO", "PORTRAIT")):
        d.text((w / 2 + (i - 1) * w * 0.3, my), t, font=fm,
               fill=(255, 214, 10) if t == "PHOTO" else (230, 230, 230), anchor="mm")
    sy = top + sh + int(bot * 0.55)
    r = w * 0.1
    d.ellipse([w / 2 - r - 8, sy - r - 8, w / 2 + r + 8, sy + r + 8], outline=(255, 255, 255), width=6)
    d.ellipse([w / 2 - r, sy - r, w / 2 + r, sy + r], fill=(255, 255, 255))
    t = w * 0.07
    d.rounded_rectangle([w * 0.16 - t, sy - t, w * 0.16 + t, sy + t], radius=10, fill=SAGE)
    d.ellipse([w * 0.84 - t, sy - t, w * 0.84 + t, sy + t], fill=(60, 60, 64))
    prot = Image.new("L", body.size, 0)
    ImageDraw.Draw(prot).rectangle([0, 0, w, h], fill=255)
    return El(body, prot)


def cutout(path, height, model="u2net_human_seg", outline=12, person=True):
    im = load_photo(path)
    m = rembg_mask(path, model)
    big = upscale(im, target_w=m.size[0]).resize(m.size, RS.LANCZOS)
    big = grade(big)
    a = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    bb = a.point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bb:
        raise RuntimeError(f"rembg tak jumpa subjek dalam {path.name}")
    big, a = big.crop(bb), a.crop(bb)
    f = height / big.size[1]
    size = (int(big.size[0] * f), height)
    big = upscale(big, *size).resize(size, RS.LANCZOS)
    a = a.resize(size, RS.LANCZOS)
    pad = outline + 4
    W, H = size[0] + 2 * pad, size[1] + 2 * pad
    alpha = Image.new("L", (W, H), 0)
    alpha.paste(a, (pad, pad))
    img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    if outline:
        img.putalpha(outline_alpha(alpha, outline))       # garisan putih sticker
    subj = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    subj.paste(big, (pad, pad))
    subj.putalpha(alpha)
    img.alpha_composite(subj)
    prot = Image.new("L", (W, H), 0)
    if person:
        # muka: guna Haar; kalau tak jumpa, lindungi bahagian kepala (atas ~24% subjek)
        crop_im = load_photo(path).crop(tuple(int(v * im.size[0] / m.size[0]) for v in bb))
        faces = detect_faces(crop_im)
        pd = ImageDraw.Draw(prot)
        sx = size[0] / crop_im.size[0]
        sy = size[1] / crop_im.size[1]
        for (x0, y0, x1, y1) in faces:
            pd.rectangle([pad + x0 * sx, pad + y0 * sy, pad + x1 * sx, pad + y1 * sy], fill=255)
        ah = np.asarray(alpha) > 128
        rows = np.where(ah.any(1))[0]
        if len(rows):
            head_end = rows[0] + int((rows[-1] - rows[0]) * 0.17)
            band = (ah[rows[0]:head_end].any(0))
            cols = np.where(band)[0]
            if len(cols):
                pd.rectangle([cols[0], rows[0], cols[-1], head_end], fill=255)
    return El(img, prot)


# ---------------------------------------------------------------- COMPOSER
class Canvas:
    def __init__(self, n):
        self.n = n
        self.W, self.H = n * SLIDE_W, SLIDE_H
        self.img = paper_texture(self.W, self.H, CREAM, seed=SEED, fiber=5).convert("RGBA")
        self.prot = Image.new("L", (self.W, self.H), 0)
        self.seams = [SLIDE_W * i for i in range(1, n)]
        self.log = []

    def _bad_cols(self, el, x):
        cols = np.where(np.asarray(el.prot).any(0))[0]
        if not len(cols):
            return False
        c0, c1 = x + cols[0], x + cols[-1]
        return any(c0 - SEAM_MARGIN < s < c1 + SEAM_MARGIN for s in self.seams)

    def put(self, el, x, y, shadow=0.28, blur=16, off=(10, 16), avoid=True, name=""):
        """Letak elemen. x,y = tengah elemen. Kalau kawasan 'protect' kena garis potong,
        anjak mendatar sedikit demi sedikit sampai selamat."""
        w, h = el.size
        x0, y0 = int(x - w / 2), int(y - h / 2)
        if avoid and self._bad_cols(el, x0):
            for d in range(10, 600, 10):
                for s in (d, -d):
                    if not self._bad_cols(el, x0 + s):
                        self.log.append(f"  anjak '{name}' {s:+d}px supaya tak kena garis potong")
                        x0 += s
                        break
                else:
                    continue
                break
        if shadow:
            a = el.img.split()[-1]
            sh = Image.new("RGBA", (w + 4 * blur, h + 4 * blur), (0, 0, 0, 0))
            sa = Image.new("L", sh.size, 0)
            sa.paste(a, (2 * blur, 2 * blur))
            sa = sa.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * shadow))
            col = Image.new("RGBA", sh.size, (70, 55, 45, 255))
            col.putalpha(sa)
            self._paste_clip(col, x0 - 2 * blur + off[0], y0 - 2 * blur + off[1])
        self._paste_clip(el.img, x0, y0)
        p = Image.new("L", (self.W, self.H), 0)
        p.paste(el.prot, (x0, y0))
        self.prot = ImageChops.lighter(self.prot, p)
        return x0 + w / 2, y0 + h / 2

    def _paste_clip(self, im, x, y):
        layer = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        layer.paste(im, (x, y))
        self.img.alpha_composite(layer)

    def check_seams(self):
        p = np.asarray(self.prot) > 0
        bad = []
        for i, s in enumerate(self.seams):
            if p[:, max(0, s - SEAM_MARGIN):s + SEAM_MARGIN].any():
                bad.append(i + 1)
        return bad

    def finish(self):
        rgb = self.img.convert("RGB")
        rng = np.random.default_rng(SEED)
        a = np.asarray(rgb).astype(np.float32)
        a += rng.normal(0, 3.2, a.shape[:2])[..., None]   # grain seragam
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- LAYOUT
def build(n, P):
    """Susun semua elemen atas kanvas panjang. Koordinat = tengah elemen."""
    rng = random.Random(SEED)
    c = Canvas(n)
    S, H = SLIDE_W, SLIDE_H
    bg, cut, obj, pol = P["bg"], P["cutout"], P.get("object", []), P["polaroid"]
    L = lambda p: load_photo(p)

    def ox(i):
        return S * i

    # --- latar bersambung: jalur kertas corak di belakang ---
    c.put(paper_panel("dots", 900, 460, seed=11, edges="lrb"), ox(0) + 470, 205, shadow=0.15)
    if n > 1:
        c.put(paper_panel("hearts", 1060, 1000, seed=12), ox(1) + 560, 640, shadow=0.18, avoid=False)

    # ===== SLIDE 1 : cover =====
    c.put(photo_el(L(bg[0]), 1340, 960, fx=0.5, fy=0.62, edges="tr", seed=3),
          ox(0) + 670, H - 470, shadow=0.25, avoid=False)
    c.put(text_el(TEXT["headline"], font("black", 150), BUTTER + (255,), stroke=6, stroke_fill=INK + (255,)),
          ox(0) + 520, 150, shadow=0.2, blur=8, off=(6, 8))
    c.put(beads(TEXT["beads"], r=58), ox(0) + 520, 300, shadow=0.18, blur=10)
    c.put(paper_clip(190).rotate(-28), ox(0) + 85, 330, shadow=0.25, blur=6, off=(5, 7), avoid=False)
    c.put(sticker_star(52).rotate(14), ox(0) + 965, 240, shadow=0.25, blur=8, avoid=False)
    c.put(sticker_heart_button(40).rotate(-12), ox(0) + 140, 470, shadow=0.25, blur=8, avoid=False)
    lab = text_el(TEXT["label"], font("mono", 46), BUTTER + (255,), stroke=3, stroke_fill=INK + (255,))
    c.put(lab, ox(0) + 330, H - 90, shadow=0.2, blur=6, off=(4, 5))
    if n > 1:
        # cutout besar merentas slide 1 -> 2 (badan sahaja kena garis; kepala dilindungi)
        c.put(cutout(cut[0], 900).rotate(2), ox(1) - 150, H - 455, shadow=0.3, blur=14, name="cutout1")
        c.put(washi(260, seed=1).rotate(-8), ox(1) + 20, 520, shadow=0.1, blur=5, avoid=False)

    # ===== SLIDE 2 : post IG =====
    if n > 1:
        ig = ig_post(L(P["ig"][0]), 600, TEXT["ig_user"], TEXT["ig_place"], TEXT["ig_caption"], fy=0.5)
        c.put(ig.rotate(-4), ox(1) + 610, 620, shadow=0.3, blur=18, name="ig")
        c.put(small_heart(24).rotate(10), ox(1) + 950, 160, shadow=0.2, blur=5, avoid=False)
        c.put(small_heart(17).rotate(-15), ox(1) + 1000, 230, shadow=0.2, blur=5, avoid=False)
        c.put(sparkle(30), ox(1) + 250, 120, shadow=0, avoid=False)

    # ===== SLIDE 3 : latar separuh + polaroid =====
    if n > 2:
        c.put(lace(1400, 74).rotate(0), ox(2) - 50, 64, shadow=0.15, blur=6, avoid=False)
        # latar berkabus merentas garis 3 -> 4 (orang kecil kekal di slide 3)
        c.put(photo_el(L(bg[1]), 980, 1180, fx=0.45, fy=0.42, edges="lrtb", seed=5).rotate(1.2),
              ox(2) + 840, 720, shadow=0.25, avoid=False)
        c.put(polaroid(L(pol[0]), 470, TEXT["polaroid"][0], fy=0.55, seed=4).rotate(-5),
              ox(2) + 300, 600, shadow=0.32, blur=16, name="polaroid1")
        c.put(washi(190, color=SAGE, seed=2).rotate(4), ox(2) + 300, 290, shadow=0.1, blur=5, avoid=False)
        c.put(sticker_star(46, PINK).rotate(-18), ox(2) - 10, 1150, shadow=0.25, blur=8, avoid=False)
        c.put(small_heart(18).rotate(12), ox(2) + 60, 1240, shadow=0.2, blur=5, avoid=False)
    if n > 3:
        c.put(cutout(cut[1], 940), ox(3) + 130, H - 490, shadow=0.3, blur=14, name="cutout2")

    # ===== SLIDE 4 : skrin kamera =====
    if n > 3:
        c.put(paper_panel("grid", 640, 1210, seed=13, edges="lrtb").rotate(-1.5), ox(3) + 720, 690,
              shadow=0.15, avoid=False)
        # latar rumah kaca merentas garis 4 -> 5
        c.put(photo_el(L(bg[2]), 780, 900, fx=0.5, fy=0.5, edges="lrtb", seed=7).rotate(-2.5),
              ox(3) + 850, 470, shadow=0.25, avoid=False)
        ph = phone_camera(L(P["phone"][0]), 430, fy=0.4)
        c.put(ph.rotate(4), ox(3) + 640, 820, shadow=0.35, blur=18, name="phone")
        c.put(label_chip(TEXT["phone_note"].upper()).rotate(-5), ox(3) + 470, 1290, shadow=0.2, blur=6,
              off=(4, 6), name="note")
        c.put(paper_clip(170, color=(170, 180, 190)).rotate(15), ox(3) + 920, 130, shadow=0.25, blur=6,
              off=(5, 7), avoid=False)

    # ===== SLIDE 5 : objek + polaroid + penutup =====
    if n > 4:
        c.put(polaroid(L(pol[1]), 400, TEXT["polaroid"][1], seed=6).rotate(-6), ox(4) + 330, 400,
              shadow=0.3, name="polaroid2")
        c.put(polaroid(L(pol[2]), 380, TEXT["polaroid"][2], fy=0.6, seed=8).rotate(7), ox(4) + 760, 470,
              shadow=0.3, name="polaroid3")
        c.put(washi(180, seed=3).rotate(30), ox(4) + 200, 150, shadow=0.1, blur=5, avoid=False)
        c.put(sticker_heart_button(46).rotate(10), ox(4) + 930, 180, shadow=0.25, blur=8, avoid=False)
        if obj:
            # objek di hujung kanan: kalau objek terpotong dalam gambar asal, tepi lurusnya
            # jatuh tepat di tepi kanan slide terakhir
            ob = cutout(obj[0], 470, model="u2net", outline=10, person=False)
            c.put(ob, ox(4) + S - ob.size[0] / 2 + 30, H - 250, shadow=0.32, blur=14, avoid=False)
        c.put(text_el(TEXT["outro"], font("serif", 72), INK + (255,)).rotate(3), ox(4) + 400, 930, shadow=0,
              name="outro")
        c.put(small_heart(28), ox(4) + 760, 905, shadow=0.2, blur=5, avoid=False)
        c.put(sparkle(34), ox(4) + 980, 760, shadow=0, avoid=False)
        c.put(sticker_star(40).rotate(-10), ox(4) + 170, 1150, shadow=0.25, blur=8, avoid=False)
        c.put(washi(220, color=SAGE, seed=4).rotate(-12), ox(4) + 380, 1230, shadow=0.1, blur=5, avoid=False)

    # slide tambahan (SLIDES > 5): ulang corak polaroid + latar
    for i in range(5, n):
        c.put(photo_el(L(bg[i % len(bg)]), 760, 1100, edges="lrtb", seed=20 + i).rotate(rng.uniform(-3, 3)),
              ox(i) + 420, 680, shadow=0.25, avoid=False)
        c.put(polaroid(L(pol[i % len(pol)]), 430, seed=30 + i).rotate(rng.uniform(-7, 7)),
              ox(i) + 700, 760, shadow=0.3, name=f"polaroid_{i}")
        c.put(sticker_star(40).rotate(rng.uniform(-20, 20)), ox(i) + 180, 220, shadow=0.25, blur=8, avoid=False)
    return c


# ---------------------------------------------------------------- MAIN
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photos", nargs="?", default=str(PHOTO_DIR))
    ap.add_argument("--slides", type=int, default=SLIDES)
    ap.add_argument("--out", default=str(OUT_DIR))
    a = ap.parse_args()
    n = max(2, a.slides)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    P = resolve_picks(Path(a.photos))
    for k, v in P.items():
        print(f"{k:9s}: {', '.join(p.name for p in v)}")
    small = [p.name for v in P.values() for p in v if max(Image.open(p).size) < 1200]
    if small:
        print(f"AMARAN: {len(set(small))} gambar resolusi rendah (<1200px), hasil akan nampak lembut. "
              "Guna gambar asal dari telefon untuk hasil tajam.")
    derive_palette(P["bg"])

    c = build(n, P)
    for line in c.log:
        print(line)
    bad = c.check_seams()
    print("Semakan garis potong:", "OK, tiada muka/teks atas garis" if not bad
          else f"MASALAH di garis selepas slide {bad}")

    final = c.finish()
    for i in range(n):
        final.crop((i * SLIDE_W, 0, (i + 1) * SLIDE_W, SLIDE_H)).save(
            out / f"slide_{i + 1:02d}.jpg", quality=JPEG_QUALITY, subsampling=0)

    # preview: kanvas penuh + tanda garis potong di luar gambar (atas & bawah)
    band = 36
    scale = 0.5
    pw, ph_ = int(c.W * scale), int(c.H * scale)
    prev = Image.new("RGB", (pw, ph_ + 2 * band), (40, 40, 40))
    prev.paste(final.resize((pw, ph_), RS.LANCZOS), (0, band))
    d = ImageDraw.Draw(prev)
    for i in range(n):
        d.text((int((i + 0.5) * SLIDE_W * scale), band // 2), f"{i + 1}", font=font("bold", 22),
               fill=(230, 230, 230), anchor="mm")
    for s in c.seams:
        x = int(s * scale)
        d.polygon([(x - 9, 4), (x + 9, 4), (x, band - 4)], fill=(255, 90, 110))
        d.polygon([(x - 9, ph_ + 2 * band - 4), (x + 9, ph_ + 2 * band - 4), (x, ph_ + band + 4)],
                  fill=(255, 90, 110))
    prev.save(out / "preview_strip.jpg", quality=92)
    print(f"Siap: {out}/slide_01..{n:02d}.jpg + preview_strip.jpg")


if __name__ == "__main__":
    main()
