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
- `js/tabs/design.js` : tab Design (koleksi `design`, doc `design/<id>`; berasingan dari carousel footage dalam Published yang guna `carousel/<id>`) (format Carousel / Single / Cover reel / Warna, templat Kit Gaya atau Kolaj rawak, tulisan pilihan, kunci slide, Shuffle, versi lama, Hantar ke Posting Gambar: gambar masuk Photo Editor terus ke langkah 3 Posting; juga butang Dari Design di langkah 1). Senarai kit dari doc `sync/kits`.
- `js/tabs/threads.js` : tab Posting Gambar (dulu Threads). Tiada edit gambar; terima gambar dari Design; pilih platform; belajar gaya ayat kekal.
- `mac-mini/design.py` : job `design` (jana), `ed_cover`, `ref_tag`, `stk_save`, `kit_fonts` dan `tpl_req` (muat turun rujukan ke `kit-requests/<id>/`, buka sesi Claude Code yang tambah kit baru).
- `mac-mini/carousel_engine.py` + `mac-mini/design_kits.py` : enjin. Kit Gaya (`doodle`, `comel`, `majalah`) dalam `design_kits.py`; kolaj rawak lama dalam `carousel_engine.py`. Font dalam `mac-mini/fonts/` (OFL / Apache).
- Pasang sekali di Mac mini: salin `design.py`, `carousel_engine.py`, `design_kits.py`, folder `fonts/`, `carousel_setup.sh` dan `worker.py` ke `~/MiracikcitTranscribe/`, jalankan `bash ~/MiracikcitTranscribe/carousel_setup.sh`, mulakan semula worker.
- **Editor:** Style Board ada preset **Kit Doodle / Kit Comel / Kit Majalah** (`editor/ed-boot.js`, guna pilihan editor sedia ada sahaja supaya `render_draft.py` render sama). Butang **Cover** dalam tab Editor: job `ed_cover` ambil 10 frame dari video projek, pilih muka paling jelas, jana cover reel 9:16 ikut kit (hasil dalam Design).
- **Rujukan disusun Claude:** setiap gambar yang di-dump dihantar ke job `ref_tag` (Claude Sonnet baca gambar kecil, ~3k token setiap gambar): jenis, koleksi (rupa yang sama dapat label sama), kit paling dekat; halaman **Rasa Mira** dari doc `sync/rasa`. Koleksi dengan 2+ rujukan ada butang Buat templat.
- **Kit baru terus ke Editor:** entri `sync/kits` bawa `editor` (preset Style Board dengan id editor sedia ada); `ed-boot.js` baca senarai tu. Butang **Pasang font kit** (job `kit_fonts`) buka sesi Claude Code yang tambah font kit sebenar dalam enjin render (`reel-page-template`), kemudian preset guna font `kit<id>`.
- **Sticker PNG:** Rujukan > Templat > Upload PNG (job `stk_save`, simpan dalam `~/MiracikcitTranscribe/stickers/`). Kit Comel guna sticker tu dulu.
- **★ Kegemaran** dalam Design (doc `sync/kitfav`); "Rawak dari ★" pilih dari kegemaran sahaja.
- Apps Script tak berubah.
