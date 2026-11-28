# Miracikcit Studio (PWA)

App Studio @miracikcit: skrin penuh di phone, sync semua device melalui Google Sheet CONTENT 2026.

- `index.html`, `css/app.css`, `js/` : app. Satu fail setiap tab dalam `js/tabs/`, enjin dalam `js/core/` dan `js/runtime.js`.
- `apps-script/Code.gs` : backend dalam Sheet CONTENT 2026 (Extensions > Apps Script). Data app dalam tab tersembunyi `STUDIO_DATA`, kerja Mac mini dalam `STUDIO_JOBS`.
- `mac-mini/` : worker (transkrip, Generate Ideas guna Claude, scan folder) dan `studio.py`.
- **Lepas ubah kod: `./deploy.sh "apa yang diubah"`** (semak JS, naik versi, commit, push). Phone tunjuk "Versi baru Studio".
- **Jangan edit artifact Studio lama** (DdMbNo2UWauackyuUMJtMv). Hook `~/.claude/hooks/studio-guard.py` menyekat publish ke situ.
- Data Sheet lain: tambah `MCP.watchTool(GS,'get_values',...)` dalam `js/core/sheet.js` (Sheet CONTENT 2026 terus boleh; Sheet lain perlu kebenaran `izinkan`).

Tiada rahsia dalam repo ni. Kunci worker dan kod rahsia Studio disimpan dalam Script Properties.

## Rujukan → Design → Posting Gambar (Lagi)

Satu hala: **Rujukan** (dump apa yang Mira suka) → **Design** (edit gambar ikut templat, 0 token) → **Posting Gambar** (tulis ayat untuk Threads, IG, FB, TikTok). Caption (video produk) kekal tab sendiri.

- `js/tabs/rujukan.js` : tab Rujukan (dulu Copy Style + Inspiration). Dump gambar (board) / video / link (Resipi reel, aliran `gaya.js`). Segmen Templat: pilih rujukan + nota > "Minta jadi templat" (job `tpl_req`, doc `kitreq/<id>`).
- `js/tabs/carousel.js` : tab Design (format Carousel / Single / Cover reel / Warna, templat Kit Gaya atau Kolaj rawak, tulisan pilihan, kunci slide, Shuffle, versi lama, Hantar ke Posting Gambar). Senarai kit dari doc `sync/kits`.
- `js/tabs/threads.js` : tab Posting Gambar (dulu Threads). Tiada edit gambar; terima gambar dari Design; pilih platform; belajar gaya ayat kekal.
- `mac-mini/carousel.py` : job `carousel` (jana) dan `tpl_req` (muat turun rujukan ke `kit-requests/<id>/`, buka sesi Claude Code yang tambah kit baru).
- `mac-mini/carousel_engine.py` + `mac-mini/design_kits.py` : enjin. Kit Gaya (`doodle`, `comel`, `majalah`) dalam `design_kits.py`; kolaj rawak lama dalam `carousel_engine.py`. Font dalam `mac-mini/fonts/` (OFL / Apache).
- Pasang sekali di Mac mini: salin `carousel.py`, `carousel_engine.py`, `design_kits.py`, folder `fonts/`, `carousel_setup.sh` dan `worker.py` ke `~/MiracikcitTranscribe/`, jalankan `bash ~/MiracikcitTranscribe/carousel_setup.sh`, mulakan semula worker.
- Apps Script tak berubah.
