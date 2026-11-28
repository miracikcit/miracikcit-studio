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
A.toEditAsk=el=>{const it=get('items',el.dataset.id);modal(`<h2>Masuk folder edit mana?</h2><div class="list">${FOLDERS.map(f=>`<button class="btn" style="justify-content:flex-start;gap:12px;--bc:${FCOL[fno(f)]}" data-act="toEdit" data-id="${it.id}" data-x="${esc(f)}"><b>${fno(f)}</b>${esc(f.replace(/^\d+\.\s*/,''))}</button>`).join('')}</div>`,TAB['to-edit'].c)};
A.toEdit=el=>{closeModal();const it=get('items',el.dataset.id);moveItem(it,'toedit',{folder:el.dataset.x});mkEditFolder(el.dataset.x,it.title)};

/* Lepas final: Best (simpan listing ke Drive, buang dari Mac) atau Tak best (buang ke Trash). */
function lsFolderOf(it){const fs=((S.sync.folders||{}).folders)||[];const f=it.listing&&it.listing.folder;if(f&&fs.some(x=>x.name===f))return f;return lsGuess(it)}
const lsPending=()=>S.items.filter(it=>(it.stage==='ready'||it.stage==='published')&&!it.listingLink&&!it.listingGone&&lsFolderOf(it));
/* Listing lama dalam R1 yang tiada kad aktif (sebelum aliran Best / Tak best wujud). Mira pilih sekali. */
function lsLegacy(){const fs=((S.sync.folders||{}).folders)||[];const keep=((S.settings||{}).lsKeep)||[];
  const used=new Set(S.items.filter(it=>!it.listingLink&&!it.listingGone).map(it=>lsFolderOf(it)).filter(Boolean));
  const edits=toEditFolders().map(f=>nrm(f.name));const words1=n=>nrm(String(n).split(/\s+/)[0]);
  return fs.filter(f=>!used.has(f.name)&&!keep.includes(f.name)&&(f.mtime||0)<Date.now()-14*DAY&&!edits.some(e=>{const w=words1(f.name);return w.length>=4&&e.startsWith(w)})&&!activeSamples().some(it=>itMatch(it,f.name)))}
function lsChoiceOld(){const list=lsLegacy();if(!list.length)return '';
  return `<div class="card glass" style="margin-bottom:14px;box-shadow:0 0 0 1.5px #E9BD45 inset"><p class="eyebrow" style="margin:0">Kemas listing lama · ${list.length}</p><h3 style="margin:4px 0 2px">Folder dalam R1 tanpa projek aktif</h3><p class="meta" style="margin:0 0 6px">⭐ Best: simpan ke Drive, buang dari Mac. Tak best: ke Trash. Masih guna: biar dalam R1.</p>
   ${list.map(f=>{const busy=ui.lsBusy&&ui.lsBusy['old:'+f.name];return `<div class="rowh" style="align-items:center;gap:8px;margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><div style="min-width:0"><strong>${esc(f.name)}</strong><span class="meta" style="display:block">${f.images} gambar · ${fmtD(f.mtime)}</span></div>
    ${busy?`<span class="pill" style="--pc:var(--warn)">${esc(busy)}</span>`:`<div class="btns" style="gap:6px;flex-wrap:nowrap"><button class="btn sm solid tab" data-act="lsOld" data-x="archive" data-f="${esc(f.name)}">⭐ Best</button><button class="btn sm bad" data-act="lsOld" data-x="del" data-f="${esc(f.name)}">Tak best</button><button class="btn sm" data-act="lsKeep" data-f="${esc(f.name)}">Masih guna</button></div>`}</div>`}).join('')}</div>`}
A.lsKeep=el=>{const st=Object.assign({},S.settings||{});st.lsKeep=(st.lsKeep||[]).concat([el.dataset.f]);S.settings=st;saveDoc('settings/main',st);render();toast('Dibiar dalam R1')};
A.lsOld=el=>{const folder=el.dataset.f,kind=el.dataset.x;const go2=()=>{const it=save('items',{title:folder,stage:'published',sheetMatched:true,legacyListing:true,listing:{folder},stageAt:{published:Date.now()}},true);
    ui.lsBusy=Object.assign({},ui.lsBusy,{['old:'+folder]:kind==='archive'?'Simpan ke Drive...':'Sedang buang...'});render();
    lsGo2(it,kind).finally(()=>{const b=Object.assign({},ui.lsBusy);delete b['old:'+folder];ui.lsBusy=b;render()})};
  if(kind==='del')confirmBox('Buang listing "'+folder+'" ke Trash Mac? Masih boleh pulih dari Trash.',go2,'Ya, buang');else go2()};
function lsChoice(){const list=lsPending();const old=lsChoiceOld();if(!list.length)return old;
  return `<div class="card glass" style="margin-bottom:14px"><p class="eyebrow" style="margin:0">Video dah siap · listing dalam Mac</p><h3 style="margin:4px 0 2px">Barang best?</h3><p class="meta" style="margin:0 0 6px">Best: listing disimpan dalam Drive untuk next video, dibuang dari Mac. Tak best: listing dibuang ke Trash.</p>
   ${list.map(it=>{const busy=ui.lsBusy&&ui.lsBusy[it.id];return `<div class="rowh" style="align-items:center;gap:8px;margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><div style="min-width:0"><strong>${esc(it.title)}</strong><span class="meta" style="display:block">R1 / ${esc(lsFolderOf(it))}</span></div>
    ${busy?`<span class="pill" style="--pc:var(--warn)">${esc(busy)}</span>`:`<div class="btns" style="gap:6px;flex-wrap:nowrap"><button class="btn sm solid tab" data-act="lsBest" data-id="${it.id}">⭐ Best</button><button class="btn sm bad" data-act="lsBad" data-id="${it.id}">Tak best</button></div>`}</div>`}).join('')}</div>`+old}
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
