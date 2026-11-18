/* ---------- FOOTAGE ---------- */
const FOOT_REQ=`Render dah siap. Jangan buang raw footage lagi. Scan raw footage video ni, pilih clip terbaik (stabil, terang, fokus, shot produk / tangan / transformation), potong jadi clip pendek, simpan dalam folder "TO HARD DRIVE/[nama video]" dengan nama fail produk_jenisshot_tarikh, kemudian tambah satu entry dalam tab Footage Miracikcit Studio (koleksi footage: name, product, tags, date, clips, moved:false, location:"").`;
V.footage=()=>{const tags=[...new Set(FTAGS.concat(S.footage.flatMap(f=>f.tags||[])))];
  const list=S.footage.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).filter(f=>hit('ft',f.name,f.product,(f.tags||[]).join(' '),f.location)&&(!ui.ftTag||(f.tags||[]).includes(ui.ftTag)));
  return head('Clip B-roll dalam TOSHIBA EXT',`<button class="btn sm" data-act="copy" data-x="${esc(FOOT_REQ)}">${IC.copy}Minta Claude pilih clip</button><button class="btn solid tab" data-act="ftAdd">${IC.plus}Tambah</button>`)+searchBox('ft','Cari video, produk atau tag')+
  `<div class="btns" style="margin-bottom:14px;gap:6px"><button class="btn sm ${!ui.ftTag?'solid tab':''}" data-act="ftTag" data-x="">Semua</button>${tags.map(t=>`<button class="btn sm ${ui.ftTag===t?'solid tab':''}" data-act="ftTag" data-x="${esc(t)}">${esc(t)}</button>`).join('')}</div>
  <div class="list">${list.map(f=>`<div class="card glass"><div class="rowh"><div><h3>${esc(f.name||'Set clip')}</h3><div class="meta">${esc([f.product,f.date?fmtD(f.date):'',f.clips?f.clips+' clip':''].filter(Boolean).join(' · '))}</div><div class="btns" style="gap:5px;margin-top:6px">${(f.tags||[]).map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div></div>
     <div class="btns" style="flex-wrap:nowrap"><button class="btn icon sm" data-act="ftEdit" data-id="${f.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="ftDel" data-id="${f.id}" aria-label="Padam">${IC.trash}</button></div></div>
    <div style="margin-top:10px">${chk(f.moved,'ftMoved',f.id,'Dah pindah ke hard disk')}</div>
    <label class="f" style="margin:8px 0 0"><span>Lokasi dalam TOSHIBA EXT</span><input class="inp" id="fl-${f.id}" data-col="footage" data-id="${f.id}" data-f="location" value="${esc(f.location||'')}" placeholder="cth. B-ROLL/2026/Kathwi"></label></div>`).join('')||`<div class="empty">${S.footage.length?'Tiada padanan.':'Belum ada set clip. Lepas render siap, minta Claude pilih clip terbaik dan senaraikan di sini.'}</div>`}</div>`};
A.ftTag=el=>{ui.ftTag=el.dataset.x||null;render(true)};
function ftForm(f){const tags=[...new Set(FTAGS.concat(S.footage.flatMap(x=>x.tags||[])))];ui.ftSel=new Set(f.tags||[]);
  modal(`<h2>${f.id?'Edit set clip':'Set clip baru'}</h2><label class="f"><span>Nama video</span><input class="inp" id="ftN" value="${esc(f.name||'')}"></label><div class="row2"><label class="f"><span>Produk</span><input class="inp" id="ftP" value="${esc(f.product||'')}"></label><label class="f"><span>Tarikh</span><input type="date" class="inp" id="ftD" value="${esc(f.date||ymd(new Date()))}"></label></div>
  <label class="f"><span>Bilangan clip</span><input class="inp" id="ftC" inputmode="numeric" value="${esc(f.clips||'')}"></label>
  <div class="f"><span>Tag</span><div class="btns" style="gap:6px" id="ftTags">${tags.map(t=>`<button type="button" class="btn sm ${ui.ftSel.has(t)?'solid tab':''}" data-act="ftSel" data-x="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
  <label class="f"><span>Tag lain (asing dengan koma)</span><input class="inp" id="ftX"></label>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="ftSave" data-id="${f.id||''}">Simpan</button></div>`)}
A.ftAdd=()=>ftForm({});A.ftEdit=el=>ftForm(get('footage',el.dataset.id));
A.ftSel=el=>{const t=el.dataset.x;ui.ftSel.has(t)?ui.ftSel.delete(t):ui.ftSel.add(t);el.classList.toggle('solid');el.classList.toggle('tab')};
A.ftSave=el=>{const n=$('#ftN').value.trim();if(!n){toast('Isi nama video');return}const extra=$('#ftX').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  save('footage',Object.assign({moved:false,location:''},get('footage',el.dataset.id)||{},{name:n,product:$('#ftP').value.trim(),date:$('#ftD').value,clips:$('#ftC').value.trim(),tags:[...new Set([...ui.ftSel,...extra])]}));closeModal();toast('Disimpan')};
A.ftMoved=el=>{const f=get('footage',el.dataset.id);save('footage',Object.assign({},f,{moved:!f.moved}))};
A.ftDel=el=>{const f=get('footage',el.dataset.id);confirmBox('Padam "'+(f.name||'set clip')+'" dari senarai?',()=>del('footage',f.id))};

