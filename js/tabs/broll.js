/* ---------- B-ROLL PICKER (app lokal dalam Mac mini) ---------- */
const BR_HOME='http://Miras-Mac-Mini.local:8787';
const brCfg=()=>Object.assign({home:BR_HOME,away:''},((S.settings||{}).broll)||{});
V.broll=()=>{const c=brCfg();
  return head('Pilih b-roll dari raw footage, terus dari phone')+`
  <div class="card big glass"><p class="hand" style="margin:0 0 6px">Swipe, keep, siap.</p>
   <p class="meta" style="margin:0 0 14px">App ni jalan dalam Mac mini. Dia potong raw video jadi moment pendek dan buang yang kabur, goyang, gelap atau berulang. Kau cuma swipe Keep atau Skip. Clip yang kau keep disimpan dalam Mac (Movies › B-ROLL LIBRARY, ikut label), bukan iCloud. Hujung bulan pindah folder tu ke hard disk. Semuanya kod biasa, tiada token AI.</p>
   <div class="btns"><a class="btn solid tab" href="${esc(c.home)}" target="_blank" rel="noopener">${IC.broll}Buka di rumah</a>${isUrl(c.away)?`<a class="btn" href="${esc(c.away)}" target="_blank" rel="noopener">${IC.ext}Buka masa travel</a>`:''}</div>
   <p class="meta" style="margin:12px 0 0">Phone mesti guna Wi-Fi rumah yang sama dengan Mac mini. Kalau tak terbuka, pastikan B-Roll Picker sedang jalan dalam Mac mini.</p></div>
  <div class="card big glass" style="margin-top:14px"><p class="eyebrow">Cara guna</p>
   <ol class="trisi"><li><b>Folders</b>: pilih folder raw (contoh 22. EDIT VLOG / Tayar Kereta), tekan Pre-cut. Tunggu bar progress.</li><li><b>Swipe</b>: kanan atau Keep untuk simpan, kiri atau Skip untuk buang. Undo kalau tersilap.</li><li><b>Trim</b>: gerakkan kotak sepanjang clip, pilih 1.5s, 3s atau 5s.</li><li><b>Label</b>: tekan chip (DIY, Cooking, Product...) atau tambah label sendiri.</li><li><b>Kept</b>: tekan Save to B-Roll Library. Raw asal tak diusik.</li></ol>
   <p class="meta" style="margin:0">Makin banyak kau swipe, makin pandai dia teka moment yang kau suka (tab My taste).</p></div>
  <div class="card big glass" style="margin-top:14px"><p class="eyebrow">Alamat</p>
   <label class="f"><span>Di rumah (Wi-Fi sama)</span><input class="inp" id="brHome" value="${esc(c.home)}" inputmode="url" autocapitalize="off"></label>
   <label class="f"><span>Masa travel (alamat Tailscale, pilihan)</span><input class="inp" id="brAway" value="${esc(c.away)}" placeholder="http://miras-mac-mini:8787" inputmode="url" autocapitalize="off"></label>
   <button class="btn solid tab" data-act="brSave">Simpan</button></div>`};
A.brSave=()=>{const h=$('#brHome').value.trim()||BR_HOME,a=$('#brAway').value.trim();if(!/^https?:\/\//i.test(h)||(a&&!/^https?:\/\//i.test(a))){toast('Alamat mesti mula dengan http://');return}saveSettings({broll:{home:h,away:a}});render(true);toast('Disimpan')};

