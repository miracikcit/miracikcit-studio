#!/usr/bin/env python3
"""
carousel_engine.py : generator carousel Instagram "seamless" untuk Miracikcit Studio.

Setiap run lain: templat slide, gaya cutout, latar dan hiasan dipilih secara rawak (seed),
dan resipi beberapa carousel terakhir dielak supaya tak berulang. 0 token (tiada AI).

Satu kanvas panjang (N x 1080) x H dipotong jadi slide (4:5, 1:1 atau 9:16). Elemen melintas
garis potong supaya bersambung bila swipe. Muka dilindungi: tiada muka atas garis potong.

Templat: popout_print, popout_polaroid, popout_phone (orang keluar dari bingkai), zoom_bubble
(bulatan zoom), zoom_cutout (cutout besar sebelah foto), cutout_scene (cutout atas latar),
polaroid_stack, film_strip, grid_torn, arch, circles, ticket, fullbleed.
Gaya cutout: loose (longgar, licin), tight (ikut badan), color (garisan warna), shadow (bayang).
Gaya keseluruhan (vibe): scrapbook, minimal, film, majalah.
Warna: preset natural, vivid, warm, misty, film, pastel (lindung warna kulit).

Guna:
  python carousel_engine.py --job job.json
job.json = {"photos":[{"path":"..","name":"..","star":false}], "out":"dir", "cache":"dir",
            "opts":{"mode":"carousel|enhance","slides":5,"aspect":"4:5","vibe":"rawak",
                    "cutout":"rawak","decor":1,"enhance":"natural","strength":1.0,"order":false},
            "seed":123, "avoid":[["popout_print","grid_torn",..],..], "lock":[2], "recipe":{..}}
Keluar: <out>/result.json  {"slides":[..], "preview":"..", "thumb":"..", "recipe":{..}, "warnings":[..]}
Kemajuan dicetak ke stdout:  PROG <peratus> <mesej>
"""
import argparse
import hashlib
import json
import math
import os
import random
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ENGINE_VERSION = 1
RS = Image.Resampling
SIZES = {"4:5": (1080, 1350), "1:1": (1080, 1080), "9:16": (1080, 1920)}
SEAM_MARGIN = 45
JPEG_Q = 95
VIBES = ["scrapbook", "minimal", "film", "majalah"]
CUT_STYLES = ["loose", "tight", "color", "shadow"]

# Warna asas (dikemas kini ikut tona gambar dalam set_palette)
CREAM = (247, 243, 235)
INK = (58, 52, 46)
PINK = (241, 190, 196)
BUTTER = (247, 224, 130)
SAGE = (168, 196, 160)
ACCENTS = [PINK, SAGE, BUTTER]
SS = 2  # supersampling hiasan


def prog(pct, msg):
    print(f"PROG {int(pct)} {msg}", flush=True)


# ---------------------------------------------------------------- ELEMENT
class El:
    """Gambar RGBA + topeng 'protect' (muka: tak boleh kena garis potong)."""

    def __init__(self, img, prot=None):
        self.img = img.convert("RGBA")
        self.prot = prot if prot is not None else Image.new("L", self.img.size, 0)

    def rotate(self, deg):
        if not deg:
            return self
        return El(self.img.rotate(deg, resample=RS.BICUBIC, expand=True),
                  self.prot.rotate(deg, resample=RS.NEAREST, expand=True))

    def scale(self, f):
        if abs(f - 1) < 1e-3:
            return self
        sz = (max(1, round(self.img.size[0] * f)), max(1, round(self.img.size[1] * f)))
        return El(self.img.resize(sz, RS.LANCZOS), self.prot.resize(sz, RS.NEAREST))

    def fit(self, mw, mh):
        w, h = self.img.size
        return self.scale(min(1.0, mw / w, mh / h))

    @property
    def size(self):
        return self.img.size


def protect_all(img, inset=0):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rectangle([inset, inset, img.size[0] - inset, img.size[1] - inset], fill=255)
    return m


# ---------------------------------------------------------------- IMAGE IO
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


def crop_box(iw, ih, w, h, fx=0.5, fy=0.5):
    s = max(w / iw, h / ih)
    cw, ch = w / s, h / s
    x0 = min(max(0, iw * fx - cw / 2), iw - cw)
    y0 = min(max(0, ih * fy - ch / 2), ih - ch)
    return (int(x0), int(y0), int(x0 + cw), int(y0 + ch))


def cover_crop(im, w, h, fx=0.5, fy=0.5):
    return fit(im.crop(crop_box(im.size[0], im.size[1], w, h, fx, fy)), w, h)


# ---------------------------------------------------------------- ENHANCE
PRESETS = {
    "natural": dict(wb=.30, curve=.12, vib=.35, sat=.02, warm=.01, tint=0, fade=0, bright=0, clarity=12),
    "vivid": dict(wb=.35, curve=.20, vib=.60, sat=.06, warm=.02, tint=0, fade=0, bright=.01, clarity=18),
    "warm": dict(wb=.15, curve=.14, vib=.40, sat=.02, warm=.06, tint=.005, fade=.02, bright=.02, clarity=12),
    "misty": dict(wb=.30, curve=.08, vib=.25, sat=-.05, warm=-.035, tint=0, fade=.05, bright=.03, clarity=8),
    "film": dict(wb=.20, curve=.16, vib=.20, sat=-.10, warm=.03, tint=-.012, fade=.07, bright=0, clarity=10),
    "pastel": dict(wb=.25, curve=-.04, vib=.15, sat=-.14, warm=.02, tint=.01, fade=.10, bright=.05, clarity=6),
}


def enhance(im, preset="natural", k=1.0):
    """Tingkatkan warna ikut preset. k = kekuatan (0..1.5). Warna kulit dilindungi."""
    P = PRESETS.get(preset)
    if not P or k <= 0:
        return im
    a = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    m = a.reshape(-1, 3).mean(0)
    a *= 1 + P["wb"] * k * (m.mean() / np.maximum(m, 1e-3) - 1)                 # white balance separa
    lo, hi = np.percentile(a, 0.2), np.percentile(a, 99.8)                       # regang tonal
    st = np.clip((a - lo) / max(hi - lo, 1e-3), 0, 1)
    kk = min(1.0, k)
    a = np.clip(a * (1 - kk) + st * kk, 0, 1)
    a = a - P["curve"] * k * np.sin(2 * np.pi * a) / (2 * np.pi)                 # lengkung S
    a = a + P["bright"] * k * (1 - a)
    a = P["fade"] * k + a * (1 - P["fade"] * k)                                   # angkat hitam (pudar)
    hsv = cv2.cvtColor(np.clip(a, 0, 1).astype(np.float32), cv2.COLOR_RGB2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    skin = (((H < 28) | (H > 340)) & (S > 0.12) & (S < 0.72) & (V > 0.2)).astype(np.float32)
    skin = cv2.GaussianBlur(skin, (0, 0), 3)
    S2 = np.clip(S * (1 + P["sat"] * k) + P["vib"] * k * S * (1 - S), 0, 1)
    hsv[..., 1] = S + (S2 - S) * (1 - 0.65 * skin)                               # kulit: perubahan kecil
    a = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    a[..., 0] *= 1 + P["warm"] * k
    a[..., 2] *= 1 - P["warm"] * k
    a[..., 1] *= 1 - P["tint"] * k
    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    r = max(3, int(max(im.size) / 160))
    return out.filter(ImageFilter.UnsharpMask(radius=r, percent=int(P["clarity"] * k), threshold=4))


# ---------------------------------------------------------------- PHOTO + ANALYSIS
_sessions = {}
_cascades = None


def detect_faces(im):
    """Kotak muka (x0,y0,x1,y1) dalam koordinat im (Haar frontal + profile, pendua dibuang)."""
    global _cascades
    if _cascades is None:
        d = cv2.data.haarcascades
        _cascades = [cv2.CascadeClassifier(d + n) for n in
                     ("haarcascade_frontalface_default.xml", "haarcascade_profileface.xml")]
    f = 1000 / max(im.size)
    g = cv2.cvtColor(np.asarray(im.convert("RGB").resize((int(im.size[0] * f), int(im.size[1] * f)))),
                     cv2.COLOR_RGB2GRAY)
    g = cv2.equalizeHist(g)
    boxes = []
    for c in _cascades:
        for flip in (False, True):
            gg = cv2.flip(g, 1) if flip else g
            for (x, y, w, h) in c.detectMultiScale(gg, 1.1, 5, minSize=(24, 24)):
                if flip:
                    x = gg.shape[1] - x - w
                boxes.append((x / f, y / f, (x + w) / f, (y + h) / f))
    out = []
    for b in sorted(boxes, key=lambda b: -(b[2] - b[0])):
        if all(abs((b[0] + b[2]) / 2 - (o[0] + o[2]) / 2) > (o[2] - o[0]) * 0.5 or
               abs((b[1] + b[3]) / 2 - (o[1] + o[3]) / 2) > (o[3] - o[1]) * 0.5 for o in out):
            out.append(b)
    return out


class Photo:
    """Satu gambar: asal, versi enhance, topeng orang, muka dan keupayaan (untuk templat)."""

    def __init__(self, path, name=None, star=False, cache=None, preset="natural", strength=1.0):
        self.path = str(path)
        self.name = name or os.path.basename(self.path)
        self.star = bool(star)
        self.raw = ImageOps.exif_transpose(Image.open(self.path)).convert("RGB")
        if max(self.raw.size) > 3200:   # cukup untuk carousel, lebih laju
            self.raw.thumbnail((3200, 3200), RS.LANCZOS)
        self.W, self.H = self.raw.size
        self.cache = cache
        self.preset, self.strength = preset, strength
        self._im = None
        self._loose = {}
        self._analyse()

    @property
    def im(self):
        if self._im is None:
            self._im = enhance(self.raw, self.preset, self.strength)
        return self._im

    def _key(self):
        h = hashlib.md5()
        h.update(self.raw.tobytes()[::997])
        h.update(str(self.raw.size).encode())
        return h.hexdigest()[:16]

    def _analyse(self):
        key = self._key()
        cdir = Path(self.cache) if self.cache else None
        mp = cdir / f"{key}_m.png" if cdir else None
        jp = cdir / f"{key}_a.json" if cdir else None
        if mp and mp.exists() and jp.exists():
            m = Image.open(mp).convert("L")
            faces = json.load(open(jp))["faces"]
        else:
            from rembg import new_session, remove
            if "h" not in _sessions:
                _sessions["h"] = new_session("u2net_human_seg")
            small = self.raw.copy()
            small.thumbnail((1600, 1600), RS.LANCZOS)
            if max(small.size) < 1000:
                small = upscale(small, target_w=small.size[0] * 1000 / max(small.size))
            m = remove(small, session=_sessions["h"], post_process_mask=True).split()[-1]
            faces = [list(b) for b in detect_faces(self.raw)]
            if cdir:
                cdir.mkdir(parents=True, exist_ok=True)
                m.save(mp)
                json.dump({"faces": faces}, open(jp, "w"))
        a = np.asarray(m.resize((self.W, self.H), RS.BILINEAR)) > 128
        a = cv2.morphologyEx(a.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(a)
        solid = 0.0
        if n > 1:
            big = st[1:, cv2.CC_STAT_AREA].max()
            solid = big / max(1, a.sum())
            a = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 0.08 * big]).astype(np.uint8)
        a = cv2.medianBlur(cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)) * 255, 9)
        self.mask = Image.fromarray(a)
        # muka sebenar: ada warna kulit (Haar kadang kesan lantai / daun sebagai muka)
        hsv = cv2.cvtColor(np.asarray(self.raw), cv2.COLOR_RGB2HSV)
        real, missing = [], 0
        for f in faces:
            x0, y0, x1, y1 = [int(v) for v in f]
            hb = hsv[max(0, y0):y1, max(0, x0):x1]
            if hb.size == 0:
                continue
            sk = (((hb[..., 0] < 14) | (hb[..., 0] > 170)) & (hb[..., 1] > 40) & (hb[..., 1] < 170) & (hb[..., 2] > 60)).mean()
            if sk >= 0.45:
                real.append(tuple(f))
                if (a[max(0, y0):y1, max(0, x0):x1] > 128).mean() < 0.3:
                    missing += 1   # orang yang rembg terlepas
        faces = real
        self.mask_incomplete = missing > 0
        # latar yang rembg anggap 'orang' di atas kepala (pokok, tiang): buang, simpan bentuk kepala sahaja
        inm = [f for f in faces if (a[int((f[1] + f[3]) / 2), int(min(self.W - 1, (f[0] + f[2]) / 2))] > 128)]
        if inm:
            rows = np.where((a > 128).any(1))[0]
            fh = float(np.median([f[3] - f[1] for f in inm]))
            if len(rows) and rows[0] < min(f[1] for f in inm) - 1.0 * fh:
                cut = min(f[3] + 0.3 * (f[3] - f[1]) for f in inm)
                keep = Image.new("L", (self.W, self.H), 0)
                kd = ImageDraw.Draw(keep)
                kd.rectangle([0, cut, self.W, self.H], fill=255)
                for x0, y0, x1, y1 in inm:
                    w, h = x1 - x0, y1 - y0
                    cx = (x0 + x1) / 2
                    kd.ellipse([cx - 0.6 * w, y0 - 0.32 * h, cx + 0.6 * w, y0 + 0.9 * h], fill=255)
                    kd.rectangle([x0 + 0.04 * w, y0 + 0.3 * h, x1 - 0.04 * w, y1], fill=255)
                    kd.rectangle([x0 + 0.18 * w, y1 - 0.1 * h, x1 - 0.18 * w, max(y1, cut) + 2], fill=255)
                rgb = np.asarray(self.raw).astype(np.float32)
                R, G, B = rgb[..., 0] + 1, rgb[..., 1], rgb[..., 2]
                foliage = ((G < 0.5 * R) & (B < 0.55 * R) & (R > 32)) | ((G > R * 1.05) & (G > B))
                yy = np.arange(self.H)[:, None]
                a = ((a > 128) & (np.asarray(keep) > 0) & ~(foliage & (yy < cut))).astype(np.uint8)
                a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
                a = cv2.medianBlur(cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)) * 255, 9)
                self.mask = Image.fromarray(a)
        self.faces = [tuple(f) for f in faces]
        self.ratio = float((a > 128).mean())
        self.bbox = self.mask.point(lambda v: 255 if v > 128 else 0).getbbox() if self.ratio > 0.002 else None
        self.solid = float(solid)
        L = max(self.W, self.H)
        self.lowres = L < 900
        self.people = self.ratio > 0.012 and self.bbox is not None
        fin = [f for f in self.faces if self.bbox and self.bbox[0] - 20 <= (f[0] + f[2]) / 2 <= self.bbox[2] + 20]
        self.backview = self.people and not fin
        if self.backview:   # pastikan betul-betul dari belakang: kawasan kepala hampir tiada kulit
            x0, y0, x1, y1 = self.bbox
            hy = y0 + int((y1 - y0) * 0.28)
            hb = hsv[y0:hy, x0:x1]
            hm = a[y0:hy, x0:x1] > 128
            if hm.sum() > 50:
                sk = (((hb[..., 0] < 14) | (hb[..., 0] > 170)) & (hb[..., 1] > 40) & (hb[..., 1] < 170) & (hb[..., 2] > 60))[hm].mean()
                self.backview = sk < 0.12
        self.nfaces = len(fin)
        bh = (self.bbox[3] - self.bbox[1]) / self.H if self.bbox else 0
        top_ok = self.bbox is not None and self.bbox[1] > 0.03 * self.H
        side_ok = self.bbox is not None and self.bbox[0] > 2 and self.bbox[2] < self.W - 2
        whole = not self.mask_incomplete
        self.popout_ok = self.people and whole and not self.lowres and self.solid >= 0.5 and bh >= 0.3 and top_ok
        self.cut_ok = self.people and whole and L >= 900 and self.solid >= 0.55 and bh >= 0.25 and side_ok
        tall = self.bbox is not None and (self.bbox[3] - self.bbox[1]) > 1.1 * (self.bbox[2] - self.bbox[0])
        self.backcut_ok = self.people and whole and tall and self.ratio > 0.03 and L >= 500 and self.solid >= 0.55 \
            and bh >= 0.25 and side_ok
        self.zoom_ok = bool(self.faces) and L >= 1100 and max(f[2] - f[0] for f in self.faces) >= 45
        self.scenic = not self.lowres
        # titik fokus untuk potongan (muka / orang)
        if self.faces:
            fx = np.mean([(f[0] + f[2]) / 2 for f in self.faces]) / self.W
            fy = np.mean([(f[1] + f[3]) / 2 for f in self.faces]) / self.H
            self.focus = (float(fx), float(min(0.7, fy + 0.12)))
        elif self.bbox:
            self.focus = ((self.bbox[0] + self.bbox[2]) / 2 / self.W, (self.bbox[1] * 0.7 + self.bbox[3] * 0.3) / self.H)
        else:
            self.focus = (0.5, 0.5)

    def loose(self, frac):
        if frac not in self._loose:
            self._loose[frac] = loose_mask(self.mask, frac)
        return self._loose[frac]

    def protect_map(self):
        """Topeng kawasan yang perlu dilindungi (orang + muka), saiz gambar."""
        pm = self.mask.copy()
        d = ImageDraw.Draw(pm)
        for f in self.faces:
            d.rectangle(f, fill=255)
        return pm

    def caps(self):
        return sum([self.popout_ok, self.zoom_ok, self.cut_ok])

    def free_crop(self, aspect):
        """Kawasan tanpa orang (untuk jalur foto koyak). aspect = lebar/tinggi."""
        W, H = self.W, self.H
        if not self.bbox or self.ratio < 0.01:
            return (0, 0, W, H)
        x0, y0, x1, y1 = self.bbox
        cands = [(0, 0, int(x0 * 0.85), H), (int(x1 + (W - x1) * 0.15), 0, W, H), (0, 0, W, int(y0 * 0.85))]
        best, area = (0, 0, W, H), 0
        for c in cands:
            cw, ch = c[2] - c[0], c[3] - c[1]
            if cw < 40 or ch < 40:
                continue
            if cw / ch > aspect:
                nw = ch * aspect
                c = (int(c[0] + (cw - nw) / 2), c[1], int(c[0] + (cw + nw) / 2), c[3])
            else:
                nh = cw / aspect
                c = (c[0], int(c[1] + (ch - nh) / 2), c[2], int(c[1] + (ch + nh) / 2))
            a = (c[2] - c[0]) * (c[3] - c[1])
            if a > area:
                best, area = c, a
        if area < 0.04 * W * H:
            return (0, 0, W, H)
        return best


def loose_mask(m, frac):
    """Cutout 'longgar': bentuk licin lebih besar dari badan (tutup celah, tepi tajam)."""
    bb = m.point(lambda v: 255 if v > 128 else 0).getbbox()
    if not bb:
        return m
    bh = bb[3] - bb[1]
    L = max(6, int(bh * frac))
    K = max(9, int(bh * frac * 2.6)) | 1
    a = (np.asarray(m) > 128).astype(np.uint8)
    pad = K + L
    a = cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, 0)
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (K, K)))
    a = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * L + 1, 2 * L + 1)))
    ff = a.copy()
    cv2.floodFill(ff, np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8), (0, 0), 1)
    a = a | (1 - ff)
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), L * 0.8)
    a = ((a > 0.5).astype(np.uint8) * 255)[pad:-pad, pad:-pad]
    return Image.fromarray(a).filter(ImageFilter.GaussianBlur(1.0))


# ---------------------------------------------------------------- PALETTE
def set_palette(photos):
    """Warna hiasan diambil dari tona gambar (versi pastel)."""
    global PINK, SAGE, BUTTER, ACCENTS
    px = []
    for p in photos:
        t = p.raw.copy()
        t.thumbnail((80, 80))
        px.append(np.asarray(t).reshape(-1, 3))
    px = np.concatenate(px).astype(np.float32)
    hsv = cv2.cvtColor(px.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV).reshape(-1, 3)
    keep = px[(hsv[:, 1] > 50) & (hsv[:, 2] > 60)]
    accents = []
    if len(keep) > 30:
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
        k = min(4, len(keep) // 10)
        _, lab, cen = cv2.kmeans(keep, k, None, crit, 2, cv2.KMEANS_PP_CENTERS)
        order = np.argsort(-np.bincount(lab.ravel(), minlength=k))
        for i in order:
            c = cen[i]
            accents.append(tuple(int(v * 0.5 + 238 * 0.5) for v in c))
    base = [(241, 190, 196), (168, 196, 160), (247, 224, 130)]
    accents = (accents + base)[:4]
    ACCENTS = accents
    PINK = base[0]
    SAGE = next((a for a in accents if a[1] >= a[0] and a[1] >= a[2]), base[1])
    BUTTER = base[2]


def strong(c, k=0.55):
    """Versi lebih pekat warna pastel (untuk garisan cutout / blok warna)."""
    h = cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_RGB2HSV)[0, 0].astype(int)
    h[1] = min(255, int(h[1] / k))
    h[2] = int(h[2] * 0.85)
    return tuple(int(v) for v in cv2.cvtColor(np.uint8([[h]]), cv2.COLOR_HSV2RGB)[0, 0])


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




def paper_stripes(w, h, color=None, seed=4):
    color = color or SAGE
    img = paper_texture(w, h, (249, 247, 241), seed).convert("RGBA")
    d = ImageDraw.Draw(img)
    for x in range(-h, w + h, 56):
        d.line([(x, 0), (x + h * 0.0, h)], fill=color + (150,), width=18)
    return img


def paper_panel2(kind, w, h, seed, edges="lrtb"):
    f = {"hearts": paper_hearts, "dots": paper_dots, "grid": paper_grid, "stripes": paper_stripes}[kind]
    p = f(w, h, seed=seed)
    p.putalpha(ImageChops.multiply(p.split()[-1], deckle_mask(w, h, edges, seed=seed)))
    return El(p)


def color_block(w, h, color, shape="rect", rad=0):
    lay = ss_canvas(w, h)
    d = ImageDraw.Draw(lay)
    if shape == "circle":
        d.ellipse([0, 0, w * SS - 1, h * SS - 1], fill=color + (255,))
    else:
        d.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=rad * SS, fill=color + (255,))
    return El(ss_done(lay))


def tape(length=170, height=46, color=(236, 226, 205)):
    """Pita kertas lut sinar (gaya film/minimal)."""
    img = Image.new("RGBA", (length, height), color + (190,))
    m = Image.new("L", img.size, 255)
    d = ImageDraw.Draw(m)
    rng = random.Random(length * 7 + height)
    for y in range(0, height, 6):
        d.rectangle([0, y, rng.randint(2, 7), y + 6], fill=0)
        d.rectangle([length - rng.randint(2, 7), y, length, y + 6], fill=0)
    img.putalpha(ImageChops.multiply(img.split()[-1], m))
    return El(img)


def dots_cluster(r=7, n=9, color=None, seed=0):
    color = color or INK
    rng = random.Random(seed)
    s = int(r * 14)
    lay = ss_canvas(s, s)
    d = ImageDraw.Draw(lay)
    for i in range(n):
        x, y = rng.uniform(r, s - r), rng.uniform(r, s - r)
        rr = r * rng.uniform(0.6, 1.2)
        d.ellipse([(x - rr) * SS, (y - rr) * SS, (x + rr) * SS, (y + rr) * SS], fill=color + (230,))
    return El(ss_done(lay))


# ---------------------------------------------------------------- FRAMES (tanpa tulisan)
def frame_print(iw, ih, seed=0, col=(252, 251, 248)):
    b = int(iw * 0.045)
    w, h = iw + 2 * b, ih + 2 * b
    card = paper_texture(w, h, col, seed, fiber=3).convert("RGBA")
    card.putalpha(deckle_mask(w, h, "lrtb", amp=4, seed=seed))
    return card, (b, b, b + iw, b + ih)


def frame_polaroid(iw, ih, seed=0, col=(252, 250, 246)):
    pad, bottom = int(iw * 0.065), int(iw * 0.26)
    w, h = iw + 2 * pad, ih + pad + bottom
    card = paper_texture(w, h, col, seed, fiber=3).convert("RGBA")
    return card, (pad, pad, pad + iw, pad + ih)


def frame_phone(iw, ih, seed=0, col=None):
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
    for x in (w * 0.18, w * 0.82):
        r = w * 0.032
        d.ellipse([x - r, top * 0.72 - r, x + r, top * 0.72 + r], outline=(215, 215, 215), width=3)
    sy = top + ih + bot * 0.5
    r = w * 0.105
    d.ellipse([w / 2 - r - 9, sy - r - 9, w / 2 + r + 9, sy + r + 9], outline=(255, 255, 255), width=6)
    d.ellipse([w / 2 - r, sy - r, w / 2 + r, sy + r], fill=(255, 255, 255))
    t = w * 0.075
    d.rounded_rectangle([w * 0.17 - t, sy - t, w * 0.17 + t, sy + t], radius=10, fill=SAGE)
    d.ellipse([w * 0.83 - t, sy - t, w * 0.83 + t, sy + t], fill=(62, 62, 66))
    for i in range(5):
        x = w / 2 + (i - 2) * w * 0.09
        rr = 7 if i == 2 else 4
        d.ellipse([x - rr, top + ih + bot * 0.17 - rr, x + rr, top + ih + bot * 0.17 + rr],
                  fill=(255, 214, 10) if i == 2 else (150, 150, 150))
    return body, (b, top, b + iw, top + ih)


FRAMES = {"print": frame_print, "polaroid": frame_polaroid, "phone": frame_phone}


def _prot_from(ph, box_img, size, offset=(0, 0), dil=25):
    """Topeng protect untuk potongan box_img (koordinat gambar) yang diskala ke size."""
    pm = ph.protect_map().crop(tuple(int(v) for v in box_img)).resize(size, RS.NEAREST)
    if dil:
        pm = Image.fromarray(cv2.dilate(np.asarray(pm), np.ones((dil, dil), np.uint8)))
    return pm


def framed(ph, kind, inner_w, window=None, aspect=None, seed=0, protect="person", col=None):
    im = ph.im
    if window is None:
        window = (0, 0, ph.W, ph.H)
    x0, y0, x1, y1 = window
    if aspect:
        ww, hh = x1 - x0, y1 - y0
        if ww / hh > aspect:
            nw = hh * aspect
            cx = min(max((x0 + x1) / 2, x0 + nw / 2), x1 - nw / 2)
            fxp = ph.focus[0] * ph.W
            cx = min(max(fxp, x0 + nw / 2), x1 - nw / 2) if window == (0, 0, ph.W, ph.H) else cx
            x0, x1 = cx - nw / 2, cx + nw / 2
        else:
            nh = ww / aspect
            cy = (y0 + y1) / 2
            if window == (0, 0, ph.W, ph.H):
                cy = min(max(ph.focus[1] * ph.H, y0 + nh / 2), y1 - nh / 2)
            y0, y1 = cy - nh / 2, cy + nh / 2
    s = inner_w / (x1 - x0)
    inner_h = round((y1 - y0) * s)
    kw = {"col": col} if col else {}
    card, box = FRAMES[kind](inner_w, inner_h, seed, **kw)
    card.paste(fit(im.crop((int(x0), int(y0), int(x1), int(y1))), inner_w, inner_h), box[:2])
    prot = Image.new("L", card.size, 0)
    if protect == "all":
        prot = protect_all(card)
    elif protect == "person":
        prot.paste(_prot_from(ph, (x0, y0, x1, y1), (inner_w, inner_h)), box[:2])
    info = dict(s=s, ox=box[0] - x0 * s, oy=box[1] - y0 * s, box=box, window=(x0, y0, x1, y1))
    return El(card, prot), info


def popout_window(ph, aspect, head_frac=0.25, widen=1.55):
    bx0, by0, bx1, by1 = ph.bbox
    bw, bh = bx1 - bx0, by1 - by0
    top = by0 + head_frac * bh
    w = bw * widen
    h = w / aspect
    need = (by1 - top) * 1.08
    if h < need:
        h = need
        w = h * aspect
    w = min(w, ph.W)
    cx = (bx0 + bx1) / 2
    x0 = max(0, min(cx - w / 2, ph.W - w))
    y1 = min(ph.H, top + h)
    return (x0, top, x0 + w, y1)


def outline_layer(alpha, px, color):
    a = outline_alpha(alpha, px)
    img = Image.new("RGBA", alpha.size, color + (0,))
    img.putalpha(a)
    return img


def popout(ph, kind, inner_w, aspect, seed=0, head_frac=0.25, style="loose", color=(255, 255, 255), frame_col=None):
    """Orang keluar dari atas bingkai (kepala & badan atas di luar bingkai)."""
    outline = 12 if style != "shadow" else 0
    win = popout_window(ph, aspect, head_frac=head_frac)
    el, info = framed(ph, kind, inner_w, window=win, aspect=aspect, seed=seed, protect="all", col=frame_col)
    s, ox, oy, box = info["s"], info["ox"], info["oy"], info["box"]
    m = ph.loose(0.03) if style == "loose" else ph.mask
    bb = m.point(lambda v: 255 if v > 128 else 0).getbbox() or ph.bbox
    bx0, by0, bx1, by1 = bb
    sx0, sy0, sx1 = ox + bx0 * s, oy + by0 * s, ox + bx1 * s
    pad_o = max(outline, 6) + 6
    padT = max(0, int(-sy0) + pad_o)
    padL = max(0, int(-sx0) + pad_o)
    padR = max(0, int(sx1 - el.size[0]) + pad_o)
    W, H = el.size[0] + padL + padR, el.size[1] + padT
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(el.img, (padL, padT))
    sw, sh = max(1, round((bx1 - bx0) * s)), max(1, round((by1 - by0) * s))
    subj = fit(ph.im.crop(bb), sw, sh).convert("RGBA")
    a = m.crop(bb).resize((sw, sh), RS.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    px, py = round(sx0) + padL, round(sy0) + padT
    lim = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(lim).rectangle([0, 0, sw, max(0, box[3] + padT - py)], fill=255)
    a = ImageChops.multiply(a, lim)
    full_a = Image.new("L", (W, H), 0)
    full_a.paste(a, (px, py))
    outside = Image.new("L", (W, H), 255)
    ImageDraw.Draw(outside).rectangle([box[0] + padL + max(outline, 4), box[1] + padT + max(outline, 4),
                                       box[2] + padL - max(outline, 4), box[3] + padT], fill=0)
    out_part = np.asarray(ImageChops.multiply(full_a, outside)) > 100
    nl, lab, st, _ = cv2.connectedComponentsWithStats(out_part.astype(np.uint8))
    keep = np.isin(lab, [i for i in range(1, nl) if st[i, cv2.CC_STAT_AREA] > 2500]).astype(np.uint8)
    keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    big = Image.fromarray(keep * 255)
    sh_a = full_a.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * (0.25 if outline else 0.45)))
    shadow = Image.new("RGBA", (W, H), (60, 45, 35, 0))
    shadow.putalpha(ImageChops.multiply(sh_a, outside))
    base.alpha_composite(shadow, (6, 10))
    if outline:
        ol = outline_layer(big, outline, color)
        ol.putalpha(ImageChops.multiply(ol.split()[-1], outside.filter(ImageFilter.GaussianBlur(outline / 2))))
        base.alpha_composite(ol)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(subj, (px, py))
    layer.putalpha(full_a)
    base.alpha_composite(layer)
    return El(base, protect_all(base))


def tangent_lines(c1, r1, c2, r2):
    dx, dy = c2[0] - c1[0], c2[1] - c1[1]
    d = math.hypot(dx, dy)
    th = math.atan2(dy, dx)
    al = math.acos(max(-1, min(1, (r1 - r2) / max(d, 1e-3))))
    return [((c1[0] + r1 * math.cos(th + s * al), c1[1] + r1 * math.sin(th + s * al)),
             (c2[0] + r2 * math.cos(th + s * al), c2[1] + r2 * math.sin(th + s * al))) for s in (1, -1)]


def zoom_target(ph, rng):
    if not ph.faces:
        bx0, by0, bx1, by1 = ph.bbox
        return ((bx0 + bx1) / 2, by0 + (by1 - by0) * 0.2, (bx1 - bx0) * 0.25)
    fs = sorted(ph.faces, key=lambda b: -(b[1] + b[3]) / 2)
    f = fs[0] if rng.random() < 0.6 else rng.choice(fs)
    w = f[2] - f[0]
    r = min(1.75 * w, ph.W * 0.3)
    return ((f[0] + f[2]) / 2, min(ph.H - r, (f[1] + f[3]) / 2 + 0.55 * w), r)


def zoom_bubble_el(ph, inner_w, aspect, bubble_r, rng, seed=0, ring_col=(255, 255, 255), kind="print"):
    """Foto dalam bingkai + bulatan zoom (bahagian kecil dibesarkan) dengan garis penyambung."""
    if ph.bbox:
        bx0, by0, bx1, by1 = ph.bbox
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        w = (bx1 - bx0) * rng.uniform(1.9, 2.5)
    else:
        cx, cy, w = ph.W / 2, ph.H / 2, ph.W
    w = min(max(w, ph.W * 0.45), ph.W)
    h = min(w / aspect, ph.H)
    w = h * aspect
    x0 = max(0, min(cx - w / 2, ph.W - w))
    y0 = max(0, min(cy - h / 2, ph.H - h))
    el, info = framed(ph, kind, inner_w, window=(x0, y0, x0 + w, y0 + h), aspect=aspect, seed=seed, protect="person")
    s, ox, oy = info["s"], info["ox"], info["oy"]
    tx, ty, tr = zoom_target(ph, rng)
    c1 = (ox + tx * s, oy + ty * s)
    r1 = tr * s
    fx = (c1[0]) / el.size[0]
    fy = (c1[1]) / el.size[1]
    dxs = 1 if fx < 0.5 else -1
    dys = 1 if fy < 0.55 else -1
    off = (dxs * rng.uniform(0.85, 1.05) * (bubble_r + r1 + 40), dys * rng.uniform(0.75, 1.0) * (bubble_r + r1 + 20))
    c2 = (c1[0] + off[0], c1[1] + off[1])
    ring = 12
    R = bubble_r + ring
    xmn, ymn = min(0, c2[0] - R - 20), min(0, c2[1] - R - 20)
    xmx, ymx = max(el.size[0], c2[0] + R + 20), max(el.size[1], c2[1] + R + 20)
    W, H = int(xmx - xmn), int(ymx - ymn)
    dx, dy = int(-xmn), int(-ymn)
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base.alpha_composite(el.img, (dx, dy))
    prot = Image.new("L", (W, H), 0)
    prot.paste(el.prot, (dx, dy))
    c1 = (c1[0] + dx, c1[1] + dy)
    c2 = (c2[0] + dx, c2[1] + dy)
    lay = ss_canvas(W, H)
    d = ImageDraw.Draw(lay)
    for p, q in tangent_lines(c1, r1, c2, R):
        d.line([(p[0] * SS, p[1] * SS), (q[0] * SS, q[1] * SS)], fill=ring_col + (235,), width=4 * SS)
    d.ellipse([(c1[0] - r1) * SS, (c1[1] - r1) * SS, (c1[0] + r1) * SS, (c1[1] + r1) * SS],
              outline=ring_col + (255,), width=5 * SS)
    lines = ss_done(lay)
    sh = lines.split()[-1].filter(ImageFilter.GaussianBlur(3)).point(lambda v: int(v * 0.35))
    shimg = Image.new("RGBA", (W, H), (40, 30, 25, 0))
    shimg.putalpha(sh)
    base.alpha_composite(shimg, (2, 3))
    base.alpha_composite(lines)
    bub = circle_el(ph.im, 2 * bubble_r, ring, ring_col, crop=(tx - tr, ty - tr, tx + tr, ty + tr)).img
    bs = bub.split()[-1].filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.35))
    bsh = Image.new("RGBA", bub.size, (50, 40, 30, 0))
    bsh.putalpha(bs)
    bx, by = int(c2[0] - R), int(c2[1] - R)
    base.alpha_composite(bsh, (bx + 8, by + 14))
    base.alpha_composite(bub, (bx, by))
    ImageDraw.Draw(prot).ellipse([bx, by, bx + 2 * R, by + 2 * R], fill=255)
    return El(base, prot)


def circle_el(im, D, ring=12, ring_col=(255, 255, 255), crop=None, focus=(0.5, 0.5), ph=None):
    """Foto bulat bercincin. crop = kawasan (x0,y0,x1,y1) dalam gambar."""
    if crop:
        x0, y0, x1, y1 = [int(v) for v in crop]
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(im.size[0], x1), min(im.size[1], y1)
        src = fit(im.crop((x0, y0, x1, y1)), D, D)
        box = (x0, y0, x1, y1)
    else:
        box = crop_box(im.size[0], im.size[1], D, D, *focus)
        src = fit(im.crop(box), D, D)
    R = D // 2 + ring
    out = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0))
    rm = Image.new("L", (2 * R * SS, 2 * R * SS), 0)
    ImageDraw.Draw(rm).ellipse([0, 0, 2 * R * SS - 1, 2 * R * SS - 1], fill=255)
    rm = rm.resize((2 * R, 2 * R), RS.LANCZOS)
    ringimg = Image.new("RGBA", (2 * R, 2 * R), ring_col + (255,))
    ringimg.putalpha(rm)
    if ring:
        out.alpha_composite(ringimg)
    cm = Image.new("L", (D * SS, D * SS), 0)
    ImageDraw.Draw(cm).ellipse([0, 0, D * SS - 1, D * SS - 1], fill=255)
    src = src.convert("RGBA")
    src.putalpha(cm.resize((D, D), RS.LANCZOS))
    out.alpha_composite(src, (ring, ring))
    prot = Image.new("L", out.size, 0)
    if ph is not None:
        prot.paste(_prot_from(ph, box, (D, D), dil=15), (ring, ring))
        prot = ImageChops.multiply(prot, rm)
    return El(out, prot)


def scene_el(ph, w, h, edges="lrtb", seed=0, crop=None, amp=9, focus=None):
    """Foto koyak tepi (tanpa bingkai). protect = orang dalam gambar."""
    box0 = crop or (0, 0, ph.W, ph.H)
    iw, ih = box0[2] - box0[0], box0[3] - box0[1]
    fx, fy = focus or (0.5, 0.5)
    if crop is None and focus is None:
        fx, fy = ph.focus
    b = crop_box(iw, ih, w, h, fx, fy)
    box = (box0[0] + b[0], box0[1] + b[1], box0[0] + b[2], box0[1] + b[3])
    p = fit(ph.im.crop(box), w, h).convert("RGBA")
    if edges:
        p.putalpha(deckle_mask(w, h, edges, amp=amp, seed=seed))
    return El(p, _prot_from(ph, box, (w, h), dil=15))


def cutout_el(ph, height, style="loose", color=(255, 255, 255)):
    """Cutout orang. style: loose / tight / color / shadow. Kepala & muka dilindungi."""
    m = ph.loose(0.035) if style == "loose" else ph.mask
    bb = m.point(lambda v: 255 if v > 128 else 0).getbbox()
    if ph.lowres:   # gambar kecil: jangan besarkan terlalu banyak (kabur)
        height = min(height, int((bb[3] - bb[1]) * 1.7))
    sub, a = ph.im.crop(bb), m.crop(bb)
    f = height / sub.size[1]
    size = (max(1, round(sub.size[0] * f)), height)
    sub = fit(sub, *size)
    a = a.resize(size, RS.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    outline = 0 if style == "shadow" else 12
    pad = outline + 6
    W, H = size[0] + 2 * pad, size[1] + 2 * pad
    alpha = Image.new("L", (W, H), 0)
    alpha.paste(a, (pad, pad))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if outline:
        col = color if style == "color" else (255, 255, 255)
        img.alpha_composite(outline_layer(alpha, outline, col))
        if style == "color":   # garisan putih nipis di dalam garisan warna
            img.alpha_composite(outline_layer(alpha, 4, (255, 255, 255)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer.paste(sub, (pad, pad))
    layer.putalpha(alpha)
    img.alpha_composite(layer)
    prot = Image.new("L", (W, H), 0)
    pd = ImageDraw.Draw(prot)
    for (x0, y0, x1, y1) in ph.faces:
        pd.rectangle([pad + (x0 - bb[0]) * f, pad + (y0 - bb[1]) * f, pad + (x1 - bb[0]) * f,
                      pad + (y1 - bb[1]) * f], fill=255)
    ah = np.asarray(ph.mask.crop(bb).resize(size, RS.NEAREST)) > 128
    rows = np.where(ah.any(1))[0]
    if len(rows):
        he = rows[0] + int((rows[-1] - rows[0]) * 0.17)
        cols = np.where(ah[rows[0]:he].any(0))[0]
        if len(cols):
            pd.rectangle([pad + cols[0], pad + rows[0], pad + cols[-1], pad + he], fill=255)
    return El(img, prot)


def polaroid_el(ph, w, seed=0, aspect=1 / 1.05):
    el, _ = framed(ph, "polaroid", w, aspect=aspect, seed=seed, protect="person")
    return el


def print_el(ph, w, aspect, seed=0, col=None):
    el, _ = framed(ph, "print", w, aspect=aspect, seed=seed, protect="person", col=col)
    return el


def film_strip_el(phs, frame_w, seed=0, vertical=True, land=True):
    """Jalur filem: beberapa foto dalam bingkai filem dengan lubang sprocket."""
    n = len(phs)
    fw = frame_w
    fh = int(fw * (0.72 if land else 1.15))
    side, gap, endp = int(fw * 0.16), int(fw * 0.06), int(fw * 0.12)
    W = fw + 2 * side
    H = n * fh + (n - 1) * gap + 2 * endp
    strip = Image.new("RGBA", (W, H), (24, 22, 21, 255))
    d = ImageDraw.Draw(strip)
    hw, hh = int(side * 0.42), int(side * 0.3)
    for y in range(int(hh), H - hh, int(hh * 2.4)):
        for x in (side / 2, W - side / 2):
            d.rounded_rectangle([x - hw / 2, y, x + hw / 2, y + hh], radius=3, fill=(236, 230, 220, 255))
    prot = Image.new("L", (W, H), 0)
    for i, ph in enumerate(phs):
        y = endp + i * (fh + gap)
        box = crop_box(ph.W, ph.H, fw, fh, *ph.focus)
        strip.paste(fit(ph.im.crop(box), fw, fh), (side, y))
        prot.paste(_prot_from(ph, box, (fw, fh), dil=15), (side, y))
    el = El(strip, prot)
    if not vertical:
        el = el.rotate(90)
    return el


def arch_el(ph, w, h, border=18, col=(255, 255, 255)):
    """Foto dalam bingkai gerbang (atas bulat)."""
    W, H = w + 2 * border, h + 2 * border

    def arch_mask(ww, hh):
        m = Image.new("L", (ww * SS, hh * SS), 0)
        d = ImageDraw.Draw(m)
        r = ww * SS / 2
        d.ellipse([0, 0, ww * SS - 1, 2 * r], fill=255)
        d.rectangle([0, r, ww * SS - 1, hh * SS - 1], fill=255)
        return m.resize((ww, hh), RS.LANCZOS)

    out = Image.new("RGBA", (W, H), col + (0,))
    out.putalpha(arch_mask(W, H))
    box = crop_box(ph.W, ph.H, w, h, *ph.focus)
    p = fit(ph.im.crop(box), w, h).convert("RGBA")
    p.putalpha(arch_mask(w, h))
    out.alpha_composite(p, (border, border))
    prot = Image.new("L", (W, H), 0)
    prot.paste(_prot_from(ph, box, (w, h), dil=15), (border, border))
    return El(out, prot)


def ticket_el(ph, w, h, stub_col, seed=0):
    """Tiket menegak: foto di atas, keratan berwarna di bawah, garis putus dan takuk bulat."""
    ph_h = int(h * 0.74)
    out = paper_texture(w, h, (252, 250, 245), seed, fiber=3).convert("RGBA")
    pad = int(w * 0.05)
    box = crop_box(ph.W, ph.H, w - 2 * pad, ph_h - 2 * pad, *ph.focus)
    out.paste(fit(ph.im.crop(box), w - 2 * pad, ph_h - 2 * pad), (pad, pad))
    d = ImageDraw.Draw(out)
    d.rectangle([pad, ph_h + pad // 2, w - pad, h - pad], fill=stub_col + (255,))
    rng = random.Random(seed)
    x = pad * 2
    while x < w - pad * 2:   # garis menegak hiasan (bukan tulisan)
        bw = rng.choice([2, 3, 5, 8])
        d.rectangle([x, h - pad - int((h - ph_h) * 0.45), x + bw, h - pad * 2], fill=strong(stub_col, 0.4) + (255,))
        x += bw + rng.choice([3, 4, 6])
    for x in range(pad, w - pad, 22):
        d.line([(x, ph_h), (x + 11, ph_h)], fill=(190, 182, 170, 255), width=3)
    m = Image.new("L", (w * SS, h * SS), 255)
    md = ImageDraw.Draw(m)
    r = int(w * 0.06) * SS
    for cx in (0, w * SS):
        md.ellipse([cx - r, ph_h * SS - r, cx + r, ph_h * SS + r], fill=0)
    md_r = int(w * 0.04) * SS
    md.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=md_r, outline=0, width=1)
    out.putalpha(ImageChops.multiply(out.split()[-1], m.resize((w, h), RS.LANCZOS)))
    prot = Image.new("L", (w, h), 0)
    prot.paste(_prot_from(ph, box, (w - 2 * pad, ph_h - 2 * pad), dil=15), (pad, pad))
    return El(out, prot)



# ---------------------------------------------------------------- CANVAS
class Canvas:
    def __init__(self, n, W, H, vibe, rng):
        self.n, self.SW, self.H = n, W, H
        self.W = n * W
        self.seams = [W * i for i in range(1, n)]
        self.prot = Image.new("L", (self.W, H), 0)
        self.log = []
        self.vibe = vibe
        self.img = self._base(vibe, rng)

    def _base(self, vibe, rng):
        W, H = self.W, self.H
        if vibe == "film":
            img = paper_texture(W, H, (34, 31, 29), seed=rng.randint(0, 999), fiber=4).convert("RGBA")
            for _ in range(max(2, self.n)):   # kebocoran cahaya lembut
                r = rng.randint(300, 700)
                g = Image.new("L", (2 * r, 2 * r), 0)
                ImageDraw.Draw(g).ellipse([r * 0.45, r * 0.45, r * 1.55, r * 1.55], fill=80)
                g = g.filter(ImageFilter.GaussianBlur(r / 2.5))
                leak = Image.new("RGBA", g.size, (255, 160, 90, 0))
                leak.putalpha(g)
                self._paste(leak, rng.randint(-r, W - r), rng.randint(-r, H - r), img)
            return img
        if vibe == "minimal":
            t = ACCENTS[0]
            base = tuple(int(c * 0.12 + 250 * 0.88) for c in t)
            return paper_texture(W, H, base, seed=rng.randint(0, 999), fiber=2).convert("RGBA")
        if vibe == "majalah":
            return paper_texture(W, H, (250, 248, 244), seed=rng.randint(0, 999), fiber=2).convert("RGBA")
        return paper_texture(W, H, CREAM, seed=rng.randint(0, 999), fiber=5).convert("RGBA")

    def _paste(self, im, x, y, target=None):
        target = target if target is not None else self.img
        layer = Image.new("RGBA", target.size, (0, 0, 0, 0))
        layer.paste(im, (int(x), int(y)))
        target.alpha_composite(layer)

    def _bad(self, el, x):
        cols = np.where(np.asarray(el.prot).any(0))[0]
        if not len(cols):
            return False
        for sg in np.split(cols, np.where(np.diff(cols) > 1)[0] + 1):
            c0, c1 = x + sg[0], x + sg[-1]
            if any(c0 - SEAM_MARGIN < s < c1 + SEAM_MARGIN for s in self.seams):
                return True
        return False

    def put(self, el, x, y, shadow=0.28, blur=16, off=(10, 16), avoid=True, name="", lo=None, hi=None):
        """Letak elemen (x,y = tengah). Kalau muka kena garis potong, anjak mendatar (dalam had lo..hi)."""
        if el is None:
            return None
        w, h = el.size
        x0, y0 = int(x - w / 2), int(y - h / 2)
        if avoid and self._bad(el, x0):
            moved = False
            for d in range(10, 800, 10):
                for s in (d, -d):
                    nx = x0 + s
                    if lo is not None and nx + w / 2 < lo:
                        continue
                    if hi is not None and nx + w / 2 > hi:
                        continue
                    if not self._bad(el, nx):
                        self.log.append(f"anjak {name} {s:+d}px")
                        x0, moved = nx, True
                        break
                if moved:
                    break
        if shadow:
            a = el.img.split()[-1]
            sa = Image.new("L", (w + 4 * blur, h + 4 * blur), 0)
            sa.paste(a, (2 * blur, 2 * blur))
            sa = sa.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * shadow))
            col = Image.new("RGBA", sa.size, (40, 30, 25, 255) if self.vibe == "film" else (70, 55, 45, 255))
            col.putalpha(sa)
            self._paste(col, x0 - 2 * blur + off[0], y0 - 2 * blur + off[1])
        self._paste(el.img, x0, y0)
        p = Image.new("L", (self.W, self.H), 0)
        p.paste(el.prot, (x0, y0))
        self.prot = ImageChops.lighter(self.prot, p)
        return (x0, y0, x0 + w, y0 + h)

    def busy(self, rect):
        x0, y0, x1, y1 = [int(v) for v in rect]
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(self.W, x1), min(self.H, y1)
        if x1 <= x0 or y1 <= y0:
            return 1e9
        return float((np.asarray(self.prot)[y0:y1, x0:x1] > 0).mean())

    def check_seams(self):
        p = np.asarray(self.prot) > 0
        return [i + 1 for i, s in enumerate(self.seams) if p[:, max(0, s - SEAM_MARGIN):s + SEAM_MARGIN].any()]

    def finish(self, seed):
        rng = np.random.default_rng(seed)
        a = np.asarray(self.img.convert("RGB")).astype(np.float32)
        a += rng.normal(0, 3.0 if self.vibe == "film" else 2.2, a.shape[:2])[..., None]
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------------------------------------------------------------- SLIDE CONTEXT
class Slide:
    def __init__(self, i, W, H, seed, opts, vibe):
        self.i, self.W, self.H, self.seed = i, W, H, seed
        self.ox = i * W
        self.cx = self.ox + W / 2
        self.f = min(1.0, H / 1350) if H <= 1350 else min(1.15, H / 1350 * 0.85)   # 9:16: elemen lebih besar
        self.rng = random.Random(seed)
        self.opts, self.vibe = opts, vibe
        self.decor = int(opts.get("decor", 1))
        r = self.rng
        self.frame_col = (245, 240, 232) if vibe == "film" else (252, 251, 248)
        self.ring_col = (255, 255, 255)
        if vibe in ("minimal", "majalah") and r.random() < 0.5:
            self.ring_col = strong(r.choice(ACCENTS), 0.7)

    def X(self, fx):
        return self.ox + fx * self.W

    def cut(self, ph, popout=False):
        r, mode = self.rng, self.opts.get("cutout", "rawak")
        color = strong(r.choice(ACCENTS), 0.6)
        if mode == "longgar":
            return "loose", color
        if mode == "ketat":
            return ("tight" if ph.solid >= 0.5 else "loose"), color
        if mode == "campur":
            ch = ["loose", "tight", "color"] + (["shadow"] if ph.solid > 0.85 and not ph.lowres else [])
            return r.choice(ch), color
        if ph.solid < 0.75:
            return ("loose" if r.random() < 0.75 else "color"), color
        return r.choices(["loose", "tight", "color"], [0.45, 0.35, 0.2])[0], color


def washi_for(S, length):
    if S.vibe in ("film", "minimal"):
        return tape(length, 44)
    return washi(length, color=S.rng.choice(ACCENTS), seed=S.rng.randint(0, 99))


def corner_spot(S, which=None):
    spots = [(0.2, 0.14), (0.8, 0.14), (0.2, 0.87), (0.8, 0.87)]
    fx, fy = spots[which] if which is not None else S.rng.choice(spots)
    return S.X(fx), fy * S.H


# ---------------------------------------------------------------- TEMPLATES
def _companion(c, S, ph, avoid_center=True):
    w = int(S.rng.uniform(270, 320) * S.f)
    el = polaroid_el(ph, w, seed=S.rng.randint(0, 999)).rotate(S.rng.uniform(-10, 10))
    x, y = corner_spot(S)
    c.put(el, x, y, shadow=0.28, name="companion", lo=S.ox + 40, hi=S.ox + S.W - 40)


def t_popout(kind):
    def fn(c, S, phs):
        r, f, ph = S.rng, S.f, phs[0]
        w0, asp = {"print": (r.uniform(700, 780), r.uniform(.78, .9)),
                   "polaroid": (r.uniform(560, 640), r.uniform(.84, .95)),
                   "phone": (r.uniform(450, 500), r.uniform(.6, .64))}[kind]
        if S.H < 1200:
            asp = min(1.05, asp * 1.15)
        elif S.H > 1600 and kind != "phone":
            asp *= 0.82
        if len(phs) > 1:
            _companion(c, S, phs[1])
        style, col = S.cut(ph, popout=True)
        el = popout(ph, kind, int(w0 * f), asp, seed=S.seed, head_frac=r.uniform(.22, .34), style=style, color=col,
                    frame_col=S.frame_col if kind != "phone" else None)
        el = el.rotate(r.uniform(2, 5) * r.choice([-1, 1])).fit(S.W - 70, S.H - 40)
        c.put(el, S.cx + r.uniform(-45, 45), S.H * 0.52 + r.uniform(-20, 20), shadow=0.35, blur=20,
              name="popout", lo=S.ox + 30, hi=S.ox + S.W - 30)
    return fn


def t_zoom_bubble(c, S, phs):
    r, f, ph = S.rng, S.f, phs[0]
    asp = r.uniform(.8, .9) if S.H >= 1200 else r.uniform(.95, 1.05)
    if S.H > 1600:
        asp = r.uniform(.68, .76)
    if len(phs) > 1:
        _companion(c, S, phs[1])
    el = zoom_bubble_el(ph, int(r.uniform(700, 780) * f), asp, int(r.uniform(185, 230) * f), r, seed=S.seed,
                        ring_col=S.ring_col)
    el = el.rotate(r.uniform(-2.5, 2.5)).fit(S.W - 40, S.H - 30)
    c.put(el, S.cx, S.H / 2, shadow=0.32, blur=18, name="zoom", lo=S.ox + 20, hi=S.ox + S.W - 20)


def t_zoom_cutout(c, S, phs):
    r, f, ph = S.rng, S.f, phs[0]
    side = r.choice([-1, 1])
    asp = 0.8 if S.H >= 1200 else 0.95
    pr = print_el(ph, int(r.uniform(520, 600) * f), asp, seed=S.seed, col=S.frame_col)
    pr = pr.rotate(side * r.uniform(2, 5)).fit(S.W * 0.62, S.H * 0.7)
    c.put(pr, S.cx + side * 150 * f, S.H * r.uniform(.36, .44), shadow=0.3, name="print",
          lo=S.ox + 30, hi=S.ox + S.W - 30)
    style, col = S.cut(ph)
    cu = cutout_el(ph, int(S.H * r.uniform(.6, .7)), style, col).fit(S.W * 0.6, S.H * 0.75)
    c.put(cu, S.cx - side * 180 * f, S.H - cu.size[1] / 2 - 20 * f, shadow=0.32 if style != "shadow" else 0.5,
          blur=14, name="zoomcut", lo=S.ox + 30, hi=S.ox + S.W - 30)


def t_cutout_scene(c, S, phs):
    r, f = S.rng, S.f
    sc, cu_ph = phs[0], phs[1]
    w = int(r.uniform(800, 880) * f)
    h = int(min(S.H - 110, w * r.uniform(1.2, 1.35)))
    el = scene_el(sc, w, h, edges="lrtb", seed=S.seed).rotate(r.uniform(-2, 2))
    c.put(el, S.cx + r.uniform(-20, 20), S.H * 0.46, shadow=0.24, name="scene", lo=S.ox + 30, hi=S.ox + S.W - 30)
    style, col = S.cut(cu_ph)
    cu = cutout_el(cu_ph, int(S.H * r.uniform(.58, .68)), style, col).fit(S.W * 0.7, S.H * 0.72)
    c.put(cu, S.cx + r.uniform(-140, 140) * f, S.H - cu.size[1] / 2 - 18 * f, shadow=0.32, blur=14,
          name="scenecut", lo=S.ox + 30, hi=S.ox + S.W - 30)


def t_polaroid_stack(c, S, phs):
    r, f = S.rng, S.f
    n = len(phs)
    if n == 1:
        lay = [[(0.5, 0.5)]]
        w = r.uniform(560, 620)
    elif n == 2:
        lay = [[(0.36, 0.32), (0.64, 0.67)], [(0.64, 0.31), (0.36, 0.67)], [(0.42, 0.3), (0.58, 0.69)]]
        w = r.uniform(430, 480)
    else:
        lay = [[(0.32, 0.25), (0.7, 0.48), (0.37, 0.76)], [(0.68, 0.24), (0.3, 0.5), (0.65, 0.77)],
               [(0.3, 0.3), (0.71, 0.32), (0.5, 0.73)]]
        w = r.uniform(360, 410)
    pos = r.choice(lay)
    for ph, (fx, fy) in zip(phs, pos):
        el = polaroid_el(ph, int(w * f), seed=r.randint(0, 999)).rotate(r.uniform(-9, 9))
        el = el.fit(S.W * 0.75, S.H * 0.62)
        x, y = S.X(fx + r.uniform(-.03, .03)), S.H * (fy + r.uniform(-.02, .02))
        c.put(el, x, y, shadow=0.3, name="polaroid", lo=S.ox + 30, hi=S.ox + S.W - 30)
        if S.decor and r.random() < 0.55:
            c.put(washi_for(S, int(170 * f)).rotate(r.uniform(-35, 35)), x + r.uniform(-60, 60) * f,
                  y - el.size[1] / 2 + 15, shadow=0.1, blur=5, avoid=False)


def t_film_strip(c, S, phs):
    r, f = S.rng, S.f
    land = r.random() < 0.7
    fw = int(r.uniform(400, 460) * f)
    el = film_strip_el(phs, fw, seed=S.seed, land=land)
    el = el.rotate(r.uniform(3, 8) * r.choice([-1, 1])).fit(S.W - 80, S.H - 50)
    c.put(el, S.cx + r.uniform(-40, 40), S.H / 2, shadow=0.35, blur=18, name="film", lo=S.ox + 30, hi=S.ox + S.W - 30)
    if S.decor:
        c.put(tape(int(150 * f), 42).rotate(r.uniform(-20, 20)), S.cx + r.uniform(-80, 80), S.H * 0.06 + 30,
              shadow=0.1, blur=5, avoid=False)


def t_grid_torn(c, S, phs):
    r, f = S.rng, S.f
    tw, gap = int(min(S.W - 70, r.uniform(860, 930) * f)), int(22 * f)
    cw = (tw - gap) // 2
    ch = int(min(cw * 1.3, (S.H - 130 - gap) / 2))
    th = 2 * ch + gap
    x0, y0 = S.cx - tw / 2, S.H / 2 - th / 2
    if len(phs) >= 4:
        cells = [(0, 0, cw, ch), (cw + gap, 0, cw, ch), (0, ch + gap, cw, ch), (cw + gap, ch + gap, cw, ch)]
    else:
        tall = r.choice([0, 1])
        cells = ([(0, 0, cw, th)] + [(cw + gap, 0, cw, ch), (cw + gap, ch + gap, cw, ch)]) if tall == 0 else \
                ([(cw + gap, 0, cw, th)] + [(0, 0, cw, ch), (0, ch + gap, cw, ch)])
    for ph, (cx, cy, w, h) in zip(phs, cells):
        el = scene_el(ph, int(w), int(h), edges="lrtb", seed=r.randint(0, 999), amp=6).rotate(r.uniform(-2.5, 2.5))
        c.put(el, x0 + cx + w / 2 + r.uniform(-8, 8), y0 + cy + h / 2 + r.uniform(-8, 8), shadow=0.24, blur=12,
              name="grid", lo=S.ox + 30, hi=S.ox + S.W - 30)


def t_arch(c, S, phs):
    r, f, ph = S.rng, S.f, phs[0]
    w = int(r.uniform(620, 700) * f)
    h = int(min(w * r.uniform(1.35, 1.5), S.H - 150))
    col = S.ring_col if r.random() < 0.6 else S.frame_col
    el = arch_el(ph, w, h, border=int(18 * f), col=col).rotate(r.uniform(-1.5, 1.5))
    x = S.cx + r.uniform(-40, 40)
    c.put(el, x, S.H * 0.48, shadow=0.3, blur=18, name="arch", lo=S.ox + 30, hi=S.ox + S.W - 30)
    if len(phs) > 1:
        side = r.choice([-1, 1])
        p2 = phs[1]
        if p2.cut_ok:
            style, colr = S.cut(p2)
            cu = cutout_el(p2, int(S.H * r.uniform(.36, .44)), style, colr).fit(S.W * 0.45, S.H * 0.5)
            c.put(cu, S.cx + side * 300 * f, S.H - cu.size[1] / 2 - 25 * f, shadow=0.3, blur=12, name="archcut",
                  lo=S.ox + 30, hi=S.ox + S.W - 30)
        else:
            ce = circle_el(p2.im, int(r.uniform(240, 280) * f), 10, S.ring_col, focus=p2.focus, ph=p2)
            c.put(ce, S.cx + side * 320 * f, S.H * 0.8, shadow=0.3, blur=12, name="archcircle",
                  lo=S.ox + 30, hi=S.ox + S.W - 30)


def t_circles(c, S, phs):
    r, f = S.rng, S.f
    D = int(r.uniform(620, 700) * f)
    bx, by = S.cx + r.uniform(-60, 60), S.H * r.uniform(.42, .5)
    big = circle_el(phs[0].im, D, int(14 * f), S.ring_col, focus=phs[0].focus, ph=phs[0])
    c.put(big, bx, by, shadow=0.3, blur=18, name="circle", lo=S.ox + 30, hi=S.ox + S.W - 30)
    angs = r.sample([35, 145, 215, 325], k=max(0, len(phs) - 1))
    for ph, a in zip(phs[1:], angs):
        d = int(r.uniform(200, 280) * f)
        el = circle_el(ph.im, d, int(10 * f), S.ring_col, focus=ph.focus, ph=ph)
        rr = D / 2 + d * 0.15
        x = min(max(bx + rr * math.cos(math.radians(a)), S.ox + d / 2 + 50), S.ox + S.W - d / 2 - 50)
        y = min(max(by + rr * math.sin(math.radians(a)), d / 2 + 30), S.H - d / 2 - 30)
        c.put(el, x, y, shadow=0.3, blur=12, name="circle2", lo=S.ox + 30, hi=S.ox + S.W - 30)


def t_ticket(c, S, phs):
    r, f = S.rng, S.f
    w = int(r.uniform(500, 560) * f)
    h = int(min(w * 1.75, S.H - 120))
    side = r.choice([-1, 1])
    if len(phs) > 1:
        e2 = ticket_el(phs[1], int(w * 0.82), int(h * 0.82), r.choice(ACCENTS), seed=S.seed + 1)
        e2 = e2.rotate(-side * r.uniform(5, 9))
        c.put(e2, S.cx - side * 190 * f, S.H * 0.45, shadow=0.28, name="ticket2", lo=S.ox + 30, hi=S.ox + S.W - 30)
    el = ticket_el(phs[0], w, h, r.choice(ACCENTS), seed=S.seed).rotate(side * r.uniform(3, 7))
    c.put(el, S.cx + side * (90 if len(phs) > 1 else 0) * f, S.H * 0.52, shadow=0.32, name="ticket",
          lo=S.ox + 30, hi=S.ox + S.W - 30)


def t_fullbleed(c, S, phs):
    r, ph = S.rng, phs[0]
    box = crop_box(ph.W, ph.H, S.W, S.H, *ph.focus)
    s = S.W / (box[2] - box[0])
    near_edge = any(((f[0] - box[0]) * s < 90) or ((box[2] - f[2]) * s < 90) for f in ph.faces
                    if box[0] <= (f[0] + f[2]) / 2 <= box[2])
    if near_edge:   # muka dekat tepi: guna foto koyak sedikit kecil supaya boleh dianjak
        el = scene_el(ph, S.W - 90, S.H - 90, edges="lrtb", seed=S.seed)
        c.put(el, S.cx, S.H / 2, shadow=0.25, name="full", lo=S.ox + 30, hi=S.ox + S.W - 30)
    else:
        el = El(fit(ph.im.crop(box), S.W, S.H), _prot_from(ph, box, (S.W, S.H), dil=15))
        c.put(el, S.cx, S.H / 2, shadow=0, avoid=False, name="full")
        if S.vibe in ("scrapbook", "film") and not any((f[3] - box[1]) * s > S.H * 0.82 for f in ph.faces):
            bh = int(S.H * r.uniform(.08, .12))
            band = paper_texture(S.W + 40, bh, CREAM if S.vibe == "scrapbook" else (34, 31, 29), seed=S.seed).convert("RGBA")
            band.putalpha(deckle_mask(S.W + 40, bh, "t", amp=10, seed=S.seed))
            c.put(El(band), S.cx, S.H - bh / 2 + 4, shadow=0.15, blur=8, off=(0, -4), avoid=False)
    if len(phs) > 1:
        _companion(c, S, phs[1])


TPLS = {
    "popout_print":    dict(fn=t_popout("print"), slots="Pa", hero=1),
    "popout_polaroid": dict(fn=t_popout("polaroid"), slots="Pa", hero=1),
    "popout_phone":    dict(fn=t_popout("phone"), slots="Pa", hero=1),
    "zoom_bubble":     dict(fn=t_zoom_bubble, slots="Za", hero=1),
    "zoom_cutout":     dict(fn=t_zoom_cutout, slots="C", hero=1),
    "cutout_scene":    dict(fn=t_cutout_scene, slots="SC", hero=0),
    "polaroid_stack":  dict(fn=t_polaroid_stack, slots="AAa", hero=0),
    "film_strip":      dict(fn=t_film_strip, slots="AAAa", hero=0),
    "grid_torn":       dict(fn=t_grid_torn, slots="AAAa", hero=0),
    "arch":            dict(fn=t_arch, slots="Sa", hero=1),
    "circles":         dict(fn=t_circles, slots="Saa", hero=1),
    "ticket":          dict(fn=t_ticket, slots="Aa", hero=0),
    "fullbleed":       dict(fn=t_fullbleed, slots="Sa", hero=1),
}
VW = {  # pemberat templat ikut vibe
    "scrapbook": dict(popout_print=1, popout_polaroid=1, popout_phone=1, zoom_bubble=1, zoom_cutout=.9, cutout_scene=.9,
                      polaroid_stack=1.2, film_strip=.6, grid_torn=.8, arch=.7, circles=.7, ticket=.8, fullbleed=.4),
    "minimal": dict(popout_print=1, popout_polaroid=.8, popout_phone=.6, zoom_bubble=1, zoom_cutout=1, cutout_scene=.8,
                    polaroid_stack=.6, film_strip=.4, grid_torn=1.2, arch=1.2, circles=1, ticket=.4, fullbleed=1),
    "film": dict(popout_print=.8, popout_polaroid=.9, popout_phone=.5, zoom_bubble=.8, zoom_cutout=.6, cutout_scene=.6,
                 polaroid_stack=.9, film_strip=1.6, grid_torn=.8, arch=.5, circles=.5, ticket=.9, fullbleed=.8),
    "majalah": dict(popout_print=1, popout_polaroid=.5, popout_phone=.8, zoom_bubble=1, zoom_cutout=1.3, cutout_scene=1.1,
                    polaroid_stack=.5, film_strip=.5, grid_torn=1, arch=1, circles=1.2, ticket=.6, fullbleed=1),
}


# ---------------------------------------------------------------- PLANNER
def slot_ok(ph, ch):
    return {"P": ph.popout_ok, "Z": ph.zoom_ok, "C": ph.cut_ok, "S": ph.scenic, "A": True}.get(ch.upper(), True)


def pick_for(ch, pool, rng):
    c = [p for p in pool if slot_ok(p, ch)]
    if not c:
        return None
    rng.shuffle(c)
    if ch in "PZC":
        c.sort(key=lambda p: -(p.ratio * 3 + (p.W * p.H) / 4e6 + min(p.nfaces, 5) * 0.2))
    elif ch == "S":
        c.sort(key=lambda p: (p.caps(), p.lowres))
    else:
        c.sort(key=lambda p: (not p.lowres, p.caps()))
    return c[0]


def plan(photos, opts, seed, avoid, locked):
    """Pilih templat dan gambar untuk setiap slide. Pulangkan senarai {tpl, photos, seed}."""
    N = int(opts["slides"])
    vibe = opts["vibe"]
    byname = {p.name: p for p in photos}
    best, best_sim = None, 9
    for attempt in range(8):
        rng = random.Random(seed * 101 + attempt)
        slides = [None] * N
        used = {}
        for i, spec in locked.items():
            if i < N and all(n in byname for n in spec["photos"]):
                slides[i] = dict(spec)
                for n in spec["photos"]:
                    used[n] = used.get(n, 0) + 1
        order = bool(opts.get("order"))
        queue = list(photos)
        hero = next((p for p in photos if p.star), None)
        if hero is None and not order:
            hero = max(photos, key=lambda p: (p.popout_ok or p.zoom_ok) * 10 + p.ratio * 5 + (p.W * p.H) / 4e6
                       + min(p.nfaces, 5) * .8 - p.lowres * 20)
        elif hero is None:
            hero = photos[0]
        counts = {}
        for i in range(N):
            if slides[i] is not None:
                counts[slides[i]["tpl"]] = counts.get(slides[i]["tpl"], 0) + 1
                continue
            unused = [p for p in queue if p.name not in used]
            left = sum(1 for s in slides[i:] if s is None)
            pool = unused if unused else sorted(photos, key=lambda p: used.get(p.name, 0))
            if order and unused:
                pool = unused[:4]
            prev = slides[i - 1]["tpl"] if i and slides[i - 1] else None
            prev_ph = set(slides[i - 1]["photos"]) if i and slides[i - 1] else set()
            pool_nb = [p for p in pool if p.name not in prev_ph] or pool
            pressure = len(unused) / max(1, left)
            cands = []
            for name, T in TPLS.items():
                if i == 0 and not T["hero"]:
                    continue
                req = [ch for ch in T["slots"] if ch.isupper()]
                tmp = list(pool_nb)
                ok = True
                first = hero if (i == 0 and hero in tmp) else None
                for k, ch in enumerate(req):
                    if k == 0 and first is not None:
                        if not slot_ok(first, ch):
                            ok = False
                            break
                        tmp.remove(first)
                        continue
                    p = pick_for(ch, tmp, rng)
                    if p is None:
                        ok = False
                        break
                    tmp.remove(p)
                if not ok:
                    continue
                w = VW[vibe].get(name, 1)
                if name == prev:
                    w *= 0.12
                w *= 0.35 ** counts.get(name, 0)
                if prev and prev.startswith("popout") and name.startswith("popout"):
                    w *= 0.4
                for seq in avoid:
                    if i < len(seq) and seq[i] == name:
                        w *= 0.3
                    elif name in seq:
                        w *= 0.9
                multi = len(T["slots"]) >= 3
                if pressure > 2.6:
                    w *= 6 if multi else 0.25
                elif pressure > 1.8 and multi:
                    w *= 2.2
                if pressure < 0.9 and multi:
                    w *= 0.35
                cands.append((name, w))
            if not cands:
                cands = [("polaroid_stack", 1)]
            name = rng.choices([c[0] for c in cands], [c[1] for c in cands])[0]
            T = TPLS[name]
            chosen, tmp = [], list(pool_nb)
            for k, ch in enumerate(T["slots"]):
                if ch.islower():
                    continue
                if k == 0 and i == 0 and hero in tmp and slot_ok(hero, ch):
                    p = hero
                else:
                    p = pick_for(ch, tmp, rng) or (tmp[0] if tmp else rng.choice(photos))
                chosen.append(p)
                if p in tmp:
                    tmp.remove(p)
            n_opt = sum(1 for ch in T["slots"] if ch.islower())
            rem_unused = [p for p in tmp if p.name not in used and p not in chosen]
            for _ in range(n_opt):
                left_after = left - 1
                if rem_unused and (len(rem_unused) > left_after * 1.2 or rng.random() < 0.3):
                    p = pick_for("A", rem_unused, rng)
                    chosen.append(p)
                    rem_unused.remove(p)
            for p in chosen:
                used[p.name] = used.get(p.name, 0) + 1
            counts[name] = counts.get(name, 0) + 1
            slides[i] = {"tpl": name, "photos": [p.name for p in chosen], "seed": rng.randint(1, 10 ** 6)}
        # gambar yang belum masuk: tambah ke slide yang ada ruang
        left_out = [p for p in photos if p.name not in used]
        for p in left_out:
            for s in slides:
                if s.get("locked"):
                    continue
                T = TPLS[s["tpl"]]
                cap = len(T["slots"])
                if len(s["photos"]) < cap and s["tpl"] not in ("cutout_scene", "zoom_cutout"):
                    s["photos"].append(p.name)
                    used[p.name] = 1
                    break
        sig = [s["tpl"] for s in slides]
        sim = max([sum(a == b for a, b in zip(sig, q)) / max(1, len(sig)) for q in avoid] or [0])
        if sim < best_sim:
            best, best_sim = slides, sim
        if sim < 0.5:
            break
    unused = [p.name for p in photos if not any(p.name in s["photos"] for s in best)]
    return best, unused


def strip_source(photos, aspect, rng):
    """Gambar + kawasan tanpa orang untuk jalur foto yang melintas garis potong (None kalau tiada)."""
    c = []
    for p in photos:
        if p.lowres and len(photos) > 3:
            continue
        cr = p.free_crop(aspect)
        whole = cr == (0, 0, p.W, p.H)
        if whole and (p.ratio > 0.005 or p.faces):
            continue
        c.append((p, cr))
    if not c:
        return None, None
    return rng.choice(c)


# ---------------------------------------------------------------- SEAMS + DECOR
def seam_behind(c, k, W, H, photos, rng, vibe, f):
    x = k * W
    kind = rng.choices(["strip", "panel", "block"], {
        "scrapbook": [0.45, 0.55, 0], "minimal": [0.7, 0, 0.3], "film": [0.8, 0, 0.2], "majalah": [0.4, 0, 0.6]}[vibe])[0]
    y = H * rng.uniform(0.2, 0.8)
    if kind == "panel":
        w, h = int(rng.uniform(320, 460) * f), int(rng.uniform(560, 1000) * f)
        el = paper_panel2(rng.choice(["dots", "grid", "hearts", "stripes"]), w, h, seed=rng.randint(0, 999)).rotate(rng.uniform(-4, 4))
    elif kind == "block":
        w, h = int(rng.uniform(280, 520) * f), int(rng.uniform(400, 900) * f)
        col = strong(rng.choice(ACCENTS), 0.85) if vibe != "film" else (58, 52, 47)
        el = color_block(w, h, col, shape=rng.choice(["rect", "rect", "circle"]), rad=int(30 * f))
    else:
        land = rng.random() < 0.6
        w, h = (int(rng.uniform(440, 560) * f), int(rng.uniform(280, 360) * f)) if land else \
               (int(rng.uniform(300, 380) * f), int(rng.uniform(520, 700) * f))
        ph, cr = strip_source(photos, w / h, rng)
        if ph is None:
            el = paper_panel2(rng.choice(["dots", "grid", "stripes"]), int(w * 0.8), h, seed=rng.randint(0, 999))
        else:
            el = scene_el(ph, w, h, edges="lrtb", seed=rng.randint(0, 999), crop=cr).rotate(rng.uniform(-5, 5))
            el.prot = Image.new("L", el.size, 0)
    c.put(el, x + rng.uniform(-60, 60), y, shadow=0.2, blur=12, avoid=False, name="seam")


def seam_top(c, k, W, H, backcuts, rng, vibe, decor, f, photos, cutmode):
    x = k * W
    if backcuts and rng.random() < 0.7:
        ph = backcuts.pop(0)
        st = "loose" if cutmode in ("rawak", "longgar") or ph.solid < 0.75 else ("tight" if cutmode == "ketat" else rng.choice(["loose", "tight"]))
        el = cutout_el(ph, int(H * rng.uniform(.38, .48)), st)
        c.put(el, x + rng.uniform(-30, 30), H - el.size[1] / 2 - 15 * f, shadow=0.3, blur=12, name="backcut")
        if not decor:
            return
    if decor:
        if vibe == "scrapbook":
            el = rng.choice([lambda: washi(int(rng.uniform(220, 300) * f), color=rng.choice(ACCENTS), seed=rng.randint(0, 99)),
                             lambda: lace(int(rng.uniform(380, 520) * f), int(66 * f)),
                             lambda: sticker_star(int(44 * f), rng.choice(ACCENTS)),
                             lambda: sticker_heart_button(int(40 * f), rng.choice(ACCENTS))])()
        elif vibe == "majalah":
            el = rng.choice([lambda: dots_cluster(int(8 * f), seed=rng.randint(0, 99), color=strong(rng.choice(ACCENTS), .6)),
                             lambda: color_block(int(120 * f), int(120 * f), strong(rng.choice(ACCENTS), .6), "circle")])()
        else:
            el = tape(int(rng.uniform(200, 260) * f), int(44 * f))
        el = el.rotate(rng.uniform(-40, 40))
    else:
        w, h = int(rng.uniform(300, 380) * f), int(rng.uniform(200, 260) * f)
        ph, cr = strip_source(photos, w / h, rng)
        if ph is None:
            el = paper_panel2("dots", w, h, seed=rng.randint(0, 999)).rotate(rng.uniform(-6, 6))
        else:
            el = scene_el(ph, w, h, edges="lrtb", seed=rng.randint(0, 999), crop=cr).rotate(rng.uniform(-6, 6))
            el.prot = Image.new("L", el.size, 0)
    w, h = el.size
    ys = sorted([H * v for v in (0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92)], key=lambda y: c.busy((x - w / 2, y - h / 2, x + w / 2, y + h / 2)) + rng.random() * 0.01)
    y = min(max(ys[0], h / 2 + 10), H - h / 2 - 10)
    if c.busy((x - w / 2, y - h / 2, x + w / 2, y + h / 2)) > 0.02:
        return
    c.put(el, x + rng.uniform(-20, 20), y, shadow=0.15, blur=6, avoid=False, name="seamtop")


def scatter_decor(c, S):
    if not S.decor:
        return
    r, f = S.rng, S.f
    n = {1: 2, 2: 4}.get(S.decor, 2)
    for _ in range(n):
        if S.vibe == "scrapbook":
            el = r.choice([lambda: sparkle(int(r.uniform(22, 34) * f)), lambda: small_heart(int(r.uniform(16, 26) * f), strong(r.choice(ACCENTS), .7)),
                           lambda: sticker_star(int(r.uniform(32, 44) * f), r.choice(ACCENTS)),
                           lambda: sticker_heart_button(int(r.uniform(32, 42) * f), r.choice(ACCENTS)),
                           lambda: paper_clip(int(r.uniform(150, 180) * f), color=r.choice([(196, 160, 170), (170, 182, 192)]))])()
        elif S.vibe == "majalah":
            el = r.choice([lambda: dots_cluster(int(7 * f), seed=r.randint(0, 99), color=strong(r.choice(ACCENTS), .6)),
                           lambda: sparkle(int(28 * f), strong(r.choice(ACCENTS), .6))])()
        elif S.vibe == "film":
            el = r.choice([lambda: sparkle(int(r.uniform(20, 30) * f), (250, 236, 210)), lambda: tape(int(140 * f), int(40 * f))])()
        else:
            el = sparkle(int(r.uniform(18, 26) * f), strong(r.choice(ACCENTS), .7))
        el = el.rotate(r.uniform(-30, 30))
        w, h = el.size
        best = None
        for _ in range(30):
            x = S.ox + r.uniform(w / 2 + 50, S.W - w / 2 - 50)
            y = r.uniform(h / 2 + 20, S.H - h / 2 - 20)
            b = c.busy((x - w / 2, y - h / 2, x + w / 2, y + h / 2))
            if b == 0:
                best = (x, y)
                break
        if best:
            c.put(el, best[0], best[1], shadow=0.2, blur=5, off=(3, 5), avoid=False, name="decor")


def slide_backdrop(c, S):
    """Latar tambahan di belakang setiap slide (ikut vibe)."""
    r, f = S.rng, S.f
    if S.vibe == "scrapbook" and r.random() < 0.55:
        w, h = int(r.uniform(560, 760) * f), int(r.uniform(700, 1000) * f)
        el = paper_panel2(r.choice(["dots", "grid", "hearts", "stripes"]), w, h, seed=r.randint(0, 999)).rotate(r.uniform(-3, 3))
        c.put(el, S.X(r.uniform(.3, .7)), S.H * r.uniform(.35, .65), shadow=0.15, avoid=False, name="backdrop")
    elif S.vibe == "majalah":
        for _ in range(r.randint(1, 2)):
            w, h = int(r.uniform(300, 700) * f), int(r.uniform(400, 1000) * f)
            el = color_block(w, h, strong(r.choice(ACCENTS), 0.85), shape=r.choice(["rect", "rect", "circle"]), rad=int(24 * f))
            c.put(el, S.X(r.uniform(.15, .85)), S.H * r.uniform(.2, .8), shadow=0, avoid=False, name="block")


# ---------------------------------------------------------------- RENDER + MAIN
def render(job):
    opts = dict(mode="carousel", slides=5, aspect="4:5", vibe="rawak", cutout="rawak", decor=1,
                enhance="natural", strength=1.0, order=False)
    opts.update(job.get("opts") or {})
    out = Path(job["out"])
    out.mkdir(parents=True, exist_ok=True)
    seed = int(job.get("seed") or random.randint(1, 10 ** 9))
    preset, k = opts["enhance"], float(opts["strength"])
    warnings = []
    plist = job["photos"]
    if not plist:
        raise SystemExit("Tiada gambar")

    if opts["mode"] == "enhance":   # Enhance sahaja: gambar penuh dengan warna baru
        res = []
        for i, p in enumerate(plist):
            prog(5 + 90 * i / len(plist), f"Warna gambar {i + 1}/{len(plist)}")
            im = ImageOps.exif_transpose(Image.open(p["path"])).convert("RGB")
            o = out / f"enhance_{i + 1:02d}.jpg"
            enhance(im, preset, k).save(o, quality=93, subsampling=0)
            res.append(str(o))
        r = {"photos": res, "warnings": warnings, "engine": ENGINE_VERSION}
        json.dump(r, open(out / "result.json", "w"))
        prog(100, "Siap")
        return r

    photos = []
    for i, p in enumerate(plist):
        prog(3 + 40 * i / len(plist), f"Analisis gambar {i + 1}/{len(plist)}")
        try:
            photos.append(Photo(p["path"], p.get("name"), p.get("star"), job.get("cache"), preset, k))
        except Exception as e:
            warnings.append(f"Gambar {p.get('name') or p['path']} tak dapat dibaca: {e}")
    if not photos:
        raise SystemExit("Tiada gambar yang boleh dibaca")
    low = [p.name for p in photos if p.lowres]
    if low:
        warnings.append(f"{len(low)} gambar resolusi rendah, digunakan kecil sahaja")
    set_palette(photos)
    if opts.get("kit"):   # templat dikurasi ikut Kit Gaya (design_kits.py)
        return render_kit_out(opts, photos, seed, out, warnings)
    rng = random.Random(seed)
    vibe = opts["vibe"] if opts["vibe"] in VIBES else rng.choices(VIBES, [0.45, 0.2, 0.15, 0.2])[0]
    opts["vibe"] = vibe
    N = max(2, min(10, int(opts["slides"])))
    opts["slides"] = N
    W, H = SIZES.get(opts["aspect"], SIZES["4:5"])
    prev = job.get("recipe") or {}
    locked = {}
    for i in job.get("lock") or []:
        sl = (prev.get("slides") or [])
        if 0 <= i < len(sl) and prev.get("aspect") == opts["aspect"]:
            locked[i] = dict(sl[i], locked=True)
    if locked and prev.get("vibe") in VIBES:
        vibe = opts["vibe"] = prev["vibe"]
    prog(45, "Susun resipi")
    slides, unused = plan(photos, opts, seed, job.get("avoid") or [], locked)
    if unused:
        warnings.append(f"{len(unused)} gambar tak muat. Tambah slide untuk guna semua")
    byname = {p.name: p for p in photos}
    c = Canvas(N, W, H, vibe, rng)
    f = min(1.0, H / 1350) if H <= 1350 else min(1.15, H / 1350 * 0.85)
    used_names = {n for s in slides for n in s["photos"]}
    backcuts = [p for p in photos if p.backview and p.backcut_ok and p.name not in used_names]
    srng = random.Random(seed * 31 + 7)
    for i in range(N):   # latar setiap slide
        slide_backdrop(c, Slide(i, W, H, slides[i]["seed"] + 5, opts, vibe))
    for k_ in range(1, N):
        seam_behind(c, k_, W, H, photos, srng, vibe, f)
    for i, s in enumerate(slides):
        prog(50 + 40 * i / N, f"Slide {i + 1}/{N}: {s['tpl']}")
        S = Slide(i, W, H, s["seed"], opts, vibe)
        TPLS[s["tpl"]]["fn"](c, S, [byname[n] for n in s["photos"]])
    for k_ in range(1, N):
        seam_top(c, k_, W, H, backcuts, srng, vibe, int(opts["decor"]), f, photos, opts["cutout"])
    for i, s in enumerate(slides):
        scatter_decor(c, Slide(i, W, H, s["seed"] + 9, opts, vibe))
    bad = c.check_seams()
    if bad:
        warnings.append(f"Muka mungkin dekat garis potong selepas slide {bad}")
    prog(93, "Simpan slide")
    final = c.finish(seed)
    paths = []
    for i in range(N):
        pth = out / f"slide_{i + 1:02d}.jpg"
        final.crop((i * W, 0, (i + 1) * W, H)).save(pth, quality=JPEG_Q, subsampling=0)
        paths.append(str(pth))
    band, sc = 30, 0.5
    pw, ph_ = int(c.W * sc), int(H * sc)
    prev_img = Image.new("RGB", (pw, ph_ + 2 * band), (40, 40, 40))
    prev_img.paste(final.resize((pw, ph_), RS.LANCZOS), (0, band))
    d = ImageDraw.Draw(prev_img)
    for s_ in c.seams:
        x = int(s_ * sc)
        d.polygon([(x - 9, 4), (x + 9, 4), (x, band - 4)], fill=(255, 90, 110))
        d.polygon([(x - 9, ph_ + 2 * band - 4), (x + 9, ph_ + 2 * band - 4), (x, ph_ + band + 4)], fill=(255, 90, 110))
    pv = out / "preview.jpg"
    prev_img.save(pv, quality=88)
    th = out / "thumb.jpg"
    final.crop((0, 0, W, H)).resize((360, int(360 * H / W)), RS.LANCZOS).save(th, quality=82)
    recipe = {"v": ENGINE_VERSION, "seed": seed, "vibe": vibe, "aspect": opts["aspect"],
              "slides": [{k2: v for k2, v in s.items() if k2 != "locked"} for s in slides]}
    r = {"slides": paths, "preview": str(pv), "thumb": str(th), "recipe": recipe, "warnings": warnings,
         "log": c.log, "engine": ENGINE_VERSION, "kits": kit_list()}
    json.dump(r, open(out / "result.json", "w"))
    prog(100, "Siap")
    return r


def kit_list():
    try:
        import design_kits
        return [{"id": k, "name": v["name"], "formats": v["formats"]} for k, v in design_kits.KITS.items()]
    except Exception:
        return []


def save_outputs(img, n, W, H, out, seed, vibe="kit"):
    rng = np.random.default_rng(seed)
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    a += rng.normal(0, 1.8, a.shape[:2])[..., None]
    final = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    paths = []
    for i in range(n):
        pth = out / f"slide_{i + 1:02d}.jpg"
        final.crop((i * W, 0, (i + 1) * W, H)).save(pth, quality=JPEG_Q, subsampling=0)
        paths.append(str(pth))
    band, sc = 30, 0.5
    pw, ph_ = int(n * W * sc), int(H * sc)
    pv_img = Image.new("RGB", (pw, ph_ + 2 * band), (40, 40, 40))
    pv_img.paste(final.resize((pw, ph_), RS.LANCZOS), (0, band))
    d = ImageDraw.Draw(pv_img)
    for k in range(1, n):
        x = int(k * W * sc)
        d.polygon([(x - 9, 4), (x + 9, 4), (x, band - 4)], fill=(255, 90, 110))
        d.polygon([(x - 9, ph_ + 2 * band - 4), (x + 9, ph_ + 2 * band - 4), (x, ph_ + band + 4)], fill=(255, 90, 110))
    pv = out / "preview.jpg"
    pv_img.save(pv, quality=88)
    th = out / "thumb.jpg"
    final.crop((0, 0, W, H)).resize((360, int(360 * H / W)), RS.LANCZOS).save(th, quality=82)
    return paths, str(pv), str(th)


def render_kit_out(opts, photos, seed, out, warnings):
    import design_kits
    prog(50, "Susun templat " + str(opts.get("kit")))
    st, rec = design_kits.render_kit(opts, photos, seed)
    bad = st.bad_seams()
    if bad:
        warnings.append(f"Muka mungkin dekat garis potong selepas slide {bad}")
    prog(93, "Simpan slide")
    paths, pv, th = save_outputs(st.img, st.n, st.W, st.H, out, seed)
    recipe = {"v": ENGINE_VERSION, "seed": seed, "vibe": "kit:" + rec["kit"], "aspect": opts.get("aspect"),
              "kit": rec["kit"], "format": rec["format"], "slides": rec["slides"]}
    r = {"slides": paths, "preview": pv, "thumb": th, "recipe": recipe, "warnings": warnings, "engine": ENGINE_VERSION,
         "kits": kit_list()}
    json.dump(r, open(out / "result.json", "w"))
    prog(100, "Siap")
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True, help="fail job.json")
    a = ap.parse_args()
    job = json.load(open(a.job))
    r = render(job)
    print(json.dumps({k: v for k, v in r.items() if k != "log"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
