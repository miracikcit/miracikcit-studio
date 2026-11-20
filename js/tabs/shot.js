/* ---------- SHOT ---------- */
function shotList(){const list=byStage('shot');if(!list.length)return '';
  return `<p class="eyebrow" style="margin:4px 0 10px">Dah shoot, pilih folder edit · ${list.length}</p><div class="list" style="margin-bottom:18px">${list.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title||'Nota')}</h3><div class="meta">${esc([it.brand,it.shotAt?'shoot '+fmtD(it.shotAt):''].filter(Boolean).join(' · '))} ${accPill(it.account)}</div></div>${it.listingLink?`<span class="pill" style="--pc:var(--ok)">Diarkib</span>`:it.listingGone?`<span class="pill">Listing dibuang</span>`:ui.lsBusy&&ui.lsBusy[it.id]?`<span class="pill" style="--pc:var(--warn)">${ui.lsBusy[it.id]}</span>`:`<span class="pill">Listing dalam R1</span>`}</div>${sampleBlock(it)}
    <label class="f" style="margin-top:12px"><span>Link folder product listing (Google Drive)</span><input class="inp" id="ll-${it.id}" data-col="items" data-id="${it.id}" data-f="listingLink" data-url="1" value="${esc(it.listingLink||'')}" placeholder="https://drive.google.com/drive/folders/..." inputmode="url"></label>
    <div class="btns">${it.listingLink?`<a class="btn sm" href="${esc(it.listingLink)}" target="_blank" rel="noopener">${IC.ext}Buka folder</a>`:''}
     <button class="btn sm" data-act="nota" data-id="${it.id}">Nota</button><button class="btn sm solid tab" data-act="toEditAsk" data-id="${it.id}">Pilih folder edit${IC.next}</button><button class="btn icon sm" data-act="unShot" data-id="${it.id}" aria-label="Pindah balik ke To Shoot">${IC.back}</button></div></div>`).join('')}</div>`}
V.shot=()=>head('Dah shoot')+(shotList()||`<div class="empty">Belum ada. Tekan Shot dalam tab Shoot.</div>`);
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

/* Lepas final: Best (simpan listing ke Drive, buang dari Mac) atau Tak best (buang ke Trash). */
function lsFolderOf(it){const fs=((S.sync.folders||{}).folders)||[];const f=it.listing&&it.listing.folder;if(f&&fs.some(x=>x.name===f))return f;return lsGuess(it)}
const lsPending=()=>S.items.filter(it=>(it.stage==='ready'||it.stage==='published')&&!it.listingLink&&!it.listingGone&&lsFolderOf(it));
function lsChoice(){const list=lsPending();if(!list.length)return '';
  return `<div class="card glass" style="margin-bottom:14px"><p class="eyebrow" style="margin:0">Video dah siap · listing dalam Mac</p><h3 style="margin:4px 0 2px">Barang best?</h3><p class="meta" style="margin:0 0 6px">Best: listing disimpan dalam Drive untuk next video, dibuang dari Mac. Tak best: listing dibuang ke Trash.</p>
   ${list.map(it=>{const busy=ui.lsBusy&&ui.lsBusy[it.id];return `<div class="rowh" style="align-items:center;gap:8px;margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><div style="min-width:0"><strong>${esc(it.title)}</strong><span class="meta" style="display:block">R1 / ${esc(lsFolderOf(it))}</span></div>
    ${busy?`<span class="pill" style="--pc:var(--warn)">${esc(busy)}</span>`:`<div class="btns" style="gap:6px;flex-wrap:nowrap"><button class="btn sm solid tab" data-act="lsBest" data-id="${it.id}">⭐ Best</button><button class="btn sm bad" data-act="lsBad" data-id="${it.id}">Tak best</button></div>`}</div>`}).join('')}</div>`}
A.lsBest=el=>{const it=get('items',el.dataset.id);lsGo2(it,'archive')};
A.lsBad=el=>{const it=get('items',el.dataset.id);confirmBox('Buang listing "'+it.title+'" ke Trash Mac? Masih boleh pulih dari Trash.',()=>lsGo2(it,'del'),'Ya, buang')};
async function lsGo2(it,kind){const id=it.id,folder=lsFolderOf(it);if(!folder){toast('Folder listing tak dijumpai');return}
  ui.lsBusy=Object.assign({},ui.lsBusy,{[id]:kind==='archive'?'Simpan ke Drive...':'Sedang buang...'});render();
  try{const r=await studioJob(kind==='archive'?'archive':'listing_del',{folder,item:id,best:kind==='archive',name:[it.brand,it.title].filter(Boolean).join(' ')||folder},15*60000);
    const cur=get('items',id)||it;
    save('items',Object.assign({},cur,kind==='archive'?{listingLink:r.link,listingAt:Date.now(),listingBest:true,listingFiles:r.manifest||[]}:{listingGone:Date.now()}));
    toast(kind==='archive'?'⭐ '+r.files+' gambar dalam Drive, Mac dah lapang':'Listing dibuang ke Trash')}
  catch(e){toast(e&&e.code==='unavailable'?'Tiada internet':'Tak berjaya: '+String((e&&e.message)||'Mac mini tak jawab').slice(0,90))}
  finally{const b=Object.assign({},ui.lsBusy);delete b[id];ui.lsBusy=b;render()}}
/* Barang best: ambil balik listing dari Drive ke R1 untuk video seterusnya */
function lsBestRow(its){const it=(its||[]).find(x=>x.listingBest&&x.listingLink);if(!it)return '';const busy=ui.lsBusy&&ui.lsBusy[it.id];
  return `<div class="rowh" style="align-items:center;gap:8px;margin-top:10px"><span class="meta">⭐ Listing best dalam Drive</span><div class="btns" style="gap:6px;flex-wrap:nowrap"><a class="btn sm" href="${esc(it.listingLink)}" target="_blank" rel="noopener">${IC.ext}Drive</a>${(it.listingFiles||[]).length?`<button class="btn sm solid tab" data-act="lsBack" data-id="${it.id}"${busy?' disabled':''}>${busy?esc(busy):'Ambil balik'}</button>`:''}</div></div>`}
A.lsBack=async el=>{const it=get('items',el.dataset.id);const id=it.id;ui.lsBusy=Object.assign({},ui.lsBusy,{[id]:'Muat turun...'});render();
  try{const r=await studioJob('listing_restore',{name:[it.brand,it.title].filter(Boolean).join(' ')||it.title,files:it.listingFiles},15*60000);
    save('items',Object.assign({},get('items',id)||it,{listing:Object.assign({},it.listing,{folder:r.folder})}));toast('Listing ada semula dalam R1 / '+r.folder)}
  catch(e){toast('Tak berjaya ambil balik. Semak Mac mini hidup')}
  finally{const b=Object.assign({},ui.lsBusy);delete b[id];ui.lsBusy=b;render()}};
