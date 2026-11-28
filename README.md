# Miracikcit Studio (PWA)

App Studio @miracikcit: skrin penuh di phone, sync semua device melalui Google Sheet CONTENT 2026.

- `index.html`, `css/app.css`, `js/` : app. Satu fail setiap tab dalam `js/tabs/`, enjin dalam `js/core/` dan `js/runtime.js`.
- `apps-script/Code.gs` : backend dalam Sheet CONTENT 2026 (Extensions > Apps Script). Data app dalam tab tersembunyi `STUDIO_DATA`, kerja Mac mini dalam `STUDIO_JOBS`.
- `mac-mini/` : worker (transkrip, Generate Ideas guna Claude, scan folder) dan `studio.py`.
- **Lepas ubah kod: `./deploy.sh "apa yang diubah"`** (semak JS, naik versi, commit, push). Phone tunjuk "Versi baru Studio".
- **Jangan edit artifact Studio lama** (DdMbNo2UWauackyuUMJtMv). Hook `~/.claude/hooks/studio-guard.py` menyekat publish ke situ.
- Data Sheet lain: tambah `MCP.watchTool(GS,'get_values',...)` dalam `js/core/sheet.js` (Sheet CONTENT 2026 terus boleh; Sheet lain perlu kebenaran `izinkan`).

Tiada rahsia dalam repo ni. Kunci worker dan kod rahsia Studio disimpan dalam Script Properties.

## Carousel (Lagi > Carousel)

Upload gambar, pilih setting, Mac mini jana carousel IG seamless (0 token, tanpa Claude). Setiap Generate / Shuffle
guna seed baru dan elak resipi 8 carousel terakhir, jadi templat, cutout dan hiasan sentiasa berlainan.

- `js/tabs/carousel.js` : tab Studio (upload dikecilkan ke 2560 px dalam phone, pilih hero ★, setting, kunci slide, Shuffle, versi lama, Enhance sahaja).
- `mac-mini/carousel.py` : job `carousel` (muat turun gambar, jalankan enjin, upload ke Drive `Miracikcit Studio Files/CAROUSEL/<tarikh> <tajuk>`, tulis doc `carousel/<id>`).
- `mac-mini/carousel_engine.py` : enjin (13 templat, 4 gaya cutout, 4 vibe, 6 preset warna dengan pelindung warna kulit, perlindungan muka di garis potong). Boleh dijalankan sendiri: `python carousel_engine.py --job job.json`.
- Pasang sekali di Mac mini: salin `carousel.py`, `carousel_engine.py`, `carousel_setup.sh` dan `worker.py` ke `~/MiracikcitTranscribe/`, jalankan `bash ~/MiracikcitTranscribe/carousel_setup.sh` (venv `carousel_env`, ~600 MB), kemudian mulakan semula worker.
- Apps Script tak berubah.
