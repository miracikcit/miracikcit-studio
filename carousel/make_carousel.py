#!/usr/bin/env python3
"""
make_carousel.py : carousel Instagram "seamless" gaya scrapbook (gambar + cutout sahaja, tiada tulisan).

Satu kanvas panjang (SLIDES x 1080) x 1350 dipotong jadi slide 4:5.
Elemen diletak merentas garis potong supaya bersambung bila swipe:
  - latar foto (koyak tepi) & kertas corak
  - "pop-out zoom": orang dipotong (rembg) dan keluar dari bingkai foto / polaroid / skrin telefon
  - bulatan zoom: kawasan kecil dalam foto dibesarkan dalam bulatan, dengan garis penyambung
  - cutout belakang (tanpa muka) yang melintas garis slide
  - hiasan scrapbook dilukis dengan code (boleh tutup: DECOR = False)
Warna semua gambar ditingkatkan (enhance): white balance, kontras, vibrance, kejelasan.

Guna:
    _carousel_tools/venv/bin/python make_carousel.py [folder_gambar] [--slides N]

Gambar asal tak diubah. Hasil: output/slide_01.jpg ... + output/preview_strip.jpg
Kalau fail dalam PICKS tiada, script pilih sendiri (lihat auto_picks).
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
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

# ---------------------------------------------------------------- SETTINGS
SLIDES = 5
SLIDE_W, SLIDE_H = 1080, 1350
JPEG_QUALITY = 95
SEED = 7                      # tukar untuk susunan hiasan lain
SEAM_MARGIN = 45              # px: muka mesti jauh sekurang-kurangnya ini dari garis potong
DECOR = True                  # False = gambar & cutout sahaja, tanpa sticker/pita
ENHANCE = 0.8                 # kekuatan tingkatkan warna (0 = asal, 1 = biasa, 1.5 = kuat)

HERE = Path(__file__).resolve().parent
PHOTO_DIR = HERE / "photos"
OUT_DIR = HERE / "output"
CACHE_DIR = HERE / "_carousel_tools" / "cache"

# Pilihan gambar (nama fail dalam PHOTO_DIR). Kosongkan {} untuk auto.
PICKS = {
    "hero":     ["fam_stroller.jpg"],                 # slide 1: pop-out dari bingkai foto besar
    "popout":   ["fam_couple.jpg", "fam_boys.jpg"],   # pop-out dari polaroid & skrin telefon
    "zoom":     ["fam_mushroom.jpg"],                 # foto besar + bulatan zoom si kecil
    "scene":    ["awana2_p3.jpg", "eufloria_p6.jpg"],  # latar koyak merentas garis
    "backcut":  ["awana2_p2.jpg"],                    # cutout dari belakang, melintas garis
    "polaroid": ["awana1_p3.jpg", "eufloria_p7.jpg", "awana2_p0.jpg", "awana2_p1.jpg", "awana1_p7.jpg"],
}
# Gambar yang orangnya bertindih dengan pokok/latar sewarna: buang latar di atas paras bahu
TRIM_ABOVE_HEADS = {"fam_stroller.jpg"}

# Warna asas
CREAM = (247, 243, 235)
INK = (58, 52, 46)
PINK = (241, 190, 196)
BUTTER = (247, 224, 130)
SAGE = (168, 196, 160)

RS = Image.Resampling


# ---------------------------------------------------------------- ELEMENT
class El:
    """Gambar RGBA + topeng 'protect' (muka yang tak boleh kena garis potong)."""

    def __init__(self, img, prot=None):
        self.img = img.convert("RGBA")
        self.prot = prot if prot is not None else Image.new("L", self.img.size, 0)

    def rotate(self, deg):
        if not deg:
            return self
        return El(self.img.rotate(deg, resample=RS.BICUBIC, expand=True),
                  self.prot.rotate(deg, resample=RS.NEAREST, expand=True))

    @property
    def size(self):
        return self.img.size


def protect_all(img, inset=0):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rectangle([inset, inset, img.size[0] - inset, img.size[1] - inset], fill=255)
    return m


# ---------------------------------------------------------------- PHOTO PREP
_photo_cache = {}


def load_photo(path):
    key = str(path)
    if key not in _photo_cache:
        _photo_cache[key] = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return _photo_cache[key]


def enhance(im, k=None):
    """Tingkatkan warna: white balance separa, lengkung S, vibrance, sedikit hangat, kejelasan."""
    k = ENHANCE if k is None else k
    if k <= 0:
        return im
    a = np.asarray(im).astype(np.float32) / 255.0
    m = a.reshape(-1, 3).mean(0)
    a *= 1 + 0.3 * k * (m.mean() / np.maximum(m, 1e-3) - 1)            # white balance
    lo, hi = np.percentile(a, 0.2), np.percentile(a, 99.8)              # regang tonal
    a = np.clip((a - lo) / max(hi - lo, 1e-3), 0, 1)
    a = a - 0.16 * k * np.sin(2 * np.pi * a) / (2 * np.pi)              # lengkung S
    hsv = cv2.cvtColor(np.clip(a, 0, 1), cv2.COLOR_RGB2HSV)
    s = hsv[..., 1]
    hsv[..., 1] = np.clip(s + 0.55 * k * s * (1 - s) + 0.04 * k * s, 0, 1)  # vibrance
    a = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    a[..., 0] *= 1 + 0.025 * k
    a[..., 2] *= 1 - 0.02 * k
    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    r = max(4, int(max(im.size) / 160))
    return out.filter(ImageFilter.UnsharpMask(radius=r, percent=int(14 * k), threshold=4))


def upscale(im, target_w=None, target_h=None):
    w, h = im.size
    f = max((target_w or 0) / w, (target_h or 0) / h, 1e-9)
    if f <= 1:
        return im.resize((max(1, round(w * f)), max(1, round(h * f))), RS.LANCZOS)
    out = im
    while f > 1.0:
        step = min(f, 2.0)
        out = out.resize((round(out.size[0] * step), round(out.size[1] * step)), RS.LANCZOS)
        f /= step
    return out.filter(ImageFilter.UnsharpMask(radius=2, percent=35, threshold=3))


def fit(im, w, h):
    return upscale(im, w, h).resize((w, h), RS.LANCZOS)


def cover_crop(im, w, h, fx=0.5, fy=0.5):
    iw, ih = im.size
    s = max(w / iw, h / ih)
    cw, ch = w / s, h / s
    x0 = min(max(0, iw * fx - cw / 2), iw - cw)
    y0 = min(max(0, ih * fy - ch / 2), ih - ch)
    return fit(im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))), w, h)


_enh_cache = {}


def photo(path):
    """Gambar yang sudah di-enhance (cache)."""
    key = str(path)
    if key not in _enh_cache:
        _enh_cache[key] = enhance(load_photo(path))
    return _enh_cache[key]


# ---------------------------------------------------------------- ANALYSIS (rembg + muka)
_sessions = {}


def rembg_mask(path, model="u2net_human_seg"):
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
    m = remove(big, session=_sessions[model], post_process_mask=True).split()[-1]
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
    g = cv2.cvtColor(np.asarray(im.resize((int(im.size[0] * f), int(im.size[1] * f)))), cv2.COLOR_RGB2GRAY)
    g = cv2.equalizeHist(g)
    boxes = []
    for c in _face_cascades:
        for flip in (False, True):
            gg = cv2.flip(g, 1) if flip else g
            for (x, y, w, h) in c.detectMultiScale(gg, 1.1, 5, minSize=(24, 24)):
                if flip:
                    x = gg.shape[1] - x - w
                boxes.append((x / f, y / f, (x + w) / f, (y + h) / f))
    # buang pendua
    out = []
    for b in sorted(boxes, key=lambda b: -(b[2] - b[0])):
        if all(abs((b[0] + b[2]) / 2 - (o[0] + o[2]) / 2) > (o[2] - o[0]) * 0.5 or
               abs((b[1] + b[3]) / 2 - (o[1] + o[3]) / 2) > (o[3] - o[1]) * 0.5 for o in out):
            out.append(b)
    return out


_mask_cache = {}


def person_mask(path):
    """Topeng orang (L, saiz gambar asal), dibersihkan. Untuk TRIM_ABOVE_HEADS: latar di atas bahu dibuang."""
    key = str(path)
    if key in _mask_cache:
        return _mask_cache[key]
    im = load_photo(path)
    a = np.asarray(rembg_mask(path).resize(im.size, RS.BILINEAR)) > 128
    faces = [f for f in detect_faces(im) if a[int((f[1] + f[3]) / 2), int((f[0] + f[2]) / 2)]]
    if Path(path).name in TRIM_ABOVE_HEADS and faces:
        cut = min(f[3] + 0.3 * (f[3] - f[1]) for f in faces)
        keep = Image.new("L", im.size, 0)
        d = ImageDraw.Draw(keep)
        d.rectangle([0, cut, im.size[0], im.size[1]], fill=255)
        for x0, y0, x1, y1 in faces:  # bentuk kepala ketat: tengkorak + muka + leher
            w, h = x1 - x0, y1 - y0
            cx = (x0 + x1) / 2
            d.ellipse([cx - 0.6 * w, y0 - 0.32 * h, cx + 0.6 * w, y0 + 0.9 * h], fill=255)
            d.rectangle([x0 + 0.04 * w, y0 + 0.3 * h, x1 - 0.04 * w, y1], fill=255)
            d.rectangle([x0 + 0.18 * w, y1 - 0.1 * h, x1 - 0.18 * w, max(y1, cut) + 2], fill=255)
        rgb = np.asarray(im).astype(np.float32)
        R, G, B = rgb[..., 0] + 1, rgb[..., 1], rgb[..., 2]
        foliage = ((G < 0.5 * R) & (B < 0.55 * R) & (R > 32)) | ((G > R * 1.05) & (G > B))
        yy = np.arange(im.size[1])[:, None]
        a = a & (np.asarray(keep) > 0) & ~(foliage & (yy < cut))
    m = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:  # simpan komponen besar sahaja
        big = st[1:, cv2.CC_STAT_AREA].max()
        m = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.08 * big]).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = cv2.medianBlur(m * 255, 9)
    res = (Image.fromarray(m), faces)
    _mask_cache[key] = res
    return res


def person_bbox(path):
    m, _ = person_mask(path)
    return m.point(lambda v: 255 if v > 128 else 0).getbbox()


def popout_window(path, aspect, head_frac=0.17, widen=1.55):
    """Tetingkap bingkai (x0,y0,x1,y1) supaya kepala keluar di atas bingkai.
    aspect = lebar/tinggi tetingkap."""
    im = load_photo(path)
    W, H = im.size
    bx0, by0, bx1, by1 = person_bbox(path)
    bw, bh = bx1 - bx0, by1 - by0
    top = by0 + head_frac * bh
    w = bw * widen
    h = w / aspect
    need = (by1 - top) * 1.08
    if h < need:
        h = need
        w = h * aspect
    cx = (bx0 + bx1) / 2
    x0 = min(max(0, cx - w / 2), W - w)
    x0 = max(0, x0)
    w = min(w, W)
    y1 = min(H, top + h)
    return (x0, top, x0 + w, y1)


def zoom_target(path):
    """Muka paling bawah (biasanya si kecil) dalam topeng orang -> (cx, cy, r)."""
    _, faces = person_mask(path)
    if not faces:
        bx0, by0, bx1, by1 = person_bbox(path)
        return ((bx0 + bx1) / 2, by0 + (by1 - by0) * 0.2, (bx1 - bx0) * 0.25)
    f = max(faces, key=lambda b: (b[1] + b[3]) / 2)
    w = f[2] - f[0]
    return ((f[0] + f[2]) / 2, (f[1] + f[3]) / 2 + 0.55 * w, 1.75 * w)


# ---------------------------------------------------------------- PAPER BASE
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


# ---------------------------------------------------------------- FRAMES (tanpa tulisan)
def frame_print(iw, ih, seed=0):
    """Cetakan foto bersempadan putih, tepi koyak halus."""
    b = int(iw * 0.045)
    w, h = iw + 2 * b, ih + 2 * b
    card = paper_texture(w, h, (252, 251, 248), seed, fiber=3).convert("RGBA")
    card.putalpha(deckle_mask(w, h, "lrtb", amp=4, seed=seed))
    return card, (b, b, b + iw, b + ih)


def frame_polaroid(iw, ih, seed=0):
    pad, bottom = int(iw * 0.065), int(iw * 0.26)
    w, h = iw + 2 * pad, ih + pad + bottom
    card = paper_texture(w, h, (252, 250, 246), seed, fiber=3).convert("RGBA")
    return card, (pad, pad, pad + iw, pad + ih)


def frame_phone(iw, ih, seed=0):
    b = int(iw * 0.05)
    top, bot = int(ih * 0.12), int(ih * 0.27)
    w, h = iw + 2 * b, ih + top + bot
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    d.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=int(w * 0.15 * SS), fill=(26, 26, 28, 255))
    d.rounded_rectangle([5 * SS, 5 * SS, (w - 5) * SS, (h - 5) * SS], radius=int(w * 0.14 * SS),
                        outline=(78, 78, 82, 255), width=2 * SS)
    body = ss_done(lay)
    d = ImageDraw.Draw(body)
    d.rounded_rectangle([w / 2 - w * 0.15, top * 0.28, w / 2 + w * 0.15, top * 0.58], radius=40, fill=(0, 0, 0))
    for x in (w * 0.18, w * 0.82):                                 # ikon bulat (tanpa tulisan)
        r = w * 0.032
        d.ellipse([x - r, top * 0.72 - r, x + r, top * 0.72 + r], outline=(215, 215, 215), width=3)
    sy = top + ih + bot * 0.5                                      # shutter
    r = w * 0.105
    d.ellipse([w / 2 - r - 9, sy - r - 9, w / 2 + r + 9, sy + r + 9], outline=(255, 255, 255), width=6)
    d.ellipse([w / 2 - r, sy - r, w / 2 + r, sy + r], fill=(255, 255, 255))
    t = w * 0.075
    d.rounded_rectangle([w * 0.17 - t, sy - t, w * 0.17 + t, sy + t], radius=10, fill=SAGE)
    d.ellipse([w * 0.83 - t, sy - t, w * 0.83 + t, sy + t], fill=(62, 62, 66))
    for i in range(5):                                             # titik mod kamera
        x = w / 2 + (i - 2) * w * 0.09
        rr = 7 if i == 2 else 4
        d.ellipse([x - rr, top + ih + bot * 0.17 - rr, x + rr, top + ih + bot * 0.17 + rr],
                  fill=(255, 214, 10) if i == 2 else (150, 150, 150))
    return body, (b, top, b + iw, top + ih)


FRAMES = {"print": frame_print, "polaroid": frame_polaroid, "phone": frame_phone}


def framed(path, kind, inner_w, window=None, aspect=None, seed=0, protect="person"):
    """Foto dalam bingkai. Pulangkan (El, info) di mana info memetakan koordinat gambar -> elemen."""
    im = photo(path)
    if window is None:
        window = (0, 0, im.size[0], im.size[1])
    x0, y0, x1, y1 = window
    if aspect:  # paksa nisbah dengan memotong tengah tetingkap
        ww, hh = x1 - x0, y1 - y0
        if ww / hh > aspect:
            nw = hh * aspect
            x0, x1 = x0 + (ww - nw) / 2, x0 + (ww + nw) / 2
        else:
            nh = ww / aspect
            y0, y1 = y0 + (hh - nh) / 2, y0 + (hh + nh) / 2
    s = inner_w / (x1 - x0)
    inner_h = round((y1 - y0) * s)
    card, box = FRAMES[kind](inner_w, inner_h, seed)
    card.paste(fit(im.crop((int(x0), int(y0), int(x1), int(y1))), inner_w, inner_h), box[:2])
    prot = Image.new("L", card.size, 0)
    if protect == "all":
        prot = protect_all(card)
    elif protect == "person":
        m, faces = person_mask(path)
        pm = m.crop((int(x0), int(y0), int(x1), int(y1))).resize((inner_w, inner_h), RS.NEAREST)
        pd = ImageDraw.Draw(pm)
        for f in detect_faces(load_photo(path)):  # muka yang rembg terlepas
            pd.rectangle([(f[0] - x0) * s, (f[1] - y0) * s, (f[2] - x0) * s, (f[3] - y0) * s], fill=255)
        pm = Image.fromarray(cv2.dilate(np.asarray(pm), np.ones((25, 25), np.uint8)))
        prot.paste(pm, box[:2])
    info = dict(s=s, ox=box[0] - x0 * s, oy=box[1] - y0 * s, box=box, window=(x0, y0, x1, y1))
    return El(card, prot), info


def loose_mask(m, frac):
    """Cutout 'longgar': bentuk licin yang lebih besar dari badan (termasuk sedikit latar).
    Tepi jadi tajam & licin, dan celah kecil (lengan yang rembg terlepas) tertutup."""
    bb = m.point(lambda v: 255 if v > 128 else 0).getbbox()
    bh = bb[3] - bb[1]
    L = max(6, int(bh * frac))                 # jarak dari badan
    K = max(9, int(bh * frac * 2.6)) | 1       # tutup celah antara bahagian badan
    a = (np.asarray(m) > 128).astype(np.uint8)
    pad = K + L
    a = cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, 0)
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (K, K)))
    a = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * L + 1, 2 * L + 1)))
    ff = a.copy()                              # isi lubang
    cv2.floodFill(ff, np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8), (0, 0), 1)
    a = a | (1 - ff)
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), L * 0.8)
    a = (a > 0.5).astype(np.uint8) * 255
    a = a[pad:-pad, pad:-pad]
    return Image.fromarray(a).filter(ImageFilter.GaussianBlur(1.0))


def popout(path, kind, inner_w, aspect, seed=0, outline=11, head_frac=0.17, loose=0.0):
    """Pop-out zoom: orang dipotong dan keluar dari atas bingkai (kepala di luar bingkai).
    loose > 0 : cutout longgar (contoh 0.035 = jarak ~3.5% tinggi badan dari tepi badan)."""
    win = popout_window(path, aspect, head_frac=head_frac)
    el, info = framed(path, kind, inner_w, window=win, aspect=aspect, seed=seed, protect="all")
    s, ox, oy, box = info["s"], info["ox"], info["oy"], info["box"]
    im = photo(path)
    m, _ = person_mask(path)
    if loose:
        m = loose_mask(m, loose)
    bx0, by0, bx1, by1 = m.point(lambda v: 255 if v > 128 else 0).getbbox()
    # kedudukan subjek dalam koordinat elemen
    sx0, sy0 = ox + bx0 * s, oy + by0 * s
    sx1 = ox + bx1 * s
    padT = max(0, int(-sy0) + outline + 6)
    padL = max(0, int(-sx0) + outline + 6)
    padR = max(0, int(sx1 - el.size[0]) + outline + 6)
    W, H = el.size[0] + padL + padR, el.size[1] + padT
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(el.img, (padL, padT))
    # lapisan subjek (seluruh gambar diskala sama, hanya di atas garis bawah tetingkap)
    crop_box = (int(bx0), int(by0), int(bx1), int(by1))
    sw, sh = max(1, round((bx1 - bx0) * s)), max(1, round((by1 - by0) * s))
    subj = fit(im.crop(crop_box), sw, sh).convert("RGBA")
    a = m.crop(crop_box).resize((sw, sh), RS.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    px, py = round(sx0) + padL, round(sy0) + padT
    lim = Image.new("L", (sw, sh), 0)                    # potong di bawah garis bawah tetingkap
    cut_y = box[3] + padT - py
    ImageDraw.Draw(lim).rectangle([0, 0, sw, max(0, cut_y)], fill=255)
    a = ImageChops.multiply(a, lim)
    full_a = Image.new("L", (W, H), 0)
    full_a.paste(a, (px, py))
    outside = Image.new("L", (W, H), 255)                # garisan putih hanya di luar tetingkap
    ImageDraw.Draw(outside).rectangle([box[0] + padL + outline, box[1] + padT + outline,
                                       box[2] + padL - outline, box[3] + padT], fill=0)
    # garisan hanya untuk bahagian besar yang terkeluar (elak tompok putih kecil di tepi tetingkap)
    out_part = np.asarray(ImageChops.multiply(full_a, outside)) > 100
    nlab, lab, st, _ = cv2.connectedComponentsWithStats(out_part.astype(np.uint8))
    keep = np.isin(lab, [i for i in range(1, nlab) if st[i, cv2.CC_STAT_AREA] > 2500])
    keep = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    big = Image.fromarray((keep * 255).astype(np.uint8))
    ol = ImageChops.multiply(outline_alpha(big, outline), outside.filter(ImageFilter.GaussianBlur(outline / 2)))
    white = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    white.putalpha(ol)
    # bayang lembut subjek atas bingkai
    sh_a = full_a.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.25))
    shadow = Image.new("RGBA", (W, H), (60, 45, 35, 0))
    shadow.putalpha(ImageChops.multiply(sh_a, outside))
    base.alpha_composite(shadow, (6, 10))
    base.alpha_composite(white)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(subj, (px, py))
    layer.putalpha(full_a)
    base.alpha_composite(layer)
    prot = protect_all(base)
    return El(base, prot)


def tangent_lines(c1, r1, c2, r2):
    dx, dy = c2[0] - c1[0], c2[1] - c1[1]
    d = math.hypot(dx, dy)
    th = math.atan2(dy, dx)
    al = math.acos(max(-1, min(1, (r1 - r2) / d)))
    out = []
    for sgn in (1, -1):
        a = th + sgn * al
        out.append(((c1[0] + r1 * math.cos(a), c1[1] + r1 * math.sin(a)),
                    (c2[0] + r2 * math.cos(a), c2[1] + r2 * math.sin(a))))
    return out


def print_with_zoom(path, inner_w, aspect, bubble_r, bubble_off, kind="print", seed=0, widen=2.2,
                    target=None):
    """Foto dalam bingkai + bulatan zoom (besarkan si kecil) dengan garis penyambung."""
    bx0, by0, bx1, by1 = person_bbox(path)
    im = photo(path)
    cx = (bx0 + bx1) / 2
    w = (bx1 - bx0) * widen
    h = w / aspect
    cy = (by0 + by1) / 2
    win = (max(0, cx - w / 2), max(0, cy - h / 2), min(im.size[0], cx + w / 2), min(im.size[1], cy + h / 2))
    el, info = framed(path, kind, inner_w, window=win, aspect=aspect, seed=seed, protect="person")
    s, ox, oy = info["s"], info["ox"], info["oy"]
    tx, ty, tr = target or zoom_target(path)
    c1 = (ox + tx * s, oy + ty * s)
    r1 = tr * s
    c2 = (c1[0] + bubble_off[0], c1[1] + bubble_off[1])
    ring = 12
    R = bubble_r + ring
    x_min = min(0, c2[0] - R - 20)
    y_min = min(0, c2[1] - R - 20)
    x_max = max(el.size[0], c2[0] + R + 20)
    y_max = max(el.size[1], c2[1] + R + 20)
    W, H = int(x_max - x_min), int(y_max - y_min)
    dx, dy = int(-x_min), int(-y_min)
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(el.img, (dx, dy))
    prot = Image.new("L", (W, H), 0)
    prot.paste(el.prot, (dx, dy))
    c1 = (c1[0] + dx, c1[1] + dy)
    c2 = (c2[0] + dx, c2[1] + dy)
    # garis penyambung + bulatan sumber
    lay = ss_canvas(W, H)
    d = ImageDraw.Draw(lay)
    for p, q in tangent_lines(c1, r1, c2, R):
        d.line([(p[0] * SS, p[1] * SS), (q[0] * SS, q[1] * SS)], fill=(255, 255, 255, 235), width=4 * SS)
    d.ellipse([(c1[0] - r1) * SS, (c1[1] - r1) * SS, (c1[0] + r1) * SS, (c1[1] + r1) * SS],
              outline=(255, 255, 255, 255), width=5 * SS)
    lines = ss_done(lay)
    sh = lines.split()[-1].filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.35))
    shimg = Image.new("RGBA", (W, H), (40, 30, 25, 0))
    shimg.putalpha(sh)
    base.alpha_composite(shimg, (2, 3))
    base.alpha_composite(lines)
    # bulatan zoom dari gambar asal (resolusi penuh)
    zr = tr
    zc = im.crop((int(tx - zr), int(ty - zr), int(tx + zr), int(ty + zr)))
    D = 2 * bubble_r
    zc = fit(zc, D, D)
    cm = Image.new("L", (D * SS, D * SS), 0)
    ImageDraw.Draw(cm).ellipse([0, 0, D * SS - 1, D * SS - 1], fill=255)
    cm = cm.resize((D, D), RS.LANCZOS)
    bub = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0))
    rm = Image.new("L", (2 * R * SS, 2 * R * SS), 0)
    ImageDraw.Draw(rm).ellipse([0, 0, 2 * R * SS - 1, 2 * R * SS - 1], fill=255)
    rm = rm.resize((2 * R, 2 * R), RS.LANCZOS)
    ringimg = Image.new("RGBA", (2 * R, 2 * R), (255, 255, 255, 255))
    ringimg.putalpha(rm)
    bub.alpha_composite(ringimg)
    zc = zc.convert("RGBA")
    zc.putalpha(cm)
    bub.alpha_composite(zc, (ring, ring))
    bs = rm.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.35))
    bsh = Image.new("RGBA", (2 * R, 2 * R), (50, 40, 30, 0))
    bsh.putalpha(bs)
    bx, by = int(c2[0] - R), int(c2[1] - R)
    base.alpha_composite(bsh, (bx + 8, by + 14))
    base.alpha_composite(bub, (bx, by))
    ImageDraw.Draw(prot).ellipse([bx, by, bx + 2 * R, by + 2 * R], fill=255)
    return El(base, prot)


def scene(path, w, h, fx=0.5, fy=0.5, edges="lrtb", seed=0, crop=None):
    """Latar foto koyak tepi (tanpa bingkai). protect = orang dalam gambar."""
    im = photo(path)
    m, _ = person_mask(path)
    if crop:
        im, m = im.crop(crop), m.crop(crop)
    iw, ih = im.size
    s = max(w / iw, h / ih)
    cw, ch = w / s, h / s
    x0 = min(max(0, iw * fx - cw / 2), iw - cw)
    y0 = min(max(0, ih * fy - ch / 2), ih - ch)
    box = (int(x0), int(y0), int(x0 + cw), int(y0 + ch))
    p = fit(im.crop(box), w, h).convert("RGBA")
    if edges:
        p.putalpha(deckle_mask(w, h, edges, amp=9, seed=seed))
    pm = m.crop(box).resize((w, h), RS.NEAREST)
    pm = Image.fromarray(cv2.dilate(np.asarray(pm), np.ones((15, 15), np.uint8)))
    return El(p, pm)


def back_cutout(path, height, outline=12):
    """Cutout orang (biasanya dari belakang). Kepala dilindungi daripada garis potong."""
    im = photo(path)
    m, faces = person_mask(path)
    bb = m.point(lambda v: 255 if v > 128 else 0).getbbox()
    sub, a = im.crop(bb), m.crop(bb)
    f = height / sub.size[1]
    size = (round(sub.size[0] * f), height)
    sub = fit(sub, *size)
    a = a.resize(size, RS.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    pad = outline + 4
    W, H = size[0] + 2 * pad, size[1] + 2 * pad
    alpha = Image.new("L", (W, H), 0)
    alpha.paste(a, (pad, pad))
    img = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    img.putalpha(outline_alpha(alpha, outline))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(sub, (pad, pad))
    layer.putalpha(alpha)
    img.alpha_composite(layer)
    prot = Image.new("L", (W, H), 0)
    pd = ImageDraw.Draw(prot)
    for (x0, y0, x1, y1) in faces:
        pd.rectangle([pad + (x0 - bb[0]) * f, pad + (y0 - bb[1]) * f, pad + (x1 - bb[0]) * f,
                      pad + (y1 - bb[1]) * f], fill=255)
    ah = np.asarray(alpha) > 128
    rows = np.where(ah.any(1))[0]
    if len(rows):
        he = rows[0] + int((rows[-1] - rows[0]) * 0.17)
        cols = np.where(ah[rows[0]:he].any(0))[0]
        if len(cols):
            pd.rectangle([cols[0], rows[0], cols[-1], he], fill=255)
    return El(img, prot)


def polaroid(path, w, seed=0, fy=0.5):
    el, _ = framed(path, "polaroid", w, window=None, aspect=1 / 1.05, seed=seed, protect="all")
    return el


# ---------------------------------------------------------------- COMPOSER
class Canvas:
    def __init__(self, n):
        self.n = n
        self.W, self.H = n * SLIDE_W, SLIDE_H
        self.img = paper_texture(self.W, self.H, CREAM, seed=SEED, fiber=5).convert("RGBA")
        self.prot = Image.new("L", (self.W, self.H), 0)
        self.seams = [SLIDE_W * i for i in range(1, n)]
        self.log = []

    def _bad(self, el, x):
        cols = np.where(np.asarray(el.prot).any(0))[0]
        if not len(cols):
            return False
        segs = np.split(cols, np.where(np.diff(cols) > 1)[0] + 1)
        for sgm in segs:
            c0, c1 = x + sgm[0], x + sgm[-1]
            if any(c0 - SEAM_MARGIN < s < c1 + SEAM_MARGIN for s in self.seams):
                return True
        return False

    def put(self, el, x, y, shadow=0.28, blur=16, off=(10, 16), avoid=True, name=""):
        """Letak elemen (x,y = tengah). Kalau kawasan protect kena garis potong, anjak mendatar."""
        if el is None:
            return
        w, h = el.size
        x0, y0 = int(x - w / 2), int(y - h / 2)
        if avoid and self._bad(el, x0):
            for d in range(10, 700, 10):
                hit = next((s for s in (d, -d) if not self._bad(el, x0 + s)), None)
                if hit is not None:
                    self.log.append(f"  anjak '{name}' {hit:+d}px supaya muka tak kena garis potong")
                    x0 += hit
                    break
        if shadow:
            a = el.img.split()[-1]
            sa = Image.new("L", (w + 4 * blur, h + 4 * blur), 0)
            sa.paste(a, (2 * blur, 2 * blur))
            sa = sa.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * shadow))
            col = Image.new("RGBA", sa.size, (70, 55, 45, 255))
            col.putalpha(sa)
            self._paste(col, x0 - 2 * blur + off[0], y0 - 2 * blur + off[1])
        self._paste(el.img, x0, y0)
        p = Image.new("L", (self.W, self.H), 0)
        p.paste(el.prot, (x0, y0))
        self.prot = ImageChops.lighter(self.prot, p)

    def deco(self, el, x, y, **kw):
        if DECOR:
            kw.setdefault("avoid", False)
            self.put(el, x, y, **kw)

    def _paste(self, im, x, y):
        layer = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        layer.paste(im, (x, y))
        self.img.alpha_composite(layer)

    def check_seams(self):
        p = np.asarray(self.prot) > 0
        return [i + 1 for i, s in enumerate(self.seams) if p[:, max(0, s - SEAM_MARGIN):s + SEAM_MARGIN].any()]

    def finish(self):
        rng = np.random.default_rng(SEED)
        a = np.asarray(self.img.convert("RGB")).astype(np.float32)
        a += rng.normal(0, 2.4, a.shape[:2])[..., None]
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- PICKS
def analyse(paths):
    info = {}
    for p in paths:
        im = load_photo(p)
        m, faces = person_mask(p)
        a = np.asarray(m) > 128
        n, _, st, _ = cv2.connectedComponentsWithStats(a.astype(np.uint8))
        solid = st[1:, cv2.CC_STAT_AREA].max() / max(1, a.sum()) if n > 1 else 0
        sharp = cv2.Laplacian(cv2.cvtColor(np.asarray(im.resize((320, int(320 * im.size[1] / im.size[0])))),
                                           cv2.COLOR_RGB2GRAY), cv2.CV_64F).var()
        info[p.name] = dict(ratio=a.mean(), solid=solid, faces=len(faces), sharp=sharp, px=im.size[0] * im.size[1])
    return info


def auto_picks(paths):
    print("Auto pilih gambar (analisis rembg + muka)...")
    info = analyse(paths)
    med = np.median([v["sharp"] for v in info.values()])
    left = {k for k, v in info.items() if v["sharp"] > 0.35 * med}

    def take(key, n, cond=lambda k: True):
        got = [k for k in sorted(left, key=key) if cond(k)][:n]
        left.difference_update(got)
        return got

    people = lambda k: info[k]["ratio"] > 0.02 and info[k]["faces"] > 0
    hero = take(lambda k: -info[k]["px"] * info[k]["faces"], 1, people)
    pop = take(lambda k: -info[k]["px"] * info[k]["solid"], 2, lambda k: people(k) and info[k]["solid"] > 0.8)
    zoom = take(lambda k: -info[k]["px"], 1, people)
    back = take(lambda k: -info[k]["ratio"], 1, lambda k: 0.04 < info[k]["ratio"] < 0.45 and info[k]["faces"] == 0)
    scene_ = take(lambda k: info[k]["ratio"], 2)
    pol = take(lambda k: -info[k]["faces"], 5)
    for k, v in info.items():
        print(f"  {k:24s} orang={v['ratio']:.2f} muka={v['faces']} solid={v['solid']:.2f}")
    return {"hero": hero, "popout": pop, "zoom": zoom, "scene": scene_, "backcut": back, "polaroid": pol}


def resolve_picks(photo_dir):
    paths = sorted(p for p in photo_dir.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
    if not paths:
        sys.exit(f"Tiada gambar dalam {photo_dir}")
    names = {p.name for p in paths}
    want = [n for v in PICKS.values() for n in v]
    picks = {k: list(v) for k, v in PICKS.items()} if PICKS and all(n in names for n in want) \
        else auto_picks(paths)
    pool = [p.name for p in paths]
    need = {"hero": 1, "popout": 2, "zoom": 1, "scene": 2, "backcut": 1, "polaroid": 5}
    i = 0
    for k, n in need.items():
        while len(picks.get(k, [])) < n:
            picks.setdefault(k, []).append(pool[i % len(pool)])
            i += 1
    return {k: [photo_dir / n for n in v] for k, v in picks.items()}


# ---------------------------------------------------------------- LAYOUT
def build(n, P):
    """Susun semua elemen atas kanvas panjang. Koordinat = tengah elemen; ox(i) = tepi kiri slide i."""
    rng = random.Random(SEED)
    c = Canvas(n)
    S, H = SLIDE_W, SLIDE_H
    hero, pops, zoom, scenes, back, pol = (P["hero"][0], P["popout"], P["zoom"][0], P["scene"],
                                           P["backcut"], P["polaroid"])
    ox = lambda i: S * i

    # ===== SLIDE 1 : hero (family + stroller) keluar dari cetakan foto =====
    hm, _ = person_mask(hero)
    top_people = person_bbox(hero)[1]
    hw, hh = load_photo(hero).size
    # latar: bahagian atas gambar hero (bumbung, hiasan) tanpa orang, merentas ke slide 2
    c.put(scene(hero, 1380, H, fx=0.5, fy=0.5, edges="r", seed=3,
                crop=(0, 0, hw, max(int(hh * 0.25), int(top_people * 0.92)))),
          ox(0) + 690, H / 2, shadow=0.22, avoid=False)
    if n > 1:
        c.put(scene(pops[1], 560, 1000, seed=5, crop=_side_crop(pops[1])).rotate(3),
              ox(1) + 90, 560, shadow=0.22, avoid=False)
    c.deco(lace(700, 70).rotate(-90), ox(0) + 40, 760, shadow=0.15, blur=6)
    c.put(popout(hero, "print", 760, aspect=0.86, seed=2, head_frac=0.34, loose=0.035, outline=13).rotate(-3),
          ox(0) + 530, 735,
          shadow=0.35, blur=20, name="hero")
    c.deco(washi(200, seed=1).rotate(-35), ox(0) + 205, 205, shadow=0.1, blur=5)
    c.deco(washi(200, color=SAGE, seed=2).rotate(30), ox(0) + 860, 1260, shadow=0.1, blur=5)
    c.deco(sparkle(34), ox(0) + 950, 150, shadow=0)
    c.deco(sparkle(22), ox(0) + 1010, 230, shadow=0)

    # ===== SLIDE 2 : adik-beradik keluar dari skrin telefon =====
    if n > 1:
        c.put(polaroid(pol[2], 330, seed=10).rotate(-6), ox(1) + 905, 1120, shadow=0.3, name="pol2")
        ph = popout(pops[1], "phone", 480, aspect=0.62, seed=11, head_frac=0.22, outline=10)
        c.put(ph.rotate(4), ox(1) + 590, 690, shadow=0.38, blur=20, name="phone")
        c.deco(paper_clip(170, color=(170, 182, 192)).rotate(18), ox(1) + 930, 140, shadow=0.25, blur=6,
               off=(5, 7))
        c.deco(sparkle(30), ox(1) + 250, 1250, shadow=0)

    # ===== SLIDE 3 : foto besar + bulatan zoom si kecil =====
    if n > 2:
        if n > 3:  # latar dinding pokok (gambar couple) merentas garis 3 -> 4
            c.put(scene(pops[0], 560, 1000, seed=5, crop=_side_crop(pops[0])).rotate(3),
                  ox(3) + 60, 560, shadow=0.22, avoid=False)
        c.put(polaroid(pol[1], 330, seed=8).rotate(7), ox(2) + 880, 250, shadow=0.3, name="pol1")
        # jalur foto koyak (latar tanpa orang dari gambar zoom) merentas garis 2 -> 3
        c.put(scene(zoom, 560, 300, fy=0.55, seed=15, crop=_side_crop(zoom)).rotate(-4), ox(2) - 30, 1180,
              shadow=0.22, avoid=False)
        c.put(print_with_zoom(zoom, 800, aspect=0.85, bubble_r=225, bubble_off=(345, 360), seed=9).rotate(-2),
              ox(2) + 520, 690, shadow=0.32, blur=18, name="zoom")
        c.deco(washi(210, color=SAGE, seed=3).rotate(-6), ox(2) + 120, 120, shadow=0.1, blur=5)

    # ===== SLIDE 4 : couple pop-out dari polaroid =====
    if n > 3:
        c.put(polaroid(pol[0], 330, seed=4).rotate(-8), ox(3) + 185, 1145, shadow=0.3, name="pol0")
        c.put(popout(pops[0], "polaroid", 600, aspect=0.9, seed=6, head_frac=0.3).rotate(4),
              ox(3) + 610, 700, shadow=0.35, blur=20, name="couple")
        c.deco(small_heart(26).rotate(12), ox(3) + 960, 300, shadow=0.2, blur=5)
        c.deco(small_heart(18).rotate(-15), ox(3) + 1005, 370, shadow=0.2, blur=5)
        c.deco(sticker_heart_button(40).rotate(-10), ox(3) + 260, 140, shadow=0.25, blur=8)

    # ===== SLIDE 5 : kenangan lain + cutout melintas garis =====
    if n > 4:
        c.put(scene(scenes[0], 900, 1150, seed=12).rotate(1.5), ox(4) + 330, 650, shadow=0.22, avoid=False)
        c.put(polaroid(pol[3], 330, seed=13).rotate(-7), ox(4) + 850, 330, shadow=0.3, name="pol3")
        c.put(polaroid(pol[4], 330, seed=14).rotate(6), ox(4) + 830, 1000, shadow=0.3, name="pol4")
        c.put(back_cutout(back[0], 660), ox(4) + 60, 1000, shadow=0.3, blur=14, name="backcut")
        c.deco(sticker_star(40).rotate(-12), ox(4) + 560, 1250, shadow=0.25, blur=8)
        c.deco(sticker_heart_button(38).rotate(14), ox(4) + 1000, 640, shadow=0.25, blur=8)
        c.deco(washi(180, seed=4).rotate(28), ox(4) + 720, 140, shadow=0.1, blur=5)

    # slide tambahan (SLIDES > 5)
    for i in range(5, n):
        c.put(scene(scenes[i % len(scenes)], 760, 1100, seed=20 + i).rotate(rng.uniform(-3, 3)),
              ox(i) + 400, 680, shadow=0.22, avoid=False)
        c.put(polaroid(pol[i % len(pol)], 400, seed=30 + i).rotate(rng.uniform(-7, 7)),
              ox(i) + 700, 760, shadow=0.3, name=f"pol_{i}")
        c.deco(sticker_star(40).rotate(rng.uniform(-20, 20)), ox(i) + 180, 220, shadow=0.25, blur=8)
    return c


def _side_crop(path):
    """Kawasan latar di sebelah orang (tiada orang) untuk dijadikan kertas foto koyak."""
    im = load_photo(path)
    bx0, by0, bx1, by1 = person_bbox(path)
    W, H = im.size
    if bx0 > W - bx1:
        return (0, int(H * 0.1), max(10, int(bx0 * 0.7)), int(H * 0.75))
    return (min(W - 10, int(bx1 + (W - bx1) * 0.3)), int(H * 0.1), W, int(H * 0.75))


# ---------------------------------------------------------------- MAIN
def main():
    global DECOR
    ap = argparse.ArgumentParser()
    ap.add_argument("photos", nargs="?", default=str(PHOTO_DIR))
    ap.add_argument("--slides", type=int, default=SLIDES)
    ap.add_argument("--out", default=str(OUT_DIR))
    ap.add_argument("--no-decor", action="store_true", help="tanpa sticker/pita/renda")
    a = ap.parse_args()
    if a.no_decor:
        DECOR = False
    n = max(2, a.slides)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    P = resolve_picks(Path(a.photos))
    for k, v in P.items():
        print(f"{k:9s}: {', '.join(p.name for p in v)}")
    small = sorted({p.name for v in P.values() for p in v if max(load_photo(p).size) < 1200})
    if small:
        print(f"Nota: {len(small)} gambar resolusi rendah (<1200px) digunakan kecil sahaja: {', '.join(small)}")

    c = build(n, P)
    for line in c.log:
        print(line)
    bad = c.check_seams()
    print("Semakan garis potong:", "OK, tiada muka atas garis" if not bad else f"MASALAH di garis selepas slide {bad}")

    final = c.finish()
    for i in range(n):
        final.crop((i * SLIDE_W, 0, (i + 1) * SLIDE_W, SLIDE_H)).save(
            out / f"slide_{i + 1:02d}.jpg", quality=JPEG_QUALITY, subsampling=0)

    # preview: kanvas penuh + tanda segi tiga di garis potong (di luar gambar)
    band, scale = 30, 0.5
    pw, ph_ = int(c.W * scale), int(c.H * scale)
    prev = Image.new("RGB", (pw, ph_ + 2 * band), (40, 40, 40))
    prev.paste(final.resize((pw, ph_), RS.LANCZOS), (0, band))
    d = ImageDraw.Draw(prev)
    for s_ in c.seams:
        x = int(s_ * scale)
        d.polygon([(x - 9, 4), (x + 9, 4), (x, band - 4)], fill=(255, 90, 110))
        d.polygon([(x - 9, ph_ + 2 * band - 4), (x + 9, ph_ + 2 * band - 4), (x, ph_ + band + 4)],
                  fill=(255, 90, 110))
    prev.save(out / "preview_strip.jpg", quality=92)
    print(f"Siap: {out}/slide_01..{n:02d}.jpg + preview_strip.jpg")


if __name__ == "__main__":
    main()
