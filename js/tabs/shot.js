/* ---------- SHOT ---------- */
V.shot=()=>{const list=byStage('shot');
  return head('Dah shoot, simpan link product listing')+`<div class="list">${list.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title||'Nota')}</h3><div class="meta">${esc([it.brand,it.shotAt?'shoot '+fmtD(it.shotAt):''].filter(Boolean).join(' · '))} ${accPill(it.account)}</div></div>${it.listingLink?`<span class="pill" style="--pc:var(--ok)">Diarkib</span>`:it.listingGone?`<span class="pill">Listing dibuang</span>`:ui.lsBusy&&ui.lsBusy[it.id]?`<span class="pill" style="--pc:var(--warn)">${ui.lsBusy[it.id]}</span>`:`<span class="pill" style="--pc:var(--warn)">Belum arkib</span>`}</div>
    <label class="f" style="margin-top:12px"><span>Link folder product listing (Google Drive)</span><input class="inp" id="ll-${it.id}" data-col="items" data-id="${it.id}" data-f="listingLink" data-url="1" value="${esc(it.listingLink||'')}" placeholder="https://drive.google.com/drive/folders/..." inputmode="url"></label>
    <div class="btns">${it.listingLink?`<a class="btn sm" href="${esc(it.listingLink)}" target="_blank" rel="noopener">${IC.ext}Buka folder</a>`:it.listingGone?'':`<button class="btn sm solid tab" data-act="lsAsk" data-id="${it.id}" data-x="archive"${ui.lsBusy&&ui.lsBusy[it.id]?' disabled':''}>${IC.up}Simpan ke Drive</button><button class="btn sm bad" data-act="lsAsk" data-id="${it.id}" data-x="del"${ui.lsBusy&&ui.lsBusy[it.id]?' disabled':''}>${IC.trash}Buang listing</button>`}
     <button class="btn sm" data-act="nota" data-id="${it.id}">Nota</button><button class="btn sm solid tab" data-act="toEditAsk" data-id="${it.id}">Ke To Edit${IC.next}</button><button class="btn icon sm" data-act="unShot" data-id="${it.id}" aria-label="Pindah balik ke To Shoot">${IC.back}</button></div></div>`).join('')||`<div class="empty">Belum ada. Tekan Dah shoot dalam To Shoot.</div>`}</div>`};
A.unShot=el=>moveItem(get('items',el.dataset.id),'toshoot');
/* Product listing: Simpan (arkib ke Drive) atau Buang (ke Trash). Mac mini buat sendiri, tanpa Claude. */
function lsGuess(it){const fs=((S.sync.folders||{}).folders)||[];const p=it.productId&&get('products',it.productId);
  if(p&&p.folder&&fs.some(f=>f.name===p.folder))return p.folder;
  const t=nrm(it.title),b=nrm(it.brand);const m=fs.filter(f=>{const n=nrm(f.name);return n&&(t.includes(n)||n.includes(t.slice(0,8))||(b&&n.includes(b)))});return m.length===1?m[0].name:''}
A.lsAsk=el=>{const it=get('items',el.dataset.id);const kind=el.dataset.x;const fs=((S.sync.folders||{}).folders)||[];const g=lsGuess(it);
  if(!fs.length){toast('Senarai folder R1 belum ada. Tekan Sync di Home');return}
  const what=kind==='archive'?'Mac mini akan salin folder ni ke Google Drive (ARCHIVE PRODUCT LISTING), semak semua fail ada, simpan link di sini, kemudian buang folder asal ke Trash.':'Folder ni akan dibuang ke Trash Mac mini tanpa disimpan ke Drive. Masih boleh dipulihkan dari Trash.';
  modal(`<h2>${kind==='archive'?'Simpan listing ke Drive':'Buang listing'}</h2><p class="meta">${what}</p><p class="eyebrow" style="margin-top:14px">Pilih folder dalam R1. PRODUCT LISTING</p>${g?'':`<p class="meta" style="color:var(--bad);margin-top:-4px">Tiada folder yang namanya padan dengan produk ni. Pastikan pilih folder yang betul.</p>`}
   <div class="list">${fs.slice().sort((a,b)=>(b.name===g)-(a.name===g)).map(f=>`<button class="btn${f.name===g?' solid tab':''}" style="justify-content:space-between" data-act="lsGo" data-id="${it.id}" data-x="${kind}" data-f="${esc(f.name)}"><span>${esc(f.name)}</span><span class="meta" style="color:inherit">${f.images} gambar${f.name===g?' · padan':''}</span></button>`).join('')}</div>
   <div class="btns" style="justify-content:space-between;margin-top:12px"><button class="btn sm" data-act="lsNone" data-id="${it.id}">Tiada folder, tanda selesai</button><button class="btn" data-act="closeModal">Batal</button></div>`,TAB.shot.c)};
A.lsNone=el=>{const it=get('items',el.dataset.id);closeModal();save('items',Object.assign({},it,{listingGone:Date.now()}));toast('Ditanda: tiada listing')};
A.lsGo=async el=>{const id=el.dataset.id,kind=el.dataset.x,folder=el.dataset.f;const it=get('items',id);closeModal();
  ui.lsBusy=Object.assign({},ui.lsBusy,{[id]:kind==='archive'?'Sedang simpan':'Sedang buang'});render();
  toast(kind==='archive'?'Mac mini sedang salin ke Drive':'Mac mini sedang buang folder');
  try{const r=await studioJob(kind==='archive'?'archive':'listing_del',{folder,item:id,name:[it.brand,it.title].filter(Boolean).join(' ')||folder},15*60000);
    if(kind==='archive')save('items',Object.assign({},get('items',id),{listingLink:r.link,listingAt:Date.now()}));
    else save('items',Object.assign({},get('items',id),{listingGone:Date.now()}));
    toast(kind==='archive'?'Siap: '+r.files+' fail dalam Drive, folder asal ke Trash':'Folder dibuang ke Trash')}
  catch(e){toast(e&&e.code==='unavailable'?'Tiada internet':'Tak berjaya: '+String((e&&e.message)||'Mac mini tak jawab').slice(0,90))}
  finally{const b=Object.assign({},ui.lsBusy);delete b[id];ui.lsBusy=b;render()}};
A.toEditAsk=el=>{const it=get('items',el.dataset.id);modal(`<h2>Masuk folder edit mana?</h2><div class="list">${FOLDERS.map(f=>`<button class="btn" style="justify-content:flex-start;gap:12px;--bc:${FCOL[fno(f)]}" data-act="toEdit" data-id="${it.id}" data-x="${esc(f)}"><b>${fno(f)}</b>${esc(f.replace(/^\d+\.\s*/,''))}</button>`).join('')}</div>`,TAB['to-edit'].c)};
A.toEdit=el=>{closeModal();moveItem(get('items',el.dataset.id),'toedit',{folder:el.dataset.x})};

