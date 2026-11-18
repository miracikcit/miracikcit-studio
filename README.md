# Miracikcit Studio (PWA)

App Studio @miracikcit: skrin penuh di phone, sync semua device melalui Google Sheet CONTENT 2026.

- `index.html`, `css/app.css`, `js/` : app. Satu fail setiap tab dalam `js/tabs/`, enjin dalam `js/core/` dan `js/runtime.js`.
- `apps-script/Code.gs` : backend dalam Sheet CONTENT 2026 (Extensions > Apps Script). Data app dalam tab tersembunyi `STUDIO_DATA`, kerja Mac mini dalam `STUDIO_JOBS`.
- `mac-mini/` : worker (transkrip, Generate Ideas guna Claude, scan folder) dan `studio.py`.
- Lepas ubah kod: `./bump.sh` kemudian commit dan push. Phone tunjuk "Versi baru".

Tiada rahsia dalam repo ni. Kunci worker dan kod rahsia Studio disimpan dalam Script Properties.
